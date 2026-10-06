#!/usr/bin/env python3
"""Stress preservation with CHANGE-heavy text, real browser mutations, and two authorized renames.

Generic runner: application names and routes are read from its inventory or supplied as navigation labels.
No model/platform calls. All application copies and evidence are written under --out.
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from oneshot import regression_guard as guard
from scripts.validate_regression_guard import MUTATOR, targets, write


def requirements(baseline, navigation):
    root = baseline['screens'][0]
    assert all(any(i['name'] == n for i in root['items']) for n in navigation), 'navigation labels must be observed'
    mutations = targets(baseline)
    first = mutations[1]
    second = next(i for i in root['items'] if i['role'] in ('button', 'link') and i.get('href') not in (None, '/', first['href'])
                  and not any(p['name'] == i['name'] and p['role'] != i['role'] and p['role'] in ('button', 'link')
                              for p in root['items']))
    renames = [dict(i, kind='rename-navigation', replacement=f'Renamed entry {n}') for n, i in enumerate([first, second], 1)]
    visit = navigation + [s['name'] for s in mutations[0]['steps']] + [mutations[0]['name']]
    changes = []
    for number in range(1, 9):
        changes.append({'id': f'CHANGE-{number}', 'type': 'ATOMIC', 'change_type': 'CHANGE',
                        'original_requirement_id': f'ORIGINAL-{number}',
                        'name': f'Review metric {number}',
                        'description': f'After using "{navigation[0]}" and "{navigation[-1]}", '
                                       f'show a status named "Review metric {number}" containing a deterministic '
                                       'count for the current records. Preserve all existing navigation and listings.',
                        'scenarios': [{'name': f'Inspect metric {number}', 'steps': [
                            {'keyword': 'GIVEN', 'content': 'Open the application in a fresh signed-out context.'},
                            {'keyword': 'WHEN', 'content': 'Sign in through the existing form using a seeded account.'},
                            *[{'keyword': 'WHEN', 'content': f'Navigate through "{name}".'} for name in visit],
                            {'keyword': 'THEN', 'content': f'The status "Review metric {number}" is visible.'}]}]})
    for number, rename in enumerate(renames, 9):
        changes.append({'id': f'CHANGE-{number}', 'type': 'ATOMIC', 'change_type': 'CHANGE',
                        'original_requirement_id': f'ORIGINAL-{number}', 'name': f'Navigation rename {number}',
                        'description': f'Rename the {rename["role"]} "{rename["name"]}" to "{rename["replacement"]}" '
                                       'on every page. Preserve its destination and all content reached through it.'})
    return {'id': 'ROOT', 'name': 'Synthetic evolution preservation exercise', 'type': 'FOLDER', 'children': changes}, mutations, renames


def modified(app, directory, mutations):
    directory.mkdir()
    for part in ('frontend', 'backend'):
        guard.scenario_check.Workspace._copy(app / part, directory / part)
    for path in (directory / 'frontend').rglob('index.html'):
        if 'node_modules' in path.parts or 'dist' in path.parts:
            continue
        injection = ''.join('<script>' + MUTATOR.replace('__CONFIG__', json.dumps(m)) + '</script>' for m in mutations)
        text = path.read_text()
        assert '</body>' in text, 'the generic HTML mutator needs a body end tag'
        path.write_text(text.replace('</body>', injection + '</body>'))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--app', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--navigation-names', required=True, help='JSON array of existing navigation labels')
    parser.add_argument('--paths-from', type=Path, help='Freeze the earlier navigation plan for comparable recall')
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    paths = None if args.paths_from is None else [s['steps'] for s in json.loads(args.paths_from.read_text())['screens']]
    b = guard.observe(args.app, paths, passes=2, work_parent=args.out)
    assert b.get('items') and not b.get('unavailable'), b.get('unavailable')
    write(args.out / 'baseline.json', b)
    document, mutations, renames = requirements(b, json.loads(args.navigation_names))
    text = json.dumps(document, indent=2)
    (args.out / 'requirements.yaml').write_text(text + '\n')  # JSON is also valid YAML.
    source_hashes = {str(p.relative_to(args.app)): hashlib.sha256(p.read_bytes()).hexdigest()
                     for part in ('frontend', 'backend') for p in (args.app / part).rglob('*')
                     if p.is_file() and not p.is_symlink() and not {'node_modules', 'dist'} & set(p.parts)}
    summary = {'baseline_items': b['items'], 'baseline_screens': len(b['screens']), 'baseline_seconds': b['seconds'],
               'source_hashes': source_hashes, 'requirements': document, 'renames': renames, 'cases': []}
    # A renamed navigation entry must not excuse deleting content on the screen it still reaches.
    descendant = next(dict(i, kind='hide-section', steps=s['steps']) for s in b['screens']
                      if s['steps'] and s['steps'][0]['name'] == renames[0]['name']
                      for i in s['items'] if i['role'] in ('textbox', 'searchbox'))
    cases = [('unchanged', []), *[(m['kind'], [m]) for m in mutations if m['kind'] != 'additions'],
             ('explicit-renames', renames), ('renames-with-descendant-loss', renames + [descendant])]
    for name, changes in cases:
        app = args.app
        if changes:
            app = args.out / ('app-' + name)
            modified(args.app, app, changes)
        try:
            observed = guard.observe(app, [s['steps'] for s in b['screens']], work_parent=args.out)
            result = guard.compare(b, observed, text)
            write(args.out / (name + '.json'), result)
            missing_ids = {f['id'] for f in result['missing']}
            if name == 'explicit-renames':
                success = not missing_ids and all(any(e['name'] == r['name'] and e['exemption']['rule'] == 'explicit_item'
                                                      for e in result['exempted']) for r in renames)
            elif name == 'unchanged':
                success = not missing_ids and not result['exempted']
            else:
                expected = descendant if name == 'renames-with-descendant-loss' else changes[0]
                success = expected['id'] in missing_ids
            success = success and not result['unknown']
            record = {'case': name, 'missing': len(missing_ids), 'kept': len(result['kept']),
                      'unknown': len(result['unknown']), 'exemptions_by_rule': result['exemptions_by_rule'],
                      'seconds': observed['seconds'], 'expected_result': success}
            summary['cases'].append(record)
            write(args.out / 'summary.json', summary)
            print(json.dumps(record), flush=True)
        finally:
            if changes:
                shutil.rmtree(app)
    assert all(hashlib.sha256((args.app / p).read_bytes()).hexdigest() == sha for p, sha in source_hashes.items())
    assert all(c['expected_result'] for c in summary['cases']), 'a recall/precision case failed; inspect its evidence'


if __name__ == '__main__':
    main()
