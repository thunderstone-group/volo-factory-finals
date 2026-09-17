"""Local isolated browser observations from explicit requirement-grounded flow data.

This is a small development adapter, not an official evaluator or universal planner.
The three fixed templates take caller-reviewed labels/routes. Uncertain selection
stops repair. Original benchmark tests and their errors are never an input.
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
from oneshot import skill_repair as sr
from oneshot.business_feedback import source_id, run
from scripts.evaluate_minimal import evaluate

PROBE = Path(__file__).resolve().parents[1] / 'oneshot/business_probe.spec.cjs'
MARKER = 'VOLO_BUSINESS_OBSERVATION '


def digest(data):
    return hashlib.sha256(data).hexdigest()


def norm(text):
    return ' '.join(text.split())


def load_contract(manifest_path, requirement_path):
    raw = sr._read(Path(manifest_path), 64 * 1024)
    manifest = json.loads(raw)
    requirement = sr._text(sr._read(Path(requirement_path), 2 * 1024 * 1024))
    if not isinstance(manifest, dict) or set(manifest) != {'schema', 'login', 'flows'} or manifest['schema'] != 1:
        raise ValueError('invalid_flow_manifest')
    flows = manifest['flows']
    if not isinstance(flows, list) or not 1 <= len(flows) <= 8:
        raise ValueError('expected_1_to_8_flows')
    ids = set()
    for f in flows:
        fields={'id','kind','requirement','navigate'} | ({'enable','disable'} if f.get('kind')=='favorite' else {'open','field','save','cancel'})
        if set(f) != fields or f.get('kind') not in {'save-reopen','cancel','favorite'}:
            raise ValueError('unsupported_probe_shape')
        if not isinstance(f['id'],str) or not f['id'] or f['id'] in ids:
            raise ValueError('duplicate_probe_id')
        ids.add(f['id'])
        if not isinstance(f['requirement'],str) or len(f['requirement']) < 20 or norm(f['requirement']) not in norm(requirement):
            raise ValueError('requirement_excerpt_not_in_supplied_document')
        if not isinstance(f['navigate'],list) or not 1 <= len(f['navigate']) <= 5:
            raise ValueError('invalid_navigation')
        strings=[v for k,v in f.items() if k not in {'navigate','requirement'}]+f['navigate']
        if any(not isinstance(v,str) or not v or len(v)>256 for v in strings):
            raise ValueError('invalid_label')
    auth=manifest['login']
    if auth is not None and (not isinstance(auth,dict) or set(auth) not in ({'open','fields','submit','ready'}, {'open','fields','submit','ready','scope'})
                             or ('scope' in auth and auth['scope'] not in ('banner','navigation','header'))
                             or not isinstance(auth['fields'],dict) or not 1 <= len(auth['fields']) <= 4
                             or any(not isinstance(s,str) or not s or len(s)>256 for s in
                                    [auth['open'],auth['submit'],auth['ready'],*auth['fields'],*auth['fields'].values()])):
        raise ValueError('invalid_login_setup')
    contract_hash=digest(raw+requirement.encode()+PROBE.read_bytes())
    manifest['contract_sha256']=contract_hash
    return manifest


def parse_observations(raw, contract):
    rows=[]
    def walk(suite):
        for spec in suite.get('specs',[]):
            tests=spec.get('tests',[])
            if len(tests)!=1 or len(tests[0].get('results',[]))!=1:
                raise ValueError('missing_or_repeated_probe_execution')
            result=tests[0]['results'][0]
            if result.get('status')!='passed':
                raise ValueError('probe_program_did_not_complete')
            found=[]
            for output in result.get('stdout',[]):
                for line in output.get('text','').splitlines():
                    if line.startswith(MARKER): found.append(json.loads(line[len(MARKER):]))
            if len(found)!=1 or found[0].get('id')!=spec.get('title'):
                raise ValueError('ambiguous_probe_receipt')
            rows.extend(found)
        for child in suite.get('suites',[]): walk(child)
    for suite in raw.get('suites',[]): walk(suite)
    expected={f['id']:f for f in contract['flows']}
    if len(rows)!=len(expected) or {r.get('id') for r in rows}!=set(expected):
        raise ValueError('missing_probe_coverage')
    for row in rows:
        if row.get('contract_sha256')!=contract['contract_sha256'] or row.get('status') not in {'pass','product_fail','unknown'}:
            raise ValueError('invalid_probe_receipt')
        if not isinstance(row.get('observation'),str) or len(row['observation'])>3000:
            raise ValueError('invalid_probe_observation')
        row['requirement']=expected[row['id']]['requirement']
    return rows


class BrowserObserver:
    def __init__(self, manifest_path, requirement_path, image):
        self.contract=load_contract(manifest_path, requirement_path)
        self.image=image
        self.probe=PROBE.read_bytes()
    def __call__(self, app, output):
        output=Path(output); output.mkdir(parents=True,exist_ok=False)
        suite=output/'probe'; suite.mkdir()
        (suite/'probe.spec.cjs').write_bytes(self.probe)
        (suite/'probe-input.json').write_text(json.dumps(self.contract))
        original=source_id(app)
        raw_result=evaluate(app,suite,output/'execution',self.image,len(self.contract['flows']))
        report={'source_sha256':original,'contract_sha256':self.contract['contract_sha256'],
                'checks':[], 'official_score':False,'verified_requirements':[],
                'integrity_verified':False, 'status':'unknown'}
        try:
            if raw_result.get('status')!='scored' or not all(raw_result.get(k) for k in
                    ('cleanup_verified','original_unchanged','tests_unchanged')):
                raise ValueError('incomplete_or_environment_failure')
            if source_id(app)!=original: raise ValueError('input_changed')
            raw=json.loads((output/'execution/playwright.stdout.json').read_text())
            rows=parse_observations(raw,self.contract)
            report['checks']=rows
            report['integrity_verified']=True
            report['status']=next((s for s in ('unknown','product_fail') if any(r['status']==s for r in rows)),'pass')
        except (OSError,ValueError,KeyError) as exc:
            status='environment_error' if raw_result.get('status')=='environment_error' else 'unknown'
            report['status']=status
            report['checks']=[{'id':f['id'],'requirement':f['requirement'],'status':status,
                               'observation':'No usable business observation: '+str(exc)} for f in self.contract['flows']]
            # No repair is allowed regardless; exact source and contract still recorded.
            report['integrity_verified']=source_id(app)==original and raw_result.get('cleanup_verified') is True
            report['execution_status']=raw_result.get('status')
        (output/'observation.json').write_text(json.dumps(sr._safe(report),ensure_ascii=False,indent=2)+'\n')
        return report


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('application',type=Path);p.add_argument('--manifest',required=True,type=Path)
    p.add_argument('--requirements',required=True,type=Path);p.add_argument('--image',required=True)
    p.add_argument('--evidence',required=True,type=Path);p.add_argument('--source',action='append',required=True)
    p.add_argument('--protected',action='append',default=[]);p.add_argument('--real-repair',action='store_true')
    p.add_argument('--max-rounds',type=int,default=2);p.add_argument('--max-calls',type=int,default=6)
    args=p.parse_args()
    import os
    config={'model':os.environ.get('MODEL'),'base_url':os.environ.get('OPENAI_BASE_URL'),
            'api_key':os.environ.get('OPENAI_API_KEY')} if args.real_repair else None
    if config and not all(config.values()):p.error('MODEL, OPENAI_BASE_URL and OPENAI_API_KEY required')
    r=run(args.application,args.evidence,observer=BrowserObserver(args.manifest,args.requirements,args.image),
          paths=args.source,protected_paths=args.protected,model_config=config,
          max_rounds=args.max_rounds,max_model_calls=args.max_calls)
    print(json.dumps(r['diagnostics'], indent=2))

if __name__=='__main__': main()
