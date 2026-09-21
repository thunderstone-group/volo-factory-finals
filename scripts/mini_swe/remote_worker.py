"""One detached model request on the user-owned relay; credentials stay in pipes/RAM."""
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time

os.umask(0o077)
root=Path(__file__).resolve().parent
payload=json.load(sys.stdin);key=payload.pop('key');body=base64.b64decode(payload['body'])
(root/'request.json').write_bytes(body)
started=time.time()
command=['curl','-q','--silent','--show-error','--http1.1','--no-buffer','--connect-timeout','30','--max-time','1200','--max-filesize','134217728','--fail-with-body','--output',str(root/'provider.sse'),'--write-out','http_code=%{http_code} http_version=%{http_version}\n','--request',payload.get('method','POST'),'--config','-','--data-binary','@'+str(root/'request.json'),payload['url']]
with (root/'curl.stderr').open('w') as err,(root/'curl.metrics').open('w') as metrics:
 proc=subprocess.Popen(command,stdin=subprocess.PIPE,stdout=metrics,stderr=err)
 proc.stdin.write(('header = "Content-Type: application/json"\nheader = "Authorization: Bearer '+key+'"\n').encode());proc.stdin.close();key=None
 (root/'pid.json').write_text(json.dumps({'worker_pid':os.getpid(),'curl_pid':proc.pid}))
 code=proc.wait()
meta=(root/'curl.metrics').read_text()
parsed_metrics=re.search(r'http_code=(\d+) http_version=(\S*)',meta)
raw=root/'provider.sse';sha=hashlib.sha256()
if raw.exists():
 with raw.open('rb') as stream:
  for chunk in iter(lambda:stream.read(1048576),b''):sha.update(chunk)
summary={'curl_exit_code':code,'http_status':int(parsed_metrics[1]) if parsed_metrics else None,'negotiated_http_version':parsed_metrics[2] if parsed_metrics else None,'bytes':raw.stat().st_size if raw.exists() else 0,'sha256':sha.hexdigest(),'request_sha256':hashlib.sha256(body).hexdigest(),'elapsed_seconds':round(time.time()-started,3),'finished_at':time.time()}
(root/'done.tmp').write_text(json.dumps(summary));(root/'done.tmp').replace(root/'done.json')
