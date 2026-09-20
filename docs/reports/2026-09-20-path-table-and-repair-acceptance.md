# Requirement path table, path walk, and the repair that was thrown away

Frozen investigation of the goal-round candidate (`feat/arc-optimization-loop`, `f842e08` base). It
answers two questions the loop controller left open — why 12306 lost 31 tests to one entry, and why
Ctrip scored 0/125 — and lands two carriers for the next round: a deterministic requirement path table
with a local path walk, and an acceptance rule that stops rejecting a repair which fixes a whole-app
failure.

## 1. The replay has to run in the runner's timezone

The same immutable r27a 12306 bundle, replayed locally twice:

| replay | passed | platform `cb1e1d2f9aa0` |
|---|---|---|
| local clock (UTC+8), 2026-09-18 01:57 local | 48/135 | 62/135 |
| `TZ=UTC` | **62/135** | 62/135 |

`helpers.ts` derives its search date from `new Date().toISOString().slice(0, 10)` (UTC), while the
application under test validated its search date against the *browser's* local midnight. At 01:57 on
09-19 local that is 2026-09-18 UTC, so the suite filled a date the app judged past, the search never
navigated, and 18 booking tests died on a locator that was never rendered. On the platform both sides
run in UTC and the same tests get past that step.

Consequence for the harness: **replay with `TZ=UTC`.** A replay in another timezone measures a different
app, and every attribution drawn from it is suspect.

## 2. Ctrip 0/125 was a repair that was rejected, not a wrong app

The goal-round Ctrip run `9a2cdc6656f3` reports `timedOut` for all 125 tests, including
`REQ-1.1: Open Homepage`. Local replay of the downloaded bundle (21.9 MB) reproduces the cause in 3.4 s:

```
frontend script error on load (the page is blank for every test):
  Uncaught [TypeError: this.flights is not a function]
```

The platform log shows the delivery check **did** catch exactly that, plus label collisions and a
readonly picker. The bounded repair ran and was rejected:

```
"repair": {"accepted": false, "reason": "repair renamed quoted control(s): + 添加返程"}
```

The pinned-name rule (added for 12306 r25a, where a repair renamed the quoted `From`) fired on a phrase
that moved during a whole-file rewrite, and the blank draft shipped. This is the fourth instance of the
shape the night of 09-19 named: a gate that is right, and an acceptance rule that throws away the good
part. A blank page is zero on every test; a renamed quoted name costs a family. The rule now reads:
**a repair is kept when it removes a whole-app failure even if a quoted control name moved with it**
(the rename veto still applies to repairs of family-level problems), recorded as
`repair.renamed_but_kept` in the smoke summary.

## 3. 12306's 31 tests were one unreachable menu

31 of the platform run's 73 failures are two locators:

| locator | tests |
|---|---|
| `getByRole('button', { name: /^Personal$/i })` | 18 |
| `getByRole('button', { name: /^Information management$/i })` | 13 |

The UTC replay's error contexts name the mechanism. `openPersonalCenter` clicks the top `My 12306`
entry and then `Personal`; the app rendered `My 12306` as a popover trigger:

```yaml
- button "My 12306" [active]
- menu "My 12306":
  - menuitem "Order center"
  - menuitem "User information"
  - menuitem "Account security"
  - menuitem "My passengers"
```

The requirement (REQ-4.1/REQ-4.3/REQ-4.4) says that entry opens the personal center home page, whose left
menu holds "Personal Center", "Order center", "Personal" and "Information management", and that
"Personal" expands to "User information" / "Account security" / "Verify mobile number". None of those
names existed anywhere, so `firstVisible` fell through all six rungs and returned the button locator that
never appears. The ledger's label for this family (`12306/header-role`) was a misreading of the failure
line: the missing thing is reachability, not the role of a header link.

## 4. The carrier: a path table the requirement already contains, and a walk that runs it

The requirement's scenarios are machine-readable in both shapes the pipeline sees
(`requirements.yaml` on the platform, the same document as markdown locally). `scenario_contract()`
extracts, per ATOMIC scenario: the screen it starts on (from the sentence "open the personal center home
page from the top \"My 12306\" entry"), the names its WHEN step clicks in order, and the names its THEN
step requires on the resulting screen. Rows it cannot stand on locally (a filled form, an order that
exists, a dialog already open) stay in the prompt and out of the walk.

* **Prompt (level 2).** `contract_table()` prepends the rows to the requirement, ~4.2 KB for 12306:
  `REQ-4.3.1 [from personal center + login] click "My 12306" -> "Personal" -> "User information" |
  screen shows: "Essential information", "Contact information", "Additional information"`.
* **Gate (level 4).** The DOM probe walks each executable row in a fresh jsdom page, resolving names
  with the suite's own ladder (button, link, tab, menuitem, option, radio, checkbox, heading, text),
  signing in with the account the requirement names for that row (falling back to the requirement's
  first verified account when a row dead-ends at a sign-in surface), and reports the row id, the name
  and the screen it failed on.
* **Fixed date.** When the requirement declares the current date (`Ctrip: fixed at 2026-07-19`),
  `fixed_date_gaps()` requires that literal in the frontend and names the `new Date()`/`Date.now()`
  lines if it is absent — the suite's fixture dates sit around the declared date, not the machine clock.

Measured on the immutable r27a bundle with its own requirement: exactly three path problems, all true
(`REQ-4.3.1`, `REQ-4.3.5` at "Personal", `REQ-4.4.1` at "Information management"), and none for the nine
other executable rows. On a synthetic app that implements the paths correctly: zero. False positives
removed while building it, each of which is now a rule: state scenarios (a filled form) are prompt-only;
a name mentioned as the thing a step changes *away from* is not required on screen; a name shared by an
entry and a submit control resolves to the button (the suite's ladder order); a row that dead-ends at a
sign-in surface is retried signed in rather than reported.

## 5. What this does not claim

No platform run has been made with these carriers; the loop requires a clean local gate first, and the
target pair is still 12306 + Ctrip. The path walk executes rows the extraction can stand on (12 for
12306) — a row whose precondition is application state is prompt-only and unverified locally. The
fixed-date gate proves presence of the literal, not that the app's bounds use it. Suite score claims
remain the platform's, with run ids, and none is made here.
