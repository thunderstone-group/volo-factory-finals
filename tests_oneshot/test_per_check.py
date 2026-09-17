"""Synthetic per-check policy tests; no gateway or browser invoked."""
from test_business_feedback import BusinessFeedbackTests, REQ
from oneshot import skill_repair as sr
from pathlib import Path


class PerCheckTests(BusinessFeedbackTests):
    def test_partial_improvement_is_retained_at_budget(self):
        result = self.run_loop(max_model_calls=2, feedback_policy='per_check')
        self.assertTrue(result['accepted'])
        self.assertEqual(result['acceptance_scope'], 'partial_observed_improvement')
        text = (Path(result['export'])/self.path).read_text()
        self.assertIn('save:good', text)
        self.assertIn('favorite:bad', text)
        self.assertEqual(result['verified_requirements'], [])

    def test_independent_unknown_does_not_hide_known_failure(self):
        def observe(app, output):
            result = self.observe(app, output)
            result['checks'][1]['status'] = 'unknown'
            result['status'] = 'unknown'
            return result
        result = self.run_loop(observer=observe, feedback_policy='per_check')
        self.assertTrue(self.calls)
        self.assertTrue(result['accepted'])
        self.assertIn('favorite:good', (Path(result['export'])/self.path).read_text())
        self.assertEqual(result['verified_requirements'], [])

    def test_known_failure_cannot_disappear_into_unknown(self):
        def observe(app, output):
            result = self.observe(app, output)
            if app != self.app:
                result['checks'][2]['status'] = 'unknown'
                result['status'] = 'unknown'
            return result
        result = self.run_loop(observer=observe, feedback_policy='per_check')
        self.assertFalse(result['accepted'])
        self.assertEqual(result['stop_reason'], 'known_check_became_unknown')

    def test_later_model_error_preserves_observed_partial(self):
        def propose(*args, **kwargs):
            if self.calls:
                raise sr.RepairError('synthetic error', {'calls': [{}]})
            return self.proposal(*args, **kwargs)
        result = self.run_loop(proposer=propose, feedback_policy='per_check')
        self.assertTrue(result['accepted'])
        self.assertEqual(result['stop_reason'], 'model_error')
        self.assertIn('save:good', (Path(result['export'])/self.path).read_text())

    def test_environment_failure_still_stops(self):
        def observe(app, output):
            result = self.observe(app, output)
            result['checks'][1]['status'] = 'environment_error'
            result['status'] = 'environment_error'
            return result
        result = self.run_loop(observer=observe, feedback_policy='per_check')
        self.assertFalse(self.calls)
        self.assertEqual(result['stop_reason'], 'environment_error')
