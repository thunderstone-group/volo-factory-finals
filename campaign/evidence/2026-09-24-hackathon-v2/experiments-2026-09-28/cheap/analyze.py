"""Draft-only runs: evaluator score, cost, and the S of every Sheet x GitHub pair under the pre-registered mappings."""
import itertools
import json
import re
import sys
from pathlib import Path

RUNS = Path(__file__).parent / "runs"
MAPS = {"median": {"sheet": 12, "github": 13}, "pessimistic": {"sheet": 17, "github": 15},
        "sensitivity": {"sheet": 17, "github": 18}}


def run_info(d):
    info = {"name": d.name, "task": d.name.split("-")[0]}
    log = (d / "log.txt").read_text(errors="replace") if (d / "log.txt").exists() else ""
    m = re.search(r"\[oneshot\] usage (\{.*\})", log)
    if m:
        u = json.loads(m.group(1))
        info["cost"] = u.get("estimated_cost_cny")
        info["calls"] = u.get("calls")
    info["exit"] = (d / "done.txt").read_text().split()[0] if (d / "done.txt").exists() else "running"
    for key, name in (("oracle", "oracle.json"), ("clean", "oracle-clean.json")):
        f = d / name
        if f.exists():
            tests = json.loads(f.read_text())["tests"]
            info[key] = sum(t["status"] == "pass" for t in tests)
    return info


def score(g, s, b):
    p = (g + s) / 2
    if p <= 0:
        return 0.0
    ratio = max(b / (0.8 * p), 0.01)
    return p / ratio ** (0.1 if ratio <= 1 else 0.2)


def main():
    infos = [run_info(d) for d in sorted(RUNS.iterdir()) if d.is_dir()]
    for i in infos:
        print(i)
    sheets = [i for i in infos if i["task"] == "sheet" and "oracle" in i and i.get("cost") is not None]
    gits = [i for i in infos if i["task"] == "github" and "oracle" in i and i.get("cost") is not None]
    for label, m in MAPS.items():
        pairs = []
        for s, g in itertools.product(sheets, gits):
            hs, hg = max(s["oracle"] - m["sheet"], 0), max(g["oracle"] - m["github"], 0)
            pairs.append(score(hg, hs, s["cost"] + g["cost"]))
        if not pairs:
            continue
        pairs.sort()
        n = len(pairs)
        ge60 = sum(x >= 60 for x in pairs) / n
        ge574 = sum(x >= 57.4 for x in pairs) / n
        mean_cost = sum(s["cost"] for s in sheets) / len(sheets) + sum(g["cost"] for g in gits) / len(gits)
        per100 = 100 / mean_cost * ge60
        print(f"{label}: pairs {n}, S median {pairs[n // 2]:.1f}, max {pairs[-1]:.1f}, P(S>=57.4) {ge574:.2f}, "
              f"P(S>=60) {ge60:.2f}, mean cost {mean_cost:.2f}, expected S>=60 draws per CNY 100 {per100:.2f} "
              f"(full pipeline 0.36)")


if __name__ == "__main__":
    main()
