"""The overlay lifecycle, and the two rules narrowed on 2026-09-15.

Every page here is a hand-written synthetic fixture under tests/fixtures/. None of
them is a generated application and none of them implements a requirement; they exist
so a rule can be shown to fire on the defect it names and to stay silent on the shapes
it must accept.

The browser tests need an installed Playwright and Chromium, exactly as
tests/test_state_contract.py does, and skip without them. The rest are pure functions
over a contract and run everywhere.
"""
import json
import unittest

from volo import contract as state_contract
from volo import state_runtime
from volo import web_runtime
from test_state_contract import SYNTHETIC_RESPONSE, InterfaceCheckCase


class DeclaredActionTests(unittest.TestCase):
    """Which generic actions a contract declares, for the container rule."""

    def contract(self, **overrides):
        value = json.loads(SYNTHETIC_RESPONSE)
        value.update(overrides)
        return state_contract.normalize(value)

    def test_a_contract_that_names_no_generic_action_declares_none(self):
        # The synthetic ledger has no archive, pin, colour, label or delete action, so
        # the container rule has nothing to check and reports nothing.
        self.assertEqual(state_runtime.declared_actions(self.contract()), [])

    def test_prose_in_the_contract_declares_the_actions_it_names(self):
        contract = self.contract(conventions=[
            'A removed entry is archived rather than deleted.',
            'An entry can be pinned to the top of the ledger.'])
        self.assertEqual(state_runtime.declared_actions(contract),
                         ['archive', 'delete', 'pin'])

    def test_requirement_text_declares_the_row_menu_the_contract_cannot_see(self):
        # "More options" is never a quoted literal, so it never reaches exact_texts.
        # The contract alone cannot declare the menu; the requirement prose can.
        contract = self.contract()
        self.assertNotIn('menu', state_runtime.declared_actions(contract))
        self.assertIn('menu', state_runtime.declared_actions(
            contract, None, 'Hover the entry, open More options, and choose Remove.'))

    def test_a_schema_word_is_not_a_declaration(self):
        # Every sidebar entry the contract describes carries control: "menuitem", and a
        # scan that read it declared a row menu in every application with a sidebar.
        contract = self.contract(navigation=[
            {'name': 'Preferences', 'from': 'ledger page', 'screen': 'preferences',
             'control': 'menuitem'}])
        self.assertNotIn('menu', state_runtime.declared_actions(contract))

    def test_an_identifier_convention_is_not_a_row_menu(self):
        # "Entry identifiers are kebab-case strings" declared a kebab menu.
        contract = self.contract(conventions=['Entry identifiers are kebab-case strings.'])
        self.assertNotIn('menu', state_runtime.declared_actions(contract))

    def test_the_vocabulary_module_carries_the_declared_actions(self):
        contract = self.contract(conventions=['An entry can be archived from its row.'])
        source = state_runtime.vocabulary_module(contract)
        self.assertIn('const actions = ["archive"]', source)
        self.assertIn('module.exports = {terms, titles, actions, matches};', source)


class OverlayModuleTests(unittest.TestCase):
    """The harness-owned module itself, and how it reaches the application."""

    def test_the_build_emits_the_overlay_where_the_page_loads_it(self):
        # It is not shipped in frontend/public: creating that directory would let a
        # batch that writes no index.html build successfully and then wait out the
        # readiness poll instead of failing at once.
        self.assertIn("fs.writeFileSync('dist/factory/overlay.js'", web_runtime.BUILD)
        self.assertIn(json.dumps(web_runtime.OVERLAY), web_runtime.BUILD)
        self.assertEqual(web_runtime.OVERLAY_URL, '/factory/overlay.js')

    def test_the_scaffold_does_not_create_the_public_directory(self):
        paths = []

        class Recorder:
            def write_files(self, files):
                paths.extend(item['path'] for item in files)

        web_runtime.scaffold(Recorder())
        self.assertFalse([path for path in paths if path.startswith('frontend/public')])

    def test_the_overlay_path_is_harness_owned_and_summarised(self):
        self.assertIn(web_runtime.OVERLAY_PATH, state_runtime.HARNESS_OWNED)
        self.assertIn(web_runtime.OVERLAY_PATH, state_runtime.HARNESS_SUMMARY)

    def test_the_module_exposes_the_open_sequence_and_the_cleanup(self):
        source = web_runtime.OVERLAY
        for symbol in ('openOverlay', 'closeOverlay', 'isCurrent', 'sequence',
                       'hideOutside', 'showOutside', 'MutationObserver'):
            self.assertIn(symbol, source)

    def test_the_instructions_name_the_module_and_the_script_tag(self):
        rules = state_runtime.INTERFACE_RULES
        self.assertIn('<script src="/factory/overlay.js"></script>', rules)
        self.assertIn('handle.isCurrent()', rules)
        self.assertIn(web_runtime.OVERLAY_PATH, state_runtime.STORE_CONTRACT)


class RuleTextConsistencyTests(unittest.TestCase):
    """One policy for a hover-revealed row action, in the prompt and in every message."""

    def test_no_message_asks_for_the_row_title_in_a_hover_revealed_name(self):
        # The failure feedback used to demand the row title in the name and, four
        # hundred lines later, demand the verb alone without it.
        for source in (state_runtime.INTERFACE_CHECK, state_runtime.INTERFACE_RULES):
            self.assertNotIn('keep the row title in the name', source)

    def test_both_messages_prescribe_the_bare_verb_on_a_hover_revealed_action(self):
        for source in (state_runtime.INTERFACE_CHECK, state_runtime.INTERFACE_RULES):
            self.assertIn('verb alone', source)
        self.assertIn('never "Archive for <title>"', state_runtime.INTERFACE_CHECK)
        self.assertIn('not "Archive for <title>"', state_runtime.INTERFACE_RULES)

    def test_the_rules_allow_a_row_scoped_name_where_the_action_is_always_visible(self):
        self.assertIn('A row-scoped name is not forbidden in itself',
                      state_runtime.INTERFACE_RULES)

    def test_the_inertness_rule_speaks_of_dialogs_and_exempts_inline_pickers(self):
        rules = state_runtime.INTERFACE_RULES
        self.assertIn('While a dialog is open', rules)
        self.assertIn('must not make the page inert', rules)
        self.assertIn("if (chooser.role !== 'dialog' && !chooser.modal) continue;",
                      state_runtime.INTERFACE_CHECK)

    def test_the_container_rule_speaks_of_the_actions_the_requirements_ask_for(self):
        self.assertIn('Every action your requirements actually ask for',
                      state_runtime.INTERFACE_RULES)
        self.assertIn('vocabulary.actions', state_runtime.INTERFACE_CHECK)


class OverlayLifecycleCheckTests(InterfaceCheckCase):
    """The same machinery as InterfaceCheckTests, against the overlay fixtures."""

    def test_an_overlay_superseded_before_its_request_resolves_fails(self):
        # The run-5 defect on a synthetic page: two rapid opens leave two dialogs of the
        # same name stacked, and the page cannot be driven out of them.
        self.build_fixture('synthetic-overlay-race.html')
        output = self.failure(self.run_check())
        self.assertIn('An overlay left the page in a state it cannot be driven out of', output)
        self.assertIn('Preferences', output)
        self.assertIn('/factory/overlay.js', output)

    def test_the_same_page_rewritten_on_the_overlay_module_passes(self):
        result = self.build_fixture('synthetic-overlay-module.html') and self.run_check()
        self.assertTrue(result['passed'], str((result['steps'] or [{}])[-1].get('output', '')))

    def test_an_inline_non_modal_palette_does_not_owe_the_page_inertness(self):
        # A role="group" picker that leaves a search box visible beside it used to fail
        # the inertness rule. Only a dialog owns the page.
        self.build_fixture('synthetic-inline-palette.html')
        result = self.run_check()
        self.assertTrue(result['passed'], str((result['steps'] or [{}])[-1].get('output', '')))

    def test_a_hover_revealed_action_named_by_its_bare_verb_passes(self):
        self.build_fixture('synthetic-row-actions-bare-verb.html',
                           declares='An entry can be archived from its own row.')
        result = self.run_check()
        self.assertTrue(result['passed'], str((result['steps'] or [{}])[-1].get('output', '')))

    def test_a_row_scoped_name_on_an_always_visible_action_passes(self):
        self.build_fixture('synthetic-row-actions-row-scoped.html',
                           declares='An entry can be archived from its own row.')
        result = self.run_check()
        self.assertTrue(result['passed'], str((result['steps'] or [{}])[-1].get('output', '')))

    def test_a_verb_no_requirement_declares_is_not_a_finding(self):
        self.build_fixture('synthetic-stray-verb-undeclared.html',
                           declares='An entry can be archived from its own row.')
        result = self.run_check()
        self.assertTrue(result['passed'], str((result['steps'] or [{}])[-1].get('output', '')))

    def test_the_same_page_fails_once_the_requirements_declare_that_action(self):
        # The discriminator is the requirement text and nothing else: the page is byte
        # for byte the one above, and the banner's "Pin" is now a defect because a
        # requirement attaches pinning to the row.
        self.build_fixture('synthetic-stray-verb-undeclared.html',
                           declares='An entry can be archived and pinned from its own row.')
        output = self.failure(self.run_check())
        self.assertIn('resolves only outside the row or composer', output)
        self.assertIn('"verb":"pin"', output.replace(' ', ''))


if __name__ == '__main__':
    unittest.main()
