#!/usr/bin/env python3
"""Run unchanged independent original-requirement suites via testgen.run_suite."""
import argparse,collections,hashlib,json,os,shutil,subprocess,sys,tempfile,time,zipfile
from pathlib import Path
from run_proxy import tree_hash
ROOT=Path(__file__).resolve().parent
EVIDENCE=Path('~/projects/arcbench-campaign/evidence/2026-10-02-s70')
FACTORY=Path('~/projects/volo-factory')
def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('app_dir',type=Path);p.add_argument('task',choices=['github','sheet']);p.add_argument('--out',type=Path);p.add_argument('--suite',choices=['all','g99','cov99n-arm'],default='all');a=p.parse_args()
    out=(a.out or ROOT/'results'/f'{a.task}-regression-latest.json').resolve()
    if not out.is_relative_to(ROOT):p.error('Output must stay within finals-proxy')
    out.parent.mkdir(parents=True,exist_ok=True)
    (ROOT/'.work').mkdir(parents=True,exist_ok=True)
    work=Path(tempfile.mkdtemp(prefix='regression-',dir=ROOT/'.work'))
    container_name='finals-'+work.name.replace('_','-')
    try:
        suites={}
        if a.task=='github':suites['v6-fixed-independent']=EVIDENCE/'v7-official-github-79/v6-fixed-independent/suite'
        else:
            for name in ['g99','cov99n-arm']:
                if a.suite in ['all',name]:suites[name]=EVIDENCE/f'v7-official-sheet-87/{name}-check/suite'
        for name,source in suites.items():shutil.copytree(source,work/name)
        # Run inside the immutable official image, mounting the existing Python
        # harness read-only. No edits to volo-factory; caches stay in this workspace.
        cmd=['docker','run','--rm','--name',container_name,'--platform','linux/amd64','--shm-size=1g','--mount',f'type=bind,source={ROOT},target=/proxy','--mount',f'type=bind,source={FACTORY},target=/factory,readonly','--env','PYTHONDONTWRITEBYTECODE=1','--env','NODE_PATH=/opt/arcbench/node_modules','--env',f'TMPDIR=/proxy/{work.relative_to(ROOT)}','--env',f'PWTEST_CACHE_DIR=/proxy/{work.relative_to(ROOT)}/pw-cache','--entrypoint','python3','gyataro/arcbench-runner:local-base','/proxy/scripts/container_regression.py','/proxy/'+str(work.relative_to(ROOT))]
        shutil.copytree(a.app_dir.resolve(),work/'application',ignore=shutil.ignore_patterns('node_modules','.git','dist','__pycache__'))
        if a.task=='github':text=zipfile.ZipFile(EVIDENCE/'v7-github-79-delivery.zip').read('template/requirements/requirements.yaml').decode()
        else:text=(EVIDENCE/'v7-official-sheet-input.yaml').read_text()
        (work/'original-requirements.yaml').write_text(text)
        (work/'suites.json').write_text(json.dumps(list(suites)))
        metadata={'app_sha256':tree_hash(work/'application'),'original_requirements_sha256':hashlib.sha256(text.encode()).hexdigest(),'suite_sha256':{name:tree_hash(work/name) for name in suites},'image_id':subprocess.check_output(['docker','image','inspect','gyataro/arcbench-runner:local-base','--format','{{.Id}}'],text=True).strip()}
        started=time.monotonic()
        with out.with_suffix('.log').open('w') as log:done=subprocess.run(cmd,stdout=log,stderr=subprocess.STDOUT,timeout=2100)
        if done.returncode:raise RuntimeError(out.with_suffix('.log').read_text()[-5000:])
        report=json.loads((work/'result.json').read_text());report.update(task=a.task,app_dir=str(a.app_dir.resolve()),wall_seconds=round(time.monotonic()-started,3),**metadata)
        out.write_text(json.dumps(report,indent=2)+'\n')
        print(json.dumps({k:v for k,v in report.items() if k!='reports'}))
        return 0
    finally:
        subprocess.run(['docker','rm','-f',container_name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,check=False)
        shutil.rmtree(work)
if __name__=='__main__':raise SystemExit(main())
