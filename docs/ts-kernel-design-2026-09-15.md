# TS kernel — design of 2026-09-15

Owner: main session (Fable). Decided with the team lead 15:18: rewrite the harness in
TypeScript on branch `feat/ts-kernel`; `feat/state-contract` continues as the fallback package.
Status of this document: draft for GPT-6 review, then frozen as the spec for module dispatch.

## 1. Why a rewrite, in one paragraph

Run 7 (`docs/keep-attribution-run7-2026-09-15.md`) lost 47% of its budget because the model
could not see its own failures, and its two real defects came from a rule added the day
before. Every one of the five root causes lives in the layer where the *model writes the
checks*: TAP parsing of model noise, dedup, idempotence, tmp-debug filtering, `checks/` in the
source snapshot, salvage heuristics, rollback of `checks/`. The rewrite removes that layer: the
harness derives the checks mechanically from `requirements.yaml` and runs them with the
official locator ladder. The model writes product code only.

## 2. Contract with the platform (unchanged, measured)

- Entry `python3 main.py <requirements> --output-dir <out> --type web`; `main.py` is a
  three-line shim that execs `node kernel/dist/index.js` with the same argv.
- Env: `OPENAI_API_KEY`, `OPENAI_BASE_URL` (chat completions only; no Messages API), `MODEL`.
- Container: 1 CPU, 2 GiB, `/dev/shm` 64 MB, outbound network (pip + npm work), Playwright at
  `/opt/arcbench/node_modules/playwright` on the hosted runner, ~2 model calls/min.
- Output: `<out>/frontend` (`npm install && npm run build`) and `<out>/backend` (`npm run
  start`, reads `PORT`); platform starts the backend and runs the hidden suite: 10 s per test,
  4 workers, trace off, `page.goto('/')` only, no reload, seed data assumed present.
- Upload ≤ 50 MB zip. Node 22 on the runner (verify on first run; local is v22.22).

## 3. Modules

One directory per module under `kernel/src/`, one public interface each, no module imports
another's internals. JS/TS in real files; nothing embedded in strings.

### 3.1 `contract` — requirements → contract (port of `volo/contract.py`)

Input: `requirements.yaml`. Output `Contract`:

```ts
type Contract = {
  atomics: Atomic[];            // id, name, description, dependencies, scenarios[]
  seeds: SeedRow[];             // entity, fields, quoted title, owning requirement — deterministic
  literals: Literal[];          // every quoted string with its requirement id
  navigation: NavItem[];        // top-level and sidebar entries named in prose or images
  entities: Entity[];           // nouns with fields inferred from seeds and literals
  order: string[][];            // batches: dependency-respecting groups of atomic ids
}
```

Deterministic parts (quotes, seed sentences) are regex; the model organizes entities and
navigation in one call and `reconcile` reattaches anything it dropped. Same as today.

### 3.2 `runtime` — product scaffold the model never writes

Emitted into `<out>` before batch 1: Express backend on `PORT` with `/api/health` gated on
seeding, JSON-file store with `GET/POST /__factory/store` snapshot/restore, seed loader from
`Contract.seeds`, static frontend from `frontend/dist`, SPA fallback excluding `/api`,
`overlay.js` lifecycle primitive (open sequence, cancel on close, container `inert`). The model
receives a short API card for these and is told they are read-only. Build is `cpSync` from
`frontend/public` unless the model adds a real bundler.

### 3.3 `checks` — scenario → executable check, official ladder

The core. For every scenario of every atomic (fixed denominator: Keep = 32 scenarios, 12306 =
135) produce a `Check`:

```ts
type Step =
  | { op: 'open' }                                   // page.goto('/')
  | { op: 'click', name: Match[], within?: Match }    // clickFirstAvailable via resolveNamed
  | { op: 'hover', name: Match }                     // hoverNamed
  | { op: 'fill', field: Match, value: string }      // fillField ladder: label → placeholder → role textbox
  | { op: 'check', name: Match, checked: boolean }
  | { op: 'expectText', texts: Match[] }             // expectTextsVisible
  | { op: 'expectAbsent', text: Match }
  | { op: 'expectFeedback', kind: 'error'|'success', text?: Match }
  | { op: 'expectField', field: Match, value: string };
type Check = { scenario: string; requirement: string; given: Step[]; when: Step[]; then: Step[] };
```

The ladder (`resolveNamed`, `firstVisible`, `namedLocators` in that exact rung order, names as
case-insensitive regexes with `\s+`) is copied from the public `helpers.ts` into
`kernel/src/checks/ladder.ts` and never edited. Those ten rungs plus `fillField`'s fallback are
the whole locator surface; measured across the 478 public tests the step vocabulary above
covers every helper (`clickFirstAvailable` 192, `clickNamed` 114, `fillField` 92,
`expectTextsVisible` 246, `expectAnyVisible` 80, `expectErrorFeedback` 47, `setCheckbox` 17,
`confirmDialog` 10, `expectFieldValue` 13; app `openX` helpers are compositions).

Compilation is a model call per requirement group with a fixed output schema (the `Check`
JSON), grounded by the contract: names come from the requirement's own vocabulary, texts from
THEN sentences and quoted literals, seeds from `Contract.seeds`. The compiler sees requirements
and contract only, never the public tests. A step it cannot ground is emitted as
`{op:'unknown', reason}` and the scenario counts as unknown, never as pass.

Runner: Playwright Test, `workers: 4`, 10 s per test, trace/video off, one spec file per
requirement generated from `Check[]`, a `reset` fixture that restores the store snapshot
before each file. Output is structured JSON (`{scenario, status: pass|fail|unknown, failedStep,
locatorPending, pageOffers: string[]}`), not TAP. `pageOffers` is the accessible-name list of
the ten rungs at the failing step: the failure digest is a by-product of the runner, never
parsed out of text.

**Acceptance of this module, offline, before any generation**: compile Keep's 32 scenarios,
run them against run 7's delivered app (`runs/2026-09-15-keep-full-7/app`, 22/32 official) and
run 5's (`runs/2026-09-14-keep-full-5/app`, 25/32). Agreement with the official verdict per
scenario ≥ 29/32 on each; every official failure must be a local fail or unknown (no local
pass on an official fail). Then the same on Bookstack against `runs/2026-09-15-bookstack-2`.

### 3.4 `loop` — batches, budget, repair

```
for batch in contract.order (dependency order):
  implement: one call with contract card + runtime API card + relevant product source +
             the batch's Check[] rendered as prose ("the evaluator will hover X then click Y…")
  verify:    run checks for this batch + all earlier batches (regression)
  repair:    ≤ R calls; each gets the structured failure digest of *this* verify only
  outcome:   green → snapshot; not green at R → keep if no earlier-green scenario regressed
             (set difference against the last snapshot's results), else restore snapshot
budget:      CNY, computed from the gateway price table; first pass R = 8 per batch;
             remaining budget after the first pass funds a second pass over batches with
             ≥ 1 unknown/fail, ordered by (fails, cost so far)
deliver:     last snapshot whose regression set is green; final verify without the gateway
```

No stall detection, no read-only heuristics, no rollback of `checks/` (there is none). Tools
for the model: `list_files`, `read_files` (bounded), `write_files`, `edit`, `run` (product
commands only). Rejected tool-call shapes from 9fddc0b carry over as schema validation.

### 3.5 `rules` — skill files, selected per stage

`kernel/skills/<name>/SKILL.md`, front-matter `stage: implement|repair`, `apps: [web]`,
`evidence: <doc>#<anchor>` naming the failure that motivated it. Loader concatenates the files
whose stage matches. Initial set, each ≤ 15 lines: accessible names, hover-revealed row actions
(bare verb **not** an anchored prefix of any navigation name), one visible control per verb
per state, reachable from `/` by clicks, seed rows at startup, form input survives in-form
clicks, dialogs inert their background, quoted literals verbatim. Everything else in today's
`state_runtime.py` prose is dropped until a run proves it necessary.

### 3.6 `deliver` — snapshot and hand-off

Store snapshot + file tree fingerprint per green batch; restore is a file-tree diff apply plus
`POST /__factory/store`. Exit 0 with the last green tree on any end (budget, refusal, error).

## 4. Deleted from today's harness

Model-written checks and everything serving them (§1); `diagnosis_stall_*` and
`source_snapshot` caps; TAP excerpting; interface audit rules subsumed by §3.3 (verb collapse,
one-click walk, chooser inertness, form durability — the check runner exercises the real
path); `patch_and_verify`/`deliver` composite tools; `harness_lab` probes stay as a lab.

## 5. Schedule and bars (preliminary 2026-09-21)

| Day | Deliverable | Bar |
|---|---|---|
| 09-15 | this document reviewed by GPT-6; fallback fixes F1–F6 landed; Keep run 8 on fallback | run 8 ≥ 25/32 |
| 09-16 | §3.1, 3.2, 3.3, 3.6 landed with offline tests | §3.3 acceptance: ≥ 29/32 agreement on runs 5 and 7 |
| 09-17 | §3.4, 3.5; first Keep generation on the kernel | ≥ 26/32, ≤ CNY 10 |
| 09-18 | Bookstack and prestashop, no tuning on them | ≥ 75% each |
| 09-19 | freeze; one official Keep run | senior row |
| 09-20 | slack | |

If 09-17 misses its bar, the fallback package is the preliminary entry.

## 6. Dispatch plan

Design and bars: main session. §3.3 compiler and ladder: codex (GPT-6), with the Keep public
tests as the hidden acceptance. §3.1, 3.2, 3.4, 3.6: Opus, one module per dispatch, interfaces
and fixtures fixed in the dispatch. §3.5 content: main session; loader: Opus. Every module gets
a codex review before merge.

## 7. Open questions for the review

1. Is a model call per requirement group the right granularity for compilation, or one call
   for the whole app with the contract (Keep is 27 KB of YAML)?
2. `pageOffers` at the failing step: ten rungs × visible names could be large on 12306; cap
   per rung at 20 names?
3. Should the runner use Playwright Test or a plain script on `playwright` — the hosted
   runner ships `playwright`, not `@playwright/test`, at `/opt/arcbench/node_modules`.
4. First-pass repair budget R = 8: run 7 healthy batches converged in 4–7 calls including the
   implement call; is 8 too generous or too tight once failures are visible?
