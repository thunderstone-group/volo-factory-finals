"""Summarize [oneshot] trace/smoke/usage lines from a saved platform log JSON (read-only, regex based
because the platform's *** redaction breaks JSON)."""
import json, re, sys

def load_stdout(path):
    try:
        d = json.load(open(path))
    except Exception:
        return open(path, encoding="utf-8", errors="replace").read()
    if isinstance(d, dict):
        return d.get("stdout") or d.get("console") or ""
    return str(d)

def unescape_len(raw):
    return len(raw.replace('\\n', '\n').replace('\\"', '"').replace('\\\\', '\\').replace('\\t', '\t'))

def trace_record(msg):
    rec = {}
    m = re.match(r'\{"call": (\d+), "model": "([^"]*)"', msg)
    if m:
        rec["call"], rec["model"] = int(m.group(1)), m.group(2)
    tail = msg[-4000:]
    for key in ("status", "finish_reason", "error_type"):
        mm = re.findall(r'"%s": (null|"[^"]*")' % key, tail)
        if mm:
            rec[key] = json.loads(mm[-1]) if mm[-1] != "null" else None
    mm = re.findall(r'"elapsed_seconds": ([\d.]+)', tail)
    if mm:
        rec["elapsed"] = float(mm[-1])
    mm = re.findall(r'"http_status": (\d+)', tail)
    if mm:
        rec["http"] = int(mm[-1])
    # top-level content: between '], "content": "' (end of messages) and '", "usage": {'
    end = msg.rfind('", "usage": {')
    start = msg.rfind('], "content": "', 0, end if end > 0 else len(msg))
    if start > 0 and end > start:
        raw = msg[start + len('], "content": "'):end]
        rec["content_chars"] = unescape_len(raw)
        rec["files"] = re.findall(r'=== FILE:\s*(.*?)\s*===', raw)
        rec["ends"] = raw.count('=== END ===')
        mstart = msg.find('"messages": [')
        rec["prompt_chars"] = unescape_len(msg[mstart:start]) if mstart > 0 else None
    else:
        rec["content_chars"] = None
    so = re.search(r'"stream_observation": (\{[^}]*\})', msg)
    if so:
        try:
            rec["stream"] = json.loads(re.sub(r':\s*\*\*\*', ': null', so.group(1)))
        except Exception:
            pass
    return rec

def summarize(path):
    s = load_stdout(path)
    out = {"path": path, "calls": [], "smoke": None, "usage": None, "wrote": None, "failed": None,
           "agent_start": None, "agent_end": None, "notes": []}
    for line in s.split("\n"):
        m = re.match(r"\[(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)[^\]]*\] \[runner\] (.*)$", line)
        body = m.group(2) if m else line
        ts = m.group(1) if m else None
        if "Executing generation-agent" in body:
            out["agent_start"] = ts
        if "generation-agent exit code" in body:
            out["agent_end"] = ts; out["exit"] = body.split(":")[-1].strip()
        idx = body.find("[oneshot] ")
        if idx < 0:
            continue
        msg = body[idx + len("[oneshot] "):]
        if msg.startswith("trace "):
            out["calls"].append(trace_record(msg[6:]))
        elif msg.startswith("smoke "):
            sm = msg[6:]
            info = {"len": len(sm)}
            info["accepted"] = re.findall(r'"accepted": (true|false)', sm)
            r = re.search(r'"reason": "(.{0,400})', sm)
            info["reason"] = r.group(1)[:400] if r else None
            info["repair_str"] = (re.search(r'"repair": ("[^"]*"|null)', sm) or [None, None])[1]
            probs = re.search(r'"problems": \[(.*?)\], "vocabulary_missing"', sm)
            info["problems_head"] = [p[:150] for p in re.findall(r'"((?:[^"\\]|\\.){20,}?)"', probs.group(1))][:8] if probs else None
            vm = re.search(r'"vocabulary_missing": (\d+)', sm)
            info["vocab_missing"] = int(vm.group(1)) if vm else None
            out["smoke"] = info
        elif msg.startswith("usage "):
            out["usage"] = msg[6:][:600]
        elif msg.startswith("wrote "):
            out["wrote"] = msg
        elif msg.startswith("failed"):
            out["failed"] = msg[:300]
        else:
            out["notes"].append(msg[:200])
    return out

if __name__ == "__main__":
    for p in sys.argv[1:]:
        r = summarize(p)
        print(json.dumps(r, ensure_ascii=False, indent=1)[:8000])
