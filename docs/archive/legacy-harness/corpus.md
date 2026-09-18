# Supplied task corpus

Source: [arcbench-harness-lab upstream/data](https://g.ktvsky.com/ai-native/arcbench-harness-lab/-/tree/main/upstream/data),
repository commit `14a0035b5bfa9c8ce214117b8c2345f51b631a62`.
Its lock file declares website source `bb0ef32f9f7eb570d71a5dec29e4d34d1c137390`.
This supplied snapshot is useful preparation material; it does not establish what
the final competition will contain, nor does it exactly match today's live catalog.

## Coverage and evidence boundaries

The snapshot contains **22 requirement documents, 20 unique after semantic deduplication**.
GitHub and Sheets each occur twice under competition and playground paths. The catalog
records exact-byte and normalized-YAML hashes so those duplicates are auditable.

- Six web application packs contain requirement documents and test spec files.
- Ten mobile packs contain requirements but no test spec files in this snapshot.
  VOLO's current runtime builds web applications; parsing these documents is not mobile support.
- GitHub, Sheets, a demo and Ticket Booking provide the other four unique documents.
  The GitHub and Sheets copies here do not include an official executable test suite.

`atomic_requirements` in the catalog counts explicitly typed ATOMIC nodes. The scheduler
also includes leaf nodes without that type: Ctrip has 125 explicitly atomic nodes but
133 scheduled leaves. Spec-file counts are not test-case counts. These definitions
must stay separate when comparing snapshots or live platform totals.

The live competition page observed on 2026-09-11 has four entries: Smoke (2 tasks/2 tests),
Smoke Evolution (2/4), Ticket Booking (1/10) and Ticket Booking Evolution (0/unpublished).
The separate live web benchmark catalog lists six apps and 480 tests. Neither catalog
should be counted as the complete formal preliminary or final task set.

## Compatibility audit

Initial VOLO parsing rejected two supplied trees:

- Ctrip: `REQ-2.6.2` references ancestor `REQ-2`.
- Stack Overflow: `REQ-3.3` references ancestor `REQ-3`.

Expanding those containment references into every descendant made a requirement depend
on itself. VOLO now interprets an ancestor reference as container context, preserving
the original dependency in model input and inheriting the container's external
prerequisites. External folder dependencies still expand into descendant work. Explicit
self-dependencies, missing nodes and true cycles still fail. This is VOLO's scheduling
interpretation, not a claim that the official evaluator prescribes this algorithm.

After the change, **22/22 documents schedule successfully**, including both copies of
GitHub and Sheets. The largest current batch prompts are 46,061 and 38,889 characters
for those two packs, before runtime/file context. This supports testing context pressure
before attempting larger applications; it is not a model-cost or quality measurement.

Reproduce against an authorized local clone, including a clone with no working-tree checkout:

```sh
.venv/bin/python scripts/inspect_corpus.py /path/to/arcbench-harness-lab \
  --output /tmp/volo-corpus-scheduling.json
```

The script checks every YAML byte hash against the pinned catalog, reads with `git show`,
and runs the actual requirement loader and scheduler. It makes no model calls, loads no
reference images, and executes no official tests. It never modifies the upstream clone.
Only metadata and the inspection script are committed here, not copied official tests.

Evidence: [catalog and hashes](../../evidence/2026-09-11-provided-task-catalog.json),
[actual scheduling report](../../evidence/2026-09-11-corpus-scheduling.json).

## Use toward the final

Use published packs for development and failure classification. Keep separately labeled
derived variants for regression checks, and freeze an agent revision before evaluating
held-out variants. Reserve a larger web task for transfer after Ticket Booking works.
Track official evaluation separately from model-authored checks. Mobile execution and
binary visual references require additional runtime work and actual acceptance evidence.
