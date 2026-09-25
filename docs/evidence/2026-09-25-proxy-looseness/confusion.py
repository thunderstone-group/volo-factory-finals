import json,re,sys
def key(name):
    m=re.match(r'\s*(REQ[-\d]+).*Scenario (\d+)',name); return f"{m.group(1)} S{m.group(2)}"
def hidden(path):
    d=json.load(open(path)); d=d[0] if isinstance(d,list) else d
    return {key(t['name']) for t in d['failed_tests']}, d['passed']
def proxy(path):
    d=json.load(open(path)); out={}
    for e in d['scenarios']:
        if e['id'].startswith('helper:'): continue
        i,_,n=e['id'].partition('#'); out[f"{i} S{n or 1}"]=e['status']
    return out
hf,hp=hidden(sys.argv[1]); px=proxy(sys.argv[2])
allk=set(px)|hf
hpass={k for k in px if k not in hf}
print('hidden passed',hp,'derived',len(hpass))
from collections import Counter
c=Counter()
for k in sorted(px):
    h='pass' if k not in hf else 'fail'
    c[(h,px[k])]+=1
print(c)
print('proxy-only pass:',sorted(k for k in px if px[k]=='pass' and k in hf))
print('hidden-only pass:',sorted(k for k in px if px[k]!='pass' and k not in hf))
