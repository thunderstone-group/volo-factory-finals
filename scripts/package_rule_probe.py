#!/usr/bin/env python3
"""Make an explicit diagnostic ZIP from a frozen, already validated agent ZIP."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile


ROOT = Path(__file__).resolve().parents[1]


def replace_once(content, old, new):
    if content.count(old) != 1:
        raise ValueError('Base archive does not match the reviewed probe insertion point: ' + old[:60])
    return content.replace(old, new, 1)


def build(base, output):
    if output.exists():
        raise ValueError('Probe output already exists; preserve it and choose a new path')
    with zipfile.ZipFile(base) as archive:
        if len(archive.namelist()) != len(set(archive.namelist())):
            raise ValueError('Duplicate base archive member')
        files = {name: archive.read(name) for name in archive.namelist()}
    main = replace_once(files['main.py'].decode(), '    trace = Trace(output / ".factory")\n',
                        '    trace = Trace(output / ".factory")\n'
                        '    from volo.runner_rules_probe import capture_agent_rules\n'
                        '    capture_agent_rules(trace.directory)\n')
    runtime = replace_once(files['volo/web_runtime.py'].decode(), 'import json\n',
                           'import json\nfrom volo.runner_rules_probe import SOURCE as RULE_PROBE_SOURCE\n')
    runtime = replace_once(runtime, 'SERVER = r"""const http',
                           'SERVER = r"""require(\'./runner_rules_probe.cjs\').watch('
                           'require(\'node:path\').resolve(__dirname, \'../.factory/runner-rules-server.json\'));\nconst http')
    runtime = replace_once(runtime, '    workspace.write_files([\n',
                           '    workspace.write_files([\n'
                           '        {"path": "backend/runner_rules_probe.cjs", "content": RULE_PROBE_SOURCE},\n')
    files.update({'main.py': main.encode(), 'volo/web_runtime.py': runtime.encode(),
                  'volo/runner_rules_probe.py': (ROOT / 'harness_lab/runner_rules_probe.py').read_bytes()})
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, 'x', compression=zipfile.ZIP_DEFLATED) as archive:
        for name, content in sorted(files.items()):
            info = zipfile.ZipInfo(name, date_time=(2026, 9, 12, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            archive.writestr(info, content)
    return {'base_sha256': hashlib.sha256(base.read_bytes()).hexdigest(),
            'probe_sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
            'probe_archive': str(output.resolve()),
            'modified_members': ['main.py', 'volo/web_runtime.py'],
            'added_members': ['volo/runner_rules_probe.py']}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(build(args.base, args.output), indent=2))
