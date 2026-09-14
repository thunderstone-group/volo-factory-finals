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

from volo import contract as state_contract
from volo.agent import Agent
from volo.acceptance import AcceptanceSuite
from volo.model import Model
from volo.requirements import RequirementSet
from volo.references import ReferenceObserver, vision_model_name
from volo.trace import Runtime, Trace
from volo.workspace import Workspace


# A single-batch package (Smoke, Ticket) fits the small budget. A multi-batch package
# takes the contract path, and Keep at b3d2331 needed 142 calls and 4.1 M tokens over
# 83 minutes for 15 batches; the hosted runner's own limit on generation time is not
# documented, so the wall clock stays moderate and the schedule delivers the last
# verified snapshot when it runs out. Explicit flags and FACTORY_* env win.
SMALL_BUDGET = {"max_calls": 32, "token_budget": 450000, "timeout": 1200}
LARGE_BUDGET = {"max_calls": 160, "token_budget": 5000000, "timeout": 2700}


def apply_budget_defaults(args, requirements):
    large = len(requirements.batches()) > 1
    env = {"max_calls": "FACTORY_MAX_CALLS", "token_budget": "FACTORY_TOKEN_BUDGET", "timeout": "FACTORY_TIMEOUT"}
    for name, variable in env.items():
        if getattr(args, name) is None:
            value = os.getenv(variable)
            setattr(args, name, int(value) if value else (LARGE_BUDGET if large else SMALL_BUDGET)[name])
    return large


def main():
    parser = argparse.ArgumentParser(description="VOLO Factory competition agent")
    parser.add_argument("requirement_path", type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--inspect", action="store_true", help="Validate inputs and print the schedule without model calls")
    parser.add_argument("--max-calls", type=int, default=None)
    parser.add_argument("--token-budget", type=int, default=None)
    parser.add_argument("--timeout", type=int, default=None)
    parser.add_argument('--acceptance-contract', type=Path,
                        help='Reviewed external acceptance manifest; never discovered from generated files')
    args = parser.parse_args()
    apply_budget_defaults(args, RequirementSet.load(args.requirement_path))
    if min(args.max_calls, args.token_budget, args.timeout) <= 0:
        parser.error("Budgets must be positive")
    requirements = RequirementSet.load(args.requirement_path)
    if args.inspect:
        print(json.dumps({"fingerprint": requirements.fingerprint,
                          "batches": [[n["id"] for n in b] for b in requirements.batches()],
                          "state_contract": len(requirements.batches()) > 1,
                          "seed_sentences": state_contract.seed_sentences(requirements.document),
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
    acceptance = None
    if args.acceptance_contract:
        try:
            acceptance = AcceptanceSuite(args.acceptance_contract, output, requirements.fingerprint,
                                         [node['id'] for node in requirements.nodes])
            covered = {req for case in acceptance.cases for req in case['requirements']}
            if covered != set(acceptance.requirement_ids):
                raise ValueError('Contract does not cover every input requirement')
        except (OSError, ValueError) as exc:
            parser.error('Invalid acceptance contract: ' + str(exc))
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
        vision_name = vision_model_name()
        references = None
        if vision_name:
            vision = Model(base, key, vision_name, trace, max_output=4096, timeout=240)
            vision.usage = client.usage
            references = ReferenceObserver(vision, trace)
        workspace = Workspace(output, requirements.root, trace, time.monotonic() + args.timeout)
        workspace.acceptance_suite = acceptance
        trace.event("run_started", requirement_fingerprint=requirements.fingerprint,
                    model=model_name, vision_model=vision_name, max_calls=args.max_calls, token_budget=args.token_budget,
                    timeout_seconds=args.timeout)
        try:
            # A package that does not fit one batch is implemented by several batches that
            # cannot see each other's code. Fix the shared state once, before any page is
            # generated. A single-batch package has no cross-batch state to reconcile and
            # takes exactly the path it took before.
            contract = None
            if len(requirements.batches()) > 1:
                contract = state_contract.extract(requirements, client, trace)
                print("[volo] state contract: "
                      + json.dumps(contract['audit'], ensure_ascii=False)
                      + " cost=" + json.dumps(contract['cost']), flush=True)
            result = Agent(requirements, client, workspace, runtime,
                           max_calls=args.max_calls, token_budget=args.token_budget,
                           references=references, contract=contract).run()
            print(json.dumps(result, ensure_ascii=False), flush=True)
            return 0
        except Exception as exc:
            print("VOLO Factory failed: " + trace.redact(str(exc)), file=sys.stderr, flush=True)
            return 1


if __name__ == "__main__":
    raise SystemExit(main())
