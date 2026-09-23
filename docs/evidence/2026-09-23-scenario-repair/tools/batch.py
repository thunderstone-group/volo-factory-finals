#!/usr/bin/env python3
"""Roadmap 4.3 validation batch: repair_replay.py on each job, then the public Lite replay of the result.
    batch.py JOBS.json [--repair-jobs 4] [--replay-jobs 2]
JOBS.json: [{"label", "task": keep|bookstack, "app"}]. Results in runs/<label>/ and replays/<label>/; summary.json."""
import concurrent.futures, json, os, subprocess, sys, threading, time
from pathlib import Path

SP = Path(__file__).resolve().parent
WT = Path(os.environ.get("BATCH_WT") or Path.home() / "projects/volo-factory-worktrees/scenario-repair")
PY = Path.home() / "projects/volo-factory/.venv/bin/python"
LITE = Path.home() / "projects/volo-factory-worktrees/lite-first-20260922/runs/lite-goal-20260922"
REQ = Path.home() / "projects/arcbench-campaign/upstream/hackathon-local-simulation/public-exercise/{task}/requirements/requirements.yaml"
lock = threading.Lock()


def log(msg):
    with lock:
        with open(SP / os.environ.get("BATCH_LOG", "batch.log"), "a") as f:
            f.write(time.strftime("%H:%M:%S ") + msg + "\n")


def repair(job):
    out = SP / "runs" / job["label"]
    if job.get("replay_only") or (out / "repair.json").is_file():
        return job
    env = dict(os.environ, SCENARIO_CACHE_DIR=str(SP / "cache"))
    env.pop("OPENAI_API_KEY", None)  # repair_replay reads the key from the env file itself
    log(f"repair start {job['label']}")
    t = time.time()
    with open(SP / "runs" / (job["label"] + ".log"), "w") as f:
        code = subprocess.run([str(PY), "scripts/repair_replay.py", "--requirements", str(REQ).format(task=job["task"]),
                               "--app", job["app"], "--out", str(out)], cwd=WT, env=env, stdout=f, stderr=subprocess.STDOUT).returncode
    log(f"repair done {job['label']} exit {code} {time.time() - t:.0f}s")
    return job


def replay(job):
    out = SP / "replays" / job["label"]
    application = Path(job["app"]) if job.get("replay_only") else SP / "runs" / job["label"] / "application"
    if (out / "result.json").is_file() or not application.is_dir():
        return job
    log(f"replay start {job['label']}")
    with open(SP / "replays" / (job["label"] + ".log"), "w") as f:
        code = subprocess.run([str(PY), "replay.py", "--app", job["task"], "--application",
                               str(application), "--out", str(out)],
                              cwd=LITE, stdout=f, stderr=subprocess.STDOUT).returncode
    log(f"replay done {job['label']} exit {code}")
    return job


def main():
    jobs = json.loads(Path(sys.argv[1]).read_text())
    rj = int(sys.argv[sys.argv.index("--repair-jobs") + 1]) if "--repair-jobs" in sys.argv else 4
    pj = int(sys.argv[sys.argv.index("--replay-jobs") + 1]) if "--replay-jobs" in sys.argv else 2
    (SP / "runs").mkdir(exist_ok=True)
    (SP / "replays").mkdir(exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(rj) as repairs, concurrent.futures.ThreadPoolExecutor(pj) as replays:
        futures = [replays.submit(replay, f.result()) for f in
                   concurrent.futures.as_completed([repairs.submit(repair, j) for j in jobs])]
        for f in concurrent.futures.as_completed(futures):
            f.result()
    log("batch complete")


if __name__ == "__main__":
    main()
