# ADR 0002 — Model policy for the formal round

Date: 2026-09-18. Status: accepted (owner, 09:50–11:00).

## Decision
- Generator: `deepseek-v4-flash`, temperature 0, explicit `max_tokens` 131072.
- Same-model retries (three per call) first; only when all are transport failures does the run switch
  to `FALLBACK_MODEL` (`qwen3.7-plus`) for the rest of the run. Permanent HTTP errors never switch.
- No best-of-2 drafts; the whole-app bad samples are attacked with gates instead. *Superseded 09-25 by the owner: two drafts, the second judged by the written tests when the first passes under a third of them (roadmap 4.17).*
- glm-5.3 is out on this gateway.
- Gateway balance is not a guard before the preliminary (organizer tops up).

## Evidence
- Uncapped flash (local Keep, 09-18 10:20): `length` at 95,200 tokens with 13.6k characters of content,
  then `length` again; the platform draft with the cap finished `stop`. The provider applies a lower
  ceiling of its own; omitting the cap buys nothing.
- glm-5.3: three attempts, each cut by the gateway at 1201 s with no content; the gateway accepts
  `thinking` / `reasoning_effort` and ignores both (09:57 probe); reasoning runs at ~35 tok/s.
- Temperature 0 pairs (64.5/58.6, 52.6/67.1, 56.5/63.0) are tighter than the temperature-0.3 pair
  (60.8/34.0).
- Best-of-2 by gate count would have caught one of the two whole-app bad samples of the night (SO r14)
  and that one is caught by the jsdom `fetch` fix for free; Keep r11 had one gate problem and an
  accepted repair.

## Consequences
Model swaps are decided by paired runs only. A route cut in the formal run costs three retries
(≤45 minutes worst case) before the switch.
