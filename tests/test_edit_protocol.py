"""Anchored edit protocol and harness-prepared checks; not model-quality evidence."""
import json
import unittest

from volo.agent import (Agent, BUILD_APP, PREPARED_CHECK_COMMAND, PREPARED_CHECK_PATH,
                        EDIT, PREPARED_EDIT_SYSTEM, SMALL_SYSTEM, apply_edit, apply_edits, patch_tool)
from volo.model import Model
from volo.requirements import RequirementSet
from volo.trace import Runtime
from volo.web_runtime import prepared_assertions, prepared_check, scaffold
from test_core import FakeGateway, TempCase, response


SOURCE = "<body>\n  <button id=\"inc\">Increment</button>\n  <script>\n    let count = 0;\n  </script>\n</body>\n"


class AnchoredEditTests(unittest.TestCase):
    def test_exact_unique_anchor_is_replaced_once(self):
        self.assertEqual(apply_edit(SOURCE, {'path': 'x', 'old': 'let count = 0;', 'new': 'let count = 1;'}),
                         SOURCE.replace('let count = 0;', 'let count = 1;'))

    def test_missing_anchor_is_rejected_without_changing_text(self):
        # The rejection says where the anchor stops matching and what the file holds there,
        # so the next call does not have to guess. See docs/repair-loop-autopsy-2026-09-14.md.
        with self.assertRaises(ValueError) as rejected:
            apply_edit(SOURCE, {'path': 'x', 'old': 'let total = 0;', 'new': 'let total = 1;'})
        message = str(rejected.exception)
        self.assertIn('old text did not apply', message)
        self.assertIn('is not present', message)
        self.assertIn('characters match', message)
        self.assertIn('<<<HERE>>>', message)

    def test_repeated_anchor_is_rejected_and_names_its_count(self):
        text = 'a\nvalue\nb\nvalue\n'
        with self.assertRaisesRegex(ValueError, 'occurs 2 times'):
            apply_edit(text, {'path': 'x', 'old': 'value', 'new': 'other'})

    def test_insert_after_adds_text_without_repeating_the_anchor(self):
        item = {'path': 'x', 'insert_after': '<button id="inc">Increment</button>',
                'new': '\n  <button id="reset">Reset</button>'}
        result = apply_edit(SOURCE, item)
        self.assertIn('Increment</button>\n  <button id="reset">Reset</button>\n  <script>', result)
        self.assertEqual(result.count('Increment'), 1)

    def test_insert_after_rejects_a_missing_or_repeated_anchor(self):
        # The rejection names the anchor field, and shows the file rather than the anchor.
        with self.assertRaisesRegex(ValueError, 'insert_after text did not apply'):
            apply_edit(SOURCE, {'path': 'x', 'insert_after': 'absent', 'new': 'y'})
        missing = None
        try:
            apply_edit(SOURCE, {'path': 'x', 'insert_after': 'absent', 'new': 'y'}, 'app.html')
        except ValueError as exc:
            missing = str(exc)
        self.assertIn('is not present in app.html', missing)
        self.assertIn('<<<HERE>>>', missing)
        with self.assertRaisesRegex(ValueError, 'occurs 2 times'):
            apply_edit('m\nm\n', {'path': 'x', 'insert_after': 'm', 'new': 'y'})

    def test_a_span_anchor_is_not_offered(self):
        # `until` let one local run rewrite everything from a short anchor to
        # </html>; a destructive span must cost as much text as it destroys.
        self.assertNotIn('until', EDIT['properties'])
        self.assertEqual(sorted(EDIT['properties']), ['insert_after', 'new', 'old', 'path'])

    def test_only_an_empty_file_takes_new_without_an_anchor(self):
        self.assertEqual(apply_edit('', {'path': 'x', 'new': 'created\n'}), 'created\n')
        # Treating an anchorless edit to a non-empty file as an append was measured
        # worse: an omitted anchor appended a whole replacement file.
        with self.assertRaisesRegex(ValueError, 'exactly one of insert_after or old'):
            apply_edit('a\n', {'path': 'x', 'new': 'b\n'})

    def test_one_anchor_kind_is_required(self):
        with self.assertRaisesRegex(ValueError, 'exactly one of insert_after or old'):
            apply_edit(SOURCE, {'path': 'x', 'old': '<script>', 'insert_after': '</script>', 'new': 'y'})
        with self.assertRaisesRegex(ValueError, 'inserted or replacing text in new'):
            apply_edit(SOURCE, {'path': 'x', 'old': '<script>'})
        with self.assertRaisesRegex(ValueError, 'nonempty strings'):
            apply_edit(SOURCE, {'path': 'x', 'old': '', 'new': 'y'})

    def test_several_edits_to_one_file_compose_in_order(self):
        current = SOURCE
        for item in ({'path': 'x', 'insert_after': '<body>', 'new': '\n  <h1>Counter</h1>'},
                     {'path': 'x', 'old': 'let count = 0;', 'new': 'let count = 0; // start'}):
            current = apply_edit(current, item)
        self.assertIn('<h1>Counter</h1>', current)
        self.assertIn('// start', current)


class MultipleEditTests(unittest.TestCase):
    def test_every_anchor_resolves_against_the_text_the_model_was_shown(self):
        items = [{'path': 'x', 'old': '<button id="inc">Increment</button>',
                  'new': '<button id="inc">Increment</button>\n  <button id="reset">Reset</button>'},
                 {'path': 'x', 'insert_after': 'let count = 0;', 'new': '\n    reset();'}]
        result = apply_edits(SOURCE, items)
        self.assertIn('<button id="reset">Reset</button>', result)
        self.assertIn('let count = 0;\n    reset();', result)

    def test_overlapping_edits_are_refused_before_anything_is_written(self):
        items = [{'path': 'x', 'old': 'let count = 0;', 'new': 'let count = 1;'},
                 {'path': 'x', 'old': 'count = 0', 'new': 'count = 2'}]
        with self.assertRaisesRegex(ValueError, 'overlap'):
            apply_edits(SOURCE, items)

    def test_edits_apply_in_file_order_not_call_order(self):
        items = [{'path': 'x', 'insert_after': '</script>', 'new': '\n  <!-- last -->'},
                 {'path': 'x', 'insert_after': '<body>', 'new': '\n  <!-- first -->'}]
        result = apply_edits(SOURCE, items)
        self.assertLess(result.index('<!-- first -->'), result.index('<!-- last -->'))


class PreparedCheckDerivationTests(unittest.TestCase):
    def test_quoted_test_ids_and_button_names_become_assertions(self):
        text = ('The home page displays the current count, initially 0, and buttons named "Increment" '
                'and "Decrement". The count display has the test id "count".')
        lines = prepared_assertions(text)
        self.assertEqual(len(lines), 4)
        self.assertIn('page.getByTestId("count").first().waitFor({state:"attached"})', lines[0])
        self.assertIn('page.getByTestId("count").count(),1', lines[1])
        self.assertIn('page.getByRole("button",{name:"Increment"}).waitFor({state:"visible"})', lines[2])
        self.assertIn('{name:"Decrement"}', lines[3])
        self.assertNotIn('exact:true', '\n'.join(lines))

    def test_repeated_names_are_asserted_once_and_unknown_phrasing_is_ignored(self):
        text = 'A button named "Roll" with the test id "dice-value". The button named "Roll" is visible.'
        self.assertEqual(len(prepared_assertions(text)), 3)
        self.assertEqual(prepared_assertions('The page lists recent orders.'), [])

    def test_a_derivation_without_literals_still_executes_a_real_page_check(self):
        source = prepared_check('The page lists recent orders.')
        self.assertIn("require('./browser.cjs')", source)
        self.assertIn('page.locator("body").count()', source)

    def test_derived_source_is_valid_javascript_with_escaped_names(self):
        source = prepared_check('A button named "Say \\"hi\\"" with the test id "a\'b".')
        self.assertIn('a\'b', json.dumps(source))
        for line in source.splitlines()[2:-1]:
            self.assertTrue(line.startswith(('  assert.', '  await ')), line)


class PreparedModeTests(TempCase):
    def small_agent(self, **kwargs):
        agent = Agent(RequirementSet.load(self.req), None, self.workspace, None, **kwargs)
        agent.prepared_checks = True
        return agent

    def test_prepared_mode_keeps_authored_behavior_and_drops_the_check_command(self):
        # The harness prepares interface assertions; behavior stays the model's work.
        self.assertIn('checks_js', BUILD_APP['function']['parameters']['required'])
        patch = patch_tool(True)['function']['parameters']
        self.assertEqual(patch['required'], ['edits'])
        self.assertNotIn('check_command', patch['properties'])
        self.assertIn('check_command', patch_tool(False)['function']['parameters']['required'])
        # The one-shot build prompt keeps its own rules: a local ablation showed that
        # telling it test ids are checked elsewhere made it stop rendering them.
        self.assertIn('checks_js', SMALL_SYSTEM)
        self.assertIn('harness-owned', PREPARED_EDIT_SYSTEM)
        self.assertNotIn('check_command is argv', PREPARED_EDIT_SYSTEM)
        self.assertEqual(PREPARED_CHECK_COMMAND, ['node', '--test', 'checks/prepared.cjs', 'checks/requirements.cjs'])

    def test_prepared_snapshot_hides_harness_owned_checks(self):
        scaffold(self.workspace)
        self.workspace.write_files([{'path': 'frontend/public/index.html', 'content': '<h1>Product</h1>'},
                                    {'path': PREPARED_CHECK_PATH, 'content': prepared_check('none')}])
        agent = self.small_agent()
        agent.inline_source = True
        payload = json.loads(agent.batch_request(agent.requirements.nodes))
        self.assertNotIn(PREPARED_CHECK_PATH, payload['source'])
        self.assertEqual(payload['harness_owned_prepared_checks'], [PREPARED_CHECK_PATH])
        self.assertIn('read-only', payload['runtime']['contract'])
        # With no prepared file on disk the snapshot has nothing to hide.
        (self.out / PREPARED_CHECK_PATH).unlink()
        plain = json.loads(agent.batch_request(agent.requirements.nodes))
        self.assertNotIn('harness_owned_prepared_checks', plain)
        self.assertIn('frontend/public/index.html', plain['source'])

    def test_edits_to_prepared_checks_are_reported_and_product_edits_still_apply(self):
        scaffold(self.workspace)
        self.workspace.write_files([{'path': 'frontend/public/index.html', 'content': '<h1>Product</h1>'},
                                    {'path': PREPARED_CHECK_PATH, 'content': prepared_check('none')}])
        agent = self.small_agent()
        self.workspace.write_files([{'path': 'checks/requirements.cjs', 'content': '// authored\n'}])
        result = agent.dispatch('patch_and_verify', {'edits': [
            {'path': 'frontend/public/index.html', 'insert_after': '<h1>Product</h1>', 'new': '<p>More</p>'},
            {'path': 'checks/requirements.cjs', 'insert_after': '// authored', 'new': '\n// added'},
            {'path': PREPARED_CHECK_PATH, 'old': 'body', 'new': 'html'}]})
        self.assertEqual(result['skipped_edits']['paths'], [PREPARED_CHECK_PATH])
        self.assertEqual((self.out / 'frontend/public/index.html').read_text(), '<h1>Product</h1><p>More</p>')
        self.assertEqual((self.out / PREPARED_CHECK_PATH).read_text(), prepared_check('none'))
        self.assertEqual((self.out / 'checks/requirements.cjs').read_text(), '// authored\n// added\n')
        self.assertEqual(result['check_command'], PREPARED_CHECK_COMMAND)

    def test_an_edit_batch_touching_only_prepared_checks_is_refused(self):
        scaffold(self.workspace)
        self.workspace.write_files([{'path': PREPARED_CHECK_PATH, 'content': prepared_check('none')}])
        agent = self.small_agent()
        with self.assertRaisesRegex(ValueError, 'harness-owned'):
            agent.dispatch('patch_and_verify', {'edits': [
                {'path': PREPARED_CHECK_PATH, 'old': 'body', 'new': 'html'}]})

    def test_one_shot_small_batch_prepares_its_own_interface_check(self):
        self.workspace.browser = {'available': True, 'module': '/synthetic/playwright'}
        answer = response([('build_app', {'index_html': '<h1>Greeting</h1>', 'checks_js': '//assertions'})])
        with FakeGateway([answer]) as gateway:
            agent = Agent(RequirementSet.load(self.req),
                          Model(gateway.url, 'synthetic-test-key', 'synthetic-model', self.trace),
                          self.workspace, Runtime(self.trace))
            with self.assertRaises(Exception):
                # Verification needs a real browser; the request contract is the subject here.
                agent.run()
        request = gateway.requests[0]
        self.assertEqual(request['messages'][0]['content'], SMALL_SYSTEM)
        self.assertEqual([tool['function']['name'] for tool in request['tools']], ['build_app'])
        self.assertTrue((self.out / PREPARED_CHECK_PATH).is_file())
        self.assertIn("require('./browser.cjs')", (self.out / PREPARED_CHECK_PATH).read_text())
        self.assertEqual(PREPARED_CHECK_PATH, 'checks/prepared.cjs')

    def test_compact_serialization_keeps_every_requirement_and_drops_empty_sections(self):
        requirements = RequirementSet.load(self.req)
        prompt = requirements.batch_prompt(requirements.nodes)
        self.assertNotIn('\n', prompt)
        payload = json.loads(prompt)
        self.assertEqual([node['id'] for node in payload['current_batch']], ['REQ-1'])
        self.assertEqual(payload['current_batch'][0]['description'], 'Serve a visible greeting over HTTP.')
        self.assertNotIn('inherited_constraints', payload)
        self.assertNotIn('reference_assets', payload)
        self.assertNotIn('all_requirements', payload)
        self.assertEqual(payload['application']['name'], 'Greeting')

    def test_a_partial_batch_keeps_the_full_requirement_index(self):
        (self.req / 'requirements.yaml').write_text(
            'id: ROOT\nname: Greeting\ntype: FOLDER\nchildren:\n'
            '  - id: REQ-1\n    name: One\n    type: ATOMIC\n    description: First.\n'
            '  - id: REQ-2\n    name: Two\n    type: ATOMIC\n    description: Second.\n')
        requirements = RequirementSet.load(self.req)
        payload = json.loads(requirements.batch_prompt(requirements.nodes[:1]))
        self.assertEqual([item['id'] for item in payload['all_requirements']], ['REQ-1', 'REQ-2'])


if __name__ == '__main__':
    unittest.main()
