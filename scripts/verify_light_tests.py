#!/usr/bin/env python3
"""Read-only public-corpus coverage/equivalence audit; optional local base-app smoke.

Usage: python scripts/verify_light_tests.py --corpus EVIDENCE_ROOT --output runs/light-compiler --smoke
Requires NODE_PATH pointing at @playwright/test 1.57.0. Never calls a model/platform.
The corpus is read-only; generated suites and all subprocess scratch data use output.
"""
import argparse
import collections
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from oneshot import light_tests, testgen


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def trace(files, ids, helper, env):
    process = subprocess.run(['node', str(Path(__file__).with_name('light_operations.cjs'))],
        input=json.dumps({'files': list(map(str, files)), 'ids': ids, 'helper': str(helper)}),
        text=True, capture_output=True, env=env, timeout=60)
    if process.returncode:
        raise RuntimeError(process.stderr)
    return json.loads(process.stdout)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--corpus', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--smoke', action='store_true')
    args = parser.parse_args()
    root, output = args.corpus.resolve(), args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    scratch = output / 'tmp'
    scratch.mkdir(exist_ok=True)
    tempfile.tempdir = str(scratch)
    os.environ.update(TMPDIR=str(scratch), TMP=str(scratch), TEMP=str(scratch))
    env = dict(os.environ)
    # A missing runner is an explicit blocker, not permission to install/retry silently.
    roots = [Path(p) for p in env.get('NODE_PATH', '').split(os.pathsep) if p]
    runner = next((p for p in roots if (p / '@playwright/test/cli.js').is_file()), None)
    if runner is None:
        parser.error('set NODE_PATH to the existing Playwright 1.57.0 node_modules')
    version = json.loads((runner / '@playwright/test/package.json').read_text())['version']
    if version != '1.57.0':
        parser.error('expected Playwright 1.57.0, got ' + version)
    rows = []
    requirements = sorted((root / 'req/req-arc-bench-evolution').glob('*/requirements.yaml'))
    if not requirements:
        parser.error('no Light requirement files in the corpus')
    for requirement in requirements:
        text = requirement.read_text()
        planned = light_tests.compile_requirements(text)
        compiled = [s for s in planned if s['source'] is not None]
        suite = output / requirement.parent.name
        suite.mkdir(exist_ok=True)
        # Exercise the real write_suite integration with zero model calls. Fallbacks are
        # recorded as missing for this compiled-only smoke, never filled with fake tests.
        calls = []
        def unavailable(messages):
            calls.append(messages)
            raise RuntimeError('model calls disabled for the public-corpus audit')
        previous = testgen.LIGHT_TESTS
        testgen.LIGHT_TESTS = True
        try:
            manifest = testgen.write_suite(text, suite, unavailable, audit=False)
        finally:
            testgen.LIGHT_TESTS = previous
        # run_suite expects only the compiled subset for this audit. The mixed manifest
        # from write_suite remains alongside it for inspection.
        (suite / 'mixed-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
        manifest['files'] = [r for r in manifest['files'] if r.get('compiler') == 'light']
        manifest['scenarios'] = manifest['tests'] = len(compiled)
        (suite / 'suite.json').write_text(json.dumps(manifest, indent=2) + '\n')
        pack = root / 'packs' / requirement.parent.name
        specs = sorted(pack.glob('EV-*.spec.ts'))
        ids = [s['id'] for s in compiled]
        actual = trace([suite / light_tests.SPEC_FILE], ids, suite / light_tests.HELPER_FILE, env)
        official = trace(specs, ids, pack / 'helpers.ts', env)
        differences = []
        for key in sorted(set(actual) | set(official)):
            if actual.get(key) != official.get(key):
                differences.append({'scenario': key, 'actual': actual.get(key), 'official': official.get(key)})
        equivalence = {'actual': actual, 'official': official, 'differences': differences}
        (suite / 'equivalence.json').write_text(json.dumps(equivalence, indent=2, ensure_ascii=False) + '\n')
        config = suite / 'list.config.cjs'
        config.write_text('module.exports = { testDir: __dirname, testMatch: /.*\\.spec\\.cjs$/, reporter: "list" };\n')
        listed = subprocess.run(['node', str(runner / '@playwright/test/cli.js'), 'test', '--config', str(config), '--list'],
                                cwd=output, env=env, text=True, capture_output=True, timeout=60)
        (suite / 'list.log').write_text(listed.stdout + listed.stderr)
        match = re.search(r'Total: (\d+) tests?', listed.stdout)
        uncompiled = [dict(id=s['id'], **step) for s in planned for step in s['uncompiled']]
        row = {'task': requirement.parent.name, 'scenarios_compiled': len(compiled), 'scenarios_total': len(planned),
               'steps_parsed': sum(s['parsed'] for s in planned), 'steps_total': sum(s['total'] for s in planned),
               'interaction_steps_total': sum(step['keyword'] != 'GIVEN' for r in light_tests.scenarios.load_requirements(text)
                                               for s in r['scenarios'] for step in s['steps']),
               'uncompiled': uncompiled, 'equivalent': len(compiled) - sum(d['scenario'] != 'helpers' for d in differences),
               'differences': differences, 'helper_equal': actual.get('helpers') == official.get('helpers'),
               'operations': sum(len(st['operations']) for k, s in actual.items() if k != 'helpers' for st in s['steps']),
               'list_exit': listed.returncode, 'list_tests': int(match[1]) if match else None,
               'fallback_writer_invocations': len(calls), 'compiled_calls': sum(r['calls'] for r in manifest['files']),
               'inputs': {str(p.relative_to(root)): digest(p) for p in [requirement, pack / 'helpers.ts', *specs]}}
        row['interaction_steps_parsed'] = row['interaction_steps_total'] - sum(s['keyword'] != 'GIVEN' for s in uncompiled)
        if args.smoke:
            app = root / ('base-web-' + requirement.parent.name.split('--', 1)[1])
            report = testgen.run_suite(app, suite, text)
            (suite / 'run.json').write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n')
            counts = collections.Counter(s['status'] for s in report.get('scenarios', []))
            row['run'] = {k: counts[k] for k in ('pass', 'fail', 'error')}
            row['run'].update(seconds=report.get('seconds'), unavailable=report.get('unavailable'),
                              runner=report.get('runner'), timed_out=report.get('timed_out'))
            row['run']['executed'] = sum('seconds' in s for s in report.get('scenarios', []))
            row['app_inputs'] = {str(p.relative_to(app)): digest(p) for p in sorted(app.rglob('*')) if p.is_file()}
        rows.append(row)
        print(json.dumps({k: row[k] for k in ('task', 'scenarios_compiled', 'scenarios_total', 'equivalent', 'list_tests')}
                         | {'run': row.get('run')}, ensure_ascii=False), flush=True)
        (output / 'summary.json').write_text(json.dumps({'playwright': version, 'tasks': rows}, indent=2, ensure_ascii=False) + '\n')
    lite = []
    for p in sorted((root / 'req/req-arc-bench-lite-evolution').glob('*/requirements.yaml')):
        items = light_tests.compile_requirements(p.read_text())
        lite.append({'task': p.parent.name, 'compiled': sum(s['source'] is not None for s in items), 'total': len(items)})
    summary = {'playwright': version, 'tasks': rows, 'lite': lite}
    (output / 'summary.json').write_text(json.dumps(summary, indent=2, ensure_ascii=False) + '\n')
    if sum(r['scenarios_compiled'] for r in rows) < 0.9 * sum(r['scenarios_total'] for r in rows) or any(r['compiled'] for r in lite):
        return 1
    if any(r['differences'] or r['list_exit'] or r['list_tests'] != r['scenarios_compiled'] or
           (args.smoke and (r['run']['error'] or r['run']['executed'] != r['scenarios_compiled'])) for r in rows):
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
