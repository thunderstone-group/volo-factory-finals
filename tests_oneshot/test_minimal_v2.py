"""Synthetic model streams test the extracted V2 package, never real model quality."""
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
from scripts.package_minimal_v2 import build
from scripts.package_minimal_v1 import build as build_v1
from scripts.run_minimal_batch import extract_candidate, read_trace
from test_oneshot import block, events, SyntheticStream

class V2Tests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name);self.zip=self.root/'v2.zip';self.manifest=build(self.zip)
        self.extracted=self.root/'package';extract_candidate(self.zip,self.manifest['package_sha256'],self.extracted)
        def load(name,path):
            spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
        core=load('v2_test_core',self.extracted/'core.py')
        with patch.dict(sys.modules,{'core':core}):adapter=load('v2_test_adapter',self.extracted/'v1.py')
        with patch.dict(sys.modules,{'v1':adapter}):self.entry=load('v2_test_entry',self.extracted/'main.py')
        self.inputs=self.root/'inputs';self.inputs.mkdir();(self.inputs/'requirements.yaml').write_text('name: Synthetic records\n')
    def invoke(self,text):
        stderr=io.StringIO();captured=[]
        def transport(req,timeout):captured.append(json.loads(req.data));return SyntheticStream(events(text,{'prompt_tokens':5,'completion_tokens':8}))
        with patch.dict(os.environ,{'OPENAI_API_KEY':'synthetic-key','MODEL':'synthetic-pro'}),patch.object(self.entry.core,'_open_model',side_effect=transport),contextlib.redirect_stdout(io.StringIO()),contextlib.redirect_stderr(stderr):
            code=self.entry.main([str(self.inputs),'--output-dir',str(self.root/'out')])
        log=self.root/'trace.log';log.write_text(stderr.getvalue());return code,captured,read_trace(log)
    def test_package_is_reproducible_and_v1_unchanged(self):
        build(self.root/'again.zip');self.assertEqual(self.zip.read_bytes(),(self.root/'again.zip').read_bytes())
        self.assertEqual(len(self.manifest['files']),7)
        self.assertEqual(build_v1(self.root/'v1.zip')['package_sha256'],'28ca6f990fef97a3830a1a28b7d766742f523f1276b17d2c0af6170730994b68')
    def test_actual_request_contains_fixed_source_and_retains_it(self):
        code,payloads,(traces,usage,error)=self.invoke(block('frontend/public/app.js','// Synthetic new business implementation\n'))
        self.assertEqual(code,0);self.assertEqual(usage['calls'],1);self.assertIsNone(error)
        text=payloads[0]['messages'][1]['content']
        self.assertIn('VoloNavigation.create',text);self.assertIn('function rowActions',text)
        self.assertEqual(payloads[0]['model'],'synthetic-pro')
        for target,source in self.entry.PROTECTED.items():
            self.assertEqual((self.root/'out'/target).read_bytes(),(self.extracted/source).read_bytes())
        self.assertEqual(len(traces),1)
        self.assertTrue(traces[0]['transport']['done'])
        self.assertEqual(traces[0]['transport']['content_chars'],len(block('frontend/public/app.js','// Synthetic new business implementation\n')))
    def test_modified_fixed_source_is_rejected_before_publication(self):
        code,_,(_,usage,error)=self.invoke(block('frontend/public/volo-interaction.js','// changed'))
        self.assertEqual(code,1);self.assertEqual(usage['calls'],1)
        self.assertIn('Protected shared implementation changed',error)
        self.assertFalse((self.root/'out').exists())
    def test_existing_application_is_not_reused_or_overwritten(self):
        (self.root/'out').mkdir();(self.root/'out/retained').write_text('keep')
        code,requests,(_,usage,error)=self.invoke('must not consume')
        self.assertEqual(code,1);self.assertEqual(requests,[]);self.assertEqual(usage['calls'],0)
        self.assertEqual((self.root/'out/retained').read_text(),'keep')

if __name__=='__main__':unittest.main()
