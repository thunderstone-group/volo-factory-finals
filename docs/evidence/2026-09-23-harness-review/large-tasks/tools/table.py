import sys, json, glob, os, re
sys.path.insert(0, os.path.dirname(__file__))
from trace_summary import summarize
SP = "/private/tmp/claude-501/-Users-e0-7-projects/a492ba62-8f9a-4850-a1ad-d5f49589dfb2/scratchpad/agent-large"
meta = {}
for line in open(SP + "/fetch-list.txt"):
    tag, rid, task, passed, dur = line.split()
    meta[rid] = (tag, task, int(passed), dur)
rows = []
for rid, (tag, task, passed, dur) in meta.items():
    p = f"{SP}/logs/{rid}/{rid}-logs.json"
    if not os.path.exists(p):
        continue
    r = summarize(p)
    calls = r["calls"]
    draft = calls[0] if calls else {}
    agent_s = None
    m = re.search(r"in ([\d.]+)s", r["wrote"] or "")
    if m: agent_s = float(m.group(1))
    sm = r["smoke"] or {}
    rows.append(dict(tag=tag, rid=rid, task=task, passed=passed, run_dur=dur, agent_s=agent_s, exit=r.get("exit"),
                     ncalls=len(calls),
                     calls=[(c.get("model","?")[:8], c.get("status"), c.get("finish_reason"), c.get("error_type"), c.get("elapsed"), c.get("content_chars"), len(c.get("files") or [])) for c in calls],
                     draft_chars=draft.get("content_chars"), prompt_chars=draft.get("prompt_chars"),
                     repair_accepted=sm.get("accepted"), repair_reason=(sm.get("reason") or "")[:160], repair_str=sm.get("repair_str"),
                     failed=r["failed"], notes=r["notes"]))
json.dump(rows, open(SP + "/large-gen-table.json", "w"), indent=1, ensure_ascii=False)
for x in sorted(rows, key=lambda x: (x["task"], x["tag"])):
    print(f'{x["task"]:13} {x["tag"]:30} {x["rid"]} pass={x["passed"]:>3} agent={x["agent_s"]} exit={x["exit"]} draft_chars={x["draft_chars"]} prompt={x["prompt_chars"]}')
    for c in x["calls"]:
        print("      ", c)
    print("       repair accepted=", x["repair_accepted"], "str=", x["repair_str"], "reason=", x["repair_reason"][:140], "| failed=", x["failed"], "| notes=", x["notes"][:3])
