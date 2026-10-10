"""Final proof of the five-report calibration, reference controls, and local rejudgements."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from run_proxy import tree_hash
from scripts.freeze import verify
from scripts.extract_official_real_frames import ANSI,LINE
from scripts.extract_official_real_frames_v3 import strings
def read(path):return json.loads(path.read_text())
def date(value):return datetime.datetime.fromisoformat(value.replace('Z','+00:00'))
def main():
    subprocess.run([sys.executable,str(ROOT/'scripts/audit_real_tasks.py')],check=True,stdout=subprocess.DEVNULL)
    subprocess.run([sys.executable,str(ROOT/'scripts/report_real_calibration_v3.py')],check=True,stdout=subprocess.DEVNULL)
    evidence=read(ROOT/'results/official-real-frames-v3.json');apps=read(ROOT/'results/calibration-app-provenance-v3.json');comparison=read(ROOT/'results/official-calibration-v3.json')
    assert comparison['completed_scenarios']==300 and comparison['agreement']>=290
    assert all(row['explanation'] and 'pending' not in row['explanation'].lower() for row in comparison['disagreements'])
    output={'version':3,'agreement':comparison['agreement'],'total':300,'target':290,'disagreement_count':len(comparison['disagreements']),'all_disagreements_explained':True,'official_apps':{},'local_apps':{},'source_and_snapshot_hashes':{},'reference_runs':{}}
    for task in ['github','sheet']:
        manifest=read(ROOT/(task+'-real')/'FROZEN.json');assert manifest['version']==3
        assert [m['version'] for m in manifest['history']]==[1,2]
        times=[]
        for i in [1,2]:
            raw=read(ROOT/'results'/f'reference-{task}-real-v3-proxy-{i}.playwright.json');times.append((date(raw['stats']['startTime']),raw['stats']['duration']))
        assert times[1][0]>=times[0][0]+datetime.timedelta(milliseconds=times[0][1])
        output['reference_runs'][task]=[{'start':start.isoformat(),'duration_ms':duration} for start,duration in times]
    for name,app in apps.items():
        source=Path(app['source']);copy=ROOT/app['copy'];assert tree_hash(copy)==app['app_sha256']
        assert sorted(p.name for p in copy.iterdir())==['backend','frontend']
        for component,sha in app['source_component_sha256'].items():assert tree_hash(source/component)==sha,(name,component)
        output['source_and_snapshot_hashes'][name]=app['app_sha256']
        report=read(ROOT/'results'/f'v3-{name}-proxy.json');assert report['total']==30 and report['subset'] is None and not report.get('infrastructure_error')
        assert report['app_sha256']==app['app_sha256'] and report['frozen_manifest_sha256']==verify(app['task'])
        assert report['settings']['workers']==1 and report['settings']['timeout_ms']==10000 and report['settings']['retries']==0
        if app['cohort']=='official':
            official=evidence['reports'][name];raw=read(Path(official['source']))
            assert hashlib.sha256(Path(official['source']).read_bytes()).hexdigest()==official['sha256']
            count=sum(any(LINE.match(line) for line in ANSI.sub('',value).splitlines()) for value in strings(raw))
            assert count==official['visible_frame_occurrences']
            output['official_apps'][name]={'official_passed':official['passed'],'proxy_passed':report['passed'],'agreement':comparison['reports'][name]['agreement'],'wall_seconds':report['wall_seconds'],'all_frame_occurrences_extracted':count}
        else:output['local_apps'][name]={'passed':report['passed'],'total':30,'wall_seconds':report['wall_seconds']}
    assert len(output['official_apps'])==10 and len(output['local_apps'])==5
    output['reference_regression_audit']='results/real-final-audit-v3.json'
    (ROOT/'results/real-calibration-final-audit-v3.json').write_text(json.dumps(output,indent=2)+'\n')
    print(json.dumps(output,indent=2))

if __name__=='__main__':main()
