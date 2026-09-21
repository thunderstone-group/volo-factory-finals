"""Resume only confirmed relay delivery/setup failures; preserve every old receipt."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import sys
import time
from urllib.request import Request

REPO=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(REPO/'scripts'))
from experiment_recovery import atomic_json,RunLock
from remote_transport import RemoteResponse
from arc_model import MODEL


def captured_response(lines,out):
    result={'role':'assistant','content':'','reasoning_content':''};calls={};usage={};finish=None;done=False;model=None
    for line in lines:
        if not line.startswith(b'data:'):continue
        data=line[5:].strip()
        if data==b'[DONE]':done=True;break
        obj=json.loads(data);model=obj.get('model',model)
        if obj.get('error'):raise ValueError('captured provider error; not a recoverable completion')
        if obj.get('usage'):usage=obj['usage']
        for choice in obj.get('choices') or []:
            d=choice.get('delta') or {};result['content']+=d.get('content') or '';result['reasoning_content']+=d.get('reasoning_content') or ''
            for c in d.get('tool_calls') or []:
                v=calls.setdefault(c['index'],{'id':'','type':'function','function':{'name':'','arguments':''}})
                if c.get('id'):v['id']=c['id']
                f=c.get('function') or {};v['function']['name']+=f.get('name') or '';v['function']['arguments']+=f.get('arguments') or ''
            if choice.get('finish_reason'):finish=choice['finish_reason']
    if not done or finish not in ('stop','length','tool_calls') or model!=MODEL or not all(k in usage for k in ('prompt_tokens','completion_tokens')):raise ValueError('captured response is incomplete')
    if calls:result['tool_calls']=[calls[i] for i in sorted(calls)]
    cost=(usage['prompt_tokens']*3+usage['completion_tokens']*9)/1_000_000
    result['extra']={'usage':usage,'finish_reason':finish,'cost':cost,'currency':'CNY uncached upper bound','call_path':str(out)}
    return result


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--run-dir',required=True,type=Path);args=p.parse_args();root=args.run_dir.resolve()
    with RunLock(root):
        receipt=json.loads((root/'receipt.json').read_text())
        if receipt['outcome']['exit_status']!='Interrupted':raise SystemExit('only interrupted trials may be prepared for resume')
        archive=root/'recovery-v3';archive.mkdir(exist_ok=False)
        ledger_path=root/'model/ledger.json';ledger=json.loads(ledger_path.read_text());record=ledger['calls'][-1]
        if record['status']!='failed':raise SystemExit('no failed final call to recover')
        out=root/'model'/record['path'];transport=json.loads((out/'transport.json').read_text())
        if not str(transport.get('route','')).startswith('detached'):raise SystemExit('direct failures cannot be reclassified by this recovery')
        shutil.copy2(ledger_path,archive/'ledger-before.json');shutil.copy2(root/'receipt.json',archive/'receipt-before.json');shutil.copy2(out/'transport.json',archive/'transport-before.json')
        bridge=RemoteResponse.__new__(RemoteResponse);bridge.key='unused-for-read-only-recovery';bridge.host='hk-zyl';bridge.control='/tmp/arc-mini-ssh-'+hashlib.sha256(str(REPO).encode()).hexdigest()[:12]
        code='''import pathlib,json,hashlib,os
rows=[]
for p in pathlib.Path("/tmp").glob("arc-mini-transport-*"):
 if p.stat().st_uid!=os.getuid(): continue
 f=p/"request.json";d=p/"done.json"
 rows.append({"directory":str(p),"request_sha256":hashlib.sha256(f.read_bytes()).hexdigest() if f.exists() else None,"done":json.loads(d.read_text()) if d.exists() else None})
print(json.dumps(rows))'''
        inventory=json.loads(bridge.ssh(code,timeout=45));atomic_json(archive/'remote-inventory.json',{'checked_at':time.time(),'jobs':inventory})
        matching=[j for j in inventory if j['request_sha256']==record['request_sha256']]
        if matching:
            if len(matching)!=1:raise RuntimeError('ambiguous remote job')
            job=matching[0];atomic_json(out/'remote-job.json',{'directory':job['directory'],'state':'started'})
            if (out/'provider.sse').exists():shutil.copy2(out/'provider.sse',archive/'partial-provider.sse')
            observed={'lines':0,'sse_events':0,'reasoning_chars':0,'content_chars':0,'saw_done':False}
            body=(out/'request.json').read_bytes();req=Request('https://unused.invalid/existing-job',data=body,method='POST')
            with RemoteResponse(req,bridge.key,out,observed,'','1.1',record['request_sha256']) as response:
                message=captured_response(response,out)
            atomic_json(out/'response.json',message);atomic_json(out/'transport-recovered.json',observed)
            record['prior_failure']={k:record[k] for k in ('error','finished_at') if k in record}
            record.update(status='completed',usage=message['extra']['usage'],uncached_cost_cny=message['extra']['cost'],finish_reason=message['extra']['finish_reason'],recovered_without_new_inference=True,recovered_at=time.time())
            resolution='complete remote response recovered without a new model request'
        else:
            if transport.get('remote_job') or (out/'remote-job.json').exists() or transport.get('sse_events') or 'relay SSH' not in transport.get('bridge_error',''):raise RuntimeError('cannot establish a pre-launch setup failure')
            # v2 workers never remove their own directories. A missing job plus a
            # failed SSH launch and no observed response establishes no relay request.
            archived=out.with_name(out.name+'-setup-failed-v2');out.rename(archived)
            ledger['calls'].pop();ledger.setdefault('resolved_setup_failures',[]).append({**record,'path':archived.name,'request_sent':False,'resolution':'failed SSH launch; complete relay inventory has no matching job'})
            resolution='confirmed relay setup failure; no model request sent, original evidence retained'
        atomic_json(ledger_path,ledger)
        files=[*Path(REPO/'scripts/mini_swe').glob('*.py'),*Path(REPO/'scripts/mini_swe').glob('*.cjs'),*[REPO/'scripts'/n for n in ('business_model_step.py','business_replay.py','business_loop.py','experiment_transport.py','experiment_recovery.py','goal_coverage.py')],*Path(REPO/'scripts/business_experiment').glob('*')]
        hashes={str(f.relative_to(REPO)):hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted(files) if f.is_file()}
        atomic_json(root/'driver-recovery.json',{'original_plan_sha256':hashlib.sha256((root/'plan.json').read_bytes()).hexdigest(),'driver_hashes':hashes,'reason':'idempotent relay launcher, shared SSH connection, nonfatal cleanup, bounded platform reads; model/task/checks/budget unchanged','resolution':resolution,'expected_pending_request_sha256':record['request_sha256']})
        (root/'receipt.json').unlink()
        print(json.dumps({'run':root.name,'resolution':resolution,'new_inference_requests':0}))

if __name__=='__main__':main()
