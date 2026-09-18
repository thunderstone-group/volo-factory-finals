"""Static rejection of browser self-navigation in generated product code.

The measured failure mode is in docs/archive/legacy-harness/registration-timing-2026-09-14.md: an application
that assigns location.href after an awaited fetch races the test runner's next
navigation. These checks are deterministic and need no Node, browser or model.
"""
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

from volo.trace import Trace
from volo.workspace import Workspace, self_navigation_findings


NAVIGATING = [
    "window.location.href = '/';",
    "location.href='/'",
    "window.location = '/';",
    "document.location.href = '/'",
    "location.assign('/')",
    "location.replace('/account')",
    "location.reload()",
    "window . location . reload ( )",
    "location.pathname = '/home'",
    "if (ok) location.href = target;",
    '<meta http-equiv="refresh" content="0;url=/">',
    "<META HTTP-EQUIV='Refresh' CONTENT='0'>",
]

ALLOWED = [
    "const path = location.pathname;",
    "if (location.pathname === '/register') renderRegister();",
    "history.replaceState({}, '', '/');",
    "history.pushState(null, '', '/register');",
    "window.addEventListener('popstate', render);",
    "const url = new URL(location.href);",
    "const { pathname } = window.location;",
    "link.href = '/register';",
    "const location = payload.location;",
    "let locationLabel = 'Beijing';",
    "form.addEventListener('submit', event => event.preventDefault());",
    "res.setHeader('Location', '/');",
    "body = template.replace('{name}', name);",
]


class SelfNavigationPatternTests(unittest.TestCase):
    def test_every_navigating_form_is_reported_with_its_line(self):
        for source in NAVIGATING:
            with self.subTest(source=source):
                findings = self_navigation_findings('frontend/public/index.html', 'let a=1;\n' + source)
                self.assertEqual(len(findings), 1, findings)
                self.assertEqual(findings[0]['line'], 2)
                self.assertEqual(findings[0]['file'], 'frontend/public/index.html')
                self.assertIn(source.strip()[:40], findings[0]['source'])

    def test_route_reads_history_calls_and_similar_names_are_not_reported(self):
        for source in ALLOWED:
            with self.subTest(source=source):
                self.assertEqual(self_navigation_findings('index.html', source), [])

    def test_findings_are_bounded_and_one_per_line(self):
        line = "location.href='/';location.reload();"
        findings = self_navigation_findings('index.html', '\n'.join([line] * 9))
        self.assertEqual(len(findings), 5)
        self.assertEqual([item['line'] for item in findings], [1, 2, 3, 4, 5])


class SelfNavigationGuardTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='volo-nav-')
        base = Path(self.temp.name)
        requirements = base / 'input'
        requirements.mkdir()
        trace = Trace(base / 'application' / '.factory')
        with patch('volo.workspace.discover_playwright', return_value={'available': False}):
            self.workspace = Workspace(base / 'application', requirements, trace, time.monotonic() + 60)

    def tearDown(self):
        self.temp.cleanup()

    def test_authored_product_source_is_rejected_before_any_build(self):
        self.workspace.write_files([
            {'path': 'frontend/public/index.html',
             'content': "<script>\nasync function submit(){await fetch('/api/register');"
                        "\nwindow.location.href = '/';\n}\n</script>"}])
        findings = self.workspace.self_navigation_guard()
        self.assertEqual([(item['file'], item['line']) for item in findings],
                         [('frontend/public/index.html', 3)])
        result = self.workspace.verify(['node', '--test', 'checks/requirements.cjs'])
        self.assertFalse(result['passed'])
        self.assertEqual(result['self_navigation'], findings)
        self.assertIn('frontend/public/index.html', result['error'])
        self.assertIn('history.replaceState', result['error'])
        self.assertEqual(result['steps'], [])
        self.assertIsNone(self.workspace.last_verification)

    def test_in_place_rerender_passes_the_guard(self):
        self.workspace.write_files([
            {'path': 'frontend/public/index.html',
             'content': "<script>\nasync function submit(){await fetch('/api/register');"
                        "\nhistory.replaceState({}, '', '/');\nrender(location.pathname);\n}\n</script>"}])
        self.assertEqual(self.workspace.self_navigation_guard(), [])

    def test_generated_checks_and_files_this_run_did_not_write_are_not_scanned(self):
        existing = self.workspace.root / 'frontend' / 'public'
        existing.mkdir(parents=True)
        (existing / 'legacy.js').write_text("window.location.href = '/';\n")
        self.workspace.write_files([
            {'path': 'checks/requirements.cjs',
             'content': "test('x', async page => { await page.evaluate(() => location.reload()); });"}])
        self.assertEqual(self.workspace.self_navigation_guard(), [])
        self.workspace.edit('frontend/public/legacy.js', "'/'", "'/home'")
        self.assertEqual(len(self.workspace.self_navigation_guard()), 1)


if __name__ == '__main__':
    unittest.main()
