"""Bounded coding tools and real build/start/behavioral-check verification.

The process runs inside the organizer's sandbox. Path guards protect harness files;
they are not an OS sandbox for arbitrary generated shell programs.
"""
from __future__ import annotations

import hashlib
import json
import os
import signal
import shutil
import socket
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path

from .environment import discover_playwright
from .trace import Trace, atomic_json


EXCLUDED = {".git", ".arc", ".factory", "node_modules", "dist", "build", "__pycache__", ".venv"}
PROTECTED = {".git", ".arc", ".factory", "requirements"}


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
        result = {}
        for name in paths:
            path = self.path(name)
            if path.stat().st_size > 80000:
                raise ValueError(f"File is too large; use run to inspect a bounded slice: {name}")
            result[name] = path.read_text()
        return result

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
        return {"written": [str(p.relative_to(self.root)) for p in pending]}

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

    def verify(self, check_command):
        """Verify the actual current tree, never a model's claimed test result."""
        if not isinstance(check_command, list) or len(check_command) < 2:
            raise ValueError("Supply a concrete behavioral check command")
        if check_command[0] not in ("node", "npm", "npx", "python", "python3"):
            raise ValueError("Use a Node/Python test runner for behavioral checks")
        if (self.last_verification and self.last_verification.get("check_command") == check_command
                and self.last_verification.get("source_fingerprint") == self.fingerprint()):
            return {**self.last_verification, "reused_unchanged_verification": True}
        self.last_verification = None
        steps = []
        def result(ok, **extra):
            value = {"passed": ok, "steps": steps, "check_command": check_command,
                     "source_fingerprint": self.fingerprint(), "official_evaluation": "pending", **extra}
            self.last_verification_attempt = value
            if ok:
                self.last_verification = value
            atomic_json(self.trace.directory / "verification.json", value)
            self.trace.event("verification", **value)
            return value
        try:
            for relative in ("frontend", "backend"):
                manifest = self.root / relative / "package.json"
                if not manifest.is_file():
                    return result(False, error=f"Missing {relative}/package.json")
                scripts = json.loads(manifest.read_text()).get("scripts", {})
                required = "build" if relative == "frontend" else "start"
                if required not in scripts:
                    return result(False, error=f"Missing {relative} npm script: {required}")
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
                    check = self.run(check_command, ".", 180, {
                        "FACTORY_BASE_URL": url, "E2E_BASE_URL": url, "PLAYWRIGHT_BASE_URL": url})
                    steps.append(check)
                    return result(check["exit_code"] == 0 and not check["timed_out"],
                                  check_command=check_command, application_url=url)
                finally:
                    stop_process(process)
                    text = self.trace.redact(server_log.read_text(errors="replace"))
                    server_log.write_text(text)
                    os.chmod(server_log, 0o600)
        except (OSError, ValueError, TimeoutError) as exc:
            return result(False, error=str(exc))
