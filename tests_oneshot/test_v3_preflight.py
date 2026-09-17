"""Trusted/synthetic runtime fixtures; never execute a generated app on the host."""
import contextlib
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch
import zipfile

from oneshot import main as core
from oneshot.v3 import entry, observer
from scripts.package_minimal_v3 import build

READY = {'status': 'ready', 'checks': {'isolation': True, 'browser': True}}
RUNTIME = {'bwrap': '/usr/bin/bwrap', 'node': '/usr/bin/node',
           'modules': '/opt/arc/node_modules', 'browsers': '/ms-playwright'}


class RuntimePreflightTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(dir=Path(tempfile.gettempdir()).resolve())
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)

    def execute(self, reply, root=None, deadline=None):
        with patch.object(observer, 'discover', return_value=RUNTIME), \
             patch.object(observer, '_process', return_value=reply) as process:
            result = observer.runtime_preflight(root or self.root/'runtime',
                                                deadline or time.monotonic()+60)
        return result, process

    def test_host_gate_starts_no_process_and_has_no_model_calls(self):
        with patch.object(observer.sys, 'platform', 'darwin'), \
             patch.object(observer, '_process') as process:
            result = observer.runtime_preflight(self.root/'runtime', time.monotonic()+30)
        process.assert_not_called()
        self.assertEqual(result['error']['code'], 'linux_container_required')
        self.assertEqual(result['status'], 'environment_error')
        self.assertEqual(result['model_calls'], 0)
        self.assertFalse(result['generated_code_executed'])
        self.assertTrue(result['cleanup_verified'])

    def test_missing_and_privileged_helpers_are_not_executed(self):
        for code in ('safe_runtime_or_browser_missing', 'privileged_runtime_refused'):
            with self.subTest(code=code), patch.object(observer, 'discover', side_effect=ValueError(code)), \
                 patch.object(observer, '_process') as process:
                result = observer.runtime_preflight(self.root/'runtime', time.monotonic()+30)
            process.assert_not_called()
            self.assertEqual(result['error']['code'], code)

    def test_ready_runs_only_trusted_driver_with_empty_app_and_clean_environment(self):
        def process(argv, cwd, seconds, **kwargs):
            self.assertGreater(seconds, 0); self.assertLessEqual(seconds, 35)
            self.assertEqual(kwargs['env'], {'PATH': '/usr/local/bin:/usr/bin:/bin', 'LANG': 'C.UTF-8'})
            self.assertLessEqual(kwargs['max_log'], 16384)
            config = json.loads(Path(argv[-1]).read_text())
            self.assertEqual(config['mode'], 'preflight')
            self.assertEqual(list(Path(config['app']).iterdir()), [])
            probe = Path(config['probe'])
            self.assertEqual({p.name for p in probe.iterdir()}, {'runner.cjs'})
            self.assertEqual((probe/'runner.cjs').read_bytes(), (observer.HERE/'runner.cjs').read_bytes())
            return {'exit_code': 0, 'output': json.dumps(READY), 'elapsed_seconds': 0.01}
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'synthetic-private-key', 'NODE_OPTIONS': 'untrusted'}), \
             patch.object(observer, 'discover', return_value=RUNTIME), \
             patch.object(observer, '_process', side_effect=process):
            result = observer.runtime_preflight(self.root/'runtime', time.monotonic()+60)
        self.assertEqual(result['status'], 'ready')
        self.assertTrue(result['cleanup_verified'])
        self.assertEqual(list((self.root/'runtime').iterdir()), [])
        self.assertNotIn('synthetic-private-key', json.dumps(result))
        self.assertNotIn('NODE_OPTIONS', json.dumps(result))
        self.assertEqual(result['verified_requirements'], [])
        self.assertFalse(result['official_score'])

    def test_process_failure_timeout_and_forged_receipts_fail_closed(self):
        replies = [
            {'exit_code': 1, 'output': json.dumps(READY)},
            {'exit_code': -9, 'reason': 'timeout', 'output': json.dumps(READY)},
            {'exit_code': 0, 'reason': 'output_limit', 'output': json.dumps(READY)},
            {'exit_code': 0, 'output': 'not JSON'},
            {'exit_code': 0, 'output': '{"status":"observed","report":{}}'},
            {'exit_code': 0, 'output': '{"status":"ready","checks":{"isolation":1,"browser":true}}'},
            {'exit_code': 0, 'output': json.dumps({**READY, 'extra': 'forged'})},
            {'exit_code': 0, 'output': '{"status":"environment_error","code":"browser_unavailable"}'},
            {'exit_code': 0, 'output': '{"status":"environment_error","code":"synthetic-private-secret"}'},
        ]
        for i, reply in enumerate(replies):
            with self.subTest(reply=i):
                result, process = self.execute(reply, self.root/str(i))
                self.assertEqual(result['status'], 'environment_error')
                self.assertIn(result['error']['code'], observer.PREFLIGHT_CODES)
                self.assertTrue(result['cleanup_verified'])
                self.assertNotIn('synthetic-private-secret', json.dumps(result))

    def test_exhausted_wall_budget_does_not_start_a_process(self):
        result, process = self.execute({}, deadline=time.monotonic()-1)
        process.assert_not_called()
        self.assertEqual(result['error']['code'], 'wall_budget_exhausted')

    def test_cleanup_failure_cannot_be_ready_and_preserves_unrelated_evidence(self):
        root = self.root/'runtime'; root.mkdir()
        (root/'existing-evidence').write_text('must not delete')
        result, _ = self.execute({'exit_code': 0, 'output': json.dumps(READY)}, root)
        self.assertEqual(result['error']['code'], 'preflight_cleanup_failed')
        self.assertEqual(result['status'], 'environment_error')
        self.assertEqual((root/'existing-evidence').read_text(), 'must not delete')

    def test_worker_preflight_failure_skips_every_model_and_business_stage(self):
        req = self.root/'requirements'; req.mkdir()
        (req/'requirements.md').write_text('Synthetic public requirement')
        evidence = self.root/'evidence'; evidence.mkdir()
        out = self.root/'application'
        failure = {'status': 'environment_error', 'cleanup_verified': True,
                   'error': {'stage': 'runtime_preflight', 'code': 'isolation_unavailable'}}
        with patch.object(entry, 'runtime_preflight', return_value=failure), \
             patch.object(entry.v2, 'main') as generation, \
             patch.object(entry.planner, 'plan') as planner, \
             patch.object(entry.bf, 'run') as repair:
            code = entry.worker(req, out, evidence, time.monotonic()+60)
        self.assertEqual(code, 1)
        generation.assert_not_called(); planner.assert_not_called(); repair.assert_not_called()
        self.assertFalse(out.exists())
        report = json.loads((evidence/'result.json').read_text())
        self.assertEqual(report['status'], 'environment_error')
        self.assertEqual(report['planner_calls'], 0)
        self.assertEqual(report['repair']['model_calls'], 0)
        for name in ('generation', 'planner', 'observation', 'repair'):
            self.assertEqual(report['stages'][name]['status'], 'skipped')
        self.assertFalse((evidence/'generation.json').exists())
        self.assertFalse((evidence/'planner.json').exists())

    def test_generation_failure_does_not_plan_and_restores_transport(self):
        req = self.root/'requirements'; req.mkdir()
        evidence = self.root/'evidence'; evidence.mkdir()
        preflight = {'status': 'ready', 'cleanup_verified': True, 'synthetic': True}
        with patch.object(entry, 'runtime_preflight', return_value=preflight), \
             patch.object(entry.v2, 'main', return_value=1), \
             patch.object(entry.planner, 'plan') as planner, \
             patch.object(core, '_open_model') as transport:
            code = entry.worker(req, self.root/'app', evidence, time.monotonic()+60)
            self.assertIs(core._open_model, transport)
        planner.assert_not_called(); transport.assert_not_called()
        self.assertEqual(code, 1)
        report = json.loads((evidence/'result.json').read_text())
        self.assertEqual(report['stages']['generation']['status'], 'failed')
        self.assertEqual(report['stages']['planner']['status'], 'skipped')

    def test_shipped_driver_preflight_never_copies_builds_or_runs_application(self):
        node = shutil.which('node')
        if not node:
            self.skipTest('Node is required for this trusted driver test')
        script = r"""
const fs=require('node:fs'),vm=require('node:vm'),{EventEmitter}=require('node:events'),{PassThrough}=require('node:stream');
const source=fs.readFileSync(process.argv[1],'utf8'),mode=process.argv[2];
let copied=false,browserLaunches=0;const spawns=[];
const fakefs={
 fstatSync(){throw Object.assign(new Error(),{code:'EBADF'});},
 existsSync(){return true;},lstatSync(){return {isSymbolicLink(){return false;}};},
 cpSync(){copied=true;throw new Error('preflight must not copy source');}
};
function spawn(command,args){
 spawns.push({command,args});const p=new EventEmitter();
 p.stdout=new PassThrough();p.stderr=new PassThrough();p.kill=()=>true;
 setImmediate(()=>{p.stdout.end();p.stderr.end();p.emit('close',0);});return p;
}
const timer=setTimeout(()=>{process.stderr.write('driver did not return');process.exitCode=1;},2000);
const output=text=>{clearTimeout(timer);setImmediate(()=>process.stdout.write(JSON.stringify({result:JSON.parse(text),copied,browserLaunches,spawns})));};
vm.runInNewContext(source,{
 require(name){
  if(name==='node:fs')return fakefs;
  if(name==='node:child_process')return {spawn};
  if(name==='@playwright/test')return {chromium:{async launch(){browserLaunches++;return {async close(){}};}}};
  throw new Error('unexpected require '+name);
 },
 process:{argv:['node','runner','bwrap','node','/modules','3','4','5',mode],getuid:()=>65534,getgid:()=>65534,env:{},stdout:{write:output}},
 setTimeout,clearTimeout,Buffer,
});
"""
        for mode in ('preflight', 'unsupported'):
            with self.subTest(mode=mode):
                result = subprocess.run([node, '-e', script, str(observer.HERE/'runner.cjs'), mode],
                                        capture_output=True, text=True, timeout=5)
                self.assertEqual(result.returncode, 0, result.stdout+result.stderr)
                report = json.loads(result.stdout)
                self.assertFalse(report['copied'])
                if mode == 'preflight':
                    self.assertEqual(report['result'], READY)
                    self.assertEqual(report['browserLaunches'], 1)
                    self.assertEqual(len(report['spawns']), 1)
                    self.assertIn('-e', report['spawns'][0]['args'])
                    self.assertNotIn('npm', report['spawns'][0]['args'])
                else:
                    self.assertEqual(report['result']['status'], 'environment_error')
                    self.assertEqual(report['spawns'], [])
                    self.assertEqual(report['browserLaunches'], 0)

    def test_extracted_entry_real_missing_runtime_preserves_platform_metadata_without_key(self):
        if sys.platform == 'linux' and Path('/usr/bin/bwrap').exists():
            self.skipTest('This negative fixture requires a host or missing-runtime environment')
        archive = self.root/'candidate.zip'; build(archive)
        package = self.root/'package'
        with zipfile.ZipFile(archive) as z: z.extractall(package)
        req = self.root/'requirements'; req.mkdir()
        (req/'requirements.md').write_text('Synthetic public requirement')
        out = self.root/'output'; (out/'.arc').mkdir(parents=True)
        marker = out/'.arc/runner-events.jsonl'; marker.write_text('runner-owned')
        inode = out.stat().st_ino
        result = subprocess.run([sys.executable, '-B', 'main.py', str(req),
                                 '--output-dir', str(out), '--type', 'web'],
                                cwd=package, env={'PATH': os.environ.get('PATH', '')},
                                capture_output=True, text=True, timeout=20)
        self.assertEqual(result.returncode, 1, result.stdout+result.stderr)
        report = json.loads(result.stdout)
        self.assertFalse(report['delivered'])
        self.assertEqual(report['result']['stop_reason'], 'runtime_preflight_failed')
        self.assertEqual(report['result']['planner_calls'], 0)
        self.assertEqual(report['result']['repair']['model_calls'], 0)
        self.assertEqual(out.stat().st_ino, inode)
        self.assertEqual(marker.read_text(), 'runner-owned')
        self.assertEqual({p.name for p in out.iterdir()}, {'.arc'})


if __name__ == '__main__':
    unittest.main()
