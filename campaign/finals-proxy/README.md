# Hidden finals proxy — hackathon-evolution

This workspace contains independent local proxies for ARC-Bench hackathon finals,
not official finals test packs or predictions of the final score. The original
`github` / `sheet` tasks below were authored before publication; the `github-real` /
`sheet-real` tasks use the requirements published on 2026-10-06 and are documented in
[Real finals tasks](#real-finals-tasks--published-2026-10-06-1948). It starts
from the participant's actual GitHub 79/100 and Sheet 87/100 preliminary apps.
The original requirements and their 60 acceptance tests were authored and SHA-256 frozen
before opening either application's source. The reference implementations are
hand-edited positive controls, not the AI agent being measured.

## Design

Each task has 30 atomic requirements, one scenario and one test per requirement:
10 CHANGE requirements cite actual original requirement IDs and extend an
observable original workflow; 20 ADD requirements introduce additional behavior.
The structure and generated accessible-locator sentences follow the organizer's
2026-10-05 Light evolution samples. `helpers.ts` is byte-identical to the official
`arc-bench-evolution--keep/helpers.ts`. Every test step is a direct translation of
the corresponding scenario, with its prose retained as a comment.

GitHub adds issue qualifiers and ordering, comment/file preview, PR draft and diff
controls, stars, topics, archiving, labels, milestones, and discussion management.
It stays inside the original ROOT boundary: no Actions, Packages, Wiki, projects,
notification delivery, live collaboration, or remote Git protocol. Sheet adds
conditional and cross-sheet formulas, named ranges, search and replacement,
worksheet organization, cell notes, and data cleanup. It keeps the original public
single-user model; there are no original sheet accounts or passwords to reuse.

Each scenario owns a distinct EV-suffixed repository or workbook. GitHub uses the
original documented verified accounts with `Valid-password-123!`; it never changes
their passwords. Account-dependent cases use real UI sign-out and sign-in, not
test-injected sessions. Seeds are declared in GIVEN clauses and must be provisioned
by the application. Tests never inject seeds, call private APIs, inspect storage,
or infer internal URLs. Successful mutations are generally checked after reload or
navigation. Permission, negative-control and preservation checks are included.

The baseline therefore measures the unmodified selected app, including its lack
of newly required seed records. A zero baseline does not prove that every new
feature is independently absent; see the per-test first-failure excerpts.

## Run

Prerequisites: Python 3, Docker, and the already installed image
`gyataro/arcbench-runner:local-base`. Both reference apps have no npm dependencies.
No LLM gateway, ARC-Bench key or platform upload is used. A failed npm dependency
install aborts that run; there is no retry or offline fallback loop.

From this directory, or from any clean shell using absolute script paths:

```sh
python3 scripts/freeze.py --verify
python3 run_proxy.py reference/github-app github --list
python3 run_proxy.py reference/sheet-app sheet --list
python3 run_proxy.py reference/github-app github --out results/github-check.json
python3 run_proxy.py reference/sheet-app sheet --out results/sheet-check.json
python3 run_regression.py reference/github-app github --out results/github-regression-check.json
python3 run_regression.py reference/sheet-app sheet --out results/sheet-regression-check.json
```

`run_proxy.py <app_dir> <github|sheet|github-prose|sheet-prose|github-real|sheet-real> [--out report.json]` emits JSON containing
the app hash, freeze-manifest hash, image ID, timings and each test's pass/fail,
Playwright status and error excerpt. Exit status is 0 for all pass, 1 for test
failure and 2 for a runner/infrastructure error. Raw Playwright JSON and process
logs sit beside the normalized report. `--grep` is for diagnosis only; partial
runs never satisfy full-suite acceptance. `--keep-work` retains the scratch app.

`--list` calls `npx playwright test --list` inside the official image. Docker runs
the installed Playwright 1.57.0/Chromium package. The proxy settings match the
organizer: one worker, fullyParallel false, 10-second test and expect timeouts,
no retry, trace off, baseURL `http://127.0.0.1:3000`, one app instance for the entire
suite and a fresh browser context per test. The source app is copied before build;
there is no server state reset between tests. Separate invocations start fresh
scratch copies. Test files run in their numbered file order.

The second Sheet acceptance run also used `/usr/bin/python3` from `/` through a
non-login shell, with absolute script, application and output paths. The runners
do not depend on the current working directory or a project virtual environment.

`run_regression.py` imports the existing read-only
`volo-factory/oneshot/testgen.py` and calls `testgen.run_suite(app, suite, original_requirements)`.
It runs `v6-fixed-independent` for GitHub and both `g99` and `cov99n-arm` for Sheet.
The original regression configuration remains unchanged (15-second tests,
5-second actions/assertions); it is deliberately distinct from the proxy runner.
All scratch files and writable suite copies are inside this directory. Source
evidence and volo-factory are never edited. Regression summaries retain the
harness's pass/fail/error distinction instead of treating test errors as failures.

## Results

All figures below are local measured results. Historical official preliminary
scores are context only. Timings include the units shown. Independent suites
overlapped during authoring, so wall-time differences are not performance gains.

| App | Proxy pass / total | Proxy wall time | Regression pass / fail / error | Regression time |
|---|---:|---:|---|---:|
| Base GitHub | [0 / 30](results/base-github-proxy.json) | 358.041 s | v6-fixed-independent: 107 / 4 / 0 | v6-fixed-independent: 194.3 s |
| Reference GitHub, run 1 | [30 / 30](results/reference-github-proxy-1.json) | 62.742 s | v6-fixed-independent: 107 / 4 / 0 | v6-fixed-independent: 203.3 s |
| Reference GitHub, run 2 | [30 / 30](results/reference-github-proxy-2.json) | 67.309 s | — | — |
| Base Sheet | [0 / 30](results/base-sheet-proxy.json) | 357.401 s | g99: 66 / 9 / 26<br>cov99n-arm: 96 / 4 / 0 | g99: 407.0 s<br>cov99n-arm: 241.6 s |
| Reference Sheet, run 1 | [30 / 30](results/reference-sheet-proxy-1.json) | 95.811 s | g99: 66 / 9 / 26<br>cov99n-arm: 97 / 3 / 0 | g99: 411.6 s<br>cov99n-arm: 246.2 s |
| Reference Sheet, run 2 | [30 / 30](results/reference-sheet-proxy-2.json) | 90.78 s | — | — |

Regression case comparison, github / v6-fixed-independent: 0 previously passing cases lost.

Regression case comparison, sheet / g99: 0 previously passing cases lost.

Regression case comparison, sheet / cov99n-arm: 0 previously passing cases lost.

## Requirement inventory

Difficulty describes interaction/state complexity, not a measured agent difficulty.
Easy is a single operation or visibility rule; medium combines state changes and
persistence; hard crosses resources, accounts, or dependent calculations.

### GitHub

| ID | Type | Original ID | Behavior | Difficulty |
|---|---|---|---|---|
| EV-1.1 | CHANGE | REQ-5-1-1 | Filter issues with combined qualifiers | medium |
| EV-1.2 | CHANGE | REQ-5-1-1 | Sort the filtered issue list | easy |
| EV-1.3 | CHANGE | REQ-6-2-1 | Filter draft pull requests by author | medium |
| EV-1.4 | CHANGE | REQ-5-4 | Close an issue as not planned | medium |
| EV-1.5 | CHANGE | REQ-5-2-3 | Preview a Markdown issue comment | medium |
| EV-1.6 | CHANGE | REQ-4-4 | Preview a Markdown file before committing | medium |
| EV-1.7 | CHANGE | REQ-6-2-4 | Convert an open pull request to draft | medium |
| EV-1.8 | CHANGE | REQ-6-3-2 | Switch the pull request diff layout | easy |
| EV-1.9 | CHANGE | REQ-5-3-2 | Search labels before applying one | easy |
| EV-1.10 | CHANGE | REQ-6-2-2 | Swap comparison branches | medium |
| EV-2.1 | ADD | — | Star and unstar a repository | easy |
| EV-2.2 | ADD | — | Keep stars specific to each account | hard |
| EV-2.3 | ADD | — | Edit repository topics | medium |
| EV-2.4 | ADD | — | Restrict topic editing to administrators | easy |
| EV-2.5 | ADD | — | Archive a repository | hard |
| EV-2.6 | ADD | — | Read an archived repository as a visitor | easy |
| EV-2.7 | ADD | — | Create a repository label | hard |
| EV-2.8 | ADD | — | Rename an applied repository label | hard |
| EV-2.9 | ADD | — | Create a milestone with a due date | hard |
| EV-2.10 | ADD | — | Close and reopen a milestone | easy |
| EV-3.1 | ADD | — | Lock an issue conversation | hard |
| EV-3.2 | ADD | — | Deny issue locking to a read user | easy |
| EV-3.3 | ADD | — | Pin an issue to the repository list | medium |
| EV-3.4 | ADD | — | Unpin an issue without deleting it | medium |
| EV-3.5 | ADD | — | Toggle a thumbs-up reaction | easy |
| EV-3.6 | ADD | — | Create and use a saved reply | hard |
| EV-3.7 | ADD | — | Edit an authored issue comment | medium |
| EV-3.8 | ADD | — | Confirm deletion of an authored comment | medium |
| EV-3.9 | ADD | — | Complete an issue task-list item | medium |
| EV-3.10 | ADD | — | Resolve and reopen a review thread | medium |

### Sheet

| ID | Type | Original ID | Behavior | Difficulty |
|---|---|---|---|---|
| EV-1.1 | CHANGE | REQ-4-1-1 | Calculate IF with a comparison | medium |
| EV-1.2 | CHANGE | REQ-4-1-1 | Count matching values with COUNTIF | medium |
| EV-1.3 | CHANGE | REQ-4-1-1 | Sum matching rows with SUMIF | medium |
| EV-1.4 | CHANGE | REQ-4-2-2 | Recover from formula errors with IFERROR | medium |
| EV-1.5 | CHANGE | REQ-4-2-1 | Recalculate cross-worksheet references | hard |
| EV-1.6 | CHANGE | REQ-5-1-1 | Sort by a secondary column | medium |
| EV-1.7 | CHANGE | REQ-5-2-1 | Allow invalid input with a validation warning | medium |
| EV-1.8 | CHANGE | REQ-3-2-1 | Paste only calculated values | medium |
| EV-1.9 | CHANGE | REQ-3-2-2 | Undo and redo a worksheet rename | easy |
| EV-1.10 | CHANGE | REQ-4-1-1 | Concatenate cell text in a formula | medium |
| EV-2.1 | ADD | — | Create a named range for formulas | medium |
| EV-2.2 | ADD | — | Rename a named range and its references | hard |
| EV-2.3 | ADD | — | Delete a named range without deleting data | medium |
| EV-2.4 | ADD | — | Find case-sensitive text | easy |
| EV-2.5 | ADD | — | Replace all text on the active worksheet | medium |
| EV-2.6 | ADD | — | Replace text inside formulas | medium |
| EV-2.7 | ADD | — | Duplicate a worksheet independently | hard |
| EV-2.8 | ADD | — | Hide a worksheet without losing its data | medium |
| EV-2.9 | ADD | — | Show a hidden worksheet | easy |
| EV-2.10 | ADD | — | Move a worksheet left | easy |
| EV-3.1 | ADD | — | Attach a note to a cell | easy |
| EV-3.2 | ADD | — | Edit then remove a cell note | medium |
| EV-3.3 | ADD | — | Trim whitespace only in the selection | medium |
| EV-3.4 | ADD | — | Split a selected column by a delimiter | medium |
| EV-3.5 | ADD | — | Remove duplicate records from a range | medium |
| EV-3.6 | ADD | — | Freeze the top worksheet row | medium |
| EV-3.7 | ADD | — | Hide a column without deleting its values | medium |
| EV-3.8 | ADD | — | Show a hidden column | easy |
| EV-3.9 | ADD | — | Toggle display of formula expressions | easy |
| EV-3.10 | ADD | — | Make an independent workbook copy | hard |

## Prose-style variants

`github-prose` and `sheet-prose` isolate requirement-writing style as the changed
input for a future agent evaluation. They describe the same evolution as `github`
and `sheet`, using the preliminary hackathon's longer descriptive paragraphs,
curly quotes for UI wording, backticks for literal values, and natural
GIVEN/WHEN/THEN paragraphs. Generated locator lists and the Light “Benchmark
interaction contract” paragraph are removed. The same ROOT/FOLDER/ATOMIC tree,
30 atomic IDs, names, change types, original IDs, dependencies, seed facts,
scenario names, action order and expected outcomes are retained for each task.
Consecutive operations are combined into prose; initial seed/account facts are
collected in GIVEN without changing any account or record.

These original variants are four selectable task names sharing **60 distinct tests**.
The two real tasks below add another 60 distinct scenario tests. Each prose
`tests` directory is a relative symlink to its canonical original directory.
The runner resolves the original directory explicitly, so it executes the same
physical spec files and the byte-identical official helper, in the same order.
No prose-specific assertions or reference-app changes were introduced.

Each prose `FROZEN.json` was created before its first validation run. It records
the new requirement hash, hashes for all shared tests, the canonical manifest
hash and the original requirement hash. Verification checks the symlink target
as well as the bytes. Reports identify the prose requirement separately from
`test_task`, `test_files_sha256` and `test_suite_sha256`; changing either the
requirement or the shared tests invalidates the relevant freeze.

```sh
python3 scripts/freeze.py --verify
python3 scripts/check_prose_coverage.py
python3 run_proxy.py reference/github-app github-prose --out results/reference-github-prose-proxy.json
python3 run_proxy.py reference/sheet-app sheet-prose --out results/reference-sheet-prose-proxy.json
python3 scripts/verify_prose_equivalence.py
```

The coverage checker uses the official image's installed PyYAML with Docker
networking disabled; it requires no host package installation. The two runners
continue to work from a clean shell with absolute paths. Original regressions
still use `run_regression.py ... github` or `sheet`, since their inputs and the
reference applications have not changed.

### Results and baseline equivalence

| Variant | Base proxy | Reference proxy, new execution | Reference wall time |
|---|---:|---:|---:|
| github-prose | [0/30, reused](results/base-github-proxy.json) | [30/30](results/reference-github-prose-proxy.json) | 67.595 s |
| sheet-prose | [0/30, reused](results/base-sheet-proxy.json) | [30/30](results/reference-sheet-prose-proxy.json) | 94.502 s |

The base applications were **not rerun** for this style-only variant. Their
completed 0/30 results are reused by hash equivalence: the live base-source hash
matches the recorded run, all test and helper hashes match, and the immutable
image, test directory, test title order and execution settings are unchanged.
Requirement text is provenance during evaluation; neither Playwright nor the
application consumes it as an execution input. The two reference results above
are fresh runs under the prose task names, each using the unchanged application
hash from the original acceptance runs. The checks and exact hashes are in
[prose-equivalence.json](results/prose-equivalence.json).

### Side-by-side requirement example

This is the complete description and scenario for Sheet `EV-3.8`, “Show a hidden
column”. Both versions have type `ATOMIC`, change type `ADD`, dependency
`EV-3.7`, and no `original_requirement_id`.

| Part | Light requirement | Prose requirement |
|---|---|---|
| Description | Show column &lt;letter&gt; restores a hidden column in its original position, preserving values and formulas. Restoration persists.<br><br>The current page contains one link or button named "Show EV-3.8" when this action is available. The current page exposes "Worksheet grid" as a grid. The current page exposes "Show column B" as a button. A visible grid named "Worksheet grid" contains the controls and content within it in the scenario. The grid named "Worksheet grid" exposes "B" as a columnheader. The grid named "Worksheet grid" exposes "B1" as a gridcell. The grid named "Worksheet grid" exposes "C1" as a gridcell. | “Show column &lt;letter&gt;” restores a hidden column at its original position in the worksheet. Its column header and grid cells become visible again, with their saved values unchanged. Formulas that refer to those cells continue to show the correct result before and after restoration. Refreshing preserves the restored column and its contents.<br><br>The user opens the seeded workbook through its workbook-name entry on the home page. Its active worksheet is displayed by the ARIA grid “Worksheet grid”, with coordinate-named gridcells and selection represented by aria-selected. Worksheet tabs retain their tab role and selected state; row and column headers retain their corresponding header roles. Menu commands use menuitem semantics unless a different role is stated. The visible controls used for this workflow are unique within the page or the stated dialog or region. Navigation entries may be links or buttons unless a particular role is stated, while form submissions use buttons and inputs have the visible labels shown below. The named sections, dialogs, articles and lists use their corresponding accessible roles; list items show the complete stated text in reading order. A control described as absent is not present. |
| Scenario | **GIVEN** The user opens the application home entry in a fresh browser context, signed out.<br><br>**GIVEN** The public workbook "Show EV-3.8" exists independently of every other scenario. Unless stated otherwise, it has only Sheet1, active with A1 selected, at least 100 rows and 26 columns, and all unspecified cells blank; there are no filters, validation rules, notes or named ranges. A1=2,B1=8,C1 has formula =A1+B1; column B is hidden.<br><br>**WHEN** The user activates "Show EV-3.8" in the current page.<br><br>**THEN** The grid named "Worksheet grid" is visible exactly once in the current page.<br><br>**WHEN** The user clicks the button named "Show column B" in the current page.<br><br>**THEN** The columnheader named "B" is visible exactly once in the grid named "Worksheet grid".<br><br>**THEN** The gridcell named "B1" in the grid named "Worksheet grid" has exact text "8".<br><br>**THEN** The gridcell named "C1" in the grid named "Worksheet grid" has exact text "10".<br><br>**WHEN** The user reloads the current page.<br><br>**THEN** The gridcell named "B1" in the grid named "Worksheet grid" has exact text "8". | **GIVEN** The visitor starts at the application home page in a fresh, unauthenticated browser session. The evaluation seed contains the public workbook `Show EV-3.8`, separate from the workbooks used in the other scenarios. Unless stated otherwise, it has only Sheet1, active with A1 selected, at least 100 rows and 26 columns, and all unspecified cells blank; there are no filters, validation rules, notes or named ranges. A1=2,B1=8,C1 has formula =A1+B1; column B is hidden.<br><br>**WHEN** The user opens “Show EV-3.8”.<br><br>**THEN** The “Worksheet grid” grid appears once and is visible.<br><br>**WHEN** The user clicks the “Show column B” button.<br><br>**THEN** The “B” columnheader appears once and is visible in the “Worksheet grid” grid. Cell `B1` in the “Worksheet grid” grid displays exactly `8`. Cell `C1` in the “Worksheet grid” grid displays exactly `10`.<br><br>**WHEN** The user refreshes the current page.<br><br>**THEN** Cell `B1` in the “Worksheet grid” grid displays exactly `8`. |

### Every-test name coverage

The checker extracts literal names from executable calls to the frozen helpers,
not from test comments or the prose author's name list. Each name must occur as
an exact quoted/code literal in **that atomic requirement's description or
scenario**, not merely in ROOT, a title, another requirement or a substring of
a longer name. Regions, dialogs, grids, articles, forms and lists must also state
the corresponding container role near the name. Input values, selected options,
expected text/value assertions and key operands are checked too. Metadata and
the scenario translation are checked against the unchanged source requirements.

“Names” counts distinct kind/name pairs per test; the final column lists each
literal once for readability. “Containers” is the subset needing a stated
container role. Full evidence excerpts, spec hashes and operand checks are in
[prose-name-coverage.json](results/prose-name-coverage.json). This is a lexical
coverage check and a preservation check on the scenario translation, not a
formal proof that arbitrary natural-language interpretations are identical.

| Task | Test | Names found / used | Containers found / used | Names and exact-text locators checked |
|---|---|---:|---:|---|
| github-prose | EV-1.1 | 8/8 | 2/2 | `Issue titles`, `Issues`, `Open EV-1.1`, `Search`, `Search issues`, `evolution-EV-1.1`, `repo-admin/evolution-EV-1.1` |
| github-prose | EV-1.2 | 9/9 | 2/2 | `Issue sort`, `Issue titles`, `Issues`, `Newest`, `Oldest`, `Search`, `evolution-EV-1.2`, `repo-admin/evolution-EV-1.2` |
| github-prose | EV-1.3 | 7/7 | 2/2 | `Pull request titles`, `Pull requests`, `Search`, `Search pull requests`, `evolution-EV-1.3`, `repo-admin/evolution-EV-1.3` |
| github-prose | EV-1.4 | 20/20 | 1/1 | `Account menu`, `Close issue`, `Close reason`, `Closed as not planned`, `Declined EV-1.4`, `Issue`, `Issues`, `Keep this description.`, `Not planned`, `Open`, `Password`, `Reopen issue`, `Search`, `Sign in`, `Username or email`, `evolution-EV-1.4`, `repo-admin/evolution-EV-1.4` |
| github-prose | EV-1.5 | 20/20 | 3/3 | `Account menu`, `Comment`, `Comment preview`, `Discussion`, `Issue`, `Issues`, `Password`, `Preview`, `Preview EV-1.5`, `Reviewed`, `Reviewed carefully.`, `Search`, `Sign in`, `Username or email`, `Write`, `evolution-EV-1.5`, `repo-admin/evolution-EV-1.5` |
| github-prose | EV-1.6 | 19/19 | 1/1 | `Account menu`, `Add file`, `Commit changes`, `Commit message`, `Create new file`, `Edit file`, `File contents`, `File name`, `File preview`, `Guide EV-1.6`, `Password`, `Preview file`, `Search`, `Sign in`, `Username or email`, `docs/guide.md`, `evolution-EV-1.6`, `repo-admin/evolution-EV-1.6` |
| github-prose | EV-1.7 | 17/17 | 2/2 | `Account menu`, `Convert to draft`, `Draft`, `Draft conversion EV-1.7`, `Merge pull request`, `Password`, `Pull request`, `Pull requests`, `Search`, `Sign in`, `Username or email`, `Work in progress.`, `evolution-EV-1.7`, `repo-admin/evolution-EV-1.7` |
| github-prose | EV-1.8 | 17/17 | 3/3 | `+hello after`, `-hello before`, `After`, `Before`, `Diff layout`, `Files changed`, `Layout EV-1.8`, `Pull requests`, `Search`, `Split`, `Unified`, `Unified diff`, `evolution-EV-1.8`, `hello after`, `hello before`, `repo-admin/evolution-EV-1.8` |
| github-prose | EV-1.9 | 17/17 | 1/1 | `Account menu`, `Filter labels`, `Issue`, `Issues`, `Label search EV-1.9`, `Labels`, `Password`, `Search`, `Sign in`, `Username or email`, `bug`, `documentation`, `evolution-EV-1.9`, `repo-admin/evolution-EV-1.9` |
| github-prose | EV-1.10 | 18/18 | 1/1 | `Account menu`, `Base`, `Compare`, `Compare changes`, `Comparison summary`, `New pull request`, `Password`, `Pull requests`, `Search`, `Sign in`, `Swap branches`, `Username or email`, `base: feature-ev-1.10; compare: main`, `evolution-EV-1.10`, `feature-ev-1.10`, `main`, `repo-admin/evolution-EV-1.10` |
| github-prose | EV-2.1 | 13/13 | 1/1 | `0 stars`, `1 star`, `Account menu`, `Password`, `Repository social`, `Search`, `Sign in`, `Star`, `Unstar`, `Username or email`, `evolution-EV-2.1`, `repo-admin/evolution-EV-2.1` |
| github-prose | EV-2.2 | 16/16 | 2/2 | `1 star`, `Account menu`, `Confirm sign out`, `Password`, `Repository social`, `Search`, `Sign in`, `Sign out`, `Star`, `Unstar`, `Username or email`, `evolution-EV-2.2`, `repo-admin/evolution-EV-2.2` |
| github-prose | EV-2.3 | 14/14 | 3/3 | `About`, `Account menu`, `Edit topics`, `Password`, `Save`, `Search`, `Sign in`, `Topics`, `Username or email`, `evolution-EV-2.3`, `repo-admin/evolution-EV-2.3` |
| github-prose | EV-2.4 | 11/11 | 2/2 | `About`, `Account menu`, `Edit topics`, `Password`, `Search`, `Sign in`, `Topics`, `Username or email`, `evolution-EV-2.4`, `repo-admin/evolution-EV-2.4` |
| github-prose | EV-2.5 | 20/20 | 2/2 | `Account menu`, `Archive`, `Archive repository`, `Archived`, `General`, `Issues`, `New issue`, `Password`, `Preserved EV-2.5`, `Repository name`, `Repository status`, `Search`, `Settings`, `Sign in`, `Username or email`, `evolution-EV-2.5`, `repo-admin/evolution-EV-2.5` |
| github-prose | EV-2.6 | 11/11 | 2/2 | `Archived`, `Close issue`, `Historical discussion.`, `Issue`, `Issues`, `Read only EV-2.6`, `Repository status`, `Search`, `evolution-EV-2.6`, `repo-admin/evolution-EV-2.6` |
| github-prose | EV-2.7 | 23/23 | 3/3 | `Account menu`, `Apply EV-2.7`, `Color`, `Create label`, `Description`, `Issue`, `Issues`, `Label name`, `Labels`, `New label`, `Password`, `Search`, `Ship this first.`, `Sign in`, `Username or email`, `evolution-EV-2.7`, `priority-ev-2.7`, `repo-admin/evolution-EV-2.7` |
| github-prose | EV-2.8 | 20/20 | 4/4 | `Account menu`, `Description`, `Edit`, `Edit label`, `Issue`, `Issues`, `Label name`, `Labels`, `Linked EV-2.8`, `Password`, `Save`, `Search`, `Sign in`, `Username or email`, `evolution-EV-2.8`, `old-ev-2.8`, `renamed-ev-2.8`, `repo-admin/evolution-EV-2.8` |
| github-prose | EV-2.9 | 23/23 | 3/3 | `2030-10-31`, `Account menu`, `Create milestone`, `Description`, `Due date`, `Issue`, `Issues`, `Milestone`, `Milestones`, `New milestone`, `Password`, `Release EV-2.9`, `Schedule EV-2.9`, `Search`, `Sign in`, `Title`, `Username or email`, `evolution-EV-2.9`, `repo-admin/evolution-EV-2.9` |
| github-prose | EV-2.10 | 16/16 | 1/1 | `Account menu`, `Close milestone`, `Closed`, `Cycle EV-2.10`, `Issues`, `Milestones`, `Open`, `Password`, `Preserve scope`, `Reopen milestone`, `Search`, `Sign in`, `Username or email`, `evolution-EV-2.10`, `repo-admin/evolution-EV-2.10` |
| github-prose | EV-3.1 | 24/24 | 3/3 | `Account menu`, `Comment`, `Confirm sign out`, `Issue`, `Issues`, `Lock`, `Lock EV-3.1`, `Lock conversation`, `Lock reason`, `Locked: Off-topic`, `Off-topic`, `Password`, `Retain context.`, `Search`, `Sign in`, `Sign out`, `Username or email`, `evolution-EV-3.1`, `repo-admin/evolution-EV-3.1` |
| github-prose | EV-3.2 | 15/15 | 1/1 | `Account menu`, `Issue`, `Issues`, `Lock conversation`, `Lock permission EV-3.2`, `Password`, `Readable content.`, `Search`, `Sign in`, `Unlock conversation`, `Username or email`, `evolution-EV-3.2`, `repo-admin/evolution-EV-3.2` |
| github-prose | EV-3.3 | 15/15 | 3/3 | `Account menu`, `Issue`, `Issues`, `Password`, `Pin issue`, `Pinned EV-3.3`, `Pinned issue titles`, `Pinned issues`, `Search`, `Sign in`, `Username or email`, `evolution-EV-3.3`, `repo-admin/evolution-EV-3.3` |
| github-prose | EV-3.4 | 18/18 | 4/4 | `Account menu`, `Issue`, `Issues`, `Password`, `Pin issue`, `Pinned issue titles`, `Pinned issues`, `Search`, `Sign in`, `Unpin EV-3.4`, `Unpin issue`, `Username or email`, `evolution-EV-3.4`, `repo-admin/evolution-EV-3.4` |
| github-prose | EV-3.5 | 16/16 | 2/2 | `0 reactions`, `1 reaction`, `Account menu`, `Issue`, `Issues`, `Password`, `React EV-3.5`, `Reaction count`, `Search`, `Sign in`, `Thumbs up`, `Username or email`, `evolution-EV-3.5`, `repo-admin/evolution-EV-3.5` |
| github-prose | EV-3.6 | 24/24 | 3/3 | `Account menu`, `Comment`, `Discussion`, `Insert saved reply`, `Issue`, `Issues`, `New saved reply`, `Password`, `Reply EV-3.6`, `Reply body`, `Reply title`, `Save`, `Saved replies`, `Saved reply`, `Search`, `Sign in`, `Thanks EV-3.6`, `Thanks for the reproducible example.`, `Username or email`, `evolution-EV-3.6`, `repo-admin/evolution-EV-3.6` |
| github-prose | EV-3.7 | 18/18 | 2/2 | `Account menu`, `Comment body`, `Comment by issue-commenter`, `Edit comment`, `Edit comment EV-3.7`, `Edited`, `Issues`, `Password`, `Revised comment EV-3.7`, `Save comment`, `Search`, `Sign in`, `Username or email`, `evolution-EV-3.7`, `repo-admin/evolution-EV-3.7` |
| github-prose | EV-3.8 | 20/20 | 4/4 | `Account menu`, `Cancel`, `Comment by issue-commenter`, `Delete`, `Delete comment`, `Delete comment EV-3.8`, `Discussion`, `Disposable EV-3.8`, `Issue`, `Issues`, `Keep the issue body.`, `Password`, `Search`, `Sign in`, `Username or email`, `evolution-EV-3.8`, `repo-admin/evolution-EV-3.8` |
| github-prose | EV-3.9 | 17/17 | 1/1 | `1 of 2 tasks complete`, `Account menu`, `Add tests`, `Checklist EV-3.9`, `Edit issue description`, `Issue`, `Issue description`, `Issues`, `Password`, `Search`, `Sign in`, `Update docs`, `Username or email`, `evolution-EV-3.9`, `repo-admin/evolution-EV-3.9` |
| github-prose | EV-3.10 | 17/17 | 1/1 | `Account menu`, `Files changed`, `Handle the empty case.`, `Password`, `Pull requests`, `Resolve EV-3.10`, `Resolve conversation`, `Resolved`, `Search`, `Sign in`, `Thread EV-3.10`, `Unresolve conversation`, `Username or email`, `evolution-EV-3.10`, `repo-admin/evolution-EV-3.10` |
| sheet-prose | EV-1.1 | 5/5 | 1/1 | `A1`, `B1`, `Calculate EV-1.1`, `Formula bar`, `Worksheet grid` |
| sheet-prose | EV-1.2 | 5/5 | 1/1 | `A2`, `B1`, `Count EV-1.2`, `Formula bar`, `Worksheet grid` |
| sheet-prose | EV-1.3 | 5/5 | 1/1 | `B2`, `C1`, `Formula bar`, `Sum EV-1.3`, `Worksheet grid` |
| sheet-prose | EV-1.4 | 6/6 | 1/1 | `A1`, `B1`, `C1`, `Formula bar`, `Recover EV-1.4`, `Worksheet grid` |
| sheet-prose | EV-1.5 | 7/7 | 1/1 | `A1`, `B1`, `Formula bar`, `Rates`, `Recalculate EV-1.5`, `Sheet1`, `Worksheet grid` |
| sheet-prose | EV-1.6 | 22/22 | 2/2 | `A1`, `A2`, `A4`, `Ascending`, `B2`, `B3`, `B4`, `D1`, `Data`, `Data has header row`, `Descending`, `Order`, `Score`, `Sort`, `Sort EV-1.6`, `Sort by`, `Sort range`, `Team`, `Then by`, `Then order`, `Worksheet grid` |
| sheet-prose | EV-1.7 | 15/15 | 2/2 | `A1`, `Allow EV-1.7`, `Data`, `Data validation`, `Formula bar`, `Maximum`, `Minimum`, `Number range`, `On invalid data`, `Rule type`, `Save`, `Show warning`, `Validation warning`, `Worksheet grid` |
| sheet-prose | EV-1.8 | 7/7 | 1/1 | `A1`, `B1`, `D1`, `Formula bar`, `Paste EV-1.8`, `Paste values only`, `Worksheet grid` |
| sheet-prose | EV-1.9 | 12/12 | 2/2 | `A1`, `Redo`, `Rename`, `Rename worksheet`, `Renamed EV-1.9`, `Save`, `Sheet1`, `Undo`, `Undo EV-1.9`, `Worksheet grid`, `Worksheet name`, `Worksheet options for Sheet1` |
| sheet-prose | EV-1.10 | 5/5 | 1/1 | `B1`, `C1`, `Concatenate EV-1.10`, `Formula bar`, `Worksheet grid` |
| sheet-prose | EV-2.1 | 12/12 | 3/3 | `Add named range`, `B1`, `Create EV-2.1`, `Data`, `Formula bar`, `Name`, `Named range`, `Named ranges`, `Range`, `Save`, `Worksheet grid` |
| sheet-prose | EV-2.2 | 11/11 | 3/3 | `B1`, `Data`, `Edit`, `Formula bar`, `Name`, `Named range`, `Named ranges`, `Rename EV-2.2`, `Revenue`, `Save`, `Worksheet grid` |
| sheet-prose | EV-2.3 | 11/11 | 3/3 | `A1`, `A2`, `B1`, `Data`, `Delete`, `Delete EV-2.3`, `Delete named range`, `Formula bar`, `Named ranges`, `Revenue`, `Worksheet grid` |
| sheet-prose | EV-2.4 | 11/11 | 2/2 | `A1`, `B2`, `Close`, `Find`, `Find EV-2.4`, `Find and replace`, `Find next`, `Match B2`, `Match case`, `Worksheet grid` |
| sheet-prose | EV-2.5 | 13/13 | 2/2 | `2 replacements`, `A1`, `A2`, `Close`, `Find`, `Find and replace`, `Other`, `Replace EV-2.5`, `Replace all`, `Replace with`, `Sheet1`, `Worksheet grid` |
| sheet-prose | EV-2.6 | 13/13 | 2/2 | `2 replacements`, `B1`, `B2`, `Close`, `Find`, `Find and replace`, `Formula bar`, `Replace EV-2.6`, `Replace all`, `Replace with`, `Search in formulas`, `Worksheet grid` |
| sheet-prose | EV-2.7 | 13/13 | 2/2 | `A1`, `B1`, `Copy of Sheet1`, `Data`, `Data validation`, `Duplicate`, `Duplicate EV-2.7`, `Formula bar`, `Maximum`, `Sheet1`, `Worksheet grid`, `Worksheet options for Sheet1` |
| sheet-prose | EV-2.8 | 10/10 | 2/2 | `A1`, `Archive`, `Hidden sheets`, `Hide`, `Hide EV-2.8`, `Sheet1`, `Show Archive`, `Worksheet grid`, `Worksheet options for Archive` |
| sheet-prose | EV-2.9 | 7/7 | 2/2 | `A1`, `Archive`, `Hidden sheets`, `Show Archive`, `Show EV-2.9`, `Worksheet grid` |
| sheet-prose | EV-2.10 | 7/7 | 2/2 | `A1`, `Move EV-2.10`, `Move left`, `Third`, `Worksheet grid`, `Worksheet options for Third`, `Worksheet order` |
| sheet-prose | EV-3.1 | 9/9 | 2/2 | `A1`, `Attach EV-3.1`, `Cell note`, `Close`, `Insert note`, `Note`, `Save`, `Show note for A1`, `Worksheet grid` |
| sheet-prose | EV-3.2 | 8/8 | 2/2 | `A1`, `Cell note`, `Delete note`, `Edit EV-3.2`, `Note`, `Save`, `Show note for A1`, `Worksheet grid` |
| sheet-prose | EV-3.3 | 10/10 | 1/1 | `A1`, `A2`, `B1`, `Data`, `Formula bar`, `Redo`, `Trim EV-3.3`, `Trim whitespace`, `Undo`, `Worksheet grid` |
| sheet-prose | EV-3.4 | 15/15 | 2/2 | `A1`, `A2`, `B1`, `B2`, `C1`, `C2`, `Comma`, `D1`, `Data`, `Separator`, `Split`, `Split EV-3.4`, `Split text to columns`, `Worksheet grid` |
| sheet-prose | EV-3.5 | 14/14 | 2/2 | `1 duplicate removed`, `A1`, `A2`, `A3`, `A4`, `B4`, `D4`, `Data`, `Data has header row`, `Remove EV-3.5`, `Remove duplicates`, `Worksheet grid` |
| sheet-prose | EV-3.6 | 12/12 | 3/3 | `0 rows frozen`, `1 row frozen`, `Freeze EV-3.6`, `Freeze rows`, `Frozen rows`, `Other`, `Rows to freeze`, `Save`, `Sheet1`, `View`, `Worksheet grid` |
| sheet-prose | EV-3.7 | 7/7 | 1/1 | `B`, `B1`, `C1`, `Hide EV-3.7`, `Hide column`, `Show column B`, `Worksheet grid` |
| sheet-prose | EV-3.8 | 6/6 | 1/1 | `B`, `B1`, `C1`, `Show EV-3.8`, `Show column B`, `Worksheet grid` |
| sheet-prose | EV-3.9 | 6/6 | 1/1 | `A1`, `B1`, `Show formulas`, `Toggle EV-3.9`, `View`, `Worksheet grid` |
| sheet-prose | EV-3.10 | 11/11 | 2/2 | `A1`, `B1`, `Copy workbook`, `Create copy`, `Formula bar`, `Independent EV-3.10`, `Make EV-3.10`, `Make a copy`, `Workbook name`, `Worksheet grid` |

github-prose: all 30 tests covered, 503/503 kind/name pairs and 65/65 named containers.

sheet-prose: all 30 tests covered, 295/295 kind/name pairs and 53/53 named containers.

### Prose freeze history

- github-prose v1, 2026-10-06T06:11:51.285583+00:00: Initial prose-style freeze before any prose-variant validation run; canonical tests and application sources unchanged.
- sheet-prose v1, 2026-10-06T06:11:51.309921+00:00: Initial prose-style freeze before any prose-variant validation run; canonical tests and application sources unchanged.

No prose requirements or shared tests were edited after this freeze.

## Freeze and change log

`github/FROZEN.json` and `sheet/FROZEN.json` contain SHA-256 for every requirement
and test file. Version history retains previous hashes. The first freeze occurred
before application source inspection; tests were compiled from requirements only.
Do not regenerate or silently update a manifest to make an implementation pass.
Every post-freeze requirement/test change must be explained here and versioned.

The main results table uses the current frozen versions. Earlier diagnostics are
retained in `results/diagnostic-*`; the original Sheet v1 baseline is preserved.
The interrupted Sheet v2 baseline is explicitly marked as an aborted non-score.
`results/final-audit.json` records the completed acceptance and per-case regression
comparison. No flaky-loss exception was needed.

- github v1, 2026-10-06T04:39:06.701012+00:00: Initial independent freeze before reading either application source.
- sheet v1, 2026-10-06T04:39:06.702390+00:00: Initial independent freeze before reading either application source.
- sheet v2, 2026-10-06T05:02:28.304263+00:00: Correct test gesture semantics: scroll both named cells into view before coordinate-based dragging (EV-1.6, EV-3.3, EV-3.4, EV-3.5). A visible DOM element can be outside the viewport after normal navigation; the original test did not actually perform its declared drag. Strengthen EV-3.3 scenario and test with exact Formula bar values for both trimmed cells and the untouched outside cell, because Playwright text assertions normalize whitespace. No business behavior or seed values changed.
  Changed files: `sheet/requirements/requirements.yaml`, `sheet/tests/06-EV-1.6.spec.ts`, `sheet/tests/23-EV-3.3.spec.ts`, `sheet/tests/24-EV-3.4.spec.ts`, `sheet/tests/25-EV-3.5.spec.ts`.
- sheet v3, 2026-10-06T05:05:26.222348+00:00: Repair the strengthened EV-3.3 scenario: explicitly select A1 before reading its Formula bar after Redo and reload. The prior version accidentally assumed a particular selection-restoration policy, which the requirements do not mandate. This adds the missing user action; expected data and business behavior are unchanged.
  Changed files: `sheet/requirements/requirements.yaml`, `sheet/tests/23-EV-3.3.spec.ts`.

## Limitations and handoff

- The original tasks predate publication of the real finals requirements. They sample
  plausible evolution work and cannot establish official finals coverage or score.
  The separate real tasks below use the now-published requirements.
- Thirty scenarios per task are acceptance examples, not exhaustive verification
  of every input, permission combination, formula grammar or failure mode. For
  example, freeze-row state is checked, but pixel geometry during scrolling is
  not scored. No visual fidelity claim is made.
- The reference is a hand-written positive control on the actual base apps.
  Existing base limitations are retained unless the evolution needs a change;
  passing the inherited regression suites is a preservation check, not proof that
  every original requirement was ever implemented correctly.
- The original data architecture is retained: GitHub uses the shared `/api/state`
  store with browser-local sessions; Sheet saves workbook edits in browser local
  storage. Reload/navigation persistence is checked, but the Sheet proxy does not
  certify edits surviving a completely new browser storage context. These UI
  permission checks are not an audit of the base server's authentication security.
- Some behavior, such as undoing a worksheet rename, was already present in the
  selected base source although not covered by its original requirement text.
  The evolution formalizes that contract rather than requiring it to be rewritten.
- Docker runs the organizer's amd64 image on this Apple Silicon host. Emulation
  affects timings. The runner settings match, but this is not organizer hardware.
- The runner is a trusted local evaluator, not a security sandbox for hostile
  submitted applications. Reports include test excerpts and must remain hidden.
- For later evaluation, expose only the original selected application, original
  requirements, and the task's new `requirements/requirements.yaml` through a
  scoped view. Do not expose this workspace root. Keep
  tests, reports, authoring scripts and reference implementations unavailable to
  the agent and its developers. Nothing here has been uploaded or published.


## Real finals tasks — published 2026-10-06 19:48

The following records the initial v1 acceptance. The later official-report calibration
section records newer versions and supersedes v1 locator assumptions.

Complete. Both real reference apps passed 30/30 on two consecutive full runs;
all three original regression suites retain exactly their baseline results.
`github-real` and `sheet-real` use the organizer's real finals
requirements, copied verbatim with their reference images. The preceding hypothetical
and prose tasks remain unchanged. The real GitHub file contains 52 atomic requirements;
only the five changed and five new requirements (three scenarios each) are scored.
The real Sheet file contains exactly those ten changed/new requirements. There is
no `change_type` field. Tests are authored from requirements before inspecting either
baseline application, then frozen before baseline execution or reference implementation.

| Task | Requirements SHA-256 | Authoring state |
|---|---|---|
| github-real | `f1f73b4190831cef37669f9e919edde50cd0bc7ad02b888e6dab617094921754` | 30 scenario tests authored and frozen before baseline-source inspection |
| sheet-real | `7a2ee0a9d81317bcc3f92fd627effae0c510412b891ab6c79896c4517b139962` | 30 scenario tests authored and frozen before baseline-source inspection |


The organizer injects the selected baseline application into the agent's output
directory; the evaluated agent must evolve it incrementally. These reference apps
are hand-written positive controls, not the measured agent. Expose only the baseline
app and official requirement assets to that agent; keep this workspace, frozen tests,
reports, authoring scripts, and reference implementations hidden. Nothing is uploaded.

### Running the real tasks

```sh
python3 scripts/freeze.py --verify
python3 run_proxy.py reference/github-real-app github-real --list
python3 run_proxy.py reference/sheet-real-app sheet-real --list
python3 run_proxy.py reference/github-real-app github-real --out results/github-real-check.json
python3 run_proxy.py reference/sheet-real-app sheet-real --out results/sheet-real-check.json
python3 run_regression.py reference/github-real-app github --out results/github-real-regression-check.json
python3 run_regression.py reference/sheet-real-app sheet --out results/sheet-real-regression-check.json
python3 scripts/audit_real_tasks.py
```

The real tasks are canonical entries in `TEST_TASKS`, with their own physical test
directories and manifests. Regression task names remain `github` and `sheet`, so the
existing wrapper and original suites are reused unchanged. The same official image,
one-worker shared-app lifecycle, fresh contexts, and 10-second timeout settings apply.
[Source provenance](results/real-source-provenance.json) verifies every copied reference
image as well as both YAML files and the byte-identical 27-line official helper.

### Real-task results (filled as runs finish)

| App | Proxy pass / total | Wall time | Regression pass / fail / error | Regression time |
|---|---:|---:|---|---:|
| Base github-real | [3 / 30](results/base-github-real-proxy.json) | 313.897 s | v6-fixed-independent: 107 / 4 / 0 | v6-fixed-independent: 194.3 s |
| Reference github-real, run 1 | [30 / 30](results/reference-github-real-proxy-1.json) | 64.332 s | v6-fixed-independent: 107 / 4 / 0 | v6-fixed-independent: 211.8 s |
| Reference github-real, run 2 | [30 / 30](results/reference-github-real-proxy-2.json) | 60.033 s | — | — |
| Base sheet-real | [0 / 30](results/base-sheet-real-proxy.json) | 359.098 s | g99: 66 / 9 / 26<br>cov99n-arm: 96 / 4 / 0 | g99: 407.0 s<br>cov99n-arm: 241.6 s |
| Reference sheet-real, run 1 | [30 / 30](results/reference-sheet-real-proxy-1.json) | 73.648 s | g99: 66 / 9 / 26<br>cov99n-arm: 96 / 4 / 0 | g99: 413.7 s<br>cov99n-arm: 252.7 s |
| Reference sheet-real, run 2 | [30 / 30](results/reference-sheet-real-proxy-2.json) | 74.183 s | — | — |

Proxy report links retain every scenario's result, duration, first error, application
hash, image ID, and freeze hash; adjacent `.playwright.json` files retain full raw
Playwright output. Regression baselines reuse the completed original baseline runs
(GitHub 107, Sheet g99 66 / cov99n-arm 96 passing), supplied and verified before this
task. The source paths are identical; the fresh real-proxy baseline hashes are compared
with the earlier baseline proxy hashes in the real-task audit. All reference regression
figures are new executions of the unchanged regression wrapper.

### Real-task final acceptance

[The final audit](results/real-final-audit.json) passes every enumerable acceptance
check: official YAML/reference bytes and helper bytes match, each task contains exactly
30 published scenario tests, all six task manifests verify, both references pass twice
with the same application hash used for their regression runs, and no previously passing
regression case is lost. No flaky-loss exception or test relaxation was used.

The official runner's listings are retained for [GitHub](results/github-real-test-list.txt)
and [Sheet](results/sheet-real-test-list.txt). The second Sheet acceptance run used
absolute paths from `/` in a non-login shell. The four pre-existing freeze manifests
and both pre-existing reference applications are byte-for-byte unchanged by hash.
The completed diagnostic reports are retained; this task's diagnostic scratch app
copies and duplicate stdout captures were removed. No gateway, ARC-Bench credential,
platform submission, or external upload was used.

### Real-task post-freeze changes

No requirements, reference images, helpers, interaction helpers, or spec files were
edited during the initial v1 acceptance. The later calibration section records
subsequent frozen versions. Application fixes
are recorded below and do not alter the frozen contracts.

- github-real v1, 2026-10-06T12:01:18.885071+00:00: Initial independent real-scenario freeze before opening either baseline application source.
- sheet-real v1, 2026-10-06T12:01:19.023293+00:00: Initial independent real-scenario freeze before opening either baseline application source.

### Real-task requirement inventory

Difficulty is an interaction/state-complexity guess, not a measured agent score.


| github ID | Type | Behavior | Difficulty guess |
|---|---|---|---|
| REQ-1-1-1 | changed | Underscores in valid usernames; preserve validation | medium |
| REQ-1-1-2 | changed | Case-insensitive email authentication | easy |
| REQ-1-4 | new | List and revoke browser sessions | hard |
| REQ-2-1-2 | changed | Normalize organization identifiers to lowercase | medium |
| REQ-2-4 | new | Owner-only persisted audit log and action filter | medium |
| REQ-3-1 | changed | Case-insensitive name and description search | easy |
| REQ-3-5 | new | Archive, disable writes, and restore repositories | hard |
| REQ-4-3-1 | changed | Keep selected branch in the address across reload | medium |
| REQ-4-5 | new | Publish and view releases with unique tags | medium |
| REQ-5-5 | new | Add and remove per-account issue reactions | medium |

| sheet ID | Type | Behavior | Difficulty guess |
|---|---|---|---|
| REQ-1-2-2 | changed | Trim workbook names; case-insensitive uniqueness and 80-character limit | medium |
| REQ-2-1-3 | changed | Trim worksheet names; case-insensitive uniqueness and 50-character limit | medium |
| REQ-3-1-1 | changed | Delete selected cells and recalculate dependents | medium |
| REQ-5-1-2 | changed | Save, apply, and delete persistent filter views | hard |
| REQ-5-2-1 | changed | Persist custom validation errors across entry paths | medium |
| REQ-6-1-1 | new | Persist row, column, and combined frozen panes | medium |
| REQ-6-2-1 | new | Find and replace entire displayed cell values | medium |
| REQ-7-1-1 | new | Create and edit named formula ranges | hard |
| REQ-7-2-1 | new | Create, edit, and delete conditional cell fills | hard |
| REQ-8-1-1 | new | Create, edit, and delete persistent cell notes | medium |

### Real-task interpretation boundaries

The fresh unmodified baselines also measure whether the newly declared EVO records
exist. Most initial failures can therefore occur at account/workbook discovery before
the changed interaction is reached; aggregate failures do not independently establish
that every evolved capability is absent. No tests provision their own records.

- These are independent proxy tests of the real published scenarios, not the undisclosed
  official finals tests or an official score. All scenario titles and step comments are
  verbatim. Exactly one test represents each changed/new scenario. Preparatory sign-in,
  repository search, and dialog reopening use public UI only.
- Exact named controls use strict single-match accessible locators. When the requirement
  supplies no role, navigation accepts a link/button, and menu commands also accept a
  menuitem. Sheet rectangle selection uses Shift-click; transient editors are dismissed
  with Escape when needed to continue the stated workflow. The official author could
  choose drag selection, another dialog-close gesture, or different unspecified scopes.
- GitHub audit clearing uses the conventional option `All actions`; the published text
  does not specify that option's exact label. Audit event values and timestamps are
  checked as nonempty fields, not invented seed literals. Session rows may be semantic
  table rows or list items; the current marker is case-insensitive. Token checks reject
  visibly labeled session-secret/token disclosure, not every possible encoded secret.
- Release Scenario 2 specifies no literal description. The proxy checks the exact
  published tag/title/branch plus readable paragraph content; it cannot certify an
  unpublished exact description. Reaction Scenarios 2/3 omit their repository name: the
  proxy discovers visible issue links or traverses repository-result links, without
  inventing a route or reading storage. Reaction counts use the visible `+1 <count>`
  representation; a zero count may disappear. Official locators could reasonably differ.
- A filter-view duplicate check is case-insensitive because the published scenario
  submits ` queued lanes ` against `Queued lanes`, even though the prose description
  only says unique. Intermediate failure/color assertions occur before later operations
  in the same compound WHEN. Freeze scenarios test the exact published state button;
  they do not independently measure sticky geometry during scrolling.

Real-task implementation progress: first GitHub diagnostic [30/30](results/diagnostic-reference-github-real-1.json), 61.302 s. No test changes were needed. The release account seed was then restricted to the explicitly declared Write grant before the final acceptance runs.

Reference implementation scope: the new apps are copies of the unmodified selected
baselines, with application-owned EVO fixtures and hand-written source changes.
GitHub adds server-held browser sessions with HttpOnly cookie credentials and revocation,
owner-only audit views, archive/restore checks, releases, and per-user reactions.
Sheet retains its existing browser-local workbook store and extends its editing,
validation, formula, and rendering paths. Find/filter/named-range/note inspectors are
nonmodal so the grid remains readable while they are open. Frozen panes use sticky
rows/columns as well as the specified saved-state button. No new npm dependencies
were introduced. The independent regression wrappers and their suite inputs are unchanged.

First Sheet diagnostic: [29/30](results/diagnostic-reference-sheet-real-1.json),
82.472 s. REQ-5-1-2 Scenario 3 reached the correct duplicate-name error, then could
not dismiss the modal save interface with Escape. The application now closes dialogs
on Escape; the frozen test and official requirement were not changed. The frozen
column headers and empty-note button behavior were also completed before final runs.

A Sheet regression invocation on the superseded pre-Escape reference was deliberately stopped and is an [aborted non-score](results/diagnostic-sheet-real-regression-aborted.json). It is not included in acceptance counts; the unchanged wrapper subsequently completed on the final application hash, as recorded in [the final Sheet regression report](results/reference-sheet-real-regression.json).

### github-real baseline per scenario

| File | Published scenario | Result | Duration |
|---|---|---|---:|
| `01-REQ-1-1-1-scenario-1.spec.ts` | REQ-1-1-1: Register a New GitHub Account - Evolution Scenario 1 | timedOut | 10091 ms |
| `02-REQ-1-1-1-scenario-2.spec.ts` | REQ-1-1-1: Register a New GitHub Account - Evolution Scenario 2 | passed | 2119 ms |
| `03-REQ-1-1-1-scenario-3.spec.ts` | REQ-1-1-1: Register a New GitHub Account - Evolution Scenario 3 | timedOut | 10024 ms |
| `04-REQ-1-1-2-scenario-1.spec.ts` | REQ-1-1-2: Sign In with an Existing Account - Evolution Scenario 1 | timedOut | 10091 ms |
| `05-REQ-1-1-2-scenario-2.spec.ts` | REQ-1-1-2: Sign In with an Existing Account - Evolution Scenario 2 | timedOut | 10102 ms |
| `06-REQ-1-1-2-scenario-3.spec.ts` | REQ-1-1-2: Sign In with an Existing Account - Evolution Scenario 3 | passed | 1906 ms |
| `07-REQ-1-4-scenario-1.spec.ts` | REQ-1-4: Manage Active Browser Sessions - Scenario 1 | timedOut | 10031 ms |
| `08-REQ-1-4-scenario-2.spec.ts` | REQ-1-4: Manage Active Browser Sessions - Scenario 2 | timedOut | 10084 ms |
| `09-REQ-1-4-scenario-3.spec.ts` | REQ-1-4: Manage Active Browser Sessions - Scenario 3 | timedOut | 10082 ms |
| `10-REQ-2-1-2-scenario-1.spec.ts` | REQ-2-1-2: Create an Organization After Authentication - Evolution Scenario 1 | timedOut | 10088 ms |
| `11-REQ-2-1-2-scenario-2.spec.ts` | REQ-2-1-2: Create an Organization After Authentication - Evolution Scenario 2 | timedOut | 10089 ms |
| `12-REQ-2-1-2-scenario-3.spec.ts` | REQ-2-1-2: Create an Organization After Authentication - Evolution Scenario 3 | timedOut | 10090 ms |
| `13-REQ-2-4-scenario-1.spec.ts` | REQ-2-4: View Organization Audit Log - Scenario 1 | timedOut | 10095 ms |
| `14-REQ-2-4-scenario-2.spec.ts` | REQ-2-4: View Organization Audit Log - Scenario 2 | timedOut | 10092 ms |
| `15-REQ-2-4-scenario-3.spec.ts` | REQ-2-4: View Organization Audit Log - Scenario 3 | timedOut | 10085 ms |
| `16-REQ-3-1-scenario-1.spec.ts` | REQ-3-1: Search for and Locate Repositories - Evolution Scenario 1 | timedOut | 10093 ms |
| `17-REQ-3-1-scenario-2.spec.ts` | REQ-3-1: Search for and Locate Repositories - Evolution Scenario 2 | timedOut | 10086 ms |
| `18-REQ-3-1-scenario-3.spec.ts` | REQ-3-1: Search for and Locate Repositories - Evolution Scenario 3 | passed | 1798 ms |
| `19-REQ-3-5-scenario-1.spec.ts` | REQ-3-5: Archive and Restore a Repository - Scenario 1 | timedOut | 10031 ms |
| `20-REQ-3-5-scenario-2.spec.ts` | REQ-3-5: Archive and Restore a Repository - Scenario 2 | timedOut | 10094 ms |
| `21-REQ-3-5-scenario-3.spec.ts` | REQ-3-5: Archive and Restore a Repository - Scenario 3 | timedOut | 10090 ms |
| `22-REQ-4-3-1-scenario-1.spec.ts` | REQ-4-3-1: List and Switch Repository Branches - Evolution Scenario 1 | timedOut | 10093 ms |
| `23-REQ-4-3-1-scenario-2.spec.ts` | REQ-4-3-1: List and Switch Repository Branches - Evolution Scenario 2 | timedOut | 10084 ms |
| `24-REQ-4-3-1-scenario-3.spec.ts` | REQ-4-3-1: List and Switch Repository Branches - Evolution Scenario 3 | timedOut | 10087 ms |
| `25-REQ-4-5-scenario-1.spec.ts` | REQ-4-5: Create and View Repository Releases - Scenario 1 | timedOut | 10093 ms |
| `26-REQ-4-5-scenario-2.spec.ts` | REQ-4-5: Create and View Repository Releases - Scenario 2 | timedOut | 10085 ms |
| `27-REQ-4-5-scenario-3.spec.ts` | REQ-4-5: Create and View Repository Releases - Scenario 3 | timedOut | 10089 ms |
| `28-REQ-5-5-scenario-1.spec.ts` | REQ-5-5: Add and Remove Issue Reactions - Scenario 1 | timedOut | 10089 ms |
| `29-REQ-5-5-scenario-2.spec.ts` | REQ-5-5: Add and Remove Issue Reactions - Scenario 2 | failed | 2327 ms |
| `30-REQ-5-5-scenario-3.spec.ts` | REQ-5-5: Add and Remove Issue Reactions - Scenario 3 | failed | 2299 ms |

### sheet-real baseline per scenario

| File | Published scenario | Result | Duration |
|---|---|---|---:|
| `01-REQ-1-2-2-scenario-1.spec.ts` | REQ-1-2-2 - trim and persist an available workbook name | timedOut | 10094 ms |
| `02-REQ-1-2-2-scenario-2.spec.ts` | REQ-1-2-2 - reject a case-insensitive duplicate workbook name | timedOut | 10087 ms |
| `03-REQ-1-2-2-scenario-3.spec.ts` | REQ-1-2-2 - reject a workbook name longer than 80 characters | timedOut | 10089 ms |
| `04-REQ-2-1-3-scenario-1.spec.ts` | REQ-2-1-3 - trim and persist an available worksheet name | timedOut | 10087 ms |
| `05-REQ-2-1-3-scenario-2.spec.ts` | REQ-2-1-3 - reject a worksheet name differing only by case | timedOut | 10088 ms |
| `06-REQ-2-1-3-scenario-3.spec.ts` | REQ-2-1-3 - reject a worksheet name longer than 50 characters | timedOut | 10095 ms |
| `07-REQ-3-1-1-scenario-1.spec.ts` | REQ-3-1-1 - clear a text cell with Delete | timedOut | 10095 ms |
| `08-REQ-3-1-1-scenario-2.spec.ts` | REQ-3-1-1 - clear a formula and recalculate its dependent result | timedOut | 10093 ms |
| `09-REQ-3-1-1-scenario-3.spec.ts` | REQ-3-1-1 - clear every cell in a selected rectangular range | timedOut | 10089 ms |
| `10-REQ-5-1-2-scenario-1.spec.ts` | REQ-5-1-2 - save a two-condition filter view | timedOut | 10091 ms |
| `11-REQ-5-1-2-scenario-2.spec.ts` | REQ-5-1-2 - apply a persisted saved filter view | timedOut | 10092 ms |
| `12-REQ-5-1-2-scenario-3.spec.ts` | REQ-5-1-2 - reject and delete a saved filter view | timedOut | 10089 ms |
| `13-REQ-5-2-1-scenario-1.spec.ts` | REQ-5-2-1 - show a custom numeric error from the formula bar | timedOut | 10094 ms |
| `14-REQ-5-2-1-scenario-2.spec.ts` | REQ-5-2-1 - show a custom dropdown error from the grid | timedOut | 10089 ms |
| `15-REQ-5-2-1-scenario-3.spec.ts` | REQ-5-2-1 - persist an updated custom error message | timedOut | 10098 ms |
| `16-REQ-6-1-1-scenario-1.spec.ts` | REQ-6-1-1 - freeze the first row | timedOut | 10090 ms |
| `17-REQ-6-1-1-scenario-2.spec.ts` | REQ-6-1-1 - freeze the first column | timedOut | 10104 ms |
| `18-REQ-6-1-1-scenario-3.spec.ts` | REQ-6-1-1 - freeze both row and column panes | timedOut | 10090 ms |
| `19-REQ-6-2-1-scenario-1.spec.ts` | REQ-6-2-1 - find the next matching cell | timedOut | 10101 ms |
| `20-REQ-6-2-1-scenario-2.spec.ts` | REQ-6-2-1 - replace all matching text in the active worksheet | timedOut | 10089 ms |
| `21-REQ-6-2-1-scenario-3.spec.ts` | REQ-6-2-1 - replace only exact-case matches | timedOut | 10089 ms |
| `22-REQ-7-1-1-scenario-1.spec.ts` | REQ-7-1-1 - create a named range and use it in a formula | timedOut | 10091 ms |
| `23-REQ-7-1-1-scenario-2.spec.ts` | REQ-7-1-1 - reject an invalid named range name | timedOut | 10094 ms |
| `24-REQ-7-1-1-scenario-3.spec.ts` | REQ-7-1-1 - update an existing named range | timedOut | 10092 ms |
| `25-REQ-7-2-1-scenario-1.spec.ts` | REQ-7-2-1 - apply a numeric threshold format | timedOut | 10093 ms |
| `26-REQ-7-2-1-scenario-2.spec.ts` | REQ-7-2-1 - apply a text-match format | timedOut | 10094 ms |
| `27-REQ-7-2-1-scenario-3.spec.ts` | REQ-7-2-1 - edit and delete a conditional formatting rule | timedOut | 10094 ms |
| `28-REQ-8-1-1-scenario-1.spec.ts` | REQ-8-1-1 - create and persist a cell note | timedOut | 10092 ms |
| `29-REQ-8-1-1-scenario-2.spec.ts` | REQ-8-1-1 - edit an existing cell note | timedOut | 10093 ms |
| `30-REQ-8-1-1-scenario-3.spec.ts` | REQ-8-1-1 - delete an existing cell note | timedOut | 10092 ms |


## Official-report calibration — real tasks v2

This is the historical v2 acceptance record. Current real tasks use v3; use the
five-run calibration section and its audit command below for the current tree.

Complete. Both tasks are frozen at v2. The official-output calibration agrees on
all 60 scenario outcomes; both references passed twice and retain every previously
passing regression case. The organizer's finals-r1 reports are read-only evidence from an agent
output, separate from the hand-written references and from the local agent outputs.
All visible error code frames were extracted before editing the tests: GitHub has
4 unique frames across 27 failed scenarios; Sheet has 9 unique frames across 9 failures.
[Every frame, its source line numbers, and affected scenarios](results/official-real-frames.md)
and [the full structured extraction](results/official-real-frames.json) are retained.
Only conventions evidenced by these frames are calibrated; unseen test code is not
claimed to be reconstructed. Published proxy test titles and official requirement
bytes are retained. The byte-identical 27-line sample helper remains unchanged.

| Official output | Report SHA-256 | Official pass / total |
|---|---|---:|
| github-real | `0d4dd60dc3c0737150407c3b79def51ff5f86ca9417c6b880aa7f9bacd109097` | 3 / 30 |
| sheet-real | `32b5e5e2d964a9bde1d02d1f27c0493baf7915fb6c53625de4d031ead7921f87` | 21 / 30 |

### Calibration change log

The v2 revision changes only the evidence-backed UI conventions below. Each frame
ID links to the exact numbered excerpt in [the extraction](results/official-real-frames.md).
The complete before/after edit sequence is retained as [a diff](results/calibration-v2-test-changes.diff)
and [per-edit SHA-256 records](results/calibration-v2-test-changes.json). No requirement,
reference image, scenario title, seed value, timeout, or original `helpers.ts` byte changed.

| Convention changed | Official frame and lines |
|---|---|
| Sign in and Create an account links are scoped to main, including both browser contexts | GitHub F01:7–10, F02:7–9, F03:95–100 |
| Repository setup uses banner Search and main result links; actual REQ-3-1 search scenarios retain their translation | GitHub F04:105–110 |
| The two unnamed public-issue repositories retain UI discovery, but it must enter through banner Search | GitHub F04, observed in REQ-5-5 #3; the repository argument is not visible |
| Filter Scenario 1 starts with button Create filter, dialog Filter, and labeled Range/Column fields | Sheet F01:6–10; later Condition/Value/Apply operations retain the requirement-derived translation |
| Duplicate filter-view error uses role alert and toContainText; its containing dialog closes with Close; Filter views uses menuitem | Sheet F02:59–64 |
| All three custom-validation errors use role alert and toContainText; the active grid editor uses fill/Enter; K8 uses toContainText | Sheet F03:16–21, F04:31–36, F05:48–53 |
| Named range list is checked and its named dialog closed before entering the formula | Sheet F06:22–27; the unseen conditional is represented by reopening only if Save closed the panel |
| Open note buttons are inside their named gridcells; open note text is checked in the labeled Note field; Edit/Delete buttons use page scope; deletion requires count zero | Sheet F07:18–23, F08:27–32, F09:44–49 |

Unseen rejection steps retain v1 locators; the report does not reveal a universal
error helper. The exact repository name for the unnamed issue seeds, the grid-editor
locator behind `editor`, and the body of the named-range conditional are not visible.
Their existing UI discovery/focus/reopening behavior is retained and explicitly
distinguished from the observed code. The original v1 authoring script is retained.

| Changed file | Frame sources |
|---|---|
| `github-real/tests/evolution-navigation.ts` | github-real-F04 |
| `github-real/tests/01-REQ-1-1-1-scenario-1.spec.ts` | github-real-F01 |
| `github-real/tests/02-REQ-1-1-1-scenario-2.spec.ts` | github-real-F01 |
| `github-real/tests/03-REQ-1-1-1-scenario-3.spec.ts` | github-real-F01 |
| `github-real/tests/04-REQ-1-1-2-scenario-1.spec.ts` | github-real-F02 |
| `github-real/tests/05-REQ-1-1-2-scenario-2.spec.ts` | github-real-F02 |
| `github-real/tests/06-REQ-1-1-2-scenario-3.spec.ts` | github-real-F02 |
| `github-real/tests/07-REQ-1-4-scenario-1.spec.ts` | github-real-F03 |
| `github-real/tests/08-REQ-1-4-scenario-2.spec.ts` | github-real-F03 |
| `github-real/tests/09-REQ-1-4-scenario-3.spec.ts` | github-real-F03 |
| `github-real/tests/10-REQ-2-1-2-scenario-1.spec.ts` | github-real-F03 |
| `github-real/tests/11-REQ-2-1-2-scenario-2.spec.ts` | github-real-F03 |
| `github-real/tests/12-REQ-2-1-2-scenario-3.spec.ts` | github-real-F03 |
| `github-real/tests/13-REQ-2-4-scenario-1.spec.ts` | github-real-F03 |
| `github-real/tests/14-REQ-2-4-scenario-2.spec.ts` | github-real-F03 |
| `github-real/tests/15-REQ-2-4-scenario-3.spec.ts` | github-real-F03 |
| `github-real/tests/19-REQ-3-5-scenario-1.spec.ts` | github-real-F03, github-real-F04 |
| `github-real/tests/20-REQ-3-5-scenario-2.spec.ts` | github-real-F03, github-real-F04 |
| `github-real/tests/21-REQ-3-5-scenario-3.spec.ts` | github-real-F03, github-real-F04 |
| `github-real/tests/22-REQ-4-3-1-scenario-1.spec.ts` | github-real-F04 |
| `github-real/tests/23-REQ-4-3-1-scenario-2.spec.ts` | github-real-F04 |
| `github-real/tests/24-REQ-4-3-1-scenario-3.spec.ts` | github-real-F04 |
| `github-real/tests/25-REQ-4-5-scenario-1.spec.ts` | github-real-F03, github-real-F04 |
| `github-real/tests/26-REQ-4-5-scenario-2.spec.ts` | github-real-F04 |
| `github-real/tests/27-REQ-4-5-scenario-3.spec.ts` | github-real-F03, github-real-F04 |
| `github-real/tests/28-REQ-5-5-scenario-1.spec.ts` | github-real-F03, github-real-F04 |
| `github-real/tests/29-REQ-5-5-scenario-2.spec.ts` | github-real-F03 |
| `github-real/tests/interactions.ts` | github-real-F04 |
| `sheet-real/tests/10-REQ-5-1-2-scenario-1.spec.ts` | sheet-real-F01, sheet-real-F02 |
| `sheet-real/tests/11-REQ-5-1-2-scenario-2.spec.ts` | sheet-real-F02 |
| `sheet-real/tests/12-REQ-5-1-2-scenario-3.spec.ts` | sheet-real-F02 |
| `sheet-real/tests/13-REQ-5-2-1-scenario-1.spec.ts` | sheet-real-F03 |
| `sheet-real/tests/14-REQ-5-2-1-scenario-2.spec.ts` | sheet-real-F04 |
| `sheet-real/tests/15-REQ-5-2-1-scenario-3.spec.ts` | sheet-real-F05 |
| `sheet-real/tests/22-REQ-7-1-1-scenario-1.spec.ts` | sheet-real-F06 |
| `sheet-real/tests/28-REQ-8-1-1-scenario-1.spec.ts` | sheet-real-F07 |
| `sheet-real/tests/29-REQ-8-1-1-scenario-2.spec.ts` | sheet-real-F08 |
| `sheet-real/tests/30-REQ-8-1-1-scenario-3.spec.ts` | sheet-real-F09 |


<!-- calibration-results:start -->
### Calibration results

Agreement compares each official output app with its own organizer report, using
requirement ID + scenario number (the published Sheet proxy titles are retained).
The local agent apps have different frontend source hashes and are reported separately.

| Application | Official pass / total | Proxy pass / total | Per-test agreement | Proxy wall time |
|---|---:|---:|---:|---:|
| github-real official output | 3 / 30 | [3 / 30](results/calibration-official-github-v2.json) | 30 / 30 | 324.675 s |
| sheet-real official output | 21 / 30 | [21 / 30](results/calibration-official-sheet-v2.json) | 30 / 30 | 153.685 s |

#### Reference and local-agent runs

| Application | Proxy pass / total | Wall time |
|---|---:|---:|
| reference-github-real-v2-proxy-1 | [30 / 30](results/reference-github-real-v2-proxy-1.json) | 63.259 s |
| reference-github-real-v2-proxy-2 | [30 / 30](results/reference-github-real-v2-proxy-2.json) | 68.583 s |
| reference-sheet-real-v2-proxy-1 | [30 / 30](results/reference-sheet-real-v2-proxy-1.json) | 71.572 s |
| reference-sheet-real-v2-proxy-2 | [30 / 30](results/reference-sheet-real-v2-proxy-2.json) | 77.908 s |
| calibration-local-github-v2 | [3 / 30](results/calibration-local-github-v2.json) | 327.729 s |
| calibration-local-sheet-v2 | [22 / 30](results/calibration-local-sheet-v2.json) | 151.151 s |

#### Reference regressions

| Task / suite | Baseline pass / fail / error | v2 pass / fail / error | Time |
|---|---|---|---:|
| github / v6-fixed-independent | 107 / 4 / 0 | 107 / 4 / 0 | 208.8 s |
| sheet / g99 | 66 / 9 / 26 | 66 / 9 / 26 | 413.2 s |
| sheet / cov99n-arm | 96 / 4 / 0 | 96 / 4 / 0 | 243.4 s |


#### github-real per-scenario agreement

| Scenario | Official | Proxy | Agreement |
|---|---|---|---|
| REQ-1-1-1#1 | fail | fail | yes |
| REQ-1-1-1#2 | fail | fail | yes |
| REQ-1-1-1#3 | fail | fail | yes |
| REQ-1-1-2#1 | fail | fail | yes |
| REQ-1-1-2#2 | fail | fail | yes |
| REQ-1-1-2#3 | fail | fail | yes |
| REQ-1-4#1 | fail | fail | yes |
| REQ-1-4#2 | fail | fail | yes |
| REQ-1-4#3 | fail | fail | yes |
| REQ-2-1-2#1 | fail | fail | yes |
| REQ-2-1-2#2 | fail | fail | yes |
| REQ-2-1-2#3 | fail | fail | yes |
| REQ-2-4#1 | fail | fail | yes |
| REQ-2-4#2 | fail | fail | yes |
| REQ-2-4#3 | fail | fail | yes |
| REQ-3-1#1 | pass | pass | yes |
| REQ-3-1#2 | pass | pass | yes |
| REQ-3-1#3 | pass | pass | yes |
| REQ-3-5#1 | fail | fail | yes |
| REQ-3-5#2 | fail | fail | yes |
| REQ-3-5#3 | fail | fail | yes |
| REQ-4-3-1#1 | fail | fail | yes |
| REQ-4-3-1#2 | fail | fail | yes |
| REQ-4-3-1#3 | fail | fail | yes |
| REQ-4-5#1 | fail | fail | yes |
| REQ-4-5#2 | fail | fail | yes |
| REQ-4-5#3 | fail | fail | yes |
| REQ-5-5#1 | fail | fail | yes |
| REQ-5-5#2 | fail | fail | yes |
| REQ-5-5#3 | fail | fail | yes |

#### sheet-real per-scenario agreement

| Scenario | Official | Proxy | Agreement |
|---|---|---|---|
| REQ-1-2-2#1 | pass | pass | yes |
| REQ-1-2-2#2 | pass | pass | yes |
| REQ-1-2-2#3 | pass | pass | yes |
| REQ-2-1-3#1 | pass | pass | yes |
| REQ-2-1-3#2 | pass | pass | yes |
| REQ-2-1-3#3 | pass | pass | yes |
| REQ-3-1-1#1 | pass | pass | yes |
| REQ-3-1-1#2 | pass | pass | yes |
| REQ-3-1-1#3 | pass | pass | yes |
| REQ-5-1-2#1 | fail | fail | yes |
| REQ-5-1-2#2 | pass | pass | yes |
| REQ-5-1-2#3 | fail | fail | yes |
| REQ-5-2-1#1 | fail | fail | yes |
| REQ-5-2-1#2 | fail | fail | yes |
| REQ-5-2-1#3 | fail | fail | yes |
| REQ-6-1-1#1 | pass | pass | yes |
| REQ-6-1-1#2 | pass | pass | yes |
| REQ-6-1-1#3 | pass | pass | yes |
| REQ-6-2-1#1 | pass | pass | yes |
| REQ-6-2-1#2 | pass | pass | yes |
| REQ-6-2-1#3 | pass | pass | yes |
| REQ-7-1-1#1 | fail | fail | yes |
| REQ-7-1-1#2 | pass | pass | yes |
| REQ-7-1-1#3 | pass | pass | yes |
| REQ-7-2-1#1 | pass | pass | yes |
| REQ-7-2-1#2 | pass | pass | yes |
| REQ-7-2-1#3 | pass | pass | yes |
| REQ-8-1-1#1 | fail | fail | yes |
| REQ-8-1-1#2 | fail | fail | yes |
| REQ-8-1-1#3 | fail | fail | yes |

Both official-output replays agree on all 60 pass/fail outcomes. There are no disagreements in this calibration pair. This does not establish equivalence to unseen organizer assertions.
<!-- calibration-results:end -->

- github-real v2, 2026-10-06T12:51:29.189016+00:00: Calibrate navigation to visible finals-r1 official frames: main-scoped Sign in/Create an account; banner-scoped repository Search and main result links (GitHub F01-F04). Titles, seeds, requirements, helpers.ts and runner settings unchanged.

- sheet-real v2, 2026-10-06T12:51:29.321494+00:00: Calibrate to visible finals-r1 official frames: Create filter/Filter Range-Column flow, alert assertions, named dialog Close controls, gridcell-scoped note buttons and Note field values (Sheet F01-F09). Titles, seeds, requirements, helpers.ts and runner settings unchanged.

[Application provenance](results/calibration-app-provenance.json) records clean copies of the four output apps. Only frontend/ and backend/ were copied; .arc, requirements, dependencies, and build output are excluded. Original output directories remain read-only.

Reference v2 implementation: GitHub now renders the global repository search in
the banner and the home-page Sign in link in main; its existing repository code
search remains in the repository content. Sheet adds the explicit Filter dialog
entry, uses alert semantics for validation errors, places note-open controls inside
their gridcells, and exposes the saved note in the labeled Note field. Existing
selection-based filtering and the specified Close buttons remain available.

Both first full reference executions passed 30/30 without subsets. Their reports
were retained as v2 reference run 1 (renamed from diagnostic filenames, not executed
or counted twice). No test changes followed the v2 freeze.

### Local-output differences and calibration limits

The local Sheet output scores 22/30, while replaying the official Sheet output scores
21/30. Exactly one scenario differs between these two **different applications**:
REQ-7-1-1 #1. The [local named-range list](calibration/apps/local-sheet/frontend/public/app.js)
renders a `Close` button (line 930 in the captured copy); the
[official output's named-range panel](calibration/apps/official-sheet/frontend/public/app.js)
at lines 1108–1121 has no such button. The official and calibrated-proxy failures
both occur at the named dialog's Close button. This is supported by the frozen v2
replays and captured source; it is not a disagreement against the official report.

A 60/60 agreement on this pair does not reveal later assertions hidden behind early
failures. In particular, GitHub's main/banner failures prevent the official report
from showing most downstream feature checks. The proxy continues to use the original
requirement-derived assertions there. Claims of full official-suite equivalence or
official scores for the reference/local apps would be unsupported.

### v2 final verification

[The calibration audit](results/real-calibration-final-audit-v2.json) and
[the reference/regression audit](results/real-final-audit-v2.json) passed. They verify
all visible official frame occurrences were extracted; every official-output replay
uses v2 and matches all 30 official results; both references have two distinct,
consecutive 30/30 runs on the same hash used for regression; the local re-judgements
use v2; all four staged applications and their read-only source components retain
their recorded hashes; and all six task freezes verify. GitHub remains at 107 passing
regressions, Sheet g99 at 66 and cov99n-arm at 96, with zero previously passing cases
lost and no flaky-loss exception required.

The v1 reports and audit remain historical evidence. New records have versioned
filenames; `audit_real_tasks.py` now selects the current frozen version's reference
reports without overwriting the historical v1 audit. No changes were made to the
original `github`, `sheet`, prose tasks, or their reference apps. No requirement or
27-line helper bytes changed. The v2 test files were not edited after their freeze.

```sh
python3 scripts/freeze.py --verify
python3 scripts/audit_real_calibration.py
python3 run_proxy.py calibration/apps/official-github github-real --out results/check-official-github-v2.json
python3 run_proxy.py calibration/apps/official-sheet sheet-real --out results/check-official-sheet-v2.json
```

Completed scratch app copies and redundant stdout captures were removed. The clean
application snapshots, full normalized and raw reports, original-source hashes,
frame extraction, test diff, and per-scenario agreement tables are retained locally.
No LLM gateway, ARC-Bench key, or upload was used.


## Five-run official calibration — real tasks v3

Complete. Frozen v3 achieved **292/300 per-test agreement** against all ten official
outputs (GitHub 142/150, Sheet 150/150), exceeding the required 290/300. All eight
disagreements are explained below. All ten finals-r1..r5 reports are read-only evidence. The v3 calibration
uses one common suite for all five applications per task; it does not choose test
behavior from application hashes or expected pass/fail outcomes.
[All 31 unique visible code frames](results/official-real-frames-v3.md),
[resolved locators and assertion values](results/official-real-observations-v3.md),
and [the complete structured extraction](results/official-real-frames-v3.json) were
created before revising tests or opening later output-app source. A recursive scan
confirmed that every visible frame occurrence in all ten JSON reports is represented.

| Official report | Passed / total | SHA-256 |
|---|---:|---|
| r1-github | 3 / 30 | `0d4dd60dc3c0737150407c3b79def51ff5f86ca9417c6b880aa7f9bacd109097` |
| r1-sheet | 21 / 30 | `32b5e5e2d964a9bde1d02d1f27c0493baf7915fb6c53625de4d031ead7921f87` |
| r2-github | 21 / 30 | `e14f27639ab19f8b9013aac67c82a5186df7b9d570a5bb7071b4f0c445fd1097` |
| r2-sheet | 29 / 30 | `951e06dc4f95cac0fff62359ba9b1cc23ab44e86fcfde1c8d0fc18e3ffeb520d` |
| r3-github | 3 / 30 | `acbfeebc0f5208bb189792b98f754a843d0d201282784b6d87c4648968a33c0e` |
| r3-sheet | 24 / 30 | `a7e9ccdd1db5f86d401e77ead3acc2f019f83f075b609d588043b2bdf008c263` |
| r4-github | 15 / 30 | `8b721a2cc3319a2ee8e1e37c24ae62f3410d277d485dcac80d20469a9a2e45f2` |
| r4-sheet | 11 / 30 | `241a48985703eefb1953d83f874cfcd7b8eb542ef16860161b49175b63e37d0e` |
| r5-github | 16 / 30 | `4f945831cd89cf0e1cf5ad1f3f33e3a15f4aaba90906b00372bcc5d7d153d4dc` |
| r5-sheet | 26 / 30 | `dde2b6a8e1d9bd1875a5f3bbcae2353a9b33980d5c40a3219d836d9c5b190c60` |

### v3 changes and evidence

The [complete test diff](results/calibration-v3-test-changes.diff) and
[per-edit hashes and frame references](results/calibration-v3-test-changes.json)
record each change from v2. Official requirement/reference files, sample helpers,
scenario titles, and runner settings remain unchanged.

The visible candidate-poll body is reproduced literally. Its candidate array and
several callers are not visible: the proxy retains its existing exact link/button
candidates, in that order. Owner audit setup now opens the named organization from
home before Audit log; that preparation follows the requirement but is an inference,
not recovered official source. Member audit setup and unnamed issue-repository UI
discovery retain their previous routes. These unknowns may explain residual mismatches.

| Changed file | Visible frame evidence | Reason |
|---|---|---|
| `github-real/tests/evolution-navigation.ts` | github-v3-F06, github-v3-F12 | Mirror the observed candidate polling body; retain the previously supported link/button candidates because the actual list is unseen. |
| `github-real/tests/20-REQ-3-5-scenario-2.spec.ts` | github-v3-F06 | Use the observed polling navigation convention for existing exact-name link/button targets. |
| `github-real/tests/25-REQ-4-5-scenario-1.spec.ts` | github-v3-F06, github-v3-F13 | Use the observed polling navigation convention for existing exact-name link/button targets. Require a tag heading and the exact target-branch regex, retaining the published title/description and persistence checks. |
| `github-real/tests/11-REQ-2-1-2-scenario-2.spec.ts` | github-v3-F06, github-v3-F12 | Use the observed polling navigation convention for existing exact-name link/button targets. Scope Your organizations to a link in the Account menu, as shown at line 12. |
| `github-real/tests/12-REQ-2-1-2-scenario-3.spec.ts` | github-v3-F06, github-v3-F12 | Use the observed polling navigation convention for existing exact-name link/button targets. Scope Your organizations to a link in the Account menu, as shown at line 12. |
| `github-real/tests/09-REQ-1-4-scenario-3.spec.ts` | github-v3-F05, github-v3-F06, github-v3-F11 | Use the observed polling navigation convention for existing exact-name link/button targets. The revoked page must show the main Sign in link. Preserve the other page as shown, without an additional reload or sign-in-form requirement. |
| `github-real/tests/28-REQ-5-5-scenario-1.spec.ts` | github-v3-F06, github-v3-F10 | Use the observed polling navigation convention for existing exact-name link/button targets. Assert the exact 1 reaction label before and after reload; remove the prior +1-count-only approximation. |
| `github-real/tests/19-REQ-3-5-scenario-1.spec.ts` | github-v3-F06 | Use the observed polling navigation convention for existing exact-name link/button targets. |
| `github-real/tests/21-REQ-3-5-scenario-3.spec.ts` | github-v3-F06, github-v3-F07 | Use the observed polling navigation convention for existing exact-name link/button targets. Check the visible Active text immediately after restore, before reopening and reloading the repository. |
| `github-real/tests/08-REQ-1-4-scenario-2.spec.ts` | github-v3-F05, github-v3-F06 | Use the observed polling navigation convention for existing exact-name link/button targets. Use the exact strict revoked/inactive regex before and after reload, including the observed first revoke button; do not choose between two matching markers. |
| `github-real/tests/15-REQ-2-4-scenario-3.spec.ts` | github-v3-F06 | Use the observed polling navigation convention for existing exact-name link/button targets. |
| `github-real/tests/07-REQ-1-4-scenario-1.spec.ts` | github-v3-F06 | Use the observed polling navigation convention for existing exact-name link/button targets. |
| `github-real/tests/27-REQ-4-5-scenario-3.spec.ts` | github-v3-F06, github-v3-F09 | Use the observed polling navigation convention for existing exact-name link/button targets. The resolved official seed RELEASE_TAG_S3 must occur as text exactly once after the duplicate error; an input value alone does not satisfy this. |
| `github-real/tests/10-REQ-2-1-2-scenario-1.spec.ts` | github-v3-F06, github-v3-F12 | Use the observed polling navigation convention for existing exact-name link/button targets. Scope Your organizations to a link in the Account menu, as shown at line 12. |
| `github-real/tests/13-REQ-2-4-scenario-1.spec.ts` | github-v3-F06 | Use the observed polling navigation convention for existing exact-name link/button targets. Owner audit setup opens the named organization directly from the signed-in home, then polls Audit log. The caller sequence is inferred from the requirement; the report exposes only the polling helper and caller line. |
| `github-real/tests/14-REQ-2-4-scenario-2.spec.ts` | github-v3-F06 | Use the observed polling navigation convention for existing exact-name link/button targets. Owner audit setup opens the named organization directly from the signed-in home, then polls Audit log. The caller sequence is inferred from the requirement; the report exposes only the polling helper and caller line. |
| `github-real/tests/26-REQ-4-5-scenario-2.spec.ts` | github-v3-F06, github-v3-F08 | Use the observed polling navigation convention for existing exact-name link/button targets. Replace the unspecified-description approximation with the now-observed Evolution release seed, tag heading and target-branch regex. |
| `github-real/tests/interactions.ts` | github-v3-F06, github-v3-F10 | Recognize the observed reaction-count label in unchanged scenarios, exclude it from issue-content preservation comparison, and use the candidate poll when selecting a discovered issue. |
| `sheet-real/tests/28-REQ-8-1-1-scenario-1.spec.ts` | sheet-v3-F18 | Mirror the newly observed exact menuitem/button/dialog scopes; retain unobserved gestures and assertions. |
| `sheet-real/tests/11-REQ-5-1-2-scenario-2.spec.ts` | sheet-v3-F11 | Mirror the newly observed exact menuitem/button/dialog scopes; retain unobserved gestures and assertions. |
| `sheet-real/tests/12-REQ-5-1-2-scenario-3.spec.ts` | sheet-v3-F11, sheet-v3-F12 | Mirror the newly observed exact menuitem/button/dialog scopes; retain unobserved gestures and assertions. |
| `sheet-real/tests/27-REQ-7-2-1-scenario-3.spec.ts` | sheet-v3-F17 | Mirror the newly observed exact menuitem/button/dialog scopes; retain unobserved gestures and assertions. |
| `sheet-real/tests/21-REQ-6-2-1-scenario-3.spec.ts` | sheet-v3-F15 | Mirror the newly observed exact menuitem/button/dialog scopes; retain unobserved gestures and assertions. |
| `sheet-real/tests/23-REQ-7-1-1-scenario-2.spec.ts` | sheet-v3-F16 | Mirror the newly observed exact menuitem/button/dialog scopes; retain unobserved gestures and assertions. |
| `sheet-real/tests/15-REQ-5-2-1-scenario-3.spec.ts` | sheet-v3-F13 | Mirror the newly observed exact menuitem/button/dialog scopes; retain unobserved gestures and assertions. |
| `sheet-real/tests/17-REQ-6-1-1-scenario-2.spec.ts` | sheet-v3-F14 | Mirror the newly observed exact menuitem/button/dialog scopes; retain unobserved gestures and assertions. |
| `sheet-real/tests/25-REQ-7-2-1-scenario-1.spec.ts` | sheet-v3-F17 | Mirror the newly observed exact menuitem/button/dialog scopes; retain unobserved gestures and assertions. |
| `sheet-real/tests/10-REQ-5-1-2-scenario-1.spec.ts` | sheet-v3-F12 | Mirror the newly observed exact menuitem/button/dialog scopes; retain unobserved gestures and assertions. |
| `sheet-real/tests/18-REQ-6-1-1-scenario-3.spec.ts` | sheet-v3-F14 | Mirror the newly observed exact menuitem/button/dialog scopes; retain unobserved gestures and assertions. |
| `sheet-real/tests/16-REQ-6-1-1-scenario-1.spec.ts` | sheet-v3-F14 | Mirror the newly observed exact menuitem/button/dialog scopes; retain unobserved gestures and assertions. |
| `sheet-real/tests/19-REQ-6-2-1-scenario-1.spec.ts` | sheet-v3-F15 | Mirror the newly observed exact menuitem/button/dialog scopes; retain unobserved gestures and assertions. |
| `sheet-real/tests/24-REQ-7-1-1-scenario-3.spec.ts` | sheet-v3-F10, sheet-v3-F16 | Mirror the newly observed exact menuitem/button/dialog scopes; retain unobserved gestures and assertions. |
| `sheet-real/tests/20-REQ-6-2-1-scenario-2.spec.ts` | sheet-v3-F15 | Mirror the newly observed exact menuitem/button/dialog scopes; retain unobserved gestures and assertions. |
| `sheet-real/tests/22-REQ-7-1-1-scenario-1.spec.ts` | sheet-v3-F16 | Mirror the newly observed exact menuitem/button/dialog scopes; retain unobserved gestures and assertions. |
| `sheet-real/tests/26-REQ-7-2-1-scenario-2.spec.ts` | sheet-v3-F17 | Mirror the newly observed exact menuitem/button/dialog scopes; retain unobserved gestures and assertions. |


<!-- v3-results:start -->
### v3 calibration results

Completed agreement: **292 / 300**; acceptance target is at least 290 / 300.
All runs use the same frozen task suites. [All 300 scenario rows](results/calibration-v3-per-test.md)
and [machine-readable comparisons](results/official-calibration-v3.json) are retained.

| Official output | Official pass / total | Proxy pass / total | Agreement | Wall time |
|---|---:|---:|---:|---:|
| r1-github | 3 / 30 | [3 / 30](results/v3-r1-github-proxy.json) | 30 / 30 | 328.9 s |
| r1-sheet | 21 / 30 | [21 / 30](results/v3-r1-sheet-proxy.json) | 30 / 30 | 157.523 s |
| r2-github | 21 / 30 | [22 / 30](results/v3-r2-github-proxy.json) | 27 / 30 | 137.753 s |
| r2-sheet | 29 / 30 | [29 / 30](results/v3-r2-sheet-proxy.json) | 30 / 30 | 77.034 s |
| r3-github | 3 / 30 | [3 / 30](results/v3-r3-github-proxy.json) | 30 / 30 | 328.105 s |
| r3-sheet | 24 / 30 | [24 / 30](results/v3-r3-sheet-proxy.json) | 30 / 30 | 127.312 s |
| r4-github | 15 / 30 | [13 / 30](results/v3-r4-github-proxy.json) | 28 / 30 | 226.752 s |
| r4-sheet | 11 / 30 | [11 / 30](results/v3-r4-sheet-proxy.json) | 30 / 30 | 253.156 s |
| r5-github | 16 / 30 | [17 / 30](results/v3-r5-github-proxy.json) | 27 / 30 | 180.614 s |
| r5-sheet | 26 / 30 | [26 / 30](results/v3-r5-sheet-proxy.json) | 30 / 30 | 106.104 s |

#### Explained disagreements

- **r2-github / REQ-1-4#1** (official pass, proxy fail): Known proxy false negative: the app renders the current session as an article.session-row (captured app.js lines 436-438), with a Current session marker. The retained v1 proxy locator only accepts semantic row/listitem containers. No report reveals the official current-row locator for this passing scenario; this retained container assumption is stricter than the observed official result.
- **r2-github / REQ-5-5#2** (official fail, proxy pass): Known navigation coverage gap: the snapshot seeds this issue in evo-reaction-repository-s2 (seed.js lines 111 and 287). The proxy discovers it by traversing public repository results. Official execution times out in clickEvolutionTarget inside openReactionIssue at line 16 (github-v3-F06); neither that call argument nor the helper candidate array is visible. The exact official parent-repository/target choice cannot be recovered, so the generic discovery is retained rather than inventing an app-specific failing route.
- **r2-github / REQ-5-5#3** (official fail, proxy pass): Known navigation coverage gap: this issue is seeded in evo-reaction-repository-s3 (seed.js lines 112 and 288), and public UI discovery reaches it. The official report times out in the unseen target selection at openReactionIssue:16 (github-v3-F06). Its repository argument and candidate list are not exposed, so their exact difference from the proxy cannot be asserted.
- **r4-github / REQ-1-4#1** (official pass, proxy fail): Known proxy false negative: app.js lines 476-478 render Current session inside article.session-row, not a semantic row/listitem. The proxy retains the earlier row/listitem locator, while this official scenario passes. Its official current-session container locator is not visible in any report.
- **r4-github / REQ-2-4#3** (official pass, proxy fail): Known proxy false negative in the retained member navigation route: after Your organizations, the snapshot offers a link named Evo Audit Org, not evo-audit-org (seed.js:66 and the retained DOM snapshot). The proxy polls the latter exact name and times out before the permission assertion. The passing official member case exposes no frame identifying its route, target argument, or candidate list, so that navigation cannot be reconstructed literally.
- **r5-github / REQ-1-4#1** (official pass, proxy fail): Known proxy false negative: app.js lines 506-509 use article.session-row with the Current session marker. The retained proxy container locator excludes articles. No frame reveals which container/marker locator the passing official case uses.
- **r5-github / REQ-5-5#2** (official fail, proxy pass): Known navigation coverage gap: seed.js:105 and :256 place Evo reaction issue s2 in evo-reaction-repository-s2. Generic public-repository discovery reaches it. The official report instead times out inside clickEvolutionTarget at openReactionIssue:16 (github-v3-F06); the actual target argument, repository argument, and candidate list are unseen. No run-specific route is substituted to force the official failure.
- **r5-github / REQ-5-5#3** (official fail, proxy pass): Known navigation coverage gap: seed.js:106 and :257 place Evo reaction issue s3 in evo-reaction-repository-s3. The proxy discovers and reads it, but the official run fails in the hidden target selection at openReactionIssue:16 (github-v3-F06). The exact official navigation choice is not recoverable from these reports.

#### v3 reference and local-agent runs

| Application | Proxy pass / total | Wall time |
|---|---:|---:|
| reference-github-real-v3-proxy-1 | [30 / 30](results/reference-github-real-v3-proxy-1.json) | 66.667 s |
| reference-github-real-v3-proxy-2 | [30 / 30](results/reference-github-real-v3-proxy-2.json) | 63.662 s |
| reference-sheet-real-v3-proxy-1 | [30 / 30](results/reference-sheet-real-v3-proxy-1.json) | 74.766 s |
| reference-sheet-real-v3-proxy-2 | [30 / 30](results/reference-sheet-real-v3-proxy-2.json) | 75.969 s |
| v3-local-github-real-c340ea0e8e-s1-proxy | [21 / 30](results/v3-local-github-real-c340ea0e8e-s1-proxy.json) | 149.301 s |
| v3-local-github-real-c452126573-s1-proxy | [19 / 30](results/v3-local-github-real-c452126573-s1-proxy.json) | 168.04 s |
| v3-local-github-real-place3c0294d9-s2-proxy | [23 / 30](results/v3-local-github-real-place3c0294d9-s2-proxy.json) | 128.011 s |
| v3-local-sheet-real-c340ea0e8e-s1-proxy | [26 / 30](results/v3-local-sheet-real-c340ea0e8e-s1-proxy.json) | 106.716 s |
| v3-local-sheet-real-c452126573-s1-proxy | [11 / 30](results/v3-local-sheet-real-c452126573-s1-proxy.json) | 248.96 s |

#### v3 reference regressions

| Task / suite | Baseline pass / fail / error | Current pass / fail / error | Time |
|---|---|---|---:|
| github / v6-fixed-independent | 107 / 4 / 0 | 107 / 4 / 0 | 205.8 s |
| sheet / g99 | 66 / 9 / 26 | 66 / 9 / 26 | 414.7 s |
| sheet / cov99n-arm | 96 / 4 / 0 | 96 / 4 / 0 | 266.1 s |
<!-- v3-results:end -->

- github-real v3, 2026-10-06T17:15:13.938487+00:00: Five-report calibration: strict revoked/inactive state, main sign-in link after revocation, menu-scoped organization entry, observed candidate-poll body, Active marker, release tag headings/description/target regex and duplicate tag count, and exact 1 reaction label. Frames github-v3-F01-F13; unseen candidate list/callers explicitly documented.

- sheet-real v3, 2026-10-06T17:15:14.045640+00:00: Five-report calibration: exact button/menuitem roles for Data, View, Edit, Format and Insert commands; Filter views dialog scope; named-range edit field and Save scoping. Frames sheet-v3-F01-F18. Requirements, helper bytes, titles and 10-second runner settings unchanged.

[Application snapshot provenance](results/calibration-app-provenance-v3.json) records frontend/backend hashes for all fifteen read-only source applications and their clean local copies. Runs use the existing random per-invocation container names; the batch coordinator only manages its own child process groups.

The first GitHub v3 reference run was [29/30](results/diagnostic-reference-github-real-v3-1.json).
The new expired-session page contained the required main Sign in link, but the inherited
duplicate-control suppression hid it after seeing the identical header link. The header
now omits that duplicate on the expired-session page, just as on home. This is an
application correction; no v3 test or requirement changed. Sheet's first full v3 run
passed 30/30 on its unchanged v2 application source.

Reference v3 changes are limited to the observed conventions: a dedicated signed-out
entry after session revocation, an Active repository marker, release-tag headings,
the revealed `Evolution release` description seed, a link to an existing duplicate
release, and reaction counts displayed as `1 reaction` / `<n> reactions`. The data
operations remain state-based. Sheet required no source changes for the newly strict
menu and dialog scopes. No test file has changed since the v3 freeze.

### Residual v3 calibration boundaries

The eight disagreements are four false negatives and four false positives. Three
false negatives come from the retained semantic row/listitem assumption for current
sessions; the applications use articles and the official passing locator is unseen.
The fourth is the member organization entry's display name, confirmed by the
[retained r4 DOM snapshot](results/calibration-v3-r4-audit-member-context.md). The four
false positives come from the proxy's broader public-repository discovery for issue
scenarios whose official navigation arguments and candidate list are not exposed.
Each application/scenario is explained in the results section and in
[the disagreement ledger](results/calibration-v3-disagreements.json).

These are documented proxy limitations, not declarations that the affected apps
violate the official contract. No expected result, application hash, or run number
is consulted by the tests. No v3 test was changed after seeing replay outcomes.
The shared candidate list and unseen caller steps remain inferred; a 292/300 fit
does not reconstruct the entire organizer suite or establish a universal score predictor.

### v3 final verification

[The final calibration audit](results/real-calibration-final-audit-v3.json) passed,
including all 300 official/proxy comparisons, explanations for every disagreement,
all 15 original/staged application hashes, complete extraction of all visible frames,
and the five local re-judgements. [The reference audit](results/real-final-audit-v3.json)
confirms two distinct consecutive 30/30 runs per task on the same app hash used for
regression. GitHub retains 107 passing cases; Sheet g99 retains 66 and cov99n-arm
retains 96. No formerly passing regression case was lost, so neither the one-case
allowance nor the changed-requirement exception was needed.

All six task freezes verify. Official YAML/reference images, published scenario
titles, and the original 27-line helpers remain byte-identical. The older hypothetical
and prose tasks and their reference apps are unchanged. The current v3 tests were
not edited after freeze or specialized to any of the replayed apps. v1/v2 reports
and audits remain historical artifacts with their original hashes.

```sh
python3 scripts/freeze.py --verify
python3 scripts/audit_real_calibration_v3.py
python3 scripts/report_real_calibration_v3.py
```

The official runner listings are retained as [GitHub v3](results/github-real-v3-test-list.txt)
and [Sheet v3](results/sheet-real-v3-test-list.txt). Completed scratch app copies
and redundant stdout captures from this turn were removed; clean input snapshots,
normalized/raw reports, the r4 member-page snapshot, and evidence ledgers remain
inside this workspace. No LLM gateway, ARC-Bench key, or upload was used.
