"""Preserve the fresh application's completed UI phase before source review; never changes the running agent."""
import concurrent.futures
import hashlib
import json
import shutil
import tempfile
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
SKIP = ('node_modules','dist','__pycache__')

def one(task):
    run = HERE / ('generate-contracts-v2-' + task)
    location = run / 'suite-location.json'
    suite = None
    while True:
        progress_files = list(run.glob('.oneshot-*/progress.json'))
        if progress_files:
            progress = json.loads(progress_files[0].read_text())
            if suite is None and progress.get('phase') == 'waiting_for_tests':
                at = progress['updated_at']
                candidates = [(abs(getattr(p.stat(),'st_birthtime',p.stat().st_ctime)-at),p)
                              for p in Path(tempfile.gettempdir()).glob('oneshot-tests-*')]
                candidates.sort()
                if candidates and candidates[0][0] < 3:
                    if len(candidates)>1 and candidates[1][0] < 3:
                        raise RuntimeError('Ambiguous suite creation time for '+task)
                    suite = candidates[0][1]
                    location.write_text(json.dumps({'suite':str(suite),'created_distance_seconds':candidates[0][0]},indent=2))
                    print(task+' suite '+str(suite),flush=True)
            events = []
            for line in (run/'stderr.log').read_text().splitlines():
                if line.startswith('[oneshot] repair end '):
                    events.append(json.loads(line[len('[oneshot] repair end '):]))
            if events:
                if suite is None:
                    raise RuntimeError('Missed unambiguous suite discovery for '+task)
                stage = progress_files[0].parent/'app'
                def hashes():
                    return {p.relative_to(stage).as_posix():hashlib.sha256(p.read_bytes()).hexdigest()
                            for p in stage.rglob('*') if p.is_file() and not any(x in SKIP for x in p.parts)}
                before = hashes()
                target = HERE / ('ui-checkpoint-v2-'+task)
                target.mkdir(exist_ok=False)
                shutil.copytree(stage,target/'application',ignore=shutil.ignore_patterns(*SKIP))
                shutil.copytree(suite,target/'suite')
                if before != hashes():
                    raise RuntimeError('Application changed during checkpoint copy: '+task)
                if (target/'suite/source-contracts.json').exists():
                    raise RuntimeError('Source review already completed before checkpoint: '+task)
                (target/'checkpoint.json').write_text(json.dumps({'task':task,'ui_repair_end':events[0],
                    'source_stage':str(stage),'suite':str(suite),'source_hashes':before},ensure_ascii=False,indent=2))
                print(task+' checkpoint complete',flush=True)
                return
        if (run/'finished.json').exists():
            raise RuntimeError('Generation ended before checkpoint capture: '+task)
        time.sleep(5)

with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    for result in pool.map(one,['github','sheet']):
        pass
