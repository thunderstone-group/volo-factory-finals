#!/usr/bin/env python3
"""Build pre-repair drafts of finished model-pair flash samples and a job list: replay the draft, and repair it with
the new loop. Skips samples already prepared.  pair_prepare.py OUT_JOBS.json"""
import json, subprocess, sys
from pathlib import Path
SP = Path(__file__).resolve().parent
MP = Path("/private/tmp/claude-501/-Users-e0-7-projects/a492ba62-8f9a-4850-a1ad-d5f49589dfb2/scratchpad/agent-modelpair/gens")
PY = Path.home() / "projects/volo-factory/.venv/bin/python"
jobs = []
for sample in sorted((MP / "flash").iterdir()):
    task = sample.name.split("-")[0]
    if task not in ("keep", "bookstack") or not (sample / "replay-result.json").is_file():
        continue
    label = f"flash-{sample.name}"
    draft = SP / "pair-drafts" / label
    if not draft.exists():
        r = subprocess.run([str(PY), str(SP / "draft_from_trace.py"), str(sample), str(draft)], capture_output=True, text=True)
        print(label, r.stdout.strip()[-300:], r.stderr.strip()[-300:])
    old = json.loads((sample / "replay-result.json").read_text())
    jobs.append({"label": "pair-draft-" + label, "task": task, "app": str(draft), "replay_only": True})
    jobs.append({"label": "pair-new-" + label, "task": task, "app": str(draft), "old_repair": f"{old['passed']}/{old['total']}"})
Path(sys.argv[1]).write_text(json.dumps(jobs, indent=1))
print(len(jobs), "jobs")
