#!/usr/bin/env python3
"""ARC-Bench web adapter: generate a complete application from a requirement folder.

    python3 main.py <requirement_path> --output-dir <DIR> --type web

Reads `<requirement_path>/requirements.yaml`, sends it to the model together with
`dialect.md` (how the official accessibility-driven suite resolves controls) and the
delivery contract, and writes the returned files under `<DIR>`.

Environment: OPENAI_API_KEY, OPENAI_BASE_URL, MODEL (default deepseek-v4-flash).
"""
import argparse
import json
import os
import re
import sys
import time
from pathlib import Path, PurePosixPath, PureWindowsPath

import http.client
import shlex
import tempfile
from urllib import error, request

HERE = Path(__file__).resolve().parent
DEFAULT_BASE = "https://api.arc-bench.com/v1"
DEFAULT_MODEL = "deepseek-v4-flash"
MAX_TOKENS = 32768
MAX_CALLS = 3  # Shared by retries and the single truncation continuation.

CONTRACT = """## Delivery contract (a runner enforces this exactly)
Emit two npm packages under one application root.
- `frontend/package.json` must have a `build` script. `npm run build` produces `frontend/dist/`
  containing `index.html` and whatever assets it references. A pure-static frontend is fine and the
  build may be a plain copy: `"build": "node -e \\"require('fs').cpSync('public','dist',{recursive:true})\\""`.
- `backend/package.json` must have a `start` script of the form `node server.js`
  (a relative .js/.cjs/.mjs entry file, with no shell operators). `npm run start` launches an HTTP server that
  listens on `process.env.PORT`, serves `../frontend/dist` as static files with `/` -> `index.html`,
  and serves the JSON API under `/api/*`.
- `GET /api/health` returns 200 with exactly `{"code":200,"message":"Backend Ready"}`, and only after
  the seed data is fully in place. Everything is scored zero if this never answers.
- ZERO npm dependencies. Backend uses `node:http`, `node:fs`, `node:path` only. Frontend is plain
  HTML/CSS/JS, no framework, no bundler, no CDN (the test machine has no network).
- Keep all application state in backend memory and reseed on startup, so every run starts clean.
- Never let an API handler throw: wrap request handling so one bad request cannot kill the process.
- Every file you emit must be complete and syntactically valid. No placeholders, no "...", no TODO.
Output format: emit each file as a block, and nothing else — no JSON, no markdown fence, no
commentary, no blank line between blocks. The two markers stand alone on their own lines, verbatim:
=== FILE: backend/package.json ===
<the complete text of that file>
=== END ===
=== FILE: frontend/public/index.html ===
<the complete text of that file>
=== END ===
The path is relative to the application root. Emit every file the application needs, in full."""

SYSTEM = ("You are a senior full-stack engineer. You are given a requirements document and a precise "
          "description of the automated accessibility-driven acceptance suite that will grade your work. "
          "You get exactly one attempt: no tools, no feedback, no iteration. Write the complete, working "
          "application in one response. Correctness against the described locator dialect matters far "
          "more than visual polish. Emit the file blocks and nothing else.")

CONTINUE = ("Your output was cut off inside the file `{path}`. Re-emit that file from its beginning as "
            "one complete block, then continue with every remaining file. Do not repeat files you already "
            "emitted in full. Use the same `=== FILE: <path> ===` and `=== END ===` framing and emit "
            "nothing else.")

FILE_OPEN = re.compile(r"=== FILE:[ \t]*(.*?)[ \t]*===[ \t]*")
TOKEN_FIELDS = ("prompt_tokens", "completion_tokens")


class StreamError(RuntimeError):
    """A retryable interrupted or malformed event stream."""


class NoModelRedirect(request.HTTPRedirectHandler):
    """A gateway redirect must never forward the model credential elsewhere."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise error.HTTPError(req.full_url, code, "model redirect refused", headers, fp)


def _open_model(req, timeout):
    return request.build_opener(NoModelRedirect()).open(req, timeout=timeout)


class CallBudget:
    """One global request cap and an honest ledger, including failed requests."""

    def __init__(self, limit=MAX_CALLS):
        if not isinstance(limit, int) or isinstance(limit, bool) or not 1 <= limit <= MAX_CALLS:
            raise ValueError(f"call limit must be between 1 and {MAX_CALLS}")
        self.limit = limit
        self.attempts = []

    def start(self, messages, model):
        if len(self.attempts) >= self.limit:
            raise RuntimeError(f"global model call limit reached ({self.limit})")
        record = {"call": len(self.attempts) + 1, "model": model, "messages": list(messages),
                  "content": "", "usage": {}, "usage_events": [], "status": "failed",
                  "finish_reason": None}
        self.attempts.append(record)
        return record

    def summary(self):
        result = {"calls": len(self.attempts), "call_limit": self.limit}
        unknown = [r["call"] for r in self.attempts
                   if any(field not in r["usage"] for field in TOKEN_FIELDS)]
        for field in TOKEN_FIELDS:
            values = [r["usage"][field] for r in self.attempts if field in r["usage"]]
            result["known_" + field] = sum(values) if values else None
            result[field] = sum(values) if len(values) == len(self.attempts) and values else None
        result["unknown_usage_calls"] = unknown
        result["billing_status"] = ("not_called" if not self.attempts else
                                    "unknown" if unknown else "tokens_reported_cost_not_estimated")
        return result


def stream_completion(messages, model, base, key, budget, tries=3):
    """Buffer each attempt separately; failed streams never write application files."""
    payload = {"model": model, "messages": messages, "max_tokens": MAX_TOKENS,
               "temperature": 0.3, "stream": True, "stream_options": {"include_usage": True}}
    req = request.Request(base.rstrip("/") + "/chat/completions",
                          data=json.dumps(payload).encode("utf-8"),
                          headers={"Content-Type": "application/json",
                                   "Authorization": "Bearer " + key}, method="POST")
    for attempt in range(tries):
        record = budget.start(messages, model)
        started = time.monotonic()
        retryable = False
        try:
            ended = False
            with _open_model(req, timeout=900) as response:
                for line in response:
                    if not line.startswith(b"data:"):
                        continue
                    chunk = line[5:].strip()
                    if chunk == b"[DONE]":
                        ended = True
                        break
                    try:
                        obj = json.loads(chunk)
                        if not isinstance(obj, dict) or "error" in obj:
                            raise ValueError("invalid stream object")
                        usage = obj.get("usage")
                        if isinstance(usage, dict):
                            record["usage_events"].append(usage)
                            # Usage frames are cumulative snapshots within ONE request.
                            for field in TOKEN_FIELDS:
                                value = usage.get(field)
                                if isinstance(value, int) and not isinstance(value, bool) and value >= 0:
                                    record["usage"][field] = max(record["usage"].get(field, 0), value)
                        choices = obj.get("choices", [])
                        if not isinstance(choices, list):
                            raise ValueError("choices must be a list")
                        for choice in choices:
                            delta = (choice.get("delta") or {}).get("content") or ""
                            if not isinstance(delta, str):
                                raise ValueError("content must be text")
                            record["content"] += delta
                            if choice.get("finish_reason"):
                                record["finish_reason"] = choice["finish_reason"]
                    except (ValueError, TypeError, AttributeError) as exc:
                        raise StreamError("malformed SSE event") from exc
            if not ended or record["finish_reason"] is None:
                raise StreamError("stream ended without completion markers")
            if record["finish_reason"] not in ("stop", "length"):
                raise ValueError("unsupported finish reason: " + str(record["finish_reason"]))
            if not record["content"].strip():
                raise ValueError("stream produced no content")
            record["status"] = "completed"
            return record["content"], record["usage"], record["finish_reason"]
        except error.HTTPError as exc:
            record["error_type"] = type(exc).__name__
            record["http_status"] = exc.code
            retryable = exc.code in (408, 429) or 500 <= exc.code < 600
            if exc.fp is not None:
                exc.close()
            failure = RuntimeError(f"model HTTP {exc.code}")
        except (error.URLError, OSError, http.client.IncompleteRead, StreamError) as exc:
            record["error_type"] = type(exc).__name__
            retryable = True
            failure = RuntimeError(f"model stream failed ({type(exc).__name__})")
        finally:
            record["elapsed_seconds"] = round(time.monotonic() - started, 3)
        if not retryable or attempt + 1 >= tries or len(budget.attempts) >= budget.limit:
            raise failure
        print(f"[oneshot] call {record['call']} failed; bounded retry", file=sys.stderr)
        time.sleep(1)
    raise RuntimeError("no model call attempted")


def resolve_path(out, name):
    """Check path components AND resolved hierarchy (including existing symlinks)."""
    if not isinstance(name, str) or not name.strip() or "\x00" in name or "\\" in name:
        raise ValueError("invalid file path")
    relative = PurePosixPath(name)
    if relative.is_absolute() or PureWindowsPath(name).drive or ".." in relative.parts:
        raise ValueError("path escapes the output directory: " + name)
    root = out.resolve()
    target = (root / name).resolve()
    if target == root or root not in target.parents:
        raise ValueError("path escapes the output directory: " + name)
    return target


def parse_blocks(text):
    """Strict line framing; only a nonempty final open block may be continued."""
    files, current, body = [], None, []
    for line in text.splitlines(keepends=True):
        marker = line.rstrip("\r\n")
        opening = FILE_OPEN.fullmatch(marker)
        if opening:
            if current is not None:
                raise ValueError("unterminated file before next block: " + current)
            current = opening.group(1).strip()
            if not current:
                raise ValueError("empty file block path")
            body = []
        elif marker.rstrip(" \t") == "=== END ===":
            if current is None:
                raise ValueError("file closing marker without an open block")
            content = "".join(body)
            if not content.strip():
                raise ValueError("empty file block: " + current)
            if any(item["path"] == current for item in files):
                raise ValueError("duplicate file block: " + current)
            files.append({"path": current, "content": content.rstrip("\r\n") + "\n"})
            current, body = None, []
        elif marker.startswith(("=== FILE", "=== END")):
            raise ValueError("malformed file marker")
        elif current is not None:
            body.append(line)
        elif line.strip():
            raise ValueError("text outside file blocks")
    if not files and current is None:
        raise ValueError("no file blocks in the response")
    return files, [current] if current is not None else []


def write_one(out, item):
    target = resolve_path(out, item["path"])
    if not isinstance(item.get("content"), str) or not item["content"].strip():
        raise ValueError("empty file block: " + item["path"])
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(item["content"], encoding="utf-8")


def missing_required(out):
    """Cheap delivery checks only: never execute generated scripts or call a model."""
    out = out.resolve()
    needed = []
    for package, script in (("backend", "start"), ("frontend", "build")):
        name = f"{package}/package.json"
        try:
            manifest = json.loads(resolve_path(out, name).read_text(encoding="utf-8"))
            if not isinstance(manifest, dict):
                raise ValueError("manifest must be an object")
            scripts = manifest.get("scripts", {})
            if not isinstance(scripts, dict) or not isinstance(scripts.get(script), str) or not scripts[script].strip():
                raise ValueError(f"missing nonempty {script} script")
            for field in ("dependencies", "devDependencies", "optionalDependencies", "peerDependencies"):
                if manifest.get(field):
                    raise ValueError("delivery requires zero npm dependencies")
            if package == "backend":
                command = shlex.split(scripts[script])
                if len(command) != 2 or command[0] != "node" or not command[1].endswith((".js", ".cjs", ".mjs")):
                    raise ValueError("start must be node <relative .js/.cjs/.mjs file>")
                entry = resolve_path(resolve_path(out, "backend"), command[1])
                if not entry.is_file() or not entry.read_text(encoding="utf-8").strip():
                    raise ValueError("missing or empty backend entry file")
        except (OSError, ValueError) as exc:
            needed.append(f"{name}: {exc}")
    frontend = resolve_path(out, "frontend")
    pages = [p for p in frontend.rglob("index.html") if p.is_file()]
    if not any(resolve_path(out, str(p.relative_to(out.resolve()))).read_text(encoding="utf-8").strip()
               for p in pages):
        needed.append("frontend: missing nonempty index.html")
    return needed


def generate(requirements, model, base, key, out, budget=None):
    budget = budget if budget is not None else CallBudget()
    # Reusing a nonempty directory could hide missing files behind an earlier run.
    out = Path(os.path.abspath(out))
    if out.is_symlink() or (out.exists() and (not out.is_dir() or any(out.iterdir()))):
        raise ValueError("output directory must be absent or empty, and not a symlink")
    out.parent.mkdir(parents=True, exist_ok=True)
    user = ((HERE / "dialect.md").read_text(encoding="utf-8") + "\n\n" + CONTRACT +
            "\n\n## Requirements (the application to build)\n```yaml\n" + requirements + "\n```")
    messages = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": user}]
    files, expected = [], None
    with tempfile.TemporaryDirectory(prefix=".oneshot-", dir=out.parent) as temp:
        stage = Path(temp) / "app"
        stage.mkdir()
        for turn in range(2):
            content, _, finish = stream_completion(messages, model, base, key, budget)
            batch, missing = parse_blocks(content)
            for name in [item["path"] for item in batch] + missing:
                resolve_path(stage, name)
            if expected and (not batch or batch[0]["path"] != expected):
                raise ValueError("continuation did not complete file: " + expected)
            for item in batch:
                target = resolve_path(stage, item["path"])
                if target.exists():
                    raise ValueError("duplicate file path: " + item["path"])
                write_one(stage, item)
                files.append(item)
            if not missing:
                if finish == "length":
                    raise ValueError("output truncated between file blocks; remaining files unknown")
                break
            if turn == 1 or finish != "length":
                raise ValueError("unterminated file block: " + missing[0])
            expected = missing[0]
            messages += [{"role": "assistant", "content": content},
                         {"role": "user", "content": CONTINUE.format(path=expected)}]
        needed = missing_required(stage)
        if needed:
            raise ValueError("incomplete delivery: " + "; ".join(needed))
        # All generation and retries are staged. Publish the validated directory in one rename.
        if out.is_symlink() or (out.exists() and (not out.is_dir() or any(out.iterdir()))):
            raise ValueError("output directory changed during generation")
        stage.replace(out)
    return files, budget.summary()


def main(argv=None):
    parser = argparse.ArgumentParser(description="Generate an ARC-Bench web application.")
    parser.add_argument("requirement_path", type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--type", default="web", choices=("web",))
    args = parser.parse_args(argv)
    document = args.requirement_path / "requirements.yaml"
    if not document.is_file():
        print(f"[oneshot] no requirements.yaml under {args.requirement_path}", file=sys.stderr)
        return 1
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        print("[oneshot] OPENAI_API_KEY is not set", file=sys.stderr)
        return 1
    budget = CallBudget()
    started = time.monotonic()
    try:
        files, _ = generate(document.read_text(encoding="utf-8"),
                            os.environ.get("MODEL", DEFAULT_MODEL),
                            os.environ.get("OPENAI_BASE_URL", DEFAULT_BASE), key,
                            args.output_dir, budget)
    except Exception as exc:
        print(("[oneshot] failed: " + str(exc)).replace(key, "[REDACTED]"), file=sys.stderr)
        return 1
    else:
        print(f"[oneshot] wrote {len(files)} files in {time.monotonic() - started:.1f}s")
        return 0
    finally:
        # True prompts, responses, timing and usage, including failures; never headers or keys.
        for attempt in budget.attempts:
            print("[oneshot] trace " + json.dumps(attempt, ensure_ascii=False).replace(key, "[REDACTED]"),
                  file=sys.stderr)
        print("[oneshot] usage " + json.dumps(budget.summary(), sort_keys=True), file=sys.stderr)


if __name__ == "__main__":
    sys.exit(main())
