import json, sys, collections
from pathlib import Path
sys.path.insert(0, '~/projects/volo-factory-worktrees/light-compiler')
from oneshot import light_tests, testgen
OUT = Path(sys.argv[1]).resolve()
for t in ['github', 'sheet']:
    text = Path(f'~/projects/arcbench-campaign/finals-proxy/{t}/requirements/requirements.yaml').read_text()
    allc = light_tests.compile_requirements(text)
    compiled = [s for s in allc if s['source'] is not None]
    suite = OUT / t; suite.mkdir(parents=True, exist_ok=False)
    records = light_tests.write_compiled(suite, compiled)
    (suite / 'suite.json').write_text(json.dumps({'files': records, 'scenarios': len(compiled), 'tests': len(compiled), 'seconds': 0, 'prerequisites': ''}))
    app = Path(f'~/projects/arcbench-campaign/finals-local/runs/{t}-0a0ab9d7-s1/workspace')
    report = testgen.run_suite(app, suite, text)
    mine = {s['id']: s['status'] for s in report['scenarios']}
    proxy = json.load(open(f'~/projects/arcbench-campaign/finals-proxy/results/local/{t}-0a0ab9d7-s1-proxy.json'))
    pv = {x['name'].split(':')[0]: x['status'] for x in proxy['tests']}
    agree = sum(1 for k in mine if pv.get(k) == mine[k])
    print(t, 'compiled', len(compiled), '/', len(allc), 'compiled-verdicts', dict(collections.Counter(mine.values())),
          'agree with proxy', agree, '/', len(mine), 'disagree', [(k, mine[k], pv.get(k)) for k in mine if pv.get(k) != mine[k]],
          'uncompiled', [s['id'] for s in allc if s['source'] is None], flush=True)
