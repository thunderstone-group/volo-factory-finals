#!/usr/bin/env python3
"""VOLO minimal V1: explicit inputs and semantic UI construction; V0 transport unchanged."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import sys
import time

try:
    import core  # Included unchanged from oneshot/main.py in the standalone ZIP.
except ModuleNotFoundError:
    from oneshot import main as core

HERE = Path(__file__).resolve().parent
SYSTEM = """You implement complete web applications from the supplied requirements.
Before emitting code, work out the entities, seed records, relationships, user flows,
state ownership and semantic UI structure within this same response. Implement all
specified behaviors, including errors, persistence and undo where requested. Follow
the construction guide and delivery contract. Requirements are authoritative; the
guide supplies consistent defaults only where requirements leave a choice. You have
no acceptance-test source and must not invent hidden test requirements. Output only
complete file blocks. Prefer straightforward working code to elaborate styling."""


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True,
                                     separators=(",", ":")).encode()).hexdigest()


def load_inputs(root):
    """Only requirement documents: never discover tests or unrelated local files."""
    root = Path(root)
    sources = []
    def read(name):
        path = root / name
        if not path.exists():
            return ""
        if path.is_symlink() or not path.is_file() or path.stat().st_size > 2 * 1024 * 1024:
            raise ValueError("invalid requirement document: " + name)
        data = path.read_text(encoding="utf-8")
        sources.append({"path": name, "sha256": hashlib.sha256(data.encode()).hexdigest()})
        return data
    yaml = read("requirements.yaml")
    detail_text = read("detail.json")
    detail = json.loads(detail_text) if detail_text else {}
    if not isinstance(detail, dict):
        raise ValueError("detail.json must be an object")
    # Markdown is an alternative rendering, not a second copy of the same task.
    document = yaml or detail.get("requirements_yaml") or read("requirements.md") or detail.get("requirements_markdown")
    if not isinstance(document, str) or not document.strip():
        raise ValueError("no requirement document")
    prerequisite = read("prerequisites.md") or detail.get("prerequisites_markdown", "")
    if not isinstance(prerequisite, str):
        raise ValueError("prerequisites must be text")
    if prerequisite.strip():
        document += "\n\n## Supplied prerequisites\n" + prerequisite
    return document, {"sources": sources, "document_sha256": hashlib.sha256(document.encode()).hexdigest(),
                      "prerequisites_included": bool(prerequisite.strip()),
                      "remote_references_fetched": False}


class TraceBudget(core.CallBudget):
    def start(self, messages, model):
        record = super().start(messages, model)
        record["messages_sha256"] = digest(messages)
        record["system_sha256"] = digest([m for m in messages if m["role"] == "system"])
        print("[minimal] request " + json.dumps({k: record[k] for k in
              ("call", "model", "messages_sha256", "system_sha256")}), file=sys.stderr, flush=True)
        return record


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("requirement_path", type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--type", default="web", choices=("web",))
    parser.add_argument("--template-dir", type=Path)
    args = parser.parse_args(argv)
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        print("[oneshot] failed: OPENAI_API_KEY is not set", file=sys.stderr)
        return 1
    budget = TraceBudget()
    started = time.monotonic()
    try:
        document, identity = load_inputs(args.requirement_path)
        print("[minimal] input " + json.dumps(identity), file=sys.stderr)
        core.HERE, core.SYSTEM = HERE, SYSTEM
        template = args.template_dir
        if template is None and args.output_dir.is_dir() and any(args.output_dir.iterdir()):
            template = args.output_dir
        files, _ = core.generate(document, os.environ.get("MODEL", core.DEFAULT_MODEL),
                                 os.environ.get("OPENAI_BASE_URL", core.DEFAULT_BASE), key,
                                 args.output_dir, budget, template=template)
        print(f"[oneshot] wrote {len(files)} files in {time.monotonic() - started:.1f}s")
        return 0
    except Exception as exc:
        print(("[oneshot] failed: " + str(exc)).replace(key, "[REDACTED]"), file=sys.stderr)
        return 1
    finally:
        for attempt in budget.attempts:
            print("[oneshot] trace " + json.dumps(attempt, ensure_ascii=False).replace(key, "[REDACTED]"), file=sys.stderr)
        print("[oneshot] usage " + json.dumps(budget.summary(), sort_keys=True), file=sys.stderr)


if __name__ == "__main__":
    sys.exit(main())
