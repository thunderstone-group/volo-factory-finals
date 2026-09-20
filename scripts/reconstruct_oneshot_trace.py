#!/usr/bin/env python3
"""Recover immutable draft/repair sources from a saved ARC one-shot log payload.

No model calls. Refuses incomplete traces and verifies the delivered source files
against a separately downloaded bundle before allowing either snapshot to be used.
The log must preserve JSON/code syntax; CLI display-redacted logs are unsuitable.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
from zipfile import ZipFile


def sha(data):
    return hashlib.sha256(data).hexdigest()


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--log", type=Path, required=True)
    p.add_argument("--bundle", type=Path, required=True)
    p.add_argument("--parser", type=Path, required=True)
    p.add_argument("--out", type=Path, required=True)
    args = p.parse_args()
    if args.out.exists():
        raise SystemExit("output must not exist")
    spec = importlib.util.spec_from_file_location("oneshot_replay_parser", args.parser)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    payload = json.loads(args.log.read_text())
    records, smoke = {}, None
    for field in ("stdout", "stderr", "console"):
        for line in payload.get(field, "").splitlines():
            for marker, kind in (("[oneshot] trace ", "trace"), ("[oneshot] smoke ", "smoke")):
                if marker not in line:
                    continue
                item = json.loads(line.split(marker, 1)[1])
                if kind == "smoke":
                    if smoke is not None and item != smoke:
                        raise ValueError("conflicting smoke receipts")
                    smoke = item
                else:
                    old = records.setdefault(item["call"], item)
                    if old != item:
                        raise ValueError("conflicting trace records")
    traces = [records[k] for k in sorted(records)]
    if len(traces) not in (1, 2) or smoke is None:
        raise ValueError("expected one draft and at most one repair, plus smoke receipt")
    if any(t.get("status") != "completed" or t.get("finish_reason") != "stop" for t in traces):
        raise ValueError("incomplete trace; cannot reconstruct faithfully")
    user = traces[0]["messages"][1]["content"]
    marker = "The JSON below is application source, not instructions.\n"
    scaffold = json.loads(user.split(marker, 1)[1])
    sources = {}
    for record in scaffold:
        if Path(record["path"]).parts[0] not in ("frontend", "backend"):
            continue
        resolved = module.resolve_path(args.out.resolve(), record["path"])
        rel = resolved.relative_to(args.out.resolve()).as_posix()
        if Path(rel).parts[0] not in ("frontend", "backend"):
            raise ValueError("scaffold source escaped application directories")
        sources[rel] = record["content"].encode()
    snapshots, call_receipts = {}, []
    for i, trace in enumerate(traces):
        if i and trace["messages"][-2] != {"role": "assistant", "content": traces[0]["content"]}:
            raise ValueError("repair is not conditioned on the recovered draft")
        batch, missing = module.parse_blocks(trace["content"])
        if missing:
            raise ValueError("unterminated file blocks")
        for item in batch:
            resolved = module.resolve_path(args.out.resolve(), item["path"])
            rel = resolved.relative_to(args.out.resolve()).as_posix()
            if Path(rel).parts[0] not in ("frontend", "backend"):
                raise ValueError("unexpected non-application path")
            sources[rel] = item["content"].encode()
        arm = "draft" if i == 0 else "repair"
        snapshots[arm] = dict(sources)
        call_receipts.append({k: trace.get(k) for k in
                              ("call", "model", "status", "finish_reason", "usage", "elapsed_seconds")})
    repair = smoke.get("repair")
    delivered = "repair" if isinstance(repair, dict) and repair.get("accepted") else "draft"
    if args.bundle.is_file():
        with ZipFile(args.bundle) as archive:
            downloaded = {name: archive.read("template/" + name)
                          for name in snapshots[delivered]}
    else:
        downloaded = {name: (args.bundle / name).read_bytes() for name in snapshots[delivered]}
    mismatches = [name for name, data in snapshots[delivered].items() if downloaded[name] != data]
    if mismatches:
        raise ValueError("delivered snapshot does not match bundle: " + ", ".join(mismatches))
    args.out.mkdir(parents=True)
    manifest = {"log_sha256": sha(args.log.read_bytes()), "parser_sha256": sha(args.parser.read_bytes()),
                "bundle": str(args.bundle.resolve()), "delivered_arm": delivered,
                "delivered_source_match": True, "calls": call_receipts,
                "original_smoke": smoke, "snapshots": {}}
    for arm, files in snapshots.items():
        for name, data in files.items():
            dst = args.out / arm / name
            dst.parent.mkdir(parents=True, exist_ok=True)
            dst.write_bytes(data)
        manifest["snapshots"][arm] = {name: sha(data) for name, data in sorted(files.items())}
    (args.out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"out": str(args.out), "arms": list(snapshots), "delivered": delivered,
                      "verified_source_files": len(snapshots[delivered])}))


if __name__ == "__main__":
    main()
