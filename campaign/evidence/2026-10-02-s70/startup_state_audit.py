"""Requirements-grounded startup coverage pilot; no hidden tests or named-task hints in prompts."""
import json
import sys
import time
from pathlib import Path
from unittest.mock import patch

ROOT = Path('~/projects/volo-factory-worktrees/source-owners-20261002')
sys.path.insert(0, str(ROOT))
from oneshot import main as adapter, source_contracts as contracts
from scripts.repair_replay import gateway_key

HERE = Path(__file__).resolve().parent
OUT = HERE / 'startup-state-audit-r2'
OUT.mkdir(exist_ok=False)
APP = HERE / 'official-github-r2/application'
requirements = (APP / 'requirements/requirements.yaml').read_text()
key = gateway_key('~/.config/arcbench/volo.env')
budget = adapter.CallBudget(draft_limit=2, repair_limit=0, fail_limit=1)
budget.progress_path = OUT / 'progress.json'

FOCUS = '''
For this audit, examine only initial states that the public requirements explicitly say the application supplies,
pre-provisions, or seeds. Does the actual startup state provide the required actors, effective permissions,
relationships, and distinct eligible/ineligible records? Merely including a quoted title or account name does not
establish these facts. Follow actual bootstrap behavior before claiming an initial state is missing.

For a startup-coverage claim, do not create missing accounts or records, add grants, or change decisions/statuses in
the fixture setup. Use the actual initializers and actual non-mutating application observers/predicates. Stub only
external plumbing. Selecting a current user or route may establish an observation context, but must not fabricate
the underlying business facts. A missing required seed is the fact to assert during CHECK, not a precondition to
silently drop as a fixture error. Preconditions should establish that the executor can read the real startup data.
Keep valid controls. If actual initialization cannot be reproduced, leave the claim unjudged or omit it.

Distinguish explicitly required pre-existing state from input the user is supposed to create or type later. Do not
turn illustrative or invalid-input examples into mandatory seeds, infer hidden fixture names, or require an
unstated internal representation. The public behavior and relationships are the contract. Return at most four
justified probes in the usual schema, without changing application code.'''

def complete(messages):
    return adapter.stream_completion(messages, 'deepseek-v4-flash-vision-exp', adapter.DEFAULT_BASE,
                                     key, budget, tries=1, fallback='')

started = time.monotonic()
summary = {}
try:
    with patch.object(contracts, 'SYSTEM', contracts.SYSTEM + FOCUS), \
            patch.object(contracts, 'VERIFY', contracts.VERIFY + FOCUS + '\nExecution results:\n'):
        result = contracts.prepare(APP, requirements, OUT, complete)
    summary['proposed'] = len(result.get('proposed', []))
    summary['probes'] = len(result.get('probes', []))
    summary['results'] = result.get('validation', [])
except Exception as exc:
    summary['error'] = type(exc).__name__ + ': ' + str(exc)[:1000]
finally:
    (OUT / 'trace.json').write_text(json.dumps(budget.attempts, ensure_ascii=False, indent=1).replace(key, '[REDACTED]'))
    summary.update(seconds=round(time.monotonic() - started, 1), usage=budget.summary(),
                   scope='Generic startup-state audit using only unchanged full public requirements and actual source; operator probes and Stage 1 specifics were not supplied.')
    (OUT / 'summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2))
    print(json.dumps(summary, ensure_ascii=False), flush=True)
