import json, sys, re
res = json.load(open(sys.argv[1]))['tests']
labels = {x['key']: x['hidden'] for x in json.load(open(sys.argv[2]))}
agree = 0; rows = []
for t in res:
    m = re.match(r'(REQ-[\d-]+): .* - Scenario (\d+)', t['title'])
    key = f"{m.group(1)} S{m.group(2)}"
    mine = 'pass' if t['status'] == 'pass' else 'fail'
    hid = labels.get(key, '?')
    ok = mine == hid
    agree += ok
    err = t['error'].split('\n')
    err = ' | '.join(e.strip() for e in err if e.strip())[:260]
    rows.append(f"{'  ' if ok else 'XX'} {key:14s} mine={mine:4s} hidden={hid:4s} {t['seconds']:5.2f}s  {'' if mine=='pass' else err}")
print('\n'.join(rows))
print(f"agree {agree}/{len(res)}; mine pass {sum(1 for t in res if t['status']=='pass')}")
