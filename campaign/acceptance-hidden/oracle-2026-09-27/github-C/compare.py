"""Compare one oracle run (summarize.py JSON) with hidden per-test labels: python3 compare.py RUN.json LABELS.json"""
import json, re, sys
res = json.load(open(sys.argv[1]))['tests']
labels = {x['key']: x['hidden'] for x in json.load(open(sys.argv[2]))}
agree = mine_pass = hid_pass = 0
for t in res:
    m = re.match(r'(REQ-[\d-]+): .* - Scenario (\d+)', t['title'])
    key = '%s S%s' % (m.group(1), m.group(2))
    mine = 'pass' if t['status'] == 'pass' else 'fail'
    hid = labels.get(key, '?')
    agree += mine == hid; mine_pass += mine == 'pass'; hid_pass += hid == 'pass'
    print('%s %-14s mine=%-4s hidden=%-4s %5.2fs' % ('  ' if mine == hid else 'XX', key, mine, hid, t['seconds']))
print('agree %d/%d; mine pass %d; hidden pass %d' % (agree, len(res), mine_pass, hid_pass))
