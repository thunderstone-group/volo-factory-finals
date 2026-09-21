"""The pilot's acceptance and feedback separation invariants; synthetic control rows."""

from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from business_loop import decision
from business_model_step import feedback


def report(**states):
    return {
        "mode": "probe",
        "cases": [
            {"name": name, "passed": value, "errors": [], "observation": None}
            for name, value in states.items()
        ],
    }


class BusinessLoopTests(unittest.TestCase):
    def test_different_runtime_cannot_be_counted_as_improvement(self):
        before = report(login=True, search=False)
        after = report(login=True, search=True)
        before['runtime'] = {'workers': 1}
        after['runtime'] = {'workers': 4}
        with self.assertRaises(ValueError):
            decision(before, after)

    def test_improvement_must_preserve_previous_successes(self):
        result = decision(
            report(login=True, search=False, booking=False),
            report(login=False, search=True, booking=True),
        )
        self.assertFalse(result["accepted"])
        self.assertEqual(result["regressed"], ["login"])

    def test_strict_safe_improvement_is_accepted(self):
        self.assertTrue(
            decision(report(login=True, search=False), report(login=True, search=True))[
                "accepted"
            ]
        )

    def test_no_change_does_not_reset_stagnation(self):
        self.assertFalse(
            decision(
                report(login=True, search=False), report(login=True, search=False)
            )["accepted"]
        )

    def test_changed_check_id_cannot_be_silently_dropped(self):
        with self.assertRaises(ValueError):
            decision(report(login=True), report(search=True))

    def test_external_score_is_not_model_feedback(self):
        data = report(login=False)
        data["mode"] = "score"
        with self.assertRaises(ValueError):
            feedback(data)

    def test_feedback_preserves_successes_and_reports_actual_failures(self):
        data = feedback(report(login=True, search=False))
        self.assertEqual(data["successful_journeys_to_preserve"], ["login"])
        self.assertEqual(data["unresolved_journeys"], ["search"])
        self.assertEqual(data["observed_failures"][0]["journey"], "search")


if __name__ == "__main__":
    unittest.main()
