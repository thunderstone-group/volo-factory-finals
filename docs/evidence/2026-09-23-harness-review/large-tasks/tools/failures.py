"""Parse failed tests + first error line per failure from saved platform logs; group by requirement family."""
import json, re, os, sys, collections
SP = "/private/tmp/claude-501/-Users-e0-7-projects/a492ba62-8f9a-4850-a1ad-d5f49589dfb2/scratchpad/agent-large"
B = "~/projects/arcbench-campaign/upstream/arc-bench/arc-bench/webapp"

def folder_names(task):
    names = {}
    cur = None
    for line in open(f"{B}/{task}/requirements/requirements.yaml", encoding="utf-8"):
        m = re.match(r"^\s*-?\s*id:\s*['\"]?(REQ-[\d.]+)", line)
        if m:
            cur = m.group(1); continue
        n = re.match(r"^\s*name:\s*['\"]?(.*?)['\"]?\s*$", line)
        if n and cur and cur not in names:
            names[cur] = n.group(1)
    return names

def parse(path):
    s = json.load(open(path))["stdout"]
    ansi = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")
    lines = [ansi.sub("", re.sub(r"^\[[^\]]*\] \[runner\] playwright-test\.stdout \| ", "", l)) for l in s.split("\n") if "playwright-test.stdout" in l]
    failed, errors = [], {}
    # numbered failure blocks: "  1) REQ-1.2.spec.ts:7:1 › REQ-1.2: title ─────"
    cur = None
    for l in lines:
        m = re.match(r"^\s+\d+\) (REQ-[\d.]+)\.spec\.ts:(\d+):\d+ › (.*?)\s*─*$", l)
        if m:
            cur = (m.group(1), m.group(2)); errors.setdefault(cur, None); continue
        if cur and errors.get(cur) is None:
            w = re.search(r"waiting for (.*)$", l) or re.search(r"^\s*Locator: (.*)$", l)
            e = re.search(r"^\s*(Error: .*|TimeoutError: .*|Test timeout of .*)$", l)
            if w:
                errors[cur] = "waiting for " + w.group(1)[:160]
            elif e and "Error: expect" not in l and "Error: locator" not in l:
                errors[cur] = errors.get(cur) or None
                errors[(cur[0], cur[1], "e")] = e.group(1)[:160]
    # summary block
    summ = False
    for l in lines:
        if re.match(r"^\s+\d+ failed", l):
            summ = True; continue
        if summ:
            m = re.match(r"^\s+(REQ-[\d.]+)\.spec\.ts:(\d+):\d+ › (.*?)\s*─*$", l)
            if m:
                failed.append((m.group(1), m.group(2), m.group(3)))
            elif re.match(r"^\s+\d+ (passed|flaky|skipped|did not run)", l):
                summ = False
    out = []
    for req, ln, title in failed:
        err = errors.get((req, ln)) or errors.get((req, ln, "e"))
        out.append({"req": req, "line": ln, "title": title[:100], "error": err})
    return out

if __name__ == "__main__":
    meta = {}
    for f in ("fetch-list.txt",):
        for line in open(f"{SP}/{f}"):
            tag, rid, task, passed, dur = line.split()
            meta[rid] = (tag, task, int(passed))
    per_task = collections.defaultdict(list)
    for rid, (tag, task, passed) in meta.items():
        p = f"{SP}/logs/{rid}/{rid}-logs.json"
        if not os.path.exists(p): continue
        fails = parse(p)
        per_task[task].append((tag, rid, passed, fails))
    json.dump({t: [(a, b, c, d) for a, b, c, d in v] for t, v in per_task.items()}, open(f"{SP}/failures.json", "w"), ensure_ascii=False, indent=1)
    for task, runs in per_task.items():
        names = folder_names(task)
        fam = collections.Counter(); total = 0
        errs = collections.Counter()
        for tag, rid, passed, fails in runs:
            for f in fails:
                top = ".".join(f["req"].split(".")[:1]) if f["req"].count(".") == 0 else f["req"].split(".")[0]
                grp = f["req"].split(".")[0] + ("." + f["req"].split(".")[1] if f["req"].count(".") >= 1 else "")
                fam[grp] += 1; total += 1
                if f["error"]:
                    errs[re.sub(r"\d+", "#", f["error"])[:120]] += 1
        print(f"=== {task}: {len(runs)} runs, {total} failures, mean failures/run {total/max(1,len(runs)):.1f}")
        for grp, n in fam.most_common(14):
            top = grp.split(".")[0]
            print(f"   {grp:10} {n:4} {100*n/total:5.1f}%  {names.get(grp, '')[:50]} / {names.get(top,'')[:30]}")
        print("   top error lines:")
        for e, n in errs.most_common(12):
            print(f"     {n:4}  {e}")
