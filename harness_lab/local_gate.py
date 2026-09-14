"""Replay the unchanged public tests against a locally generated application.

A local gate is evidence about the application only if the generation could drive a
browser. Image ablation variant A was generated where Playwright discovery failed: the
agent wrote HTTP-only checks, shipped two /register links and failed 0 of 20 replays on
a defect the hosted runner would never have let it keep. This gate refuses to score a
generation whose recorded browser environment was unavailable, before any container starts.

Host mode, matching lab/bench.py: the application runs in a 1-CPU / 256 MB container behind
the volo launcher; Playwright and Google Chrome run on the host with the hosted settings,
workers 4, fullyParallel false, 10 s timeouts, retries 0, trace and video off.
"""
from __future__ import annotations

import argparse, json, os, shutil, subprocess, sys, time, urllib.request, uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from volo.launcher import install
from volo.workspace import NAVIGATION_SOURCES, self_navigation_findings


class GateRefused(RuntimeError):
    """The generation cannot be scored; this is not a measurement of the application."""


def browser_availability(app: Path) -> dict:
    """Read the browser environment the generation itself recorded."""
    for name in ('.factory/verification.json', '.factory/checkpoint.json'):
        try:
            state = json.loads((app / name).read_text())
        except (OSError, ValueError):
            continue
        if isinstance(state.get('browser_available'), bool):
            return {'available': state['browser_available'], 'source': name}
    return {'available': None, 'source': None}


def forbidden_patterns(app: Path) -> list:
    findings = []
    for path in sorted((app / 'frontend/public').rglob('*')) + sorted((app / 'backend').rglob('*')):
        if (not path.is_file() or path.suffix.lower() not in NAVIGATION_SOURCES
                or 'node_modules' in path.parts):
            continue
        findings.extend(self_navigation_findings(str(path.relative_to(app)), path.read_text(errors='replace')))
    return findings


def stage(app: Path, dest: Path) -> Path:
    if dest.exists():
        shutil.rmtree(dest)
    (dest / 'frontend').mkdir(parents=True)
    (dest / 'backend').mkdir(parents=True)
    shutil.copytree(app / 'frontend/dist', dest / 'frontend/dist')
    for entry in sorted((app / 'backend').iterdir()):
        if entry.name not in ('node_modules', 'data'):
            (shutil.copytree if entry.is_dir() else shutil.copy)(entry, dest / 'backend' / entry.name)
    install(dest)
    return dest


def wait_http(url: str, seconds: float = 20) -> None:
    deadline = time.monotonic() + seconds
    while True:
        try:
            with urllib.request.urlopen(url, timeout=1) as response:
                assert response.status == 200
            return
        except OSError:
            if time.monotonic() > deadline:
                raise
            time.sleep(0.1)


def replay(staged: Path, args, out: Path) -> dict:
    out.mkdir(parents=True, exist_ok=True)
    name = 'localgate-' + uuid.uuid4().hex[:10]
    subprocess.run(['docker', 'run', '-d', '--name', name, '--pull=never', '--read-only',
                    '--user', '65534:65534', '--cap-drop=ALL', '--security-opt', 'no-new-privileges',
                    '--pids-limit', '64', '--memory', '256m', '--cpus', '1', '-p', '127.0.0.1::3301',
                    '--tmpfs', '/tmp:rw,size=32m,mode=1777', '--workdir', '/tmp',
                    '--mount', f'type=bind,src={staged},dst=/candidate,readonly',
                    '--tmpfs', '/work:rw,size=64m,mode=1777', '--entrypoint', '/bin/sh', args.image,
                    '-c', 'cp -R /candidate/. /work/ && cd /work/backend && exec env -i '
                          'PATH=/usr/local/bin:/usr/bin:/bin PORT=3000 node .volo/launcher.cjs'],
                   check=True, capture_output=True, text=True)
    try:
        url = 'http://' + subprocess.run(['docker', 'port', name, '3301/tcp'], check=True,
                                         capture_output=True, text=True).stdout.strip()
        wait_http(url)
        cfg = out / 'playwright.config.cjs'
        cfg.write_text('module.exports=' + json.dumps({
            'testDir': str(args.tests), 'workers': 4, 'fullyParallel': False, 'timeout': 10000,
            'expect': {'timeout': 10000}, 'retries': 0, 'reporter': 'json',
            'outputDir': str(out / 'test-results'),
            'use': {'trace': 'off', 'headless': True, 'screenshot': 'off', 'video': 'off',
                    'launchOptions': {'executablePath': args.chrome}}}) + ';\n')
        started = time.time()
        done = subprocess.run(['node', str(args.node_modules / '@playwright/test/cli.js'), 'test',
                               '--config', str(cfg)], capture_output=True, text=True, timeout=300,
                              env={'PATH': os.environ['PATH'], 'E2E_BASE_URL': url,
                                   'NODE_PATH': str(args.node_modules)})
        wall = time.time() - started
    finally:
        subprocess.run(['docker', 'rm', '-f', name], capture_output=True)
    (out / 'stdout.json').write_text(done.stdout)
    (out / 'stderr.log').write_text(done.stderr)
    try:
        report = json.loads(done.stdout)
    except json.JSONDecodeError:
        return {'error': 'no json report', 'exit_code': done.returncode, 'wall': round(wall, 2)}
    return {'exit_code': done.returncode, 'wall': round(wall, 2), 'stats': report['stats'],
            'tests': [{'title': spec['title'], 'status': run['status'], 'duration': run['duration']}
                      for suite in report['suites'] for spec in suite['specs']
                      for test in spec['tests'] for run in test['results']]}


def gate(app: Path, args) -> dict:
    browser = browser_availability(app)
    if browser['available'] is not True:
        raise GateRefused('Refusing to score this generation: recorded browser_available is '
                          + json.dumps(browser['available']) + '. A generation without a browser writes '
                          'HTTP-only self-checks, so its replay measures the local environment, not the '
                          'application. Regenerate with Playwright discoverable.')
    findings = forbidden_patterns(app)
    if findings:
        raise GateRefused('Product source performs browser self-navigation: ' + json.dumps(findings[:5]))
    staged = stage(app, args.out / ('staged-' + args.label))
    rows = []
    for index in range(args.repetitions):
        row = replay(staged, args, args.out / ('gate-' + args.label) / f'run-{index:02d}')
        row['run'] = index
        print(json.dumps({'run': index, 'stats': row.get('stats'), 'wall': row.get('wall'), 'failed':
                          [t['title'] for t in row.get('tests', []) if t['status'] != 'passed']}), flush=True)
        rows.append(row)
    raw = args.out / f'gate-{args.label}.json'
    raw.write_text(json.dumps(rows, indent=1) + '\n')
    total = max(row.get('stats', {}).get('expected', 0) + row.get('stats', {}).get('unexpected', 0) for row in rows)
    clean = sum(1 for row in rows if row.get('stats', {}).get('unexpected') == 0
                and row.get('stats', {}).get('expected') == total)
    return {'label': args.label, 'browser_environment': browser, 'forbidden_patterns': 0,
            'repetitions': args.repetitions, 'tests_per_replay': total, 'clean_replays': clean, 'raw': str(raw)}


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description='Replay the public tests against a local generation')
    parser.add_argument('app', type=Path)
    parser.add_argument('--label', required=True)
    parser.add_argument('--tests', required=True, type=Path)
    parser.add_argument('--out', required=True, type=Path)
    parser.add_argument('--node-modules', required=True, type=Path)
    parser.add_argument('--repetitions', type=int, default=20)
    parser.add_argument('--image', default='hermes-agent:latest')
    parser.add_argument('--chrome', default='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    args = parser.parse_args(argv)
    try:
        summary = gate(args.app.resolve(), args)
    except GateRefused as refusal:
        print(json.dumps({'gate': 'refused', 'reason': str(refusal)}, ensure_ascii=False))
        return 2
    print(json.dumps(summary, ensure_ascii=False))
    return 0 if summary['clean_replays'] == args.repetitions else 1


if __name__ == '__main__':
    raise SystemExit(main())
