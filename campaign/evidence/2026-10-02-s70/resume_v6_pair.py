"""Continue the frozen v6 applications with bounded standard repairs, without regenerating drafts."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time

ROOT = Path('~/projects/volo-factory')
HERE = Path(__file__).resolve().parent
CASES = [('github', 'v6-transport-recovery-github'),
         ('sheet', 'generate-semantic-entry-v6-sheet')]

for task, source in CASES:
    output = HERE / ('v6-resumed-' + task)
    if output.exists():
        raise SystemExit('Refusing to overwrite ' + str(output))
    env = dict(os.environ, ONESHOT_REPAIR_CALLS='2', FALLBACK_MODEL='')
    cache = Path(tempfile.gettempdir())
    env['NODE_PATH'] = os.pathsep.join(str(cache / name / 'node_modules')
        for name in ['oneshot-playwright-test-1.57.0', 'oneshot-jsdom'])
    command = ['uv', 'run', '--python', '3.12', '--no-project', 'python',
        'scripts/repair_replay.py', '--requirements',
        str(HERE / ('requirements-after-stage-announcement/hackathon--' + task) / 'requirements.yaml'),
        '--app', str(HERE / source / 'application'), '--suite', str(HERE / ('v6-frozen-suite-' + task)),
        '--out', str(output), '--model', 'deepseek-v4-flash-vision-exp', '--repair-cny', '1.5']
    started = time.monotonic()
    with (HERE / ('v6-resumed-' + task + '.log')).open('w') as log:
        process = subprocess.Popen(command, cwd=ROOT, env=env, stdout=log, stderr=log)
        (HERE / 'v6-resume-active.json').write_text(json.dumps({'task': task, 'pid': process.pid,
            'source': source, 'output': str(output), 'repair_call_limit': 2,
            'estimated_repair_cny_limit': 1.5, 'fallback_disabled': True}) + '\n')
        code = process.wait()
    path = output / 'repair.json'
    record = json.loads(path.read_text()) if path.exists() else {}
    usage = record.get('summary', {})
    summary = {'task': task, 'exit': code, 'seconds': round(time.monotonic() - started, 1),
        'error': record.get('error'), 'usage': usage,
        'counts': record.get('smoke', {}).get('scenarios_after', {}).get('counts')}
    (HERE / ('v6-resumed-' + task + '-finished.json')).write_text(json.dumps(summary, indent=2) + '\n')
    print(json.dumps(summary), flush=True)
    if code or (usage.get('failed_calls') and not usage.get('completed_calls')):
        print('Stopped before scheduling another task after a wholly failed recovery.', flush=True)
        break
