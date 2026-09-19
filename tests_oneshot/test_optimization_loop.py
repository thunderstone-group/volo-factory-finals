import unittest

from scripts.arc_optimization_loop import Round, evaluate_round


def round_data(round_id, change_id, values, *, gate=True):
    samples = []
    for sample_id, sample_values in values:
        tasks = {}
        for task, passed, total, failures in sample_values:
            tasks[task] = {
                "passed": passed,
                "total": total,
                "delivered": True,
                "failures": failures,
            }
        samples.append({"id": sample_id, "tasks": tasks})
    return {
        "round_id": round_id,
        "change_id": change_id,
        "local_gate": {"passed": gate, "problems": [] if gate else ["synthetic gate failure"]},
        "samples": samples,
    }


TASK_TOTALS = {"keep": 32, "bookstack": 34, "stackoverflow": 66, "prestashop": 86, "12306": 135, "ctrip": 125}


def all_tasks(overrides=None):
    overrides = overrides or {}
    rows = []
    for task, total in TASK_TOTALS.items():
        passed, failures = overrides.get(task, (total // 2, {}))
        rows.append((task, passed, total, failures))
    return rows


class OptimizationLoopTests(unittest.TestCase):
    def test_keeps_two_sample_target_gain_without_non_target_regression(self):
        baseline_rows = all_tasks({"12306": (60, {"header-role": 40}), "ctrip": (25, {"login-fields": 80})})
        candidate_rows = all_tasks({"12306": (88, {"header-role": 12}), "ctrip": (48, {"login-fields": 35})})
        baseline = round_data("r27", "baseline", [("a", baseline_rows), ("b", baseline_rows)])
        candidate = round_data("r28", "planner", [("a", candidate_rows), ("b", candidate_rows)])
        result = evaluate_round(Round.from_json(baseline), Round.from_json(candidate))
        self.assertEqual(result["decision"], "keep", result)
        self.assertGreaterEqual(result["target_gain"], 0.03)
        self.assertEqual(result["next_action"]["task"], "ctrip")

    def test_rejects_single_sample_even_when_score_is_higher(self):
        rows = all_tasks({"12306": (100, {}), "ctrip": (80, {})})
        baseline = round_data("r27", "baseline", [("a", all_tasks()), ("b", all_tasks())])
        candidate = round_data("r28", "planner", [("a", rows)])
        result = evaluate_round(Round.from_json(baseline), Round.from_json(candidate))
        self.assertEqual(result["decision"], "reject")
        self.assertTrue(any("2 are required" in reason for reason in result["reasons"]))

    def test_rejects_delivery_failure_before_score_comparison(self):
        rows = all_tasks({"12306": (0, {"protocol": 1})})
        baseline = round_data("r27", "baseline", [("a", all_tasks()), ("b", all_tasks())])
        candidate = round_data("r28", "parser", [("a", rows), ("b", rows)])
        candidate["samples"][0]["tasks"]["12306"]["delivered"] = False
        candidate["samples"][1]["tasks"]["12306"]["delivered"] = False
        result = evaluate_round(Round.from_json(baseline), Round.from_json(candidate))
        self.assertEqual(result["decision"], "reject")
        self.assertIn("12306", result["candidate"]["delivery_failures"])

    def test_rejects_non_target_regression(self):
        baseline_rows = all_tasks({"12306": (60, {}), "ctrip": (25, {})})
        candidate_rows = all_tasks({"12306": (90, {}), "ctrip": (50, {}), "bookstack": (15, {})})
        baseline = round_data("r27", "baseline", [("a", baseline_rows), ("b", baseline_rows)])
        candidate = round_data("r28", "planner", [("a", candidate_rows), ("b", candidate_rows)])
        result = evaluate_round(Round.from_json(baseline), Round.from_json(candidate))
        self.assertEqual(result["decision"], "reject")
        self.assertIn("bookstack", result["non_target_regressions"])

    def test_next_action_weights_large_task_failure_family(self):
        rows = all_tasks({
            "12306": (60, {"header-role": 49}),
            "ctrip": (25, {"login-fields": 40, "city-picker": 35}),
        })
        baseline = round_data("r27", "baseline", [("a", rows), ("b", rows)])
        candidate = round_data("r28", "probe", [("a", rows), ("b", rows)])
        result = evaluate_round(Round.from_json(baseline), Round.from_json(candidate))
        self.assertEqual(result["next_action"], {
            "task": "12306",
            "family": "header-role",
            "observed_failures": 98,
            "rule": "change one carrier or gate for this family, then rerun local replay before platform evaluation",
        })

    def test_rejected_candidate_without_attribution_falls_back_to_baseline_action(self):
        baseline_rows = all_tasks({"12306": (60, {"header-role": 49})})
        candidate_rows = all_tasks({"12306": (50, {})})
        baseline = round_data("r27", "baseline", [("a", baseline_rows), ("b", baseline_rows)])
        candidate = round_data("r28", "gate-only", [("a", candidate_rows)])
        result = evaluate_round(Round.from_json(baseline), Round.from_json(candidate))
        self.assertEqual(result["decision"], "reject")
        self.assertEqual(result["next_action"]["task"], "12306")
        self.assertEqual(result["next_action"]["family"], "header-role")


if __name__ == "__main__":
    unittest.main()
