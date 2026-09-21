"""One real model repair, conditioned only on requirements, app source and our UI probe."""

import argparse
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import signal
import sys
import time

from experiment_recovery import atomic_json
from experiment_transport import Response
from goal_coverage import goal_feedback

SYSTEM = """You implement application requirements through a feedback-driven repair loop.
The user goal is working business behavior, including correct state changes and preserving existing behavior.
The supplied browser observations are incomplete diagnostic evidence, not a replacement for the requirements.
Repair a coherent root cause of the first unresolved journey, including other affected paths when appropriate.
Preserve successful journeys, required wording, seeded accounts and data. Do not rewrite unrelated features.
Do not modify tests, probes, evaluation tools, or add behavior that detects an evaluation environment.
Return only complete changed files, each framed as:
=== FILE: relative/path ===
complete file contents
=== END ===
Keep the existing frontend/backend build and startup contracts. Emit no commentary."""


def feedback(report):
    if report.get("mode") != "probe":
        raise ValueError(
            "external evaluation results are not allowed in repair feedback"
        )
    failed = [c for c in report["cases"] if not c["passed"]]
    return {
        "goal": "Complete all frozen business journeys while preserving already successful journeys.",
        "successful_journeys_to_preserve": [
            c["name"] for c in report["cases"] if c["passed"]
        ],
        "unresolved_journeys": [c["name"] for c in failed],
        "observed_failures": [
            {
                "journey": c["name"],
                "error": re.sub(
                    r"\x1b\[[0-9;]*m", "", "\n".join(c.get("errors", []))
                ).split("\n\n   ")[0][:1700],
                "observation": c.get("observation"),
            }
            for c in failed[:3]
        ],
    }


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--application", required=True, type=Path)
    p.add_argument("--requirements", required=True, type=Path)
    p.add_argument("--probe", required=True, type=Path)
    p.add_argument("--previous-rejection", type=Path)
    p.add_argument("--adapter", required=True, type=Path)
    p.add_argument("--out", required=True, type=Path)
    p.add_argument("--expected-request-sha256")
    p.add_argument("--include-readonly-diagnostics", action="store_true")
    p.add_argument("--goal-catalogue", type=Path)
    p.add_argument("--direct", action="store_true")
    args = p.parse_args()
    source, out = args.application.resolve(), args.out.resolve()
    if out.exists():
        raise SystemExit("attempt output already exists")
    out.mkdir(parents=True)
    spec = importlib.util.spec_from_file_location("frozen_agent", args.adapter)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    os.environ["FALLBACK_MODEL"] = ""
    if args.direct:
        os.environ.pop("ARC_EXPERIMENT_SSH_HOST", None)
    else:
        os.environ["ARC_EXPERIMENT_SSH_HOST"] = "hk-zyl"
    note = feedback(json.loads(args.probe.read_text()))
    if args.goal_catalogue:
        note["requirement_goal"] = goal_feedback(
            json.loads(args.goal_catalogue.read_text()), json.loads(args.probe.read_text())
        )
    if args.include_readonly_diagnostics:
        note["existing_input_contract_diagnostics"] = m.readonly_gaps(source)
        note["input_contract_instruction"] = (
            "These configurable flight-search fields must support keyboard entry as well as the existing picker journeys. "
            "Keep both interaction paths and synchronize typed values into the real search state. "
            "Preserve all successful journeys; moving a picker is optional advice, not a requirement."
        )
    if args.previous_rejection:
        note["previous_proposal_was_rolled_back"] = json.loads(
            args.previous_rejection.read_text()
        )
    snapshot = m.read_template(source)
    source_blocks = "\n".join(
        "=== FILE: " + name + " ===\n" + data.decode() + "\n=== END ==="
        for name, data in sorted(snapshot.items())
    )
    messages = [
        {"role": "system", "content": SYSTEM},
        {
            "role": "user",
            "content": "APPLICATION REQUIREMENTS\n"
            + args.requirements.read_text()
            + "\nCURRENT ACCEPTED APPLICATION\n"
            + source_blocks
            + "\nBUSINESS DIAGNOSTICS\n"
            + json.dumps(note, ensure_ascii=False, indent=2),
        },
    ]
    sys.path.insert(0, str(Path.home() / "projects/arcbench-cli/src"))
    from arcbench_cli.client import (
        OfficialClient,
        SubmitConfig,
        load_env,
        TERMINAL_STATES,
    )

    client = OfficialClient(
        SubmitConfig.from_env(load_env(Path.home() / ".config/arcbench/volo.env"))
    )
    active = [
        r
        for r in client.list_runs(limit=10000)
        if str(r.get("status", "")).upper() not in TERMINAL_STATES | {"PENDING"}
    ]
    atomic_json(
        out / "preflight.json", {"active_runs": len(active), "checked_at": time.time()}
    )
    if active:
        raise SystemExit("official run active; model request not sent")
    key = client.access_key()
    observed = {
        "lines": 0,
        "sse_events": 0,
        "reasoning_chars": 0,
        "content_chars": 0,
        "last_lines": [],
        "saw_done": False,
        "python_version": sys.version.split()[0],
    }
    m._open_model = lambda req, timeout: Response(
        req,
        key,
        out,
        observed,
        "" if args.direct else "socks5h://127.0.0.1:1",
        "1.1",
        args.expected_request_sha256,
    )

    def interrupted(signum, frame):
        raise KeyboardInterrupt("model worker interrupted")

    signal.signal(signal.SIGTERM, interrupted)
    budget = m.CallBudget(limit=1, fail_limit=1)
    started = time.time()
    try:
        content, usage, finish = m.stream_completion(
            messages,
            "deepseek-v4-flash",
            client.config.api_base_url,
            key,
            budget,
            tries=1,
        )
    finally:
        atomic_json(out / "transport.json", observed)
        trace = {
            "started_at": started,
            "finished_at": time.time(),
            "attempts": budget.attempts,
        }
        atomic_json(
            out / "trace.json",
            json.loads(
                json.dumps(trace, ensure_ascii=False).replace(key, "[REDACTED]")
            ),
        )
    target = out / "application"
    shutil.copytree(source, target)
    valid, error, changed = False, None, []
    try:
        blocks, missing = m.parse_blocks(content)
        if missing or finish != "stop" or not blocks:
            raise ValueError("completed response did not contain a complete repair")
        for block in blocks:
            path = m.resolve_path(target, block["path"])
            rel = path.relative_to(target)
            if rel.parts[0] not in ("frontend", "backend") or any(
                p.startswith(".") for p in rel.parts
            ):
                raise ValueError("repair attempted to change a non-application path")
            block["path"] = str(rel)
            m.write_one(target, block)
            changed.append(str(rel))
        problems = m.missing_required(target)
        if problems:
            raise ValueError("; ".join(problems))
        valid = True
    except ValueError as exc:
        error = str(exc)
        shutil.rmtree(target)
        shutil.copytree(source, target)
    atomic_json(
        out / "receipt.json",
        {
            "model": "deepseek-v4-flash",
            "new_model_calls": 1,
            "usage": usage,
            "finish_reason": finish,
            "valid_patch": valid,
            "patch_error": error,
            "files": changed,
            "seconds": round(time.time() - started, 3),
        },
    )
    print(
        json.dumps({"valid_patch": valid, "files": changed, "usage": usage}), flush=True
    )


if __name__ == "__main__":
    main()
