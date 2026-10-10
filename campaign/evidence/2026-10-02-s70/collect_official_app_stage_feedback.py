"""Evaluate one immutable official application across stages, without regeneration."""
import hashlib
import json
import os
import subprocess
import time
from pathlib import Path

from arcbench_cli.client import load_env
from arcbench_cli.selftest import SelftestClient, TERMINAL

HERE = Path(__file__).resolve().parent
OUT = HERE / 'official-github-refreshed'
APP = OUT / 'official-github-46-app.zip'
ENV = Path('~/.config/arcbench/volo.env')
EXPECTED = 'e4d684922f6d0494e67f6f826f7612be9f24fe85df53ed451c38dfe0620bb178'
assert hashlib.sha256(APP.read_bytes()).hexdigest() == EXPECTED
client = SelftestClient.from_env(load_env(ENV))
first_id = 'f043daea-9f43-4c6b-898c-067695e4a6a0'
(OUT / 'stage-feedback-process.json').write_text(json.dumps({'pid': os.getpid(), 'first_id': first_id}))
deadline = time.monotonic() + 1800
while True:
    first = client.submission(first_id)
    if first.get('status') in TERMINAL:
        break
    if time.monotonic() >= deadline:
        raise SystemExit('Observation deadline; existing self-test left unchanged. Do not re-upload.')
    time.sleep(20)
(OUT / 'stage-1-observed-terminal.json').write_text(json.dumps(client.safe(first), indent=2))
if first.get('status') not in {'passed', 'failed'} or not (first.get('result') or {}).get('total'):
    raise SystemExit('Stage 1 did not return a quality result; inspect before further uploads.')
results = [{'stage': 1, 'id': first_id, 'passed': first['result']['passed'], 'total': first['result']['total']}]
print(json.dumps(results[-1]), flush=True)
for stage in (2, 3):
    result_path = OUT / f'stage-{stage}-result.json'
    if result_path.exists():
        raise SystemExit(f'{result_path} exists; inspect/resume its id, never submit twice.')
    assert hashlib.sha256(APP.read_bytes()).hexdigest() == EXPECTED
    cmd = ['arcbench', '--env-file', str(ENV), 'selftest', 'submit', str(APP), '--task',
           f'github-stage-{stage}-req-test', '--wait', '--poll-interval', '20', '--poll-timeout', '1800',
           '--output', str(result_path), '--json']
    with (OUT / f'stage-{stage}-submit.jsonl').open('x') as log:
        process = subprocess.run(cmd, stdout=log)
    if process.returncode not in (0, 1) or not result_path.exists():
        raise SystemExit(f'Stage {stage} outcome uncertain; inspect existing checkpoint, never re-upload.')
    result = json.loads(result_path.read_text())
    quality = result.get('result') or {}
    if result.get('status') not in {'passed', 'failed'} or not quality.get('total'):
        raise SystemExit(f'Stage {stage} has no quality result; inspect before another upload.')
    results.append({'stage': stage, 'id': result['id'], 'passed': quality['passed'], 'total': quality['total']})
    print(json.dumps(results[-1]), flush=True)
(OUT / 'stage-feedback-summary.json').write_text(json.dumps({
    'immutable_app_sha256': EXPECTED, 'official_full_github_passed': 46, 'stages': results,
    'total_stage_passed': sum(r['passed'] for r in results),
    'scope': 'Same completed official app, three diagnostic stages; not formal staged-route scores.'
}, indent=2))
