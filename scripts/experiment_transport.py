"""Owned SSH/curl lifetime and transport evidence for one experiment request."""

import hashlib
import json
import os
import re
import socket
import subprocess
import time

from experiment_recovery import atomic_json


class Response:
    def __init__(
        self, request, key, out, observed, route, http_version, expected_hash=None
    ):
        self.out, self.observed, self.key = out, observed, key
        self.proc = self.tunnel = self.raw = self.err = self.tunnel_log = None
        self.raw_bytes = 0
        self.started = time.monotonic()
        observed["request_sha256"] = hashlib.sha256(request.data).hexdigest()
        if expected_hash and observed["request_sha256"] != expected_hash:
            observed["failure_kind"] = "request_mismatch"
            observed["request_reached_gateway"] = False
            raise ValueError(
                "request bytes differ from the preserved failed attempt; no request sent"
            )
        request_file = out / "request.json"
        request_file.write_bytes(request.data)
        request_file.chmod(0o600)
        try:
            self.err = (out / "curl.stderr").open("wb")
            self.raw = (out / "provider.sse").open("wb")
            (out / "provider.sse").chmod(0o600)
            host = os.environ.get("ARC_EXPERIMENT_SSH_HOST")
            if host:
                with socket.socket() as sock:
                    sock.bind(("127.0.0.1", 0))
                    port = sock.getsockname()[1]
                self.tunnel_log = (out / "ssh.stderr").open("wb")
                self.tunnel = subprocess.Popen(
                    [
                        "ssh",
                        "-N",
                        "-D",
                        "127.0.0.1:" + str(port),
                        "-o",
                        "BatchMode=yes",
                        "-o",
                        "ConnectTimeout=12",
                        "-o",
                        "ExitOnForwardFailure=yes",
                        "-o",
                        "ServerAliveInterval=15",
                        "-o",
                        "ServerAliveCountMax=3",
                        host,
                    ],
                    stdin=subprocess.DEVNULL,
                    stdout=subprocess.DEVNULL,
                    stderr=self.tunnel_log,
                )
                deadline = time.monotonic() + 20
                ready = False
                while time.monotonic() < deadline and self.tunnel.poll() is None:
                    try:
                        with socket.create_connection(("127.0.0.1", port), timeout=0.3):
                            ready = True
                            break
                    except OSError:
                        time.sleep(0.2)
                if not ready:
                    observed.update(
                        local_setup_failure=True, request_reached_gateway=False
                    )
                    raise OSError("temporary SSH proxy did not become ready")
                route = "socks5h://127.0.0.1:" + str(port)
                observed.update(route=route, tunnel_pid=self.tunnel.pid, ssh_host=host)
            self.proc = subprocess.Popen(
                [
                    "curl",
                    "-q",
                    "--silent",
                    "--show-error",
                    "--http" + http_version,
                    "--proxy",
                    route,
                    "--noproxy",
                    "",
                    "--no-buffer",
                    "--connect-timeout",
                    "30",
                    "--max-time",
                    "1200",
                    "--fail-with-body",
                    "--write-out",
                    "%{stderr}http_code=%{http_code} http_version=%{http_version} size_download=%{size_download}\n",
                    "--request",
                    "POST",
                    "--config",
                    "-",
                    "--data-binary",
                    "@" + str(request_file),
                    request.full_url,
                ],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=self.err,
            )
            self.proc.stdin.write(
                (
                    'header = "Content-Type: application/json"\n'
                    'header = "Authorization: Bearer ' + key + '"\n'
                ).encode()
            )
            self.proc.stdin.close()
        except BaseException:
            self.cleanup()
            raise

    def __enter__(self):
        return self

    def __iter__(self):
        for line in self.proc.stdout:
            self.observed["lines"] += 1
            safe_line = line.decode("utf-8", "replace").replace(self.key, "[REDACTED]")
            self.observed["last_lines"] = (
                self.observed["last_lines"] + [safe_line[:800]]
            )[-3:]
            if self.raw_bytes < 20_000_000:
                self.raw.write(line.replace(self.key.encode(), b"[REDACTED]"))
                self.raw_bytes += len(line)
            if line.startswith(b"data:"):
                self.observed["sse_events"] += 1
                chunk = line[5:].strip()
                if chunk == b"[DONE]":
                    self.observed["saw_done"] = True
                else:
                    try:
                        data = json.loads(chunk)
                        self.observed["request_id"] = data.get(
                            "id", self.observed.get("request_id")
                        )
                        self.observed["response_model"] = data.get(
                            "model", self.observed.get("response_model")
                        )
                        for choice in data.get("choices") or []:
                            delta = choice.get("delta") or {}
                            self.observed["reasoning_chars"] += len(
                                delta.get("reasoning_content") or ""
                            )
                            self.observed["content_chars"] += len(
                                delta.get("content") or ""
                            )
                        if data.get("error"):
                            self.observed["upstream_error"] = str(
                                data["error"]
                            ).replace(self.key, "[REDACTED]")[:1200]
                    except (ValueError, TypeError, AttributeError):
                        pass  # The frozen model parser remains authoritative for validity.
            elif line.lstrip().startswith(b"{"):
                try:
                    data = json.loads(safe_line)
                    if data.get("error"):
                        self.observed["upstream_error"] = str(data["error"])[:1200]
                except (ValueError, TypeError, AttributeError):
                    pass
            if self.observed["lines"] % 1000 == 0:
                atomic_json(
                    self.out / "progress.json",
                    {k: v for k, v in self.observed.items() if k != "last_lines"},
                )
            yield line

    @staticmethod
    def stop(proc):
        if proc and proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()

    def cleanup(self):
        self.stop(self.proc)
        if self.proc:
            self.observed["curl_exit_code"] = self.proc.returncode
            for stream in (self.proc.stdin, self.proc.stdout):
                if stream and not stream.closed:
                    stream.close()
        if self.tunnel:
            self.observed["ssh_exit_before_cleanup"] = self.tunnel.poll()
            self.stop(self.tunnel)
        for stream in (self.raw, self.err, self.tunnel_log):
            if stream:
                stream.close()
        stderr = self.out / "curl.stderr"
        if stderr.exists():
            matches = re.findall(
                r"http_code=(\d+) http_version=(\S*)",
                stderr.read_text(errors="replace"),
            )
            if matches:
                self.observed["http_status"] = int(matches[-1][0])
                self.observed["negotiated_http_version"] = matches[-1][1]
        if self.observed.get("curl_exit_code") == 7 and not self.observed["sse_events"]:
            self.observed.update(
                local_setup_failure=True, request_reached_gateway=False
            )
        self.observed.update(
            raw_capture_limit_bytes=20_000_000,
            raw_capture_truncated=self.raw_bytes >= 20_000_000,
            elapsed_seconds=round(time.monotonic() - self.started, 3),
        )

    def __exit__(self, kind, error, traceback):
        try:
            if error:
                self.observed["exception"] = str(error).replace(self.key, "[REDACTED]")[
                    :400
                ]
                self.observed["cause"] = str(getattr(error, "__cause__", None)).replace(
                    self.key, "[REDACTED]"
                )[:400]
            elif self.proc.poll() is None:
                try:
                    self.proc.wait(timeout=20)
                except subprocess.TimeoutExpired:
                    self.observed["cleanup_timeout"] = True
        finally:
            self.cleanup()
