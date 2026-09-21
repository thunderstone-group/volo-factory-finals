"""Paired Flash experiment: current fixed-feedback policy versus mini-SWE-agent."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time

REPO=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(REPO/'scripts'))
from business_model_step import SYSTEM as REPAIR_SYSTEM,feedback
from business_replay import fingerprint
from experiment_recovery import RunLock,atomic_json
from arc_model import ArcGateway,MiniModel,BudgetStop
from environment import AppEnvironment,copy_source

COMMON='''Implement the supplied booking-to-payment requirements in this existing application.
Preserve every previously passing fixed regression check, required labels, seeded data, and build/start contracts.
Keep account business data separate from browser authentication/session state and transient view/form state.
Do not modify verification tools, requirements, fixed tests, metering, or detect a test environment.
Only frontend/ and backend/ source changes are application deliverables. Diagnostic scripts belong in /workspace/notes.
Model-authored checks are exploratory observations; only the protected verifier accepts a checkpoint.
The scope is booking passenger/contact validation, service fees, pending payment and simulated payment success.
Passing this scoped goal does not mean the entire application is verified.'''
TOOLS='''You have explicit native tools. Use bash for source inspection/edits in the isolated Linux container.
Working directory: /workspace/application (editable source). Requirements: /workspace/requirements.yaml (read-only).
Available native tools:
  arc_build: build a disposable live copy and restart its backend/browser.
  arc_browser(script_path): run an async Playwright JavaScript file written in /workspace/notes.
      The script has page, browser, context, expect and log variables; page state persists between calls.
      Example script: await page.goto('/'); log.push(await page.locator('body').innerText());
  arc_verify: run protected fixed checks with a shared backend and rollback regressions.
  arc_status: show accepted scoped progress.
  arc_submit: verify and finish when the scoped goal is complete.
These are native API tools, not executable programs. Do not search for arc binaries or invoke them through bash.
The container has Node 20.19.3, Python 3 and Playwright 1.57.0. No network or model credentials are mounted.
A fresh browser must not inherit another session's signed-in user.
Inspect relevant source, make focused edits, observe actual behavior and verify coherent changes.
Do not start your own server or install dependencies; use arc_build and the bundled runtime.
'''


def load_agent_module(path):
    spec=importlib.util.spec_from_file_location('frozen_oneshot',path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m


def diagnostics(report):
    scope=[c for c in report['cases'] if c['name'].startswith('ORDER-GOAL ')]
    return {'goal':feedback({**report,'cases':scope}),'protected_successes':[c['name'] for c in report['cases'] if c['passed']]}


def run_classic(env,gateway,plan):
    adapter=load_agent_module(plan['adapter']);stalled=0;rounds=[]
    for i in range(1,plan['max_model_calls']+1):
        accepted=json.loads(Path(env.state['accepted_probe']).read_text())
        goal=env.goal(accepted)
        if goal['passed']==goal['total']:return {'exit_status':'ScopedGoalPassed','rounds':rounds}
        source=Path(env.state['accepted_application']);snapshot=adapter.read_template(source)
        blocks='\n'.join('=== FILE: '+name+' ===\n'+data.decode()+'\n=== END ===' for name,data in sorted(snapshot.items()))
        note=diagnostics(accepted)
        if rounds and not rounds[-1]['accepted']:note['previous_proposal']=rounds[-1]
        messages=[{'role':'system','content':COMMON+'\n'+REPAIR_SYSTEM},{'role':'user','content':'APPLICATION REQUIREMENTS\n'+Path(plan['requirements']).read_text()+'\nCURRENT ACCEPTED APPLICATION\n'+blocks+'\nBUSINESS DIAGNOSTICS\n'+json.dumps(note,ensure_ascii=False,indent=2)}]
        try:response=gateway.complete(messages)
        except BudgetStop as e:return {'exit_status':'BudgetLimit','reason':str(e),'rounds':rounds}
        valid=False;error=None
        try:
            patches,missing=adapter.parse_blocks(response['content'])
            if missing or response['extra']['finish_reason']!='stop' or not patches:raise ValueError('incomplete file patch')
            for patch in patches:
                path=adapter.resolve_path(env.app,patch['path']);relative=path.relative_to(env.app.resolve())
                if relative.parts[0] not in ('frontend','backend'):raise ValueError('non-application path')
                adapter.write_one(env.app,patch)
            problems=adapter.missing_required(env.app)
            if problems:raise ValueError('; '.join(problems))
            valid=True
        except ValueError as e:error=str(e)
        if valid:
            result=env.verify();outcome=result.get('outcome',result);row={'round':i,**outcome}
        else:row={'round':i,'accepted':False,'patch_error':error}
        rounds.append(row);atomic_json(env.root/'classic-rounds.json',rounds)
        if row['accepted']:stalled=0
        else:
            stalled+=1;shutil.rmtree(env.app);copy_source(env.state['accepted_application'],env.app)
        print(json.dumps({'mode':'classic',**row},ensure_ascii=False),flush=True)
        if stalled>=2:return {'exit_status':'Stalled','rounds':rounds}
        if len(env.state['checks'])>=plan['max_verifications']:return {'exit_status':'VerificationLimit','rounds':rounds}
    return {'exit_status':'StepLimit','rounds':rounds}


def read_api(function,label,root):
    from arcbench_cli.client import ApiError
    rows=[]
    for attempt in range(1,4):
        try:
            result=function();rows.append({'attempt':attempt,'status':'ok'})
            atomic_json(root/('platform-read-'+label+'.json'),rows)
            return result
        except ApiError as error:
            rows.append({'attempt':attempt,'status':'failed','error':str(error)})
            atomic_json(root/('platform-read-'+label+'.json'),rows)
            if not any(word in str(error) for word in ('IncompleteRead','URLError','Timeout','Internal Server Error','500','502','503','504')) or attempt==3:raise
            time.sleep(2)


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--run-dir',required=True,type=Path);args=p.parse_args()
    root=args.run_dir.resolve();plan=json.loads((root/'plan.json').read_text())
    manifest=root/'driver-recovery.json'
    hashes=plan['driver_hashes']
    if manifest.exists():
        recovery=json.loads(manifest.read_text())
        if recovery['original_plan_sha256']!=hashlib.sha256((root/'plan.json').read_bytes()).hexdigest():raise SystemExit('recovery plan binding changed')
        hashes=recovery['driver_hashes']
    for name,sha in hashes.items():
        if hashlib.sha256((REPO/name).read_bytes()).hexdigest()!=sha:raise SystemExit('frozen driver changed: '+name)
    if fingerprint(Path(plan['baseline_application']))!=plan['baseline_source_sha256']:raise SystemExit('baseline changed')
    for key in ('requirements','probe_file'):
        if hashlib.sha256(Path(plan[key]).read_bytes()).hexdigest()!=plan[key+'_sha256']:raise SystemExit(key+' changed')
    receipt=root/'receipt.json'
    if receipt.exists():print(json.dumps({'terminal_resume':True,'new_model_calls':0,'receipt':str(receipt)}));return
    sys.path.insert(0,str(Path.home()/'projects/arcbench-cli/src'))
    from arcbench_cli.client import OfficialClient,SubmitConfig,load_env,TERMINAL_STATES
    client=OfficialClient(SubmitConfig.from_env(load_env(Path.home()/'.config/arcbench/volo.env')))
    active=[r for r in read_api(lambda:client.list_runs(limit=10000),'runs',root) if str(r.get('status','')).upper() not in TERMINAL_STATES|{'PENDING'}]
    if active:raise SystemExit('official run active; no model call')
    atomic_json(root/'preflight.json',{'active_official_runs':0,'checked_at':time.time()})
    started=time.time()
    with RunLock(root) as lock:
        key=read_api(client.access_key,'access-key',root)
        if not key:raise RuntimeError('platform returned no access key')
        env=AppEnvironment(root,plan,lock);gateway=ArcGateway(root/'model',client,plan['budget_cny_upper_bound'],plan['max_model_calls'],plan.get('model_transport','direct'),key=key)
        outcome={}
        try:
            if plan['mode']=='classic':outcome=run_classic(env,gateway,plan)
            else:
                upstream=Path(plan['mini_upstream'])
                sha=subprocess.run(['git','-C',str(upstream),'rev-parse','HEAD'],capture_output=True,text=True,check=True).stdout.strip()
                if sha!=plan['mini_commit']:raise ValueError('mini-SWE-agent revision changed')
                os.environ['MSWEA_GLOBAL_CONFIG_DIR']=str(root/'mini-config');os.environ['MSWEA_SILENT_STARTUP']='1'
                sys.path.insert(0,str(upstream/'src'))
                from minisweagent.agents.default import DefaultAgent
                class CheckpointAgent(DefaultAgent):
                    def save(self,path,*extra_dicts):
                        data=self.serialize(*extra_dicts)
                        if path:atomic_json(path,data)
                        return data
                env.start()
                baseline=json.loads(Path(plan['baseline_probe']).read_text())
                task=COMMON+'\n'+TOOLS+'\nINITIAL FIXED OBSERVATIONS\n'+json.dumps(diagnostics(baseline),ensure_ascii=False)
                agent=CheckpointAgent(MiniModel(gateway),env,system_template='You are a software engineering agent. Use native tools to inspect, edit and verify the application. '+COMMON,instance_template='{{ task }}',step_limit=plan['max_model_calls'],cost_limit=plan['budget_cny_upper_bound'],max_consecutive_format_errors=3,output_path=root/'trajectory.json')
                outcome=agent.run(task)
                # A stopped agent may have an unverified working edit. Evaluate once
                # if the predeclared verification budget remains; select only safe gains.
                if len(env.state['checks'])<plan['max_verifications'] and fingerprint(env.app)!=fingerprint(Path(env.state['accepted_application'])):
                    env.verify()
        except BaseException as e:
            outcome={'exit_status':'Interrupted','error_type':type(e).__name__,'error':str(e)}
            raise
        finally:
            env.close()
            atomic_json(receipt,{'outcome':outcome,'mode':plan['mode'],'selected_application':env.state['accepted_application'],'selected_probe':env.state['accepted_probe'],'model_requests':len(gateway.ledger['calls']),'budget_charged_cny_upper_bound':gateway.spent,'seconds':round(time.time()-started,3),'full_requirement_verification':False})
            print(json.dumps({'mode':plan['mode'],'outcome':outcome,'selected_application':env.state['accepted_application']},ensure_ascii=False),flush=True)


if __name__=='__main__':main()
