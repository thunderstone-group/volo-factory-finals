"""Three mechanical defects of the repair loop, and the authority of a captured check.

Every payload here is taken from a retained trace: the edits that never applied and the
KeyError reported to the model as "'path'" are the literal arguments of official run
8abb7f040604, calls 3 to 7. Model transport is synthetic; Node, the server and the
verification are real. See docs/repair-loop-autopsy-2026-09-14.md.
"""
import hashlib
import json
import shutil
import unittest

from test_core import TempCase, FakeGateway, response
from volo.acceptance import AcceptanceSuite
from volo.agent import Agent, call_acted, is_check_argv
from volo.model import Model
from volo.requirements import RequirementSet
from volo.trace import Runtime
from volo.web_runtime import scaffold, implement
from volo.workspace import edit_anchor_failure, tool_failure

# backend/api.cjs of run 8abb7f040604 at call 3, reduced to the two regions its edits touched.
API = """const VALID_COUNTRY_CODES = ['+86', '+84'];
function normalizePassenger(b) {
  return {
    documentType: String(b.documentType || '').trim(),
    name: String(b.name || '').trim(),
  };
}
function normalizeContact(b) {
  return {
    documentType: String(b.documentType || '').trim(),
    phone: String(b.phone || '').trim(),
  };
}
"""


class ToolFailureTests(TempCase):
    def agent(self, gateway):
        return Agent(RequirementSet.load(self.req),
                     Model(gateway.url, 'synthetic-key', 'synthetic-model', self.trace),
                     self.workspace, Runtime(self.trace))

    def test_a_missing_key_never_reaches_the_model_as_a_bare_exception_string(self):
        """Calls 4 and 7 of run 8abb7f040604 were rejected with the message "'path'"."""
        self.assertEqual(str(KeyError('path')), "'path'")
        failure = tool_failure('write_files', KeyError('path'), self.out)
        self.assertNotEqual(failure['error'], "'path'")
        self.assertIn('write_files', failure['error'])
        self.assertIn('path', failure['error'])
        self.assertIn('required argument was missing', failure['error'])
        self.assertIn('Resend files', failure['next'])

    def test_every_tool_exception_is_named_actionable_and_free_of_host_paths(self):
        cases = [
            ('read_files', KeyError('paths')),
            ('run', TypeError("run() got an unexpected keyword argument 'command'")),
            ('read_file_chunk', FileNotFoundError(2, 'No such file or directory')),
            ('edit', ValueError('Requirement inputs are read-only')),
            ('finish', TimeoutError('Agent wall-time budget exhausted')),
            ('build_app', json.JSONDecodeError('Expecting value', '{', 0)),
        ]
        for tool, exc in cases:
            with self.subTest(tool=tool):
                failure = tool_failure(tool, exc, self.out)
                self.assertEqual(failure['tool'], tool)
                self.assertTrue(failure['error'].startswith(tool + ' did not run: '), failure)
                self.assertIn('next', failure)
                self.assertNotIn(str(self.base), json.dumps(failure))

    def test_a_file_error_names_the_application_path_not_the_host_path(self):
        exc = FileNotFoundError(2, 'No such file or directory')
        exc.filename = str(self.out / 'backend' / 'api.cjs')
        failure = tool_failure('read_files', exc, self.out)
        self.assertIn('backend/api.cjs', failure['error'])
        self.assertNotIn(str(self.base), failure['error'])

    def test_write_files_rejects_a_malformed_entry_by_name(self):
        with self.assertRaises(ValueError) as rejected:
            self.workspace.write_files([{'path': 'a.js', 'content': 'ok'}, {'content': 'no path'}])
        self.assertIn('File 2', str(rejected.exception))
        self.assertIn("'path' and 'content'", str(rejected.exception))
        self.assertFalse((self.out / 'a.js').exists())

    def test_the_loop_formats_an_escaping_exception_instead_of_repeating_it(self):
        reply = response([('write_files', {'files': [{'content': 'no path'}]})])
        with FakeGateway([reply, response([])]) as gateway:
            agent = self.agent(gateway)
            with self.assertRaises(RuntimeError):
                agent.run_batch(list(RequirementSet.load(self.req).nodes))
        results = [json.loads(line) for line in (self.trace.directory / 'events.jsonl').read_text().splitlines()]
        failures = [e['result'] for e in results if e['event'] == 'tool_result' and 'error' in e['result']]
        self.assertTrue(failures)
        self.assertIn('write_files did not run: ', failures[0]['error'])
        self.assertIn('next', failures[0])


class EditAnchorTests(TempCase):
    def setUp(self):
        super().setUp()
        self.workspace.write_files([{'path': 'backend/api.cjs', 'content': API}])

    def agent(self, gateway):
        return Agent(RequirementSet.load(self.req),
                     Model(gateway.url, 'synthetic-key', 'synthetic-model', self.trace),
                     self.workspace, Runtime(self.trace))

    def test_an_ambiguous_anchor_reports_its_count_and_line_numbers(self):
        """Calls 3 and 5 of run 8abb7f040604 were rejected with only a file name."""
        old = "    documentType: String(b.documentType || '').trim(),"
        message = edit_anchor_failure('backend/api.cjs', old, API, 2)
        self.assertIn('edit 2 of this call', message)
        self.assertIn('occurs 2 times', message)
        self.assertIn('line 4, 10', message)
        self.assertIn('Extend old', message)

    def test_an_absent_anchor_reports_where_it_stops_matching_and_the_real_text(self):
        """Call 7 guessed a different anchor instead of being told what the file holds."""
        old = "    documentType: String(b.documentType || '),"
        message = edit_anchor_failure('backend/api.cjs', old, API, 3)
        self.assertIn('edit 3 of this call', message)
        self.assertIn('is not present in backend/api.cjs', message)
        self.assertIn('characters match', message)
        self.assertIn('<<<HERE>>>', message)
        self.assertIn("String(b.documentType", message)

    def test_a_whitespace_only_difference_is_named_as_such(self):
        message = edit_anchor_failure('backend/api.cjs', 'function normalizePassenger(b) {   ', API)
        self.assertIn('is not present', message)
        self.assertIn('whitespace differs', message)

    def test_the_real_failing_payload_is_rejected_with_a_usable_message_and_writes_nothing(self):
        edits = [{'path': 'backend/api.cjs', 'new': "const VALID_COUNTRY_CODES = ['+86', '+84'];\nconst MAP={};",
                  'old': "const VALID_COUNTRY_CODES = ['+86', '+84'];"},
                 {'path': 'backend/api.cjs',
                  'new': "    documentType: MAP[String(b.documentType || '')],",
                  'old': "    documentType: String(b.documentType || '').trim(),"}]
        with FakeGateway([]) as gateway:
            agent = self.agent(gateway)
            with self.assertRaises(ValueError) as rejected:
                agent.dispatch('patch_and_verify', {'edits': edits,
                                                    'check_command': ['node', '--test', 'checks/x.cjs']})
        self.assertIn('edit 2 of this call', str(rejected.exception))
        self.assertIn('occurs 2 times', str(rejected.exception))
        self.assertEqual((self.out / 'backend/api.cjs').read_text(), API)

    def test_a_missing_key_in_the_real_payload_names_the_edit_and_the_key(self):
        edits = [{'path': 'backend/api.cjs', 'old': "const VALID_COUNTRY_CODES = ['+86', '+84'];",
                  'new': 'const X=1;'},
                 {'new': "    documentType: MAP[b.documentType],",
                  'old': "    documentType: String(b.documentType || '').trim(),"}]
        with FakeGateway([]) as gateway:
            agent = self.agent(gateway)
            with self.assertRaises(ValueError) as rejected:
                agent.dispatch('patch_and_verify', {'edits': edits,
                                                    'check_command': ['node', '--test', 'checks/x.cjs']})
        self.assertIn('Edit 2', str(rejected.exception))
        self.assertIn("'path'", str(rejected.exception))
        self.assertEqual((self.out / 'backend/api.cjs').read_text(), API)


class PatchCreatesAFileTests(TempCase):
    """Bookstack run 2, batch 1: twenty calls, no file written, no verification.

    Patch mode was forced on a batch that had written nothing, the model answered with
    an edit that carried only new text for checks/requirements.cjs, and the edit was
    rejected because the file does not exist.
    """

    def agent(self, gateway):
        scaffold(self.workspace)
        return Agent(RequirementSet.load(self.req),
                     Model(gateway.url, 'synthetic-key', 'synthetic-model', self.trace),
                     self.workspace, Runtime(self.trace))

    def events(self):
        return [json.loads(line) for line in
                (self.trace.directory / 'events.jsonl').read_text().splitlines()]

    def test_an_edit_with_only_new_text_for_a_missing_path_creates_it_and_verifies(self):
        check = ("const test=require('node:test');const assert=require('node:assert/strict');\n"
                 "test('the application answers', async () => {\n"
                 "  const response = await fetch(process.env.FACTORY_BASE_URL);\n"
                 "  assert.equal(response.status, 200);\n});\n")
        with FakeGateway([]) as gateway:
            agent = self.agent(gateway)
            agent.workspace.write_files([{'path': 'frontend/public/index.html',
                                          'content': '<!doctype html><title>x</title><h1>x</h1>'}])
            result = agent.dispatch('patch_and_verify', {
                'edits': [{'path': 'checks/requirements.cjs', 'new': check}],
                'check_command': ['node', '--test', 'checks/requirements.cjs']})
        self.assertEqual((self.out / 'checks' / 'requirements.cjs').read_text(), check)
        self.assertTrue(result['passed'], result.get('error'))
        self.assertEqual(agent.check_command, ['node', '--test', 'checks/requirements.cjs'])
        created = [event for event in self.events() if event['event'] == 'patch_created_files']
        self.assertEqual([event['paths'] for event in created], [['checks/requirements.cjs']])

    def test_a_created_file_that_does_not_parse_is_reported_and_not_verified(self):
        # The same guard write_files runs. A file created here has never been parsed.
        with FakeGateway([]) as gateway:
            agent = self.agent(gateway)
            agent.contract = {'seeds': []}
            result = agent.dispatch('patch_and_verify', {
                'edits': [{'path': 'frontend/public/app.js', 'new': 'function ( {\n'}],
                'check_command': ['node', '--test', 'checks/requirements.cjs']})
        self.assertIn('syntax_errors', result)
        self.assertEqual(result['syntax_errors'][0]['file'], 'frontend/public/app.js')
        self.assertNotIn('passed', result)

    def test_an_anchored_edit_to_a_missing_file_is_still_refused(self):
        with FakeGateway([]) as gateway:
            agent = self.agent(gateway)
            with self.assertRaises(ValueError) as rejected:
                agent.dispatch('patch_and_verify', {
                    'edits': [{'path': 'backend/nothing.cjs', 'old': 'x', 'new': 'y'}],
                    'check_command': ['node', '--test', 'checks/x.cjs']})
        self.assertIn('Edit a file that exists', str(rejected.exception))

    def test_an_edit_with_no_anchor_on_a_file_that_exists_is_still_refused(self):
        with FakeGateway([]) as gateway:
            agent = self.agent(gateway)
            self.workspace.write_files([{'path': 'backend/api.cjs', 'content': API}])
            with self.assertRaises(ValueError) as rejected:
                agent.dispatch('patch_and_verify', {
                    'edits': [{'path': 'backend/api.cjs', 'new': 'const X=1;'}],
                    'check_command': ['node', '--test', 'checks/x.cjs']})
        self.assertIn("needs 'insert_after' or 'old'", str(rejected.exception))
        self.assertEqual((self.out / 'backend/api.cjs').read_text(), API)


class DiagnosisStallTests(TempCase):
    """E056 spent thirteen consecutive read-only calls; 8abb7f040604 spent three."""

    def agent(self, gateway):
        return Agent(RequirementSet.load(self.req),
                     Model(gateway.url, 'synthetic-key', 'synthetic-model', self.trace),
                     self.workspace, Runtime(self.trace))

    def test_running_a_test_bundle_counts_as_acting_and_grep_does_not(self):
        self.assertTrue(is_check_argv(['node', '--test', 'checks/requirements.cjs']))
        self.assertTrue(is_check_argv(['npm', 'test']))
        self.assertFalse(is_check_argv(['grep', '-rn', 'toBeVisible', 'checks/']))
        self.assertFalse(is_check_argv(['node', '-e', 'console.log(1)']))
        self.assertTrue(call_acted([('write_files', {}, {'written': ['a.js']})]))
        self.assertTrue(call_acted([('run', {'argv': ['node', '--test', 'checks/a.cjs']}, {})]))
        self.assertFalse(call_acted([('read_files', {'paths': ['a.js']}, {})]))
        self.assertFalse(call_acted([('run', {'argv': ['grep', 'x', 'a.js']}, {})]))

    def stalling_workspace(self):
        # A tree larger than the bounded snapshot keeps the full tool menu offered,
        # which is the mode every observed diagnosis stall ran in.
        self.workspace.write_files([{'path': 'app.js', 'content': 'const marker="complete-source";\n'},
                                    {'path': 'bulk.js', 'content': '// bulk\n' + 'x' * 30000}])

    def replies(self, payloads):
        replies = []
        for index, payload in enumerate(payloads):
            reply = response([payload])
            for call in reply['choices'][0]['message']['tool_calls']:
                call['id'] = f'step-{index}-' + call['id']
            replies.append(reply)
        return replies

    def events(self):
        return [json.loads(line) for line in
                (self.trace.directory / 'events.jsonl').read_text().splitlines()]

    def test_the_call_after_two_stalls_receives_the_complete_source_it_has_been_reading(self):
        self.stalling_workspace()
        read = ('read_files', {'paths': ['app.js']})
        replies = self.replies([read, read, ('write_files', {'files': [{'path': 'b.js', 'content': 'x'}]}), read])
        with FakeGateway(replies + [response([])]) as gateway:
            agent = self.agent(gateway)
            agent.max_calls = 5
            with self.assertRaises(RuntimeError):
                agent.run_batch(list(RequirementSet.load(self.req).nodes))
        stalls = [e for e in self.events() if e['event'] == 'diagnosis_stall_sources']
        self.assertEqual(len(stalls), 1, stalls)
        self.assertEqual(stalls[0]['consecutive_read_only'], 2)
        self.assertEqual(stalls[0]['files'], ['app.js'])
        # The complete current file and one instruction to act reach the next request.
        sent = json.dumps(gateway.requests[3]['messages'])
        self.assertIn('complete-source', sent)
        self.assertIn('make the edit now', sent)

    def test_the_third_stalled_call_switches_to_the_bounded_repair_path(self):
        self.stalling_workspace()
        read = ('read_files', {'paths': ['app.js']})
        replies = self.replies([read, read, read])
        with FakeGateway(replies + [response([])]) as gateway:
            agent = self.agent(gateway)
            agent.max_calls = 4
            with self.assertRaises(RuntimeError):
                agent.run_batch(list(RequirementSet.load(self.req).nodes))
        events = self.events()
        self.assertEqual([e['consecutive_read_only'] for e in events if e['event'] == 'diagnosis_stall_repair'], [3])
        self.assertTrue([e for e in events if e['event'] == 'prepared_repair_snapshot'
                         and e.get('reason') == 'diagnosis_stall'])
        # Only patch_and_verify remains offered, so the next call cannot read again.
        self.assertEqual([tool['function']['name'] for tool in gateway.requests[-1]['tools']],
                         ['patch_and_verify'])

    def test_a_call_that_writes_or_verifies_resets_the_bound(self):
        self.stalling_workspace()
        read = ('read_files', {'paths': ['app.js']})
        replies = self.replies([read, read, ('write_files', {'files': [{'path': 'b.js', 'content': 'x'}]}), read])
        with FakeGateway(replies + [response([])]) as gateway:
            agent = self.agent(gateway)
            agent.max_calls = 5
            with self.assertRaises(RuntimeError):
                agent.run_batch(list(RequirementSet.load(self.req).nodes))
        events = self.events()
        self.assertEqual([e for e in events if e['event'] == 'diagnosis_stall_repair'], [])
        self.assertEqual(len([e for e in events if e['event'] == 'diagnosis_stall_sources']), 1)


AMBIGUOUS = """<span>Unique User</span><span>Unique User</span>"""
CAPTURABLE = """const test=require('node:test');
test('identity (primary)',async()=>{
  const body=await (await fetch(process.env.FACTORY_BASE_URL)).text();
  if((body.match(/Unique User/g)||[]).length>1)
    throw new Error('strict mode violation: resolved to 2 elements');
});
"""
SCOPED = """const test=require('node:test');
test('identity (primary)',async()=>{});
"""
ACCEPT = """const {test}=require('node:test');const assert=require('node:assert/strict');
test('serves a greeting',async()=>{assert.ok((await (await fetch(process.env.FACTORY_BASE_URL)).text()).length>0);});
"""


@unittest.skipUnless(shutil.which('node') and shutil.which('npm'), 'Node/npm required')
class CapturedCheckAuthorityTests(TempCase):
    """A frozen self-check reports; it does not decide."""

    def freeze(self):
        scaffold(self.workspace)
        self.workspace.retain_failed_prepared_checks = True
        first = implement(self.workspace, AMBIGUOUS, '', CAPTURABLE)
        self.assertFalse(first['passed'])
        self.assertEqual(first['retained_self_check']['cases'], ['identity (primary)'])
        self.assertEqual(first['retained_self_check']['authority'], 'diagnostic_only')
        return ['node', '--test', 'checks/requirements.cjs']

    def suite(self):
        root = (self.base / 'external-acceptance').resolve()
        root.mkdir(exist_ok=True)
        (root / 'accept.cjs').write_text(ACCEPT)
        fingerprint = RequirementSet.load(self.req).fingerprint
        manifest = {'version': 1, 'requirement_fingerprint': fingerprint,
                    'files': {'accept.cjs': hashlib.sha256(ACCEPT.encode()).hexdigest()},
                    'cases': [{'id': 'R1', 'file': 'accept.cjs', 'name': 'serves a greeting',
                               'requirements': ['REQ-1'], 'source': 'requirements.yaml#REQ-1'}]}
        (root / 'contract.json').write_text(json.dumps(manifest))
        return AcceptanceSuite(root / 'contract.json', self.out, fingerprint, ['REQ-1'])

    def test_a_failing_capture_reports_but_does_not_block_the_requirement_assertions(self):
        command = self.freeze()
        # The model scopes its own assertion away. The product is still ambiguous, and the
        # frozen bytes still say so; that is reported, not used as a verdict.
        self.workspace.write_files([{'path': 'checks/requirements.cjs', 'content': SCOPED}])
        verified = self.workspace.verify(command)
        self.assertTrue(verified['passed'], verified)
        report = verified['captured_self_check'][0]
        self.assertEqual(report['status'], 'failed')
        self.assertEqual(report['authority'], 'diagnostic_only')
        self.assertIn('strict mode violation', report['output'])
        self.assertIn('diagnostic evidence, not a verdict', report['instruction'])
        # It is still not evidence that anything is verified.
        self.assertEqual(verified['acceptance']['verified_requirements'], [])
        self.assertEqual(verified['verification_scope'], 'local_checks_only')

    def test_independent_acceptance_decides_over_a_failing_capture(self):
        command = self.freeze()
        self.workspace.write_files([{'path': 'checks/requirements.cjs', 'content': SCOPED}])
        self.workspace.acceptance_suite = self.suite()
        self.workspace.acceptance_requirement_ids = ['REQ-1']
        verified = self.workspace.verify(command)
        self.assertTrue(verified['passed'], verified)
        self.assertEqual(verified['acceptance']['verified_requirements'], ['REQ-1'])
        self.assertEqual(verified['verification_scope'], 'independent_acceptance')
        self.assertEqual(verified['captured_self_check'][0]['status'], 'failed')

    def test_repairing_the_product_makes_the_capture_pass_and_it_is_still_not_a_verdict(self):
        command = self.freeze()
        self.workspace.write_files([{'path': 'checks/requirements.cjs', 'content': SCOPED},
                                    {'path': 'frontend/public/index.html',
                                     'content': '<span>Unique User</span>'}])
        verified = self.workspace.verify(command)
        self.assertTrue(verified['passed'], verified)
        self.assertEqual(verified['captured_self_check'][0]['status'], 'passed')
        self.assertEqual(verified['acceptance']['verified_requirements'], [])

    def test_a_filtered_capture_is_reported_incomplete_rather_than_failing_the_run(self):
        command = self.freeze()
        self.workspace.write_files([{'path': 'checks/requirements.cjs', 'content': SCOPED},
                                    {'path': 'frontend/public/index.html',
                                     'content': '<span>Unique User</span>'}])
        self.workspace.required_checks[0]['argv'][3] = '--test-name-pattern=^absent$'
        verified = self.workspace.verify(command)
        self.assertTrue(verified['passed'], verified)
        report = verified['captured_self_check'][0]
        self.assertEqual(report['status'], 'failed')
        self.assertIn('did not all execute', report['note'])

    def test_an_operator_supplied_required_check_keeps_its_authority(self):
        scaffold(self.workspace)
        self.workspace.write_files([{'path': 'frontend/public/index.html', 'content': '<p>one</p>'},
                                    {'path': 'checks/requirements.cjs', 'content': SCOPED},
                                    {'path': 'checks/operator.cjs', 'content':
                                     "process.exitCode=1;console.error('operator check failed');"}])
        digest = hashlib.sha256((self.out / 'checks/operator.cjs').read_bytes()).hexdigest()
        self.workspace.required_checks.append(
            {'kind': 'external', 'files': {'checks/operator.cjs': digest},
             'argv': ['node', 'checks/operator.cjs']})
        rejected = self.workspace.verify(['node', '--test', 'checks/requirements.cjs'])
        self.assertFalse(rejected['passed'], rejected)
        self.assertEqual(rejected['executed_checks'][0], ['node', 'checks/operator.cjs'])
