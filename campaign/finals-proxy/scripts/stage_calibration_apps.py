"""Copy only application directories; originals and their reports remain read-only."""
import json,shutil,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from run_proxy import tree_hash

def main():
    evidence={}
    for kind in ['official','local']:
        for task,short in [('github','gh'),('sheet','sh')]:
            source=(ROOT.parent/'evidence/2026-10-06-finals/finals-r1'/short/'template' if kind=='official' else ROOT.parent/'finals-local/runs'/(task+'-real-main9293-s1')/'workspace')
            target=ROOT/'calibration/apps'/(kind+'-'+task)
            if target.exists():raise RuntimeError('Refusing to overwrite '+str(target))
            target.mkdir(parents=True)
            hashes={}
            for part in ['frontend','backend']:
                assert (source/part/'package.json').is_file()
                hashes[part]=tree_hash(source/part)
                shutil.copytree(source/part,target/part,ignore=shutil.ignore_patterns('node_modules','.git','dist','__pycache__','.arc','requirements'))
                assert tree_hash(target/part)==hashes[part]
            evidence[kind+'-'+task]={'source':str(source),'copy':str(target.relative_to(ROOT)),'app_sha256':tree_hash(target),'source_component_sha256':hashes,'copied_components':['frontend','backend'],'ignored':['.arc','requirements','node_modules','.git','dist','__pycache__']}
    (ROOT/'results/calibration-app-provenance.json').write_text(json.dumps(evidence,indent=2)+'\n')
    print(json.dumps(evidence,indent=2))

if __name__=='__main__':main()
