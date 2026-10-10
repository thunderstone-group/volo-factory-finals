The browser-driven repair loop can stop with business-rule defects that its generated UI tests do not exercise. This candidate adds up to four counterexamples derived from the public requirements and current application source, executes the actual functions, and uses a second model pass to validate the fixtures and semantics before repairing.

Definitions remain fixed across repairs. Every check rebinds current source, distinguishes invalid prerequisites/runtime errors from failed assertions, and requires a real subject call and assertion during the check itself. Fixture error-to-pass changes cannot count as repair gains. The previous extra UI coverage audit becomes opt-in. A narrowly bounded parser fix also recovers the single-hunk EDIT closure variant observed in a real gateway reply.

Validation:
- 259 one-shot checks: 256 passed, 3 optional readiness skips. Legacy: 214 passed, 12 optional integration skips.
- Eight model-validated counterexamples fail on the original two generated applications and pass after controlled model repairs.
- Fixed independent public-requirement browser judges: GitHub 69/66 unchanged; Sheet 89/93 to 90/96. Initial controlled repair inputs were operator-calibrated; this does not establish the full autonomous pipeline.
- Source and exact ZIP secret scans passed. No task-specific application, fixture, or probe is included in the package.
- Fresh paired generation of ZIP `1d509a809cc5f5e7bb52523a76b3627c331cfd76d77e496d9fa18646e037314d` is running. Complete official evaluation and promotion remain pending; the goal is S >= 70 in one paired submission.

This branch retains the ancestry and generic diagnostics of draft #110, with the extra audit disabled. See `docs/evidence/2026-10-02-source-contract-pilot.json` and roadmap 4.36 for evidence boundaries.

Follow-up findings:
- A separate preservation control exposed a structural absolute-reference regression in the controlled Sheet repair. The earlier aggregate improvements do not establish absence of regressions.
- A new generated application uses ordinary namespace assignments. The executor now binds the actual namespace methods, constants and receiver, including constants from another referenced namespace. Thirteen focused checks pass, along with a real new-application namespace invocation and the original eight counterexample replays.
- v1 and v2 fresh pairs remain separate and running. The latest `b1061724` package adds the cross-namespace constant correction only in `source_contracts.py`; its generation/UI-phase files are byte-identical to v2. It has not yet had a complete fresh run or official evaluation. Checkpoints are being retained to validate the corrected source phase without changing live runs.
