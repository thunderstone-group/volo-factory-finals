"""Incremental 300-scenario agreement and current reference/local-run evidence."""
import json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def read(path):return json.loads(path.read_text())
def key(test):
    m=re.search(r'(REQ-\d+(?:-\d+)*)-scenario-(\d+)',test['file']);assert m,test['file']
    return m.group(1)+'#'+m.group(2)
def main():
    evidence=read(ROOT/'results/official-real-frames-v3.json')
    reasons=read(ROOT/'results/calibration-v3-disagreements.json') if (ROOT/'results/calibration-v3-disagreements.json').exists() else {}
    result={'version':3,'target_agreement':290,'completed_scenarios':0,'agreement':0,'reports':{},'disagreements':[]}
    rows=[];detail=['# v3 per-scenario official/proxy agreement','','| App | Scenario | Official | Proxy | Agreement |','|---|---|---|---|---|']
    for name,official in evidence['reports'].items():
        path=ROOT/'results'/f'v3-{name}-proxy.json';proxy=read(path) if path.exists() else None
        actual={key(test):test for test in proxy['tests']} if proxy else {};cases=[]
        for case in official['cases']:
            test=actual.get(case['key']);agree=test['status']==case['status'] if test else None
            item={'key':case['key'],'official':case['status'],'proxy':test['status'] if test else 'pending','agree':agree,'official_frames':case['frames'],'proxy_error':test.get('error') if test else None}
            cases.append(item)
            detail.append(f"| {name} | {case['key']} | {case['status']} | {item['proxy']} | {'yes' if agree else 'NO' if agree is False else 'pending'} |")
            if agree is False:
                entry={'app':name,**item,'explanation':reasons.get(name+'/'+case['key'],'Investigation pending')};result['disagreements'].append(entry)
        matched=sum(case['agree'] is True for case in cases)
        if proxy:
            assert proxy['total']==30 and not proxy.get('infrastructure_error'),name
            result['completed_scenarios']+=30;result['agreement']+=matched
        result['reports'][name]={'official_passed':official['passed'],'proxy_passed':proxy['passed'] if proxy else None,'agreement':matched if proxy else None,'report':str(path.relative_to(ROOT)) if proxy else None,'app_sha256':proxy['app_sha256'] if proxy else None,'cases':cases}
        proxy_cell=f"[{proxy['passed']} / 30]({path.relative_to(ROOT)})" if proxy else 'pending'
        rows.append(f"| {name} | {official['passed']} / 30 | {proxy_cell} | {str(matched)+' / 30' if proxy else 'pending'} | {str(proxy['wall_seconds'])+' s' if proxy else '—'} |")
    body=f"""### v3 calibration results

Completed agreement: **{result['agreement']} / {result['completed_scenarios']}**; acceptance target is at least 290 / 300.
All runs use the same frozen task suites. [All 300 scenario rows](results/calibration-v3-per-test.md)
and [machine-readable comparisons](results/official-calibration-v3.json) are retained.

| Official output | Official pass / total | Proxy pass / total | Agreement | Wall time |
|---|---:|---:|---:|---:|
"""+'\n'.join(rows)+'\n'
    body+='\n#### Explained disagreements\n\n'
    if result['disagreements']:
        for item in result['disagreements']:body+=f"- **{item['app']} / {item['key']}** (official {item['official']}, proxy {item['proxy']}): {item['explanation']}\n"
    else:body+='No disagreements in completed replays.\n'
    body+='\n#### v3 reference and local-agent runs\n\n| Application | Proxy pass / total | Wall time |\n|---|---:|---:|\n'
    provenance=read(ROOT/'results/calibration-app-provenance-v3.json') if (ROOT/'results/calibration-app-provenance-v3.json').exists() else {}
    paths=[ROOT/'results'/f'reference-{task}-real-v3-proxy-{i}.json' for task in ['github','sheet'] for i in [1,2]]
    paths += [ROOT/'results'/f'v3-{name}-proxy.json' for name,app in provenance.items() if app['cohort']=='local']
    for path in paths:
        if path.exists():
            report=read(path);body+=f"| {path.stem} | [{report['passed']} / {report['total']}]({path.relative_to(ROOT)}) | {report['wall_seconds']} s |\n"
        else:body+=f'| {path.stem} | pending | — |\n'
    body+='\n#### v3 reference regressions\n\n| Task / suite | Baseline pass / fail / error | Current pass / fail / error | Time |\n|---|---|---|---:|\n'
    for task in ['github','sheet']:
        baseline=read(ROOT/'results'/f'base-{task}-regression.json');path=ROOT/'results'/f'reference-{task}-real-v3-regression.json';completed={}
        if path.exists():completed=read(path)['summaries']
        elif path.with_suffix('.log').exists():
            for line in path.with_suffix('.log').read_text().splitlines():
                if line.startswith(('v6-fixed-independent ','g99 ','cov99n-arm ')):
                    suite,summary=line.split(' ',1);completed[suite]=json.loads(summary)
        counts=lambda value:' / '.join(str(value.get(k,0)) for k in ['pass','fail','error'])
        for suite,base in baseline['summaries'].items():
            now=completed.get(suite)
            body+=f"| {task} / {suite} | {counts(base['counts'])} | {counts(now['counts']) if now else 'pending'} | {str(now['seconds'])+' s' if now else '—'} |\n"
    path=ROOT/'README.md';text=path.read_text();a=text.index('<!-- v3-results:start -->')+len('<!-- v3-results:start -->');b=text.index('<!-- v3-results:end -->',a)
    path.write_text(text[:a]+'\n'+body+text[b:])
    (ROOT/'results/calibration-v3-per-test.md').write_text('\n'.join(detail)+'\n')
    (ROOT/'results/official-calibration-v3.json').write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')
    print(f"v3 agreement {result['agreement']}/{result['completed_scenarios']}; {len(result['disagreements'])} disagreements")

if __name__=='__main__':main()
