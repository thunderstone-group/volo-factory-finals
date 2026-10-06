"""Synthetic protocol and transport fixtures; real gateway evidence lives in the dated report."""
import hashlib
import json
from pathlib import Path
import unittest
from unittest.mock import patch, Mock

from oneshot import main as adapter, upgrade_patch as protocol
import test_oneshot as fixtures
from test_oneshot import application, block, events, SYNTHETIC_KEY


def edit(path, *hunks):
    return (f"=== EDIT: {path} ===\n" + "".join(
        f"<<<<<<< SEARCH\n{search}=======\n{replace}>>>>>>> REPLACE\n" for search, replace in hunks) +
        "=== END ===\n")


class UpgradePatchTests(unittest.TestCase):
    setUp = fixtures.OfflineCase.setUp
    enter = fixtures.OfflineCase.enter
    replies = fixtures.OfflineCase.replies

    def seed(self):
        for item in adapter.parse_blocks(application())[0]:
            adapter.write_one(self.out, item)
        (self.out / 'large.js').write_text('const first = 1;\nconst second = 2;\n' + '// untouched\n' * 400)
        return adapter.read_template(self.out)

    def apply(self, text, original=None):
        return protocol.apply_reply(text, self.out, original or adapter.read_template(self.out), adapter)

    def draft(self, *responses, budget=None):
        self.replies(*responses)
        budget = budget or adapter.CallBudget()
        files = []
        messages = [{'role': 'system', 'content': 'Synthetic system'}, {'role': 'user', 'content': 'Synthetic task'}]
        history = protocol.draft(self.out, files, messages, 'synthetic-model', 'https://synthetic.invalid',
                                 SYNTHETIC_KEY, budget, adapter)
        return files, history, budget.upgrade_patch

    def test_mixed_edit_file_and_unchanged_bytes(self):
        before = self.seed()
        response = (edit('large.js', ('const first = 1;\n', 'const first = 3;\n')) +
                    block('new.js', 'const fresh = true;') + block('frontend/public/index.html', '<h1>Updated</h1>'))
        result = self.apply(response)
        self.assertEqual(result['applied'], 1)
        self.assertEqual(result['edited'], ['large.js'])
        self.assertEqual(result['created'], ['new.js'])
        self.assertEqual(result['rewritten'], ['frontend/public/index.html'])
        self.assertEqual((self.out / 'large.js').read_bytes(), before['large.js'].replace(b'first = 1', b'first = 3'))
        self.assertEqual((self.out / 'backend/server.js').read_bytes(), before['backend/server.js'])

    def test_exact_once_no_whitespace_fallback_and_atomic_per_file(self):
        before = self.seed()
        response = (edit('large.js', ('const first = 1;\n', 'const first = 4;\n'),
                         ('  const second = 2;\n', 'const second = 5;\n')) + block('new.js', 'ok'))
        result = self.apply(response)
        self.assertEqual(result['applied'], 0)
        self.assertEqual((self.out / 'large.js').read_bytes(), before['large.js'])
        self.assertTrue((self.out / 'new.js').is_file())
        self.assertIn('0 places', result['rejected'][0]['problems'][0]['reason'])
        self.assertEqual(result['rejected'][0]['hunks'], 2)
        self.assertEqual(result['rejected'][0]['unmatched'], 1)
        self.assertIn('2: const second = 2;', result['rejected'][0]['problems'][0]['current'])

    def test_ambiguous_search_is_rejected_and_numbered(self):
        self.seed()
        (self.out / 'a.js').write_text('same();\nother();\nsame();\n')
        result = self.apply(edit('a.js', ('same();\n', 'different();\n')))
        problem = result['rejected'][0]['problems'][0]
        self.assertIn('2 places', problem['reason'])
        self.assertIn('1: same();', problem['current'])
        self.assertIn('3: same();', problem['current'])
        self.assertEqual(protocol.occurrences('aaa', 'aa'), [0, 1])

    def test_multiple_blocks_same_file_are_one_transaction_and_aliases_group(self):
        before = self.seed()
        result = self.apply(edit('large.js', ('const first = 1;\n', 'const first = 3;\n')) +
                            edit('./large.js', ('absent();\n', 'fixed();\n')))
        self.assertEqual(result['applied'], 0)
        self.assertEqual(result['rejected'][0]['hunks'], 2)
        self.assertEqual((self.out / 'large.js').read_bytes(), before['large.js'])

    def test_hunks_are_sequential_and_preserve_crlf(self):
        self.seed()
        (self.out / 'a.js').write_bytes(b'a();\r\nb();\r\n')
        result = self.apply(edit('a.js', ('a();\r\n', 'c();\r\n'), ('c();\r\n', 'd();\r\n')))
        self.assertEqual(result['applied'], 2)
        self.assertEqual((self.out / 'a.js').read_bytes(), b'd();\r\nb();\r\n')

    def test_large_file_full_replacement_rejected_at_byte_threshold(self):
        self.seed()
        for size in (4096, 4097):
            (self.out / 'size.js').write_bytes(b'x' * size)
            result = self.apply(block('size.js', 'small'))
            self.assertEqual(bool(result['rejected']), size > 4096)
        (self.out / 'unicode.js').write_text('字' * 1400)
        self.assertTrue(self.apply(block('unicode.js', 'small'))['rejected'])
        result = self.apply(block('brand-new.js', 'x' * 5000))
        self.assertEqual(result['created'], ['brand-new.js'])

    def test_empty_search_malformed_hunk_and_binary_rejected(self):
        self.seed()
        for body in ('<<<<<<< SEARCH\n=======\nx\n>>>>>>> REPLACE\n',
                     '<<<<<<< SEARCH\nconst first = 1;\n=======\nx\n',
                     '<<<<<<< SEARCH\nconst first = 1;\n=======\nx\n=======\n>>>>>>> REPLACE\n'):
            self.assertTrue(self.apply('=== EDIT: large.js ===\n' + body + '=== END ===\n')['rejected'])
        (self.out / 'asset.bin').write_bytes(b'\xff\x00')
        self.assertTrue(self.apply(block('asset.bin', 'text'))['rejected'])

    def test_correction_once_in_same_conversation_and_whole_file_retried(self):
        self.seed()
        initial = edit('large.js', ('const first = 1;\n', 'const first = 4;\n'),
                       ('const second = 99;\n', 'const second = 5;\n')) + block('new.js', 'ok')
        corrected = edit('large.js', ('const first = 1;\n', 'const first = 4;\n'),
                         ('const second = 2;\n', 'const second = 5;\n'))
        files, history, stats = self.draft(events(initial), events(corrected))
        self.assertEqual(stats['correction_turns'], 1)
        self.assertEqual(stats['proposed_hunks'], 4)
        self.assertEqual(stats['applied_hunks'], 2)
        self.assertEqual(stats['corrected_hunks'], 2)
        self.assertEqual(stats['unmatched_hunks'], 0)
        self.assertEqual(self.transport.call_count, 2)
        request = json.loads(self.transport.call_args.args[0].data)['messages']
        self.assertEqual(request[-2], {'role': 'assistant', 'content': initial})
        self.assertIn('2: const second = 2;', request[-1]['content'])
        self.assertIn('ALL intended hunks', request[-1]['content'])
        self.assertEqual(len(files), 2)

    def test_failed_correction_reports_and_delivery_checks_still_run(self):
        before = self.seed()
        bad = edit('large.js', ('absent();\n', 'fixed();\n'))
        self.replies(events(bad + block('new.js', 'ok')), events(bad))
        budget = adapter.CallBudget()
        with patch.object(adapter, 'UPGRADE_PATCH', True), patch.object(adapter, 'SMOKE', True), \
                patch.object(adapter, 'repair_delivery') as repair:
            adapter.generate('Synthetic requirements', 'synthetic-model', 'https://synthetic.invalid',
                             SYNTHETIC_KEY, self.out, budget, template=self.out)
        repair.assert_called_once()
        self.assertIn('still not applied', repair.call_args.args[2][-1]['content'])
        self.assertEqual(budget.upgrade_patch['unmatched_hunks'], 1)
        self.assertEqual((self.out / 'large.js').read_bytes(), before['large.js'])
        self.assertTrue((self.out / 'new.js').is_file())
        self.assertEqual(self.transport.call_count, 2)

    def test_truncation_inside_hunk_discards_entire_file_until_continuation(self):
        before = self.seed()
        first = (edit('large.js', ('const first = 1;\n', 'const first = 3;\n')) +
                 '=== EDIT: large.js ===\n<<<<<<< SEARCH\nconst second = 2;\n=======\nconst second =')
        partial = self.apply(first)
        self.assertEqual(partial['pending'], ['large.js'])
        self.assertEqual((self.out / 'large.js').read_bytes(), before['large.js'])
        complete = edit('large.js', ('const first = 1;\n', 'const first = 3;\n'),
                        ('const second = 2;\n', 'const second = 4;\n'))
        _, _, stats = self.draft(events(first, finish='length'), events(complete))
        self.assertEqual(stats['applied_hunks'], 2)
        self.assertEqual(stats['correction_turns'], 0)
        self.assertIn('const second = 4;', (self.out / 'large.js').read_text())

    def test_all_hunks_unmatched_still_reaches_normal_repair_loop(self):
        before = self.seed()
        bad = edit('large.js', ('absent();\n', 'fixed();\n'))
        self.replies(events(bad), events(bad))
        with patch.object(adapter, 'UPGRADE_PATCH', True), patch.object(adapter, 'SMOKE', True), \
                patch.object(adapter, 'repair_delivery') as repair:
            adapter.generate('Synthetic requirements', 'synthetic-model', 'https://synthetic.invalid',
                             SYNTHETIC_KEY, self.out, template=self.out)
        repair.assert_called_once()
        self.assertEqual(adapter.read_template(self.out), before)

    def test_cut_between_blocks_and_transport_salvage(self):
        self.seed()
        first = edit('large.js', ('const first = 1;\n', 'const first = 3;\n'))
        for done in (True, False):
            (self.out / 'large.js').write_text('const first = 1;\n' + '// untouched\n' * 400)
            _, _, stats = self.draft(events(first, finish='length', done=done), events(block('new.js', 'ok')))
            self.assertEqual(stats['applied_hunks'], 1)
            self.assertEqual(stats['correction_turns'], 0)

    def test_truncated_later_edit_to_prior_file_continues_against_current_text(self):
        self.seed()
        first = edit('large.js', ('const first = 1;\n', 'const first = 3;\n'))
        cut = '=== EDIT: large.js ===\n<<<<<<< SEARCH\nconst first = 3;\n=======\ncut'
        last = edit('large.js', ('const first = 3;\n', 'const first = 4;\n'))
        _, _, stats = self.draft(events(first, finish='length'), events(cut, finish='length'), events(last))
        self.assertEqual(stats['applied_hunks'], 2)
        self.assertEqual(stats['correction_turns'], 0)
        ask = json.loads(self.transport.call_args.args[0].data)['messages'][-1]['content']
        self.assertIn('Do not repeat applied files: []', ask)
        self.assertIn('before this reply: ["large.js"]', ask)

    def test_failed_hunks_collected_until_single_correction_after_continuations(self):
        self.seed()
        bad = edit('large.js', ('missing();\n', 'fixed();\n'))
        self.draft(events(bad, finish='length'), events(block('new.js', 'ok')), events(bad))
        requests = [json.loads(c.args[0].data)['messages'] for c in self.transport.call_args_list]
        self.assertNotIn('SEARCH matches', requests[1][-1]['content'])
        self.assertIn('SEARCH matches', requests[2][-1]['content'])
        self.assertEqual(self.transport.call_count, 3)

    def test_truncated_correction_is_not_retried_or_partially_applied(self):
        before = self.seed()
        bad = edit('large.js', ('missing\n', 'replacement\n'))
        cut = edit('large.js', ('const first = 1;\n', 'const first = 3;\n')).replace('=== END ===\n', '')
        _, _, stats = self.draft(events(bad), events(cut, finish='length'))
        self.assertEqual(self.transport.call_count, 2)
        self.assertEqual(stats['applied_hunks'], 0)
        self.assertEqual(stats['unmatched_hunks'], 1)
        self.assertEqual((self.out / 'large.js').read_bytes(), before['large.js'])
        self.assertEqual(stats['unresolved'][0]['problems'][0]['reason'], 'correction was truncated')

    def test_correction_slot_survives_draft_call_limit(self):
        self.seed()
        _, _, stats = self.draft(events(edit('large.js', ('missing\n', 'x\n'))),
                                 events(edit('large.js', ('const first = 1;\n', 'const first = 9;\n'))),
                                 budget=adapter.CallBudget(draft_limit=1))
        self.assertEqual(stats['corrected_hunks'], 1)

    def test_forbidden_file_fallback_does_not_erase_unresolved_hunks(self):
        before = self.seed()
        _, _, stats = self.draft(events(edit('large.js', ('missing\n', 'x\n'))),
                                 events(block('large.js', 'a replacement')))
        self.assertEqual(stats['unmatched_hunks'], 1)
        self.assertEqual(stats['applied_hunks'], 0)
        self.assertEqual((self.out / 'large.js').read_bytes(), before['large.js'])

    def test_metadata_requirements_traversal_and_symlink_paths_never_written(self):
        self.seed()
        (self.out / '.arc').mkdir()
        (self.out / '.arc/runner').write_text('protected\n')
        (self.out / 'alias').symlink_to(self.out / '.arc', target_is_directory=True)
        for path in ('.env', '.arc/runner', 'alias/runner', './requirements/requirements.yaml',
                     'frontend/dist/app.js', 'node_modules/file.js', '../escape.js'):
            for reply in (block(path, 'bad'), edit(path, ('protected\n', 'bad\n')),
                          '=== EDIT: ' + path + ' ===\n<<<<<<< SEARCH\n'):
                with self.subTest(path=path, reply=reply), self.assertRaises(ValueError):
                    self.apply(block('new.js', 'must not be written') + reply)
                self.assertFalse((self.out / 'new.js').exists())
        self.assertEqual((self.out / '.arc/runner').read_text(), 'protected\n')

    def test_prompt_inventory_marks_required_edits_and_removes_whole_file_contract(self):
        before = self.seed()
        with patch.object(adapter, 'UPGRADE_PATCH', True):
            prompt = adapter.draft_messages('Synthetic requirements', snapshot=before)[1]['content']
        self.assertIn('"path": "large.js"', prompt)
        self.assertIn('"mode": "EDIT required"', prompt)
        self.assertNotIn('Emit every file the application needs, in full.', prompt)
        self.assertNotIn('emit complete file blocks ONLY', prompt)

    def test_flag_off_prompt_bytes_match_prechange_commit_and_fresh_ignores_flag(self):
        # Captured from 9e1051e3 before this implementation, using the same synthetic inputs.
        snapshot = {'frontend/public/app.js': b'function oldFeature() { return 1; }\n' * 200,
                    'frontend/package.json': b'{"scripts":{"build":"node build.js"}}\n',
                    'backend/package.json': b'{"scripts":{"start":"node server.js"}}\n', 'asset.bin': b'\xff\x00'}
        golden = {'fresh': '7ada350d5303ebc4fc68cf52b73a90bfc22cda7913728e353aabf722da480e8a',
                  'upgrade': '2cee3ae1d93b4fe8ac4560eaf6a32f7a62a1376d844fa36b034392d19128ba44',
                  'scaffold': 'fd2f4f529f6a06f2175d9bba105846bf09462c3f7c0d8ea10a1d875403bfb451'}
        for mode, digest in golden.items():
            for flag in (False, True) if mode != 'upgrade' else (False,):
                with patch.object(adapter, 'UPGRADE_PATCH', flag):
                    messages = adapter.draft_messages('Extend the synthetic app without changing existing behavior.',
                        scaffold={'a.js': b'const a = 1;\n'} if mode == 'scaffold' else None,
                        snapshot=snapshot if mode == 'upgrade' else None, prerequisites='Synthetic prerequisite')
                self.assertEqual(hashlib.sha256(json.dumps(messages, ensure_ascii=False).encode()).hexdigest(), digest)

    def test_flag_off_retains_large_file_rewrite_continuation_and_output_bytes(self):
        self.seed()
        replacement = '// whole replacement\n' * 300
        cut = '=== FILE: large.js ===\npartial'
        self.replies(events(cut, finish='length'), events(block('large.js', replacement)))
        with patch.object(adapter, 'UPGRADE_PATCH', False), patch.object(protocol, 'draft') as opted_in:
            _, summary = adapter.generate('Synthetic requirements', 'synthetic-model', 'https://synthetic.invalid',
                                          SYNTHETIC_KEY, self.out, template=self.out)
        opted_in.assert_not_called()
        self.assertNotIn('upgrade_patch', summary)
        self.assertEqual((self.out / 'large.js').read_bytes(), (replacement.rstrip('\n') + '\n').encode())
        request = json.loads(self.transport.call_args.args[0].data)
        self.assertEqual(request['messages'][-1]['content'], adapter.CONTINUE.format(path='large.js'))
        # Full HTTP payload bytes, including the continuation conversation, captured from 9e1051e3.
        self.assertEqual([hashlib.sha256(c.args[0].data).hexdigest() for c in self.transport.call_args_list],
                         ['0ce328548db45ff0345b21f0c79a7e80ca5c7bbcbdeb74bb9d51134d6c3f3a46',
                          'ef10bcd861e8a61082931acf533af8414006db01d809bb4cb667965198164b76'])


if __name__ == '__main__':
    unittest.main()
