"""Bounded coding tools and real build/start/behavioral-check verification.

The process runs inside the organizer's sandbox. Path guards protect harness files;
they are not an OS sandbox for arbitrary generated shell programs.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import signal
import shlex
import shutil
import socket
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path

from .acceptance import AcceptanceUnavailable, REPORTER
from .environment import discover_playwright
from .launcher import install as install_launcher
from .trace import Trace, atomic_json


EXCLUDED = {".git", ".arc", ".factory", "node_modules", "dist", "build", "__pycache__", ".venv"}
PROTECTED = {".git", ".arc", ".factory", ".volo", "requirements"}


def normalize_check_command(command):
    if isinstance(command, list) and len(command) == 1 and isinstance(command[0], str):
        command = shlex.split(command[0])
    if (not isinstance(command, list) or len(command) < 2
            or not all(isinstance(part, str) and part for part in command)):
        raise ValueError('Supply a concrete behavioral check as argv, e.g. ["node", "checks/test.cjs"]')
    if command[0] not in ('node', 'npm', 'npx', 'python', 'python3'):
        raise ValueError('Use a Node/Python test runner for behavioral checks')
    if any(part in ('&&', '||', '|', ';', '>', '>>', '<') for part in command):
        raise ValueError('Check commands use argv without shell operators')
    return command


# Generated code that hands the browser a navigation after an awaited fetch races the
# test runner's next goto/reload. Measured on 2026-09-14: 10 of 48 replays of an
# application that assigns location.href failed with ERR_ABORTED or "interrupted by
# another navigation", against 0 of 18 replays of the same application re-rendering in
# place. See docs/registration-timing-2026-09-14.md.
GLOBAL = r'(?:(?:window|document|self|top|parent)\s*\.\s*)?'
SELF_NAVIGATION = re.compile(
    r'<meta[^>]+http-equiv\s*=\s*["\']?\s*refresh'
    r'|(?<![\w$.])' + GLOBAL + r'location\s*\.\s*(?:assign|replace|reload)\s*\('
    r'|(?<![\w$.])' + GLOBAL +
    r'location\s*(?:\.\s*(?:href|pathname|search|hash|host|hostname|protocol|port)\s*)?=(?!=)',
    re.IGNORECASE)
DECLARED_NAME = re.compile(r'\b(?:var|let|const|function|class)\s+$')
NAVIGATION_SOURCES = ('.html', '.htm', '.js', '.cjs', '.mjs', '.jsx', '.ts', '.tsx', '.vue', '.svelte')


def self_navigation_findings(path, source, limit=5):
    """Report browser self-navigation in one product file, one finding per line.

    Reads such as location.pathname and every history.* call are deliberately allowed.
    """
    findings = []
    for number, line in enumerate(source.splitlines(), 1):
        for match in SELF_NAVIGATION.finditer(line):
            if DECLARED_NAME.search(line[:match.start()]):
                continue
            findings.append({'file': path, 'line': number,
                             'source': line.strip()[:200], 'match': match.group(0)[:80]})
            break
        if len(findings) >= limit:
            break
    return findings


# A self-check that fails because the check itself misuses an API is not product
# evidence. Freezing such a check, or repairing the product against it, can never
# converge: the nav-race first generation lost 450,000 tokens to a frozen check that
# called assert(locator).toBeVisible(), where assert is node:assert/strict.
# See docs/selfcheck-deadend-2026-09-14.md.
CHECK_DEFECT = re.compile(
    r"is not a function"
    r"|Cannot read properties of (?:undefined|null) \(reading '(?:to[A-Z]\w*|not|resolves|rejects|and)'\)"
    r"|(?:undefined|null) is not an object \(evaluating '[^']*\.to[A-Z]"
    r"|Cannot find module"
    r"|ERR_MODULE_NOT_FOUND|ERR_REQUIRE_ESM"
    r"|\bis not defined\b"
    r"|Unexpected (?:token|identifier|end of input)")
# Ports, ids and timings differ between rounds; the failure identity does not.
FAILURE_NOISE = re.compile(r"https?://[^\s\"',]+|\d+")


def check_events(text):
    """Yield (case name, error message) for both TAP and the captured JSON reporter."""
    name = None
    for raw in text.splitlines():
        stripped = raw.strip()
        if stripped.startswith('# Subtest: '):
            name = stripped[len('# Subtest: '):].strip()
            continue
        if stripped.startswith('{') and '"error"' in stripped:
            try:
                event = json.loads(stripped)
            except ValueError:
                continue
            if isinstance(event, dict) and isinstance(event.get('error'), str):
                yield str(event.get('name') or name or ''), event['error']
            continue
        yield name, stripped


def check_defect_findings(text, limit=3):
    """Report harness/API misuse inside the run's own checks, not product failures.

    A JavaScript error raised by the product is reported by the prepared wrapper as
    "Browser JavaScript errors"; those lines, and the serialized page state appended
    to every failure, are excluded so that product text can never be read as a defect.
    """
    findings = []
    for name, message in check_events(text):
        message = message.split('Browser state:')[0]
        if 'Browser JavaScript errors' in message or '"visible_text"' in message:
            continue
        match = CHECK_DEFECT.search(message)
        if match:
            findings.append({'case': (name or '')[:200], 'signature': match.group(0)[:120],
                             'error': message.strip()[:300]})
            if len(findings) >= limit:
                break
    return findings


DEFECTIVE_CHECK_INSTRUCTION = (
    'This failure is a defect in your own check code, not evidence about the product. '
    'It was not frozen as a required check. Fix or delete the offending check before '
    'repairing the application. checks/browser.cjs exports node:assert/strict as assert; '
    'it is not Playwright expect, so assert(locator).toBeVisible() is invalid. '
    'Assert with assert.ok(await locator.isVisible()) or await locator.waitFor().')


def failure_signature(text):
    """Identify a check failure across rounds, ignoring ports, ids and durations."""
    cases = []
    for name, message in check_events(text):
        message = message.split('Browser state:')[0].strip()
        if message and name is not None:
            cases.append((name or '') + ' => ' + message[:200])
    if not cases:
        cases = [text.strip()[-2000:]]
    normalized = sorted({FAILURE_NOISE.sub('#', case) for case in cases})
    return hashlib.sha256('\n'.join(normalized).encode()).hexdigest()


def stop_process(process):
    if process.poll() is None:
        try:
            os.killpg(process.pid, signal.SIGTERM)
            process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            process.wait(timeout=3)
        except ProcessLookupError:
            pass


def tool_environment(extra=None):
    env = {key: value for key, value in os.environ.items()
           if not any(word in key.upper() for word in ("API_KEY", "TOKEN", "PASSWORD", "SECRET"))
           and not key.startswith(("OPENAI_", "VISUAL_", "ARCBENCH_", "FACTORY_"))}
    env.update({"CI": "1", "GIT_TERMINAL_PROMPT": "0"})
    if extra:
        env.update(extra)
    # Installing an agent's browser library must never garbage-collect the
    # organizer's pinned browser revision from a shared /ms-playwright cache.
    env["PLAYWRIGHT_SKIP_BROWSER_GC"] = "1"
    return env


class Workspace:
    def __init__(self, root: Path, requirements: Path, trace: Trace, deadline: float):
        self.root, self.requirements = root.resolve(), requirements.resolve()
        self.trace, self.deadline = trace, deadline
        self.counter = 0
        self.last_verification = None
        self.last_verification_attempt = None
        self.required_checks = []
        self.retain_failed_prepared_checks = False
        self.released_self_check = False
        self.captured_failure = None
        self.authored = set()
        self.acceptance_suite = None
        self.acceptance_requirement_ids = None
        self.root.mkdir(parents=True, exist_ok=True)
        self.node_available = bool(shutil.which("node"))
        self.browser = discover_playwright(self.root)
        self.runtime_env = {}
        if self.browser.get("available"):
            self.runtime_env["FACTORY_PLAYWRIGHT_MODULE"] = self.browser["module"]
        else:
            self.runtime_env["PLAYWRIGHT_BROWSERS_PATH"] = str(self.trace.directory / "browsers")
        self.trace.event("browser_environment", **self.browser)

    def path(self, name: str, *, write=False) -> Path:
        if not isinstance(name, str) or not name or Path(name).is_absolute():
            raise ValueError("Use a relative file path")
        base = self.root
        if name.startswith("@requirements/"):
            if write:
                raise ValueError("Requirement inputs are read-only")
            base, name = self.requirements, name[len("@requirements/"):]
        relative = Path(name)
        if any(part in PROTECTED for part in relative.parts) or any(
                part == ".env" or part.startswith(".env.") and part != ".env.example"
                for part in relative.parts):
            raise ValueError("Harness, credentials and evaluator inputs are protected")
        target = (base / relative).resolve()
        if not target.is_relative_to(base):
            raise ValueError("Path escapes the permitted workspace")
        if write and target.is_relative_to(self.requirements):
            raise ValueError("Requirement inputs are read-only")
        return target

    def files(self):
        result = []
        for directory, dirs, files in os.walk(self.root):
            dirs[:] = sorted(d for d in dirs if d not in EXCLUDED and d != "requirements"
                             and not (Path(directory) / d).is_symlink())
            for name in sorted(files):
                path = Path(directory) / name
                if name.startswith(".env") or path.is_symlink():
                    continue
                result.append(path)
        return result

    def fingerprint(self):
        digest = hashlib.sha256()
        for path in self.files():
            digest.update(str(path.relative_to(self.root)).encode())
            with path.open("rb") as stream:
                for block in iter(lambda: stream.read(65536), b""):
                    digest.update(block)
        return digest.hexdigest()

    def list_files(self):
        return {"files": [{"path": str(p.relative_to(self.root)), "bytes": p.stat().st_size}
                          for p in self.files() if p.name != ".gitignore"][:800]}

    def read_files(self, paths):
        if not isinstance(paths, list) or not 1 <= len(paths) <= 20:
            raise ValueError("Read 1–20 paths per call")
        sizes = {name: self.path(name).stat().st_size for name in paths}
        if sum(sizes.values()) > 12000:
            raise ValueError('Source read exceeds 12000 bytes. Use read_file_chunk with character offsets. '
                             'Requested file sizes: ' + json.dumps(sizes))
        result = {}
        for name in paths:
            path = self.path(name)
            if path.stat().st_size > 80000:
                raise ValueError(f"File is too large; use run to inspect a bounded slice: {name}")
            result[name] = path.read_text()
        return result

    def read_file_chunk(self, path, offset=0, limit=8000):
        if (not isinstance(offset, int) or offset < 0 or not isinstance(limit, int)
                or not 1 <= limit <= 8000):
            raise ValueError('Use a nonnegative character offset and a limit of 1-8000 characters')
        source = self.path(path)
        if source.stat().st_size > 1000000:
            raise ValueError('Source exceeds 1 MB; inspect a bounded slice with run')
        content = source.read_text()
        chunk = content[offset:offset + limit]
        return {'path': path, 'offset': offset, 'content': chunk, 'total_chars': len(content),
                'next_offset': offset + len(chunk) if offset + len(chunk) < len(content) else None}

    def write_files(self, files):
        if not isinstance(files, list) or not 1 <= len(files) <= 30:
            raise ValueError("Write 1–30 files per call")
        pending, old = {}, {}
        for item in files:
            path = self.path(item["path"], write=True)
            content = item["content"]
            if not isinstance(content, str) or len(content.encode()) > 250000:
                raise ValueError("A file must be UTF-8 text below 250KB")
            if path in pending:
                raise ValueError("Duplicate write path")
            pending[path] = content
            old[path] = path.read_bytes() if path.exists() else None
        try:
            for path, content in pending.items():
                path.parent.mkdir(parents=True, exist_ok=True)
                temp = path.with_name(path.name + ".volo-tmp")
                temp.write_text(content)
                temp.replace(path)
        except Exception:
            for path, content in old.items():
                if content is None:
                    path.unlink(missing_ok=True)
                else:
                    path.write_bytes(content)
            raise
        written = [str(p.relative_to(self.root)) for p in pending]
        self.authored.update(written)
        return {"written": written}

    def edit(self, path, old, new):
        target = self.path(path, write=True)
        content = target.read_text()
        if not old or content.count(old) != 1:
            raise ValueError("Exact old text must occur exactly once; read the file again")
        return self.write_files([{"path": path, "content": content.replace(old, new, 1)}])

    def run(self, argv, cwd=".", timeout=90, extra_env=None):
        if not isinstance(argv, list) or not argv or not all(isinstance(a, str) for a in argv):
            raise ValueError("argv must be a nonempty list of strings")
        working = self.path(cwd)
        timeout = min(float(timeout), 180, self.deadline - time.monotonic())
        if timeout <= 0:
            raise TimeoutError("Agent wall-time budget exhausted")
        self.counter += 1
        log = self.trace.directory / f"command-{self.counter:04d}.log"
        started = time.monotonic()
        timed_out = False
        with log.open("wb") as output:
            process = subprocess.Popen(argv, cwd=working, stdout=output, stderr=subprocess.STDOUT,
                                       env=tool_environment({**self.runtime_env, **(extra_env or {})}), start_new_session=True)
            try:
                process.wait(timeout=timeout)
            except subprocess.TimeoutExpired:
                timed_out = True
            finally:
                stop_process(process)
        raw = log.read_text(errors="replace")
        clean = self.trace.redact(raw)
        log.write_text(clean)
        os.chmod(log, 0o600)
        result = {"argv": argv, "cwd": cwd, "exit_code": process.returncode,
                  "timed_out": timed_out, "seconds": round(time.monotonic() - started, 3),
                  "output": clean[-14000:], "output_truncated": len(clean) > 14000,
                  "log": str(log.relative_to(self.root))}
        self.trace.event("command", **result)
        return result

    def _install(self, relative):
        directory = self.root / relative
        manifest = directory / "package.json"
        package = json.loads(manifest.read_text())
        if not package.get("dependencies") and not package.get("devDependencies"):
            return None
        marker = self.trace.directory / ("installed-" + relative.replace("/", "_") + ".json")
        digest = hashlib.sha256(manifest.read_bytes()).hexdigest()
        if marker.exists() and (directory / "node_modules").is_dir():
            if json.loads(marker.read_text()).get("manifest") == digest:
                return None
        result = self.run(["npm", "install", "--no-audit", "--no-fund"], relative, 180)
        if result["exit_code"] == 0:
            atomic_json(marker, {"manifest": digest})
        return result

    def browser_checks(self, check_command):
        """Find standalone browser checks written by this agent, not evaluator files."""
        if not self.browser.get("available"):
            return []
        checks = []
        for path in self.files():
            relative = str(path.relative_to(self.root))
            if (not relative.startswith('checks/') or relative in check_command
                    or path.suffix not in ('.js', '.cjs', '.mjs')
                    or not any(marker in path.name for marker in ('.spec.', '.test.'))):
                continue
            source = path.read_text(errors='replace')
            if 'FACTORY_PLAYWRIGHT_MODULE' in source and '@playwright/test' not in source:
                checks.append(['node', relative])
        return checks

    def discovered_check_command(self):
        """Recognize authored Node test bundles once the application contract exists."""
        for directory, script in [('frontend', 'build'), ('backend', 'start')]:
            try:
                package = json.loads((self.root / directory / 'package.json').read_text())
                if not isinstance(package.get('scripts', {}).get(script), str):
                    return None
            except (OSError, ValueError, AttributeError):
                return None
        checks = []
        for path in self.files():
            name = str(path.relative_to(self.root))
            if (not name.startswith('checks/') or path.suffix not in ('.js', '.cjs', '.mjs')
                    or not any(marker in path.name for marker in ('.test.', '.spec.'))):
                continue
            checks.append(name)
        return ['node', '--test', *checks] if checks else None

    def clear_prepared_check_guards(self):
        """A new requirement batch may intentionally change previous behavior."""
        self.required_checks = [check for check in self.required_checks
                                if check.get('kind') != 'captured_self_check']
        self.retain_failed_prepared_checks = False
        self.released_self_check = False
        self.captured_failure = None

    def capture_failed_prepared_check(self, result):
        """Retain ambiguous-locator cases as repair evidence, not authority.

        The model may add diagnostic tests, but changing them cannot erase this
        observed ambiguity. Unrelated timing assertions are not frozen: E052 showed
        that those may legitimately need waits. Existing-project tests are unaffected.
        """
        command = ['node', '--test', '--test-reporter=tap', 'checks/requirements.cjs']
        if (not self.retain_failed_prepared_checks or result.get('passed')
                or result.get('defective_check') or self.released_self_check
                or command not in result.get('executed_checks', [])
                or any(check.get('kind') == 'captured_self_check' for check in self.required_checks)):
            return None
        step = result['steps'][-1]
        log = self.root / step['log']
        if log.stat().st_size > 1000000:
            return None
        names = []
        for section in log.read_text().split('\n# Subtest: ')[1:]:
            name = section.split('\n', 1)[0]
            if ('strict mode violation' in section and re.search(r'\nnot ok \d+ - ', section)
                    and not re.search(r'\n\s+# Subtest:', section)
                    and name.strip() and len(name) <= 500):
                names.append(name)
        if not names or len(set(names)) != len(names):
            return None
        syntax = self.run(['node', '--check', 'checks/requirements.cjs'], '.', 10)
        if syntax['exit_code'] != 0 or syntax['timed_out']:
            return None
        sources = {name: (self.root / 'checks' / name).read_bytes()
                   for name in ('requirements.cjs', 'browser.cjs')}
        sources['reporter.cjs'] = REPORTER.encode()
        digest = hashlib.sha256(b''.join(sources.values())).hexdigest()
        directory = self.trace.directory / 'repair-checks' / digest
        directory.mkdir(parents=True, exist_ok=True)
        files = {}
        for name, raw in sources.items():
            path = directory / name
            path.write_bytes(raw)
            files[str(path.relative_to(self.root))] = hashlib.sha256(raw).hexdigest()
        check = {'kind': 'captured_self_check', 'files': files,
                 'expected_cases': names,
                 'argv': ['node', '--test', '--test-reporter=' + str(directory / 'reporter.cjs'),
                          '--test-name-pattern=^(?:' + '|'.join(re.escape(name) for name in names) + ')$',
                          str((directory / 'requirements.cjs').relative_to(self.root))]}
        self.required_checks.append(check)
        self.trace.event('self_check_failure_preserved', check=check,
                         independently_verified=False)
        return {'argv': check['argv'], 'cases': names, 'independently_verified': False,
                'instruction': 'These captured locator-ambiguity cases must also pass after repair. '
                               'Scoping or replacing current assertions cannot remove the captured failure; '
                               'repair the ambiguous product interface. Other checks may receive legitimate waits. '
                               'A genuinely incorrect captured check remains a reported limitation, not permission '
                               'to weaken required product behavior or claim independent acceptance.'}

    def step_defects(self, step):
        """Harness/API misuse inside the run's own check code, read from its real log."""
        if not isinstance(step, dict) or not step.get('log'):
            return []
        path = self.root / step['log']
        try:
            if path.stat().st_size > 1000000:
                return []
            return check_defect_findings(path.read_text(errors='replace'))
        except OSError:
            return []

    def release_captured_check(self, captured, step):
        """Stop repairing against a captured check that cannot pass.

        Two fixed rules, no configuration. A captured check whose failure is a defect
        in the check code is released at once. Otherwise it is released after the
        second consecutive round with the identical failure signature over changed
        product source, because further repair against it cannot converge. Release is
        recorded as a limitation; it never marks the requirement verified.
        """
        try:
            text = (self.root / step['log']).read_text(errors='replace')[-400000:]
        except (OSError, KeyError, TypeError):
            text = ''
        defects = check_defect_findings(text)
        reason = None
        if defects:
            reason = 'defective_check'
        else:
            signature = failure_signature(text)
            fingerprint = self.fingerprint()
            previous = self.captured_failure
            if (previous and previous['signature'] == signature
                    and previous['source_fingerprint'] != fingerprint):
                reason = 'no_progress'
            self.captured_failure = {'signature': signature, 'source_fingerprint': fingerprint}
        if not reason:
            return None
        self.required_checks = [fixed for fixed in self.required_checks if fixed is not captured]
        self.released_self_check = True
        self.captured_failure = None
        release = {'reason': reason, 'cases': captured.get('expected_cases', []), 'defects': defects,
                   'instruction': (
                       'The previously captured self-check cases were released and are no longer required: '
                       + ('the check code itself is defective. ' if reason == 'defective_check' else
                          'two consecutive repairs of changed product source produced the identical failure. ')
                       + 'Rewrite or delete that check, then verify the application normally. '
                         'Do not weaken required product behavior; a released capture is a reported '
                         'limitation, not evidence that the requirement is satisfied.')}
        self.trace.event('captured_self_check_released', independently_verified=False, **release)
        return release

    def contract_fingerprint(self):
        return hashlib.sha256(json.dumps(self.required_checks, sort_keys=True).encode()).hexdigest()

    def self_navigation_guard(self):
        """Reject browser self-navigation in product code this run authored.

        Files supplied by an existing project are not scanned until the agent
        rewrites them, so a legacy pattern never makes verification unreachable.
        """
        findings = []
        for path in self.files():
            relative = str(path.relative_to(self.root))
            if (relative not in self.authored or relative.startswith('checks/')
                    or path.suffix.lower() not in NAVIGATION_SOURCES):
                continue
            try:
                source = path.read_text()
            except (OSError, UnicodeError):
                continue
            findings.extend(self_navigation_findings(relative, source))
            if len(findings) >= 8:
                break
        return findings[:8]

    def verify(self, check_command):
        """Verify the actual current tree, never a model's claimed test result."""
        check_command = normalize_check_command(check_command)
        for check in self.required_checks:
            for name, expected in check['files'].items():
                path = self.root / name
                if (not path.is_file() or path.is_symlink()
                        or hashlib.sha256(path.read_bytes()).hexdigest() != expected):
                    self.last_verification = None
                    raise ValueError('A fixed acceptance check was removed or changed: ' + name)
        contract = self.contract_fingerprint()
        if (self.acceptance_suite is None and self.last_verification and self.last_verification.get("check_command") == check_command
                and self.last_verification.get("source_fingerprint") == self.fingerprint()
                and self.last_verification.get('acceptance_fingerprint') == contract):
            return {**self.last_verification, "reused_unchanged_verification": True}
        self.last_verification = None
        steps = []
        def result(ok, **extra):
            acceptance = extra.pop('acceptance', {'status': 'not_run' if self.acceptance_suite else 'not_configured',
                                                  'passed': False, 'verified_requirements': []})
            value = {"passed": ok, "steps": steps, "check_command": check_command,
                     'acceptance_fingerprint': self.contract_fingerprint(),
                     'browser_available': bool(self.browser.get('available')),
                     "source_fingerprint": self.fingerprint(), "official_evaluation": "pending",
                     "verification_scope": "independent_acceptance" if acceptance['passed'] else "local_checks_only",
                     "requirements_verified": bool(acceptance['passed']),
                     'acceptance': acceptance, **extra}
            self.last_verification_attempt = value
            if ok:
                self.last_verification = value
            atomic_json(self.trace.directory / "verification.json", value)
            self.trace.event("verification", **value)
            return value
        def extra(release):
            return {'released_self_check': release} if release else {}
        try:
            findings = self.self_navigation_guard()
            if findings:
                return result(False, self_navigation=findings, error=(
                    'Product code navigates the browser itself, which races the test runner: '
                    + json.dumps(findings, ensure_ascii=False)
                    + '. Remove every window.location/location.href assignment, location.assign, '
                      'location.replace, location.reload and <meta http-equiv="refresh">. After a '
                      'submission or sign-out, re-render the affected view in place and update the URL '
                      'with history.replaceState; route in-app links with history.pushState and a '
                      'popstate handler. Reading location.pathname is allowed.'))
            for relative in ("frontend", "backend"):
                manifest = self.root / relative / "package.json"
                if not manifest.is_file():
                    return result(False, error=f"Missing {relative}/package.json")
                scripts = json.loads(manifest.read_text()).get("scripts", {})
                required = "build" if relative == "frontend" else "start"
                if required not in scripts:
                    return result(False, error=f"Missing {relative} npm script: {required}")
            self.trace.event("application_entrypoints", **install_launcher(self.root))
            for relative in (".", "frontend", "backend"):
                if (self.root / relative / "package.json").exists():
                    step = self._install(relative)
                    if step:
                        steps.append(step)
                        if step["exit_code"] != 0:
                            return result(False, error="Dependency installation failed")
            build = self.run(["npm", "run", "build"], "frontend", 180)
            steps.append(build)
            if build["exit_code"] != 0:
                return result(False, error="Frontend build failed")
            with socket.socket() as listener:
                listener.bind(("127.0.0.1", 0))
                port = listener.getsockname()[1]
            url = f"http://127.0.0.1:{port}"
            server_log = self.trace.directory / "server.log"
            with server_log.open("wb") as output:
                process = subprocess.Popen(["npm", "run", "start"], cwd=self.root / "backend",
                                           stdout=output, stderr=subprocess.STDOUT,
                                           env=tool_environment({**self.runtime_env, "PORT": str(port)}), start_new_session=True)
                try:
                    end = min(time.monotonic() + 30, self.deadline)
                    ready = False
                    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
                    while time.monotonic() < end and process.poll() is None:
                        try:
                            with opener.open(url, timeout=1) as response:
                                ready = response.status == 200
                            if ready:
                                break
                        except (OSError, urllib.error.URLError):
                            pass
                        time.sleep(0.1)
                    if not ready:
                        return result(False, error="Application did not serve HTTP 200 on PORT",
                                      server_output=self.trace.redact(server_log.read_text(errors="replace")[-6000:]))
                    commands = [*[check['argv'] for check in self.required_checks],
                                check_command, *self.browser_checks(check_command)]
                    executed = []
                    released = None
                    for command in commands:
                        check = self.run(command, ".", 180, {
                            "FACTORY_BASE_URL": url, "E2E_BASE_URL": url, "PLAYWRIGHT_BASE_URL": url})
                        steps.append(check)
                        executed.append(command)
                        captured = next((fixed for fixed in self.required_checks
                                         if fixed['argv'] == command and 'expected_cases' in fixed), None)
                        if captured and (check['exit_code'] != 0 or check['timed_out']):
                            release = self.release_captured_check(captured, check)
                            if release:
                                # The captured check can never pass; continue with the
                                # remaining checks instead of spending another round on it.
                                released = release
                                steps.pop()
                                executed.pop()
                                continue
                        if captured and check['exit_code'] == 0 and not check['timed_out']:
                            raw = self.root / check['log']
                            try:
                                if raw.stat().st_size > 1000000:
                                    raise ValueError('Captured result is too large')
                                events = [json.loads(line) for line in raw.read_text().splitlines() if line.strip()]
                                passed_names = [event['name'] for event in events
                                                if event.get('type') == 'test:pass' and event.get('kind') in (None, 'test')
                                                and event.get('nesting') == 0 and not event.get('skip')
                                                and not event.get('todo')]
                                complete = sorted(passed_names) == sorted(captured['expected_cases'])
                            except (OSError, ValueError, KeyError, TypeError, AttributeError):
                                complete = False
                            if not complete:
                                return result(False, error='Captured ambiguity cases did not all execute',
                                              check_command=check_command, executed_checks=executed,
                                              application_url=url, **extra(released))
                        if check["exit_code"] != 0 or check["timed_out"]:
                            defects = self.step_defects(check)
                            return result(False, check_command=check_command, executed_checks=executed,
                                          application_url=url, **extra(released),
                                          **({'defective_check': {'findings': defects,
                                                                  'instruction': DEFECTIVE_CHECK_INSTRUCTION}}
                                             if defects else {}))
                    if self.acceptance_suite is not None:
                        scope = (self.acceptance_requirement_ids if self.acceptance_requirement_ids is not None
                                 else self.acceptance_suite.requirement_ids)
                        acceptance = self.acceptance_suite.run(url, scope,
                            timeout=min(180, self.deadline - time.monotonic()), extra_env=self.runtime_env)
                        acceptance['source_fingerprint'] = self.fingerprint()
                        self.trace.event('independent_acceptance', **acceptance)
                        if not acceptance['passed']:
                            steps.append({'output': json.dumps(acceptance, ensure_ascii=False),
                                          'exit_code': 1, 'timed_out': acceptance.get('timed_out', False)})
                        verified = result(acceptance['passed'], check_command=check_command,
                                          executed_checks=commands, application_url=url, acceptance=acceptance,
                                          **extra(released),
                                          **({'error': 'Independent acceptance did not pass'} if not acceptance['passed'] else {}))
                        if acceptance['status'] in ('error', 'unverified'):
                            raise AcceptanceUnavailable('Independent acceptance is unavailable or incomplete; '
                                                        'stopping instead of asking the model to repair its evaluator')
                        return verified
                    return result(True, check_command=check_command, executed_checks=executed,
                                  application_url=url, **extra(released))
                finally:
                    stop_process(process)
                    text = self.trace.redact(server_log.read_text(errors="replace"))
                    server_log.write_text(text)
                    os.chmod(server_log, 0o600)
        except (OSError, ValueError, TimeoutError) as exc:
            return result(False, error=str(exc))
