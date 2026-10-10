Generated browser tests can pass while the application still violates business rules. This candidate adds a bounded source review after UI repair: propose up to four counterexamples from public requirements and current code, execute the actual functions, validate fixture semantics with execution feedback, then repair against the fixed browser and source checks together.

The executor rebinds current source on every check, preserves real namespace methods/constants, and separates invalid prerequisites or runtime fixtures from failed assertions. Calls and assertions in preconditions cannot certify the check. Fixture error-to-pass changes never count as repair gains. Pure functions may have an empty external setup. The previous extra UI coverage audit is opt-in, and a captured unambiguous single-hunk EDIT closure variant is recovered without inventing content.

Validation and limits:
- Last broad run: 256 one-shot passes with 3 optional skips; 214 legacy passes with 12 optional skips. Latest checker changes: 14 focused passes and 2 package-name passes. Exact ZIP secret scan: zero findings.
- Actual-source checks exercised frozen applications and newly generated namespace-based code. The original controlled fixes also exposed a separate preservation regression, so targeted and aggregate gains do not establish full correctness.
- Fresh v1 independent judges: GitHub 67/71, Sheet 91/90. Sheet's source phase stopped at the now-fixed empty-setup rejection; its untouched model response now executes four real counterexamples. Fresh v2 Sheet: 90/95, with all 100 original UI scenarios and three source checks passing. v2 GitHub remains in validation.
- The latest ZIP has targeted and real-source replay evidence, not a separately completed fresh local trajectory. Generation and UI-repair files are unchanged from those local trials. One v1 local gate missed by one point; the official run is an explicitly recorded bounded experiment, not a mainline promotion or a mixed local score.

Official submission `e963e1a3e56c`, SHA-256 `c5832d5275a76144c3f5e60ad3482d2d442ae1bf468accd1557c91107ca68820`, is running as a complete pair: GitHub `07c92a18ffb4`, Sheet `cee35cb1fb7f`. No official result yet. The goal remains overall S >= 70 in one complete submission. Keep this PR draft until the official evidence supports promotion.

This branch preserves the ancestry of #110. Evidence and experiment boundaries are in `docs/evidence/2026-10-02-s70-official-experiment-r1.json` and roadmap 4.36. No task-specific application, fixture or probe is shipped in the agent ZIP.
