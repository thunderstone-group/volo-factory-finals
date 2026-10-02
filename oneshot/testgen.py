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

GROUP_SCENARIOS = 30  # scenarios per spec file (one model call); requirements are never split across files. One
# file per top-level requirement group (Sheet 5 files of 13-26, GitHub 6 of 14-25) cost CNY 2.29 against 5.16 for
# 8 per file (16 files) on 09-28, and ranked ten apps with known hidden scores better (Spearman 0.94 vs 0.86, errors
# per app 5.8 vs 21.3; one suite each). 92 % of the output is reasoning,
# and each call re-reads the whole requirements document before it writes.
GROUP_WORKERS = 1  # serialize long streams; preserve the completed file before starting the next one
AUDIT = os.environ.get("ONESHOT_TEST_AUDIT", "0") == "1"  # opt-in; replaced by source counterexamples in the S70 candidate
AUDIT_LIMIT = 6  # Additional requirement-grounded checks per file, after reviewing the existing tests.
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
- Follow the specified selection interaction. For explicitly clickable options, click the combobox and then the
  named option; do not use selectOption to bypass the required clickable-option path. Use selectOption for a control
  explicitly described as a native select. Two controls with the same label may have different contracts in different
  containers; respect each declaration rather than applying one interaction to every matching label.
- Tests are independent: each builds its own state and never relies on another test having run.
- Every file runs in order against ONE application that is never reset between tests. Never change a seeded
  record's credentials, never delete or rename a seeded record: when a scenario does that (change a password, delete
  a repository, rename a workbook), the test first creates its own record through the UI and acts on that one, so the
  seeded state stays as the requirements give it for every later test.
- Preserve every shared prerequisite, including permissions, effective decisions, flags, constraints and related
  records. Merely opening an existing record does not establish that it is eligible, writable, current or otherwise
  in the stated GIVEN condition. Establish those conditions through the documented flows and check their stated
  visible facts before the WHEN action; a comment or an enabled button alone is not evidence of them.
  Prefer records created by this test when the scenario does not require a particular seeded identity. If it must
  mutate a reusable seed, complete every THEN assertion first, including persistence, then restore the effective
  prerequisites through documented UI actions before later tests reuse it. Preserve history where required; do not
  delete historical records just to reset an effective decision. Never replace these steps with an API, storage edit
  or an assumption that the next browser context resets server data.
- A scenario whose name or steps are generic ("the requested workflow") is specified by its requirement's
  description. Across the tests of one requirement, cover every behaviour the description states: each case it lists
  (every kind of error, option, direction or input form), how the feature works together with the others it names (a
  formula after a sort, a rule after an insert, a filter with a header row), the boundary values it gives, and the
  rejected paths with their stated messages. When a requirement states more behaviours than it has scenarios, one test
  checks several of them in sequence. After a refresh or reopen, assert the changed content itself, not only a title.
- Where the requirements allow several ways to do the same thing (in a grid or a separate field, with a keyboard
  shortcut or a menu command, with a button or the Enter key), spread the tests of that requirement across those ways,
  as different users would.

Write ONE self-contained file (named at the end): small helper functions at the top (creating the records the scenarios assume,
entering values the way the requirements describe, opening menus), then one `test(...)` per scenario listed, titled
exactly `<scenario id>: <scenario name>` as listed. Each test builds the GIVEN state, performs the WHEN steps in order
and asserts what the THEN steps state with web-first assertions (`await expect(locator).toBeVisible()`, `toHaveText`,
`toHaveValue`, `toHaveAttribute`, `toHaveCount`). When a THEN step mentions refreshing or reopening, do it
(`page.reload()`, or back through the home page) and assert again. Assert only what the text states; do not invent
labels or messages.

Reply with exactly one file block for that file and nothing else:
=== FILE: <file name> ===
<file content>
=== END ==="""

FILE_BLOCK = re.compile(r"=== FILE:[ \t]*(.*?)[ \t]*===[ \t]*\r?\n(.*?)\r?\n=== END ===", re.S)
TITLE = re.compile(r"""\btest(?:\.(?:skip|only|fixme))?\(\s*(['"`])((?:\\.|(?!\1).)*)\1""")
ANSI = re.compile(r"\x1b\[[0-9;]*m")
OWN_ERROR = re.compile(r"^(?:ReferenceError|TypeError|SyntaxError|RangeError)\b"
                       r"|can be only used with (?:Locator|Page|APIResponse) object"
                       r"|^Error: expect: Property '[^'\n]+' not found\.$")
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
    # Everything before this point is the same for every file of the suite, so the gateway's prefix cache serves it
    # after the first call (09-26: the file name sat in the system prompt, no call shared a prefix, and the
    # requirements were billed uncached sixteen times).
    user += (f"\n\nWrite `{group['file']}` with one test per scenario below (ids and names exactly as listed):\n{listed}"
             f"\n\nReply with exactly one file block:\n=== FILE: {group['file']} ===\n<file content>\n=== END ===")
    system = SYSTEM.format(test_seconds=TEST_SECONDS, action_seconds=ACTION_SECONDS)
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def _node():
    return shutil.which("node")


def _parses(node, path, text):
    """Whether `text` passes `node --check` as the CommonJS file `path` would."""
    probe = Path(path).with_name(Path(path).name + ".check.cjs")
    try:
        probe.write_text(text + "\n", encoding="utf-8")
        return subprocess.run([node, "--check", str(probe)], capture_output=True, text=True, timeout=30).returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        return False
    finally:
        probe.unlink(missing_ok=True)


FENCE = re.compile(r"\A[ \t]*```[\w-]*[ \t]*\r?\n(.*?)(?:\r?\n[ \t]*```[ \t]*)?\s*\Z", re.S)


def unfence(body):
    """A file body without the Markdown code fence a reply may wrap it in: three of fifteen files of one GitHub suite
    began with ```js, which turns the whole file into template literals that do not parse (21 of 100 tests never ran)."""
    match = FENCE.match(body)
    return match.group(1) if match else body


# Two slips of the writer kill whole files whatever the application does. In eight Sheet suites (09-27) 13-19 tests
# per application threw in their own code, nearly all in the REQ-5 files (sort, filter, validation, pivot), the area
# the hidden suite fails most: a helper that uses `page` without taking it as a parameter (`ReferenceError: page is
# not defined`), and an `async` helper that only returns a locator, whose caller forgets `await` and calls a method
# on the Promise (`startCell.scrollIntoViewIfNeeded is not a function`). Those tests never drove a repair.
PAGE_SHIM = ("\n// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the "
             "running test's page.\nrequire('@playwright/test').test.beforeEach(async ({ page }) => "
             "{ globalThis.page = page; });\n")
ASYNC_HEAD = re.compile(r"\basync\s+(?:function\b[^{]*?\)\s*|\([^()]*\)\s*=>\s*|[A-Za-z_$][\w$]*\s*=>\s*)(?=\{)")
REGEX_BEFORE = set("(,=:[!&|?{};+-*%<>~^") | {""}


def _skip_quoted(src, i):
    """Index just past the string literal that opens at src[i]."""
    quote, i = src[i], i + 1
    while i < len(src) and src[i] != quote and src[i] != "\n":
        i += 2 if src[i] == "\\" else 1
    return i + 1


def _skip_regex(src, i):
    """Index just past the regular expression literal that opens at src[i] (flags included)."""
    i, in_class = i + 1, False
    while i < len(src) and src[i] != "\n":
        c = src[i]
        if c == "\\":
            i += 2
            continue
        if c == "[":
            in_class = True
        elif c == "]":
            in_class = False
        elif c == "/" and not in_class:
            i += 1
            while i < len(src) and (src[i].isalnum() or src[i] == "_"):
                i += 1
            return i
        i += 1
    return i


def _block_end(src, i):
    """Index of the `}` closing the block or template substitution opened at src[i] (`{`), skipping strings,
    template literals, comments and regular expressions; -1 when it never closes."""
    depth, j, n = 0, i, len(src)
    while j < n:
        c = src[j]
        if c in "'\"":
            j = _skip_quoted(src, j)
            continue
        if c == "`":
            j += 1
            while j < n and src[j] != "`":
                if src[j] == "\\":
                    j += 2
                elif src.startswith("${", j):
                    end = _block_end(src, j + 1)
                    if end < 0:
                        return -1
                    j = end + 1
                else:
                    j += 1
            j += 1
            continue
        if src.startswith("//", j):
            j = src.find("\n", j)
            if j < 0:
                return -1
            continue
        if src.startswith("/*", j):
            j = src.find("*/", j + 2)
            if j < 0:
                return -1
            j += 2
            continue
        if c == "/":
            k = j - 1
            while k >= 0 and src[k] in " \t\r\n":
                k -= 1
            before = src[k] if k >= 0 else ""
            if before in REGEX_BEFORE or re.search(r"\b(?:return|typeof|case|in|of)$", src[max(0, k - 6):k + 1]):
                j = _skip_regex(src, j)
                continue
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return j
        j += 1
    return -1


def _needless_async(src):
    """The source with `async` dropped from every function whose body never awaits: it returns its value itself
    instead of a Promise of it, so a caller that forgot `await` still gets the locator."""
    cuts = []
    for match in ASYNC_HEAD.finditer(src):
        start = match.end()
        end = _block_end(src, start)
        if end < 0:
            continue
        if not re.search(r"\bawait\b", src[start:end]):
            cuts.append(match.start())
    for at in reversed(cuts):
        src = src[:at] + re.sub(r"^async\s+", "", src[at:], count=1)
    return src


def harden(body, check=None):
    """The file with the two slips above made harmless. `check(text) -> bool` says whether a text still parses;
    when the async rewrite does not, the file keeps its own functions (the page shim alone never breaks parsing)."""
    hardened = _needless_async(body)
    if hardened != body and check is not None and not check(hardened):
        hardened = body
    if "globalThis.page = page" not in hardened:
        hardened = hardened.rstrip("\n") + "\n" + PAGE_SHIM
    return hardened


def depths(text):
    """Requirement id -> the length of its longest dependency chain (0 when it depends on nothing), counting what its
    folders depend on. The repair request lists what others depend on first: in ARC's ablation (arXiv 2602.13723,
    Table 6) building requirements in an arbitrary rather than dependency order cost 16-52 points of pass rate."""
    reqs = {r["id"]: r for r in scenarios.load_requirements(text)}
    memo = {}

    def declared(rid):
        found, node = set(), reqs.get(rid)
        while node:
            found.update(d for d in node.get("dependencies") or [] if d in reqs)
            node = reqs.get(node.get("parent"))
        return found

    def depth(rid, trail):
        if rid not in memo:
            memo[rid] = 1 + max((depth(d, trail | {rid}) for d in declared(rid) if d not in trail | {rid}), default=-1)
        return memo[rid]
    return {rid: depth(rid, frozenset()) for rid in reqs}


def name_tests(body, group):
    """The file with every test titled by its bare scenario name given its `<scenario id>: ` prefix: the first scenario
    of that name without a test yet, in listed order. Masked names repeat within a requirement ("REQ-1-3-2 -the
    requested workflow" four times), Playwright refuses a file with two tests of one title, and on 09-28 one such file
    took 13 tests of a Sheet suite with it. Titles that already carry a listed id are left alone."""
    ids = {item["id"] for item in group["items"]}
    used = {_test_id(m.group(2))[0] for m in TITLE.finditer(body)} & ids
    out, last = [], 0
    for m in TITLE.finditer(body):
        title = m.group(2)
        if _test_id(title)[0] in ids:
            continue
        match = next((item for item in group["items"]
                      if item["id"] not in used and item["name"].strip() == title.strip()), None)
        if match is None:
            continue
        used.add(match["id"])
        quote = m.group(1)
        new = f"{match['id']}: {match['name']}".replace("\\", "\\\\").replace(quote, "\\" + quote)
        out.append(body[last:m.start(2)] + new)
        last = m.end(2)
    return "".join(out) + body[last:]


def write_suite(text, suite, complete, prerequisites="", workers=GROUP_WORKERS, audit=None):
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
                body = unfence(found[-1].group(2))
                break
            record["error"] = "the reply had no file block"
        if body is None:
            return record
        path = suite / group["file"]
        node = _node()
        body = name_tests(harden(body, (lambda text: _parses(node, path, text)) if node else None), group)
        path.write_text(body + "\n", encoding="utf-8")
        record.pop("error", None)
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
                "seconds": round(time.monotonic() - started, 1), "prerequisites": prerequisites}
    (suite / "suite.json").write_text(json.dumps(manifest, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    if (AUDIT if audit is None else audit):
        manifest = audit_suite(text, suite, complete, workers=workers)
        manifest["seconds"] = round(time.monotonic() - started, 1)
        (suite / "suite.json").write_text(json.dumps(manifest, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    return manifest


AUDIT_REQUEST = """Review the test file you just wrote against the requirements, without seeing any application.
The existing tests are immutable. Find explicit behaviours that they do NOT establish, especially a state change
used by a later feature, a rejected operation leaving all affected records unchanged, independent records or users,
invalidation after an earlier result changes, a described boundary/input variant, and equivalent interaction paths.
An assertion of a heading or success message alone does not establish the changed data or its persistence.

Add at most {limit} focused tests for the most consequential uncovered behaviours of this file's requirements.
Each test must be justified by a verbatim quote from its ATOMIC requirement description; use only the stated public
behaviour, never infer an evaluator implementation. Exercise real UI state transitions on fresh records the UI
creates. Reuse the existing helpers, following their exact signatures. Assert the effect and what must not change.
Use varied valid inputs where names/values are implementation-independent. Do not mutate shared seed credentials.
Do not duplicate existing coverage, add performance expectations, or require an unspecified control or message.
Each test still has the original timeout: prefer a short discriminating sequence over a long kitchen-sink journey.
For a property that must hold across multiple stated modes or directions, contrast those modes with the same
discriminating data; testing the property in only the easiest mode leaves the other modes unverified.
A named control is not guaranteed on every screen. Follow the navigation the requirement actually describes;
when returning to an entity, reopen it through the documented entry path rather than assuming sibling navigation
on its detail/settings screens. Do not require an absent/disabled control unless the requirement says so: otherwise
perform the attempted operation and check its permitted or rejected effect.

Reply with exactly two file blocks. The first is a JSON array (empty if no defensible gap is found):
=== FILE: coverage.json ===
[{"id":"<requirement id>#audit-1","requirement":"<requirement id>","quote":"<verbatim description excerpt>","gap":"<what the old tests fail to establish>"}]
=== END ===
The second contains ONLY additional test(...) declarations, no imports, helpers, hooks, configuration changes,
test.skip/only/fixme, or edits to existing code. Titles are exactly '<id>: <short description of the behaviour>'.
Number ids uniquely within each requirement. Every added test must have an entry in coverage.json and vice versa.
=== FILE: additions.cjs ===
<additional tests, or empty when the array is empty>
=== END ==="""


def _audit_test_blocks(body):
    """Only standalone test(title, async (...) => {...}) declarations; preserve their bodies exactly."""
    blocks, end = {}, 0
    clean = lambda value: re.sub(r"/\*.*?\*/|//[^\n]*", "", value, flags=re.S).strip()
    for match in TITLE.finditer(body):
        if clean(body[end:match.start()]):
            raise ValueError("audit additions contain code outside test declarations")
        head = re.match(r"\s*,\s*(?:async\s+)?\([^)]*\)\s*=>\s*(\{)", body[match.end():])
        if not head:
            raise ValueError("audit test must have an inline callback")
        close = _block_end(body, match.end() + head.end() - 1)
        tail = re.match(r"\s*\)\s*;?", body[close + 1:]) if close >= 0 else None
        if not tail:
            raise ValueError("audit test declaration is incomplete")
        end = close + 1 + tail.end()
        sid = _test_id(match.group(2))[0]
        if sid in blocks:
            raise ValueError("audit test ids must be unique")
        blocks[sid] = body[match.start():end]
    if clean(body[end:]):
        raise ValueError("audit additions contain trailing non-test code")
    return blocks


def _audit_assertion_helpers(original):
    """Recognize assertions delegated to existing named functions or block-arrow helpers.

    This is a guard against empty checks, not a proof that an assertion follows the requirement.
    The original file stays immutable; only its already-defined helpers are eligible.
    """
    name = r"[A-Za-z_$][\w$]*"
    heads = re.compile(r"\b(?:async\s+)?function\s+(" + name + r")\s*\([^)]*\)\s*(\{)"
                       r"|\b(?:const|let)\s+(" + name + r")\s*=\s*(?:async\s+)?\([^)]*\)\s*=>\s*(\{)")
    bodies = {}
    for match in heads.finditer(original):
        start = match.start(2) if match.group(1) else match.start(4)
        end = _block_end(original, start)
        if end >= 0:
            bodies[match.group(1) or match.group(3)] = original[start + 1:end]
    helpers = set()
    while True:
        found = {name for name, body in bodies.items() if _audit_has_assertion(body, helpers)}
        if found <= helpers:
            return helpers
        helpers.update(found)


def _audit_has_assertion(body, helpers):
    if re.search(r"\bexpect\s*(?:\.\s*(?:soft|poll)\s*)?\(", body):
        return True
    return any(re.search(r"(?<![\w$.])" + re.escape(name) + r"\s*\(", body) for name in helpers)


def _audit_additions(content, group, requirements, original, node, path):
    """Validate provenance and identifiers before appending checks; this does not certify their semantics."""
    blocks = {m.group(1).strip(): m.group(2) for m in FILE_BLOCK.finditer(content or "")}
    if set(blocks) != {"coverage.json", "additions.cjs"}:
        raise ValueError("audit must return coverage.json and additions.cjs")
    claims = json.loads(blocks["coverage.json"])
    if not isinstance(claims, list) or len(claims) > AUDIT_LIMIT:
        raise ValueError("audit coverage must be a bounded list")
    body = unfence(blocks["additions.cjs"]).strip()
    allowed = {item["requirement"] for item in group["items"]}
    normalize = lambda value: re.sub(r"\s+", " ", value).strip()
    ids, grounded, rejected = [], [], []
    for claim in claims:
        if not isinstance(claim, dict) or not all(isinstance(claim.get(k), str) for k in ("id", "requirement", "quote", "gap")):
            raise ValueError("audit claim lacks its id, requirement, quote or gap")
        rid, sid, quote = claim["requirement"], claim["id"], normalize(claim["quote"])
        if rid not in allowed or not re.fullmatch(re.escape(rid) + r"#audit-[1-9]\d*", sid):
            raise ValueError("audit id is not in the file's requirements")
        ids.append(sid)
        if len(quote) < 24 or quote not in normalize(requirements[rid].get("description") or ""):
            rejected.append({"id": sid, "reason": "quote is not a verbatim requirement description excerpt"})
        else:
            grounded.append(claim)
    titles = [m.group(2) for m in TITLE.finditer(body)]
    test_ids = [_test_id(title)[0] for title in titles]
    if len(set(ids)) != len(ids) or sorted(ids) != sorted(test_ids):
        raise ValueError("audit claims and unique test ids do not match")
    if not claims:
        if body:
            raise ValueError("an empty audit must not append code")
        return "", [], []
    if SKIPPING.search(body) or re.search(r"\btest\.(?:before|after|describe|use|setTimeout)|\brequire\s*\(", body):
        raise ValueError("audit additions must not change suite setup or skip tests")
    blocks = _audit_test_blocks(body)
    if not grounded:
        raise ValueError("no audit check has a verbatim requirement description excerpt")
    body = "\n\n".join(blocks[claim["id"]] for claim in grounded)
    helpers = _audit_assertion_helpers(original)
    if any(not _audit_has_assertion(blocks[claim["id"]], helpers) for claim in grounded):
        raise ValueError("every grounded audit check needs an observable assertion")
    if node and not _parses(node, path, original + "\n" + body):
        raise ValueError("audit additions do not parse with the existing file")
    return body, grounded, rejected


def audit_suite(text, suite, complete, workers=GROUP_WORKERS):
    """Append checks for uncovered requirement behaviours. The reviewer sees requirements and tests, never the app.
    Audit failure preserves the original file and is recorded; no existing assertion is rewritten or removed."""
    suite = Path(suite)
    manifest = json.loads((suite / "suite.json").read_text(encoding="utf-8"))
    groups = {g["file"]: g for g in plan(text)}
    requirements = {r["id"]: r for r in scenarios.load_requirements(text)}
    node = _node()

    def one(record):
        name = record["file"]
        if record.get("syntax") or not record.get("tests") or name not in groups or record.get("audit"):
            return
        path = suite / name
        original = path.read_text(encoding="utf-8")
        messages = request(text, groups[name], manifest.get("prerequisites") or "")
        messages += [{"role": "assistant", "content": f"=== FILE: {name} ===\n{original.rstrip()}\n=== END ==="},
                     {"role": "user", "content": AUDIT_REQUEST.replace("{limit}", str(AUDIT_LIMIT))}]
        info = {"claims": [], "calls": 1}
        record["audit"] = info
        try:
            content, _, finish = complete(messages)
            if finish != "stop":
                raise ValueError(f"audit response is incomplete ({finish})")
            addition, claims, rejected = _audit_additions(content, groups[name], requirements, original, node, path)
            if addition:
                path.write_text(original + "\n" + addition + "\n", encoding="utf-8")
                record["tests"] += [m.group(2) for m in TITLE.finditer(addition)]
            info["claims"] = claims
            if rejected:
                info["rejected"] = rejected
        except Exception as exc:
            info["error"] = f"{type(exc).__name__}: {str(exc)[:300]}"

    started = time.monotonic()
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
        list(pool.map(one, manifest["files"]))
    manifest["audit_checks"] = sum(len(r.get("audit", {}).get("claims", [])) for r in manifest["files"])
    manifest["audit_seconds"] = round(time.monotonic() - started, 1)
    manifest["tests"] = sum(len(r.get("tests") or []) for r in manifest["files"])
    (suite / "suite.json").write_text(json.dumps(manifest, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    return manifest


FIX = """Running `{file}` against the application, these tests broke in the test file's own code before the
application was judged:
{problems}

Fix only the test code that broke: a helper that uses a variable it was not given, a missing `await`, a method called
on the wrong object, a Playwright API used the wrong way, a name the requirements never give (use the one they give).
Keep every scenario, step, locator, value and assertion that follows the requirements. Reply with the whole corrected
file and nothing else:
=== FILE: {file} ===
<file content>
=== END ==="""
OWN_BREAK = ("The test's own code threw", "The test used the name", "The test file does not parse")
FIX_SHOWN = 12


SKIPPING = re.compile(r"\btest\.(?:skip|only|fixme)\b|\btest\.describe\.(?:skip|only|fixme)\b")


def faithful(before, after):
    """Whether a rewritten file still measures what the written one did: every test id it had, no new skip, only or
    fixme, and no fewer assertions. A rewrite that drops or weakens tests would turn errors into passes by deleting
    the check, not by mending it."""
    ids = lambda text: {_test_id(m.group(2))[0] for m in TITLE.finditer(text)}
    return (ids(before) <= ids(after) and len(SKIPPING.findall(after)) <= len(SKIPPING.findall(before))
            and after.count("expect(") >= before.count("expect("))


def own_breaks(report):
    """File name -> the tests of the report that broke in the test file's own code (not blocked by a helper finding,
    not skipped): the ones only the test writer can mend."""
    found = collections.defaultdict(list)
    for entry in (report or {}).get("scenarios", []):
        if entry.get("status") == "error" and entry.get("file") and (entry.get("observation") or "").startswith(OWN_BREAK):
            found[entry["file"]].append(entry)
    return dict(found)


def fix_suite(text, suite, report, complete, workers=GROUP_WORKERS):
    """One more writer call for each spec file whose tests broke in their own code on the first run (09-27: 13-19 such
    tests per Sheet application, whole REQ-5 files, never a repair target). The call continues the file's own
    request with the file as the writer's reply and the errors it raised; a reply that does not parse leaves the file
    as it was. Returns the files rewritten."""
    suite = Path(suite)
    try:
        manifest = json.loads((suite / "suite.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []
    broken = own_breaks(report)
    groups = {g["file"]: g for g in plan(text)}
    records = {r["file"]: r for r in manifest.get("files", [])}
    todo = [name for name in broken if name in groups and name in records and (suite / name).is_file()]
    node = _node()

    def one(name):
        path = suite / name
        body = path.read_text(encoding="utf-8", errors="replace")
        lines = body.splitlines()
        problems, seen = [], set()
        for entry in broken[name]:
            first = (entry.get("observation") or "").splitlines()[0]
            where = entry.get("at") or ""
            if (first, where) in seen:
                continue
            seen.add((first, where))
            at = ""
            if where.startswith(name + ":"):
                number = where.rsplit(":", 1)[1]
                if number.isdigit() and 0 < int(number) <= len(lines):
                    at = f"\n  at line {number}: {lines[int(number) - 1].strip()[:200]}"
            problems.append(f"- {entry['id']}: {first[:400]}{at}")
        ask = FIX.format(file=name, problems="\n".join(problems[:FIX_SHOWN]))
        messages = request(text, groups[name], manifest.get("prerequisites") or "")
        messages += [{"role": "assistant", "content": f"=== FILE: {name} ===\n{body.rstrip()}\n=== END ==="},
                     {"role": "user", "content": ask}]
        try:
            content, _, _ = complete(messages)
        except Exception:
            return None
        found = [m for m in FILE_BLOCK.finditer(content or "") if m.group(1).strip() == name]
        if not found:
            return None
        fixed = name_tests(harden(unfence(found[-1].group(2)), (lambda t: _parses(node, path, t)) if node else None),
                           groups[name])
        if node and not _parses(node, path, fixed):
            return None
        titles = [m.group(2) for m in TITLE.finditer(fixed)]
        if not titles or not faithful(body, fixed):
            return None
        path.write_text(fixed + "\n", encoding="utf-8")
        records[name]["tests"] = titles
        records[name].pop("syntax", None)
        records[name]["fixed"] = len(problems)
        return name

    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
        done = [name for name in pool.map(one, todo) if name]
    if done:
        manifest["tests"] = sum(len(r.get("tests") or []) for r in manifest.get("files", []))
        (suite / "suite.json").write_text(json.dumps(manifest, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    return done


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
  reporter: [['json', {{ outputFile: {report} }}], [{progress_reporter}, {{ outputFile: {progress} }}]],
  use: {{ baseURL: {base}, permissions: ['clipboard-read', 'clipboard-write'], actionTimeout: {action_ms},
         navigationTimeout: {navigation_ms}, trace: 'off', video: 'off', screenshot: 'off' }},
}};
"""


# The JSON report is written only when the run ends; a run stopped at RUN_SECONDS left none, and every test read "Not
# run" (09-25 Sheet run dca5df727dcb: a draft that overflowed its stack made each test wait out its timeouts, the suite
# was stopped at 900 s, the written tests fell back to unparsable requirement scenarios, and no repair was made).
# This reporter appends each finished test at once, so a stopped run still reports the tests it finished.
PROGRESS_REPORTER = """const fs = require('fs');
class Progress {
  constructor(options) { this.file = options.outputFile; }
  onTestEnd(test, result) {
    const errors = (result.errors || []).map((e) => ({ message: e.message, stack: e.stack, location: e.location,
                                                       snippet: e.snippet }));
    fs.appendFileSync(this.file, JSON.stringify({ spec: { title: test.title, line: test.location && test.location.line },
                                                  result: { status: result.status, duration: result.duration, errors,
                                                    attachments: result.attachments || [] } }) + '\\n');
  }
  printsToStdio() { return false; }
}
module.exports = Progress;
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
    # A phrase that is all placeholder (`<target worksheet name>`) would match any name; it grounds nothing.
    patterns = [re.compile("^" + ".+".join(re.escape(part) for part in parts) + "$", re.S)
                for parts in (re.split(r"<[^<>]{1,40}>", p) for p in found if "<" in p) if "".join(parts).strip()]
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
    numbered = re.fullmatch(r"(.*\D)\d+", name)
    if numbered and re.search(re.escape(numbered.group(1)) + r"\d", text):
        return False  # the next of a numbered series the requirements name (`Sheet3` after `Sheet1`, `Sheet2`)
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
    if OWN_ERROR.search(first) or OWN_ERROR.match(stack.strip()):
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


def page_snapshot(result, report_path):
    """Bounded Playwright failure context, read only from the current runner's output tree."""
    root = Path(report_path).resolve().parent
    for attachment in result.get("attachments") or []:
        if attachment.get("name") != "error-context" or not attachment.get("path"):
            continue
        path = Path(attachment["path"])
        if not path.is_absolute():
            path = root / path
        try:
            path = path.resolve()
            path.relative_to(root)
            if path.name != "error-context.md" or not path.is_file() or path.stat().st_size > 256000:
                continue
            text = path.read_text(encoding="utf-8", errors="replace")
        except (OSError, ValueError):
            continue
        return text if len(text) <= 2400 else text[:1500] + "\n... page content omitted ...\n" + text[-900:]
    return ""


def parse(report_path, suite, manifest, text, progress_path=None, missing="the runner did not report it"):
    """The Playwright JSON report as scenario-check entries, one per test the manifest lists. Without a report, the
    tests the progress file recorded; a test in neither is an error reading `Not run: <missing>`."""
    suite = Path(suite)
    # One line per phrase: YAML folds long descriptions, and five quoted Sheet messages ("Worksheet name already
    # exists") were broken across lines, so tests asserting them were set aside as using names never given.
    text = re.sub(r"\s+", " ", text or "")
    quoted = _phrases(text)
    try:
        data = json.loads(Path(report_path).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        data = {}
    found = []
    for node in data.get("suites") or []:
        _walk(node, found)
    if not found and progress_path:
        try:
            lines = Path(progress_path).read_text(encoding="utf-8").splitlines()
        except OSError:
            lines = []
        for line in lines:
            try:
                record = json.loads(line)
            except ValueError:
                continue  # the line being written when the run was stopped
            found.append((record.get("spec") or {}, record.get("result") or {}))
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
                why = next((e for e in load_errors if record["file"] in e), None) or missing
                entry.update(status="error", observation="Not run: " + why)
            else:
                spec, result = by_title[title]
                status, observation, location = _classify(result, source_text, text or "", quoted)
                entry.update(status=status, observation=observation,
                             source=_source(path, spec.get("line")) if status == "fail" else "")
                if status == "fail":
                    snapshot = page_snapshot(result, report_path)
                    if snapshot:
                        entry["page_snapshot"] = snapshot
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
                    "file": members[0]["file"], "page_snapshot": members[0].get("page_snapshot", "")})
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
        report_path, progress_path = work / "report.json", work / "progress.jsonl"
        (work / "progress-reporter.cjs").write_text(PROGRESS_REPORTER, encoding="utf-8")

        def configure(broken):
            report_path.unlink(missing_ok=True)
            progress_path.unlink(missing_ok=True)
            (work / "playwright.config.cjs").write_text(CONFIG.format(
                suite=json.dumps(str(suite)), ignore=json.dumps(broken),
                output=json.dumps(str(work / "results")), report=json.dumps(str(report_path)),
                progress_reporter=json.dumps(str(work / "progress-reporter.cjs")), progress=json.dumps(str(progress_path)),
                base=json.dumps(f"http://127.0.0.1:{port}"), test_ms=TEST_SECONDS * 1000,
                action_ms=ACTION_SECONDS * 1000, navigation_ms=10000), encoding="utf-8")

        def read(timed_out):
            return parse(report_path, suite, manifest, text, progress_path,
                         f"the suite was stopped at its {seconds} s limit before this test" if timed_out
                         else "the runner did not report it")

        configure(broken)
        command = [shutil.which("node", path=env.get("PATH")), cli, "test", "--config", str(work / "playwright.config.cjs")]
        if only is not None and titles:
            command += ["--grep", _grep(titles)]
        runner_env = dict(env, NODE_PATH=os.pathsep.join(filter(None, [node_path, env.get("NODE_PATH")])))
        for name in ("PLAYWRIGHT_BROWSERS_PATH",):
            if name in os.environ:
                runner_env[name] = os.environ[name]
        timed_out, run = False, None
        try:
            run = subprocess.run(command, cwd=work, env=runner_env, capture_output=True, text=True, timeout=seconds)
        except subprocess.TimeoutExpired:
            timed_out = True
        entries = read(timed_out)
        if not timed_out and titles and all((e.get("observation") or "").startswith("Not run:") for e in entries):
            # Nothing ran: a file Playwright cannot load (a duplicate title, a throw at module level) stops the whole
            # run although it parses (09-25 23:07 Sheet run: all 100 tests "Not run" in 1.7 s, repairs stopped after
            # one round). Find the files that do not load on their own, set them aside for this suite, run again.
            unloadable = _unloadable(command[:3] + ["--config", str(work / "playwright.config.cjs")], manifest, suite,
                                     work, runner_env)
            if unloadable:
                for record in manifest.get("files", []):
                    if record.get("file") in unloadable:
                        record["syntax"] = "Playwright cannot load it: " + unloadable[record["file"]]
                _save_marks(suite, unloadable)
                broken = ["**/" + r["file"] for r in manifest.get("files", []) if r.get("syntax") and r.get("file")]
                titles = [t for r in manifest.get("files", []) if not r.get("syntax") for t in (r.get("tests") or [])]
                configure(broken)
                try:
                    run = subprocess.run(command, cwd=work, env=runner_env, capture_output=True, text=True,
                                         timeout=seconds)
                except subprocess.TimeoutExpired:
                    timed_out, run = True, None
                entries = read(timed_out)
        report = {"kind": "testgen", "scenarios": entries, "invariants": []}
        if run is not None and all((e.get("observation") or "").startswith("Not run:") for e in entries):
            report["runner"] = ANSI.sub("", (run.stderr or "") + (run.stdout or ""))[-600:]  # why nothing ran
        if timed_out:
            report["timed_out"] = seconds
        counts = collections.Counter(e["status"] for e in report["scenarios"])
        report["coverage"] = {"total": (manifest.get("scenarios") or 0) + manifest.get("audit_checks", 0),
                              "parsed": counts.get("pass", 0) + counts.get("fail", 0)}
        report["seconds"] = round(time.monotonic() - started, 1)
        return report
    finally:
        if backend:
            backend.stop()
        shutil.rmtree(work, ignore_errors=True)


def _unloadable(base, manifest, suite, work, env):
    """{file: why} for the suite files Playwright cannot load on their own (`test --list` on each one)."""
    found = {}
    for record in manifest.get("files", []):
        if record.get("syntax") or not record.get("file"):
            continue
        try:
            probe = subprocess.run(base + ["--list", "--reporter=list", str(Path(suite) / record["file"])], cwd=work,
                                   env=env, capture_output=True, text=True, timeout=120)
        except subprocess.TimeoutExpired:
            continue
        if probe.returncode:
            found[record["file"]] = ANSI.sub("", (probe.stderr or "") + (probe.stdout or "")).strip()[-300:]
    return found


def _save_marks(suite, marks):
    """Record in suite.json which files cannot load, so later runs set them aside without probing again."""
    path = Path(suite) / "suite.json"
    try:
        saved = json.loads(path.read_text(encoding="utf-8"))
        for record in saved.get("files", []):
            if record.get("file") in marks:
                record["syntax"] = "Playwright cannot load it: " + marks[record["file"]]
        path.write_text(json.dumps(saved, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    except (OSError, ValueError):
        pass


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
