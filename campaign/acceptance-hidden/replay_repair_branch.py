#!/usr/bin/env python3
"""Replay a RECORDED repair response through the candidate's repair_delivery (no model call).

usage: replay_repair.py <main.py dir> <app src dir> <requirements.yaml> <work dir> <repair text> <out.json> [variant]

stream_completion is replaced by a function that returns the recorded text, so repair_delivery's own
acceptance code (smoke before/after, browser recheck rule, improvement rule, vocabulary, rename guard)
decides. The budget is set so no second repair round is attempted.
variant "keep-plus": the recorded repair with its `<span aria-hidden="true">+ </span>添加返程` put back
to the draft's `+ 添加返程`, isolating the rename guard.
"""
import importlib.util
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

main_dir, src, req_path, work, repair_path, out_path = sys.argv[1:7]
variant = sys.argv[7] if len(sys.argv) > 7 else "as-is"
os.environ["TZ"] = "UTC"
time.tzset()
spec = importlib.util.spec_from_file_location("oneshot_main", str(Path(main_dir) / "main.py"))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

requirements = Path(req_path).read_text(encoding="utf-8")
repair_text = Path(repair_path).read_text(encoding="utf-8")
if variant == "keep-plus":
    before = '<span aria-hidden="true">+ </span>添加返程'
    assert before in repair_text
    repair_text = repair_text.replace(before, "+ 添加返程")

work = Path(work)
if work.exists():
    shutil.rmtree(work)
stage = work / "app"
stage.mkdir(parents=True)
for root in ("frontend", "backend"):
    shutil.copytree(Path(src) / root, stage / root, symlinks=True,
                    ignore=shutil.ignore_patterns("node_modules", "dist", "__pycache__"))

record = {"variant": variant, "src": src, "stage": str(stage), "smoke_calls": [], "subprocesses": []}
T0 = time.monotonic()
_real_run = subprocess.run


def timed_run(*args, **kwargs):
    argv = [str(a) for a in (args[0] if args else kwargs.get("args"))]
    label = ("chromium_probe" if any(a.endswith("semantic_probe.cjs") for a in argv) else
             "jsdom_probe" if "-e" in argv and "JSDOM" in argv[argv.index("-e") + 1] else
             "build" if "build" in argv else "node --check" if "--check" in argv else " ".join(argv[:2]))
    entry = {"label": label, "timeout_limit": kwargs.get("timeout"), "t": round(time.monotonic() - T0, 3)}
    started = time.monotonic()
    try:
        return _real_run(*args, **kwargs)
    except subprocess.TimeoutExpired:
        entry["timed_out"] = True
        raise
    finally:
        entry["seconds"] = round(time.monotonic() - started, 3)
        record["subprocesses"].append(entry)


subprocess.run = timed_run
_real_smoke = m.smoke_check


def timed_smoke(*args, **kwargs):
    started = time.monotonic()
    problems, executed = _real_smoke(*args, **kwargs)
    record["smoke_calls"].append({"seconds": round(time.monotonic() - started, 3), "problems": len(problems)})
    return problems, executed


m.smoke_check = timed_smoke


def replayed_completion(messages, model, base, key, budget, tries=3):
    rec = budget.start(messages, "replay:recorded-09-19-repair")
    rec["status"], rec["finish_reason"] = "completed", "stop"
    return repair_text, {}, "stop"


m.stream_completion = replayed_completion
budget = m.CallBudget(draft_limit=1, repair_limit=1)
draft = budget.start([], "replay:draft-already-spent")
draft["status"] = "completed"
budget.phase = "repair"

m.repair_delivery(stage, [], [], "replay", "", "", budget, None, requirements, scaffold=True)
subprocess.run = _real_run
record["seconds_total"] = round(time.monotonic() - T0, 3)
record["smoke"] = budget.smoke
Path(out_path).write_text(json.dumps(record, ensure_ascii=False, indent=1), encoding="utf-8")
s = budget.smoke
print(json.dumps({"variant": variant, "seconds_total": record["seconds_total"], "smoke_calls": record["smoke_calls"],
                  "chromium": [e for e in record["subprocesses"] if e["label"] == "chromium_probe"],
                  "browser_before_executed": [d.get("executed") for d in s.get("browser_before", [])],
                  "browser_after_executed": [d.get("executed") for d in s.get("browser_after", [])],
                  "repair": s.get("repair"), "problems_after": s.get("problems_after")}, ensure_ascii=False, indent=1))
