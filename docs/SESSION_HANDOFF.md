# Current handoff — 2026-09-19 01:05 (Fable + owner; read this section, then progress.md from "23:35")

Branch `goal/round-1` (head pushed) = main `ff686e3` + the day's commits; **PR #38** goal/round-1 → main is open.
Doctrine: ADR 0001 (gate → scaffold → table → prose), ADR 0002 (model policy). Working mode set by the owner:
Fable and the owner directly, no Codex/Opus dispatch. `arcbench` needs `--env-file ~/.config/arcbench/volo.env`
(never `source` it in zsh: the cookie value contains `;`).

## State
- Web board 72.3% (rank 5), Lite board **68.0%** (rank 7, from 55.6). Candidate = **r25** (`r25-candidate.zip`,
  Web 61.8 / 67.8, Lite 65.0 / 66.5); r24 (67.8 / 54.7, Lite 68.2 / 60.6) was the best single sample.
- Tonight's three fixes are all "the gate was right, the repair/acceptance threw the good part away":
  (1) r23a Prestashop 0/86 = parse error the DOM probe caught but the repair could not locate → `node --check`
  syntax gate with file:line + repairs that remove a whole-app failure are kept (`3cc0f24`, `d97509f`);
  (2) r24b Keep 0/32 = `</think>=== FILE: … ===` glued on one line → marker at end of line opens the block (`8c96fe4`);
  (3) r25a 12306 54/135 = collision repair renamed the quoted "From"/"To" → advice names the side to rename,
  repair rejected if a quoted control name disappears (`0ba726d`). tests_oneshot 81 green.
- Round 26 (r25 + fix 3): Web a 25/32/47/64/?/34, b **51.5%** (three bad samples, two of them repair-acceptance
  faults, both fixed: `45a9182` strictly-fewer-problems repairs are kept; `e439539` quoted button names are not
  collisions and only quoted control phrases are pinned). Lite 69.7 / 43.9 (Keep 21 = new high).
- **Round 27 running** (r26 + those two): Web `f1f64dec4e4c`, Lite `97082c9ded7c`, two samples each, 01:33.
  `runs/2026-09-18-goal/r27-wait.sh` → `r27-final.txt` + `.done`; `python3 finalize_round.py 27` rebuilds the
  summary from `arcbench status` any time (`arcbench wait` emits JSON lines and returns on the first FAILED).
- **Balance CNY 56 before round 27** (a Web+Lite pair round costs CNY 15–20). Goal-mode guard: stop below 50.
  No round 28 without the owner; ask the organizer for a top-up.
- Downloads: the platform cuts bundle streams near the end; the installed `arcbench download` fails. Use the
  scratchpad `resume_download.py <run> <out.zip>` (Range resume) until arcbench-cli **PR #8** is merged and reinstalled.
- Local replays: `bigtask-keep/harness_lab/state_rehearsal.py --app <app> --app-dir <bundle>/template --profile
  hosted --work-dir <dir> --json <file>`; failure reasons: `grep -h "waiting for" <dir>/artifacts/*/error-context.md | sort | uniq -c`.
- Full run logs need `arcbench logs <run> --offset 0 --tail 100000 --out <dir>` (default is the last 42 lines);
  the platform redacts `***` inside the smoke JSON, so parse it with regex, not json.loads.

## Next
1. Judge r27 against r25 (61.8 / 67.8; no drop → r27 is the candidate); then **merge PR #38** (owner authorised merging
   volo-factory PRs) and rebuild the candidate zip from main.
2. Remaining Web losses by size: Ctrip (25–45/125; login placeholders from a screenshot, more-services menu),
   12306 bad samples (attribute each with the replay), SO 44–48/66, Prestashop 57–68/86. Lite Keep 19–20/32:
   the families listed in progress 22:35 need a scaffold primitive or a gate, not prose. New scaffold candidate
   (progress 01:35): view flags (sidebar collapsed, grid/list) must not ride in the saved state — one worker's
   REQ-6.2 toggle hid the sidebar for the other three (Keep 18/32; Prestashop's collapsed category menu is the same shape).
3. Planner stage for the large tasks (untried); seed-link heading walk gate (Bookstack r18a route bug).
4. Formal round 2026-09-21: several submissions allowed, best or average counts (owner 09-18 18:42).

---

---

Older handoff sections are in `archive/handoffs/` (one file per section, newest first in `README.md`).
