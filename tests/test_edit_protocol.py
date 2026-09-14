"""Anchored edit protocol and harness-prepared checks; not model-quality evidence."""
import json
import unittest

from volo.agent import (Agent, BUILD_APP, PREPARED_CHECK_COMMAND, PREPARED_CHECK_PATH,
                        PREPARED_EDIT_SYSTEM, SMALL_SYSTEM, apply_edit, patch_tool)
from volo.model import Model
from volo.requirements import RequirementSet
from volo.trace import Runtime
from volo.web_runtime import prepared_assertions, prepared_check, scaffold
from test_core import FakeGateway, TempCase, response


SOURCE = "<body>\n  <button id=\"inc\">Increment</button>\n  <script>\n    let count = 0;\n  </script>\n</body>\n"


class AnchoredEditTests(unittest.TestCase):
    def test_exact_unique_anchor_is_replaced_once(self):
        self.assertEqual(apply_edit(SOURCE, {'path': 'x', 'replace': 'let count = 0;', 'new': 'let count = 1;'}),
                         SOURCE.replace('let count = 0;', 'let count = 1;'))

    def test_missing_anchor_is_rejected_without_changing_text(self):
        with self.assertRaisesRegex(ValueError, 'exactly once but was not found'):
            apply_edit(SOURCE, {'path': 'x', 'replace': 'let total = 0;', 'new': 'let total = 1;'})

    def test_repeated_anchor_is_rejected_and_names_its_count(self):
        text = 'a\nvalue\nb\nvalue\n'
        with self.assertRaisesRegex(ValueError, 'occurs 2 times'):
            apply_edit(text, {'path': 'x', 'replace': 'value', 'new': 'other'})

    def test_insert_after_adds_text_without_repeating_the_anchor(self):
        item = {'path': 'x', 'insert_after': '<button id="inc">Increment</button>',
                'new': '\n  <button id="reset">Reset</button>'}
        result = apply_edit(SOURCE, item)
        self.assertIn('Increment</button>\n  <button id="reset">Reset</button>\n  <script>', result)
        self.assertEqual(result.count('Increment'), 1)

    def test_insert_after_rejects_a_missing_or_repeated_anchor(self):
        with self.assertRaisesRegex(ValueError, 'insert_after text must occur exactly once'):
            apply_edit(SOURCE, {'path': 'x', 'insert_after': 'absent', 'new': 'y'})
        with self.assertRaisesRegex(ValueError, 'occurs 2 times'):
            apply_edit('m\nm\n', {'path': 'x', 'insert_after': 'm', 'new': 'y'})

    def test_until_replaces_a_span_from_two_short_anchors(self):
        result = apply_edit(SOURCE, {'path': 'x', 'replace': '<script>', 'until': '</script>',
                                     'new': '<script>let count = 5;</script>'})
        self.assertIn('<script>let count = 5;</script>', result)
        self.assertNotIn('let count = 0;', result)
        self.assertIn('<button id="inc">Increment</button>', result)

    def test_until_must_follow_old_and_must_exist(self):
        with self.assertRaisesRegex(ValueError, 'until text must appear after replace text'):
            apply_edit(SOURCE, {'path': 'x', 'replace': '</script>', 'until': '<script>', 'new': 'z'})
        with self.assertRaisesRegex(ValueError, 'until text must occur exactly once but was not found'):
            apply_edit(SOURCE, {'path': 'x', 'replace': '<script>', 'until': '</style>', 'new': 'z'})

    def test_the_general_edit_tool_spelling_still_replaces(self):
        # `edit` remains old/new in the general tool menu; the same shape must not
        # cost a round trip when it arrives here.
        self.assertEqual(apply_edit(SOURCE, {'path': 'x', 'old': 'let count = 0;', 'new': 'let count = 2;'}),
                         SOURCE.replace('let count = 0;', 'let count = 2;'))
        with self.assertRaisesRegex(ValueError, 'exactly one of insert_after or replace'):
            apply_edit(SOURCE, {'path': 'x', 'old': '<script>', 'insert_after': '</script>', 'new': 'y'})

    def test_an_empty_file_takes_the_new_text_as_its_whole_content(self):
        self.assertEqual(apply_edit('', {'path': 'x', 'new': 'created\n'}), 'created\n')
        with self.assertRaisesRegex(ValueError, 'exactly one of insert_after or replace'):
            apply_edit('', {'path': 'x', 'until': 'z', 'new': 'created'})

    def test_one_anchor_kind_is_required(self):
        for item in ({'path': 'x', 'new': 'y'},
                     {'path': 'x', 'replace': '<script>', 'insert_after': '</script>', 'new': 'y'}):
            with self.assertRaisesRegex(ValueError, 'exactly one of insert_after or replace'):
                apply_edit(SOURCE, item)
        with self.assertRaisesRegex(ValueError, 'until applies to replace'):
            apply_edit(SOURCE, {'path': 'x', 'insert_after': '<script>', 'until': '</script>', 'new': 'y'})
        with self.assertRaisesRegex(ValueError, 'inserted or replacing text in new'):
            apply_edit(SOURCE, {'path': 'x', 'replace': '<script>'})
        with self.assertRaisesRegex(ValueError, 'nonempty strings'):
            apply_edit(SOURCE, {'path': 'x', 'replace': '', 'new': 'y'})

    def test_several_edits_to_one_file_compose_in_order(self):
        current = SOURCE
        for item in ({'path': 'x', 'insert_after': '<body>', 'new': '\n  <h1>Counter</h1>'},
                     {'path': 'x', 'replace': 'let count = 0;', 'new': 'let count = 0; // start'}):
            current = apply_edit(current, item)
        self.assertIn('<h1>Counter</h1>', current)
        self.assertIn('// start', current)


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
        self.assertIn('already asserts', PREPARED_EDIT_SYSTEM)
        self.assertIn('harness-owned', PREPARED_EDIT_SYSTEM)
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
        agent.prepared_checks = False
        self.assertIn(PREPARED_CHECK_PATH, json.loads(agent.batch_request(agent.requirements.nodes))['source'])

    def test_edits_to_prepared_checks_are_reported_and_product_edits_still_apply(self):
        scaffold(self.workspace)
        self.workspace.write_files([{'path': 'frontend/public/index.html', 'content': '<h1>Product</h1>'},
                                    {'path': PREPARED_CHECK_PATH, 'content': prepared_check('none')}])
        agent = self.small_agent()
        self.workspace.write_files([{'path': 'checks/requirements.cjs', 'content': '// authored\n'}])
        result = agent.dispatch('patch_and_verify', {'edits': [
            {'path': 'frontend/public/index.html', 'insert_after': '<h1>Product</h1>', 'new': '<p>More</p>'},
            {'path': 'checks/requirements.cjs', 'insert_after': '// authored', 'new': '\n// added'},
            {'path': PREPARED_CHECK_PATH, 'replace': 'body', 'new': 'html'}]})
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
                {'path': PREPARED_CHECK_PATH, 'replace': 'body', 'new': 'html'}]})

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
