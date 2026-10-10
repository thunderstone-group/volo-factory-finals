import json, sys
labels_pass = set("""REQ-3-2-1 S4|REQ-3-2-2 S1|REQ-3-2-2 S2|REQ-3-2-2 S3|REQ-3-2-2 S5|REQ-3-2-2 S7|REQ-4-1-1 S1|REQ-4-1-1 S3|REQ-4-1-1 S4|REQ-4-1-1 S5|REQ-4-1-2 S2|REQ-4-2-1 S1|REQ-4-2-1 S3|REQ-4-2-2 S2|REQ-4-2-2 S3|REQ-4-2-2 S4|REQ-4-2-2 S5""".split('|'))
d = json.load(open(sys.argv[1]))
agree = 0
for t in d['tests']:
    key = t['title'].split(':')[0]
    hid = 'pass' if key in labels_pass else 'fail'
    mine = 'pass' if t['status'] == 'pass' else 'fail'
    agree += hid == mine
    if hid != mine: print('!! hidden', hid, 'mine', mine, t['title'])
print('agree', agree, 'of', len(d['tests']), '| mine pass', sum(t['status']=='pass' for t in d['tests']), '| hidden pass', len(labels_pass))
