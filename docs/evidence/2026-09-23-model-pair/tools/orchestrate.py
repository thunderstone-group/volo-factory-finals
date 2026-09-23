#!/usr/bin/env python3
"""Model-pair experiment orchestrator: at most 4 generations at once, a balance read before every launch,
Lite replays (container, 1 CPU / 2 GB) at most 2 at once, 12306 host replays one at a time."""
import datetime as dt
import json
import shutil
import subprocess
import sys
import threading
import time
from pathlib import Path

S = Path(__file__).resolve().parent
ENV_FILE = str(Path.home() / ".config/arcbench/volo.env")
LITE_REPLAY = Path.home() / "projects/volo-factory-worktrees/lite-first-20260922/runs/lite-goal-20260922/replay.py"
WEB_REPLAY = Path.home() / "projects/volo-factory-worktrees/bigtask-keep/harness_lab/state_rehearsal.py"
TOTAL = {"keep": 32, "bookstack": 34, "12306": 135}
STOP_BALANCE = 100.0
SPEND_CAP = 120.0
LAUNCH_SPEND_LIMIT = 100.0  # stop launching when this much is already spent (in-flight calls still land)
LAST_LAUNCH = dt.datetime(2026, 9, 23, 20, 45)

JOBS = [("flash", "12306", "a"), ("kimi", "12306", "a"), ("flash", "keep", "a"), ("kimi", "keep", "a"),
        ("flash", "bookstack", "a"), ("kimi", "bookstack", "a"), ("flash", "12306", "b"), ("kimi", "12306", "b"),
        ("flash", "keep", "b"), ("kimi", "keep", "b"), ("flash", "bookstack", "b"), ("kimi", "bookstack", "b"),
        ("flash", "keep", "c"), ("kimi", "keep", "c"), ("flash", "bookstack", "c"), ("kimi", "bookstack", "c")]
if len(sys.argv) > 1:
    wanted = set(sys.argv[1:])
    JOBS = [j for j in JOBS if "-".join(j) in wanted]

lock = threading.Lock()
gen_sem = threading.Semaphore(4)
lite_sem = threading.Semaphore(2)
web_sem = threading.Semaphore(1)
state = {"started_at": time.time(), "jobs": {}, "balances": [], "stopped": None}


def log(msg):
    line = f"{dt.datetime.now():%H:%M:%S} {msg}"
    with lock:
        with open(S / "orchestrate.log", "a") as f:
            f.write(line + "\n")
        print(line, flush=True)


def save():
    with lock:
        (S / "state.json").write_text(json.dumps(state, indent=2))


def update(key, **fields):
    with lock:
        state["jobs"].setdefault(key, {}).update(fields)
        (S / "state.json").write_text(json.dumps(state, indent=2))


def balance():
    out = subprocess.run(["arcbench", "--env-file", ENV_FILE, "--json", "balance"], capture_output=True, text=True,
                         timeout=60)
    data = json.loads(out.stdout)
    value = float(data["available_balance"])
    with lock:
        state["balances"].append({"at": time.time(), "balance": value, "as_of": data.get("as_of"),
                                  "pending": data.get("pending_billing_events")})
    return value


def safe_balance():
    for attempt in range(3):
        try:
            return balance()
        except Exception as exc:
            log(f"balance read failed ({attempt + 1}/3): {exc!r}")
            time.sleep(10)
    return None


def replay(tag, task, sample):
    d = S / "gens" / tag / f"{task}-{sample}"
    app = d / "app"
    key = f"{tag}-{task}-{sample}"
    if not (app / "frontend" / "package.json").is_file() or not (app / "backend" / "package.json").is_file():
        result = {"app": task, "passed": 0, "total": TOTAL[task], "delivered": False,
                  "note": "no delivered application; scored as a whole-task zero"}
        (d / "replay-result.json").write_text(json.dumps(result, indent=2))
        update(key, replay=result)
        log(f"replay {key}: not delivered -> 0/{TOTAL[task]}")
        return
    sem = web_sem if task == "12306" else lite_sem
    with sem:
        log(f"replay {key}: start")
        t0 = time.time()
        if task == "12306":
            work = d / "replay12306"
            if work.exists():
                raise RuntimeError(f"{work} exists")
            shutil.copytree(app, work / "app", ignore=shutil.ignore_patterns("node_modules", "dist", ".oneshot-*"))
            with open(d / "replay.log", "w") as f:
                code = subprocess.run([sys.executable, str(WEB_REPLAY), "--app", "12306", "--app-dir", str(work / "app"),
                                       "--profile", "hosted", "--work-dir", str(work / "work"),
                                       "--json", str(work / "result.json")], stdout=f, stderr=subprocess.STDOUT).returncode
            raw = json.loads((work / "result.json").read_text()) if (work / "result.json").is_file() else {}
            result = {"app": task, "passed": raw.get("passed"), "total": raw.get("total"), "delivered": True,
                      "tool": "state_rehearsal.py --profile hosted (4 workers, 10 s)", "exit_code": code,
                      "failed_titles": raw.get("failed_titles"), "wall_seconds": raw.get("wall_seconds"),
                      "error": raw.get("error")}
        else:
            with open(d / "replay.log", "w") as f:
                code = subprocess.run([sys.executable, str(LITE_REPLAY), "--app", task, "--application", str(app),
                                       "--out", str(d / "replay")], stdout=f, stderr=subprocess.STDOUT).returncode
            rj = d / "replay" / "result.json"
            raw = json.loads(rj.read_text()) if rj.is_file() else {}
            result = {"app": task, "passed": raw.get("passed"), "total": raw.get("total"), "delivered": True,
                      "tool": "lite replay.py (arc-business-feedback:20260921, 1 CPU, 2 GB, 1 worker, 10 s)",
                      "exit_code": code, "failed_ids": [c["id"] for c in raw.get("cases", []) if not c["passed"]],
                      "wall_seconds": raw.get("seconds")}
        result["replay_seconds"] = round(time.time() - t0, 1)
        (d / "replay-result.json").write_text(json.dumps(result, indent=2))
        update(key, replay=result)
        log(f"replay {key}: {result['passed']}/{result['total']} (exit {code}, {result['replay_seconds']} s)")


def run_job(tag, task, sample):
    key = f"{tag}-{task}-{sample}"
    try:
        t0 = time.time()
        with open(S / "logs" / f"{key}.runner.log", "w") as f:
            code = subprocess.run([sys.executable, str(S / "run_gen.py"), "--model", tag, "--task", task,
                                   "--sample", sample], stdout=f, stderr=subprocess.STDOUT).returncode
        update(key, gen_exit=code, gen_seconds=round(time.time() - t0, 1), gen_done_at=time.time())
        log(f"generation {key}: exit {code} after {round(time.time() - t0)} s")
    except Exception as exc:
        update(key, gen_error=repr(exc))
        log(f"generation {key}: runner error {exc!r}")
    finally:
        gen_sem.release()
    try:
        replay(tag, task, sample)
    except Exception as exc:
        update(key, replay_error=repr(exc))
        log(f"replay {key}: error {exc!r}")


def main():
    (S / "logs").mkdir(exist_ok=True)
    initial = balance()
    state["initial_balance"] = initial
    save()
    log(f"initial balance {initial:.4f}; {len(JOBS)} jobs")
    threads = []
    for tag, task, sample in JOBS:
        gen_sem.acquire()
        now = dt.datetime.now()
        b = safe_balance()
        spent = initial - b if b is not None else None
        log(f"balance {b} (spent {spent}) before {tag}-{task}-{sample}")
        reason = None
        if b is None:
            reason = "balance unreadable"
        elif b < STOP_BALANCE:
            reason = f"balance {b:.2f} < {STOP_BALANCE}"
        elif spent >= LAUNCH_SPEND_LIMIT:
            reason = f"spent {spent:.2f} >= launch limit {LAUNCH_SPEND_LIMIT} (cap {SPEND_CAP})"
        elif now > LAST_LAUNCH:
            reason = f"past last launch time {LAST_LAUNCH:%H:%M}"
        if reason:
            with lock:
                state["stopped"] = {"at": time.time(), "reason": reason, "next_job": f"{tag}-{task}-{sample}"}
            save()
            log("STOP launching: " + reason)
            gen_sem.release()
            break
        key = f"{tag}-{task}-{sample}"
        update(key, model_tag=tag, task=task, sample=sample, launched_at=time.time())
        log(f"launch {key}")
        t = threading.Thread(target=run_job, args=(tag, task, sample))
        t.start()
        threads.append(t)
        time.sleep(5)
    for t in threads:
        t.join()
    state["final_balance"] = safe_balance()
    state["ended_at"] = time.time()
    save()
    log(f"all done; final balance {state['final_balance']}")


if __name__ == "__main__":
    main()
