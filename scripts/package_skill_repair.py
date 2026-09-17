#!/usr/bin/env python3
"""Reproducible standalone skill-repair ZIP; no legacy modules, prompts or runs.

python -B scripts/package_skill_repair.py --output /NEW/PATH/skill-repair.zip
Extract, then run python -B skill_repair.py --help. Standard library only.
Both ZIP and adjacent manifest must be new files. No source imports or network.
"""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import stat
import zipfile

ROOT = Path(__file__).resolve().parents[1]
FILES = {"skill_repair.py": "oneshot/skill_repair.py", "skills/index.json": "oneshot/skills/index.json"}
for _id in ("interface-contract", "ready-navigation", "state-roundtrip"):
    FILES[f"skills/{_id}/SKILL.md"] = f"oneshot/skills/{_id}/SKILL.md"


def _path(path):
    path = Path(os.path.abspath(path))
    if any(p.is_symlink() for p in (path, *path.parents)):
        raise ValueError("package paths must not contain symlinks")
    return path


def build_package(output, root=ROOT):
    root, output = _path(root), _path(output)
    manifest_path = _path(str(output) + ".manifest.json")
    if root == output or root in output.parents or output in root.parents:
        raise ValueError("package output must be outside source tree")
    for path in (output, manifest_path):
        if path.exists() or not path.parent.is_dir():
            raise ValueError("package outputs must be new files with existing parents")
    blobs = {}
    for name, relative in FILES.items():
        path = _path(root / relative)
        with os.fdopen(os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK), "rb") as stream:
            info = os.fstat(stream.fileno())
            if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_size > 256 * 1024:
                raise ValueError("invalid package source")
            data = stream.read(256 * 1024 + 1)
        if not data or len(data) > 256 * 1024:
            raise ValueError("invalid package source size")
        blobs[name] = data
    index = json.loads(blobs["skills/index.json"])
    rows = index["skills"]
    expected = {name.removeprefix("skills/") for name in blobs if name.endswith("SKILL.md")}
    if len(rows) != 3 or {row["path"] for row in rows} != expected:
        raise ValueError("invalid skill inventory")
    for row in rows:
        if hashlib.sha256(blobs["skills/" + row["path"]]).hexdigest() != row["body_sha256"]:
            raise ValueError("skill body hash mismatch")
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_STORED) as archive:
        for name in sorted(blobs):
            info = zipfile.ZipInfo(name, (2026, 9, 17, 0, 0, 0))
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            info.compress_type = zipfile.ZIP_STORED
            archive.writestr(info, blobs[name])
    data = buffer.getvalue()
    manifest = {"candidate": "skill-repair-opt-in", "package_sha256": hashlib.sha256(data).hexdigest(),
                "package_bytes": len(data), "files": {name: {"bytes": len(blob),
                "sha256": hashlib.sha256(blob).hexdigest()} for name, blob in sorted(blobs.items())}}
    # Exclusive opens never overwrite old artifacts, including hardlink aliases.
    with output.open("xb") as stream:
        stream.write(data)
    with manifest_path.open("x", encoding="utf-8") as stream:
        stream.write(json.dumps(manifest, sort_keys=True, indent=2) + "\n")
    return manifest


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    print(json.dumps(build_package(parser.parse_args().output), indent=2))
