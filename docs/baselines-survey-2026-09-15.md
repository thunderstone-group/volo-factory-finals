# Are the ARC-Bench web tasks evaluated with mainstream harnesses? — survey of 2026-09-15

Read-only survey by an Opus agent, checked by the main session. Paper text extracted to the
session scratchpad (`research-baselines/arc-paper.txt`, line numbers below refer to it).

## Answer

No mainstream coding harness (Claude Code, Codex CLI, Gemini CLI, Devin) has an official or
public score on ARC-Bench. The closest data is the organizers' own ISSTA 2026 paper
(arXiv 2602.13723), which runs four baselines — MetaGPT, OpenHands, Cursor agent mode, Copilot
agent mode — on the same six apps under the same GUI-test pass-rate metric, all on Gemini 3 Pro
(temperature 1.0, thinking high), three trials each. The paper's "Codex" is the 2021 model
citation, not the CLI.

## Paper Table 2 — GUI test pass rate %, mean ± std of 3 trials (`arc-paper.txt:712-722`)

| App | ARC (organizers) | MetaGPT | OpenHands | Cursor | Copilot |
|---|---|---|---|---|---|
| BookStack | 91.1 ± 5.1 | 76.7 ± 10.0 | 55.6 ± 24.6 | 54.4 ± 12.6 | 52.2 ± 15.0 |
| Keep | 91.9 ± 5.6 | 55.6 ± 13.3 | 40.0 ± 21.2 | 40.7 ± 26.9 | 69.6 ± 4.6 |
| Stack Overflow | 86.7 ± 6.0 | 53.3 ± 6.7 | 37.2 ± 8.6 | 35.0 ± 15.5 | 36.1 ± 6.7 |
| PrestaShop | 85.8 ± 1.5 | 48.0 ± 6.7 | 20.4 ± 12.6 | 68.0 ± 9.3 | 34.7 ± 6.7 |
| 12306 | 78.8 ± 5.7 | 41.3 ± 7.5 | 31.7 ± 11.6 | 50.8 ± 10.6 | 45.0 ± 3.3 |
| Ctrip | 75.4 ± 7.6 | 18.8 ± 6.3 | 15.0 ± 5.7 | 36.3 ± 13.0 | 23.8 ± 11.9 |

## Paper Table 5 — minutes / million tokens

| App | ARC | MetaGPT | OpenHands | Cursor | Copilot |
|---|---|---|---|---|---|
| BookStack | 145.98 / 11.80 | 48.90 / 0.98 | 22.00 / 5.69 | 29.16 / 3.82 | 13.28 / 2.46 |
| Keep | 161.04 / 17.50 | 37.83 / 0.38 | 22.35 / 6.70 | 13.58 / 1.84 | 22.78 / 3.95 |
| Stack Overflow | 231.52 / 21.38 | 42.38 / 0.67 | 52.00 / 14.43 | 16.48 / 3.47 | 22.50 / 5.14 |
| PrestaShop | 253.95 / 22.76 | 42.98 / 0.89 | 34.72 / 3.94 | 19.73 / 4.45 | 14.12 / 2.85 |
| 12306 | 351.52 / 27.02 | 53.72 / 1.23 | 38.73 / 16.29 | 39.11 / 7.26 | 17.40 / 3.81 |
| Ctrip | 363.27 / 26.38 | 35.00 / 0.90 | 26.68 / 5.24 | 16.21 / 2.74 | 18.51 / 3.35 |

How the baselines were driven (`arc-paper.txt:684-690`): Cursor and Copilot from an empty
project template plus the requirement document in a fresh IDE session, agent mode; OpenHands
through its GUI with the template and document uploaded; MetaGPT's official Docker image with
the document as input. All human-driven, none unattended. The authors set no token or time cap
and observe that the baselines often under-use resources (`arc-paper.txt:836-840`).

## Why the paper numbers are not our target line

1. **Model.** Everything in the paper runs Gemini 3 Pro; no deepseek/qwen/flash number exists
   anywhere in it, and the authors list model transfer as an unaddressed threat
   (`arc-paper.txt:1007-1013`). The platform's reference agent is the same code family (the
   submission template differs from the public compiler in 10 Python files, all five SKILL.md
   byte-identical; see `docs/arc-template-map-2026-09-15.md`) but runs deepseek-v4-flash.
2. **Denominator.** Paper Table 1 (`arc-paper.txt:604-611`) versus repository README:

   | App | paper tests | repo tests |
   |---|---:|---:|
   | BookStack | 30 | 34 |
   | Keep | 45 | 32 |
   | Stack Overflow | 60 | 66 |
   | PrestaShop | 75 | 86 |
   | 12306 | 80 | 117 (grep of `test(`: 135) |
   | Ctrip | 80 | 125 |

   The two big apps are capped at 80 in the paper; the competition suites are 30–45% larger
   there. Paper pass rates are optimistic as targets for 12306 and ctrip. Three totals are in
   circulation — README 460, grep 478, our earlier 484 — and none agrees with the others; not
   resolved.
3. **Procedure.** Paper runs are human-driven IDE sessions with no cost accounting; the
   competition runs a containerized package with a hidden suite and a shared metered key.

## Board as of 2026-09-15 (CLI)

Aggregated `arc-bench-web`: VOLO AI 19.6% (CNY 197.53 stamped, run cut by the 402), FT-踏歌行
11.9%, 你也秃对不队 0.0. No harness-named rows; the schema has no harness field.

Per task, top 3: keep 李尧 100 / 你也秃对不队 71.9 / 包子头队 62.5 (VOLO AI 59.4, tied 4th);
bookstack three rows at 100; stackoverflow 李尧 69.7 / FT 37.9 / VOLO AI 16.7; prestashop 睿欣达
18.6 / VOLO AI 15.1; 12306 你也秃对不队 83.0 / FT 21.5; ctrip 包子头队 18.4 / FT 8.8.

The organizers' reference agent (account `ARC`) appears only on the demo boards: smoke 100%
(CNY 3.38, 9.1 M tokens) and ticket-booking 100% (CNY 4.48, 14.1 M tokens). It has never
scored on any of the six big tasks; our planned ARC-template official Keep run is the first
such number.

## What this means for the campaign

- General-purpose harnesses score 15–77% on these apps; our local Keep 25/32 (78%) is in the
  same band. The organizers' 80–92% comes from a requirement→test compiler plus TDD at 5–10×
  the tokens, not from a better general agent.
- The senior threshold (80%) sits above every general baseline in the paper and just below
  ARC's own numbers on the four hardest apps.

## Addendum 13:40 — the paper's suite and the repository's suite are two different sets

Neither is a subset of the other: Keep has more tests in the paper (45 vs 32), BookStack fewer
(30 vs 34), the other four fewer. The requirement graphs differ too (paper Keep 35 nodes vs repo
32; 12306 142 vs 117), and tests hang off requirement nodes. The paper describes construction
only as "one hand-written GUI test per leaf scenario" (`arc-paper.txt:644-647`) with no mention
of curation or the 80 cap on 12306/Ctrip, and publishes no dataset version (no DOI, hash or
artifact; only the project site, `arc-paper.txt:1254`). In the repository the counts have been
constant since the first commit d50b782 (2026-07-20); the five commits touching `tests/` are
in-place rewrites, none adds or removes cases. 12306 has 117 spec files but 135 `test(` calls;
README counts files. Actual total is 478.

Usable from the paper: the ordering between baselines and the "bigger app, lower pass rate"
trend. Not usable: the absolute numbers as target lines on the competition suites.
