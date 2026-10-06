"""Synthetic template regressions; no paid calls or official answers."""
import contextlib
import io
import json
import os
from pathlib import Path
from unittest.mock import Mock, patch

import test_oneshot as fixtures
from test_oneshot import SYNTHETIC_KEY, application, block, events
from oneshot import main as adapter


import unittest
class EvolutionTests(unittest.TestCase):
    setUp = fixtures.OfflineCase.setUp
    enter = fixtures.OfflineCase.enter
    replies = fixtures.OfflineCase.replies

    def seed(self):
        for item in adapter.parse_blocks(application())[0]:
            adapter.write_one(self.out, item)
        (self.out / 'frontend/public/logo.bin').write_bytes(b'\xff\x00asset')
        return adapter.read_template(self.out)

    def upgrade(self, template=None, out=None):
        return adapter.generate('Extend the synthetic app', 'synthetic-model',
                                'https://synthetic.invalid', SYNTHETIC_KEY,
                                out or self.out, template=template or self.out)

    def test_in_place_patch_reads_source_and_preserves_unchanged_binary_and_text(self):
        before = self.seed()
        self.replies(events(block('frontend/public/index.html', '<h1>Updated</h1>')))
        self.upgrade()
        after = adapter.read_template(self.out)
        self.assertEqual(set(before), set(after))
        for name in before:
            if name != 'frontend/public/index.html':
                self.assertEqual(before[name], after[name])
        payload = json.loads(self.transport.call_args.args[0].data)
        self.assertIn('console.log', payload['messages'][1]['content'])
        self.assertIn('binary_bytes', payload['messages'][1]['content'])
        self.assertEqual(list(self.root.glob('.oneshot-*')), [])

    def test_separate_template_stays_unchanged(self):
        before = self.seed()
        self.replies(events(block('frontend/public/index.html', '<h1>Updated</h1>')))
        target = self.root / 'upgraded'
        self.upgrade(out=target)
        self.assertEqual(adapter.read_template(self.out), before)
        self.assertIn('Updated', (target / 'frontend/public/index.html').read_text())

    def test_upgrade_runs_requirement_written_checks_and_source_review(self):
        self.seed()
        self.replies(events(block('frontend/public/index.html', '<h1>Updated</h1>')))
        suite = self.root / 'upgrade-tests'
        suite.mkdir()
        job = {'dir': suite, 'thread': Mock(is_alive=Mock(return_value=False))}
        with patch.object(adapter, 'SMOKE', True), patch.object(adapter, 'TESTGEN', True), \
                patch.object(adapter, 'SOURCE_CONTRACTS', True), patch.object(adapter, 'SECOND_SUITE', False), \
                patch.object(adapter, 'start_suite', return_value=job) as start, \
                patch.object(adapter, 'finish_suite', return_value=suite), \
                patch.object(adapter, 'repair_delivery') as repair, \
                patch.object(adapter, 'source_review') as review:
            self.upgrade()
        start.assert_called_once()
        self.assertEqual(start.call_args.args[0], 'Extend the synthetic app')
        self.assertEqual(repair.call_args.kwargs['tests'], suite)
        review.assert_called_once()
        self.assertEqual(review.call_args.args[-1], suite)
        self.assertFalse(suite.exists())

    def upgrade_reporting(self):
        """Run an upgrade that ends in an error but still delivers; returns what it printed to stderr."""
        capture = io.StringIO()
        with contextlib.redirect_stderr(capture):
            self.upgrade()
        self.assertIn('[oneshot] delivering the last complete version after an error: ', capture.getvalue())
        return capture.getvalue()

    def test_partial_or_invalid_upgrade_leaves_original_untouched(self):
        before = self.seed()
        # A patch that breaks a required file leaves nothing complete to deliver: still nonzero.
        self.replies(events(block('backend/package.json', '{}')))
        with self.assertRaisesRegex(ValueError, 'incomplete delivery'):
            self.upgrade()
        self.assertEqual(adapter.read_template(self.out), before)
        # A rejected or unterminated patch writes nothing; the original is the last complete version and ships
        # (it used to raise, and the task scored zero).
        for reply, reason in ((block('../escape', 'bad'), 'escapes'),
                              ('=== FILE: x.js ===\npartial', 'unterminated file block: x.js')):
            self.replies(events(reply))
            self.assertIn(reason, self.upgrade_reporting())
            self.assertEqual(adapter.read_template(self.out), before)
        self.assertFalse((self.root / 'escape').exists())
        self.assertEqual(list(self.root.glob('.oneshot-*')), [])

    def test_unchanged_response_is_not_an_upgrade(self):
        before = self.seed()
        self.replies(events(block('frontend/public/index.html', before['frontend/public/index.html'].decode().rstrip())))
        self.assertIn('upgrade did not change any files', self.upgrade_reporting())
        self.assertEqual(adapter.read_template(self.out), before)

    def test_snapshot_limits_and_symlinks_fail_before_http(self):
        self.seed()
        with patch.object(adapter, 'MAX_TEMPLATE_BYTES', 10):
            with self.assertRaisesRegex(ValueError, 'limit'):
                self.upgrade()
        (self.out / 'linked.js').symlink_to(self.out / 'backend/server.js')
        with self.assertRaisesRegex(ValueError, 'symlink'):
            self.upgrade()
        self.transport.assert_not_called()

    def test_local_dotfiles_and_build_artifacts_are_not_sent(self):
        self.seed()
        (self.out / '.env').write_text('SYNTHETIC_SECRET=do-not-send')
        (self.out / 'frontend/dist').mkdir()
        (self.out / 'frontend/dist/index.html').write_text('old-dist-sentinel')
        snapshot = adapter.read_template(self.out)
        context = adapter.template_context(snapshot)
        self.assertNotIn('do-not-send', context)
        self.assertNotIn('old-dist-sentinel', context)
        self.replies(events(block('frontend/public/index.html', '<h1>Updated</h1>')))
        self.upgrade()
        self.assertEqual((self.out / '.env').read_text(), 'SYNTHETIC_SECRET=do-not-send')
        self.assertEqual((self.out / 'frontend/dist/index.html').read_text(), 'old-dist-sentinel')

    def test_alias_path_cannot_turn_unchanged_response_into_success(self):
        before = self.seed()
        self.replies(events(block('./frontend/public/index.html', before['frontend/public/index.html'].decode().rstrip())))
        self.assertIn('upgrade did not change any files', self.upgrade_reporting())
        self.assertEqual(adapter.read_template(self.out), before)

    def test_large_task_inputs_are_preserved_without_consuming_application_snapshot(self):
        self.seed()
        inputs = self.out / 'requirements'
        inputs.mkdir()
        original = b'prior task input\n' + b'x' * adapter.MAX_TEMPLATE_BYTES
        (inputs / 'requirements.yaml').write_bytes(original)
        asset = self.out / 'frontend/public/requirements/help.txt'
        asset.parent.mkdir()
        asset.write_text('Application asset with the same directory name')
        snapshot = adapter.read_template(self.out)
        self.assertNotIn('requirements/requirements.yaml', snapshot)
        self.assertIn('frontend/public/requirements/help.txt', snapshot)
        self.assertNotIn('prior task input', adapter.template_context(snapshot))
        self.replies(events(block('frontend/public/index.html', '<h1>Updated</h1>')))
        self.upgrade()
        self.assertEqual((inputs / 'requirements.yaml').read_bytes(), original)
        self.assertEqual(asset.read_text(), 'Application asset with the same directory name')

    def test_repair_cannot_modify_retained_task_inputs(self):
        self.seed()
        with self.assertRaisesRegex(ValueError, 'metadata or build artifacts'):
            adapter._write_repair(self.out, [{'path': 'requirements/requirements.yaml', 'content': 'changed'}], self.out)
        self.assertFalse((self.out / 'requirements').exists())

    def test_preserved_metadata_is_not_writable_by_generated_patch(self):
        self.seed()
        (self.out / '.env').write_text('preserved')
        for name in ('.env', 'frontend/.env', 'frontend/dist/old.js', 'node_modules/x.js',
                     'requirements/requirements.yaml'):
            self.replies(events(block(name, 'bad')))
            self.assertIn('metadata or build artifacts: ' + name, self.upgrade_reporting())
        self.assertEqual((self.out / '.env').read_text(), 'preserved')
        for name in ('frontend/.env', 'frontend/dist/old.js', 'node_modules/x.js'):
            self.assertFalse((self.out / name).exists())

    def test_concurrent_source_change_keeps_untouched_files(self):
        self.seed()
        def response(*args, **kwargs):
            (self.out / 'backend/server.js').write_text('concurrent edit')
            return block('frontend/public/index.html', '<h1>Updated</h1>'), {}, 'stop'
        with patch.object(adapter, 'stream_completion', side_effect=response):
            self.upgrade()
        # Only the files the model changed are written back; a file it left alone keeps whatever is on disk.
        self.assertEqual((self.out / 'backend/server.js').read_text(), 'concurrent edit')
        self.assertIn('Updated', (self.out / 'frontend/public/index.html').read_text())

    def test_failed_publish_restores_original(self):
        before = self.seed()
        self.replies(events(block('frontend/public/index.html', '<h1>Updated</h1>')))
        with patch.object(Path, 'replace', side_effect=OSError('synthetic publication failure')):
            with self.assertRaisesRegex(OSError, 'publication failure'):
                self.upgrade()
        self.assertEqual(adapter.read_template(self.out), before)
        self.assertEqual(list(self.root.glob('.oneshot-*')), [])

    def test_concurrent_metadata_change_publishes_without_losing_it(self):
        self.seed()
        (self.out / '.env').write_text('before')
        def response(*args, **kwargs):
            (self.out / '.env').write_text('concurrent change')
            (self.out / '.git').mkdir()
            (self.out / '.git/new-object').write_text('retained')
            return block('frontend/public/index.html', '<h1>Updated</h1>'), {}, 'stop'
        with patch.object(adapter, 'stream_completion', side_effect=response):
            self.upgrade()
        self.assertEqual((self.out / '.env').read_text(), 'concurrent change')
        self.assertEqual((self.out / '.git/new-object').read_text(), 'retained')
        self.assertIn('Updated', (self.out / 'frontend/public/index.html').read_text())

    def test_runner_log_written_during_generation_is_kept_and_publication_succeeds(self):
        # The platform runner appends the agent's output to <output-dir>/.arc/stdout.log while it runs (10-06).
        self.seed()
        (self.out / '.arc').mkdir()
        (self.out / '.arc/stdout.log').write_text('start\n')
        inode = (self.out / '.arc/stdout.log').stat().st_ino
        def response(*args, **kwargs):
            with open(self.out / '.arc/stdout.log', 'a') as log:
                log.write('agent output\n')
            return (block('frontend/public/index.html', '<h1>Updated</h1>') +
                    block('frontend/public/new/added.js', 'export const added = 1;')), {}, 'stop'
        with patch.object(adapter, 'stream_completion', side_effect=response):
            self.upgrade()
        self.assertEqual((self.out / '.arc/stdout.log').read_text(), 'start\nagent output\n')
        self.assertEqual((self.out / '.arc/stdout.log').stat().st_ino, inode)
        self.assertIn('Updated', (self.out / 'frontend/public/index.html').read_text())
        self.assertEqual((self.out / 'frontend/public/new/added.js').read_text().strip(), 'export const added = 1;')
        self.assertEqual([p for p in self.out.rglob('.oneshot-*')], [])

    def test_platform_cli_detects_prepopulated_application(self):
        self.seed()
        req = self.root / 'input'
        req.mkdir()
        (req / 'requirements.yaml').write_text('Extend this application')
        self.replies(events(block('frontend/public/index.html', '<h1>Updated</h1>')))
        with patch.dict(os.environ, {'OPENAI_API_KEY': SYNTHETIC_KEY}, clear=True), contextlib.redirect_stderr(io.StringIO()), contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(adapter.main([str(req), '--output-dir', str(self.out), '--type', 'web']), 0)
