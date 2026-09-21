"""Post-run probe validity audit; does not change the frozen loop or call a model."""

import argparse
import json
from pathlib import Path
import shutil
import subprocess
import uuid

from business_replay import fingerprint, summarize
from experiment_recovery import atomic_json


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--application", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    source, out = args.application.resolve(), args.out.resolve()
    if out.exists():
        raise SystemExit("audit output exists; do not overwrite it")
    out.mkdir(parents=True)
    shutil.copytree(
        source,
        out / "application",
        ignore=shutil.ignore_patterns("node_modules", "dist", "__pycache__"),
    )
    checks = out / "checks"
    checks.mkdir()
    tools = Path(__file__).with_name("business_experiment").resolve()
    original = (tools / "ctrip_business.spec.cjs").read_text()
    corrected = original.replace(
        "getByLabel(/联系人.*手机|联系手机|手机号码/)",
        "getByLabel(/联系人.*手机|联系手机|手机号码|联系方式/)",
    )
    corrected = corrected.replace(
        "await page.getByRole('button',{name:'删除',exact:true}).first().click();",
        "const row=page.locator('article,tr,[role=\"row\"]').filter({hasText:'实验联系人'}).first(); await row.hover(); await row.getByRole('button',{name:'删除',exact:true}).click();",
    )
    corrected = corrected.replace(
        "page.getByRole('button',{name:/^(确定|确认|确认删除)$/})",
        "page.getByRole('dialog').getByRole('button',{name:/^(删除|确定|确认|确认删除)$/})",
    )
    (checks / "ctrip_business.spec.cjs").write_text(corrected)
    name = "arc-probe-audit-" + uuid.uuid4().hex[:12]
    command = [
        "docker",
        "--context",
        "desktop-linux",
        "run",
        "--rm",
        "--init",
        "--pull=never",
        "--name",
        name,
        "--cpus",
        "1",
        "--memory",
        "2g",
        "--network",
        "none",
        "--mount",
        f"type=bind,source={out},target=/workspace",
        "--mount",
        f"type=bind,source={checks},target=/workspace/checks,readonly",
        "--mount",
        f"type=bind,source={tools},target=/experiment-tools,readonly",
        "--workdir",
        "/workspace",
        "arc-business-feedback:20260921",
        "node",
        "/experiment-tools/container_runner.cjs",
        "probe",
    ]
    atomic_json(
        out / "invocation.json",
        {
            "command": command,
            "source_sha256": fingerprint(source),
            "purpose": "Independent interpretation audit; original model feedback and loop results remain unchanged.",
            "corrections": [
                "Accept the semantically valid 联系方式 label.",
                "Hover and scope deletion to the actual contact row before confirming the dialog.",
            ],
        },
    )
    try:
        with (out / "docker.log").open("w") as log:
            result = subprocess.run(command, stdout=log, stderr=subprocess.STDOUT)
        if result.returncode or not (out / "report.json").exists():
            raise RuntimeError("probe audit did not finish")
    finally:
        subprocess.run(
            ["docker", "--context", "desktop-linux", "rm", "-f", name],
            capture_output=True,
        )
    cases = summarize(json.loads((out / "report.json").read_text()))
    if len(cases) != 13:
        raise RuntimeError("unexpected audit case count")
    data = {
        "mode": "probe",
        "post_run_audit": True,
        "source_sha256": fingerprint(source),
        "checks_sha256": fingerprint(checks),
        "passed": sum(c["passed"] for c in cases),
        "total": len(cases),
        "cases": cases,
        "runtime": json.loads((out / "runtime.json").read_text()),
    }
    atomic_json(out / "result.json", data)
    print(
        json.dumps({"passed": data["passed"], "total": data["total"], "out": str(out)})
    )


if __name__ == "__main__":
    main()
