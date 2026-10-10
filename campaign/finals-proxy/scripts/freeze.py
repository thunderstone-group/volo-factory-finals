"""Versioned, explicit manifest creation; verification never rewrites manifests."""
import argparse, datetime, hashlib, json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
TEST_TASKS={'github':'github','sheet':'sheet','github-prose':'github','sheet-prose':'sheet','github-real':'github-real','sheet-real':'sheet-real'}
def test_task(task):
    if task not in TEST_TASKS:raise ValueError(f'Unknown task: {task}')
    return TEST_TASKS[task]
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def files(task):return {str(p.relative_to(ROOT/task)):digest(p) for folder in ['requirements','tests'] for p in sorted((ROOT/task/folder).rglob('*')) if p.is_file()}
def shared_source(task):
    source=test_task(task)
    if source==task:return None
    alias=ROOT/task/'tests'
    if not alias.is_symlink() or alias.resolve()!=(ROOT/source/'tests').resolve():
        raise RuntimeError(f'{task}: tests must be a symlink to the canonical {source}/tests directory')
    return {'task':source,'directory':f'../{source}/tests','frozen_manifest_sha256':verify(source),'requirements_sha256':digest(ROOT/source/'requirements/requirements.yaml')}
def verify(task):
    test_task(task)
    path=ROOT/task/'FROZEN.json'
    manifest=json.loads(path.read_text())
    actual=files(task)
    if manifest['files']!=actual:raise RuntimeError(f'{task}: frozen files changed; record a reason and create a new version')
    source=shared_source(task)
    if source is not None and manifest.get('test_source')!=source:
        raise RuntimeError(f'{task}: canonical source manifest changed; review and freeze a new version')
    return digest(path)
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--verify',action='store_true');p.add_argument('--reason');p.add_argument('--task',choices=list(TEST_TASKS));a=p.parse_args()
    tasks=[a.task] if a.task else [task for task in TEST_TASKS if (ROOT/task/'requirements/requirements.yaml').exists()]
    for task in tasks:
        path=ROOT/task/'FROZEN.json'
        if a.verify:print(task,verify(task));continue
        if path.exists():
            if not a.reason:raise SystemExit('--reason required for a post-freeze revision')
            old=json.loads(path.read_text());history=old.get('history',[])+[{k:v for k,v in old.items() if k!='history'}];version=old['version']+1
        else:history=[];version=1
        manifest={'version':version,'frozen_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'reason':a.reason or 'Initial independent freeze before reading either application source','files':files(task),'history':history}
        source=shared_source(task)
        if source is not None:
            manifest['test_source']=source
            if not a.reason:manifest['reason']='Initial prose-style freeze before any prose-variant validation run; canonical tests and application sources unchanged'
        path.write_text(json.dumps(manifest,indent=2)+'\n');print(task,'version',version,len(manifest['files']),'files')
