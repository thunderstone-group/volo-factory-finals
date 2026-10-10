#!/usr/bin/env python3
"""Best per-task finals runs of a submission and the resulting S.

Usage: ARCBENCH_ENV_FILE=~/.config/arcbench/volo.env python3 best_combo.py SUBMISSION [SUBMISSION ...]

S follows the finals leaderboard (verified 10-07 against 977c79cf0389, S 98.82):
p = passed / 60 * 100, expected cost = 0.24 * p, ratio = cost / expected,
S = p / ratio**0.1 when ratio <= 1, else p / ratio**0.2.
Per task the best run is the most passed, then the lower cost (the platform's own
tie rule is unverified).
"""
import json
import subprocess
import sys

TASKS = ("github", "sheet")


def runs(sub):
    out = subprocess.run(["arcbench", "--json", "runs", "--submission", sub, "--limit", "100"],
                         capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def score(passed, cost):
    p = passed / 60 * 100
    if p == 0:
        return 0.0
    ratio = cost / (0.24 * p)
    return p / ratio ** (0.1 if ratio <= 1 else 0.2)


for sub in sys.argv[1:]:
    rows = runs(sub)
    best = {}
    for task in TASKS:
        done = [r for r in rows if r["requirement_id"].endswith("--" + task) and r["status"] == "PASSED"
                and r["cost"]["amount"] is not None]
        tally = " ".join(str(r["passed"]) for r in sorted(done, key=lambda r: r["finished_at"]))
        active = sum(r["status"] in ("RUNNING", "QUEUED", "PENDING") for r in rows if r["requirement_id"].endswith("--" + task))
        if done:
            best[task] = max(done, key=lambda r: (r["passed"], -r["cost"]["amount"]))
            b = best[task]
            print(f"{sub} {task}: runs [{tally}] active {active}; best {b['run_id']} {b['passed']}/30 {b['cost']['amount']:.3f} CNY")
        else:
            print(f"{sub} {task}: no finished run; active {active}")
    if len(best) == len(TASKS):
        passed = sum(b["passed"] for b in best.values())
        cost = sum(b["cost"]["amount"] for b in best.values())
        print(f"{sub} combo: {passed}/60, {cost:.3f} CNY, S {score(passed, cost):.2f}")
