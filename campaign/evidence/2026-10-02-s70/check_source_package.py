"""Execute captured real proposals with one exact unpacked agent; no model calls or app edits."""
import argparse
import json
import sys
from pathlib import Path

parser=argparse.ArgumentParser()
parser.add_argument('--agent',type=Path,required=True)
parser.add_argument('--app',type=Path,required=True)
parser.add_argument('--manifest',type=Path,required=True)
parser.add_argument('--requirements',type=Path,required=True)
parser.add_argument('--out',type=Path,required=True)
args=parser.parse_args()
sys.path.insert(0,str(args.agent.resolve()))
import source_contracts
manifest=json.loads(args.manifest.read_text())
results={}
for label in ['proposed','probes']:
    try:
        results[label]=source_contracts.execute(args.app,manifest.get(label,[]),args.requirements.read_text())
    except Exception as exc:
        results[label]={'error':type(exc).__name__+': '+str(exc)}
args.out.write_text(json.dumps(results,ensure_ascii=False,indent=2))
print(json.dumps({k:([{'id':r['id'],'status':r['status'],'message':r.get('message','')[:150]}
                     for r in v['results']] if 'results' in v else v) for k,v in results.items()},ensure_ascii=False))
