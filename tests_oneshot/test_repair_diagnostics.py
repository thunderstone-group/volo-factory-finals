"""Synthetic failures: public status must not expose source or model content."""
import copy
import io
import json
import time
import unittest
from urllib import error
import test_skill_repair as fixtures
import test_business_feedback as business
from oneshot import skill_repair as sr


class DiagnosticTests(unittest.TestCase):
    def setUp(self):
        self.case = fixtures.RepairTests()
        self.case.setUp()
        self.addCleanup(self.case.doCleanups)

    def failed(self, responses, **kwargs):
        gateway = fixtures.SyntheticGateway(responses)
        with self.assertRaises(sr.RepairError) as caught:
            self.case.run_proposal(gateway, **kwargs)
        diagnostic = sr.safe_diagnostics(caught.exception.trace)
        self.assertEqual(len(gateway.requests), diagnostic['call_count'])
        return diagnostic

    def test_final_json_and_patch_failures_have_separate_codes(self):
        d = self.failed([fixtures.completion('SECRET SOURCE invalid json')])
        self.assertEqual(d['failure'], {'stage': 'proposal', 'code': 'invalid_json'})
        for field, value, code in [('old', 'absent', 'patch_context_not_unique'),
                                   ('before_sha256', '0' * 64, 'patch_source_hash_mismatch')]:
            p = copy.deepcopy(self.case.proposal); p['edits'][0][field] = value
            d = self.failed([fixtures.completion(json.dumps(p))])
            self.assertEqual(d['failure'], {'stage': 'proposal', 'code': code})

    def test_http_truncation_and_protocol_errors_are_not_business_failures(self):
        d = self.failed([error.HTTPError('https://synthetic.invalid', 429, 'SECRET', {}, io.BytesIO(b'{}'))])
        self.assertEqual(d['failure']['code'], 'http_error')
        self.assertEqual(d['calls'][0]['http_status'], 429)
        d = self.failed([fixtures.completion('SECRET', finish='length')])
        self.assertEqual(d['failure'], {'stage': 'response', 'code': 'response_truncated'})
        d = self.failed([fixtures.completion(calls=[fixtures.read_call('absent')])])
        self.assertEqual(d['failure'], {'stage': 'tools', 'code': 'unknown_skill'})

    def test_budget_exhaustion_is_explicit_without_retry(self):
        d = self.failed([fixtures.completion(calls=[fixtures.read_call(sr.SKILL_IDS[0])])],
                        limits=sr.Limits(max_calls=1))
        self.assertEqual(d['failure'], {'stage': 'budget', 'code': 'model_call_limit'})

    def test_timeout_is_categorized_and_accounted(self):
        def slow(req, timeout):
            time.sleep(.2)
        with self.assertRaises(sr.RepairError) as caught:
            self.case.run_proposal(slow, limits=sr.Limits(request_timeout=.02))
        d = sr.safe_diagnostics(caught.exception.trace)
        self.assertEqual(d['failure'], {'stage': 'request', 'code': 'time_budget_exhausted'})
        self.assertEqual(d['call_count'], 1)

    def test_projection_uses_allowlisted_enums_and_numbers_only(self):
        secret = 'never-export-this-source-or-credential'
        d = sr.safe_diagnostics({'status': secret, 'error': secret,
            'failure': {'stage': secret, 'code': secret},
            'calls': [{'call': secret, 'http_status': secret, 'finish_reason': secret,
                       'status': secret, 'stage': secret, 'elapsed_seconds': float('nan'),
                       'assistant': {'content': secret, 'reasoning_content': secret},
                       'request': secret, 'usage': {'prompt_tokens': secret}}]})
        self.assertNotIn(secret, json.dumps(d))
        self.assertNotIn('reasoning', json.dumps(d))
        self.assertIsNone(d['calls'][0]['elapsed_seconds'])
        self.assertEqual(d['failure']['code'], 'internal_error')

    def test_success_does_not_change_model_payload(self):
        gateway = fixtures.SyntheticGateway([fixtures.completion(json.dumps(self.case.proposal))])
        r = self.case.run_proposal(gateway)
        payload = gateway.requests[0][2]
        self.assertEqual(set(payload), {'model','messages','tools','stream','max_tokens'})
        self.assertEqual(payload['max_tokens'], 8192)
        self.assertIsNone(sr.safe_diagnostics(r['trace'])['failure'])

    def test_outer_deadline_still_bounds_long_request_timeout(self):
        def slow(req, timeout):
            self.assertEqual(timeout, 300)
            time.sleep(.2)
        started = time.monotonic()
        with self.assertRaises(sr.RepairError) as caught:
            self.case.run_proposal(slow, limits=sr.Limits(wall_seconds=.02, request_timeout=300))
        self.assertLess(time.monotonic()-started, .18)
        self.assertEqual(sr.safe_diagnostics(caught.exception.trace)['failure']['code'], 'time_budget_exhausted')

    def test_timeout_changes_only_local_wait_not_model_request(self):
        first = fixtures.SyntheticGateway([fixtures.completion(json.dumps(self.case.proposal))])
        second = fixtures.SyntheticGateway([fixtures.completion(json.dumps(self.case.proposal))])
        self.case.run_proposal(first)
        self.case.run_proposal(second, limits=sr.Limits(request_timeout=300))
        self.assertEqual(first.requests[0][0].data, second.requests[0][0].data)
        self.assertEqual(first.requests[0][1], 120)
        self.assertEqual(second.requests[0][1], 300)

    def test_output_budget_is_explicit_bounded_and_truncation_still_refused(self):
        limits = sr.Limits(max_output_tokens=16384)
        gateway = fixtures.SyntheticGateway([fixtures.completion(json.dumps(self.case.proposal))])
        r = self.case.run_proposal(gateway, limits=limits)
        self.assertEqual(gateway.requests[0][2]['max_tokens'], 16384)
        self.assertEqual(sr.safe_diagnostics(r['trace'])['calls'][0]['max_output_tokens'], 16384)
        d = self.failed([fixtures.completion('incomplete', finish='length')], limits=limits)
        self.assertEqual(d['failure']['code'], 'response_truncated')
        self.assertEqual(d['call_count'], 1)
        for value in (0, 32769, True):
            with self.assertRaises(sr.RepairError):
                sr.Limits(max_output_tokens=value)

    def test_business_profile_preserves_total_deadline_and_shared_callcap(self):
        case = business.BusinessFeedbackTests(); case.setUp(); self.addCleanup(case.doCleanups)
        seen = []
        def propose(source, observations, **kwargs):
            limit = kwargs['limits']
            seen.append((limit.wall_seconds, limit.request_timeout, limit.max_output_tokens, limit.max_calls))
            return case.proposal(source, observations, **kwargs)
        r = case.run_loop(proposer=propose, max_model_calls=4)
        self.assertTrue(r['accepted'])
        self.assertEqual(r['model_calls'], 4)
        self.assertEqual(seen, [(300,300,16384,4), (300,300,16384,2)])

    def test_business_loop_writes_separate_safe_failure_receipt(self):
        case = business.BusinessFeedbackTests(); case.setUp(); self.addCleanup(case.doCleanups)
        secret = 'do-not-copy-application-source'
        def failed(*args, **kwargs):
            raise sr.RepairError(secret, {'status':'failed', 'error':secret,
                'failure':{'stage':'proposal','code':'patch_context_not_unique'},
                'calls':[{'call':1,'status':'failed','request':secret}]})
        result = case.run_loop(proposer=failed)
        text = (case.root/'evidence/diagnostic-status.json').read_text()
        self.assertNotIn(secret, text)
        self.assertEqual(json.loads(text), result['diagnostics'])
        self.assertFalse(result['accepted'])
        self.assertEqual(result['retained_source_sha256'], case.initial)
        self.assertEqual(result['diagnostics']['rounds'][0]['model']['failure']['code'], 'patch_context_not_unique')


if __name__ == '__main__':
    unittest.main()
