"""Run a saved app in a pinned local container; keep probe and scoring inputs separate."""

import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import time
import uuid

from experiment_recovery import atomic_json


def fingerprint(root):
    files = {}
    for current, dirs, names in os.walk(root):
        dirs[:] = sorted(
            d for d in dirs if d not in ("node_modules", "dist", "__pycache__", ".git")
        )
        for name in sorted(names):
            p = Path(current) / name
            if p.is_symlink():
                raise ValueError("source symlink: " + str(p))
            files[str(p.relative_to(root))] = hashlib.sha256(p.read_bytes()).hexdigest()
    return hashlib.sha256(json.dumps(files, sort_keys=True).encode()).hexdigest()


def summarize(report):
    rows = []

    def walk(suite):
        for spec in suite.get("specs", []):
            for test in spec.get("tests", []):
                result = test.get("results", [{}])[-1]
                observation = None
                for attachment in result.get("attachments", []):
                    if attachment["name"] == "business-observation" and attachment.get(
                        "body"
                    ):
                        observation = json.loads(base64.b64decode(attachment["body"]))
                rows.append(
                    {
                        "name": spec["title"],
                        "passed": test["status"] == "expected",
                        "status": test["status"],
                        "duration_ms": result.get("duration"),
                        "errors": [
                            e.get("message", "") for e in result.get("errors", [])
                        ],
                        "observation": observation,
                    }
                )
        for child in suite.get("suites", []):
            walk(child)

    for suite in report.get("suites", []):
        walk(suite)
    return rows


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--application", required=True, type=Path)
    p.add_argument("--out", required=True, type=Path)
    p.add_argument("--mode", required=True, choices=["probe", "score"])
    p.add_argument("--tests", type=Path)
    p.add_argument("--probe-source", type=Path)
    p.add_argument("--probe-count", type=int, default=13)
    p.add_argument("--shared-server", action="store_true", help="Preserve backend state between probe cases, as in full-suite evaluation")
    p.add_argument("--image", default="arc-business-feedback:20260921")
    args = p.parse_args()
    source, out = args.application.resolve(), args.out.resolve()
    sha = fingerprint(source)
    tools = Path(__file__).with_name("business_experiment")
    if args.mode == "probe":
        probe_file = args.probe_source or tools / "ctrip_business.spec.cjs"
        checks = {"ctrip_business.spec.cjs": hashlib.sha256(probe_file.read_bytes()).hexdigest()}
        expected_checks_sha = hashlib.sha256(json.dumps(checks, sort_keys=True).encode()).hexdigest()
    else:
        if not args.tests:
            raise SystemExit("--tests is required for score mode")
        expected_checks_sha = fingerprint(args.tests)
    if (out / "result.json").exists():
        saved = json.loads((out / "result.json").read_text())
        if saved["source_sha256"] != sha or saved["mode"] != args.mode or saved["checks_sha256"] != expected_checks_sha:
            raise SystemExit("existing result belongs to another input")
        expected_lifecycle = "shared" if args.mode == "score" or args.shared_server else "per_check"
        saved_lifecycle = saved.get("runtime", {}).get("server_lifecycle", "shared" if saved["mode"] == "score" else "per_check")
        if saved_lifecycle != expected_lifecycle:
            raise SystemExit("existing result belongs to another server lifecycle")
        print(
            json.dumps(
                {
                    "reused_result": True,
                    "passed": saved["passed"],
                    "total": saved["total"],
                }
            )
        )
        return
    if out.exists():
        raise SystemExit("incomplete replay exists; inspect it before retrying")
    out.mkdir(parents=True)
    shutil.copytree(
        source,
        out / "application",
        ignore=shutil.ignore_patterns("node_modules", "dist", "__pycache__"),
    )
    if args.mode == "probe":
        (out / "checks").mkdir()
        shutil.copy2(
            args.probe_source or tools / "ctrip_business.spec.cjs",
            out / "checks" / "ctrip_business.spec.cjs",
        )
    else:
        if not args.tests:
            raise SystemExit("--tests is required for score mode")
        shutil.copytree(args.tests, out / "checks")
    checks_sha = fingerprint(out / "checks")
    name = "arc-business-" + uuid.uuid4().hex[:12]
    cmd = [
        "docker",
        "--context",
        "desktop-linux",
        "run",
        "--rm",
        "--init",
        "--pull=never",
        "--name",
        name,
        "--cpus",
        "1",
        "--memory",
        "2g",
        "--network",
        "none",
        "--env",
        "ARC_PROBE_SHARED_SERVER=" + ("1" if args.shared_server else "0"),
        "--mount",
        f"type=bind,source={out},target=/workspace",
        "--mount",
        f"type=bind,source={out / 'checks'},target=/workspace/checks,readonly",
        "--mount",
        f"type=bind,source={tools.resolve()},target=/experiment-tools,readonly",
        "--workdir",
        "/workspace",
        args.image,
        "node",
        "/experiment-tools/container_runner.cjs",
        args.mode,
    ]
    started = time.time()
    atomic_json(
        out / "invocation.json",
        {
            "command": cmd,
            "started_at": started,
            "source_sha256": sha,
            "checks_sha256": checks_sha,
        },
    )
    try:
        with (out / "docker.log").open("w") as log:
            proc = subprocess.run(cmd, stdout=log, stderr=subprocess.STDOUT)
        if not proc.returncode and (out / "application-failure.json").exists():
            failure = json.loads((out / "application-failure.json").read_text())
            atomic_json(
                out / "result.json",
                {
                    "mode": args.mode,
                    "source_sha256": sha,
                    "checks_sha256": checks_sha,
                    "application_failure": failure,
                    "passed": None,
                    "total": 0,
                    "cases": [],
                    "official_score": False,
                },
            )
            print(json.dumps({"application_failure": failure["stage"]}))
            return
        if proc.returncode or not (out / "report.json").exists():
            raise RuntimeError(
                "container evaluation failed; inspect " + str(out / "docker.log")
            )
    finally:
        subprocess.run(
            ["docker", "--context", "desktop-linux", "rm", "-f", name],
            capture_output=True,
        )
    if fingerprint(source) != sha or fingerprint(out / "checks") != checks_sha:
        raise RuntimeError("evaluation changed the frozen source or checks")
    cases = summarize(json.loads((out / "report.json").read_text()))
    expected = args.probe_count if args.mode == "probe" else 125
    if len(cases) != expected:
        raise RuntimeError(
            f"evaluation produced {len(cases)} cases instead of {expected}"
        )
    result = {
        "mode": args.mode,
        "source_sha256": sha,
        "checks_sha256": checks_sha,
        "passed": sum(x["passed"] for x in cases),
        "total": len(cases),
        "cases": cases,
        "seconds": round(time.time() - started, 3),
        "runtime": json.loads((out / "runtime.json").read_text()),
        "official_score": False,
        "architecture_limitation": "local arm64; formal runner is x86_64",
    }
    atomic_json(out / "result.json", result)
    print(json.dumps({k: result[k] for k in ["mode", "passed", "total", "seconds"]}))


if __name__ == "__main__":
    main()
