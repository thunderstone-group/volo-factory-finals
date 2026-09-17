#!/usr/bin/env python3
"""Explicit reproducible V3 ZIP; no change to any historical/default package."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
FILES = {'main.py': 'oneshot/v3/main.py', 'requirements.txt': 'oneshot/requirements.txt'}
for name in ('main.py', 'platform_entry.py', 'effort_entry.py', 'minimal_feedback.py', 'skill_repair.py', 'business_feedback.py', 'business_probe.spec.cjs',
             'v1/main.py', 'v1/dialect.md', 'v2/main.py', 'v2/interaction.js', 'v2/navigation.js',
             'v3/__init__.py', 'v3/entry.py', 'v3/planner.py', 'v3/observer.py', 'v3/launch.py', 'v3/runner.cjs',
             'skills/index.json', 'skills/interface-contract/SKILL.md', 'skills/ready-navigation/SKILL.md',
             'skills/state-roundtrip/SKILL.md'):
    FILES['oneshot/'+name] = 'oneshot/'+name


def build(output):
    output = Path(output)
    manifest_path = Path(str(output)+'.manifest.json')
    if output.exists() or output.is_symlink() or manifest_path.exists() or manifest_path.is_symlink():
        raise ValueError('package_outputs_must_be_new')
    blobs = {}
    for name, source in sorted(FILES.items()):
        path = ROOT/source
        if any(p.is_symlink() for p in (path, *[p for p in path.parents if p != ROOT and ROOT in p.parents])):
            raise ValueError('package_source_symlink')
        if not path.is_file() or path.stat().st_size > 256*1024:
            raise ValueError('invalid_package_source')
        blobs[name] = path.read_bytes()
    # Explicit package markers prevent ambient packages from hijacking namespace imports.
    for name in ('oneshot/__init__.py', 'oneshot/v1/__init__.py', 'oneshot/v2/__init__.py'):
        blobs[name] = b''
    index = json.loads(blobs['oneshot/skills/index.json'])
    for row in index['skills']:
        if hashlib.sha256(blobs['oneshot/skills/'+row['path']]).hexdigest() != row['body_sha256']:
            raise ValueError('skill_hash_mismatch')
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', compression=zipfile.ZIP_STORED) as z:
        for name, blob in sorted(blobs.items()):
            info = zipfile.ZipInfo(name, (2026, 9, 17, 0, 0, 0))
            info.create_system = 3; info.external_attr = 0o100644 << 16
            z.writestr(info, blob)
    data = buf.getvalue()
    manifest = {'candidate': 'minimal-v3-experimental', 'package_sha256': hashlib.sha256(data).hexdigest(),
                'package_bytes': len(data), 'files': {name: {'source': FILES.get(name, 'empty-package-marker'),
                    'sha256': hashlib.sha256(blob).hexdigest()} for name, blob in sorted(blobs.items())}}
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open('xb') as f:
        f.write(data)
    with manifest_path.open('x') as f:
        json.dump(manifest, f, sort_keys=True, indent=2); f.write('\n')
    return manifest


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--output', required=True, type=Path)
    print(json.dumps(build(p.parse_args().output), indent=2))
