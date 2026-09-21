"""Track observed requirement coverage without promoting a probe to full acceptance."""

import argparse
from collections import Counter
import json
from pathlib import Path
import re

from experiment_recovery import atomic_json


def catalogue(text):
    # The supplied ARC YAML uses explicit id/name/type fields. Read only that schema;
    # never interpret an unrecognised document as an empty, completed objective.
    blocks = re.split(r'(?m)^\s*-?\s*id: (REQ-[\d.]+)\s*$', text)
    rows = []
    for rid, body in zip(blocks[1::2], blocks[2::2]):
        kind = re.search(r'(?m)^\s*type: (\w+)\s*$', body)
        name = re.search(r'(?m)^\s*name: (.+)$', body)
        if kind and kind.group(1) in ('ATOMIC', 'FOLDER'):
            if not name:
                raise ValueError('requirement has no name: ' + rid)
            rows.append({'id': rid, 'name': name.group(1).strip().strip("'\""), 'type': kind.group(1)})
    if not any(r['type'] == 'ATOMIC' for r in rows) or len({r['id'] for r in rows}) != len(rows):
        raise ValueError('missing or duplicate atomic requirements')
    return rows


def coverage(requirements, report):
    if report.get('mode') != 'probe' or report.get('application_failure'):
        raise ValueError('coverage requires a successful probe execution')
    cases = report.get('cases', [])
    if not cases or len({c['name'] for c in cases}) != len(cases):
        raise ValueError('empty or duplicate probe cases')
    observations = {r['id']: [] for r in requirements}
    for case in cases:
        for rid in re.findall(r'REQ-[\d.]+', case['name'].split(':', 1)[0]):
            if rid not in observations:
                raise ValueError('unknown requirement in probe: ' + rid)
            observations[rid].append(case['passed'])
    rows = []
    for requirement in requirements:
        values = observations[requirement['id']]
        status = 'unverified' if not values else ('observed_pass' if all(values) else 'observed_failure')
        rows.append({**requirement, 'status': status})
    all_checks_pass = all(c['passed'] for c in cases)
    counts = dict(Counter(r['status'] for r in rows if r.get('type', 'ATOMIC') == 'ATOMIC'))
    return {
        'requirements': rows,
        'counts': counts,
        'group_counts': dict(Counter(r['status'] for r in rows if r.get('type') == 'FOLDER')),
        'checks_passed': sum(c['passed'] for c in cases),
        'checks_total': len(cases),
        'all_checks_pass': all_checks_pass,
        'full_requirement_verification': False,
        'completion': ('coverage_incomplete' if counts.get('unverified') else 'scoped_checks_passed') if all_checks_pass else None,
        'interpretation': 'Observations cover selected behaviors, not every scenario of a requirement. Unverified is not passed.',
    }


def goal_feedback(requirements, report):
    state = coverage(requirements, report)
    return {
        'objective': 'Improve the observed failing requirements while preserving every successful check and existing input contracts.',
        'coverage_counts': state['counts'],
        'remaining_unverified': [r for r in state['requirements'] if r['status'] == 'unverified'],
        'completion_rule': 'The harness validates actual behavior. Passing selected checks does not establish full task completion. Do not invent evidence or weaken checks.',
        'scope': 'Repair the supplied observed failures. Unverified requirements are coverage gaps, not an instruction to rewrite unrelated features.',
    }


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('requirements', type=Path)
    p.add_argument('--out', required=True, type=Path)
    args = p.parse_args()
    atomic_json(args.out, catalogue(args.requirements.read_text()))
    rows = json.loads(args.out.read_text())
    print(json.dumps({'atomic_requirements': sum(r['type'] == 'ATOMIC' for r in rows), 'all_nodes': len(rows)}))
