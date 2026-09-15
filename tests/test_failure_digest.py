"""The failure digest, read against two real Keep run 7 TAP logs.

`tests/fixtures/real-keep-run7-tap-*.log` are verbatim `.factory/command-NNNN.log`
files from `runs/2026-09-15-keep-full-7`. 0113 is batch 10's first verification: 34
failures in a 310 KB log, 28 of them the same hover timeout caused by one misplaced
button, and what the model actually saw of it was `not ok 7 - REQ-2.4` and nothing else.
"""
import unittest
from pathlib import Path

from volo import tap

ROOT = Path(__file__).resolve().parents[1]


def fixture(name):
    return (ROOT / 'tests/fixtures' / name).read_text()


class FailureDigest(unittest.TestCase):
    def test_every_failing_check_is_named_within_the_bound(self):
        output = fixture('real-keep-run7-tap-0113.log')
        failures = tap.failing_tests(output)
        self.assertEqual(len(failures), 34)
        digest = tap.failure_digest(output, ['2.7.6.1', '2.7.6.3', '2.8.2'])
        self.assertLessEqual(len(digest), tap.DIGEST_LIMIT)
        for failure in failures:
            self.assertIn('not ok %d - %s' % (failure['number'], failure['name']), digest)

    def test_the_regression_and_its_cause_are_both_in_the_digest(self):
        """The one line that named the defect: the hover reveals the button that blocks it."""
        digest = tap.failure_digest(fixture('real-keep-run7-tap-0113.log'), ['2.8.2'])
        self.assertIn('intercepts pointer events', digest)
        self.assertIn('label-btn', digest)
        self.assertIn('locator.hover: Timeout 5000ms exceeded.', digest)

    def test_one_error_repeated_is_written_once_and_counted(self):
        digest = tap.failure_digest(fixture('real-keep-run7-tap-0113.log'))
        self.assertEqual(digest.count('intercepts pointer events'), 6)
        self.assertIn('x24 locator.hover: Timeout 5000ms exceeded.', digest)

    def test_this_batch_is_listed_before_the_regressions(self):
        digest = tap.failure_digest(fixture('real-keep-run7-tap-0113.log'),
                                    ['2.7.6.1', '2.7.6.3', '2.8.2'])
        rows = [line for line in digest.split('\n') if line.startswith('not ok')]
        self.assertTrue(rows[0].startswith('not ok 43 - REQ-2.7.6.3'))
        self.assertTrue(rows[1].startswith('not ok 44 - REQ-2.8.2'))
        self.assertTrue(rows[2].startswith('not ok 7 - REQ-2.4'))

    def test_second_log_of_the_same_regression(self):
        output = fixture('real-keep-run7-tap-0128.log')
        failures = tap.failing_tests(output)
        self.assertEqual(len(failures), 32)
        digest = tap.failure_digest(output, ['2.7.6.1', '2.7.6.3', '2.8.2'])
        self.assertLessEqual(len(digest), tap.DIGEST_LIMIT)
        for failure in failures:
            self.assertIn('not ok %d - %s' % (failure['number'], failure['name']), digest)
        self.assertIn('label-btn', digest)

    def test_the_seeded_store_dump_never_reaches_the_digest(self):
        """A browser check prints the whole visible page on failure; 0153 has 20 KB of it."""
        digest = tap.failure_digest(fixture('real-keep-run7-tap-0153.log'))
        self.assertNotIn('Browser state:', digest)
        self.assertNotIn('Pinned from creation', digest)
        self.assertIn('deleted note no longer listed', digest)
        self.assertIn('at batch-2.spec.cjs:43:10', digest)

    def test_a_passing_log_has_no_digest(self):
        self.assertEqual(tap.failure_digest('TAP version 13\nok 1 - fine\n1..1\n'), '')
        self.assertEqual(tap.failure_digest(''), '')

    def test_the_limit_holds_when_the_failures_do_not_fit(self):
        output = fixture('real-keep-run7-tap-0113.log')
        digest = tap.failure_digest(output, limit=900)
        self.assertLessEqual(len(digest), 900)
        self.assertIn('more failing checks', digest)

    def test_failure_names_reads_the_set_only(self):
        names = tap.failure_names(fixture('real-keep-run7-tap-0155.log'))
        self.assertEqual(names, {
            'REQ-2.5.1 archive a note via the archive button with Undo',
            'REQ-2.5.1 archive a note shows notification with Undo and moves it to the archive list',
            'REQ-2.3.3 Trash list shows deleted notes and empties trash'})


if __name__ == '__main__':
    unittest.main()
