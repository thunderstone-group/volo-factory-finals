"""Bounded goal-style pilot. Public scoring is never used as model/acceptance feedback."""

import argparse
import hashlib
import json
from pathlib import Path
import sys
import time

from business_replay import fingerprint
from experiment_recovery import Recovery, RunLock, atomic_json, repair_pending_archives


def decision(before, after):
    if before.get("checks_sha256") != after.get("checks_sha256") or before.get(
        "runtime"
    ) != after.get("runtime"):
        raise ValueError("probe definition or runtime changed during comparison")
    old = {c["name"]: c["passed"] for c in before["cases"]}
    new = {c["name"]: c["passed"] for c in after["cases"]}
    if old.keys() != new.keys():
        raise ValueError("business checks changed during comparison")
    gained = sorted(k for k in old if new[k] and not old[k])
    lost = sorted(k for k in old if old[k] and not new[k])
    return {"accepted": bool(gained) and not lost, "gained": gained, "regressed": lost}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--run-dir", required=True, type=Path)
    args = p.parse_args()
    if sys.version_info[:3] != (3, 11, 15):
        raise SystemExit("use Python 3.11.15 for this frozen pilot")
    root = args.run_dir.resolve()
    plan = json.loads((root / "plan.json").read_text())
    scripts = Path(__file__).resolve().parent
    for relative, sha in plan["driver_hashes"].items():
        if hashlib.sha256((scripts.parent / relative).read_bytes()).hexdigest() != sha:
            raise SystemExit("frozen experiment code changed: " + relative)
    if (
        fingerprint(Path(plan["baseline_application"]))
        != plan["baseline_source_sha256"]
    ):
        raise SystemExit("baseline source changed")
    if (
        hashlib.sha256(Path(plan["requirements"]).read_bytes()).hexdigest()
        != plan["requirements_sha256"]
    ):
        raise SystemExit("requirements changed")
    with RunLock(root) as lock:
        recovery = Recovery(root, lock)
        repair_pending_archives(recovery)
        state_path = root / "loop-state.json"
        state = (
            json.loads(state_path.read_text())
            if state_path.exists()
            else {
                "status": "running",
                "current_application": plan["baseline_application"],
                "current_probe": plan["baseline_probe"],
                "rounds": [],
                "stalled_rounds": 0,
            }
        )
        if state["status"] in ("goal_checks_passed", "stalled", "round_limit"):
            print(json.dumps({"status": state["status"], "new_model_calls": 0}))
            return
        last_rejection = None
        if state["rounds"] and not state["rounds"][-1]["accepted"]:
            last_rejection = (
                root / f"round-{state['rounds'][-1]['number']}" / "rejection.json"
            )
        try:
            for number in range(len(state["rounds"]) + 1, plan["max_rounds"] + 1):
                before = json.loads(Path(state["current_probe"]).read_text())
                if all(c["passed"] for c in before["cases"]):
                    state["status"] = "goal_checks_passed"
                    break
                round_dir = root / f"round-{number}"
                round_dir.mkdir(exist_ok=True)
                model_dir = round_dir / "model"
                cmd = [
                    sys.executable,
                    str(scripts / "business_model_step.py"),
                    "--application",
                    state["current_application"],
                    "--requirements",
                    plan["requirements"],
                    "--probe",
                    state["current_probe"],
                    "--adapter",
                    plan["adapter"],
                    "--out",
                    str(model_dir),
                ]
                if last_rejection:
                    cmd += ["--previous-rejection", str(last_rejection)]
                if plan.get("include_readonly_diagnostics"):
                    cmd += ["--include-readonly-diagnostics"]
                state.update(status="running", current_step=f"round-{number}/model")
                atomic_json(state_path, state)
                recovery.step(f"round-{number}/model", cmd, model_dir, scripts.parent)
                receipt = json.loads((model_dir / "receipt.json").read_text())
                if receipt["valid_patch"]:
                    probe_dir = round_dir / "probe"
                    state["current_step"] = f"round-{number}/probe"
                    atomic_json(state_path, state)
                    cmd = [
                        sys.executable,
                        str(scripts / "business_replay.py"),
                        "--mode",
                        "probe",
                        "--application",
                        str(model_dir / "application"),
                        "--out",
                        str(probe_dir),
                    ]
                    if plan.get("probe_file"):
                        cmd += ["--probe-source", plan["probe_file"]]
                    cmd += ["--probe-count", str(plan["probe_count"])]
                    code = recovery.run(cmd, round_dir / "probe.log", scripts.parent)
                    if code:
                        raise RuntimeError(
                            "probe execution failed; inspect before making another model request"
                        )
                    after = json.loads((probe_dir / "result.json").read_text())
                    outcome = (
                        {
                            "accepted": False,
                            "gained": [],
                            "regressed": [],
                            "application_failure": after["application_failure"],
                        }
                        if after.get("application_failure")
                        else decision(before, after)
                    )
                else:
                    after = before
                    outcome = {
                        "accepted": False,
                        "gained": [],
                        "regressed": [],
                        "invalid_patch": receipt["patch_error"],
                    }
                row = {
                    "number": number,
                    "before_passed": before["passed"],
                    "proposal_passed": after["passed"],
                    **outcome,
                    "usage": receipt["usage"],
                    "source_sha256": fingerprint(model_dir / "application"),
                }
                state["rounds"].append(row)
                if outcome["accepted"]:
                    state["current_application"] = str(model_dir / "application")
                    state["current_probe"] = str(round_dir / "probe/result.json")
                    state["stalled_rounds"] = 0
                    last_rejection = None
                else:
                    state["stalled_rounds"] += 1
                    last_rejection = round_dir / "rejection.json"
                    atomic_json(
                        last_rejection,
                        {
                            **outcome,
                            "instruction": "Previous proposal was rolled back. Current source is the accepted application.",
                            "newly_failing_journeys": [
                                c
                                for c in after["cases"]
                                if c["name"] in outcome["regressed"]
                            ],
                        },
                    )
                atomic_json(state_path, state)
                print(json.dumps(row, ensure_ascii=False), flush=True)
                if outcome["accepted"] and after["passed"] == after["total"]:
                    state["status"] = "goal_checks_passed"
                    break
                if state["stalled_rounds"] >= plan["max_stalled_rounds"]:
                    state["status"] = "stalled"
                    break
            else:
                state["status"] = "round_limit"
            state.pop("current_step", None)
            state["finished_at"] = time.time()
            atomic_json(state_path, state)
            print(
                json.dumps(
                    {
                        "status": state["status"],
                        "rounds": len(state["rounds"]),
                        "selected_application": state["current_application"],
                    }
                ),
                flush=True,
            )
        except BaseException as exc:
            state.update(
                status="interrupted", error=str(exc), interrupted_at=time.time()
            )
            atomic_json(state_path, state)
            raise


if __name__ == "__main__":
    main()
