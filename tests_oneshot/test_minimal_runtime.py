"""Protocol tests and opt-in REAL containers with synthetic application code."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch

from oneshot import main as baseline
from oneshot import minimal_feedback as feedback
from oneshot.minimal_runtime import DockerRuntime, editable_files, process_status
from test_oneshot import block, events, SyntheticStream

IMAGE = os.environ.get('MINIMAL_TEST_IMAGE')
GOOD_BUILD = "require('node:fs').cpSync('public','dist',{recursive:true});\n"
BAD_BUILD = "console.log('passed'); throw new Error('synthetic build failure');\n"

def server(health=True):
    body = '{code:200,message:"Backend Ready"}' if health else '{code:200,message:"Wrong"}'
    return '''const fs=require('node:fs'); const http=require('node:http');
http.createServer((req,res)=>{
 if(req.url==='/api/health'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(HEALTH));}
 else {res.setHeader('Content-Type','text/html');res.end(fs.readFileSync('../frontend/dist/index.html'));}
}).listen(process.env.PORT);
'''.replace('HEALTH',body)

class Fixture:
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name).resolve(); self.app=self.root/'app';self.out=self.root/'out'
        blobs={'frontend/package.json':json.dumps({'scripts':{'build':'node build.cjs'}}),
               'frontend/build.cjs':GOOD_BUILD,'frontend/public/index.html':'<!doctype html><h1>Synthetic</h1>',
               'backend/package.json':json.dumps({'scripts':{'start':'node server.cjs'}}),
               'backend/server.cjs':server()}
        for n,s in blobs.items():
            p=self.app/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(s)
        (self.app/'.env').write_text('SYNTHETIC_SECRET=must-not-transfer')
        (self.app/'frontend/dist').mkdir();(self.app/'frontend/dist/index.html').write_text('stale')
    def tree(self):return {str(p.relative_to(self.app)):p.read_bytes() for p in self.app.rglob('*') if p.is_file()}

class RuntimeProtocolTests(Fixture,unittest.TestCase):
    def test_docker_failure_is_environment_but_app_missing_dependency_is_product(self):
        for code,text in ((125,''),(1,'Error response from daemon: container stopped'),(126,'OCI runtime exec failed: executable unavailable')):
            self.assertEqual(process_status({'exit_code':code,'output':text}),'environment_error')
        self.assertEqual(process_status({'exit_code':1,'output':"Error: Cannot find module 'invented-dependency'"}),'product_fail')
        self.assertEqual(process_status({'exit_code':-9,'reason':'timeout'}),'unknown')

    def test_image_pin_and_explicit_isolation(self):
        with self.assertRaises(ValueError):DockerRuntime('node:latest')
        runtime=DockerRuntime('sha256:'+'a'*64)
        args=runtime.create_args('unique-owned-name','/synthetic/input')
        for flag in ('--pull=never','--network=none','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--memory=2g','--pids-limit=96'):self.assertIn(flag,args)
        self.assertNotIn('-p',args);self.assertNotIn('/var/run/docker.sock',' '.join(args))
        self.assertIn('20002:20002',args);self.assertIn('readonly',' '.join(args))
    def test_environment_error_never_consumes_offline_or_model_repair(self):
        runtime=DockerRuntime('sha256:'+'a'*64)
        with patch.object(DockerRuntime,'preflight',return_value={'status':'environment_error','reason':'docker_unavailable'}), patch.object(baseline,'_open_model',side_effect=AssertionError('must not call')):
            report=feedback.run(self.app,self.out,runtime_image=runtime.image,max_rounds=2,model_config={'model':'synthetic','base':'https://synthetic.invalid','key':'synthetic'})
        self.assertEqual(report['stop_reason'],'environment_error');self.assertEqual(report['model_api_calls'],0)
    def test_editable_paths_are_not_check_identifiers_or_tests(self):
        blobs=baseline.read_template(self.app);blobs['backend/test/hidden.spec.js']=b'synthetic';blobs['official-results.json']=b'synthetic'
        names=editable_files(blobs)
        self.assertIn('frontend/build.cjs',names);self.assertIn('frontend/package.json',names)
        self.assertNotIn('health',names);self.assertNotIn('backend/test/hidden.spec.js',names)
        self.assertNotIn('official-results.json',names)
    def test_real_model_transport_contract_is_separate_from_replay_and_caps_requests(self):
        (self.app/'backend/server.cjs').write_text('const bad = ;')
        content=block('backend/server.cjs',server())
        with patch.object(baseline,'_open_model',return_value=SyntheticStream(events(content,{'prompt_tokens':7,'completion_tokens':11}))) as call:
            report=feedback.run(self.app,self.out,max_rounds=2,model_config={'model':'synthetic','base':'https://synthetic.invalid','key':'synthetic-test-secret'})
        self.assertEqual(report['model_api_calls'],1);self.assertEqual(report['replay_calls'],0)
        self.assertEqual(report['usage']['prompt_tokens'],7);self.assertEqual(report['usage']['completion_tokens'],11)
        self.assertNotIn('synthetic-test-secret',json.dumps(report));call.assert_called_once()

@unittest.skipUnless(IMAGE,'Set MINIMAL_TEST_IMAGE to an existing pinned local image; no auto-pull')
class RealContainerTests(Fixture,unittest.TestCase):
    def check(self):
        before=self.tree();result=DockerRuntime(IMAGE).check(self.app)
        self.assertEqual(self.tree(),before);self.assertTrue(result['cleanup_verified'],result)
        self.assertEqual(result['behavior'],'unknown');self.assertEqual(result['verified_requirements'],[])
        return result
    def repair(self,*responses):
        before=self.tree();result=feedback.run(self.app,self.out,runtime_image=IMAGE,max_rounds=2,responses=responses)
        self.assertEqual(self.tree(),before)
        self.assertTrue(result['baseline_feedback']['cleanup_verified'],result)
        for r in result['rounds']:
            if 'feedback' in r:self.assertTrue(r['feedback']['cleanup_verified'],r)
        return result
    def test_correct_application_runs_all_checks_without_repair(self):
        result=self.repair('must not consume')
        self.assertEqual(result['stop_reason'],'pass',result);self.assertEqual(result['replay_calls'],0)
        self.assertEqual(result['baseline_feedback']['environment']['node'],'v22.17.0')
    def test_runtime_exception_is_product_failure_and_repairs(self):
        (self.app/'backend/server.cjs').write_text("console.log('passed');throw new Error('synthetic runtime failure');")
        result=self.repair(block('backend/server.cjs',server()))
        self.assertEqual(result['stop_reason'],'runtime_pass_behavior_unknown',result)
        self.assertEqual(result['replay_calls'],1)
        self.assertIn('start',[r['id'] for r in result['baseline_feedback']['checks'] if r['status']=='product_fail'])
    def test_build_error_then_new_health_feedback_accumulates(self):
        (self.app/'frontend/build.cjs').write_text(BAD_BUILD);(self.app/'backend/server.cjs').write_text(server(False))
        result=self.repair(block('frontend/build.cjs',GOOD_BUILD),block('backend/server.cjs',server()))
        self.assertEqual(result['stop_reason'],'runtime_pass_behavior_unknown',result)
        packet=json.loads(result['rounds'][1]['attempt']['messages'][0]['content'])
        self.assertIn('health',[r['id'] for r in packet['failures']]);self.assertEqual(packet['sources']['frontend/build.cjs'],GOOD_BUILD)
        self.assertEqual((self.out/'frontend/build.cjs').read_text(),GOOD_BUILD)
    def test_manifest_dependency_is_product_error_and_editable(self):
        (self.app/'backend/package.json').write_text(json.dumps({'scripts':{'start':'node server.cjs'},'dependencies':{'imaginary':'1'}}))
        result=self.repair(block('backend/package.json',json.dumps({'scripts':{'start':'node server.cjs'}})))
        self.assertEqual(result['stop_reason'],'runtime_pass_behavior_unknown',result)
    def test_stale_dist_and_stdout_success_cannot_mask_missing_build(self):
        (self.app/'frontend/build.cjs').write_text("console.log('passed');")
        result=self.check();self.assertEqual(result['status'],'product_fail',result)
        self.assertIn('build',[r['id'] for r in result['checks'] if r['status']=='product_fail'])
    def test_wrong_health_json_is_not_pass(self):
        (self.app/'backend/server.cjs').write_text(server(False))
        result=self.check();self.assertEqual(result['status'],'product_fail',result)
        self.assertIn('health',[r['id'] for r in result['checks'] if r['status']=='product_fail'])
    def test_dynamic_home_is_unknown_and_does_not_trigger_model_repair(self):
        dynamic=server().replace("fs.readFileSync('../frontend/dist/index.html')", "fs.readFileSync('../frontend/dist/index.html','utf8').replace('Synthetic','Rendered Synthetic')")
        (self.app/'backend/server.cjs').write_text(dynamic)
        before=self.tree()
        with patch.object(baseline,'_open_model',side_effect=AssertionError('uncertain homepage must not trigger a model call')):
            result=feedback.run(self.app,self.out,runtime_image=IMAGE,max_rounds=2,
                model_config={'model':'synthetic','base':'https://synthetic.invalid','key':'synthetic'})
        self.assertEqual(result['stop_reason'],'unknown',result)
        self.assertEqual(result['model_api_calls'],0)
        self.assertEqual(self.tree(),before)
        self.assertEqual(baseline.read_template(self.out),baseline.read_template(self.app))
        self.assertTrue(result['baseline_feedback']['cleanup_verified'])
        home=next(r for r in result['baseline_feedback']['checks'] if r['id']=='home')
        self.assertEqual(home['status'],'unknown')
        self.assertEqual(home['reason'],'served_home_differs_from_build')
    def test_non_html_home_remains_product_failure(self):
        (self.app/'backend/server.cjs').write_text(server().replace("res.setHeader('Content-Type','text/html')", "res.setHeader('Content-Type','text/plain')"))
        result=self.check()
        self.assertEqual(result['status'],'product_fail',result)
        self.assertEqual(next(r['status'] for r in result['checks'] if r['id']=='home'),'product_fail')
    def test_source_mutation_cannot_be_accepted(self):
        (self.app/'frontend/build.cjs').write_text("require('node:fs').appendFileSync('../backend/server.cjs','// mutation');"+GOOD_BUILD)
        result=self.check();self.assertEqual(result['status'],'unknown',result)
    def test_runtime_regression_preserves_initial_artifact(self):
        (self.app/'backend/server.cjs').write_text(server(False))
        before=self.tree()
        result=self.repair(block('frontend/build.cjs',BAD_BUILD),block('backend/server.cjs',server()))
        self.assertEqual(result['stop_reason'],'regression_or_missing_protected_evidence',result)
        self.assertEqual(result['replay_calls'],1)
        self.assertEqual((self.out/'backend/server.cjs').read_bytes(),before['backend/server.cjs'])

    def test_excessive_app_output_is_unknown_and_cleaned(self):
        (self.app/'backend/server.cjs').write_text("console.log('x'.repeat(1000000));setInterval(()=>{},1000);")
        result=self.repair(block('backend/server.cjs',server()))
        self.assertEqual(result['stop_reason'],'unknown',result)
        self.assertEqual(result['replay_calls'],0)
        self.assertIn('output_limit',json.dumps(result['baseline_feedback']))

    def test_environment_credentials_and_validator_write_are_blocked(self):
        guard="""const fs=require('node:fs');
if(process.env.OPENAI_API_KEY || fs.existsSync('/input/.env') || fs.existsSync('/opt/arc/package.json'))throw new Error('secret/evaluator exposed');
if(process.getuid()!==10001 || Object.keys(require('node:os').networkInterfaces()).some(n=>n!=='lo'))throw new Error('isolation contract broken');
try{fs.writeFileSync('/verifier.cjs','forged');throw new Error('validator writable');}catch(e){if(e.message==='validator writable')throw e;}
"""
        (self.app/'backend/server.cjs').write_text(guard+server().replace("const fs=require('node:fs'); ",''))
        with patch.dict(os.environ,{'OPENAI_API_KEY':'synthetic-env-sentinel'}):result=self.check()
        self.assertEqual(result['status'],'pass',result);self.assertNotIn('synthetic-env-sentinel',json.dumps(result))
