"""Audit calibrated tests, exact official-output agreement, and all four app copies."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from run_proxy import tree_hash
from scripts.freeze import verify
from scripts.extract_official_real_frames import LINE,ANSI

def read(path):return json.loads(path.read_text())
def date(value):return datetime.datetime.fromisoformat(value.replace('Z','+00:00'))
def strings(value):
    if isinstance(value,str):yield value
    elif isinstance(value,dict):
        for item in value.values():yield from strings(item)
    elif isinstance(value,list):
        for item in value:yield from strings(item)

def main():
    subprocess.run([sys.executable,str(ROOT/'scripts/audit_real_tasks.py')],check=True,stdout=subprocess.DEVNULL)
    subprocess.run([sys.executable,str(ROOT/'scripts/report_real_calibration.py')],check=True,stdout=subprocess.DEVNULL)
    comparison=read(ROOT/'results/official-calibration-v2.json')
    frames=read(ROOT/'results/official-real-frames.json')
    provenance=read(ROOT/'results/calibration-app-provenance.json')
    result={'version':2,'official_agreement':{},'local_agent_results':{},'source_apps_unchanged':{},'reference_runs':{},'current_reference_audit':'results/real-final-audit-v2.json'}
    for name,app in provenance.items():
        source=Path(app['source']);copy=ROOT/app['copy']
        assert tree_hash(copy)==app['app_sha256'],name
        for component,expected in app['source_component_sha256'].items():assert tree_hash(source/component)==expected,(name,component)
        assert sorted(p.name for p in copy.iterdir())==['backend','frontend']
        result['source_apps_unchanged'][name]=app['app_sha256']
    for task in ['github','sheet']:
        name=task+'-real';manifest=verify(name);assert read(ROOT/name/'FROZEN.json')['version']==2
        official=frames[name]
        assert hashlib.sha256(Path(official['report']).read_bytes()).hexdigest()==official['report_sha256']
        raw_official=read(Path(official['report']))
        frame_count=sum(any(LINE.match(line) for line in ANSI.sub('',value).splitlines()) for value in strings(raw_official))
        assert frame_count==len(official['frame_occurrences'])
        replay=read(ROOT/'results'/f'calibration-official-{task}-v2.json')
        assert not replay.get('infrastructure_error') and replay['subset'] is None and replay['total']==30
        assert replay['frozen_manifest_sha256']==manifest
        assert replay['app_sha256']==provenance['official-'+task]['app_sha256']
        match=comparison['tasks'][task];assert match['agreement']==match['total']==30
        result['official_agreement'][task]={'official_passed':match['official_passed'],'proxy_passed':match['proxy_passed'],'agreement':30,'total':30,'all_visible_frame_occurrences_extracted':frame_count}
        local=read(ROOT/'results'/f'calibration-local-{task}-v2.json')
        assert local['total']==30 and local['subset'] is None and not local.get('infrastructure_error')
        assert local['frozen_manifest_sha256']==manifest and local['app_sha256']==provenance['local-'+task]['app_sha256']
        result['local_agent_results'][task]={'passed':local['passed'],'total':30,'wall_seconds':local['wall_seconds'],'app_sha256':local['app_sha256']}
        times=[]
        for i in [1,2]:
            raw=read(ROOT/'results'/f'reference-{task}-real-v2-proxy-{i}.playwright.json')
            times.append((date(raw['stats']['startTime']),raw['stats']['duration']))
        assert times[1][0] >= times[0][0]+datetime.timedelta(milliseconds=times[0][1]),'Reference runs must be separate consecutive executions'
        result['reference_runs'][task]=[{'started_at':time.isoformat(),'duration_ms':duration} for time,duration in times]
    (ROOT/'results/real-calibration-final-audit-v2.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result,indent=2))

if __name__=='__main__':main()
