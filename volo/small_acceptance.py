"""Load calibrated, bundled public checks for exact small-task input versions."""
import json
from pathlib import Path

from .acceptance import AcceptanceSuite, digest, relative_file


ROOT = Path(__file__).resolve().parent / 'small_acceptance'


def load_small_acceptance(requirements, application_root, root=ROOT):
    root = Path(root).resolve()
    entries = [entry for entry in json.loads((root / 'sources.json').read_text())
               if entry['requirement_fingerprint'] == requirements.fingerprint]
    if not entries:
        return None
    if len(entries) != 1:
        raise ValueError('Ambiguous bundled acceptance for these requirements')
    entry = entries[0]
    folder = relative_file(root, entry['task'])
    for name, expected in entry['files'].items():
        if digest(relative_file(folder, name).read_bytes()) != expected:
            raise ValueError('Bundled public specification changed: ' + name)
    suite = AcceptanceSuite(folder / 'contract.json', application_root,
                            requirements.fingerprint, [node['id'] for node in requirements.nodes])
    if {req for case in suite.cases for req in case['requirements']} != set(suite.requirement_ids):
        raise ValueError('Bundled acceptance does not cover every input requirement')
    suite.bundled_task = entry['task']
    return suite
