# A global state contract for multi-page requirement packages

Rehearsed 2026-09-14 on the published `keep` corpus app, with `bookstack` held out untouched
as validation. Model `deepseek-v4-flash` through the organizers' gateway `https://api.arc-bench.com/v1`.
Machine: macOS arm64, Node 22.22.0, Playwright 1.61.1 from the arc-bench clone.
Evidence record: [`evidence/2026-09-14-state-contract.json`](evidence/2026-09-14-state-contract.json).

No official run was started. No corpus test and no public specification entered any generation
prompt; both were used only to score a finished application.

## 1. Results

PLACEHOLDER_RESULTS

## 2. The problem this addresses

`volo/requirements.py` schedules a requirement package into batches of at most six nodes or
24,000 characters, and `batch_prompt` gives a later batch only the **names and dependencies**
of earlier ones. That is adequate when the whole package is one batch, which is the case for
Ticket Booking (2 ATOMIC nodes) and for both small boards (1 node each).

It is not adequate for the packages the formal competition will use.
[`docs/arc-bench-corpus-2026-09-14.md`](arc-bench-corpus-2026-09-14.md) measures the published
corpus: 460 ATOMIC requirements across six apps, and **426 of them depend on state declared once
in requirement prose**, with no reset API anywhere in the corpus. An identity is stated in one
requirement's `description` as a trailing sentence and then assumed silently by every later
requirement that touches it.

Independent batches must therefore agree, without seeing each other, on:

| Shared thing | What a disagreement costs |
|---|---|
| Seeded rows and their exact titles | The row the later test looks for does not exist |
| Entity fields | One batch writes `isPinned`, another reads `pinned` |
| Exact visible copy | A paraphrased button label matches no assertion |
| Click path from the entry page | A screen exists but the evaluator cannot reach it |
| HTTP shapes | Two batches serve incompatible versions of one resource |

The evaluator cannot navigate by URL, read an id, a class or a `data-` attribute, and matches
visible text and accessible names as case-insensitive substrings
(`scripts/audit-benchmark-tests.js:39-46`). So none of the above can be papered over by a
selector: a name that does not match is a test that does not pass.

## 3. Design

### 3.1 One call, before any page exists

`volo/contract.py` extracts a machine-readable contract from the **complete** requirement
package in a single model call, before generation starts. `main.py` runs it when, and only
when, `requirements.batches()` returns more than one batch. A single-batch package therefore
takes exactly the path it took before: no contract call, no seeder, and `backend/state.cjs`
absent, which leaves the server's new state hook inert. Ticket Booking and the small boards are
unaffected by construction, not by configuration; there is no switch to set.

The contract's top-level keys are `app`, `entities`, `seeds`, `exact_texts`, `navigation`,
`persistence`, `api` and `conventions`. `contract.document()` renders it with a fixed header and
every batch receives that text verbatim.

### 3.2 The model organizes; it cannot lose

The load-bearing property is that **no named identity can disappear between the requirement
prose and the contract**, and that this is mechanical rather than a hope about the model.

* `quoted_literals()` recovers every quoted string in every node, attributed to the requirement
  that states it. Image paths and URLs are excluded.
* `seed_sentences()` recovers every sentence that declares pre-existing state, after stripping
  image references and the captions they leave behind.

Both run without a model. They are handed to the extraction call as evidence, and afterwards
`reconcile()` checks the returned contract against them: any quoted literal that does not appear
anywhere in the contract is reattached to its own requirement's `exact_texts`, and any seed
sentence whose quoted values reached no seed row is reported in `unresolved_seed_sentences`,
which is also delivered to the batches. The audit block records both counts on every run.

On Keep the extraction declared 48 quoted literals and 26 seed sentences. The accepted contract
carried 22 seed rows with **0 unresolved seed sentences**.

### 3.3 `normalize()` reshapes rather than re-asks

The first real extraction returned correct content in a container of its own invention:
`entities` as a mapping instead of a list, seed fields inline instead of under `data`, `type`
instead of `collection`. A strict reader produced **0 seed rows from a response that named all
22**. Reshaping costs nothing; a second call to correct the shape costs a call. `normalize()`
accepts a list, a single item or a mapping in every position, and `tests/test_state_contract.py`
pins that exact wrong-shaped response as a synthetic fixture.

### 3.4 Startup contract in the generated application

`volo/state_runtime.py` writes three backend files the model does not author:

| File | Role |
|---|---|
| `backend/seed.cjs` | the contract's rows, as data. Generated by the harness, never by the model |
| `backend/state.cjs` | a persistent store and a readiness promise |
| `backend/server.cjs` | the existing runtime server, now with a `/api/health` gate |

Seeding is **applied at most once per data file**: `state.cjs` records applied seed ids, so a
second start neither duplicates a row nor resurrects one the user deleted. That is ordinary
persistence, not the reference implementation's restart-reset, which would contradict the
requirements' own durability statements.

`/api/health` answers `200 {"code":200,"message":"Backend Ready"}` only after the seed
transaction commits, and `503 {"code":503,...}` while it is pending or has failed. Because
product code requires `state.cjs` at load time, a broken seeder must not prevent the process
from binding its port; the seed require is guarded and the failure is deferred into the
readiness promise, so a broken seed is observable as a 503 rather than as a dead port.

`volo/workspace.py` polls `/api/health` before `/` whenever `backend/state.cjs` exists, and
refuses the application if readiness never arrives. Applications without startup state are not
health-gated at all.

One further change: `backend/data` is excluded from the workspace fingerprint and file listing,
matching what `harness_lab/local_gate.py` already does when staging. Without it, a check that
mutates a seeded row changes the source fingerprint and invalidates the verification it just
passed.

### 3.5 Batching by shared state

`state_batches()` keeps the topological order of the requirement graph and closes a batch when
the next requirement would put **disjoint** shared state in the same conversation: two
requirements mutating different collections are the pair most likely to invent conflicting
shapes for them. A requirement touching no shared state conflicts with nothing and fills space.
A top-level folder boundary also closes a batch once it is at least half full, so a screen and
the behaviour on it stay together without producing a batch per requirement.

On Keep this produces 8 batches against the size-only scheduler's 6.

### 3.6 Cross-batch regression

Each batch writes its checks to a new `checks/<batch>.spec.cjs` and leaves earlier files alone.
`Workspace.discovered_check_command()` already aggregates every `checks/*.spec.*` file, and
`browser_checks()` executes standalone browser checks in addition to the named command, so a
regression in an earlier batch fails the current batch without any new machinery.

Every prompt rule Ticket depends on is retained: the batch system prompt is the unchanged
`SYSTEM` plus a contract supplement. The nav-race rule, accessible names, `role="alert"`
regions and named `<meter>` controls are all still stated.

## 4. What the rehearsal cost, and where it went

PLACEHOLDER_COST

## 5. What broke, and why

PLACEHOLDER_BROKE

## 6. Limits of this work

PLACEHOLDER_LIMITS

## 7. Reproducing

```bash
# Extract and inspect a contract without generating anything.
python main.py <requirement-dir> --output-dir /tmp/inspect --inspect

# Generate, with the organizers' gateway supplied by the environment.
OPENAI_BASE_URL=... OPENAI_API_KEY=... MODEL=deepseek-v4-flash \
FACTORY_PLAYWRIGHT_MODULE=<clone>/node_modules/playwright \
  python main.py <clone>/arc-bench/webapp/keep/requirements --output-dir /tmp/keep-app

# Score it against the official suite, fresh data, both runner profiles.
python harness_lab/state_rehearsal.py --app keep --app-dir /tmp/keep-app \
    --profile hosted --json /tmp/keep-hosted.json
python harness_lab/state_rehearsal.py --app keep --app-dir /tmp/keep-app \
    --profile repo --json /tmp/keep-repo.json
```

`harness_lab/state_rehearsal.py` starts the application itself on a fresh data directory,
waits for `/api/health`, and writes its four-worker Playwright config into the session scratch
directory. The corpus clone is never modified.
