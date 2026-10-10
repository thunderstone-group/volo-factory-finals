"""Backstop before the 10-08 20:00 finals deadline: at 19:50, if v6 is still the latest submission and its best
combo S is below v5's, cancel v6's active runs and delete v6 so v5 (Sheet 30/30) becomes the latest again.
Deleting a worse newer submission is authorized (10-07: "授权，更差的提交你直接删"); the session normally does this
by hand earlier, and this only acts if that did not happen."""
import json, re, subprocess, sys, time
from datetime import datetime
from pathlib import Path
from arcbench_cli.client import OfficialClient, SubmitConfig, load_env

D = Path(__file__).resolve().parent
V6, V5 = "218428c590f0", "108621e1ed8d"
LOG = D / "final_guard.log"


def log(msg):
    with LOG.open("a") as f:
        f.write(f"{datetime.now():%m-%d %H:%M} {msg}\n")


def cli(*args):
    return subprocess.run(["arcbench", "--json", *args], capture_output=True, text=True).stdout


def combo(sub):
    out = subprocess.run([sys.executable, str(D / "best_combo.py"), sub], capture_output=True, text=True).stdout
    m = re.search(r"combo: (\d+)/60, ([\d.]+) CNY, S ([\d.]+)", out)
    return (int(m[1]), float(m[2]), float(m[3])) if m else None


while datetime.now().strftime("%m%d%H%M") < "10081950":
    time.sleep(30)
latest = max((s for s in json.loads(cli("submissions")) if s.get("competition_id") == "hackathon-evolution"),
             key=lambda s: s["created_at"])["id"]
c6, c5 = combo(V6), combo(V5)
log(f"latest {latest}; v6 {c6}; v5 {c5}")
if latest != V6 or c5 is None or (c6 is not None and c6[2] >= c5[2]):
    log("no action")
    sys.exit(0)
for r in json.loads(cli("runs", "--submission", V6, "--limit", "100")):
    if r["status"] in ("RUNNING", "QUEUED", "PENDING"):
        cli("cancel", r["run_id"])
        log(f"cancelled {r['run_id']}")
client = OfficialClient(SubmitConfig.from_env(load_env(Path.home() / ".config/arcbench/volo.env")))
client.request("DELETE", f"/submissions/{V6}")
left = [s["id"] for s in json.loads(cli("submissions"))]
log(f"deleted {V6}; still listed: {V6 in left}")
with (D / "deletions.log").open("a") as f:
    f.write(f"{datetime.now():%m-%d %H:%M} deleted {V6} (final_guard: v6 {c6} < v5 {c5})\n")
