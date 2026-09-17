#!/usr/bin/env python3
"""Frozen thin-source-v1 package; explicit allowlist, no historical ZIP overwrite."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
FILES = {'main.py': 'oneshot/thin/main.py', 'requirements.txt': 'oneshot/requirements.txt'}
for name in ('main.py', 'platform_entry.py', 'effort_entry.py', 'minimal_feedback.py',
             'business_feedback.py', 'skill_repair.py', 'v1/main.py', 'v1/dialect.md',
             'v2/main.py', 'v2/interaction.js', 'v2/navigation.js',
             'thin/__init__.py', 'thin/entry.py', 'thin/checks.py', 'thin/review.py',
             'skills/index.json', 'skills/interface-contract/SKILL.md',
             'skills/ready-navigation/SKILL.md', 'skills/state-roundtrip/SKILL.md'):
    FILES['oneshot/'+name] = 'oneshot/'+name


def build(output):
    output = Path(output)
    manifest_path = Path(str(output)+'.manifest.json')
    if any(p.exists() or p.is_symlink() for p in (output, manifest_path)):
        raise ValueError('new_package_paths_required')
    blobs = {}
    for name, source in sorted(FILES.items()):
        path = ROOT/source
        if any(p.is_symlink() for p in (path, *path.parents)) or not path.is_file() or path.stat().st_size > 256*1024:
            raise ValueError('unsafe_package_source')
        blobs[name] = path.read_bytes()
    for name in ('oneshot/__init__.py', 'oneshot/v1/__init__.py', 'oneshot/v2/__init__.py'):
        blobs[name] = b''
    index = json.loads(blobs['oneshot/skills/index.json'])
    for item in index['skills']:
        if hashlib.sha256(blobs['oneshot/skills/'+item['path']]).hexdigest() != item['body_sha256']:
            raise ValueError('skill_hash_mismatch')
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w', compression=zipfile.ZIP_STORED) as archive:
        for name, blob in sorted(blobs.items()):
            info = zipfile.ZipInfo(name, (2026, 9, 17, 0, 0, 0))
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            archive.writestr(info, blob)
    data = buffer.getvalue()
    manifest = {'candidate': 'thin-source-v1', 'model': 'deepseek-v4-flash',
                'scope': 'source_review_and_syntax_feedback_not_browser',
                'package_sha256': hashlib.sha256(data).hexdigest(), 'package_bytes': len(data),
                'files': {n: {'source': FILES.get(n, 'empty-package-marker'),
                              'sha256': hashlib.sha256(b).hexdigest()} for n, b in blobs.items()}}
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open('xb') as stream:
        stream.write(data)
    with manifest_path.open('x') as stream:
        json.dump(manifest, stream, indent=2)
        stream.write('\n')
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, type=Path)
    print(json.dumps(build(parser.parse_args().output), indent=2))
