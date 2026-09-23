#!/usr/bin/env python3
"""Rebuild the pre-repair draft of a model-pair sample: the scaffold plus every file block of its completed draft-phase
calls, later blocks replacing earlier ones (the way generate() writes them).
    draft_from_trace.py SAMPLE_DIR OUT_APP_DIR"""
import json, shutil, sys
from pathlib import Path
sys.path.insert(0, str(Path.home() / "projects/volo-factory-worktrees/scenario-repair"))
from oneshot import main as adapter

sample, out = Path(sys.argv[1]), Path(sys.argv[2])
if out.exists():
    raise SystemExit(f"{out} exists")
records = []
for line in (sample / "stderr.log").read_text(encoding="utf-8", errors="replace").splitlines():
    if line.startswith("[oneshot] trace "):
        records.append(json.loads(line[len("[oneshot] trace "):]))
drafts = [r for r in records if r.get("phase") == "draft" and r.get("content")]
if not drafts:
    raise SystemExit("no draft content in the trace")
shutil.copytree(adapter.SCAFFOLD_DIR, out)
written = []
for record in drafts:
    blocks, _, _ = adapter.salvage_blocks(record["content"])
    for item in blocks:
        target = adapter.resolve_path(out, item["path"])
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(item["content"], encoding="utf-8")
        written.append(item["path"])
print(json.dumps({"draft_calls": [(r["call"], r.get("status"), r.get("finish_reason")) for r in drafts],
                  "files": sorted(set(written)),
                  "repairs": [(r["call"], r.get("status")) for r in records if r.get("phase") == "repair"]}))
