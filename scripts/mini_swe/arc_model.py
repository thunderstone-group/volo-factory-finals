"""Organizer-gateway adapter with native tools and bounded, private call receipts."""
import hashlib
import json
import os
import shlex
from pathlib import Path
import time
from urllib.request import Request

from experiment_recovery import atomic_json
from experiment_transport import Response

BASH_TOOL = {'type':'function','function':{'name':'bash','description':'Inspect or edit application source with shell commands. Use explicit arc_* tools for managed build, browser and protected verification.','parameters':{'type':'object','properties':{'command':{'type':'string'}},'required':['command'],'additionalProperties':False}}}
def workflow_tool(name,description,properties=None,required=None):
    return {'type':'function','function':{'name':name,'description':description,'parameters':{'type':'object','properties':properties or {},'required':required or [],'additionalProperties':False}}}
WORKFLOW_TOOLS=[BASH_TOOL,
    workflow_tool('arc_build','Build and start a clean live application/browser copy. Use this after source edits.'),
    workflow_tool('arc_browser','Run a JavaScript file from the container with persistent Playwright page/browser/context/expect/log variables. Write scripts into /workspace/notes first.',{'script_path':{'type':'string'}},['script_path']),
    workflow_tool('arc_verify','Run protected shared-backend regression and scoped goal checks. Preserve successful behavior; regressions are rolled back.'),
    workflow_tool('arc_status','Read accepted goal progress and verification count.'),
    workflow_tool('arc_submit','Verify the current application and finish only when the scoped goal passes protected checks.')]
MODEL='deepseek-v4-flash'


class BudgetStop(RuntimeError):
    pass


class ArcGateway:
    def __init__(self, root, client, budget_cny=3.0, max_calls=32, transport="direct", key=None):
        self.root=Path(root);self.root.mkdir(parents=True,exist_ok=True)
        self.client=client;self.key=key if key is not None else client.access_key();self.transport=transport
        self.budget=float(budget_cny);self.max_calls=max_calls
        self.path=self.root/'ledger.json'
        self.ledger=json.loads(self.path.read_text()) if self.path.exists() else {'calls':[],'budget_cny_upper_bound':self.budget,'pricing_cny_per_million':{'input':3,'output':9}}
        if self.ledger['budget_cny_upper_bound']!=self.budget:raise ValueError('saved budget changed')

    @property
    def spent(self):
        return sum(c.get('uncached_cost_cny',c.get('reserved_cny',0)) for c in self.ledger['calls'])

    def complete(self, messages, *, tools=False):
        allowed={'role','content','reasoning_content','tool_calls','tool_call_id','name'}
        clean=[{k:v for k,v in m.items() if k in allowed and v is not None} for m in messages]
        logical={'model':MODEL,'messages':clean,'tools':WORKFLOW_TOOLS if tools else []}
        logical_sha=hashlib.sha256(json.dumps(logical,ensure_ascii=False,sort_keys=True).encode()).hexdigest()
        for record in self.ledger['calls']:
            if record['logical_sha256']==logical_sha:
                if record['status']!='completed':raise RuntimeError('same request has an incomplete/unknown attempt; inspect before continuation')
                return json.loads((self.root/record['path']/'response.json').read_text())
        if len(self.ledger['calls'])>=self.max_calls:raise BudgetStop('request cap reached')
        # Conservative token reservation: UTF-8 bytes plus framing overhead bound input
        # tokens. Budget charges ignore cache discounts; actual settled cost is separate.
        input_bound=len(json.dumps(logical,ensure_ascii=False).encode())+4096
        available=self.budget-self.spent-input_bound*3/1_000_000
        max_tokens=min(131072,int(available*1_000_000/9))
        if max_tokens<8192:raise BudgetStop('remaining token-cost allowance is insufficient')
        payload={'model':MODEL,'messages':clean,'max_tokens':max_tokens,'temperature':0.0,'stream':True,'stream_options':{'include_usage':True}}
        if tools:payload['tools']=WORKFLOW_TOOLS
        data=json.dumps(payload,ensure_ascii=False).encode()
        out=self.root/f'call-{len(self.ledger["calls"])+1:03d}';out.mkdir()
        record={'path':out.name,'logical_sha256':logical_sha,'request_sha256':hashlib.sha256(data).hexdigest(),'status':'reserved','started_at':time.time(),'reserved_cny':(input_bound*3+max_tokens*9)/1_000_000,'input_token_bound':input_bound,'max_output_tokens':max_tokens}
        self.ledger['calls'].append(record);atomic_json(self.path,self.ledger)
        os.environ.pop('ARC_EXPERIMENT_SSH_HOST',None)
        observed={'lines':0,'sse_events':0,'reasoning_chars':0,'content_chars':0,'last_lines':[],'saw_done':False,'route':'direct'}
        result={'role':'assistant','content':'','reasoning_content':''};tool_chunks={};usage={};finish=None;done=False
        req=Request(self.client.config.api_base_url.rstrip('/')+'/chat/completions',data=data,method='POST')
        try:
            response_class=Response
            if self.transport=='detached_hk':
                from remote_transport import RemoteResponse
                response_class=RemoteResponse
            with response_class(req,self.key,out,observed,'','1.1') as response:
                for line in response:
                    if not line.startswith(b'data:'):continue
                    chunk=line[5:].strip()
                    if chunk==b'[DONE]':done=True;break
                    item=json.loads(chunk)
                    if item.get('error'):raise RuntimeError('gateway error: '+str(item['error']).replace(self.key,'[REDACTED]')[:300])
                    if item.get('usage'):usage=item['usage']
                    for choice in item.get('choices',[]):
                        delta=choice.get('delta') or {}
                        result['content']+=delta.get('content') or ''
                        result['reasoning_content']+=delta.get('reasoning_content') or ''
                        for tool in delta.get('tool_calls') or []:
                            target=tool_chunks.setdefault(tool['index'],{'id':'','type':'function','function':{'name':'','arguments':''}})
                            if tool.get('id'):target['id']=tool['id']
                            f=tool.get('function') or {}
                            if f.get('name'):target['function']['name']+=f['name']
                            target['function']['arguments']+=f.get('arguments') or ''
                        if choice.get('finish_reason'):finish=choice['finish_reason']
            if not done or finish not in ('stop','length','tool_calls') or not all(k in usage for k in ('prompt_tokens','completion_tokens')):
                raise RuntimeError(f"incomplete transport: HTTP {observed.get('http_status')}, curl {observed.get('curl_exit_code')}, SSE {observed.get('sse_events')}; missing finish/usage markers")
            if observed.get('response_model')!=MODEL:raise RuntimeError('completed response returned a different or unidentified model')
            if tool_chunks:result['tool_calls']=[tool_chunks[i] for i in sorted(tool_chunks)]
            charge=(usage['prompt_tokens']*3+usage['completion_tokens']*9)/1_000_000
            result['extra']={'usage':usage,'finish_reason':finish,'cost':charge,'currency':'CNY uncached upper bound','call_path':str(out)}
            record.update(status='completed',usage=usage,uncached_cost_cny=charge,finish_reason=finish)
            atomic_json(out/'response.json',result)
            return result
        except BaseException as e:
            record.update(status='failed',error=str(e).replace(self.key,'[REDACTED]')[:1000],usage=usage or None)
            raise
        finally:
            record['finished_at']=time.time()
            atomic_json(out/'transport.json',{k:v for k,v in observed.items() if k!='last_lines'})
            atomic_json(self.path,self.ledger)
            print(json.dumps({'call':out.name,'status':record['status'],'budget_charged_cny_upper_bound':round(self.spent,6),'budget':self.budget}),flush=True)


class MiniModel:
    def __init__(self,gateway):self.gateway=gateway
    def format_message(self,**kwargs):return kwargs
    def get_template_vars(self,**kwargs):return {'model_name':MODEL,**kwargs}
    def serialize(self):return {'arc_gateway':{'model':MODEL,'ledger':str(self.gateway.path),'budget_currency':'CNY uncached upper bound'}}
    def query(self,messages,**kwargs):
        try:message=self.gateway.complete(messages,tools=True)
        except BudgetStop as e:
            from minisweagent.exceptions import LimitsExceeded
            raise LimitsExceeded({'role':'exit','content':str(e),'extra':{'exit_status':'BudgetLimit','submission':''}})
        actions=[]
        for call in message.get('tool_calls') or []:
            try:
                args=json.loads(call['function']['arguments'])
                if not isinstance(args,dict):raise ValueError('tool arguments must be an object')
                name=call['function']['name']
                if name=='bash' and isinstance(args.get('command'),str):command=args['command']
                elif name in ('arc_build','arc_verify','arc_status','arc_submit'):command=name.replace('_',' ')
                elif name=='arc_browser' and isinstance(args.get('script_path'),str):command=shlex.join(['arc','browser',args['script_path']])
                else:raise ValueError('unknown workflow tool or invalid arguments')
                actions.append({'command':command,'tool_call_id':call['id']})
            except (ValueError,KeyError,TypeError) as e:actions.append({'command':'','tool_call_id':call.get('id',''),'parse_error':str(e)})
        if not actions:
            from minisweagent.exceptions import FormatError
            raise FormatError(message,{'role':'user','content':'Use a native tool call: bash for source edits, arc_build/arc_browser for observation, or arc_verify/arc_submit for protected verification.'})
        message['extra']['actions']=actions
        return message
    def format_observation_messages(self,message,outputs,template_vars=None):
        if not outputs:return [{'role':'user','content':'Use the bash tool to inspect or edit the app. Finish with the standalone command arc submit; the protected verifier decides completion.'}]
        return [{'role':'tool','tool_call_id':a['tool_call_id'],'content':json.dumps(output,ensure_ascii=False)} for a,output in zip(message['extra']['actions'],outputs)]
