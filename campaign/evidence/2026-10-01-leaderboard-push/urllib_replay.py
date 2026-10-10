"""Same request as the completed curl call, through the original Python client, with no retry."""
import json
import sys
import time
from pathlib import Path
sys.path.insert(0,'~/projects/volo-factory-worktrees/behavior-coverage-20261001')
from oneshot import main as adapter
from scripts.repair_replay import gateway_key
HERE=Path(__file__).resolve().parent
OUT=HERE/'urllib-after-curl';OUT.mkdir(exist_ok=False)
payload=json.loads((HERE/'curl-stream-compare/request.json').read_text())
adapter.MAX_TOKENS=payload['max_tokens']
key=gateway_key('~/.config/arcbench/volo.env')
b=adapter.CallBudget(draft_limit=1,repair_limit=0,fail_limit=1);b.progress_path=OUT/'progress.json'
start=time.monotonic()
try:
    content,usage,finish=adapter.stream_completion(payload['messages'],payload['model'],adapter.DEFAULT_BASE,key,b,tries=1,fallback='')
    (OUT/'response.txt').write_text(content)
    result={'status':'completed','finish':finish,'usage':usage,'content_chars':len(content)}
except Exception as exc:result={'status':'failed','error':str(exc)}
finally:
    result.update(seconds=round(time.monotonic()-start,1),estimated_cost_cny=b.spent())
    (OUT/'trace.json').write_text(json.dumps(b.attempts,ensure_ascii=False,indent=1).replace(key,'[REDACTED]'))
    (OUT/'summary.json').write_text(json.dumps(result,indent=2))
    print(json.dumps(result),flush=True)
