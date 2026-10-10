"""Read-only acceptance audit; emits evidence inside this workspace only."""
import hashlib,json,re,sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from scripts.freeze import verify
from run_proxy import tree_hash

ORIGINAL_MANIFESTS={
    'github':'569f6719e9eed44a28365ef64c036c75d0405df2010cdb1e34f8f0093a92e83b',
    'sheet':'1278fbd112df8a197a60558401b9c1ad70cd1d7fe04c0722ad2e6cf538541d99',
    'github-prose':'1db2869b83ce7a28c6ad0edbd427ce142211dfed9ce31352ad3c209d9d083e79',
    'sheet-prose':'f0f56de4e8e0dc3a6c4d82c1fcaa7ea8463c6986218e58466d4033060678a5f9'}
def read(path): return json.loads(path.read_text())
def hashfiles(path):return {str(p.relative_to(path)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(path.rglob('*')) if p.is_file()}

def main():
    result={'old_frozen_manifests_unchanged':{},'old_reference_apps_unchanged':{},'tasks':{}}
    versions=set()
    for task,expected in ORIGINAL_MANIFESTS.items():
        actual=verify(task);assert actual==expected,task
        result['old_frozen_manifests_unchanged'][task]=actual
    for task in ['github','sheet']:
        previous_reference=read(ROOT/'results'/f'reference-{task}-proxy-2.json')
        old_reference_hash=tree_hash(ROOT/'reference'/f'{task}-app')
        assert old_reference_hash==previous_reference['app_sha256']
        result['old_reference_apps_unchanged'][task]=old_reference_hash
        name=task+'-real';d=ROOT/name
        version=read(d/'FROZEN.json')['version'];versions.add(version)
        report_prefix=f'reference-{task}-real'+(f'-v{version}' if version>1 else '')
        source=ROOT.parent/'evidence/2026-10-06-finals/finals-open/req'/('hackathon-evolution--'+task)
        assert hashfiles(d/'requirements')==hashfiles(source)
        official=ROOT.parent/'evidence/2026-10-06-finals/packs/arc-bench-evolution--keep/helpers.ts'
        assert (d/'tests/helpers.ts').read_bytes()==official.read_bytes()
        reqs=read(ROOT/'scripts'/f'{task}_real_requirements.json')
        scenarios=[s for r in reqs for s in r['scenarios']]
        specs=sorted((d/'tests').glob('*.spec.ts'));assert len(specs)==len(scenarios)==30
        for spec,scenario in zip(specs,scenarios):
            code=spec.read_text();assert len(re.findall(r'^test\(',code,re.M))==1
            assert 'test('+json.dumps(scenario['name'],ensure_ascii=False)+',' in code
            for step in scenario['steps']:assert '// '+step['keyword']+': '+step['content'].replace('\n',' ') in code
            assert 'test.use({ storageState: { cookies: [], origins: [] } });' in code
        manifest=verify(name)
        baseline=read(ROOT/'results'/f'base-{task}-real-proxy.json')
        oldbase=read(ROOT/'results'/f'base-{task}-proxy.json')
        assert baseline['app_sha256']==oldbase['app_sha256']
        assert baseline['total']==30 and not baseline.get('infrastructure_error')
        current_hash=tree_hash(ROOT/'reference'/f'{task}-real-app')
        ref=[]
        for i in [1,2]:
            report=read(ROOT/'results'/f'{report_prefix}-proxy-{i}.json')
            assert report['app_sha256']==current_hash
            assert report['frozen_manifest_sha256']==manifest
            assert report['passed']==report['total']==30 and report['failed']==0
            assert report['subset'] is None and not report.get('infrastructure_error')
            assert report['image_id']==baseline['image_id']
            assert [r['name'] for r in report['tests']]==[s['name'] for s in scenarios]
            ref.append({'passed':report['passed'],'total':report['total'],'wall_seconds':report['wall_seconds']})
        regression=read(ROOT/'results'/f'{report_prefix}-regression.json')
        assert regression['app_sha256']==current_hash
        oldreg=read(ROOT/'results'/f'base-{task}-regression.json')
        reg={}
        for suite,base in oldreg['summaries'].items():
            now=regression['summaries'][suite]
            assert not now.get('unavailable')
            assert now['counts'].get('pass',0)>=base['counts'].get('pass',0)-1,(task,suite,now)
            old_cases={r['id']:r for r in oldreg['reports'][suite]['scenarios']}
            new_cases={r['id']:r for r in regression['reports'][suite]['scenarios']}
            losses=[key for key,r in old_cases.items() if r['status']=='pass' and new_cases.get(key,{}).get('status')!='pass']
            gains=[key for key,r in new_cases.items() if r['status']=='pass' and old_cases.get(key,{}).get('status')!='pass']
            reg[suite]={'baseline':base['counts'],'reference':now['counts'],'seconds':now['seconds'],'previously_passing_cases_lost':losses,'newly_passing_cases':gains}
        result['tasks'][name]={'requirements_sha256':hashlib.sha256((d/'requirements/requirements.yaml').read_bytes()).hexdigest(),'helper_sha256':hashlib.sha256(official.read_bytes()).hexdigest(),'scenario_count':30,'freeze_sha256':manifest,'baseline_application_unchanged':True,'baseline_passed':baseline['passed'],'reference_application_sha256':current_hash,'proxy_runs':ref,'regression':reg}
    suffix='' if versions=={1} else '-v'+('-'.join(str(v) for v in sorted(versions)))
    (ROOT/'results'/f'real-final-audit{suffix}.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result,indent=2))

if __name__=='__main__':main()
