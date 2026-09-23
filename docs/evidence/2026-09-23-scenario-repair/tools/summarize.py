#!/usr/bin/env python3
"""Summarize the 4.3 validation: per job the repair rounds, scenario counts, cost, and the public replay against the
public result before the repair (criterion 2: accepted repairs never lower the public pass count)."""
import json, sys
from pathlib import Path
SP = Path(__file__).resolve().parent
LITE = Path.home() / "projects/volo-factory-worktrees/lite-first-20260922/runs/lite-goal-20260922/replays"
BEFORE = {"v24": ("official-v24/bookstack", 9), "v22a": ("form-state-v22/bookstack-highspeed-a", 9),
          "base": ("baseline/bookstack-a", 5), "c8a5": (None, 9)}


def public(path):
    try:
        d = json.loads(Path(path).read_text())
    except (OSError, ValueError):
        return None
    cases = d.get("cases") or []
    return {c["id"]: bool(c.get("passed")) for c in cases}


rows = []
for job in json.loads(Path(sys.argv[1]).read_text()):
    label = job["label"]
    rep = SP / "runs" / label / "repair.json"
    if not rep.is_file():
        rows.append({"label": label, "status": "pending"})
        continue
    r = json.loads(rep.read_text())
    sm = r["smoke"] or {}
    rounds = sm.get("rounds") or []
    after = public(SP / "replays" / label / "result.json")
    if label.startswith("c1-"):
        key = label.split("-")[1]
        rel, _ = BEFORE[key]
        before = public(LITE / rel / "result.json") if rel else public(SP / "replays" / "c8a5-original" / "result.json")
    else:
        rel = label[3:].replace("__", "/")
        before = public(LITE / rel / "result.json")
    row = {"label": label, "cost": r["summary"]["estimated_repair_cost_cny"], "seconds": r["seconds"],
           "self": f"{(sm.get('scenarios') or {}).get('counts')} -> {(sm.get('scenarios_after') or {}).get('counts')}",
           "rounds": [("+" if x["accepted"] else "-") + (x.get("reason") or "")[:70] for x in rounds],
           "stopped": sm.get("stopped"), "error": r.get("error")}
    if after is not None:
        row["public_after"] = sum(after.values())
    if before is not None:
        row["public_before"] = sum(before.values())
        if after is not None:
            row["lost_cases"] = sorted(k for k, v in before.items() if v and not after.get(k))
            row["gained_cases"] = sorted(k for k, v in after.items() if v and not before.get(k))
    rows.append(row)
print(json.dumps(rows, ensure_ascii=False, indent=1))
