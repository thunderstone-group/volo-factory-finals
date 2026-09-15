"""The bounded-repair channel, sized against Keep run 7's delivered tree.

`source_snapshot` returns nothing at all above twenty candidate files or
STALL_SOURCE_LIMIT bytes, and run 7 crossed both: 21 files and 74.6 KB, of which 34.5 KB
was the model's own `checks/*.cjs`, which a contract batch may not edit. The channel's
last success was batch 4; the twenty-six stall repairs after it all ended
`bounded_repair_unavailable`, while the model re-read `checks/browser.cjs` twenty-seven
times. The file sizes below are the delivered snapshot's, measured.
"""
import json
import unittest

from volo import contract as state_contract
from volo.agent import Agent, STALL_SOURCE_LIMIT
from volo.trace import Runtime
from test_core import TempCase
from test_state_contract import FakeModel, SYNTHETIC_RESPONSE, synthetic_requirements


# path -> bytes, from runs/2026-09-15-keep-full-7/app at the delivered fingerprint.
PRODUCT = {'backend/api.cjs': 5776,
           'frontend/public/index.html': 4119,
           'frontend/public/features/note-editor.js': 14066,
           'frontend/public/features/trash-archive.js': 6508,
           'frontend/public/features/note-listing.js': 4948,
           'frontend/public/features/pin-note.js': 3784,
           'frontend/public/features/default-label.js': 854}
CHECKS = {'checks/batch-1.spec.cjs': 4114, 'checks/batch-2.spec.cjs': 5698,
          'checks/batch-3.spec.cjs': 2911, 'checks/batch-4.spec.cjs': 3156,
          'checks/batch-5.spec.cjs': 1431, 'checks/batch-6.spec.cjs': 3751,
          'checks/batch-7.spec.cjs': 3313, 'checks/pin-note.spec.cjs': 3832,
          'checks/browser.cjs': 2643, 'checks/requirements.cjs': 575,
          'checks/reset.cjs': 1389, 'checks/all.spec.cjs': 400,
          'checks/run-all.spec.cjs': 645, 'checks/tmp-debug.spec.cjs': 708}


class SourceSnapshotTests(TempCase):
    def tree(self):
        self.workspace.write_files([{'path': path, 'content': '// x\n' + 'y' * (size - 6) + '\n'}
                                    for path, size in {**PRODUCT, **CHECKS}.items()])

    def agent(self, contract=True):
        requirements = synthetic_requirements(self)
        value = None
        if contract:
            value = state_contract.reconcile(
                state_contract.normalize(json.loads(SYNTHETIC_RESPONSE)),
                state_contract.evidence(requirements))
        agent = Agent(requirements, FakeModel('{}'), self.workspace, Runtime(self.trace),
                      contract=value)
        agent.source_snapshot_limit = STALL_SOURCE_LIMIT
        return agent

    def test_a_contract_run_offers_the_product_source_and_not_the_checks(self):
        self.tree()
        source = self.agent().source_snapshot()
        self.assertIsNotNone(source, 'the candidate set must fit the bound again')
        self.assertEqual(sorted(source), sorted(PRODUCT))
        self.assertLessEqual(len(source), 20)
        self.assertLess(sum(len(text) for text in source.values()), STALL_SOURCE_LIMIT)

    def test_the_same_tree_with_the_checks_counted_does_not_fit(self):
        """21 files over the twenty-file cap: what the channel saw from batch 5 on."""
        self.tree()
        self.assertIsNone(self.agent(contract=False).source_snapshot())

    def test_the_stall_repair_channel_is_open_again(self):
        self.tree()
        agent = self.agent()
        agent.inline_source = False
        self.assertIsNotNone(agent.stall_sources())
        self.assertEqual(sorted(agent.stall_sources()), sorted(PRODUCT))


if __name__ == '__main__':
    unittest.main()
