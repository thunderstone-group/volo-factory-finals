"""Real-process discovery bounds; no model or browser downloads."""
import json
import os
import shutil
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

from volo.environment import discover_playwright


@unittest.skipUnless(shutil.which('node'), 'Node required')
class DiscoveryTests(unittest.TestCase):
    def test_local_module_is_used_before_host_scan(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            module = root / 'node_modules/playwright'
            module.mkdir(parents=True)
            browser = root / 'browser'
            browser.touch()
            (module / 'index.js').write_text('exports.chromium={executablePath:()=>'+json.dumps(str(browser))+'};')
            value = discover_playwright(root, max_entries=1)
            self.assertTrue(value['available'], value)
            self.assertEqual(Path(value['module']).resolve(), (module / 'index.js').resolve())

    def test_hanging_module_load_is_bounded_with_real_process(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            module = root / 'node_modules/playwright'
            module.mkdir(parents=True)
            (module / 'index.js').write_text('while(true){}')
            started = time.monotonic()
            value = discover_playwright(root, timeout=0.4)
            self.assertFalse(value['available'])
            self.assertEqual(value['reason'], 'discovery_timeout')
            self.assertLess(time.monotonic() - started, 3)

    def test_probe_does_not_receive_credentials_or_node_preload(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            module = root / 'node_modules/playwright'
            module.mkdir(parents=True)
            browser = root / 'browser'
            browser.touch()
            (module / 'index.js').write_text("if(process.env.OPENAI_API_KEY||process.env.NODE_OPTIONS)throw Error('secret leaked');"+
                'exports.chromium={executablePath:()=>'+json.dumps(str(browser))+'};')
            with patch.dict(os.environ, {'OPENAI_API_KEY': 'synthetic-secret', 'NODE_OPTIONS': '--require /missing-preload'}):
                self.assertTrue(discover_playwright(root)['available'])

    def test_invalid_budget_is_rejected_before_spawning(self):
        for timeout in (0, -1, float('inf'), float('nan')):
            with self.subTest(timeout=timeout), self.assertRaises(ValueError):
                discover_playwright(Path('.'), timeout=timeout)
