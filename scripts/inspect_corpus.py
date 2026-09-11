#!/usr/bin/env python3
"""Inspect a pinned, local corpus without checking out or editing upstream files.

Only requirements YAML is loaded. This establishes parser/scheduling coverage,
not execution, reference-asset handling or official evaluator compatibility.
"""
import argparse
import hashlib
import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from volo.requirements import RequirementSet


def inspect(repository, catalog):
    rows = []
    for task in catalog["tasks"]:
        raw = subprocess.check_output([
            "git", "-C", str(repository), "show", catalog["repository_commit"] + ":" + task["path"]])
        row = {"path": task["path"], "sha256": hashlib.sha256(raw).hexdigest()}
        if row["sha256"] != task["sha256"]:
            raise ValueError("Pinned corpus hash mismatch: " + task["path"])
        with tempfile.TemporaryDirectory(prefix="volo-corpus-inspect-") as directory:
            root = Path(directory)
            (root / "requirements.yaml").write_bytes(raw)
            try:
                requirements = RequirementSet.load(root)
                batches = requirements.batches()
                row.update(status="scheduled", scheduled_nodes=len(requirements.nodes),
                           explicitly_atomic_nodes=task["atomic_requirements"], batches=len(batches),
                           largest_batch_prompt_chars=max(
                               (len(requirements.batch_prompt(nodes)) for nodes in batches), default=0))
            except ValueError as error:
                row.update(status="rejected", error=str(error))
        rows.append(row)
    return {"source_url": catalog["source_url"], "repository_commit": catalog["repository_commit"],
            "scope": "Requirements parsing and scheduling only; no model calls, assets or official tests.",
            "documents": len(rows), "scheduled": sum(row["status"] == "scheduled" for row in rows),
            "unique_semantic_documents": catalog["unique_semantic_documents"], "tasks": rows}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("repository", type=Path)
    parser.add_argument("--catalog", type=Path,
                        default=ROOT / "docs/evidence/2026-09-11-provided-task-catalog.json")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    report = inspect(args.repository, json.loads(args.catalog.read_text()))
    rendered = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.write_text(rendered)
    else:
        print(rendered, end="")
    return 0 if report["scheduled"] == report["documents"] else 1


if __name__ == "__main__":
    sys.exit(main())
