"""Real upgrade of the failed stage template, through the frozen agent and normal repair loop."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time

ROOT=Path('~/projects/volo-factory')
sys.path.insert(0,str(ROOT))
from scripts.repair_replay import gateway_key
HERE=Path(__file__).resolve().parent
out=HERE/'v9-stage2-upgrade'
env=dict(os.environ)
for name in list(env):
    if name.startswith('ONESHOT_'):del env[name]
env.update(OPENAI_API_KEY=REDACTED'~/.config/arcbench/volo.env'),
           OPENAI_BASE_URL='https://api.arc-bench.com/v1',MODEL='deepseek-v4-flash-vision-exp')
env.pop('FALLBACK_MODEL',None)
cache=Path(tempfile.gettempdir())
env['NODE_PATH']=os.pathsep.join(str(cache/n/'node_modules') for n in ['oneshot-playwright-test-1.57.0','oneshot-jsdom'])
started=time.monotonic()
with (out/'stdout.log').open('x') as stdout,(out/'stderr.log').open('x') as stderr:
    proc=subprocess.Popen([sys.executable,str(HERE/'run_agent_direct_gateway.py'),str(out/'agent'),
        str(HERE/'requirements-after-stage-announcement/hackathon--github-stage-2'),
        '--output-dir',str(out/'application')],env=env,cwd=out,stdout=stdout,stderr=stderr)
    (out/'process.json').write_text(json.dumps({'pid':proc.pid,'started_at':time.time()}))
    result=proc.wait()
record={'exit':result,'seconds':round(time.monotonic()-started,1)}
(out/'finished.json').write_text(json.dumps(record,indent=2));print(json.dumps(record),flush=True)
