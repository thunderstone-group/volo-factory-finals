#!/usr/bin/env python3
"""Scenario self-check: run every ATOMIC requirement's GIVEN/WHEN/THEN scenario in Chromium.

    python oneshot/scenario_check.py --requirements requirements.yaml --app APP_DIR --out result.json [--port N]

Result: {"scenarios": [{"id", "name", "status": pass|fail|unparsed|error, "observation", "steps"}],
"invariants": [...], "coverage": {"total", "parsed"}, "seconds"}. Diagnostic only: it reads the
requirements and the application, never evaluator tests, and calls no model.

Isolation: the application (frontend/ and backend/) is copied to a scratch directory and built once.
Every scenario gets a fresh browser context and a freshly started backend on its own port; when the
scenario ends the backend process group is stopped and every file it created or changed under the
copy (and in its private TMPDIR) is restored from the pristine build.
"""
import argparse
import collections
import json
import os
import queue
import shlex
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path
from urllib import error, request

try:
    from . import scenario_translate, scenarios
except ImportError:  # run as a script, or from the flat package next to main.py
    import scenario_translate
    import scenarios

HERE = Path(__file__).resolve().parent
EXECUTOR = HERE / "scenario_check.cjs"
BUILD_SECONDS = 180
READY_SECONDS = 60
SCENARIO_SECONDS = 60  # per scenario, plus STEP_SECONDS per step, before the executor is presumed hung
STEP_SECONDS = 8
PLAYWRIGHT_PREFIX = Path(tempfile.gettempdir()) / "oneshot-playwright-1.57.0"


class AppError(Exception):
    """The application could not be built or started; its scenarios fail."""


def _child_env(tmpdir):
    """A minimal environment for generated code: no credentials or proxies, a private TMPDIR."""
    keep = ("PATH", "HOME", "LANG", "LC_ALL", "SYSTEMROOT", "USERPROFILE", "NODE_PATH", "PLAYWRIGHT_BROWSERS_PATH")
    env = {name: os.environ[name] for name in keep if name in os.environ}
    env.update({"TMPDIR": str(tmpdir), "TEMP": str(tmpdir), "TMP": str(tmpdir)})
    return env


def _free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def _port_free(port):
    with socket.socket() as sock:
        try:
            sock.bind(("127.0.0.1", port))
            return True
        except OSError:
            return False


def _status(url, timeout):
    opener = request.build_opener(request.ProxyHandler({}))
    try:
        with opener.open(url, timeout=timeout) as response:
            return response.status
    except error.HTTPError as exc:
        return exc.code


def _tail(path, limit=600):
    try:
        data = Path(path).read_bytes()[-limit:]
    except OSError:
        return ""
    return data.decode("utf-8", "replace").strip()


# ---------------------------------------------------------------------------- workspace

def _inventory(root):
    files, dirs = {}, set()
    for current, dirnames, filenames in os.walk(root):
        rel_dir = os.path.relpath(current, root)
        dirs.add(rel_dir)
        kept = []
        for name in dirnames:
            if os.path.islink(os.path.join(current, name)):
                files[os.path.normpath(os.path.join(rel_dir, name))] = ("link",)
            else:
                kept.append(name)
        dirnames[:] = kept
        for name in filenames:
            path = os.path.join(current, name)
            rel = os.path.normpath(os.path.join(rel_dir, name))
            if os.path.islink(path):
                files[rel] = ("link",)
                continue
            stat = os.stat(path)
            files[rel] = (stat.st_size, stat.st_mtime_ns)
    return files, dirs


class Workspace:
    """A built copy of the application plus a pristine copy to restore it from after each scenario."""

    def __init__(self, app, work, env):
        app = Path(app).resolve()
        for part in ("frontend", "backend"):
            if not (app / part).is_dir():
                raise AppError(f"{app} has no {part}/ directory")
        self.root, self.pristine, self.env = work / "app", work / "pristine", env
        self.root.mkdir(parents=True)
        for entry in app.iterdir():
            if entry.name in ("frontend", "backend"):
                self._copy(entry, self.root / entry.name)
            elif entry.is_file() and not entry.is_symlink() and entry.stat().st_size < 5_000_000:
                shutil.copy2(entry, self.root / entry.name)
        self._build()
        shutil.copytree(self.root, self.pristine, symlinks=True)
        self.snapshot, self.dirs = _inventory(self.root)

    @staticmethod
    def _copy(source, target):
        shutil.copytree(source, target, symlinks=True, ignore=lambda d, names: [n for n in names if n in ("node_modules", ".git")])
        for current, dirnames, _ in os.walk(source):  # dependencies are linked, never copied or written
            if "node_modules" in dirnames:
                link = Path(target) / os.path.relpath(current, source) / "node_modules"
                if not link.exists():
                    link.symlink_to(Path(current) / "node_modules", target_is_directory=True)
            dirnames[:] = [d for d in dirnames if d not in ("node_modules", ".git")]

    def _build(self):
        manifest = self.root / "frontend" / "package.json"
        if not manifest.is_file():
            return
        try:
            scripts = json.loads(manifest.read_text(encoding="utf-8")).get("scripts") or {}
        except ValueError as exc:
            raise AppError(f"frontend/package.json is not valid JSON: {exc}") from None
        if "build" not in scripts:
            return
        npm = shutil.which("npm", path=self.env.get("PATH"))
        if not npm:
            raise AppError("npm is not available to run the frontend build")
        try:
            build = subprocess.run([npm, "run", "build", "--silent"], cwd=self.root / "frontend", env=self.env,
                                   capture_output=True, text=True, timeout=BUILD_SECONDS)
        except subprocess.TimeoutExpired:
            raise AppError(f"frontend `npm run build` did not finish within {BUILD_SECONDS} s") from None
        if build.returncode != 0:
            raise AppError(f"frontend `npm run build` exited {build.returncode}: {(build.stderr + build.stdout)[-400:].strip()}")

    def restore(self):
        """Undo every file the last scenario created, changed or removed under the copy."""
        current, dirs = _inventory(self.root)
        for rel, signature in current.items():
            path = self.root / rel
            if rel not in self.snapshot:
                if path.is_symlink() or path.is_file():
                    path.unlink()
                else:
                    shutil.rmtree(path, ignore_errors=True)
            elif signature != self.snapshot[rel] and signature != ("link",):
                shutil.copy2(self.pristine / rel, path)
        for rel, signature in self.snapshot.items():
            if rel not in current:
                (self.root / rel).parent.mkdir(parents=True, exist_ok=True)
                source = self.pristine / rel
                if signature == ("link",):
                    os.symlink(os.readlink(source), self.root / rel)
                else:
                    shutil.copy2(source, self.root / rel)
        for rel in sorted(dirs - self.dirs, key=len, reverse=True):
            shutil.rmtree(self.root / rel, ignore_errors=True)


# ------------------------------------------------------------------------------ backend

def _descendants(pid):
    """Every process below `pid` (detached grandchildren leave its process group)."""
    try:
        listing = subprocess.run(["ps", "-A", "-o", "pid=,ppid="], capture_output=True, text=True, timeout=5).stdout
    except (OSError, subprocess.TimeoutExpired):
        return []
    children = collections.defaultdict(list)
    for line in listing.splitlines():
        parts = line.split()
        if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
            children[int(parts[1])].append(int(parts[0]))
    found, stack = [], [pid]
    while stack:
        for child in children.get(stack.pop(), []):
            found.append(child)
            stack.append(child)
    return found


class Backend:
    def __init__(self, root, env, log_path):
        self.root, self.env, self.log_path = Path(root), env, Path(log_path)
        self.proc, self.log = None, None
        manifest = self.root / "backend" / "package.json"
        start = None
        if manifest.is_file():
            try:
                start = (json.loads(manifest.read_text(encoding="utf-8")).get("scripts") or {}).get("start")
            except ValueError:
                start = None
        command = shlex.split(start) if start else ["node", "server.js"]
        executable = shutil.which(command[0], path=env.get("PATH")) or command[0]
        self.command = [executable] + command[1:]

    def start(self, port):
        self.log = open(self.log_path, "wb")
        try:
            self.proc = subprocess.Popen(self.command, cwd=self.root / "backend", stdin=subprocess.DEVNULL,
                                         stdout=self.log, stderr=subprocess.STDOUT, start_new_session=True,
                                         env={**self.env, "PORT": str(port), "HOST": "127.0.0.1"})
        except OSError as exc:
            self.log.close()
            raise AppError(f"backend command {' '.join(self.command)!r} could not start: {exc}") from None

    def wait_ready(self, port, seconds=READY_SECONDS):
        deadline, last = time.monotonic() + seconds, ""
        while time.monotonic() < deadline:
            if self.proc.poll() is not None:
                return False, f"the backend exited with code {self.proc.returncode}: {_tail(self.log_path)}"
            try:
                status = _status(f"http://127.0.0.1:{port}/", 3)
                if status < 500:
                    return True, ""
                last = f"HTTP {status}"
            except Exception as exc:  # refused while starting, resets, timeouts
                last = str(exc)[:120]
            time.sleep(0.1)
        return False, f"GET / did not answer below HTTP 500 within {seconds} s (last: {last}); output: {_tail(self.log_path)}"

    def stop(self):
        if self.proc is None:
            return
        below = _descendants(self.proc.pid)
        try:
            os.killpg(self.proc.pid, signal.SIGTERM)
        except (ProcessLookupError, PermissionError):
            pass
        try:
            self.proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            try:
                os.killpg(self.proc.pid, signal.SIGKILL)
            except (ProcessLookupError, PermissionError):
                pass
            self.proc.wait(timeout=5)
        for pid in below:
            try:
                os.kill(pid, signal.SIGKILL)
            except (ProcessLookupError, PermissionError):
                pass
        self.proc = None
        if self.log:
            self.log.close()


# ------------------------------------------------------------------------------- worker

class Worker:
    """The Node executor: one Chromium, one JSON line per scenario."""

    def __init__(self, env):
        self.env, self.proc, self.lines, self.info = env, None, queue.Queue(), None

    def start(self, seconds=60):
        node = shutil.which("node", path=self.env.get("PATH"))
        if not node:
            return {"ready": False, "unavailable": "node", "reason": "node is not on PATH"}
        self.lines = queue.Queue()
        self.proc = subprocess.Popen([node, str(EXECUTOR)], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                     stderr=subprocess.PIPE, text=True, env=self.env, bufsize=1)
        threading.Thread(target=self._pump, args=(self.proc.stdout, self.lines), daemon=True).start()
        threading.Thread(target=self._drain, args=(self.proc.stderr,), daemon=True).start()
        self.info = self._read(seconds) or {"ready": False, "unavailable": "executor", "reason": "no ready line"}
        return self.info

    @staticmethod
    def _pump(stream, lines):
        for line in stream:
            lines.put(line)
        lines.put(None)

    @staticmethod
    def _drain(stream):
        for _ in stream:
            pass

    def _read(self, seconds):
        deadline = time.monotonic() + seconds
        while True:
            try:
                line = self.lines.get(timeout=max(0.05, deadline - time.monotonic()))
            except queue.Empty:
                return None
            if line is None:
                return None
            try:
                value = json.loads(line)
            except ValueError:
                continue
            if isinstance(value, dict):
                return value

    def run(self, base, scenario, seconds):
        try:
            self.proc.stdin.write(json.dumps({"cmd": "run", "base": base, "scenario": scenario}) + "\n")
            self.proc.stdin.flush()
        except (OSError, ValueError):
            return None
        return self._read(seconds)

    def close(self):
        if self.proc is None:
            return
        try:
            self.proc.stdin.write(json.dumps({"cmd": "exit"}) + "\n")
            self.proc.stdin.flush()
            self.proc.wait(timeout=10)
        except (OSError, ValueError, subprocess.TimeoutExpired):
            self.proc.kill()
            self.proc.wait()
        for stream in (self.proc.stdin, self.proc.stdout, self.proc.stderr):
            try:
                stream.close()
            except (OSError, ValueError):
                pass
        self.proc = None


def _npm_global_root(env):
    npm = shutil.which("npm", path=env.get("PATH"))
    if not npm:
        return None
    try:
        root = subprocess.run([npm, "root", "-g"], capture_output=True, text=True, timeout=20, env=env).stdout.strip()
    except (OSError, subprocess.TimeoutExpired):
        return None
    return root or None


def _start_worker(env):
    """Start the executor, locating or installing Playwright the way main.py's browser probe does."""
    paths = [p for p in env.get("NODE_PATH", "").split(os.pathsep) if p]
    paths.append(str(PLAYWRIGHT_PREFIX / "node_modules"))
    env = dict(env, NODE_PATH=os.pathsep.join(dict.fromkeys(paths)))
    worker = Worker(env)
    info = worker.start()
    if info.get("unavailable") == "module":
        global_root = _npm_global_root(env)
        if global_root:
            env["NODE_PATH"] = os.pathsep.join(dict.fromkeys(paths + [global_root]))
            worker = Worker(env)
            info = worker.start()
    if info.get("unavailable") == "module" and shutil.which("npm", path=env.get("PATH")):
        subprocess.run([shutil.which("npm", path=env.get("PATH")), "install", "--prefix", str(PLAYWRIGHT_PREFIX),
                        "playwright@1.57.0", "--no-audit", "--no-fund", "--silent"],
                       env=env, capture_output=True, timeout=180)
        worker = Worker(env)
        info = worker.start()
    if info.get("unavailable") == "browser":
        subprocess.run([shutil.which("node", path=env.get("PATH")) or "node", "-e",
                        "process.argv=['node','cli','install','chromium','--only-shell'];"
                        "require(require('path').join(require('path').dirname("
                        "require.resolve('playwright/package.json')),'cli.js'))"],
                       env=env, capture_output=True, timeout=300)
        worker = Worker(env)
        info = worker.start()
    return worker, info


# ---------------------------------------------------------------------------------- run

def _unparsed_entry(item, translation=None):
    fragment = item.get("fragment") or {}
    phase = (fragment.get("phase") or "").upper()
    text = fragment.get("text") or ""
    if fragment.get("reason") == "setup":
        observation = f"Unparsed: {text}"
    else:
        observation = f"Unparsed {phase} {text!r}: {fragment.get('reason', item.get('reason', ''))}"
    rejected = ((translation or {}).get("rejected") or {}).get(item["id"])
    if rejected:
        observation += f"; model translation rejected: {rejected}"
    return {"id": item["id"], "name": item["name"], "status": "unparsed", "observation": observation, "steps": []}


def _aggregate_invariants(replies):
    invariants = []
    headings = collections.OrderedDict()
    for sid, reply in replies:
        for check in reply.get("heading_checks") or []:
            entry = headings.setdefault(check["name"], {"id": f"main-heading:{check['name']}", "kind": "main-heading",
                                                         "status": "pass", "scenarios": [], "observation": ""})
            entry["scenarios"].append(sid)
            if not check.get("ok") and entry["status"] == "pass":
                entry["status"], entry["observation"] = "fail", f"{check.get('observation', '')} (scenario {sid})"
    for entry in headings.values():
        if entry["status"] == "pass":
            entry["observation"] = f"After activating the link `{entry['id'].split(':', 1)[1]}` the main heading names it."
        invariants.append(entry)
    errors = collections.OrderedDict()
    for sid, reply in replies:
        for page_error in reply.get("page_errors") or []:
            entry = errors.setdefault(page_error["message"], {"kind": "pageerror", "status": "fail", "scenarios": [],
                                                               "first": (sid, page_error.get("after") or "load")})
            if sid not in entry["scenarios"]:
                entry["scenarios"].append(sid)
    for index, (message, entry) in enumerate(errors.items(), 1):
        sid, after = entry.pop("first")
        entry["id"] = f"pageerror:{index}"
        entry["observation"] = (f"Uncaught page error `{message}` in {len(entry['scenarios'])} scenario(s), "
                                f"first in {sid} after `{after}`.")
        invariants.append(entry)
    return invariants


def _start_backend(backend, workspace, port, attempts=3):
    """Start the backend on a free port. A free port can be taken by a parallel process between the probe and the
    backend's bind, so an early exit is retried on a fresh port, from restored files, before it counts."""
    for attempt in range(attempts):
        chosen = port or _free_port()
        if port:
            deadline = time.monotonic() + 10
            while not _port_free(port) and time.monotonic() < deadline:
                time.sleep(0.2)
        backend.start(chosen)
        ready, why = backend.wait_ready(chosen)
        if ready or attempt + 1 == attempts or "EADDRINUSE" not in _tail(backend.log_path, 4000):
            return chosen, ready, why
        backend.stop()
        workspace.restore()
    return chosen, ready, why


def _payload(item, failed_headings):
    # A name whose main-heading check already failed is not re-polled (each failure costs a wait).
    return {"id": item["id"], "ops": item["ops"], "skip_heading": sorted(failed_headings)}


def _execute(runnable, app, port, progress=None):
    """Run the parsed scenarios; returns ({id: reply}, runtime)."""
    work = Path(tempfile.mkdtemp(prefix="scenario-check-"))
    replies, runtime, failed_headings = {}, {}, set()
    worker = backend = None
    try:
        tmp = work / "tmp"
        tmp.mkdir()
        env = _child_env(tmp)
        try:
            workspace = Workspace(app, work, env)
        except (AppError, OSError) as exc:
            for item in runnable:
                replies[item["id"]] = {"status": "fail", "observation": f"The application could not be prepared: {exc}",
                                       "steps": []}
            return replies, runtime
        worker, info = _start_worker(dict(env))
        runtime.update({k: info.get(k) for k in ("browser", "playwright") if info.get(k)})
        if not info.get("ready"):
            for item in runnable:
                replies[item["id"]] = {"status": "error", "steps": [], "observation":
                                       f"Chromium is unavailable ({info.get('unavailable')}): {info.get('reason', '')}"}
            return replies, runtime
        backend = Backend(workspace.root, env, work / "backend.log")
        for item in runnable:
            try:
                chosen, ready, why = _start_backend(backend, workspace, port)
                if not ready:
                    replies[item["id"]] = {"status": "fail", "steps": [], "observation": f"The backend did not start: {why}"}
                    continue
                reply = worker.run(f"http://127.0.0.1:{chosen}", _payload(item, failed_headings),
                                   SCENARIO_SECONDS + STEP_SECONDS * len(item["ops"]))
                if reply is None:
                    reply = {"status": "error", "steps": [], "observation": "The executor did not answer in time; restarted."}
                    worker.close()
                    worker, info = _start_worker(dict(env))
                replies[item["id"]] = reply
                failed_headings.update(c["name"] for c in reply.get("heading_checks") or [] if not c.get("ok"))
            except AppError as exc:
                replies[item["id"]] = {"status": "fail", "steps": [], "observation": str(exc)}
            finally:
                backend.stop()
                workspace.restore()
                shutil.rmtree(tmp, ignore_errors=True)
                tmp.mkdir(exist_ok=True)
            if progress:
                progress(item["id"], replies[item["id"]])
    finally:
        if backend:
            backend.stop()
        if worker:
            worker.close()
        shutil.rmtree(work, ignore_errors=True)
    return replies, runtime


def translate_unparsed(text, planned):
    """Replace unparsed scenarios with validated model translations (one cached call per requirements text).
    Off with SCENARIO_TRANSLATE=0; without OPENAI_API_KEY only an existing cache entry is used."""
    if os.environ.get("SCENARIO_TRANSLATE", "1") == "0":
        return {"status": "disabled"}
    summary = scenario_translate.translate(text, planned)
    for item in planned["scenarios"]:
        ops = summary["accepted"].get(item["id"])
        if ops is not None:
            item.update(status="parsed", source="model", ops=ops, chain=[])
    summary["accepted"] = sorted(summary["accepted"])
    return summary


def run(requirements, app, out=None, port=None, progress=None, text=None, only=None):
    """Plan and execute the scenarios of `requirements` (a path, or the document itself as `text`) against the
    application directory `app`. With `only`, just those scenario ids run and appear in the report (a recheck)."""
    started = time.monotonic()
    text = text if text is not None else Path(requirements).read_text(encoding="utf-8")
    planned = scenarios.plan(text)
    rules = sum(1 for item in planned["scenarios"] if item["status"] == "parsed")
    translation = translate_unparsed(text, planned)
    if only is not None:
        planned["scenarios"] = [item for item in planned["scenarios"] if item["id"] in only]
    runnable = [item for item in planned["scenarios"] if item["status"] == "parsed"]
    replies, runtime = _execute(runnable, app, port, progress) if runnable else ({}, {})
    parsed = len(runnable)
    report = {"scenarios": [], "invariants": [],
              "coverage": {"total": planned["coverage"]["total"], "parsed": parsed, "rules": rules, "model": parsed - rules},
              "translation": translation}
    ordered = []
    for item in planned["scenarios"]:
        if item["status"] != "parsed":
            report["scenarios"].append(_unparsed_entry(item, translation))
            continue
        reply = replies.get(item["id"]) or {"status": "error", "observation": "not executed", "steps": []}
        entry = {"id": item["id"], "name": item["name"], "status": reply.get("status", "error"),
                 "observation": reply.get("observation", ""), "steps": reply.get("steps", []), "chain": item["chain"],
                 "source": item.get("source", "rules")}
        if item.get("substitutions"):
            entry["substitutions"] = item["substitutions"]
        report["scenarios"].append(entry)
        ordered.append((item["id"], reply))
    report["invariants"] = _aggregate_invariants(ordered)
    shapes = collections.Counter()  # what the rules could not read, whether or not the model translated it
    for item in planned["scenarios"]:
        fragment = item.get("fragment")
        if fragment and fragment.get("reason") != "setup":
            shapes[(fragment["phase"], scenarios.shape(fragment["text"]))] += 1
        elif fragment:
            shapes[("given", "setup: " + (item.get("reason") or "")[:120])] += 1
    report["unparsed_shapes"] = [{"phase": phase, "shape": text, "count": count}
                                 for (phase, text), count in shapes.most_common()]
    report["runtime"] = runtime
    report["seconds"] = round(time.monotonic() - started, 1)
    if out:
        Path(out).parent.mkdir(parents=True, exist_ok=True)
        Path(out).write_text(json.dumps(report, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    return report


def main(argv=None):
    parser = argparse.ArgumentParser(description="Run requirement scenarios against a generated application.")
    parser.add_argument("--requirements", required=True, type=Path, help="requirements.yaml")
    parser.add_argument("--app", required=True, type=Path, help="application directory with frontend/ and backend/")
    parser.add_argument("--out", required=True, type=Path, help="result JSON path")
    parser.add_argument("--port", type=int, help="fixed backend port (default: a free port per scenario)")
    args = parser.parse_args(argv)
    report = run(args.requirements, args.app, args.out, args.port)
    counts = collections.Counter(item["status"] for item in report["scenarios"])
    failed = [i["id"] for i in report["invariants"] if i["status"] == "fail"]
    coverage, translation = report["coverage"], report["translation"]
    print(f"scenarios: {dict(counts)}; coverage {coverage['parsed']}/{coverage['total']} (rules {coverage['rules']}, "
          f"model {coverage['model']}; translation {translation.get('status')}, cost CNY {translation.get('cost_cny')}); "
          f"invariant failures: {len(failed)}; {report['seconds']} s -> {args.out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
