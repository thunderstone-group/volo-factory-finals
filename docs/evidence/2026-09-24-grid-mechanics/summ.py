import json,sys,re
def load(p):
    d=json.load(open(p)); out={}
    def walk(s):
        for sp in s.get('specs',[]):
            for t in sp.get('tests',[]):
                r=t['results'][-1] if t.get('results') else {}
                out[sp['title']]=(r.get('status'), re.sub(r'\x1b\[[0-9;]*m','',(r.get('error') or {}).get('message',''))[:160].replace('\n',' '))
        for c in s.get('suites',[]): walk(c)
    for s in d['suites']: walk(s)
    return out
a=load(sys.argv[1]); b=load(sys.argv[2]) if len(sys.argv)>2 else None
print('A pass', sum(1 for v in a.values() if v[0]=='passed'), '/', len(a))
if b:
    print('B pass', sum(1 for v in b.values() if v[0]=='passed'), '/', len(b))
    for k in sorted(set(a)|set(b)):
        if (a.get(k,('?',))[0]=='passed') != (b.get(k,('?',))[0]=='passed'):
            print('  CHANGED', k, '|', a.get(k,('?',''))[0], '->', b.get(k,('?',''))[0], '|', b.get(k,('',''))[1][:120])
