# mini-SWE-agent comparison — 2026-09-22

The completed comparison does **not justify migrating the competition agent** to this mini-SWE integration under the measured budget. The existing repair policy fixed the scoped journeys in one call per app, while mini exhausted its conservative allowance during inspection and browser exploration without modifying application source. Neither approach increased the independent 125-case score; the classic B candidate lost two cases and is rejected.

## Final paired results

All rows use the same two saved applications, requirement bytes, shared-backend checks and Flash model. The scoped suite has nine booking/payment checks, alongside 27 existing regression journeys.

| Sample / approach | Scoped checks before / after | Independent score before / after | Complete model calls | Settled cost CNY |
|---|---:|---:|---:|---:|
| A / fixed feedback | 5/9 to 9/9 | 49/125 to 49/125 | 1 | 0.281351 |
| A / mini native tools | 5/9 to 5/9 | 49/125 to 49/125 | 22 | 0.298123 |
| B / fixed feedback | 6/9 to 9/9 | 48/125 to 46/125 | 1 | 0.390647 |
| B / mini native tools | 6/9 to 6/9 | 48/125 to 48/125 | 17 | 0.401176 |

Both mini workspaces exactly match their baseline source hashes. They wrote diagnostic scripts in the notes directory, but made no application changes and never invoked protected verification. Their independent results therefore reuse the already measured, byte-identical baseline applications. Classic A had no public-case gains or losses; classic B lost REQ-4.3.1 and REQ-4.3.2 (payment entry/method paths). Its scoped tests passing is not a reason to promote that regression.

## What was actually integrated

The upstream revision is mini-SWE-agent 2.4.6 at `04d809ceab9df28f9adaed044884180159172930`. Its DefaultAgent loop remains unchanged; an atomic-save subclass and custom model/environment adapters attach our gateway, source workspace, live browser, fixed verification and checkpoints. The [upstream customization interface](https://mini-swe-agent.com/v2/advanced/cookbook/) supports these adapters. This is not native Codex `/goal`.

The final interface exposes native `bash`, `arc_build`, `arc_browser`, `arc_verify`, `arc_status` and `arc_submit` tools. Application source is editable in a network-isolated container; live backend data lives in a disposable copy. Fixed checks, evaluator source, credentials and accounting stay outside the agent container. Model-authored checks are diagnostic only. Native tool IDs and all assistant reasoning fields are preserved according to the [DeepSeek tool-call contract](https://api-docs.deepseek.com/guides/thinking_mode/).

An earlier integration exposed the workflow tools as virtual bash commands. Both minis spent calls searching for an `arc` executable. That is our integration defect, and those trials are not final evidence against upstream mini-SWE-agent. It was corrected to explicit native tools and both mini samples were rerun. The valid classic controls were reused because their model inputs, source, acceptance policy and budget do not depend on this interface. All earlier artifacts and expenses remain separate.

## Budget interpretation

Each arm had a CNY 3 conservative **uncached token-cost allowance**, at input/output rates of 3/9 CNY per million tokens, up to 32 request slots and six verification attempts. Before a request, the adapter reserves a UTF-8 input bound plus output capacity, with at least 8,192 output tokens available. Consequently it can stop before the nominal ceiling; this is not a claim that mini spent CNY 3 in settled fees. Cache discounts are excluded from the allowance and included only when reconciling actual bills.

Mini A consumed 782,193 input and 4,270 output tokens; mini B consumed 679,317 input and 12,645 output tokens. The classic calls used 66,160/30,325 and 65,532/30,800 respectively. The larger repeated input histories and the conservative next-request reservation exhausted mini’s allowance before it turned observations into source edits. The result applies to this integration and budget policy, not every possible mini configuration or a larger cached-cost budget.

| Approach | Provider HTTP seconds | Active controller seconds |
|---|---:|---:|
| classic-a-relay | 192.402 | 408.247 |
| mini-a-native-tools | 95.984 | 319.227 |
| classic-b-relay | 218.811 | 439.204 |
| mini-b-native-tools | 146.648 | 357.166 |

The timing columns include the measured provider HTTP interval and active controller invocations, including recovered invocations. Operator gaps and independent replay time are not included. Runs overlapped and some needed transport recovery, so these are diagnostics rather than an official speed ranking.

## Transport and recovery findings

Six direct streams ended without complete usage and application output. One early adapter error incorrectly described a missing response as a different model; raw evidence showed empty HTTP/SSE or a truncated stream. Error precedence was fixed, and these failures remain transport evidence rather than model-quality outcomes.

The detached relay completes a bounded HTTPS request on the user-owned Hong Kong host and retrieves checksummed chunks over short SSH operations. Credentials travel only through process pipes. A stable job ID makes launch retries idempotent; a temporary shared SSH connection avoids repeated authentication bursts. Cleanup failure cannot invalidate a complete response. Classic A’s complete remote response was recovered without another model request. Two failed SSH launches were established as not sent by the complete owned-job inventory and retained transport evidence; their original records remain archived.

Final comparison cost is **CNY 1.371297**. Across integration trials, failed-route investigations and the final comparison, confirmed cost is **CNY 2.044966**. Six incomplete direct calls still have unknown usage/cost; unknown is not zero. Every completed request has a matched bill. Matches use exact model/input/output totals and nearest provider completion, not an asserted identity between provider and billing request IDs.

## Verification and limits

Twelve adapter/relay control tests pass. Required legacy validation passed 214 tests with 12 skips. Real checks validated container build/browser access, native API/tool round-trips, complete response recovery, checksum retrieval, idempotent relay launch and zero-repeat recovery. The 41 completed model responses in the final comparison match their captured SSE, request hashes, declared model and usage. Classic selected sources exactly equal the model file patches; mini source hashes are unchanged.

The local runtime is ARM64, Node 20.19.3 / Playwright 1.57.0, one CPU, 2GB and one worker. It does not reproduce the full official x86_64 lifecycle. Two saved drafts and nine scoped checks do not establish broad task generalization. Passing those checks does not establish full requirement coverage. No official run/upload, main merge or competition-entrypoint change occurred.

Retain the existing competition selections and the reusable transport/verification work as experimental tooling. Do not migrate based on turn count. A future change should address a concrete remaining failure or demonstrate useful edits at comparable cost; this experiment has not provided that evidence for the external harness.

See [the complete receipt](../evidence/2026-09-22-mini-swe-comparison.json) and [execution reference](../reference/mini-swe-experiment.md).
