"""Apply the six fixed criteria to the analysed runs (read-only). Usage: judge.py RUN_ID... (in run order)."""
import json
import sys
import zipfile

SP = "/private/tmp/claude-501/-Users-e0-7-projects/a492ba62-8f9a-4850-a1ad-d5f49589dfb2/scratchpad/agent-practice"
FLOOR = {"12306": 22, "ctrip": 10}
MAX_OUT, MAX_SECONDS = 110_000, 900
BAD_REPAIR = ("browser recheck unavailable", "repair renamed quoted control")


def bundle_app(rid):
    try:
        names = zipfile.ZipFile(f"{SP}/runs/{rid}/bundle.zip").namelist()
    except (OSError, zipfile.BadZipFile):
        return None
    return {"backend/package.json": any(n.endswith("template/backend/package.json") for n in names),
            "frontend/package.json": any(n.endswith("template/frontend/package.json") for n in names),
            "files": len([n for n in names if "/requirements/" not in n])}


def main(rids):
    verdict = {i: True for i in range(1, 6)}
    for rid in rids:
        a = json.load(open(f"{SP}/runs/{rid}/analysis.json", encoding="utf-8"))
        st = a["status"]
        task = st["requirement_id"].split("--")[-1]
        total = st["passed"] + st["failed"]
        steps = {s["key"]: s["status"] for s in st.get("steps", [])}
        app = bundle_app(rid)
        c1 = (a["agent_exit"] == "0" and bool(a["wrote"]) and steps.get("run_tests") == "completed" and total > 0
              and bool(app) and app["backend/package.json"] and app["frontend/package.json"])
        c2 = st["passed"] >= FLOOR[task]
        # A transport failure (StreamError) is not a draft ending: judge the completed draft calls.
        drafts = [c for c in a["calls"] if c["phase"] == "draft" and c["status"] == "completed"]
        finishes = [c["finish_reason"] for c in drafts]
        cut = any(f == "length" for f in finishes)
        c3 = bool(drafts) and (finishes[0] == "stop" or (cut and finishes[-1] == "stop" and c1))
        failed = [(c["call"], c.get("error_type"), c.get("elapsed_seconds")) for c in a["calls"] if c["status"] != "completed"]
        outs = [c.get("output_tokens") for c in a["calls"]]
        secs = [c.get("elapsed_seconds") for c in a["calls"]]
        c4 = all(o is not None and o <= MAX_OUT for o in outs) and all(s is not None and s < MAX_SECONDS for s in secs)
        bad = [r for r in a["repairs"] if r.get("accepted") is False and any(x in (r.get("reason") or "") for x in BAD_REPAIR)]
        c5 = not bad
        for i, ok in zip(range(1, 6), (c1, c2, c3, c4, c5)):
            verdict[i] &= ok
        print(f"{rid} {task:5} {st['passed']}/{total}  C1={c1} (exit={a['agent_exit']}, run_tests={steps.get('run_tests')}, "
              f"bundle={app})  C2={c2} (floor {FLOOR[task]})  C3={c3} (completed draft finishes {finishes}; failed attempts {failed})  "
              f"C4={c4} (max out {max((o or 0) for o in outs)}, max s {max((s or 0) for s in secs)})  C5={c5} {bad}")
    print("overall:", verdict)


if __name__ == "__main__":
    main(sys.argv[1:])
