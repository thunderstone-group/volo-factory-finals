"""Pinned public inputs are never reported as executed acceptance."""
import json
import shutil
import unittest

from volo.agent import Agent
from volo.public_specs import ROOT, load_public_specs
from volo.requirements import RequirementSet
from volo.trace import Runtime
from test_core import TempCase


FINGERPRINT = json.loads((ROOT / 'manifest.json').read_text())[0]['requirement_fingerprint']


class PublicSpecsTests(TempCase):
    def test_exact_input_binding_and_unmodified_public_source(self):
        self.assertIsNone(load_public_specs('another-requirement-version'))
        source = load_public_specs(FINGERPRINT)
        self.assertEqual(len(source['files']), 3)
        self.assertFalse(source['executed'])
        self.assertEqual(source['official_evaluation'], 'not_performed')
        self.assertIn("getByText('账户信息'", ''.join(source['files'].values()))

    def test_changed_public_file_is_rejected(self):
        root = self.base / 'specs'
        shutil.copytree(ROOT, root)
        path = next(root.rglob('*.spec.ts'))
        path.write_text(path.read_text() + '\n// changed\n')
        with self.assertRaisesRegex(ValueError, 'source changed'):
            load_public_specs(FINGERPRINT, root)

    def test_public_input_survives_bounded_context_and_checkpoint(self):
        requirements = RequirementSet.load(self.req)
        # Synthetic binding used only to test prompt transport, not product quality.
        requirements.fingerprint = FINGERPRINT
        agent = Agent(requirements, None, self.workspace, Runtime(self.trace))
        expected = load_public_specs(FINGERPRINT)['files']
        for inline in (False, True):
            agent.inline_source = inline
            request = agent.batch_request(requirements.nodes)
            if inline:
                self.assertEqual(json.loads(request)['public_acceptance_specifications']['files'], expected)
            else:
                self.assertIn(json.dumps(expected, ensure_ascii=False), request)
            checkpoint = agent.context_checkpoint(requirements.nodes, 'system', None)
            self.assertIn('账户信息', checkpoint[1]['content'])
        self.assertIsNone(self.workspace.last_verification)
