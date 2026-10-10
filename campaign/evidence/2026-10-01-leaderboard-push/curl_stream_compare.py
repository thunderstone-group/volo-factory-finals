"""Replay the same useful short request through curl/HTTP2 to isolate transport behavior; no credentials in argv/files."""
import hashlib
import json
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, '~/projects/volo-factory-worktrees/behavior-coverage-20261001')
from scripts.repair_replay import gateway_key

HERE=Path(__file__).resolve().parent
OUT=HERE/'curl-stream-compare'
OUT.mkdir(exist_ok=False)
old=json.loads((HERE/'short-test-deepseek-v4-flash-vision-exp/trace.json').read_text())[0]
payload={'model':old['model'],'messages':old['messages'],'max_tokens':16384,'temperature':0.0,
         'stream':True,'stream_options':{'include_usage':True}}
body=json.dumps(payload).encode()
(OUT/'request.json').write_bytes(body)
assert hashlib.sha256(body).hexdigest()==old['request_sha256']
key=gateway_key('~/.config/arcbench/volo.env')
assert '\n' not in key and '\r' not in key
config='header = "Authorization: Bearer '+key.replace('\\','\\\\').replace('"','\\"')+'"\n'
started=time.monotonic()
result=subprocess.run(['curl','--silent','--show-error','--http2','--no-buffer','--max-time','1200',
                       '--config','-','--header','Content-Type: application/json',
                       '--data-binary','@'+str(OUT/'request.json'),'--output',str(OUT/'response.sse'),
                       '--write-out','%{response_code} %{http_version}',
                       'https://api.arc-bench.com/v1/chat/completions'],input=config,text=True,capture_output=True)
done=False;finish=None;usage=None;content=[];reasoning=0;bad=[];events=0
for line in (OUT/'response.sse').read_bytes().splitlines():
    if not line.startswith(b'data:'):continue
    data=line[5:].strip()
    if data==b'[DONE]':done=True;continue
    try:
        event=json.loads(data);events+=1
        if event.get('usage'):usage=event['usage']
        for choice in event.get('choices') or []:
            delta=choice.get('delta') or {}
            if isinstance(delta.get('content'),str):content.append(delta['content'])
            if isinstance(delta.get('reasoning_content'),str):reasoning+=len(delta['reasoning_content'])
            if choice.get('finish_reason'):finish=choice['finish_reason']
    except (ValueError,AttributeError,TypeError) as exc:
        bad.append({'error':str(exc),'frame':data.decode('utf-8',errors='replace')[:500]})
summary={'request_sha256':hashlib.sha256(body).hexdigest(),'curl_exit':result.returncode,
         'http_status_version':result.stdout.strip(),'stderr':result.stderr[:500].replace(key,'[REDACTED]'),
         'seconds':round(time.monotonic()-started,1),'events':events,'done':done,'finish':finish,
         'content_chars':sum(map(len,content)),'reasoning_chars':reasoning,'usage':usage,'invalid_frames':bad[:3]}
(OUT/'response.txt').write_text(''.join(content))
(OUT/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
print(json.dumps(summary,ensure_ascii=False),flush=True)
