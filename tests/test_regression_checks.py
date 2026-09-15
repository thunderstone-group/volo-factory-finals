"""Which check files become permanent regression checks.

Keep run 7's batch 1 wrote `checks/tmp-debug.spec.cjs` to look at the page once: it
prints the header markup and some role counts and then asserts true. It was recorded as
a regression check, which locks it against editing and runs it in every later
verification, and the 1.2 KB of markup it prints went into the tail of the output the
model could still read while its real failures were being cut out of the middle. The
file is a verbatim fixture here.
"""
import json
import unittest
from pathlib import Path

from volo.agent import Agent, asserts_something, is_regression_check
from volo import contract as state_contract
from volo.trace import Runtime
from test_core import TempCase
from test_state_contract import FakeModel, SYNTHETIC_RESPONSE, synthetic_requirements

ROOT = Path(__file__).resolve().parents[1]
REAL = """const { test } = require('./browser.cjs');
test('REQ-1 the row is listed after it is created', async (page, assert) => {
  await page.getByRole('button', { name: 'Save' }).click();
  assert.ok(await page.getByText('Sprint goals').isVisible());
});
"""
WAIT_ONLY = """const { test } = require('./browser.cjs');
test('REQ-2 the trash page lists the deleted row', async (page) => {
  await page.getByRole('link', { name: 'Trash' }).click();
  await page.getByText('Delete me').first().waitFor();
});
"""
AGGREGATE = """'use strict';
const { before } = require('node:test');
const { resetState } = require('./reset.cjs');
before(async () => { await resetState(); });
require('./batch-1.spec.cjs');
"""


class RegressionCheckRuleTests(unittest.TestCase):
    def test_the_real_debug_probe_is_not_a_regression_check(self):
        source = (ROOT / 'tests/fixtures/real-keep-run7-tmp-debug.spec.cjs').read_text()
        self.assertFalse(is_regression_check('checks/tmp-debug.spec.cjs', source))

    def test_a_check_with_a_real_assertion_is_one(self):
        self.assertTrue(is_regression_check('checks/batch-3.spec.cjs', REAL))

    def test_a_wait_on_a_locator_counts_as_an_assertion(self):
        """It throws on timeout; run 7's REQ-2.3.3 check asserts nothing else."""
        self.assertTrue(asserts_something(WAIT_ONLY))
        self.assertTrue(is_regression_check('checks/batch-7.spec.cjs', WAIT_ONLY))

    def test_a_file_whose_only_assertion_is_a_truism_is_not_one(self):
        source = "const { test } = require('./browser.cjs');\n" \
                 "test('look', async (page, assert) => { console.log(1); assert.ok(true); });\n"
        self.assertFalse(is_regression_check('checks/inspect.spec.cjs', source))

    def test_an_aggregate_entrypoint_asserts_nothing_of_its_own(self):
        self.assertFalse(is_regression_check('checks/all.spec.cjs', AGGREGATE))

    def test_a_file_that_registers_no_test_and_requires_nothing_is_still_recorded(self):
        """The synthetic stubs the schedule tests write are checks by position."""
        self.assertTrue(is_regression_check('checks/batch-1.spec.cjs', '// batch 1 check\n'))

    def test_the_name_alone_is_enough_to_exclude_a_one_off(self):
        for name in ('tmp-debug.spec.cjs', 'debug.spec.cjs', 'scratch-1.spec.cjs',
                     'batch-2.tmp.spec.cjs', 'probe.spec.cjs'):
            self.assertFalse(is_regression_check('checks/' + name, REAL), name)
        for name in ('batch-1.spec.cjs', 'interface.spec.cjs', 'debugger-panel.spec.cjs'):
            self.assertTrue(is_regression_check('checks/' + name, REAL), name)


class RecordBatchChecksTests(TempCase):
    def agent(self):
        requirements = synthetic_requirements(self)
        contract = state_contract.reconcile(
            state_contract.normalize(json.loads(SYNTHETIC_RESPONSE)),
            state_contract.evidence(requirements))
        agent = Agent(requirements, FakeModel('{}'), self.workspace, Runtime(self.trace),
                      contract=contract)
        agent.install_contract()
        return agent

    def test_only_the_real_check_is_locked_into_the_suite(self):
        agent = self.agent()
        agent.batch_index = 1
        self.workspace.write_files([
            {'path': 'checks/batch-1.spec.cjs', 'content': REAL},
            {'path': 'checks/tmp-debug.spec.cjs',
             'content': (ROOT / 'tests/fixtures/real-keep-run7-tmp-debug.spec.cjs').read_text()}])
        self.assertEqual(agent.record_batch_checks(['REQ-1']), ['checks/batch-1.spec.cjs'])
        self.assertEqual(sorted(agent.regression_checks), ['checks/batch-1.spec.cjs'])
        events = [json.loads(line) for line in
                  (self.trace.directory / 'events.jsonl').read_text().splitlines()]
        recorded = [event for event in events if event['event'] == 'regression_checks_recorded'][-1]
        self.assertEqual(recorded['not_regression_checks'], ['checks/tmp-debug.spec.cjs'])
        # Not locked: the next batch may rewrite or delete it.
        args, locked = agent.withhold_locked_checks(
            {'files': [{'path': 'checks/tmp-debug.spec.cjs', 'content': '// gone\n'}]})
        self.assertEqual(locked, {})
        self.assertEqual(len(args['files']), 1)


if __name__ == '__main__':
    unittest.main()
