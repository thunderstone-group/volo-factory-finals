#!/usr/bin/env python3
"""Attribute the gateway's billed requests to the experiment's model calls (no network: reads a saved request log).

Completed calls match on the same model and exact input/output token counts inside the generation's time window.
Calls without reported usage (cut streams, failed attempts) match only a request of the same model whose start time
(the first 14 digits of the gateway request id, CST) is within 3 s of the call's own start (the stderr failure event
minus the attempt's elapsed seconds). Requests nobody claims in the experiment window are listed separately: another
agent on the same account (scratchpad agent-card) was generating Lite apps at the same time.
"""
import datetime as dt
import json
import sys
from pathlib import Path

S = Path(__file__).resolve().parent
sys.path.insert(0, str(S))
from parse_sample import summarize  # noqa: E402

EXPERIMENT_START = 1790140967  # 13:22:47 CST, the request snapshot before the first launch


def latest_log():
    files = sorted((S / "billing").glob("requests-[0-9]*.json"))
    if not files:
        raise SystemExit("no saved request log")
    return files[-1], json.loads(files[-1].read_text())


def event_times(sample_dir):
    """call number -> epoch of the stderr line that reported its failure or cut."""
    out = {}
    path = Path(sample_dir) / "events.tsv"
    for line in path.read_text(errors="replace").splitlines() if path.is_file() else []:
        at, _, text = line.partition("\t")
        for marker in ("[oneshot] call ",):
            if text.startswith(marker) and (" failed; bounded retry" in text or " was cut (" in text):
                try:
                    out[int(text[len(marker):].split()[0])] = float(at)
                except ValueError:
                    pass
    return out


def request_start(record):
    rid = str(record.get("request_id", ""))
    try:
        return dt.datetime.strptime(rid[:14], "%Y%m%d%H%M%S").timestamp()  # local time (CST) on this machine
    except ValueError:
        return None


def main(log_path=None):
    if log_path:
        path, records = Path(log_path), json.loads(Path(log_path).read_text())
    else:
        path, records = latest_log()
    records = [r for r in records if (r.get("occurred_at") or 0) >= EXPERIMENT_START - 60]
    used = set()
    samples = {}
    dirs = sorted(p for p in (S / "gens").glob("*/*") if (p / "meta.json").is_file())
    summaries = {}
    for d in dirs:
        try:
            summaries[d] = summarize(d)
        except Exception as exc:
            print(f"skip {d}: {exc!r}", file=sys.stderr)
    # pass 1: exact token matches
    for d, s in summaries.items():
        lo, hi = (s["started_at"] or 0) - 5, (s["ended_at"] or 1e12) + 120
        rows = []
        for c in s["calls"]:
            row = {"call": c["call"], "phase": c["phase"], "model": c["model"], "status": c["status"],
                   "local_cost_cny": c["local_cost_cny"], "cost_basis": c["cost_basis"], "billing": None}
            if c["prompt_tokens"] is not None and c["completion_tokens"] is not None:
                cands = [i for i, r in enumerate(records) if i not in used and r.get("model") == c["model"]
                         and r["metrics"].get("input_tokens") == c["prompt_tokens"]
                         and r["metrics"].get("output_tokens") == c["completion_tokens"]
                         and lo <= r.get("occurred_at", 0) <= hi]
                if cands:
                    i = cands[0]
                    used.add(i)
                    row["billing"] = {"request_id": records[i]["request_id"], "occurred_at": records[i]["occurred_at"],
                                      "match": "exact tokens" + (" (ambiguous)" if len(cands) > 1 else ""),
                                      **records[i]["metrics"]}
            rows.append(row)
        samples[d] = rows
    # pass 2: calls without usage, by request start time
    for d, s in summaries.items():
        times = event_times(d)
        elapsed = {c["call"]: c["elapsed_seconds"] or 0 for c in s["calls"]}
        for row in samples[d]:
            if row["billing"] is not None:
                continue
            if row["call"] not in times:
                if row["status"] != "completed":
                    row["billing_note"] = "no billed request found (an immediate connection failure never reaches the gateway)"
                continue
            start = times[row["call"]] - elapsed[row["call"]]
            row["call_started_at"] = round(start, 1)
            cands = sorted((abs(request_start(r) - start), i) for i, r in enumerate(records)
                           if i not in used and r.get("model") == row["model"] and request_start(r) is not None)
            if cands and cands[0][0] <= 3:
                i = cands[0][1]
                used.add(i)
                row["billing"] = {"request_id": records[i]["request_id"], "occurred_at": records[i]["occurred_at"],
                                  "match": f"request start within {cands[0][0]:.1f} s", **records[i]["metrics"]}
            else:
                row["billing_note"] = "no billed request started with this call (not billed by the gateway)"
    out = {"request_log": path.name, "records_in_window": len(records), "samples": {}, "unclaimed": []}
    for d, rows in samples.items():
        s = summaries[d]
        billed = [r for r in rows if r["billing"]]
        out["samples"][f"{s['model']}|{s['task']}|{s['sample']}"] = {
            "metered_cost_cny": round(sum(float(r["billing"]["amount"]) for r in billed), 6),
            "calls": len(rows), "calls_matched": len(billed),
            "unmatched_calls": [r["call"] for r in rows if not r["billing"] and r["status"] == "completed"],
            "unbilled_failed_calls": [r["call"] for r in rows if not r["billing"] and r["status"] != "completed"],
            "local_cost_cny": s["local_cost_cny"], "rows": rows}
    for i, r in enumerate(records):
        if i not in used:
            out["unclaimed"].append({"request_id": r["request_id"], "model": r.get("model"),
                                     "occurred_at": r.get("occurred_at"), **r["metrics"]})
    out["unclaimed_amount_cny"] = round(sum(float(r["amount"]) for r in out["unclaimed"]), 6)
    (S / "billing" / "reconciled.json").write_text(json.dumps(out, indent=2))
    for k, v in out["samples"].items():
        print(f"{k:45s} metered {v['metered_cost_cny']:8.4f}  local {v['local_cost_cny']:8.4f}  "
              f"matched {v['calls_matched']}/{v['calls']} unmatched {v['unmatched_calls']}")
    print(f"unclaimed in window: {len(out['unclaimed'])} requests, {out['unclaimed_amount_cny']} CNY")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else None)
