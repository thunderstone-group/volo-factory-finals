"""Synthetic requirement extraction and counterexamples to inferred product contracts; no model calls."""
import unittest

from oneshot import main as adapter


class SemanticContractsCase(unittest.TestCase):
    def test_record_entry_actions_disclosures_and_pressed_transitions_are_requirement_derived(self):
        text = '''
- id: CREATE
  type: ATOMIC
  description: A form named `Create collection` contains a control named `Attributes` that reveals a textbox with exact placeholder `key, value`. Seed data: collection "Collection A".
  steps:
    - keyword: GIVEN
      content: The user is on the collection details page.
    - keyword: WHEN
      content: The user activates the unique button named `New Collection` and fills the form.
- id: EDIT
  description: The form named `Edit collection` contains an `Attributes` control with a `key, value` textbox.
- id: TOGGLE
  description: A button named `Watch` with aria-pressed=false. Activating it changes the same control to name `Unwatch` with aria-pressed=true. Seed data: collection "Collection B".
- id: PRIVATE
  description: Authenticated users see a button named `Save` with aria-pressed=false. Activating it changes the same control to name `Unsave` with aria-pressed=true. Seed data: collection "Private".
'''
        result = adapter.semantic_contracts(text)
        self.assertEqual(result['recordActions'], [{'record':'Collection A','action':'New Collection'}])
        self.assertEqual(result['pressedTransitions'], [{'record':'Collection B','before':'Watch','after':'Unwatch'}])
        self.assertEqual(result['formReveals'], [
            {'form':'Create collection','control':'Attributes','placeholder':'key, value','record':'Collection A','entryAction':'New Collection'},
            {'form':'Edit collection','control':'Attributes','placeholder':'key, value'},
        ])

    def test_draft_and_toggle_words_do_not_invent_a_workflow_or_seed_absence(self):
        text = '''
description: A reading page has a button named `Edit`.
description: The button named `Favorite` with aria-pressed=false changes state.
description: Seed data: book "Collection" with existing draft page "Unfinished".
content: GIVEN a favorite item is already shown.
'''
        result = adapter.semantic_contracts(text)
        self.assertNotIn('readingEntries', result)
        self.assertNotIn('emptyFavorites', result)
        self.assertEqual(result['roles']['favorite'], ['button'])

    def test_record_state_title_is_distinct_from_an_input_title_field(self):
        result = adapter.semantic_contracts('''
description: The flagged article exposes a title attribute `Flagged`.
content: The article has title `Flagged`.
description: The editor contains a textbox named `Title`.
''')
        self.assertEqual(result['recordTitles'], ['Flagged'])

    def test_seed_adjectives_do_not_prescribe_internal_storage_fields(self):
        text = '''
description: Seed data: active record "Archive candidate"; pinned record "Priority"; regular record "Ordinary".
content: GIVEN the record "Archive candidate" has already been archived.
description: Seed data: deletable item `Remove candidate`.
content: THEN the item `Remove candidate` is deleted.
'''
        self.assertNotIn('seedStates', adapter.semantic_contracts(text))

    def test_entry_roles_and_editor_scope_come_from_requirement_text(self):
        # Reduced requirement wording; names deliberately differ from the corpus.
        text = '''
- id: START
  type: ATOMIC
  description: A region named `Workspace` and a button named "New item".
  content: The user opens the application entry URL.
- id: EDIT
  type: ATOMIC
  description: Clicking an article opens a dialog named `Item editor`.
  content: A button named `Tag` and a checkbox named `Tag`.
'''
        result = adapter.semantic_contracts(text)
        self.assertEqual(result['home'], [('button', 'New item'), ('region', 'Workspace')])
        self.assertEqual(result['recordEditors'], ['Item editor'])
        self.assertEqual(result['roles']['tag'], ['button', 'checkbox'])

    def test_conditional_dashboard_is_not_an_initial_page_contract(self):
        result = adapter.semantic_contracts('''
description: Display the `Recent items` list on the homepage.
description: Authenticated users see the `Private items` list on the homepage.
- id: LOGIN
  type: ATOMIC
  description: A button named `Login`.
  content: The user is on the login page.
''')
        self.assertEqual(result['homeLists'], ['Recent items'])
        self.assertEqual(result['home'], [])

    def test_authenticated_home_scenarios_do_not_override_an_explicit_public_list(self):
        result = adapter.semantic_contracts('''
- id: LISTS
  description: Display the `Recent visits` list on the homepage.
- id: PRIVATE
  content: The authenticated homepage shows `Recent visits` and `Updated items`.
- id: PUBLIC
  content: The homepage shows `Updated items` with at least one item.
''')
        self.assertEqual(result['homeLists'], ['Updated items'])

    def test_semantic_observations_are_not_whole_app_crashes(self):
        self.assertFalse(adapter._fatal('Requirement-derived UI observation: Missing editor role'))
        self.assertFalse(adapter._fatal('browser interaction error: Missing record'))
        self.assertTrue(adapter._fatal('frontend script error on load: undefined'))


if __name__ == '__main__':
    unittest.main()
