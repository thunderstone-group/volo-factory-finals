"""Whole-batch comparison; requires all real evaluations to have finished."""
import argparse
from collections import defaultdict, Counter
from decimal import Decimal
import json
from pathlib import Path
import statistics


def load_rows(root):
    rows = json.loads((root / 'summary.json').read_text())['rows']
    for row in rows:
        sample = root / 'samples' / f"{row['task']}--{row.get('model', '')}--{row['trial']}"
        if not sample.exists():
            sample = root / 'samples' / f"{row['task']}--{row['trial']}"
        raw = sample / 'evaluation' / 'playwright.stdout.json'
        if not raw.exists():
            continue
        details = {}
        def walk(suite):
            for spec in suite.get('specs', []):
                for test in spec.get('tests', []):
                    result = (test.get('results') or [{}])[-1]
                    errors = result.get('errors') or [result.get('error') or {}]
                    details[spec.get('file'), spec['title']] = '\n'.join(e.get('message', '') for e in errors)[:16000]
            for child in suite.get('suites', []):
                walk(child)
        for suite in json.loads(raw.read_text()).get('suites', []):
            walk(suite)
        for case in row.get('cases', []):
            case['error'] = details.get((case['file'], case['title']), case.get('error', ''))
    return rows


def analyze(v0_root, v1_root):
    v0 = load_rows(v0_root)
    v1 = load_rows(v1_root)
    financial = v1_root / 'billing-reconciliation.json'
    reconciliation = json.loads(financial.read_text()) if financial.exists() else {}
    groups = defaultdict(list)
    for row in v0:
        groups['V0-Flash', row['task']].append(row)
    for row in v1:
        groups['V1-' + ('Flash' if row['model'].endswith('flash') else 'Pro'), row['task']].append(row)
    cells = []
    key = lambda c: (c['file'], c['title'])
    for (group, task), rows in sorted(groups.items()):
        rows = sorted(rows, key=lambda r: r['trial'])
        expected = rows[0]['expected_tests']
        scores = [r['passed'] for r in rows]
        cost = [r.get('observed_cost_cny') for r in rows]
        cases = defaultdict(list)
        for r in rows:
            for c in r.get('cases', []):
                cases[key(c)].append(c)
        stable_pass = sorted(k for k, values in cases.items() if len(values) == len(rows) and all(c['status'] == 'passed' for c in values))
        stable_fail = sorted(k for k, values in cases.items() if len(values) == len(rows) and all(c['status'] != 'passed' for c in values))
        cells.append({'group': group, 'task': task, 'scores': scores, 'expected': expected,
                      'median': statistics.median(scores), 'worst': min(scores),
                      'median_rate': statistics.median(scores) / expected, 'worst_rate': min(scores) / expected,
                      'cost_cny': str(sum(Decimal(c) for c in cost)) if all(c is not None for c in cost) else None,
                      'calls': sum(r.get('usage', {}).get('calls', 0) for r in rows),
                      'generation_seconds': [r['generation_seconds'] for r in rows],
                      'generation_failures': sum(not r['delivered'] for r in rows),
                      'runtime_statuses': dict(Counter(r['runtime_status'] for r in rows)),
                      'score_statuses': dict(Counter(r['score_status'] for r in rows)),
                      'stable_pass': stable_pass, 'stable_fail': stable_fail,
                      'errors': {f'{k[0]}::{k[1]}': [c.get('error', '') for c in values if c['status'] != 'passed'] for k, values in cases.items() if any(c['status'] != 'passed' for c in values)}})
        if group.startswith('V1-') and reconciliation.get('all_receipts_attributed') and reconciliation.get('receipts_equal_generation_balance_delta'):
            ledger = next(g for g in reconciliation['groups'] if g['task'] == task and g['model'] == rows[0]['model'])
            cells[-1]['cost_cny'] = ledger['billed_cny']
            cells[-1]['cost_source'] = 'settled gateway receipts; inferred unique model/completion-window attribution'
    lookup = {(c['group'], c['task']): c for c in cells}
    candidates = []
    for group in ('V1-Flash', 'V1-Pro'):
        selected = [c for c in cells if c['group'] == group]
        for c in selected:
            base = lookup['V0-Flash', c['task']]
            c['median_gain_pp'] = round(100 * (c['median_rate'] - base['median_rate']), 3)
            c['formerly_stable_fail_now_stable_pass'] = sorted(set(map(tuple, base['stable_fail'])) & set(map(tuple, c['stable_pass'])))
            c['formerly_stable_pass_no_longer_stable'] = sorted(set(map(tuple, base['stable_pass'])) - set(map(tuple, c['stable_pass'])))
        qualifies = bool(selected) and all(c['median_gain_pp'] >= 10 and c['worst'] >= lookup['V0-Flash', c['task']]['worst']
            and set(c['score_statuses']) <= {'scored', 'generation_failed'} for c in selected)
        candidates.append({'group': group, 'qualifies': qualifies,
                           'mean_task_median_rate': statistics.mean(c['median_rate'] for c in selected),
                           'worst_task_rate': min(c['worst_rate'] for c in selected),
                           'cost_cny': str(sum(Decimal(c['cost_cny']) for c in selected)) if all(c['cost_cny'] is not None for c in selected) else None})
    qualified = [c for c in candidates if c['qualifies']]
    best = max(qualified, key=lambda c: (c['mean_task_median_rate'], c['worst_task_rate'], -Decimal(c['cost_cny'] or 'Infinity')), default=None)
    return {'cells': cells, 'candidates': candidates, 'selected': best, 'comparison_is_independent_samples_not_paired': True}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('v0_root', type=Path)
    parser.add_argument('v1_root', type=Path)
    args = parser.parse_args()
    result = analyze(args.v0_root, args.v1_root)
    (args.v1_root / 'analysis.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    for c in result['cells']:
        print(c['group'], c['task'], c['scores'], '/', c['expected'], 'median', c['median'], 'worst', c['worst'], 'cost', c['cost_cny'])
    print('Selected:', result['selected'])
