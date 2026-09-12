#!/usr/bin/env python3
"""Build the explicitly labeled public-answer security control; never the normal ZIP."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile


ROOT = Path(__file__).resolve().parents[1]


def build(base, output):
    if output.exists():
        raise ValueError('Output exists; preserve the previous audit package')
    with zipfile.ZipFile(base) as archive:
        names = archive.namelist()
        if len(names) != len(set(names)):
            raise ValueError('Duplicate archive members')
        files = {name: archive.read(name) for name in names}
    files['main.py'] = ("from volo.public_answer_baseline import main\n"
                        "if __name__ == '__main__':\n    raise SystemExit(main())\n").encode()
    files['volo/public_answer_baseline.py'] = (ROOT / 'harness_lab/public_answer_baseline.py').read_bytes()
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, 'x', compression=zipfile.ZIP_DEFLATED) as archive:
        for name, content in sorted(files.items()):
            item = zipfile.ZipInfo(name, date_time=(2026, 9, 12, 0, 0, 0))
            item.compress_type = zipfile.ZIP_DEFLATED
            item.external_attr = 0o644 << 16
            archive.writestr(item, content)
    return {'purpose': 'authorized_security_reproduction', 'method': 'fixed_public_answers',
            'base_sha256': hashlib.sha256(base.read_bytes()).hexdigest(),
            'archive_sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
            'archive': str(output.resolve()), 'modified_members': ['main.py'],
            'added_members': ['volo/public_answer_baseline.py']}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(build(args.base, args.output), indent=2))
