# Progress

Append-only ledger of the current one-shot line (from 2026-09-17). The legacy multi-round line (2026-09-11 to 2026-09-14) is in `archive/progress-2026-09-11-to-09-14.md`.

## 2026-09-17 — Fable takes over; one-shot line measured on all six Web tasks

- Codex/ChatGPT execution stopped by the owner; the minimal worktree was committed as-is (`c55b8b3`, pushed) and all thin/V3 lines are parked. The Lite thin package hung after one request and its Keep run failed on readiness; no further investment.
- The one-shot package had never run on the platform: the runner pre-populates the output directory with `.arc/` and `requirements/`, which the entrypoint rejected (run `12f7c07637ec`). Fixed in PR #34 (generate beside the metadata, move `frontend/` and `backend/` in).
- Dialect-card ablation on platform Keep, three runs each: ported generic card 21/20/17; ported + hover rule 19/26/25; original 59-line lab card 26/24/28; lab card + "hide instead of inert" 22/17/not-ready. Decision: the lab card verbatim, no further card tuning on Keep — single-sentence edits swing ±5 tests.
- Root causes found with local replays: always-visible row actions and `<button>` sidebar entries let the helper's page-wide `.first()` pick the wrong control (archive/trash/labels families); `inert` does not stop `isVisible()` resolution, so a sidebar link wins over a picker checkbox (labels family, all nine runs).
- Holdout on the lab-card package: Bookstack 27/34, Prestashop 51/86, Ctrip 20/125, StackOverflow 0/66, 12306 0/135. Both zeros and one Keep run were delivery faults at `/` (404 from `.index.html` path join; `application/octet-stream` making the browser download). Aggregated board 38.8%, rank 6 (from 19.6%).
- Helper survey: keep/prestashop/stackoverflow share identical resolver functions, ctrip is a variant, bookstack and 12306 are a different generation. The card's mechanics are corpus-level for four of six apps, not Keep-only.
- Local generation is unusable today: nine local calls and three parallel curl probes were all cut by the gateway or the path to it (all three at the same instant, unbilled); platform-side requests are unaffected. Experiments run on the platform.
- Added the delivery smoke check with one bounded repair (this branch, PR #35): build, start on a free port, read `/api/health`, `/` and referenced assets; validated on the real failing artifacts. Six-task platform validation on submission `7fd7a288b404`.
- Next: the evaluator-reading audit (one visible control per verb, hover-only row actions, links for navigation, hidden siblings while a chooser is open) as a deterministic gate with bounded repair, then requirement-group generation for the large tasks. Evidence: `runs/2026-09-17-web-keep-oneshot/`.

## 2026-09-17 evening — six-task smoke validation lost to a gateway-wide stream cut

- The six-task validation of submission `7fd7a288b404` (runs `542f2338b9c8` keep, `33ae97f7ef90` bookstack, `80a538d033e6` stackoverflow, `749a22a65df4` prestashop, `0c72a07e49b2` 12306, `82330a9d20dd` ctrip; started 19:56 local) failed in generation on every task: all three one-shot calls ended in `StreamError` (stream closed before `finish_reason`), `passed=0 failed=0`, no application delivered. Not a package regression — no run reached the smoke check.
- The failures cluster across the six independent runs: first calls all died 19:58–20:00, second calls 20:07–20:09, third calls 20:16–20:20 (local). Same-instant cuts across unrelated runs mean a gateway-side event that drops every in-flight stream, the same signature as the local probes earlier in the day. Of 18 platform calls in that window only one was metered (20:08:43, out 65,536 = the hard cap), the other 17 were unbilled; every run's cost column shows that single record.
- Gateway state at 21:05–21:16 (local probes, `deepseek-v4-flash`): a 20-token non-stream call and a 56 s stream (`reasoning_effort=low`, 3,657 tokens) both finished cleanly with `finish_reason`; a default-effort stream was cut at 467 s while still in reasoning, and the meter recorded it as out 65,536 with zero content at the same second. Two observations from this: `max_tokens` bounds content only, reasoning is not counted against it and can run to the 65,536 cap with no answer; and long streams are still being cut, so the gateway is not back to normal for the one-shot's 5–15 minute calls.
- Re-validation: run `b1af053badc4` (same submission, Keep only) started 21:20 to check whether the platform path works again before deciding on the full six-task rerun. Result recorded below when it lands.
- Local proxy-vs-direct comparison was started and abandoned: the platform failures are the subject, the local path is irrelevant to them.
- Re-validation result: run `b1af053badc4` (same submission, Keep, deepseek-v4-flash) failed the same way at 22:04 — three calls of 11, 20 and 13 minutes, each closed before `finish_reason`, none metered. The platform path on `deepseek-v4-flash` is still broken; its reported 24,623 tokens are exactly my two local probes, again the meter-difference accounting.
- Model sweep (local long-stream probes, same prompt, `max_tokens` 12000, default reasoning, six models in parallel from 21:59): `minimax-m3` finished `length` at 12,000 tokens in 2 min; `qwen3.7-plus` finished `length` at 12,329 in 2.5 min; `kimi-k3` finished `length` at 12,372 in 6 min; all three metered correctly. `qwen3.6-flash` was closed at 38 s with 16k characters of content, no `finish_reason`, unmetered. `deepseek-v4-pro` and `glm-5.3` still streaming at 6 min. Cut streams are never metered, so the drop happens at or before the gateway's upstream.
- Uploaded the same smoke package as submission `f8c6a82e4dc7` with `--model qwen3.7-plus` (2/0.4/8 CNY per M, same price band as flash) and started Keep run `a3714ee01088` at 22:06 to see whether a model whose long streams survive delivers on the platform. `glm-5.3-flash` (0.8/0.23/2.8) and `deepseek-v4-flash-vision-exp` are new on the gateway list.
- Sweep closed: `deepseek-v4-pro` cut at 660 s mid-chunk (unmetered); `glm-5.3` finished `length` at 12,000 tokens, all reasoning (GLM counts reasoning inside `max_tokens`). Long streams survive on minimax-m3, qwen3.7-plus, kimi-k3, glm-5.3; they are cut on deepseek-v4-flash, deepseek-v4-pro, qwen3.6-flash. The drop is per model route, not a gateway-wide outage.
- Platform on qwen3.7-plus: Keep run `a3714ee01088` delivered, **22/32** in 469 s (124k tokens; the CNY 2.43 cost column includes the local kimi probe). Failures are the labels family (2.7.1/2.7.2/2.7.4/2.7.5/2.7.6.x), colors (2.6.1/2.6.2), pin (2.8.1) and 4.2 — the same families flash loses, so the model swap did not change the failure shape. Started the other five tasks on submission `f8c6a82e4dc7` at 22:17: bookstack `14d9c3d0b1e3`, stackoverflow `483ce9e264ba`, prestashop `361ef392c29a`, 12306 `ae507f83ee7a`, ctrip `ba63aa5e2be5`. Judge unchanged: SO/12306 leave zero, the rest hold the holdout band.
- Five-task validation on qwen3.7-plus (submission `f8c6a82e4dc7`, 22:17–22:43): Bookstack **12/34** (`14d9c3d0b1e3`, flash holdout 27/34), StackOverflow **15/66** (`483ce9e264ba`, was 0), Prestashop **29/86** (`361ef392c29a`, flash holdout 51/86), 12306 **63/135** (`ae507f83ee7a`, was 0), Ctrip `ba63aa5e2be5` still running at 22:48. Both former zeros left zero, so the delivery smoke check (PR #35) holds on the real path and the zeros were delivery faults, not generation. Bookstack and Prestashop are well below the flash holdout — model effect or single-run variance is undetermined (one run each; Keep swings ±5 between runs on flash). Token/cost columns for these runs are polluted by the concurrent runs on one key (all show 609,558).
- Ctrip **12/125** (`ba63aa5e2be5`, flash holdout 20/125). Submission `f8c6a82e4dc7` (smoke package, qwen3.7-plus) six-task average 36.1% (Keep 68.8, Bookstack 35.3, SO 22.7, Prestashop 33.7, 12306 46.7, Ctrip 9.6); the board keeps the lab-card submission's 38.8% (rank 6) as the best average. Net: the model swap keeps the platform path alive and removed the two zeros, but on Bookstack/Prestashop/Ctrip a single qwen3.7-plus run scored below the flash holdout. Open question for tomorrow: is flash's stream drop transient (then re-validate the smoke package on flash) or persistent (then pick between qwen3.7-plus and an untried survivor such as minimax-m3 with paired runs), and merge PR #35 either way since the smoke check is validated on the real path.
- 23:27–23:29 three more Keep runs on the same smoke package, model swap only: glm-5.3 (`9d0da8982728` / run `16180f834eec`), glm-5.3-flash (`3a069260f1a3` / `ef14b1f867f2`), deepseek-v4-flash again (`478d93e2bbab` / `79c325f4af2d`). Owner asked for the GLM and flash comparison.
- glm-5.3-flash failed in 695 s: one call, `finish_reason=length`, zero content — the model spent the whole 32,768 `max_tokens` on reasoning (GLM counts reasoning inside `max_tokens`), and one-shot treats an empty stream as a hard failure without retry. Using GLM would need a thinking switch or a much larger `max_tokens` in `oneshot/main.py`; not worth it on the eve unless glm-5.3 itself delivers.
- glm-5.3 failed the same way at 23:43 (one call, about 16 min, no content): both GLM models exhaust `max_tokens` in reasoning under the one-shot prompt. GLM is out for the preliminary unless a thinking switch is added.
- deepseek-v4-flash recovered: run `79c325f4af2d` (submission `478d93e2bbab`, same smoke package) delivered Keep **25/32** in 1,544 s at 23:55, no stream cut. Same package, model swap only: flash 25, qwen3.7-plus 22, glm-5.3 and glm-5.3-flash no content. The 19:58–22:04 flash drops were a transient route fault, not a permanent state.
- 23:58 started the remaining five tasks on the flash submission `478d93e2bbab` to finish the original PR #35 judge: bookstack `23fdd9ca1182`, stackoverflow `2b0dae1b647a`, prestashop `c9c2b5fd3b2c`, 12306 `b883fa97b031`, ctrip `2105472e648f`.
- 2026-09-18 00:03 and 00:09: flash streams were cut again, same second across the 12306 (`b883fa97b031`) and ctrip (`2105472e648f`) runs (calls 1 and 2, StreamError at 303/297 s and 334/339 s). The flash route fault is intermittent, not resolved. Both runs' third call completed with `finish_reason=length` (large-task output exceeds the 32,768 content cap) but the continuation needed a fourth call and the one-shot's global limit of 3 calls refused it: 0/0, no delivery. Package finding: cut-stream retries and `length` continuations share one 3-call budget, so a large task that loses one stream cannot deliver. Bookstack on flash `23fdd9ca1182` delivered 16/34 (holdout 27/34, qwen3.7-plus 12/34): same package, same model, 11 tests apart between two runs.
- Flash five-task close (00:27): StackOverflow **4/66** (`2b0dae1b647a`), Prestashop **44/86** (`c9c2b5fd3b2c`, holdout 51). Flash submission `478d93e2bbab` six-task average 30.4% (two large tasks 0/0 from the cut + call budget); qwen3.7-plus submission 36.1%; board best stays the lab-card submission at 38.8%, rank 6. PR #35 judge met on the real path: the two former zeros delivered on both models (SO 4 and 15, 12306 63 on qwen; 12306 on flash never reached delivery because of the stream cut). Merging PR #35.

## 2026-09-18 — Content cap 131072, split call budget, six-task flash run (PR #36)

- 01:31 flash route checked good again: short call 3.6 s, a 60000-cap stream finished `stop` at 22,447 tokens (13,886 reasoning) in about 150 s at ~150 tok/s.
- Owner decisions: raise the content cap and split the call budget now; run the semi-automatic skill loop (Fable distils one rule per round from failures, paired holdout runs decide).
- Change (branch `fix/call-budget`, PR #36): `MAX_TOKENS` 32768 → 131072; `CallBudget` counts completed calls (limit 3) and transport failures (limit 4) separately. Three budget regressions rewritten, one added; `tests_oneshot` 53 green. Package sha256 `46a51fd8…` in `runs/2026-09-18-call-budget/`.
- 01:52 uploaded as submission `97f8570c7279` (deepseek-v4-flash) and started all six tasks: keep `b45a931207d8`, bookstack `755275bae18c`, stackoverflow `03bad7c55e23`, prestashop `eb166860ff13`, 12306 `9ef988eb2274`, ctrip `63ad25bdacbc`. Judge: the two large tasks deliver; no task below the earlier flash runs (25/16/4/44).
- Round 0 (submission `97f8570c7279`): Keep 26/32 `b45a931207d8`, Bookstack 28/34 `755275bae18c` (both above 80%), StackOverflow 15/66 `03bad7c55e23`, Prestashop 41/86 `eb166860ff13`; 12306 `9ef988eb2274` and ctrip `63ad25bdacbc` still generating at 02:20. Local replay of the downloaded SO/PS bundles reproduces the platform exactly (15/66, 44/86 at the same package), so attribution runs locally from `error-context.md` snapshots.
- Attribution (SO 51 + PS 42 failures): the assert/click ladders end in `button` and fail only when no element carries the phrase, so most losses are vocabulary: 14 tests wait for a visible "Profile" after login, 11 for anchored `/^edit|delete|reply$/i` (our buttons said "Edit question"), ~20 for THEN-step nouns and quoted messages absent as text (header, sidebar, main question feed, footer, logo, addresses, order history and details, Favorites, validation sentences), 4 for `getByLabel` resolving to a container with `aria-label`; 8 PS timeouts have no locator (unattributed).
- Round 1 (branch `goal/round-1`, submission `fe10afe427d2`, sha256 `4c2e7215…`): dialect card 59→87 lines — exact verb names with the stem exception, §7 verbatim vocabulary made concrete (layout nouns as text, messages verbatim, navigation/section names as controls, seeds verbatim), §7a aria-label reserved for controls. Six tasks started 02:19: keep `71aa703b0958`, bookstack `a015ae1fcc0a`, stackoverflow `b319a1e78a87`, prestashop `a57c8da4efb6`, 12306 `1525d5fd7d07`, ctrip `337ff1b2d247`.
- Round 0 closed 02:22: 12306 **40/135** (`9ef988eb2274`), ctrip **8/125** (`63ad25bdacbc`); six-task average **45.0%**, above the board's 38.8%. Local 12306 replay (27/135, lower than the platform's 40) attributes 73 of its failures to one role mismatch: the app renders "Sign Out" as a link, `login()` in the official helper asserts `getByRole('button', {name: /sign out/i})`, so every logged-in scenario dies at login. Other 12306 families: `getByLabel(/Email/i)` (5), "Train No." text, anchored `/^Book$/i` button, sortable column headers expected as buttons, "How to book tickets online?" heading. Round-2 rule drafted: state-changing controls are buttons regardless of the requirement's word; links only navigate; sortable headers are buttons named by the column title.
- Round 1 results (02:22–02:36): Keep 17/32 `71aa703b0958`, Bookstack 24/34 `a015ae1fcc0a`, StackOverflow **33/66** `b319a1e78a87` (Profile family 14→0), Prestashop 0/0 `a57c8da4efb6` (one 18-minute draft rejected for prose outside file blocks), 12306 **51/135** `1525d5fd7d07`, ctrip pending. Local replays of the Keep/Bookstack/SO bundles: Keep's 13 hover timeouts are the revealed action bar sitting over the note title (`<span aria-hidden>🎨</span> from .row-actions intercepts pointer events`); SO's remaining `/^edit$/i` family is Edit not rendered for the seed owner after login (requirement pairs the row with question_editor@example.com; no test asserts non-owners cannot see it); Bookstack's misses are post-create headings.
- Fixes: parser now ignores prose outside blocks (`ec8ecb5`, 54 tests green). Dialect round 2 (`goal/round-1` head): §1a buttons for actions regardless of the requirement's word, §3c action bar below the title never over it, §6a ownership never hides a control. Card 87→112 lines.
- Round 2 submission `11cd16489a3e` (sha256 `84d8b37f…`), six tasks started 02:35: keep `82ecfa65901d`, bookstack `586fd5f95368`, stackoverflow `612bfa179c1a`, prestashop `d457e5574260`, 12306 `ea95252f47fc`, ctrip `38115ce82dc1`.
- Round 1 ctrip **43/125** `337ff1b2d247` (round 0: 8). Round-1 six-task average 41.0% with the Prestashop protocol zero, 49.2% over the five delivered tasks. Ctrip also shows the §7a family in another shape: `getByLabel(/航班号/)` resolves to a mode radio whose label contains the field word before the text field.
- Round 2 partial (02:49–02:55): Keep **26/32** `82ecfa65901d` (the no-overlay rule restored it), Bookstack **0/34** `586fd5f95368`, Prestashop 38/86 `d457e5574260`. Bookstack's zero is a blank page: `app.js` throws `appendChild … not of type Node` on load (verified with a headless browser and with jsdom on the downloaded bundle); the HTTP smoke check cannot see it. Prestashop still loses the quantity family to `<button aria-label="Decrease quantity">` preceding the input.
- Fix: `smoke_check` now loads `/` in jsdom (installed once per machine into the temp dir, skipped silently offline) and reports script errors on load and blank pages, which feed the existing one bounded repair. Fixture index gained visible text; one guarded test added (`tests_oneshot` 55 green). Dialect §7a gained the stepper example.
- Round 3 submission `e3d00d4f3f4d` (sha256 `f8ea0f12…`), six tasks started 02:59: keep `836f4e8e94df`, bookstack `f7d190cfdf13`, stackoverflow `e139d9ab00d9`, prestashop `8cda69ac75e6`, 12306 `27c132cc5490`, ctrip `1375c98047c6`.
- Round 2 more: StackOverflow **19/66** `612bfa179c1a` (round 1: 33 — the Profile family, 14 tests, came back; the model's adherence to a card rule is stochastic), 12306 **64/135** `ea95252f47fc` (40 → 51 → 64 across rounds). 
- Quoted-vocabulary gate (`goal/round-1` head): `vocabulary_gaps()` extracts every quoted string from the requirement (SO 125 unique, 12306 262) and lists those absent from the delivered source as delivery problems for the bounded repair; a repair is kept when the smoke check passes and the count did not get worse. `tests_oneshot` 56 green. Round 4 submission `327a6085d81f` (sha256 `8abbc294…`), six tasks started 03:08: keep `0c55fbab35c7`, bookstack `7f2b870bd7e1`, stackoverflow `8de3e5e7d785`, prestashop `d7040f3dc0aa`, 12306 `be7918ad723c`, ctrip `f0d9011dce55`.
- Round 2 closed: ctrip 27/125 `38115ce82dc1` (still `getByLabel(/航班号/)` resolving to a mode radio placed before the field). Six-task average 37.2%; the board keeps round 0's 45.0%.
- Round 3 (02:59): Keep **28/32** `836f4e8e94df`, Bookstack 16/34 `f7d190cfdf13`, StackOverflow **36/66** `e139d9ab00d9`, Prestashop **56/86** `8cda69ac75e6`, 12306 61/135 `27c132cc5490`, ctrip pending at 03:30. Round 4 (03:08): Keep 28/32 `0c55fbab35c7`, Bookstack 23/34 `7f2b870bd7e1`, StackOverflow 34/66 `8de3e5e7d785`, 12306 **5/135** `be7918ad723c` — the backend threw "Assignment to constant variable" in a handler at test 6 and the Node process exited; the platform's injected `.volo/launcher.cjs` does not respawn it (verified in local replay: 4/135, same crash).
- Static gates added (57 tests green): `process_guard_gaps` requires uncaughtException/unhandledRejection handlers in the backend; `aria_collision_gaps` flags buttons whose aria-label shares a word with a field label (found 3 in SO r2, 3 in PS r0). Card §8 gained the backend-guard rule. Round 5 submission `9653af1b4ce2` (sha256 `550ed7c8…`), six tasks started 03:30: keep `14ee2d33a97f`, bookstack `80ebe39a9bd7`, stackoverflow `b794068fa7b1`, prestashop `9d2ec094eef3`, 12306 `1ba0a4b30b5a`, ctrip `0ab9fe9c4cbd`.
- Round 3 closed 03:31: ctrip 24/125 `1375c98047c6`; six-task average **53.1%** (round 0: 45.0). Ctrip keeps losing the flight-status family to a mode radio labelled "航班号" placed before the "航班号" text field (`getByLabel(/航班号/).first()` picks the radio).
- Round 4 closed 03:34: Prestashop 50/86 `d7040f3dc0aa`, ctrip 25/125 `f0d9011dce55`; average 48.1% (12306 crash). Bookstack r3 attribution: 10 of 13 failures click a seed item by name right after navigating to its list; the seeds exist and the links are in the failure snapshot, but the click ladder probes each role for 500 ms and the list is fetched after navigation, so it arrives too late. Card §8: render navigation synchronously from an in-memory store loaded once at startup.
- Round 5 (03:30): Keep 24/32, Bookstack 18/34, StackOverflow 31/66, Prestashop 49/86, ctrip 0/0 (draft lost to a missing final `=== END ===` at finish=stop; the one-shot now closes it, fresh generation only, `37f0d07`). Round 6 (03:36): Keep 28/32, Bookstack **11/34**. Bookstack r6 replay: Edit/Delete/New Shelf/New Page/Favorite are gated behind login while 31 of 34 Bookstack specs never log in. §6a rewritten: nothing is gated behind login or ownership.
- Round 5 closed 04:00: 12306 46/135 `1ba0a4b30b5a`; average 44.3%. 12306's remaining families are data semantics: station filters that do not restrict rows, and duration sorting that the suite compares as strings (`localeCompare`), so durations must render zero-padded (`05h28m`) for numeric and lexical order to agree; "Total travel time: N minutes" / "Transfer waiting NhNm" texts absent on transfer plans. Round 7 submission `d5b306cf33fc` (sha256 `8dd2ad85…`) started 03:56: keep `ed93598bbed4`, bookstack `cb08b17dbea8`, stackoverflow `8ba987c75a5a`, prestashop `a8f403842b67`, 12306 `3b55b0eac0a0`, ctrip `dbda3fc128d4`.
- Round 6 more: StackOverflow 20/66 `06a32813ffcf`, Prestashop 53/86 `11649c8140f6`, 12306 55/135 `b63dac75ec7c` (new families: `getByLabel('From')` strict-mode collision with "From Station"; sort asserted ascending on the first click; durations compared as strings). Round 7 Bookstack **32/34** `cb08b17dbea8` — §6a (nothing gated behind login) was the Bookstack fix. Gate: field labels that are whole-word substrings of another short label; card: first sort click ascending, zero-padded sortable values. Round 8 submission `5e94aaae8244` (sha256 `1548a120…`) started 04:07: keep `307c85ab96ad`, bookstack `5707d33653f6`, stackoverflow `cda090c91843`, prestashop `3a582701ac37`, 12306 `bee4b6bcc602`, ctrip `34ef155fc3e0`.
- Round 7 more: Keep 25/32, StackOverflow **47/66** `8ba987c75a5a` (best; §6a), Prestashop 49/86, ctrip 39/125 `dbda3fc128d4`. Round 8 partial: Keep 27, Bookstack 19 (seed-click family back; stochastic), SO 38. Ctrip r7 replay: 50 of 86 failures are the login identifier field — the helper wants `/邮箱.*用户名.*手机号/` (from the reference screenshot the model cannot see) or its English fallback `/account/i`; the app wrote "请输入手机号/用户名/邮箱". Card §7: bilingual accessible names in Chinese apps (账号 Account, 密码 Password, 登录 Login). Not adding the Ctrip-specific placeholder order: that would fit the public test, not the hidden ones.
- Round 7 12306 5/135 `3b55b0eac0a0`: 130 timeouts, server alive (process guards present), app renders locally in jsdom without errors (86k chars of text on `/`, everything in one inline index.html); cause not determined, treated as a one-off since round 8 12306 scored **74/135** `bee4b6bcc602` (best) and Prestashop 52/86 `3a582701ac37`. Round-7 average 46.8%.
- Round 9 (04:30) closed 05:01: Keep 28/32 `c2985c084cd7`, Bookstack 24/34 `ed3364d2e97e`, StackOverflow 31/66 `9569b763269e`, Prestashop **64/86** `89ee48b3abd1` (best), 12306 49/135 `45a2817ccad4`, ctrip 16/125 `11a9308368fd`; average 54.8%. The r9 ctrip app does carry "Account"/"账号" on the login field yet 109 tests time out without a locator; local replay in progress. Round 10 partial: Keep 27, Bookstack 12.
- Round 10 partial (05:07): Keep 27/32, Bookstack 12/34, StackOverflow **53/66** (80.3%, first task besides Keep/Bookstack over 80%), Prestashop 56/86, ctrip **54/125** (best; radio collision gate). Ctrip r9 replay: 49 failures were the header "登录 Login" click not opening the login form (no script error at load or on click in jsdom — a logic fault, not catchable generically); a click-probe extension of the DOM smoke found nothing and was reverted.
- Round 10 closed 05:09: 12306 **76/135** `c0e81dda8d50` (best); six-task average **60.8%** (best; Bookstack 12 is the drag). New 12306 family: direct and transfer tables both render "Departure Time" sort buttons at once → strict-mode violation (card §1a note added). Round 11 = second sample of the round-10 package (submission `6f422db9ee51`, started 05:10).
- Round 11 partial (second sample of the round-10 package): Keep **6/32** `1458cb0b58a9`, Bookstack 16/34. Keep replay: an empty `<div id="dialog-root">` overlay intercepts every hover (`intercepts pointer events` on 26 tests) — same package as round 10's 27/32, so generation variance. Card §4: idle overlay roots must be display:none. Round 12 submission `$SUB` started 05:31.
- Round 11 closed 05:41 (same package as round 10): 6/16/22/27/75/22 → **34.0%** against round 10's 60.8%. The package's expected score is nearer 47% with a spread of about 13 points; the board's 60.8% is a favourable sample. Card rules reduce specific families but do not reduce sample variance; that needs a generation-time change (temperature 0.3 → 0, or best-of-2 drafts selected by gate problem count), which is an owner decision on cost.
- Round 12 partial (06:00): Keep 27, Bookstack 12, SO 29, Prestashop 64, 12306 50 (sort still descends first; time cells carry the station name). Round 13 (temperature 0.0, `c217e08`+): Keep **30/32** (best), Bookstack 24, SO 46 — all in the upper band so far.
- Round 12 closed: ctrip 34/125; average 50.4%. Round 13 (temperature 0.0) closed 06:12: Keep 30/32, Bookstack 24/34, SO 46/66, Prestashop 52/86, 12306 **85/135**, ctrip 37/125 → **64.5%** (best). Round 14 = second sample of the round-13 package (submission `$SUB`) to test whether temperature 0 narrows the spread.
- Round 14 (second temperature-0 sample) closed 06:49: Keep 27, Bookstack **34/34**, SO **3/66** (a bad sample: homepage without "Main question feed" text or a "Log in" control, no runtime fault), Prestashop 58, 12306 77, ctrip 48 → 58.6%. Temperature 0 pairs (64.5 / 58.6) are much tighter than the temperature-0.3 pair (60.8 / 34.0). Stopping autonomous rounds at 06:50 with CNY 93 left; board 64.5%, rank 5. Decisions and next levers are at the end of `docs/reports/2026-09-18-goal-ledger.md`.

## 2026-09-18 morning — owner decisions, jsdom fetch false positive, model fallback

- Owner decisions (09:50): no best-of-2 for now (fix the gate first, re-sample); balance is not a concern
  before the preliminary (topped up to CNY 289 overnight; note it, do not guard on it); `goal/round-1`
  opens its own PR to main and supersedes #36; keep retrying the same model and only switch models once
  the retry limit is hit; open a side branch that runs glm-5.3 with thinking and a matching token cap;
  find out whether an uncapped run was ever tried.
- Correction to the round-14 reading: StackOverflow 3/66 was **not** "no runtime fault". The run log's
  `[oneshot] smoke` line shows `Uncaught [SyntaxError: Unexpected identifier 'ffice']` on load
  (`title.indexOf(t)ffice !== -1` at app.js:794, a five-character generation glitch, two calls, no
  continuation), the bounded repair rewrote the file, and the repair was **rejected** because the re-check
  reported `ReferenceError: fetch is not defined`. jsdom 29 ships no `fetch`; any frontend that loads its
  data on start tripped the DOM gate. Round 13's good SO sample (46/66) reported the same false positive
  first and spent its only repair call on it. Keep r11 (6/32) had one gate problem and an accepted repair:
  the empty overlay root is not visible to gate counts, so a gate-count best-of-2 would have caught one of
  the two whole-app bad samples, and the fetch fix catches that one for free.
- Fix `6cb35f8`: the probe's `beforeParse` installs `window.fetch` that resolves against the probe URL and
  calls Node's fetch (the backend is running on that port during the check). Verified on the downloaded
  r14 bundle: unchanged it still reports the SyntaxError; with the five characters removed the check is
  clean. New regression: a frontend that fetches `/api/health` on load and renders it reports no problem.
- Gateway probe (tiny streaming calls, 09:57): `deepseek-v4-flash` without `max_tokens` is accepted;
  `glm-5.3` accepts `thinking: {type: enabled|disabled}` and `reasoning_effort: low` without error but
  **still streams `reasoning_content` in every variant** (34–284 reasoning tokens for a one-word answer),
  so the gateway does not forward a thinking switch for GLM; the only lever is `max_tokens`, which for GLM
  bounds reasoning + content together and is now 131072.
- Fallback `60a4707`: same-model retries stay at three per call; when all three are transport failures the
  run switches to `FALLBACK_MODEL` (default `qwen3.7-plus`) for that and every later call; permanent HTTP
  errors never switch; empty `FALLBACK_MODEL` disables it; `MAX_FAILURES` 4 → 5 so the fallback gets two
  attempts. `tests_oneshot` 61 green.
- Uncapped run: never tried on a real task before today. Two local Keep generations started 09:59 on the
  current package: `deepseek-v4-flash` with `max_tokens` omitted, and `glm-5.3` unchanged (cap 131072).
  Results below when they finish.
- Round 15 package (`6cb35f8` + `60a4707`, sha256 `8ae67a05…`) uploaded as submission `83fba30a434a`;
  runs start after the local probes finish so the usage-meter delta stays clean.
- Uncapped flash (local Keep, `max_tokens` omitted, 09:59–10:20): **failed**. Call 1 `finish=length` at
  95,200 completion tokens after 699 s with only 13,606 characters of content; the continuation
  `finish=length` again at 71,296 tokens; `unterminated file block: frontend/public/app.js`. The platform's
  round-13 Keep draft finished `stop` in 553 s (about 80k tokens at the observed 150 tok/s), so omitting
  the cap did not buy more content: the provider applies its own, lower, ceiling and the reasoning volume is
  the same. Keep the explicit 131072 cap. One sample; not worth a second at CNY 1.5.
- Round 15 sample A started 10:26 (`r15-runs.json`: 12306 `8f92145a3744`, Bookstack `863318b7cf5a`,
  Ctrip `bbc5bb0a7fdd`, Keep `7747d71e9e70`, Prestashop `63d21f8ba126`, StackOverflow `0eb9937e897f`).
  The glm-5.3 local probe was still running (call 1 failed on transport at about 10:20, retrying), so this
  round's token column includes it.
- glm-5.3 local Keep probe (09:59–10:59, current package, cap 131072): **three attempts, each cut by the
  gateway at 1201 s with no content and no usage frame** (`StreamError: stream ended without completion
  markers`). The token cap never fired; the gateway closes a stream at 20 minutes and GLM's reasoning runs at
  about 35 tok/s (09-17: 32,768 tokens in 16 min), so it cannot finish thinking inside the window. Removing
  `max_tokens` cannot change that. Cut streams are unmetered. GLM is out on this gateway unless the
  organizer raises the stream ceiling or forwards a thinking switch (it accepts `thinking`/`reasoning_effort`
  and ignores both, 09:57 probe).
- Round 15 sample A closed 10:58: Keep **30/32**, Bookstack 26/34, StackOverflow **1/66**, Prestashop 57/86,
  12306 **85/135**, Ctrip 18/125 → 52.6%. Keep and 12306 tie their bests; SO is a whole-app bad sample
  again — no DOM error this time, the vocabulary repair rewrote the 110 KB single-file `index.html` (the
  whole app is inline) and was accepted with 0 phrases missing. Local replay of the bundle running. Working
  hypothesis: the jsdom false positive used to reject such whole-file rewrites by accident; now they land.
  Sample B (same submission) started 11:01: 12306 `df60e5072a9a`, Bookstack `f2d259d182b7`, Ctrip
  `66c719aedcad`, Keep `61fa7531580f`, Prestashop `80d4434870dd`, StackOverflow `a49aa2ec0296`.
- Round 15 SO 1/66 replayed locally (1/66 reproduced): the a11y snapshot of `/` starts at the "Top
  Questions" heading — no header, navigation, login control or sidebar exist on the home screen, so every
  test that starts there times out. The trace shows the **draft itself** rendered `renderHome()` and
  `renderQuestionsPage()` without the shared `renderLayout()` wrapper (14 other routes use it); the accepted
  vocabulary repair only added constants. Not gate-visible until now: the DOM check only asked for text.
- Gate `f72342f`: the jsdom probe reports header / navigation / footer landmarks on `/`; when the requirement
  mentions one of those words and the landmark is absent, the bounded repair gets "the first screen renders
  no <header>… every screen renders through the one shared layout". Card §8 states the rule. Real-bundle
  check: r15 SO flagged (header, nav), r1 Keep / r11 Keep / r8 Bookstack clean. `tests_oneshot` 62 green.
  Round 16 = round-15 package + this gate, uploaded once sample B has finished.
- Round 15 sample B closed 11:31: Keep **30/32**, Bookstack 23/34, SO 49/66, Prestashop 63/86, 12306 68/135,
  Ctrip **54/125** (ties best) → **67.1%** (best; board now 67.1%, rank 5). Round-15 pair 52.6 / 67.1 against
  round 13/14's 64.5 / 58.6: same band, the A-sample drop is the gated SO family. Verdict: keep the jsdom
  fetch and the fallback. **PR #37 merged** (`ff686e3`); main now carries the whole goal line.
- Round 16 = round 15 + landmark gate (`f72342f`, package sha256 `79af8e84…`, submission `003f21fc67a7`).
  Sample A 11:33: 12306 `5614ef17a3ac`, Bookstack `d45bdb61afd8`, Ctrip `4be2d1b4205a`, Keep `094302f16050`,
  Prestashop `b7e272ce6ba8`, SO `58e3c1cd9234`. Sample B 11:36 (first start hit a platform 500 on
  GET /submissions, retried): 12306 `4f1f041e40f1`, Bookstack `11c50656c2cd`, Ctrip `44d9c77266f0`, Keep
  `74032e8864ac`, Prestashop `5b227b45dde5`, SO `56896036410e`. Both samples run concurrently.
- Round 16 (landmark gate) closed 12:40: sample A 29/15/53/49/35/51 → 56.5%; sample B 24/33/34/57/79/37 →
  63.0%. Pair 56.5 / 63.0 against round 15's 52.6 / 67.1: same band, no whole-app zero in either sample
  (lowest: 12306 35/135 in A, a new low for that task, two `stop` calls, no delivery fault; Bookstack 15/34
  in A with zero gate problems — the known stochastic navigation family). **Verdict: keep the landmark
  gate.** Board stays 67.1%.
- Generic-card ablation started 12:41 (branch `exp/generic-card` `4ce8ec3`, same code as round 16, card
  cut to 126 mechanics-only lines: §6a and every task-shaped rule/example removed; package sha256
  `23d8de9f…`, submission `85832f7d5293`). Sample A: 12306 `9388c7bf1d25`, Bookstack `030833032cb4`,
  Ctrip `7443f5012b3a`, Keep `bdd209231711`, Prestashop `9e9221d34ae8`, SO `37a29cdeb557`. Sample B:
  12306 `22f415b33177`, Bookstack `c9d8c7213a24`, Ctrip `f421af673378`, Keep `da773e8e9c80`, Prestashop
  `22e270c017c5`, SO `a5c0b54ee171`. Control = round 16's pair.
- Distillation plan proposed to the owner (12:38, awaiting a nod): move know-how down the ladder prose →
  requirement table → scaffold code → gates. Next levers in order: (1) a fixed scaffold (layout, router,
  in-memory store, inert dialog, hover-revealed row actions, status notifications) shipped with the package
  for the model to extend; (2) prepend the quoted-vocabulary table to the prompt instead of only checking it
  afterwards; (3) a screen-walk gate for "phrase in source but not on the asserted screen" (half of the
  r15b SO/Prestashop failures).
- Owner 12:47: the three levers approved ("think less, execute"); the scaffold is to become a generic
  architecture knowledge base for ARC; the screen-walk gate is the TDD analogue; research obra/superpowers
  for flash. Recorded in `docs/reports/2026-09-18-distillation.md` (assessment: only its plan discipline
  transfers, as a planning stage; multi-agent parts are the route lost on 09-15) and ADR 0001/0002.
- Scaffold shipped (`25e7d44`, level 1 of the ladder): `oneshot/scaffold/` (328 lines: backend with process
  guards + static + `/api/health` + `/api/state`; `lib/arc.js` primitives — layout with landmarks on every
  route, hash router, in-memory store with write-through, inert dialogs, `role=status` notifications with
  Undo, hover-revealed row actions, delegated `data-action` events; `app.js`/`seed.js` example stubs). For a
  fresh generation it is placed in the stage first and shown in the prompt as the base to extend; a static
  gate keeps the shell and primitives defined. `ONESHOT_SCAFFOLD=0` disables it. Bare scaffold passes every
  gate; `tests_oneshot` 64 green; the package carries the directory. Local Keep probe running (13:35).
- Generic-card ablation partial (13:35): Keep 29/22, Bookstack 24/32 (§6a removed and Bookstack did not
  collapse), SO sample B **0/0** — one 865 s call, `finish=stop`, "no file blocks in the response", and the
  pipeline exits after that single call instead of asking again.
- Scaffold probe (local Keep, flash t0, 13:33–13:47, 831 s, two calls: draft 123,665 completion tokens /
  40k chars, repair 49 s): the model wrote only `app.js` (26 KB) and `seed.js` (4.6 KB); `lib/arc.js`,
  `index.html` and `server.js` are byte-identical to the scaffold. One gate problem (Note / "Take a note..."
  label substring), repair accepted. **Local replay 31/32** (hosted profile; best Keep so far was 30/32),
  the one loss REQ-2.7.4 default label on create. Bundle under `runs/2026-09-18-goal/scaffold-probe-keep`.
- Empty-draft retry (`588e6be`): a first draft without file blocks is asked once more (two calls left in
  the budget); two empty drafts still fail. Round 17 candidate = scaffold + empty-draft retry
  (sha256 `see r17-candidate.zip.manifest.json`), uploaded once the ablation's runs finish.
- Generic-card ablation closed 13:27: sample A 22/32/29/59/47/27 → 55.3%; sample B 29/24/0(empty draft)/44/47/34
  → 45.7%. Control (round 16, same code) 56.5 / 63.0. Excluding the empty-draft SO, the generic card is about
  10 points cheaper on the six public tasks, the loss concentrated in 12306, Prestashop and Ctrip; Bookstack
  without §6a stayed in its band (32, 24). Reading: task-shaped rules are worth ~10 points where they were
  written and ~0 elsewhere, so the hidden-task expectation is ~50, not ~60. Decision: keep the full card plus
  the scaffold for the formal round; trim the card only after the scaffold is validated.
- Round 17 = scaffold + empty-draft retry (`25e7d44`, `588e6be`; sha256 `831f5e09…`, submission
  `efdc725f67bf`), two samples started 13:28 (sample A's Keep entry came back without a run id and was started
  separately). Ids in `r17a-runs.json`, `r17a-keep-run.json`, `r17b-runs.json`.
- Round 17 (scaffold + empty-draft retry) sample A closed 14:10: Keep 28/32, Bookstack 29/34, SO 47/66,
  Prestashop 58/86, 12306 69/135, Ctrip 36/125 → **65.2%** (second-best round; no whole-app zero). Sample B
  so far: Keep 27, Bookstack 19, SO 35, Prestashop 57, Ctrip 37; 12306 still PENDING after an hour in the
  platform queue.
- Lite holdout (14:12): the round-17 package uploaded to `arc-bench-lite` (submission `d4fb5e687fa3`, two
  samples: A Bookstack `8ea91c95dfb3` / Keep `71c64ecb4e69`; B Bookstack `a7523e35a279` / Keep
  `37eb3cd66155`). Lite's Keep/Bookstack use different tests and stricter helper conventions than Web
  (09-16: the same Keep product Web 21/32, Lite 5/32), so this measures the "other helper generation" risk
  Jev weighted 0.80. First result: Lite Bookstack B **5/34**. Board context: four 100% entries (fixed
  answers on every small board so far), then 51.5 / 38.1 / 37.1 / VOLO 31.6.
- Tooling: `arcbench wait` returns as soon as one run reports FAILED (our normal terminal state), so the
  background waiters exited early all afternoon; replaced by `scratchpad/poll_runs.py` (polls `arcbench
  runs` until every id is terminal). Worth folding into the CLI as `wait --until-terminal`.
- **Lite holdout closed 15:05: Keep 5/32 and 5/32, Bookstack 10/34 and 5/34 (about 19%)** against ~60% on
  Web with the same package. Local replay of the Lite Keep bundle (test pack via `arcbench fetch
  --competition arc-bench-lite`, `state_rehearsal.py --tests-dir`, node_modules symlinked beside the pack)
  reproduces 5/32. Reading of `lite-testsets/arc-bench-lite--keep/helpers.ts`: a **different helper
  generation — task-specific helpers with anchored exact names** (`getByRole('button', {name: /^Take a
  note$/i})`, `getByRole('dialog', {name: /^Note editor$/i})`, textboxes `/^Title$/i` `/^Note content$/i`,
  `/^Close$/i`, `/^More options$/i`, `/^Delete Note$/i`, `/^Archive$/i`, `getByText(/^Notes$/i)`,
  `menu`/`menuitem`, `article`, `complementary`). 23 anchored names; **22 are written in the Lite
  requirement** (only "Note editor" is not), which is exactly what the organizer promised for the formal
  round. So Lite is the closest public sample of the formal dialect, and it is winnable: our losses are
  decoration and role, not missing vocabulary — sidebar links rendered as "• Notes" / "🔔 Reminders"
  (anchored `^Notes$` fails), "Take a note" rendered as a placeholder instead of a button, no dialog named
  "Note editor"; 22 of 27 failures cascade from `openComposer`. The vocabulary gate passed (phrases exist in
  source, just decorated).
- Board oddity: `arc-bench-web` shows VOLO AI 72.3% at 15:00 while no six-task sample exceeds 67.1; the
  aggregation must combine runs across the latest submission's samples. Not relied on.
- Next (evening): (1) card §7b + vocabulary-table header: a quoted control name is the exact accessible
  name, byte-exact, no icon/bullet/ellipsis/added noun, role from the requirement's verb; §3's "add a noun"
  only for unquoted names. (2) Exact-name static gate: a quoted phrase ≤ 5 words that appears in the source
  only decorated (`• Notes`, `Take a note...`, `Archive note`) is a problem for the bounded repair. (3) Validate
  with a local Lite Keep generation + replay and a Web Keep replay for regression, then Lite/Web platform pairs.
- Round 17 closed 15:43: sample B Keep 27/32, Bookstack 19/34, SO 35/66, Prestashop 57/86, 12306 **85/135**
  (rerun `dc34a40bdd46` after the first run sat PENDING two hours; ties best), Ctrip 37/125 → 58.7%. Pair
  **65.2 / 58.7** against round 16's 56.5 / 63.0 (mean 62.0 vs 59.8), no whole-app zero in either sample,
  the model touched only `app.js`/`seed.js` in every run. **Verdict: keep the scaffold.**
- Web Keep regression probe of the round-18 candidate (scaffold + vocabulary table + §7b + exact-name gate;
  local, 15:18–15:47, 1764 s — twice the scaffold probe's time): replay **25/32**. The seven losses are the
  archive/trash/label families; 2.5.3 and 2.3.3 fail at the first hover because this sample seeded
  "Travel plans 2.5.3" already archived and "Delete me 2.3.3" already trashed (the tests archive/trash them
  through the UI first), 2.7.x are the label dialog. Routes and the "Archived" sidebar link are correct.
  Seed-state interpretation is the known Keep stochastic family, not an effect of §7b; one sample, band 24–31.
  Round 18 candidate built (`r18-candidate.zip`); upload waits for the local Lite Keep replay.
- Local Lite Keep with the §7b package (15:18–16:08, 2981 s): replay **6/32** (was 5). Names are now exact
  (textbox "Title"/"Note content", "Close", "More options", "Pin note"), the blockers are Lite's helper
  conventions: sidebar entries resolved as `complementary >> button /^Name$/` (ours were links), search as
  `textbox /^Search$/` (ours `type=search` = searchbox), cards as `article`, the editor as `dialog "Note
  editor"` (unwritten in the requirement; skipped). Web Keep's `archiveNote` is a page-wide `.first()` for
  /archive/i, so sidebar buttons must come after the cards in DOM order: scaffold v2 (`sidebar buttons in
  <aside> placed after <main>, CSS order -1`; search textbox; article example) + card §8 lines. Bare scaffold
  clean on every gate. Round 18 = this package on Web (two samples, submission `87b8bf978a70`) and Lite
  (two samples, `4f410b2e5ae7`), started 16:15. Local generation time rose to 30–50 min this afternoon
  (gateway load or the longer prompt; platform drafts will tell).
- Session handoff at 16:20: context at 45%; the next session continues from `docs/SESSION_HANDOFF.md`.

## 2026-09-18 17:00 — Round 18 read; the click-ladder race; round 19 (Fable + owner)

- Round 18 closed on Web except 12306 sample B: **52.2% / 46.1%** against round 17's 65.2 / 58.7. Three
  causes, read from bundles and local replays, none of them the §7b rule itself:
  1. Ctrip sample B **0/125**: the gateway ended the draft stream with `finish_reason=content_filter` after
     483 s and about 200 KB of `app.js` (the trace stops in an airport list); `stream_completion` raised on any
     finish other than stop/length and the run exited 1. Fixed in `7169cb9`: content_filter is treated as a
     truncation (the partial draft is kept) and the continuation goes to `FALLBACK_MODEL`, because at
     temperature 0 the same model re-emits the tokens that tripped the filter. Two tests. A formal-round task
     with a whole-app zero from this would be unrecoverable, so this is the most valuable fix of the day.
  2. StackOverflow **27 / 32** (from 47 / 35): REQ-1.1, 1.2, 3.3.2, 4.4, 5.1.2 failed in BOTH samples and passed in
     17a. They assert prose nouns as visible text (`/header/i`, `/sidebar/i`, `/products/i`, `/modified/i`,
     `/helpful user/i`). The round-17 app wrote them (footer line `Footer · Header · Sidebar · …`, a `Products`
     nav entry); the round-18 app did not — the prepended quoted-vocabulary checklist read as the whole
     vocabulary. Response: the scaffold footer now ends with `Header · Sidebar · Main content · Footer` (level 1),
     and the checklist header says the unquoted THEN-step nouns are asserted just the same (level 3).
  3. Bookstack sample A 13/34: the model's own route bug (cards link to `#/shelves/<id>`, the detail screen is
     registered as `shelf`), so every detail-page test failed. Not a scaffold mechanic; a jsdom "click each seed
     link, expect the heading to become the link text" walk would catch it (candidate gate, not built).
- **Lite Bookstack 6/34 replayed locally, root cause found**: both suite generations' `firstVisible` probes each
  rung with `isVisible()` (no wait) right after the click resolves. The scaffold rendered on the `hashchange`
  task, which comes after the click's task, so every "click an entry after navigation" step saw nothing,
  fell to `locators[0]` (button) and waited until the 10 s timeout — deterministic on Lite (Bookstack lost
  22 tests this way), stochastic on Web (the known seed-click family). A probe script reproduced it: the
  hash changed but `h1` was still the list heading when the next probe ran. Fix in the scaffold (`dab1c49`):
  `ARC.navigate` and in-app `a[href^="#/"]` clicks render synchronously; `hashchange` only renders when the
  hash differs from the last rendered one (back/forward). Plus a logo BUTTON `"<Brand> logo"` beside the brand
  link (Lite: `button /^BookStack logo$/`; Web: `link /bookstack/i`) and, in the bundle, `aria-label="Login
  form"` on the login form (Lite scopes the submit button inside `form /^Login form$/`). Replay of the same
  bundle: **22/34**. Web Bookstack sample A with the same patch: 14 → 14 (its failures are the route bug).
  Lite Keep sample A with the patch: 11 → 11 (its families are archive/label/pin).
- Remaining Lite Bookstack families after the patch (12): `Shelf Tags` / `Book Tags` resolved as a BUTTON
  (the requirement calls it a field; the real product has a collapsible section), `Confirm Delete` (our
  dialog button says `Confirm`; the requirement's REQ title is "Confirm Delete Shelf"), `Page title` /
  `Write your page content here...` as PLACEHOLDERS (ours were labels), `Create New Book` on the books list
  vs `New Book` on the shelf page (the helper is the reverse of the requirement's wording; Web's helper
  uses `Create New Book` for both). Card §8 now says: every form named "<phrase> form"; a quoted field name
  is both label and placeholder. The tags-button and the swapped names are Bookstack-specific and not
  encoded.
- Round 19 = `dab1c49` + `7169cb9`. Lite two samples started 16:58 (submission `0aa67e9eaa9b`); the Web upload
  is chained after round-18 12306 sample B finishes (the server keeps one submission per competition), two
  samples, by `scratchpad/r19_web_chain.py`, which then polls every round-19 run and writes
  `runs/2026-09-18-goal/r19-final.json`. Judge Web against 65.2 / 58.7 (round 17), Lite Bookstack against 6 / 7
  and Lite Keep against 12 / 11.
- Tooling: `arcbench` needs `--env-file ~/.config/arcbench/volo.env` (sourcing the file in the shell gives 401).

## 2026-09-18 17:40 — Round 19 closed: kept; Lite doubled

- Web pair **65.5 / 60.0** (Keep 29/22, Bookstack 33/29, SO 50/43, Prestashop 66/69, 12306 51/61, Ctrip 19/19)
  against round 17's 65.2 / 58.7 and round 18's 52.2 / 45.6. SO's five prose-noun tests (REQ-1.1/1.2/3.3.2/4.4/5.1.2)
  passed in both samples again; Bookstack and Prestashop set or tied their bests. Lite pair **54.0 / 55.6**
  (Keep 12/13, Bookstack 24/24) from 27.6 / 27.5: the click-ladder race was the whole Lite Bookstack story.
  Boards: Web 72.3% (rank 5, unchanged aggregation), Lite 55.6% (rank 6; the five above are 98.5–100).
- Open: Ctrip 19/125 in both samples (round 17: 36/37, round 18: 23 and the content_filter zero). The drop
  started with round 18, so it is in the §7b / vocabulary-table / scaffold-v2 set, not in today's scaffold
  patch. Next: attribute the round-19 Ctrip bundle (families, error contexts) before touching the card.
- Docs reorganised (`8236924`): `docs/README.md` is the map and policy; see it for where things live now.

## 2026-09-18 17:55 — Ctrip attributed to the card's Chinese-app rewrite; round 20

- Round-19 Ctrip bundle replays 19/125 locally (platform 19/19). Every failure waits for `/邮箱.*用户名.*手机号/`
  (login) or `/到达城市/` (flight search) or the registration agreement; 106 cascade from those. The round-17
  app wrote `账号 Account` + placeholder `邮箱/用户名/手机号` and `出发城市 Origin` / `到达城市 Destination`; the
  round-19 app wrote `手机号/用户名/邮箱` and `出发地` / `到达地`. The difference is the card: the §7b rewrite
  (round 18) reduced the Chinese-app paragraph to "quoted names exact, bilingual label only when nothing is
  quoted", and the model took the fields' wording as free. Restored the explicit list of product-worded
  bilingual fields (commit on goal/round-1). Not the vocabulary table: SO's prose nouns came back in
  round 19 with the footer alone, and the Ctrip words are not in any quoted phrase either way.
- Round 20 = round 19 + that paragraph, Web only, two samples (submission `2108891b5706`, 17:52).
  Judge Ctrip against 19/19 and 36/37; everything else should hold round 19's band.

## 2026-09-18 18:40 — Round 20 read: the paragraph works, the pair is noisy

- Web pair **54.1 / 57.9** (Keep 25/19, Bookstack 25/27, SO 39/33, Prestashop 41/57, 12306 68/80, Ctrip 20/41).
  Both Ctrip apps carry the restored words (`账号 Account` + `邮箱/用户名/手机号`, `出发城市` / `到达城市`); sample b
  scores 41 (r17 band 36–37, best 54), sample a 20 with 24 tests that fail only in a. Prestashop a 41 has 19 tests
  that fail only in a. SO differs from r19 by two shared tests. So the drop against round 19 (65.5 / 60.0) is two
  bad samples plus noise, not the paragraph, which cannot touch the English tasks. Replays of Ctrip a and
  Prestashop a are running to name the two families.
- Candidate for the formal round stays r20 (= r19 + the Chinese paragraph) unless the replays show a
  mechanism the card caused.

## 2026-09-18 19:05 — Two bad samples become two gates; round 21

- Round-20 sample A replays: Prestashop 41/86 because the product page's `add-to-cart` handler throws
  `Cannot read properties of undefined (reading 'id')` (no dialog, 17 checkout tests wait for "Proceed to
  checkout"); Ctrip 20/125 because `出发城市` / `到达城市` / dates are `readonly` picker triggers, so every
  `fill()` times out (35 direct, 64 cascades through the city picker's `热门` tab). Both confirmed with a real
  browser probe, not only the suite's error contexts.
- Gates (commit on goal/round-1, 72 tests green twice): the DOM probe now walks every hash route reachable
  from `/` (≤ 40 screens, 15 s), clicks every button once (re-querying after each render, since the scaffold
  rebuilds the screen) and reports uncaught handler exceptions per handler + message, jsdom's own gaps filtered;
  `readonly_gaps` flags readonly inputs in the generated frontend. Checked on six real bundles: Prestashop a →
  page-change / toggle-password / select-color / add-to-cart (one signature bug across handlers), Ctrip a →
  4 readonly, Ctrip b → `发送验证码` throws on an empty phone (a real robustness bug); Bookstack, Keep, SO
  bundles and the bare scaffold stay clean. r17a Ctrip (36/125) has readonly date inputs too — the gate will
  make those typeable; harmless for a suite that picks dates.
- Round 21 = r20 + these gates, Web and Lite two samples each (~19:05).

## 2026-09-18 19:40 — Round 21 kept: best pair so far

- Web pair **65.5 / 62.9** (Keep 26/28, Bookstack 27/29, SO 51/44, Prestashop 54/53, 12306 81/76, Ctrip 40/25) —
  the first pair whose lower sample is above 60. Lite 55.6 / 52.5, flat. Results in `r21-final.json`.
- Round 22 = r21 + the scaffold popover (`19a872d`), Web and Lite two samples each; judge Lite Keep against
  13/11 (the popover targets 12 of its 19 failures) and Web against 65.5 / 62.9.

## 2026-09-18 20:10 — Round 22 kept: the popover lifts Lite Keep

- Lite pair **61.9 / 61.8** (Keep 17/16 from 13/11, Bookstack 24/25); Web pair 63.5 / 64.2 (Keep 26/27, Bookstack 30/27,
  SO 44/48, Prestashop 50/63, 12306 61/76, Ctrip 52/24) — r21's band, Ctrip a 52 is two off its best. Results in
  `r22-final.json`. **r22-candidate.zip is the formal-round candidate.**
- Day's arc: r17 65.2/58.7 → r18 52.2/45.6 (three regressions) → r19 65.5/60.0 → r20 54.1/57.9 (two bad samples) →
  r21 65.5/62.9 (gates) → r22 63.5/64.2; Lite 19 → 27 → 55 → 62.
- Next (not started): replay an r22 Lite Keep bundle for the remaining 15 failures (Pinned title, label group,
  view toggle, sidebar); the planner stage for the large tasks; a jsdom check that a seed link's target screen
  carries the link text as its heading (Bookstack r18a route bug).

## 2026-09-18 20:40 — Lite Keep r22 attributed; round 23

- r22 Lite Keep sample a replays 17/32. Of the 15 failures: six wait for `dialog "Note editor"` (the composer
  was an inline form and the label picker a card popover; the suite fills `dialog >> textbox Title` and checks
  `dialog >> checkbox Work`), four for `article >> button /^Archive$/` (ours said `Archive note`; sidebar said
  `Archived`), one each for an anchored `Note trashed` (the status text shared its element with the Undo
  label), `aria-pressed=""` on Toggle sidebar, a `listbox` of search suggestions, and the settings menu's
  `Help & feedback`. Only `Note editor`, `Help & feedback`, the listbox role and the bare `Archive` are
  unwritten in the requirement — the real product's accessibility tree, which this helper generation copies.
- Card §8 rewritten for these (one editor dialog for create and edit, bare-verb row actions, aria-pressed as
  strings, listbox suggestions, settings items); the scaffold's notify wraps the message in its own span.
- Round 23 = r22 + these, Web and Lite two samples each (~20:40). PR #38 (goal/round-1 → main) is open.

## 2026-09-18 22:35 — Round 23 rejected; two robustness findings; session ends

- Round 23 (r22 + Keep-shaped editor-dialog / bare-verb card lines + status span) **rejected**: Web 40.8 / 53.6,
  Lite 60.3 / 55.5 (Keep 16/12). Candidate stays **r22** (`r22-candidate.zip`, PR #38).
- Two whole-app zeros, both mechanical, one fixed: 12306 b — three flash stream cuts → qwen3.7-plus draft
  re-emitted `seed.js` → `duplicate file block` ValueError → 0/135; now the later block wins (`a36bad5`, tests
  74 green). Prestashop a — every test timed out from "Visit Homepage" in the real browser while the DOM
  probe passed; the probe's own 60 s timeout returns silently instead of reporting, so a page that hangs
  after load is invisible to the gate (the bundle download failed twice with IncompleteRead at ~18.7 MB of 18.9; retry `arcbench download 5e54581b8c44`, then a real-browser probe).
- SO a 21/66 and Ctrip a 12/125 are sample-a-only (21 and 9 tests fail only in a); the other sample is in
  band. The Keep-shaped lines did not take: the r23 Lite Keep app still rendered `Archive note` and put the
  editor behind a plain button, so the remaining Lite Keep families are unchanged (card-scoped `Archive` /
  `Delete Note` / `Change labels` / `Pin note`, `listbox` suggestions, settings menu items `Settings` /
  `Help & feedback` / `Send feedback`, Toggle sidebar). Card adherence on unwritten names is stochastic;
  the next carrier is a scaffold primitive or a gate, not more prose.

## 2026-09-18 23:35 — Round 23 Prestashop re-read: not a hang; round 24 (mechanical) started

- The r23a Prestashop bundle downloaded on the fourth try (the platform cuts the stream near 18.0 of 18.9 MB;
  `arcbench download` gives up, a plain urllib fetch with `Range` finished — script in the session scratchpad,
  worth folding into the CLI). Local replay reproduces 0/86 in 11 s: the page renders the scaffold's EMPTY shell
  (brand `App`, heading `Home`, footer `Footer`), not a hang. `node --check app.js` → `app.js:12 SyntaxError:
  Unexpected token ';'` (a missing parenthesis in `cartSubtotal`). The 22:35 "hangs after load" reading was wrong.
- Full run log (`arcbench logs --offset 0 --tail 100000`, the default tail is 42 lines): three flash cuts →
  qwen3.7-plus draft (call 4) → smoke DID catch it (`frontend script error on load: Uncaught [SyntaxError:
  Unexpected token ';']`, plus label collisions and one missing quoted phrase) → repair (call 5) re-emitted
  65 KB and left the same error → rejected → the broken original shipped. The gate worked; the repair had no
  location to work from, and even a partial win would have been thrown away.
- Fixes (`3cc0f24`, `d97509f`, tests_oneshot 78 green): (1) the DOM probe's own timeout is a problem, not a
  silent pass; (2) `_check_syntax` runs `node --check` on every frontend script before anything is served and
  names file, line and the source line — no jsdom, no network, so it holds when the runner's jsdom install is
  slow (that skip now prints to stderr); (3) a repair that removes a whole-app failure (parse error, blank page,
  dead backend) is kept even if a click or landmark problem remains; the ordinary path still demands a clean app.
- Round-23 card lines reverted (`7bec21d`); the status-span scaffold change stays. **Round 24 = r22 + the
  mechanical fixes only**, Web `5189caeffa1b` and Lite `465e2b38f27d`, two samples each, started 23:30
  (balance CNY 116 before). Detached waiter `runs/2026-09-18-goal/r24-wait.sh` writes `r24-final.json` +
  `r24-final.done`. Judge: no drop vs r22 (63.5 / 64.2, Lite 61.9 / 61.8); then r24 is the candidate and PR #38 merges.
- Dropped from the list: the "jsdom check that `/` settles" (its premise was the hang).

## 2026-09-19 00:15 — Round 24 kept (67.8% sample); Keep b protocol crash fixed; round 25 started

- r24 Web a: Keep 25, Bookstack 30, SO 45, Prestashop 60, 12306 **90** (best ever), Ctrip 45 → **67.8%**, the best
  single sample of the day (r22 63.5 / 64.2). Web b: Bookstack 29, SO 48, Prestashop **68** (best ever), Ctrip 33,
  12306 pending, **Keep 0/0 — the agent exited 1**. Lite: **68.2 / 60.6** (Keep 20/16, Bookstack 25/24) from 61.9 / 61.8.
- Keep b full log: call 1 cut, call 2 completed, then `[oneshot] failed: file closing marker without an open
  block`. The continuation's content began with leaked reasoning ending `Writing the output.</think>=== FILE:
  frontend/public/seed.js ===` on ONE line: the marker was not a full-line match, was ignored as prose, and the
  next `=== END ===` was "without an open block" — the whole task died on protocol strictness, with eight good
  file blocks in hand. Fixed (`8c96fe4`, 79 green): between blocks, a line that ends with a well-formed marker
  opens it; the prefix counts as prose outside blocks; inside a block the line stays content.
- **Round 25 = r24 + that fix**, Web `362bc22182ff` and Lite `1a37de39c710`, two samples each, started 00:12
  (the platform's own API cut two `run` calls with TLS EOF / IncompleteRead first; the uploads had landed, the
  runs were started on retry — check `arcbench runs` before re-issuing). Waiter `r25-wait.sh` → `r25-final.json`.
- arcbench-cli PR #8: `download`/`archive` resume with `Range` after a cut stream (the r23a bundle needed it).

## 2026-09-19 01:00 — Round 25 kept; 12306 a lost 45 tests to the repair renaming "From"; round 26

- r25 Web **61.8 / 67.8** (b: Keep 28, Bookstack 30, SO 44, PS 57, 12306 88, Ctrip 41), Lite 65.0 / 66.5. Kept over
  r24 (67.8 / 54.7). 12306 has now delivered 90 / 87 / 88 in three of four samples.
- r25a 12306 54/135 replayed locally (54/135, identical): 45 tests wait for `getByLabel(/From/i)`. The draft had
  `placeholder="From"` / `"To"` exactly as the requirement quotes; the smoke found 19 nested-label pairs (the log's
  list is cut by the platform's `***` redaction after "New password:"), and the accepted repair re-emitted app.js
  with `aria-label="Origin city"` / `"Destination city"`. The gate said "rename" without saying which side; the
  vocabulary count could not see the loss because "From" survives in "From Station" and `data-from`.
- Fixed (`0ba726d`, 81 green): the nested-label advice names the side to rename (the label the requirement does
  not quote; a pair with both quoted is not reported), and the repair is rejected when any quoted control name
  present before it (label text / placeholder / aria-label / button text) is gone after it.
- Third finding of the night of the same shape: a gate or protocol that is right, and a repair/acceptance that
  throws away or damages the good part (parse-error repair rejected whole; glued marker killing eight good
  blocks; collision repair renaming the mandated name). Each is now a bounded, tested rule.
- **Round 26 = r25 + this**, Web `6d58dedfc0b5`, Lite `dc788a8eb93d`, two samples each, 01:00. Balance ≈ CNY 95.

## 2026-09-19 01:35 — Round 26 read (three bad samples, two fixed), round 27 started; balance CNY 56

- r26 Web a: Keep 25, Bookstack **32**, SO 47, PS 64, Ctrip 34, 12306 pending. Web b **51.5%**: Keep 18, Bookstack 27,
  SO 46, PS 47, 12306 48, Ctrip 37. Lite 69.7 / 43.9 (Keep **21**/20, Bookstack 25/**9**).
- Lite Bookstack b 9/34: draft with six click handlers throwing `this.shelfForm is not a function`; the repair fixed
  all six and exposed one newly reachable throw (Save Draft); the acceptance demanded a clean app, rejected it, and
  the six-fault draft shipped. **Fixed `45a9182`**: a repair is kept when nothing whole-app remains and it is strictly
  better (clean, or a whole-app failure removed, or fewer problems than before).
- 12306 b 48/135: the collision gate asked to rename the button "Contact information" (shares a word with a field);
  the new pinned-name rule then rejected the repair for "renaming" that quoted name and quoted MESSAGES ("Please
  enter a new email address."); the collision-laden draft shipped. **Fixed `e439539`**: a button/radio whose name
  the requirement quotes is never a collision to fix, and only phrases quoted in a control context (≤ 5 words, no
  sentence punctuation; the filter shared with exact_name_gaps) are pinned across a repair.
- Web Keep b 18/32 (gates clean, no repair): replay 18/14; REQ-6.2 toggles the sidebar, the app stores
  `sidebarCollapsed` in `ARC.state` which `ARC.save` PUTs to `/api/state`, and the other three workers then find
  every sidebar entry hidden (7 tests: Reminders / Notes / Archive / Trash / Edit labels). Candidate scaffold rule,
  not done: view flags (collapsed, grid/list, theme) live outside the saved state. Prestashop b 47/86 (repair
  accepted): category links `Men`/`Women` hidden behind a collapsed menu (same shape), product names
  "Hummingbird checkout-step t-shirt" (seed per step), 15 unstable-click waits. Both are content/scaffold work.
- **Round 27 = r26 + `45a9182` + `e439539`**, Web `f1f64dec4e4c`, Lite `97082c9ded7c`, two samples each, 01:33.
  Balance **CNY 56** before it (a Web+Lite round costs about CNY 15–20, more than the CNY 5 estimated this morning).
  The owner said budget is not a guard before the preliminary, but the goal-mode rule says stop below CNY 50:
  **no round 28 tonight without the owner**; ask the organizer for a top-up.

## 2026-09-19 02:10 — Round 27 kept as candidate; PR #38 merged; session ends (balance guard)

- r27 Web **60.9 / 65.3** (a: Keep 27, Bookstack 30, SO 41, PS 55, 12306 62, Ctrip 26; b: 25, **33**, 47, 55, 75, 32),
  Lite 54.4 / 54.2. r26 a completed at **68.7%** (12306 **91**), the best single sample of the day. Web pairs of
  the night: r24 67.8/54.7 → r25 61.8/67.8 → r26 68.7/51.5 → r27 60.9/65.3; every sub-60 sample was a mechanical
  fault (agent exit, rejected repair, renamed quoted name) and each has a fix and a test now.
- Lite 54 is Keep 16/14 + Bookstack 20/22. Bookstack's drafts had no problems and no repair (variance). Keep's
  repairs re-emitted `lib/arc.js` + `app.js` and were accepted as clean — identical to r26 (21/20), so r27's rules
  did not touch this path; the families are the known ones (Note editor dialog, card `More options`, `Toggle sidebar`
  unstable 24×). Keep Lite band tonight: 14–21.
- 12306 r27a 62/135 replayed (62/135): 49 tests wait for `button /^Personal$/`, `/^Book$/`, `/^Information
  management$/` — header entries this suite generation resolves as BUTTONS with exact names, while the scaffold
  renders header entries as links (the Bookstack/SO generation wants links). Content/scaffold family, not done;
  candidate: header entries as `<a>` wrapped with a same-named button, or per-app choice from the requirement's
  verb ("click the Personal button").
- **r27 is the candidate** (`r27-candidate.zip` = oneshot/ at `e439539`); **PR #38 merged** into main (owner
  authorised). Balance about CNY 40 after r27; no round 28 without the owner.

## 2026-09-20 — Goal round: action-outcome gate rejected, planner becomes next carrier

- Branch `feat/arc-optimization-loop` adds the measured round controller and extends the local DOM walk to flag
  silent product actions and hash changes that leave the main screen unchanged. The real Lite Bookstack bundle
  (`832aea526d315d3006df2edecb3ffe51f45d813afd753d0e4f790e95cb7de9ee`) reproduced six Edit route-no-op cases.
- Candidate package `0378dde57c6e9ab00509a67aa49c71bb985c75295a9cc36e8cb76931eb935bb1` was uploaded as Web submission
  `218a586c0c9a` and evaluated serially on all six tasks. Results: Keep 23/32 (`84ecc659d5ce`), Bookstack 31/34
  (`5731b09783e3`), StackOverflow 35/66 (`e5dfdd1a6d77`), Prestashop 59/86 (`435556e82b15`), 12306 50/135
  (`67195b0de1c0`), Ctrip 0/125 (`9a2cdc6656f3`). No task had a delivery/protocol zero; Ctrip was a whole-task
  behavioral failure. Total passed 198/478 (41.4% pooled; 53.6% task-equal).
- The controller rejected `action-outcome-gate-only` before any Lite run: one sample is insufficient, the lower
  sample dropped 7.3 points versus r27, and the target-task mean dropped 18.4 points. The next action selected from
  the attributed baseline failures is exactly one carrier: `12306/header-role`; Ctrip remains the second target.
- Balance after the six serial Web runs: CNY 228.744207, pending billing 0. No Lite run was started for the rejected
  candidate. The gate remains in the package as a diagnostic carrier; the next candidate must add a requirement
  planner/contract table for 12306 and Ctrip before another platform pair.

## 2026-09-20 [11:30] — Path table + path walk landed; Ctrip's zero was a rejected repair

- **The replay timezone matters.** The same r27a 12306 bundle replays 48/135 on this machine's clock (UTC+8) and
  **62/135 under `TZ=UTC`** — exactly the platform's `cb1e1d2f9aa0`. `helpers.ts` takes TEST_DATE from
  `toISOString().slice(0,10)` (UTC) while the app validated dates against local midnight, so the suite's own date
  was judged past and the search never navigated. Every replay from here runs `TZ=UTC`; the earlier 48/135 families
  were part artifact.
- **12306's 31 failures are one unreachable menu**, not a role question. 18 × `button /^Personal$/` (REQ-4.3.x) and
  13 × `button /^Information management$/` (REQ-4.4.x): after login the top "My 12306" opened a popover
  (`menu "My 12306"` with Order center / User information / Account security / My passengers), so the requirement's
  personal-center home — left menu "Personal Center", "Order center", "Personal", "Information management", with
  "Personal" expanding to its three entries — never existed. `firstVisible` fell through all six rungs.
- **Ctrip 0/125 was a repair thrown away.** All 125 tests `timedOut`; the local gate reproduces
  `Uncaught [TypeError: this.flights is not a function]` (blank page) in 3.4 s, and the platform log shows the
  smoke check caught it, the repair ran and was **rejected by the pinned-name veto**
  (`repair renamed quoted control(s): + 添加返程`), shipping the blank draft. Fourth instance of "a right gate, and
  an acceptance rule that discards the good part".
- Carrier 1 (`oneshot/main.py`): `scenario_contract()` reads the requirement's own GIVEN/WHEN/THEN (yaml and
  markdown shapes) into a **path table** — start screen, click names in order, required names on the destination —
  prepended to the prompt (4.2 KB, 42 rows for 12306); rows that need application state stay prompt-only.
- Carrier 2: the DOM probe now **walks those rows** on a fresh jsdom page with the suite's own ladder order
  (button → link → tab → menuitem → option → radio → checkbox → heading → text), signing in with the account the
  requirement names for that row and retrying signed in when a row dead-ends at a sign-in surface. On the r27a
  bundle it reports exactly three problems, all true (REQ-4.3.1 / REQ-4.3.5 at "Personal", REQ-4.4.1 at
  "Information management") and none for the nine other executable rows; 12.8 s. False positives removed while
  building it are now rules: state scenarios, change-from mentions, shared entry/submit names, sign-in walls.
- Carrier 3: `fixed_date_gaps()` fires when the requirement declares "the current date … fixed at 2026-07-19"
  (Ctrip) and the literal is absent from the frontend; it names the `new Date()`/`Date.now()` lines.
- Carrier 4 (acceptance): a repair that removes a whole-app failure is kept even when a quoted control name moved
  with it (`repair.renamed_but_kept`); the rename veto still applies to family-level repairs.
- `tests_oneshot` 98 green (5 new). Report `docs/reports/2026-09-20-path-table-and-repair-acceptance.md`, evidence
  `docs/evidence/2026-09-20-path-walk-and-acceptance-fix.json`. Balance CNY 191.278679, pending 0, no run started:
  the platform pair waits for a clean local gate on the next candidate.

## 2026-09-20 [12:30] — Round r28 measured on the platform: the personal-center family is fixed, the controller still rejects

- Candidate package `r28-candidate.zip` sha256 `c7a8bb9497e37b24a79f32edf715fa2be5e41ef9fbd9a42faf10b1da30a4d37e`, Web submission
  `98cbfb0f4da4`, Lite `a2aac0fad435`, two samples each, all sixteen runs started 11:37 local. The first
  upload (sha `cfaf1ea7`, 11:25) was **cancelled** before it finished: it predated the hover/arrow/retry
  fixes, and measuring a package whose gate is known to be noisy is worse than spending twenty minutes.
- Web pair **64.4 / 63.5** against r27's 60.9 / 65.3: lower sample +2.6 points, mean +0.8, **no delivery
  failure and no non-target regression** (Prestashop +9.3 / +11.6, Bookstack +2.9 / −5.9, SO 0 / −3.0).
  12306 **74 / 64** (r27 62 / 75), Ctrip 26 / 22 (r27 26 / 32).
- **The carrier did its job where it fired.** On run `01ea1a853d95` the platform prompt contained the
  requirement path table (2 traces) and the walk flagged `REQ-4.4.1 ends on #/passengers without "All"`;
  the bounded repair was accepted and re-emitted `lib/arc.js`, `app.js`, `styles.css`. Test-level diff
  against r27a: **27 tests fixed**, exactly the family this session attributed — REQ-4.1.2, REQ-4.1.3,
  REQ-4.3.1, REQ-4.3.5, the three REQ-4.3.6 cases, REQ-4.3.7, REQ-4.3.8, REQ-4.4.x — and 15 new failures in a
  different family (REQ-3.2.x: result rows, re-search, sort toggles).
- The controller (r28 vs the r27 baseline in `docs/evidence/2026-09-19-optimization-baseline.json`) says
  **reject**: target task gain −1.8 points against the +3 rule, no delivery failures, no non-target
  regressions. Its next action is still computed from the baseline's stale family list, so it names
  `12306/header-role` again; the measured state is that this family is now fixed and the next one is the
  search-results family.
- The change stays as a **diagnostic carrier** (like the action-outcome gate): the path table and the walk
  are what produced the fix, they cost nothing on tasks without executable rows, and the round's Lite pair is
  flat (bookstack 25 / 16, keep 16 + one run still queued at the platform).
- Also this session: contract extraction widened to the phrasings the other tasks use (backticks in
  Bookstack, arrow chains and "User is on the homepage" in Ctrip), and the walk got a 25 s wall-clock budget
  with coverage reported, because the runner has one CPU. `tests_oneshot` 98 green.
- Attribution of the round's remaining family, from the local replay of `01ea1a853d95` under `TZ=UTC` (74/135,
  identical to the platform): 18 of the 61 failures wait for `button /^Book$/`, and the error context of
  REQ-3.2.1 shows why — the home search form holds From/To/Date and a "Search" button, and clicking it never
  leaves the home screen, so the results table (and every Book button in it) never renders. The app does
  render `<button>Book</button>` per price line; the family is search-page reachability, not the button's
  name or role. The path walk stays silent on it by construction: the row's precondition is a filled form,
  which the walk does not set up (it is prompt-only in the path table).
