"""Contract extraction, seeding idempotence and health gating.

Every requirement package and every model response here is labeled synthetic. These
tests validate that named state survives the extraction and reaches the running
application; they are not evidence about generated product quality, which only an
official run measures.
"""
import json
import os
import time
import unittest
from pathlib import Path
from unittest.mock import patch

from volo import contract as state_contract
from volo import state_runtime
from volo.agent import Agent, CONTRACT_SYSTEM
from volo.requirements import RequirementSet
from volo.trace import Runtime
from volo.web_runtime import scaffold
from test_core import TempCase


# Synthetic requirement package. Its shape copies the published corpus convention —
# a seed row declared as a trailing sentence of a requirement description — without
# reusing any corpus vocabulary, entity or identifier.
SYNTHETIC_PACKAGE = '''id: ROOT
name: Synthetic Ledger
type: FOLDER
description: Synthetic package for harness tests. Not a corpus application.
dependencies: []
children:
  - id: REQ-1
    name: Entry
    type: FOLDER
    description: Landing area.
    dependencies: []
    children:
      - id: REQ-1.1
        name: Open
        type: ATOMIC
        description: Open the application and show the ledger page.
        dependencies: []
  - id: REQ-2
    name: Entries
    type: FOLDER
    description: 'Entry management. The system contains the category "Utilities".'
    dependencies: [REQ-1]
    children:
      - id: REQ-2.1
        name: List entries
        type: ATOMIC
        description: 'Show the entry list. The system contains an entry titled "Opening balance". The system contains an entry titled "Monthly rent".'
        dependencies: [REQ-1.1]
      - id: REQ-2.2
        name: Remove entry
        type: ATOMIC
        description: 'Remove an entry and show the message "Entry removed." The system contains a removable entry titled "Scrap me 2.2".'
        dependencies: [REQ-2.1]
      - id: REQ-2.3
        name: Rename entry
        type: ATOMIC
        description: 'Rename an entry. The system contains a renamable entry titled "Scrap me 2.3".'
        dependencies: [REQ-2.1]
  - id: REQ-3
    name: Preferences
    type: FOLDER
    description: Application preferences.
    dependencies: [REQ-2]
    children:
      - id: REQ-3.1
        name: Currency
        type: ATOMIC
        description: 'Choose a display currency. The system contains the preference "currency" set to "EUR".'
        dependencies: [REQ-1.1]
'''

# A synthetic model response in the *wrong* container shape, matching the shape a real
# gateway returned on 2026-09-14: entities as a mapping, seed fields inline. Normalizing
# it is cheaper than spending a second call to correct the shape.
SYNTHETIC_RESPONSE = json.dumps({
    "version": "1.0",
    "app": "Synthetic Ledger",
    "entities": {
        "entry": {"id": "string", "title": "string", "amount": "number", "removed": "boolean"},
        "category": {"id": "string", "name": "string"},
    },
    "seeds": [
        {"id": "entry-opening", "type": "entry", "title": "Opening balance", "amount": 0},
        {"id": "entry-rent", "type": "entry", "title": "Monthly rent", "amount": 1200},
        {"id": "entry-scrap-2-2", "type": "entry", "title": "Scrap me 2.2", "amount": 1,
         "mutated_by": ["REQ-2.2"]},
        {"id": "entry-scrap-2-3", "type": "entry", "title": "Scrap me 2.3", "amount": 2,
         "mutated_by": ["REQ-2.3"]},
        {"id": "category-utilities", "type": "category", "name": "Utilities",
         "declared_by": "REQ-2"},
        {"id": "preference-currency", "type": "preference", "key": "currency",
         "value": "EUR", "declared_by": "REQ-3.1"},
    ],
    "exact_texts": [{"requirement": "REQ-2.2", "texts": ["Entry removed."]}],
    "navigation": [{"name": "Preferences", "from": "ledger page", "screen": "preferences",
                    "control": "link"}],
    "persistence": ["A removed entry stays removed after a reload."],
    "api": [{"method": "GET", "path": "/api/entries", "purpose": "list entries"}],
    "conventions": ["Entry ids are opaque strings."],
})


class FakeModel:
    """A synthetic transport. It returns one prepared completion and counts usage."""

    def __init__(self, content, prompt_tokens=1000, completion_tokens=500):
        from volo.model import Usage
        self.content = content
        self.usage = Usage()
        self.prompt_tokens, self.completion_tokens = prompt_tokens, completion_tokens
        self.requests = []
        self.model = 'synthetic'
        self.thinking = None

    def complete(self, messages, tools, **kwargs):
        self.requests.append(messages)
        self.usage.calls += 1
        self.usage.prompt_tokens += self.prompt_tokens
        self.usage.completion_tokens += self.completion_tokens
        return {"role": "assistant", "content": self.content}, "stop"


def synthetic_requirements(case):
    (case.req / 'requirements.yaml').write_text(SYNTHETIC_PACKAGE)
    return RequirementSet.load(case.req)


class DeterministicExtractionTests(TempCase):
    def test_quoted_literals_and_seed_sentences_are_recovered_without_a_model(self):
        requirements = synthetic_requirements(self)
        literals = state_contract.quoted_literals(requirements.document)
        texts = {item['text'] for item in literals}
        self.assertEqual(texts, {'Utilities', 'Opening balance', 'Monthly rent',
                                 'Entry removed.', 'Scrap me 2.2', 'Scrap me 2.3',
                                 'currency', 'EUR'})
        # The private row for each mutating requirement stays attributed to it.
        owner = {item['text']: item['requirement'] for item in literals}
        self.assertEqual(owner['Scrap me 2.2'], 'REQ-2.2')
        self.assertEqual(owner['Scrap me 2.3'], 'REQ-2.3')

        sentences = state_contract.seed_sentences(requirements.document)
        self.assertEqual(len(sentences), 6)
        self.assertTrue(all('system contains' in item['sentence'] for item in sentences))

    def test_image_captions_do_not_leak_into_a_seed_sentence(self):
        (self.req / 'requirements.yaml').write_text(
            'id: ROOT\nchildren:\n  - id: REQ-1\n    type: ATOMIC\n'
            '    description: \'Reference image: ![image](./reference/a.png) '
            'The system contains an entry titled "Kept".\'\n')
        sentences = state_contract.seed_sentences(RequirementSet.load(self.req).document)
        self.assertEqual([item['sentence'] for item in sentences],
                         ['The system contains an entry titled "Kept".'])

    def test_an_image_path_is_not_mistaken_for_a_quoted_literal(self):
        (self.req / 'requirements.yaml').write_text(
            'id: ROOT\nchildren:\n  - id: REQ-1\n    type: ATOMIC\n'
            '    description: \'Use "./reference/a.png" and "https://example.invalid" and "Real Label".\'\n')
        literals = state_contract.quoted_literals(RequirementSet.load(self.req).document)
        self.assertEqual([item['text'] for item in literals], ['Real Label'])


class NormalizationTests(TempCase):
    def test_a_mapping_shaped_response_normalizes_without_losing_a_row(self):
        contract = state_contract.normalize(state_contract._as_json_object(SYNTHETIC_RESPONSE))
        self.assertEqual({entity['name'] for entity in contract['entities']}, {'entry', 'category'})
        # A field literally called "name" must not rename its entity.
        category = next(e for e in contract['entities'] if e['name'] == 'category')
        self.assertIn('name', {field['name'] for field in category['fields']})
        self.assertEqual(len(contract['seeds']), 6)
        by_id = {seed['id']: seed for seed in contract['seeds']}
        self.assertEqual(by_id['entry-opening']['collection'], 'entries')
        self.assertEqual(by_id['category-utilities']['collection'], 'categories')
        self.assertEqual(by_id['entry-opening']['data']['title'], 'Opening balance')
        self.assertNotIn('id', by_id['entry-opening']['data'])
        self.assertEqual(by_id['entry-scrap-2-2']['mutated_by'], ['REQ-2.2'])

    def test_a_fenced_response_is_read(self):
        value = state_contract._as_json_object('```json\n{"seeds": []}\n```')
        self.assertEqual(value, {'seeds': []})

    def test_duplicate_seed_ids_are_kept_as_separate_rows(self):
        contract = state_contract.normalize({'seeds': [
            {'id': 'row', 'type': 'entry', 'title': 'First'},
            {'id': 'row', 'type': 'entry', 'title': 'Second'}]})
        self.assertEqual(len({seed['id'] for seed in contract['seeds']}), 2)
        self.assertEqual([seed['data']['title'] for seed in contract['seeds']], ['First', 'Second'])


class ReconciliationTests(TempCase):
    def test_a_dropped_literal_is_reattached_mechanically(self):
        requirements = synthetic_requirements(self)
        facts = state_contract.evidence(requirements)
        # A model that forgets the required message must not silently lose it.
        contract = state_contract.normalize(json.loads(SYNTHETIC_RESPONSE.replace(
            '"Entry removed."', '"paraphrased"')))
        contract = state_contract.reconcile(contract, facts)
        recovered = {text for entry in contract['exact_texts'] for text in entry['texts']}
        self.assertIn('Entry removed.', recovered)
        self.assertGreaterEqual(contract['audit']['quoted_literals_recovered_mechanically'], 1)

    def test_a_dropped_seed_row_is_reported_as_unresolved(self):
        requirements = synthetic_requirements(self)
        facts = state_contract.evidence(requirements)
        partial = json.loads(SYNTHETIC_RESPONSE)
        partial['seeds'] = [seed for seed in partial['seeds'] if seed['id'] != 'entry-scrap-2-3']
        contract = state_contract.reconcile(state_contract.normalize(partial), facts)
        self.assertEqual(contract['audit']['seed_sentences_unresolved'], 1)
        self.assertIn('Scrap me 2.3', contract['unresolved_seed_sentences'][0]['sentence'])
        # It still reaches the batches, so a batch can implement what the model missed.
        self.assertIn('Scrap me 2.3', state_contract.document(contract))

    def test_a_complete_contract_reports_nothing_unresolved(self):
        requirements = synthetic_requirements(self)
        contract = state_contract.reconcile(
            state_contract.normalize(json.loads(SYNTHETIC_RESPONSE)),
            state_contract.evidence(requirements))
        self.assertEqual(contract['audit']['seed_sentences_unresolved'], 0)
        self.assertEqual(contract['audit']['seed_rows'], 6)


class ExtractionCallTests(TempCase):
    def test_one_call_produces_a_reconciled_contract_and_reports_its_cost(self):
        requirements = synthetic_requirements(self)
        model = FakeModel(SYNTHETIC_RESPONSE)
        contract = state_contract.extract(requirements, model, self.trace)
        self.assertEqual(model.usage.calls, 1)
        self.assertEqual(contract['cost'], {'calls': 1, 'tokens': 1500})
        self.assertEqual(contract['audit']['seed_sentences_unresolved'], 0)
        # Acceptance tests never reach the extraction input.
        request = json.dumps(model.requests[0])
        self.assertNotIn('expect(', request)
        self.assertNotIn('getByRole', request)

    def test_a_truncated_extraction_is_refused_rather_than_half_applied(self):
        requirements = synthetic_requirements(self)

        class Truncated(FakeModel):
            def complete(self, messages, tools, **kwargs):
                self.usage.calls += 1
                return {"role": "assistant", "content": '{"seeds": ['}, "length"

        with self.assertRaisesRegex(ValueError, 'output limit'):
            state_contract.extract(requirements, Truncated(''), self.trace)


class BatchingTests(TempCase):
    def test_requirements_are_grouped_by_the_state_they_share(self):
        requirements = synthetic_requirements(self)
        contract = state_contract.reconcile(
            state_contract.normalize(json.loads(SYNTHETIC_RESPONSE)),
            state_contract.evidence(requirements))
        batches = state_contract.state_batches(requirements, contract, max_nodes=2)
        ids = [[node['id'] for node in batch] for batch in batches]
        self.assertEqual(sorted(node for batch in ids for node in batch),
                         sorted(node['id'] for node in requirements.nodes))
        # The two requirements that mutate their own entry row share the entries
        # collection, so they are scheduled together rather than in isolation.
        position = {node: index for index, batch in enumerate(ids) for node in batch}
        self.assertEqual(position['REQ-2.2'], position['REQ-2.3'])

    def test_disjoint_state_is_not_packed_into_one_batch(self):
        requirements = synthetic_requirements(self)
        contract = state_contract.normalize({'seeds': [
            {'id': 'a', 'collection': 'alpha', 'declared_by': 'REQ-2.1', 'title': 'A'},
            {'id': 'b', 'collection': 'beta', 'declared_by': 'REQ-2.2', 'title': 'B'}]})
        batches = state_contract.state_batches(requirements, contract, max_nodes=6)
        position = {node['id']: index for index, batch in enumerate(batches) for node in batch}
        self.assertNotEqual(position['REQ-2.1'], position['REQ-2.2'])

    def test_every_requirement_appears_exactly_once_and_keeps_dependency_order(self):
        requirements = synthetic_requirements(self)
        contract = state_contract.reconcile(
            state_contract.normalize(json.loads(SYNTHETIC_RESPONSE)),
            state_contract.evidence(requirements))
        scheduled = [node['id'] for batch in state_contract.state_batches(requirements, contract)
                     for node in batch]
        self.assertEqual(scheduled, [node['id'] for node in requirements.nodes])


class SeedModuleTests(TempCase):
    def contract(self):
        requirements = synthetic_requirements(self)
        return state_contract.reconcile(
            state_contract.normalize(json.loads(SYNTHETIC_RESPONSE)),
            state_contract.evidence(requirements))

    def test_the_seeder_is_generated_from_the_contract_not_from_a_model(self):
        source = state_runtime.seed_module(self.contract())
        self.assertIn('"Opening balance"', source)
        self.assertIn('"Scrap me 2.2"', source)
        self.assertIn('"entries"', source)
        payload = json.loads(source[source.index('{'):source.rindex('}') + 1])
        self.assertEqual(len(payload['rows']), 6)
        self.assertEqual(sorted(payload['collections']), ['categories', 'entries', 'preferences'])
        self.assertTrue(all(row['id'] for row in payload['rows']))
        self.assertNotIn('id', payload['rows'][0]['data'])

    def test_collections_carry_every_seeded_store_key(self):
        contract = self.contract()
        self.assertEqual(sorted(state_contract.collections(contract)),
                         ['categories', 'entries', 'preferences'])


@unittest.skipUnless(__import__('shutil').which('node'), 'node is required')
class RunningApplicationTests(TempCase):
    """Run the real generated backend and observe seeding, health and persistence."""

    def build(self):
        requirements = synthetic_requirements(self)
        contract = state_contract.reconcile(
            state_contract.normalize(json.loads(SYNTHETIC_RESPONSE)),
            state_contract.evidence(requirements))
        scaffold(self.workspace)
        state_runtime.install(self.workspace, contract)
        self.workspace.write_files([
            {'path': 'frontend/public/index.html', 'content': '<!doctype html><title>L</title><h1>Ledger</h1>'},
            {'path': 'backend/api.cjs', 'content': '''const {store}=require('./state.cjs');
module.exports=async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/api/entries'&&req.method==='GET'){
    res.writeHead(200,{'content-type':'application/json'});
    res.end(JSON.stringify(store.list('entries')));return true;}
  if(url.pathname==='/api/remove'&&req.method==='GET'){
    store.remove('entries',url.searchParams.get('id'));
    res.writeHead(200,{'content-type':'application/json'});res.end('{"ok":true}');return true;}
  return false;};
'''}])
        return contract

    def start(self, port_holder):
        """Start the built backend on an ephemeral port and return its base URL."""
        import socket
        import subprocess
        from volo.launcher import install
        from volo.workspace import tool_environment
        install(self.workspace.root)
        subprocess.run(['node', 'build.cjs'], cwd=self.workspace.root / 'frontend', check=True)
        with socket.socket() as listener:
            listener.bind(('127.0.0.1', 0))
            port = listener.getsockname()[1]
        process = subprocess.Popen(['npm', 'run', 'start'], cwd=self.workspace.root / 'backend',
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                   env=tool_environment({'PORT': str(port)}), start_new_session=True)
        port_holder.append(process)
        return f'http://127.0.0.1:{port}'

    def get(self, url, timeout=10):
        import urllib.error
        import urllib.request
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        end = time.monotonic() + timeout
        last = None
        while time.monotonic() < end:
            try:
                with opener.open(url, timeout=2) as response:
                    return response.status, response.read().decode()
            except urllib.error.HTTPError as exc:
                return exc.code, exc.read().decode()
            except (OSError, urllib.error.URLError) as exc:
                last = exc
                time.sleep(0.1)
        raise AssertionError(f'no response from {url}: {last}')

    def stop(self, processes):
        from volo.workspace import stop_process
        for process in processes:
            stop_process(process)

    def test_health_answers_only_after_seeding_and_seeding_is_idempotent(self):
        self.build()
        processes = []
        try:
            url = self.start(processes)
            status, body = self.get(url + '/api/health')
            self.assertEqual(status, 200)
            self.assertIn('Backend Ready', body)
            # Ready means the rows are already there, not that they are on their way.
            status, body = self.get(url + '/api/entries')
            titles = [row['title'] for row in json.loads(body)]
            self.assertEqual(sorted(titles), ['Monthly rent', 'Opening balance',
                                              'Scrap me 2.2', 'Scrap me 2.3'])
            self.get(url + '/api/remove?id=entry-scrap-2-2')
        finally:
            self.stop(processes)

        processes = []
        try:
            url = self.start(processes)
            self.assertEqual(self.get(url + '/api/health')[0], 200)
            titles = [row['title'] for row in json.loads(self.get(url + '/api/entries')[1])]
            # A second start duplicates nothing and does not resurrect a deleted row.
            self.assertEqual(sorted(titles), ['Monthly rent', 'Opening balance', 'Scrap me 2.3'])
        finally:
            self.stop(processes)

    def test_health_reports_503_when_seeding_fails(self):
        self.build()
        (self.workspace.root / 'backend' / 'seed.cjs').write_text(
            "'use strict';\nthrow new Error('synthetic seed failure');\n")
        processes = []
        try:
            url = self.start(processes)
            status, body = self.get(url + '/api/health')
            self.assertEqual(status, 503)
            self.assertIn('Backend not ready', body)
        finally:
            self.stop(processes)

    def test_verification_refuses_an_application_whose_health_never_reports_ready(self):
        self.build()
        # Seeding that never commits is exactly the failure the gate exists for. The
        # application is refused before any check runs, and the diagnosis names the path
        # the organizers' entrypoint polls rather than a generic startup message.
        (self.workspace.root / 'backend' / 'state.cjs').write_text(
            "'use strict';\nmodule.exports={ready:new Promise(()=>{}),store:{}};\n")
        self.workspace.write_files([{'path': 'checks/batch-1.spec.cjs',
                                     'content': "require('node:test').test('n', () => {});\n"}])
        self.workspace.deadline = time.monotonic() + 25
        result = self.workspace.verify(['node', '--test', 'checks/batch-1.spec.cjs'])
        self.assertFalse(result['passed'])
        self.assertIn('/api/health', result['error'])
        self.assertFalse(result['startup_health']['ready'])

    def test_an_application_without_startup_state_is_not_health_gated(self):
        scaffold(self.workspace)
        self.workspace.write_files([
            {'path': 'frontend/public/index.html', 'content': '<!doctype html><title>P</title><h1>Plain</h1>'},
            {'path': 'checks/plain.test.cjs', 'content':
                "const test=require('node:test');const assert=require('node:assert/strict');\n"
                "test('serves', async () => {\n"
                "  const r = await fetch(process.env.FACTORY_BASE_URL);\n"
                "  assert.equal(r.status, 200);\n});\n"}])
        self.assertFalse((self.workspace.root / 'backend' / 'state.cjs').exists())
        result = self.workspace.verify(['node', '--test', 'checks/plain.test.cjs'])
        self.assertTrue(result['passed'], result.get('error'))
        self.assertNotIn('startup_health', result)


class AgentWiringTests(TempCase):
    def contract(self, requirements):
        return state_contract.reconcile(
            state_contract.normalize(json.loads(SYNTHETIC_RESPONSE)),
            state_contract.evidence(requirements))

    def test_the_contract_reaches_every_batch_verbatim(self):
        requirements = synthetic_requirements(self)
        contract = self.contract(requirements)
        agent = Agent(requirements, None, self.workspace, Runtime(self.trace), contract=contract)
        for batch in agent.schedule():
            for inline in (False, True):
                agent.inline_source = inline
                request = agent.batch_request(batch)
                self.assertIn('Opening balance', request)
                self.assertIn('Scrap me 2.2', request)
                self.assertIn('GLOBAL STATE CONTRACT', request)

    def test_a_single_batch_package_takes_the_unchanged_path(self):
        requirements = RequirementSet.load(self.req)
        self.assertEqual(len(requirements.batches()), 1)
        agent = Agent(requirements, None, self.workspace, Runtime(self.trace))
        self.assertIsNone(agent.contract_text)
        self.assertEqual(agent.schedule(), requirements.batches())
        self.assertNotIn('GLOBAL STATE CONTRACT', agent.batch_request(requirements.nodes))

    def test_installing_the_contract_writes_the_seeder_and_keeps_it_out_of_git(self):
        requirements = synthetic_requirements(self)
        agent = Agent(requirements, None, self.workspace, Runtime(self.trace),
                      contract=self.contract(requirements))
        agent.install_contract()
        for name in ('backend/seed.cjs', 'backend/state.cjs', 'backend/server.cjs',
                     'frontend/package.json', 'backend/package.json'):
            self.assertTrue((self.workspace.root / name).is_file(), name)
        self.assertIn('Opening balance', (self.workspace.root / 'backend/seed.cjs').read_text())
        self.assertIn(state_runtime.DATA_DIRECTORY,
                      (self.workspace.root / '.gitignore').read_text())
        self.assertTrue((self.trace.directory / 'state-contract.json').is_file())

    def test_the_contract_system_prompt_states_the_store_and_regression_rules(self):
        self.assertIn('checks/<batch>.spec.cjs', CONTRACT_SYSTEM)
        self.assertIn("require('./state.cjs')", CONTRACT_SYSTEM)
        self.assertIn('/api/health', CONTRACT_SYSTEM)


class RuntimeStateExclusionTests(TempCase):
    def test_rows_written_at_runtime_do_not_change_the_source_fingerprint(self):
        self.workspace.write_files([{'path': 'backend/api.cjs', 'content': 'x'}])
        before = self.workspace.fingerprint()
        target = self.workspace.root / state_runtime.DATA_DIRECTORY
        target.mkdir(parents=True, exist_ok=True)
        (target / 'store.json').write_text('{"collections":{"entries":[]}}')
        self.assertEqual(before, self.workspace.fingerprint())
        self.assertNotIn(state_runtime.DATA_DIRECTORY,
                         [item['path'] for item in self.workspace.list_files()['files']])


if __name__ == '__main__':
    unittest.main()


@unittest.skipUnless(__import__('shutil').which('node'), 'node is required')
class WriteTimeSyntaxTests(TempCase):
    def agent(self):
        requirements = synthetic_requirements(self)
        contract = state_contract.reconcile(
            state_contract.normalize(json.loads(SYNTHETIC_RESPONSE)),
            state_contract.evidence(requirements))
        agent = Agent(requirements, None, self.workspace, Runtime(self.trace), contract=contract)
        agent.install_contract()
        return agent

    def test_a_broken_file_is_diagnosed_by_the_parser_at_write_time(self):
        agent = self.agent()
        result = agent.dispatch('write_files', {'files': [
            {'path': 'frontend/public/app.js', 'content': 'const a = {;\n'}]})
        self.assertEqual([item['file'] for item in result['syntax_errors']],
                         ['frontend/public/app.js'])
        self.assertIn('app.js', result['syntax_errors'][0]['error'])

    def test_valid_files_pass_through_untouched(self):
        agent = self.agent()
        result = agent.dispatch('write_files', {'files': [
            {'path': 'frontend/public/app.js', 'content': 'const a = 1;\n'},
            {'path': 'frontend/public/index.html', 'content': '<!doctype html><title>a</title>'}]})
        self.assertNotIn('syntax_errors', result)

    def test_a_package_without_a_contract_is_not_syntax_checked(self):
        requirements = RequirementSet.load(self.req)
        agent = Agent(requirements, None, self.workspace, Runtime(self.trace))
        scaffold(self.workspace)
        result = agent.dispatch('write_files', {'files': [
            {'path': 'frontend/public/app.js', 'content': 'const a = {;\n'}]})
        self.assertNotIn('syntax_errors', result)


class ToolShapeTests(TempCase):
    def test_a_single_file_write_is_executed_rather_than_rejected(self):
        self.assertEqual(
            state_runtime.coerce_file_batch({'path': 'a.js', 'content': 'x'}),
            {'files': [{'path': 'a.js', 'content': 'x'}]})
        self.assertEqual(
            state_runtime.coerce_file_batch({'files': {'path': 'a.js', 'content': 'x'}}),
            {'files': [{'path': 'a.js', 'content': 'x'}]})

    def test_an_extra_argument_does_not_discard_the_write(self):
        self.assertEqual(
            state_runtime.coerce_file_batch(
                {'files': [{'path': 'a.js', 'content': 'x'}], 'check_command': ['node', 'a.js']}),
            {'files': [{'path': 'a.js', 'content': 'x'}]})

    def test_the_normal_shape_is_untouched(self):
        args = {'files': [{'path': 'a.js', 'content': 'x'}]}
        self.assertIs(state_runtime.coerce_file_batch(args), args)


class SourceDeliveryTests(TempCase):
    def test_product_source_is_delivered_without_the_harness_runtime_files(self):
        requirements = synthetic_requirements(self)
        contract = state_contract.reconcile(
            state_contract.normalize(json.loads(SYNTHETIC_RESPONSE)),
            state_contract.evidence(requirements))
        agent = Agent(requirements, None, self.workspace, Runtime(self.trace), contract=contract)
        agent.install_contract()
        agent.dispatch('write_files', {'files': [
            {'path': 'frontend/public/app.js', 'content': 'const marker = "product code";\n'}]})
        source = agent.contract_source()
        self.assertIn('frontend/public/app.js', source)
        for name in state_runtime.HARNESS_OWNED:
            self.assertNotIn(name, source)
        request = agent.batch_request(requirements.nodes[:1])
        self.assertIn('product code', request)
        self.assertNotIn('Harness-managed shared state', request)


class HarnessReadTests(TempCase):
    def agent(self):
        requirements = synthetic_requirements(self)
        contract = state_contract.reconcile(
            state_contract.normalize(json.loads(SYNTHETIC_RESPONSE)),
            state_contract.evidence(requirements))
        agent = Agent(requirements, None, self.workspace, Runtime(self.trace), contract=contract)
        agent.install_contract()
        return agent

    def test_reading_a_harness_file_returns_its_contract_not_its_bytes(self):
        agent = self.agent()
        result = agent.dispatch('read_files', {'paths': ['backend/state.cjs', 'backend/seed.cjs']})
        self.assertEqual(sorted(result['files']), ['backend/seed.cjs', 'backend/state.cjs'])
        self.assertNotIn('Object.assign', json.dumps(result))
        self.assertIn('state contract', result['files']['backend/seed.cjs'])
        chunk = agent.dispatch('read_file_chunk', {'path': 'backend/seed.cjs'})
        self.assertIn('backend/seed.cjs', chunk['files'])

    def test_reading_product_source_is_unaffected(self):
        agent = self.agent()
        agent.dispatch('write_files', {'files': [
            {'path': 'backend/api.cjs', 'content': 'module.exports=async()=>false;\n'}]})
        result = agent.dispatch('read_files', {'paths': ['backend/api.cjs']})
        self.assertIn('module.exports', json.dumps(result))
        mixed = agent.dispatch('read_files', {'paths': ['backend/api.cjs', 'backend/state.cjs']})
        self.assertNotIn('note', mixed)

    def test_a_package_without_a_contract_reads_normally(self):
        requirements = RequirementSet.load(self.req)
        agent = Agent(requirements, None, self.workspace, Runtime(self.trace))
        scaffold(self.workspace)
        result = agent.dispatch('read_files', {'paths': ['backend/server.cjs']})
        self.assertIn('createServer', json.dumps(result))


class GatewayRetryTests(TempCase):
    """A long multi-batch run must survive one transient proxy error."""

    def transport(self, status, attempts=3):
        import io
        import urllib.request
        from urllib.error import HTTPError
        from volo.model import Model, ModelError
        model = Model("https://gateway.example/v1", "synthetic-test-key", "test",
                      self.trace, max_attempts=attempts)
        error = HTTPError(model.url, status, "synthetic", {}, io.BytesIO(b'{}'))
        with patch("urllib.request.urlopen", side_effect=error) as request, patch("time.sleep"):
            with self.assertRaises(ModelError):
                model.complete([{"role": "user", "content": "synthetic"}], [])
        return request.call_count

    def test_a_gateway_proxy_error_is_retried(self):
        for status in (429, 502, 503, 504):
            self.assertEqual(self.transport(status), 3, f"status {status}")

    def test_a_request_error_is_not_retried(self):
        for status in (400, 401, 404, 500):
            self.assertEqual(self.transport(status), 1, f"status {status}")

    def test_a_single_attempt_transport_still_makes_one_request(self):
        self.assertEqual(self.transport(502, attempts=1), 1)


class ServingDiagnosisTests(TempCase):
    def test_a_handler_that_never_returns_false_is_named(self):
        self.workspace.write_files([{'path': 'backend/api.cjs', 'content':
            "module.exports=async(req,res)=>{res.writeHead(404);res.end();return true;};\n"}])
        diagnosis = self.workspace.serving_diagnosis()
        self.assertIn('never returns false', diagnosis)
        self.assertIn('index.html does not exist', diagnosis)

    def test_a_correct_handler_and_a_built_document_produce_no_diagnosis(self):
        self.workspace.write_files([
            {'path': 'backend/api.cjs', 'content': 'module.exports=async()=>{return false;};\n'},
            {'path': 'frontend/dist/index.html', 'content': '<!doctype html><title>a</title>'}])
        self.assertEqual(self.workspace.serving_diagnosis(), '')

    def test_the_api_contract_is_stated_to_the_model(self):
        self.assertIn('return false', state_runtime.STORE_CONTRACT)
        self.assertIn('async (req, res) => boolean', state_runtime.STORE_CONTRACT)


class DocumentHygieneTests(TempCase):
    def test_the_internal_mapping_sentinel_never_reaches_a_batch(self):
        contract = state_contract.normalize({
            'navigation': {'Trash': {'from': 'home', 'control': 'link'}},
            'api': {'/api/notes': {'method': 'GET'}},
            'entities': {'note': {'title': 'string'}},
            'seeds': [{'id': 'a', 'type': 'note', 'title': 'A'}]})
        text = state_contract.document(state_contract.reconcile(
            contract, {'quoted_literals': [], 'declared_seed_sentences': []}))
        self.assertNotIn(state_contract.KEY, text)
        self.assertIn('Trash', text)
        self.assertIn('/api/notes', text)


class PromptRuleRetentionTests(TempCase):
    """The contract supplement adds to the system prompt; it must not replace its rules."""

    def system_prompt(self):
        from volo.agent import SYSTEM
        return SYSTEM + CONTRACT_SYSTEM

    def test_the_rules_ticket_depends_on_survive_in_contract_mode(self):
        prompt = self.system_prompt()
        for rule in (
                'never navigate the browser yourself',      # nav-race
                'history.replaceState',                     # nav-race remedy
                'accessible name',                          # accessible names
                'role="alert"',                             # visible validation
                'meter',                                    # named level indicator
                'process.env.PORT',                         # runner contract
        ):
            self.assertIn(rule, prompt, rule)

    def test_the_supplement_is_additive_not_a_replacement(self):
        from volo.agent import SYSTEM
        self.assertTrue(self.system_prompt().startswith(SYSTEM))


class SourceBudgetTests(TempCase):
    """The delivered source must leave room for the checkpoint that carries it."""

    def agent(self):
        requirements = synthetic_requirements(self)
        contract = state_contract.reconcile(
            state_contract.normalize(json.loads(SYNTHETIC_RESPONSE)),
            state_contract.evidence(requirements))
        agent = Agent(requirements, None, self.workspace, Runtime(self.trace), contract=contract)
        agent.install_contract()
        return agent

    def test_a_large_application_still_fits_the_context_checkpoint(self):
        agent = self.agent()
        agent.dispatch('write_files', {'files': [
            {'path': f'frontend/public/part{index}.js', 'content': f'// part {index}\n' + 'x'.ljust(30000, 'y') + '\n'}
            for index in range(6)]})
        self.assertGreater(sum(len(p.read_text()) for p in
                               (self.workspace.root / 'frontend' / 'public').iterdir()), 150000)
        source = agent.contract_source()
        self.assertLessEqual(sum(len(v) for v in source.values()),
                             agent.source_budget() + 400)
        self.assertIn('_omitted_from_this_listing', source)
        checkpoint = agent.context_checkpoint(requirements_nodes(agent), 'system', None)
        from volo.context import size
        self.assertLess(size(checkpoint), agent.max_context_chars)

    def test_earlier_batches_checks_are_not_re_delivered(self):
        agent = self.agent()
        agent.dispatch('write_files', {'files': [
            {'path': 'checks/batch-1.spec.cjs', 'content': '// earlier batch check\n'},
            {'path': 'frontend/public/app.js', 'content': '// product\n'}]})
        source = agent.contract_source()
        self.assertIn('frontend/public/app.js', source)
        self.assertNotIn('checks/batch-1.spec.cjs', source)


def requirements_nodes(agent):
    return agent.requirements.nodes[:1]


class VocabularyModuleTests(TempCase):
    def contract(self):
        requirements = synthetic_requirements(self)
        return state_contract.reconcile(
            state_contract.normalize(json.loads(SYNTHETIC_RESPONSE)),
            state_contract.evidence(requirements))

    def test_the_vocabulary_carries_requirement_words_and_observed_headings(self):
        source = state_runtime.vocabulary_module(self.contract(), ['Synthetic', 'Heading'])
        self.assertIn('"Entry removed."', source)   # an exact_texts string
        self.assertIn('"Opening balance"', source)  # a seed value
        self.assertIn('"Preferences"', source)      # a navigation name
        self.assertIn('"Heading"', source)          # observed only in a reference image
        self.assertIn('module.exports = {terms, matches}', source)

    def test_an_empty_contract_produces_a_loadable_module(self):
        source = state_runtime.vocabulary_module({})
        self.assertIn('const terms = []', source)


@unittest.skipUnless(os.getenv('FACTORY_TEST_PLAYWRIGHT_MODULE')
                     and os.getenv('FACTORY_TEST_CHROMIUM_EXECUTABLE'),
                     'Provide an installed Playwright module and Chromium for real browser checks')
class InterfaceCheckTests(TempCase):
    """The harness-owned check that encodes the two defects the rehearsal measured."""

    def enable_installed_browser(self):
        module = os.environ['FACTORY_TEST_PLAYWRIGHT_MODULE']
        executable = os.environ['FACTORY_TEST_CHROMIUM_EXECUTABLE']
        wrapper = self.base / 'real-browser.cjs'
        wrapper.write_text('const pw=require(' + json.dumps(module) + ');'
            'module.exports={chromium:{launch:()=>pw.chromium.launch({headless:true,executablePath:'
            + json.dumps(executable) + '})}};')
        self.workspace.runtime_env['FACTORY_PLAYWRIGHT_MODULE'] = str(wrapper)

    def build(self, body):
        self.enable_installed_browser()
        requirements = synthetic_requirements(self)
        contract = state_contract.reconcile(
            state_contract.normalize(json.loads(SYNTHETIC_RESPONSE)),
            state_contract.evidence(requirements))
        scaffold(self.workspace)
        state_runtime.install(self.workspace, contract)
        self.workspace.write_files([
            {'path': 'frontend/public/index.html',
             'content': '<!doctype html><title>L</title><main>' + body + '</main>'},
            {'path': 'backend/api.cjs', 'content': 'module.exports=async()=>{return false;};\n'}])
        return contract

    def run_check(self):
        self.workspace.deadline = time.monotonic() + 90
        return self.workspace.verify(['node', '--test', state_runtime.INTERFACE_CHECK_PATH])

    def test_two_visible_controls_sharing_a_name_fail(self):
        # Exactly the Keep defect: one "More options" per row, nineteen of them.
        rows = ''.join(f'<li>Row {index}<button aria-label="More options">x</button></li>'
                       for index in range(3))
        self.build(f'<ul>{rows}</ul>')
        result = self.run_check()
        self.assertFalse(result['passed'])
        output = str((result['steps'] or [{}])[-1].get('output', ''))
        self.assertIn('share one accessible name', output)
        self.assertIn('more options', output.lower())

    def test_row_scoped_names_pass(self):
        rows = ''.join(f'<li>Row {index}<button aria-label="More options for Row {index}">x</button></li>'
                       for index in range(3))
        self.build(f'<ul>{rows}</ul>')
        self.assertTrue(self.run_check()['passed'])

    def test_actions_hidden_until_hover_pass(self):
        # The other permitted shape: the actions exist but only one is ever visible.
        rows = ''.join(f'<li>Row {index}'
                       f'<button aria-label="More options" style="display:none">x</button></li>'
                       for index in range(3))
        self.build(f'<ul>{rows}</ul>')
        self.assertTrue(self.run_check()['passed'])

    def test_an_unnamed_input_fails(self):
        self.build('<form><input type="text"></form>')
        result = self.run_check()
        self.assertFalse(result['passed'])
        self.assertIn('no accessible name', str((result['steps'] or [{}])[-1].get('output', '')))

    def test_a_named_input_passes(self):
        self.build('<form><label for="a">Title</label><input id="a" type="text"></form>')
        self.assertTrue(self.run_check()['passed'])

    def test_an_unnamed_meter_fails(self):
        self.build('<meter min="0" max="4" value="1"></meter>')
        self.assertFalse(self.run_check()['passed'])

    def test_a_name_outside_the_vocabulary_is_reported_and_not_failed(self):
        # A soft signal must never start a repair loop; it is printed, not asserted.
        self.build('<button aria-label="Frobnicate">x</button>')
        result = self.run_check()
        self.assertTrue(result['passed'], result.get('error'))
        output = ''.join(str(step.get('output', '')) for step in result['steps'])
        self.assertIn('matching no requirement text', output)
        self.assertIn('Frobnicate', output)

    def test_the_rules_are_stated_to_the_model(self):
        self.assertIn('No two controls visible at the same time', state_runtime.STORE_CONTRACT)
        self.assertIn('More options for Delete me 2.3.1', state_runtime.STORE_CONTRACT)
        self.assertIn('aria-label', state_runtime.STORE_CONTRACT)


class ScheduleCompletionTests(TempCase):
    """A batch that cannot converge must not cost the batches after it their turn."""

    def agent(self, failing=()):
        requirements = synthetic_requirements(self)
        contract = state_contract.reconcile(
            state_contract.normalize(json.loads(SYNTHETIC_RESPONSE)),
            state_contract.evidence(requirements))
        agent = Agent(requirements, FakeModel('{}'), self.workspace, Runtime(self.trace),
                      contract=contract)
        agent.install_contract()
        self.attempted = []

        def run_batch(nodes):
            ids = [node['id'] for node in nodes]
            self.attempted.append(ids)
            if any(item in failing for item in ids):
                raise RuntimeError('synthetic: batch did not converge')
            agent.check_command = ['node', '--test', 'checks/batch.spec.cjs']
            self.workspace.last_verification = {
                'passed': True, 'source_fingerprint': self.workspace.fingerprint(),
                'check_command': agent.check_command, 'verification_scope': 'local_checks_only',
                'acceptance': {}}

        agent.run_batch = run_batch
        return agent

    def scheduled(self, agent):
        return [[node['id'] for node in batch] for batch in agent.schedule()]

    def test_a_batch_that_does_not_converge_does_not_end_the_schedule(self):
        agent = self.agent(failing={'REQ-2.1'})
        agent.run_schedule()
        self.assertEqual(self.attempted, self.scheduled(agent))
        self.assertEqual([record['requirements'] for record in agent.incomplete],
                         [batch for batch in self.scheduled(agent) if 'REQ-2.1' in batch])
        # Its requirements are not claimed as completed, but everything else is.
        self.assertNotIn('REQ-2.1', agent.completed)
        self.assertIn('REQ-3.1', agent.completed)

    def test_budget_exhaustion_stops_the_schedule_and_is_recorded(self):
        agent = self.agent(failing={'REQ-2.2'})

        def run_batch(nodes):
            self.attempted.append([node['id'] for node in nodes])
            raise RuntimeError('Model call budget exhausted')

        agent.run_batch = run_batch
        agent.run_schedule()
        self.assertEqual(len(self.attempted), 1, 'the schedule stops at the first exhaustion')
        events = [json.loads(line) for line in
                  (self.trace.directory / 'events.jsonl').read_text().splitlines()]
        self.assertTrue(any(event['event'] == 'schedule_stopped_on_budget' for event in events))

    def test_a_wall_clock_timeout_also_stops_the_schedule(self):
        agent = self.agent()

        def run_batch(nodes):
            self.attempted.append([node['id'] for node in nodes])
            raise TimeoutError('Agent wall-time budget exhausted')

        agent.run_batch = run_batch
        agent.run_schedule()
        self.assertEqual(len(self.attempted), 1)

    def test_a_package_without_a_contract_still_fails_fast(self):
        requirements = RequirementSet.load(self.req)
        agent = Agent(requirements, FakeModel('{}'), self.workspace, Runtime(self.trace))

        def run_batch(nodes):
            raise RuntimeError('synthetic failure')

        agent.run_batch = run_batch
        with self.assertRaisesRegex(RuntimeError, 'synthetic failure'):
            agent.run_schedule()


@unittest.skipUnless(__import__('shutil').which('node'), 'node is required')
class SnapshotDeliveryTests(TempCase):
    """Exhaustion delivers the best tree that verified, not whatever was half-written."""

    def agent(self):
        requirements = synthetic_requirements(self)
        contract = state_contract.reconcile(
            state_contract.normalize(json.loads(SYNTHETIC_RESPONSE)),
            state_contract.evidence(requirements))
        agent = Agent(requirements, FakeModel('{}'), self.workspace, Runtime(self.trace),
                      contract=contract)
        agent.install_contract()
        return agent

    def test_a_verified_tree_is_snapshotted_and_restored_over_a_broken_one(self):
        agent = self.agent()
        self.workspace.write_files([
            {'path': 'frontend/public/index.html', 'content': '<!doctype html><title>good</title>'},
            {'path': 'backend/api.cjs', 'content': '// good\nmodule.exports=async()=>false;\n'}])
        self.workspace.last_verification = {
            'passed': True, 'source_fingerprint': self.workspace.fingerprint(),
            'check_command': ['node', '--test', 'checks/a.spec.cjs'], 'acceptance': {}}
        self.assertTrue(agent.snapshot_product())

        # A later batch half-writes the application and never verifies.
        self.workspace.write_files([{'path': 'backend/api.cjs', 'content': '// broken'}])
        self.assertTrue(agent.deliver_best_snapshot())
        self.assertIn('// good', (self.workspace.root / 'backend' / 'api.cjs').read_text())
        self.assertEqual(agent.check_command, ['node', '--test', 'checks/a.spec.cjs'])

    def test_nothing_is_restored_when_the_tree_already_matches_a_verification(self):
        agent = self.agent()
        self.workspace.write_files([{'path': 'backend/api.cjs', 'content': '// current\n'}])
        self.workspace.last_verification = {
            'passed': True, 'source_fingerprint': self.workspace.fingerprint(),
            'check_command': ['node', '--test', 'checks/a.spec.cjs'], 'acceptance': {}}
        agent.snapshot_product()
        self.assertFalse(agent.deliver_best_snapshot())
        self.assertIn('// current', (self.workspace.root / 'backend' / 'api.cjs').read_text())

    def test_an_unverified_tree_is_never_snapshotted(self):
        agent = self.agent()
        self.workspace.last_verification = None
        self.assertFalse(agent.snapshot_product())
        self.assertFalse(agent.snapshot_path().exists())
