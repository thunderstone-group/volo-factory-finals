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

Five failures, in the order they were found. Each is a measurement from a real rehearsal, and
each produced a change that is now covered by a synthetic test.

### 5.1 The first extraction produced zero seed rows from a response that named all of them

The model returned `entities` as a mapping, seed fields inline rather than under `data`, and
`type` where the schema said `collection`. The reader rejected every row. The content was right
and only the container was wrong, so `normalize()` now accepts a list, a single item or a mapping
in every position, and the exact wrong-shaped response is pinned as a synthetic fixture. The
schema itself is also now embedded in the extraction instruction, which it was not at first.

A related bug in the same reader: a mapping key was merged over the value's own fields, so an
entity whose *field* was called `name` had its identity overwritten and lost that field. The
mapping key is now carried separately.

### 5.2 The reconciliation reported rows as missing that were present

A seed sentence often carries two quoted strings, the row's title and a message the requirement
also specifies. Requiring every quoted value to appear among the seeds reported such a sentence
unresolved forever. One recognised value is sufficient evidence that the sentence produced a row.

### 5.3 Extraction with default reasoning cost 3.2 times what it needed to

The first extraction ran at the model's default effort and cost 44,187 tokens. Extraction copies
declared values into a fixed shape; it is not a reasoning task. With reasoning disabled the same
package costs 13,677 tokens and still resolves all 26 seed sentences.

### 5.4 The batch loop spent its budget on bytes it already had

Iteration i1 used 33 calls and CNY 2.22 without finishing its first batch. The trace shows where:

| Waste | Calls in i1 | Fix |
|---|---:|---|
| `read_files` over the 12,000-byte bound, retried with smaller sets still over it | 5 | Harness-owned files answer with their contract, not their bytes; product source is delivered in the request |
| `node -e` scripts hunting a syntax error in a file the agent had just written | 9 | `node --check` runs at write time and the parser's own diagnosis is returned |
| Tool calls rejected for argument shape (`{path, content}` instead of `{files: [...]}`; an extra `check_command`) | 2 across i2 and i3 | The write is executed; the intent is unambiguous |

### 5.5 A six-requirement batch could not fit one reply

Iteration i3 lost a batch to a 30 KB `write_files` call that arrived as invalid JSON. Six
requirements of a large application demand more complete files than one reply can carry.
Contract batches are now three requirements or 12,000 characters. That is only safe because the
contract already fixes what the batches share, which is the argument for extracting it first.

### 5.6 One transient gateway 502 discarded eleven paid calls

A rehearsal died on `Gateway HTTP 502` from the gateway's openresty proxy; the same key answered
normally seconds later. The transport retried 429 only. 502, 503 and 504 come from the proxy, so
no upstream answer reached us whether or not one was produced, and retrying costs at most a
duplicate prompt. Request errors are still not retried, and a transport failure of unknown
outcome is still surfaced rather than silently repeated.

## 6. Limits of this work

**The pass counts measure one generation each, not a distribution.** Generation is stochastic.
A second run of the same harness on the same package will not produce the same application, and
these numbers carry no error bar.

**Bookstack is a holdout for the harness, not for the contract's generality.** It was run once,
untouched, after the Keep rehearsal fixed the process. That tests whether the changes transfer to
an app they were not tuned on. It does not establish that the extraction handles requirement
packages written in a different style, and the hidden competition tests are not these six apps.

**No official run was started, so no official score exists for any of this.** Agent verification
and official benchmark scores remain separate facts.

**The efficiency claim is not made.** The review asked that any claim of improved efficiency be
compared against the original process across all generation cost. There is no prior multi-batch
generation on this harness to compare against: before this branch, a package of this size was
never generated. What is measured is cost and pass rate for this process, and the specific
per-iteration savings in section 5, each against the iteration that preceded it.

**`ARC_TEST_DATE` is not honoured.** Section 5.9 of the corpus catalogue asks that server-side
date logic read that variable and that client-side display derive from the browser clock. Keep
and Bookstack pin no date, so this rehearsal could not exercise it. 12306 and ctrip would.

**Seeding idempotence is per data file, not per process.** A second start against the same data
file neither duplicates a row nor resurrects a deleted one. A fresh data file re-seeds from
scratch, which is what the competition runner does and what
`harness_lab/state_rehearsal.py` does between profiles. There is deliberately no reset endpoint:
the corpus has none, and the requirements state durability that a restart-reset would contradict.

**The four-worker profile runs on this machine, not the organizers'.** Absolute wall times are
ours. The corpus catalogue's measurement that artifact capture, not the ten-second budget, is
what breaks a suite locally is the reason both profiles here disable trace and video.

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
