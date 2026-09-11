#!/usr/bin/env python3
"""ArcBench entrypoint: main.py REQUIREMENTS --output-dir PROJECT."""
from __future__ import annotations

import argparse
import fcntl
import json
import os
import sys
import time
from pathlib import Path

from volo.agent import Agent
from volo.model import Model
from volo.requirements import RequirementSet
from volo.references import ReferenceObserver
from volo.trace import Runtime, Trace
from volo.workspace import Workspace


def main():
    parser = argparse.ArgumentParser(description="VOLO Factory competition agent")
    parser.add_argument("requirement_path", type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--inspect", action="store_true", help="Validate inputs and print the schedule without model calls")
    parser.add_argument("--max-calls", type=int, default=int(os.getenv("FACTORY_MAX_CALLS", "32")))
    parser.add_argument("--token-budget", type=int, default=int(os.getenv("FACTORY_TOKEN_BUDGET", "450000")))
    parser.add_argument("--timeout", type=int, default=int(os.getenv("FACTORY_TIMEOUT", "1200")))
    args = parser.parse_args()
    if min(args.max_calls, args.token_budget, args.timeout) <= 0:
        parser.error("Budgets must be positive")
    requirements = RequirementSet.load(args.requirement_path)
    if args.inspect:
        print(json.dumps({"fingerprint": requirements.fingerprint,
                          "batches": [[n["id"] for n in b] for b in requirements.batches()],
                          "assets": requirements.assets}, ensure_ascii=False, indent=2))
        return 0
    key = os.getenv("OPENAI_API_KEY")
    base = os.getenv("OPENAI_BASE_URL")
    model_name = os.getenv("MODEL")
    if not key or not base or not model_name:
        parser.error("OPENAI_API_KEY, OPENAI_BASE_URL and MODEL must be supplied by the runner")
    output = args.output_dir.resolve()
    if output == requirements.root or output.is_relative_to(requirements.root):
        parser.error("Output directory must not overwrite requirement inputs")
    trace = Trace(output / ".factory")
    with (trace.directory / "lock").open("w") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            parser.error("Another VOLO Factory process is using this output directory")
        # Protect traces and credentials from the SDK's project commits.
        ignore = output / ".gitignore"
        existing = ignore.read_text() if ignore.exists() else ""
        entries = [".factory/", ".env", ".env.*", "node_modules/"]
        missing = [entry for entry in entries if entry not in existing.splitlines()]
        if missing:
            ignore.write_text(existing.rstrip() + "\n" + "\n".join(missing) + "\n")
        runtime = Runtime(trace)
        client = Model(base, key, model_name, trace,
                       max_output=int(os.getenv("FACTORY_MAX_OUTPUT_TOKENS", "16384")))
        vision_name = os.getenv('FACTORY_VISION_MODEL', 'kimi-k3')
        references = None
        if vision_name:
            vision = Model(base, key, vision_name, trace, max_output=4096, timeout=240)
            vision.usage = client.usage
            references = ReferenceObserver(vision, trace)
        workspace = Workspace(output, requirements.root, trace, time.monotonic() + args.timeout)
        trace.event("run_started", requirement_fingerprint=requirements.fingerprint,
                    model=model_name, vision_model=vision_name, max_calls=args.max_calls, token_budget=args.token_budget,
                    timeout_seconds=args.timeout)
        try:
            result = Agent(requirements, client, workspace, runtime,
                           max_calls=args.max_calls, token_budget=args.token_budget,
                           references=references).run()
            print(json.dumps(result, ensure_ascii=False), flush=True)
            return 0
        except Exception as exc:
            print("VOLO Factory failed: " + trace.redact(str(exc)), file=sys.stderr, flush=True)
            return 1


if __name__ == "__main__":
    raise SystemExit(main())
