#!/usr/bin/env python3
"""Model-pair orchestrator, fourth version (14:09). orchestrate3 had a slot-accounting bug (it released a generation
slot for each already-finished 12306 sample and never watched its two adopted Lite runs), so it launched a fifth
concurrent generation; that one (flash-bookstack-e) was aborted after 64 s and orchestrate3 paused with SIGSTOP.

This supervisor counts running generations from disk (a sample directory whose meta.json has no exit_code yet),
never runs more than 4, replays every Lite sample once it ends, relaunches flash-bookstack-e, then runs the
quiet-phase 12306 replays and the final meter read (30-minute spacing).
"""
import datetime as dt
import json
import sys
import threading
import time
from pathlib import Path

S = Path(__file__).resolve().parent
sys.path.insert(0, str(S))
import orchestrate2 as base  # noqa: E402  (functions only; its main() is not run)

MAX_GEN = 4
FIRST_METER = dt.datetime(2026, 9, 23, 14, 15, 30)
TO_LAUNCH = [("flash", "bookstack", "e")]
WEB_ORDER = [("flash", "a"), ("kimi", "a"), ("flash", "b"), ("kimi", "b")]
ABORTED_ESTIMATE = 0.2  # flash-bookstack-e's aborted first call, until the request log prices it

# Route orchestrate2's helpers to this run's own log and state files.
base.state_path = S / "state4.json"
base.state = {"started_at": time.time(), "initial_balance": base.INITIAL_BALANCE, "jobs": {}, "meter_reads": [],
              "stopped": None, "ledger": []}
_log_file = S / "orchestrate4.log"


def log(msg):
    line = f"{dt.datetime.now():%H:%M:%S} {msg}"
    with base.lock:
        with open(_log_file, "a") as f:
            f.write(line + "\n")
        print(line, flush=True)


base.log = log
base.FIRST_METER = FIRST_METER


def samples():
    out = []
    for d in sorted((S / "gens").glob("*/*")):
        if (d / "meta.json").is_file():
            task, _, sample = d.name.rpartition("-")
            out.append((d.parent.name, task, sample))
    return out


def running():
    return [k for k in samples() if not base.finished(*k)]


_priced = {}


def ledger():
    done, inflight = ABORTED_ESTIMATE, 0.0
    for tag, task, sample in samples():
        if base.finished(tag, task, sample):
            if (tag, task, sample) not in _priced:
                _priced[(tag, task, sample)] = base.summarize(base.sample_dir(tag, task, sample))["local_cost_cny"]
            done += _priced[(tag, task, sample)]
        else:
            inflight += base.EST[(tag, task)]
    return done, inflight


def lite_when_done(tag, task, sample):
    while not base.finished(tag, task, sample):
        time.sleep(15)
    d = base.sample_dir(tag, task, sample)
    meta = json.loads((d / "meta.json").read_text())
    log(f"generation {tag}-{task}-{sample}: exit {meta.get('exit_code')} after {meta.get('wall_seconds')} s")
    if (d / "replay-result.json").is_file() or task == "12306":
        return
    if not base.not_delivered(tag, task, sample):
        base.lite_replay(tag, task, sample)


def launch(tag, task, sample):
    import subprocess
    with open(S / "logs" / f"{tag}-{task}-{sample}.runner.log", "w") as f:
        code = subprocess.run([sys.executable, str(S / "run_gen.py"), "--model", tag, "--task", task,
                               "--sample", sample], stdout=f, stderr=subprocess.STDOUT).returncode
    log(f"runner {tag}-{task}-{sample}: exit {code}")


def main():
    threads = []
    mt = threading.Thread(target=base.meter_loop, daemon=True)
    mt.start()
    for key in samples():
        tag, task, sample = key
        d = base.sample_dir(*key)
        if task != "12306" and not (d / "replay-result.json").is_file():
            t = threading.Thread(target=lite_when_done, args=key)
            t.start()
            threads.append(t)
            log(f"watching {tag}-{task}-{sample} for its Lite replay")
    for tag, task, sample in TO_LAUNCH:
        while True:
            busy = running()
            if len(busy) >= MAX_GEN:
                time.sleep(15)
                continue
            done, inflight = ledger()
            if base.stop_flag.is_set():
                log("STOP launching: a successful meter read was below CNY 100")
                break
            if done >= base.SPEND_CAP or done + inflight + base.EST[(tag, task)] > base.SPEND_CAP:
                if busy:
                    time.sleep(30)
                    continue
                log(f"STOP launching: ledger {done:.2f} + estimate would pass the cap")
                break
            log(f"launch {tag}-{task}-{sample} (running {len(busy)}: {['-'.join(b) for b in busy]}; "
                f"ledger done {done:.3f}, in-flight estimate {inflight:.1f})")
            t = threading.Thread(target=launch, args=(tag, task, sample))
            t.start()
            threads.append(t)
            time.sleep(3)
            w = threading.Thread(target=lite_when_done, args=(tag, task, sample))
            w.start()
            threads.append(w)
            break
    for t in threads:
        t.join()
    while running():  # nothing of ours may still be generating when the host replays start
        time.sleep(15)
    log("all generations and Lite replays ended; 12306 quiet-phase replays start")
    for tag, sample in WEB_ORDER:
        d = base.sample_dir(tag, "12306", sample)
        if not (d / "meta.json").is_file() or (d / "replay-result.json").is_file():
            continue
        if base.not_delivered(tag, "12306", sample):
            continue
        try:
            base.web_replay(tag, sample)
        except Exception as exc:
            log(f"replay {tag}-12306-{sample}: error {exc!r}")
    done, _ = ledger()
    log(f"all replays ended; local ledger {done:.4f} CNY (incl. {ABORTED_ESTIMATE} estimate for the aborted call); "
        f"waiting for the final meter read")
    base.gens_done.set()
    mt.join()
    log("orchestrator 4 finished")


if __name__ == "__main__":
    main()
