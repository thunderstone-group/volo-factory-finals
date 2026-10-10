"""Collect completed local runs and start immutable independent judges; never submits automatically."""
import concurrent.futures
import json
import subprocess
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
PYTHON = '~/projects/volo-factory/.venv/bin/python'

def one(task):
    name = 'generate-controls-v3-' + task
    root = HERE / name
    while not (root / 'finished.json').exists():
        time.sleep(20)
    completed = json.loads((root / 'finished.json').read_text())
    summaries = {}
    with (root / 'stderr.log').open() as stream:
        for line in stream:
            for kind in ['usage','smoke']:
                prefix = '[oneshot] ' + kind + ' '
                if line.startswith(prefix):
                    summaries[kind] = json.loads(line[len(prefix):])
    (root / 'run-summary.json').write_text(json.dumps(summaries, ensure_ascii=False, indent=2))
    print(json.dumps({'task':task, 'completed':completed, 'usage':summaries.get('usage'),
                      'source_review':summaries.get('smoke',{}).get('source_review')},ensure_ascii=False),flush=True)
    if completed['exit']:
        return {'task':task,'error':'generation failed','completed':completed}
    with (root/'judge.log').open('w') as out:
        result = subprocess.run([PYTHON,str(HERE/'judge_contract_repair.py'),'--task',task,'--name',name],
                                cwd=HERE,stdout=out,stderr=subprocess.STDOUT)
    judges = ['gh99','gh8'] if task=='github' else ['g99','cov99n-arm']
    scores = []
    for judge in judges:
        path = HERE/'judges'/(name+'-'+judge)/'summary.json'
        scores.append(json.loads(path.read_text()) if path.exists() else {'judge':judge,'error':'no result'})
    record = {'task':task,'judge_exit':result.returncode,'scores':scores}
    (root/'independent-validation.json').write_text(json.dumps(record,ensure_ascii=False,indent=2))
    print(json.dumps(record,ensure_ascii=False),flush=True)
    return record

with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    results = list(pool.map(one,['github','sheet']))
(HERE/'fresh-controls-v3-validation.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
