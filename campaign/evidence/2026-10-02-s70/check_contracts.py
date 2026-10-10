"""Bind reviewer counterexamples to exact functions in a frozen application; errors are never product failures."""
import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, '~/projects/volo-factory-worktrees/s70-20261002')
from oneshot import testgen, scenarios

def extract(source, name, kind):
    escaped = re.escape(name)
    if kind == 'function':
        pattern = r'\bfunction\s+' + escaped + r'\s*(\([^)]*\))\s*(\{)'
    elif kind == 'method':
        key = r'(?:[\x27\x22]' + escaped + r'[\x27\x22]|' + escaped + r')'
        pattern = r'(?m)^\s*' + key + r'\s*(?::\s*function\s*)?(\([^)]*\))\s*(\{)'
    else:
        raise ValueError('Unsupported source selector kind: ' + str(kind))
    matches = list(re.finditer(pattern, source))
    if len(matches) != 1:
        raise ValueError('Expected one exact function/method for ' + name + ', got ' + str(len(matches)))
    match = matches[0]
    end = testgen._block_end(source, match.start(2))
    if end < 0:
        raise ValueError('Incomplete source function: ' + name)
    return 'function ' + match.group(1) + ' ' + source[match.start(2):end + 1]

def run(app, definitions):
    app = Path(app).resolve()
    reqs = {r['id'] for r in scenarios.load_requirements((app / 'requirements/requirements.yaml').read_text())}
    sources = {}
    for p in definitions:
        for f in p.get('functions', []):
            path = (app / f['file']).resolve()
            if path.is_relative_to(app) and path.suffix in ('.js', '.cjs', '.mjs'):
                sources[f['file']] = path.read_text()
    indexed = subprocess.run(['node', str(HERE / 'contract-bindings.cjs')], input=json.dumps(sources),
                             capture_output=True, text=True, timeout=15, check=True)
    index = json.loads(indexed.stdout)
    def bind(f):
        matches = [b for b in index if b['file'] == f['file'] and b['name'] == f['name'] and b['kind'] == f['kind']]
        if len(matches) != 1:
            raise ValueError('Expected one exact source binding: ' + f['name'] + ', got ' + str(len(matches)))
        return dict(matches[0], alias=f['alias'], source_sha256=hashlib.sha256(sources[f['file']].encode()).hexdigest())
    bound, rejected = [], []
    for p in definitions:
        try:
            if p['requirement'] not in reqs or not p['id'].startswith(p['requirement'] + '#contract-'):
                raise ValueError('Unknown requirement or probe id')
            if not isinstance(p['setup'], str) or not isinstance(p['check'], str):
                raise ValueError('Probe setup/check must be strings')
            if re.search(r'\b(?:require|process|fetch|setTimeout|setInterval|import)\b', p['setup'] + '\n' + p['check']):
                raise ValueError('Probe must be synchronous and self-contained')
            functions = []
            for f in p['functions']:
                file = (app / f['file']).resolve()
                if not file.is_relative_to(app) or file.suffix not in ('.js', '.cjs', '.mjs'):
                    raise ValueError('Function source is outside application JavaScript')
                if not re.fullmatch(r'[A-Za-z_$][\w$]*', f['alias']):
                    raise ValueError('Invalid binding alias')
                functions.append(bind(f))
            aliases = [f['alias'] for f in functions]
            if len(set(aliases)) != len(aliases) or p['subject'] not in aliases:
                raise ValueError('The subject must be one unique actual-source binding')
            initializers = []
            for name in p.get('initializers', []):
                file = (app / name).resolve()
                if not file.is_relative_to(app) or file.suffix not in ('.js', '.cjs', '.mjs'):
                    raise ValueError('Initializer is outside application JavaScript')
                initializers.append({'file': name, 'code': file.read_text(),
                                     'source_sha256': hashlib.sha256(file.read_bytes()).hexdigest()})
            bound.append(dict(p, functions=functions, initializers=initializers))
        except Exception as exc:
            rejected.append({'id': p.get('id'), 'status': 'error', 'error': str(exc)})
    with tempfile.TemporaryDirectory(prefix='contract-probe-') as temp:
        env = {k: os.environ[k] for k in ['PATH', 'HOME', 'LANG'] if k in os.environ}
        env['TMPDIR'] = temp
        for _ in range(24):
            process = subprocess.run(['node', str(HERE / 'contract-runner.cjs')], input=json.dumps(bound),
                                     text=True, capture_output=True, timeout=10, env=env, cwd=temp)
            if process.returncode:
                raise RuntimeError(process.stderr[-1000:])
            results = json.loads(process.stdout)
            added = False
            by_id = {p['id']: p for p in bound}
            for r in results:
                missing = re.search(r'([A-Za-z_$][\w$]*) is not defined', r.get('message','') or r.get('error',''))
                if r['status'] != 'error' or not missing:
                    continue
                p = by_id[r['id']]
                name = missing.group(1)
                scopes = {(f['file'], f['scope']) for f in p['functions']}
                matches = [f for f in index if f['name'] == name and f['kind'] in ('function','value')
                           and (f['file'],f['scope']) in scopes]
                if len(matches) == 1 and name not in [f['alias'] for f in p['functions']]:
                    f = matches[0]
                    p['functions'].append(bind({'file':f['file'],'name':name,'kind':f['kind'],'alias':name}))
                    p.setdefault('linked_dependencies',[]).append(name)
                    added = True
            if not added:
                break
    return {'results': results + rejected, 'bindings': bound}

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--task', choices=['github', 'sheet'], required=True)
    args = parser.parse_args()
    out = HERE / ('contracts-' + args.task)
    app = HERE.parent / '2026-10-01-leaderboard-push' / ('official-' + args.task + '-r1/application')
    source = out / 'validated-probes.json'
    if not source.exists(): source = out / 'response.txt'
    definitions = json.loads(testgen.unfence(source.read_text()))
    result = run(app, definitions)
    (out / 'execution.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(json.dumps(result['results'], ensure_ascii=False, indent=2))
