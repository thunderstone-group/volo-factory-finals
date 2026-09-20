# Current handoff — 2026-09-20 12:35 (path table + walk measured on the platform; next family is 12306 search results)

Worktree `feat/arc-optimization-loop` on main `248eb65`. The goal round's rejection stands, and this
session's carriers have now been measured on the platform: they fixed the family they were built for and
the controller still rejects the round, because the target pair did not gain three points.

## Current state

- **Attribution, both families, from the platform's own runs.** 12306's 31 failures were one unreachable
  menu (`My 12306` opened a popover, so the personal center the requirement describes never rendered);
  Ctrip's 0/125 was a blank page whose fixing repair the pinned-name veto threw away. Replays must run
  `TZ=UTC`: the same r27a bundle scores 48/135 on this machine's clock and 62/135 under UTC, which is the
  platform's own number.
- **Carriers** (`oneshot/main.py`): the requirement path table in the prompt, the path walk in the DOM probe
  (suite ladder order, per-row account, anonymous first, hover steps, 25 s budget with reported coverage),
  the fixed-date gate, and the acceptance rule that keeps a repair which removes a whole-app failure even
  when a quoted control name moved. `tests_oneshot` 98 green.
- **Round r28** (package sha256 `c7a8bb94…`, Web submission `98cbfb0f4da4`, Lite `a2aac0fad435`): Web pair
  **64.4 / 63.5** against r27's 60.9 / 65.3, no delivery failure, no non-target regression, Prestashop
  +9.3 / +11.6. The platform log of run `01ea1a853d95` shows the path table in the prompt, the walk
  reporting REQ-4.4.1, the repair accepted, and the test diff **fixes the whole personal-center family (27
  tests)** while 15 new failures appear in REQ-3.2.x (result rows, re-search, sort toggles).
- **The controller rejects**: target gain −1.8 points (12306 74/64, Ctrip 26/22; r27 62/75 and 26/32). The
  carriers stay as diagnostics; the family list it prints is stale (it still names `12306/header-role`,
  which this round fixed).
- One Lite run (`9c72d461b1a9`, Lite Keep sample A) was still queued at the platform when this was written;
  `runs/2026-09-20-goal/r28-wait.py` writes `r28-final.json` when every run is terminal.
- Balance CNY 191.28 at 11:20 before the round; the round's own cost column is polluted by the other runs
  on the shared key.

## Next

1. Attribute the **REQ-3.2.x search-results family** on 12306 from the round's bundle
   (`runs/2026-09-20-goal/r28a-12306-bundle`, replay under `TZ=UTC`; a local replay is running).
2. Check the Ctrip app of this round for the same class of fault (its `walk` carries hover and arrow paths
   now); Ctrip stayed at 22–26/125.
3. Only then choose the next single carrier — the controller's rule for the next round is unchanged, and the
   path table/walk stay in the package as diagnostics either way.
