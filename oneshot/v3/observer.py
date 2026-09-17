"""Native Linux-container observer. No Docker, downloads, or host app execution.

Requires existing unprivileged bubblewrap namespaces and installed Playwright.
An outer namespace has only loopback; a second PID/mount namespace prevents the
application from seeing the trusted observer's files, processes and report pipe.
"""
import json
import os
from pathlib import Path
import stat
import sys
import tempfile
import time
from oneshot import main as core, skill_repair as sr
from oneshot.business_feedback import source_id
from oneshot.minimal_feedback import _process
from .planner import PROBE, canonical

HERE = Path(__file__).resolve().parent
MODULE_ROOTS = ('/opt/arc/node_modules', '/usr/local/lib/node_modules', '/usr/lib/node_modules', '/opt/node_modules')
BROWSER_ROOTS = ('/ms-playwright', '/opt/arc/ms-playwright', '/root/.cache/ms-playwright', '/home/runner/.cache/ms-playwright')
MARKER = 'VOLO_BUSINESS_OBSERVATION '


def discover():
    if sys.platform != 'linux' or not any(Path(p).is_file() for p in ('/.dockerenv', '/run/.containerenv')):
        raise ValueError('linux_container_required')
    bwrap = next((Path(p) for p in ('/usr/bin/bwrap', '/bin/bwrap') if Path(p).is_file()), None)
    node = next((Path(p) for p in ('/usr/bin/node', '/usr/local/bin/node') if Path(p).is_file()), None)
    modules = next((Path(p) for p in MODULE_ROOTS if (Path(p)/'@playwright/test/cli.js').is_file()), None)
    browsers = next((Path(p) for p in BROWSER_ROOTS if Path(p).is_dir()), None)
    if not all((bwrap, node, modules, browsers)):
        raise ValueError('safe_runtime_or_browser_missing')
    # Never invoke a privileged/setuid isolation helper.
    if bwrap.stat().st_mode & (stat.S_ISUID | stat.S_ISGID):
        raise ValueError('privileged_runtime_refused')
    return {'bwrap': str(bwrap), 'node': str(node), 'modules': str(modules), 'browsers': str(browsers)}



PREFLIGHT_SECONDS = 35
PREFLIGHT_CODES = frozenset({
    'linux_container_required', 'safe_runtime_or_browser_missing',
    'privileged_runtime_refused', 'wall_budget_exhausted',
    'native_runtime_failed', 'browser_unavailable', 'isolation_unavailable',
    'output_limit', 'preflight_receipt_invalid', 'preflight_cleanup_failed',
    'preflight_error',
})


def runtime_preflight(runtime_root, deadline):
    """Exercise only the trusted isolation/browser driver, before any model call.

    No requirement, generated application, model credential or official evaluator
    is given to this process. A missing/denied runtime is not silently downgraded
    to a generation-only V3 run. This is capability evidence, not a business pass.
    """
    root = Path(runtime_root)
    started = time.monotonic()
    report = {'schema': 'v3-runtime-preflight/v1', 'status': 'environment_error',
              'scope': 'trusted_runtime_only', 'model_calls': 0,
              'generated_code_executed': False, 'official_score': False,
              'verified_requirements': [], 'checks': {}, 'cleanup_verified': False}
    try:
        runtime = discover()
        report['runtime'] = runtime
        seconds = min(PREFLIGHT_SECONDS, deadline-time.monotonic()-2)
        if seconds <= 0:
            raise ValueError('wall_budget_exhausted')
        root.mkdir(mode=0o700, parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix='preflight-', dir=root) as tmp:
            tmp = Path(tmp)
            app = tmp/'app'; app.mkdir(mode=0o700)
            probe = tmp/'probe'; probe.mkdir(mode=0o700)
            driver = (HERE/'runner.cjs').read_bytes()
            (probe/'runner.cjs').write_bytes(driver)
            report['driver_sha256'] = sr.sha256(driver)
            report['launcher_sha256'] = sr.sha256((HERE/'launch.py').read_bytes())
            config = tmp/'launch.json'
            config.write_text(json.dumps({**runtime, 'app': str(app),
                                          'probe': str(probe), 'mode': 'preflight'}))
            result = _process([sys.executable, '-B', str(HERE/'launch.py'), str(config)],
                              HERE, seconds,
                              env={'PATH': '/usr/local/bin:/usr/bin:/bin', 'LANG': 'C.UTF-8'},
                              max_log=16*1024)
            report['execution'] = {k: result[k] for k in
                                   ('exit_code', 'elapsed_seconds', 'reason') if k in result}
            if result.get('reason') or result.get('exit_code') != 0:
                raise ValueError('native_runtime_failed')
            raw = sr._decode(result['output'])
            expected = {'status': 'ready', 'checks': {'isolation': True, 'browser': True}}
            # JSON booleans are required; integer 1 must not masquerade as True.
            if sr._json(raw) != sr._json(expected):
                code = raw.get('code') if isinstance(raw, dict) else None
                raise ValueError(code if code in PREFLIGHT_CODES else 'preflight_receipt_invalid')
            report['checks'] = raw['checks']
        report['status'] = 'ready'
    except (OSError, ValueError, KeyError, TypeError, AttributeError, RecursionError) as exc:
        code = str(exc) if isinstance(exc, ValueError) else 'preflight_error'
        report['error'] = {'stage': 'runtime_preflight',
                           'code': code if code in PREFLIGHT_CODES else 'preflight_error'}
    finally:
        try:
            report['cleanup_verified'] = not root.exists() or not any(root.iterdir())
        except OSError:
            report['cleanup_verified'] = False
        if not report['cleanup_verified']:
            report.update(status='environment_error',
                          error={'stage': 'runtime_preflight', 'code': 'preflight_cleanup_failed'})
        report['elapsed_seconds'] = round(time.monotonic()-started, 3)
    return report


def parse_observations(raw, contract):
    rows, visited = [], 0
    def walk(suite, depth=0):
        nonlocal visited
        visited += 1
        if depth > 8 or visited > 32 or not isinstance(suite, dict):
            raise ValueError('invalid_probe_report')
        for spec in suite.get('specs', []):
            tests = spec.get('tests', [])
            if len(tests) != 1 or len(tests[0].get('results', [])) != 1:
                raise ValueError('missing_or_repeated_probe')
            result = tests[0]['results'][0]
            if result.get('status') != 'passed':
                raise ValueError('probe_incomplete')
            found = []
            for output in result.get('stdout', []):
                for line in output.get('text', '').splitlines():
                    if line.startswith(MARKER):
                        found.append(sr._decode(line[len(MARKER):]))
            if len(found) != 1 or found[0].get('id') != spec.get('title'):
                raise ValueError('ambiguous_probe_receipt')
            rows.extend(found)
        for child in suite.get('suites', []):
            walk(child, depth+1)
    if not isinstance(raw, dict) or raw.get('errors'):
        raise ValueError('probe_runner_error')
    for suite in raw.get('suites', []):
        walk(suite)
    expected = {f['id']: f for f in contract['flows']}
    if len(rows) != len(expected) or {r.get('id') for r in rows} != set(expected):
        raise ValueError('probe_coverage_mismatch')
    for row in rows:
        if (set(row) != {'id', 'status', 'phase', 'observation', 'contract_sha256'}
                or row['contract_sha256'] != contract['contract_sha256']
                or row['status'] not in ('pass', 'product_fail', 'unknown')
                or row['phase'] not in ('setup', 'navigate', 'favorite', 'open', 'cancel', 'save', 'reopen')
                or not isinstance(row['observation'], str) or len(row['observation']) > 3000):
            raise ValueError('invalid_probe_receipt')
        row['requirement'] = expected[row['id']]['requirement']
    return rows


class NativeObserver:
    def __init__(self, contract, runtime_root, deadline):
        # Retain exactly this plan for A0 and every candidate; no model regeneration.
        self.encoded = canonical(contract)
        if sr.sha256(canonical({k: v for k, v in contract.items() if k != 'contract_sha256'})) != contract['contract_sha256']:
            raise ValueError('contract_changed')
        self.probe = PROBE.read_bytes()
        if sr.sha256(self.probe) != contract['provenance']['probe_sha256']:
            raise ValueError('probe_changed')
        self.root, self.deadline = Path(runtime_root), deadline
        self.first = True

    def __call__(self, app, output):
        contract = json.loads(self.encoded)
        output = Path(output); output.mkdir(mode=0o700)
        original = source_id(app)
        report = {'schema': 'v3-observation/v1', 'source_sha256': original,
                  'scope': 'model_derived_fixed_probes_only',
                  'contract_sha256': contract['contract_sha256'], 'status': 'environment_error',
                  'official_score': False, 'verified_requirements': [], 'checks': [],
                  'integrity_verified': False, 'cleanup_verified': False}
        try:
            if self.first and original != contract['provenance']['source_sha256']:
                raise ValueError('baseline_plan_source_mismatch')
            self.first = False
            runtime = discover()  # Must precede any generated-code process.
            seconds = min(160, self.deadline-time.monotonic()-2)
            if seconds <= 0:
                raise ValueError('wall_budget_exhausted')
            self.root.mkdir(mode=0o700, exist_ok=True)
            with tempfile.TemporaryDirectory(prefix='observe-', dir=self.root) as tmp:
                tmp = Path(tmp); appcopy = tmp/'app'; appcopy.mkdir(mode=0o700)
                blobs = core.read_template(Path(app))
                for name, data in blobs.items():
                    path = appcopy/name; path.parent.mkdir(parents=True, exist_ok=True)
                    path.write_bytes(data)
                suite = tmp/'probe'; suite.mkdir()
                (suite/'probe.spec.cjs').write_bytes(self.probe)
                (suite/'probe-input.json').write_bytes(self.encoded)
                (suite/'runner.cjs').write_bytes((HERE/'runner.cjs').read_bytes())
                (suite/'config.cjs').write_text('module.exports='+json.dumps({
                    'testDir': '/probe', 'testMatch': 'probe.spec.cjs', 'workers': 1, 'retries': 0,
                    'fullyParallel': False, 'timeout': 20000, 'globalTimeout': 75000,
                    'reporter': 'json', 'outputDir': '/tmp/test-results',
                    'use': {'baseURL': 'http://127.0.0.1:3301', 'headless': True,
                            'trace': 'off', 'video': 'off', 'screenshot': 'off'}})+';\n')
                # launcher is trusted Python; it drops UID before bwrap and sets
                # hard inherited limits. No generated source runs before isolation.
                config = tmp/'launch.json'
                config.write_text(json.dumps({**runtime, 'app': str(appcopy), 'probe': str(suite)}))
                r = _process([sys.executable, '-B', str(HERE/'launch.py'), str(config)],
                             HERE, seconds, env={'PATH': '/usr/local/bin:/usr/bin:/bin', 'LANG': 'C.UTF-8'},
                             max_log=2*1024*1024)
                report['execution'] = {k: r[k] for k in ('exit_code', 'elapsed_seconds', 'reason') if k in r}
                if r.get('reason') or r['exit_code'] != 0:
                    raise ValueError('native_runtime_failed')
                raw = sr._decode(r['output'])
                if not isinstance(raw, dict) or raw.get('status') != 'observed':
                    code = raw.get('code') if isinstance(raw, dict) else None
                    if code not in {'browser_unavailable', 'isolation_unavailable', 'build_failed', 'health_failed', 'probe_failed', 'output_limit'}:
                        code = 'native_runtime_failed'
                    raise ValueError(code)
                report['checks'] = parse_observations(raw['report'], contract)
                report['status'] = next((s for s in ('unknown', 'product_fail')
                    if any(r['status'] == s for r in report['checks'])), 'pass')
            report['cleanup_verified'] = True
        except (OSError, ValueError, KeyError, TypeError, AttributeError, RecursionError) as exc:
            code = str(exc) if isinstance(exc, ValueError) and len(str(exc)) < 80 else 'observer_error'
            report.update(status='environment_error', error={'stage': 'observer', 'code': code},
                          cleanup_verified=not self.root.exists() or not any(self.root.iterdir()))
            report['checks'] = [{'id': f['id'], 'requirement': f['requirement'], 'status': 'environment_error',
                                 'observation': 'No usable independent observation: '+code} for f in contract['flows']]
        report['integrity_verified'] = source_id(app) == original and report['cleanup_verified']
        (output/'observation.json').write_text(sr._json(sr._safe(report))+'\n')
        return report
