"""Observe the existing GitHub run, then start Sheet once; use only arcbench-cli."""
import json
from pathlib import Path
import subprocess
import time

HERE = Path(__file__).resolve().parent
CLI = ['~/.local/bin/arcbench', '--env-file', '~/.config/arcbench/volo.env', '--json']
SUBMISSION = '12e3bab723fd'
TERMINAL = {'PASSED', 'FAILED', 'CANCELLED', 'ERROR'}
starts = json.loads((HERE / 'v7-official-start-github.jsonl').read_text())
(HERE / 'v7-official-start.jsonl').write_text(json.dumps(starts) + '\n')

def call(args, timeout=100):
    result = subprocess.run(CLI + args, capture_output=True, text=True, timeout=timeout)
    try:
        data = json.loads(result.stdout)
    except ValueError:
        data = None
    return result, data

def wait_for(run_id, task):
    deadline, previous, errors = time.monotonic() + 10800, None, 0
    while time.monotonic() < deadline:
        try:
            result, data = call(['status', run_id])
        except subprocess.TimeoutExpired:
            result, data = None, None
        if isinstance(data, dict) and data.get('run_id') == run_id and data.get('status'):
            errors = 0
            (HERE / ('v7-official-' + task + '-latest.json')).write_text(json.dumps(data, indent=2) + '\n')
            signature = (data['status'], data.get('passed'), data.get('failed'),
                         tuple((s.get('key'), s.get('status')) for s in data.get('steps', [])))
            if signature != previous:
                print(json.dumps({'task': task, 'run_id': run_id, 'status': data['status'],
                    'passed': data.get('passed'), 'failed': data.get('failed'),
                    'steps': signature[-1]}), flush=True)
                previous = signature
            if data['status'] in TERMINAL:
                (HERE / ('v7-official-' + task + '-result.json')).write_text(json.dumps(data, indent=2) + '\n')
                return data
        else:
            errors += 1
            with (HERE / 'v7-official-read-errors.log').open('a') as log:
                log.write((result.stderr if result else 'status observation timed out') + '\n')
            if errors in (1, 3, 10):
                print(json.dumps({'task': task, 'run_id': run_id, 'read_errors': errors,
                    'action': 'recheck the same run; no new submission'}), flush=True)
        time.sleep(30)
    raise SystemExit('Observation deadline elapsed; retain and inspect the same run id ' + run_id)

wait_for('c5e4493bad81', 'github')
result, data = call(['run', SUBMISSION, '--task', 'hackathon--sheet', '--queue-timeout', '600'], timeout=700)
(HERE / 'v7-official-start-sheet.jsonl').write_text(result.stdout)
if not isinstance(data, list) or not data or not data[0].get('run_id'):
    # The write may have succeeded despite a lost response. Look up this submission,
    # never repeat the write on an uncertain outcome.
    _, existing = call(['runs', '--submission', SUBMISSION, '--task', 'hackathon--sheet', '--limit', '10'])
    if not isinstance(existing, list) or len(existing) != 1 or not existing[0].get('run_id'):
        raise SystemExit('Sheet start is uncertain; inspect this submission before another write')
    data = [{'task': 'hackathon--sheet', 'run_id': existing[0]['run_id'], 'recovered_receipt': True}]
starts.extend(data)
(HERE / 'v7-official-start.jsonl').write_text(json.dumps(starts, indent=2) + '\n')
print(json.dumps({'task': 'sheet', 'run_id': data[0]['run_id'], 'started': True}), flush=True)
wait_for(data[0]['run_id'], 'sheet')
print(json.dumps({'submission_id': SUBMISSION, 'pair_terminal': True}), flush=True)
