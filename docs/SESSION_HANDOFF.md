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
- **Round 26 running** (r25 + fix 3): Web `6d58dedfc0b5`, Lite `dc788a8eb93d`, two samples each, started 01:00.
  `runs/2026-09-18-goal/r26-wait.sh` → `r26-final.txt` + `.done`; `python3 finalize_round.py 26` rebuilds the
  summary from `arcbench status` any time (`arcbench wait` emits JSON lines and returns on the first FAILED).
- Downloads: the platform cuts bundle streams near the end; the installed `arcbench download` fails. Use the
  scratchpad `resume_download.py <run> <out.zip>` (Range resume) until arcbench-cli **PR #8** is merged and reinstalled.
- Local replays: `bigtask-keep/harness_lab/state_rehearsal.py --app <app> --app-dir <bundle>/template --profile
  hosted --work-dir <dir> --json <file>`; failure reasons: `grep -h "waiting for" <dir>/artifacts/*/error-context.md | sort | uniq -c`.
- Full run logs need `arcbench logs <run> --offset 0 --tail 100000 --out <dir>` (default is the last 42 lines);
  the platform redacts `***` inside the smoke JSON, so parse it with regex, not json.loads.

## Next
1. Judge r26 against r25 (no drop → r26 is the candidate); then **merge PR #38** (owner authorised merging
   volo-factory PRs) and rebuild the candidate zip from main.
2. Remaining Web losses by size: Ctrip (25–45/125; login placeholders from a screenshot, more-services menu),
   12306 bad samples (attribute each with the replay), SO 44–48/66, Prestashop 57–68/86. Lite Keep 19–20/32:
   the families listed in progress 22:35 need a scaffold primitive or a gate, not prose.
3. Planner stage for the large tasks (untried); seed-link heading walk gate (Bookstack r18a route bug).
4. Formal round 2026-09-21: several submissions allowed, best or average counts (owner 09-18 18:42).

---

---

Older handoff sections are in `archive/handoffs/` (one file per section, newest first in `README.md`).
