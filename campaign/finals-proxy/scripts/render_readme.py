"""Render the inventory and measured results without touching frozen inputs."""
import json
from pathlib import Path
import yaml
from render_prose_readme import section as prose_section
ROOT=Path(__file__).resolve().parents[1]

def main():
    difficulties=json.loads((ROOT/'scripts/difficulties.json').read_text())
    text='''# Hidden finals proxy — hackathon-evolution

This is an independent local proxy for the unreleased ARC-Bench hackathon finals,
not an official finals test pack or a prediction of the final score. It starts
from the participant's actual GitHub 79/100 and Sheet 87/100 preliminary apps.
The requirements and all 60 acceptance tests were authored and SHA-256 frozen
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

`run_proxy.py <app_dir> <github|sheet|github-prose|sheet-prose> [--out report.json]` emits JSON containing
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

'''
    text+='| App | Proxy pass / total | Proxy wall time | Regression pass / fail / error | Regression time |\n|---|---:|---:|---|---:|\n'
    rows=[('Base GitHub','base-github-proxy','base-github-regression'),('Reference GitHub, run 1','reference-github-proxy-1','reference-github-regression'),('Reference GitHub, run 2','reference-github-proxy-2',None),('Base Sheet','base-sheet-proxy','base-sheet-regression'),('Reference Sheet, run 1','reference-sheet-proxy-1','reference-sheet-regression'),('Reference Sheet, run 2','reference-sheet-proxy-2',None)]
    for label,proxy,regression in rows:
        pp=ROOT/'results'/f'{proxy}.json';rp=ROOT/'results'/f'{regression}.json' if regression else None
        pr=json.loads(pp.read_text()) if pp.exists() else {}
        rr=json.loads(rp.read_text()) if rp and rp.exists() else {}
        counts=[];timings=[]
        for name,s in rr.get('summaries',{}).items():
            c=s['counts'];counts.append(f'{name}: {c.get("pass",0)} / {c.get("fail",0)} / {c.get("error",0)}');timings.append(f'{name}: {s.get("seconds")} s')
        text+=f'| {label} | '+(f'[{pr["passed"]} / {pr["total"]}](results/{proxy}.json)' if pr else 'Pending')+' | '+(str(pr['wall_seconds'])+' s' if pr else '—')+' | '+('<br>'.join(counts) if counts else ('—' if not regression else 'Pending'))+' | '+('<br>'.join(timings) or '—')+' |\n'
    for task in ['github','sheet']:
        bp=ROOT/'results'/f'base-{task}-regression.json';rp=ROOT/'results'/f'reference-{task}-regression.json'
        if bp.exists() and rp.exists():
            baseline=json.loads(bp.read_text());reference=json.loads(rp.read_text())
            for name,report in baseline['reports'].items():
                b={x['id']:x for x in report['scenarios']};r={x['id']:x for x in reference['reports'][name]['scenarios']}
                lost=[k for k in b if b[k]['status']=='pass' and r.get(k,{}).get('status')!='pass']
                text+=f'\nRegression case comparison, {task} / {name}: {len(lost)} previously passing cases lost'+(': '+', '.join(lost) if lost else '')+'.\n'
    text+='''
## Requirement inventory

Difficulty describes interaction/state complexity, not a measured agent difficulty.
Easy is a single operation or visibility rule; medium combines state changes and
persistence; hard crosses resources, accounts, or dependent calculations.

'''
    for task in ['github','sheet']:
        text+=f'### {"GitHub" if task=="github" else "Sheet"}\n\n| ID | Type | Original ID | Behavior | Difficulty |\n|---|---|---|---|---|\n'
        for r in yaml.safe_load((ROOT/task/'requirements/requirements.yaml').read_text())['children']:
            text+=f'| {r["id"]} | {r["change_type"]} | {r.get("original_requirement_id","—")} | {r["name"]} | {difficulties[task][r["id"]]} |\n'
        text+='\n'
    text+=prose_section()
    text+='''## Freeze and change log

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

'''
    for task in ['github','sheet']:
        manifest=json.loads((ROOT/task/'FROZEN.json').read_text())
        previous=None
        for version in manifest.get('history',[])+[manifest]:
            text+=f'- {task} v{version["version"]}, {version["frozen_at"]}: {version["reason"]}.\n'
            if previous:
                changed=[name for name,sha in version['files'].items() if previous['files'].get(name)!=sha]
                text+='  Changed files: '+', '.join(f'`{task}/{name}`' for name in changed)+'.\n'
            previous=version
    text+='''
## Limitations and handoff

- The real finals requirements are unpublished. This benchmark samples plausible
  evolution work and cannot establish official finals coverage or score.
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
'''
    (ROOT/'README.md').write_text(text)
if __name__=='__main__':main()
