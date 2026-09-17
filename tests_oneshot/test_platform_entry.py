"""Synthetic extracted-package tests; no real gateway or generated app execution."""
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
import zipfile
from scripts.package_minimal_platform import build
from test_oneshot import block, events, SyntheticStream

class PlatformEntryTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name).resolve();self.archive=self.root/'candidate.zip'
        self.manifest=build(self.archive);self.pkg=self.root/'package'
        with zipfile.ZipFile(self.archive) as z:z.extractall(self.pkg)
        def load(name,path):
            spec=importlib.util.spec_from_file_location(name,path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
        self.core=load('platform_test_core',self.pkg/'core.py')
        with patch.dict(sys.modules,{'core':self.core}):v1=load('platform_test_v1',self.pkg/'v1.py')
        with patch.dict(sys.modules,{'v1':v1}):v2=load('platform_test_v2',self.pkg/'v2.py')
        with patch.dict(sys.modules,{'v2':v2}):self.entry=load('platform_test_entry',self.pkg/'main.py')
        self.req=self.root/'requirements';self.req.mkdir();(self.req/'requirements.yaml').write_text('name: Synthetic application\n')
        self.out=self.root/'template';self.out.mkdir()
        (self.out/'.arc/traceability').mkdir(parents=True);(self.out/'.arc/runner-events.jsonl').write_text('runner-owned\n')
        (self.out/'requirements').mkdir();(self.out/'requirements/requirements.yaml').write_text('runner-owned requirement\n')
        self.calls=[]
    def invoke(self,text=None):
        text=text or block('frontend/public/app.js','// synthetic generated application\n')
        def transport(req,timeout):
            self.calls.append(json.loads(req.data));return SyntheticStream(events(text,{'prompt_tokens':5,'completion_tokens':8}))
        with patch.dict(os.environ,{'OPENAI_API_KEY':'synthetic-test-key','MODEL':'synthetic'}),patch.object(self.core,'_open_model',side_effect=transport),contextlib.redirect_stdout(io.StringIO()),contextlib.redirect_stderr(io.StringIO()):
            return self.entry.main([str(self.req),'--output-dir',str(self.out)])
    def test_metadata_preserved_and_extracted_entry_generates(self):
        before={str(p.relative_to(self.out)):p.read_bytes() for p in self.out.rglob('*') if p.is_file()}
        inode=self.out.stat().st_ino
        self.assertEqual(self.invoke(),0);self.assertEqual(len(self.calls),1)
        self.assertEqual(self.out.stat().st_ino,inode)
        for name,data in before.items():self.assertEqual((self.out/name).read_bytes(),data)
        self.assertTrue((self.out/'frontend/package.json').is_file());self.assertTrue((self.out/'backend/server.cjs').is_file())
        self.assertFalse(list(self.root.glob('.volo-platform-*')))
    def test_existing_application_refused_before_model(self):
        (self.out/'frontend').mkdir();(self.out/'frontend/existing.txt').write_text('keep')
        self.assertEqual(self.invoke(),1);self.assertFalse(self.calls)
        self.assertEqual((self.out/'frontend/existing.txt').read_text(),'keep')
    def test_empty_application_directories_allowed(self):
        for name in ('frontend','backend'):(self.out/name).mkdir()
        self.assertEqual(self.invoke(),0)
    def test_symlink_output_refused(self):
        target=self.root/'target';target.mkdir();self.out=self.root/'alias';self.out.symlink_to(target,target_is_directory=True)
        self.assertEqual(self.invoke(),1);self.assertFalse(self.calls);self.assertFalse(list(target.iterdir()))
    def test_failed_generation_preserves_metadata(self):
        self.assertEqual(self.invoke(block('frontend/public/volo-interaction.js','changed protected source')),1)
        self.assertEqual((self.out/'.arc/runner-events.jsonl').read_text(),'runner-owned\n')
        self.assertFalse((self.out/'frontend').exists())
    def test_publish_second_root_failure_rolls_back(self):
        candidate=self.root/'staged';candidate.mkdir()
        self.entry.implementation.starter(candidate)
        original=Path.rename
        def rename(path,target):
            if path==candidate/'backend':raise OSError('synthetic publication failure')
            return original(path,target)
        with patch.object(Path,'rename',rename),self.assertRaises(OSError):self.entry.publish(candidate,self.out)
        self.assertFalse((self.out/'frontend').exists());self.assertTrue((candidate/'frontend').is_dir())
        self.assertEqual((self.out/'.arc/runner-events.jsonl').read_text(),'runner-owned\n')
    def test_package_reproducible_and_only_allowlisted_code(self):
        again=self.root/'again.zip';second=build(again)
        self.assertEqual(self.archive.read_bytes(),again.read_bytes())
        self.assertEqual(len(self.manifest['files']),8)
        self.assertEqual(self.manifest['files']['v2.py']['sha256'],hashlib.sha256(Path('oneshot/v2/main.py').read_bytes()).hexdigest())
        self.assertEqual(second['package_sha256'],self.manifest['package_sha256'])

if __name__=='__main__':unittest.main()
