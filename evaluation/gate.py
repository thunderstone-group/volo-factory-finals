"""Run a pinned developer check suite outside a candidate's writable workspace.

This is an evidence/protocol boundary, NOT an OS sandbox or a semantic oracle.
The operator must calibrate checks and supply an isolated running application.
No candidate code is imported, built, started, or modified by this module.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import platform
import signal
import subprocess
import tempfile
import time
from pathlib import Path
from urllib.parse import urlsplit

IGNORED = {'.git', '.factory', '__pycache__', '.venv', 'node_modules'}
OUTPUT_LIMIT = 1024 * 1024


def digest_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def tree_digest(root: Path) -> str:
    """Hash a frozen snapshot, including tests/build output but not dependency caches."""
    root = root.resolve(strict=True)
    if not root.is_dir():
        raise ValueError('Snapshot must be a directory')
    rows = []
    for directory, dirs, files in os.walk(root):
        dirs[:] = sorted(name for name in dirs if name not in IGNORED)
        for name in dirs + files:
            path = Path(directory) / name
            if path.is_symlink():
                raise ValueError('Snapshot symlinks are not supported')
        for name in sorted(files):
            path = Path(directory) / name
            if not path.is_file():
                raise ValueError('Snapshot must contain only regular files')
            rows.append([path.relative_to(root).as_posix(), digest_file(path)])
    return hashlib.sha256(json.dumps(sorted(rows), separators=(',', ':')).encode()).hexdigest()


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('Duplicate JSON object key')
        result[key] = value
    return result


def parse_json(raw):
    return json.loads(raw, object_pairs_hook=unique_object)


def identifiers(values):
    if (not isinstance(values, list) or not values
            or any(not isinstance(v, str) or not v.strip() for v in values)
            or len(set(values)) != len(values)):
        raise ValueError('Expected nonempty unique identifiers')
    return set(values)


def sha(value):
    return isinstance(value, str) and len(value) == 64 and all(c in '0123456789abcdef' for c in value)


def inside(path: Path, root: Path) -> bool:
    return path == root or path.is_relative_to(root)


class Gate:
    def __init__(self, manifest: Path):
        if manifest.is_symlink():
            raise ValueError('Manifest symlink is not allowed')
        self.path = manifest.resolve(strict=True)
        self.root = self.path.parent
        raw = self.path.read_bytes()
        self.fingerprint = hashlib.sha256(raw).hexdigest()
        self.spec = parse_json(raw)
        spec = self.spec
        if not isinstance(spec, dict) or spec.get('schema_version') != 1:
            raise ValueError('Unsupported contract schema')
        if not sha(spec.get('requirements_sha256')):
            raise ValueError('A requirements snapshot hash is required')
        self.requirements = identifiers(spec.get('requirement_ids'))
        cases = spec.get('cases')
        if not isinstance(cases, list) or not cases:
            raise ValueError('Contract must declare at least one scenario')
        self.cases = {}
        for case in cases:
            if not isinstance(case, dict):
                raise ValueError('Invalid scenario declaration')
            key = case.get('id')
            if not isinstance(key, str) or not key.strip() or key in self.cases:
                raise ValueError('Scenario ids must be nonempty and unique')
            covered = identifiers(case.get('requirement_ids'))
            if not covered <= self.requirements:
                raise ValueError('Scenario refers to unknown requirements')
            self.cases[key] = covered
        if set().union(*self.cases.values()) != self.requirements:
            raise ValueError('Declared requirement has no scenario')
        argv = spec.get('argv')
        if (not isinstance(argv, list) or len(argv) < 2
                or any(not isinstance(arg, str) or not arg or '\x00' in arg for arg in argv)):
            raise ValueError('argv must contain an absolute interpreter and a pinned script')
        executable = Path(argv[0])
        if not executable.is_absolute() or not executable.is_file():
            raise ValueError('Use an installed absolute interpreter path')
        self.executable = executable.resolve(strict=True)
        self.executable_hash = digest_file(self.executable)
        files = spec.get('files')
        if not isinstance(files, dict) or not files or argv[1] not in files:
            raise ValueError('The suite entrypoint and dependencies must be pinned')
        self.files = {}
        for name, expected in files.items():
            relative = Path(name)
            if relative.is_absolute() or '..' in relative.parts or not sha(expected):
                raise ValueError('Invalid pinned check path/hash')
            path = self.root / relative
            if any(part.is_symlink() for part in [path, *path.parents] if inside(part, self.root)):
                raise ValueError('Check symlinks are not allowed')
            path = path.resolve(strict=True)
            if not inside(path, self.root) or not path.is_file() or path == self.path:
                raise ValueError('Check path escapes its suite')
            self.files[path] = expected
        # Preserve the invocation path: resolving a venv Python symlink would
        # silently discard its virtual environment and change dependency resolution.
        self.argv = [str(executable), *argv[1:]]
        self.assert_unchanged()

    def assert_unchanged(self):
        if self.path.is_symlink() or digest_file(self.path) != self.fingerprint:
            raise ValueError('Acceptance manifest changed')
        for path, expected in self.files.items():
            if (path.is_symlink() or path.resolve() != path or not path.is_file()
                    or digest_file(path) != expected):
                raise ValueError('Pinned acceptance file changed')
        if (Path(self.argv[0]).resolve(strict=True) != self.executable
                or digest_file(self.executable) != self.executable_hash):
            raise ValueError('Acceptance interpreter changed')

    def _run(self, url, timeout):
        with tempfile.TemporaryDirectory(prefix='volo-external-check-') as temp:
            env = {'PATH': os.environ.get('PATH', os.defpath), 'HOME': temp, 'TMPDIR': temp,
                   'LANG': 'C.UTF-8', 'PYTHONNOUSERSITE': '1', 'PYTHONDONTWRITEBYTECODE': '1',
                   'FACTORY_BASE_URL': url, 'E2E_BASE_URL': url, 'PLAYWRIGHT_BASE_URL': url}
            with open(Path(temp) / 'stdout', 'w+b') as out, open(Path(temp) / 'stderr', 'w+b') as err:
                process = subprocess.Popen(self.argv, cwd=self.root, env=env,
                                           stdin=subprocess.DEVNULL, stdout=out, stderr=err,
                                           start_new_session=True)
                deadline = time.monotonic() + timeout
                try:
                    while process.poll() is None:
                        if os.fstat(out.fileno()).st_size + os.fstat(err.fileno()).st_size > OUTPUT_LIMIT:
                            raise ValueError('Acceptance output limit exceeded')
                        if time.monotonic() >= deadline:
                            raise TimeoutError('Acceptance timed out')
                        time.sleep(0.02)
                    if os.fstat(out.fileno()).st_size + os.fstat(err.fileno()).st_size > OUTPUT_LIMIT:
                        raise ValueError('Acceptance output limit exceeded')
                    out.seek(0)
                    return process.returncode, out.read(OUTPUT_LIMIT + 1)
                finally:
                    # Clean up descendants even when their immediate parent has exited.
                    try:
                        os.killpg(process.pid, signal.SIGTERM)
                    except ProcessLookupError:
                        pass
                    try:
                        process.wait(timeout=0.5)
                    except subprocess.TimeoutExpired:
                        pass
                    try:
                        os.killpg(process.pid, signal.SIGKILL)
                    except ProcessLookupError:
                        pass
                    process.wait(timeout=2)

    def evaluate(self, candidate: Path, requirements: Path, base_url: str, *, timeout=120):
        started = time.monotonic()
        report = {'schema_version': 1, 'status': 'error', 'accepted': False,
                  'verification_scope': 'developer_contract', 'official_evaluation': 'not_run',
                  'verified_requirements': [], 'unverified_requirements': sorted(self.requirements),
                  'contract_sha256': self.fingerprint, 'cases': [],
                  'environment': {'platform': platform.platform(), 'interpreter_sha256': self.executable_hash},
                  'application_binding': 'caller_supplied_url_not_attested',
                  'calibration': 'operator_responsibility_not_automatically_established'}
        try:
            if not isinstance(timeout, (int, float)) or not math.isfinite(timeout) or not 0 < timeout <= 3600:
                raise ValueError('Timeout must be finite and in (0, 3600]')
            candidate, requirements = candidate.resolve(strict=True), requirements.resolve(strict=True)
            if any(inside(a, b) or inside(b, a) for a, b in
                   [(self.root, candidate), (self.root, requirements), (candidate, requirements)]):
                raise ValueError('Check suite, frozen candidate and requirements must be disjoint')
            url = urlsplit(base_url)
            if (url.scheme != 'http' or url.hostname not in ('127.0.0.1', 'localhost', '::1')
                    or url.username or url.password or url.query or url.fragment or url.port is None):
                raise ValueError('Use an explicit loopback HTTP application URL with a port')
            self.assert_unchanged()
            report['candidate_sha256'] = tree_digest(candidate)
            report['requirements_sha256'] = tree_digest(requirements)
            if report['requirements_sha256'] != self.spec['requirements_sha256']:
                raise ValueError('Requirements snapshot does not match acceptance contract')
            code, raw = self._run(base_url, timeout)
            report['exit_code'] = code
            report['result_sha256'] = hashlib.sha256(raw).hexdigest()
            self.assert_unchanged()
            if report['candidate_sha256'] != tree_digest(candidate):
                raise ValueError('Frozen candidate changed during evaluation')
            if report['requirements_sha256'] != tree_digest(requirements):
                raise ValueError('Requirements changed during evaluation')
            value = parse_json(raw)
            cases = value.get('cases') if isinstance(value, dict) else None
            if not isinstance(cases, list) or not cases:
                raise ValueError('No executed scenario results')
            results = {}
            for case in cases:
                if not isinstance(case, dict):
                    raise ValueError('Invalid scenario result')
                key, status = case.get('id'), case.get('status')
                if not isinstance(key, str) or key not in self.cases or key in results:
                    raise ValueError('Unknown or duplicate scenario result')
                if status not in ('passed', 'failed', 'error', 'skipped'):
                    raise ValueError('Invalid scenario status')
                evidence = case.get('evidence')
                if not isinstance(evidence, str) or not evidence.strip():
                    raise ValueError('Scenario result has no evidence')
                results[key] = {'id': key, 'status': status, 'evidence': evidence[:4000]}
            if set(results) != set(self.cases):
                raise ValueError('Missing declared scenario results')
            report['cases'] = [results[key] for key in self.cases]
            if code not in (0, 1) or (code != 0 and all(r['status'] == 'passed' for r in results.values())):
                raise ValueError('Evaluator process failed or contradicted its report')
            verified = [req for req in self.requirements if all(
                results[key]['status'] == 'passed' for key, reqs in self.cases.items() if req in reqs)]
            report['verified_requirements'] = sorted(verified)
            report['unverified_requirements'] = sorted(self.requirements - set(verified))
            report['accepted'] = len(verified) == len(self.requirements) and code == 0
            report['status'] = ('passed' if report['accepted'] else 'incomplete' if any(
                r['status'] in ('skipped', 'error') for r in results.values()) else 'failed')
        except (OSError, ValueError, TypeError, TimeoutError, subprocess.SubprocessError) as exc:
            report['error'] = str(exc)
        report['seconds'] = round(time.monotonic() - started, 3)
        return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--contract', type=Path, required=True)
    parser.add_argument('--candidate', type=Path, required=True, help='Frozen snapshot, separate from runtime state')
    parser.add_argument('--requirements', type=Path, required=True)
    parser.add_argument('--base-url', required=True, help='Already running, operator-isolated application')
    parser.add_argument('--timeout', type=float, default=120)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    try:
        gate = Gate(args.contract)
        if args.output:
            output = args.output.resolve()
            if args.output.is_symlink() or any(inside(output, root.resolve()) for root in
                                             (args.candidate, args.requirements, gate.root)):
                raise ValueError('Report must be outside all three input snapshots')
        report = gate.evaluate(args.candidate, args.requirements, args.base_url, timeout=args.timeout)
        text = json.dumps(report, ensure_ascii=False, indent=2) + '\n'
        if args.output:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            with tempfile.NamedTemporaryFile(mode='w', dir=args.output.parent, delete=False) as stream:
                stream.write(text)
                temp = Path(stream.name)
            temp.replace(args.output)
        print(text, end='')
        return 0 if report['accepted'] else 1
    except (OSError, ValueError) as exc:
        print(json.dumps({'status': 'error', 'accepted': False, 'error': str(exc)}))
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
