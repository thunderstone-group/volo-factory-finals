"""Fixed public-requirement judges, excluded from prompts and repair feedback."""
import argparse
import collections
import concurrent.futures
import json
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / '2026-10-01-leaderboard-push/frozen-judge-harness'))
from oneshot import testgen

parser = argparse.ArgumentParser()
parser.add_argument('--task', choices=['github','sheet'], required=True)
parser.add_argument('--name')
args = parser.parse_args()
name = args.name or ('contract-repair-'+args.task)
app = HERE / name / 'application'
root = HERE.parent / '2026-09-24-hackathon-v2'
requirements = (root / ('requirements/hackathon--'+args.task) / 'requirements.yaml').read_text()
judges = ['gh99','gh8'] if args.task == 'github' else ['g99','cov99n-arm']

def one(judge):
    out = HERE / 'judges' / (name+'-'+judge)
    out.mkdir(parents=True, exist_ok=False)
    suite = out/'suite'
    shutil.copytree(root/'experiments-2026-09-28/tcost'/judge/'suite', suite)
    report = testgen.run_suite(app, suite, requirements)
    (out/'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    summary = {'app':name,'judge':judge,'counts':dict(collections.Counter(x['status'] for x in report.get('scenarios',[]))),
               'seconds':report.get('seconds'),'coverage':report.get('coverage')}
    (out/'summary.json').write_text(json.dumps(summary, indent=2))
    print(json.dumps(summary),flush=True)

with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    for future in [pool.submit(one,j) for j in judges]:
        future.result()
