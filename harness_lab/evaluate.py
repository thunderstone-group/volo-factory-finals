"""Evaluate a candidate with operator-owned checks in a separate container.

No model calls, downloads, host execution of candidate code, or official submissions.
Both containers have no external network; only the candidate network namespace is
shared. Checks, results, credentials and Docker socket are never mounted in the app.
This protects check integrity, not correctness: calibrate every trusted check suite.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import shutil
import stat
import subprocess
import tempfile
import time
import uuid
from pathlib import Path

SCHEMA = 1
EXCLUDED = {'.git', '.factory', '.arc', 'node_modules', '.venv', '__pycache__', '.DS_Store'}
MAX_TREE_BYTES = 64 * 1024 * 1024
MAX_REPORT_BYTES = 256 * 1024


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'),
                                     ensure_ascii=False).encode()).hexdigest()


def snapshot(source: Path, destination: Path):
    """Copy exact regular-file bytes into a fresh tree, with an auditable manifest.

Caches and secret configuration are not source. Symlinks, hardlinks and special
files are rejected rather than followed. Callers must quiesce the original producer;
only this resulting snapshot, not a subsequently changing original, is evaluated.
"""
    source = source.resolve(strict=True)
    if not source.is_dir() or destination.exists():
        raise ValueError('Source must be a directory and destination must be new')
    if destination.resolve().is_relative_to(source):
        raise ValueError('Snapshot destination must be outside its source')
    destination.mkdir(mode=0o755)
    entries, total = [], 0
    for directory, dirs, names in os.walk(source, followlinks=False):
        dirs[:] = sorted(name for name in dirs if name not in EXCLUDED and not name.startswith('.env'))
        for name in [*dirs, *sorted(names)]:
            if name in EXCLUDED or (name.startswith('.env') and name != '.env.example'):
                continue
            path = Path(directory) / name
            info = path.lstat()
            relative = path.relative_to(source).as_posix()
            if stat.S_ISLNK(info.st_mode):
                raise ValueError('Symlink not allowed in candidate/check snapshot: ' + relative)
            target = destination / relative
            if stat.S_ISDIR(info.st_mode):
                target.mkdir(mode=0o755, exist_ok=True)
                continue
            if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1:
                raise ValueError('Only ordinary unlinked files are accepted: ' + relative)
            if len(entries) >= 5000 or total + info.st_size > MAX_TREE_BYTES:
                raise ValueError('Snapshot exceeds bounded source limits')
            # O_NOFOLLOW closes the common symlink replacement race at file open.
            fd = os.open(path, os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0))
            with os.fdopen(fd, 'rb') as stream:
                opened = os.fstat(stream.fileno())
                if not stat.S_ISREG(opened.st_mode) or opened.st_nlink != 1:
                    raise ValueError('Source changed during snapshot')
                data = stream.read(MAX_TREE_BYTES - total + 1)
            total += len(data)
            if total > MAX_TREE_BYTES:
                raise ValueError('Snapshot exceeds bounded source limits')
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            os.chmod(target, 0o755 if info.st_mode & 0o111 else 0o644)
            entries.append({'path': relative, 'sha256': hashlib.sha256(data).hexdigest(),
                            'executable': bool(info.st_mode & 0o111)})
    if not entries:
        raise ValueError('Empty source/check snapshot')
    entries.sort(key=lambda item: item['path'])
    return {'sha256': digest(entries), 'files': entries, 'bytes': total}


def load_contract(path: Path):
    if path.stat().st_size > 65536:
        raise ValueError('Contract too large')
    value = json.loads(path.read_text())
    allowed = {'schema_version', 'requirements_sha256', 'requirements_file', 'provenance', 'cases',
               'candidate_argv', 'verifier_argv', 'port'}
    if not isinstance(value, dict) or set(value) != allowed or value['schema_version'] != SCHEMA:
        raise ValueError('Unsupported or incomplete verifier contract')
    if not isinstance(value['provenance'], str) or not value['provenance'].strip():
        raise ValueError('Check provenance is required; checks are operator-owned, not generated truth')
    if not isinstance(value['requirements_sha256'], str) or not re.fullmatch('[a-f0-9]{64}', value['requirements_sha256']):
        raise ValueError('Exact requirements SHA-256 is required')
    name = value['requirements_file']
    if not isinstance(name, str) or not name or Path(name).is_absolute():
        raise ValueError('A suite-relative original requirements file is required')
    source = (path.parent / name).resolve(strict=True)
    if not source.is_relative_to(path.parent.resolve()) or not source.is_file():
        raise ValueError('Requirements must remain inside the trusted input snapshot')
    if hashlib.sha256(source.read_bytes()).hexdigest() != value['requirements_sha256']:
        raise ValueError('Requirements bytes do not match the declared fingerprint')
    cases = value['cases']
    if (not isinstance(cases, list) or not 1 <= len(cases) <= 1000 or
            not all(isinstance(item, str) and 0 < len(item) <= 200 for item in cases) or
            len(set(cases)) != len(cases)):
        raise ValueError('Contract needs unique, nonempty expected case IDs')
    for name in ('candidate_argv', 'verifier_argv'):
        args = value[name]
        if (not isinstance(args, list) or not 1 <= len(args) <= 64 or
                not all(isinstance(arg, str) and arg and '\0' not in arg and len(arg) <= 8192 for arg in args)):
            raise ValueError(name + ' must be bounded executable argv')
    if type(value['port']) is not int or not 1024 <= value['port'] <= 65535:
        raise ValueError('Use a nonprivileged application port')
    return value


def assess(raw: str, expected: list[str], exit_code: int):
    """A successful process alone is not evidence. Require every expected case once."""
    if len(raw.encode()) > MAX_REPORT_BYTES:
        raise ValueError('Verifier report too large')
    report = json.loads(raw)
    if not isinstance(report, dict) or set(report) != {'schema_version', 'cases'} or report['schema_version'] != SCHEMA:
        raise ValueError('Verifier must emit exactly one structured case report')
    cases = report['cases']
    if not isinstance(cases, list) or len(cases) != len(expected) or not cases:
        raise ValueError('Empty or incomplete verifier case set')
    seen = set()
    for case in cases:
        if not isinstance(case, dict) or set(case) - {'id', 'status', 'detail'}:
            raise ValueError('Invalid case report')
        name, status = case.get('id'), case.get('status')
        if not isinstance(name, str) or name not in expected or name in seen:
            raise ValueError('Unexpected or duplicate case ID')
        if status not in ('passed', 'failed', 'error', 'skipped'):
            raise ValueError('Unknown case status')
        if 'detail' in case and (not isinstance(case['detail'], str) or len(case['detail']) > 4000):
            raise ValueError('Case details must be bounded text')
        seen.add(name)
    statuses = [case['status'] for case in cases]
    if exit_code != 0 or 'error' in statuses:
        status = 'error'
    elif 'failed' in statuses:
        status = 'failed'
    elif 'skipped' in statuses:
        status = 'incomplete'
    else:
        status = 'passed'
    return {'status': status, 'cases': cases, 'passed': statuses.count('passed'),
            'expected': len(expected), 'verifier_exit_code': exit_code}


def evaluate(candidate: Path, suite: Path, image: str, *, timeout=90):
    """Trusted suite/contract + quiescent candidate -> snapshot-bound local evidence.

The image must already exist locally. Tags resolve once to an exact local image ID.
The timeout bounds execution; cleanup has a separate bounded ten seconds per container.
No unsafe host fallback exists when Docker or a required runtime/browser is missing.
"""
    if not math.isfinite(timeout) or not 1 <= timeout <= 3600:
        raise ValueError('Use a finite timeout from 1 to 3600 seconds')
    candidate, suite = candidate.resolve(strict=True), suite.resolve(strict=True)
    if candidate.is_relative_to(suite) or suite.is_relative_to(candidate):
        raise ValueError('Candidate and trusted suite must be disjoint directories')
    if not shutil.which('docker'):
        raise RuntimeError('Docker required; refusing host execution of candidate code')
    started = time.monotonic()
    deadline = started + timeout
    names = []
    result = {'schema_version': SCHEMA, 'kind': 'local_external_verification',
              'official_evaluation': 'not_run', 'status': 'error', 'model_api_calls': 0,
              'isolation': 'separate filesystem/PID containers; shared network namespace with network=none',
              'source_exclusions': sorted(EXCLUDED) + ['.env* except .env.example']}
    result['orchestrator_sha256'] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    result['limits'] = {'cpu_per_container': 1, 'memory_bytes_per_container': 536870912,
                        'execution_seconds': timeout, 'cleanup_seconds_per_container': 10}
    with tempfile.TemporaryDirectory(prefix='volo-verifier-') as directory:
        root = Path(directory)
        serial = 0

        def command(args, *, cleanup=False):
            nonlocal serial
            serial += 1
            remaining = 10 if cleanup else deadline - time.monotonic()
            if remaining <= 0:
                raise TimeoutError('External verification budget exhausted')
            out, err = root / f'{serial}.out', root / f'{serial}.err'
            with out.open('wb') as stdout, err.open('wb') as stderr:
                run = subprocess.run(['docker', *args], stdout=stdout, stderr=stderr,
                                     timeout=remaining, check=False)
            if out.stat().st_size > MAX_REPORT_BYTES:
                raise ValueError('Container output exceeds report limit')
            return run.returncode, out.read_text(errors='replace'), err.read_text(errors='replace')[-4000:]

        try:
            result['candidate'] = snapshot(candidate, root / 'candidate')
            result['suite'] = snapshot(suite, root / 'suite')
            contract = load_contract(root / 'suite/contract.json')
            result['contract_sha256'] = digest(contract)
            result['requirements_sha256'] = contract['requirements_sha256']
            result['provenance'] = contract['provenance']
            code, output, error = command(['image', 'inspect', image, '--format', '{{.Id}}'])
            image_id = output.strip()
            if code or not re.fullmatch('sha256:[a-f0-9]{64}', image_id):
                raise RuntimeError('Required local image unavailable: ' + error)
            result['image_id'] = image_id
            common = ['--pull=never', '--read-only', '--cap-drop=ALL', '--security-opt',
                      'no-new-privileges', '--user', '65534:65534', '--pids-limit', '128',
                      '--memory', '512m', '--cpus', '1', '--tmpfs', '/tmp:rw,size=64m,mode=1777',
                      '--log-driver', 'json-file', '--log-opt', 'max-size=1m', '--log-opt', 'max-file=1']
            clean_env = ['-i', 'PATH=/usr/local/bin:/usr/bin:/bin', 'HOME=/tmp',
                         'PYTHONDONTWRITEBYTECODE=1']
            token = uuid.uuid4().hex[:16]
            app, verifier = 'volo-app-' + token, 'volo-check-' + token
            names.append(app)
            code, _, error = command(['run', '-d', '--name', app, *common, '--network', 'none',
                                      '--tmpfs', '/work:rw,size=256m,mode=1777',
                                      '--mount', f'type=bind,src={root / "candidate"},dst=/candidate,readonly',
                                      '--entrypoint', '/usr/bin/env', image_id, *clean_env,
                                      f'PORT={contract["port"]}', '/bin/sh', '-c',
                                      'cp -R /candidate/. /work/ && cd /work && exec "$@"',
                                      'candidate', *contract['candidate_argv']])
            if code:
                raise RuntimeError('Candidate container did not start: ' + error)
            names.append(verifier)
            code, output, error = command(['run', '--name', verifier, *common,
                                          '--network', 'container:' + app,
                                          '--mount', f'type=bind,src={root / "suite"},dst=/suite,readonly',
                                          '--workdir', '/suite', '--entrypoint', '/usr/bin/env',
                                          image_id, *clean_env,
                                          f'BASE_URL=http://127.0.0.1:{contract["port"]}',
                                          *contract['verifier_argv']])
            inspection_code, inspection, inspection_error = command(['inspect', app, verifier])
            if inspection_code:
                raise RuntimeError('Cannot attest container separation: ' + inspection_error)
            specs = json.loads(inspection)
            app_spec, check_spec = specs
            proof = []
            for spec in specs:
                host = spec['HostConfig']
                entry = {'network': host['NetworkMode'], 'readonly_root': host['ReadonlyRootfs'],
                         'privileged': host['Privileged'], 'pid_mode': host['PidMode'],
                         'user': spec['Config']['User'],
                         'bind_mounts': [{'destination': m['Destination'], 'writable': m['RW']}
                                         for m in spec['Mounts'] if m['Type'] == 'bind']}
                if not entry['readonly_root'] or entry['privileged'] or entry['pid_mode'] or entry['user'] != '65534:65534':
                    raise RuntimeError('Observed container protection differs from requested boundary')
                proof.append(entry)
            if (proof[0]['network'] != 'none' or
                    proof[1]['network'] != 'container:' + app_spec['Id'] or
                    proof[0]['bind_mounts'] != [{'destination': '/candidate', 'writable': False}] or
                    proof[1]['bind_mounts'] != [{'destination': '/suite', 'writable': False}]):
                raise RuntimeError('Observed network/mount separation differs from requested boundary')
            # Do not persist random container IDs or host mount paths as reproducibility identity.
            proof[1]['network'] = 'candidate-network-namespace'
            result['isolation_attestation'] = proof
            result.update(assess(output, contract['cases'], code))
            if error:
                result['verifier_stderr'] = error
        except (OSError, ValueError, RuntimeError, subprocess.TimeoutExpired) as exc:
            result.update(status='error', error_type=type(exc).__name__, error=str(exc)[:4000])
        finally:
            result['cleanup_errors'] = []
            for name in reversed(names):
                try:
                    code, _, error = command(['rm', '-f', name], cleanup=True)
                    if code and 'No such container' not in error:
                        result['cleanup_errors'].append(error or 'container removal failed')
                except (OSError, ValueError, subprocess.TimeoutExpired) as exc:
                    result['cleanup_errors'].append(str(exc)[:1000])
            if result['cleanup_errors']:
                result['status'] = 'error'
    result['seconds'] = round(time.monotonic() - started, 3)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--candidate', type=Path, required=True)
    parser.add_argument('--suite', type=Path, required=True)
    parser.add_argument('--image', required=True, help='Existing image ID/tag; never auto-pulled')
    parser.add_argument('--timeout', type=float, default=90)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    if args.output and any(args.output.resolve().is_relative_to(path.resolve()) for path in (args.candidate, args.suite)):
        parser.error('Evidence output must be outside both input trees')
    result = evaluate(args.candidate, args.suite, args.image, timeout=args.timeout)
    text = json.dumps(result, ensure_ascii=False, indent=2) + '\n'
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        # Explicit opt-in output file, never overwrite a previous experiment silently.
        with args.output.open('x') as stream:
            os.chmod(args.output, 0o600)
            stream.write(text)
    print(text, end='')
    return 0 if result['status'] == 'passed' else 1


if __name__ == '__main__':
    raise SystemExit(main())
