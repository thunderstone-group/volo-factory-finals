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
from test_core import ROOT, TempCase


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


class BatchFeatureFileTests(TempCase):
    """The instruction that stops one frontend file from growing past the read bound.

    Measured: in the 2026-09-14 Keep generation frontend/public/app.js went from 17.6 KB
    to 25.7 KB, and every batch after it opened with a read of that file that the
    12000-byte bound refused.
    """

    def test_the_supplement_asks_each_batch_for_its_own_feature_file(self):
        self.assertIn('frontend/public/features/', CONTRACT_SYSTEM)
        self.assertIn('index.html', CONTRACT_SYSTEM)
        self.assertIn("another batch's feature file", CONTRACT_SYSTEM)

    def test_the_supplement_reaches_the_model_on_the_contract_path(self):
        requirements = synthetic_requirements(self)
        contract = state_contract.reconcile(
            state_contract.normalize(json.loads(SYNTHETIC_RESPONSE)),
            state_contract.evidence(requirements))
        agent = Agent(requirements, None, self.workspace, Runtime(self.trace), contract=contract)
        model = FakeModel('no tool call')
        agent.model = model
        agent.max_calls = 1
        with self.assertRaises(Exception):
            agent.run_batch(requirements.nodes[:1])
        system = model.requests[0][0]['content']
        self.assertIn('frontend/public/features/', system)


class RegressionCheckOwnershipTests(TempCase):
    """An earlier batch's check is answered by what it covers, and cannot be edited.

    Synthetic reproduction of the measured waste: in one Keep generation the model
    opened nearly every batch by reading every earlier checks/batch-N.spec.cjs, and by
    batch 11 four of those files alone exceeded the 12000-byte read bound. One further
    call was spent on an edit to an earlier batch's check whose anchor did not match.
    """

    def agent(self):
        requirements = synthetic_requirements(self)
        contract = state_contract.reconcile(
            state_contract.normalize(json.loads(SYNTHETIC_RESPONSE)),
            state_contract.evidence(requirements))
        agent = Agent(requirements, None, self.workspace, Runtime(self.trace), contract=contract)
        agent.install_contract()
        return agent

    def finished_batch(self, agent, path, requirements, content="// synthetic check\n"):
        agent.batch_index += 1
        agent.dispatch('write_files', {'files': [{'path': path, 'content': content}]})
        agent.record_batch_checks(requirements)

    def test_a_finished_batch_check_is_read_as_a_summary_not_as_bytes(self):
        agent = self.agent()
        self.finished_batch(agent, 'checks/batch-1.spec.cjs', ['REQ-1.1'],
                            "// synthetic check body\n" * 400)
        agent.batch_index += 1
        answer = agent.dispatch('read_files', {'paths': ['checks/batch-1.spec.cjs']})
        self.assertNotIn('synthetic check body', json.dumps(answer))
        summary = answer['files']['checks/batch-1.spec.cjs']
        self.assertIn('REQ-1.1', summary)
        self.assertIn('checks/batch-2.spec.cjs', summary)
        self.assertIn('regression check', summary)

    def test_the_batch_writing_a_check_can_still_read_and_rewrite_it(self):
        agent = self.agent()
        agent.batch_index = 1
        agent.dispatch('write_files', {'files': [
            {'path': 'checks/batch-1.spec.cjs', 'content': '// mine\n'}]})
        agent.record_batch_checks(['REQ-1.1'])
        answer = agent.dispatch('read_files', {'paths': ['checks/batch-1.spec.cjs']})
        self.assertEqual(answer['checks/batch-1.spec.cjs'], '// mine\n')
        agent.dispatch('write_files', {'files': [
            {'path': 'checks/batch-1.spec.cjs', 'content': '// mine, revised\n'}]})
        self.assertIn('revised', (self.workspace.root / 'checks/batch-1.spec.cjs').read_text())

    def test_a_mixed_read_still_returns_the_product_file_verbatim(self):
        agent = self.agent()
        self.finished_batch(agent, 'checks/batch-1.spec.cjs', ['REQ-1.1'])
        agent.batch_index += 1
        agent.dispatch('write_files', {'files': [
            {'path': 'frontend/public/features/entries.js', 'content': 'const marker = 1;\n'}]})
        answer = agent.dispatch('read_files', {'paths': [
            'checks/batch-1.spec.cjs', 'frontend/public/features/entries.js']})
        self.assertIn('const marker = 1;', answer['files']['frontend/public/features/entries.js'])
        self.assertIn('REQ-1.1', answer['files']['checks/batch-1.spec.cjs'])

    def test_an_edit_of_a_finished_batch_check_is_refused_and_names_the_remedy(self):
        agent = self.agent()
        self.finished_batch(agent, 'checks/batch-1.spec.cjs', ['REQ-1.1'])
        agent.batch_index += 1
        with self.assertRaises(ValueError) as refused:
            agent.dispatch('edit', {'path': 'checks/batch-1.spec.cjs',
                                    'old': '// synthetic check', 'new': '// weakened'})
        self.assertIn('Fix the application', str(refused.exception))
        self.assertIn('checks/batch-2.spec.cjs', str(refused.exception))
        self.assertIn('// synthetic check',
                      (self.workspace.root / 'checks/batch-1.spec.cjs').read_text())

    def test_a_write_keeps_the_product_files_and_withholds_only_the_locked_check(self):
        agent = self.agent()
        self.finished_batch(agent, 'checks/batch-1.spec.cjs', ['REQ-1.1'])
        agent.batch_index += 1
        result = agent.dispatch('write_files', {'files': [
            {'path': 'checks/batch-1.spec.cjs', 'content': '// weakened\n'},
            {'path': 'backend/api.cjs', 'content': 'module.exports=async()=>false;\n'}]})
        self.assertEqual(result['written'], ['backend/api.cjs'])
        self.assertIn('checks/batch-1.spec.cjs', result['refused'])
        self.assertIn('// synthetic check',
                      (self.workspace.root / 'checks/batch-1.spec.cjs').read_text())

    def test_a_write_of_only_a_locked_check_is_refused_with_the_reason(self):
        agent = self.agent()
        self.finished_batch(agent, 'checks/batch-1.spec.cjs', ['REQ-1.1'])
        agent.batch_index += 1
        with self.assertRaises(ValueError) as refused:
            agent.dispatch('write_files', {'files': [
                {'path': 'checks/batch-1.spec.cjs', 'content': '// weakened\n'}]})
        self.assertIn('Fix the application', str(refused.exception))

    def test_a_package_without_a_contract_locks_nothing(self):
        requirements = RequirementSet.load(self.req)
        agent = Agent(requirements, None, self.workspace, Runtime(self.trace))
        agent.batch_index = 1
        agent.dispatch('write_files', {'files': [
            {'path': 'checks/batch-1.spec.cjs', 'content': '// synthetic\n'}]})
        self.assertEqual(agent.record_batch_checks(['REQ-1']), [])
        agent.batch_index += 1
        answer = agent.dispatch('read_files', {'paths': ['checks/batch-1.spec.cjs']})
        self.assertEqual(answer['checks/batch-1.spec.cjs'], '// synthetic\n')

    def test_a_stall_never_hands_back_a_locked_check_it_declined_to_show(self):
        agent = self.agent()
        self.finished_batch(agent, 'checks/batch-1.spec.cjs', ['REQ-1.1'],
                            "// synthetic check body\n" * 400)
        agent.batch_index += 1
        agent.dispatch('write_files', {'files': [
            {'path': 'frontend/public/features/entries.js', 'content': 'const marker = 1;\n'}]})
        agent.read_paths = ['checks/batch-1.spec.cjs', 'backend/state.cjs',
                            'frontend/public/features/entries.js']
        sources = agent.stall_sources()
        self.assertEqual(list(sources), ['frontend/public/features/entries.js'])

    def test_the_harness_owned_interface_check_is_not_attributed_to_a_batch(self):
        agent = self.agent()
        agent.batch_index = 1
        agent.record_batch_checks(['REQ-1.1'])
        self.assertNotIn(state_runtime.INTERFACE_CHECK_PATH, agent.regression_checks)


class InterfaceVocabularyReportTests(unittest.TestCase):
    """The reported vocabulary list must not grow with every self-check run.

    Rule 1 of the interface check prescribes row action names of the form
    "<Action> for <title>", and each verification creates fresh rows, so the raw list
    re-sent with every verification grew without bound.
    """

    def test_the_row_title_suffix_is_stripped_before_matching(self):
        self.assertIn("replace(/\\s+for\\s+[\\s\\S]+$/i, ' ')", state_runtime.INTERFACE_CHECK)

    def test_the_reported_list_is_capped_and_says_how_many_were_omitted(self):
        self.assertIn('outside.slice(0, 20)', state_runtime.INTERFACE_CHECK)
        self.assertIn("' and ' + (outside.length - 20) + ' more'", state_runtime.INTERFACE_CHECK)

    def test_the_report_is_still_a_log_line_and_never_an_assertion(self):
        report = state_runtime.INTERFACE_CHECK.split('  // Vocabulary.')[1].split('\n  assert.')[0]
        self.assertIn('console.log', report)
        self.assertNotIn('assert.', report)


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


class HarnessReadDispatchTests(TempCase):
    """The same interception, through Agent.dispatch, against a real workspace.

    This class was named HarnessReadTests until 2026-09-14 and was shadowed by the
    module-level class of that name below, so none of it ran.
    """

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
        self.assertIn('module.exports', mixed['files']['backend/api.cjs'])
        self.assertNotIn('Object.assign', json.dumps(mixed))

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
        self.assertIn('module.exports = {terms, titles, matches}', source)

    def test_an_empty_contract_produces_a_loadable_module(self):
        source = state_runtime.vocabulary_module({})
        self.assertIn('const terms = []', source)
        self.assertIn('const titles = []', source)

    def test_the_seeded_row_titles_are_exported_longest_first(self):
        # The interface check strips a row title out of an action name before comparing
        # two names, and strips the longest match first so a title that contains another
        # title cannot leave half of itself behind.
        source = state_runtime.vocabulary_module(self.contract())
        titles = json.loads(source.split('const titles = ')[1].split(';\n')[0])
        self.assertIn('Opening balance', titles)
        self.assertIn('Monthly rent', titles)
        self.assertNotIn('Preferences', titles)   # a navigation name, not a row title
        self.assertEqual(titles, sorted(titles, key=lambda title: (-len(title), title)))


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

    def build_fixture(self, name):
        """Serve a hand-written synthetic page from tests/fixtures/."""
        return self.build((ROOT / 'tests' / 'fixtures' / name).read_text())

    def failure(self, result):
        self.assertFalse(result['passed'], 'the check passed and was expected to fail')
        return str((result['steps'] or [{}])[-1].get('output', ''))

    def run_check(self):
        self.workspace.deadline = time.monotonic() + 90
        return self.workspace.verify(['node', '--test', state_runtime.INTERFACE_CHECK_PATH])

    def test_two_visible_controls_sharing_a_name_fail(self):
        # Exactly the Keep defect: one "More options" per row, nineteen of them.
        rows = ''.join(f'<li>Row {index}<button aria-label="More options">x</button></li>'
                       for index in range(3))
        self.build(f'<ul>{rows}</ul>')
        output = self.failure(self.run_check())
        self.assertIn('same action verb', output)
        self.assertIn('more options', output.lower())

    def test_row_scoped_names_visible_at_rest_fail_on_the_verb(self):
        # The rule the 2026-09-14 rehearsal obeyed and still lost six specs to: every
        # name is unique, and every one of them answers to a search for "archive".
        rows = ''.join(f'<li>Row {index}<button aria-label="Archive for Row {index}">x</button></li>'
                       for index in range(19))
        self.build(f'<ul>{rows}</ul>')
        output = self.failure(self.run_check())
        self.assertIn('same action verb', output)
        self.assertIn('"verb":"archive"', output.replace(' ', ''))
        self.assertIn('"count":19', output.replace(' ', ''))

    def test_actions_hidden_until_hover_pass(self):
        # The other permitted shape: the actions exist but only one is ever visible.
        rows = ''.join(f'<li>Row {index}'
                       f'<button aria-label="Archive for Row {index}" style="display:none">x</button></li>'
                       for index in range(19))
        self.build(f'<ul>{rows}</ul>')
        self.assertTrue(self.run_check()['passed'])

    def test_actions_hidden_with_opacity_are_not_hidden_at_all(self):
        # getByRole resolves against the accessibility tree, where opacity:0 is still
        # there to be matched and clicked. Only display and visibility remove a control.
        rows = ''.join(f'<li>Row {index}'
                       f'<button aria-label="Archive for Row {index}" style="opacity:0">x</button></li>'
                       for index in range(19))
        self.build(f'<ul>{rows}</ul>')
        output = self.failure(self.run_check())
        self.assertIn('same action verb', output)
        self.assertIn('opacity', output)

    def test_a_rule_is_applied_to_a_state_one_click_away(self):
        # The entry page is clean; the ambiguity is one click in. The old check loaded
        # the entry page once, which is why every one of the eight failures escaped it.
        rows = ''.join(f'<li>Row {index}<button aria-label="Archive for Row {index}">x</button></li>'
                       for index in range(19))
        self.build('<button type="button" id="open">Show entries</button>'
                   f'<ul id="rows" style="display:none">{rows}</ul>'
                   '<script>document.getElementById("open").addEventListener("click",'
                   'function(){document.getElementById("rows").style.display="block";});</script>')
        output = self.failure(self.run_check())
        self.assertIn('same action verb', output)
        self.assertIn('after clicking', output)
        self.assertIn('Show entries', output)

    def test_a_chooser_that_leaves_a_matching_name_behind_it_fails(self):
        self.build_fixture('synthetic-leaky-chooser.html')
        output = self.failure(self.run_check())
        self.assertIn('Leaked', output)
        self.assertIn('Utilities for Opening balance', output)

    def test_the_synthetic_hover_fixture_passes_every_rule(self):
        # Hover-revealed row actions, a modal chooser, and a re-render that keeps what
        # was typed. Hand written; it implements no requirement.
        self.build_fixture('synthetic-hover-rows.html')
        result = self.run_check()
        self.assertTrue(result['passed'], str((result['steps'] or [{}])[-1].get('output', '')))

    def test_typing_lost_to_an_in_form_click_fails(self):
        # REQ-2.8.3, reduced: the composer re-renders on a pin toggle and emits the
        # title input with no value, so the note is saved empty.
        self.build('<div id="composer">'
                   '<input id="title" aria-label="Title" placeholder="Title">'
                   '<button type="button" id="pin" aria-label="Pin new entry">Pin</button></div>'
                   '<script>document.getElementById("pin").addEventListener("click",function(){'
                   'document.getElementById("composer").innerHTML='
                   '\'<input id="title" aria-label="Title" placeholder="Title">\''
                   '+\'<button type="button" aria-label="Unpin new entry">Pin</button>\';});</script>')
        output = self.failure(self.run_check())
        self.assertIn('Text typed into a form was lost', output)
        self.assertIn('Pin new entry', output)

    def test_a_form_that_clears_itself_on_a_submission_passes(self):
        # A submission is allowed to clear its own form. The discriminator is the write
        # the click sends, not a list of English verbs.
        self.build('<div id="composer">'
                   '<input id="title" aria-label="Title" placeholder="Title">'
                   '<button type="button" id="add" aria-label="Add entry">Add</button></div>'
                   '<script>document.getElementById("add").addEventListener("click",function(){'
                   'fetch("/api/entries",{method:"POST",body:"{}"}).catch(function(){});'
                   'document.getElementById("title").value="";});</script>')
        result = self.run_check()
        self.assertTrue(result['passed'], str((result['steps'] or [{}])[-1].get('output', '')))

    def test_an_unnamed_input_fails(self):
        self.build('<form><input type="text"></form>')
        self.assertIn('no accessible name', self.failure(self.run_check()))

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

    def test_the_walk_puts_back_every_row_it_moved(self):
        # The walk reaches a state by clicking the application's own controls, which
        # writes rows. A later check must still find the rows the contract seeded.
        contract = self.build(
            '<button type="button" id="scrap" aria-label="Scrap an entry">Scrap</button>'
            '<script>document.getElementById("scrap").addEventListener("click",function(){'
            'fetch("/api/scrap",{method:"POST"});});</script>')
        self.workspace.write_files([{'path': 'backend/api.cjs', 'content': '''const {store}=require('./state.cjs');
module.exports=async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/api/scrap'&&req.method==='POST'){
    for(const row of store.list('entries')) store.remove('entries',row.id);
    res.writeHead(200,{'content-type':'application/json'});res.end('{"ok":true}');return true;}
  return false;};
'''}])
        seeded = len([seed for seed in contract['seeds'] if seed['collection'] == 'entries'])
        self.assertGreater(seeded, 0)
        self.assertTrue(self.run_check()['passed'])
        stored = json.loads((self.workspace.root / state_runtime.DATA_DIRECTORY
                             / 'store.json').read_text())
        self.assertEqual(len(stored['collections']['entries']), seeded)

    def test_row_scoped_names_are_reported_once_per_action_and_capped(self):
        # The rule itself prescribes "<Action> for <title>", and a self-check adds a row
        # every run, so the raw report grew with every verification. Twenty-five rows,
        # two actions each, must reduce to the two action words.
        # Only the first row's actions are visible, which is the shape rule 1 now
        # requires; the rest are hidden exactly as a hover-revealed row would be.
        rows = ''.join('<li>Row {0}'
                       '<button aria-label="Frobnicate for Synthetic row {0}"{1}>a</button>'
                       '<button aria-label="Transclude for Synthetic row {0}"{1}>b</button>'
                       '</li>'.format(index, '' if index == 0 else ' style="display:none"')
                       for index in range(25))
        self.build('<ul>' + rows + '</ul>')
        result = self.run_check()
        self.assertTrue(result['passed'], result.get('error'))
        output = ''.join(str(step.get('output', '')) for step in result['steps'])
        line = [row for row in output.splitlines() if 'matching no requirement text' in row]
        self.assertEqual(len(line), 1, output)
        self.assertNotIn('Synthetic row', line[0])
        self.assertEqual(line[0].count('Frobnicate'), 1)
        self.assertEqual(line[0].count('Transclude'), 1)

    def test_a_report_longer_than_twenty_names_is_cut_and_counted(self):
        buttons = ''.join('<button aria-label="Frobnicate{0}">x</button>'.format(index)
                          for index in range(24))
        self.build(buttons)
        result = self.run_check()
        self.assertTrue(result['passed'], result.get('error'))
        output = ''.join(str(step.get('output', '')) for step in result['steps'])
        line = [row for row in output.splitlines() if 'matching no requirement text' in row][0]
        self.assertEqual(line.count('Frobnicate'), 20)
        self.assertIn('and 4 more', line)

    def test_the_rules_are_stated_to_the_model(self):
        rules = state_runtime.STORE_CONTRACT
        self.assertIn('At most one control carrying a given action verb', rules)
        self.assertIn('Archive for Delete me 2.3.1', rules)
        self.assertIn('display:none or visibility:hidden', rules)
        self.assertIn('opacity:0', rules)
        self.assertIn('aria-label', rules)

    def test_the_inertness_rule_is_stated_to_the_model(self):
        rules = state_runtime.STORE_CONTRACT
        self.assertIn('aria-modal="true"', rules)
        self.assertIn('while a chooser is open', rules.lower())

    def test_the_form_durability_rule_is_stated_to_the_model(self):
        self.assertIn('survives a click on another control in the same form',
                      state_runtime.STORE_CONTRACT)

    def test_the_supplement_asks_a_self_check_to_assert_on_the_row_not_a_toast(self):
        # Four of the last run's specs passed against a toast while the action had been
        # applied to the wrong row, and the model's own checks agreed with them.
        rules = state_runtime.STORE_CONTRACT
        self.assertIn('asserts on that row afterwards', rules)
        self.assertIn('Never assert only that a', rules)
        self.assertIn('toast, snackbar or notification appeared', rules)

    def test_the_supplement_tells_a_self_check_to_hover_before_locating_a_row_action(self):
        # Keep at 69a7f59, batch 3: the page hid row actions until hover as rule 1 asks, and the
        # model's own check waited for "Archive for <title>" without hovering until the cap.
        rules = state_runtime.STORE_CONTRACT
        self.assertIn('hover the row\'s title text', rules)
        self.assertIn('.hover()', rules)


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

    def test_each_batch_owns_the_checks_it_left_and_locks_the_earlier_ones(self):
        # The batch loop is where a check file gets its owner: written during batch N,
        # a regression check from batch N+1 on. Synthetic, driven by the fake batch above.
        agent = self.agent()
        written = []

        def run_batch(nodes):
            path = 'checks/batch-%d.spec.cjs' % agent.batch_index
            written.append(path)
            agent.dispatch('write_files', {'files': [{'path': path, 'content': '// synthetic\n'}]})
            self.workspace.last_verification = {
                'passed': True, 'source_fingerprint': self.workspace.fingerprint(),
                'check_command': ['node', '--test', path],
                'verification_scope': 'local_checks_only', 'acceptance': {}}

        agent.run_batch = run_batch
        agent.run_schedule()
        self.assertEqual(sorted(agent.regression_checks), sorted(written))
        self.assertEqual(agent.regression_checks[written[0]]['requirements'],
                         self.scheduled(agent)[0])
        # After the last batch every one of them is locked against an edit.
        agent.batch_index += 1
        for path in written:
            self.assertIn('Fix the application', agent.locked_check(path))

    def test_a_failed_batch_restores_the_last_verified_tree(self):
        # Keep at ccf0600: a batch that never converged left three half-written feature
        # files and its own failing check behind, and the next batch would have built on
        # them. Synthetic: the first batch verifies and is snapshotted, the second edits a
        # verified file, adds a new one, and fails.
        agent = self.agent()
        first = self.scheduled(agent)[0]

        def run_batch(nodes):
            ids = [node['id'] for node in nodes]
            self.attempted.append(ids)
            if ids == first:
                self.workspace.write_files([{'path': 'frontend/public/features/home.js',
                                             'content': '// verified\n'}])
                self.workspace.last_verification = {
                    'passed': True, 'source_fingerprint': self.workspace.fingerprint(),
                    'check_command': ['node', '--test', 'checks/batch-1.spec.cjs'],
                    'verification_scope': 'local_checks_only', 'acceptance': {}}
                return
            self.workspace.write_files([
                {'path': 'frontend/public/features/home.js', 'content': '// broken\n'},
                {'path': 'frontend/public/features/debris.js', 'content': '// debris\n'}])
            raise RuntimeError('synthetic: batch did not converge')

        agent.run_batch = run_batch
        # Every real tree carries these two; the restore must step over them.
        (self.workspace.root / 'backend' / '.volo').mkdir(parents=True, exist_ok=True)
        (self.workspace.root / 'backend' / '.volo' / 'launcher.cjs').write_text('// synthetic launcher\n')
        (self.workspace.root / 'backend' / 'data').mkdir(parents=True, exist_ok=True)
        (self.workspace.root / 'backend' / 'data' / 'store.json').write_text('{}')
        agent.run_schedule()
        self.assertEqual(self.workspace.path('frontend/public/features/home.js').read_text(),
                         '// verified\n')
        self.assertFalse(self.workspace.path('frontend/public/features/debris.js').exists())
        self.assertTrue((self.workspace.root / 'backend' / '.volo' / 'launcher.cjs').exists())
        self.assertTrue((self.workspace.root / 'backend' / 'data' / 'store.json').exists())
        events = [json.loads(line) for line in
                  (self.trace.directory / 'events.jsonl').read_text().splitlines()]
        restored = [event for event in events if event['event'] == 'restored_product_snapshot']
        self.assertTrue(restored)
        self.assertEqual(restored[0]['removed'], ['frontend/public/features/debris.js'])

    def test_the_snapshot_survives_protected_and_runtime_files_in_the_tree(self):
        # Every real run carries backend/.volo/launcher.cjs (protected) and
        # backend/data/store.json (runtime data). Neither may abort the snapshot.
        agent = self.agent()
        (self.workspace.root / 'backend' / '.volo').mkdir(parents=True, exist_ok=True)
        (self.workspace.root / 'backend' / '.volo' / 'launcher.cjs').write_text('// synthetic launcher\n')
        (self.workspace.root / 'backend' / 'data').mkdir(parents=True, exist_ok=True)
        (self.workspace.root / 'backend' / 'data' / 'store.json').write_text('{}')
        self.workspace.write_files([{'path': 'backend/api.cjs', 'content': '// synthetic api\n'}])
        self.workspace.last_verification = {
            'passed': True, 'source_fingerprint': self.workspace.fingerprint(),
            'check_command': ['node', '--test', 'checks/batch-1.spec.cjs'],
            'verification_scope': 'local_checks_only', 'acceptance': {}}
        self.assertTrue(agent.snapshot_product())
        state = json.loads(agent.snapshot_path().read_text())
        self.assertIn('backend/api.cjs', state['files'])
        self.assertNotIn('backend/.volo/launcher.cjs', state['files'])
        self.assertNotIn('backend/data/store.json', state['files'])

    def test_a_contract_batch_stops_at_its_call_limit(self):
        # Synthetic transport that answers every request with a read-only tool call, so the
        # batch can never converge. The cap, not the run-wide budget, must end it.
        from volo.agent import BATCH_CALL_LIMIT
        requirements = synthetic_requirements(self)
        contract = state_contract.reconcile(
            state_contract.normalize(json.loads(SYNTHETIC_RESPONSE)),
            state_contract.evidence(requirements))
        model = FakeModel('')

        def complete(messages, tools, **kwargs):
            model.requests.append(messages)
            model.usage.calls += 1
            model.usage.prompt_tokens += 1000
            model.usage.completion_tokens += 100
            return {'role': 'assistant', 'content': '',
                    'tool_calls': [{'id': 'call-%d' % model.usage.calls, 'type': 'function',
                                    'function': {'name': 'list_files', 'arguments': '{}'}}]}, 'tool_calls'

        model.complete = complete
        agent = Agent(requirements, model, self.workspace, Runtime(self.trace),
                      contract=contract, max_calls=200)
        agent.install_contract()
        nodes = list(agent.schedule())[0]
        with self.assertRaises(RuntimeError) as raised:
            agent.run_batch(nodes)
        self.assertNotIn('budget', str(raised.exception).lower())
        self.assertLessEqual(model.usage.calls, BATCH_CALL_LIMIT)
        events = [json.loads(line) for line in
                  (self.trace.directory / 'events.jsonl').read_text().splitlines()]
        self.assertTrue(any(event['event'] == 'batch_call_limit' for event in events))

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


class HarnessReadTests(unittest.TestCase):
    """A read of harness-owned files is answered with their contract, never their bytes.

    The first full Keep run on this branch lost a call to a read that mixed the two new
    check files with product files: the owned bytes counted against the read bound.
    """

    def test_owned_only_read_is_summarised(self):
        answer = state_runtime.harness_read(['backend/state.cjs', 'checks/vocabulary.cjs'])
        self.assertEqual(set(answer['files']), {'backend/state.cjs', 'checks/vocabulary.cjs'})
        self.assertNotIn('product', answer)

    def test_product_only_read_is_not_intercepted(self):
        self.assertIsNone(state_runtime.harness_read(['backend/api.cjs']))

    def test_mixed_read_names_the_product_files_for_a_verbatim_read(self):
        answer = state_runtime.harness_read([
            'checks/interface.spec.cjs', 'frontend/public/app.js', 'checks/vocabulary.cjs', 'backend/api.cjs'])
        self.assertEqual(set(answer['files']), {'checks/interface.spec.cjs', 'checks/vocabulary.cjs'})
        self.assertEqual(answer['product'], ['frontend/public/app.js', 'backend/api.cjs'])


class ToolArgumentRepairTests(unittest.TestCase):
    """A file body whose backslash the model escaped one level short must not cost the call.

    Synthetic reproduction of the Keep ccf0600 write: CSS content:"\\22EF" inside a JS string.
    """

    def test_an_invalid_json_escape_is_repaired_to_the_intended_bytes(self):
        from volo.agent import tool_arguments
        raw = '{"files":[{"path":"a.js","content":"x = \'.b::before{content:\\"\\22EF\\"}\';"}]}'
        with self.assertRaises(ValueError):
            json.loads(raw)
        args = tool_arguments(raw)
        self.assertEqual(args['files'][0]['content'], 'x = \'.b::before{content:"\\22EF"}\';')

    def test_valid_arguments_and_truly_broken_json_are_unchanged(self):
        from volo.agent import tool_arguments
        self.assertEqual(tool_arguments('{"paths":["a","b"]}'), {'paths': ['a', 'b']})
        with self.assertRaises(ValueError):
            tool_arguments('{"paths":[')
