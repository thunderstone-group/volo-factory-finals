#!/usr/bin/env python3
"""Fresh generations with the candidate worktree's oneshot/main.py, then the public Lite replay.
    gen_batch.py JOBS.json [--gen-jobs 3] [--replay-jobs 2]
JOBS.json: [{"label", "task": keep|bookstack}]. Each generation gets a fresh output dir under gens/<label>/app and its
own scenario translation cache (so the translation is called afresh, as on the platform). The key comes from the env file
and is passed only through the child's environment."""
import concurrent.futures, json, os, subprocess, sys, threading, time
from pathlib import Path

SP = Path(__file__).resolve().parent
WT = Path.home() / "projects/volo-factory-worktrees/scenario-repair"
PY = Path.home() / "projects/volo-factory/.venv/bin/python"
LITE = Path.home() / "projects/volo-factory-worktrees/lite-first-20260922/runs/lite-goal-20260922"
REQ = Path.home() / "projects/arcbench-campaign/upstream/hackathon-local-simulation/public-exercise/{task}/requirements"
lock = threading.Lock()


def log(msg):
    with lock:
        with open(SP / "gen_batch.log", "a") as f:
            f.write(time.strftime("%H:%M:%S ") + msg + "\n")


def key():
    for line in (Path.home() / ".config/arcbench/volo.env").read_text().splitlines():
        name, _, value = line.partition("=")
        if name.strip() == "ARC_BENCH_API_KEY":
            return value.strip().strip("'\"")
    raise SystemExit("no key")


def generate(job):
    root = SP / "gens" / job["label"]
    if (root / "done.json").is_file():
        return job
    root.mkdir(parents=True, exist_ok=True)
    env = {k: v for k, v in os.environ.items() if not (k.startswith(("ONESHOT_", "SCENARIO_")) or
                                                       k in ("MODEL", "FALLBACK_MODEL", "OPENAI_API_KEY", "OPENAI_BASE_URL"))}
    # A private translation cache: every generation translates its scenarios afresh, as on the platform.
    env.update(OPENAI_API_KEY=key(), MODEL=job.get("model", "deepseek-v4-flash"),
               SCENARIO_CACHE_DIR=str(root / "scenario-cache"))
    log(f"gen start {job['label']}")
    t = time.time()
    with open(root / "stdout.log", "wb") as out, open(root / "stderr.log", "wb") as err:
        code = subprocess.run([str(PY), str(WT / "oneshot/main.py"), str(REQ).format(task=job["task"]),
                               "--output-dir", str(root / "app")], cwd=root, env=env, stdout=out, stderr=err).returncode
    (root / "done.json").write_text(json.dumps({"exit": code, "seconds": round(time.time() - t, 1)}))
    log(f"gen done {job['label']} exit {code} {time.time() - t:.0f}s")
    return job


def replay(job):
    out = SP / "gen-replays" / job["label"]
    app = SP / "gens" / job["label"] / "app"
    if (out / "result.json").is_file() or not app.is_dir():
        return job
    out.parent.mkdir(exist_ok=True)
    log(f"replay start {job['label']}")
    with open(str(out) + ".log", "w") as f:
        code = subprocess.run([str(PY), "replay.py", "--app", job["task"], "--application", str(app), "--out", str(out)],
                              cwd=LITE, stdout=f, stderr=subprocess.STDOUT).returncode
    log(f"replay done {job['label']} exit {code}")
    return job


def main():
    jobs = json.loads(Path(sys.argv[1]).read_text())
    gj = int(sys.argv[sys.argv.index("--gen-jobs") + 1]) if "--gen-jobs" in sys.argv else 3
    rj = int(sys.argv[sys.argv.index("--replay-jobs") + 1]) if "--replay-jobs" in sys.argv else 2
    with concurrent.futures.ThreadPoolExecutor(gj) as gens, concurrent.futures.ThreadPoolExecutor(rj) as replays:
        futures = [replays.submit(replay, f.result()) for f in
                   concurrent.futures.as_completed([gens.submit(generate, j) for j in jobs])]
        for f in concurrent.futures.as_completed(futures):
            f.result()
    log("batch complete")


if __name__ == "__main__":
    main()
