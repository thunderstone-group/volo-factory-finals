"""Synthetic transport tests, not evidence of model quality or gateway acceptance."""
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
from urllib import request
import zipfile
from oneshot import effort_entry as effort
from scripts.package_minimal_effort import build
from test_oneshot import block, events, SyntheticStream

class GenerationEffortTests(unittest.TestCase):
    def test_exact_request_changes_only_explicit_control_fields(self):
        core=effort.platform.implementation.core
        body={'model':'deepseek-v4-pro','messages':[{'role':'user','content':'Synthetic input'}],
              'stream':True,'stream_options':{'include_usage':True},'max_tokens':32768,'temperature':0.3}
        req=request.Request('https://synthetic.invalid/v1/chat/completions',data=json.dumps(body).encode(),headers={'Authorization':'Bearer synthetic-key'},method='POST')
        seen=[]
        def opener(amended,timeout):seen.append((amended,timeout));return 'synthetic-response'
        with patch.object(core,'_open_model',opener),contextlib.redirect_stderr(io.StringIO()):
            with effort.low_effort_generation(core):self.assertEqual(core._open_model(req,timeout=67),'synthetic-response')
            self.assertIs(core._open_model,opener)
        amended,timeout=seen[0];actual=json.loads(amended.data)
        self.assertEqual(actual,{**body,'thinking':{'type':'enabled'},'reasoning_effort':'low'})
        self.assertEqual(timeout,67);self.assertEqual(amended.full_url,req.full_url)
        self.assertEqual(amended.get_header('Authorization'),'Bearer synthetic-key');self.assertEqual(len(seen),1)
    def test_failure_restores_original_transport(self):
        core=effort.platform.implementation.core
        with patch.object(core,'_open_model') as original:
            with self.assertRaises(RuntimeError):
                with effort.low_effort_generation(core):raise RuntimeError('synthetic')
            self.assertIs(core._open_model,original)
    def test_unrelated_model_is_not_silently_modified(self):
        core=effort.platform.implementation.core
        req=request.Request('https://synthetic.invalid',data=json.dumps({'model':'other-model','stream':True}).encode())
        with patch.object(core,'_open_model') as original,effort.low_effort_generation(core),self.assertRaises(ValueError):core._open_model(req,timeout=1)
        original.assert_not_called()
    def test_extracted_entry_controls_real_generation_request_and_preserves_metadata(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp).resolve();archive=root/'candidate.zip';meta=build(archive)
            again=root/'again.zip';self.assertEqual(build(again)['package_sha256'],meta['package_sha256'])
            self.assertEqual(archive.read_bytes(),again.read_bytes())
            pkg=root/'package'
            with zipfile.ZipFile(archive) as z:
                self.assertEqual(len(z.namelist()),9);z.extractall(pkg)
            def load(name,path):
                spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
            core=load('effort_test_core',pkg/'core.py')
            with patch.dict(sys.modules,{'core':core}):v1=load('effort_test_v1',pkg/'v1.py')
            with patch.dict(sys.modules,{'v1':v1}):v2=load('effort_test_v2',pkg/'v2.py')
            with patch.dict(sys.modules,{'v2':v2}):platform=load('effort_test_platform',pkg/'platform_entry.py')
            with patch.dict(sys.modules,{'platform_entry':platform}):entry=load('effort_test_entry',pkg/'main.py')
            inputs=root/'requirements';inputs.mkdir();(inputs/'requirements.yaml').write_text('name: Synthetic records\n')
            out=root/'out';(out/'.arc').mkdir(parents=True);(out/'.arc/events.jsonl').write_text('runner metadata\n')
            calls=[]
            def transport(req,timeout):
                calls.append(json.loads(req.data));return SyntheticStream(events(block('frontend/public/app.js','// synthetic output\n'),{'prompt_tokens':5,'completion_tokens':8}))
            log=io.StringIO()
            with patch.dict(os.environ,{'OPENAI_API_KEY':'synthetic-key','MODEL':'deepseek-v4-pro'}),patch.object(core,'_open_model',transport),contextlib.redirect_stdout(io.StringIO()),contextlib.redirect_stderr(log):
                code=entry.main([str(inputs),'--output-dir',str(out),'--type','web'])
            self.assertEqual(code,0);self.assertEqual(len(calls),1);self.assertEqual(calls[0]['reasoning_effort'],'low')
            self.assertEqual(calls[0]['thinking'],{'type':'enabled'})
            self.assertIn('generation_control',log.getvalue());self.assertNotIn('synthetic-key',log.getvalue())
            self.assertEqual((out/'.arc/events.jsonl').read_text(),'runner metadata\n')
            self.assertEqual((out/'frontend/public/app.js').read_text(),'// synthetic output\n')
            self.assertEqual(meta['files']['core.py']['sha256'],hashlib.sha256(Path('oneshot/main.py').read_bytes()).hexdigest())

if __name__=='__main__':unittest.main()
