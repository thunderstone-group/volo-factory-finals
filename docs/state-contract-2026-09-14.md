# A global state contract for multi-page requirement packages

Rehearsed 2026-09-14 on the published `keep` corpus app, with `bookstack` held out untouched
as validation. Model `deepseek-v4-flash` through the organizers' gateway `https://api.arc-bench.com/v1`.
Machine: macOS arm64, Node 22.22.0, Playwright 1.61.1 from the arc-bench clone.
Evidence record: [`evidence/2026-09-14-state-contract.json`](evidence/2026-09-14-state-contract.json).

No official run was started. No corpus test and no public specification entered any generation
prompt; both were used only to score a finished application.

## 1. Results

### 1.1 Official suites against the generated applications

| Application | Batches completed | Runner profile | Workers | Test timeout | Passed |
|---|---|---|---:|---:|---:|
| `keep` (i5) | 7 of 15 | hosted | 4 | 10 s | **17 of 32** |
| `keep` (i5) | 7 of 15 | repo | 1 | 60 s | **17 of 32** |
| `bookstack` (h1) | 8 of 18 | hosted | 4 | 10 s | **11 of 34** |
| `bookstack` (h2) | 11 of 18 | hosted | 4 | 10 s | **15 of 34** |

Repeated against the same unchanged bytes, with no generation running:

| Application | Profile | Workers | Replays | Passed | Always failing | Specs that flip between replays |
|---|---|---:|---:|---|---:|---:|
| `bookstack` | hosted | 4 | 3 | 15, 13, 18 of 34 | 13 | 13 |
| `keep` | hosted | 4 | 4 | 17, 17, 17, 17 of 32 | 15 | 0 |

That difference is the result, not the pass counts. `keep` returns the same number and the same failing set every time. `bookstack` moves by five across three replays of identical bytes, and 13 of its specs flip. The hosted runner uses four workers with `fullyParallel` false, so four spec files exercise one backend and one store at once; the corpus keeps that safe by giving every destructive test its own seeded row. The contract reproduces the rows the prose declares, but a generated application also creates entities during a test, and those collide. A pass count that does not reproduce is not a result, so the Bookstack figure is reported as a range.


Trace, video and screenshots are off in both profiles. `docs/arc-bench-corpus-2026-09-14.md` measures that artifact capture alone costs the organizers' own reference fourteen of its 135 tests.

`keep` (i5) scores 17 under the hosted profile and 17 under the repository profile, on exactly the same specs, while the suite takes 42.9 s against 560.5 s. Six times the per-test budget and a single worker change nothing, which rules out time pressure as the cause and says the controls those specs look for are absent or carry names the helpers' resolution ladder never matches.

### 1.2 The contract itself

| Quantity | Keep | Bookstack |
|---|---:|---:|
| Quoted literals recovered from the prose | 48 | 38 |
| Literals reattached mechanically after extraction | 0 | 0 |
| Seed sentences recovered from the prose | 26 | 29 |
| Seed sentences left unresolved | 0 | 0 |
| Seed rows in the contract | 22 | 32 |
| Entities in the contract | 2 | 7 |
| Extraction cost, tokens | 13585 | 17446 |
| Extraction cost, model calls | 1 | 1 |

Every one of the 22 identities the Keep requirements name reaches the running application: a probe of a generated build served 19 seeded notes and the labels 'Work', 'Reminders', 'Work editable' through the model's own request handler, with `/api/health` answering 200. Nothing declared was missing, including the three private rows each destructive requirement owns ('Delete me 2.3.1', 'Delete me 2.3.2', 'Delete me 2.3.3').

### 1.3 Cost per rehearsal iteration

| Iteration | Batches | Outcome | Calls | Tokens | Cache-hit | CNY | Hosted suite |
|---|---|---|---:|---:|---:|---:|---:|
| i1 | 1 of 10 | no checkpoint | 33 | 1,051,058 | 485,376 | 2.216533 | not scored |
| i2 | 2 of 10 | batch_verified | 21 | 391,126 | 256,512 | 0.651235 | not scored |
| i3 | 2 of 10 | batch_verified | 17 | 392,936 | 208,896 | 1.257952 | not scored |
| i4 | 1 of 15 | no checkpoint | 19 | 409,090 | 347,648 | 0.353184 | not scored |
| i5 | 7 of 15 | failed: Current requirements and workspace checkpoint exceed the context character limit | 50 | 1,295,489 | 917,248 | 1.720258 | 17 of 32 |
| i6 | 7 of 15 | batch_verified | 50 | 1,244,230 | 940,800 | 1.400703 | not scored |
| i7 | 7 of 15 | batch_verified | 105 | 3,039,317 | 2,181,376 | 3.496472 | not scored |
| bookstack h1 | 8 of 18 | batch_verified | 53 | 1,208,626 | 931,584 | 1.290064 | 11 of 34 |
| bookstack h2 | 11 of 18 | batch_verified | 103 | 2,677,942 | 1,888,512 | 3.253532 | 15 of 34 |

Rehearsal total CNY 15.639933, plus CNY 0.397544 for the one Ticket generation used to measure the local gate. Prices are the rate table solved in `docs/token-accounting-2026-09-14.md`, applied to the usage each response reported. No official run was started, so no official charge exists for any of this.

### 1.4 What the contract fixed, and what still failed

Every failing spec of a scored run, split by how far generation actually got. A requirement the run never reached cannot say anything about the contract; a requirement that passed the agent's own check and then failed the official spec can.

| Application | Requirements self-checked | Failed after passing their own check | Failed, never reached | Failed, batch did not complete |
|---|---:|---|---|---|
| `keep` (i5) | 13 | REQ-2.4, REQ-2.6.2, REQ-2.7.1, REQ-2.8.3 | REQ-2.7.2, REQ-2.7.4, REQ-2.7.5, REQ-2.7.6.1, REQ-2.7.6.2, REQ-2.7.6.3, REQ-3.1, REQ-4.2, REQ-5.1, REQ-5.2 | REQ-2.3.3 |
| `bookstack` (h1) | 12 | REQ-4.3.1 | REQ-4.5.1, REQ-4.5.2, REQ-5.2.2, REQ-5.4.1, REQ-5.4.2, REQ-5.5.1, REQ-5.5.2, REQ-5.6.1, REQ-6.1.1, REQ-6.1.2, REQ-6.1.3, REQ-6.2.1, REQ-6.3.1, REQ-6.3.2, REQ-7.1, REQ-7.2, REQ-8.1, REQ-8.2, REQ-9.1 | REQ-4.3.2, REQ-4.4.1, REQ-4.4.2 |
| `bookstack` (h2) | 20 | REQ-4.3.1, REQ-4.3.2, REQ-4.4.1, REQ-4.4.2, REQ-5.6.1 | REQ-6.1.1, REQ-6.1.2, REQ-6.1.3, REQ-6.2.1, REQ-6.3.1, REQ-6.3.2, REQ-7.1, REQ-7.2, REQ-8.1, REQ-8.2, REQ-9.1 | REQ-5.4.2, REQ-5.5.1, REQ-5.5.2 |

How those specs failed, which is the more informative split:

| Failure | Count |
|---|---:|
| test timed out | 38 |

38 of the 38 failures are the spec running out of time and 0 are a failed assertion. That distinction matters, because an assertion failure is the application contradicting the requirement, and a timeout is an interaction that never completed. Not one failure was a missing seed row, a renamed field or a value that did not match: the helpers resolve a control by walking a ladder of roles and falling back to the first candidate, so a control that is absent or carries a name the ladder does not match holds the test until the budget runs out. What the contract set out to prevent did not appear. What is left is control naming and presence, which is a different lever and the one the corpus catalogue ranks next.

### 1.5 Ticket Booking is unchanged

One generated Ticket application, gated five times with this branch's server file and five times with `main`'s restored byte for byte. Same application otherwise.

| Server | Passed per replay | Median suite wall | Failing test |
|---|---|---:|---|
| this branch | [9, 9, 9, 9, 9] of 10 | 15.03 s | REQ-1.1: successfully register a new account and remain signed in |
| `main` | [9, 9, 9, 9, 9] of 10 | 15.32 s | REQ-1.1: successfully register a new account and remain signed in |

The two are identical. That application passes 9 of its 10 public tests, which is a property of that generation, not of the change: both servers agree exactly, replay after replay. Ticket also confirms the routing rule directly, because no contract was extracted for it at all.


### 1.6 No public specification or corpus test reached a generation prompt

`volo/public_specs.py` can put published tests into the generation context, so this was checked
rather than assumed, three independent ways, over all ten retained traces. The script is recorded
in the evidence as `public_spec_leakage`.

| Check | Result |
|---|---|
| `public_specs_supplied` events across all ten generations | **0** |
| Exact lines from the `keep` and `bookstack` published specs found in any message sent to the gateway (159 distinct lines searched) | **0** |
| `load_public_specs()` replayed against each package's fingerprint | returns `None` for both |

The mechanism that excluded them is the fingerprint binding, not luck. The manifest holds exactly
one entry, for `ticket-booking--ticket-booking`, keyed to requirement fingerprint `a22b340306d1…`.
Keep hashes to `cbc9dfa4779c…` and Bookstack to `2cef30f1dff8…`, so the lookup finds no entry and
returns `None`; the event that would announce a bundle is never emitted. The one marker that did
appear in prompts, `@playwright/test`, comes from the harness's own system prompt telling the model
*not* to use that runner.

So the Keep and Bookstack figures are not contaminated as generalization estimates. The generation
side saw requirement prose and reference filenames only.

### 1.7 Cause analysis: what the next iteration should target

Grouped by cause rather than by requirement, because the same defect produces many failures.
Probe scripts and raw output are in the evidence record.

**Cause 1 — one accessible name shared by every row, resolved to the wrong one. Keep, 5 specs.**
The generated Keep application renders each note's actions as always-visible buttons, so the home
page carries **19 buttons named "More options", 19 "Background options", 19 "Archive" and 18 "Pin
note"**. The published helpers resolve a control by role and name and then take `.first()`
(`keep/tests/helpers.ts` `firstVisible`), so `deleteNote(page, 'Delete me 2.3.3')` hovers the right
note and then clicks the *first* "More options" on the page, which belongs to "Sprint goals". A
probe confirms it directly: the element `.first()` picks for `/more/i` and for
`/background options/i` both sit in the "Sprint goals" card. Every test that names a specific note
then acts on a different note, the expected outcome never arrives, and the spec times out. This is
REQ-2.3.3, REQ-2.6.2, REQ-2.7.1, REQ-2.7.2 and REQ-2.8.3.

*Fix to try:* render a row's actions only while that row is hovered or focused, or give each one a
name that includes its row ("More options for Delete me 2.3.3"). The helpers match names as
case-insensitive substrings, so a name that contains the row title still matches `/more/i` while
becoming unique.

**Cause 2 — a required field with no name the helper can reach. Keep, 1 spec.**
`REQ-2.4` fills the note body with `fillField(page, [/note/i, /content/i], …)`. The application
exposes **no placeholder or label matching either pattern** (the probe returns an empty list), so
the helper falls through to its bare `getByRole('textbox')` fallback and types the note body into
the search box.

*Fix to try:* the contract already carries the requirement's exact copy; the generator should also
be required to give every input an accessible name drawn from the requirement's own vocabulary.

**Cause 3 — the requirement was never implemented. Keep 10 of 15, Bookstack 11 of 23.**
The largest single group, and not a defect: the run stopped before its schedule did. Keep never
reached REQ-2.7.2, 2.7.4, 2.7.5, 2.7.6.1, 2.7.6.2, 2.7.6.3, 3.1, 4.2, 5.1 and 5.2. Bookstack never
reached REQ-6.1.1 through 9.1. A probe of the Keep application finds no list/grid toggle at all,
which is REQ-5.1 and REQ-5.2 exactly.

**Cause 4 — implemented behaviour that interferes under four workers. Bookstack, 13 specs.**
Replayed three times against identical bytes on an idle machine, Bookstack returns 15, 13 and 18,
and **13 specs flip between replays. Ten of them are requirements the run implemented and
self-checked and the other three are requirements whose batch it had started; not one is a
requirement it never reached.** The hosted runner uses four workers with
`fullyParallel` false, so four spec files drive one backend and one store at once. The corpus keeps
that safe by giving every destructive test its own seeded row, and the contract does reproduce the
rows the prose declares — but a Bookstack test also *creates* shelves, books and pages as it runs,
and those collide across workers. Keep shows none of this: four replays, 17 every time, same
failing set, because its mutating tests act on rows that already exist.

*Fix to try:* the contract knows which requirements mutate which collection (`mutated_by`). A
generated write path could namespace rows it creates by the requirement that created them, which
is the same convention the corpus uses for seeds. The direct control — replaying Bookstack at one
worker — did not finish in the time available and is the first measurement to take next.

**Cause 5 — self-checked and still wrong. Keep 4 specs, Bookstack 2 specs.**
REQ-2.4, REQ-2.6.2, REQ-2.7.1 and REQ-2.8.3 on Keep, REQ-4.3.1 and REQ-5.6.1 on Bookstack, passed
the agent's own behavioural check and then failed the official spec every time. Causes 1 and 2
explain the Keep four. The agent's checks use the names it chose itself, so they cannot catch a
name that is ambiguous to a resolver walking a fixed ladder.

**Not a cause: the seeded state.** No failure in any scored run was a missing seed row, a renamed
field, a value that disagreed or a screen a later batch could not reach. Every failing spec ran out
of time; none failed an assertion. That is what the contract was built to prevent, and it did not
occur.

### 1.8 Every timed-out Keep spec, by the locator it waits on

All fifteen failures of the scored Keep application, with the locator the spec is pending on and
what the page offers instead. Pending locators come from Playwright's own call log; the "page has"
column comes from driving the running application directly. Raw output is in the evidence under
`spec_locator_probe`; the probe is `probe4.mjs` and the call logs are `calllog/out.txt` and
`calllog/slow.txt` in the session scratch directory.

Re-run at 30 s per test and one worker, the seven that print no call log still time out at 30 s,
so none of these is a slow page.

| Spec | Waits on | The page has | Cause |
|---|---|---|---|
| REQ-2.3.3 Trash list | `getByText(/Delete me 2.3.3/i)` in Trash | the note was never deleted: 19 buttons named "More options", `.first()` is the "Sprint goals" card's | duplicate name, wrong control |
| REQ-2.7.1 Assign label | the note in the label-filtered list | the dialog is correct — "Change labels" ×1, checkbox "Work" ×2 — but the menu opened belongs to the first card | duplicate name, wrong control |
| REQ-2.7.2 Remove label | the note absent from the filtered list | as above | duplicate name, wrong control |
| REQ-2.7.4 Default label on create | the created note under "Reminders" | the composer's own "More options" is not first among 19 | duplicate name, wrong control |
| REQ-2.8.3 Pin on create | `/pinned/i` and the new title | `/pin/i` `.first()` is a card's "Pin note", of which there are 18 | duplicate name, wrong control |
| REQ-2.4 Update Note | `getByText(/Updated editable content…/i)` | **no label or placeholder matches `/note/i` or `/content/i`**, so `fillField` falls through to the bare `textbox` fallback and types into the Search box | missing accessible name |
| REQ-2.6.2 Colour on create | the created note, after choosing "light green" | "Background options" opens, but the palette exposes **no button whose name matches `/light green/i` or even `/green/i`** — the swatch name list is empty | missing accessible name |
| REQ-2.7.5 Edit labels | `getByLabel('Work editable')` or `/label name/i` | "Edit Labels" opens with **one unnamed textbox**; zero match either pattern | missing accessible name |
| REQ-4.2 Detailed settings | `getByRole('button', {name: /save/i})` | after opening Settings: **0 save, 0 cancel, 0 text matching `/bottom/i`** | screen not implemented |
| REQ-5.1 Toggle views | `getByRole('button', {name: /list view/i})` | **0**; `/grid view/i` is also 0 | control not implemented |
| REQ-5.2 Grid by default | `getByRole('button', {name: /list view/i})` | **0** | control not implemented |
| REQ-2.7.6.1 Filter by label | `getByText(/Movie list/i)` to reach count 0 | resolved to 1 element: selecting a label does not filter the list | behaviour not implemented |
| REQ-2.7.6.2 View all notes | both titles visible after clicking "Notes" | same filter defect | behaviour not implemented |
| REQ-2.7.6.3 View Reminders | `getByText(/Call dentist existing/i)` | the Reminders filter shows nothing | behaviour not implemented |
| REQ-3.1 Suggested filters | `getByText(/Call dentist existing/i)` | selecting a suggested filter does not filter | behaviour not implemented |

Rolled up, and this is what the next iteration should attack in order:

| Cause | Specs | What would fix it |
|---|---:|---|
| One accessible name shared by every row, resolved with `.first()` | 5 | Reveal a row's actions only on hover or focus, or put the row's title in the name. Both keep the substring match the helpers rely on. |
| An existing control with no name the helper can reach | 3 | Require every input, swatch and dialog field to carry a name drawn from the requirement's own vocabulary. The contract already holds that vocabulary in `exact_texts`; nothing consumes it as a naming rule yet. |
| Screen, control or behaviour never implemented | 7 | Finish the schedule. All seven sit in batches the run never reached or only started. |

The first two groups are eight specs on an application that implemented seven of fifteen batches.
They are also the two the contract could address directly, because both are about names, and names
are what the contract already carries.

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

`volo/state_runtime.py` writes three backend files the model does not author, and the contract
supplement states the boundary between them and `backend/api.cjs`, which the model does author:

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

Contract batches hold three requirements or 12,000 characters, half what the size-only
scheduler uses, because six requirements of a large application demanded more complete files
than one reply could carry (section 5.5). On Keep that produces 15 batches against the size-only
scheduler's 6.

### 3.6 Cross-batch regression

Each batch writes its checks to a new `checks/<batch>.spec.cjs` and leaves earlier files alone.
`Workspace.discovered_check_command()` already aggregates every `checks/*.spec.*` file, and
`browser_checks()` executes standalone browser checks in addition to the named command, so a
regression in an earlier batch fails the current batch without any new machinery.

Every prompt rule Ticket depends on is retained: the batch system prompt is the unchanged
`SYSTEM` plus a contract supplement. The nav-race rule, accessible names, `role="alert"`
regions and named `<meter>` controls are all still stated.

## 4. What the rehearsal cost, and where it went

The rehearsal spent CNY 15.64 across 7 Keep iterations and the holdout. Where it went, and what each fix bought:

| Change | Measured effect |
|---|---|
| Contract extraction at default reasoning effort | 44,187 tokens; with reasoning disabled the same package costs 13,677 and resolves the same 26 seed sentences |
| Harness files answered with their contract instead of their bytes | removes a 14 KB read the agent made repeatedly, and the retries it spent hitting the 12,000-byte bound |
| Product source delivered in the batch request | `read_files` is not needed to see the application at all |
| `node --check` at write time | run i1 spent 9 of 21 calls locating a syntax error the parser already knew the position of |
| Batches halved to three requirements | run i3 lost a batch to a 30 KB tool call that arrived as invalid JSON |

Cache hits dominate the prompt cost: the contract and the product source are re-sent inside a batch, and the gateway bills a cache hit at 0.1 CNY per million against 3.0 for a miss. That is why i4 cost CNY 0.353 against i1's 2.217 on a comparable token count.

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

**The obvious control on Bookstack's instability was not run.** Replaying it at one worker would
say directly whether four-way concurrency is the cause, rather than leaving that an inference from
how the corpus seeds one private row per destructive test. The repository profile takes 60 s per
failing spec, and with about twenty of them the replay did not finish inside the time available.
It is the first measurement to take next.

**No scored run had the repair bounds this branch now carries.** The rehearsals ran before
`main`'s repair-loop work was merged in, and the largest single cost in them is a batch repairing
itself: one Keep batch spent thirteen calls applying one edit at a time. That work bounds exactly
this, so the merged head should do better than every number here. Nothing in this document
measures the two together.

**No scored run implemented its whole schedule.** Keep schedules 15 batches and Bookstack 18,
and the runs reported here stopped earlier: the default `FACTORY_MAX_CALLS` of 32 was raised for
these rehearsals, and the binding constraint became wall time on a machine running several
agents' generations at once. Every pass count below therefore measures a partially implemented
application, and section 1.4 separates the requirements a run never reached from the ones it
implemented and still failed. A batch costs five to thirteen model calls, most of it repair, so
a package of this size needs a call budget in the low hundreds rather than the default 32.

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
