"""Real Node/file tests for the opt-in lab probe; all environment data is synthetic."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import tempfile
import unittest
import zipfile

from harness_lab.runner_rules_probe import SOURCE
from scripts.package_rule_probe import build


@unittest.skipUnless(shutil.which('node'), 'Node required')
class RuleProbeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='volo-rule-probe-')
        self.root = Path(self.temp.name).resolve()
        self.tests = self.root / 'tests'
        self.tests.mkdir()
        self.script = self.root / 'probe.cjs'
        self.script.write_text(SOURCE)
        self.output = self.root / 'diagnostics/probe.json'

    def tearDown(self):
        self.temp.cleanup()

    def capture(self, root=None):
        result = subprocess.run(['node', '-e',
            "require(process.argv[1]).capture(process.argv[2],'synthetic-test',process.argv[3])",
            str(self.script), str(self.output), str(root or self.tests)],
            capture_output=True, text=True, timeout=5,
            env={'PATH': os.environ['PATH'], 'TEST_API_KEY': 'synthetic-private-key-123'})
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(self.output.read_text())

    def test_reads_rules_without_exporting_secrets_or_other_files_or_editing_tests(self):
        config = "export default {timeout:10000, note:'synthetic-private-key-123'};\n"
        (self.tests / 'playwright.config.ts').write_text(config)
        (self.tests / 'REQ-1.spec.ts').write_text('synthetic public assertion body')
        (self.tests / '.env').write_text('never-collect-this-private-file')
        before = {p.name: p.read_bytes() for p in self.tests.iterdir()}
        result = self.capture()
        self.assertEqual(result['status'], 'config_captured')
        self.assertEqual(result['files'][0]['sha256'], hashlib.sha256(config.encode()).hexdigest())
        self.assertTrue(result['files'][0]['redacted'])
        self.assertNotIn('synthetic-private-key-123', self.output.read_text())
        self.assertNotIn('never-collect', self.output.read_text())
        self.assertNotIn('synthetic public assertion body', self.output.read_text())
        self.assertEqual([x['path'] for x in result['test_inventory']], ['REQ-1.spec.ts'])
        self.assertEqual(before, {p.name: p.read_bytes() for p in self.tests.iterdir()})
        self.assertEqual(stat.S_IMODE(self.output.stat().st_mode), 0o600)

    def test_symlink_nonregular_and_large_files_are_not_followed(self):
        target = self.root / 'outside'
        target.write_text('outside-private-file')
        (self.tests / 'playwright.config.ts').symlink_to(target)
        (self.tests / 'package.json').write_text('x' * 65537)
        (self.tests / 'support').mkdir()
        os.mkfifo(self.tests / 'support/e2e.ts')
        result = self.capture()
        self.assertEqual([x['status'] for x in result['files']],
                         ['SYMLINK_SKIPPED', 'SIZE_LIMIT', 'NOT_REGULAR_FILE'])
        self.assertNotIn('outside-private-file', self.output.read_text())
        alias = self.root / 'alias'
        alias.symlink_to(self.tests, target_is_directory=True)
        self.assertEqual(self.capture(alias)['status'], 'SYMLINK_ROOT_SKIPPED')

    def test_absent_or_incomplete_config_is_not_claimed_captured(self):
        self.assertEqual(self.capture(self.root / 'missing')['status'], 'ENOENT')
        (self.tests / 'playwright.config.ts').write_text('')
        self.assertEqual(self.capture()['status'], 'config_unavailable')

    def test_probe_packaging_preserves_baseline_and_all_assertion_bytes(self):
        base = self.root / 'base.zip'
        repo = Path(__file__).resolve().parents[1]
        members = {name: (repo / name).read_bytes() for name in ('main.py', 'volo/web_runtime.py')}
        members['volo/public_specs/test.spec.ts'] = b'synthetic fixed public assertion'
        with zipfile.ZipFile(base, 'w') as archive:
            for name, content in members.items():
                archive.writestr(name, content)
        before = base.read_bytes()
        output = self.root / 'probe.zip'
        receipt = build(base, output)
        self.assertEqual(base.read_bytes(), before)
        self.assertEqual(receipt['base_sha256'], hashlib.sha256(before).hexdigest())
        with zipfile.ZipFile(output) as archive:
            for name in ('main.py', 'volo/web_runtime.py', 'volo/runner_rules_probe.py'):
                compile(archive.read(name), name, 'exec')
            self.assertEqual(archive.read('volo/public_specs/test.spec.ts'), members['volo/public_specs/test.spec.ts'])
            self.assertEqual(set(archive.namelist()) - set(members), {'volo/runner_rules_probe.py'})
        with self.assertRaisesRegex(ValueError, 'already exists'):
            build(base, output)
