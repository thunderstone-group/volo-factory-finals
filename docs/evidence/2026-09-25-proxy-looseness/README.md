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
