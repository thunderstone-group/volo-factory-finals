"""One real repair call on an immutable historical draft, through an existing SSH SOCKS route."""

import argparse
import importlib.util
import json
import os
import shutil
import sys
import time
import signal
from experiment_recovery import atomic_json
from pathlib import Path

sys.path.insert(0, "~/projects/arcbench-cli/src")
from arcbench_cli.client import OfficialClient, SubmitConfig, load_env, TERMINAL_STATES

p = argparse.ArgumentParser()
p.add_argument("--app", required=True)
p.add_argument("--out", required=True, type=Path)
p.add_argument("--proxy", required=True)
p.add_argument("--mode", choices=["oracle", "repair", "generate"], default="oracle")
p.add_argument("--adapter", type=Path)
p.add_argument("--draft", type=Path)
p.add_argument("--draft-trace", type=Path)
p.add_argument("--reuse-repair", type=Path, nargs="+")
p.add_argument("--run-dir", required=True, type=Path)
p.add_argument("--expected-request-sha256")
args = p.parse_args()
run_dir = args.run_dir.resolve()
repo = run_dir.parents[1]
source = repo / "runs/fixed-draft"
out = args.out.resolve()
if out.exists():
    raise SystemExit(
        "output exists; inspect the previous attempt instead of overwriting"
    )
out.mkdir(parents=True)
spec = importlib.util.spec_from_file_location(
    "oneshot", args.adapter.resolve() if args.adapter else repo / "oneshot/main.py"
)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
os.environ["FALLBACK_MODEL"] = ""
http_version = os.environ.get("ARC_EXPERIMENT_HTTP_VERSION", "2")
if http_version not in ("1.1", "2"):
    raise SystemExit("unsupported experimental HTTP version")
c = OfficialClient(
    SubmitConfig.from_env(load_env(Path("~/.config/arcbench/volo.env")))
)
key = c.access_key()
runs = c.list_runs(limit=10000)
active = [
    {"id": x.get("id"), "status": x.get("status")}
    for x in runs
    if str(x.get("status", "")).upper() not in TERMINAL_STATES | {"PENDING"}
]
(out / "preflight.json").write_text(
    json.dumps({"at": time.time(), "runs": len(runs), "active": active}, indent=2)
    + "\n"
)
if active:
    raise SystemExit("platform run active; no model call")
if args.mode == "oracle":
    trace = json.loads(
        (
            source
            / args.app
            / (
                "oracle-trace-attempt4.json"
                if args.app == "12306"
                else "oracle-trace.json"
            )
        ).read_text()
    )["attempts"][0]
else:
    if args.draft_trace:
        trace = json.loads(args.draft_trace.read_text())["attempts"][0]
    else:
        data = json.loads((source / (args.app + "-logs.json")).read_text())
        trace = next(
            json.loads(l.split("[oneshot] trace ", 1)[1])
            for l in data["stdout"].splitlines()
            if "[oneshot] trace " in l
        )
messages = trace["messages"]
model = trace["model"]
request_file = out / "request.json"
requirements = (source / args.app / "requirements.yaml").read_text()
started = time.time()
observed = {
    "python_version": sys.version.split()[0],
    "python_executable": sys.executable,
    "route": args.proxy,
    "http_version": http_version,
    "lines": 0,
    "sse_events": 0,
    "reasoning_chars": 0,
    "content_chars": 0,
    "last_lines": [],
    "saw_done": False,
}


def interrupted(signum, frame):
    raise KeyboardInterrupt("experiment worker interrupted")


signal.signal(signal.SIGTERM, interrupted)
from experiment_transport import Response

m._open_model = lambda req, timeout: Response(
    req, key, out, observed, args.proxy, http_version, args.expected_request_sha256
)
reused = []
real_completion = m.stream_completion
if args.reuse_repair:
    cached_calls = []
    cached_origins = {}
    cached_requests = {}
    for cached_path in args.reuse_repair:
        cached = json.loads(cached_path.read_text())
        for a in cached["attempts"]:
            if a.get("status") == "completed" and a.get("finish_reason") in (
                "stop",
                "length",
                "content_filter",
            ):
                cached_calls.append(a)
                cached_origins[id(a)] = str(cached_path.resolve())
                cached_requests[id(a)] = json.loads(
                    cached_path.with_name("request.json").read_text()
                )

    def completion_with_reuse(messages, model, base, key, budget, tries=1):
        payload = {
            "model": model,
            "messages": messages,
            "max_tokens": m.MAX_TOKENS,
            "temperature": 0.0,
            "stream": True,
            "stream_options": {"include_usage": True},
        }
        for item in cached_calls:
            if cached_requests[id(item)] == payload:
                reused.append(item)
                request_file.write_text(
                    json.dumps(
                        {
                            "model": model,
                            "messages": messages,
                            "max_tokens": m.MAX_TOKENS,
                            "temperature": 0.0,
                            "stream": True,
                            "stream_options": {"include_usage": True},
                        }
                    )
                )
                request_file.chmod(0o600)
                (out / "reused-repair.json").write_text(
                    json.dumps(
                        {
                            "source_trace": cached_origins[id(item)],
                            "new_model_call": False,
                            "reason": "identical model, messages, temperature and token cap",
                        },
                        indent=2,
                    )
                    + "\n"
                )
                return item["content"], {}, item["finish_reason"]
        return real_completion(messages, model, base, key, budget, tries=tries)

    m.stream_completion = completion_with_reuse
budget = m.CallBudget(limit=1, fail_limit=1)
print(
    json.dumps(
        {
            "started": args.app,
            "model": model,
            "route": "SSH SOCKS through existing HK host",
        }
    ),
    flush=True,
)
try:
    if args.mode == "oracle":
        content, usage, finish = m.stream_completion(
            messages, model, c.config.api_base_url, key, budget, tries=1
        )
    elif args.mode == "repair":
        target = out / "application"
        shutil.copytree(
            args.draft.resolve() if args.draft else source / args.app / "draft", target
        )
        files = m.parse_blocks(trace["content"])[0]
        messages = trace["messages"] + [
            {"role": "assistant", "content": trace["content"]}
        ]
        m.repair_delivery(
            target,
            files,
            messages,
            model,
            c.config.api_base_url,
            key,
            budget,
            requirements=requirements,
            scaffold=True,
        )
        content = (
            budget.attempts[-1]["content"]
            if budget.attempts
            else (reused[-1]["content"] if reused else "")
        )
        usage = budget.attempts[-1].get("usage", {}) if budget.attempts else {}
        finish = (
            budget.attempts[-1].get("finish_reason")
            if budget.attempts
            else (reused[-1]["finish_reason"] if reused else None)
        )
    else:
        m.SMOKE = False
        generated_files, _ = m.generate(
            requirements, model, c.config.api_base_url, key, out / "application", budget
        )
        content = budget.attempts[-1]["content"]
        usage = budget.attempts[-1]["usage"]
        finish = budget.attempts[-1]["finish_reason"]
finally:
    atomic_json(out / "transport.json", observed)
    atomic_json(
        out / "trace.json",
        json.loads(
            json.dumps(
                {
                    "started_at": started,
                    "finished_at": time.time(),
                    "attempts": budget.attempts,
                    "smoke": budget.smoke,
                    "reused_response": bool(reused),
                },
                ensure_ascii=False,
            ).replace(key, "[REDACTED]")
        ),
    )
if any(a.get("status") != "completed" for a in budget.attempts):
    raise SystemExit(
        "incomplete model attempt; inspect trace before treating this as a repair comparison"
    )
batch = generated_files if args.mode == "generate" else []
if content and args.mode != "generate":
    try:
        batch, missing = m.parse_blocks(content)
        if missing or finish != "stop":
            raise ValueError(
                "completed provider response did not deliver complete file blocks"
            )
        target = out / ("application" if args.mode == "oracle" else "proposal")
        shutil.copytree(
            args.draft.resolve() if args.draft else source / args.app / "draft", target
        )
        for item in batch:
            q = m.resolve_path(target, item["path"])
            rel = q.relative_to(target)
            if rel.parts[0] not in ("frontend", "backend"):
                raise ValueError("unexpected source path")
            item["path"] = str(rel)
            m.write_one(target, item)
    except ValueError as exc:
        if args.mode == "oracle":
            raise
        (out / "proposal-unavailable.json").write_text(
            json.dumps(
                {
                    "error": str(exc),
                    "provider_finished": True,
                    "retained_application_is_authoritative": True,
                },
                indent=2,
            )
            + "\n"
        )
receipt = {
    "app": args.app,
    "mode": args.mode,
    "model": model,
    "new_model_calls": len(budget.attempts),
    "reused_response": bool(reused),
    "usage": usage,
    "finish_reason": finish,
    "files": [x["path"] for x in batch],
    "seconds": round(time.time() - started, 2),
    "smoke": budget.smoke,
    "cost_upper_estimate_cny": (
        usage["prompt_tokens"] * 3 + usage["completion_tokens"] * 9
    )
    / 1e6
    if usage
    else (0 if not budget.attempts else None),
}
atomic_json(out / "receipt.json", receipt)
print(
    json.dumps(
        {
            "completed": args.app,
            "mode": args.mode,
            "new_model_calls": receipt["new_model_calls"],
            "usage": usage,
            "seconds": receipt["seconds"],
        }
    ),
    flush=True,
)
