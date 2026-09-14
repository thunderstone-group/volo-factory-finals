#!/usr/bin/env python3
"""Run one ARC-Bench app's official suite against a generated application.

Opt-in developer tool. No default harness path calls it and it makes no model call.

It does three things `arc_bench_corpus.py` does not, all of which a seeded application
needs:

* starts the generated app itself, on a fresh data directory, so a suite that deletes
  seeded rows does not poison the next run,
* waits for `/api/health` rather than for the first byte on `/`, which is what the
  organizers' own entrypoint does,
* offers the hosted runner's four-worker profile, which the repository's runner cannot
  produce because `scripts/run-playwright.js` appends `--workers 1` after user
  arguments. The four-worker config is written into the session scratch directory; the
  corpus clone is never modified.

Usage:
    python harness_lab/state_rehearsal.py --app keep --app-dir /path/to/generation \\
        --profile hosted --json result.json
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from volo.launcher import install  # noqa: E402
from volo.workspace import stop_process, tool_environment  # noqa: E402

DEFAULT_CLONE = Path.home() / "projects/arcbench-campaign/upstream/arc-bench"
APPS = ("12306", "bookstack", "ctrip", "keep", "prestashop", "stackoverflow")

# `repo` is the repository's published runner. `hosted` matches the competition runner
# observed on 2026-09-12: four workers, ten-second budgets, no artifact capture. Both
# disable trace and video; docs/arc-bench-corpus-2026-09-14.md measures that capture
# alone costs the organizers' own reference fourteen of 135 tests.
PROFILES = {
    "repo": {"timeout": 60000, "expect": 10000, "workers": 1},
    "hosted": {"timeout": 10000, "expect": 10000, "workers": 4},
}

CONFIG = """import {{ defineConfig, devices }} from '@playwright/test';
export default defineConfig({{
  testDir: {test_dir},
  timeout: {timeout},
  expect: {{ timeout: {expect} }},
  fullyParallel: false,
  retries: 0,
  workers: {workers},
  reporter: [['list'], ['json', {{ outputFile: {report} }}]],
  outputDir: {output_dir},
  use: {{
    baseURL: {base_url},
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  }},
  projects: [{{ name: 'chromium', use: {{ ...devices['Desktop Chrome'] }} }}],
}});
"""


def parse_args(argv):
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--app", required=True, choices=APPS)
    parser.add_argument("--app-dir", required=True, type=Path, help="a generated application")
    parser.add_argument("--clone", type=Path, default=DEFAULT_CLONE)
    parser.add_argument("--profile", choices=sorted(PROFILES), default="hosted")
    parser.add_argument("--work-dir", type=Path, default=None,
                        help="scratch directory for the config, report and data (default: a temp dir)")
    parser.add_argument("--grep", default=None)
    parser.add_argument("--json", type=Path, default=None)
    parser.add_argument("--startup-timeout", type=float, default=60.0)
    parser.add_argument("--keep-data", action="store_true",
                        help="reuse the application's existing data directory instead of a fresh one")
    return parser.parse_args(argv)


def free_port():
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        return listener.getsockname()[1]


def build_frontend(app: Path):
    manifest = app / "frontend" / "package.json"
    if not manifest.is_file():
        raise SystemExit(f"not a generated application: {manifest} is missing")
    scripts = json.loads(manifest.read_text()).get("scripts", {})
    if "build" not in scripts:
        raise SystemExit("frontend/package.json has no build script")
    for relative in (".", "frontend", "backend"):
        directory = app / relative
        if (directory / "package.json").is_file():
            package = json.loads((directory / "package.json").read_text())
            if package.get("dependencies") or package.get("devDependencies"):
                subprocess.run(["npm", "install", "--no-audit", "--no-fund"],
                               cwd=directory, check=True)
    subprocess.run(["npm", "run", "build"], cwd=app / "frontend", check=True)


def wait_ready(url, deadline, process):
    """Poll /api/health, then /. Health is what the organizers' entrypoint polls."""
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    observed = {"health": None, "root": None}
    for path, key in (("/api/health", "health"), ("/", "root")):
        while time.monotonic() < deadline and process.poll() is None:
            try:
                with opener.open(url + path, timeout=2) as response:
                    if response.status == 200:
                        observed[key] = round(time.monotonic(), 3)
                        break
            except urllib.error.HTTPError as exc:
                observed[key + "_last"] = f"HTTP {exc.code}"
            except (OSError, urllib.error.URLError) as exc:
                observed[key + "_last"] = str(exc)[:120]
            time.sleep(0.2)
        else:
            if key == "health":
                # An application with no startup state never serves this path.
                continue
            raise SystemExit(f"application never served 200 at {path}: {observed}")
    return observed


def start(app: Path, port: int, work: Path, keep_data: bool):
    install(app)
    env = {"PORT": str(port)}
    if not keep_data:
        data = work / "data"
        if data.exists():
            shutil.rmtree(data)
        data.mkdir(parents=True)
        env["APP_DATA_DIR"] = str(data)
    log = (work / "server.log").open("wb")
    return subprocess.Popen(["npm", "run", "start"], cwd=app / "backend",
                            stdout=log, stderr=subprocess.STDOUT,
                            env=tool_environment(env), start_new_session=True), log


def summarize(report: Path):
    """Read Playwright's JSON report: one entry per test, with its status."""
    data = json.loads(report.read_text())
    results = []

    def walk(suite):
        for spec in suite.get("specs", []):
            for test in spec.get("tests", []):
                status = test.get("status") or "unknown"
                results.append({"title": spec.get("title", ""),
                                "file": suite.get("file", ""),
                                "status": status,
                                "expected": test.get("expectedStatus", "passed")})
        for child in suite.get("suites", []):
            walk(child)

    for suite in data.get("suites", []):
        walk(suite)
    passed = [item for item in results if item["status"] == "expected"]
    failed = [item for item in results if item["status"] not in ("expected", "skipped")]
    return {"total": len(results), "passed": len(passed), "failed": len(failed),
            "failed_titles": sorted(item["title"] for item in failed)}


def main(argv):
    args = parse_args(argv)
    clone = args.clone.resolve()
    tests = clone / "arc-bench" / "webapp" / args.app / "tests"
    if not tests.is_dir():
        raise SystemExit(f"no published suite at {tests}")
    if not (clone / "node_modules" / "@playwright" / "test").is_dir():
        raise SystemExit(f"run `npm install` in {clone} first")
    app = args.app_dir.resolve()
    work = (args.work_dir or app.parent / (app.name + "-rehearsal")).resolve()
    work.mkdir(parents=True, exist_ok=True)

    build_frontend(app)
    port = free_port()
    url = f"http://127.0.0.1:{port}"
    profile = PROFILES[args.profile]
    # The config lives outside the clone, so give it the clone's module resolution
    # without writing anything into the clone itself.
    modules = work / "node_modules"
    if modules.is_symlink():
        modules.unlink()
    if not modules.exists():
        modules.symlink_to(clone / "node_modules")
    report = work / f"report-{args.app}-{args.profile}.json"
    config = work / f"config-{args.app}-{args.profile}.ts"
    config.write_text(CONFIG.format(
        test_dir=json.dumps(str(tests)), timeout=profile["timeout"],
        expect=profile["expect"], workers=profile["workers"],
        report=json.dumps(str(report)),
        output_dir=json.dumps(str(work / "artifacts")),
        base_url=json.dumps(url)))

    process, log = start(app, port, work, args.keep_data)
    started = time.monotonic()
    try:
        readiness = wait_ready(url, started + args.startup_timeout, process)
        command = ["npx", "playwright", "test", "--config", str(config)]
        if args.grep:
            command += ["--grep", args.grep]
        environment = {**os.environ, "TARGET_URL": url, "PLAYWRIGHT_BASE_URL": url}
        print(f"[rehearsal] {args.app} / {args.profile} -> {url}", flush=True)
        suite = subprocess.run(command, cwd=clone, env=environment, text=True, capture_output=True)
        sys.stdout.write(suite.stdout[-8000:])
        sys.stderr.write(suite.stderr[-4000:])
    finally:
        stop_process(process)
        log.close()

    result = {"app": args.app, "profile": args.profile, "workers": profile["workers"],
              "test_timeout_ms": profile["timeout"], "expect_timeout_ms": profile["expect"],
              "trace": "off", "video": "off",
              "application": str(app), "readiness": readiness,
              "wall_seconds": round(time.monotonic() - started, 1),
              "exit_code": suite.returncode}
    result.update(summarize(report) if report.is_file() else {"error": "no report produced"})
    print("[rehearsal] " + json.dumps(result, ensure_ascii=False), flush=True)
    if args.json:
        args.json.write_text(json.dumps(result, indent=2) + "\n")
    return 0 if result.get("total") else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
