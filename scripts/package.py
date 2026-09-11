#!/usr/bin/env python3
"""Make a deterministic, credential-free ArcBench upload from an explicit allowlist."""
import hashlib
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FILES = [ROOT / "main.py", ROOT / "requirements.txt", *sorted((ROOT / "volo").glob("*.py")),
         *sorted((ROOT / "volo/vendor").glob("*"))]
DEST = ROOT / "dist" / "volo-factory.zip"
DEST.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(DEST, "w", compression=zipfile.ZIP_DEFLATED) as archive:
    for source in FILES:
        info = zipfile.ZipInfo(source.relative_to(ROOT).as_posix(), date_time=(2026, 9, 11, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        archive.writestr(info, source.read_bytes())
print(DEST)
print("sha256=" + hashlib.sha256(DEST.read_bytes()).hexdigest())
