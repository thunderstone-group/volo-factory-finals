#!/usr/bin/env python3
"""Prototype: let flash write Playwright acceptance tests from a requirements.yaml (experiment, not in the package).

Step 1 writes fixtures.cjs (creates every record a scenario assumes, through the application's own UI).
Step 2 writes one spec file per top-level requirement folder, one test per ATOMIC scenario, in parallel.
Usage: testgen_proto.py REQUIREMENTS_YAML OUT_DIR
"""
import concurrent.futures
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, os.path.expanduser("~/projects/volo-factory/oneshot"))
import main as oneshot  # noqa: E402
import scenarios  # noqa: E402

MODEL = "deepseek-v4-flash"
BASE = "https://api.arc-bench.com/v1"

COMMON = """You write end-to-end acceptance tests for a web application that another engineer is building, right now,
from the requirements document below. You never see the application: the tests must follow only what the requirements
state, and they are how the engineer learns what is still wrong.

How the tests run:
- @playwright/test, CommonJS (`const { test, expect } = require('@playwright/test');`), one worker, Chromium,
  `baseURL` set to the application's origin, so navigate with `page.goto('/')` or a path the requirements give.
- Each test has 15 seconds; each action or assertion waits at most 5 seconds. Keep every test short and direct.
- The application starts EMPTY: no accounts, no records. Anything a scenario assumes to exist ("an existing
  account", "a saved workbook", "a repository with two branches", "A1 contains 2") must be created by the test itself
  through the application's own user interface, following the creation flows the requirements describe, with the
  exact pages, controls and names they give. There is no test API, no seed data and no direct database access.
- Every name that must be unique (usernames, emails, titles, repository or workbook names ...) gets a unique suffix,
  e.g. `u()` returning `Date.now().toString(36) + Math.random().toString(36).slice(2, 6)`; respect the format rules
  the requirements state for that value (lowercase, allowed characters, length).
- Locate elements the way a user perceives them, only with what the requirements state: `page.getByRole(role, { name,
  exact: true })` with the exact quoted accessible name, `page.getByLabel(label, { exact: true })` for fields,
  `page.getByText(text)` for visible text. Never use CSS selectors, XPath, test ids, element ids, class names or
  guessed URLs. When the requirements say a control lives inside a named dialog, menu, region, row, card or grid,
  scope the locator to that container first.
- A browser session is isolated per test; a test that needs a signed-in user signs up and signs in through the UI
  (use the fixtures).
"""

FIXTURES = COMMON + """
Your task now: write `fixtures.cjs`, a CommonJS module used by every test file. It exports:
- `u()` for unique suffixes;
- one async function per kind of record or state the scenarios assume, each creating it through the UI exactly as the
  requirements' own creation flow describes (for example: register an account and sign in; create the record; open it;
  enter values), taking `page` plus options and returning what later steps need (names, credentials, the URL of the
  created record's page);
- small helpers for interactions the requirements define in a specific way (for example how a value is entered and
  committed, how a menu is opened), so tests stay short.
Only use controls, labels, texts and flows the requirements state. If a flow needs a value the requirements constrain
(password rules, name formats), generate a compliant one. Add a one-line comment above each export naming the
requirement ids whose flow it follows.

Reply with exactly one file block and nothing else:
=== FILE: fixtures.cjs ===
<file content>
=== END ===
"""

TESTS = COMMON + """
`fixtures.cjs` (already written, in the same directory; import it with `const f = require('./fixtures.cjs');`) exports:
{api}

Your task now: write `{file}` with exactly one `test(...)` per scenario listed below, titled `<scenario id>: <scenario
name>` exactly as listed. Each test builds the GIVEN state (with the fixtures, or with the UI steps of the requirements
it depends on), performs the WHEN actions in order, and asserts what the THEN steps state, using the names and values
the scenario and its requirement give; when a THEN step mentions refreshing or reopening, do it (`page.reload()` or
navigating back to the record) and assert again. Assert only what the text states; do not invent labels or messages.
Prefer web-first assertions (`await expect(locator).toBeVisible()`, `toHaveText`, `toHaveAttribute`, `toHaveValue`).

Scenarios:
{scenarios}

Reply with exactly one file block and nothing else:
=== FILE: {file} ===
<file content>
=== END ===
"""


def key():
    for line in (Path.home() / ".config/arcbench/volo.env").read_text().splitlines():
        if line.startswith("ARC_BENCH_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"')
    raise SystemExit("no key")


def call(system, user, budget, label, log):
    messages = [{"role": "system", "content": system}, {"role": "user", "content": user}]
    started = time.monotonic()
    content, usage, finish = oneshot.stream_completion(messages, MODEL, BASE, key(), budget, tries=3)
    log.append({"label": label, "seconds": round(time.monotonic() - started, 1), "usage": usage, "finish": finish})
    blocks, missing = oneshot.parse_blocks(content)
    return blocks, missing, finish


def main():
    req_path, out = Path(sys.argv[1]), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    text = req_path.read_text(encoding="utf-8")
    document = "Requirements document (YAML):\n\n" + text
    budget = oneshot.CallBudget(draft_limit=20)
    log = []
    if (out / "fixtures.cjs").is_file():
        fixture = {"content": (out / "fixtures.cjs").read_text(encoding="utf-8")}
    else:
        blocks, missing, finish = call(FIXTURES, document, budget, "fixtures", log)
        fixture = next(b for b in blocks if b["path"].endswith("fixtures.cjs"))
        (out / "fixtures.cjs").write_text(fixture["content"], encoding="utf-8")
    api = "\n".join(line for line in fixture["content"].splitlines()
                    if re.match(r"\s*(//|async function|function|module\.exports|exports\.|const \w+ = async)", line))[:6000]

    reqs = scenarios.load_requirements(text)
    atomic = [n for n in reqs["atomic"]] if isinstance(reqs, dict) and "atomic" in reqs else None
    if atomic is None:
        planned = scenarios.plan(text)
        items = [(s["id"], s["name"]) for s in planned["scenarios"]]
    else:
        items = []
        for r in atomic:
            for i, s in enumerate(r["scenarios"]):
                items.append((r["id"] + (f"#{i + 1}" if i else ""), s["name"]))
    groups = {}
    for sid, name in items:
        top = sid.split("#")[0].split("-")[:2]
        groups.setdefault("-".join(top), []).append((sid, name))

    def one(group):
        file = f"{group}.spec.cjs"
        listed = "\n".join(f"- {sid}: {name}" for sid, name in groups[group])
        fill = lambda t: t.replace("{api}", api).replace("{file}", file).replace("{scenarios}", listed)
        user = document + "\n\n" + "Your task now:" + fill(TESTS.split("Your task now:")[1])
        system = fill(TESTS.split("Your task now:")[0])
        blocks, missing, finish = call(system, user, budget, group, log)
        spec = next((b for b in blocks if b["path"].endswith(".cjs")), None)
        if spec:
            (out / file).write_text(spec["content"], encoding="utf-8")
        return group, bool(spec), finish, missing

    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(one, sorted(groups)))
    checks = {}
    for path in sorted(out.glob("*.cjs")):
        r = subprocess.run(["node", "--check", str(path)], capture_output=True, text=True)
        checks[path.name] = r.returncode == 0 or r.stderr[-400:]
    summary = {"results": results, "checks": checks, "calls": log, "cost_cny": round(budget.spent(), 4),
               "tests": sum(len(re.findall(r"^\s*test\(", p.read_text(), re.M)) for p in out.glob("*.spec.cjs")),
               "scenarios": len(items)}
    (out / "summary.json").write_text(json.dumps(summary, indent=1, ensure_ascii=False, default=str))
    print(json.dumps({k: summary[k] for k in ("results", "checks", "cost_cny", "tests", "scenarios")}, default=str))


if __name__ == "__main__":
    main()
