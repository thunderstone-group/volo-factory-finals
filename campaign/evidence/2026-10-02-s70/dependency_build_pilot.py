"""Two-phase architecture pilot using the exact candidate and its existing template entrypoint.

Both phases are billed and logged. The second phase receives all original requirements.
The dependency-closed projection and its validation are retained in decision.json.
No independent judge output is sent to either generation.
"""
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import time
import zipfile
from pathlib import Path

ROOT = Path('~/projects/volo-factory-worktrees/source-owners-20261002')
sys.path.insert(0, str(ROOT))
from scripts.repair_replay import gateway_key

HERE = Path(__file__).resolve().parent
OUT = HERE / 'dependency-build-pilot-github'
PACKAGE = HERE / 'candidate-diagnostics-v4b.zip'
PYTHON = '~/projects/volo-factory/.venv/bin/python'
REQS = HERE.parent / '2026-09-24-hackathon-v2/requirements/hackathon--github'
decision = json.loads((OUT / 'decision.json').read_text())
assert hashlib.sha256(PACKAGE.read_bytes()).hexdigest() == decision['package_sha256']
assert hashlib.sha256((REQS / 'requirements.yaml').read_bytes()).hexdigest() == decision['original_requirements_sha256']
assert hashlib.sha256((OUT / 'foundation-requirements/requirements.yaml').read_bytes()).hexdigest() == decision['projection_sha256']
agent = OUT / 'agent'
agent.mkdir(exist_ok=False)
with zipfile.ZipFile(PACKAGE) as archive:
    archive.extractall(agent)

env = dict(os.environ)
for name in list(env):
    if name.startswith('ONESHOT_'):
        del env[name]
env.update(OPENAI_API_KEY=REDACTED'~/.config/arcbench/volo.env'),
           OPENAI_BASE_URL='https://api.arc-bench.com/v1',
           MODEL='deepseek-v4-flash-vision-exp', FALLBACK_MODEL='',
           ONESHOT_REPAIR_CNY='2.5', ONESHOT_REPAIR_CALLS='8')
cache = Path(tempfile.gettempdir())
env['NODE_PATH'] = os.pathsep.join(str(cache / name / 'node_modules')
                                  for name in ['oneshot-playwright-test-1.57.0', 'oneshot-jsdom'])
started = time.monotonic()
records = []
final_exit = 1
for phase in ['foundation', 'complete']:
    folder = OUT / phase
    folder.mkdir(exist_ok=False)
    requirement_dir = OUT / 'foundation-requirements' if phase == 'foundation' else REQS
    target = folder / 'application' if phase == 'foundation' else OUT / 'application'
    command = [PYTHON, str(agent / 'main.py'), str(requirement_dir), '--output-dir', str(target)]
    if phase == 'complete':
        command += ['--template-dir', str(OUT / 'foundation/application')]
    phase_start = time.monotonic()
    with (folder / 'stdout.log').open('w') as stdout, (folder / 'stderr.log').open('w') as stderr:
        process = subprocess.Popen(command, cwd=folder, env=env, stdout=stdout, stderr=stderr)
        (OUT / 'process.json').write_text(json.dumps({'pid': process.pid, 'phase': phase,
            'package_sha256': decision['package_sha256']}))
        final_exit = process.wait()
    record = {'phase': phase, 'exit': final_exit, 'seconds': round(time.monotonic() - phase_start, 1)}
    for line in (folder / 'stderr.log').open():
        for kind in ['usage', 'smoke']:
            prefix = '[oneshot] ' + kind + ' '
            if line.startswith(prefix):
                record[kind] = json.loads(line[len(prefix):])
    (folder / 'finished.json').write_text(json.dumps(record, ensure_ascii=False, indent=2))
    records.append(record)
    print(json.dumps({k: v for k, v in record.items() if k != 'smoke'}, ensure_ascii=False), flush=True)
    if final_exit:
        break

summary = {'exit': final_exit, 'seconds': round(time.monotonic() - started, 1),
           'package_sha256': decision['package_sha256'], 'completed_phases': len(records),
           'estimated_cost_cny': sum(r.get('usage', {}).get('estimated_cost_cny', 0) for r in records),
           'unknown_usage_phases': [r['phase'] for r in records if r.get('usage', {}).get('unknown_usage_calls')],
           'scope': 'Complete requirements after a dependency-closed foundation; both phases counted.'}
(OUT / 'finished.json').write_text(json.dumps(summary, indent=2))
print(json.dumps(summary), flush=True)
