"""Local transport adapter only; imported packaged agent remains byte-identical.

Preserves HTTPS origin/request bytes and records every attempt. Not shipped.
"""
import contextlib
import hashlib
import itertools
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit

agent = Path(sys.argv[1]).resolve()
root = agent.parent
sys.path.insert(0, str(agent))
import main as adapter

counter = itertools.count(1)
@contextlib.contextmanager
def direct_open(req, timeout):
    origin = urlsplit(req.full_url)
    if origin.scheme != 'https' or origin.hostname != 'api.arc-bench.com':
        raise ValueError('Unexpected model gateway')
    number = next(counter)
    record = {'attempt':number,'request_sha256':hashlib.sha256(req.data).hexdigest(),
              'request_bytes':len(req.data),'started_at':time.time(),
              'interface':'en0','http_version':'1.1','resolved_ip':'189.1.235.72'}
    destination = root / ('transport-%03d.json' % number)
    destination.write_text(json.dumps(record,indent=2))
    with tempfile.TemporaryDirectory(prefix='arc-v8-stream-') as td:
        body,response = Path(td)/'request.json',Path(td)/'response.sse'
        body.touch(mode=0o600);body.write_bytes(req.data);response.touch(mode=0o600)
        config=''.join('header = '+json.dumps(k+': '+v)+'\n' for k,v in req.header_items())
        command=['curl','--silent','--show-error','--http1.1','--no-buffer',
                 '--interface','en0','--resolve','api.arc-bench.com:443:189.1.235.72',
                 '--connect-timeout','20','--max-time',str(timeout),'--request','POST',
                 '--config','-','--data-binary','@'+str(body),'--output',str(response),
                 '--write-out','%{http_code}',req.full_url]
        started=time.monotonic()
        result=subprocess.run(command,input=config.encode(),capture_output=True)
        status=int(result.stdout.strip()) if result.stdout.strip().isdigit() else 0
        record.update(http_status=status,curl_exit=result.returncode,
                      seconds=round(time.monotonic()-started,3),received_bytes=response.stat().st_size)
        destination.write_text(json.dumps(record,indent=2))
        if status>=400:raise HTTPError(req.full_url,status,'gateway HTTP failure',None,None)
        with response.open('rb') as stream:yield stream
        if result.returncode:raise URLError('curl transport exit '+str(result.returncode))

adapter._open_model=direct_open
sys.argv=[str(agent/'main.py')]+sys.argv[2:]
raise SystemExit(adapter.main())
