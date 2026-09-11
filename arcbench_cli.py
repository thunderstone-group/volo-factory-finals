"""Thin ArcBench website client; separate from the agent uploaded to the runner."""
from __future__ import annotations

import argparse
import hashlib
import html
import http.cookiejar
import http.server
import json
import os
import re
import secrets
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path


DEFAULT_ORIGIN = "https://arc-bench.com"
DEFAULT_SESSION = Path.home() / ".config/volo-factory/arcbench-session.json"
SENSITIVE = {"api_key", "access_token", "refresh_token", "password", "password_hash",
             "authorization", "cookie", "cookies", "session_token"}
STOP_WAITING = {"PASSED", "FAILED", "CANCELLED", "PAUSED"}


class APIError(RuntimeError):
    def __init__(self, message, *, status=None, method=None, path=None, uncertain=False):
        super().__init__(message)
        self.details = {"error": message, "http_status": status, "method": method,
                        "path": path, "outcome_uncertain": uncertain}


def private_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    temp = path.with_name(path.name + ".tmp-" + secrets.token_hex(4))
    try:
        fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w") as stream:
            json.dump(value, stream, ensure_ascii=False)
            stream.write("\n")
        temp.replace(path)
    finally:
        temp.unlink(missing_ok=True)


def encode_multipart(fields, file=None):
    boundary = "volo-" + secrets.token_hex(16)
    chunks = []
    for name, value in fields.items():
        chunks.extend([f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n".encode(),
                       str(value).encode(), b"\r\n"])
    if file:
        filename, data = file
        if any(character in filename for character in ('"', "\r", "\n")):
            raise ValueError("Archive filename contains unsupported characters")
        chunks.extend([f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\n"
                       "Content-Type: application/zip\r\n\r\n".encode(), data, b"\r\n"])
    chunks.append(f"--{boundary}--\r\n".encode())
    return b"".join(chunks), "multipart/form-data; boundary=" + boundary


class SameOriginRedirect(urllib.request.HTTPRedirectHandler):
    def __init__(self, origin):
        self.origin = origin

    def redirect_request(self, request, response, code, message, headers, newurl):
        target = urllib.parse.urlparse(newurl)
        if target.scheme + "://" + target.netloc != self.origin:
            raise APIError("Refusing to forward this authenticated request to another origin",
                           method=request.method, path=urllib.parse.urlparse(request.full_url).path)
        if request.method not in ("GET", "HEAD"):
            raise APIError("Mutation redirected; inspect the existing submission/run before retrying",
                           method=request.method, path=urllib.parse.urlparse(request.full_url).path, uncertain=True)
        return super().redirect_request(request, response, code, message, headers, newurl)


class Client:
    def __init__(self, origin=DEFAULT_ORIGIN, session=DEFAULT_SESSION, *, timeout=30):
        parsed = urllib.parse.urlparse(origin)
        if (not parsed.netloc or parsed.username or parsed.password or parsed.query or parsed.fragment
                or parsed.path not in ("", "/") or parsed.scheme not in ("https", "http")
                or parsed.scheme == "http" and parsed.hostname not in ("localhost", "127.0.0.1", "::1")):
            raise ValueError("Use an HTTPS origin, or HTTP on localhost for testing")
        self.origin, self.session, self.timeout = origin.rstrip("/"), Path(session), timeout
        self.cookies = http.cookiejar.CookieJar()
        self.known_secrets = []
        self.persist = True
        if self.session.exists():
            if self.session.stat().st_mode & 0o077:
                raise ValueError("Session file must be private: chmod 600 " + str(self.session))
            self.import_cookies(json.loads(self.session.read_text()))
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cookies),
                                                  SameOriginRedirect(self.origin))

    def import_cookies(self, payload):
        if payload.get("origin") != self.origin:
            raise ValueError("Session origin does not match the requested server")
        hostname = urllib.parse.urlparse(self.origin).hostname
        for item in payload["cookies"]:
            domain = item["domain"]
            if domain.lstrip(".") != hostname:
                raise ValueError("Cookie belongs to another host")
            expiry = item.get("expires")
            expires = int(expiry) if expiry and expiry > 0 else None
            cookie = http.cookiejar.Cookie(
                version=0, name=item["name"], value=item["value"], port=None, port_specified=False,
                domain=domain, domain_specified=domain.startswith("."), domain_initial_dot=domain.startswith("."),
                path=item.get("path", "/"), path_specified=True, secure=bool(item.get("secure", True)),
                expires=expires, discard=expires is None,
                comment=None, comment_url=None, rest={"HttpOnly": bool(item.get("httpOnly", True))})
            self.cookies.set_cookie(cookie)
            self.known_secrets.append(cookie.value)

    def save_session(self):
        if self.persist and self.cookies:
            private_json(self.session, {"origin": self.origin, "cookies": [
                {"name": c.name, "value": c.value, "domain": c.domain, "path": c.path,
                 "secure": c.secure, "httpOnly": c.has_nonstandard_attr("HttpOnly"), "expires": c.expires}
                for c in self.cookies]})

    def authenticate(self, payload):
        # Validate a newly imported session before replacing an existing credential file.
        self.persist = False
        try:
            self.cookies.clear()
            self.import_cookies(payload)
            result = self.request("GET", "/auth/me")
        finally:
            self.persist = True
        self.save_session()
        return {"authenticated": True, "user": user_summary(result.get("user") or {}),
                "session_file": str(self.session)}

    def safe(self, value):
        if isinstance(value, dict):
            return {key: "[REDACTED]" if key.lower() in SENSITIVE else self.safe(item)
                    for key, item in value.items()}
        if isinstance(value, list):
            return [self.safe(item) for item in value]
        if isinstance(value, str):
            value = re.sub(r"(Meter baseline captured for access key)\s+\S+", r"\1 [REDACTED]", value)
            for secret in [*self.known_secrets, *(cookie.value for cookie in self.cookies)]:
                if secret:
                    value = value.replace(secret, "[REDACTED]")
        return value

    def request(self, method, path, *, fields=None, file=None, binary=False):
        if not path.startswith("/") or path.startswith("//") or "#" in path:
            raise ValueError("Expected a relative API path")
        data, headers = None, {"Accept": "application/json", "User-Agent": "volo-factory-cli/0.1"}
        if fields is not None:
            data, headers["Content-Type"] = encode_multipart(fields, file)
        request = urllib.request.Request(self.origin + "/api" + path, data=data, headers=headers, method=method)
        try:
            with self.opener.open(request, timeout=self.timeout) as response:
                body = response.read()
                content_type = response.headers.get("Content-Type", "")
                status = response.status
            self.save_session()
        except urllib.error.HTTPError as error:
            self.save_session()
            try:
                payload = json.loads(error.read(8192))
                detail = payload.get("detail", payload)
                message = detail if isinstance(detail, str) else json.dumps(detail, ensure_ascii=False)
            except (ValueError, UnicodeError):
                message = error.reason
            raise APIError(self.safe(str(message)), status=error.code, method=method, path=path,
                           uncertain=method not in ("GET", "HEAD") and (error.code >= 500 or error.code == 408)) from None
        except (OSError, urllib.error.URLError) as error:
            raise APIError(self.safe(str(error)), method=method, path=path,
                           uncertain=method not in ("GET", "HEAD")) from None
        if binary:
            if "application/json" in content_type:
                raise APIError("Expected an archive, received JSON", status=status, method=method, path=path)
            return body
        if status == 204:
            return None
        try:
            return json.loads(body)
        except (ValueError, UnicodeError):
            raise APIError("Expected JSON; received " + content_type, status=status, method=method, path=path,
                           uncertain=method not in ("GET", "HEAD")) from None

    def archive(self, submission_id):
        return self.request("GET", "/submissions/" + identifier(submission_id) + "/archive", binary=True)

    def upload(self, archive, competition, name, model, gateway, runtime, api_key=None):
        path = Path(archive)
        if not zipfile.is_zipfile(path):
            raise ValueError("Upload must be a ZIP archive")
        raw = path.read_bytes()
        digest = hashlib.sha256(raw).hexdigest()
        if not api_key:
            api_key = self.request("GET", "/auth/access-key")["api_key"]
        if not api_key:
            raise ValueError("The configured model API key is empty")
        self.known_secrets.append(api_key)
        response = self.request("POST", "/submissions", fields={
            "competition_id": competition, "runtime": runtime, "catalog": "competition",
            "agent_source": "upload", "display_name": name, "base_url": gateway,
            "api_key": api_key, "model": model}, file=(path.name, raw))
        submission = response["submission"]
        result = {"submission": self.safe(submission), "uploaded_sha256": digest, "archive_verified": False}
        try:
            downloaded = self.archive(submission["id"])
            result["downloaded_sha256"] = hashlib.sha256(downloaded).hexdigest()
            result["archive_verified"] = result["downloaded_sha256"] == digest
        except APIError as error:
            result["archive_error"] = error.details
        return result

    def run(self, submission_id, requirement_id):
        # Preserve create and start as two separate stages; never retry a mutation.
        created = self.request("POST", "/runs", fields={
            "submission_id": submission_id, "requirement_id": requirement_id})
        run_id = created["run"]["id"]
        try:
            started = self.request("POST", "/runs/" + identifier(run_id) + "/start")
            return {"run_id": run_id, "url": self.origin + "/runs/" + run_id, "run": started}
        except APIError as error:
            return {"run_id": run_id, "url": self.origin + "/runs/" + run_id,
                    "start_error": error.details, "next": "Inspect status, then use: arcbench start " + run_id}


def identifier(value):
    return urllib.parse.quote(value, safe="")


def run_summary(run):
    keys = ("id", "submission_id", "requirement_id", "display_name", "model_name", "status", "score",
            "test_pass_rate", "passed_count", "failed_count", "run_duration_seconds", "token_count",
            "feature_implemented_count", "feature_total_count", "failure_reason")
    result = {key: run[key] for key in keys if key in run}
    # The website field is named *_usd even when its explicit currency is CNY.
    if "token_cost_usd" in run:
        result["cost"] = {"amount": run["token_cost_usd"], "currency": run.get("token_cost_currency")}
    result["steps"] = [{key: step.get(key) for key in ("key", "status", "description")}
                       for step in run.get("steps", [])]
    result["failed_tests"] = [{key: test.get(key) for key in ("name", "status", "error")}
                              for test in run.get("tests", []) if test.get("passed") is False]
    return result


def log_summary(run_id, payload, tail):
    console = payload.get("console") or payload.get("stdout") or payload.get("events") or ""
    return {"run_id": run_id, "console": "\n".join(console.splitlines()[-tail:]),
            "stderr": "\n".join((payload.get("stderr") or "").splitlines()[-tail:]),
            "next_offset": payload.get("log_offset"), "last_event_id": payload.get("last_event_id")}


def submission_summary(submission):
    return {key: submission[key] for key in
            ("id", "display_name", "model_name", "competition_id", "requirement_id", "runtime", "created_at")
            if key in submission}


def user_summary(user):
    return {key: user[key] for key in ("id", "username", "registration_source") if key in user}


def emit(client, value):
    print(json.dumps(client.safe(value), ensure_ascii=False, separators=(",", ":")), flush=True)


def browser_import(client):
    """One-use localhost form for transferring an already authorized browser session."""
    route = "/session/" + secrets.token_urlsafe(24)
    outcome = {"authenticated": False}
    class Handler(http.server.BaseHTTPRequestHandler):
        def reply(self, status, content):
            body = content.encode()
            self.send_response(status)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Security-Policy", "default-src 'none'; form-action 'self'; frame-ancestors 'none'")
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            if self.path != route:
                self.reply(404, "Not found")
                return
            self.reply(200, '<!doctype html><meta charset="utf-8"><title>ArcBench CLI login</title>'
                       '<h1>Connect ArcBench CLI</h1><form method="post">'
                       '<label for="session">Session JSON</label>'
                       '<input id="session" name="session" type="password" autocomplete="off" required>'
                       '<button type="submit">Connect CLI</button></form>')

        def do_POST(self):
            expected_origin = f"http://127.0.0.1:{self.server.server_port}"
            if self.path != route or self.headers.get("Origin") != expected_origin:
                self.reply(403, "Unexpected origin")
                return
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 65536:
                self.reply(400, "Invalid session payload size")
                return
            try:
                fields = urllib.parse.parse_qs(self.rfile.read(length).decode())
                payload = json.loads(fields["session"][0])
                result = client.authenticate(payload)
                outcome.update(result)
                self.reply(200, "<!doctype html><title>Connected</title><h1>ArcBench CLI connected</h1>"
                           "<p>The session was saved privately on this computer. You can close this tab.</p>")
            except (APIError, ValueError, KeyError) as error:
                self.reply(400, "Connection failed: " + html.escape(client.safe(str(error))))
            finally:
                self.server.finished = True

        def log_message(self, *args):
            pass

    with http.server.HTTPServer(("127.0.0.1", 0), Handler) as server:
        server.finished = False
        server.timeout = 1
        emit(client, {"login_url": f"http://127.0.0.1:{server.server_port}{route}", "expires_in_seconds": 180})
        deadline = time.monotonic() + 180
        while not server.finished and time.monotonic() < deadline:
            server.handle_request()
    emit(client, outcome)
    return 0 if outcome["authenticated"] else 1


def parser():
    root = argparse.ArgumentParser(description="Upload, run and inspect ArcBench through the website API.")
    root.add_argument("--origin", default=DEFAULT_ORIGIN)
    root.add_argument("--session", type=Path, default=DEFAULT_SESSION)
    root.add_argument("--http-timeout", type=float, default=30)
    commands = root.add_subparsers(dest="command", required=True)
    auth = commands.add_parser("auth-import", help="Import origin-scoped browser cookies; never echo them")
    auth.add_argument("--listen", action="store_true", help="Use a one-use localhost form instead of stdin")
    commands.add_parser("whoami", help="Check the saved login session")
    commands.add_parser("competitions")
    tasks = commands.add_parser("tasks")
    tasks.add_argument("competition")
    submissions = commands.add_parser("submissions")
    submissions.add_argument("--competition")
    runs = commands.add_parser("runs")
    runs.add_argument("--task")
    runs.add_argument("--submission")
    upload = commands.add_parser("upload", help="Save a submission and verify its archive by download and SHA-256")
    upload.add_argument("archive", type=Path)
    upload.add_argument("--competition", required=True)
    upload.add_argument("--name", required=True)
    upload.add_argument("--model", default="deepseek-v4-flash")
    upload.add_argument("--gateway", default="https://api.arc-bench.com/v1")
    upload.add_argument("--runtime", choices=("python", "node"), default="python")
    upload.add_argument("--api-key-env", help="Read model key from this environment variable instead of the account access key")
    run = commands.add_parser("run", help="Create a run from a saved submission, then start it")
    run.add_argument("submission")
    run.add_argument("--task", required=True)
    for name in ("start", "cancel", "status", "wait", "logs", "download"):
        command = commands.add_parser(name)
        command.add_argument("run")
        if name == "wait":
            command.add_argument("--timeout", type=float, default=1200)
            command.add_argument("--interval", type=float, default=10)
        if name == "logs":
            command.add_argument("--offset", type=int, default=0)
            command.add_argument("--tail", type=int, default=40)
        if name == "download":
            command.add_argument("--output", required=True, type=Path)
        if name == "status":
            command.add_argument("--full", action="store_true")
    archive = commands.add_parser("archive")
    archive.add_argument("submission")
    archive.add_argument("--output", required=True, type=Path)
    board = commands.add_parser("leaderboard")
    board.add_argument("--competition", required=True)
    board.add_argument("--team")
    board.add_argument("--limit", type=int, default=10)
    return root


def main(argv=None):
    args = parser().parse_args(argv)
    client = None
    try:
        client = Client(args.origin, args.session, timeout=args.http_timeout)
        if args.command == "auth-import":
            if args.listen:
                return browser_import(client)
            if sys.stdin.isatty():
                raise ValueError("Pipe session JSON to stdin; do not put credentials in command arguments")
            emit(client, client.authenticate(json.load(sys.stdin)))
        elif args.command == "whoami":
            emit(client, {"user": user_summary(client.request("GET", "/auth/me")["user"])})
        elif args.command == "competitions":
            emit(client, [{key: item[key] for key in
                 ("id", "title", "status", "task_count", "total_tests", "template_required") if key in item}
                 for item in client.request("GET", "/competitions")])
        elif args.command == "tasks":
            competition = client.request("GET", "/competitions/" + identifier(args.competition))
            result = {key: competition[key] for key in
                 ("id", "title", "task_count", "total_tests", "template_required") if key in competition}
            result["tasks"] = [{key: task[key] for key in
                ("id", "display_id", "title", "category", "total_tests", "module_count") if key in task}
                for task in competition.get("tasks", [])]
            emit(client, result)
        elif args.command == "submissions":
            submissions = client.request("GET", "/submissions")
            emit(client, [submission_summary(item) for item in submissions
                          if not args.competition or item.get("competition_id") == args.competition])
        elif args.command == "runs":
            query = urllib.parse.urlencode({k: v for k, v in
                (("requirement_id", args.task), ("submission_id", args.submission)) if v})
            emit(client, [run_summary(run) for run in client.request("GET", "/runs" + ("?" + query if query else ""))])
        elif args.command == "upload":
            key = None
            if args.api_key_env:
                key = os.environ.get(args.api_key_env)
                if not key:
                    raise ValueError("Missing model key environment variable: " + args.api_key_env)
            result = client.upload(args.archive, args.competition, args.name, args.model, args.gateway, args.runtime, key)
            emit(client, result)
            return 0 if result["archive_verified"] else 1
        elif args.command == "run":
            result = client.run(args.submission, args.task)
            if "run" in result:
                result["run"] = run_summary(result["run"])
            emit(client, result)
            return 1 if "start_error" in result else 0
        elif args.command == "start":
            emit(client, run_summary(client.request("POST", "/runs/" + identifier(args.run) + "/start")))
        elif args.command == "cancel":
            client.request("POST", "/runs/" + identifier(args.run) + "/cancel")
            emit(client, run_summary(client.request("GET", "/runs/" + identifier(args.run))))
        elif args.command == "status":
            result = client.request("GET", "/runs/" + identifier(args.run))
            emit(client, result if args.full else run_summary(result))
        elif args.command == "wait":
            if args.interval <= 0 or args.timeout <= 0:
                raise ValueError("Wait timeout and interval must be positive")
            deadline, previous = time.monotonic() + args.timeout, None
            while True:
                result = client.request("GET", "/runs/" + identifier(args.run))
                summary = run_summary(result)
                signature = json.dumps({k: v for k, v in summary.items() if k != "updated_at"}, sort_keys=True)
                if signature != previous:
                    emit(client, summary)
                    previous = signature
                if result["status"] in STOP_WAITING:
                    return 0 if result["status"] == "PASSED" else 1
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    emit(client, {"run_id": args.run, "waiting_timed_out": True, "run_cancelled": False})
                    return 2
                time.sleep(min(args.interval, remaining))
        elif args.command == "logs":
            if args.tail <= 0 or args.offset < 0:
                raise ValueError("Log tail must be positive and offset must be nonnegative")
            key = client.request("GET", "/auth/access-key").get("api_key")
            if key:
                client.known_secrets.append(key)
            result = client.request("GET", "/runs/" + identifier(args.run) + "/logs?log_offset=" + str(args.offset))
            emit(client, log_summary(args.run, result, args.tail))
        elif args.command in ("download", "archive"):
            if args.output.exists():
                raise ValueError("Output already exists; choose a new path")
            raw = (client.archive(args.submission) if args.command == "archive" else client.request(
                "GET", "/runs/" + identifier(args.run) + "/workspace/template-bundle", binary=True))
            args.output.parent.mkdir(parents=True, exist_ok=True)
            with args.output.open("xb") as stream:
                stream.write(raw)
            emit(client, {"path": str(args.output.resolve()), "bytes": len(raw),
                          "sha256": hashlib.sha256(raw).hexdigest()})
        elif args.command == "leaderboard":
            query = urllib.parse.urlencode({"track": "all", "competition_id": args.competition})
            rows = client.request("GET", "/competitions/leaderboard?" + query)
            ranked = [{"rank": index + 1, **row} for index, row in enumerate(rows)]
            if args.team:
                ranked = [row for row in ranked if row.get("username") == args.team]
            emit(client, ranked[:args.limit])
        return 0
    except APIError as error:
        print(json.dumps(error.details, ensure_ascii=False), file=sys.stderr)
        return 1
    except (ValueError, OSError, KeyError) as error:
        message = client.safe(str(error)) if client else str(error)
        print(json.dumps({"error": message}, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
