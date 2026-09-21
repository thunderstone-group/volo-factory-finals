"""Reconstruct saved repair inputs/outputs without making model or platform requests."""

import argparse
import ast
import hashlib
import importlib.util
import json
from pathlib import Path

from business_replay import fingerprint
from experiment_recovery import atomic_json


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


def audit(root):
    plan = json.loads((root / "plan.json").read_text())
    state = json.loads((root / "loop-state.json").read_text())
    repo = Path(__file__).resolve().parents[1]
    roots = [repo, *sorted(root.glob("driver-v*"))]
    driver = next(
        (
            p
            for p in roots
            if all(
                (p / name).is_file()
                and hashlib.sha256((p / name).read_bytes()).hexdigest() == sha
                for name, sha in plan["driver_hashes"].items()
            )
        ),
        None,
    )
    if driver is None:
        raise ValueError("no preserved driver matches the frozen plan")
    worker_path = driver / "scripts/business_model_step.py"
    worker = module("audit_worker", worker_path)
    agent = module("audit_agent", Path(plan["adapter"]))
    current, probe = Path(plan["baseline_application"]), Path(plan["baseline_probe"])
    result = {
        "driver_hashes_preserved": True,
        "driver_snapshot": str(driver),
        "baseline_preserved": fingerprint(current) == plan["baseline_source_sha256"],
        "requirements_preserved": hashlib.sha256(
            Path(plan["requirements"]).read_bytes()
        ).hexdigest()
        == plan["requirements_sha256"],
        "rounds": [],
    }
    previous_rejection = None
    for row in state["rounds"]:
        out = root / f"round-{row['number']}" / "model"
        request = json.loads((out / "request.json").read_text())
        trace = json.loads((out / "trace.json").read_text())
        transport = json.loads((out / "transport.json").read_text())
        note = worker.feedback(json.loads(probe.read_text()))
        if plan.get("include_readonly_diagnostics"):
            note["existing_input_contract_diagnostics"] = agent.readonly_gaps(current)
            for node in ast.walk(ast.parse(worker_path.read_text())):
                if isinstance(node, ast.Assign) and any(
                    isinstance(t, ast.Subscript)
                    and isinstance(t.slice, ast.Constant)
                    and t.slice.value == "input_contract_instruction"
                    for t in node.targets
                ):
                    note["input_contract_instruction"] = ast.literal_eval(node.value)
        if previous_rejection:
            note["previous_proposal_was_rolled_back"] = json.loads(
                previous_rejection.read_text()
            )
        before = agent.read_template(current)
        blocks = "\n".join(
            "=== FILE: " + name + " ===\n" + data.decode() + "\n=== END ==="
            for name, data in sorted(before.items())
        )
        messages = [
            {"role": "system", "content": worker.SYSTEM},
            {
                "role": "user",
                "content": "APPLICATION REQUIREMENTS\n"
                + Path(plan["requirements"]).read_text()
                + "\nCURRENT ACCEPTED APPLICATION\n"
                + blocks
                + "\nBUSINESS DIAGNOSTICS\n"
                + json.dumps(note, ensure_ascii=False, indent=2),
            },
        ]
        expected = dict(before)
        changes, missing = agent.parse_blocks(trace["attempts"][0]["content"])
        for change in changes:
            path = agent.resolve_path(out / "application", change["path"]).relative_to(
                out / "application"
            )
            expected[str(path)] = change["content"].encode()
        checks = {
            "round": row["number"],
            "inputs_match_declared_sources_only": request["messages"] == messages,
            "trace_matches_request": trace["attempts"][0]["messages"] == messages,
            "model_matches": request["model"]
            == transport.get("response_model")
            == plan["model"],
            "parameters_match": request["temperature"] == plan["temperature"]
            and request["max_tokens"] == plan["max_output_tokens"],
            "transport_complete": transport["saw_done"]
            and transport["curl_exit_code"] == 0,
            "application_is_exact_model_patch": not missing
            and expected == agent.read_template(out / "application"),
            "source_hash_matches": fingerprint(out / "application")
            == row["source_sha256"],
        }
        if not all(v for k, v in checks.items() if k != "round"):
            raise ValueError(str(checks))
        result["rounds"].append(checks)
        if row["accepted"]:
            current, probe = out / "application", out.parent / "probe/result.json"
            previous_rejection = None
        else:
            previous_rejection = out.parent / "rejection.json"
    if not result["baseline_preserved"] or not result["requirements_preserved"]:
        raise ValueError("frozen inputs changed")
    atomic_json(root / "audit.json", result)
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("run_dirs", nargs="+", type=Path)
    args = parser.parse_args()
    for root in args.run_dirs:
        result = audit(root.resolve())
        print(
            json.dumps(
                {
                    "run": str(root),
                    "audited_rounds": len(result["rounds"]),
                    "passed": True,
                }
            )
        )
