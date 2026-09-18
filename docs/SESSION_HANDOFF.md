# Current handoff — 2026-09-18 17:45 (Fable + owner; read this section, then progress.md from "17:40")

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
- **Round 19 kept**: Web 65.5 / 60.0 (vs 65.2 / 58.7), Lite 54.0 / 55.6 (vs 27.6 / 27.5). Ledger rows 19a/19b/lite19;
  results in `runs/2026-09-18-goal/r19-final.json`. Package = `r19-candidate.zip` (Web submission `3d5bb7a3cc1b`,
  Lite `0aa67e9eaa9b`). Lite board 55.6% rank 6; Web board 72.3% rank 5.
- Docs layout changed (`8236924`): `docs/README.md` is the map and the policy; reports live in `docs/reports/`
  with date prefixes, the goal ledger is `docs/reports/2026-09-18-goal-ledger.md`, old handoff sections in
  `docs/archive/handoffs/`.
- Local replays: `bigtask-keep/harness_lab/state_rehearsal.py --app <app> --app-dir <bundle>/template --profile
  hosted [--tests-dir runs/2026-09-18-goal/lite-testsets/arc-bench-lite--<app>]`; artifacts under
  `<work-dir>/artifacts/*/error-context.md` (the "waiting for" line names the rung the ladder fell to).

## Next
1. Ctrip is 19/125 in both round-19 samples (36/37 in round 17; the drop began in round 18). Attribute the
   round-19 Ctrip bundle (download `586c93b426ce`, `scripts/attribute_runs.py`, local replay, error contexts)
   before changing anything; suspects are the §7b exact-name rule and the vocabulary table on a Chinese app.
2. Candidate gate: jsdom walk that clicks each seed link on the list screens and expects the main heading to
   become the link text (Bookstack r18a route bug, 20 tests). Candidate rules not encoded: Bookstack's tags
   BUTTON, `Confirm Delete`, swapped `Create New Book` / `New Book` (helper contradicts the requirement).
3. Planner stage (stronger gateway model, short output: screens / exact control names / seed rows / routes)
   before the flash draft — untried.
4. PR `goal/round-1` → main once round 19 is judged. Formal round 2026-09-21: two hidden tasks.

---

---

Older handoff sections are in `archive/handoffs/` (one file per section, newest first in `README.md`).
