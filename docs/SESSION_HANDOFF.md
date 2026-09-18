# Current handoff — 2026-09-18 17:05 (Fable + owner; read this section, then progress.md from "17:00")

Branch `goal/round-1` (head pushed) = main `ff686e3` + the day's commits; open a PR to main when round 19 is
judged. Doctrine: ADR 0001 (gate → scaffold → table → prose), ADR 0002 (model policy). Working mode set by
the owner: Fable and the owner directly, no Codex/Opus dispatch. `arcbench` needs
`--env-file ~/.config/arcbench/volo.env`.

## State
- Web board 72.3% (rank 5). Round 18 (§7b + vocabulary table + scaffold v2) **dropped**: 52.2 / 45.6 vs round 17's 65.2 / 58.7. Lite rose ~19% → 27.6 / 27.5 (Keep 5 → 12/11, Bookstack flat).
- Three causes found and answered (progress 17:00): Ctrip whole-task zero from `finish_reason=content_filter`
  (`7169cb9`: keep the partial draft, continue on the fallback model); StackOverflow prose nouns no longer
  written (scaffold footer carries `Header · Sidebar · Main content · Footer`, checklist note); Lite Bookstack's
  click-ladder race (scaffold renders in the click's task — bundle replay 6 → 22/34).
- **Round 19 running**: Lite submission `0aa67e9eaa9b`, two samples (`r19{a,b}-runs-arc-bench-lite.json`, 16:58);
  Web submission `3d5bb7a3cc1b`, two samples ~17:00 (`scratchpad/r19_web_chain.py` polls them and writes
  `runs/2026-09-18-goal/r19-final.json` when every run is terminal). Ids in `r19{a,b}-runs-arc-bench-web.json`.
- Local replays: `bigtask-keep/harness_lab/state_rehearsal.py --app <app> --app-dir <bundle>/template --profile
  hosted [--tests-dir runs/2026-09-18-goal/lite-testsets/arc-bench-lite--<app>]`; artifacts under
  `<work-dir>/artifacts/*/error-context.md` (the "waiting for" line names the rung the ladder fell to).

## Next
1. Read round 19 (`r19-final.json`). Keep if Web does not drop against 65.2 / 58.7 AND Lite Bookstack rises
   (replay predicts ~20/34 before the model's own bugs). If Web stays low with the SO prose tests still failing,
   the vocabulary table is the suspect: ablate it (table off, §7b on) on a Web pair.
2. Candidate gate: jsdom walk that clicks each seed link on the list screens and expects the main heading to
   become the link text (Bookstack r18a route bug, 20 tests). Candidate rules not encoded: Bookstack's tags
   BUTTON, `Confirm Delete`, swapped `Create New Book` / `New Book` (helper contradicts the requirement).
3. Planner stage (stronger gateway model, short output: screens / exact control names / seed rows / routes)
   before the flash draft — untried.
4. PR `goal/round-1` → main once round 19 is judged. Formal round 2026-09-21: two hidden tasks.

---

---

Older handoff sections are in `archive/handoffs/` (one file per section, newest first in `README.md`).
