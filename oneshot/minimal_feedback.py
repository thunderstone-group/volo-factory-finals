"""Minimal (极简版): opt-in syntax/runtime feedback, not a shipped entrypoint.

Uses the host's trusted Node parser, not npm scripts or application/self-test code.
Repairs use explicit offline responses or an explicitly enabled gateway call.
No evaluator input, automatic retries, or behavioral pass claim.
"""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import re
import selectors
import shutil
import signal
import subprocess
import tempfile
import time

from oneshot import main as baseline

MAX_LOG = 16384
CHECK_SECONDS = 10
SOURCE = "runtime:node--check/backend-javascript/v1"


def identity(blobs):
    hashes = {name: hashlib.sha256(data).hexdigest() for name, data in sorted(blobs.items())}
    return hashlib.sha256(json.dumps(hashes, sort_keys=True).encode()).hexdigest()


def redact(text):
    # No credential file is opened. Known environment values and common assignments
    # are scrubbed before source/diagnostics enter a repair packet or returned trace.
    for name, value in os.environ.items():
        if value and re.search(r"KEY|TOKEN|SECRET|PASSWORD|COOKIE|AUTH", name, re.I):
            text = text.replace(value, "[REDACTED]")
    text = re.sub(r"(?i)(bearer\s+)[\w.~-]+", r"\1[REDACTED]", text)
    return re.sub(r'''(?i)((?:api[_-]?key|token|secret|password|cookie|authorization)["']?\s*[:=]\s*["']?)[^\s"';,}]+''',
                  r"\1[REDACTED]", text)


def _process(argv, cwd, seconds, *, env=None, max_log=MAX_LOG):
    """Bound memory, time and logs; reap this process group on every exit path."""
    start = time.monotonic()
    record = {"argv": argv, "exit_code": None, "status": "unknown", "output": "",
              "timeout_seconds": seconds, "spawn_seconds": 0.0}
    if not math.isfinite(seconds) or seconds <= 0:
        record.update(status="environment_error", reason="deadline_exhausted", elapsed_seconds=0.0)
        return record
    env = env if env is not None else {"PATH": os.defpath, "HOME": str(cwd), "TMPDIR": str(cwd), "LANG": "C", "NO_COLOR": "1"}
    try:
        proc = subprocess.Popen(argv, cwd=cwd, env=env, stdin=subprocess.DEVNULL,
                                stdout=subprocess.PIPE, stderr=subprocess.STDOUT, start_new_session=True)
    except OSError as exc:
        record.update(status="environment_error", reason="spawn_error", exception_type=type(exc).__name__,
                      errno=exc.errno, error=redact(str(exc))[:MAX_LOG],
                      elapsed_seconds=round(time.monotonic() - start, 4))
        return record
    record["spawn_seconds"] = round(time.monotonic() - start, 4)
    captured = bytearray()
    try:
        with selectors.DefaultSelector() as selector:
            selector.register(proc.stdout, selectors.EVENT_READ)
            while selector.get_map():
                remaining = seconds - (time.monotonic() - start)
                if remaining <= 0:
                    record.update(status="environment_error", reason="timeout")
                    break
                for key, _ in selector.select(min(remaining, 0.1)):
                    chunk = os.read(key.fileobj.fileno(), 4096)
                    if not chunk:
                        selector.unregister(key.fileobj)
                    else:
                        captured.extend(chunk[:max_log - len(captured)])
                        if len(captured) >= max_log:
                            record.update(reason="output_limit", truncated=True)
                            break
                if record.get("truncated"):
                    break
            else:
                try:
                    record["exit_code"] = proc.wait(timeout=max(0.001, seconds - (time.monotonic() - start)))
                except subprocess.TimeoutExpired:
                    record.update(status="environment_error", reason="timeout")
    except OSError as exc:
        record.update(status="environment_error", reason="capture_error", exception_type=type(exc).__name__,
                      errno=exc.errno, error=redact(str(exc))[:MAX_LOG])
    finally:
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        proc.wait()
        record["exit_code"] = proc.returncode
        proc.stdout.close()
    record.update(output=captured.decode("utf-8", errors="replace"),
                  elapsed_seconds=round(time.monotonic() - start, 4))
    return record


def check_syntax(app, node=None):
    """Actual Node execution, on source-only copies; pass covers syntax ONLY."""
    result = {"source": SOURCE, "status": "unknown", "checks": [], "behavior": "unknown",
              "verified_requirements": []}
    try:
        blobs = baseline.read_template(app)
    except (OSError, ValueError):
        result["reason"] = "unreadable_or_unsafe_input"
        return result
    names = sorted(name for name in blobs if name.startswith("backend/") and
                   Path(name).suffix in (".js", ".cjs", ".mjs"))
    try:
        for name in names + ["backend/package.json"]:
            blobs[name].decode("utf-8")
    except UnicodeDecodeError:
        result["reason"] = "non_utf8_backend_source"
        return result
    node = node or shutil.which("node")
    if not node:
        result.update(status="environment_error", reason="node_unavailable")
        return result
    node = str(Path(node).resolve())
    result["node"] = node
    if not names:
        result["reason"] = "no_backend_javascript"
        return result
    with tempfile.TemporaryDirectory(prefix="minimal-check-") as temp:
        root = Path(temp).resolve()
        # Materialize source only: no .env, node_modules, caches or preserved links.
        for name, data in blobs.items():
            target = baseline.resolve_path(root, name)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
        if baseline.missing_required(root):
            result["reason"] = "incomplete_delivery_or_missing_input"
            return result
        deadline = time.monotonic() + CHECK_SECONDS
        for name in names:
            target = root / name
            row = _process([node, "--check", str(target)], root, deadline - time.monotonic())
            output = row["output"]
            if not row.get("reason"):
                if row["exit_code"] == 0:
                    row["status"] = "pass"
                elif row["exit_code"] == 1 and re.search(r"^SyntaxError:", output, re.M) and re.search(
                        r"^" + re.escape(str(target)) + r":\d+\s*$", output, re.M):
                    row["status"] = "product_fail"
                elif row["exit_code"] is not None and row["exit_code"] < 0:
                    row.update(status="environment_error", reason="process_signal")
            row.update(path=name, source=SOURCE)
            row["output"] = redact(output.replace(str(root), "<isolated>"))
            row["argv"] = [node, "--check", name]
            result["checks"].append(row)
            if row["status"] in ("environment_error", "unknown"):
                break
    statuses = {row["status"] for row in result["checks"]}
    result["status"] = next((s for s in ("environment_error", "unknown", "product_fail") if s in statuses), "pass")
    return result


def run(application, output, *, responses=(), max_rounds=0, node=None, runtime_image=None, model_config=None):
    """Export A0 or a syntax-verified copy to EMPTY output; never overwrite A0.

    Explicit offline responses and real model repair are mutually exclusive.
    Runtime feedback requires an immutable local Docker image. All requests share
    one CallBudget; repair transport failures/truncations are not retried.
    """
    if type(max_rounds) is not int or not 0 <= max_rounds <= 2:
        raise ValueError("max_rounds must be 0, 1 or 2")
    if type(responses) not in (list, tuple) or len(responses) > 2 or any(
            not isinstance(r, str) or len(r.encode()) > baseline.MAX_TEMPLATE_BYTES for r in responses):
        raise ValueError("supply at most two bounded offline response texts")
    if model_config is not None and (responses or not all(model_config.get(k) for k in ('model','base','key'))):
        raise ValueError("Real repair needs model/base/key and cannot mix offline responses")
    runtime = None
    if runtime_image is not None:
        from oneshot.minimal_runtime import DockerRuntime, editable_files
        runtime = DockerRuntime(runtime_image)
    check = runtime.check if runtime else lambda app: check_syntax(app, node)
    check_id = lambda row: row.get('id', row.get('path'))
    application, output = Path(application).absolute(), Path(output).absolute()
    if application.is_symlink() or output.is_symlink():
        raise ValueError("symlink roots are not allowed")
    application, output = application.resolve(), output.resolve()
    if application == output or application in output.parents or output in application.parents:
        raise ValueError("application and output must be separate, non-nested directories")
    if output.exists() and (not output.is_dir() or any(output.iterdir())):
        raise ValueError("output must be absent or empty")
    stamp, snapshot = baseline.template_stamp(application), baseline.read_template(application)
    a0 = identity(snapshot)
    ledger = baseline.CallBudget(limit=2)
    report = {"scope": "build_start_health_home" if runtime else "backend_javascript_syntax_only", "input_source": str(application),
              "baseline_source_sha256": a0, "retained_source_sha256": a0, "round_limit": max_rounds,
              "model_api_calls": 0, "replay_calls": 0, "cost": None, "cost_status": "not_called" if model_config else "offline_no_billing",
              "behavior": "unknown", "verified_requirements": [], "rounds": [], "stop_reason": "zero_rounds"}
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".minimal-feedback-", dir=output.parent) as temp:
        root = Path(temp)
        retained = root / "retained"
        shutil.copytree(application, retained, symlinks=True)
        if baseline.read_template(retained) != snapshot:
            raise ValueError("input changed during snapshot")
        working, working_snapshot = retained, snapshot
        current = check(retained) if max_rounds else None
        report["baseline_feedback"] = current
        protected = {check_id(r) for r in current["checks"] if r["status"] == "pass"} if current else set()
        editable = editable_files(snapshot) if runtime else {r["path"] for r in current["checks"]} if current else set()
        required = set(current.get('required_checks', editable)) if current else set()
        for index in range(max_rounds):
            if current["status"] != "product_fail":
                report["stop_reason"] = current["status"]
                break
            if model_config is None and index >= len(responses):
                report["stop_reason"] = "offline_response_unavailable"
                break
            # The only feedback authority is our fixed parser. No test directory,
            # hidden assertion, requirements file or self-check enters this packet.
            packet = {"instruction": "Repair only the reported JavaScript syntax errors. Preserve behavior. "
                      "Emit complete changed-file blocks; only listed JavaScript paths are editable.",
                      "source": SOURCE, "baseline_source_sha256": a0,
                      "retained_source_sha256": report["retained_source_sha256"],
                      "working_source_sha256": identity(working_snapshot),
                      "failures": [r for r in current["checks"] if r["status"] == "product_fail"],
                      "sources": {name: data.decode("utf-8") for name, data in working_snapshot.items()
                                  if name in editable or name == "backend/package.json"}}
            if runtime:
                packet.update(source=current['source'], instruction="Repair only the reported build/start/health errors in the current source. Preserve behavior. Emit complete changed-file blocks, only for the listed existing editable files. Do not change checks, add dependencies, or emit commentary.",
                              delivery_contract=baseline.CONTRACT, editable_files=sorted(editable))
            messages = [{"role": "user", "content": redact(json.dumps(packet, ensure_ascii=False))}]
            if model_config is None:
                response = responses[index]
                attempt = ledger.start(messages, "offline-response")
                attempt.update(content=redact(response), status="replayed", usage={}, finish_reason="stop")
            else:
                try:
                    response, _, finish = baseline.stream_completion(messages, model_config['model'],
                        model_config['base'], model_config['key'], ledger, tries=1)
                    if finish == 'length':
                        raise ValueError('truncated_model_repair_no_continuation')
                except (RuntimeError, ValueError) as exc:
                    report.update(stop_reason='model_error', model_error=redact(str(exc)))
                    break
                attempt = ledger.attempts[-1]
            row = {"round": index + 1, "baseline_source_sha256": a0, "feedback_source": current["source"],
                   "retained_source_sha256": report["retained_source_sha256"],
                   "working_source_sha256": packet["working_source_sha256"],
                   "modified": [], "accepted": False, "attempt": attempt}
            report["rounds"].append(row)
            candidate = root / ("candidate-" + str(index + 1))
            shutil.copytree(working, candidate, symlinks=True)
            started = time.monotonic()
            try:
                batch, missing = baseline.parse_blocks(response)
                if missing:
                    raise ValueError("incomplete_response_no_continuation")
                seen = set()
                for item in batch:
                    target = baseline.resolve_path(candidate, item["path"])
                    name = target.relative_to(candidate.resolve()).as_posix()
                    if name not in editable or name in seen:
                        raise ValueError("repair_outside_source_boundary_or_duplicate")
                    seen.add(name)
                    baseline.write_one(candidate, item)
                blobs = baseline.read_template(candidate)
                row["candidate_source_sha256"] = identity(blobs)
                row["modified"] = sorted(n for n in blobs if blobs[n] != snapshot.get(n))
                if not row["modified"] or blobs == working_snapshot:
                    raise ValueError("no_change")
                feedback = row["feedback"] = check(candidate)
                if baseline.read_template(candidate) != blobs:
                    report["stop_reason"] = "candidate_changed_during_check"
                    break
                if feedback["status"] in ("environment_error", "unknown"):
                    report["stop_reason"] = feedback["status"]
                    break
                passes = {check_id(r) for r in feedback["checks"] if r["status"] == "pass"}
                if not protected <= passes:
                    report["stop_reason"] = "regression_or_missing_protected_evidence"
                    break
                if feedback["status"] == "pass" and required <= passes:
                    retained = candidate
                    row["accepted"] = True
                    report["retained_source_sha256"] = row["candidate_source_sha256"]
                    report["stop_reason"] = "runtime_pass_behavior_unknown" if runtime else "syntax_pass_behavior_unknown"
                    break
                if feedback["status"] != "product_fail":
                    report["stop_reason"] = feedback["status"]
                    break
                # A non-regressing syntax failure supplies new evidence/source for
                # the next round, but only an all-pass candidate replaces retained A0.
                working, working_snapshot, current = candidate, blobs, feedback
                protected |= passes
                report["stop_reason"] = "round_limit"
            except (OSError, ValueError) as exc:
                row["error"] = redact(str(exc))[:MAX_LOG]
                report["stop_reason"] = "invalid_repair"
                break
            finally:
                elapsed = round(time.monotonic() - started, 4)
                if model_config:
                    row["candidate_validation_seconds"] = elapsed
                else:
                    attempt["elapsed_seconds"] = elapsed
        report["replay_calls"] = 0 if model_config else len(ledger.attempts)
        report["model_api_calls"] = len(ledger.attempts) if model_config else 0
        if model_config and ledger.attempts:
            report['cost_status'] = 'gateway_cost_not_estimated'
            report['model_attempts'] = ledger.attempts
        report["usage"] = ledger.summary()
        if identity(baseline.read_template(retained)) != report["retained_source_sha256"]:
            raise ValueError("retained source changed before publication")
        # Reuse publication's immutable input check; input itself is never renamed.
        baseline.publish(retained, output, application, snapshot, stamp)
    if model_config:
        # Explicit credentials need not be exported to the host environment.
        return json.loads(redact(json.dumps(report)).replace(model_config['key'], '[REDACTED]'))
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("application", type=Path)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--max-rounds", type=int, choices=(0, 1, 2), default=0)
    parser.add_argument("--offline-response", type=Path, action="append", default=[])
    parser.add_argument("--runtime-image", help="Enable runtime checks using an immutable local Docker image")
    parser.add_argument("--real-repair", action="store_true", help="Use configured gateway instead of injected responses")
    args = parser.parse_args()
    if len(args.offline_response) > 2 or any(p.stat().st_size > baseline.MAX_TEMPLATE_BYTES for p in args.offline_response):
        parser.error("at most two bounded offline responses are allowed")
    config = {"model":os.environ.get("MODEL"),"base":os.environ.get("OPENAI_BASE_URL"),"key":os.environ.get("OPENAI_API_KEY")} if args.real_repair else None
    report = run(args.application, args.output_dir, max_rounds=args.max_rounds,
                 runtime_image=args.runtime_image, model_config=config,
                 responses=[p.read_text(encoding="utf-8") for p in args.offline_response])
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
