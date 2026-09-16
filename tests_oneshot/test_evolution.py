"""Synthetic template regressions; no paid calls or official answers."""
import contextlib
import io
import json
import os
from pathlib import Path
from unittest.mock import patch

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

    def test_partial_or_invalid_upgrade_leaves_original_untouched(self):
        before = self.seed()
        for reply in (block('backend/package.json', '{}'),
                      block('../escape', 'bad'), '=== FILE: x.js ===\npartial'):
            self.replies(events(reply))
            with self.assertRaises(ValueError):
                self.upgrade()
            self.assertEqual(adapter.read_template(self.out), before)
        self.assertEqual(list(self.root.glob('.oneshot-*')), [])

    def test_unchanged_response_is_not_an_upgrade(self):
        before = self.seed()
        self.replies(events(block('frontend/public/index.html', before['frontend/public/index.html'].decode().rstrip())))
        with self.assertRaisesRegex(ValueError, 'did not change'):
            self.upgrade()
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
        with self.assertRaisesRegex(ValueError, 'did not change'):
            self.upgrade()
        self.assertEqual(adapter.read_template(self.out), before)

    def test_preserved_metadata_is_not_writable_by_generated_patch(self):
        self.seed()
        (self.out / '.env').write_text('preserved')
        for name in ('.env', 'frontend/.env', 'frontend/dist/old.js', 'node_modules/x.js'):
            self.replies(events(block(name, 'bad')))
            with self.assertRaisesRegex(ValueError, 'metadata or build artifacts'):
                self.upgrade()
        self.assertEqual((self.out / '.env').read_text(), 'preserved')

    def test_concurrent_source_change_aborts_publication(self):
        self.seed()
        def response(*args, **kwargs):
            (self.out / 'backend/server.js').write_text('concurrent edit')
            return block('frontend/public/index.html', '<h1>Updated</h1>'), {}, 'stop'
        with patch.object(adapter, 'stream_completion', side_effect=response):
            with self.assertRaisesRegex(ValueError, 'template changed'):
                self.upgrade()
        self.assertEqual((self.out / 'backend/server.js').read_text(), 'concurrent edit')
        self.assertNotIn('Updated', (self.out / 'frontend/public/index.html').read_text())

    def test_failed_publish_restores_original(self):
        before = self.seed()
        self.replies(events(block('frontend/public/index.html', '<h1>Updated</h1>')))
        with patch.object(Path, 'replace', side_effect=OSError('synthetic publication failure')):
            with self.assertRaisesRegex(OSError, 'publication failure'):
                self.upgrade()
        self.assertEqual(adapter.read_template(self.out), before)
        self.assertEqual(list(self.root.glob('.oneshot-*')), [])

    def test_concurrent_metadata_change_aborts_without_losing_it(self):
        self.seed()
        (self.out / '.env').write_text('before')
        def response(*args, **kwargs):
            (self.out / '.env').write_text('concurrent change')
            (self.out / '.git').mkdir()
            (self.out / '.git/new-object').write_text('retained')
            return block('frontend/public/index.html', '<h1>Updated</h1>'), {}, 'stop'
        with patch.object(adapter, 'stream_completion', side_effect=response):
            with self.assertRaisesRegex(ValueError, 'template changed'):
                self.upgrade()
        self.assertEqual((self.out / '.env').read_text(), 'concurrent change')
        self.assertEqual((self.out / '.git/new-object').read_text(), 'retained')
        self.assertNotIn('Updated', (self.out / 'frontend/public/index.html').read_text())

    def test_platform_cli_detects_prepopulated_application(self):
        self.seed()
        req = self.root / 'input'
        req.mkdir()
        (req / 'requirements.yaml').write_text('Extend this application')
        self.replies(events(block('frontend/public/index.html', '<h1>Updated</h1>')))
        with patch.dict(os.environ, {'OPENAI_API_KEY': SYNTHETIC_KEY}, clear=True), contextlib.redirect_stderr(io.StringIO()), contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(adapter.main([str(req), '--output-dir', str(self.out), '--type', 'web']), 0)
