#!/usr/bin/env python3
"""Run the one-shot repair loop on an existing application as if it were the draft (roadmap 4.3 validation).

    python scripts/repair_replay.py --requirements REQUIREMENTS.yaml --app APP_DIR --out OUT_DIR
        [--model deepseek-v4-flash] [--repair-cny 3] [--env-file ~/.config/arcbench/volo.env]

The draft conversation is rebuilt the way generate() builds it (card, contract, vocabulary, requirements, scaffold);
the assistant turn holds the application's own source files, those that differ from the scaffold, as file blocks.
The repair loop then runs with real model calls. The gateway key comes from OPENAI_API_KEY or, when that is unset,
from ARC_BENCH_API_KEY in the env file; it is never printed or written.

OUT_DIR receives application/ (the result), repair.json (the smoke record with every round, the call ledger and the
estimated cost) and trace.jsonl (every call with its true prompt and reply, the key redacted). This is a controlled
repair: its score is evidence about the repair loop, never progress of the candidate (roadmap section 7).
"""
import argparse
import json
import os
import shutil
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from oneshot import main as adapter  # noqa: E402

SKIP = ("node_modules", "dist", "__pycache__", "package-lock.json")


def source_files(app, scaffold):
    """The application's text files under backend/ and frontend/ that the scaffold does not already hold verbatim."""
    files = []
    for part in ("backend", "frontend"):
        for path in sorted((app / part).rglob("*")):
            rel = path.relative_to(app)
            if not path.is_file() or any(p in SKIP or p.startswith(".") for p in rel.parts):
                continue
            data = path.read_bytes()
            if scaffold.get(rel.as_posix()) == data:
                continue
            try:
                files.append({"path": rel.as_posix(), "content": data.decode("utf-8")})
            except UnicodeDecodeError:
                continue
    return files


def as_blocks(files):
    return "".join(f"=== FILE: {f['path']} ===\n{f['content'].rstrip(chr(10))}\n=== END ===\n" for f in files)


def gateway_key(env_file):
    key = os.environ.get("OPENAI_API_KEY", "")
    if key:
        return key
    for line in Path(env_file).expanduser().read_text(encoding="utf-8").splitlines():
        name, _, value = line.partition("=")
        if name.strip() == "ARC_BENCH_API_KEY":
            return value.strip().strip("'\"")
    raise SystemExit("no OPENAI_API_KEY and no ARC_BENCH_API_KEY in " + str(env_file))


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--requirements", required=True, type=Path)
    parser.add_argument("--app", required=True, type=Path, help="directory holding frontend/ and backend/")
    parser.add_argument("--out", required=True, type=Path, help="new directory for the result")
    parser.add_argument("--model", default=adapter.DEFAULT_MODEL)
    parser.add_argument("--repair-cny", type=float, default=None, help="repair spend limit (default: the adapter's)")
    parser.add_argument("--env-file", default="~/.config/arcbench/volo.env")
    parser.add_argument("--suite", type=Path, default=None,
                        help="a written test suite (testgen.py write) that drives the repairs instead of the scenario check")
    args = parser.parse_args(argv)
    app, out = args.app.resolve(), args.out.resolve()
    if out.exists():
        raise SystemExit(f"{out} exists; every replay gets a new directory")
    requirements = args.requirements.read_text(encoding="utf-8")
    key = gateway_key(args.env_file)
    os.environ["OPENAI_API_KEY"] = key  # the scenario translation reads it; generated code never sees this environment
    base = os.environ.get("OPENAI_BASE_URL", adapter.DEFAULT_BASE)
    scaffold = adapter.read_template(adapter.SCAFFOLD_DIR)
    work = out / ".work"
    stage = work / "app"
    for part in ("frontend", "backend"):
        shutil.copytree(app / part, stage / part, ignore=shutil.ignore_patterns(*SKIP))
    files = source_files(app, scaffold)
    messages = adapter.draft_messages(requirements, scaffold) + [{"role": "assistant", "content": as_blocks(files)}]
    budget = adapter.CallBudget(repair_cny=args.repair_cny)
    budget.phase = "repair"
    started, error = time.monotonic(), None
    try:
        adapter.repair_delivery(stage, files, messages, args.model, base, key, budget, None, requirements, scaffold=True,
                                tests=str(args.suite.resolve()) if args.suite else None)
    except Exception as exc:  # recorded; the stage still holds the last kept version
        error = f"{type(exc).__name__}: {exc}"
    shutil.copytree(stage, out / "application", ignore=shutil.ignore_patterns(*SKIP))
    record = {"app": str(app), "requirements": str(args.requirements.resolve()), "model": args.model,
              "seconds": round(time.monotonic() - started, 1), "error": error, "draft_files": [f["path"] for f in files],
              "summary": budget.summary(), "smoke": budget.smoke}
    (out / "repair.json").write_text(json.dumps(record, ensure_ascii=False, indent=1).replace(key, "[REDACTED]") + "\n",
                                     encoding="utf-8")
    with open(out / "trace.jsonl", "w", encoding="utf-8") as trace:
        for call in budget.attempts + budget.side_calls:
            trace.write(json.dumps(call, ensure_ascii=False).replace(key, "[REDACTED]") + "\n")
    shutil.rmtree(work, ignore_errors=True)
    rounds = (budget.smoke or {}).get("rounds") or []
    print(json.dumps({"out": str(out), "rounds": [(r["round"], r["accepted"], r.get("reason", "")[:120]) for r in rounds],
                      "stopped": (budget.smoke or {}).get("stopped"), "error": error,
                      "cost_cny": record["summary"]["estimated_repair_cost_cny"],
                      "scenarios_before": ((budget.smoke or {}).get("scenarios") or {}).get("counts"),
                      "scenarios_after": ((budget.smoke or {}).get("scenarios_after") or {}).get("counts"),
                      "seconds": record["seconds"]}, ensure_ascii=False))
    return 0 if error is None else 1


if __name__ == "__main__":
    sys.exit(main())
