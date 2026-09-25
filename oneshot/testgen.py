#!/usr/bin/env python3
"""Requirement-written acceptance tests: the model writes Playwright tests from the requirements alone (it never sees
the application), the suite runs against the staged application, and its report takes the place of the scenario
check's in the repair loop (main.repair_delivery).

    python oneshot/testgen.py write --requirements requirements.yaml --suite SUITE_DIR
    python oneshot/testgen.py run --requirements requirements.yaml --app APP_DIR --suite SUITE_DIR --out result.json

Every test ends `pass`, `fail` (the application did not do what the test, written from the requirements, expects) or
`error` (the test broke on its own: its code threw, its file did not load, it named a control the requirements never
name, or it skipped a GIVEN state it could not build). Failures at the same helper line with the same message in
several tests are one finding: the tests become `error` and one `helper:` entry carries the verdict. Errors never
drive a repair and never count as gained or lost.
"""
import argparse
import collections
import concurrent.futures
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

try:
    from . import scenario_check, scenarios
except ImportError:  # run as a script, or from the flat package next to main.py
    import scenario_check
    import scenarios

GROUP_SCENARIOS = 8  # scenarios per spec file (one model call); requirements are never split across files
GROUP_WORKERS = 4  # parallel spec calls; a gateway burst cuts several streams at once
RUN_SECONDS = 900  # one suite run; a hung runner is stopped here
TEST_SECONDS = 15
ACTION_SECONDS = 5
RUNNER_PREFIX = Path(tempfile.gettempdir()) / "oneshot-playwright-test-1.57.0"
RUNNER_PACKAGE = "@playwright/test@1.57.0"
RUNNER_IMAGE_MODULES = "/opt/arcbench/node_modules"
SHOWN_ERROR = 700
SHOWN_SOURCE = 60  # lines of a failing test's body in its report entry

SYSTEM = """You write end-to-end acceptance tests for a web application that another engineer is building right now
from the requirements document you are given. You never see the application: the tests follow only what the
requirements state, and they are how the engineer learns what is still wrong. A test that fails for a reason of its own
(a name or a step the requirements do not give) misleads the engineer, so every locator and value comes from the text.

How the tests run:
- @playwright/test, CommonJS: `const {{ test, expect }} = require('@playwright/test');`, one worker, Chromium;
  `baseURL` is the application's origin, so navigate with `page.goto('/')`.
- {test_seconds} seconds per test; each action or assertion waits at most {action_seconds} seconds. Build only the state
  the scenario needs.
- The browser context grants clipboard read and write; put text on the clipboard with
  `await page.evaluate((t) => navigator.clipboard.writeText(t), text)`.
- The application starts with only the seed data the requirements describe. Anything else a scenario assumes ("an
  existing account", "a saved record", "a cell contains 2") the test creates itself through the application's own user
  interface, following the creation flows the requirements describe, with their exact pages, controls and names.
  There is no test API and no database access. When a GIVEN state cannot be built through flows the requirements
  describe (it needs seed records whose names the requirements do not give, or another system), write that test as
  `test.skip(title, async () => {{}})` with a one-line comment saying why, instead of guessing.
- Names that must be unique (usernames, emails, titles, record names) get a unique suffix, for example
  `const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);`, within the format rules the
  requirements state.
- Locate elements the way a user perceives them, only with what the requirements state:
  `page.getByRole(role, {{ name, exact: true }})` with the exact quoted accessible name,
  `page.getByLabel(label, {{ exact: true }})` for fields, `page.getByText(text, {{ exact: true }})` for visible text.
  Never CSS selectors, XPath, test ids, element ids, class names or guessed URLs. When the requirements put a control
  inside a named dialog, menu, region, row or grid, scope the locator to it first.
- Tests are independent: each builds its own state and never relies on another test having run.
- Every file runs in order against ONE application that is never reset between tests. Never change a seeded
  record's credentials, never delete or rename a seeded record: when a scenario does that (change a password, delete
  a repository, rename a workbook), the test first creates its own record through the UI and acts on that one, so the
  seeded state stays as the requirements give it for every later test.
- Where the requirements allow several ways to do the same thing (in a grid or a separate field, with a keyboard
  shortcut or a menu command, with a button or the Enter key), spread the tests of that requirement across those ways,
  as different users would.

Write ONE self-contained file `{file}`: small helper functions at the top (creating the records the scenarios assume,
entering values the way the requirements describe, opening menus), then one `test(...)` per scenario listed, titled
exactly `<scenario id>: <scenario name>` as listed. Each test builds the GIVEN state, performs the WHEN steps in order
and asserts what the THEN steps state with web-first assertions (`await expect(locator).toBeVisible()`, `toHaveText`,
`toHaveValue`, `toHaveAttribute`, `toHaveCount`). When a THEN step mentions refreshing or reopening, do it
(`page.reload()`, or back through the home page) and assert again. Assert only what the text states; do not invent
labels or messages.

Reply with exactly one file block and nothing else:
=== FILE: {file} ===
<file content>
=== END ==="""

FILE_BLOCK = re.compile(r"=== FILE:[ \t]*(.*?)[ \t]*===[ \t]*\r?\n(.*?)\r?\n=== END ===", re.S)
TITLE = re.compile(r"""\btest(?:\.(?:skip|only|fixme))?\(\s*(['"`])((?:\\.|(?!\1).)*)\1""")
ANSI = re.compile(r"\x1b\[[0-9;]*m")
OWN_ERROR = re.compile(r"^(?:ReferenceError|TypeError|SyntaxError|RangeError)\b")
CELL = re.compile(r"[A-Z]{1,3}[1-9][0-9]{0,5}")
NAMED = re.compile(r"""getBy(?:Role\(\s*'[a-z]+'\s*,\s*\{\s*name:\s*|Label\(\s*|Text\(\s*|Placeholder\(\s*)'((?:\\.|[^'\\])*)'""")


# ------------------------------------------------------------------------------------------------ writing

def _top(rid):
    match = re.match(r"^(\D*\d+)", rid)
    return match.group(1) if match else rid


def plan(text, limit=GROUP_SCENARIOS):
    """The suite's files: ATOMIC requirements in document order, grouped by top-level folder, a group split at
    `limit` scenarios (never inside a requirement). Scenario ids follow the scenario check: `REQ` for the first
    scenario of a requirement, `REQ#2` for the second."""
    groups, current = [], None
    for req in scenarios.load_requirements(text):
        if req.get("type") != "ATOMIC" or not req.get("scenarios"):
            continue
        items = [{"id": req["id"] + (f"#{i + 1}" if i else ""), "name": s["name"], "requirement": req["id"], "index": i + 1}
                 for i, s in enumerate(req["scenarios"])]
        top = _top(req["id"])
        if current is None or current["top"] != top or len(current["items"]) + len(items) > limit:
            current = {"top": top, "items": []}
            groups.append(current)
        current["items"] += items
    for number, group in enumerate(groups, 1):
        group["file"] = f"t{number:02d}-{re.sub(r'[^A-Za-z0-9_-]+', '-', group['top'])}.spec.cjs"
    return groups


def request(text, group, prerequisites=""):
    listed = "\n".join(f"- {item['id']}: {item['name']}  (scenario {item['index']} of {item['requirement']})"
                       for item in group["items"])
    user = "Requirements document (YAML):\n\n" + text
    if prerequisites.strip():
        user += "\n\nPrerequisites (the task's prerequisites.md, part of the requirements):\n" + prerequisites.strip()
    user += f"\n\nWrite `{group['file']}` with one test per scenario below (ids and names exactly as listed):\n{listed}"
    system = SYSTEM.format(file=group["file"], test_seconds=TEST_SECONDS, action_seconds=ACTION_SECONDS)
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def _node():
    return shutil.which("node")


def write_suite(text, suite, complete, prerequisites="", workers=GROUP_WORKERS):
    """Write one spec file per group into `suite` with `complete(messages) -> (content, usage, finish)`; a reply
    without a file block is asked once more. Returns the manifest (also saved as suite.json)."""
    suite = Path(suite)
    suite.mkdir(parents=True, exist_ok=True)
    groups = plan(text)
    started = time.monotonic()

    def one(group):
        record = {"file": group["file"], "scenarios": [item["id"] for item in group["items"]], "calls": 0}
        messages = request(text, group, prerequisites)
        body = None
        for _ in range(2):
            record["calls"] += 1
            try:
                content, usage, finish = complete(messages)
            except Exception as exc:  # a transport failure or a spent budget: this file is missing, not the suite
                record["error"] = f"{type(exc).__name__}: {str(exc)[:200]}"
                break
            record["finish"] = finish
            found = [m for m in FILE_BLOCK.finditer(content or "") if m.group(1).strip().endswith(".cjs")]
            if found:
                body = found[-1].group(2)
                break
            record["error"] = "the reply had no file block"
        if body is None:
            return record
        path = suite / group["file"]
        path.write_text(body + "\n", encoding="utf-8")
        record.pop("error", None)
        node = _node()
        if node:
            check = subprocess.run([node, "--check", str(path)], capture_output=True, text=True, timeout=30)
            if check.returncode:
                record["syntax"] = (check.stderr or check.stdout)[-400:].strip()
        record["tests"] = [m.group(2) for m in TITLE.finditer(body)]
        return record

    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
        records = list(pool.map(one, groups))
    manifest = {"files": records, "scenarios": sum(len(g["items"]) for g in groups),
                "tests": sum(len(r.get("tests") or []) for r in records),
                "seconds": round(time.monotonic() - started, 1)}
    (suite / "suite.json").write_text(json.dumps(manifest, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    return manifest


def runnable(manifest):
    """True when at least one spec file loaded and names a test."""
    return any(r.get("tests") and not r.get("syntax") for r in (manifest or {}).get("files", []))


# ------------------------------------------------------------------------------------------------ running

def ensure_runner(env):
    """The @playwright/test CLI next to a NODE_PATH that resolves the same module for the spec files. Installed once
    per machine into RUNNER_PREFIX when no NODE_PATH entry has it. Returns (cli path, NODE_PATH) or (None, reason)."""
    node, npm = shutil.which("node", path=env.get("PATH")), shutil.which("npm", path=env.get("PATH"))
    if not node:
        return None, "node is not on PATH"
    # The evaluator's runner image ships this exact package in /opt/arcbench/node_modules; use it before the network.
    paths = ([p for p in env.get("NODE_PATH", "").split(os.pathsep) if p] + [str(RUNNER_PREFIX / "node_modules")]
             + [RUNNER_IMAGE_MODULES])
    for root in dict.fromkeys(paths):
        cli = Path(root) / "@playwright" / "test" / "cli.js"
        if cli.is_file():
            return str(cli), root
    if not npm:
        return None, "npm is not available to install " + RUNNER_PACKAGE
    try:
        done = subprocess.run([npm, "install", "--prefix", str(RUNNER_PREFIX), RUNNER_PACKAGE, "--no-audit", "--no-fund",
                               "--silent"], env=env, capture_output=True, text=True, timeout=240)
    except (OSError, subprocess.TimeoutExpired) as exc:
        return None, f"installing {RUNNER_PACKAGE} failed: {exc}"
    cli = RUNNER_PREFIX / "node_modules" / "@playwright" / "test" / "cli.js"
    if done.returncode or not cli.is_file():
        return None, f"installing {RUNNER_PACKAGE} failed: {(done.stderr or done.stdout)[-300:].strip()}"
    return str(cli), str(RUNNER_PREFIX / "node_modules")


CONFIG = """module.exports = {{
  testDir: {suite}, testMatch: /.*\\.spec\\.cjs$/, testIgnore: {ignore}, workers: 1, fullyParallel: false, retries: 0,
  timeout: {test_ms}, expect: {{ timeout: {action_ms} }}, outputDir: {output},
  reporter: [['json', {{ outputFile: {report} }}]],
  use: {{ baseURL: {base}, permissions: ['clipboard-read', 'clipboard-write'], actionTimeout: {action_ms},
         navigationTimeout: {navigation_ms}, trace: 'off', video: 'off', screenshot: 'off' }},
}};
"""


def _grep(titles):
    """A --grep pattern for exactly these test titles. Playwright matches it against the title path, which starts
    with the file name, so only the end is anchored; escaped for a JavaScript RegExp."""
    escape = lambda t: re.sub(r"[.*+?^${}()|\[\]\\/-]", lambda m: "\\" + m.group(0), t)
    return "(?:^|\\s)(?:" + "|".join(escape(t) for t in sorted(titles)) + ")$"


def _source(path, line, limit=SHOWN_SOURCE):
    """The test's body from its `test(` line to the next top-level test, at most `limit` lines."""
    try:
        lines = Path(path).read_text(encoding="utf-8", errors="replace").splitlines()
    except OSError:
        return ""
    start = max(0, (line or 1) - 1)
    body = [lines[start]] if start < len(lines) else []
    for text in lines[start + 1:]:
        if TITLE.match(text.strip()) and not text.startswith((" ", "\t")):
            break
        body.append(text)
        if len(body) >= limit:
            body.append("  ...")
            break
    return "\n".join(body).rstrip()


def _phrases(text):
    """Every quoted phrase of the requirements as a matcher; `<placeholder>` parts match any text."""
    found = set()
    for match in re.finditer(r'`([^`\n]{1,80})`|[“"]([^”"\n]{1,80})[”"]|‘([^’\n]{1,80})’', text):
        phrase = next(g for g in match.groups() if g)
        found.add(phrase.strip())
    patterns = [re.compile("^" + ".+".join(re.escape(part) for part in re.split(r"<[^<>]{1,40}>", p)) + "$", re.S)
                for p in found if "<" in p]
    return found, patterns


def ungrounded(name, source, text, quoted):
    """True when a locator's name is a literal of the test file that the requirements never give: the test made it
    up. Names built at run time (unique suffixes, values the test entered) are not literals and are not judged."""
    literal = ("'" + name + "'") in source or ('"' + name + '"') in source or ("`" + name + "`") in source
    if not literal or len(name) < 2 or name in text:
        return False
    if CELL.fullmatch(name):
        # A grid cell's address is how any spreadsheet names its cells, not something the test made up (09-25: nine
        # Sheet tests addressing E1, F1, H2 or B5 were set aside as errors and never drove a repair).
        return False
    phrases, patterns = quoted
    return name not in phrases and not any(p.match(name) for p in patterns)


def _classify(result, source_text, text, quoted):
    """(status, observation, location) for one Playwright result."""
    status = result.get("status")
    if status in ("passed",):
        return "pass", "", None
    if status == "skipped":
        return "error", "Skipped by the test (its GIVEN state cannot be built from the requirements).", None
    errors = result.get("errors") or ([result["error"]] if result.get("error") else [])
    message = ANSI.sub("", (errors[0].get("message") if errors else "") or "").strip()
    stack = ANSI.sub("", (errors[0].get("stack") if errors else "") or "")
    location = (errors[0].get("location") if errors else None) or None
    first = message.splitlines()[0] if message else f"the test ended {status}"
    if OWN_ERROR.match(first) or OWN_ERROR.match(stack.strip()):
        return "error", "The test's own code threw: " + first[:300], location
    for name in NAMED.findall(message):
        name = name.replace("\\'", "'")
        if ungrounded(name, source_text, text, quoted):
            return "error", f"The test used the name {name!r}, which the requirements never give: {first[:200]}", location
    snippet = ANSI.sub("", (errors[0].get("snippet") if errors else "") or "")
    observation = message[:SHOWN_ERROR]
    if snippet:
        observation += "\n" + snippet[:500]
    return "fail", observation, location


def _walk(suite_node, found):
    for spec in suite_node.get("specs") or []:
        for test in spec.get("tests") or []:
            results = test.get("results") or []
            found.append((spec, results[-1] if results else {"status": test.get("status") or "skipped"}))
    for child in suite_node.get("suites") or []:
        _walk(child, found)


SCENARIO_NUMBER = re.compile(r"Scenario\s+(\d+)\s*$")


def _test_id(title):
    """`<scenario id>: <scenario name>` as (id, name). A model often drops the `#n` of a later scenario and titles it
    `REQ-3-1: ... - Scenario 2`; four tests then shared one id and the repair ledger counted them as one. The scenario
    number at the end of the name restores it."""
    sid, _, name = title.partition(": ")
    sid, name = sid.strip(), name.strip()
    number = SCENARIO_NUMBER.search(name)
    if "#" not in sid and number and int(number.group(1)) > 1:
        sid = f"{sid}#{int(number.group(1))}"
    return sid, name


def parse(report_path, suite, manifest, text):
    """The Playwright JSON report as scenario-check entries, one per test the manifest lists."""
    suite = Path(suite)
    quoted = _phrases(text or "")
    try:
        data = json.loads(Path(report_path).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        data = {}
    found = []
    for node in data.get("suites") or []:
        _walk(node, found)
    by_title = {}
    for spec, result in found:
        by_title[spec.get("title")] = (spec, result)
    load_errors = [ANSI.sub("", e.get("message") or "")[:300] for e in data.get("errors") or []]
    entries = []
    for record in manifest.get("files", []):
        path = suite / record["file"]
        source_text = path.read_text(encoding="utf-8", errors="replace") if path.is_file() else ""
        for title in record.get("tests") or []:
            sid, name = _test_id(title)
            entry = {"id": sid, "name": name, "file": record["file"], "steps": []}
            if record.get("syntax"):
                entry.update(status="error", observation="The test file does not parse: " + record["syntax"][:300])
            elif title not in by_title:
                why = next((e for e in load_errors if record["file"] in e), None) or "the runner did not report it"
                entry.update(status="error", observation="Not run: " + why)
            else:
                spec, result = by_title[title]
                status, observation, location = _classify(result, source_text, text or "", quoted)
                entry.update(status=status, observation=observation,
                             source=_source(path, spec.get("line")) if status == "fail" else "")
                if location:
                    entry["at"] = f"{Path(location.get('file') or '').name}:{location.get('line')}"
                entry["seconds"] = round((result.get("duration") or 0) / 1000, 1)
            entries.append(entry)
    return _collapse(entries)


def _collapse(entries):
    """Several tests failing at the same helper line with the same message are one finding: the tests become errors
    (never gained or lost on their own) and one `helper:` entry carries the verdict. A test body's own line is not a
    helper, so distinct tests failing alike in their own code stay separate."""
    groups = collections.defaultdict(list)
    for entry in entries:
        if entry["status"] == "fail" and entry.get("at"):
            first = entry["observation"].splitlines()[0] if entry["observation"] else ""
            groups[(entry["at"], re.sub(r"\d+ms", "", first))].append(entry)
    out = list(entries)
    for (at, first), members in groups.items():
        if len(members) < 2:
            continue
        ids = [m["id"] for m in members]
        observation, source = members[0]["observation"], members[0].get("source", "")
        for member in members:
            member.update(status="error", observation=f"Blocked by helper:{at} (shared with {len(members) - 1} other test(s)).")
        out.append({"id": f"helper:{at}", "name": f"{len(members)} tests stop at the same helper line ({', '.join(ids[:6])})",
                    "status": "fail", "observation": observation, "steps": [], "source": source, "blocks": ids,
                    "file": members[0]["file"]})
    return out


def run_suite(app, suite, text=None, only=None, seconds=RUN_SECONDS):
    """Run the suite in `suite` against the application directory `app` (built in a scratch copy, one backend for the
    whole run, like the evaluator). With `only`, just those test ids run. Returns a scenario-check-shaped report."""
    started = time.monotonic()
    suite = Path(suite)
    try:
        manifest = json.loads((suite / "suite.json").read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        return {"unavailable": f"no suite manifest: {exc}", "scenarios": [], "invariants": []}
    if only is not None and any(str(sid).startswith("helper:") for sid in only):
        only = None  # a helper finding spans tests its id does not name: run them all
    if only is not None:
        keep = set(only)
        manifest = {**manifest, "files": [{**r, "tests": [t for t in (r.get("tests") or []) if _test_id(t)[0] in keep]}
                                          for r in manifest.get("files", [])]}
    work = Path(tempfile.mkdtemp(prefix="testgen-run-"))
    backend = None
    try:
        tmp = work / "tmp"
        tmp.mkdir()
        env = scenario_check._child_env(tmp)
        cli, node_path = ensure_runner(env)
        if not cli:
            return {"unavailable": node_path, "scenarios": [], "invariants": []}
        titles = [t for r in manifest.get("files", []) if not r.get("syntax") for t in (r.get("tests") or [])]
        # One file that does not parse makes Playwright load no test at all ("Total: 0 tests"); skip it by name.
        broken = ["**/" + r["file"] for r in manifest.get("files", []) if r.get("syntax") and r.get("file")]
        try:
            workspace = scenario_check.Workspace(app, work, env)
        except (scenario_check.AppError, OSError) as exc:
            return _all(manifest, "fail", f"The application could not be prepared: {exc}", started)
        backend = scenario_check.Backend(workspace.root, env, work / "backend.log")
        port, ready, why = scenario_check._start_backend(backend, workspace, None)
        if not ready:
            return _all(manifest, "fail", f"The backend did not start: {why}", started)
        report_path = work / "report.json"
        (work / "playwright.config.cjs").write_text(CONFIG.format(
            suite=json.dumps(str(suite)), ignore=json.dumps(broken),
            output=json.dumps(str(work / "results")), report=json.dumps(str(report_path)),
            base=json.dumps(f"http://127.0.0.1:{port}"), test_ms=TEST_SECONDS * 1000, action_ms=ACTION_SECONDS * 1000,
            navigation_ms=10000), encoding="utf-8")
        command = [shutil.which("node", path=env.get("PATH")), cli, "test", "--config", str(work / "playwright.config.cjs")]
        if only is not None and titles:
            command += ["--grep", _grep(titles)]
        runner_env = dict(env, NODE_PATH=os.pathsep.join(filter(None, [node_path, env.get("NODE_PATH")])))
        for name in ("PLAYWRIGHT_BROWSERS_PATH",):
            if name in os.environ:
                runner_env[name] = os.environ[name]
        timed_out = False
        try:
            subprocess.run(command, cwd=work, env=runner_env, capture_output=True, text=True, timeout=seconds)
        except subprocess.TimeoutExpired:
            timed_out = True
        report = {"kind": "testgen", "scenarios": parse(report_path, suite, manifest, text), "invariants": []}
        if timed_out:
            report["timed_out"] = seconds
        counts = collections.Counter(e["status"] for e in report["scenarios"])
        report["coverage"] = {"total": manifest.get("scenarios"), "parsed": counts.get("pass", 0) + counts.get("fail", 0)}
        report["seconds"] = round(time.monotonic() - started, 1)
        return report
    finally:
        if backend:
            backend.stop()
        shutil.rmtree(work, ignore_errors=True)


def _all(manifest, status, observation, started):
    entries = []
    for record in manifest.get("files", []):
        for title in record.get("tests") or []:
            sid, name = _test_id(title)
            entries.append({"id": sid, "name": name, "status": status, "observation": observation,
                            "steps": [], "file": record["file"]})
    return {"kind": "testgen", "scenarios": entries, "invariants": [], "seconds": round(time.monotonic() - started, 1)}


# ------------------------------------------------------------------------------------------------ CLI

def _cli_complete(model, base, key):
    """A plain streaming completion for the CLI (main.stream_completion with a throwaway ledger)."""
    try:
        from . import main as oneshot
    except ImportError:
        import main as oneshot
    budgets = []

    def complete(messages):
        own = oneshot.CallBudget(draft_limit=1)
        budgets.append(own)
        return oneshot.stream_completion(messages, model, base, key, own, tries=3)
    complete.budgets = budgets
    return complete


def main(argv=None):
    parser = argparse.ArgumentParser(description="Write or run requirement-written acceptance tests.")
    sub = parser.add_subparsers(dest="command", required=True)
    write = sub.add_parser("write")
    write.add_argument("--requirements", required=True, type=Path)
    write.add_argument("--suite", required=True, type=Path)
    run = sub.add_parser("run")
    run.add_argument("--requirements", required=True, type=Path)
    run.add_argument("--app", required=True, type=Path)
    run.add_argument("--suite", required=True, type=Path)
    run.add_argument("--out", required=True, type=Path)
    args = parser.parse_args(argv)
    text = args.requirements.read_text(encoding="utf-8")
    if args.command == "write":
        key = os.environ.get("OPENAI_API_KEY")
        if not key:
            print("OPENAI_API_KEY is not set", file=sys.stderr)
            return 1
        complete = _cli_complete(os.environ.get("MODEL", "deepseek-v4-flash"),
                                 os.environ.get("OPENAI_BASE_URL", "https://api.arc-bench.com/v1"), key)
        manifest = write_suite(text, args.suite, complete)
        manifest["cost_cny"] = round(sum(b.spent() for b in complete.budgets), 4)
        manifest["usage"] = [b.summary() for b in complete.budgets]
        (args.suite / "suite.json").write_text(json.dumps(manifest, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
        print(json.dumps({k: manifest[k] for k in ("scenarios", "tests", "seconds", "cost_cny")}), file=sys.stderr)
        return 0
    report = run_suite(args.app, args.suite, text)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    counts = collections.Counter(e["status"] for e in report.get("scenarios", []))
    print(f"tests: {dict(counts)}; {report.get('seconds')} s -> {args.out}"
          + (f"; unavailable: {report['unavailable']}" if report.get("unavailable") else ""), file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
