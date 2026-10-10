"""Versioned public-contract correction: clickable options, with original assertions unchanged."""
import collections
import concurrent.futures
import difflib
import json
import re
import shutil
import sys
from pathlib import Path

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parent/'2026-10-01-leaderboard-push/frozen-judge-harness'))
from oneshot import testgen

req=(HERE.parent/'2026-09-24-hackathon-v2/requirements/hackathon--github/requirements.yaml').read_text()
base=HERE/'click-contract-calibration'
base.mkdir(exist_ok=False)
pattern=re.compile(r"(?m)^([ \t]*)await (page\.getBy(?:Label\('test status', \{ exact: true \}\)|Role\('combobox', \{ name: 'test status', exact: true \}\)))\.selectOption\(\{ label: 'success' \}\);$")
prepared={}
for judge in ['gh99','gh8']:
    src=HERE/'judges'/('owner-repair-github-'+judge)/'suite'
    dst=base/judge
    shutil.copytree(src,dst)
    edits=[]
    for path in dst.glob('*.cjs'):
        old=path.read_text()
        new,count=pattern.subn(lambda m:m[1]+'await '+m[2]+'.click();\n'+m[1]+"await page.getByRole('option', { name: 'success', exact: true }).click();",old)
        if not count:continue
        # The only change is the action; every assertion line is retained verbatim.
        assert [s for s in old.splitlines() if 'expect(' in s]==[s for s in new.splitlines() if 'expect(' in s]
        path.write_text(new)
        edits.append({'file':path.name,'count':count,'diff':''.join(difflib.unified_diff(old.splitlines(True),new.splitlines(True)))})
    assert sum(x['count'] for x in edits)==2,(judge,edits)
    prepared[judge]=dst
    (base/(judge+'-changes.json')).write_text(json.dumps({'basis':'Public REQ-6-1 explicitly specifies a clickable option named success. No expected value, fixture, assertion or other action changed. Original judges are retained.','edits':edits},ensure_ascii=False,indent=2))

def one(name,judge):
    out=base/(name+'-'+judge)
    out.mkdir()
    shutil.copytree(prepared[judge],out/'suite')
    report=testgen.run_suite(HERE/name/'application',out/'suite',req)
    (out/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    summary={'application':name,'judge':judge,'counts':dict(collections.Counter(s['status'] for s in report['scenarios'])),'seconds':report.get('seconds')}
    (out/'summary.json').write_text(json.dumps(summary,indent=2));print(json.dumps(summary),flush=True)
    return summary

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    futures=[pool.submit(one,name,judge) for name in ['owner-repair-github','control-repair-github'] for judge in ['gh99','gh8']]
    results=[f.result() for f in futures]
(base/'results.json').write_text(json.dumps(results,indent=2))
