"""Durable recovery for the saved paired-repair experiment, outside the agent ZIP."""

import fcntl
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time


MAX_ATTEMPTS = 3  # Includes historical attempts; restarting never resets this cap.


def read_json(path):
    return json.loads(Path(path).read_text())


def atomic_json(path, value):
    path = Path(path)
    fd, name = tempfile.mkstemp(prefix="." + path.name + "-", dir=path.parent)
    try:
        with os.fdopen(fd, "w") as stream:
            json.dump(value, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def request_hash(folder):
    path = Path(folder) / "request.json"
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else None


def outcome(folder):
    """Only observed transport/setup failures are automatically retryable."""
    folder = Path(folder)
    trace = read_json(folder / "trace.json") if (folder / "trace.json").exists() else {}
    transport = (
        read_json(folder / "transport.json")
        if (folder / "transport.json").exists()
        else {}
    )
    attempts = trace.get("attempts", [])
    receipt_path = folder / "receipt.json"
    if receipt_path.exists():
        receipt = read_json(receipt_path)
        if not (folder / "application").is_dir():
            raise RuntimeError("receipt exists without application: " + str(folder))
        if any(a.get("status") != "completed" for a in attempts):
            raise RuntimeError("receipt contradicts failed trace: " + str(folder))
        if receipt.get("new_model_calls") and not attempts:
            raise RuntimeError("receipt has no model trace: " + str(folder))
        return "completed"
    if any(a.get("status") == "completed" for a in attempts) or transport.get(
        "saw_done"
    ):
        return "completed_response_needs_recovery"
    status = transport.get("http_status")
    if status in (400, 401, 402, 403, 404, 413):
        return "permanent_http_failure"
    if transport.get("local_setup_failure") or transport.get("curl_exit_code") == 7:
        return "local_setup_failure"
    if attempts and transport.get("sse_events", 0) > 0:
        return "incomplete_stream"
    if transport.get("failure_kind") == "request_mismatch":
        return "request_mismatch"
    return "unclassified_failure"


class RunLock:
    """Inherited by worker children so a lost parent cannot cause duplicate requests."""

    def __init__(self, root):
        self.path = Path(root) / ".resume.lock"

    def __enter__(self):
        self.stream = self.path.open("a+")
        try:
            fcntl.flock(self.stream, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            self.stream.close()
            raise RuntimeError(
                "another experiment process still holds the run lock"
            ) from None
        self.stream.seek(0)
        self.stream.truncate()
        json.dump({"pid": os.getpid(), "started_at": time.time()}, self.stream)
        self.stream.flush()
        return self

    @property
    def fd(self):
        return self.stream.fileno()

    def __exit__(self, *exc):
        # Do not LOCK_UN: a surviving child must retain this same open-file lock.
        self.stream.close()


class Recovery:
    def __init__(self, root, lock, retry_delay=15, max_attempts=MAX_ATTEMPTS):
        self.root = Path(root)
        self.lock = lock
        self.retry_delay = retry_delay
        if not isinstance(max_attempts, int) or not 1 <= max_attempts <= MAX_ATTEMPTS:
            raise ValueError("attempt limit must be between 1 and 3")
        self.max_attempts = max_attempts
        self.path = self.root / "recovery.json"
        self.data = (
            read_json(self.path)
            if self.path.exists()
            else {
                "schema": "volo.experiment-recovery.v1",
                "max_attempts": self.max_attempts,
                "steps": {},
            }
        )
        if self.data["max_attempts"] != self.max_attempts:
            raise RuntimeError("saved retry policy differs from this driver")

    def save(self):
        atomic_json(self.path, self.data)

    def run(self, cmd, log_path, cwd):
        with Path(log_path).open("w") as log:
            proc = subprocess.Popen(
                cmd,
                stdout=log,
                stderr=subprocess.STDOUT,
                env={**os.environ, "TZ": "UTC", "PYTHONHASHSEED": "0"},
                cwd=cwd,
                pass_fds=(self.lock.fd,),
            )
            try:
                return proc.wait()
            except BaseException:
                # Wait for the owned worker to finish cleanup; do not orphan a paid request.
                proc.terminate()
                try:
                    proc.wait(timeout=15)
                except subprocess.TimeoutExpired:
                    proc.kill()
                    proc.wait()
                raise

    def step(self, name, cmd, folder, cwd):
        folder = Path(folder)
        if (folder / "receipt.json").exists():
            if outcome(folder) != "completed":
                raise RuntimeError("invalid completed step: " + name)
            return
        entry = self.data["steps"].setdefault(name, {"attempts": []})
        records = entry["attempts"]
        known = {a["path"] for a in records}
        historical = sorted(folder.parent.glob(folder.name + "-attempt[0-9]*"))
        historical += [folder] if folder.exists() else []
        for path in historical:
            relative = str(path.relative_to(self.root))
            if path.is_dir() and relative not in known:
                records.append(
                    {"path": relative, "imported": True, "outcome": outcome(path)}
                )
                known.add(relative)
        hashes = {request_hash(self.root / a["path"]) for a in records}
        hashes.discard(None)
        if len(hashes) > 1:
            raise RuntimeError(
                "historical attempts contain different requests: " + name
            )
        expected = next(iter(hashes), entry.get("request_sha256"))
        if entry.get("request_sha256") not in (None, expected):
            raise RuntimeError("saved request hash changed: " + name)
        entry["request_sha256"] = expected
        self.save()
        while True:
            if folder.exists():
                kind = outcome(folder)
                if kind == "completed":
                    records[-1]["outcome"] = kind
                    self.save()
                    return
                if kind not in (
                    "incomplete_stream",
                    "local_setup_failure",
                    "request_mismatch",
                ):
                    entry["stopped_reason"] = kind
                    self.save()
                    raise RuntimeError(
                        name + ": " + kind + "; inspect retained evidence"
                    )
            if len(records) >= self.max_attempts:
                entry["stopped_reason"] = "attempt_limit"
                self.save()
                raise RuntimeError(
                    name + f": cumulative attempt limit reached ({self.max_attempts}); no new request"
                )
            if folder.exists():
                archived = folder.with_name(
                    folder.name + "-attempt" + str(len(records)) + "-" + kind
                )
                if archived.exists():
                    raise RuntimeError(
                        "refusing to overwrite retained failure: " + str(archived)
                    )
                # Persist rename intent first so interruption cannot reset the attempt count.
                record = next(
                    a
                    for a in records
                    if a["path"] == str(folder.relative_to(self.root))
                )
                record["archive_pending"] = str(archived.relative_to(self.root))
                self.save()
                folder.rename(archived)
                record["path"] = record.pop("archive_pending")
                record["outcome"] = kind
                old_log = folder.with_suffix(".log")
                if old_log.exists():
                    old_log.rename(archived.with_suffix(".log"))
                self.save()
            argv = list(cmd)
            if expected:
                argv += ["--expected-request-sha256", expected]
            records.append(
                {
                    "path": str(folder.relative_to(self.root)),
                    "started_at": time.time(),
                    "outcome": "reserved",
                    "python_version": sys.version.split()[0],
                    "python_executable": sys.executable,
                }
            )
            self.save()  # A lost process still consumes its reserved attempt.
            print(
                json.dumps(
                    {"step": name, "attempt": len(records), "limit": self.max_attempts}
                ),
                flush=True,
            )
            code = self.run(argv, folder.with_suffix(".log"), cwd)
            kind = outcome(folder)
            records[-1].update(outcome=kind, exit_code=code, finished_at=time.time())
            actual = request_hash(folder)
            if actual and expected and actual != expected:
                records[-1]["outcome"] = "request_mismatch"
                self.save()
                raise RuntimeError(name + ": request changed; recovery stopped")
            expected = expected or actual
            entry["request_sha256"] = expected
            self.save()
            if kind == "request_mismatch":
                # A corrected runtime may resume under the same cap and request guard.
                # Never repeat the mismatched preparation in the current invocation.
                raise RuntimeError(
                    name + ": request_mismatch; correct the runtime before resume"
                )
            if kind == "completed":
                if code:
                    raise RuntimeError(
                        name
                        + ": worker failed after saving receipt; inspect before resume"
                    )
                return
            if (
                kind in ("incomplete_stream", "local_setup_failure")
                and len(records) < MAX_ATTEMPTS
            ):
                time.sleep(self.retry_delay)


def repair_pending_archives(recovery):
    for entry in recovery.data["steps"].values():
        for record in entry["attempts"]:
            pending = record.get("archive_pending")
            if not pending:
                continue
            old, new = recovery.root / record["path"], recovery.root / pending
            if old.exists() == new.exists():
                raise RuntimeError("ambiguous interrupted evidence rename")
            if old.exists():
                old.rename(new)
            if (
                old.with_suffix(".log").exists()
                and not new.with_suffix(".log").exists()
            ):
                old.with_suffix(".log").rename(new.with_suffix(".log"))
            record["path"] = record.pop("archive_pending")
    recovery.save()
