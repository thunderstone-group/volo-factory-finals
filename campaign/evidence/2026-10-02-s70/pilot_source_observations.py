"""Bounded live source-review control on the completed own app, using public diagnostics."""
import contextlib
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit

ROOT = Path('~/projects/volo-factory-worktrees/repair-evidence-20261003')
HERE = Path(__file__).resolve().parent
OUT = HERE / 'v8-source-observations-sheet'
OUT.mkdir(exist_ok=False)
sys.path.insert(0, str(ROOT))
from oneshot import main as adapter, source_contracts as contracts
sys.path.insert(0, str(ROOT / 'scripts'))
from repair_replay import gateway_key

records = []
@contextlib.contextmanager
def direct_open(req, timeout):
    if len(records) >= 2:
        raise RuntimeError('Two actual requests only; retain partial evidence on failure')
    url = urlsplit(req.full_url)
    if url.scheme != 'https' or url.hostname != 'api.arc-bench.com':
        raise ValueError('Unexpected gateway')
    record = {'request_sha256': hashlib.sha256(req.data).hexdigest(), 'request_bytes': len(req.data)}
    records.append(record)
    with tempfile.TemporaryDirectory(prefix='arc-source-control-') as td:
        body, output = Path(td)/'request.json', Path(td)/'response.sse'
        body.touch(mode=0o600); body.write_bytes(req.data); output.touch(mode=0o600)
        config = ''.join('header = '+json.dumps(k+': '+v)+'\n' for k,v in req.header_items())
        command = ['curl','--silent','--show-error','--http1.1','--no-buffer',
                   '--interface','en0','--resolve','api.arc-bench.com:443:189.1.235.72',
                   '--connect-timeout','20','--max-time',str(timeout), '--request','POST',
                   '--config','-','--data-binary','@'+str(body),'--output',str(output),
                   '--write-out','%{http_code}',req.full_url]
        started=time.monotonic()
        result=subprocess.run(command,input=config.encode(),capture_output=True)
        status=int(result.stdout.strip()) if result.stdout.strip().isdigit() else 0
        record.update(http_status=status,curl_exit=result.returncode,seconds=round(time.monotonic()-started,2),bytes=output.stat().st_size)
        (OUT/'transport.json').write_text(json.dumps(records,indent=2))
        if status>=400: raise HTTPError(req.full_url,status,'gateway error',None,None)
        with output.open('rb') as stream: yield stream
        if result.returncode: raise URLError('curl exit '+str(result.returncode))

adapter._open_model=direct_open
key=gateway_key('~/.config/arcbench/volo.env')
budget=adapter.CallBudget(repair_limit=2,fail_limit=1,repair_cny=2)
budget.phase='repair'
budget.progress_path=OUT/'progress.json'
def complete(messages):
    return adapter.stream_completion(messages,'deepseek-v4-flash-vision-exp',adapter.DEFAULT_BASE,key,budget,tries=1,fallback='')

req=(HERE/'v7-official-sheet-input.yaml').read_text()
report=json.loads((HERE/'v7-official-sheet-80/g99-check/report.json').read_text())
observations=[s for s in report['scenarios'] if s['status']=='fail']
try:
    result=contracts.prepare(HERE/'v7-official-sheet-80/application',req,OUT,complete,observations=observations)
    (OUT/'control-fixed.json').write_text(json.dumps(contracts.execute(
        HERE/'v7-sheet-filter-control/application',result['probes'],req),indent=2))
    print(json.dumps({'validation':result.get('validation'), 'summary':budget.summary()},ensure_ascii=False),flush=True)
finally:
    (OUT/'usage.json').write_text(json.dumps(budget.summary(),indent=2))
    with (OUT/'trace.jsonl').open('x') as f:
        for call in budget.attempts: f.write(json.dumps(call,ensure_ascii=False).replace(key,'[REDACTED]')+'\n')
