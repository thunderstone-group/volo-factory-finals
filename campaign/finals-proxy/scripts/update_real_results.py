"""Refresh the real-task README table from completed, retained runner reports."""
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

def regression(path):
    if not path.exists():
        path=path.with_name(path.stem+'-progress.json')
        if not path.exists():return '—','—'
    report=json.loads(path.read_text());counts=[];times=[]
    for name,summary in report['summaries'].items():
        c=summary['counts']
        counts.append(f"{name}: {c.get('pass',0)} / {c.get('fail',0)} / {c.get('error',0)}")
        times.append(f"{name}: {summary['seconds']} s")
    for name in report.get('pending',[]):counts.append(f'{name}: running')
    return '<br>'.join(counts),'<br>'.join(times)

def main():
    rows=[]
    for task in ['github','sheet']:
        for prefix,label in [('base',f'Base {task}-real'),('reference',f'Reference {task}-real')]:
            pattern=f'{prefix}-{task}-real-proxy*.json'
            reports=[p for p in sorted((ROOT/'results').glob(pattern)) if not p.name.endswith('.playwright.json')]
            for path in reports:
                report=json.loads(path.read_text())
                if report.get('subset'): continue
                suffix=path.stem.split('-proxy',1)[1]
                app_label=label+(f', run {suffix[1:]}' if suffix else '')
                regpath=ROOT/'results'/f'{prefix}-{task}-real-regression.json'
                if prefix=='base':regpath=ROOT/'results'/f'base-{task}-regression.json'
                counts,times=regression(regpath)
                if suffix and suffix!='-1':counts=times='—'
                if report.get('infrastructure_error'):app_label+=' (infrastructure error)'
                rows.append(f"| {app_label} | [{report.get('passed',0)} / {report.get('total',0)}]({path.relative_to(ROOT)}) | {report['wall_seconds']} s | {counts} | {times} |")
    path=ROOT/'README.md';text=path.read_text()
    start=text.index('### Real-task results (filled as runs finish)')
    end=text.index('### Real-task post-freeze changes',start)
    acceptance=text.find('### Real-task final acceptance',start,end)
    if acceptance>=0:end=acceptance
    table='''### Real-task results (filled as runs finish)

| App | Proxy pass / total | Wall time | Regression pass / fail / error | Regression time |
|---|---:|---:|---|---:|
'''+ '\n'.join(rows)+'''

Proxy report links retain every scenario's result, duration, first error, application
hash, image ID, and freeze hash; adjacent `.playwright.json` files retain full raw
Playwright output. Regression baselines reuse the completed original baseline runs
(GitHub 107, Sheet g99 66 / cov99n-arm 96 passing), supplied and verified before this
task. The source paths are identical; the fresh real-proxy baseline hashes are compared
with the earlier baseline proxy hashes in the real-task audit. All reference regression
figures are new executions of the unchanged regression wrapper.

'''
    path.write_text(text[:start]+table+text[end:])
    print('\n'.join(rows) or 'No completed real proxy reports yet.')

if __name__=='__main__':main()
