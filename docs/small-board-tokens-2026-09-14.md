# Cutting per-run tokens on the two small boards (2026-09-14)

Official cost per task, against the previous winning runs. Every run below passed every official
test. Raw generations, replays, run records and board rows are in
[`evidence/2026-09-14-small-board-tokens.json`](evidence/2026-09-14-small-board-tokens.json).

| Task | Previous winner | Tokens | CNY | This trial | Tokens | CNY | Change |
|---|---|---:|---:|---|---:|---:|---:|
| smoke counter | [`7fa25acde8dd`](https://arc-bench.com/runs/7fa25acde8dd) | 1,731 | 0.008517 | [`981a010fbc40`](https://arc-bench.com/runs/981a010fbc40) | 1,489 | 0.007089 | −16.8% |
| smoke dice | [`d8dcc590abac`](https://arc-bench.com/runs/d8dcc590abac) | 1,576 | 0.007506 | [`f8739c764e5c`](https://arc-bench.com/runs/f8739c764e5c) | 1,373 | 0.006339 | −15.5% |
| evolution counter | [`8c8a9e509ec6`](https://arc-bench.com/runs/8c8a9e509ec6) | 2,976 | 0.011275 | [`b9c65b8dbe00`](https://arc-bench.com/runs/b9c65b8dbe00) | 1,995 | 0.004104 | −63.6% |
| evolution dice | [`97e608e5381c`](https://arc-bench.com/runs/97e608e5381c) | 2,226 | 0.006535 | [`54b8062301b3`](https://arc-bench.com/runs/54b8062301b3) | 1,896 | 0.004015 | −38.6% |
| **Smoke board** | | **3,307** | **0.016023** | | **2,862** | **0.013428** | **−16.2%** |
| **Evolution board** | | **5,202** | **0.017810** | | **3,891** | **0.008119** | **−54.4%** |

On the per-task boards immediately afterwards, VOLO AI is rank 4 on smoke counter, rank 3 on smoke
dice, and rank 3 on both evolution tasks, all at 100% pass and 100% feature implementation. Rank 1
on three of the four is a 24-token entry that runs in one second; the best real agent above us is
Orchestra at CNY 0.002064 and 0.002553 on the two evolution tasks. The aggregate board rows for
VOLO AI still show an older 0.000072 submission, so the aggregate and per-task views disagree; the
per-task rows are the ones that moved.

## Local gate

Four tasks, three cohorts each, generated through the organizer gateway and replayed against the
unchanged public tests in the hosted configuration: application in a 1 CPU / 256 MB container
behind the volo launcher, Playwright 1.57.0 with Google Chrome, workers 4, `fullyParallel` false,
10 s test and expect timeouts, retries 0, trace, video and screenshot off.

| Task | Baseline median CNY | Shipped median CNY | Change | Model calls | Replays fully passing |
|---|---:|---:|---:|---|---|
| smoke counter | 0.008763 | 0.007521 | −14% | 1 in 6 of 6 | 15 of 15 |
| smoke dice | 0.007608 | 0.006159 | −19% | 1 in 6 of 6 | 15 of 15 |
| evolution counter | 0.010853 | 0.005251 | −52% | 1 in 2 of 3 | 15 of 15 |
| evolution dice | 0.011968 | 0.004006 | −67% | 1 in 3 of 3 | 15 of 15 |

Every replay ran the full public suite for its task, one test for smoke and two for evolution, and
every one passed. The baseline column is `main` at `0b18312` measured the same way on the same day,
not the historical official numbers.

## What changed

**Anchored insertion (`volo/agent.py`).** `patch_and_verify` keeps `old`/`new` exactly as it was and
adds `insert_after`: the anchor stays where it is and the new text lands directly after it, so an
added control, handler or test costs only the text being added instead of a rewritten block. Every
anchor must occur exactly once in the file **as the model was shown it**, edits may not overlap, and
a currently empty file takes `new` as its whole content. Resolving all anchors against the original
text fixes a real failure: an earlier edit in the same call used to move the text a later anchor
named, which cost one local run three identical rejected attempts.

**Prepared interface check (`volo/web_runtime.py`).** For a small batch with a browser available,
the harness writes `checks/prepared.cjs` from the literal names the requirement states: every
`test id "x"` resolves to exactly one element and every `button named "y"` becomes visible, using
the same retrying role/name lookups the public specifications use. It runs alongside the model's own
behavioral checks, is hidden from the model's snapshot, is refused as an edit target, and costs no
model tokens. It earned its place: across the local campaign it caught a missing `data-testid` that
the model had simply not rendered, and two evolution edits that deleted the Decrement control while
adding Reset.

**Requests drop what states nothing.** The batch prompt is compact JSON; an all-requirements index
identical to the current batch and empty inherited/asset sections are omitted. The one-shot request
no longer carries an empty file listing, an empty completed list, or reference-image observations
for a requirement set with no reference images. `implement` stops writing an empty
`frontend/public/app.js`, which the prompt forbids referencing and which invited two local runs to
try to fill it. The `small` and `bounded` thresholds move from 3,500 and 16,000 characters to 2,100
and 9,400, the old values scaled by the smallest compaction ratio across the five task documents, so
no document that used to take the general path becomes one-shot. Measured on the four tasks, the
one-shot request falls from 4,530 to 3,730 characters and 4,176 to 3,488.

## Five configurations that were measured and rejected

Each was generated through the real gateway and, where it got that far, replayed against the public
tests. The numbers are in the evidence file under `configurations`.

**Prepared checks instead of authored checks.** The accounting document ranks "stop emitting
`checks_js` on one-shot tasks" at 28% of the Smoke board, conditional on prepared checks covering
the requirement. Implemented that way it was the cheapest configuration measured: CNY 0.00495 and
0.004475 on the smoke tasks, one model call every time. It also shipped broken applications. Of
eight local evolution generations, three passed every local check and failed the public tests: a
Reset button with no handler, a roll counter that never increments. Presence assertions cannot see
behavior. Rejected.

**Telling either prompt that test ids are checked elsewhere.** With that sentence in the one-shot
build prompt, three of three counter generations rendered `id="count"` without `data-testid="count"`
and paid for a repair call, at CNY 0.018 against 0.0075. The same claim in the compact edit prompt
went with the model dropping existing controls in two of three cohorts, and in official run
[`fbc91de510b8`](https://arc-bench.com/runs/fbc91de510b8) it cost nine model calls and 57,301 tokens
on a task that needs one call. Both prompts now state only mechanical facts about the prepared file.

**Renaming the destructive field to `replace`.** Intended to stop the model reading `old` as a
placement locator. Measured across five cohorts it produced one to twenty-six model calls per task,
including a CNY 0.404 run. `old` keeps its name.

**A span anchor (`until`).** Two short anchors were meant to make a block replacement cheap. The
model used it to rewrite everything from a short anchor to `</html>`. Removed.

**An anchorless edit as an append.** The commonest evolution edit is appending a test, and `});`
is never unique, so the official counter run spent two calls discovering that. Treating a missing
anchor as an append made things worse: a model that had merely omitted its anchor appended a whole
replacement file, and one local run spent twenty-three calls and CNY 0.47 recovering. Only an empty
file still takes `new` without an anchor.

**`qwen3.6-flash` on the Smoke board.** It bills 1.2/7.2 CNY per million against
`deepseek-v4-flash`'s 3.0/9.0, so the same request would be about 37% cheaper. Six local generations
needed two model calls in five of them, at CNY 0.0061 to 0.0082 against 0.0044 to 0.0051 for
`deepseek-v4-flash` on identical code. The Smoke submission stays on `deepseek-v4-flash`.

## Official trials

Three submissions, seven runs.

| Submission | Source | Board | Runs |
|---|---|---|---|
| `c580c22370c7` | `04eff10`, ZIP `6b9c497674443c2d30d72b59180ff44074933a0b47868ba79430bb040d477a5e` | Smoke | counter `981a010fbc40` 1/1, dice `f8739c764e5c` 1/1 |
| `e2ee433495b9` | `04eff10`, same ZIP | Smoke Evolution | counter `fbc91de510b8` 2/2 at 57,301 tokens, dice `8718f0e11e26` 2/2 at 1,924 |
| `39b447342506` | `49e4f21`, ZIP `f265c5c88e1661a4d99c56ec5922d9abeba92afa01373cda9784697e1885847c` | Smoke Evolution | counter `b9c65b8dbe00` 2/2, dice `79741e4c25c1` **1/2**, dice re-run `54b8062301b3` 2/2 |

The Smoke submission is `04eff10` and the shipped commit is `49e4f21`; the only difference between
them is the compact-edit prompt, which the one-shot Smoke path never uses, so the Smoke numbers
stand for the shipped code. The evolution board was rerun on `49e4f21` because `fbc91de510b8` had
exposed the prompt claim above.

**The failed dice run is the honest limit of this work.** `79741e4c25c1` made one model call, added
the `roll-count` element, never wired it to the click handler, never extended the authored check,
and passed both local checks: the prepared check asserts that the element exists, and the inherited
check only covers REQ-1. Its re-run on the same submission passed 2/2 in one call. Three local
cohorts of that task had passed 15 of 15 replays beforehand. So this is generation variance that the
local gate does not catch, and the harness has no check that a newly required behavior is actually
asserted. That gap is the obvious next piece of work.

## Meter accounting

The official token count is a usage-meter delta on the shared access key between run start and run
finish. No local gateway call was made while any run on the account was QUEUED or RUNNING: the
generation driver reads `/runs` first and refuses to start otherwise, which it did four times while
another agent's Ticket trials were in flight. Five of the seven runs reconstruct close to their
captured usage. Two do not: `fbc91de510b8` reports 57,301 against 57,301 captured, and
`79741e4c25c1` reports 13,798 against 1,869 captured, an 11,929-token gap on a run that made one
model call. Nothing of ours was billed in that window, so the residual is another user of the shared
key, the same mechanism section 2 of the accounting document describes.

## Cost of the work

138 local generations, 256 model calls, CNY 2.4827 reconstructed, across every configuration
including the rejected ones. The seven official runs cost CNY 0.093 by the platform's own figures,
of which 0.082 is the single nine-call run.

## Boundaries

- No public test, evaluator file or official requirement was edited. Public tests were replayed
  unchanged and are not in the upload. The upload contains no credential.
- The prepared check is harness input derived from requirement text, not acceptance evidence. Runs
  still report `independent_acceptance: not_configured`.
- The derivation reads only quoted literals in two phrasings. A requirement that names a control
  differently gets the fallback check, which asserts that the page renders without script errors.
  It can under-cover; it cannot assert more than the requirement states.
- Local cost is reconstructed with an inferred price table; official cost is the platform's.
- Three cohorts per configuration is a small sample against real generation variance, and the
  failed dice run shows that a clean local gate does not guarantee an official pass.
