"""Stage immutable, clean snapshots of the ten official and five local outputs."""
import json,shutil,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from run_proxy import tree_hash

LOCALS=['github-real-c340ea0e8e-s1','github-real-c452126573-s1','github-real-place3c0294d9-s2','sheet-real-c340ea0e8e-s1','sheet-real-c452126573-s1']
def main():
    jobs=[]
    for run in range(1,6):
        for task,short in [('github','gh'),('sheet','sh')]:
            jobs.append((f'r{run}-{task}',task,'official',ROOT.parent/f'evidence/2026-10-06-finals/finals-r{run}'/short/'template'))
    for name in LOCALS:jobs.append(('local-'+name,name.split('-')[0],'local',ROOT.parent/'finals-local/runs'/name/'workspace'))
    result={}
    for name,task,cohort,source in jobs:
        target=ROOT/'calibration/apps/v3'/name
        if target.exists():raise RuntimeError('Refusing to overwrite '+str(target))
        target.mkdir(parents=True);components={}
        for component in ['frontend','backend']:
            assert (source/component/'package.json').is_file(),source
            components[component]=tree_hash(source/component)
            shutil.copytree(source/component,target/component,ignore=shutil.ignore_patterns('node_modules','dist','.git','__pycache__','.arc','requirements'))
            assert tree_hash(target/component)==components[component]
        result[name]={'task':task+'-real','cohort':cohort,'source':str(source),'copy':str(target.relative_to(ROOT)),'app_sha256':tree_hash(target),'source_component_sha256':components}
    (ROOT/'results/calibration-app-provenance-v3.json').write_text(json.dumps(result,indent=2)+'\n')
    for name,app in result.items():print(name,app['app_sha256'])

if __name__=='__main__':main()
