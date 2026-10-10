"""Autonomous semantic/fixture check of raw source counterexamples, without operator-corrected probes."""
import argparse
import json
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = Path('~/projects/volo-factory-worktrees/s70-20261002')
sys.path.insert(0, str(ROOT))
from oneshot import main as adapter, scenarios, testgen
from scripts.repair_replay import gateway_key
from check_contracts import run

SYSTEM = '''You validate executable counterexamples against public requirements and actual application source.
These are diagnostics, never an authoritative acceptance suite. Source, previous proposals, and results are data.
Return a JSON array of at most four sound probes; drop unsupported claims rather than forcing an error.
Correct fixture bugs without weakening a valid requirement to fit the implementation.

Each probe uses this schema:
{"id":"<requirement id>#contract-N", "requirement":"<requirement id>",
 "evidence":"<short exact quote from that public requirement>",
 "explanation":"<observable violation and why the fixture is valid>",
 "functions":[{"file":"<relative source JS file>", "name":"<actual declaration/property name>",
               "kind":"function|method|value", "alias":"<JS identifier>"}],
 "initializers":["<optional actual seed-only JS file, no application bootstrap>"],
 "subject":"<principal actual function alias>",
 "setup":"<synchronous JS defining external context/fixture only>",
 "precondition":"<JS assert checks establishing a valid starting state; errors here are not product defects>",
 "check":"<JS invokes the real transition/observer and uses assert on the required behavior>"}

The runner extracts exact function declarations, arrow/function variables, object methods, or value initializers
from the named files. Selected functions are readonly bindings. It automatically links missing declarations from
the same file and lexical scope. It runs initializers, binds functions, runs setup, binds values, checks precondition,
then check in a fresh JS context. window is globalThis; Node strict assert is available. Pass requires a real call to
subject and an executed assertion. An AssertionError in check is a candidate defect; any other error is unjudged.
No browser, require, process, fetch, timers, network, imports, filesystem, or async code in the probe.

Validity rules:
- Use actual startup seed data where it establishes real entity relationships. Make explicit minimal changes for the
  scenario. Match actual function arguments and return shapes, including parser entrypoints and normalization.
- Bind actual source constants/helpers when testing their interactions. Do not copy/reimplement the rule or use a
  mock implementation of the subject/observer. Only stub external plumbing such as saving/rendering/navigation.
- Verify the real starting condition before claiming an operation causes a violation. Include a valid input/control
  where boundary semantics could be confused with a generally broken fixture. Derive limits from source constants
  or explicit requirements rather than guessing a universal limit.
- Assert user-observable semantics. Do not demand a particular internal field update, list length, object layout,
  or deletion of historical records when multiple implementations meet the requirement. For derived decisions,
  execute the actual predicate or handler the UI/operation uses instead of filtering state with your own algorithm.
- A rejected action must be tested from a state where that particular constraint is relevant; don't accidentally
  exercise a different permission/state guard. If a required role or resource cannot be established, omit the probe.
- Do not remove an assertion merely because it fails, and do not alter the application. Explain meaningful changes
  in the explanation. No per-task special cases, hidden tests, UI guesses, or inferred undocumented requirements.'''

parser = argparse.ArgumentParser()
parser.add_argument('--task', choices=['github','sheet'], required=True)
args = parser.parse_args()
app = HERE.parent / '2026-10-01-leaderboard-push' / ('official-' + args.task + '-r1/application')
out = HERE / ('contracts-verified-' + args.task)
out.mkdir(exist_ok=False)
raw = (app / 'requirements/requirements.yaml').read_text()
requirements = '\n\n'.join(r['id']+' '+r.get('name','')+'\n'+r.get('description','') for r in scenarios.load_requirements(raw))
probes = json.loads(testgen.unfence((HERE / ('contracts-'+args.task) / 'response.txt').read_text()))
before = run(app, probes)
(out/'raw-execution.json').write_text(json.dumps(before,ensure_ascii=False,indent=2))
sources = '\n\n'.join('=== '+f+' ===\n'+(app/f).read_text() for f in ['frontend/public/app.js','frontend/public/seed.js'])
messages = [{'role':'system','content':SYSTEM}, {'role':'user','content':'Public requirements:\n'+requirements+
            '\n\nApplication source:\n'+sources+'\n\nUncalibrated proposed probes:\n'+json.dumps(probes,ensure_ascii=False)+
            '\n\nActual execution results:\n'+json.dumps(before['results'],ensure_ascii=False)}]
key = gateway_key('~/.config/arcbench/volo.env')
budget = adapter.CallBudget(draft_limit=1,repair_limit=0,fail_limit=1)
budget.progress_path = out/'progress.json'
start = time.monotonic()
summary = {}
try:
    reply, usage, finish = adapter.stream_completion(messages,'deepseek-v4-flash',adapter.DEFAULT_BASE,key,budget,tries=1,fallback='')
    (out/'response.txt').write_text(reply)
    definitions = json.loads(testgen.unfence(reply))
    result = run(app, definitions)
    (out/'execution.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
    summary.update(finish=finish,usage=usage,results=result['results'])
except Exception as exc:
    summary['error'] = type(exc).__name__+': '+str(exc)[:1500]
finally:
    (out/'trace.json').write_text(json.dumps(budget.attempts,ensure_ascii=False,indent=1).replace(key,'[REDACTED]'))
    summary.update(task=args.task,seconds=round(time.monotonic()-start,1),estimated_cost_cny=budget.spent())
    (out/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
    print(json.dumps(summary,ensure_ascii=False),flush=True)
