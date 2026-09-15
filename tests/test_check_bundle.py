"""One entrypoint per check file, and file execution serialised.

Keep run 7's suite ran 66 test instances for 23 unique tests, and a second verification
of an unchanged tree reported a different failure set than the first. Both came from
`discovered_check_command`: it passed the model's aggregate entrypoints and the files
those aggregates require as separate argv, and `node --test` runs argv files in parallel
processes against one shared persistent store.

Measured on the run 7 delivery snapshot, from a pristine seeded store: the old command
ran 66 instances with three failures the official evaluation passes; the new one runs 31
with none. See docs/keep-attribution-run7-2026-09-15.md section 4.
"""
import json
import unittest

from volo.workspace import check_bundle_entrypoints, check_requires
from test_core import TempCase


AGGREGATE = """'use strict';
const { before } = require('node:test');
const { resetState } = require('./reset.cjs');
before(async () => { await resetState(); });
require('./batch-1.spec.cjs');
require('./batch-2.spec.cjs');
"""
LEAF = """const { test } = require('./browser.cjs');
test('REQ-%s', async (page, assert) => { assert.ok(true); });
"""


class CheckBundleTests(unittest.TestCase):
    def test_a_file_an_aggregate_requires_is_not_passed_again(self):
        sources = {'checks/all.spec.cjs': AGGREGATE,
                   'checks/batch-1.spec.cjs': LEAF % '1',
                   'checks/batch-2.spec.cjs': LEAF % '2',
                   'checks/batch-3.spec.cjs': LEAF % '3'}
        self.assertEqual(check_bundle_entrypoints(sources),
                         ['checks/all.spec.cjs', 'checks/batch-3.spec.cjs'])

    def test_a_stale_aggregate_covered_by_a_newer_one_is_dropped(self):
        """Run 7 carried both: all.spec.cjs froze at batch 3, run-all.spec.cjs at batch 4."""
        sources = {'checks/all.spec.cjs': AGGREGATE,
                   'checks/run-all.spec.cjs': AGGREGATE + "require('./batch-3.spec.cjs');\n",
                   'checks/batch-1.spec.cjs': LEAF % '1',
                   'checks/batch-2.spec.cjs': LEAF % '2',
                   'checks/batch-3.spec.cjs': LEAF % '3',
                   'checks/batch-4.spec.cjs': LEAF % '4'}
        self.assertEqual(check_bundle_entrypoints(sources),
                         ['checks/run-all.spec.cjs', 'checks/batch-4.spec.cjs'])

    def test_an_entrypoint_with_tests_of_its_own_is_never_dropped(self):
        """A file that requires another and also registers tests is not an aggregate."""
        both = LEAF % 'own' + "require('./batch-1.spec.cjs');\n"
        sources = {'checks/wide.spec.cjs': both,
                   'checks/narrow.spec.cjs': "require('./batch-1.spec.cjs');\n",
                   'checks/batch-1.spec.cjs': LEAF % '1'}
        kept = check_bundle_entrypoints(sources)
        self.assertIn('checks/wide.spec.cjs', kept)
        self.assertNotIn('checks/narrow.spec.cjs', kept)
        self.assertNotIn('checks/batch-1.spec.cjs', kept)

    def test_independent_files_are_all_kept(self):
        sources = {'checks/a.spec.cjs': LEAF % 'a', 'checks/b.spec.cjs': LEAF % 'b'}
        self.assertEqual(check_bundle_entrypoints(sources),
                         ['checks/a.spec.cjs', 'checks/b.spec.cjs'])

    def test_a_require_cycle_still_returns_a_bundle(self):
        sources = {'checks/a.spec.cjs': "require('./b.spec.cjs');\n" + LEAF % 'a',
                   'checks/b.spec.cjs': "require('./a.spec.cjs');\n" + LEAF % 'b'}
        self.assertEqual(check_bundle_entrypoints(sources),
                         ['checks/a.spec.cjs', 'checks/b.spec.cjs'])

    def test_only_requires_of_other_check_files_count(self):
        source = ("const { test } = require('./browser.cjs');\n"
                  "const { resetState } = require('./reset.cjs');\n"
                  "require('./batch-1.spec.cjs');\nrequire('node:test');\n")
        self.assertEqual(check_requires('checks/all.spec.cjs', source,
                                        {'checks/batch-1.spec.cjs', 'checks/all.spec.cjs'}),
                         ['checks/batch-1.spec.cjs'])


class DiscoveredCommandTests(TempCase):
    def bundle(self, files):
        for directory, script in (('frontend', 'build'), ('backend', 'start')):
            self.workspace.write_files([{'path': directory + '/package.json',
                                         'content': json.dumps({'scripts': {script: 'node x.cjs'}})}])
        self.workspace.write_files([{'path': path, 'content': content}
                                    for path, content in files.items()])
        return self.workspace.discovered_check_command()

    def test_file_execution_is_serial_and_the_bundle_is_deduplicated(self):
        command = self.bundle({'checks/all.spec.cjs': AGGREGATE,
                               'checks/batch-1.spec.cjs': LEAF % '1',
                               'checks/batch-2.spec.cjs': LEAF % '2',
                               'checks/batch-3.spec.cjs': LEAF % '3'})
        self.assertEqual(command, ['node', '--test', '--test-concurrency=1',
                                   'checks/all.spec.cjs', 'checks/batch-3.spec.cjs'])

    def test_a_file_the_bundle_covers_is_not_run_a_second_time_standalone(self):
        """browser_checks re-ran anything not literally in the argv, which after the
        deduplication is every file an aggregate entrypoint requires."""
        self.workspace.browser = {'available': True, 'module': 'x'}
        standalone = ("const pw = require(process.env.FACTORY_PLAYWRIGHT_MODULE);\n"
                      + LEAF % '1')
        command = self.bundle({'checks/all.spec.cjs': AGGREGATE,
                               'checks/batch-1.spec.cjs': standalone,
                               'checks/batch-2.spec.cjs': LEAF % '2',
                               'checks/batch-9.spec.cjs': standalone})
        self.assertNotIn('checks/batch-1.spec.cjs', command)
        # Nothing the discovered bundle covers is offered again.
        self.assertEqual(self.workspace.browser_checks(command), [])
        # A command that names only the aggregate still leaves batch-9 uncovered.
        narrow = ['node', '--test', 'checks/all.spec.cjs']
        self.assertEqual(self.workspace.browser_checks(narrow),
                         [['node', 'checks/batch-9.spec.cjs']])

    def test_no_checks_still_means_no_command(self):
        self.assertIsNone(self.bundle({'checks/helper.cjs': '// not a spec\n'}))


if __name__ == '__main__':
    unittest.main()
