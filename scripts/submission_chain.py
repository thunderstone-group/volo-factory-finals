#!/usr/bin/env python3
"""Resample an official package: upload it as a new submission, run both tasks, wait, record, repeat.

The final score is the best single submission, and one package's submissions vary widely (GitHub 7-21 of 100 on
09-24/25), so repeated submissions of the best package raise the expected best. Each round is a new submission, so a
poor sample never overwrites an earlier one.

    python scripts/submission_chain.py --package PKG.zip --name-prefix volo-oneshot-8ce4fe6c \
        --rounds 6 --reserve 150 --log runs.jsonl

Stops after --rounds, when the team budget falls below --reserve CNY, at --until (local ISO time; no new
submission starts after it), or when a run cannot be started. Starts nothing while any run is still active.
Needs the `arcbench` CLI and ARCBENCH_ENV_FILE."""
import argparse
import datetime as dt
import json
import subprocess
import sys
import time
from pathlib import Path

COMPETITION = "hackathon"
POLL = 120


def arc(*args):
    out = subprocess.run(["arcbench", *args], capture_output=True, text=True, timeout=600)
    if out.returncode not in (0, 1):
        raise RuntimeError(f"arcbench {' '.join(args)} exited {out.returncode}: {out.stderr.strip()[-400:]}")
    return out.stdout


def arc_json(*args):
    text = arc(*args, "--json")
    if "[" not in text and "{" not in text:
        raise RuntimeError(f"arcbench {' '.join(args)} returned no JSON: {text.strip()[-300:]}")
    return json.loads(text[text.index("[") if text.lstrip().startswith("[") else text.index("{"):])


def patient(fn, *args, tries=5):
    """A read that the platform answered without JSON is asked again: on 09-25 one such answer to a status poll ended the
    relay in its first round and the queue stood idle. Uploads and run starts are never repeated."""
    for attempt in range(tries):
        try:
            return fn(*args)
        except (RuntimeError, ValueError, subprocess.TimeoutExpired) as exc:
            if attempt == tries - 1:
                raise
            print(f"retrying {fn.__name__}: {str(exc)[:300]}", file=sys.stderr, flush=True)
            time.sleep(POLL)


def active_runs():
    runs = arc_json("runs", "--limit", "10")
    return [r["run_id"] for r in runs if r.get("status") in ("RUNNING", "QUEUED", "PENDING")]


def budget():
    return float(arc_json("registration", COMPETITION)["remaining_budget_cny"])


def status(run_id):
    data = arc_json("status", run_id)
    return data[0] if isinstance(data, list) else data


def log(path, record):
    record["at"] = dt.datetime.now().isoformat(timespec="seconds")
    with open(path, "a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, ensure_ascii=False) + "\n")
    print(json.dumps(record, ensure_ascii=False), flush=True)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--package", required=True, type=Path)
    parser.add_argument("--name-prefix", required=True)
    parser.add_argument("--rounds", type=int, default=1)
    parser.add_argument("--reserve", type=float, default=150.0, help="stop when the team budget is below this (CNY)")
    parser.add_argument("--until", help="local ISO time after which no new submission starts")
    parser.add_argument("--model", default="deepseek-v4-flash")
    parser.add_argument("--log", required=True, type=Path)
    args = parser.parse_args(argv)
    until = dt.datetime.fromisoformat(args.until) if args.until else None
    for number in range(1, args.rounds + 1):
        while patient(active_runs):
            time.sleep(POLL)
        left = patient(budget)
        if left < args.reserve:
            log(args.log, {"event": "stop", "reason": f"budget {left:.2f} below reserve {args.reserve}"})
            return 0
        if until and dt.datetime.now() >= until:
            log(args.log, {"event": "stop", "reason": f"past {args.until}"})
            return 0
        upload = arc_json("upload", "--competition", COMPETITION, "--official-evaluation", "--model", args.model,
                          "--runtime", "python", "--name", f"{args.name_prefix}-r{number}", str(args.package))
        submission = upload["submission"]["id"]
        if not upload.get("archive_verified"):
            log(args.log, {"event": "stop", "reason": "archive not verified", "submission": submission})
            return 1
        started = arc("run", submission, "--all-tasks")
        runs = [line.split()[0] for line in started.splitlines() if line.strip() and COMPETITION in line]
        if len(runs) != 2:
            log(args.log, {"event": "stop", "reason": "could not start both runs", "output": started[-400:]})
            return 1
        log(args.log, {"event": "started", "round": number, "submission": submission, "runs": runs,
                       "budget_before": left, "package": str(args.package)})
        results = {}
        while len(results) < len(runs):
            time.sleep(POLL)
            for run_id in runs:
                if run_id in results:
                    continue
                record = patient(status, run_id)
                if record.get("status") not in ("RUNNING", "QUEUED", "PENDING"):
                    results[run_id] = {k: record.get(k) for k in ("requirement_id", "status", "passed", "failed",
                                                                  "cost", "duration_seconds", "failure_reason")}
        passed = sum((r.get("passed") or 0) for r in results.values())
        cost = sum(((r.get("cost") or {}).get("amount") or 0) for r in results.values())
        p = passed / 2
        ratio = cost / (0.8 * p) if p else 0  # the board's expected cost is 0.8 p (docs/reference/preliminary-rules.md)
        score = p / ratio ** (0.1 if ratio <= 1 else 0.2) if p and cost else 0
        log(args.log, {"event": "finished", "round": number, "submission": submission, "results": results,
                       "p": p, "cost": round(cost, 4), "S": round(score, 2)})
    return 0


if __name__ == "__main__":
    sys.exit(main())
