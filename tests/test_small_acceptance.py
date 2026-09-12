"""Public-body adapter calibration with E064 and controlled product corrections."""
import json
import os
from pathlib import Path
import shutil
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from types import SimpleNamespace
import unittest

from volo.small_acceptance import ROOT, load_small_acceptance


SOURCES = {entry['task']: entry for entry in json.loads((ROOT / 'sources.json').read_text())}
BAD_COUNTER = json.loads((Path(__file__).parent / 'fixtures/real-smoke-counter-qwen.json').read_text())['index_html']
GOOD_COUNTER = BAD_COUNTER.replace('id="count"', 'id="count" data-testid="count"')


def binding(task):
    # These loader bindings are fixtures; original API byte hashes are audited separately.
    source = SOURCES[task]
    return SimpleNamespace(fingerprint=source['requirement_fingerprint'],
                           nodes=[{'id': Path(name).name.split('.')[0]} for name in source['files']])


class SmallAcceptanceBindings(unittest.TestCase):
    def test_unknown_input_stays_unconfigured_and_changed_source_fails_closed(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp).resolve()
            self.assertIsNone(load_small_acceptance(SimpleNamespace(fingerprint='unknown'), root / 'app'))
            shutil.copytree(ROOT, root / 'contracts')
            file = root / 'contracts/smoke--counter/REQ-1.spec.ts'
            file.write_text(file.read_text() + '\n// changed\n')
            with self.assertRaisesRegex(ValueError, 'specification changed'):
                load_small_acceptance(binding('smoke--counter'), root / 'app', root / 'contracts')

    def test_each_manifest_covers_exactly_the_bound_input(self):
        with tempfile.TemporaryDirectory() as temp:
            for task in SOURCES:
                suite = load_small_acceptance(binding(task), Path(temp).resolve() / 'app')
                self.assertEqual(suite.bundled_task, task)
                self.assertEqual({r for case in suite.cases for r in case['requirements']},
                                 set(suite.requirement_ids))
                suite.assert_integrity()


@unittest.skipUnless(os.getenv('FACTORY_TEST_PLAYWRIGHT_MODULE') and os.getenv('FACTORY_TEST_CHROMIUM_EXECUTABLE'),
                     'Installed Playwright and Chrome required')
class SmallAcceptanceBrowser(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='small-acceptance-')
        self.root = Path(self.temp.name).resolve()
        self.html = BAD_COUNTER
        owner = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                raw = owner.html.encode()
                self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.send_header('Content-Length', str(len(raw)))
                self.end_headers()
                self.wfile.write(raw)

            def log_message(self, *_):
                pass

        self.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.url = 'http://127.0.0.1:' + str(self.server.server_port)
        self.env = {'FACTORY_PLAYWRIGHT_MODULE': os.environ['FACTORY_TEST_PLAYWRIGHT_MODULE'],
                    'FACTORY_CHROMIUM_EXECUTABLE': os.environ['FACTORY_TEST_CHROMIUM_EXECUTABLE']}

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.temp.cleanup()

    def evaluate(self, task, scope=None):
        suite = load_small_acceptance(binding(task), self.root / 'candidate')
        result = suite.run(self.url, scope or suite.requirement_ids, timeout=35, extra_env=self.env)
        suite.assert_integrity()
        return result

    def test_e064_is_rejected_and_the_single_attribute_correction_passes(self):
        # E064 run 224d26e14467: own checks use #count, official test requires the test id.
        self.assertIn('id="count"', BAD_COUNTER)
        self.assertNotIn('data-testid', BAD_COUNTER)
        failed = self.evaluate('smoke--counter')
        self.assertEqual(failed['status'], 'failed', failed)
        self.assertEqual(failed['verified_requirements'], [])
        self.html = GOOD_COUNTER
        passed = self.evaluate('smoke--counter')
        self.assertTrue(passed['passed'], passed)
        self.assertEqual(passed['verified_requirements'], ['REQ-1'])

    def test_evolution_reruns_old_behavior_and_requires_reset(self):
        self.html = GOOD_COUNTER
        first = self.evaluate('smoke-evolution--counter', ['REQ-1'])
        self.assertTrue(first['passed'], first)
        missing = self.evaluate('smoke-evolution--counter')
        self.assertFalse(missing['passed'], missing)
        self.assertEqual(missing['status'], 'failed', missing)
        self.html = GOOD_COUNTER.replace('</body>',
            '<button onclick="count=0;updateDisplay()">Reset</button></body>')
        complete = self.evaluate('smoke-evolution--counter')
        self.assertTrue(complete['passed'], complete)
        self.assertEqual(complete['verified_requirements'], ['REQ-1', 'REQ-2'])

    def test_both_dice_suites_execute_their_original_assertions(self):
        self.html = '''<span data-testid="dice-value">1</span><span data-testid="roll-count">0</span>
<button onclick="document.querySelector('[data-testid=dice-value]').textContent=1+Math.floor(Math.random()*6);
document.querySelector('[data-testid=roll-count]').textContent=++n">Roll</button><script>let n=0</script>'''
        for task, cases in [('smoke--dice', 1), ('smoke-evolution--dice', 2)]:
            result = self.evaluate(task)
            self.assertTrue(result['passed'], result)
            self.assertEqual(len(result['cases']), cases)

    def test_missing_browser_does_not_manufacture_acceptance(self):
        self.env = {}
        result = self.evaluate('smoke--counter')
        self.assertFalse(result['passed'], result)
        self.assertIn(result['status'], ('error', 'unverified'))
        self.assertEqual(result['verified_requirements'], [])
