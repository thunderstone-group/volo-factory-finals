"""Calibrate pinned acceptance with real Node/HTTP and positive/negative controls."""
import hashlib
import json
import os
import shutil
import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import unittest
from pathlib import Path

from test_core import TempCase, FakeGateway, GREETING_FILES, response
from volo.acceptance import AcceptanceSuite, AcceptanceUnavailable
from volo.agent import Agent
from volo.model import Model
from volo.requirements import RequirementSet
from volo.trace import Runtime

PREFIX = "const {test}=require('node:test');const assert=require('node:assert/strict');\n"
HTTP_CHECK = PREFIX + "test('exact greeting',async()=>{assert.equal(await(await fetch(process.env.FACTORY_BASE_URL)).text(),'hello');});\n"


@unittest.skipUnless(shutil.which('node') and shutil.which('npm'), 'Installed Node/npm required')
class AcceptanceTests(TempCase):
    def suite(self, script=HTTP_CHECK, *, cases=None, requirement_ids=None):
        root = (self.base / 'external-acceptance').resolve()
        root.mkdir(exist_ok=True)
        (root / 'accept.cjs').write_text(script)
        fingerprint = RequirementSet.load(self.req).fingerprint
        manifest = {'version': 1, 'requirement_fingerprint': fingerprint,
                    'files': {'accept.cjs': hashlib.sha256(script.encode()).hexdigest()},
                    'cases': cases if cases is not None else [
                        {'id': 'R1-exact', 'file': 'accept.cjs', 'name': 'exact greeting',
                         'requirements': ['REQ-1'], 'source': 'requirements.yaml#REQ-1'}]}
        path = root / 'contract.json'
        path.write_text(json.dumps(manifest))
        return AcceptanceSuite(path, self.out, fingerprint, requirement_ids or ['REQ-1'])

    def evaluate(self, suite, scope=None, timeout=8):
        return suite.run('http://127.0.0.1:1', scope or ['REQ-1'], timeout=timeout)

    def test_zero_assertion_file_and_printed_success_cannot_forge_named_test(self):
        for script in ('process.exit(0);', 'console.log(JSON.stringify({type:"test:pass",name:"exact greeting"}));'):
            with self.subTest(script=script):
                result = self.evaluate(self.suite(script))
                self.assertFalse(result['passed'])
                self.assertEqual(result['verified_requirements'], [])
                self.assertEqual(result['cases'][0]['status'], 'unverified')

    def test_skips_todos_and_duplicates_do_not_count_as_passes(self):
        for script in ("test('exact greeting',{skip:true},()=>{});",
                       "test('exact greeting',{todo:true},()=>{});",
                       "test('exact greeting',()=>{});test('exact greeting',()=>{});"):
            with self.subTest(script=script):
                result = self.evaluate(self.suite(PREFIX + script))
                self.assertFalse(result['passed'])
                self.assertEqual(result['verified_requirements'], [])

    def test_named_assertion_positive_control_and_failing_control(self):
        for expected in ('hello', 'wrong'):
            with self.subTest(expected=expected):
                suite = self.suite(PREFIX + "test('exact greeting',()=>assert.equal('hello'," + json.dumps(expected) + '));')
                result = self.evaluate(suite)
                self.assertEqual(result['passed'], expected == 'hello', result)
                self.assertEqual(result['verified_requirements'], ['REQ-1'] if expected == 'hello' else [])
                self.assertEqual(result['contract_fingerprint'], suite.fingerprint)

    def test_deleted_and_changed_authoritative_files_fail_closed(self):
        suite = self.suite()
        (suite.root / 'accept.cjs').write_text('process.exit(0);')
        result = self.evaluate(suite)
        self.assertEqual(result['status'], 'error')
        self.assertFalse(result['passed'])
        (suite.root / 'accept.cjs').unlink()
        self.assertEqual(self.evaluate(suite)['status'], 'error')

    def test_manifest_change_cannot_redefine_case_to_match_empty_file(self):
        suite = self.suite()
        suite.path.write_text('{}')
        self.assertEqual(self.evaluate(suite)['status'], 'error')

    def test_snapshot_tampering_during_test_is_detected(self):
        script = PREFIX + "test('exact greeting',()=>{require('node:fs').writeFileSync(__filename,'process.exit(0)');});"
        result = self.evaluate(self.suite(script))
        self.assertFalse(result['passed'])
        self.assertIn('snapshot changed', result['error'])

    def test_timeout_cannot_pass(self):
        suite = self.suite(PREFIX + "test('exact greeting',async()=>{await new Promise(r=>setTimeout(r,10000));});")
        result = self.evaluate(suite, timeout=0.4)
        self.assertFalse(result['passed'])
        self.assertTrue(result['timed_out'])
        self.assertEqual(result['verified_requirements'], [])

    def test_empty_contract_and_wrong_requirements_are_rejected(self):
        with self.assertRaisesRegex(ValueError, '1-200'):
            self.suite(cases=[])
        suite = self.suite()
        with self.assertRaisesRegex(ValueError, 'fingerprint'):
            AcceptanceSuite(suite.path, self.out, '0' * 64, ['REQ-1'])
        with self.assertRaisesRegex(ValueError, 'missing or duplicate requirements'):
            AcceptanceSuite(suite.path, self.out, suite.requirement_fingerprint, ['OTHER'])

    def test_candidate_cannot_supply_its_own_authority_directory(self):
        suite = self.suite()
        for app in (suite.root, suite.root / 'app', suite.root.parent):
            with self.subTest(app=app), self.assertRaisesRegex(ValueError, 'separate'):
                AcceptanceSuite(suite.path, app, suite.requirement_fingerprint, ['REQ-1'])

    def test_symlinks_and_traversal_in_pinned_files_are_rejected(self):
        suite = self.suite()
        file = suite.root / 'accept.cjs'
        outside = self.base / 'elsewhere.cjs'
        outside.write_text(HTTP_CHECK)
        file.unlink()
        file.symlink_to(outside)
        with self.assertRaisesRegex(ValueError, 'symlinks'):
            AcceptanceSuite(suite.path, self.out, suite.requirement_fingerprint, ['REQ-1'])
        data = json.loads(suite.raw)
        data['files'] = {'../elsewhere.cjs': hashlib.sha256(HTTP_CHECK.encode()).hexdigest()}
        suite.path.write_text(json.dumps(data))
        with self.assertRaisesRegex(ValueError, 'relative paths'):
            AcceptanceSuite(suite.path, self.out, suite.requirement_fingerprint, ['REQ-1'])

    def test_incremental_scope_does_not_execute_unimplemented_future_cases(self):
        cases = [{'id': 'a', 'file': 'accept.cjs', 'name': 'first', 'requirements': ['REQ-1'], 'source': 'fixture#1'},
                 {'id': 'b', 'file': 'accept.cjs', 'name': 'second', 'requirements': ['REQ-2'], 'source': 'fixture#2'}]
        script = PREFIX + "test('first',()=>assert.equal(1,1));test('second',()=>assert.fail('not implemented'));"
        suite = self.suite(script, cases=cases, requirement_ids=['REQ-1', 'REQ-2'])
        first = self.evaluate(suite, ['REQ-1'])
        self.assertTrue(first['passed'], first)
        self.assertEqual(first['verified_requirements'], ['REQ-1'])
        self.assertFalse(self.evaluate(suite, ['REQ-1', 'REQ-2'])['passed'])

    def test_cross_requirement_cases_activate_only_when_the_full_scope_exists(self):
        cases = [{'id': 'a', 'file': 'accept.cjs', 'name': 'first', 'requirements': ['REQ-1'], 'source': 'fixture#1'},
                 {'id': 'b', 'file': 'accept.cjs', 'name': 'integration', 'requirements': ['REQ-1', 'REQ-2'], 'source': 'fixture#2'}]
        suite = self.suite(PREFIX + "test('first',()=>assert.equal(1,1));test('integration',()=>assert.fail('future'));",
                           cases=cases, requirement_ids=['REQ-1', 'REQ-2'])
        self.assertTrue(self.evaluate(suite, ['REQ-1'])['passed'])
        self.assertFalse(self.evaluate(suite, ['REQ-1', 'REQ-2'])['passed'])

    def test_missing_authoritative_case_stops_without_more_model_calls(self):
        self.workspace.acceptance_suite = self.suite('process.exit(0);')
        first = response([('build_app', {'index_html': 'hello', 'checks_js': 'process.exit(0);'})])
        with FakeGateway([first]) as gateway:
            agent = Agent(RequirementSet.load(self.req), Model(gateway.url, 'synthetic-key', 'synthetic-model', self.trace),
                          self.workspace, Runtime(self.trace))
            with self.assertRaises(AcceptanceUnavailable):
                agent.run()
            self.assertEqual(len(gateway.requests), 1)
        self.assertEqual(self.workspace.last_verification_attempt['acceptance']['status'], 'unverified')

    def test_uncovered_requirement_is_not_implicitly_verified(self):
        suite = self.suite(PREFIX + "test('exact greeting',()=>{});", requirement_ids=['REQ-1', 'REQ-2'])
        result = self.evaluate(suite, ['REQ-1', 'REQ-2'])
        self.assertFalse(result['passed'])
        self.assertEqual(result['unverified_requirements'], ['REQ-2'])

    def test_real_wrong_app_remains_rejected_when_self_checks_are_weakened(self):
        self.workspace.write_files(GREETING_FILES)
        self.workspace.edit('backend/server.cjs', "s.end('hello')", "s.end('wrong')")
        self.workspace.acceptance_suite = self.suite()
        first = self.workspace.verify(['node', '-e', 'process.exit(0)'])
        self.assertFalse(first['passed'], first)
        self.assertEqual(first['acceptance']['cases'][0]['status'], 'failed')
        self.workspace.write_files([{'path': 'checks/greeting.cjs', 'content': 'process.exit(0);'}])
        second = self.workspace.verify(['node', 'checks/greeting.cjs'])
        self.assertFalse(second['passed'])
        self.workspace.edit('backend/server.cjs', "s.end('wrong')", "s.end('hello')")
        third = self.workspace.verify(['node', 'checks/greeting.cjs'])
        self.assertTrue(third['passed'], third)
        self.assertEqual(third['acceptance']['verified_requirements'], ['REQ-1'])
        self.assertEqual(third['source_fingerprint'], third['acceptance']['source_fingerprint'])

    def test_real_agent_repairs_product_without_changing_pinned_suite(self):
        self.workspace.acceptance_suite = self.suite()
        bad = response([('build_app', {'index_html': 'wrong', 'checks_js': 'process.exit(0);'})])
        good = response([('build_app', {'index_html': 'hello', 'checks_js': 'process.exit(0);'})])
        with FakeGateway([bad, good]) as gateway:
            agent = Agent(RequirementSet.load(self.req), Model(gateway.url, 'synthetic-key', 'synthetic-model', self.trace),
                          self.workspace, Runtime(self.trace))
            result = agent.run()
            self.assertEqual(result['verified_requirements'], ['REQ-1'])
            self.assertEqual(result['independent_acceptance'], 'passed')
            self.assertEqual(len(gateway.requests), 2)
            self.assertIn('R1-exact', gateway.requests[1]['messages'][-1]['content'])
        self.workspace.acceptance_suite.assert_integrity()

    def test_no_contract_means_no_independent_verification_claim(self):
        self.workspace.write_files(GREETING_FILES)
        finished = response([('patch_and_verify', {'edits': [
            {'path': 'checks/greeting.cjs', 'old': "'hello'", 'new': "'hello'"}],
            'check_command': ['node', 'checks/greeting.cjs']})])
        with FakeGateway([finished]) as gateway:
            result = Agent(RequirementSet.load(self.req), Model(gateway.url, 'synthetic-key', 'synthetic-model', self.trace),
                           self.workspace, Runtime(self.trace)).run()
        self.assertEqual(result['self_checked_requirements'], ['REQ-1'])
        self.assertEqual(result['verified_requirements'], [])
        self.assertEqual(result['independent_acceptance'], 'not_configured')

    def test_resumed_self_check_cannot_bypass_new_contract_in_same_workspace(self):
        self.workspace.write_files(GREETING_FILES)
        finish = response([('patch_and_verify', {'edits': [
            {'path': 'checks/greeting.cjs', 'old': "'hello'", 'new': "'hello'"}],
            'check_command': ['node', 'checks/greeting.cjs']})])
        with FakeGateway([finish]) as gateway:
            model = Model(gateway.url, 'synthetic-key', 'synthetic-model', self.trace)
            Agent(RequirementSet.load(self.req), model, self.workspace, Runtime(self.trace)).run()
            self.workspace.acceptance_suite = self.suite(PREFIX + "test('exact greeting',()=>assert.fail('new contract'));" )
            with self.assertRaisesRegex(RuntimeError, 'fresh verification'):
                Agent(RequirementSet.load(self.req), model, self.workspace, Runtime(self.trace)).run()
            self.assertEqual(len(gateway.requests), 1)
        self.assertFalse(self.workspace.last_verification_attempt['passed'])

    def test_worker_neutral_cli_scores_real_http_without_model_credentials(self):
        suite = self.suite()
        self.workspace.write_files(GREETING_FILES)
        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b'hello')
            def log_message(self, *args):
                pass
        server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        env = {k: v for k, v in os.environ.items() if not k.startswith(('OPENAI_', 'MODEL', 'FACTORY_'))}
        try:
            cli = Path(__file__).resolve().parents[1] / 'scripts/evaluate_candidate.py'
            result = subprocess.run([sys.executable, str(cli), '--requirements', str(self.req),
                '--application', str(self.out), '--contract', str(suite.path),
                '--base-url', 'http://127.0.0.1:' + str(server.server_port)],
                text=True, capture_output=True, env=env, timeout=15)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            evidence = json.loads(result.stdout)
            self.assertEqual(evidence['verified_requirements'], ['REQ-1'])
            self.assertEqual(evidence['model_api_calls'], 0)
            self.assertFalse(evidence['candidate_tree_changed'])
        finally:
            server.shutdown()
            server.server_close()
            thread.join()

    @unittest.skipUnless(os.getenv('FACTORY_TEST_PLAYWRIGHT_MODULE') and os.getenv('FACTORY_TEST_CHROMIUM_EXECUTABLE'),
                         'Installed Playwright and Chromium required')
    def test_real_browser_suite_checks_external_app_without_candidate_test_code(self):
        module = os.environ['FACTORY_TEST_PLAYWRIGHT_MODULE']
        chrome = os.environ['FACTORY_TEST_CHROMIUM_EXECUTABLE']
        script = PREFIX + "test('exact greeting',async()=>{const pw=require(" + json.dumps(module) + ");" + \
            "const browser=await pw.chromium.launch({headless:true,executablePath:" + json.dumps(chrome) + "});" + \
            "try{const page=await browser.newPage();await page.goto(process.env.FACTORY_BASE_URL);" + \
            "assert.equal(await page.locator('body').innerText(),'hello');}finally{await browser.close();}});"
        self.workspace.write_files(GREETING_FILES)
        self.workspace.acceptance_suite = self.suite(script)
        result = self.workspace.verify(['node', '-e', 'process.exit(0)'])
        self.assertTrue(result['passed'], result)
        self.assertEqual(result['acceptance']['verified_requirements'], ['REQ-1'])
