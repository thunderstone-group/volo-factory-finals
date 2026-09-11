"""Private, redacted execution evidence and the official runtime bridge."""
from __future__ import annotations

import json
import os
import time
from pathlib import Path


def atomic_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(path.name + ".tmp")
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")
    os.chmod(temp, 0o600)
    temp.replace(path)


class Trace:
    def __init__(self, directory: Path):
        directory = directory.resolve()
        self.directory = directory
        directory.mkdir(parents=True, exist_ok=True)
        self.path = directory / "events.jsonl"
        self.started = time.monotonic()
        self.secrets = [value for key, value in os.environ.items()
                        if len(value) >= 8 and any(word in key.upper()
                           for word in ("API_KEY", "TOKEN", "PASSWORD", "SECRET"))]

    def redact(self, value):
        if isinstance(value, str):
            for secret in self.secrets:
                value = value.replace(secret, "[REDACTED]")
            return value
        if isinstance(value, dict):
            return {k: self.redact(v) for k, v in value.items()}
        if isinstance(value, list):
            return [self.redact(v) for v in value]
        return value

    def event(self, kind: str, **data):
        item = self.redact({"event": kind, "time": time.time(),
                            "elapsed_seconds": round(time.monotonic() - self.started, 3), **data})
        with self.path.open("a") as stream:
            stream.write(json.dumps(item, ensure_ascii=False) + "\n")
        os.chmod(self.path, 0o600)


class Runtime:
    def __init__(self, trace: Trace):
        self.trace, self.sdk = trace, None
        try:
            from arcbench_agent_runtime import AgentRuntime
        except ImportError:
            trace.event("sdk_unavailable", platform=bool(os.getenv("ARCBENCH_RUNNER_EVENTS_PATH")))
        else:
            try:
                self.sdk = AgentRuntime.from_env()
            except Exception as exc:
                trace.event("sdk_initialization_failed", error=str(exc))

    def emit(self, name, *args):
        if self.sdk:
            try:
                getattr(self.sdk.events, name)(*args)
            except Exception as exc:
                self.trace.event("sdk_event_failed", method=name, error=str(exc))

    def commit(self, message):
        if self.sdk:
            try:
                self.sdk.git.ensure_repo()
                self.sdk.git.commit(message)
            except Exception as exc:
                self.trace.event("sdk_commit_failed", error=str(exc))
