import collections,json,os,sys,tempfile
from pathlib import Path
work=Path(sys.argv[1]);tempfile.tempdir=str(work)
sys.path.insert(0,'/factory')
from oneshot import testgen
result={'reports':{},'summaries':{}}
for name in json.loads((work/'suites.json').read_text()):
    report=testgen.run_suite(work/'application',work/name,(work/'original-requirements.yaml').read_text())
    result['reports'][name]=report
    result['summaries'][name]={'counts':dict(collections.Counter(s['status'] for s in report.get('scenarios',[]))),'seconds':report.get('seconds'),'unavailable':report.get('unavailable')}
    print(name,json.dumps(result['summaries'][name]),flush=True)
    if report.get('unavailable'):raise RuntimeError(report['unavailable'])
(work/'result.json').write_text(json.dumps(result,indent=2)+'\n')
