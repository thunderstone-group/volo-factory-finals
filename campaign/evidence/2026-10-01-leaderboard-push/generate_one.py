"""Run one exact packaged candidate with one named official model on the separate practice key."""
import argparse
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import time
import zipfile
from pathlib import Path

sys.path.insert(0, '~/projects/volo-factory-worktrees/behavior-coverage-20261001')
from scripts.repair_replay import gateway_key

p = argparse.ArgumentParser()
p.add_argument('--package', type=Path, required=True)
p.add_argument('--task', choices=['github', 'sheet'], required=True)
p.add_argument('--model', required=True)
p.add_argument('--out', type=Path, required=True)
a = p.parse_args()
a.out.mkdir(exist_ok=False)
with zipfile.ZipFile(a.package) as z:
    z.extractall(a.out/'agent')
env = dict(os.environ)
for k in list(env):
    if k.startswith('ONESHOT_'):
        del env[k]
env.update(OPENAI_API_KEY=REDACTED'~/.config/arcbench/volo.env'),
           OPENAI_BASE_URL='https://api.arc-bench.com/v1', MODEL=a.model)
cache = Path(tempfile.gettempdir())
env['NODE_PATH'] = os.pathsep.join(str(cache/x/'node_modules') for x in ['oneshot-playwright-test-1.57.0','oneshot-jsdom'])
req = Path('~/projects/arcbench-campaign/evidence/2026-09-24-hackathon-v2/requirements')/('hackathon--'+a.task)
record = {'task':a.task,'model':a.model,'package_sha256':hashlib.sha256(a.package.read_bytes()).hexdigest()}
started = time.monotonic()
with (a.out/'stdout.log').open('w') as out, (a.out/'stderr.log').open('w') as err:
    child = subprocess.Popen(['~/projects/volo-factory/.venv/bin/python',str(a.out/'agent/main.py'),str(req),
                              '--output-dir',str(a.out/'application')],cwd=a.out,env=env,stdout=out,stderr=err)
    (a.out/'process.json').write_text(json.dumps(dict(record,pid=child.pid),indent=2))
    code = child.wait()
record.update(exit=code,seconds=round(time.monotonic()-started,1))
(a.out/'finished.json').write_text(json.dumps(record,indent=2))
print(json.dumps(record),flush=True)
raise SystemExit(0 if code==0 else 1)
