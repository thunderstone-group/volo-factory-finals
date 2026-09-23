"""Read-only analysis of one platform run: [oneshot] trace/smoke/usage lines from the saved log JSON,
the billed gateway requests inside the agent window, and the run status. Numbers the platform redacted
(`***`) stay unknown (None); nothing is estimated."""
import calendar
import collections
import json
import re
import sys
import time

RUNNER = re.compile(r"^\[(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)(?: UTC)?\] \[(\w+)\] (.*)$")
CUT_INSIDE = "Your output was cut off inside the file"
CUT_BETWEEN = "Your output was cut off between two files"
REPAIR_ASK = "The application you delivered failed the runner's delivery check"


def utc_epoch(ts):
    return calendar.timegm(time.strptime(ts, "%Y-%m-%d %H:%M:%S"))


def repair_json(raw):
    """The platform replaces values after token/password-ish words with `***` (a number, an opening brace, or the
    space and backslash before an escaped quote). Pick, gap by gap, the first stand-in that lets the parser get
    past the gap: the truncated trial may only fail at its end, or inside a string still open there."""
    chunks = raw.split("***")
    fixed = chunks[0]
    for i in range(1, len(chunks)):
        rest = chunks[i]
        last = i == len(chunks) - 1
        for candidate in ("null", "{", "\\", "", "0"):
            trial = fixed + candidate + rest
            try:
                json.loads(trial)
                ok = True
            except json.JSONDecodeError as exc:
                ok = not last and (exc.pos >= len(trial) - 1 or exc.msg.startswith("Unterminated string"))
            if ok:
                fixed = trial
                break
        else:
            fixed = fixed + "null" + rest
    return json.loads(fixed)


def load_stdout(path):
    d = json.load(open(path, encoding="utf-8"))
    return d.get("stdout") or d.get("console") or ""


def classify(record, index, calls):
    if record.get("phase") == "repair":
        return "修复"
    msgs = record.get("messages") or []
    last_user = next((m.get("content", "") for m in reversed(msgs) if m.get("role") == "user"), "")
    if last_user.startswith(CUT_INSIDE):
        return "续写(文件内截断)"
    if last_user.startswith(CUT_BETWEEN):
        return "续写(文件间截断)"
    if last_user.startswith(REPAIR_ASK):
        return "修复"
    # A draft with the original two messages: first draft, a transport retry, or a redraft of an empty reply.
    prior = [c for c in calls[:index] if c.get("phase", "draft") == "draft"]
    if not prior:
        return "起草"
    prev = prior[-1]
    if prev.get("status") != "completed":
        return "起草(传输重试)"
    return "起草(空正文重发)"


def _unescape(raw):
    try:
        return json.loads('"' + raw + '"')
    except Exception:
        # Redaction (`***`) can break a JSON string; approximate the text for counting only.
        return (raw.replace('\\\\', '\x00').replace('\\n', '\n').replace('\\t', '\t')
                .replace('\\"', '"').replace('\x00', '\\'))


def trace_fields(msg):
    """Split on framing that redaction cannot produce, then read the scalar tail with regexes."""
    rec = {}
    m = re.match(r'\{"call": (\d+), (?:"phase": "(\w+)", )?"model": "([^"]*)"', msg)
    if m:
        rec["call"], rec["phase"], rec["model"] = int(m.group(1)), m.group(2) or "draft", m.group(3)
    usage_at = msg.rfind('", "usage": {')
    content_at = msg.rfind('"}], "content": "', 0, usage_at if usage_at > 0 else len(msg))
    messages_at = msg.find('"messages": [')
    if messages_at > 0 and content_at > messages_at:
        section = msg[messages_at + len('"messages": ['):content_at + 2]
        parts = re.split(r'(?:^|"\}, )\{"role": "(system|user|assistant)", "content": "', section)
        msgs = []
        for i in range(1, len(parts), 2):
            body = parts[i + 1]
            if i + 2 >= len(parts) and body.endswith('"}'):
                body = body[:-2]
            msgs.append({"role": parts[i], "content": _unescape(body)})
        rec["messages"] = msgs
    if content_at > 0 and usage_at > content_at:
        rec["content"] = _unescape(msg[content_at + len('"}], "content": "'):usage_at])
    tail = msg[usage_at:] if usage_at > 0 else msg[-6000:]
    for key in ("status", "finish_reason", "error_type", "request_sha256"):
        mm = re.findall(r'"%s": (null|"[^"]*")' % key, tail)
        if mm:
            rec[key] = None if mm[-1] == "null" else json.loads(mm[-1])
    for key in ("elapsed_seconds", "http_status"):
        mm = re.findall(r'"%s": ([\d.]+)' % key, tail)
        if mm:
            rec[key] = float(mm[-1]) if "." in mm[-1] else int(mm[-1])
    so = re.search(r'"stream_observation": (\{[^}]*\})', tail)
    if so:
        rec["stream_observation"] = {k: (None if v == "***" else int(v)) for k, v in
                                     re.findall(r'"(\w+)": (\*\*\*|\d+)', so.group(1))}
    us = re.search(r'"usage": (\{[^}]*\})', tail)
    if us:
        rec["usage"] = {k: (None if v == "***" else int(v)) for k, v in re.findall(r'"(\w+)": (\*\*\*|\d+)', us.group(1))}
    rt = re.findall(r'"reasoning_tokens": (\*\*\*|\d+)', tail)
    rec["reasoning_tokens_last"] = None if not rt or rt[-1] == "***" else int(rt[-1])
    rec["_json"] = "messages" in rec
    return rec


def parse(path):
    s = load_stdout(path)
    out = {"calls": [], "smoke": None, "usage": None, "wrote": None, "failed": None, "notes": [],
           "agent_start": None, "agent_end": None, "agent_exit": None, "test_lines": [], "runner_steps": []}
    for line in s.split("\n"):
        m = RUNNER.match(line)
        ts, body = (m.group(1), m.group(3)) if m else (None, line)
        if m and m.group(2) == "runner":
            if body.startswith("Executing "):
                out["runner_steps"].append((ts, body[:160]))
            if "exit code:" in body:
                out["runner_steps"].append((ts, body[:160]))
        if body.startswith("Executing generation-agent"):
            out["agent_start"] = ts
        if body.startswith("generation-agent exit code"):
            out["agent_end"], out["agent_exit"] = ts, body.split(":")[-1].strip()
        idx = body.find("[oneshot] ")
        if idx < 0:
            continue
        msg = body[idx + len("[oneshot] "):]
        if msg.startswith("trace "):
            out["calls"].append(trace_fields(msg[len("trace "):]))
        elif msg.startswith("smoke "):
            try:
                out["smoke"] = repair_json(msg[len("smoke "):])
            except Exception:
                out["smoke"] = {"_raw": msg[len("smoke "):][:4000]}
        elif msg.startswith("usage "):
            try:
                out["usage"] = repair_json(msg[len("usage "):])
            except Exception:
                out["usage"] = {"_raw": msg[len("usage "):][:1000]}
        elif msg.startswith("wrote "):
            out["wrote"] = msg.strip()
        elif msg.startswith("failed"):
            out["failed"] = msg[:600]
        else:
            out["notes"].append((ts, msg[:400]))
    for i, rec in enumerate(out["calls"]):
        rec["stage"] = classify(rec, i, out["calls"])
        content = rec.get("content") or ""
        rec["content_len"] = len(content)
        rec["file_blocks"] = len(re.findall(r"^=== FILE:", content, re.M))
        rec["end_markers"] = len(re.findall(r"^=== END ===\s*$", content, re.M))
        rec["prompt_chars"] = sum(len(m.get("content", "")) for m in rec.get("messages") or []) if rec.get("_json") else None
        rec["n_messages"] = len(rec.get("messages") or []) if rec.get("_json") else None
    return out


def smoke_chain(smoke):
    """Every repair record, oldest first (previous_repairs holds the earlier ones)."""
    if not smoke or "_raw" in smoke:
        return []
    chain = list(smoke.get("previous_repairs") or []) + [smoke]
    rows = []
    for item in chain:
        rep = item.get("repair")
        row = {"problems": len(item.get("problems") or []), "vocabulary_missing": item.get("vocabulary_missing"),
               "problems_after": (len(item["problems_after"]) if isinstance(item.get("problems_after"), list) else None)}
        if isinstance(rep, dict):
            row.update({"accepted": rep.get("accepted"), "reason": rep.get("reason"), "files": rep.get("files"),
                        "renamed_controls": rep.get("renamed_controls"),
                        "vocabulary_missing_after": rep.get("vocabulary_missing_after")})
        else:
            row.update({"accepted": None, "reason": rep})
        rows.append(row)
    return rows


def billed(requests, start, end, slack=120):
    return sorted((r for r in requests if start - slack <= r["occurred_at"] <= end + slack),
                  key=lambda r: r["occurred_at"])


def request_start(bill):
    """The gateway request id starts with the request's start time in China time (yyyymmddHHMMSS)."""
    m = re.match(r"(\d{14})", str(bill.get("request_id", "")))
    if not m:
        return None
    return calendar.timegm(time.strptime(m.group(1), "%Y%m%d%H%M%S")) - 8 * 3600


def attribute(rows, bills, start, end=None):
    """Match each call to its billed request. Primary key: the bill's own duration (occurred_at minus the start time
    encoded in its request id) equals the call's elapsed_seconds within 3 s, and the bill lies inside the agent
    window; fallback: the predicted end time (agent start + elapsed of this and every earlier call + gaps). A bill is
    used once; bills left over belong to another run sharing the window."""
    used = set()
    gap = 0.0
    for r in rows:
        predicted = start + r["cum_elapsed"] + gap
        best = None
        for j, b in enumerate(bills):
            if j in used or b["model"] != r["model"]:
                continue
            began = request_start(b)
            delta = b["occurred_at"] - predicted
            if began is not None and r.get("elapsed_seconds") is not None:
                if began < start - 5 or (end is not None and b["occurred_at"] > end + 5):
                    continue
                score = abs((b["occurred_at"] - began) - r["elapsed_seconds"])
                if score > 3:
                    continue
                score += abs(delta) / 1000.0
            else:
                if not -15 <= delta <= 240:
                    continue
                score = 10 + abs(delta)
            if best is None or score < best[1]:
                best = (j, score, delta, began)
        if best is None:
            r.update({"bill": None, "bill_delta": None})
            continue
        j, _, delta, began = best
        used.add(j)
        gap += max(delta, 0)
        m = bills[j]["metrics"]
        r.update({"bill": bills[j]["request_id"], "bill_delta": round(delta, 1),
                  "bill_duration": (bills[j]["occurred_at"] - began) if began is not None else None,
                  "input_tokens": m.get("input_tokens"), "cached_tokens": m.get("cached_tokens"),
                  "output_tokens": m.get("output_tokens"), "amount": float(m["amount"]) if m.get("amount") else None})
    return [b for j, b in enumerate(bills) if j not in used]


def fmt(v, width=0):
    s = "未知" if v is None else str(v)
    return s.rjust(width) if width else s


def main(run_id, log_path, status_path, requests_path, out_json):
    log = parse(log_path)
    status = json.load(open(status_path, encoding="utf-8"))
    status = status[0] if isinstance(status, list) else status
    requests = json.load(open(requests_path, encoding="utf-8"))
    start = utc_epoch(log["agent_start"]) if log["agent_start"] else None
    end = utc_epoch(log["agent_end"]) if log["agent_end"] else None
    bills = billed(requests, start, end) if start and end else []
    print(f"=== run {run_id} {status.get('requirement_id')} status={status.get('status')} "
          f"passed={status.get('passed')} failed={status.get('failed')} total={status.get('passed', 0) + status.get('failed', 0)} "
          f"cost={status.get('cost')} tokens={status.get('tokens')} duration={status.get('duration_seconds')}s")
    print(f"agent window (UTC) {log['agent_start']} -> {log['agent_end']} exit={log['agent_exit']} "
          f"= {end - start if start and end else None}s; {log['wrote']}; failed-line={log['failed']}")
    cum = 0.0
    rows = []
    for rec in log["calls"]:
        so = rec.get("stream_observation") or {}
        usage = rec.get("usage") or {}
        cum += rec.get("elapsed_seconds") or 0
        row = {"call": rec.get("call"), "stage": rec["stage"], "phase": rec.get("phase"), "model": rec.get("model"),
               "status": rec.get("status"), "finish_reason": rec.get("finish_reason"),
               "error_type": rec.get("error_type"), "http_status": rec.get("http_status"),
               "elapsed_seconds": rec.get("elapsed_seconds"), "cum_elapsed": round(cum, 1),
               "prompt_tokens_log": usage.get("prompt_tokens"), "completion_tokens_log": usage.get("completion_tokens"),
               "reasoning_tokens_log": rec.get("reasoning_tokens_last"),
               "content_chars_obs": so.get("content_chars"), "reasoning_chars_obs": so.get("reasoning_chars"),
               "sse_events": so.get("sse_events"), "received_bytes": so.get("received_bytes"),
               "content_len": rec["content_len"], "file_blocks": rec["file_blocks"], "end_markers": rec["end_markers"],
               "prompt_chars": rec["prompt_chars"], "n_messages": rec["n_messages"], "json_ok": rec.get("_json")}
        rows.append(row)
    print(f"{'#':>2} {'stage':18} {'model':26} {'status':9} {'finish':7} {'elapsed':>8} {'cum':>7} "
          f"{'content_ch':>10} {'reason_ch':>9} {'files':>5} {'prompt_ch':>9} {'in_tok':>7} {'out_tok':>7}")
    for r in rows:
        print(f"{r['call']:>2} {r['stage']:18} {str(r['model']):26} {str(r['status']):9} {str(r['finish_reason']):7} "
              f"{fmt(r['elapsed_seconds'], 8)} {r['cum_elapsed']:>7} {fmt(r['content_chars_obs'], 10)} "
              f"{fmt(r['reasoning_chars_obs'], 9)} {r['file_blocks']:>5} {fmt(r['prompt_chars'], 9)} "
              f"{fmt(r['prompt_tokens_log'], 7)} {fmt(r['completion_tokens_log'], 7)}"
              + (f"  err={r['error_type']} http={r['http_status']}" if r['error_type'] else ""))
    leftover = attribute(rows, bills, start, end) if start else bills
    print("per-call billing (matched by predicted end time; delta = bill time - predicted end):")
    for r in rows:
        print(f"   call {r['call']}: bill={r.get('bill')} delta={r.get('bill_delta')}s bill_dur={r.get('bill_duration')}s "
              f"call_elapsed={r.get('elapsed_seconds')}s in={r.get('input_tokens')} "
              f"cached={r.get('cached_tokens')} out={r.get('output_tokens')} CNY={r.get('amount')}")
    matched = [r["amount"] for r in rows if r.get("amount") is not None]
    print(f"   run cost from matched bills: CNY {sum(matched):.6f} over {len(matched)} bill(s); "
          f"tokens {sum((r.get('input_tokens') or 0) + (r.get('output_tokens') or 0) for r in rows)}; "
          f"bills in window not matched to this run: {len(leftover)}")
    print("billed requests inside the agent window (occurred_at UTC, model, input, cached, output, CNY):")
    for b in bills:
        m = b["metrics"]
        print(f"   {time.strftime('%H:%M:%S', time.gmtime(b['occurred_at']))} +{b['occurred_at'] - start:>5}s "
              f"{b['model']:26} in={m.get('input_tokens')} cached={m.get('cached_tokens')} out={m.get('output_tokens')} "
              f"amount={m.get('amount')}")
    chain = smoke_chain(log["smoke"])
    print("smoke/repair chain:")
    for i, c in enumerate(chain, 1):
        print(f"   repair {i}: accepted={c.get('accepted')} problems={c['problems']} vocab_missing={c['vocabulary_missing']} "
              f"problems_after={c['problems_after']} files={c.get('files')} renamed={c.get('renamed_controls')} "
              f"reason={(c.get('reason') or '')[:300]!r}")
    if log["smoke"] and "_raw" in log["smoke"]:
        print("   smoke raw (unparsed):", log["smoke"]["_raw"][:800])
    print("usage summary:", json.dumps(log["usage"], ensure_ascii=False)[:600])
    print("other [oneshot] lines:")
    for ts, n in log["notes"]:
        print(f"   {ts} {n[:300]}")
    reqs = collections.Counter()
    for t in status.get("failed_tests") or []:
        m = re.match(r"(REQ-[\d.]+)", t.get("name", ""))
        if m:
            reqs[m.group(1)] += 1
    json.dump({"run_id": run_id, "status": {k: v for k, v in status.items() if k != "failed_tests"},
               "failed_tests": [t.get("name") for t in status.get("failed_tests") or []],
               "agent_start": log["agent_start"], "agent_end": log["agent_end"], "agent_exit": log["agent_exit"],
               "wrote": log["wrote"], "failed_line": log["failed"], "calls": rows, "bills": bills, "unmatched_bills": leftover,
               "repairs": chain, "usage": log["usage"], "notes": log["notes"],
               "runner_steps": log["runner_steps"]},
              open(out_json, "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main(*sys.argv[1:6])
