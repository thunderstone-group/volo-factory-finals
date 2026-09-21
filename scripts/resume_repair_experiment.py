"""Predeclared, serial comparison; fixed candidate and at most three new drafts per task."""

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import time
from experiment_recovery import Recovery, RunLock, atomic_json, repair_pending_archives
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument("action", choices=["status", "resume"])
p.add_argument("--run-dir", required=True, type=Path)
p.add_argument("--ssh-host", default="hk-zyl")
args = p.parse_args()
if args.action == "resume" and sys.version_info[:3] != (3, 11, 15):
    raise SystemExit(
        "This frozen experiment requires Python 3.11.15; use "
        "uv run --no-project --python 3.11.15 python scripts/resume_repair_experiment.py. "
        "No experiment state or model request was changed."
    )
r = args.run_dir.resolve()
repo = r.parents[1]
base = r / "baseline/oneshot/main.py"
candidate = r / "candidate-v1/oneshot/main.py"
call = Path(__file__).with_name("repair_experiment_call.py")
plan = json.loads((r / "plan.json").read_text())
expected_candidate = plan["current_candidate_source_sha256"]
if hashlib.sha256(candidate.read_bytes()).hexdigest() != expected_candidate:
    raise SystemExit("candidate source changed")
baseline_source = subprocess.check_output(
    ["git", "show", plan["baseline_commit"] + ":oneshot/main.py"], cwd=repo
)
if base.read_bytes() != baseline_source:
    raise SystemExit("frozen baseline differs from the declared baseline commit")
check = json.loads((r / "12306-candidate-fixed/delta.json").read_text())
if check["regressed"] or check["passed_after"] <= check["passed_before"]:
    raise SystemExit("development comparison rejected")
root = r / "holdout"
root.mkdir(exist_ok=True)
state_path = root / "state.json"
state = (
    json.loads(state_path.read_text())
    if state_path.exists()
    else {
        "started_at": time.time(),
        "candidate_sha256": expected_candidate,
        "status": "running",
        "pairs": [],
        "planned_pairs": 6,
        "stop_rule": "reject at the first observed regression; do not replace a measured pair with another generation",
        "completed_model_calls_in_scored_pairs": 0,
    }
)


def save():
    atomic_json(state_path, state)


def step(name, cmd, where):
    state["current_step"] = name
    save()
    recovery.step(name, cmd + ["--run-dir", str(r)], where, repo)


def fingerprint(app):
    files = {}
    for current, dirs, names in os.walk(app):
        dirs[:] = sorted(
            d for d in dirs if d not in ("node_modules", "dist", "__pycache__", ".git")
        )
        for n in sorted(names):
            path = Path(current) / n
            if path.is_symlink():
                raise RuntimeError("application source contains symlink")
            files[str(path.relative_to(app))] = hashlib.sha256(
                path.read_bytes()
            ).hexdigest()
    return hashlib.sha256(json.dumps(files, sort_keys=True).encode()).hexdigest()


def cases(report):
    d = json.loads(report.read_text())
    result = {}

    def walk(suite):
        for spec in suite.get("specs", []):
            for test in spec.get("tests", []):
                result[spec["title"]] = test["status"] == "expected"
        for ch in suite.get("suites", []):
            walk(ch)

    for s in d["suites"]:
        walk(s)
    return result


def replay(app, name, application, pair, cache):
    if time.strftime("%Y-%m-%d", time.gmtime()) != comparison_day:
        raise RuntimeError("UTC day changed during the paired comparison")
    sha = fingerprint(application)
    destination = pair / ("score-" + name)
    result = destination / "result.json"
    if result.exists():
        existing = json.loads(result.read_text())
        if existing["source_sha256"] != sha:
            raise RuntimeError("existing score belongs to different application source")
        score_day = existing.get("utc_day") or time.strftime(
            "%Y-%m-%d", time.gmtime(Path(existing["report"]).stat().st_mtime)
        )
        if score_day == comparison_day:
            cache[sha] = existing
            return existing
        archived = destination.with_name(destination.name + "-prior-day-" + score_day)
        if archived.exists():
            raise RuntimeError("prior-day replay archive already exists")
        destination.rename(archived)
        # Retain the old result bytes and record the new archive location separately.
        old_report = Path(existing["report"])
        if old_report.is_relative_to(destination):
            atomic_json(
                archived / "archive-location.json",
                {
                    "original_report": str(old_report),
                    "archived_report": str(
                        archived / old_report.relative_to(destination)
                    ),
                },
            )
    if sha in cache:
        origin = cache[sha]
        destination.mkdir()
        d = {**origin, "reused_identical_application": True}
        atomic_json(result, d)
        return d
    if destination.exists():
        # A completed summary can be finalized without rerunning the browser.
        if not (destination / "summary.json").exists():
            raise RuntimeError(
                "incomplete browser replay requires inspection: " + str(destination)
            )
    else:
        destination.mkdir()
    execution = destination / "application"
    if not execution.exists():
        shutil.copytree(application, execution)
    work = destination / "replay"
    summary = destination / "summary.json"
    tests = repo / "runs/fixed-draft/testsets-web" / ("arc-bench-web--" + app)
    cmd = [
        sys.executable,
        "~/projects/volo-factory-worktrees/bigtask-keep/harness_lab/state_rehearsal.py",
        "--app",
        app,
        "--app-dir",
        str(execution),
        "--profile",
        "hosted",
        "--tests-dir",
        str(tests),
        "--work-dir",
        str(work),
        "--json",
        str(summary),
    ]
    state["current_step"] = app + "/" + pair.name + "/" + name + "/replay"
    save()
    if not summary.exists():
        code = recovery.run(cmd, destination / "replay.log", repo)
        if code or not summary.exists():
            raise RuntimeError("replay infrastructure failure: " + str(destination))
    if time.strftime("%Y-%m-%d", time.gmtime()) != comparison_day:
        raise RuntimeError(
            "UTC day changed during the paired comparison; preserve and inspect replays"
        )
    d = json.loads(summary.read_text())
    expected = {"12306": 135, "ctrip": 125}[app]
    if d.get("total") != expected:
        raise RuntimeError("suite did not execute its expected cases")
    score = {
        "source_sha256": sha,
        "passed": d["passed"],
        "total": d["total"],
        "cases": cases(work / f"report-{app}-hosted.json"),
        "reused_identical_application": False,
        "report": str(work / f"report-{app}-hosted.json"),
        "utc_day": comparison_day,
    }
    if (
        len(score["cases"]) != score["total"]
        or sum(score["cases"].values()) != score["passed"]
    ):
        raise RuntimeError("case identities or counts disagree with replay summary")
    atomic_json(result, score)
    cache[sha] = score
    return score


if args.action == "status":
    print(
        json.dumps(
            {
                "status": state["status"],
                "current_step": state.get("current_step"),
                "pairs": [
                    {
                        k: v
                        for k, v in x.items()
                        if k
                        in [
                            "id",
                            "draft_passed",
                            "baseline_passed",
                            "candidate_passed",
                            "total",
                        ]
                    }
                    for x in state["pairs"]
                ],
            },
            indent=2,
        )
    )
    raise SystemExit(0)
os.environ["ARC_EXPERIMENT_HTTP_VERSION"] = "1.1"
os.environ["ARC_EXPERIMENT_SSH_HOST"] = args.ssh_host
with RunLock(root) as lock:
    state = json.loads(state_path.read_text())
    if state["status"] in ("retained", "rejected"):
        print(json.dumps({"status": state["status"], "new_model_calls": 0}))
        raise SystemExit(0)
    if any(x["regressed"] for x in state["pairs"]):
        raise SystemExit(
            "a completed pair has regressions; do not resume a rejected comparison"
        )
    state.update(status="running")
    state.pop("error", None)
    state.pop("interrupted_at", None)
    recovery = Recovery(root, lock)
    repair_pending_archives(recovery)
    try:
        for index in range(1, 4):
            for app in ["12306", "ctrip"]:
                pair_id = app + "-" + str(index)
                if any(x["id"] == pair_id for x in state["pairs"]):
                    continue
                pair = root / pair_id
                pair.mkdir(exist_ok=True)
                comparison_day = time.strftime("%Y-%m-%d", time.gmtime())
                cache = {}
                for old_score in pair.glob("score-*-uncontrolled-hash/result.json"):
                    old = json.loads(old_score.read_text())
                    if old.get("utc_day") == comparison_day:
                        cache[old["source_sha256"]] = old
                draft = pair / "draft"
                b = pair / "baseline"
                c = pair / "candidate"
                cmd = [
                    sys.executable,
                    str(call),
                    "--app",
                    app,
                    "--mode",
                    "generate",
                    "--adapter",
                    str(base),
                    "--out",
                    str(draft),
                    "--proxy",
                    "socks5h://127.0.0.1:1",
                ]
                step(pair_id + "/generate", cmd, draft)
                raw = replay(app, "draft", draft / "application", pair, cache)
                common = [
                    sys.executable,
                    str(call),
                    "--app",
                    app,
                    "--mode",
                    "repair",
                    "--draft",
                    str(draft / "application"),
                    "--draft-trace",
                    str(draft / "trace.json"),
                    "--proxy",
                    "socks5h://127.0.0.1:1",
                ]
                archived = [
                    str(x) for x in sorted(pair.glob("*-uncontrolled-hash/trace.json"))
                ]
                reuse_baseline = ["--reuse-repair", *archived] if archived else []
                step(
                    pair_id + "/baseline-repair",
                    common + ["--adapter", str(base), "--out", str(b)] + reuse_baseline,
                    b,
                )
                baseline = replay(app, "baseline", b / "application", pair, cache)
                step(
                    pair_id + "/candidate-repair",
                    common
                    + [
                        "--adapter",
                        str(candidate),
                        "--out",
                        str(c),
                        "--reuse-repair",
                        str(b / "trace.json"),
                        *archived,
                    ],
                    c,
                )
                improved = replay(app, "candidate", c / "application", pair, cache)
                if baseline["cases"].keys() != improved["cases"].keys():
                    raise RuntimeError(
                        "baseline and candidate have different case identities"
                    )
                gains = [
                    k
                    for k in baseline["cases"]
                    if not baseline["cases"][k] and improved["cases"][k]
                ]
                regressions = [
                    k
                    for k in baseline["cases"]
                    if baseline["cases"][k] and not improved["cases"][k]
                ]
                result = {
                    "id": pair_id,
                    "app": app,
                    "draft_passed": raw["passed"],
                    "baseline_passed": baseline["passed"],
                    "candidate_passed": improved["passed"],
                    "total": baseline["total"],
                    "gained": gains,
                    "regressed": regressions,
                    "receipts": {
                        label: json.loads((path / "receipt.json").read_text())
                        for label, path in [
                            ("draft", draft),
                            ("baseline", b),
                            ("candidate", c),
                        ]
                    },
                }
                state["pairs"].append(result)
                state["completed_model_calls_in_scored_pairs"] = sum(
                    sum(z.get("new_model_calls", 0) for z in row["receipts"].values())
                    for row in state["pairs"]
                )
                save()
                print(
                    json.dumps(
                        {
                            "pair": pair_id,
                            "draft": raw["passed"],
                            "baseline": baseline["passed"],
                            "candidate": improved["passed"],
                            "gained": len(gains),
                            "regressed": len(regressions),
                        }
                    ),
                    flush=True,
                )
                if regressions:
                    state.update(
                        status="rejected",
                        reason="a planned pair lost baseline-passing cases",
                        finished_at=time.time(),
                    )
                    save()
                    raise SystemExit(2)
        gain = sum(
            (x["candidate_passed"] - x["baseline_passed"]) / x["total"]
            for x in state["pairs"]
        ) / len(state["pairs"])
        state.update(
            status="retained" if gain > 0 else "rejected",
            task_equal_gain=gain,
            finished_at=time.time(),
        )
        state.pop("current_step", None)
        save()
        print(
            json.dumps({"status": state["status"], "task_equal_gain": gain}), flush=True
        )
    except Exception as exc:
        state.update(status="interrupted", error=str(exc), interrupted_at=time.time())
        save()
        raise
