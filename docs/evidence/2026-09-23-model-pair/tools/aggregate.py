#!/usr/bin/env python3
"""Build the per-sample evidence JSON and the summary for the model-pair experiment (no network)."""
import json
import math
import statistics as st
import sys
from pathlib import Path

S = Path(__file__).resolve().parent
sys.path.insert(0, str(S))
from parse_sample import summarize  # noqa: E402

OUT = Path.home() / "projects/volo-factory-worktrees/model-pair-20260923/docs/evidence/2026-09-23-model-pair"
MODELS = ["deepseek-v4-flash", "kimi-k2.7-code-highspeed"]
TAG = {"deepseek-v4-flash": "flash", "kimi-k2.7-code-highspeed": "kimi"}
TASKS = ["keep", "bookstack", "12306"]
TOTAL = {"keep": 32, "bookstack": 34, "12306": 135}
PAIRS = [("keep", "12306"), ("bookstack", "12306"), ("keep", "bookstack")]


def score(passed, total, cost):
    """Preliminary-round formula: p in percent, b in CNY, b0 = 1.2, alpha = 0.1, beta = 0.2."""
    p = 100.0 * passed / total
    if p == 0:
        return 0.0
    ratio = cost / (1.2 * p)
    return p / ratio ** (0.1 if ratio <= 1 else 0.2)


def mean_sd(values):
    values = [v for v in values if v is not None]
    if not values:
        return None, None
    return st.mean(values), (st.stdev(values) if len(values) > 1 else None)


def r(x, n=4):
    return round(x, n) if isinstance(x, float) else x


def analyse(rows, passed_key="passed"):
    per = {}
    for m in MODELS:
        per[m] = {}
        for t in TASKS:
            rs = [x for x in rows if x["model"] == m and x["task"] == t and x.get(passed_key) is not None]
            pm, psd = mean_sd([x[passed_key] for x in rs])
            cm, csd = mean_sd([x["cost_cny"] for x in rs])
            wm, wsd = mean_sd([x["wall_seconds"] for x in rs])
            per[m][t] = {"n": len(rs), "samples": [x["sample"] for x in rs], "passed": [x[passed_key] for x in rs],
                         "total": TOTAL[t], "passed_mean": r(pm), "passed_sd": r(psd),
                         "pass_rate_mean_percent": r(pm / TOTAL[t] * 100) if pm is not None else None,
                         "cost_cny": [x["cost_cny"] for x in rs], "cost_mean": r(cm), "cost_sd": r(csd),
                         "wall_seconds_mean": r(wm, 1), "wall_seconds_sd": r(wsd, 1)}
    pairs = {}
    for a, b in PAIRS:
        name = f"{a}+{b}"
        pairs[name] = {}
        for m in MODELS:
            ra = [x for x in rows if x["model"] == m and x["task"] == a and x.get(passed_key) is not None]
            rb = [x for x in rows if x["model"] == m and x["task"] == b and x.get(passed_key) is not None]
            if not ra or not rb:
                pairs[name][TAG[m]] = None
                continue
            grid = [[score(x[passed_key] + y[passed_key], TOTAL[a] + TOTAL[b], x["cost_cny"] + y["cost_cny"]) for y in rb]
                    for x in ra]
            flat = [v for line in grid for v in line]
            row_means = [st.mean(line) for line in grid]
            col_means = [st.mean(col) for col in zip(*grid)]
            var = (st.variance(row_means) / len(ra) if len(ra) > 1 else 0.0) + \
                  (st.variance(col_means) / len(rb) if len(rb) > 1 else 0.0)
            pa, pb = per[m][a], per[m][b]
            pairs[name][TAG[m]] = {
                "combinations": len(flat), "S_mean": r(st.mean(flat)), "S_se": r(math.sqrt(var)),
                "S_min": r(min(flat)), "S_max": r(max(flat)),
                "p_mean_percent": r((pa["passed_mean"] + pb["passed_mean"]) / (TOTAL[a] + TOTAL[b]) * 100),
                "cost_mean_cny": r(pa["cost_mean"] + pb["cost_mean"]),
                "S_at_means": r(score(pa["passed_mean"] + pb["passed_mean"], TOTAL[a] + TOTAL[b],
                                      pa["cost_mean"] + pb["cost_mean"])),
                "S_grid": [[r(v, 3) for v in line] for line in grid],
                "grid_rows": [f"{a}-{x['sample']}" for x in ra], "grid_cols": [f"{b}-{y['sample']}" for y in rb]}
        f, k = pairs[name].get("flash"), pairs[name].get("kimi")
        if f and k:
            diff = f["S_mean"] - k["S_mean"]
            thr = f["S_se"] + k["S_se"]
            pairs[name]["verdict"] = {"S_diff_flash_minus_kimi": r(diff), "se_sum": r(thr),
                                      "winner": ("flash" if diff > 0 else "kimi") if abs(diff) > thr else "indistinguishable"}
    return {"per_model_task": per, "pairs": pairs}


def main():
    contaminated = json.loads((S / "contaminated.json").read_text())
    reconciled = json.loads((S / "billing" / "reconciled.json").read_text())
    rows = []
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "samples").mkdir(exist_ok=True)
    for d in sorted(p for p in (S / "gens").glob("*/*") if (p / "meta.json").is_file()):
        s = summarize(d)
        key = f"{TAG[s['model']]}-{s['task']}-{s['sample']}"
        replay = json.loads((d / "replay-result.json").read_text()) if (d / "replay-result.json").is_file() else None
        pass2 = json.loads((d / "replay-result-pass2.json").read_text()) if (d / "replay-result-pass2.json").is_file() else None
        billing = reconciled["samples"].get(f"{s['model']}|{s['task']}|{s['sample']}")
        complete = billing is not None and not billing["unmatched_calls"]
        ev = s["events"]
        mixed = bool(s["fallback_model_engaged"]) or len(s["models_used"]) > 1
        if mixed != bool(contaminated["samples"].get(key)):
            raise SystemExit(f"{key}: model switch detection disagrees with contaminated.json")
        row = {
            "sample_id": key, "model": s["model"], "task": s["task"], "sample": s["sample"],
            "passed": replay.get("passed") if replay else None, "total": TOTAL[s["task"]],
            "replay_tool": replay.get("tool") if replay else None,
            "passed_replay_pass2": pass2.get("passed") if pass2 else None,
            "mixed_model": mixed,
            "excluded_from_primary": contaminated["samples"].get(key),
            "cost_cny": billing["metered_cost_cny"] if complete else s["local_cost_cny"],
            "cost_basis": ("gateway metered: every completed call matched on exact model and input/output tokens; "
                           "failed or cut calls have no billed request") if complete else "local usage x price (unreconciled)",
            "local_ledger_cny": s["local_cost_cny"],
            "wall_seconds": s["wall_seconds"], "exit_code": s["exit_code"], "delivered": s["delivered"],
            "files_written": s["files_written"],
            "calls_completed": s["calls_completed"], "calls_failed": s["calls_failed"],
            "draft_calls_completed": s["draft_calls_completed"], "repair_calls_completed": s["repair_calls_completed"],
            "models_used": s["models_used"], "fallback_model_engaged": s["fallback_model_engaged"],
            "continuation": ev["continue_inside_file"] + ev["continue_between_files"] + ev["continue_after_framing_break"],
            "cut_stream_kept": ev["cut_stream_kept"], "transport_fallback": ev["transport_fallback"],
            "content_filter": ev["content_filter"], "empty_reply_retry": ev["empty_reply_retry"] + ev["framing_retry"],
            "bounded_retry": ev["bounded_retry"], "delivered_after_error": ev["delivered_after_error"],
            "closed_unterminated_block": ev["closed_unterminated_block"],
            "smoke_problems_before": s["smoke_problems_before"],
            "repairs": s["repairs"], "repair_accepted_any": s["repair_accepted_any"],
        }
        detail = {**row, "events": ev, "usage_summary": s["usage_summary"], "calls": s["calls"],
                  "billing_rows": billing["rows"] if billing else None, "replay": replay, "replay_pass2": pass2}
        (OUT / "samples" / f"{key}.json").write_text(json.dumps(detail, indent=2, ensure_ascii=False) + "\n")
        rows.append(row)

    primary_rows = [x for x in rows if not x["excluded_from_primary"]]
    summary = {
        "experiment": "Model pair on the frozen oneshot candidate (main 1f697d8, oneshot tree d31afba): "
                      "deepseek-v4-flash vs kimi-k2.7-code-highspeed, local generations and local replays, 2026-09-23",
        "formula": "p=0 -> S=0; b<=1.2p -> S=p/(b/(1.2p))^0.1; b>1.2p -> S=p/(b/(1.2p))^0.2; "
                   "p = combined passed/combined total in percent, b = combined cost in CNY",
        "pairing": "S is computed for every combination of one sample of each task (same model); S_mean is their mean. "
                   "S_se is the first-order two-sample U-statistic standard error: SE^2 = var(row means)/n_a + "
                   "var(column means)/n_b. Verdict: |S_mean(flash) - S_mean(kimi)| > S_se(flash) + S_se(kimi), "
                   "otherwise indistinguishable.",
        "cost_basis": "gateway metered amount per call (exact match on model and input/output tokens); matches the "
                      "local usage x price ledger for every completed call; cut or refused calls were not billed",
        "replay": {"lite": "replay.py of exp/lite-first-20260922: image arc-business-feedback:20260921 (ARM64 build of "
                           "the official runner), 1 CPU, 2 GB, 1 worker, 10 s test and expect timeouts, public tests",
                   "12306": "harness_lab/state_rehearsal.py (bigtask-keep worktree) --profile hosted: host Playwright "
                            "1.61.1, 4 workers, 10 s timeouts, arc-bench clone a0d049c tests; calibration: round-28 "
                            "sample a app replayed 74/135, platform run 01ea1a853d95 scored 74/135. Pass 1 (primary) "
                            "ran after every generation ended; pass 2 is a robustness replay in reverse order."},
        "exclusions": contaminated,
        "mixed_model_rule": "a sample whose stderr has `the rest of this run uses` or whose usage.fallback_model is set "
                            "(models_used > 1) is a mixed-model sample and is not counted for either model",
        "mixed_model_cost_split": json.loads((S / "mixed-model.json").read_text()),
        "rows": rows,
        "primary": analyse(primary_rows),
        "as_run_all_samples": analyse(rows),
    }
    if all(x.get("passed_replay_pass2") is not None for x in primary_rows if x["task"] == "12306"):
        alt = [dict(x, passed=x["passed_replay_pass2"]) if x["task"] == "12306" else x for x in primary_rows]
        summary["robustness_12306_pass2"] = analyse(alt)
    extra = S / "summary-extra.json"
    if extra.is_file():
        summary.update(json.loads(extra.read_text()))
    (OUT / "summary.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False) + "\n")
    for x in rows:
        print(f"{x['sample_id']:20s} {x['passed']}/{x['total']} p2={x['passed_replay_pass2']} cost {x['cost_cny']:.4f} "
              f"wall {x['wall_seconds']:.0f} calls {x['calls_completed']}+{x['calls_failed']}f fb {x['transport_fallback']} "
              f"retry {x['bounded_retry']} cont {x['continuation']} cut {x['cut_stream_kept']} empty {x['empty_reply_retry']} "
              f"errdeliv {x['delivered_after_error']} repair {[y.get('accepted') for y in x['repairs']]}"
              + (" EXCLUDED" if x["excluded_from_primary"] else ""))
    for label in ("primary", "as_run_all_samples", "robustness_12306_pass2", "robustness_12306_mean_of_passes"):
        if label not in summary:
            continue
        print(f"== {label}")
        for m in MODELS:
            for t in TASKS:
                v = summary[label]["per_model_task"][m][t]
                print(f"   {TAG[m]:5s} {t:9s} n={v['n']} passed {v['passed']} mean {v['passed_mean']} sd {v['passed_sd']} "
                      f"cost {v['cost_mean']} sd {v['cost_sd']} wall {v['wall_seconds_mean']}")
        for name, v in summary[label]["pairs"].items():
            f, k = v.get("flash"), v.get("kimi")
            print(f"   {name:16s} flash S {f['S_mean']} se {f['S_se']} (p {f['p_mean_percent']}, c {f['cost_mean_cny']}) | "
                  f"kimi S {k['S_mean']} se {k['S_se']} (p {k['p_mean_percent']}, c {k['cost_mean_cny']}) -> {v.get('verdict')}")


if __name__ == "__main__":
    main()
