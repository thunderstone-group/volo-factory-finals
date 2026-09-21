"""Synthetic protocol/ledger controls; real container/model validation is separate."""
import json
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

sys.path[:0]=[str(Path(__file__).resolve().parents[1]/'scripts'),str(Path(__file__).resolve().parents[1]/'scripts/mini_swe')]
from arc_model import ArcGateway,MiniModel,MODEL,BudgetStop,WORKFLOW_TOOLS
from environment import AppEnvironment,copy_source


def event(data):return b'data: '+json.dumps(data).encode()+b'\n\n'

class SyntheticResponse:
    calls=[]
    incomplete=False
    def __init__(self,request,key,out,observed,*args):
        self.calls.append(json.loads(request.data));observed.update(response_model=MODEL,http_status=200,curl_exit_code=0)
    def __enter__(self):return self
    def __exit__(self,*args):pass
    def __iter__(self):
        yield event({'choices':[{'delta':{'reasoning_content':'synthetic reasoning','tool_calls':[{'index':0,'id':'call_1','type':'function','function':{'name':'bash','arguments':'{"command":'}}]}}]})
        yield event({'choices':[{'delta':{'tool_calls':[{'index':0,'function':{'arguments':'"ls"}'}}]},'finish_reason':'tool_calls'}]})
        if not self.incomplete:
            yield event({'choices':[],'usage':{'prompt_tokens':100,'completion_tokens':20}})
            yield b'data: [DONE]\n\n'

class MiniAdapterTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.root=Path(self.tmp.name)
        self.client=SimpleNamespace(access_key=lambda:'synthetic-placeholder',config=SimpleNamespace(api_base_url='https://example.invalid/v1'))
        SyntheticResponse.calls=[];SyntheticResponse.incomplete=False
    def gateway(self,budget=3):return ArcGateway(self.root/'model',self.client,budget,32)
    def test_native_tool_fragments_and_reasoning_survive_next_request(self):
        with patch('arc_model.Response',SyntheticResponse):
            m=MiniModel(self.gateway());messages=[{'role':'user','content':'test'}];response=m.query(messages)
            self.assertEqual(response['extra']['actions'][0]['command'],'ls')
            observations=m.format_observation_messages(response,[{'returncode':0,'output':'app.js'}])
            m.query(messages+[response]+observations)
        sent=SyntheticResponse.calls[1]['messages']
        self.assertEqual(sent[1]['reasoning_content'],'synthetic reasoning')
        self.assertEqual(sent[2]['tool_call_id'],'call_1')
        self.assertNotIn('extra',sent[1])
        self.assertEqual(SyntheticResponse.calls[0]['tools'][0]['function']['name'],'bash')
    def test_completed_identical_request_is_reused_without_spending(self):
        with patch('arc_model.Response',SyntheticResponse):
            m=self.gateway();a=m.complete([{'role':'user','content':'same'}],tools=True);spent=m.spent
            b=m.complete([{'role':'user','content':'same'}],tools=True)
        self.assertEqual(a,b);self.assertEqual(len(SyntheticResponse.calls),1);self.assertEqual(m.spent,spent)
    def test_incomplete_stream_keeps_unknown_usage_and_cannot_auto_repeat(self):
        SyntheticResponse.incomplete=True
        with patch('arc_model.Response',SyntheticResponse):
            m=self.gateway()
            with self.assertRaisesRegex(RuntimeError,'incomplete transport|finish/usage'):m.complete([{'role':'user','content':'same'}],tools=True)
            with self.assertRaisesRegex(RuntimeError,'incomplete/unknown'):m.complete([{'role':'user','content':'same'}],tools=True)
        self.assertEqual(len(SyntheticResponse.calls),1);self.assertIsNone(m.ledger['calls'][0]['usage'])
    def test_missing_response_is_a_transport_failure_not_a_different_model(self):
        class EmptyResponse(SyntheticResponse):
            def __init__(self,request,key,out,observed,*args):
                observed.update(http_status=0,curl_exit_code=52)
            def __iter__(self):return iter(())
        with patch('arc_model.Response',EmptyResponse):
            with self.assertRaisesRegex(RuntimeError,'incomplete transport: HTTP 0, curl 52'):
                self.gateway().complete([{'role':'user','content':'test'}])

    def test_budget_stops_before_provider_request(self):
        with patch('arc_model.Response',SyntheticResponse):
            with self.assertRaises(BudgetStop):self.gateway(0.001).complete([{'role':'user','content':'x'}])
        self.assertEqual(SyntheticResponse.calls,[])
    def test_workflow_capabilities_are_exposed_as_native_tools(self):
        self.assertEqual({t['function']['name'] for t in WORKFLOW_TOOLS},{'bash','arc_build','arc_browser','arc_verify','arc_status','arc_submit'})
        response={'role':'assistant','content':'','reasoning_content':'','tool_calls':[{'id':'t1','function':{'name':'arc_verify','arguments':'{}'}},{'id':'t2','function':{'name':'arc_browser','arguments':'{"script_path":"/workspace/notes/check.js"}'}}],'extra':{'cost':0.0}}
        gateway=SimpleNamespace(complete=lambda *a,**k:response)
        actions=MiniModel(gateway).query([{'role':'user','content':'test'}])['extra']['actions']
        self.assertEqual(actions[0]['command'],'arc verify')
        self.assertEqual(actions[1]['command'],'arc browser /workspace/notes/check.js')

    def test_source_snapshot_rejects_symlinks(self):
        app=self.root/'app';app.mkdir();(app/'external').symlink_to('/tmp',target_is_directory=True)
        with self.assertRaisesRegex(ValueError,'symlinks'):copy_source(app,self.root/'copy')
    def test_empty_or_missing_goal_checks_cannot_finish(self):
        env=AppEnvironment.__new__(AppEnvironment);env.plan={'goal_count':8}
        with self.assertRaisesRegex(ValueError,'count mismatch'):env.goal({'cases':[]})
    def test_checkpoint_goal_remains_scoped(self):
        env=AppEnvironment.__new__(AppEnvironment);env.plan={'goal_count':1}
        result=env.goal({'cases':[{'name':'ORDER-GOAL example','passed':True}]})
        self.assertEqual(result['passed'],1);self.assertFalse(result['full_requirement_verification'])

if __name__=='__main__':unittest.main()
