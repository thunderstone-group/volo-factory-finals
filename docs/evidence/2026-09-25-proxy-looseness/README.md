# Why the written proxy suite passes what the hidden suite fails (2026-09-25)

Question: on submission 5's GitHub app (`5450c3c63fe0`, hidden 13/100, per-test hidden list known) the 09-24 proxy
suite `gh-suite-np` passed 31. 22 scenarios pass the proxy and fail the hidden suite. Why?

Method: a fresh backend of the platform bundle per probe, fresh browser context per account, start at `/` signed out,
click through without deep links, exact names, strict mode (no `.first()`), 2.5 s per step; chains replay the earlier
hidden scenario on the same backend before the subject scenario. Probes: `probes.cjs`, `facets2.cjs`, `facets3.cjs`,
`chains.cjs` (driver `harness.cjs`), results `probe-results.*.json`, `chain-results.json`. Labels:
`labels-sub5.json` (built by `confusion.py`). Done by a subagent; "confirmed" = reproduced while following the
scenario, "mapping inferred" = a described facet fails but tying it to hidden "Scenario n" is a guess.

## Category counts

| Category | Rows | Count |
|---|---|---|
| A. App defect, proxy assertion loose (regex, neighbouring value, `.first()`, missing THEN check) | 6, 12, 13, 14, 15, 20 | 6 |
| B. App defect on a step or facet the proxy never ran | 1, 3, 4, 5, 17, 19 | 6 |
| D. App seed contradicts the requirements; proxy used its own accounts or records | 8, 10, 11, 16 | 4 |
| E. Broken by an earlier hidden test on the same never-reset app | 18, 22 | 2 |
| C. Two elements match a quoted name (strict mode) | 21 | 1 |
| G. Custom dropdown where the test plausibly uses native-select commands | 9 | 1 |
| F. No failing step found | 2, 7 | 2 |

## Cases

| # | Scenario | Templated? | What the proxy skipped or loosened | First failing strict step, what the app showed | Cat. | Evidence |
|---|---|---|---|---|---|---|
| 1 | REQ-1-1-1 S3 | yes | Re-ran the seed sign-in and a reload; never submitted invalid registration input. | Several invalid fields: no field message; Email is `type=email` without `novalidate`, the browser blocks submit. With `a@b`, "Password requirements are not satisfied" appears twice (strict mode). | B (C) | defect confirmed, mapping inferred |
| 2 | REQ-1-1-2 S3 | yes | Sign in, reload, `.first()`. | Nothing failed. Candidates: two `secret-research` links in the signed-in workspace; org heading "Acme Demo" not `acme-demo`. | F | unknown |
| 3 | REQ-2-1-1 S1 | no | Member instead of visitor; skipped the "Public" filter; regex heading. | Public filter goes to `#/org-repos/Public/acme-demo` = "Not found" (route arguments swapped). | B | confirmed |
| 4 | REQ-2-1-2 S2 | yes | Chose the duplicate-name negative case (passes). | Success case: org heading shows the display name, not the identifier; "Your organizations" lists "Mobile Guild". | B | defect confirmed, mapping inferred |
| 5 | REQ-2-1-2 S3 | yes | Chose the malformed-name negative case (passes). | Same as 4. | B | defect confirmed, mapping inferred |
| 6 | REQ-2-2-3 S1 | no | Checked display name where the identifier is asked; private repo "absent from list" instead of "Access denied". | New member's "Your organizations" has no `acme-demo`; private repo address shows "Not found", not "Access denied". | A | confirmed |
| 7 | REQ-2-2-3 S2 | yes | Unknown account via `getByText`. | Both variants pass. Candidates: dialog error is `aria-hidden`; or member's view as in 6. | F | unknown |
| 8 | REQ-2-2-4 S1 | no | Used a member and repo it created. | bob-reviewer with `Valid-password-123!` = "Invalid credentials": the app seeds bob with an invented `Bob-password-123!`; bob has no personal repo. | D | step confirmed, bob inferred |
| 9 | REQ-3-2-1 S1 | no | Never touched Owner. | Passes clicked through; fails only if Owner is driven as a native select (it is a custom button list). | G | inferred |
| 10 | REQ-3-2-1 S2 | yes | Re-ran creation with its own name. | Duplicate case with `acme-docs` (seed line: owner alice-dev): the app creates `alice-dev/acme-docs` instead of rejecting; afterwards every signed-in exact `acme-docs` link matches two elements. | D (G) | facet confirmed, name inferred |
| 11 | REQ-3-2-1 S3 | yes | Public repo, no README, own name. | Same as 10. | D (G) | inferred |
| 12 | REQ-4-2-1 S1 | no | Never checked the author; `.first()`. | Author only inside "alice-dev · 2 days ago" (exact match fails); no short hash or parent. | A | confirmed |
| 13 | REQ-4-2-2 S1 | no | Only re-checked the file path. | No base/compare id; clicking the file opens the plain file view, not a diff. | A | confirmed, assertion inferred |
| 14 | REQ-4-2-3 S3 | yes | Clicked the repo "Code" nav link (leaves the results); README via tree; regex. | No "Code" result-type link; "search flow" never shown as whole text. | A | defect confirmed, mapping inferred |
| 15 | REQ-4-2-3 S4 | yes | Same as 14. | No-match query + "Code" lands on the overview; "No code results" missing. | A | defect confirmed, mapping inferred |
| 16 | REQ-4-3-3 S2 | no | Registered a fresh non-admin. | bob with the documented password fails sign-in. | D | step confirmed, bob inferred |
| 17 | REQ-4-4 S2 | yes | Chose the success case. | Invalid path shows one combined toast "Invalid file path · Commit message is required" (exact match fails; toast hidden from assistive tech). | B | inferred |
| 18 | REQ-5-4 S2 | no | Fresh viewer; the proxy's S1 failed before closing the issue. | Hidden order: S1 closes the issue then fails (no "Closed issue" activity); issue stays Closed, S2 cannot find it in the Open list. bob (Write) is shown "Close issue". | E | chain confirmed |
| 19 | REQ-6-3-1 S3 | yes | Dropped the Commits-tab check. | No "Commit summary" anywhere. | B | confirmed |
| 20 | REQ-6-3-2 S1 | no | Regex checks and `.first()`. | "4 additions, 2 deletions" across 3 files where one added and one modified file is implied; no diff lines. | A (D) | confirmed, assertion inferred |
| 21 | REQ-6-4 S1 | no | Only counted the "Remove bob-reviewer" button. | Seed already has bob's Approve review, `getByText('bob-reviewer')` matches two elements; review text stays after removal. | C (D) | confirmed |
| 22 | REQ-6-5 S1 | no | `.first()` on "Merged". | Hidden order: REQ-6-1 S1 creates a protection rule on main then fails; with the check pending "Merge pull request" is disabled. Fresh app: "Merged" matches status label and toast; no "Create a merge commit" before Merge; no merger/time/commit id. | E (C, D) | chain and duplicate confirmed |

Possible knock-on (inferred): if the hidden duplicate test in rows 10-11 typed `acme-docs`, every later signed-in
test fails strict mode on the `acme-docs` link (rows 14, 15, 17, 19, 21, 22). Every hidden pass after REQ-3-2-1 on
submission 5 is a visitor test, which fits.

## One generic rule per category (for the test writer and, where marked, the generator)

- **A:** assert every quoted value exactly, on its own element; never a regex, substring, neighbouring value or
  "absent from list" in place of the stated message. After each navigation click, check the intended page.
- **B:** perform every WHEN step literally (filters, scopes), check every THEN clause; give each templated scenario
  its own concrete example from the description, success path first, never only a negative case or a re-run of
  sign-in.
- **C:** never `.first()`/`.last()`/`.nth()` on a quoted name or status; a second match (a toast included) is a failure.
- **D (generator too):** use the seed accounts and records the requirements name, with the one password they state;
  check each GIVEN condition about the seed before acting. Generator: a seeded account whose password the requirements
  do not state uses the password they do state; records the requirements name once are seeded once.
- **E:** run in document order on one never-reset app and treat damage from an earlier test's leftovers as real.
- **G:** unless a dropdown is described as click-to-open options, a test may drive it with `selectOption`.

## Values the requirements never give

bob-reviewer's password (rows 8, 16, 18; the only password stated is `Valid-password-123!`); bob's personal repo
(8); a Maintain account, two Open PRs while REQ-6-2-1 needs one Open and one Closed, a clean start after permanent
merges (22); a Read-only viewer and a "separate protected issue" (18); conflicting ownership of `acme-docs`
(alice-dev in the seed line, the organization in REQ-2-1-1) (10-11).

## Round 2: what the strict suite (v2) still gets wrong (submission 4 app A, submission 5 app B)

v2 calibration (ids fixed): app A proxy-only 10, hidden-only 3; app B proxy-only 9, hidden-only 6 (of the 6, four are
`error` — names like `alice-dev/acme-docs` the requirements never give verbatim — and two `fail`). Probes in
`round2/` (`harness2.cjs`, `probes-*.cjs`, `chain-req13.cjs`, `strict-check.cjs`, `forgot-check.cjs`).

- **No strict-mode failure in any hidden run:** all 176 hidden failures (89 on A, 87 on B) have status `timedOut`; a
  strict-mode violation fails in 0.01 s with its own error. Duplicate matches did not directly fail a hidden test
  unless the hidden helpers retry on errors. This weakens category C of round 1.
- **R (new): the entry a role would use.** Opening `acme-docs` three ways on fresh backends (global search, the
  "Repositories" link, the home-page link), only the home-page link separates the apps: A has none and fails hidden
  REQ-3-3 S1 / REQ-4-3-1 S1, B has it and passes them. v2 reached repositories through search.

| Scenario | App | v2 skipped / loosened / over-asserted | Strict probe, first failing step | Cat. | Evidence |
|---|---|---|---|---|---|
| REQ-1-3 S1 | A | Only the success path. | "short"/"short" shows "Password updated"; empty New+Confirm sets an empty password; mismatch only a toast outside the form. | B | defects confirmed, mapping inferred |
| REQ-1-3 S2 | A | Nothing clear. | Described case passes; candidates: required-field message is a 6 s toast outside the form. | F | inferred |
| REQ-1-3 S3 | A | Confirmation equal to the new password instead of the stated mismatch. | Only "Current password is incorrect"; no confirmation error. | A | defect confirmed, mapping inferred |
| REQ-4-2-3 S2 | A | Opened the repo through search; skipped "filters unchanged". | No repository link from home; no Path/Language filter; results page has no repository navigation. | R, B | differential confirmed |
| REQ-4-2-3 S4 | A | Picked the absent-query example. | Known query: "search flow" never a whole text value; after reload no "README.md" link. | B | confirmed, mapping inferred |
| REQ-4-3-1 S1 | A | Opened the repo through search. | Home page has no repository link; everything after opening passes. | R | differential confirmed |
| REQ-4-3-2 S1 | A | Skipped base, branch history, error cases. | Base not shown; no "Commits" link; an existing name still offers "Create branch: feature-search" and the click does nothing. | B | confirmed, mapping inferred |
| REQ-4-3-2 S2 | A | Unique branch name. | After S1 created `feature/api-v2` the app still offers "Create branch: feature/api-v2", click does nothing. | E, B | chain confirmed |
| REQ-4-3-3 S1 | A | Skipped "main and its commits remain". | No "Commits" link. | B | step confirmed |
| REQ-4-3-3 S2 | A | Fresh non-admin, no earlier change. | After S1 is replayed, the code page shows "Branch release", so "default unchanged" fails. | E | chain confirmed |
| REQ-1-1-1 S3 | A | Over-asserted: password fields empty after a failed submit. | Only that extra check fails. | O1 | confirmed |
| REQ-1-1-2 S4 | B | Over-asserted: "Username or email" keeps the value after failure. | B clears the field; hidden passes. | O1 | confirmed |
| REQ-1-1-3 S3 | B | Over-asserted: unknown email case put in S3. | Hidden S3 tests another case. | O2 | confirmed |

The over-assertions in O1 come only from a parent-folder sentence ("non-sensitive input is retained … password fields
must not redisplay submitted values") that neither atomic requirement repeats. Side finding: on app A "Forgot
password" crashes in a fresh session (`Cannot read properties of undefined (reading 'recovery')`), which explains its
REQ-1-1-3 hidden failures.

Rules adopted in v3 (testgen system prompt): reach records through the entry the role would use, search only when
the scenario searches (R); literal scenario values (A); exercise every failure case a THEN lists (B); fixed names
from the scenario, so earlier tests leave the same state as the hidden suite (E); parent-only principles and cases
the description attaches to another scenario are not asserted (O1, O2).
