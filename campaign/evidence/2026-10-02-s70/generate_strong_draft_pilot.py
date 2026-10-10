"""Controlled model-routing pilot: exact v4b code, Kimi draft, Vision checks/repair.

Both models use the authorized gateway and every real request remains in the usual ledger.
This is a local GitHub screening run, not a paired model-policy adoption or official result.
"""
import hashlib
import contextlib
import json
import os
import sys
import time
import zipfile
from pathlib import Path
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
ROOT = Path('~/projects/volo-factory-worktrees/source-owners-20261002')
sys.path.insert(0, str(ROOT))
from scripts.repair_replay import gateway_key

OUT = HERE / 'strong-draft-pilot-github'
OUT.mkdir(exist_ok=False)
package = HERE / 'candidate-diagnostics-v4b.zip'
assert hashlib.sha256(package.read_bytes()).hexdigest() == '4ec287a63ac4278f22a0bb90843bda745eb08c785aa5b162287cceeed8bb8dbe'
agent = OUT / 'agent'
with zipfile.ZipFile(package) as archive:
    archive.extractall(agent)
sys.path.insert(0, str(agent))
for name in list(os.environ):
    if name.startswith('ONESHOT_'):
        del os.environ[name]
os.environ.update(OPENAI_API_KEY=REDACTED'~/.config/arcbench/volo.env'),
                  OPENAI_BASE_URL='https://api.arc-bench.com/v1',
                  MODEL='deepseek-v4-flash-vision-exp', FALLBACK_MODEL='',
                  ONESHOT_DRAFT_CALLS='2', ONESHOT_REPAIR_CALLS='12', ONESHOT_REPAIR_CNY='4')
import main as adapter

original = adapter.draft_application
def draft(stage, files, messages, model, base, key, budget, template):
    return original(stage, files, messages, 'kimi-k2.7-code-highspeed', base, key, budget, template)

decision = {'package_sha256': hashlib.sha256(package.read_bytes()).hexdigest(),
            'draft_model': 'kimi-k2.7-code-highspeed', 'checks_and_repair_model': 'deepseek-v4-flash-vision-exp',
            'draft_completed_call_limit': 2, 'repair_completed_call_limit': 12, 'repair_cny_limit': 4,
            'fallback': 'disabled', 'scope': 'One local screening trajectory; final full-pair evidence required before adoption.',
            'practice_balance_before': 410.900447,
            'published_prices_cny_per_million': {'draft': {'input': 13, 'cache_hit': 2.6, 'output': 54},
                                                 'checks': {'input': 1, 'cache_hit': .02, 'output': 4}}}
(OUT / 'decision.json').write_text(json.dumps(decision, indent=2))
(OUT / 'process.json').write_text(json.dumps({'pid': os.getpid(), 'phase': 'generate', **decision}))
requirements = HERE.parent / '2026-09-24-hackathon-v2/requirements/hackathon--github'
started = time.monotonic()
with (OUT / 'stdout.log').open('x') as stdout, (OUT / 'stderr.log').open('x') as stderr, \
        contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr), \
        patch.object(adapter, 'draft_application', draft):
    result = adapter.main([str(requirements), '--output-dir', str(OUT / 'application')])
record = {'exit': result, 'seconds': round(time.monotonic() - started, 1), **decision}
(OUT / 'finished.json').write_text(json.dumps(record, indent=2))
print(json.dumps(record), flush=True)
