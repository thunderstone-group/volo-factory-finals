"""Synthetic gateway/observer fixtures only; no real model or app execution on host."""
import contextlib
import copy
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch
import zipfile

from oneshot import main as core, skill_repair as sr, business_feedback as bf
from oneshot.v2 import main as v2
from oneshot.v3 import entry, planner, observer
from scripts.package_minimal_v3 import build, FILES
from test_oneshot import block, events, SyntheticStream
from test_skill_repair import SyntheticGateway, completion, read_call

KEY = 'synthetic-v3-credential'
REQ = 'Saving the edited record must retain its title when the editor is reopened.'
SOURCE = "// Synthetic fixture: Records Edit Title Save Cancel\nconst state = 'broken';\n"
PATH = 'frontend/public/app.js'
CONFIG = {'api_key': KEY, 'model': 'synthetic-v3', 'base_url': 'https://synthetic.invalid/v1'}


def supported():
    return {'schema': 1, 'status': 'supported', 'reason': 'Synthetic source-backed fixture', 'login': None,
            'flows': [{'id': 'save', 'kind': 'save-reopen', 'requirement': REQ, 'navigate': ['Records'],
                       'open': 'Edit', 'field': 'Title', 'save': 'Save', 'cancel': 'Cancel',
                       'evidence': [{'path': PATH, 'quote': SOURCE}]}]}


def receipt(contract, status='pass'):
    return {'errors': [], 'suites': [{'specs': [{'title': f['id'], 'tests': [{'results': [{
        'status': 'passed', 'stdout': [{'text': observer.MARKER+json.dumps({
            'id': f['id'], 'phase': 'reopen', 'status': status, 'observation': 'Synthetic observation',
            'contract_sha256': contract['contract_sha256']})+'\n'}]}]}]} for f in contract['flows']]}]}


class V3Tests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(dir=Path(tempfile.gettempdir()).resolve())
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name); self.app = self.root/'app'; self.app.mkdir()
        v2.starter(self.app); (self.app/PATH).write_text(SOURCE)
        self.paths = sorted(core.read_template(self.app))
        self.source = sr.load_source(self.app, self.paths)
        self.hash = bf.source_id(self.app)
        self.contract = planner.validate(supported(), REQ, self.source, self.hash)
        self.enter(patch.object(sr, '_open_model', side_effect=AssertionError('real gateway forbidden')))
        self.enter(patch.object(core, '_open_model', side_effect=AssertionError('real gateway forbidden')))

    def enter(self, cm):
        result = cm.__enter__(); self.addCleanup(cm.__exit__, None, None, None); return result

    def test_plan_provenance_binds_requirement_source_probe_and_parameters(self):
        self.assertEqual(self.contract['provenance']['source_sha256'], self.hash)
        self.assertEqual(self.contract['provenance']['probe_sha256'], sr.sha256(planner.PROBE.read_bytes()))
        changed = supported(); changed['flows'][0]['navigate'] = []
        self.assertNotEqual(planner.validate(changed, REQ, self.source, self.hash)['contract_sha256'], self.contract['contract_sha256'])

    def test_rejects_unsupported_shapes_uncited_parameters_and_false_provenance(self):
        changes = [lambda p: p.update(extra='code'), lambda p: p.update(schema=True),
            lambda p: p['flows'][0].update(evaluate='page.evaluate(...)'),
            lambda p: p['flows'][0].update(requirement='Not actually in the requirement document'),
            lambda p: p['flows'][0].update(field='Missing label'),
            lambda p: p['flows'][0]['evidence'][0].update(path='../test.spec.js'),
            lambda p: p['flows'][0]['evidence'][0].update(quote='Invented source excerpt'),
            lambda p: p['flows'][0].update(navigate=['Records']*6),
            lambda p: p.update(flows=p['flows']*4), lambda p: p.update(flows=p['flows']*2),
            lambda p: p.update(flows=[])]
        for change in changes:
            p = supported(); change(p)
            with self.subTest(plan=p), self.assertRaises(ValueError):
                planner.validate(p, REQ, self.source, self.hash)

    def test_uncertain_has_no_executable_flows(self):
        p = supported(); p.update(status='unsupported', flows=[])
        self.assertIsNone(planner.validate(p, REQ, self.source, self.hash))
        p['flows'] = supported()['flows']
        with self.assertRaises(ValueError): planner.validate(p, REQ, self.source, self.hash)

    def test_all_three_flow_templates_are_parameterized(self):
        p = supported(); cancel = copy.deepcopy(p['flows'][0]); cancel.update(id='cancel', kind='cancel')
        favorite = {'id': 'favorite', 'kind': 'favorite', 'requirement': REQ, 'navigate': [],
                    'enable': 'Save', 'disable': 'Cancel', 'evidence': [{'path': PATH, 'quote': SOURCE}]}
        p['flows'] += [cancel, favorite]
        self.assertEqual(len(planner.validate(p, REQ, self.source, self.hash)['flows']), 3)

    def test_login_values_must_come_from_supplied_document(self):
        p = supported(); p['login'] = {'open': 'Edit', 'fields': {'Title': 'invented-secret'},
            'submit': 'Save', 'ready': 'Records', 'scope': 'banner', 'evidence': [{'path': PATH, 'quote': SOURCE}]}
        with self.assertRaisesRegex(ValueError, 'login_value_not_supplied'):
            planner.validate(p, REQ, self.source, self.hash)

    def test_one_planner_call_no_tools_no_retry(self):
        gw = SyntheticGateway([completion(json.dumps(supported()))])
        contract, trace = planner.plan(REQ, self.app, self.paths, CONFIG, opener=gw)
        self.assertEqual(contract, self.contract); self.assertEqual(len(gw.requests), 1)
        self.assertNotIn('tools', gw.requests[0][2]); self.assertEqual(trace['calls'][0]['usage']['prompt_tokens'], 12)
        bad = SyntheticGateway([completion('{invalid')])
        result, trace = planner.plan(REQ, self.app, self.paths, CONFIG, opener=bad)
        self.assertIsNone(result); self.assertEqual(len(bad.requests), 1); self.assertEqual(trace['status'], 'unknown')

    def test_duplicate_keys_tool_calls_and_length_are_rejected(self):
        for response in (completion('{"schema":1,"schema":1}'), completion(calls=[read_call('state-roundtrip')]),
                         completion(json.dumps(supported()), finish='length')):
            contract, trace = planner.plan(REQ, self.app, self.paths, CONFIG, opener=SyntheticGateway([response]))
            self.assertIsNone(contract); self.assertEqual(len(trace['calls']), 1)

    def test_source_bound_is_fail_closed_without_truncation_or_request(self):
        gw = SyntheticGateway([])
        contract, trace = planner.plan(REQ, self.app, self.paths*8, CONFIG, opener=gw)
        self.assertIsNone(contract); self.assertEqual(gw.requests, [])

    def test_process_success_is_not_business_pass(self):
        rows = observer.parse_observations(receipt(self.contract, 'product_fail'), self.contract)
        self.assertEqual(rows[0]['status'], 'product_fail')
        raw = receipt(self.contract)
        raw['suites'][0]['specs'][0]['tests'][0]['results'][0]['stdout'] *= 2
        with self.assertRaises(ValueError): observer.parse_observations(raw, self.contract)

    def test_missing_repeated_forged_receipts_cannot_pass(self):
        for raw in ({'suites': []}, {**receipt(self.contract), 'errors': [{'message': 'failure'}]}):
            with self.assertRaises(ValueError): observer.parse_observations(raw, self.contract)
        bad = receipt(self.contract)
        bad['suites'][0]['specs'][0]['title'] = 'other'
        with self.assertRaises(ValueError): observer.parse_observations(bad, self.contract)

    def test_host_gate_never_starts_generated_code(self):
        obs = observer.NativeObserver(self.contract, self.root/'runtime', time.monotonic()+30)
        with patch.object(observer.sys, 'platform', 'darwin'), patch.object(observer, '_process') as run:
            r = obs(self.app, self.root/'observation')
        run.assert_not_called(); self.assertEqual(r['status'], 'environment_error')
        self.assertEqual(r['error']['code'], 'linux_container_required')
        self.assertEqual(r['verified_requirements'], []); self.assertTrue(r['integrity_verified'])

    def test_changed_contract_and_stale_baseline_are_not_observed(self):
        contract = copy.deepcopy(self.contract); contract['flows'][0]['field'] = 'Changed'
        with self.assertRaisesRegex(ValueError, 'contract_changed'):
            observer.NativeObserver(contract, self.root/'runtime', time.monotonic()+30)
        obs = observer.NativeObserver(self.contract, self.root/'runtime', time.monotonic()+30)
        (self.app/PATH).write_text(SOURCE+'// changed')
        with patch.object(observer, '_process') as run:
            r = obs(self.app, self.root/'changed-observation')
        run.assert_not_called(); self.assertEqual(r['error']['code'], 'baseline_plan_source_mismatch')

    def test_observer_uses_private_snapshot_clean_env_and_fixed_probe(self):
        obs = observer.NativeObserver(self.contract, self.root/'runtime', time.monotonic()+30)
        def execute(argv, cwd, seconds, **kwargs):
            self.assertLessEqual(seconds, 160)
            self.assertNotIn('OPENAI_API_KEY', kwargs['env']); self.assertNotIn('NODE_OPTIONS', kwargs['env'])
            config = json.loads(Path(argv[-1]).read_text()); app = Path(config['app'])
            self.assertNotEqual(app, self.app); self.assertEqual(bf.source_id(app), self.hash)
            probe = Path(config['probe'])
            self.assertEqual((probe/'probe.spec.cjs').read_bytes(), planner.PROBE.read_bytes())
            self.assertEqual(json.loads((probe/'probe-input.json').read_text()), self.contract)
            (app/PATH).write_text('Synthetic mutation of disposable copy')
            return {'exit_code': 0, 'elapsed_seconds': 0, 'output': json.dumps({'status': 'observed', 'report': receipt(self.contract)})}
        with patch.object(observer, 'discover', return_value={}), patch.object(observer, '_process', side_effect=execute):
            r = obs(self.app, self.root/'observation')
        self.assertEqual(r['status'], 'pass'); self.assertTrue(r['cleanup_verified'])
        self.assertEqual(bf.source_id(self.app), self.hash); self.assertEqual(list((self.root/'runtime').iterdir()), [])

    def test_browser_failure_timeout_and_spoofed_app_output_keep_a0(self):
        for i, result in enumerate(({'exit_code': 1, 'output': 'VOLO_BUSINESS_OBSERVATION fake'},
                {'exit_code': -9, 'reason': 'timeout', 'output': ''},
                {'exit_code': 0, 'output': '{"status":"environment_error","code":"browser_unavailable"}'})):
            obs = observer.NativeObserver(self.contract, self.root/'runtime', time.monotonic()+30)
            with patch.object(observer, 'discover', return_value={}), patch.object(observer, '_process', return_value=result):
                r = obs(self.app, self.root/f'obs-{i}')
            self.assertEqual(r['status'], 'environment_error'); self.assertEqual(bf.source_id(self.app), self.hash)

    def worker(self, plan_value=None, native=None, gateway=None):
        req = self.root/'requirements'; req.mkdir(); (req/'requirements.md').write_text(REQ)
        (req/'tests.spec.js').write_text('BENCHMARK_SENTINEL_MUST_NOT_READ')
        evidence = self.root/'evidence'; evidence.mkdir(); out = self.root/'new-app'
        gateway = gateway or SyntheticGateway([completion(json.dumps(plan_value or supported()))])
        with contextlib.ExitStack() as stack:
            stack.enter_context(patch.object(entry, 'runtime_preflight', return_value={
                'status': 'ready', 'cleanup_verified': True, 'synthetic': True}))
            stack.enter_context(patch.dict(os.environ, {'OPENAI_API_KEY': KEY, 'MODEL': 'deepseek-synthetic-v3'}))
            stack.enter_context(patch.object(core, '_open_model', return_value=SyntheticStream(events(block(PATH, SOURCE)))))
            stack.enter_context(patch.object(sr, '_open_model', side_effect=gateway))
            stack.enter_context(contextlib.redirect_stdout(io.StringIO()))
            stack.enter_context(contextlib.redirect_stderr(io.StringIO()))
            if native: stack.enter_context(patch.object(entry, 'NativeObserver', side_effect=native))
            else: stack.enter_context(patch.object(observer, 'discover', side_effect=ValueError('synthetic_missing_runtime')))
            code = entry.worker(req, out, evidence, time.monotonic()+120)
        return code, out, evidence, gateway

    def test_full_generation_unsupported_plan_keeps_a0_without_repair(self):
        plan = supported(); plan.update(status='unsupported', flows=[])
        code, out, evidence, gw = self.worker(plan)
        self.assertEqual(code, 0); self.assertEqual(len(gw.requests), 1)
        self.assertEqual((out/PATH).read_text(), SOURCE)
        self.assertEqual(json.loads((evidence/'result.json').read_text())['status'], 'unknown')
        self.assertNotIn('BENCHMARK_SENTINEL_MUST_NOT_READ', json.dumps(gw.requests[0][2]))

    def test_full_generation_missing_runtime_keeps_a0(self):
        code, out, evidence, gw = self.worker()
        self.assertEqual(code, 0); self.assertEqual(len(gw.requests), 1)
        result = json.loads((evidence/'result.json').read_text())
        self.assertEqual(result['status'], 'environment_error'); self.assertFalse(result['accepted_repair'])
        self.assertEqual(result['repair']['model_calls'], 0)
        self.assertEqual((out/PATH).read_text(), SOURCE)

    def test_real_coordinator_skill_client_same_plan_before_and_after_patch(self):
        observed = []
        def factory(contract, root, deadline):
            def observe(app, output):
                observed.append((bf.source_id(app), contract['contract_sha256']))
                status = 'pass' if "'fixed'" in (app/PATH).read_text() else 'product_fail'
                return {'source_sha256': bf.source_id(app), 'contract_sha256': contract['contract_sha256'],
                        'checks': [{'id': 'save', 'requirement': REQ, 'observation': 'Synthetic readback', 'status': status}],
                        'status': status, 'integrity_verified': True, 'verified_requirements': []}
            return observe
        proposal = {'edits': [{'path': PATH, 'before_sha256': sr.sha256(SOURCE.encode()), 'old': "'broken'", 'new': "'fixed'"}]}
        gw = SyntheticGateway([completion(json.dumps(supported())), completion(calls=[read_call('state-roundtrip')]), completion(json.dumps(proposal))])
        code, out, evidence, _ = self.worker(native=factory, gateway=gw)
        result = json.loads((evidence/'result.json').read_text())
        self.assertEqual(code, 0); self.assertTrue(result['accepted_repair']); self.assertEqual(result['repair']['model_calls'], 2)
        self.assertEqual(result['stages']['generation']['reasoning_effort'], 'low')
        self.assertEqual(result['stages']['planner']['model_calls'], 1)
        self.assertEqual(result['stages']['observation']['observations'], 2)
        self.assertEqual(result['stages']['repair']['model_calls'], 2)
        self.assertEqual(len(observed), 2); self.assertNotEqual(observed[0][0], observed[1][0])
        self.assertEqual(observed[0][1], observed[1][1]); self.assertIn("'fixed'", (out/PATH).read_text())
        self.assertEqual((evidence/'A0'/PATH).read_text(), SOURCE)
        self.assertNotIn(KEY, (evidence/'business/report.json').read_text())

    def test_two_rounds_share_six_repair_calls_and_all_three_skills(self):
        observed = []
        def factory(contract, root, deadline):
            def observe(app, output):
                observed.append(contract['contract_sha256'])
                status = 'pass' if "'fixed'" in (app/PATH).read_text() else 'product_fail'
                return {'source_sha256': bf.source_id(app), 'contract_sha256': contract['contract_sha256'],
                        'checks': [{'id': 'save', 'requirement': REQ, 'observation': 'Synthetic readback', 'status': status}],
                        'status': status, 'integrity_verified': True}
            return observe
        replies = [completion(json.dumps(supported()))]
        for before, after, number in (('broken', 'partial', 1), ('partial', 'fixed', 2)):
            text = SOURCE.replace("'broken'", repr(before))
            replies += [completion(calls=[read_call('state-roundtrip', number*2)]),
                        completion(calls=[read_call('interface-contract', number*2+1), read_call('ready-navigation', number*2+20)]),
                        completion(json.dumps({'edits': [{'path': PATH, 'before_sha256': sr.sha256(text.encode()),
                                                         'old': repr(before), 'new': repr(after)}]}))]
        code, out, evidence, gw = self.worker(native=factory, gateway=SyntheticGateway(replies))
        report = json.loads((evidence/'result.json').read_text())
        self.assertEqual(code, 0); self.assertEqual(report['repair']['model_calls'], 6)
        self.assertEqual(len(gw.requests), 7); self.assertEqual(len(observed), 3)
        self.assertEqual(len(set(observed)), 1); self.assertTrue(report['accepted_repair'])

    def test_existing_output_is_preserved_without_any_process(self):
        req = self.root/'req'; req.mkdir(); (req/'requirements.md').write_text(REQ)
        with patch.object(entry, '_process') as run, contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(entry.main([str(req), '--output-dir', str(self.app)]), 1)
        run.assert_not_called(); self.assertEqual(bf.source_id(self.app), self.hash)

    def test_outer_deadline_is_structured_and_no_longer_than_1800(self):
        with patch.object(entry.sr, '_deadline', side_effect=sr.RepairError('time_budget')) as deadline, contextlib.redirect_stdout(io.StringIO()) as out:
            self.assertEqual(entry.main([]), 1)
        deadline.assert_called_once_with(1800)
        self.assertEqual(json.loads(out.getvalue())['error']['code'], 'global_wall_limit')

    def test_package_allowlist_reproducibility_and_unchanged_shared_bytes(self):
        a = self.root/'a.zip'; b = self.root/'b.zip'; meta = build(a); build(b)
        self.assertEqual(a.read_bytes(), b.read_bytes())
        with zipfile.ZipFile(a) as z:
            self.assertEqual(set(z.namelist()), set(FILES) | {'oneshot/__init__.py', 'oneshot/v1/__init__.py', 'oneshot/v2/__init__.py'})
            for path in ('oneshot/v2/main.py', 'oneshot/skill_repair.py', 'oneshot/business_feedback.py', 'oneshot/business_probe.spec.cjs'):
                self.assertEqual(z.read(path), Path(path).read_bytes())
            self.assertFalse(any('tests' in n or 'runs' in n for n in z.namelist()))
        self.assertEqual(sr.sha256(a.read_bytes()), meta['package_sha256'])
        with self.assertRaises(ValueError): build(a)

    def test_extracted_official_entry_with_synthetic_gateway_no_sockets(self):
        """Actual CLI/worker; urllib transport and ready preflight are synthetic.

        sitecustomize is an OUTSIDE-ZIP fixture, propagated by a test-only wrapper
        around the process helper. This avoids sandbox-forbidden loopback binding.
        No production fixture switch or transport hook is shipped.
        """
        archive = self.root/'entry.zip'; build(archive)
        package = self.root/'package'; package.mkdir()
        with zipfile.ZipFile(archive) as z: z.extractall(package)
        req = self.root/'req'; req.mkdir(); (req/'requirements.md').write_text(REQ)
        (req/'tests.spec.js').write_text('EXCLUDED_BENCHMARK_SENTINEL')
        fixture = self.root/'fixture'; fixture.mkdir(); calls = self.root/'synthetic-calls.jsonl'
        hook = '''import sys,os,json,io
sys.path.insert(0, PACKAGE)
from oneshot import main as core, skill_repair as sr
from oneshot.v3 import entry, observer as native
entry.runtime_preflight=native.runtime_preflight=lambda *a: {'status':'ready','cleanup_verified':True,'synthetic':True}
class Response(io.BytesIO):
    status=200
    headers={}
def gateway(req,timeout):
    payload=json.loads(req.data)
    with open(CALLS,'a') as f: f.write(json.dumps({'synthetic':True,'payload':payload})+'\\n')
    if payload.get('stream'):
        frames=[{'choices':[{'delta':{'content':GENERATION},'finish_reason':'stop'}]}, {'choices':[],'usage':{'prompt_tokens':5,'completion_tokens':8}}]
        return Response((''.join('data: '+json.dumps(x)+'\\n\\n' for x in frames)+'data: [DONE]\\n\\n').encode())
    return Response(json.dumps({'choices':[{'message':{'role':'assistant','content':json.dumps(PLAN)},'finish_reason':'stop'}],'usage':{'prompt_tokens':3,'completion_tokens':4}}).encode())
core._open_model=gateway
sr._open_model=gateway
original=entry._process
def process(*a,**kw):
    kw['env']=dict(kw['env'],PYTHONPATH=FIXTURE)
    return original(*a,**kw)
entry._process=process
'''
        constants = {'PACKAGE': str(package), 'FIXTURE': str(fixture), 'CALLS': str(calls),
                     'GENERATION': block(PATH, SOURCE), 'PLAN': supported()}
        (fixture/'sitecustomize.py').write_text('\n'.join(k+' = '+repr(v) for k, v in constants.items())+'\n'+hook)
        env = {'PATH': os.environ.get('PATH', ''), 'PYTHONPATH': str(fixture), 'OPENAI_API_KEY': KEY, 'MODEL': 'deepseek-synthetic-v3'}
        # Real platform directories contain runner records before generation.
        delivered = self.root/'delivered'; delivered.mkdir()
        (delivered/'.arc').mkdir(); (delivered/'.arc/runner-events.jsonl').write_text('runner-owned\n')
        (delivered/'requirements').mkdir(); (delivered/'requirements/requirements.yaml').write_text('platform input\n')
        inode = delivered.stat().st_ino
        # The published interface is invoked verbatim, from an extracted directory.
        r = subprocess.run([sys.executable, '-B', 'main.py', str(req), '--output-dir', str(delivered), '--type', 'web'],
                           cwd=package, env=env, capture_output=True, text=True, timeout=30)
        self.assertEqual(r.returncode, 0, r.stdout+r.stderr)
        report = json.loads(r.stdout); self.assertTrue(report['delivered'])
        self.assertTrue(report['runner_metadata_preserved'])
        self.assertEqual(delivered.stat().st_ino, inode)
        self.assertEqual((delivered/'.arc/runner-events.jsonl').read_text(), 'runner-owned\n')
        self.assertEqual((delivered/'requirements/requirements.yaml').read_text(), 'platform input\n')
        self.assertEqual(report['result']['status'], 'environment_error')
        self.assertEqual(report['result']['repair']['model_calls'], 0)
        payloads = [json.loads(line)['payload'] for line in calls.read_text().splitlines()]
        self.assertEqual(len(payloads), 2); self.assertTrue(payloads[0]['stream']); self.assertFalse(payloads[1]['stream'])
        self.assertEqual(payloads[0]['reasoning_effort'], 'low')
        self.assertEqual(payloads[0]['thinking'], {'type': 'enabled'})
        self.assertNotIn('reasoning_effort', payloads[1])
        self.assertNotIn('EXCLUDED_BENCHMARK_SENTINEL', json.dumps(payloads))
        self.assertEqual((self.root/'delivered'/PATH).read_text(), SOURCE)
        evidence = Path(report['evidence'])
        self.assertNotIn(KEY, (evidence/'generation.log').read_text())
        self.assertEqual(report['verified_requirements'], [])


if __name__ == '__main__':
    unittest.main()
