"""Synthetic input routing with a captured real multimodal gateway response."""
import base64
import json
import tempfile
import time
import unittest
from unittest.mock import patch
from pathlib import Path

from test_core import FakeGateway, ROOT
from volo.agent import Agent
from volo.model import Model
from volo.references import ReferenceObserver, referenced_images, prepare_image
from volo.requirements import RequirementSet
from volo.trace import Trace, Runtime
from volo.workspace import Workspace


PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jH9kAAAAASUVORK5CYII=')


class ReferenceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name).resolve()
        self.inputs = self.root / 'inputs'
        self.inputs.mkdir()
        (self.inputs / 'reference').mkdir()
        for name in ('parent', 'active', 'future'):
            (self.inputs / 'reference' / (name + '.png')).write_bytes(PNG)
        (self.inputs / 'requirements.yaml').write_text('''id: ROOT
children:
  - id: GROUP
    description: "Shared reference ![parent](./reference/parent.png)"
    children:
      - id: ACTIVE
        description: "Current ![active](./reference/active.png) ![duplicate](reference/active.png)"
      - id: FUTURE
        description: "Later ![future](./reference/future.png)"
''')
        self.requirements = RequirementSet.load(self.inputs)
        self.nodes = [self.requirements.nodes[0]]
        self.trace = Trace(self.root / 'output/.factory')
        self.fixture = json.loads((ROOT / 'tests/fixtures/real-kimi-image-response.json').read_text())['response']

    def tearDown(self):
        self.temp.cleanup()

    def test_active_and_inherited_images_only_without_duplicates(self):
        paths, missing = referenced_images(self.requirements, self.nodes)
        self.assertEqual(set(paths), {'reference/parent.png', 'reference/active.png'})
        self.assertEqual(missing, [])

    def test_remote_missing_and_symlink_inputs_are_never_read(self):
        secret = self.root / 'outside.png'
        secret.write_bytes(b'not-an-input')
        (self.inputs / 'linked.png').symlink_to(secret)
        self.nodes[0]['description'] = ('![outside](../outside.png) ![linked](linked.png) '
                                      '![remote](https://example.test/image.png) ![absent](absent.png)')
        paths, missing = referenced_images(self.requirements, self.nodes)
        self.assertEqual(paths, ['reference/parent.png'])
        self.assertEqual(len(missing), 4)

    def test_real_response_routing_usage_cache_invalidation_and_context(self):
        with FakeGateway([self.fixture, self.fixture]) as server:
            coding = Model(server.url, 'synthetic-test-key', 'coding-model', self.trace)
            vision = Model(server.url, 'synthetic-test-key', 'kimi-k3', self.trace)
            vision.usage = coding.usage
            observer = ReferenceObserver(vision, self.trace)
            guards = []
            args = {'deadline': time.monotonic() + 30, 'guard_budget': lambda: guards.append(True)}
            result = observer.observe(self.requirements, self.nodes, **args)
            body = server.requests[0]
            images = [part for part in body['messages'][0]['content'] if part['type'] == 'image_url']
            self.assertEqual(len(images), 2)
            self.assertEqual(base64.b64decode(images[0]['image_url']['url'].split(',')[1]), PNG)
            self.assertEqual(coding.usage.calls, 1)
            self.assertEqual(coding.usage.total_tokens, 1999)
            self.assertEqual(ReferenceObserver(vision, self.trace).observe(self.requirements, self.nodes, **args), result)
            self.assertEqual(len(server.requests), 1)
            (self.inputs / 'reference/active.png').write_bytes(PNG + b'changed-input')
            observer.observe(self.requirements, self.nodes, **args)
            self.assertEqual(coding.usage.calls, 2)
            self.assertEqual(len(guards), 2)
            workspace = Workspace(self.root / 'output', self.inputs, self.trace, time.monotonic() + 30)
            agent = Agent(self.requirements, coding, workspace, Runtime(self.trace), references=observer)
            agent.reference_context = result
            self.assertIn(self.fixture['choices'][0]['message']['content'],
                          agent.batch_request(self.nodes).replace('\\n', '\n'))

    def test_truncated_observation_is_not_cached_or_called_complete(self):
        self.fixture['choices'][0]['finish_reason'] = 'length'
        with FakeGateway([self.fixture]) as server:
            model = Model(server.url, 'synthetic-test-key', 'kimi-k3', self.trace)
            observer = ReferenceObserver(model, self.trace)
            with self.assertRaisesRegex(RuntimeError, 'complete textual response'):
                observer.observe(self.requirements, self.nodes,
                                 deadline=time.monotonic() + 30, guard_budget=lambda: None)
            self.assertFalse(observer.path.exists())

    def test_large_raster_is_resized_but_small_text_reference_stays_exact(self):
        from PIL import Image
        small = self.inputs / 'reference/active.png'
        self.assertEqual(prepare_image(small)[0], PNG)
        large = self.inputs / 'reference/large.png'
        Image.new('RGB', (3840, 1908), 'white').save(large)
        raw, mime, metadata = prepare_image(large)
        self.assertEqual(mime, 'image/jpeg')
        self.assertLessEqual(len(raw), 500000)
        self.assertEqual(metadata['original_size'], [3840, 1908])
        self.assertEqual(metadata['sent_size'], [1920, 954])

    def test_encoded_payload_byte_budget_splits_even_three_images(self):
        self.nodes[0]['description'] += ' ![extra](reference/future.png)'
        # Synthetic encoded-size routing fixture, independent of image entropy.
        prepared = (b'x' * 300000, 'image/jpeg', {'transformed': True})
        with patch('volo.references.prepare_image', return_value=prepared), FakeGateway([self.fixture] * 3) as server:
            model = Model(server.url, 'synthetic-test-key', 'kimi-k3', self.trace)
            ReferenceObserver(model, self.trace).observe(self.requirements, self.nodes,
                deadline=time.monotonic() + 30, guard_budget=lambda: None)
            self.assertEqual(len(server.requests), 3)
            self.assertTrue(all(len(json.dumps(r, ensure_ascii=False).encode()) < 800000 for r in server.requests))


if __name__ == '__main__':
    unittest.main()
