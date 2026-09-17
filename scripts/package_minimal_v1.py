"""Package opt-in V1; the default V0 packager and ZIP remain unchanged."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
FILES = {"main.py": "oneshot/v1/main.py", "core.py": "oneshot/main.py",
         "dialect.md": "oneshot/v1/dialect.md", "requirements.txt": "oneshot/requirements.txt"}


def build(output, *, files=FILES, candidate='minimal-v1'):
    output = Path(output)
    blobs = {}
    for name, relative in files.items():
        path = ROOT / relative
        if path.is_symlink() or not path.is_file():
            raise ValueError("invalid package source: " + relative)
        blobs[name] = path.read_bytes()
    if output.is_symlink() or output.resolve() in {(ROOT / p).resolve() for p in files.values()}:
        raise ValueError("output overlaps source")
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_STORED) as archive:
        for name, data in blobs.items():
            info = zipfile.ZipInfo(name, (2026, 9, 16, 0, 0, 0))
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            archive.writestr(info, data)
    data = buffer.getvalue()
    manifest = {"candidate": candidate, "package_sha256": hashlib.sha256(data).hexdigest(),
                "files": {n: {"source": files[n], "sha256": hashlib.sha256(b).hexdigest()} for n, b in blobs.items()}}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(data)
    output.with_suffix(".zip.manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    return manifest


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    print(json.dumps(build(parser.parse_args().output), indent=2))
