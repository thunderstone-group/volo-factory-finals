"""Relay recovery controls use synthetic local children and response bytes only."""
import base64
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch
from urllib.request import Request

sys.path[:0]=[str(Path(__file__).resolve().parents[1]/'scripts'),str(Path(__file__).resolve().parents[1]/'scripts/mini_swe')]
from remote_transport import LAUNCH,RemoteResponse
from recover_run import captured_response
from arc_model import MODEL

class RelayTests(unittest.TestCase):
    def test_launcher_does_not_repeat_a_job_when_acknowledgement_is_retried(self):
        with tempfile.TemporaryDirectory() as t:
            p=Path(t)/'job'
            worker="import json,sys,pathlib;json.load(sys.stdin);p=pathlib.Path(__file__).parent;f=(p/'starts').open('a');f.write('started\\n');f.close()"
            data=json.dumps({'directory':str(p),'worker_source':worker,'key':'synthetic-placeholder','body':'e30=','url':'https://example.invalid'})
            one=subprocess.run([sys.executable,'-c',LAUNCH],input=data,text=True,capture_output=True,check=True)
            two=subprocess.run([sys.executable,'-c',LAUNCH],input=data,text=True,capture_output=True,check=True)
            self.assertEqual(json.loads(one.stdout)['pid'],json.loads(two.stdout)['pid'])
            until=time.time()+3
            while not (p/'starts').exists() and time.time()<until:time.sleep(.01)
            self.assertEqual((p/'starts').read_text(),'started\n')
    def test_cleanup_failure_does_not_discard_a_complete_response(self):
        data=b'data: [DONE]\n\n';request=b'{}'
        status={'request_sha256':hashlib.sha256(request).hexdigest(),'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data),'curl_exit_code':0,'http_status':200}
        def ssh(self,code,stdin=None,timeout=30):
            if code==LAUNCH:return json.dumps({'directory':'/tmp/arc-mini-transport-synthetic','state':'started'})
            if 'done.json' in code:return json.dumps(status)
            if 'f.seek' in code:return json.dumps({'data':base64.b64encode(data).decode(),'bytes':len(data)})
            if 'curl.stderr' in code:return ''
            if 'shutil.rmtree' in code:raise RuntimeError('synthetic cleanup failure')
            raise AssertionError(code)
        with tempfile.TemporaryDirectory() as t,patch.object(RemoteResponse,'ssh',ssh):
            observed={'lines':0,'sse_events':0,'reasoning_chars':0,'content_chars':0,'saw_done':False}
            with RemoteResponse(Request('https://example.invalid',data=request), 'synthetic-placeholder',Path(t),observed,'','1.1') as response:
                self.assertEqual(b''.join(response),data)
            self.assertFalse(observed['remote_cleanup_complete']);self.assertTrue(observed['saw_done'])
    def test_captured_native_response_retains_tools_and_requires_usage_and_done(self):
        frames=[{'model':MODEL,'choices':[{'delta':{'reasoning_content':'synthetic','tool_calls':[{'index':0,'id':'call_1','function':{'name':'bash','arguments':'{"command":"ls"}'}}]},'finish_reason':'tool_calls'}]}, {'model':MODEL,'choices':[],'usage':{'prompt_tokens':100,'completion_tokens':20}}]
        lines=[b'data: '+json.dumps(d).encode()+b'\n' for d in frames]
        with self.assertRaises(ValueError):captured_response(lines,Path('/synthetic'))
        result=captured_response(lines+[b'data: [DONE]\n'],Path('/synthetic'))
        self.assertEqual(result['tool_calls'][0]['function']['arguments'],'{"command":"ls"}')
        self.assertEqual(result['reasoning_content'],'synthetic')

if __name__=='__main__':unittest.main()
