# Distillation: moving know-how down to where a weaker model can use it (2026-09-18)

Owner's question (12:38): if the tasks were Fable's, what would it do differently, and can that
know-how be turned into lower-dimensional knowledge that a weaker model (deepseek-v4-flash, the
formal-round generator) uses to the same effect? This page records the answer, the decisions taken on
it, and the plan. Decisions are also ADRs 0001/0002.

## What Fable would do differently (only three things)

1. Turn the requirement into a table before writing code: every quoted string, every noun in a THEN
   step, every screen — "this word must be visible on this screen".
2. Start from a skeleton known to pass: shared layout function, in-memory store, hash router,
   hover-revealed row actions, inert-on-open dialogs, `role=status` notifications.
3. Open the finished page and check the table row by row.

Everything else (the helpers' quirks: button outranks link, bare-verb `.first()`, container
`aria-label` hijacks `fill`) Fable also only knows from reading `helpers.ts`; that reading is
already distilled into `oneshot/dialect.md`. The know-how exists; its carrier is too high-dimensional.

## The ladder

| level | carrier | what the student must do | state on 09-18 |
|---|---|---|---|
| 3 | prose rules (the card) | read, recognise the situation, derive the implementation | 126–153 lines; the model often fails to recognise (r15 SO rendered the home screen without the layout although §8 said so) |
| 2 | tables computed by code from the requirement | fill in | the vocabulary gate computes the table but only checks it afterwards |
| 1 | scaffold code shipped with the package | extend, never re-invent | not tried; largest untried lever |
| 0 | deterministic gates + one bounded repair | nothing | four gates, each killed a whole failure family |

Empirical rule from today: the same knowledge as code beats it as prose by an order of magnitude.
`fetch`, landmarks and label collisions all existed as prose first, the model kept violating them, and
only the gate stopped the family. Every new failure family is therefore asked, in order: can it be a
gate, a scaffold primitive, a table row — and only then a card sentence.

What cannot be distilled: logic faults in the tail (Ctrip's login entry that opens nothing). No carrier
reaches them; the scaffold only shrinks the surface where they can occur. The formal round is unattended
and only the organizer's gateway models exist inside it, so whatever is not in one of the four carriers by
09-21 does not exist on the day.

## Superpowers (obra/superpowers, main, 288k stars, pushed 2026-09-18) for flash

Read: `writing-plans`, `test-driven-development`, `verification-before-completion`,
`systematic-debugging`, README. It is a harness-level discipline for interactive coding agents; our
runtime is a Python script making three chat calls with no human and no tools. So the skills cannot be
installed; they can only become pipeline stages or prompt sections. Assessment per skill:

- `writing-plans` — transfers, and is the owner's intuition made precise. Its central claim is that a
  plan written "for an enthusiastic junior engineer with poor taste, no judgement, no project context"
  lets a weak executor succeed; the task template is exact file paths, exact interface names, one action
  per step, no placeholders, a self-review for spec coverage. That is level 2 of the ladder: a per-task
  plan (screens, controls with exact accessible names, seed rows, routes, messages) generated before the
  code call. The planner can be a stronger gateway model with a short output (deepseek-v4-pro or
  qwen3.7-max, a few thousand tokens, well inside the 20-minute stream ceiling) and flash executes.
- `test-driven-development` ("if you didn't watch the test fail, you don't know it tests the right
  thing") — transfers as the gate discipline: run the check before the repair and again after (already
  done) and add the screen-walk gate so the runtime check resembles the suite's path. Literal red/green
  inside one generation call is not available to a model without tools.
- `verification-before-completion` ("evidence before claims") — already the doctrine: nothing ships on the
  model's say-so, gates decide.
- `systematic-debugging` (root cause before fix) — transfers to the repair prompt, which already states
  the mechanism behind each problem rather than the symptom.
- `brainstorming`, `subagent-driven-development`, `using-git-worktrees`, code-review skills — do not
  transfer: unattended, single process; our own multi-agent loop on 09-15 cost 8× and scored lower than
  one-shot.

Conclusion: the repo as a whole is not installable here, and its multi-agent parts are the route we
already lost with. Its plan discipline is the one piece worth taking, as a planning stage in front of
generation. It is an experiment, not a fact: ablate on the six tasks, two samples per arm.

## Plan (owner 12:47: "think less, execute")

1. Scaffold (level 1): `oneshot/scaffold/` — a small fixed app (layout, router, store, dialog,
   row-actions, notifications, backend with process guards and `/api/health`) shipped in the package
   and placed in the stage before generation; the prompt shows it as the base to extend. Each primitive
   file carries a header naming the evaluator mechanic it satisfies, so the directory doubles as the
   "generic architecture knowledge base for ARC" the owner asked for. Ablate vs round 16.
2. Table (level 2): prepend the quoted-vocabulary table (grouped by requirement section) to the prompt;
   then the planner stage from the superpowers reading.
3. Screen-walk gate (level 0): from `/`, click every navigation target in jsdom, snapshot each screen's
   text and names, and check each section's quoted phrases against the screens its GIVEN steps reach.
   Targets the "phrase in source, not on the asserted screen" family (half of r15b SO/Prestashop losses).
