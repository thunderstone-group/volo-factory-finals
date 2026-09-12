"""Exercise the installed real Pi CLI against a loopback scripted SSE gateway.

Only fixed hand-authored tool arguments are emitted. This is NOT a real-model
benchmark. No account credentials, real endpoints, or user configuration are read.
"""
from __future__ import annotations

import argparse
import json
import os
import signal
import subprocess
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from .pi_adapter import prepare_pi, summarize_events

ROOT = Path(__file__).resolve().parents[1]


class ScriptedGateway:
    def __init__(self, tool_arguments: str):
        self.requests = []
        self.tool_arguments = tool_arguments
        owner = self

        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):
                size = int(self.headers.get('Content-Length', '0'))
                if self.path != '/v1/chat/completions' or not 0 < size < 1000000:
                    self.send_error(400); return
                request = json.loads(self.rfile.read(size))
                owner.requests.append(request)
                index = len(owner.requests)
                if index > 3:
                    self.send_error(400, 'Scripted fixture exhausted'); return
                self.send_response(200)
                self.send_header('Content-Type', 'text/event-stream')
                self.send_header('Connection', 'close')
                self.end_headers()
                if index == 1:
                    delta = {'role': 'assistant', 'content': None, 'tool_calls': [
                        {'index': 0, 'id': 'fixture-write', 'type': 'function',
                         'function': {'name': 'write', 'arguments': owner.tool_arguments}}]}
                    reason = 'tool_calls'
                else:
                    delta, reason = {'role': 'assistant', 'content': 'Fixture complete.'}, 'stop'
                chunks = [
                    {'choices': [{'index': 0, 'delta': delta, 'finish_reason': None}]},
                    {'choices': [{'index': 0, 'delta': {}, 'finish_reason': reason}]},
                    {'choices': [], 'usage': {'prompt_tokens': 100, 'completion_tokens': 20, 'total_tokens': 120}},
                ]
                try:
                    for chunk in chunks:
                        value = {'id': 'synthetic-' + str(index), 'object': 'chat.completion.chunk',
                                 'created': 1, 'model': 'harness-fixture', **chunk}
                        self.wfile.write(('data: ' + json.dumps(value) + '\n\n').encode())
                    self.wfile.write(b'data: [DONE]\n\n'); self.wfile.flush()
                except (BrokenPipeError, ConnectionResetError):
                    pass

            def log_message(self, *args):
                pass

        self.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)

    def __enter__(self):
        self.thread.start()
        return self

    def __exit__(self, *args):
        self.server.shutdown(); self.server.server_close(); self.thread.join(timeout=2)

    @property
    def url(self):
        return f'http://127.0.0.1:{self.server.server_port}/v1'


def probe(*, executable='pi', expected_version='0.83.0', invalid_arguments=False, image=None):
    expected = (ROOT / 'examples/external-verifier/candidate/server.cjs').read_text()
    arguments = '{"path":' if invalid_arguments else json.dumps({'path': 'server.cjs', 'content': expected})
    with tempfile.TemporaryDirectory(prefix='volo-pi-probe-') as directory:
        root = Path(directory)
        work = root / 'workspace'; work.mkdir()
        # A project-local context file must not be loaded implicitly.
        sentinel = 'UNREQUESTED_CONTEXT_SENTINEL_947bd0'
        (work / 'AGENTS.md').write_text(sentinel)
        with ScriptedGateway(arguments) as gateway:
            invocation = prepare_pi(work, root / 'home', gateway=gateway.url, model='harness-fixture',
                                    api_key='synthetic-no-value-key', executable=executable,
                                    expected_version=expected_version)
            process = subprocess.Popen(invocation.argv, cwd=work, env=invocation.env,
                                       stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                       text=True, start_new_session=True)
            try:
                stdout, stderr = process.communicate('Apply the supplied fixture tool call, then stop.\n', timeout=30)
            finally:
                # Kill the process group, including any fixture child left behind.
                try:
                    os.killpg(process.pid, signal.SIGTERM)
                except ProcessLookupError:
                    pass
                try:
                    process.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL); process.wait(timeout=2)
            events = [json.loads(line) for line in stdout.splitlines() if line.strip()]
            requests = gateway.requests
        artifact = work / 'server.cjs'
        report = {'kind': 'real_pi_with_synthetic_loopback_gateway', 'pi_version': invocation.version,
                  'real_model_calls': 0, 'synthetic_gateway_requests': len(requests),
                  'worker_exit_code': process.returncode, 'invalid_arguments_probe': invalid_arguments,
                  'artifact_matches_fixture': artifact.exists() and artifact.read_text() == expected,
                  'artifact_created': artifact.exists(),
                  'implicit_context_leaked': sentinel in json.dumps(requests),
                  'provider_and_model_match': bool(requests) and all(r.get('model') == 'harness-fixture' for r in requests),
                  'tool_result_roundtrip': any(m.get('role') == 'tool' for r in requests[1:] for m in r.get('messages', [])),
                  **summarize_events(events)}
        if stderr.strip():
            report['stderr'] = stderr[-2000:]
        if image and not invalid_arguments and report['artifact_matches_fixture']:
            from .evaluate import evaluate
            report['external_verification'] = evaluate(work, ROOT / 'examples/external-verifier/suite', image)
        return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pi', default='pi')
    parser.add_argument('--expected-version', default='0.83.0')
    parser.add_argument('--invalid-arguments', action='store_true')
    parser.add_argument('--image', help='Optional existing image for candidate -> external verifier calibration')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    report = probe(executable=args.pi, expected_version=args.expected_version,
                   invalid_arguments=args.invalid_arguments, image=args.image)
    valid = (report['worker_exit_code'] == 0 and report['synthetic_gateway_requests'] == 2 and report['agent_ended'] and
             report['provider_and_model_match'] and report['tool_result_roundtrip'] and
             not report['implicit_context_leaked'] and report['reported_total_tokens'] == 240 and
             (not report['artifact_created'] if args.invalid_arguments else report['artifact_matches_fixture']))
    if args.invalid_arguments:
        valid = valid and any(event['error'] for event in report['tool_events'])
    if 'external_verification' in report:
        valid = valid and report['external_verification']['status'] == 'passed'
    report['probe_passed'] = valid
    text = json.dumps(report, ensure_ascii=False, indent=2) + '\n'
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        with args.output.open('x') as stream:
            os.chmod(args.output, 0o600); stream.write(text)
    print(text, end='')
    return 0 if valid else 1


if __name__ == '__main__':
    raise SystemExit(main())
