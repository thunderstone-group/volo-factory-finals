#!/usr/bin/env python3
"""Calibrate the scenario self-check against public-test verdicts on replayed applications.

    python scripts/calibrate_scenarios.py --requirements REQUIREMENTS.yaml REPLAY_DIR [REPLAY_DIR ...]
        [--jobs 4] [--out summary.json]

Each replay directory holds `application/` (frontend/ and backend/) and `result.json`, whose `cases`
carry the public tests' verdict per requirement id. Only `result.json` is read on the evaluator side.
The self-check runs on every application (`--jobs` at a time, each on its own free ports) and its
verdicts are aligned with the cases by requirement id; a requirement with several scenarios fails when
any of them fails. Agreement and false passes are counted over requirements the self-check decided
(pass or fail) and the public tests cover; unparsed and error verdicts are reported separately.
"""
import argparse
import collections
import concurrent.futures
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from oneshot import scenario_check  # noqa: E402


def _label(replay):
    parts = Path(replay).resolve().parts
    return "__".join(parts[-2:])


def _application(replay):
    replay = Path(replay)
    if (replay / "application" / "frontend").is_dir():
        return replay / "application"
    if (replay / "frontend").is_dir():
        return replay
    return None


def verdicts(report):
    """Requirement id -> pass / fail / unparsed / error from a self-check report."""
    grouped = collections.defaultdict(list)
    for scenario in report["scenarios"]:
        grouped[scenario["id"].split("#", 1)[0]].append(scenario["status"])
    out = {}
    for rid, statuses in grouped.items():
        if "fail" in statuses:
            out[rid] = "fail"
        elif "error" in statuses:
            out[rid] = "error"
        elif all(s == "unparsed" for s in statuses):
            out[rid] = "unparsed"
        elif all(s in ("pass", "unparsed") for s in statuses):
            out[rid] = "pass"
        else:
            out[rid] = "error"
    return out


def compare(report, cases):
    """Counts for one application: verdict pairs plus the disagreeing requirement ids."""
    mine = verdicts(report)
    official = {case["id"]: bool(case.get("passed")) for case in cases}
    counts = collections.Counter()
    disagreements = []
    for rid, passed in official.items():
        status = mine.get(rid, "missing")
        if status in ("unparsed", "error", "missing"):
            counts[status] += 1
            continue
        counts["compared"] += 1
        if (status == "pass") == passed:
            counts["agree"] += 1
            counts["agree_pass" if passed else "agree_fail"] += 1
        elif status == "pass":
            counts["false_pass"] += 1
            disagreements.append({"id": rid, "self": status, "public": "pass" if passed else "fail"})
        else:
            counts["false_fail"] += 1
            disagreements.append({"id": rid, "self": status, "public": "pass" if passed else "fail"})
    observations = {s["id"].split("#", 1)[0]: s["observation"] for s in report["scenarios"]}
    for item in disagreements:
        item["observation"] = observations.get(item["id"], "")
    return counts, disagreements


def _rate(numerator, denominator):
    return round(numerator / denominator, 4) if denominator else None


def calibrate(requirements, replays, jobs=4, out=None, log=print):
    requirements = Path(requirements)
    work = []
    for replay in replays:
        replay = Path(replay)
        app, result = _application(replay), replay / "result.json"
        if app is None or not result.is_file():
            log(f"skip {replay}: needs application/ and result.json")
            continue
        work.append((replay, app, json.loads(result.read_text(encoding="utf-8"))))
    reports_dir = Path(str(out) + ".d") if out else None
    if reports_dir:
        reports_dir.mkdir(parents=True, exist_ok=True)

    def one(entry):
        replay, app, _ = entry
        target = reports_dir / f"{_label(replay)}.json" if reports_dir else None
        return scenario_check.run(requirements, app, target)

    started = time.monotonic()
    rows, total, all_disagreements = [], collections.Counter(), []
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, jobs)) as pool:
        futures = {pool.submit(one, entry): entry for entry in work}
        for future in concurrent.futures.as_completed(futures):
            replay, _, result = futures[future]
            report = future.result()
            counts, disagreements = compare(report, result.get("cases") or [])
            total.update(counts)
            row = {"replay": str(replay), "public": f"{result.get('passed')}/{result.get('total')}",
                   "self": dict(collections.Counter(s["status"] for s in report["scenarios"])),
                   "coverage": report["coverage"], "seconds": report["seconds"], **dict(counts),
                   "invariant_failures": sum(1 for i in report["invariants"] if i["status"] == "fail"),
                   "disagreements": disagreements}
            rows.append(row)
            for item in disagreements:
                all_disagreements.append(dict(item, replay=_label(replay)))
            log(f"{_label(replay)}: public {row['public']}, self {row['self']}, agree {counts['agree']}/"
                f"{counts['compared']}, false pass {counts['false_pass']}, false fail {counts['false_fail']}, "
                f"{report['seconds']} s")
    rows.sort(key=lambda r: r["replay"])
    summary = {
        "requirements": str(requirements), "replays": len(rows), "seconds": round(time.monotonic() - started, 1),
        "compared": total["compared"], "agree": total["agree"], "agree_pass": total["agree_pass"],
        "agree_fail": total["agree_fail"], "false_pass": total["false_pass"],
        "false_fail": total["false_fail"], "unparsed": total["unparsed"], "error": total["error"] + total["missing"],
        "agreement_rate": _rate(total["agree"], total["compared"]),
        "false_pass_rate": _rate(total["false_pass"], total["compared"]),
        "missed_public_failures": _rate(total["false_pass"], total["false_pass"] + total["agree_fail"]),
        "rows": rows,
        "disagreements_by_requirement": dict(collections.Counter(d["id"] for d in all_disagreements).most_common()),
    }
    if out:
        Path(out).write_text(json.dumps(summary, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    return summary


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--requirements", required=True, type=Path)
    parser.add_argument("replays", nargs="+", type=Path, help="replay directories (application/ + result.json)")
    parser.add_argument("--jobs", type=int, default=4, help="applications checked in parallel (default 4)")
    parser.add_argument("--out", type=Path, help="summary JSON; per-application reports go to <out>.d/")
    args = parser.parse_args(argv)
    summary = calibrate(args.requirements, args.replays, args.jobs, args.out,
                        log=lambda line: print(line, file=sys.stderr))
    print(json.dumps({k: v for k, v in summary.items() if k not in ("rows",)}, indent=1, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
