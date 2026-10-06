"""Synthetic grammar/integration regressions. Public corpus audit is a separate script."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import zipfile

from oneshot import light_tests as light, testgen
from scripts import package_oneshot

DESCRIPTION = '''The current page contains one link or button named "Start" when this action is available.
The region named "Panel" contains one button named "Apply" when this action is available.
The form named "Editor" contains one button named "Save" when this action is available.
'''


def scenario(*steps, name='Example'):
    return {'name': name, 'steps': [{'keyword': 'GIVEN', 'content': light.HOME}]
            + [{'keyword': k, 'content': c} for k, c in steps]}


def document(*items, description=DESCRIPTION):
    # JSON is a YAML subset consumed by the existing requirements reader.
    return json.dumps({'id': 'REQ-1', 'type': 'ATOMIC', 'description': description,
                       'scenarios': list(items)})


BASIC = scenario(('WHEN', 'The user activates "Start" in the current page.'),
                 ('THEN', 'The region named "Panel" is visible.'))


class GrammarCase(unittest.TestCase):
    def test_core_templates_across_all_scopes(self):
        for phrase in ['current page', 'region named "Panel"', 'form named "Editor"', 'dialog named "Modal"']:
            compiler = light.Compiler('The ' + phrase + ' contains one button named "Do" when this action is available.')
            cases = [
                ('WHEN', f'The user activates "Do" in the {phrase}.', 'await button('),
                ('WHEN', f'The user enters "a \\\"quote\\\" and \\\\" in the "Input" field in the {phrase}.', 'await fill('),
                ('WHEN', f'The user selects "B" in the "Choice" combobox in the {phrase}.', 'await choose('),
                ('WHEN', f'The user checks "Enabled" in the {phrase}.', 'true'),
                ('WHEN', f'The user unchecks "Enabled" in the {phrase}.', 'false'),
                ('THEN', f'The exact text "Message" is visible exactly once in the {phrase}.', 'await text('),
                ('THEN', f'The exact text "Message" is absent in the {phrase}.', '.toHaveCount(0)'),
                ('THEN', f'The "Input" field in the {phrase} displays "a  b".', '.toHaveValue("a  b")'),
                ('THEN', f'The "Enabled" checkbox is checked in the {phrase}.', 'checked: true'),
                ('THEN', f'The "Enabled" checkbox is unchecked in the {phrase}.', 'checked: false'),
                ('THEN', f'The "Entries" list in the {phrase} contains exactly these entries in order: ["B", "A"].', 'await order('),
            ]
            for role in ['region', 'form', 'dialog', 'heading', 'status', 'alert', 'button', 'img', 'combobox', 'navigation', 'list']:
                cases += [('THEN', f'The {role} named "Name" is visible exactly once in the {phrase}.', 'await visible('),
                          ('THEN', f'The {role} named "Name" is absent in the {phrase}.', '.toHaveCount(0)')]
            for keyword, content, expected in cases:
                with self.subTest(content=content):
                    self.assertIn(expected, '\n'.join(compiler.step(keyword, content)))

    def test_near_misses_are_rejected_and_never_partially_compiled(self):
        invalid = [
            ('WHEN', 'The user activates "Start" in the current page twice.'),
            ('WHEN', 'The user activates "Start" in current page.'),
            ('WHEN', 'The user activates "Start" in the current page. Then wait.'),
            ('WHEN', 'The user enters "x" into the "Input" field in the current page.'),
            ('THEN', 'The exact text "Hi" is visible once in the current page.'),
            ('THEN', 'The heading named "Hi" is visible exactly twice in the current page.'),
            ('THEN', 'The "Items" list in the current page contains exactly these entries in order: ["a", 1].'),
            ('THEN', 'The "Items" list in the current page contains exactly these entries in order: ["a",].'),
            ('THEN', 'The "Flag" checkbox is not checked in the current page.'),
            ('WHEN', 'The user activates "Unknown" in the current page.'),
            ('THEN', 'The form named "Panel" is visible'),
            ('WHEN', 'The region named "Panel" is visible.'),
        ]
        for step in invalid:
            with self.subTest(step=step):
                result = light.compile_scenario(scenario(*[(s['keyword'],s['content']) for s in BASIC['steps'][1:]], step), DESCRIPTION)
                self.assertIsNone(result['source'])
                self.assertEqual(len(result['uncompiled']), 1)

    def test_scope_reuse_and_nested_target_are_exact(self):
        compiler = light.Compiler(DESCRIPTION)
        first = compiler.step('THEN', 'The region named "Panel" is visible.')
        self.assertEqual(first, ['const scope0 = named(page, "region", "Panel");', 'await visible(scope0);'])
        self.assertEqual(compiler.step('WHEN', 'The user activates "Apply" in the region named "Panel".'),
                         ['await button(scope0, "Apply");'])
        self.assertEqual(compiler.step('THEN', 'The region named "Child" is absent in the region named "Panel".'),
                         ['await expect(named(scope0, "region", "Child")).toHaveCount(0);'])
        self.assertEqual(compiler.step('THEN', 'The region named "Panel" is visible.'), ['await visible(scope0);'])
        self.assertEqual(compiler.step('WHEN', 'The user activates "Start" in the current page.'), ['await activate(page, "Start");'])

    def test_implicit_controls_require_unambiguous_context(self):
        compiler = light.Compiler('')
        with self.assertRaises(light.Unsupported):
            compiler.step('THEN', 'The Secret input masks the password.')
        compiler.step('WHEN', 'The user enters "x" in the "Secret" field in the form named "Editor".')
        self.assertEqual(compiler.step('THEN', 'The Secret input masks the password.'),
                         ['await expect(field(named(page, "form", "Editor"), "Secret")).toHaveAttribute("type", "password");'])
        compiler.step('WHEN', 'The user enters "y" in the "Secret" field in the current page.')
        with self.assertRaises(light.Unsupported):
            compiler.step('THEN', 'The Secret input masks the password.')
        ambiguous = light.Compiler(DESCRIPTION + 'The current page contains one button named "Start" when this action is available.')
        with self.assertRaises(light.Unsupported):
            ambiguous.step('WHEN', 'The user activates "Start" in the current page.')
        malformed = 'The current page contains one button named "Bad\\q" when this action is available.'
        self.assertIsNone(light.compile_scenario(BASIC, malformed)['source'])

    def test_seed_comments_never_execute_and_can_be_interleaved(self):
        seed = 'Seed text\n}); throw new Error("no"); //'
        result = light.compile_scenario(scenario(('WHEN', 'The user activates "Start" in the current page.'),
                                                ('GIVEN', seed), ('THEN', 'The region named "Panel" is visible.')), DESCRIPTION)
        self.assertIsNotNone(result['source'])
        self.assertIn('// GIVEN: ' + json.dumps(seed), result['source'])
        self.assertEqual(result['source'].count('page.goto'), 1)

    def test_lite_prose_and_near_home_contract_are_not_compiled(self):
        prose = scenario(('WHEN', 'The user opens the saved record and edits it.'),
                         ('THEN', 'The changes are shown.'))
        for home in [light.HOME, light.HOME.replace('signed out', 'signed in')]:
            prose['steps'][0]['content'] = home
            self.assertIsNone(light.compile_requirements(document(prose))[0]['source'])
        no_home = dict(BASIC, steps=BASIC['steps'][1:])
        self.assertIsNone(light.compile_requirements(document(no_home))[0]['source'])

    def test_supplemental_grammar_is_parameterized(self):
        compiler = light.Compiler('The region named "Panel" contains one button named "Toggle" when this action is available.')
        compiler.step('THEN', 'The form named "Payment" is visible.')
        compiler.step('THEN', 'The region named "Panel" is visible.')
        compiler.step('WHEN', 'The user selects the Express radio in the Payment form.')
        for keyword,content in [
            ('WHEN','The user focuses the textbox labelled Query.'),
            ('WHEN','The user focuses the textbox labelled Query again.'),
            ('WHEN','The user presses Enter in Query.'),
            ('THEN','The field labelled "Date" is visible in Payment.'),
            ('THEN','The textbox labelled Reply remains visible.'),
            ('THEN','Catalog remains available as a link or button.'),
            ('THEN','The localized heading (U+4E2D U+6587) and entry navigation control (U+767B U+5165) are visible.'),
            ('THEN','Toggle is initially unpressed.'),
            ('THEN','Toggle is pressed.'),
            ('THEN','Item is absent from Panel.'),
            ('THEN','Express remains selected and the Payment form stays visible.'),
            ('THEN','Express remains selected.'),
            ('THEN','Panel displays exactly one nonempty reference as "Reference: <value>".'),
            ('THEN','Record link is a readonly input containing an absolute HTTP(S) permalink.'),
            ('THEN','The browser clipboard contains exactly the displayed Record link.'),
        ]:
            with self.subTest(content=content):
                self.assertTrue(compiler.step(keyword,content))
        compiler.step('WHEN','The user selects "Compact" in the "Layout" combobox in the current page.')
        compiler.step('WHEN','The user selects "Dark" in the "Theme" combobox in the current page.')
        self.assertEqual(compiler.step('THEN','Layout Compact and Theme Dark remain selected.'),
                         ['await selected(page, "Layout", "Compact");','await selected(page, "Theme", "Dark");'])
        with self.assertRaises(light.Unsupported):
            compiler.step('THEN','Layout Wide and Theme Dark remain selected.')


class IntegrationCase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.suite = Path(self.tmp.name)

    def test_all_compiled_calls_no_model_even_with_audit(self):
        with patch.object(testgen, 'LIGHT_TESTS', True):
            manifest = testgen.write_suite(document(BASIC), self.suite, lambda _: self.fail('model called'), audit=True)
        self.assertTrue(testgen.runnable(manifest))
        self.assertEqual((manifest['scenarios'], manifest['tests']), (1,1))
        self.assertEqual(manifest['files'][0]['calls'], 0)
        self.assertEqual(manifest['files'][0]['tests'], ['REQ-1: Example'])
        self.assertIn('cookies: [], origins: []', (self.suite/light.SPEC_FILE).read_text())
        self.assertEqual(json.loads((self.suite/'suite.json').read_text()), manifest)

    def test_flag_off_preserves_writer_files_manifest_and_calls(self):
        text = document(BASIC)
        group = testgen.plan(text)[0]
        body = 'const { test } = require("@playwright/test");\ntest("REQ-1: Example", async () => {});'
        seen = []
        def complete(messages):
            seen.append(messages)
            return f'=== FILE: {group["file"]} ===\n{body}\n=== END ===', {}, 'stop'
        with patch.object(testgen, 'LIGHT_TESTS', False), patch.object(testgen.time, 'monotonic', return_value=10), \
             patch.object(testgen, '_node', return_value=None), patch.object(light, 'compile_requirements', side_effect=AssertionError('flag off')):
            manifest = testgen.write_suite(text, self.suite, complete, audit=False)
        self.assertEqual(seen, [testgen.request(text,group)])
        self.assertEqual(sorted(p.name for p in self.suite.iterdir()), ['suite.json', group['file']])
        self.assertEqual((self.suite/group['file']).read_text(), testgen.harden(body)+'\n')
        expected = {'files':[{'file':group['file'], 'scenarios':['REQ-1'], 'calls':1, 'finish':'stop', 'tests':['REQ-1: Example']}],
                    'scenarios':1,'tests':1,'seconds':0,'prerequisites':''}
        self.assertEqual(manifest,expected)
        self.assertEqual((self.suite/'suite.json').read_text(),json.dumps(expected,indent=1,ensure_ascii=False)+'\n')

    def test_mixed_suite_writer_receives_only_uncompiled_scenario(self):
        unsupported = scenario(('WHEN','The user does an unsupported action.'),('THEN','Something happens.'), name='Manual')
        text = document(BASIC,unsupported)
        seen=[]
        def complete(messages):
            seen.append(messages)
            return '=== FILE: t01-REQ-1.spec.cjs ===\nconst { test } = require("@playwright/test");\ntest("REQ-1#2: Manual", async () => {});\n=== END ===', {}, 'stop'
        with patch.object(testgen,'LIGHT_TESTS',True):
            manifest=testgen.write_suite(text,self.suite,complete,audit=False)
        self.assertEqual(len(seen),1)
        listed=seen[0][-1]['content'].split('with one test per scenario below')[1]
        self.assertIn('- REQ-1#2: Manual',listed)
        self.assertNotIn('- REQ-1: Example',listed)
        self.assertIn(text,seen[0][-1]['content'])
        self.assertEqual((manifest['scenarios'],manifest['tests']),(2,2))
        self.assertEqual([r['calls'] for r in manifest['files']],[0,1])
        self.assertEqual(json.loads((self.suite/'suite.json').read_text()),manifest)
        self.assertTrue(testgen.runnable(manifest))

    def test_mixed_manifest_loads_in_playwright(self):
        node_path = os.environ.get('NODE_PATH', '')
        runner = next((Path(p)/'@playwright/test/cli.js' for p in node_path.split(os.pathsep)
                       if p and (Path(p)/'@playwright/test/cli.js').is_file()), None)
        if runner is None:
            self.skipTest('NODE_PATH must provide Playwright; this check never installs it')
        self.test_mixed_suite_writer_receives_only_uncompiled_scenario()
        config = self.suite/'playwright.config.cjs'
        config.write_text('module.exports={testDir:__dirname,testMatch:/.*\\.spec\\.cjs$/};')
        result = subprocess.run(['node',str(runner),'test','--config',str(config),'--list'],
                                text=True,capture_output=True,timeout=30)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
        self.assertIn('Total: 2 tests',result.stdout)

    def test_audit_and_repair_retain_the_uncompiled_partition(self):
        self.test_mixed_suite_writer_receives_only_uncompiled_scenario()
        unsupported = scenario(('WHEN','The user does an unsupported action.'),('THEN','Something happens.'), name='Manual')
        text = document(BASIC,unsupported)
        seen = []
        def audit(messages):
            seen.append(messages)
            return '=== FILE: coverage.json ===\n[]\n=== END ===', {}, 'stop'
        testgen.audit_suite(text,self.suite,audit)
        self.assertEqual(len(seen),1)
        listed = seen[0][1]['content'].split('with one test per scenario below')[1]
        self.assertIn('- REQ-1#2: Manual',listed)
        self.assertNotIn('- REQ-1: Example',listed)
        report={'scenarios':[{'id':'REQ-1#2','status':'error','file':'t01-REQ-1.spec.cjs',
                              'observation':"The test's own code threw: synthetic"}]}
        seen.clear()
        testgen.fix_suite(text,self.suite,report,audit)
        self.assertEqual(len(seen),1)
        listed = seen[0][1]['content'].split('with one test per scenario below')[1]
        self.assertIn('- REQ-1#2: Manual',listed)
        self.assertNotIn('- REQ-1: Example',listed)

    def test_default_flag_is_off(self):
        env = {k:v for k,v in os.environ.items() if k != 'ONESHOT_LIGHT_TESTS'}
        proc = subprocess.run([sys.executable,'-c','from oneshot import testgen; print(testgen.LIGHT_TESTS)'],
                              text=True,capture_output=True,env=env,timeout=10)
        self.assertEqual(proc.returncode,0,proc.stderr)
        self.assertEqual(proc.stdout.strip(),'False')

    def test_compiled_files_never_go_to_writer_repair(self):
        text=document(BASIC)
        with patch.object(testgen,'LIGHT_TESTS',True):
            manifest=testgen.write_suite(text,self.suite,lambda _: self.fail('model called'),audit=False)
        report={'scenarios':[{'id':'REQ-1','status':'error','file':light.SPEC_FILE,
                              'observation':"The test's own code threw: synthetic"}]}
        self.assertEqual(testgen.fix_suite(text,self.suite,report,lambda _: self.fail('repair called')),[])
        self.assertEqual(json.loads((self.suite/'suite.json').read_text()),manifest)

    def test_shared_fixed_helper_failures_remain_independent_scenario_failures(self):
        entries=[{'id':str(i),'status':'fail','at':'light-helpers.cjs:4','compiler':'light','observation':'missing',
                  'file':light.SPEC_FILE} for i in range(2)]
        self.assertEqual(testgen._collapse(entries),entries)
        self.assertEqual([e['status'] for e in entries],['fail','fail'])
        ordinary=[{k:v for k,v in e.items() if k!='compiler'} for e in entries]
        self.assertEqual([e['status'] for e in testgen._collapse(ordinary)],['error','error','fail'])

    def test_flat_package_import_and_compilation(self):
        package=self.suite/'package.zip'
        package_oneshot.build_package(package)
        extracted=self.suite/'flat'
        with zipfile.ZipFile(package) as z:
            self.assertIn('light_tests.py',z.namelist())
            z.extractall(extracted)
        proc=subprocess.run([sys.executable,'-c',
             'import testgen, light_tests, json, sys; testgen.LIGHT_TESTS=True; '
             'm=testgen.write_suite(sys.stdin.read(), "suite", lambda _: (_ for _ in ()).throw(AssertionError("model"))); '
             'print(json.dumps([m["tests"],m["files"][0]["calls"]]))'],
             cwd=extracted,input=document(BASIC),text=True,capture_output=True,timeout=30,
             env={**os.environ,'PYTHONPATH':'','PYTHONDONTWRITEBYTECODE':'1'})
        self.assertEqual(proc.returncode,0,proc.stderr)
        self.assertEqual(json.loads(proc.stdout),[1,0])


if __name__=='__main__':
    unittest.main()
