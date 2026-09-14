#!/usr/bin/env python3
"""Run one ARC-Bench app's official Playwright suite against a target URL.

Opt-in developer tool. Nothing in the default harness path calls this. It shells
out to the organizers' own clone so the pinned Playwright version, the config and
the spec files stay exactly as published; this file never edits that clone.

Usage:
    python harness_lab/arc_bench_corpus.py --app 12306 --target-url http://127.0.0.1:3301
    python harness_lab/arc_bench_corpus.py --app keep --target-url http://127.0.0.1:3000 \
        --profile hosted --report-dir /tmp/arc-report

Profiles:
    repo    the repository's own runner: 60 s test timeout, 10 s expect, workers 1.
    hosted  the observed competition runner: 10 s test timeout, 10 s expect. Worker
            count stays 1 because scripts/run-playwright.js appends --workers 1 last.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

DEFAULT_CLONE = Path.home() / "projects/arcbench-campaign/upstream/arc-bench"
APPS = ("12306", "bookstack", "ctrip", "keep", "prestashop", "stackoverflow")
PROFILES = {
    "repo": {"timeout": "60000", "expect_timeout": "10000"},
    "hosted": {"timeout": "10000", "expect_timeout": "10000"},
}


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--app", required=True, choices=APPS)
    parser.add_argument("--target-url", required=True)
    parser.add_argument("--clone", type=Path, default=DEFAULT_CLONE, help="path to the arc-bench clone")
    parser.add_argument("--profile", choices=sorted(PROFILES), default="repo")
    parser.add_argument("--report-dir", type=Path, default=None, help="where the HTML report and artifacts go")
    parser.add_argument("--grep", default=None, help="Playwright grep pattern, e.g. REQ-2.1")
    parser.add_argument("--json", type=Path, default=None, help="write a small result summary here")
    return parser.parse_args(argv)


def check_clone(clone: Path) -> None:
    if not (clone / "package.json").is_file():
        sys.exit(f"not an arc-bench clone: {clone}")
    if not (clone / "node_modules" / "@playwright" / "test").is_dir():
        sys.exit(f"run `npm install` in {clone} first")


def build_command(args: argparse.Namespace) -> list[str]:
    profile = PROFILES[args.profile]
    command = [
        "npm", "run", "test", "--",
        "--app", args.app,
        "--target-url", args.target_url,
        "--timeout", profile["timeout"],
        "--expect-timeout", profile["expect_timeout"],
    ]
    if args.grep:
        command += ["--grep", args.grep]
    return command


def summarize(stdout: str) -> dict[str, int]:
    counts = {"passed": 0, "failed": 0, "flaky": 0, "skipped": 0, "timedOut": 0}
    for line in stdout.splitlines():
        match = re.match(r"^\s*(\d+)\s+(passed|failed|flaky|skipped|timedOut)\b", line)
        if match:
            counts[match.group(2)] += int(match.group(1))
    return counts


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    check_clone(args.clone)

    env = dict(os.environ)
    if args.report_dir:
        args.report_dir.mkdir(parents=True, exist_ok=True)
        env["PLAYWRIGHT_REPORT_DIR"] = str(args.report_dir / "html")
        env["PLAYWRIGHT_OUTPUT_DIR"] = str(args.report_dir / "artifacts")

    command = build_command(args)
    print(f"[arc-corpus] {args.app} / {args.profile} -> {args.target_url}", flush=True)
    started = time.monotonic()
    process = subprocess.run(command, cwd=args.clone, env=env, text=True, capture_output=True)
    wall = time.monotonic() - started

    sys.stdout.write(process.stdout)
    sys.stderr.write(process.stderr)

    result = {
        "app": args.app,
        "profile": args.profile,
        "target_url": args.target_url,
        "exit_code": process.returncode,
        "wall_seconds": round(wall, 1),
        "counts": summarize(process.stdout),
    }
    print(f"[arc-corpus] {json.dumps(result)}", flush=True)
    if args.json:
        args.json.write_text(json.dumps(result, indent=2) + "\n")
    return process.returncode


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
