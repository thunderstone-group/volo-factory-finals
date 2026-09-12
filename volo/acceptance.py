"""Operator-supplied, hash-pinned acceptance outside the generated application.

Runs ordinary flat node:test cases (which may use the supplied Playwright module).
The worker cannot select the assertions or manufacture results by printing JSON:
only the parent Node test runner's events are interpreted. This is NOT an OS sandbox;
run untrusted applications under separate permissions/containers in production.
"""
from __future__ import annotations

import hashlib
import json
import math
import os
import re
import shutil
import signal
import subprocess
import tempfile
import time
from pathlib import Path
from urllib.parse import urlparse


REPORTER = r"""module.exports=async function*(events){
  for await(const {type,data} of events){
    if(type!=='test:pass'&&type!=='test:fail')continue;
    yield JSON.stringify({type,name:data.name,file:data.file,nesting:data.nesting,
      kind:data.details?.type,skip:data.skip!==undefined,todo:data.todo!==undefined,
      error:String(data.details?.error?.cause?.message||data.details?.error?.message||'').slice(0,4000)})+'\n';
  }
};
"""
MAX_REPORT = 2 * 1024 * 1024


class AcceptanceUnavailable(RuntimeError):
    """Broken or incomplete authority is not a product defect for the model to repair."""


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def relative_file(root, name):
    if (not isinstance(name, str) or not name or Path(name).is_absolute()
            or any(p in ('.', '..') for p in name.split('/')) or '\\' in name):
        raise ValueError('Acceptance files must be unambiguous relative paths')
    current = root
    for part in Path(name).parts:
        current = current / part
        if current.is_symlink():
            raise ValueError('Acceptance symlinks are not allowed: ' + name)
    if not current.resolve().is_relative_to(root):
        raise ValueError('Acceptance path escapes its root')
    return current


class AcceptanceSuite:
    """Immutable interpretation of a reviewed manifest, never generated implicitly."""
    def __init__(self, manifest, application_root, requirement_fingerprint, requirement_ids):
        original = Path(manifest).absolute()
        if any(p.is_symlink() for p in (original, *original.parents)):
            # /var on macOS is an OS alias; callers should supply resolve()d paths.
            raise ValueError('Resolve the acceptance manifest path before loading; symlinks are not accepted')
        self.path = original.resolve()
        self.root = self.path.parent
        app = Path(application_root).resolve()
        if self.root.is_relative_to(app) or app.is_relative_to(self.root):
            raise ValueError('Acceptance and application must be separate, non-nested directories')
        if self.path.stat().st_size > 256000:
            raise ValueError('Acceptance manifest too large')
        self.raw = self.path.read_bytes()
        data = json.loads(self.raw)
        if not isinstance(data, dict) or data.get('version') != 1:
            raise ValueError('Unsupported acceptance manifest version')
        if data.get('requirement_fingerprint') != requirement_fingerprint:
            raise ValueError('Acceptance requirements fingerprint does not match the input')
        self.requirement_fingerprint = requirement_fingerprint
        self.requirement_ids = frozenset(requirement_ids)
        files, cases = data.get('files'), data.get('cases')
        if not isinstance(files, dict) or not 1 <= len(files) <= 64:
            raise ValueError('Acceptance needs 1-64 pinned files')
        if not isinstance(cases, list) or not 1 <= len(cases) <= 200:
            raise ValueError('Acceptance needs 1-200 declared cases; empty suites cannot pass')
        self.files = {}
        for name, sha in files.items():
            if name == '__volo_reporter.cjs' or not isinstance(sha, str) or not re.fullmatch('[0-9a-f]{64}', sha):
                raise ValueError('Invalid acceptance file hash or reserved filename')
            file = relative_file(self.root, name)
            if file.stat().st_size > MAX_REPORT:
                raise ValueError('Acceptance file exceeds size limit')
            content = file.read_bytes()
            if digest(content) != sha:
                raise ValueError('Acceptance file hash mismatch: ' + name)
            self.files[name] = content
        self.cases = []
        identifiers, names = set(), set()
        for case in cases:
            if not isinstance(case, dict):
                raise ValueError('Acceptance case must be an object')
            for key in ('id', 'file', 'name', 'source'):
                value = case.get(key)
                if not isinstance(value, str) or not value or len(value) > 500 or '\n' in value:
                    raise ValueError('Acceptance case needs a bounded ' + key)
            reqs = case.get('requirements')
            if (not isinstance(reqs, list) or not reqs or not all(isinstance(r, str) for r in reqs)
                    or len(set(reqs)) != len(reqs) or not set(reqs) <= self.requirement_ids):
                raise ValueError('Acceptance case references missing or duplicate requirements')
            if case['file'] not in self.files or not case['file'].endswith(('.js', '.cjs', '.mjs')):
                raise ValueError('Acceptance test entrypoint must be a pinned JavaScript file')
            if case['id'] in identifiers or (case['file'], case['name']) in names:
                raise ValueError('Duplicate acceptance case identity')
            identifiers.add(case['id'])
            names.add((case['file'], case['name']))
            self.cases.append({k: case[k] for k in ('id', 'file', 'name', 'source', 'requirements')})
        self.fingerprint = digest(self.raw)

    def assert_integrity(self):
        if any(p.is_symlink() for p in (self.path, *self.path.parents)) or self.path.read_bytes() != self.raw:
            raise ValueError('Acceptance manifest changed after loading')
        for name, content in self.files.items():
            if relative_file(self.root, name).read_bytes() != content:
                raise ValueError('Acceptance file changed after loading: ' + name)

    def run(self, base_url, requirement_ids, *, timeout, extra_env=None):
        """Return per-case evidence, never infer success from an exit code alone."""
        from .workspace import tool_environment
        started = time.monotonic()
        scope = frozenset(requirement_ids)
        if not scope or not scope <= self.requirement_ids:
            raise ValueError('Acceptance scope must name actual input requirements')
        parsed = urlparse(base_url)
        if (parsed.scheme != 'http' or parsed.hostname not in ('127.0.0.1', 'localhost', '::1')
                or parsed.username or parsed.password or parsed.query or parsed.fragment):
            raise ValueError('Acceptance expects a credential-free local HTTP application URL')
        selected = [c for c in self.cases if set(c['requirements']) <= scope]
        evidence = {'passed': False, 'status': 'unverified', 'cases': [], 'verified_requirements': [],
                    'requirement_fingerprint': self.requirement_fingerprint,
                    'contract_fingerprint': self.fingerprint, 'reporter_fingerprint': digest(REPORTER.encode()),
                    'requested_requirements': sorted(scope), 'official_evaluation': 'not_performed',
                    'isolation': 'separate-suite-process; OS isolation must be supplied by the caller'}
        if not math.isfinite(timeout) or timeout <= 0:
            return {**evidence, 'status': 'error', 'error': 'No finite positive acceptance time remains'}
        env = tool_environment(extra_env)
        for key in ('NODE_OPTIONS', 'NODE_PATH', 'NODE_V8_COVERAGE', 'NODE_TEST_CONTEXT'):
            env.pop(key, None)
        env.update({'FACTORY_BASE_URL': base_url, 'E2E_BASE_URL': base_url, 'PLAYWRIGHT_BASE_URL': base_url})
        try:
            self.assert_integrity()
            if not selected:
                return {**evidence, 'error': 'No acceptance cases cover the current scope'}
            node = shutil.which('node')
            if not node:
                raise ValueError('Installed Node is required for acceptance')
            remaining = timeout - (time.monotonic() - started)
            if remaining <= 0:
                raise ValueError('Acceptance budget exhausted during preparation')
            evidence['node_version'] = subprocess.check_output([node, '--version'], env=env,
                text=True, timeout=min(5, remaining)).strip()
            with tempfile.TemporaryDirectory(prefix='volo-acceptance-') as temp:
                root = Path(temp).resolve()
                for name, content in self.files.items():
                    p = root / name
                    p.parent.mkdir(parents=True, exist_ok=True)
                    p.write_bytes(content)
                reporter = root / '__volo_reporter.cjs'
                reporter.write_text(REPORTER)
                # Flat named cases make exact selection and duplicate detection explicit.
                pattern = '^(?:' + '|'.join(re.escape(c['name']) for c in selected) + ')$'
                argv = [node, '--test', '--test-concurrency=1', '--test-name-pattern=' + pattern,
                        '--test-reporter=' + str(reporter),
                        *[str(root / f) for f in sorted({c['file'] for c in selected})]]
                with tempfile.TemporaryFile() as stdout, tempfile.TemporaryFile() as stderr:
                    if time.monotonic() - started >= timeout:
                        raise ValueError('Acceptance budget exhausted before test execution')
                    process = subprocess.Popen(argv, cwd=root, env=env, stdout=stdout, stderr=stderr,
                                               start_new_session=True)
                    timed_out = False
                    try:
                        process.wait(timeout=max(0.01, timeout - (time.monotonic() - started)))
                    except subprocess.TimeoutExpired:
                        timed_out = True
                    finally:
                        # Also remove descendants after a normally exited test parent.
                        try:
                            os.killpg(process.pid, signal.SIGKILL)
                        except ProcessLookupError:
                            pass
                        process.wait(timeout=3)
                    stdout.seek(0)
                    raw = stdout.read(MAX_REPORT + 1)
                    stderr.seek(max(0, stderr.seek(0, 2) - 4000))
                    evidence.update(exit_code=process.returncode, timed_out=timed_out,
                                    stderr=stderr.read().decode(errors='replace'),
                                    report_fingerprint=digest(raw), node_executable=node)
                self.assert_integrity()
                if reporter.read_text() != REPORTER or any((root / n).read_bytes() != b for n, b in self.files.items()):
                    raise ValueError('Acceptance snapshot changed during execution')
                if timed_out or len(raw) > MAX_REPORT:
                    return {**evidence, 'status': 'error', 'error': 'Acceptance timed out or exceeded report size'}
                events = [json.loads(line) for line in raw.decode().splitlines() if line.strip()]
                observed = {}
                for event in events:
                    if not isinstance(event, dict) or event.get('type') not in ('test:pass', 'test:fail'):
                        raise ValueError('Malformed acceptance runner event')
                    file = Path(event.get('file') or '').resolve()
                    if not file.is_relative_to(root):
                        continue
                    identity = (file.relative_to(root).as_posix(), event.get('name'))
                    observed.setdefault(identity, []).append(event)
                for case in selected:
                    matches = observed.get((case['file'], case['name']), [])
                    status, error = 'unverified', 'Expected named test did not execute exactly once'
                    if len(matches) == 1:
                        event = matches[0]
                        if event.get('kind') == 'test' and event.get('nesting') == 0:
                            status = ('skipped' if event.get('skip') or event.get('todo') else
                                      'passed' if event['type'] == 'test:pass' else 'failed')
                            error = event.get('error', '')
                    evidence['cases'].append({'id': case['id'], 'requirements': case['requirements'],
                                              'source': case['source'], 'status': status, 'error': error})
                passed = {c['id'] for c in evidence['cases'] if c['status'] == 'passed'}
                # Every currently applicable case must pass. Cross-requirement
                # scenarios activate only when all their prerequisites enter scope;
                # later scopes rerun earlier behavior rather than inherit its proof.
                for req in sorted(scope):
                    declared = {c['id'] for c in selected if req in c['requirements']}
                    if declared and declared <= passed:
                        evidence['verified_requirements'].append(req)
                evidence['unverified_requirements'] = sorted(scope - set(evidence['verified_requirements']))
                evidence['passed'] = process.returncode == 0 and not evidence['unverified_requirements']
                incomplete = (any(c['status'] in ('unverified', 'skipped') for c in evidence['cases']) or
                              any(not any(req in c['requirements'] for c in selected) for req in scope))
                evidence['status'] = ('passed' if evidence['passed'] else
                                      'unverified' if incomplete else
                                      'failed' if any(c['status'] == 'failed' for c in evidence['cases']) else 'error')
                if process.returncode != 0:
                    evidence['verified_requirements'] = []
                    evidence['unverified_requirements'] = sorted(scope)
                return evidence
        except (OSError, ValueError, subprocess.SubprocessError) as exc:
            return {**evidence, 'passed': False, 'status': 'error', 'verified_requirements': [], 'error': str(exc)}
