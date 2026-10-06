#!/usr/bin/env python3
"""Local, model-free regression-guard validation on an arbitrary supplied application.

Writes only under --out. Mutations are browser DOM changes injected into independent application copies;
targets are selected from that application's observed inventory, never from task names or evaluator tests.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from oneshot import regression_guard as guard


MUTATOR = r'''(() => {
  const mutation = __CONFIG__;
  const norm = s => String(s || '').replace(/\s+/g, ' ').trim();
  function role(el) {
    if (el.tagName === 'INPUT') return el.type === 'search' ? 'searchbox' :
      ['text','email','password','url','tel'].includes(el.type) ? 'textbox' : el.type;
    if (el.tagName === 'TEXTAREA') return 'textbox';
    return el.getAttribute('role') || ({A:'link',BUTTON:'button',NAV:'navigation',FORM:'form'}[el.tagName]) ||
      (/^H[1-6]$/.test(el.tagName) ? 'heading' : '');
  }
  function name(el) {
    if (el.hasAttribute('aria-label')) return norm(el.getAttribute('aria-label'));
    if (el.hasAttribute('aria-labelledby')) return norm(el.getAttribute('aria-labelledby').split(/\s+/)
      .map(id => document.getElementById(id)?.textContent || '').join(' '));
    if (el.labels?.length) return norm([...el.labels].map(l => l.textContent).join(' '));
    return norm(el.textContent);
  }
  const apply = () => {
    if (mutation.kind === 'additions') {
      if (!document.getElementById('synthetic-addition')) {
        const el = document.createElement('section'); el.id = 'synthetic-addition';
        el.setAttribute('role','region'); el.setAttribute('aria-label','Synthetic added region');
        el.innerHTML = '<button type="button">Synthetic added button</button>'; document.body.append(el);
      }
      return;
    }
    if (mutation.kind === 'broken-route') {
      if (location.pathname + location.search + location.hash === mutation.url) {
        const root = document.querySelector('main, [role="main"], #app') || document.body;
        if (root.childNodes.length) root.replaceChildren();
      }
      return;
    }
    for (const el of document.querySelectorAll('a,button,input,textarea,nav,form,[role],h1,h2,h3,h4,h5,h6')) {
      if (role(el) !== mutation.role || name(el) !== mutation.name) continue;
      if (mutation.kind === 'remove-link') el.remove();
      if (mutation.kind === 'rename-navigation') {
        const replacement = mutation.replacement || 'Synthetic renamed navigation';
        el.setAttribute('aria-label',replacement); el.textContent = replacement;
      }
      if (mutation.kind === 'hide-section' && el.style.display !== 'none') el.style.setProperty('display','none','important');
    }
  };
  const start = () => { apply(); new MutationObserver(apply).observe(document.body,{childList:true,subtree:true}); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
'''


def write(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')


def inventory(result):
    return [(s['steps'], [(i['role'], i['name']) for i in s['items']]) for s in result['screens']]


def targets(baseline):
    records = [(s, i) for s in baseline['screens'] for i in s['items']]
    links = [(s, i) for s, i in records if i['role'] == 'link' and i.get('href') not in (None, '/')]
    file_links = [(s, i) for s, i in links if re.search(r'\.[a-z0-9]{1,5}$', i['name'], re.I)]
    titled = [(s, i) for s, i in links if any(h['role'] == 'heading' and h['name'] == i['name'] for h in s['items'])]
    listing = (file_links or titled or links)[0]
    route = next(s for s in baseline['screens'] if s['steps'])
    first_step = route['steps'][0]
    nav = next((s, i) for s, i in records if not s['steps'] and i['role'] == first_step['role'] and i['name'] == first_step['name'])
    sections = [(s, i) for s, i in records if i['role'] in ('region', 'toolbar', 'form', 'navigation')]
    section = min(sections, key=lambda pair: (pair[1]['role'] != 'toolbar', pair[1]['role'] == 'navigation'))
    return [dict(listing[1], kind='remove-link', steps=listing[0]['steps']),
            dict(nav[1], kind='rename-navigation', steps=nav[0]['steps']),
            dict(route['items'][0], kind='broken-route', url=route['url'], steps=route['steps']),
            dict(section[1], kind='hide-section', steps=section[0]['steps']), {'kind': 'additions'}]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--app', required=True, type=Path)
    parser.add_argument('--out', required=True, type=Path)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    before = {}
    for path in sorted(args.app.rglob('*')):
        if path.is_file() and not path.is_symlink() and not set(path.parts) & {'node_modules', '.git', '.arc'}:
            before[str(path.relative_to(args.app))] = hashlib.sha256(path.read_bytes()).hexdigest()
    baselines = []
    for n in (1, 2):
        b = guard.observe(args.app, passes=2, work_parent=args.out)
        write(args.out / f'baseline-{n}.json', b)
        baselines.append(b)
        print('baseline', n, b.get('items'), len(b.get('screens', [])), b['seconds'], flush=True)
    b = baselines[0]
    if not b.get('items') or b.get('unavailable'):
        raise SystemExit('No stable baseline; validation is unavailable, not a pass')
    result = {'source': str(args.app), 'source_hashes': before, 'identical': inventory(b) == inventory(baselines[1]),
              'baselines': [{k: x.get(k) for k in ('items', 'seconds', 'unavailable')} |
                            {'screens': len(x['screens'])} for x in baselines], 'mutations': []}
    for mutation in targets(b):
        case = args.out / mutation['kind']
        case.mkdir()
        for part in ('frontend', 'backend'):
            guard.scenario_check.Workspace._copy(args.app / part, case / part)
        for path in (case / 'frontend').rglob('index.html'):
            if 'node_modules' in path.parts or 'dist' in path.parts:
                continue
            text = path.read_text()
            injected = '<script>' + MUTATOR.replace('__CONFIG__', json.dumps(mutation)) + '</script>'
            path.write_text(text.replace('</body>', injected + '</body>'))
        observed = guard.observe(case, [s['steps'] for s in b['screens']], work_parent=args.out)
        diff = guard.compare(b, observed)
        write(args.out / (mutation['kind'] + '.json'), diff)
        at_path = [f for f in diff['missing'] if guard.path_key(f['steps']) == guard.path_key(mutation.get('steps', []))]
        if mutation['kind'] == 'additions':
            added = {(i['role'], i['name']) for s in observed['screens'] for i in s['items']}
            detected = not diff['missing'] and {('button', 'Synthetic added button'),
                                               ('region', 'Synthetic added region')} <= added
        else:
            detected = any(f['id'] == mutation['id'] for f in at_path)
        detected = detected and not diff['unknown']
        record = {'mutation': mutation, 'missing': len(diff['missing']), 'unknown': len(diff['unknown']),
                  'seconds': observed['seconds'], 'detected_at_expected_path': detected,
                  'evidence': mutation['kind'] + '.json'}
        result['mutations'].append(record)
        print(mutation['kind'], record['missing'], detected, observed['seconds'], flush=True)
        shutil.rmtree(case)
    result['source_unchanged'] = all(hashlib.sha256((args.app / path).read_bytes()).hexdigest() == sha for path, sha in before.items())
    write(args.out / 'summary.json', result)
    if not result['identical'] or not result['source_unchanged'] or not all(r['detected_at_expected_path'] for r in result['mutations']):
        raise SystemExit(1)


if __name__ == '__main__':
    main()
