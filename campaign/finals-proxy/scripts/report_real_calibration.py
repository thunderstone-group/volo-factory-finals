"""Per-scenario comparison, keyed by requirement and published scenario number."""
import argparse,json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
START='<!-- calibration-results:start -->'
END='<!-- calibration-results:end -->'

def key(test):
    match=re.search(r'(REQ-\d+(?:-\d+)*)-scenario-(\d+)',test['file'])
    if not match:raise ValueError(test['file'])
    return match.group(1)+'#'+match.group(2)

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--version',type=int,default=2);args=parser.parse_args();v=args.version
    official=json.loads((ROOT/'results/official-real-frames.json').read_text())
    result={'version':v,'tasks':{}};summaries=[];tables=[]
    for task in ['github','sheet']:
        source=official[task+'-real'];path=ROOT/'results'/f'calibration-official-{task}-v{v}.json'
        if not path.exists():continue
        proxy=json.loads(path.read_text());tests={key(test):test for test in proxy['tests']};rows=[]
        for case in source['cases']:
            actual=tests.get(case['key']);status=actual['status'] if actual else 'not run'
            rows.append({'key':case['key'],'official_name':case['name'],'proxy_name':actual['name'] if actual else None,'official':case['status'],'proxy':status,'agree':status==case['status'],'proxy_error':actual.get('error') if actual else None,'official_frames':case['frames']})
        agreement=sum(row['agree'] for row in rows)
        result['tasks'][task]={'official_report_sha256':source['report_sha256'],'proxy_report':str(path.relative_to(ROOT)),'proxy_manifest_sha256':proxy['frozen_manifest_sha256'],'app_sha256':proxy['app_sha256'],'official_passed':source['official_passed'],'proxy_passed':proxy['passed'],'agreement':agreement,'total':len(rows),'wall_seconds':proxy['wall_seconds'],'rows':rows}
        summaries.append(f"| {task}-real official output | {source['official_passed']} / 30 | [{proxy['passed']} / {proxy['total']}]({path.relative_to(ROOT)}) | {agreement} / 30 | {proxy['wall_seconds']} s |")
        tables+=['',f'#### {task}-real per-scenario agreement','', '| Scenario | Official | Proxy | Agreement |','|---|---|---|---|']
        tables += [f"| {row['key']} | {row['official']} | {row['proxy']} | {'yes' if row['agree'] else '**NO**'} |" for row in rows]
        for row in rows:
            if not row['agree']:
                tables+=['',f"Disagreement {task}/{row['key']}: investigation pending. Proxy first error:",'','```text',(row['proxy_error'] or 'No error recorded')[:1200],'```']
    body='''### Calibration results

Agreement compares each official output app with its own organizer report, using
requirement ID + scenario number (the published Sheet proxy titles are retained).
The local agent apps have different frontend source hashes and are reported separately.

| Application | Official pass / total | Proxy pass / total | Per-test agreement | Proxy wall time |
|---|---:|---:|---:|---:|
'''+ '\n'.join(summaries)+'\n'
    body+='\n#### Reference and local-agent runs\n\n| Application | Proxy pass / total | Wall time |\n|---|---:|---:|\n'
    for kind in ['reference','local']:
        for task in ['github','sheet']:
            names=[f'reference-{task}-real-v{v}-proxy-{i}.json' for i in [1,2]] if kind=='reference' else [f'calibration-local-{task}-v{v}.json']
            for name in names:
                path=ROOT/'results'/name
                if path.exists():
                    report=json.loads(path.read_text());body+=f"| {name.removesuffix('.json')} | [{report['passed']} / {report['total']}]({path.relative_to(ROOT)}) | {report['wall_seconds']} s |\n"
    body+='\n#### Reference regressions\n\n| Task / suite | Baseline pass / fail / error | v2 pass / fail / error | Time |\n|---|---|---|---:|\n'
    for task in ['github','sheet']:
        baseline=json.loads((ROOT/'results'/f'base-{task}-regression.json').read_text())
        path=ROOT/'results'/f'reference-{task}-real-v{v}-regression.json'
        completed={}
        if path.exists():completed=json.loads(path.read_text())['summaries']
        elif path.with_suffix('.log').exists():
            for line in path.with_suffix('.log').read_text().splitlines():
                if line.startswith(('v6-fixed-independent ','g99 ','cov99n-arm ')):
                    suite,summary=line.split(' ',1);completed[suite]=json.loads(summary)
        for suite,base in baseline['summaries'].items():
            counts=lambda data:' / '.join(str(data.get(key,0)) for key in ['pass','fail','error'])
            current=completed.get(suite)
            body+=f"| {task} / {suite} | {counts(base['counts'])} | {counts(current['counts']) if current else 'running'} | {str(current['seconds'])+' s' if current else '—'} |\n"
    body+='\n'+ '\n'.join(tables)+'\n'
    if result['tasks'] and all(task['agreement']==task['total']==30 for task in result['tasks'].values()) and len(result['tasks'])==2:
        body+='\nBoth official-output replays agree on all 60 pass/fail outcomes. There are no disagreements in this calibration pair. This does not establish equivalence to unseen organizer assertions.\n'
    readme=ROOT/'README.md';text=readme.read_text()
    if START not in text:
        old='### Calibration results\n\nPending new frozen tests and official-output replay.'
        assert old in text
        text=text.replace(old,START+'\n'+body+END,1)
    else:
        a=text.index(START)+len(START);b=text.index(END,a);text=text[:a]+'\n'+body+text[b:]
    readme.write_text(text)
    (ROOT/'results'/f'official-calibration-v{v}.json').write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')
    print('\n'.join(summaries) or 'No completed official-output replays yet.')

if __name__=='__main__':main()
