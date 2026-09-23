#!/usr/bin/env python3
"""Run one generation of the frozen oneshot candidate (1f697d8) for the model-pair experiment.

The gateway key is read from ~/.config/arcbench/volo.env and passed to the child only through its
environment; it is never printed, logged or written to disk by this script.
"""
import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

S = Path(__file__).resolve().parent
CODE = S / "code" / "oneshot" / "main.py"
HOME = Path.home()
REQS = {
    "keep": HOME / "projects/arcbench-campaign/upstream/hackathon-local-simulation/public-exercise/keep/requirements",
    "bookstack": HOME / "projects/arcbench-campaign/upstream/hackathon-local-simulation/public-exercise/bookstack/requirements",
    "12306": HOME / "projects/volo-factory/runs/2026-09-20-goal/r28-req-12306",
}
MODELS = {"flash": "deepseek-v4-flash", "kimi": "kimi-k2.7-code-highspeed"}
BIG = ("[oneshot] trace ", "[oneshot] smoke ", "[oneshot] semantic browser ")


def load_key():
    for line in (HOME / ".config/arcbench/volo.env").read_text().splitlines():
        line = line.strip()
        if line.startswith("export "):
            line = line[7:].strip()
        if line.startswith("ARC_BENCH_API_KEY="):
            value = line.split("=", 1)[1].strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
                value = value[1:-1]
            if value:
                return value
    raise SystemExit("ARC_BENCH_API_KEY missing from the env file")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--model", choices=sorted(MODELS), required=True)
    p.add_argument("--task", choices=sorted(REQS), required=True)
    p.add_argument("--sample", required=True)
    a = p.parse_args()
    sample = S / "gens" / a.model / f"{a.task}-{a.sample}"
    if sample.exists():
        raise SystemExit(f"{sample} exists; never regenerate into a used directory")
    sample.mkdir(parents=True)
    key = load_key()
    env = {k: v for k, v in os.environ.items()
           if not (k.startswith("ONESHOT_") or k in ("FALLBACK_MODEL", "MODEL", "OPENAI_BASE_URL", "OPENAI_API_KEY"))}
    env["OPENAI_API_KEY"] = key
    env["MODEL"] = MODELS[a.model]
    req = REQS[a.task]
    meta = {"model_tag": a.model, "model": MODELS[a.model], "task": a.task, "sample": a.sample,
            "requirement_dir": str(req), "code": str(CODE), "candidate_commit": "1f697d8",
            "oneshot_tree": "d31afba1e32e2db76db72ff89fb8c936e2ea4e5b",
            "env_overrides": {"MODEL": MODELS[a.model], "OPENAI_API_KEY": "[from volo.env, not recorded]",
                              "OPENAI_BASE_URL": "default (https://api.arc-bench.com/v1)",
                              "ONESHOT_DRAFT_CALLS": "default (4)", "ONESHOT_REPAIR_CALLS": "default (2)",
                              "FALLBACK_MODEL": "default (unset)"},
            "started_at": time.time()}
    (sample / "meta.json").write_text(json.dumps(meta, indent=2))
    cmd = [sys.executable, str(CODE), str(req), "--output-dir", str(sample / "app")]
    with open(sample / "stdout.log", "wb") as out, open(sample / "stderr.log", "wb") as err, \
            open(sample / "events.tsv", "w") as events:
        proc = subprocess.Popen(cmd, cwd=sample, env=env, stdout=out, stderr=subprocess.PIPE)
        for raw in proc.stderr:
            err.write(raw)
            err.flush()
            line = raw.decode("utf-8", "replace").rstrip("\n")
            if line.startswith(BIG):
                line = line[:160] + " ...[truncated in events]"
            events.write(f"{time.time():.3f}\t{line.replace(key, '[REDACTED]')}\n")
            events.flush()
        code = proc.wait()
    meta["ended_at"] = time.time()
    meta["wall_seconds"] = round(meta["ended_at"] - meta["started_at"], 3)
    meta["exit_code"] = code
    (sample / "meta.json").write_text(json.dumps(meta, indent=2))
    # Defensive: the key must not be in any log written here.
    for name in ("stdout.log", "stderr.log", "events.tsv"):
        data = (sample / name).read_bytes()
        if key.encode() in data:
            (sample / name).write_bytes(data.replace(key.encode(), b"[REDACTED]"))
            meta.setdefault("redacted", []).append(name)
    (sample / "meta.json").write_text(json.dumps(meta, indent=2))
    print(json.dumps({k: meta[k] for k in ("model", "task", "sample", "wall_seconds", "exit_code")}), flush=True)


if __name__ == "__main__":
    main()
