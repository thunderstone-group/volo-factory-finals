#!/usr/bin/env python3
"""Wait for submission 3's Sheet run to end (the platform is under maintenance), then upload the submission-4 package
on the competition budget and run both tasks; save every record. Retries through platform errors."""
import json, subprocess, sys, time
from pathlib import Path
ENV = ["--env-file", str(Path.home() / ".config/arcbench/volo.env")]
OUT = Path.home() / "projects/arcbench-campaign/evidence/2026-09-24-hackathon/official"
PKG = "/private/tmp/claude-501/-Users-e0-7-projects/7f16c387-dfb4-4435-a927-a282ac849158/scratchpad/pkg/cand-9ac8e89.zip"
LOG = Path("/private/tmp/claude-501/-Users-e0-7-projects/7f16c387-dfb4-4435-a927-a282ac849158/scratchpad/sub4_chain.log")

def log(msg):
    with LOG.open("a") as f: f.write(time.strftime("%H:%M:%S ") + msg + "\n")

def cli(*args, timeout=180):
    try:
        p = subprocess.run(["arcbench", *ENV, *args], capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        return None, "timeout"
    return p, (p.stdout + p.stderr)

def status(rid):
    p, out = cli("status", rid)
    for line in (out or "").splitlines():
        if line.startswith("result: "):
            return json.loads(line[8:])
    return None

def wait_done(rid, name):
    while True:
        r = status(rid)
        if r and r.get("status") not in ("RUNNING", "PENDING", "QUEUED", None):
            (OUT / f"run-{rid}.json").write_text(json.dumps(r, ensure_ascii=False, indent=1))
            log(f"{name} {rid} -> {r['status']} {r.get('passed')}/{(r.get('passed') or 0) + (r.get('failed') or 0)} cost {r.get('cost')}")
            return r
        time.sleep(60)

wait_done("14de9c6238ff", "sub3 sheet")
sid = None
for attempt in range(30):
    p, out = cli("upload", "--competition", "hackathon", "--official-evaluation", "--model", "deepseek-v4-flash",
                 "--name", "volo-oneshot-9bf0254a-grid-mechanics", "--json", PKG, timeout=600)
    try:
        data = json.loads([l for l in out.splitlines() if l.strip().startswith("{")][-1]) if out else {}
    except (ValueError, IndexError):
        data = {}
    sid = ((data.get("submission") or {}).get("id")) if isinstance(data, dict) else None
    if sid:
        (OUT / "official-upload-4.json").write_text(json.dumps(data, ensure_ascii=False, indent=1))
        log(f"uploaded submission {sid} sha {data.get('uploaded_sha256')}")
        break
    log(f"upload attempt {attempt + 1} failed: {(out or '')[-300:]}")
    time.sleep(300)
if not sid:
    log("gave up uploading"); sys.exit(1)
runs = []
for attempt in range(1):  # never re-issue: a retry after a half-reported start would duplicate runs
    p, out = cli("run", sid, "--all-tasks", "--json", timeout=300)
    runs = []
    for line in (out or "").splitlines():
        try:
            obj = json.loads(line.split("result: ", 1)[-1]) if line.strip() else None
        except ValueError:
            continue
        for item in (obj if isinstance(obj, list) else [obj]):
            if isinstance(item, dict):
                rid = item.get("run_id") or item.get("id")
                if rid: runs.append((rid, item.get("requirement_id") or item.get("task")))
    if runs:
        log(f"runs started: {runs}"); break
    log(f"run attempt {attempt + 1} failed: {(out or '')[-400:]}")
    time.sleep(120)
for rid, task in runs:
    wait_done(rid, f"sub4 {task}")
log("done")
