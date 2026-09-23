#!/usr/bin/env python3
"""Summarise one generation of the model-pair experiment from its own logs (no network)."""
import json
import re
import sys
from pathlib import Path

# CNY per 1M tokens: input cache miss, input cache hit, output. Read from `arcbench models` at 13:13 on 09-23.
PRICES = {"deepseek-v4-flash": (3.0, 0.1, 9.0), "kimi-k2.7-code-highspeed": (13.0, 2.6, 54.0)}
# Conservative stand-ins for calls the log cannot price (a cut stream is billed but reports no usage).
CHARS_PER_TOKEN = 3.0

EVENT_PATTERNS = {
    "cut_stream_kept": re.compile(r"^\[oneshot\] call \d+ was cut \(.*\) after \d+ characters; keeping"),
    "transport_fallback": re.compile(r"^\[oneshot\] \S+ failed \d+ times; the rest of this run uses (\S+)"),
    "content_filter": re.compile(r"^\[oneshot\] the stream ended with finish_reason=content_filter"),
    "empty_reply_retry": re.compile(r"^\[oneshot\] the reply has no file blocks; asking again"),
    "framing_retry": re.compile(r"^\[oneshot\] the reply broke the file framing before any complete file"),
    "continue_inside_file": re.compile(r"^\[oneshot\] the output was cut off inside `.*`; continuing"),
    "continue_between_files": re.compile(r"^\[oneshot\] the output was cut off between two files; continuing"),
    "continue_after_framing_break": re.compile(r"^\[oneshot\] the reply broke the file framing \(.*\); continuing"),
    "closed_unterminated_block": re.compile(r"^\[oneshot\] closing an unterminated final block"),
    "bounded_retry": re.compile(r"^\[oneshot\] call \d+ failed; bounded retry"),
    "delivered_after_error": re.compile(r"^\[oneshot\] delivering the last complete version after an error"),
    "failed": re.compile(r"^\[oneshot\] failed:"),
    "re_emitted_file": re.compile(r"^\[oneshot\] .* emitted again; keeping the later version"),
}


def cached_tokens(attempt):
    best = 0
    for ev in attempt.get("usage_events") or []:
        if not isinstance(ev, dict):
            continue
        details = ev.get("prompt_tokens_details") or {}
        for value in (ev.get("prompt_cache_hit_tokens"), ev.get("cached_tokens"),
                      details.get("cached_tokens") if isinstance(details, dict) else None):
            if isinstance(value, int) and value > best:
                best = value
    return best


def attempt_cost(attempt):
    """(cost, basis): exact from reported usage, else an estimate from the observed stream."""
    price = PRICES.get(attempt.get("model"))
    usage = attempt.get("usage") or {}
    if price is None:
        return None, "unpriced model"
    if "prompt_tokens" in usage and "completion_tokens" in usage:
        cached = min(cached_tokens(attempt), usage["prompt_tokens"])
        cost = ((usage["prompt_tokens"] - cached) * price[0] + cached * price[1]
                + usage["completion_tokens"] * price[2]) / 1e6
        return cost, "usage"
    observed = attempt.get("stream_observation") or {}
    out_tokens = (observed.get("content_chars", 0) + observed.get("reasoning_chars", 0)) / CHARS_PER_TOKEN
    prompt_chars = sum(len(m.get("content", "")) for m in attempt.get("messages") or [])
    in_tokens = prompt_chars / CHARS_PER_TOKEN if observed.get("received_bytes") else 0
    return (in_tokens * price[0] + out_tokens * price[2]) / 1e6, "estimate(no usage reported)"


def summarize(sample_dir):
    d = Path(sample_dir)
    meta = json.loads((d / "meta.json").read_text())
    attempts, smoke, usage = [], None, None
    events = {name: 0 for name in EVENT_PATTERNS}
    fallback_to = None
    stderr = d / "stderr.log"
    for raw in stderr.open("r", encoding="utf-8", errors="replace") if stderr.is_file() else []:
        line = raw.rstrip("\n")
        if line.startswith("[oneshot] trace "):
            attempts.append(json.loads(line[len("[oneshot] trace "):]))
            continue
        if line.startswith("[oneshot] smoke "):
            smoke = json.loads(line[len("[oneshot] smoke "):])
            continue
        if line.startswith("[oneshot] usage "):
            usage = json.loads(line[len("[oneshot] usage "):])
            continue
        for name, pattern in EVENT_PATTERNS.items():
            m = pattern.search(line)
            if m:
                events[name] += 1
                if name == "transport_fallback":
                    fallback_to = m.group(1)
    calls = []
    total_cost, exact = 0.0, True
    for a in attempts:
        cost, basis = attempt_cost(a)
        exact &= basis == "usage"
        total_cost += cost or 0.0
        u = a.get("usage") or {}
        calls.append({"call": a.get("call"), "phase": a.get("phase"), "model": a.get("model"),
                      "status": a.get("status"), "finish_reason": a.get("finish_reason"),
                      "error_type": a.get("error_type"), "http_status": a.get("http_status"),
                      "elapsed_seconds": a.get("elapsed_seconds"),
                      "prompt_tokens": u.get("prompt_tokens"), "completion_tokens": u.get("completion_tokens"),
                      "cached_tokens": cached_tokens(a),
                      "content_chars": (a.get("stream_observation") or {}).get("content_chars"),
                      "reasoning_chars": (a.get("stream_observation") or {}).get("reasoning_chars"),
                      "request_sha256": a.get("request_sha256"),
                      "local_cost_cny": round(cost, 6) if cost is not None else None, "cost_basis": basis})
    repairs = []
    if smoke:
        chain = list(smoke.get("previous_repairs") or []) + [smoke]
        for step in chain:
            r = step.get("repair")
            if isinstance(r, dict):
                repairs.append({"accepted": r.get("accepted"), "reason": (r.get("reason") or "")[:300] or None,
                                "files": r.get("files"), "waived": r.get("waived")})
            elif r:
                repairs.append({"accepted": None, "reason": r})
    stdout = (d / "stdout.log").read_text(errors="replace") if (d / "stdout.log").is_file() else ""
    wrote = re.search(r"\[oneshot\] wrote (\d+) files in ([\d.]+)s", stdout)
    delivered = (d / "app" / "frontend" / "package.json").is_file() and (d / "app" / "backend" / "package.json").is_file()
    models_used = sorted({a.get("model") for a in attempts if a.get("model")})
    return {
        "model": meta["model"], "task": meta["task"], "sample": meta["sample"],
        "exit_code": meta.get("exit_code"), "wall_seconds": meta.get("wall_seconds"),
        "started_at": meta.get("started_at"), "ended_at": meta.get("ended_at"),
        "delivered": delivered, "files_written": int(wrote.group(1)) if wrote else None,
        "calls_total": len(attempts),
        "calls_completed": sum(a.get("status") == "completed" for a in attempts),
        "calls_failed": sum(a.get("status") != "completed" for a in attempts),
        "draft_calls_completed": sum(a.get("status") == "completed" and a.get("phase") == "draft" for a in attempts),
        "repair_calls_completed": sum(a.get("status") == "completed" and a.get("phase") == "repair" for a in attempts),
        "models_used": models_used, "fallback_model_engaged": (usage or {}).get("fallback_model") or fallback_to,
        "events": events,
        "smoke_executed": (smoke or {}).get("executed"),
        "smoke_problems_before": len((smoke or {}).get("problems") or []) if smoke else None,
        "repairs": repairs,
        "repair_accepted_any": any(r.get("accepted") for r in repairs) if repairs else False,
        "local_cost_cny": round(total_cost, 6), "local_cost_exact": exact and bool(attempts),
        "usage_summary": usage, "calls": calls,
    }


if __name__ == "__main__":
    print(json.dumps(summarize(sys.argv[1]), indent=2, ensure_ascii=False))
