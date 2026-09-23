import sys, json
sys.path.insert(0, "/private/tmp/claude-501/-Users-e0-7-projects/a492ba62-8f9a-4850-a1ad-d5f49589dfb2/scratchpad/agent-large/tools")
from trace_summary import summarize
for p in sys.argv[1:]:
    r = summarize(p)
    print("##", p, "| agent", r["agent_start"], "->", r["agent_end"], "exit", r.get("exit"), "|", r["wrote"] or r["failed"])
    for c in r["calls"]:
        print("   call", c.get("call"), c.get("model"), c.get("status"), "finish=", c.get("finish_reason"), "err=", c.get("error_type"),
              "elapsed=", c.get("elapsed"), "content_chars=", c.get("content_chars"), "prompt_chars=", c.get("prompt_chars"),
              "files=", ",".join((f.split("/")[-1]) for f in c.get("files") or []), "stream=", c.get("stream"))
    sm = r["smoke"]
    if sm:
        print("   smoke: accepted=", sm["accepted"], "repair_str=", sm["repair_str"], "vocab_missing=", sm["vocab_missing"], "reason=", (sm["reason"] or "")[:200])
        for ph in sm["problems_head"] or []:
            print("     -", ph[:140])
    for n in r["notes"]:
        print("   note:", n)
