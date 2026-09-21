"""Guard against false completion and accidental public-score feedback."""
import sys
from pathlib import Path
import unittest
import tempfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from business_loop import decision, validate_probe_input
from business_replay import fingerprint
from goal_coverage import catalogue, coverage


class GoalCoverageTests(unittest.TestCase):
    def setUp(self):
        self.requirements=[{'id':'REQ-1','name':'Login'}, {'id':'REQ-2','name':'Booking'}]

    def report(self, *cases):
        return {'mode':'probe','cases':[{'name':name,'passed':passed} for name,passed in cases]}

    def test_green_subset_is_not_full_completion(self):
        result=coverage(self.requirements,self.report(('REQ-1: login',True)))
        self.assertEqual(result['completion'],'coverage_incomplete')
        self.assertEqual(result['counts']['unverified'],1)
        self.assertFalse(result['full_requirement_verification'])

    def test_one_failed_scenario_keeps_requirement_unresolved(self):
        result=coverage(self.requirements,self.report(('REQ-1: positive',True),('REQ-1: negative',False)))
        self.assertEqual(result['requirements'][0]['status'],'observed_failure')
        self.assertIsNone(result['completion'])

    def test_even_all_referenced_requirements_only_establish_scoped_checks(self):
        result=coverage(self.requirements,self.report(('REQ-1 + REQ-2: journey',True)))
        self.assertEqual(result['completion'],'scoped_checks_passed')
        self.assertFalse(result['full_requirement_verification'])

    def test_passing_folder_does_not_cover_its_atomic_child(self):
        reqs=[{'id':'REQ-1','name':'Group','type':'FOLDER'}, {'id':'REQ-1.1','name':'Child','type':'ATOMIC'}]
        result=coverage(reqs,self.report(('REQ-1: group landing page',True)))
        self.assertEqual(result['counts'],{'unverified':1})
        self.assertEqual(result['completion'],'coverage_incomplete')

    def test_empty_duplicate_and_unknown_checks_fail_closed(self):
        for report in [self.report(), self.report(('REQ-1: same',True),('REQ-1: same',True)), self.report(('REQ-3: unknown',True))]:
            with self.assertRaises(ValueError): coverage(self.requirements,report)

    def test_build_failure_and_external_score_cannot_be_completion(self):
        for change in [{'mode':'score'}, {'application_failure':{'stage':'build'}}]:
            with self.assertRaises(ValueError):
                coverage(self.requirements,{**self.report(('REQ-1: login',True)),**change})

    def test_empty_acceptance_evidence_is_rejected(self):
        with self.assertRaises(ValueError): decision(self.report(),self.report())

    def test_stale_source_or_checks_are_rejected_before_request(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);app=root/'app';app.mkdir();(app/'app.js').write_text('original')
            checks=root/'checks';checks.mkdir();probe=checks/'ctrip_business.spec.cjs';probe.write_text('original check')
            plan={'probe_file':str(probe)}
            report={'mode':'probe','source_sha256':fingerprint(app),'checks_sha256':fingerprint(checks)}
            validate_probe_input(plan,report,app)
            probe.write_text('different check')
            with self.assertRaisesRegex(ValueError,'probe source changed'): validate_probe_input(plan,report,app)
            probe.write_text('original check');(app/'app.js').write_text('different app')
            with self.assertRaisesRegex(ValueError,'current application'): validate_probe_input(plan,report,app)

    def test_lifecycle_change_needs_a_new_baseline_before_request(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);app=root/'app';app.mkdir();checks=root/'checks';checks.mkdir()
            probe=checks/'ctrip_business.spec.cjs';probe.write_text('synthetic check')
            report={'mode':'probe','source_sha256':fingerprint(app),'checks_sha256':fingerprint(checks),'runtime':{'server_lifecycle':'per_check'}}
            with self.assertRaisesRegex(ValueError,'another server lifecycle'):
                validate_probe_input({'probe_file':str(probe),'shared_probe_server':True},report,app)
            with self.assertRaisesRegex(ValueError,'another server lifecycle'):
                validate_probe_input({'probe_file':str(probe),'goal_catalogue':'synthetic'},report,app)

    def test_catalogue_retains_atomic_requirements_and_folder_descriptions(self):
        text='id: ROOT\ntype: FOLDER\nchildren:\n- id: REQ-1\n  name: Login\n  type: ATOMIC\n- id: REQ-2\n  name: Folder\n  type: FOLDER\n  children:\n  - id: REQ-2.1\n    name: Booking\n    type: ATOMIC\n'
        self.assertEqual([r['id'] for r in catalogue(text)],['REQ-1','REQ-2','REQ-2.1'])
        self.assertEqual(catalogue(text)[1]['type'],'FOLDER')
        with self.assertRaises(ValueError): catalogue('invalid or empty requirements')


if __name__=='__main__': unittest.main()
