"""One real verifier call with the corrected generic precondition contract; no repaired app in prompt."""
import copy
import json
import sys
import time
from pathlib import Path

ROOT = Path('~/projects/volo-factory-worktrees/source-owners-20261002')
sys.path.insert(0, str(ROOT))
from oneshot import main as adapter, source_contracts as contracts
from scripts.repair_replay import gateway_key

HERE = Path(__file__).resolve().parent
OUT = HERE / 'startup-precondition-verifier'
OUT.mkdir(exist_ok=False)
prior = json.loads((HERE / 'startup-state-audit-r2/trace.json').read_text())
messages = copy.deepcopy(prior[1]['messages'])
record = json.loads((HERE / 'startup-state-audit-r2/source-contracts.json').read_text())
messages[-1]['content'] = contracts.VERIFY + json.dumps(record['first_execution'])
key = gateway_key('~/.config/arcbench/volo.env')
budget = adapter.CallBudget(draft_limit=1, repair_limit=0, fail_limit=1)
budget.progress_path = OUT / 'progress.json'
started = time.monotonic()
summary = {}
try:
    content, _, _ = adapter.stream_completion(messages, 'deepseek-v4-flash-vision-exp', adapter.DEFAULT_BASE,
                                              key, budget, tries=1, fallback='')
    req = (HERE / 'official-github-r2/application/requirements/requirements.yaml').read_text()
    probes = contracts.definitions(content, req)
    (OUT / 'probes.json').write_text(json.dumps(probes, ensure_ascii=False, indent=2))
    summary['results'] = {}
    for name in ['official-github-r2', 'startup-seed-repair-r2']:
        result = contracts.execute(HERE / name / 'application', probes, req)
        (OUT / (name + '.json')).write_text(json.dumps(result, ensure_ascii=False, indent=2))
        summary['results'][name] = result['results']
except Exception as exc:
    summary['error'] = type(exc).__name__ + ': ' + str(exc)[:800]
finally:
    (OUT / 'trace.json').write_text(json.dumps(budget.attempts, ensure_ascii=False, indent=1).replace(key, '[REDACTED]'))
    summary.update(seconds=round(time.monotonic() - started, 1), usage=budget.summary(),
                   scope='Original pre-repair source/proposals/results only. Same newly verified definitions replayed on before and after; neither repaired code nor operator calibration was sent.')
    (OUT / 'summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2))
    print(json.dumps(summary, ensure_ascii=False), flush=True)
