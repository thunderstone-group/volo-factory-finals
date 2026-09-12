"""Read-only, source-pinned public examples of the evaluator's UI contract.

These are model inputs, not executed acceptance evidence. Never discover tests
from runner mounts or generated applications: only the explicitly bundled files
for an exact requirement fingerprint are eligible.
"""
import hashlib
import json
from pathlib import Path

from .acceptance import relative_file


ROOT = Path(__file__).resolve().parent / 'public_specs'


def load_public_specs(requirement_fingerprint, root=ROOT):
    root = Path(root).resolve()
    manifest = json.loads((root / 'manifest.json').read_text())
    entries = [entry for entry in manifest if entry['requirement_fingerprint'] == requirement_fingerprint]
    if not entries:
        return None
    if len(entries) != 1:
        raise ValueError('Ambiguous public test source for these requirements')
    entry = entries[0]
    files = {}
    total = 0
    for name, expected in entry['files'].items():
        path = relative_file(root, name)
        raw = path.read_bytes()
        total += len(raw)
        if total > 100000 or hashlib.sha256(raw).hexdigest() != expected:
            raise ValueError('Public test source changed or exceeded its size bound: ' + name)
        files[name] = raw.decode('utf-8')
    if not files:
        raise ValueError('Public test source has no files')
    return {'source': entry['source'], 'files': files,
            'instruction': 'Read these unchanged, publicly supplied specifications and helpers before '
                           'implementing. They make routes, visible text, accessible names, input values '
                           'and action order explicit. Implement the required real product behavior. '
                           'Do not alter the specifications or mistake reading them for passing them. '
                           'They may cover only part of the written requirements.',
            'executed': False, 'official_evaluation': 'not_performed'}
