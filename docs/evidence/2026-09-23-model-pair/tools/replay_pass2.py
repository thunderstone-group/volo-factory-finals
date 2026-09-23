#!/usr/bin/env python3
"""Robustness pass for the 12306 host replays: a calibration control (round-28 sample a, platform 74/135) before and
after, and a second replay of each 12306 app in the reverse order. Sequential; the primary result stays pass 1."""
import datetime as dt
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

S = Path(__file__).resolve().parent
WEB_REPLAY = Path.home() / "projects/volo-factory-worktrees/bigtask-keep/harness_lab/state_rehearsal.py"
CALIB = Path.home() / "projects/volo-factory/runs/2026-09-20-goal/r28a-12306-bundle/template"
ORDER = [("control", "1"), ("kimi", "b"), ("flash", "b"), ("kimi", "a"), ("flash", "a"), ("control", "2")]


def run(src, work, label):
    if work.exists():
        raise SystemExit(f"{work} exists")
    shutil.copytree(src / "frontend", work / "app" / "frontend", ignore=shutil.ignore_patterns("node_modules", "dist"))
    shutil.copytree(src / "backend", work / "app" / "backend", ignore=shutil.ignore_patterns("node_modules"))
    t0 = time.time()
    with open(work / "replay.log", "w") as f:
        code = subprocess.run([sys.executable, str(WEB_REPLAY), "--app", "12306", "--app-dir", str(work / "app"),
                               "--profile", "hosted", "--work-dir", str(work / "work"),
                               "--json", str(work / "result.json")], stdout=f, stderr=subprocess.STDOUT).returncode
    raw = json.loads((work / "result.json").read_text()) if (work / "result.json").is_file() else {}
    result = {"label": label, "passed": raw.get("passed"), "total": raw.get("total"), "exit_code": code,
              "started_at": t0, "replay_seconds": round(time.time() - t0, 1), "failed_titles": raw.get("failed_titles")}
    print(f"{dt.datetime.now():%H:%M:%S} {label}: {result['passed']}/{result['total']} ({result['replay_seconds']} s)",
          flush=True)
    return result


def main():
    out = []
    for tag, sample in ORDER:
        if tag == "control":
            work = S / "calib-pass2" / f"control-{sample}"
            work.parent.mkdir(exist_ok=True)
            out.append(run(CALIB, work, f"control-{sample} (r28a, platform 74/135)"))
        else:
            d = S / "gens" / tag / f"12306-{sample}"
            if not (d / "app" / "backend" / "package.json").is_file():
                continue
            result = run(d / "app", d / "replay12306-pass2", f"{tag}-12306-{sample} pass 2")
            (d / "replay-result-pass2.json").write_text(json.dumps(result, indent=2))
            out.append(result)
        (S / "replay-pass2.json").write_text(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
