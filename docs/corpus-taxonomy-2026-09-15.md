# What the 478 official tests ask for — mechanical taxonomy of 2026-09-15

Produced by `harness_lab/corpus_taxonomy.py` (run with `.venv/bin/python`; needs PyYAML; writes
`rows.json` beside itself, git-ignored). Keyword rules over each spec's helper calls and
assertions, one primary class per test, hand-checked where rules did not fire. Cross-checked
against run 5's Keep reports. Complements `docs/arc-bench-corpus-2026-09-14.md` (contract).

## Primary behaviour class

| Class | keep | bookstack | SO | prestashop | 12306 | ctrip | total | share |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Read / list | 9 | 5 | 22 | 25 | 19 | 20 | 100 | 21% |
| Auth & session | 0 | 3 | 13 | 8 | 25 | 19 | 68 | 14% |
| Search / filter / sort | 3 | 0 | 3 | 7 | 32 | 23 | 68 | 14% |
| Navigation / reachability | 3 | 4 | 6 | 11 | 14 | 9 | 47 | 10% |
| Update / edit | 3 | 10 | 9 | 4 | 12 | 4 | 42 | 9% |
| Multi-step business flow | 0 | 0 | 0 | 13 | 14 | 13 | 40 | 8% |
| Create | 3 | 5 | 3 | 9 | 8 | 7 | 35 | 7% |
| Delete | 4 | 5 | 3 | 4 | 4 | 10 | 30 | 6% |
| State toggle | 7 | 2 | 4 | 2 | 0 | 10 | 25 | 5% |
| Form validation | 0 | 0 | 3 | 0 | 5 | 6 | 14 | 3% |
| Date-related | 0 | 0 | 0 | 0 | 2 | 3 | 5 | 1% |
| Other (pure widget) | 0 | 0 | 0 | 3 | 0 | 1 | 4 | 1% |
| **Total** | 32 | 34 | 66 | 86 | 135 | 125 | 478 | |

Validation as a secondary class is 41 (mostly under auth: all 28 of 12306's are there).

## How they verify (multi-label)

| Assertion kind | total | share |
|---|---:|---:|
| Text visible | 395 | 83% |
| Toast / dialog / message | 78 (12306 54, ctrip 24) | 16% |
| Role / state | 64 | 13% |
| Cross-page (mutate, then navigate, then assert) | 29 | 6% |
| Count | 22 | 5% |
| Persistence via sign-out and sign-in | 3 (12306 only) | 1% |
| `page.reload()` | 0 | 0% |

318 tests (67%) have text visibility as their only assertion kind; 374 (78%) make exactly one
assertion call. No test reloads; in-memory state passes everything except three 12306 specs.

## Preconditions (multi-label)

| Precondition | total | share |
|---|---:|---:|
| Seed data | 444 | 93% |
| Logged-in state | 135 (undercounted for 12306, whose login hides in composite helpers) | 28% |
| Earlier action in the same test | 119 | 25% |
| Pure UI, no seed | 34 | 7% |

## Structure per app

| Metric | keep | bookstack | SO | prestashop | 12306 | ctrip |
|---|---:|---:|---:|---:|---:|---:|
| Tests asserting inside a secondary view (`open*` other than `openHome`) | 17 (53%) | 31 (91%) | 56 (85%) | 68 (79%) | 108 (80%) | 99 (79%, undercounted) |
| Multi-step flow (primary+secondary) | 0% | 0% | 0% | 27% | 21% | 22% |
| Auth (primary+secondary) | 0% | 9% | 39% | 16% | 28% | 23% |
| Search/filter/sort (primary+secondary) | 16% | 0% | 12% | 9% | 25% | 26% |
| Writes (create/update/delete/toggle, primary) | 53% | 65% | 29% | 22% | 18% | 25% |
| Mean helper calls per test | 6.7 | 5.5 | 6.1 | 5.1 | 4.5 | 5.2 |
| `expectErrorFeedback` tests | 0 | 0 | 0 | 0 | 33 | 14 |
| Distinct fixture names | 13 | 35 | 54 | 36 | 33 | 70 |

Notes: prestashop is a storefront (home, category, product, cart, checkout, auth, My Account),
not an admin back office. Writes anti-correlate with app size; ctrip's difficulty is rendering
70 fixtures correctly, not mutating them.

## Keep run 5 failures against the taxonomy

By class: state toggle 3/7, create 1/3, update 1/3, delete 1/4, read 1/9, search 0/3,
navigation 0/3. Hosted and repo profiles fail the identical set, so these are missing or wrong
behaviour, not timeouts. Six of the seven sit among Keep's 17 secondary-view tests. That is a
projection of the attributed causes, not a separate defect: three are batches capped and rolled
back (2.3.3, 2.5.3, 2.5.4), two are control names inside a dialog that the helper ladder does
not reach (2.7.4, 2.7.5), one is hover-reveal circularity on the home page (2.8.2), one is the
overlay race (4.2). See `docs/keep-attribution-run5-2026-09-15.md`.

## What this changes for the campaign

1. Keep has the lowest secondary-view share of the six (53%); the other five are 79–91%. A
   defect that costs 6 of 17 there scales badly. Secondary views (open a section, assert there,
   state carried across) are the first structural target.
2. Auth, search/filter, multi-step flows and toast assertions are the bulk of 12306/ctrip and are
   near zero in Keep; rules trained on Keep do not cover them. Bookstack is a poor proxy for the
   transactional three; it is a CRUD app like Keep.
3. Quoted error text from the requirements rendered verbatim is a direct scoring item for 12306
   and ctrip only.
4. Persistence is not tested; seed data is (93%). A store is needed for seeding, not for reload.
