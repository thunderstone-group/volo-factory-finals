"""Synthetic transport evidence; these tests make no real model calls."""
import contextlib
from email.message import Message
import io
import json
from pathlib import Path
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer
from unittest.mock import patch
from urllib.error import HTTPError, URLError

from oneshot.v2 import main as entry
from test_oneshot import SyntheticStream, event, events
from scripts.run_minimal_batch import read_trace


KEY = 'synthetic-private-key'


class DiagnosticsTests(unittest.TestCase):
    def test_killed_process_still_exposes_request_id_without_inventing_usage(self):
        request = {'call': 1, 'model': 'synthetic-model', 'messages_sha256': 'provided-hash'}
        observed = {'call': 1, 'stage': 'opened', 'request_ids': {'x-request-id': 'pending-request'}}
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'trace.log'
            path.write_text('[minimal] request ' + json.dumps(request) + '\n' +
                            '[minimal] transport ' + json.dumps(observed) + '\n')
            traces, usage, _ = read_trace(path)
        self.assertEqual(len(traces), 1)
        self.assertEqual(traces[0]['status'], 'interrupted')
        self.assertFalse(traces[0]['prompt_hash_verified'])
        self.assertEqual(traces[0]['transport']['request_ids']['x-request-id'], 'pending-request')
        self.assertEqual(usage['unknown_usage_calls'], [1])
        self.assertIsNone(usage['completion_tokens'])

    def invoke(self, responses, limit=1):
        budget = entry.core.CallBudget(limit=limit)
        log = io.StringIO()
        replies = iter(responses)
        def opener(req, timeout):
            item = next(replies)
            if isinstance(item, Exception):
                raise item
            return item
        with contextlib.redirect_stderr(log), patch.object(entry.core.time, 'sleep'), \
             patch.object(entry.core, '_open_model', entry.diagnostic_transport(opener, budget, KEY)):
            try:
                value = entry.core.stream_completion([{'role': 'user', 'content': 'synthetic task'}],
                    'synthetic-model', 'https://synthetic.invalid/v1', KEY, budget)
            except Exception as exc:
                value = exc
        return value, budget, log.getvalue()

    def test_success_is_unchanged_and_trace_is_bounded(self):
        frames = [event({'choices': [{'delta': {'content': 'x'}}]}) for _ in range(20)]
        frames += events('end', {'prompt_tokens': 2, 'completion_tokens': 3})
        value, budget, log = self.invoke([SyntheticStream(frames)])
        self.assertEqual(value, ('x' * 20 + 'end', {'prompt_tokens': 2, 'completion_tokens': 3}, 'stop'))
        d = budget.attempts[0]['transport']
        self.assertTrue(d['done'])
        self.assertNotIn('failure_kind', d)
        self.assertEqual(d['content_chars'], 23)
        self.assertEqual(len(d['tail']), 6)
        self.assertEqual(log.count('[minimal] transport'), 4)

    def test_upstream_error_is_not_lost_as_generic_malformed_sse(self):
        frames = [event({'error': {'code': 'rate_limit', 'message': 'Bearer other-secret ' + KEY,
                                   'api_key': 'another-private-value'}})]
        value, budget, log = self.invoke([SyntheticStream(frames)])
        self.assertIsInstance(value, RuntimeError)
        d = budget.attempts[0]['transport']
        self.assertEqual(d['failure_kind'], 'upstream_error_event')
        self.assertIn('rate_limit', d['upstream_error'])
        for secret in (KEY, 'other-secret', 'another-private-value'):
            self.assertNotIn(secret, json.dumps(d) + log)
        self.assertIsNone(budget.summary()['completion_tokens'])

    def test_missing_done_and_malformed_events_have_distinct_attempts(self):
        value, budget, _ = self.invoke([
            SyntheticStream(events('partial', done=False)),
            SyntheticStream([b'data: {not JSON ' + KEY.encode() + b'\n'])], limit=2)
        self.assertIsInstance(value, RuntimeError)
        self.assertEqual([r['transport']['failure_kind'] for r in budget.attempts],
                         ['missing_done_marker', 'malformed_event'])
        self.assertNotIn(KEY, budget.attempts[1]['transport']['event_preview'])
        self.assertEqual(budget.summary()['calls'], 2)

    def test_http_error_retains_only_safe_headers_and_bounded_body(self):
        headers = Message()
        headers['x-request-id'] = 'synthetic-request-401'
        headers['Set-Cookie'] = 'not-for-logs'
        body = io.BytesIO(json.dumps({'error': {'code': 'invalid_key', 'api_key': KEY,
                                              'message': 'x' * 6000}}).encode())
        error = HTTPError('https://synthetic.invalid', 401, 'unauthorized', headers, body)
        value, budget, log = self.invoke([error])
        self.assertIsInstance(value, RuntimeError)
        self.assertTrue(body.closed)
        d = budget.attempts[0]['transport']
        self.assertEqual(d['http_status'], 401)
        self.assertEqual(d['request_ids'], {'x-request-id': 'synthetic-request-401'})
        self.assertTrue(d['http_body_truncated'])
        self.assertLessEqual(len(d['http_body_preview']), 1024)
        self.assertNotIn(KEY, json.dumps(d) + log)
        self.assertNotIn('not-for-logs', log)
        self.assertEqual(budget.summary()['calls'], 1)

    def test_network_disconnect_preserves_usage_and_sanitizes_error(self):
        frames = events('partial', {'prompt_tokens': 7}, done=False)
        frames += [URLError('connection lost ' + KEY)]
        value, budget, log = self.invoke([SyntheticStream(frames)])
        self.assertIsInstance(value, RuntimeError)
        self.assertEqual(budget.attempts[0]['transport']['failure_kind'], 'transport_error')
        self.assertEqual(budget.summary()['known_prompt_tokens'], 7)
        self.assertEqual(budget.summary()['unknown_usage_calls'], [1])
        self.assertNotIn(KEY, log)

    def test_reasoning_only_does_not_become_success_or_leak_reasoning(self):
        frames = [event({'choices': [{'delta': {'reasoning_content': 'private reasoning'},
                                     'finish_reason': 'stop'}]}), b'data: [DONE]\n\n']
        value, budget, log = self.invoke([SyntheticStream(frames)])
        self.assertIsInstance(value, ValueError)
        d = budget.attempts[0]['transport']
        self.assertEqual(d['failure_kind'], 'empty_content')
        self.assertEqual(d['reasoning_chars'], len('private reasoning'))
        self.assertNotIn('private reasoning', log)

    def test_missing_finish_and_unsupported_finish_remain_failures(self):
        for finish, expected in ((None, 'missing_finish_reason'), ('tool_calls', 'unsupported_finish_reason')):
            with self.subTest(finish=finish):
                value, budget, _ = self.invoke([SyntheticStream(events('text', finish=finish))])
                self.assertIsInstance(value, Exception)
                self.assertEqual(budget.attempts[0]['transport']['failure_kind'], expected)
                self.assertEqual(budget.attempts[0]['status'], 'failed')

    def test_real_urllib_loopback_preserves_request_and_captures_response_id(self):
        captured = []
        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass
            def do_POST(self):
                captured.append((self.path, json.loads(self.rfile.read(int(self.headers['Content-Length'])))))
                self.send_response(200)
                self.send_header('Content-Type', 'text/event-stream')
                self.send_header('X-Request-ID', 'loopback-request')
                self.end_headers()
                self.wfile.write(b''.join(events('synthetic output', {'prompt_tokens': 4, 'completion_tokens': 5})))
        server = HTTPServer(('127.0.0.1', 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        budget = entry.core.CallBudget(limit=1)
        original = entry.core._open_model
        messages = [{'role': 'user', 'content': 'loopback fixture'}]
        try:
            with contextlib.redirect_stderr(io.StringIO()), patch.object(entry.core, '_open_model',
                    entry.diagnostic_transport(original, budget, KEY)):
                output, _, _ = entry.core.stream_completion(messages, 'fixture-model',
                    f'http://127.0.0.1:{server.server_port}/v1', KEY, budget)
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)
        self.assertEqual(output, 'synthetic output')
        self.assertEqual(captured, [('/v1/chat/completions', {'model': 'fixture-model', 'messages': messages,
            'max_tokens': entry.core.MAX_TOKENS, 'temperature': 0.3, 'stream': True,
            'stream_options': {'include_usage': True}})])
        self.assertEqual(budget.attempts[0]['transport']['request_ids'], {'x-request-id': 'loopback-request'})
        self.assertEqual(budget.summary()['calls'], 1)


if __name__ == '__main__':
    unittest.main()
