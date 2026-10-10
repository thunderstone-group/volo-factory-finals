"""One exact captured generation request, changing only reasoning_effort; no automatic retries."""
import hashlib
import json
import sys
import time
from pathlib import Path

ROOT = Path('~/projects/volo-factory-worktrees/behavior-coverage-20261001')
sys.path.insert(0, str(ROOT))
from oneshot import main as adapter
from scripts.repair_replay import gateway_key

HERE = Path(__file__).resolve().parent
OUT = HERE / 'glm-low-effort-probe'
OUT.mkdir(exist_ok=False)
first = next(json.loads(line[len('[oneshot] trace '):])
             for line in (HERE / 'glm-github-1/stderr.log').read_text().splitlines()
             if line.startswith('[oneshot] trace '))
key = gateway_key('~/.config/arcbench/volo.env')
budget = adapter.CallBudget(draft_limit=1, repair_limit=0, fail_limit=1)
budget.progress_path = OUT / 'progress.json'
original_open = adapter._open_model

def patched_open(req, timeout):
    before = hashlib.sha256(req.data).hexdigest()
    if before != first['request_sha256']:
        raise ValueError('The request differs from the captured baseline before the parameter change.')
    payload = json.loads(req.data)
    payload['reasoning_effort'] = 'low'
    req.data = json.dumps(payload).encode('utf-8')
    budget.attempts[-1]['request_sha256'] = hashlib.sha256(req.data).hexdigest()
    budget.attempts[-1]['request_overrides'] = {'reasoning_effort': 'low'}
    (OUT / 'request-comparison.json').write_text(json.dumps({
        'baseline_sha256': before, 'modified_sha256': budget.attempts[-1]['request_sha256'],
        'only_changed_field': 'reasoning_effort', 'value': 'low', 'max_tokens': payload['max_tokens'],
        'temperature': payload['temperature']}, indent=2))
    return original_open(req, timeout)

adapter._open_model = patched_open
started = time.monotonic()
try:
    content, usage, finish = adapter.stream_completion(first['messages'], first['model'],
        adapter.DEFAULT_BASE, key, budget, tries=1, fallback='')
    (OUT / 'response.txt').write_text(content)
    result = {'status': 'completed', 'finish_reason': finish, 'usage': usage,
              'content_chars': len(content), 'file_markers': content.count('=== FILE:')}
except Exception as exc:
    result = {'status': 'failed', 'error': type(exc).__name__ + ': ' + str(exc)[:300]}
finally:
    result.update(seconds=round(time.monotonic() - started, 1), estimated_cost_cny=budget.spent(),
                  model=first['model'], reasoning_effort='low')
    (OUT / 'trace.json').write_text(json.dumps(budget.attempts, ensure_ascii=False, indent=1).replace(key, '[REDACTED]'))
    (OUT / 'summary.json').write_text(json.dumps(result, indent=2))
    print(json.dumps(result), flush=True)
