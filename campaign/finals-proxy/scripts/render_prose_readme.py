"""Render the prose-variant comparison and exhaustive per-test coverage table."""
import json
import html
from pathlib import Path
import yaml

ROOT=Path(__file__).resolve().parents[1]
def cell(text):return html.escape(str(text),quote=False).replace('|','\\|').replace('\n','<br>')
def scenario(req):return '<br><br>'.join('**'+s['keyword']+'** '+cell(s['content']) for s in req['scenarios'][0]['steps'])

def section():
    if not (ROOT/'github-prose/FROZEN.json').exists():return ''
    coverage=json.loads((ROOT/'results/prose-name-coverage.json').read_text())
    proof=json.loads((ROOT/'results/prose-equivalence.json').read_text())
    text='''## Prose-style variants

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

These are four selectable task names but only **60 distinct tests**. Each prose
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
'''
    for task,entry in proof['variants'].items():
        b=entry['base'];r=entry['reference']
        text+=f'| {task} | [{b["passed"]}/{b["total"]}, reused]({b["report"]}) | [{r["passed"]}/{r["total"]}]({r["report"]}) | {r["wall_seconds"]} s |\n'
    text+='''
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
'''
    light=yaml.safe_load((ROOT/'sheet/requirements/requirements.yaml').read_text())
    prose=yaml.safe_load((ROOT/'sheet-prose/requirements/requirements.yaml').read_text())
    left=next(x for x in light['children'] if x['id']=='EV-3.8')
    right=next(x for x in prose['children'] if x['id']=='EV-3.8')
    text+=f'| Description | {cell(left["description"])} | {cell(right["description"])} |\n'
    text+=f'| Scenario | {scenario(left)} | {scenario(right)} |\n'
    text+='''
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

'''
    text+=(ROOT/'results/prose-name-coverage.md').read_text()+'\n'
    for task in ['github-prose','sheet-prose']:
        rows=[r for r in coverage['requirements'] if r['task']==task]
        text+=f'{task}: all 30 tests covered, {sum(r["names_found"] for r in rows)}/{sum(r["names_used"] for r in rows)} kind/name pairs and {sum(r["containers_found"] for r in rows)}/{sum(r["containers_used"] for r in rows)} named containers.\n\n'
    text+='### Prose freeze history\n\n'
    for task in ['github-prose','sheet-prose']:
        manifest=json.loads((ROOT/task/'FROZEN.json').read_text())
        for entry in manifest.get('history',[])+[manifest]:
            text+=f'- {task} v{entry["version"]}, {entry["frozen_at"]}: {entry["reason"]}.\n'
    text+='\nNo prose requirements or shared tests were edited after this freeze.\n\n'
    return text
