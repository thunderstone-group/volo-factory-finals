"""Registration-timing bench: replay the E057 public tests under controlled CPU.

Modes:
  host   app in a 1-CPU container, Playwright + Google Chrome on the macOS host
  cpuN   app AND the Playwright runner inside one container limited to N CPUs
"""
from __future__ import annotations

import json, os, shutil, subprocess, sys, time, urllib.request, uuid, zipfile
from pathlib import Path

BASE = Path('~/projects/volo-factory')
WT = Path('~/projects/volo-factory-worktrees/reg-timing')
SCRATCH = Path('/private/tmp/claude-501/-Users-e0-7-projects/21a88b56-d9d2-4a88-ae5c-488913ee4196/scratchpad/reg-timing')
SOURCE = BASE / 'runs/worktree-archive-20260912/lean-acceptance/runs/e057-dev35-repair-flash'
TESTS = BASE / 'runs/20260912-objective-review/public-tests'
MODULE = BASE / 'runs/local-replay/node_modules/@playwright/test'
NODE_MODULES = BASE / 'runs/local-replay/node_modules'
IMAGE = 'hermes-agent:latest'
SHELL = '/root/.cache/ms-playwright/chromium_headless_shell-1217/chrome-linux/headless_shell'
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

sys.path.insert(0, str(WT))
from volo.web_runtime import SERVER
from volo.launcher import install


def build_app(variant: str, dest: Path) -> Path:
    src = WT / 'lab/variants' / variant
    if dest.exists():
        shutil.rmtree(dest)
    (dest / 'frontend/dist').mkdir(parents=True)
    (dest / 'backend').mkdir(parents=True)
    shutil.copy(src / 'index.html', dest / 'frontend/dist/index.html')
    shutil.copy(src / 'api.cjs', dest / 'backend/api.cjs')
    (dest / 'backend/server.cjs').write_text(SERVER)
    (dest / 'backend/package.json').write_text(json.dumps({'scripts': {'start': 'node server.cjs'}}))
    install(dest)
    return dest


def config(test_dir: str, output_dir: str, executable: str, trace: str = 'on') -> str:
    cfg = {
        'testDir': test_dir,
        'workers': 4,
        'fullyParallel': False,
        'timeout': 10000,
        'expect': {'timeout': 10000},
        'retries': 0,
        'reporter': 'json',
        'outputDir': output_dir,
        'use': {'trace': trace, 'headless': True,
                'screenshot': 'off', 'video': 'off',
                'launchOptions': {'executablePath': executable}},
    }
    return 'module.exports=' + json.dumps(cfg) + ';\n'


def run_host(app: Path, out: Path, test_dir: Path, cpus: str = '1') -> dict:
    name = 'regtiming-' + uuid.uuid4().hex[:10]
    subprocess.run(['docker', 'run', '-d', '--name', name, '--pull=never', '--read-only',
                    '--user', '65534:65534', '--cap-drop=ALL', '--security-opt', 'no-new-privileges',
                    '--pids-limit', '64', '--memory', '256m', '--cpus', cpus,
                    '--tmpfs', '/tmp:rw,size=32m,mode=1777', '--workdir', '/tmp',
                    '-p', '127.0.0.1::3301',
                    '--mount', f'type=bind,src={app},dst=/candidate,readonly',
                    '--tmpfs', '/work:rw,size=64m,mode=1777', '--entrypoint', '/bin/sh', IMAGE,
                    '-c', 'cp -R /candidate/. /work/ && cd /work/backend && exec env -i '
                          'PATH=/usr/local/bin:/usr/bin:/bin PORT=3000 node .volo/launcher.cjs'],
                   check=True, capture_output=True, text=True)
    try:
        port = subprocess.run(['docker', 'port', name, '3301/tcp'], check=True,
                              capture_output=True, text=True).stdout.strip()
        url = 'http://' + port
        wait_http(url)
        cfg = out / 'playwright.config.cjs'
        cfg.write_text(config(str(test_dir), str(out / 'test-results'), CHROME))
        env = {'PATH': os.environ['PATH'], 'E2E_BASE_URL': url, 'NODE_PATH': str(NODE_MODULES)}
        started = time.time()
        result = subprocess.run(['node', str(MODULE / 'cli.js'), 'test', '--config', str(cfg)],
                                capture_output=True, text=True, env=env, timeout=300)
        return finish(out, result, time.time() - started)
    finally:
        subprocess.run(['docker', 'rm', '-f', name], capture_output=True)


def run_container(app: Path, out: Path, test_dir: Path, cpus: str) -> dict:
    (out / 'test-results').mkdir(parents=True, exist_ok=True)
    cfg = out / 'playwright.config.cjs'
    cfg.write_text(config('/tests', '/out/test-results', SHELL))
    script = (
        'set -e\n'
        'cp -R /candidate/. /work/\n'
        'cd /work/backend\n'
        'PORT=3000 node .volo/launcher.cjs &\n'
        'for i in $(seq 1 300); do\n'
        '  if node -e "require(\'http\').get(\'http://127.0.0.1:3000/\',r=>process.exit(r.statusCode==200?0:1)).on(\'error\',()=>process.exit(1))" 2>/dev/null; then break; fi\n'
        '  sleep 0.1\n'
        'done\n'
        'cd /work\n'
        'E2E_BASE_URL=http://127.0.0.1:3000 NODE_PATH=/nm '
        'node /nm/@playwright/test/cli.js test --config /out/playwright.config.cjs\n'
    )
    started = time.time()
    result = subprocess.run(
        ['docker', 'run', '--rm', '--pull=never', '--cpus', cpus, '--memory', '2g',
         '--workdir', '/work',
         '--mount', f'type=bind,src={app},dst=/candidate,readonly',
         '--mount', f'type=bind,src={TESTS},dst=/tests,readonly' if test_dir == TESTS
         else f'type=bind,src={test_dir},dst=/tests,readonly',
         '--mount', f'type=bind,src={NODE_MODULES},dst=/nm,readonly',
         '--mount', f'type=bind,src={out},dst=/out',
         '--entrypoint', '/bin/sh', IMAGE, '-c', script],
        capture_output=True, text=True, timeout=900)
    return finish(out, result, time.time() - started)


def finish(out: Path, result, wall: float) -> dict:
    (out / 'stdout.json').write_text(result.stdout)
    (out / 'stderr.log').write_text(result.stderr)
    try:
        report = json.loads(result.stdout)
    except json.JSONDecodeError:
        return {'error': 'no json report', 'exit_code': result.returncode,
                'wall': wall, 'stderr': result.stderr[-4000:]}
    rows = []
    for suite in report['suites']:
        for spec in suite['specs']:
            for test in spec['tests']:
                for res in test['results']:
                    rows.append({'title': spec['title'], 'file': suite['file'],
                                 'status': res['status'], 'duration': res['duration'],
                                 'worker': res['workerIndex'], 'start': res['startTime'],
                                 'error': (res.get('error') or {}).get('message', '')[:400]})
    return {'exit_code': result.returncode, 'wall': round(wall, 2),
            'stats': report['stats'], 'tests': rows}


def wait_http(url: str, seconds: float = 20) -> None:
    deadline = time.monotonic() + seconds
    while True:
        try:
            with urllib.request.urlopen(url, timeout=1) as r:
                assert r.status == 200
            return
        except OSError:
            if time.monotonic() > deadline:
                raise
            time.sleep(0.1)


TRACE_TITLE = 'REQ-1.1: successfully register a new account and remain signed in'


def extract_trace(out: Path, marker: str = 'ccount-and-remain-signed-in') -> list:
    """Return the per-action timeline recorded for the successful-registration test."""
    for zip_path in sorted((out / 'test-results').rglob('trace.zip')):
        if marker in zip_path.parent.name:
            return read_trace(zip_path)
    return []


def read_trace(zip_path: Path) -> list:
    events = {}
    order = []
    with zipfile.ZipFile(zip_path) as archive:
        for line in archive.read('test.trace').decode('utf-8').splitlines():
            if not line.strip():
                continue
            event = json.loads(line)
            kind = event.get('type')
            if kind == 'before':
                events[event['callId']] = {
                    'api': event.get('title', '') or event.get('method', ''),
                    'method': event.get('method'),
                    'parent': event.get('parentId'),
                    'params': short_params(event.get('params') or {}),
                    'start': event.get('startTime'),
                }
                order.append(event['callId'])
            elif kind == 'after' and event['callId'] in events:
                events[event['callId']]['end'] = event.get('endTime')
                events[event['callId']]['error'] = bool(event.get('error'))
    timeline = []
    for call_id in order:
        row = events[call_id]
        if row.get('end') is None or row.get('start') is None:
            continue
        timeline.append({'id': call_id, 'api': row['api'], 'method': row['method'], 'parent': row['parent'],
                         'params': row['params'], 'start': round(row['start'], 1),
                         'duration': round(row['end'] - row['start'], 1),
                         'error': row.get('error', False)})
    return timeline


def short_params(params: dict) -> str:
    for key in ('selector', 'url', 'expression'):
        if key in params:
            return str(params[key])[:160]
    return json.dumps(params, ensure_ascii=False)[:160]


BUCKETS = (
    ('setup', ('Launch browser', 'Create context', 'Create page')),
    ('navigation', ('Navigate to', 'Reload')),
    ('click', ('Click', 'Check', 'Uncheck')),
    ('fill', ('Fill',)),
    ('select', ('Select option',)),
    ('expect', ('Expect',)),
    ('evaluate', ('Evaluate',)),
    ('teardown', ('Close context',)),
)


def bucket(title: str) -> str:
    for name, keys in BUCKETS:
        if any((title or '').startswith(k) for k in keys):
            return name
    return 'other'


def leaves(timeline: list) -> list:
    """Steps with no child step, so bucket totals do not double-count wrappers."""
    parents = {row['parent'] for row in timeline if row.get('parent')}
    return [row for row in timeline if row['id'] not in parents]
