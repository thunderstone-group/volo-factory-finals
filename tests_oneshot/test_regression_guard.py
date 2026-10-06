"""Synthetic deterministic fixtures, plus real Chromium when the supplied runtime is available."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import threading
import unittest
from unittest.mock import patch

from oneshot import main as adapter, regression_guard as guard
import test_oneshot as fixtures


def screen(items, steps=(), status='ok'):
    return {'steps': list(steps), 'status': status, 'url': '/',
            'items': [{'role': role, 'name': name} for role, name in items]}


def baseline(*screens):
    observed = {'screens': list(screens)}
    return guard.stable(observed, observed)


def state(regression=None, **statuses):
    result = {'fatal': [], 'static': {}, 'browser': [], 'smoke': [], 'vocab': [], 'missing': 0,
              'executed': True, 'report': {'kind': 'testgen', 'scenarios': [
                  {'id': k, 'name': k, 'status': v} for k, v in statuses.items()]}}
    if regression is not None:
        result['regression'] = regression
    return result


class DiffTests(unittest.TestCase):
    def test_stability_requires_same_path_role_and_name_in_both_passes(self):
        a = {'screens': [screen([('button', 'Stable'), ('heading', 'Clock 1')])]}
        b = {'screens': [screen([('button', 'Stable'), ('heading', 'Clock 2')])]}
        result = guard.stable(a, b)
        self.assertEqual(result['items'], 1)
        self.assertEqual(result['screens'][0]['items'][0]['name'], 'Stable')
        self.assertEqual(guard.stable(a, {'screens': []})['items'], 0)

    def test_missing_finding_has_precise_original_path(self):
        steps = [{'role': 'link', 'name': 'Library', 'kind': 'url', 'href': '/library'}]
        b = baseline(screen([('link', 'Manual')], steps))
        r = guard.compare(b, {'screens': [screen([], steps, 'missing-path')]})
        self.assertEqual(len(r['missing']), 1)
        self.assertIn("link 'Manual' reached by link 'Library'", r['missing'][0]['observation'])

    def test_additions_never_become_findings(self):
        b = baseline(screen([('button', 'Open')]))
        r = guard.compare(b, {'screens': [screen([('button', 'Open'), ('region', 'New')])]})
        self.assertEqual(r['missing'], [])
        self.assertEqual(len(r['kept']), 1)

    def test_unvisited_or_failed_executor_is_unknown_not_missing(self):
        b = baseline(screen([('link', 'Open')]))
        for observed in ({'screens': []}, {'unavailable': 'No runtime'},
                         {'screens': [screen([], status='unobserved')]}):
            r = guard.compare(b, observed)
            self.assertEqual(r['missing'], [])
            self.assertEqual(len(r['unknown']), 1)

    def test_broken_route_is_a_loss(self):
        r = guard.compare(baseline(screen([('heading', 'Library')])),
                          {'screens': [screen([], status='navigation-error')]})
        self.assertEqual(len(r['missing']), 1)

    def test_navigation_can_change_between_link_and_button(self):
        b = baseline(screen([('link', 'Library'), ('heading', 'Catalog')]))
        r = guard.compare(b, {'screens': [screen([('button', 'Library'), ('button', 'Catalog')])]})
        self.assertEqual(r['missing'], [])

    def test_a_control_replaced_with_plain_heading_is_still_a_loss(self):
        b = baseline(screen([('button', 'Open')]))
        r = guard.compare(b, {'screens': [screen([('heading', 'Open')])]})
        self.assertEqual(len(r['missing']), 1)

    def test_requirement_named_replacement_needs_identity_evidence(self):
        old = {'role': 'form', 'name': 'Item search form'}
        current = [{'role': 'form', 'name': 'Item search'}]
        text = 'id: E\nchange_type: CHANGE\ndescription: Use the form named "Item search".\n'
        self.assertIsNotNone(guard.replacement_exemption(old, current, text, guard.exemptions(text)))
        self.assertIsNone(guard.replacement_exemption({'role': 'form', 'name': 'Open account'}, current,
                                                     text, guard.exemptions(text)))

    def test_fixed_calendar_change_requires_new_date_controls_and_static_basis(self):
        text = 'id: E\nchange_type: CHANGE\ndescription: The calendar uses the fixed benchmark date 2030-10-01.\n'
        changes = guard.exemptions(text)
        current = [{'role': 'button', 'name': 'Oct 1 Tue'}, {'role': 'button', 'name': 'Oct 2 Wed'}]
        self.assertEqual(guard.replacement_exemption({'role': 'button', 'name': 'Oct 6 Tue'}, current, text, changes)['rule'], 'date_basis')
        self.assertIsNone(guard.replacement_exemption({'role': 'button', 'name': 'Oct 6 Tue'}, [], text, changes))
        self.assertIsNone(guard.replacement_exemption({'role': 'button', 'name': 'Item 6'}, current, text, changes))
        self.assertIsNone(guard.replacement_exemption({'role': 'button', 'name': 'Monthly report'}, current, text, changes))
        self.assertIsNone(guard.replacement_exemption({'role': 'button', 'name': 'March 3 report'}, current, text, changes))

    def test_change_mentions_do_not_exempt_items_or_descendants(self):
        steps = [{'role': 'link', 'name': 'Catalog'}]
        b = baseline(screen([('link', 'Manual'), ('button', 'Sort')], steps))
        b['screens'][0]['items'][0]['scopes'] = ['Files']
        text = '''id: ROOT
children:
- id: E
  change_type: CHANGE
  description: On Catalog, Sort opens a dialog; the Files region shows a new count.
  scenarios:
  - steps:
    - keyword: WHEN
      content: Open Catalog, activate Sort, and read Manual in Files.
'''
        r = guard.compare(b, {'screens': [screen([], steps)]}, text)
        self.assertEqual(len(r['missing']), 2)
        self.assertFalse(r['exempted'])
        self.assertEqual(sum(r['exemptions_by_rule'].values()), 0)

    def test_changed_named_container_does_not_exempt_its_descendants(self):
        changes = guard.exemptions('id: E\nchange_type: CHANGE\ndescription: Catalog filters now uses a form.\n')
        self.assertIsNone(guard.exemption({'role': 'button', 'name': 'Choice A', 'scopes': ['Filters']}, [], changes))

    def test_explicit_removed_container_exempts_its_descendants_only(self):
        text = 'id: E\nchange_type: CHANGE\ndescription: Remove the region "Legacy panel".\n'
        changes = guard.exemptions(text)
        self.assertEqual(guard.exemption({'role': 'button', 'name': 'Choice A', 'scopes': ['Legacy panel']}, [], changes)['rule'], 'explicit_container')
        self.assertIsNone(guard.exemption({'role': 'button', 'name': 'Choice A'}, [], changes))
        # A navigation control being removed does not remove the screen behind it.
        changes = guard.exemptions('id: E\ndescription: Remove the link "Legacy panel".\n')
        self.assertIsNone(guard.exemption({'role': 'heading', 'name': 'Contents'},
                                         [{'role': 'link', 'name': 'Legacy panel'}], changes))

    def test_explicit_renamed_container_never_exempts_descendants(self):
        text = 'id: E\ndescription: Rename the region "Catalog" to "Library".\n'
        changes = guard.exemptions(text)
        self.assertIsNone(guard.exemption({'role': 'button', 'name': 'Delete', 'scopes': ['Catalog']}, [], changes))

    def test_panel_replacement_does_not_treat_a_navigation_path_as_dom_ownership(self):
        changes = guard.exemptions('id: E\ndescription: Replace the region "Catalog" with "Library".\n')
        self.assertIsNone(guard.exemption({'role': 'link', 'name': 'Manual'},
                                         [{'role': 'link', 'name': 'Catalog'}], changes))

    def test_replaced_entry_screen_does_not_exempt_a_later_screen(self):
        changes = guard.exemptions('id: E\ndescription: Remove the screen "Catalog".\n')
        steps = [{'role': 'link', 'name': 'Catalog'}]
        item = {'role': 'link', 'name': 'Manual'}
        self.assertIsNotNone(guard.exemption(item, steps, changes))
        self.assertIsNone(guard.exemption(item, steps + [{'role': 'link', 'name': 'Details'}], changes))

    def test_explicit_rename_requires_its_actual_replacement(self):
        changes = guard.exemptions('id: E\ndescription: Rename the link "Catalog" to "Library".\n')
        old = {'role': 'link', 'name': 'Catalog', 'href': '/catalog'}
        right = [{'role': 'link', 'name': 'Library', 'href': '/catalog'}]
        wrong = [{'role': 'link', 'name': 'Something else', 'href': '/catalog'}]
        self.assertEqual(guard.exemption(old, [], changes, right)['rule'], 'explicit_item')
        self.assertIsNone(guard.exemption(old, [], changes, wrong))
        self.assertIsNone(guard.exemption(old, [], changes, []))
        self.assertIsNone(guard.exemption(old, [], changes, [{'role': 'textbox', 'name': 'Library', 'href': '/catalog'}]))

    def test_passive_rename_and_explicit_replacement_are_supported(self):
        text = 'id: E\ndescription: The "Catalog" link is renamed to "Library".\n'
        self.assertEqual(guard.exemption({'role': 'link', 'name': 'Catalog'}, [], guard.exemptions(text),
                                        [{'role': 'link', 'name': 'Library'}])['rule'], 'explicit_item')
        changes = guard.exemptions('id: E\ndescription: Replace the region "Legacy panel" with "Current panel".\n')
        self.assertEqual(guard.exemption({'role': 'button', 'name': 'Entry', 'scopes': ['Legacy panel']}, [], changes)['rule'],
                         'explicit_container')

    def test_hiding_one_item_and_counts_do_not_waive_a_sibling(self):
        b = baseline(screen([('button', 'Old'), ('button', 'Sibling')]))
        r = guard.compare(b, {'screens': [screen([])]}, 'id: E\ndescription: Hide the button "Old".\n')
        self.assertEqual([x['name'] for x in r['missing']], ['Sibling'])
        self.assertEqual(r['exemptions_by_rule']['explicit_item'], 1)
        self.assertEqual(sum(r['exemptions_by_rule'].values()), len(r['exempted']))

    def test_explicit_change_object_and_location_are_bound(self):
        changes = guard.exemptions('id: E\ndescription: Remove the button "Help" in the form "Settings".\n')
        self.assertIsNotNone(guard.exemption({'role': 'button', 'name': 'Help', 'scopes': ['Settings']}, [], changes))
        self.assertIsNone(guard.exemption({'role': 'button', 'name': 'Help', 'scopes': ['Profile']}, [], changes))
        self.assertIsNone(guard.exemption({'role': 'heading', 'name': 'Help', 'scopes': ['Settings']}, [], changes))

    def test_change_location_is_not_a_previous_navigation_step(self):
        changes = guard.exemptions('id: E\ndescription: Remove the button "Help" on the screen "Catalog".\n')
        item = {'role': 'button', 'name': 'Help'}
        steps = [{'role': 'link', 'name': 'Catalog'}]
        self.assertIsNotNone(guard.exemption(item, steps, changes))
        self.assertIsNone(guard.exemption(item, steps + [{'role': 'link', 'name': 'Details'}], changes))
        changes = guard.exemptions('id: E\ndescription: Remove the button "Help" in the form "Catalog".\n')
        self.assertIsNone(guard.exemption(item, steps, changes))

    def test_negation_action_names_and_user_actions_are_not_change_instructions(self):
        item = {'role': 'button', 'name': 'Filter'}
        for description in ['Do not remove "Filter".', 'The user removes "Filter".',
                            'Activate "Remove Filter".', 'The "Remove Filter" button opens a dialog.',
                            'Remove Filter button opens a dialog.', '"Filter" must not be removed.']:
            with self.subTest(description=description):
                changes = guard.exemptions('id: E\nchange_type: CHANGE\ndescription: ' + description + '\n')
                self.assertIsNone(guard.exemption(item, [], changes))

    def test_scenario_rename_action_and_bad_yaml_cannot_authorize_a_static_loss(self):
        b = baseline(screen([('button', 'Sort')]))
        for text in ['id: E\nchange_type: CHANGE\nscenarios:\n- steps:\n  - keyword: WHEN\n    content: Remove "Sort".\n',
                     'id: [malformed\n  Sort:']:
            self.assertEqual(len(guard.compare(b, {'screens': [screen([])]}, text)['missing']), 1)

    def test_unchanged_item_is_kept_even_when_a_requirement_names_its_replacement(self):
        b = baseline(screen([('link', 'Catalog')]))
        r = guard.compare(b, {'screens': [screen([('link', 'Catalog')])]},
                          'id: E\ndescription: Rename "Catalog" to "Library".\n')
        self.assertEqual(len(r['kept']), 1)
        self.assertFalse(r['exempted'])

    def test_description_contract_ignores_scenario_only_and_add_only_labels(self):
        old = {'role': 'form', 'name': 'Item search form'}
        peer = [{'role': 'form', 'name': 'Item search'}]
        for text in ['id: E\nchange_type: ADD\ndescription: Use the form named "Item search".\n',
                     'id: E\nchange_type: CHANGE\nscenarios:\n- steps:\n  - content: Use the form named "Item search".\n']:
            self.assertIsNone(guard.replacement_exemption(old, peer, text, guard.exemptions(text)))

    def test_replacement_cannot_borrow_an_existing_control_or_another_location(self):
        old = {'role': 'form', 'name': 'Item search form', 'scopes': ['Panel A']}
        peer = {'role': 'form', 'name': 'Item search', 'scopes': ['Panel A']}
        text = 'id: E\nchange_type: CHANGE\ndescription: Use the form named "Item search".\n'
        changes = guard.exemptions(text)
        self.assertIsNone(guard.replacement_exemption(old, [peer], text, changes, [peer]))
        self.assertIsNone(guard.replacement_exemption(old, [dict(peer, scopes=['Panel B'])], text, changes))
        for description in ['Use the form named "Item search" in the region "Panel B".',
                            'The region named "Panel B" has a form named "Item search".']:
            text = 'id: E\nchange_type: CHANGE\ndescription: ' + description + '\n'
            self.assertIsNone(guard.replacement_exemption(old, [peer], text, guard.exemptions(text)))

    def test_role_change_needs_a_description_contract_at_the_same_place(self):
        old = {'role': 'button', 'name': 'Visibility', 'scopes': ['Settings']}
        peer = [{'role': 'combobox', 'name': 'Visibility', 'scopes': ['Settings']}]
        text = 'id: E\nchange_type: CHANGE\ndescription: The region named "Settings" contains a combobox labelled "Visibility".\n'
        self.assertEqual(guard.replacement_exemption(old, peer, text, guard.exemptions(text))['rule'], 'description_contract')

    def test_choice_relocation_requires_an_observed_option_and_described_selector(self):
        text = 'id: E\nchange_type: ADD\ndescription: Choose the "Selection" combobox.\n'
        item = {'role': 'button', 'name': 'Choice A'}
        options = [{'role': 'combobox', 'name': 'Selection', 'choices': ['Choice A']}]
        self.assertEqual(guard.replacement_exemption(item, options, text, guard.exemptions(text))['rule'], 'selector_migration')
        self.assertIsNone(guard.replacement_exemption(item, [], text, guard.exemptions(text)))
        self.assertIsNone(guard.replacement_exemption(item, options, '', []))
        self.assertIsNone(guard.replacement_exemption(dict(item, scopes=['Another panel']), options, text,
                                                     guard.exemptions(text)))

    def test_wrapped_requirement_lists_are_supported(self):
        self.assertEqual(len(guard.exemptions('requirements:\n- id: E\n  change_type: CHANGE\n  description: Sort\n')), 1)


class JudgeTests(unittest.TestCase):
    def setUp(self):
        self.patch = patch.object(adapter, 'control_names', return_value=set())
        self.patch.start()
        self.addCleanup(self.patch.stop)
        self.b = baseline(screen([('link', 'Manual'), ('button', 'Open')]))
        self.full = guard.compare(self.b, {'screens': [screen([('link', 'Manual'), ('button', 'Open')])]})
        self.loss = guard.compare(self.b, {'screens': [screen([('button', 'Open')])]})

    def judge(self, before, after):
        with patch.object(adapter, 'check_scenarios', return_value=after['report']):
            return adapter.judge(before, after, Path('/unused'), '', set())

    def test_no_number_of_new_gains_buys_an_existing_loss(self):
        before = state(self.full, **{f'new{i}': 'fail' for i in range(30)})
        after = state(self.loss, **{f'new{i}': 'pass' for i in range(30)})
        accepted, reason, detail = self.judge(before, after)
        self.assertFalse(accepted)
        self.assertIn('lost preserved existing behavior', reason)
        self.assertEqual(len(detail['existing_lost']), 1)

    def test_restoring_only_existing_behavior_is_a_valid_gain(self):
        accepted, _, detail = self.judge(state(self.loss, new='pass'), state(self.full, new='pass'))
        self.assertTrue(accepted)
        self.assertEqual(len(detail['existing_gained']), 1)

    def test_swapping_one_old_loss_for_another_is_rejected(self):
        swapped = guard.compare(self.b, {'screens': [screen([('link', 'Manual')])]})
        self.assertFalse(self.judge(state(self.loss, new='pass'), state(swapped, new='pass'))[0])

    def test_unknown_after_keeps_last_checked_version(self):
        unknown = guard.compare(self.b, {'unavailable': 'runtime failure'})
        accepted, _, detail = self.judge(state(self.full, new='fail'), state(unknown, new='pass'))
        self.assertFalse(accepted)
        self.assertTrue(detail['checker'])

    def test_new_requirement_exemption_is_not_an_unknown_loss(self):
        waived = {**self.full, 'kept': self.full['kept'][1:],
                  'exempted': [{'id': self.full['kept'][0]}]}
        self.assertTrue(self.judge(state(self.full, new='fail'), state(waived, new='pass'))[0])

    def test_unavailable_baseline_does_not_disable_normal_acceptance(self):
        empty = guard.compare({'screens': []}, {'unavailable': 'runtime failure'})
        self.assertTrue(self.judge(state(empty, new='fail'), state(empty, new='pass'))[0])

    def test_guard_does_not_override_new_requirement_loss_rule(self):
        self.assertFalse(self.judge(state(self.loss, new='pass'), state(self.full, new='fail'))[0])

    def test_precise_findings_join_repair_request(self):
        ask = adapter.repair_request(state(self.loss, new='pass'))
        self.assertIn("link 'Manual' reached by open /", ask)
        self.assertIn('restore it unless a requirement changes it', ask)


class EvolutionIntegrationTests(unittest.TestCase):
    setUp = fixtures.OfflineCase.setUp
    enter = fixtures.OfflineCase.enter
    replies = fixtures.OfflineCase.replies

    def seed(self):
        for item in adapter.parse_blocks(fixtures.application())[0]:
            adapter.write_one(self.out, item)

    def test_flag_off_does_not_import_or_observe_and_keeps_model_calls(self):
        self.seed()
        self.replies(fixtures.events(fixtures.block('frontend/public/index.html', '<h1>Updated</h1>')))
        with patch.object(adapter, 'REGRESSION_GUARD', False), patch.object(adapter, '_regression_module') as mod:
            adapter.generate('Extend', 'm', 'https://synthetic.invalid', fixtures.SYNTHETIC_KEY, self.out, template=self.out)
        mod.assert_not_called()
        self.assertEqual(self.transport.call_count, 1)

    def test_baseline_overlaps_draft_and_uses_immutable_starting_source(self):
        self.seed()
        before = (self.out / 'frontend/public/index.html').read_text()
        started, drafted = threading.Event(), threading.Event()
        observed = []
        def observe(app, paths=None, **kwargs):
            if kwargs.get('passes') == 2:
                started.set()
                self.assertTrue(drafted.wait(5), 'baseline must not delay draft')
                observed.append((Path(app) / 'frontend/public/index.html').read_text())
                return baseline(screen([('heading', 'Original')]))
            return {'screens': [screen([('heading', 'Updated')])]}
        def draft(stage, files, messages, *args):
            self.assertTrue(started.wait(5))
            item = {'path': 'frontend/public/index.html', 'content': '<h1>Updated</h1>'}
            adapter.write_one(stage, item)
            files.append(item)
            drafted.set()
            return messages
        with patch.object(adapter, 'REGRESSION_GUARD', True), patch.object(adapter, 'TESTGEN', False), \
                patch.object(adapter, 'draft_application', side_effect=draft), patch.object(guard, 'observe', side_effect=observe), \
                patch.object(adapter, 'repair_delivery', side_effect=RuntimeError('synthetic checker failure')):
            budget = adapter.CallBudget()
            adapter.generate('Extend', 'm', 'b', '', self.out, budget=budget, template=self.out)
        self.assertEqual(observed, [before])
        self.assertIn('Updated', (self.out / 'frontend/public/index.html').read_text())
        self.assertEqual(len(budget.smoke['regression_guard']['observations'][0]['missing']), 1)

    def test_regression_only_failure_drives_repair_and_is_observed_afterwards(self):
        self.seed()
        b = baseline(screen([('heading', 'Original')]))
        missing = guard.compare(b, {'screens': [screen([])]})
        kept = guard.compare(b, {'screens': [screen([('heading', 'Original')])]})
        budget = adapter.CallBudget(repair_limit=1)
        budget.phase = 'repair'
        from unittest.mock import Mock
        budget.regression_guard = Mock(check=Mock(side_effect=[missing, kept]))
        with patch.object(adapter, 'assess', side_effect=lambda *a, **kw: state(new='pass')), \
                patch.object(adapter, 'control_names', return_value=set()), \
                patch.object(adapter, 'stream_completion', return_value=(fixtures.block('frontend/public/index.html',
                                                                                       '<h1>Original</h1>'), {}, 'stop')) as call:
            adapter.repair_delivery(self.out, [], [], 'm', 'b', '', budget, requirements='')
        self.assertEqual(call.call_count, 1)
        self.assertEqual(budget.regression_guard.check.call_count, 2)
        self.assertTrue(budget.smoke['rounds'][0]['accepted'])

    def test_rejected_regression_restores_the_best_available_application(self):
        self.seed()
        before = adapter.read_template(self.out)
        b = baseline(screen([('link', 'Manual')]))
        kept = guard.compare(b, {'screens': [screen([('link', 'Manual')])]})
        missing = guard.compare(b, {'screens': [screen([])]})
        budget = adapter.CallBudget(repair_limit=1)
        budget.phase = 'repair'
        from unittest.mock import Mock
        budget.regression_guard = Mock(check=Mock(side_effect=[kept, missing]))
        def complete(messages, model, base, key, budget, **kwargs):
            record = budget.start(messages, model)
            record.update(status='completed', usage={'prompt_tokens': 1, 'completion_tokens': 1})
            return fixtures.block('frontend/public/index.html', '<h1>Regressed</h1>'), {}, 'stop'
        with patch.object(adapter, 'assess', side_effect=[state(new='fail'), state(new='pass')]), \
                patch.object(adapter, 'control_names', return_value=set()), \
                patch.object(adapter, 'stream_completion', side_effect=complete):
            adapter.repair_delivery(self.out, [], [], 'm', 'b', '', budget, requirements='')
        self.assertEqual(adapter.read_template(self.out), before)
        self.assertFalse(budget.smoke['rounds'][0]['accepted'])
        self.assertEqual(budget.smoke['existing_behavior_after']['kept'], kept['kept'])


class BrowserTests(unittest.TestCase):
    def test_duplicate_links_are_navigable_only_when_their_targets_agree(self):
        with tempfile.TemporaryDirectory() as temp:
            app = Path(temp) / 'app'
            (app / 'frontend').mkdir(parents=True)
            (app / 'backend').mkdir()
            for second, count in [('/detail', 2), ('/other', 1)]:
                with self.subTest(second=second):
                    html = '<a href="/detail">Record</a><a href="' + second + '">Record</a>'
                    (app / 'backend/server.js').write_text(
                        "require('http').createServer((q,s)=>{s.setHeader('Content-Type','text/html');"
                        "s.end(q.url==='/'?" + json.dumps(html) + ":'<h1>Detail</h1>');"
                        "}).listen(process.env.PORT,'127.0.0.1');")
                    b = guard.observe(app, passes=2)
                    self.assertFalse(b.get('unavailable'), b)
                    self.assertEqual(len(b['screens']), count)

    def test_real_browser_navigation_named_lists_and_read_only_requests(self):
        env = dict(os.environ)
        result = subprocess.run(['node', '-e', "require('playwright')"], env=env, capture_output=True)
        if result.returncode:
            self.skipTest('Playwright runtime is unavailable')
        with tempfile.TemporaryDirectory() as temp:
            app = Path(temp) / 'app'
            (app / 'frontend').mkdir(parents=True)
            (app / 'backend').mkdir()
            (app / 'backend/server.js').write_text(r'''const http=require('http');
http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');
res.end(req.url==='/detail' ? '<h1>Detail</h1><section aria-label="Archive"><ul aria-label="Records"><li>One record</li></ul></section>' :
'<button data-nav="detail" onclick="location.href=\'/detail\'">Details</button><a href="/delete">Delete record</a><button onclick="fetch(\'/save\',{method:\'POST\'})">Save</button><h1>Home</h1>');
}).listen(process.env.PORT,'127.0.0.1');''')
            b = guard.observe(app, passes=2)
            self.assertFalse(b.get('unavailable'), b)
            self.assertEqual(len(b['screens']), 2)
            self.assertIn(('listitem', 'One record'), [(i['role'], i['name']) for s in b['screens'] for i in s['items']])
            self.assertEqual([s['url'] for s in b['screens']], ['/', '/detail'])


if __name__ == '__main__':
    unittest.main()
