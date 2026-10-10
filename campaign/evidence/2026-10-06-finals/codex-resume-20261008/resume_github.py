#!/usr/bin/env python3
"""Finish the current v6 run; try once more only if time and quota permit."""
import fcntl
import json
import subprocess
import time
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

D = Path(__file__).resolve().parent
ROOT = D.parent
SUB = "218428c590f0"
TASK = "hackathon-evolution--github"
CLI = ["~/.local/bin/arcbench", "--env-file",
       "~/.config/arcbench/volo.env", "--json"]
TZ = ZoneInfo("Asia/Taipei")
CUTOFF = datetime(2026, 10, 8, 19, 15, tzinfo=TZ)
DEADLINE = datetime(2026, 10, 8, 20, 2, tzinfo=TZ)
ACTIVE = {"PENDING", "QUEUED", "RUNNING"}


def record(event, **details):
    row = {"at": datetime.now(TZ).isoformat(), "event": event, **details}
    with (D / "supervisor.jsonl").open("a") as handle:
        handle.write(json.dumps(row, ensure_ascii=False) + "\n")
    print(json.dumps(row, ensure_ascii=False), flush=True)


def cli(*args):
    result = subprocess.run(CLI + list(args), text=True, capture_output=True, timeout=60)
    value = json.loads(result.stdout)
    # The status command returns 1 for RUNNING as well as failed runs.
    valid_status = args[0] == "status" and isinstance(value, dict) and value.get("run_id") == args[1] and value.get("status")
    if result.returncode and not valid_status:
        raise RuntimeError(f"arcbench {args[0]} exited {result.returncode}")
    return value


def snapshot(name, value):
    (D / f"{name}.json").write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def main():
    lock = (D / "supervisor.lock").open("w")
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    rid, attempts, previous = "648c0b50de3f", 1, None
    record("attached", run_id=rid, submission=SUB, max_runs=2, target_passed=29,
           start_cutoff=CUTOFF.isoformat(), poll_end=DEADLINE.isoformat())
    while datetime.now(TZ) < DEADLINE:
        if (D / "STOP").exists():
            record("stopped_by_file", run_id=rid)
            return
        try:
            status = cli("status", rid)
            if isinstance(status, list):
                status = status[0]
            snapshot("current-run", status)
            if status["status"] != previous:
                record("state", run_id=rid, status=status["status"])
                previous = status["status"]
            if status["status"] in ACTIVE:
                time.sleep(30)
                continue
            record("finished", **status)
            snapshot(f"result-{rid}", status)
            with (ROOT / f"reruns-{SUB}-github.log").open("a") as handle:
                handle.write(f"{datetime.now(TZ):%m-%d %H:%M} done {rid} {status['status']} "
                             f"passed {status.get('passed')} failed {status.get('failed')} "
                             f"sec {status.get('duration_seconds')}\n")
            snapshot("leaderboard-after-run", cli("leaderboard", "--competition",
                     "hackathon-evolution", "--limit", "25"))
            if status.get("passed", 0) >= 29 or attempts >= 2 or datetime.now(TZ) >= CUTOFF:
                record("complete", run_id=rid, target_reached=status.get("passed", 0) >= 29,
                       attempts=attempts)
                return
            # Only a completed scored run permits another attempt. Transport or
            # agent failures are evidence to inspect, not an automatic retry.
            if status["status"] != "PASSED":
                record("halt_after_failure", run_id=rid)
                return
            budget = cli("registration", "hackathon-evolution")
            snapshot("budget-before-next", budget)
            if budget.get("remaining_budget_cny", 0) < 5:
                record("halt_for_budget", remaining_budget_cny=budget.get("remaining_budget_cny"))
                return
            runs = cli("runs", "--limit", "100")
            if any(r.get("requirement_id") == TASK and r["status"] in ACTIVE for r in runs):
                record("halt_existing_run")
                return
            submissions = [s for s in cli("submissions")
                           if s.get("competition_id") == "hackathon-evolution"]
            if max(submissions, key=lambda s: s["created_at"])["id"] != SUB:
                record("halt_submission_changed")
                return
            if datetime.now(TZ) >= CUTOFF:
                record("halt_start_cutoff")
                return
            # An ambiguous start response must never be retried automatically.
            try:
                created = cli("run", SUB, "--task", TASK, "--queue-timeout", "45")
                snapshot("second-run-start", created)
                rows = created if isinstance(created, list) else [created]
                rid = next(row["run_id"] for row in rows if row.get("run_id"))
            except Exception as exc:
                record("halt_start_uncertain", error_type=type(exc).__name__)
                return
            attempts += 1
            previous = None
            with (ROOT / f"reruns-{SUB}-github.log").open("a") as handle:
                handle.write(f"{datetime.now(TZ):%m-%d %H:%M} start {rid}\n")
            record("started", run_id=rid, attempt=attempts)
        except Exception as exc:
            record("read_failed", error_type=type(exc).__name__)
            time.sleep(30)
    record("deadline", run_id=rid, final_status=previous)


if __name__ == "__main__":
    main()
