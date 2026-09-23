#!/usr/bin/env python3
"""Model-pair orchestrator, third version (14:06): takes over from orchestrate2 (paused with SIGSTOP) after the local
proxy (Clash Verge Rev) restarted at 13:58:54 and cut every in-flight stream. Adopts the two generations still running,
launches four replacement samples for the four contaminated ones, then runs the quiet-phase 12306 replays.

- At most 4 generations at once (flash-12306-a, launched by the first orchestrator, is adopted and holds a slot).
- Launch gate: ledger of finished generations (priced from their own usage) + conservative estimates for the
  ones in flight + an estimate for the new one must stay within CNY 120; a successful meter read below CNY 100
  stops launching. A failed meter read is recorded and is not a stop condition.
- Meter reads (one login per process, cookie kept in memory): first not before 13:45, then at most one attempt
  per 30 minutes; each successful read also saves the full billed-request log for reconciliation.
- Lite replays run as soon as a generation ends (container, 1 CPU, 2 GB), at most 2 at once. 12306 host replays
  are deferred to a quiet phase after every generation has ended and run one at a time, interleaving the models.
"""
import datetime as dt
import json
import shutil
import subprocess
import sys
import threading
import time
from pathlib import Path

S = Path(__file__).resolve().parent
sys.path.insert(0, str(S))
from parse_sample import summarize  # noqa: E402

sys.path.insert(0, str(Path.home() / "projects/arcbench-cli/src"))
from arcbench_cli.client import OfficialClient, SubmitConfig, load_env  # noqa: E402

ENV_FILE = Path.home() / ".config/arcbench/volo.env"
LITE_REPLAY = Path.home() / "projects/volo-factory-worktrees/lite-first-20260922/runs/lite-goal-20260922/replay.py"
WEB_REPLAY = Path.home() / "projects/volo-factory-worktrees/bigtask-keep/harness_lab/state_rehearsal.py"
TOTAL = {"keep": 32, "bookstack": 34, "12306": 135}
STOP_BALANCE = 100.0
SPEND_CAP = 120.0
INITIAL_BALANCE = 252.21233  # read 13:22:56 by the first orchestrator, before any generation
EST = {("flash", "keep"): 2.0, ("flash", "bookstack"): 2.0, ("flash", "12306"): 5.0,
       ("kimi", "keep"): 8.0, ("kimi", "bookstack"): 8.0, ("kimi", "12306"): 20.0}
LAST_LAUNCH = dt.datetime(2026, 9, 23, 20, 45)
FIRST_METER = dt.datetime(2026, 9, 23, 14, 15, 30)  # 30 min after orchestrate2's 13:44:59 attempt
METER_INTERVAL = 30 * 60

ADOPTED = [("flash", "keep", "c"), ("kimi", "bookstack", "c")]
# Replacements for the samples whose calls the 13:58:54 local proxy restart cut: flash bookstack-b, bookstack-c,
# keep-c and kimi keep-c.
JOBS = [("flash", "keep", "d"), ("kimi", "keep", "d"), ("flash", "bookstack", "d"), ("flash", "bookstack", "e")]
WEB_ORDER = [("flash", "a"), ("kimi", "a"), ("flash", "b"), ("kimi", "b")]

lock = threading.Lock()
gen_sem = threading.Semaphore(4)
lite_sem = threading.Semaphore(2)
state_path = S / "state3.json"
state = {"started_at": time.time(), "initial_balance": INITIAL_BALANCE, "jobs": {}, "meter_reads": [],
         "stopped": None, "ledger": []}
stop_flag = threading.Event()
gens_done = threading.Event()


def log(msg):
    line = f"{dt.datetime.now():%H:%M:%S} {msg}"
    with lock:
        with open(S / "orchestrate3.log", "a") as f:
            f.write(line + "\n")
        print(line, flush=True)


def save():
    with lock:
        state_path.write_text(json.dumps(state, indent=2))


def update(key, **fields):
    with lock:
        state["jobs"].setdefault(key, {}).update(fields)
        state_path.write_text(json.dumps(state, indent=2))


def sample_dir(tag, task, sample):
    return S / "gens" / tag / f"{task}-{sample}"


def finished(tag, task, sample):
    meta = sample_dir(tag, task, sample) / "meta.json"
    try:
        return "exit_code" in json.loads(meta.read_text())
    except (OSError, ValueError):
        return False


_priced = {}


def ledger():
    done, inflight, rows = 0.0, 0.0, []
    keys = []
    for d in sorted((S / "gens").glob("*/*")):
        if (d / "meta.json").is_file():
            task, _, sample = d.name.rpartition("-")
            keys.append((d.parent.name, task, sample))
    for tag, task, sample in keys:
        if finished(tag, task, sample):
            key = (tag, task, sample)
            if key not in _priced:
                try:
                    _priced[key] = summarize(sample_dir(tag, task, sample))["local_cost_cny"]
                except Exception as exc:  # unreadable log: fall back to the estimate
                    log(f"ledger: cannot price {tag}-{task}-{sample}: {exc!r}")
                    _priced[key] = EST[(tag, task)]
            cost = _priced[key]
            done += cost
            rows.append((f"{tag}-{task}-{sample}", "done", round(cost, 4)))
        else:
            inflight += EST[(tag, task)]
            rows.append((f"{tag}-{task}-{sample}", "in-flight-estimate", EST[(tag, task)]))
    return done, inflight, rows


class Meter:
    def __init__(self):
        self.cfg = SubmitConfig.from_env(load_env(ENV_FILE)).for_meter()
        self.client = OfficialClient(self.cfg)
        self.logged_in = False

    def read(self):
        if not self.logged_in:
            self.client.meter_login(self.cfg.api_key)
            self.logged_in = True
        try:
            bal = self.client.balance()
            reqs = self.client.request_log(1000000)
        except Exception:
            self.logged_in = False  # an expired cookie logs in again at the next (30-minute) attempt
            raise
        return bal, reqs


def meter_attempt(meter, label):
    at = time.time()
    entry = {"at": at, "at_local": dt.datetime.now().strftime("%H:%M:%S"), "label": label}
    try:
        bal, reqs = meter.read()
        value = float(bal["available_balance"])
        entry.update({"ok": True, "balance": value, "as_of": bal.get("as_of"),
                      "pending": bal.get("pending_billing_events"), "requests": len(reqs)})
        name = S / "billing" / f"requests-{dt.datetime.now():%H%M%S}.json"
        name.write_text(json.dumps(reqs))
        entry["requests_file"] = name.name
        log(f"meter read ok: balance {value:.4f} (spent since start {INITIAL_BALANCE - value:.4f}), "
            f"{len(reqs)} billed requests saved to {name.name}")
        if value < STOP_BALANCE:
            stop_flag.set()
            log(f"STOP: balance {value:.2f} < {STOP_BALANCE}")
    except Exception as exc:
        entry.update({"ok": False, "error": repr(exc)[:400], "http_status": getattr(exc, "status", None),
                      "kind": getattr(exc, "kind", None)})
        log(f"meter read FAILED: {repr(exc)[:200]}")
    with lock:
        state["meter_reads"].append(entry)
    save()
    return entry


def meter_loop():
    meter = Meter()
    wait = max(0.0, (FIRST_METER - dt.datetime.now()).total_seconds())
    last = None
    while True:
        if gens_done.wait(timeout=wait):
            # final reconciliation read, still no sooner than 30 minutes after the previous attempt
            if last is not None:
                remaining = METER_INTERVAL - (time.time() - last)
                if remaining > 0:
                    log(f"final meter read in {remaining / 60:.1f} min (30-minute spacing)")
                    time.sleep(remaining)
            meter_attempt(meter, "final")
            return
        meter_attempt(meter, "periodic")
        last = time.time()
        wait = METER_INTERVAL


def lite_replay(tag, task, sample):
    d = sample_dir(tag, task, sample)
    key = f"{tag}-{task}-{sample}"
    with lite_sem:
        log(f"replay {key}: start")
        t0 = time.time()
        with open(d / "replay.log", "w") as f:
            code = subprocess.run([sys.executable, str(LITE_REPLAY), "--app", task, "--application", str(d / "app"),
                                   "--out", str(d / "replay")], stdout=f, stderr=subprocess.STDOUT).returncode
        rj = d / "replay" / "result.json"
        raw = json.loads(rj.read_text()) if rj.is_file() else {}
        result = {"app": task, "passed": raw.get("passed"), "total": raw.get("total"), "delivered": True,
                  "tool": "lite replay.py (arc-business-feedback:20260921, 1 CPU, 2 GB, 1 worker, 10 s)",
                  "exit_code": code, "failed_ids": [c["id"] for c in raw.get("cases", []) if not c["passed"]],
                  "replay_seconds": round(time.time() - t0, 1)}
    (d / "replay-result.json").write_text(json.dumps(result, indent=2))
    update(key, replay=result)
    log(f"replay {key}: {result['passed']}/{result['total']} (exit {code}, {result['replay_seconds']} s)")


def web_replay(tag, sample):
    d = sample_dir(tag, "12306", sample)
    key = f"{tag}-12306-{sample}"
    log(f"replay {key}: start")
    t0 = time.time()
    work = d / "replay12306"
    if work.exists():
        raise RuntimeError(f"{work} exists")
    shutil.copytree(d / "app", work / "app", ignore=shutil.ignore_patterns("node_modules", "dist", ".oneshot-*"))
    with open(d / "replay.log", "w") as f:
        code = subprocess.run([sys.executable, str(WEB_REPLAY), "--app", "12306", "--app-dir", str(work / "app"),
                               "--profile", "hosted", "--work-dir", str(work / "work"),
                               "--json", str(work / "result.json")], stdout=f, stderr=subprocess.STDOUT).returncode
    raw = json.loads((work / "result.json").read_text()) if (work / "result.json").is_file() else {}
    result = {"app": "12306", "passed": raw.get("passed"), "total": raw.get("total"), "delivered": True,
              "tool": "state_rehearsal.py --profile hosted (4 workers, 10 s), quiet phase", "exit_code": code,
              "failed_titles": raw.get("failed_titles"), "error": raw.get("error"),
              "replay_seconds": round(time.time() - t0, 1)}
    (d / "replay-result.json").write_text(json.dumps(result, indent=2))
    update(key, replay=result)
    log(f"replay {key}: {result['passed']}/{result['total']} (exit {code}, {result['replay_seconds']} s)")


def not_delivered(tag, task, sample):
    d = sample_dir(tag, task, sample)
    app = d / "app"
    if (app / "frontend" / "package.json").is_file() and (app / "backend" / "package.json").is_file():
        return False
    result = {"app": task, "passed": 0, "total": TOTAL[task], "delivered": False,
              "note": "no delivered application; scored as a whole-task zero"}
    (d / "replay-result.json").write_text(json.dumps(result, indent=2))
    update(f"{tag}-{task}-{sample}", replay=result)
    log(f"replay {tag}-{task}-{sample}: not delivered -> 0/{TOTAL[task]}")
    return True


def after_generation(tag, task, sample):
    if not_delivered(tag, task, sample) or task == "12306":
        return  # 12306 replays wait for the quiet phase
    lite_replay(tag, task, sample)


def run_job(tag, task, sample):
    key = f"{tag}-{task}-{sample}"
    try:
        t0 = time.time()
        with open(S / "logs" / f"{key}.runner.log", "w") as f:
            code = subprocess.run([sys.executable, str(S / "run_gen.py"), "--model", tag, "--task", task,
                                   "--sample", sample], stdout=f, stderr=subprocess.STDOUT).returncode
        update(key, gen_exit=code, gen_seconds=round(time.time() - t0, 1), gen_done_at=time.time())
        log(f"generation {key}: runner exit {code} after {round(time.time() - t0)} s")
    except Exception as exc:
        update(key, gen_error=repr(exc))
        log(f"generation {key}: runner error {exc!r}")
    finally:
        gen_sem.release()
    try:
        after_generation(tag, task, sample)
    except Exception as exc:
        update(key, replay_error=repr(exc))
        log(f"replay {key}: error {exc!r}")


def adopt(tag, task, sample):
    key = f"{tag}-{task}-{sample}"
    while not finished(tag, task, sample):
        time.sleep(20)
    meta = json.loads((sample_dir(tag, task, sample) / "meta.json").read_text())
    update(key, gen_exit=meta.get("exit_code"), gen_seconds=meta.get("wall_seconds"), gen_done_at=meta.get("ended_at"))
    log(f"generation {key} (adopted): exit {meta.get('exit_code')} after {meta.get('wall_seconds')} s")
    gen_sem.release()
    try:
        after_generation(tag, task, sample)
    except Exception as exc:
        update(key, replay_error=repr(exc))
        log(f"replay {key}: error {exc!r}")


def main():
    (S / "logs").mkdir(exist_ok=True)
    (S / "billing").mkdir(exist_ok=True)
    threads = []
    for tag, task, sample in ADOPTED:
        gen_sem.acquire()
        meta = json.loads((sample_dir(tag, task, sample) / "meta.json").read_text())
        update(f"{tag}-{task}-{sample}", model_tag=tag, task=task, sample=sample, launched_at=meta["started_at"],
               adopted=True)
    for tag, task, sample in [("flash", "12306", "a"), ("flash", "12306", "b"), ("kimi", "12306", "a"),
                              ("kimi", "12306", "b")]:
        meta = json.loads((sample_dir(tag, task, sample) / "meta.json").read_text())
        update(f"{tag}-{task}-{sample}", model_tag=tag, task=task, sample=sample, launched_at=meta["started_at"],
               adopted=True, gen_exit=meta.get("exit_code"))
        t = threading.Thread(target=adopt, args=(tag, task, sample))
        t.start()
        threads.append(t)
    mt = threading.Thread(target=meter_loop, daemon=True)
    mt.start()
    log(f"orchestrator 3: {len(JOBS)} jobs to launch, {len(ADOPTED)} adopted")
    for tag, task, sample in JOBS:
        key = f"{tag}-{task}-{sample}"
        gen_sem.acquire()
        reason = None
        while True:
            done, inflight, rows = ledger()
            with lock:
                state["ledger"].append({"at": time.time(), "before": key, "done": round(done, 4),
                                        "inflight_estimate": inflight, "rows": rows})
            save()
            if stop_flag.is_set():
                reason = "a successful meter read was below CNY 100"
            elif done >= SPEND_CAP:
                reason = f"local ledger {done:.2f} >= cap {SPEND_CAP}"
            elif dt.datetime.now() > LAST_LAUNCH:
                reason = f"past last launch time {LAST_LAUNCH:%H:%M}"
            elif done + inflight + EST[(tag, task)] > SPEND_CAP:
                if inflight > 0:
                    log(f"gate: ledger {done:.2f} + in-flight {inflight:.1f} + {EST[(tag, task)]} > {SPEND_CAP}; waiting")
                    time.sleep(60)
                    continue
                reason = f"ledger {done:.2f} + estimate {EST[(tag, task)]} > cap {SPEND_CAP}"
            break
        if reason:
            with lock:
                state["stopped"] = {"at": time.time(), "reason": reason, "next_job": key}
            save()
            log("STOP launching: " + reason)
            gen_sem.release()
            break
        update(key, model_tag=tag, task=task, sample=sample, launched_at=time.time())
        log(f"launch {key} (ledger done {done:.3f}, in-flight estimate {inflight:.1f})")
        t = threading.Thread(target=run_job, args=(tag, task, sample))
        t.start()
        threads.append(t)
        time.sleep(5)
    for t in threads:
        t.join()
    log("all generations and Lite replays ended; 12306 quiet-phase replays start")
    for tag, sample in WEB_ORDER:
        key = f"{tag}-12306-{sample}"
        with lock:
            job = state["jobs"].get(key)
        if not job or not job.get("launched_at") or not finished(tag, "12306", sample):
            continue
        if (sample_dir(tag, "12306", sample) / "replay-result.json").is_file():
            continue
        try:
            web_replay(tag, sample)
        except Exception as exc:
            update(key, replay_error=repr(exc))
            log(f"replay {key}: error {exc!r}")
    done, inflight, rows = ledger()
    with lock:
        state["ledger"].append({"at": time.time(), "before": "end", "done": round(done, 4), "rows": rows})
        state["ended_at"] = time.time()
    save()
    log(f"all replays ended; local ledger {done:.4f} CNY; waiting for the final meter read")
    gens_done.set()
    mt.join()
    log("orchestrator 3 finished")


if __name__ == "__main__":
    main()
