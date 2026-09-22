"""Requirement extraction regressions from observed Lite failures; no model calls."""
import unittest

from oneshot import main as adapter


class SemanticContractsCase(unittest.TestCase):
    def test_draft_entry_checks_keep_parent_context_and_explicit_favorite_seeds(self):
        text = '''
description: A reading page has a button named `Edit`.
description: The button named `Favorite` with aria-pressed=false changes state.
description: Seed data: book "Collection" with existing draft page "Unfinished".
content: GIVEN a favorite item is already shown.
'''
        result = adapter.semantic_contracts(text)
        self.assertEqual(result['readingEntries'], [{'parent': 'Collection', 'record': 'Unfinished'}])
        self.assertTrue(result['emptyFavorites'])
        explicit = adapter.semantic_contracts(text + '\ndescription: Seed data: favorite book "Saved".\n')
        self.assertFalse(explicit['emptyFavorites'])

    def test_record_state_title_is_distinct_from_an_input_title_field(self):
        result = adapter.semantic_contracts('''
description: The flagged article exposes a title attribute `Flagged`.
content: The article has title `Flagged`.
description: The editor contains a textbox named `Title`.
''')
        self.assertEqual(result['recordTitles'], ['Flagged'])

    def test_seed_states_come_from_declarations_not_scenario_setup(self):
        text = '''
description: Seed data: active record "Archive candidate"; pinned record "Priority"; regular record "Ordinary".
content: GIVEN the record "Archive candidate" has already been archived.
description: Seed data: deletable item `Remove candidate`.
content: THEN the item `Remove candidate` is deleted.
'''
        states = {row['name']: row['states'] for row in adapter.semantic_contracts(text)['seedStates']}
        self.assertEqual(states['Archive candidate'], {'archived': False, 'deleted': False})
        self.assertEqual(states['Priority'], {'pinned': True})
        self.assertEqual(states['Ordinary'], {'archived': False, 'deleted': False, 'pinned': False})
        self.assertEqual(states['Remove candidate'], {'archived': False, 'deleted': False})

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

    def test_semantic_observations_are_not_whole_app_crashes(self):
        self.assertFalse(adapter._fatal('Requirement-derived UI observation: Missing editor role'))
        self.assertFalse(adapter._fatal('browser interaction error: Missing record'))
        self.assertTrue(adapter._fatal('frontend script error on load: undefined'))


if __name__ == '__main__':
    unittest.main()
