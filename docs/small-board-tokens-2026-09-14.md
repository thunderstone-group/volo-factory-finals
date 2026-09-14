# Cutting per-run tokens on the two small boards (2026-09-14)

The [token accounting](token-accounting-2026-09-14.md) measured where the small boards spend
their tokens. This task implements the levers it ranked, gates them against the unchanged public
tests, and reports what each one actually bought. Raw per-run and per-replay numbers are in
[`evidence/2026-09-14-small-board-tokens.json`](evidence/2026-09-14-small-board-tokens.json).

## Local before and after

One local generation cohort on `main` (`0b18312`) and three on this branch, through the organizer
gateway, with the models the winning official runs used: `deepseek-v4-flash` for Smoke and
`qwen3.6-flash` for Smoke Evolution. Cost is reconstructed with the accounting document's price
table. Every application was then replayed against its unchanged public tests.

PENDING_TABLE_1

## Local gate

PENDING_TABLE_2

## What changed

**Anchored edits (`volo/agent.py`).** `patch_and_verify` no longer requires the old file text to
come back as model output. An edit names short anchors and only the text that changes:
`insert_after` keeps its anchor and adds text after it, `replace` deletes the text it names, and
an optional `until` anchor bounds a replaced block so a whole block costs two short anchors. Every
anchor must occur exactly once; a file that is currently empty takes `new` as its whole content;
the general menu's `edit` spelling (`old`) still replaces, so a model that copies that shape does
not lose a round trip. In prepared mode the tool also stops asking for a check command it cannot
vary. `tests/test_edit_protocol.py` covers exact match, missing anchor, repeated anchor, insertion,
span replacement, ordering, the empty-file rule and the mutually exclusive fields.

The destructive field is called `replace`, not `old`, because of a measured failure. With the field
named `old`, two of three local evolution counter generations anchored on
`<button id="decrement">Decrement</button>` and replaced it with the new Reset button, deleting a
required control. The rename, plus a prompt that says the named text is deleted, is what fixed it.

**Prepared interface check (`volo/web_runtime.py`).** For a small batch with a browser available,
the harness writes `checks/prepared.cjs` from the literal names the requirement states: every
`test id "x"` must resolve to exactly one element and every `button named "y"` must become visible.
It runs with the model's own behavioral checks, is not shown to the model, and cannot be edited by
it. It costs no model tokens, asserts strictly less than the written requirement, and is not
independent acceptance.

**Requests drop what states nothing.** The batch prompt is compact JSON instead of two-space
indentation; an all-requirements index identical to the current batch, and empty inherited or
asset sections, are omitted. The one-shot request no longer carries an empty file listing, an empty
completed-requirements list, or reference-image observations for a requirement set that contains no
reference images. The `small` and `bounded` scheduling thresholds move from 3,500 and 16,000
characters to 2,100 and 9,400, the old values scaled by the smallest compaction ratio observed
across the five task documents, so no document that used to take the general path becomes one-shot.

**One vestigial file.** `implement` no longer writes an empty `frontend/public/app.js`. The prompt
forbids referencing it, and the empty file in the source snapshot invited two local evolution runs
to try to fill it.

## What was tried and rejected

**Dropping authored checks entirely.** The accounting document ranks "stop emitting `checks_js` on
one-shot tasks" as 28% of the Smoke board cost, on the condition that prepared checks already cover
the requirement. Implemented that way, with only harness-derived presence assertions, one model
call per task was enough every time and the cost fell about 40%. It also shipped applications that
fail the official tests: of eight local evolution generations, three passed every local check while
the public tests rejected them, because presence assertions cannot see that a Reset button has no
handler or that a roll counter never increments. Rejected on the pass-rate constraint.

**Telling the one-shot prompt that test ids are checked elsewhere.** With that sentence in the
build prompt, three of three local Smoke counter generations rendered `id="count"` without
`data-testid="count"` and needed a repair call, which costs more than the checks it saves. The
one-shot build prompt is therefore byte-identical to `main`; only the compact-edit prompt mentions
the prepared check.

**`qwen3.6-flash` on the Smoke board.** It bills 1.2/7.2 CNY per million against
`deepseek-v4-flash`'s 3.0/9.0, so the same request would be about 37% cheaper. Six local
generations needed two model calls in five of them, at CNY 0.0061 to 0.0082 against
`deepseek-v4-flash`'s 0.0044 to 0.0051 on the same code. The Smoke submission stays on
`deepseek-v4-flash`.

## Official trials

PENDING_TABLE_3

## Boundaries and limits

- No public test, evaluator file or official requirement was edited. The public tests were replayed
  unchanged, from the retained 2026-09-11 evidence, and are not bundled in the upload.
- The prepared check is harness input derived from requirement text, not acceptance evidence. Runs
  still report `independent_acceptance: not_configured` unless an operator supplies a contract.
- The derivation only reads quoted literals in two phrasings. A requirement that names a control
  differently gets the fallback check, which asserts only that the page renders without script
  errors. It can under-cover; it is written so it cannot assert more than the requirement states.
- Cost figures are reconstructed from captured usage with an inferred price table. Official token
  counts remain meter deltas on a shared access key.
- One local cohort per configuration is a small sample. The evolution board in particular showed
  real generation variance: repair calls cost two to five times a clean run.
