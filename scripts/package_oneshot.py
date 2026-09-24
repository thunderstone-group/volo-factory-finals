#!/usr/bin/env python3
"""Build the isolated candidate from the allowlisted files plus the scaffold directory; no imports or network."""
import argparse
import hashlib
import io
import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "oneshot"
FILES = ("main.py", "dialect.md", "requirements.txt", "semantic_probe.cjs", "scenarios.py", "scenario_translate.py",
         "scenario_check.py", "scenario_check.cjs", "testgen.py")


def scaffold_files(source=SOURCE):
    """Every regular file under <source>/scaffold, shipped beside main.py so the generator can place it."""
    root = Path(source) / "scaffold"
    if root.is_symlink() or not root.is_dir():
        return ()
    return tuple(sorted(p.relative_to(source).as_posix() for p in root.rglob("*")
                        if p.is_file() and not p.is_symlink() and not p.name.startswith(".")))


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def build_package(output, source=SOURCE):
    source, output = Path(source), Path(output)
    blobs = {}
    for name in FILES + scaffold_files(source):
        path = source / name
        if source.is_symlink() or path.is_symlink() or not path.is_file():
            raise ValueError(f"package source must be a regular file: {name}")
        blobs[name] = path.read_bytes()
        if not blobs[name].strip():
            raise ValueError(f"empty package source: {name}")
    files = {name: {"sha256": sha256(data), "bytes": len(data)} for name, data in blobs.items()}
    # Hash the exact source inventory independently from ZIP container metadata.
    canonical = json.dumps(files, sort_keys=True, separators=(",", ":")).encode("utf-8")
    manifest = {"schema_version": 1, "source_sha256": sha256(canonical),
                "source_hash_scheme": "sha256 of UTF-8 JSON files object; sorted keys; compact separators",
                "files": files}
    provenance = source / "source_manifest.json"
    if provenance.is_symlink():
        raise ValueError("source provenance must not be a symlink")
    manifest["imported_from"] = json.loads(provenance.read_text(encoding="utf-8"))
    buffer = io.BytesIO()
    # Stored entries avoid compression-version differences as well as timestamp drift.
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_STORED) as archive:
        for name in FILES + scaffold_files(source):
            info = zipfile.ZipInfo(name, date_time=(2026, 9, 16, 0, 0, 0))
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            info.compress_type = zipfile.ZIP_STORED
            archive.writestr(info, blobs[name])
    package = buffer.getvalue()
    manifest["package_sha256"] = sha256(package)
    manifest["package_bytes"] = len(package)
    manifest_path = output.with_suffix(output.suffix + ".manifest.json")
    inputs = {(source / name).resolve() for name in (*FILES, *scaffold_files(source), "source_manifest.json")}
    for path in (output, manifest_path):
        if path.is_symlink() or path.resolve() in inputs:
            raise ValueError("package output must not overwrite or link to source files")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(package)
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return manifest


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=SOURCE / "dist" / "oneshot.zip")
    args = parser.parse_args(argv)
    manifest = build_package(args.output)
    print(args.output)
    print("sha256=" + manifest["package_sha256"])
    print(args.output.with_suffix(args.output.suffix + ".manifest.json"))


if __name__ == "__main__":
    main()
