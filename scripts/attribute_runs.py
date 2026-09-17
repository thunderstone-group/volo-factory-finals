#!/usr/bin/env python3
"""Group failed official tests by evaluator failure family.

usage: attribute_runs.py RUN_ID[:label] ... [--json OUT]
Reads `arcbench status RUN --json` (needs ARCBENCH_ENV_FILE), never the network otherwise.
"""
import argparse, collections, json, re, subprocess, sys

ANSI = re.compile(r"\x1b\[[0-9;]*m")
SOUGHT = re.compile(r"(getBy(?:Label|Role|Text|Placeholder)\([^)]*\))")
RESOLVED = re.compile(r"locator resolved to <([a-zA-Z0-9]+)([^>]*)>")

def family(err):
    e = ANSI.sub("", err or "")
    if "locator resolved to" in e and ("not an <input>" in e or "Node is not an" in e):
        return "fill-hit-non-input"
    if "locator resolved to" in e and "waiting for element to be visible" in e:
        return "resolved-but-hidden-or-disabled"
    if "strict mode violation" in e:
        return "strict-ambiguity"
    if "Expected value to match" in e or "toHaveValue" in e:
        return "value-mismatch"
    if "toBeVisible" in e or "toHaveText" in e or "toContainText" in e or "toHaveCount" in e:
        return "assertion-missing-text-or-control"
    if "Test timeout" in e and "waiting for" in e:
        return "timeout-waiting-for-locator"
    if "Test timeout" in e:
        return "timeout-no-detail"
    if "net::ERR" in e or "ECONNREFUSED" in e or "page.goto" in e:
        return "delivery-or-navigation"
    return "other"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("runs", nargs="+")
    ap.add_argument("--json")
    ap.add_argument("--samples", type=int, default=2)
    a = ap.parse_args()
    report = {}
    for spec in a.runs:
        run, _, label = spec.partition(":")
        out = subprocess.run(["arcbench", "status", run, "--json"], capture_output=True, text=True).stdout
        d = json.loads(out[out.index("{"):])
        label = label or d.get("requirement_id", run).split("--")[-1]
        fams = collections.Counter(); sought = collections.Counter(); resolved = collections.Counter(); samples = collections.defaultdict(list)
        for t in d.get("failed_tests", []):
            e = ANSI.sub("", t.get("error") or "")
            f = family(e); fams[f] += 1
            for m in SOUGHT.findall(e)[:1]:
                sought[m[:70]] += 1
            for m in RESOLVED.findall(e)[:1]:
                resolved[m[0] + (" " + m[1].strip()[:60] if m[1].strip() else "")] += 1
            if len(samples[f]) < a.samples:
                samples[f].append({"name": t.get("name"), "error": e[:400]})
        report[label] = {"run": run, "passed": d.get("passed"), "failed": d.get("failed"), "status": d.get("status"),
                         "families": dict(fams.most_common()), "sought": dict(sought.most_common(12)),
                         "resolved": dict(resolved.most_common(8)), "samples": dict(samples)}
        print(f"== {label} {run} passed={d.get('passed')} failed={d.get('failed')} status={d.get('status')}")
        for k, v in fams.most_common():
            print(f"   {v:3d}  {k}")
        for k, v in sought.most_common(8):
            print(f"        {v:2d}x {k}")
        for k, v in resolved.most_common(5):
            print(f"        -> {v:2d}x resolved {k}")
    if a.json:
        json.dump(report, open(a.json, "w"), indent=1, ensure_ascii=False)

if __name__ == "__main__":
    main()
