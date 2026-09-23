"""Top failing requirement ids per task from saved `arcbench status --json` files (read-only).
Leaf test names are `REQ-a.b.c: title`; each leaf fails at most once per run, so the ranking is by the
leaf's parent requirement (the FOLDER one level up), summed over the runs, with leaves failing in every run listed."""
import collections
import json
import re
import sys

UPSTREAM = "~/projects/arcbench-campaign/upstream/arc-bench/arc-bench/webapp"


def names(task):
    out, cur = {}, None
    try:
        lines = open(f"{UPSTREAM}/{task}/requirements/requirements.yaml", encoding="utf-8")
    except OSError:
        return out
    for line in lines:
        m = re.match(r"^\s*-?\s*id:\s*['\"]?(REQ-[\d.]+)", line)
        if m:
            cur = m.group(1)
            continue
        n = re.match(r"^\s*name:\s*['\"]?(.*?)['\"]?\s*$", line)
        if n and cur and cur not in out:
            out[cur] = n.group(1)
    return out


def parent(req):
    parts = req.split(".")
    return ".".join(parts[:-1]) if len(parts) > 1 else req


def main(paths):
    per_task = collections.defaultdict(list)
    for p in paths:
        d = json.load(open(p, encoding="utf-8"))
        r = d[0] if isinstance(d, list) else d
        task = r["requirement_id"].split("--")[-1]
        leaves = [re.match(r"(REQ-[\d.]+)", t["name"]).group(1) for t in r.get("failed_tests") or []
                  if re.match(r"(REQ-[\d.]+)", t.get("name", ""))]
        per_task[task].append((r["run_id"], leaves))
    for task, runs in per_task.items():
        nm = names(task)
        by_parent = collections.Counter()
        by_leaf = collections.Counter()
        for _, leaves in runs:
            for leaf in leaves:
                by_parent[parent(leaf)] += 1
                by_leaf[leaf] += 1
        print(f"=== {task}: runs {[rid for rid, _ in runs]}, failures {[len(l) for _, l in runs]}")
        per_run = [collections.Counter(l) for _, l in runs]
        print("  top 5 requirement ids from test names (failures summed over runs; per run):")
        for req, n in sorted(by_leaf.items(), key=lambda kv: (-kv[1], kv[0]))[:8]:
            print(f"    {req:12} {n:3}  per-run {[c[req] for c in per_run]}  {nm.get(req, '')[:50]}")
        print("  top 5 parent requirement ids (failures summed over runs):")
        for req, n in by_parent.most_common(5):
            leaves = sorted({l for _, ls in runs for l in ls if parent(l) == req})
            print(f"    {req:10} {n:3}  {nm.get(req, '')[:40]:40}  leaves={len(leaves)}")
        both = sorted((l for l in by_leaf if all(c[l] for c in [collections.Counter(ls) for _, ls in runs])),
                      key=lambda x: [int(t) for t in x[4:].split('.')])
        print(f"  leaves failing in all {len(runs)} runs: {len(both)}")
        print("   ", " ".join(both))


if __name__ == "__main__":
    main(sys.argv[1:])
