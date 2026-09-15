"""The salvage criterion, replayed against Keep run 7's batch 11.

Batch 11 fixed REQ-2.7.6.2 and wrote `view-all-notes.js`. It ran out of calls, the
salvage bundle failed REQ-2.5.1 twice and REQ-2.3.3 once, none of them its own and none
of them new, and the harness threw the whole batch away. The suite is not idempotent:
2.5.1 failed at this batch's first two verifications, passed at the next four, and
failed again in the salvage run.

The four logs are verbatim `.factory/command-NNNN.log` from
`runs/2026-09-15-keep-full-7`: 0131 and 0153 are batch 11's own verifications, 0155 is
its salvage run, 0128 is batch 10's regression, used here as a new failure that is not
in any baseline.
"""
import json
import time
import unittest
from pathlib import Path

from volo import contract as state_contract
from volo.agent import Agent
from volo.trace import Runtime
from test_core import TempCase
from test_state_contract import FakeModel, SYNTHETIC_RESPONSE, synthetic_requirements

ROOT = Path(__file__).resolve().parents[1]


def fixture(name):
    return (ROOT / 'tests/fixtures' / name).read_text()


class SalvageDifferenceTests(TempCase):
    """Only a check this batch broke is a reason to throw the batch's code away."""

    def agent(self):
        requirements = synthetic_requirements(self)
        contract = state_contract.reconcile(
            state_contract.normalize(json.loads(SYNTHETIC_RESPONSE)),
            state_contract.evidence(requirements))
        agent = Agent(requirements, FakeModel('{}'), self.workspace, Runtime(self.trace),
                      contract=contract)
        agent.install_contract()
        # A tree that verified before the batch, so there is a snapshot to roll back to,
        # and one product file the batch wrote that is not in it.
        self.workspace.write_files([
            {'path': 'frontend/public/features/notes.js', 'content': '// verified\n'},
            {'path': 'checks/batch-1.spec.cjs', 'content': '// batch 1 check\n'}])
        agent.check_command = ['node', '--test', 'checks/batch-1.spec.cjs']
        self.workspace.last_verification = {
            'passed': True, 'source_fingerprint': self.workspace.fingerprint(),
            'check_command': agent.check_command, 'verification_scope': 'local_checks_only',
            'acceptance': {}}
        agent.snapshot_product()
        self.workspace.write_files([
            {'path': 'frontend/public/features/view-all-notes.js', 'content': '// batch 11\n'},
            {'path': 'checks/batch-11.spec.cjs', 'content': '// an unverified check\n'}])
        return agent

    def replay(self, agent, before_log, batch_logs, salvage_log):
        """Replay the verification before the entry, the entry's own, then the salvage."""
        from volo import tap
        history = self.workspace.verification_failures
        if before_log:
            history.append(sorted(tap.failure_names(fixture(before_log))))
        state = {'id': 'batch-11', 'index': 11, 'nodes': [], 'requirements': ['2.7.6.2'],
                 'status': 'incomplete', 'entries': 1, 'calls': 20, 'brief': None,
                 'outcome': None, 'quarantined': {}, 'verifications_before': len(history)}
        for log in batch_logs:
            history.append(sorted(tap.failure_names(fixture(log))))

        def verify(check_command):
            output = fixture(salvage_log)
            self.workspace.verification_failures.append(sorted(tap.failure_names(output)))
            self.bundles.append(list(check_command))
            return {'passed': False, 'steps': [{'exit_code': 1, 'output': output}],
                    'check_command': list(check_command),
                    'source_fingerprint': self.workspace.fingerprint(),
                    'verification_scope': 'local_checks_only', 'acceptance': {},
                    'error': 'Checks failed'}

        self.bundles = []
        self.workspace.verify = verify
        return state, agent.salvage_or_restore(state)

    def events(self, name):
        lines = (self.trace.directory / 'events.jsonl').read_text().splitlines()
        return [event for event in (json.loads(line) for line in lines) if event['event'] == name]

    def test_failures_that_predate_the_batch_do_not_discard_its_code(self):
        agent = self.agent()
        state, outcome = self.replay(agent, 'real-keep-run7-tap-0128.log',
                                     ['real-keep-run7-tap-0131.log',
                                      'real-keep-run7-tap-0153.log'],
                                     'real-keep-run7-tap-0155.log')
        self.assertEqual(outcome, 'salvaged')
        self.assertEqual(state['outcome'], 'kept_no_regression')
        salvage = self.events('batch_salvage')[-1]
        self.assertEqual(salvage['outcome'], 'kept_no_regression')
        self.assertEqual(salvage['kept'], ['frontend/public/features/view-all-notes.js'])
        self.assertEqual(salvage['pre_existing'], [
            'REQ-2.3.3 Trash list shows deleted notes and empties trash',
            'REQ-2.5.1 archive a note shows notification with Undo and moves it to the archive list',
            'REQ-2.5.1 archive a note via the archive button with Undo'])
        # The product file survives; the batch's own unverified check does not.
        self.assertTrue(self.workspace.path('frontend/public/features/view-all-notes.js').exists())
        self.assertFalse(self.workspace.path('checks/batch-11.spec.cjs').exists())
        # And the kept tree is the snapshot now, so delivery restores it and not the
        # tree from before the batch.
        snapshot = json.loads(agent.snapshot_path().read_text())
        self.assertIn('frontend/public/features/view-all-notes.js', snapshot['files'])
        self.assertEqual(snapshot['source_fingerprint'], self.workspace.fingerprint())
        self.assertFalse(snapshot['verified'])
        # Nothing here claims the batch verified.
        self.assertNotIn('2.7.6.2', agent.completed)

    def test_the_difference_is_computed_over_the_whole_window(self):
        """The salvage run's own predecessor is not enough: 2.5.1 last failed earlier."""
        from volo import tap
        names = {log: tap.failure_names(fixture('real-keep-run7-tap-%s.log' % log))
                 for log in ('0128', '0131', '0153', '0155')}
        self.assertEqual(sorted(names['0155'] - names['0153']), [
            'REQ-2.5.1 archive a note shows notification with Undo and moves it to the archive list',
            'REQ-2.5.1 archive a note via the archive button with Undo'])
        window = names['0128'] | names['0131'] | names['0153']
        self.assertEqual(names['0155'] - window, set())

    def test_a_new_failure_still_rolls_the_batch_back(self):
        agent = self.agent()
        state, outcome = self.replay(agent, None, ['real-keep-run7-tap-0153.log'],
                                     'real-keep-run7-tap-0128.log')
        self.assertEqual(outcome, 'restored')
        salvage = self.events('batch_salvage')[-1]
        self.assertEqual(salvage['reason'], 'bundle_failed')
        self.assertIn('REQ-2.4 update an existing note content', salvage['regressions'])
        self.assertFalse(self.workspace.path('frontend/public/features/view-all-notes.js').exists())

    def test_a_bundle_that_never_reached_its_checks_rolls_back(self):
        """No `not ok` at all means a build error or a dead server, not a clean run."""
        agent = self.agent()
        state = {'id': 'batch-11', 'index': 11, 'nodes': [], 'requirements': ['2.7.6.2'],
                 'status': 'incomplete', 'entries': 1, 'calls': 20, 'brief': None,
                 'outcome': None, 'quarantined': {}, 'verifications_before': 0}

        def verify(check_command):
            self.workspace.verification_failures.append([])
            return {'passed': False, 'steps': [{'exit_code': 1, 'output': 'Frontend build failed'}],
                    'check_command': list(check_command), 'error': 'Frontend build failed',
                    'source_fingerprint': self.workspace.fingerprint(),
                    'verification_scope': 'local_checks_only', 'acceptance': {}}

        self.workspace.verify = verify
        self.assertEqual(agent.salvage_or_restore(state), 'restored')
        self.assertEqual(self.events('batch_salvage')[-1]['reason'], 'bundle_failed')


if __name__ == '__main__':
    unittest.main()
