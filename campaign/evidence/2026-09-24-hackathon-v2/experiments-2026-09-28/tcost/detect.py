"""Defects a written suite can hand to repair: evaluator-failed hidden scenarios whose requirement the written suite
also fails, on the five best Sheet apps. Hidden ids come from scenario names, which in v2 differ from requirement ids.
usage: detect.py ARM [ARM...]"""
import json, os, re, sys
sys.path.insert(0, f"{os.path.dirname(os.path.abspath(__file__))}/g99/oneshot")
import scenarios
C = "/private/tmp/claude-501/-Users-e0-7-projects/2696d4ed-15e3-4314-9da8-3fc9c14aaf3a/scratchpad/cheap/calib"
T = os.path.dirname(os.path.abspath(__file__))
REQ = "~/projects/arcbench-campaign/evidence/2026-09-24-hackathon-v2/requirements/hackathon--sheet/requirements.yaml"
APPS = {"ed1e": "sheet-78-ed1e", "4c98": "sheet-79-4c98", "f49b": "sheet-80-f49b", "f686": "sheet-81", "fa94": "sheet-82-fa94"}
hidden_to_req = {}
for req in scenarios.load_requirements(open(REQ).read()):
    for s in req.get("scenarios") or []:
        m = re.match(r"(REQ-[\d-]+)", s.get("name", ""))
        if m:
            hidden_to_req.setdefault(m.group(1), set()).add(req["id"])
oracle = {}
for app, f in APPS.items():
    tests = json.load(open(f"{C}/{f}.json"))["tests"]
    reqs = set()
    for t in tests:
        if t["status"] != "pass":
            reqs |= hidden_to_req.get(t["title"].split(" ")[0], {"?" + t["title"].split(" ")[0]})
    oracle[app] = reqs
for arm in sys.argv[1:]:
    hits = total = flagged = 0; detail = []
    for app in APPS:
        f = f"{T}/{arm}/r-{app}.json"
        if not os.path.exists(f):
            detail.append(f"{app}:missing"); continue
        written = {s["id"].split("#")[0] for s in json.load(open(f))["scenarios"]
                   if s["status"] == "fail" and not s["id"].startswith("helper:")}
        h = oracle[app] & written
        hits += len(h); total += len(oracle[app]); flagged += len(written); detail.append(f"{app}:{len(h)}/{len(oracle[app])}")
    print(f"{arm}: evaluator-failed requirements caught {hits} of {total}; requirements the suite fails {flagged}; {' '.join(detail)}")
