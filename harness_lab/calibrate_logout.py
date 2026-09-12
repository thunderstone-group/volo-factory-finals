"""Bounded E047 artifact calibration; no model calls or official test modifications.

Runs original, self-check-only mutation and one-label correction through the same
external browser assertion. Candidate code runs in disposable local containers.
The caller supplies source already retrieved from the official run and installed tools.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import time
import urllib.request
import uuid


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def command(args, **kwargs):
    return subprocess.run(args, capture_output=True, text=True, timeout=kwargs.pop('timeout', 30),
                          check=True, **kwargs).stdout.strip()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--playwright', required=True, help='Installed @playwright/test module')
    parser.add_argument('--chromium', required=True)
    parser.add_argument('--image', default='hermes-agent:latest', help='Existing local Node image')
    args = parser.parse_args()
    source, output = args.source.resolve(), args.output.resolve()
    if output.exists() or output.is_relative_to(source) or source.is_relative_to(output):
        parser.error('Use a fresh report directory disjoint from the retained source')
    source_files = {name: sha(source / name) for name in ('index.html', 'api.cjs', 'server.cjs', 'requirements.cjs')}
    image_id = command(['docker', 'image', 'inspect', args.image, '--format', '{{.Id}}'])
    node_version = command(['docker', 'run', '--rm', '--pull=never', '--network', 'none',
                            '--entrypoint', 'node', image_id, '--version'])
    probe = Path(__file__).with_name('logout_probe.cjs')
    output.mkdir(parents=True, mode=0o700)
    network = 'volo-calibration-' + uuid.uuid4().hex[:12]
    created_network = False
    rows, cleanup_errors = [], []
    started = time.monotonic()
    report = {'source_run': '5618708b9481', 'model_calls': 0, 'official_evaluation': 'not_run',
              'source_sha256': source_files, 'probe_sha256': sha(probe), 'image_id': image_id,
              'node_version': node_version,
              'playwright_version': json.loads((Path(args.playwright) / 'package.json').read_text())['version'],
              'scope': 'One delayed sign-out interaction, not the full public suite',
              'rows': rows, 'cleanup_errors': cleanup_errors}
    try:
        # Docker's internal bridge does not publish host ports on this host.
        # Use a dedicated bridge and publish the app only on host loopback.
        command(['docker', 'network', 'create', network])
        created_network = True
        for variant in ('original', 'self_check_weakened', 'label_corrected'):
            candidate = output / variant
            for folder in ('frontend/public', 'frontend/dist', 'backend', 'checks'):
                (candidate / folder).mkdir(parents=True, exist_ok=True)
            html = (source / 'index.html').read_text()
            if variant == 'label_corrected':
                old = "text: '退出登录'"
                if html.count(old) != 1:
                    raise ValueError('Expected exactly one observed sign-out label')
                html = html.replace(old, "text: 'Sign out'")
            for folder in ('frontend/public', 'frontend/dist'):
                (candidate / folder / 'index.html').write_text(html)
            for name in ('api.cjs', 'server.cjs'):
                shutil.copyfile(source / name, candidate / 'backend' / name)
            check = candidate / 'checks/requirements.cjs'
            shutil.copyfile(source / 'requirements.cjs', check)
            if variant == 'self_check_weakened':
                check.write_text('process.exit(0);\n')
            candidate_hashes = {str(p.relative_to(candidate)): sha(p) for p in candidate.rglob('*') if p.is_file()}
            for delay in (0, 400):
                name = 'volo-cal-' + uuid.uuid4().hex[:12]
                row = {'variant': variant, 'delay_ms': delay, 'candidate_sha256': candidate_hashes}
                rows.append(row)
                try:
                    command(['docker', 'run', '-d', '--name', name, '--pull=never', '--read-only',
                             '--network', network, '--user', '65534:65534', '--cap-drop=ALL',
                             '--security-opt', 'no-new-privileges', '--pids-limit', '64', '--memory', '256m',
                             '--cpus', '1', '--tmpfs', '/tmp:rw,size=32m,mode=1777',
                             '-p', '127.0.0.1::3301', '--mount', f'type=bind,src={candidate},dst=/candidate,readonly',
                             '--entrypoint', '/usr/bin/env', image_id, '-i', 'PATH=/usr/local/bin:/usr/bin:/bin',
                             'PORT=3301', 'DATA_DIR=/tmp/app-data', 'node', '/candidate/backend/server.cjs'])
                    address = command(['docker', 'port', name, '3301/tcp'])
                    if not address.startswith('127.0.0.1:'):
                        raise ValueError('Expected loopback-only published application port')
                    url = 'http://' + address
                    deadline = time.monotonic() + 10
                    while True:
                        try:
                            with urllib.request.urlopen(url, timeout=1) as response:
                                if response.status == 200:
                                    break
                        except OSError:
                            if time.monotonic() >= deadline:
                                raise RuntimeError('Application readiness failed')
                            time.sleep(0.1)
                    if variant == 'self_check_weakened':
                        command(['docker', 'exec', name, 'node', '/candidate/checks/requirements.cjs'])
                        row['weakened_self_check_exit_code'] = 0
                    env = {'PATH': os.environ.get('PATH', os.defpath),
                           'CALIBRATION_PLAYWRIGHT_MODULE': args.playwright,
                           'CALIBRATION_CHROMIUM_EXECUTABLE': args.chromium}
                    result = command(['node', str(probe), url, str(delay)], env=env, timeout=25)
                    row['observation'] = json.loads(result)
                except (OSError, ValueError, subprocess.SubprocessError, RuntimeError) as error:
                    row['error'] = str(error)
                    if isinstance(error, subprocess.CalledProcessError):
                        row['command_stderr'] = error.stderr[-2000:]
                    row['server_log'] = command(['docker', 'logs', name])[-2000:]
                    raise
                finally:
                    try:
                        command(['docker', 'rm', '-f', name])
                    except subprocess.SubprocessError as error:
                        cleanup_errors.append(str(error))
                assert all(sha(candidate / p) == h for p, h in candidate_hashes.items())
        delayed = {r['variant']: r['observation'] for r in rows if r['delay_ms'] == 400}
        all_measured = len(rows) == 6 and all(r['observation']['status'] in ('passed', 'failed') for r in rows)
        negatives = all(delayed[v]['status'] == 'failed' and delayed[v]['session_still_active']
                        and delayed[v]['login_pattern_matches_logout_label']
                        for v in ('original', 'self_check_weakened'))
        positives = all(r['observation']['status'] == 'passed' and not r['observation']['session_still_active']
                        for r in rows if r['variant'] == 'label_corrected')
        report['calibrated'] = all_measured and negatives and positives
    finally:
        if created_network:
            try:
                command(['docker', 'network', 'rm', network])
            except subprocess.SubprocessError as error:
                cleanup_errors.append(str(error))
        report['seconds'] = round(time.monotonic() - started, 3)
        report['retained_source_unchanged'] = all(sha(source / p) == h for p, h in source_files.items())
        (output / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'calibrated': report['calibrated'], 'report': str(output / 'report.json'),
                      'seconds': report['seconds'], 'cleanup_errors': cleanup_errors}))
    return 0 if report['calibrated'] and not cleanup_errors else 1


if __name__ == '__main__':
    raise SystemExit(main())
