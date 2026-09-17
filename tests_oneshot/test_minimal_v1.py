"""Synthetic transport tests exercise the actual extracted V1 entrypoint."""
import contextlib
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

from scripts.package_minimal_v1 import build
from scripts.run_minimal_batch import extract_candidate, prompt_hash, read_trace
from test_oneshot import SyntheticStream, application, events


class CandidateTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.package = self.root / 'v1.zip'
        self.manifest = build(self.package)

    def load_entry(self):
        target = self.root / 'extracted'
        extract_candidate(self.package, self.manifest['package_sha256'], target)
        def load(name, path):
            spec = importlib.util.spec_from_file_location(name, path)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            return module
        core = load('extracted_core', target / 'core.py')
        with patch.dict(sys.modules, {'core': core}):
            entry = load('extracted_entry', target / 'main.py')
        return entry

    def test_reproducible_allowlisted_package_preserves_v0_core(self):
        other = self.root / 'again.zip'
        self.assertEqual(build(other), self.manifest)
        self.assertEqual(self.package.read_bytes(), other.read_bytes())
        entry = self.load_entry()
        from oneshot import main as original
        self.assertEqual((entry.HERE / 'core.py').read_bytes(), Path(original.__file__).read_bytes())
        self.assertEqual(set(self.manifest['files']), {'main.py', 'core.py', 'dialect.md', 'requirements.txt'})

    def test_wrong_zip_hash_and_changed_extraction_rejected(self):
        target = self.root / 'extracted'
        with self.assertRaisesRegex(ValueError, 'hash mismatch'):
            extract_candidate(self.package, '0' * 64, target)
        self.assertFalse(target.exists())
        self.load_entry()
        (target / 'main.py').write_text('different candidate')
        with self.assertRaisesRegex(ValueError, 'changed'):
            extract_candidate(self.package, self.manifest['package_sha256'], target)

    def test_actual_packaged_request_uses_v1_guide_and_trace_identity(self):
        entry = self.load_entry()
        inputs = self.root / 'inputs'; inputs.mkdir()
        (inputs / 'requirements.yaml').write_text('name: Synthetic ledger\n')
        (inputs / 'detail.json').write_text(json.dumps({'prerequisites_markdown': 'Start with balance 3',
                                                       'requirements_markdown': 'DUPLICATE MARKDOWN OMITTED',
                                                       'hidden_test': 'NEVER SEND THIS'}))
        captured = []
        def transport(request, timeout):
            captured.append(json.loads(request.data))
            return SyntheticStream(events(application(), {'prompt_tokens': 12, 'completion_tokens': 30}))
        stderr = io.StringIO()
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'synthetic-key', 'MODEL': 'synthetic-v1'}), \
             patch.object(entry.core, '_open_model', side_effect=transport), \
             contextlib.redirect_stderr(stderr), contextlib.redirect_stdout(io.StringIO()):
            rc = entry.main([str(inputs), '--output-dir', str(self.root / 'A0')])
        self.assertEqual(rc, 0)
        self.assertEqual(len(captured), 1)
        messages = captured[0]['messages']
        self.assertEqual(messages[0]['content'], entry.SYSTEM)
        self.assertIn('Application construction guide — minimal V1', messages[1]['content'])
        self.assertIn('Start with balance 3', messages[1]['content'])
        self.assertNotIn('DUPLICATE MARKDOWN OMITTED', messages[1]['content'])
        self.assertNotIn('NEVER SEND THIS', messages[1]['content'])
        log = self.root / 'trace.log'; log.write_text(stderr.getvalue())
        traces, usage, failure = read_trace(log)
        self.assertEqual(traces[0]['messages_sha256'], prompt_hash(messages))
        self.assertEqual(traces[0]['model'], 'synthetic-v1')
        self.assertEqual(usage['calls'], 1)
        self.assertIsNone(failure)

    def test_input_adapter_keeps_yaml_identical_with_empty_prerequisites(self):
        entry = self.load_entry()
        inputs = self.root / 'inputs'; inputs.mkdir()
        document = 'name: Synthetic\n'
        (inputs / 'requirements.yaml').write_text(document)
        (inputs / 'detail.json').write_text(json.dumps({'requirements_yaml': document, 'prerequisites_markdown': ''}))
        text, identity = entry.load_inputs(inputs)
        self.assertEqual(text, document)
        self.assertEqual(identity['document_sha256'], hashlib.sha256(document.encode()).hexdigest())
        self.assertFalse(identity['prerequisites_included'])

    def test_input_adapter_rejects_link_and_accepts_markdown_fallback(self):
        entry = self.load_entry()
        inputs = self.root / 'inputs'; inputs.mkdir()
        (inputs / 'requirements.md').write_text('# Synthetic document')
        self.assertEqual(entry.load_inputs(inputs)[0], '# Synthetic document')
        (inputs / 'requirements.yaml').symlink_to(inputs / 'requirements.md')
        with self.assertRaisesRegex(ValueError, 'invalid requirement document'):
            entry.load_inputs(inputs)


if __name__ == '__main__':
    unittest.main()
