"""Independent check: compiled Light tests on apps the official runner fully passed must pass (no false failures)."""
import json, sys, collections
from pathlib import Path
sys.path.insert(0, '~/projects/volo-factory-worktrees/light-compiler')
from oneshot import light_tests, testgen
E = Path('~/projects/arcbench-campaign/evidence/2026-10-06-finals')
OUT = Path(sys.argv[1]).resolve()
tasks = sys.argv[2:] or ['12306', 'bookstack', 'ctrip', 'keep', 'prestashop', 'stackoverflow']
summary = {}
for t in tasks:
    text = (E / 'req/req-arc-bench-evolution' / f'arc-bench-evolution--{t}' / 'requirements.yaml').read_text()
    compiled = [s for s in light_tests.compile_requirements(text) if s['source'] is not None]
    suite = OUT / t
    suite.mkdir(parents=True, exist_ok=False)
    records = light_tests.write_compiled(suite, compiled)
    manifest = {'files': records, 'scenarios': sum(len(r['scenarios']) for r in records),
                'tests': sum(len(r['tests']) for r in records), 'seconds': 0, 'prerequisites': ''}
    (suite / 'suite.json').write_text(json.dumps(manifest, indent=1))
    report = testgen.run_suite(E / 'evolved' / t / 'template', suite, text)
    (suite / 'report.json').write_text(json.dumps(report, indent=1, ensure_ascii=False))
    counts = collections.Counter(s['status'] for s in report.get('scenarios', []))
    bad = [(s['id'], s['status'], (s.get('observation') or '')[:200]) for s in report.get('scenarios', []) if s['status'] != 'pass']
    summary[t] = {'compiled': len(compiled), 'counts': dict(counts), 'unavailable': report.get('unavailable'), 'not_pass': bad}
    print(t, json.dumps(summary[t], ensure_ascii=False), flush=True)
(OUT / 'summary.json').write_text(json.dumps(summary, indent=1, ensure_ascii=False))
