# ARC Template — map of the official reference agent

Read-only analysis. Nothing was executed, no network or model was called, no file outside this
directory was modified.

Two copies were compared:

- **Template** (platform-shipped submission):
  `/private/tmp/claude-501/-Users-e0-7-projects/e3606952-f226-40fd-aaf8-7e1e53cf87fe/scratchpad/hackathon/templates/arc/`
- **Compiler repo** (organizers' published source):
  `~/projects/arcbench-campaign/upstream/arc-bench/agentic-requirement-compiler/src/`
- **Public benchmark corpus**:
  `~/projects/arcbench-campaign/upstream/arc-bench/arc-bench/webapp/<app>/{requirements,tests}/`

All file:line anchors below are relative to the **template** root unless stated otherwise.

---

## 0. The two copies, and which is authoritative

| | Platform template | Compiler repo |
|---|---|---|
| Path | `templates/arc/` | `agentic-requirement-compiler/src/` |
| Last commit touching it | packaged with the platform | `f7b35d7`, 2026-08-19 10:34 +0800 |
| Entry point | `main.py:13` rewrites argv to `compile …`, delegates to `arc_main.py` | `main.py` is the full multi-subcommand CLI |

Git history of the compiler directory is only three commits:

```
f7b35d7 2026-08-19 10:34:56 +0800 Add Docker support and update configuration for ARC applications
458d2da 2026-08-18 10:39:10 +0800 Update agentic-requirement-compiler
d50b782 2026-07-20 13:15:26 +0800 Initial ARC reproduction bundle
```

`diff -rq` over the two trees reports exactly **10 differing Python files** and no others.
**All five `SKILL.md` files are byte-identical** between the copies
(`auth-session-consistency`, `leaf-test-layer-selection`, `non-leaf-ui-only-design`,
`leaf-full-design`, `tdd-test-failure-repair`).

The template is the **newer** variant. It adds evolution mode, `.arc/project.json`, intent-based
test regeneration, and selected-test TDD, none of which exist in the repo copy. Four differences
matter to us:

1. **`TDD_RUN_TESTS_BUDGET` is 5 in the template, 10 in the repo** (`core/phases.py:17`).
   Both the TDD user prompt (`agents/context/prompts/test_driven_developer.py:124`) and the repair
   skill (`skills/tdd-test-failure-repair/SKILL.md`, instruction 10) still say
   "a fixed budget of 10 calls". **The shipped agent lies to its own model about its budget.**
2. **Default web port 3301 → 3000** (`core/config.py:16`, `core/workflow.py:84`,
   `agents/context/pipeline.py:14`, `agents/context/prompts/common.py:101`).
3. **`post_template_setup` no longer rewrites `__ARC_WEB_PORT__` placeholders**
   (`app_type_handler/web.py:769`). The new starter template hardcodes 3000, so the substitution
   pass was deleted and replaced with a log line.
4. **`initialize_project` now calls `traceability.init_store(reset=True)`**
   (`core/workflow.py:197`), and `initialize_workspace(seed_template=False)` preserves an existing
   application instead of re-scaffolding (`app_type_handler/base.py:51`).

Files that differ: `core/phases.py`, `core/workflow.py`, `core/config.py`, `main.py`,
`agents/test_generator.py`, `agents/context/pipeline.py`, `agents/context/prompts/common.py`,
`agents/context/prompts/test_generator.py`, `app_type_handler/base.py`, `app_type_handler/web.py`.
Template-only additions: `arc_main.py`, `arc-template/`, `template/`.

---

## 1. Pipeline: requirement tree to finished app

### 1.1 Ordering over the tree

Built once in `core/workflow.py:864-877` as an **Euler tour**:

```python
def walk(node):
    tasks.append(self._make_task(node_id, PHASE_DESIGN, len(tasks)))
    for child in node.get("children", []) or []:
        walk(child)
    tasks.append(self._make_task(node_id, PHASE_IMPLEMENT, len(tasks)))
```

So: `DESIGN` pre-order, recurse into children, `IMPLEMENT` post-order. Exactly two tasks per node,
`task_id = "<node_id>:<PHASE>"` (`workflow.py:882`). Execution is strictly sequential —
`_next_runnable_task` (`workflow.py:970`) returns the first `PENDING` task in list order, nothing
more.

**The `dependencies` field does not affect ordering at all.** It is read in exactly one place,
`_plan_requirement_sync` (`workflow.py:625-626`), to decide which nodes to re-queue when an
incremental requirement change lands. A leaf can therefore be implemented before a sibling leaf it
declares a dependency on. Parent/child containment is the only real ordering guarantee, and it runs
the parent's DESIGN *before* children and the parent's IMPLEMENT *after* them.

Node state machine (`workflow.py:45-52`): `UNSEEN → DESIGNING → DESIGNED → IMPLEMENTING →
PASSED | CONVERGED | CONVERGED_WITH_FAILED_CHILDREN | FAILED`.
Task states (`workflow.py:40-43`): `PENDING / RUNNING / COMPLETED / FAILED`.

On a node failure, `_mark_remaining_node_tasks_failed` (`workflow.py:977`) fails that node's
remaining tasks, but **the queue continues to the next node**. A failing subtree does not abort the
run.

### 1.2 Non-leaf handling

Three distinct cases, all in `core/phases.py:55-180`:

- **Non-leaf with no image reference in its description** (`phases.py:81-106`): DESIGN is skipped
  entirely. No agent call at all. Logs *"Skipping non-leaf DESIGN because this node has no visual
  reference; no UI/API/FUNC/DB interfaces are owned here."* and *"Skipping test generation for
  non-leaf node."*
- **Non-leaf with an image** (`phases.py:151-180`): InterfaceDesigner runs, constrained by
  `skills/non-leaf-ui-only-design/SKILL.md` to UI/composition only. TestGenerator is skipped —
  *"composition nodes only define interfaces."*
- **Every non-leaf IMPLEMENT** (`phases.py:358-373`): marks its interfaces implemented, sets
  `result_state: CONVERGED`, returns. **Zero agent calls.**

Only leaf nodes reach TestGenerator or TestDrivenDeveloper.

### 1.3 InterfaceDesigner

Response schema (`agents/interface_designer.py:23-26`):

```python
class InterfaceDesignResponse(BaseModel):
    summary: str
    interfaces: list[dict[str, Any]]
    files_written: list[str]
```

Each interface item should carry (`agents/context/prompts/interface_designer.py:94`):
`interface_id`, `req_id`, `type`, `name`, `file_path`, `first_line`, `responsibility`,
`specification`, `inputs`, `outputs`, `callers`, `callees`, `test_focus`.

`type` is validated against `ALLOWED_INTERFACE_TYPES = {"UI", "API", "FUNC", "DB"}`
(`phases.py:18`); an invalid value raises and **fails the whole node** (`phases.py:709-713`).
Paths are normalized to workspace-relative, stripping any `/workspace/` virtual prefix
(`phases.py:904-921`). `callers`/`callees` are resolved into cross-requirement call edges in the
traceability store (`phases.py:803-829`, `edge_type="cross_req"`).

Interfaces are merged with any existing record of the same `interface_id` before storage
(`phases.py:700-707`), which is how retries preserve ids.

### 1.4 TestGenerator

Returns `{summary, tests[], files_written[]}`. Each manifest item:
`test_id`, `req_id`, `interface_ids`, `type`, `file_path`, `first_line`
(`prompts/test_generator.py:129`). Layers are exactly `Unit | Integration | E2E`.

Validation before storage (`phases.py:753-789`): missing `type` or `file_path` raises; duplicate
`test_id` raises; and the app handler validates the path (`phases.py:773` →
`app_type_handler/web.py:752-767`):

```
unit | integration → frontend/tests/… or backend/tests/…
                     ending .test|.spec × .js|.jsx|.ts|.tsx
e2e                → backend/test-e2e/… ending .js|.jsx|.ts|.tsx
```

**Where tests live:** `frontend/tests/`, `backend/tests/`, `backend/test-e2e/`
(`app_type_handler/web.py:729-731`).

**Helper library: there is none.** I grepped both copies for `resolveNamed`, `getByTestId`,
`data-testid`, `helpers.ts`, and `fixtures:` — **zero hits in the compiler, either copy**. Those
constructs exist only in the public benchmark corpus under `arc-bench/webapp/*/tests/`. The ARC
compiler's TestGenerator writes free-form Playwright and Vitest files with no shared helper module
and no fixture-comment convention.

**The exact text governing E2E locator choice** is three places.

`agents/context/prompts/test_generator.py:125`:

> For E2E tests, choose selectors, prompts, command arguments, and observable outcomes from
> requirement-stated user-facing behavior first. If the requirement does not specify exact selectors
> or flags, define stable executable hooks in the test contract so implementation can align to them.

`skills/leaf-test-layer-selection/SKILL.md`, items 16-18 and 21:

> 16. For E2E selectors, prefer requirement-stated labels, roles, routes, and visible outcomes
>     first; if the requirement leaves the selector unspecified, define a stable accessible contract
>     and keep implementation aligned to it.
> 17. For labels that are substrings of other labels, such as `Password` and `Confirm password`,
>     avoid ambiguous `getByLabel('Password')`. Use exact accessible-role selectors, stable ids, or
>     scoped locators in the generated test.
> 18. If a link/control label can match another accessible name, scope the locator to the correct
>     landmark or container, such as
>     `page.getByRole('navigation', { name: 'Global' }).getByRole('link', { name: 'Books', exact: true })`.
> 21. For Playwright tests, do not invent custom fixtures unless you define and consume the same
>     fixture name exactly. If you define `runtime: async ({}, use) => use(runtime)`, consume
>     `{ runtime }`; if you define `harness`, consume `{ harness }`. Avoid `use({ runtime })` unless
>     the consumed fixture is the object wrapper.

Item 18 is the closest thing to a locator ladder anywhere in the pipeline, and it is prose guidance,
not executable code.

`agents/context/prompts/test_driven_developer.py:130` is the implementation-side counterpart:

> For E2E selector failures, preserve selectors that come from explicit requirement wording. If the
> requirement did not specify an exact selector and the generated E2E defines a stable accessible
> selector, align the implementation to that selector instead of repeatedly rewriting the test.

Skill selection is deterministic, not model-chosen (`agents/skills/selection.py`):
`leaf-test-layer-selection` always; `auth-session-consistency` added only when the requirement text
matches one of 14 hard-coded terms (`login`, `log in`, `sign in`, `register`, `registration`,
`logout`, `log out`, `session`, `authenticated`, `authentication`, `authorization`, `current user`,
`account state`) (`selection.py:11-25, 41-47`).

### 1.5 TestDrivenDeveloper

Tools exposed (`agents/test_driven_developer.py:198`): `run_tests`, `run_build`, plus three
read-only traceability tools (`get_interfaces_for_requirement`, `get_interface`,
`search_interfaces`). The generic `execute` and `write_todos` tools are stripped at the harness
level (`agents/runtime/factory.py:29`, `DISABLED_BUILTIN_TOOLS`), so **the TDD agent has no shell**.
File work is limited to `glob`, `grep`, `read_file`, `edit_file`, `write_file`
(`prompts/common.py:120-121`).

**Layer loop** (`phases.py:420-692`). `TDD_BATCH_ORDER = ("Unit", "Integration", "E2E")`
(`phases.py:19`). Only layers that actually have registered tests are scheduled
(`phases.py:435`). Each gets an **independent budget** of `TDD_RUN_TESTS_BUDGET` calls
(5 in the template, 10 in the repo), tracked in `usage_by_type`.

`run_tests` guards, in order (`phases.py:448-512`):

- no active layer → exit 1;
- requested layer is not the active one → exit 1, with the message *"The active TDD layer is `X`,
  but run_tests requested `Y`. The system attempts layers in Unit -> Integration -> E2E order with
  independent budgets."*;
- a requested file is not in the node's registered manifest for that layer → exit 1, *"run_tests(X)
  may only execute registered X tests for the current node. Unknown files: …"*;
- budget already spent → exit 1, *"run_tests budget exhausted for X: n/N."*

On a **passing** run the raw output is appended with a layer-status block (`phases.py:544-556`):

```
ARC_TEST_LAYER_STATUS:
- Unit passed.
- The system will advance to the next test layer: Integration.
- Do not return IMPLEMENTED until all scheduled layers have been attempted and passed.
```

**Session loop** (`phases.py:562-619`): while the active layer has not exited 0 and budget remains,
start a new TDD agent session. Guard rails: `max_sessions = max(1, budget × len(ordered_types))`
(`phases.py:561`); if a session ends without calling `run_tests` at all, the runner logs an error
and **moves to the next layer with a fresh budget** (`phases.py:609-619`).

**Failure is not fatal.** When a layer exhausts its budget, `phases.py:621-627` logs
*"Advancing past `X` without a passing result; the next scheduled layer will start with its own
budget."* and continues. The node is marked failed only in the final tally (`phases.py:629-664`) if
any scheduled layer ended non-zero. Per-test pass status is written to traceability at group
granularity — every test in a layer shares that layer's verdict (`phases.py:635-640`).

**IMPLEMENTED** is accepted only when the last `run_tests` exited 0. Otherwise the runner rewrites
the model's final message (`agents/test_driven_developer.py:229-233`):

> Error: latest run_tests result did not pass with Exit Code: 0, so IMPLEMENTED is not accepted for
> this batch.

**Tests may be edited.** This is explicit, repeated, and load-bearing:

- `prompts/test_driven_developer.py:129` — *"If a generated test is invalid, contradictory, brittle,
  or incompatible with the installed runner, edit the test to preserve the requirement intent and
  make it executable."*
- `prompts/test_driven_developer.py:132` — *"If product behavior is wrong, edit product code. If the
  test is wrong, edit the test. If the runner setup is wrong, edit build/config."*
- `skills/tdd-test-failure-repair/SKILL.md` item 6, same rule.
- The agent may also edit build and test **configuration** inside `/workspace`
  (`prompts/test_driven_developer.py:131`).

The agent is forbidden from giving up: *"Do not return blocked, failed, impossible, or out-of-scope
as a final answer"* (`prompts/test_driven_developer.py:57`, skill item 8).

### 1.6 Failure summary handoff

After each session the runner builds a fingerprint block
(`agents/test_driven_developer.py:254-276`):

```
<failure_analysis>
fingerprint: <exit_code>|<first line containing error/failed/expect, 240 chars>
latest_test_output_excerpt:
<last 40 non-empty lines>
</failure_analysis>
```

This is stored in the node session as `recent_failure_summary` plus a `tdd_handoff` block
(`phases.py:669-679`) and injected into the next session's prompt as `### Latest Failure Evidence`
(`prompts/test_driven_developer.py:109`). Its presence is also what unlocks the
`tdd-test-failure-repair` skill (`agents/skills/selection.py:50-58`) — the repair skill is hidden
until a real failure has occurred.

---

## 2. Model calls

### 2.1 Roles

**Main coding model**: `MODEL`, default `openai:gpt-5.4`
(`agents/interface_designer.py:44`, `agents/test_generator.py`, `agents/test_driven_developer.py:39`).
Routed through `langchain_openai.ChatOpenAI` subclasses built in
`agents/model/openai_api_adapter.py:98-126` with:

```python
"disable_streaming": True,
"stream_usage": False,
"use_responses_api": config.api_mode == "responses",
"output_version": "responses/v1" if responses else "v0",
```

**VISUAL model**: a separate raw OpenAI client, `VISUAL_MODEL` falling back to `MODEL`, and
`VISUAL_API_KEY` falling back to `OPENAI_API_KEY` (`core/visual_analysis.py:219, 237-247`). Used
only to describe reference images. Results cached on disk in `.arc/visual_analysis_cache.json`
keyed by `path::mtime_ns::size::prompt_version` (`visual_analysis.py:197-200`), so each distinct
image costs at most one call per workspace.

### 2.2 API mode

`ARC_OPENAI_API_MODE` resolves to `responses` or `chat_completions`, **defaulting to
`chat_completions`** when unset (`openai_api_adapter.py:148-159`). Aliases are accepted
(`1/true/yes/on/response/responses_api` → responses; `0/false/no/off/chat/chat_completion` →
chat_completions). An unrecognized value raises.

Two quirks worth knowing:

- `should_disable_streaming_for_openai_mode` (`openai_api_adapter.py:162-171`) forces streaming off
  for `responses` mode against any **non-official** base URL, unless
  `ARC_AGENT_FORCE_RESPONSES_STREAM` is set.
- `_should_use_sse_text_compat` (`openai_api_adapter.py:265`) swaps in `CompatibleChatOpenAI` for
  gateways that need SSE text compatibility.

**Structured output is silently dropped against non-OpenAI base URLs**
(`agents/runtime/factory.py:309-313`):

```python
def _resolve_response_format(response_format):
    base_url = os.getenv("OPENAI_API_BASE") or os.getenv("OPENAI_BASE_URL")
    if base_url and not _is_openai_base_url(base_url):
        return None
    return response_format
```

When that happens the agents fall back to scraping a JSON object out of the final assistant message
(`agents/runtime/runners.py:93-127`). Any team running through a proxy gateway is on the fallback
path, not structured outputs.

### 2.3 Context handling

`agents/context/pipeline.py` **exists and resolves**. I parsed every `import`/`from` statement
across the whole template with `ast`: every module resolves either to a local package
(`agents`, `app_type_handler`, `arc_main`, `arcbench_agent_runtime`, `core`) or to a stdlib /
declared third-party package (`deepagents`, `langchain`, `langchain_core`, `langchain_openai`,
`openai`, `httpx`, `pydantic`, `dotenv`, `yaml`, `colorama`). **No import dangles.**
`requirements.txt` declares: `aiofiles openai requests python-dotenv pyyaml pydantic colorama click
jsonschema tiktoken httpx[socks] deepagents langchain-openai` (`langchain` and `langchain_core`
arrive transitively).

Context assembled per invocation (`pipeline.py:461-560`), in order:

1. `<requirement_focus>` — id, name, description, dependencies, children, scenario digest, visual
   digest (`pipeline.py:186-217`).
2. `<acceptance_gate>` — primary outcomes, scenario target names, visual rule, and an explicit
   `forbidden_shortcuts` list: *hardcoded sample rows, fallback arrays that bypass the owned path,
   frontend-only seed data or test-only database setup, fake success messages detached from real
   writes, placeholder-only panels presented as complete features* (`pipeline.py:155-184`).
3. Tech stack, project structure (agent-type specific).
4. Test harness rules — **TestGenerator only** (`pipeline.py:489`).
5. Node session layers, resume context, existing-interface cards.
6. Source file cards — all three code stages.
7. Test file cards — **TDD only**, scoped to target files when given (`pipeline.py:527-549`).
8. Recent failure summary.

`build_agent_context_split` (`pipeline.py:578-598`) then subtracts the static half by string
replacement so the static block can be cached separately.

The cache (`NodeContextCache`, `pipeline.py:18-57`) is invalidated aggressively: after every
interface store, every test store, and every TDD completion (`phases.py:138-139, 216-217, 666-667`),
plus a full `clear()` on every `configure()` call (`pipeline.py:85`) — which every stage adapter
calls on entry. In practice the cache rarely survives between stages.

### 2.4 Retries, timeouts, budgets

- **Model retries**: none at ARC level. `ARCChatOpenAI._agenerate` only wraps and re-raises as
  `ARCModelAPIError` (`openai_api_adapter.py:61-71, 174-208`). Whatever the OpenAI SDK does by
  default is the retry policy.
- **`ARC_STRUCTURED_OUTPUT_RETRY_COUNT`** is validated by `arc doctor` (`core/config.py:154-160`)
  and **never read anywhere else**. Dead config.
- **Agent loop ceiling**: `DEFAULT_RECURSION_LIMIT = 5000` (`runners.py:17`), passed as
  `recursion_limit` (`runners.py:756`). Effectively no limit.
- **Subprocess timeouts** only (all in `app_type_handler/web.py`): 120s frontend build, 60s
  `db:prepare:e2e`, 20s backend TCP wait, 120s Playwright, 60s default for Vitest.

**There is no budget or stop condition on model calls, tokens, or wall-clock time anywhere in the
pipeline.** The only genuine ceilings are the per-layer `run_tests` budget and
`max_sessions = budget × len(layers)`.

### 2.5 Call estimate for the Keep tree

The brief said 32 atomic + 4 folders. Parsing
`arc-bench/webapp/keep/requirements/requirements.yaml` gives the real shape:

| Property | Count |
|---|---|
| Total nodes | 45 |
| Leaf (ATOMIC) | 32 |
| Non-leaf (FOLDER, incl. ROOT) | 13 |
| Non-leaf carrying an image reference | 5 (`REQ-1`, `REQ-2`, `REQ-2.6`, `REQ-2.7.6`, `REQ-5`) |
| Leaves carrying an image reference | 17 |
| Unique reference images | 22 |
| Scenarios on leaves | 32 (exactly one per leaf) |
| Hidden spec files in the corpus | 32 (exactly one per leaf) |

Note there is **no `visual_reference` field** in the YAML — images are markdown links embedded in
`description`, and `_collect_visual_candidates` (`core/visual_analysis.py:149`) scrapes them out.

Agent sessions per full compile:

| Stage | Sessions |
|---|---|
| VISUAL image analysis | 22 (one per unique image, disk-cached) |
| DESIGN, non-leaf | 5 (the other 8 skip entirely) |
| DESIGN, leaf | 64 (32 InterfaceDesigner + 32 TestGenerator) |
| IMPLEMENT, non-leaf | 0 |
| IMPLEMENT, leaf | 96 floor … 480 ceiling |
| **Total** | **~165 floor … ~550 ceiling** |

The IMPLEMENT floor assumes 3 scheduled layers per leaf, each passing on its first session
(32 × 3 = 96). The ceiling is `max_sessions` saturation: 32 × 5 × 3 = 480 with the template's
budget of 5; it would be 960 with the repo's budget of 10.

Each of those sessions is a **multi-turn ReAct loop with no turn cap**, resending a growing message
list on every turn. At a plausible 5-40 model turns per session, that is roughly 1k-10k raw model
calls for one Keep compile — which is what puts a 32-node app in the 20-30M token range.

---

## 3. Web app handler (`app_type_handler/web.py`)

### 3.1 Build and start model

Single-port, backend-led (`web.py:697-709`):

> For web apps, the hosted runtime is backend-led: enter `frontend` and run `npm run build`, then
> enter `backend` and run `npm run start` to serve the built frontend dist. The backend process is
> responsible for hosting `frontend/dist` on the single web port `3000`; do not assume a separate
> frontend dev server is part of the runtime.

`_resolve_backend_start_command` (`web.py:574-578`) requires a `start` script in
`backend/package.json`; without it the E2E run fails before anything launches.

Runtime env injected into every test subprocess (`core/config.py:82-88`):

```python
{"PORT": port, "ARC_WEB_PORT": port, "BASE_URL": f"http://localhost:{port}",
 "VITE_API_BASE_URL": f"http://localhost:{port}"}
```

The 3000 rule is now a default rather than a rewrite: `--port` still exists
(`arc_main.py`), `set_web_port` propagates it into env and context config
(`core/config.py:67-71`), but the shipped starter template hardcodes
`Number(process.env.PORT || 3000)` (`template/backend/src/index.js:2-3`) and
`post_template_setup` merely logs (`web.py:769-774`).

### 3.2 E2E group run, step by step (`web.py:960-1047`)

1. **Frontend build** — `npm run build` in `frontend/`, 120s timeout, then assert
   `frontend/dist/index.html` exists (`web.py:601-620`). Failure aborts before startup.
2. **Suite-scoped DB path** — `_build_e2e_runtime_env` (`web.py:586-598`) derives
   `backend/.arc-test-db/<slug>-<sha1[:10]>.sqlite` from the sorted target list, and exports
   `ARC_DB_FILE`, `ARC_E2E_DB_PATH`, `ARC_E2E_DB_LABEL`. Different test file sets get different
   databases.
3. **Seeding** — `npm run db:prepare:e2e` in `backend/`, 60s timeout (`web.py:623-631`).
   Note it is **`db:prepare:e2e`, not `db:seed`**. The template's `prepare_e2e.js` calls
   `createRuntimeDatabaseHarness({seedDefault: true})` which resets the DB file, initializes the
   schema, and then calls `seed_db.js` internally
   (`template/backend/src/database/test_harness.js:90-106`). `db:seed` is never invoked directly
   by the handler.
4. **Port cleanup and backend start** — `_ensure_port_released` (1s), then `npm run start` with
   stdout/stderr to `DEVNULL`, then `_wait_for_tcp_server("127.0.0.1", port, timeout=20.0)`
   (`web.py:634-686`). On success it fingerprints the listening PIDs via `lsof`/`netstat` plus
   `ps`/WMI (`web.py:293-460`) — a deliberate guard against a stale server answering the tests.
5. **Playwright** — `npx playwright test <resolved targets>` from `backend/`, **120s timeout**,
   with the E2E env (`web.py:1009-1017`).
6. **`finally`: terminate the backend.** If cleanup fails and the body says `Exit Code: 0`, the
   verdict is **rewritten to 1** (`web.py:1041-1046`).

**Workers**: no `--workers` flag is ever passed, and the starter config sets none, so Playwright
uses its own default (half the CPU cores). **Trace**: `'retain-on-failure'`. **Video**: off.
**Per-test timeout**: 30s. (`template/backend/playwright.config.js`):

```js
const baseURL = process.env.PLAYWRIGHT_BASE_URL || process.env.ARC_WEB_BASE_URL || 'http://127.0.0.1:3000';
module.exports = defineConfig({
  testDir: './test-e2e',
  testMatch: /.*\.(js|jsx|ts|tsx)$/,
  timeout: 30000,
  use: { baseURL, trace: 'retain-on-failure' },
});
```

Note the handler exports `BASE_URL`, not `PLAYWRIGHT_BASE_URL` — the config falls through to its
hardcoded `http://127.0.0.1:3000` default, which happens to match.

### 3.3 Unit and integration group runs (`web.py:922-958`)

Targets are split by resolved working directory into backend and frontend buckets, then run as two
separate `npx vitest run <files…>` invocations at the **default 60s timeout** (`web.py:927, 939` —
no timeout argument is passed). The batch exit code is 0 only if every sub-run returned 0
(`web.py:956`).

All command output is truncated to 4000 chars, keeping the first 2000 and last 2000 with
`...[OUTPUT TRUNCATED]...` between (`web.py:70-71`). Long Playwright failures lose their middle.

### 3.4 Result parsing (`app_type_handler/test_results.py`)

Thin and blunt. `parse_test_results` scans for the **first** line containing `Exit Code:` and takes
that integer as `exit_code` (`test_results.py:12-19`); everything else is cosmetic. It then
optionally splits `=== Backend Vitest Batch ===` / `=== Frontend Vitest Batch ===` /
`=== Playwright E2E Batch ===` sections into `sub_batches` (`test_results.py:41-51`) and collects
`PASS`/`FAIL`/`✓`/`✗` lines into `passed`/`failed` lists (`test_results.py:53-58`). **Only the first
exit code decides pass/fail** — everywhere in `phases.py` the check is
`parse_test_results(...).get("exit_code") == 0`.

Because `run_test_group` composes its own header with `Exit Code: N` at the top of the body
(`web.py:1021-1022`, `web.py:957`), the parser reads the handler's aggregate verdict, not
Playwright's.

---

## 4. Runtime protocol and what the platform reads from `.arc/`

`arcbench_agent_runtime` is the platform's SDK, vendored into the submission. Paths come from env
(`arcbench_agent_runtime/context.py:34-55`):

| Env var | Default |
|---|---|
| `ARCBENCH_OUTPUT_DIR` / `ARCBENCH_PROJECT_DIR` / `ARCBENCH_TEMPLATE_DIR` | `.` |
| `ARCBENCH_RUNNER_EVENTS_PATH` | `.arc/runner-events.jsonl` |
| `ARCBENCH_TRACEABILITY_DIR` | `.arc/traceability` |

`AgentRuntime.from_env` wires `events`, `traceability`, `git` and registers the traceability store
as the event client's requirement-state writer (`runtime.py:18-41`).

### 4.1 Events (`arcbench_agent_runtime/events.py`)

Append-only JSONL. Three record types:

- **`requirement_state`** — `{type, node_id, phase, status, timestamp, message}`. The
  `mark_*` methods map onto it (`events.py:51-73`): `mark_design_started/done/failed`,
  `mark_implementation_started/done/failed`, `mark_test_passed/failed`. The side-effect table
  (`events.py:38-49`) mirrors each into a node state:

  ```
  (design, running)→DESIGNING       (design, completed)→DESIGNED
  (implement, running)→IMPLEMENTING (implement, completed)→IMPLEMENTED
  (test, passed)→PASSED             (*, failed)→FAILED
  ```

- **`runner_state`** — `mark_run_started/completed/failed/paused/resumed` (`events.py:86-99`),
  emitted from `start_compilation` (`workflow.py:312, 327, 330`) and `prepare_resume_context`
  (`workflow.py:267`).
- **`signal`** — refresh hints with boolean flags `submission / logs / commit_history /
  traceability_selected / traceability_all / preview` (`events.py:106-140`). This is how the web UI
  knows to re-poll.

Emission points in the workflow: `_mark_task_running` fires `mark_design_started` /
`mark_implementation_started` (`workflow.py:1163-1170`); completion fires `mark_design_done` or
`mark_implementation_done` + `mark_test_passed` (`workflow.py:481-486`); failure fires the `_failed`
variants (`workflow.py:507-512`).

### 4.2 Traceability (`arcbench_agent_runtime/traceability.py`)

Not SQLite despite the "DB" language in the prompts — **one JSON object per table** at
`.arc/traceability/<table>.json`, written atomically (`traceability.py:113, 125-135`). Tables cover
requirements, scenarios, interfaces, tests, call edges, node states, node contracts.
`export_snapshot()` (`traceability.py:148`) is what the platform reads for scoring displays.

### 4.3 Git (`arcbench_agent_runtime/gitops.py`)

`ensure_repo(create_initial_commit=True)` initializes and makes an `init` commit
(`gitops.py:119-133`), called from `initialize_project` (`workflow.py:222`). Every phase transition
then commits with message `"<node_id> (<phase>): <name>"` (`core/commits.py:6`), including failures
tagged `DESIGN-FAILED` / `IMPLEMENT-FAILED` (`workflow.py:478, 486, 499, 512`). Every commit emits
`notify_commit_history_changed(..., preview=True)` so the platform refreshes its preview.

### 4.4 ARC's own state under `.arc/`

Written by ARC, not the SDK: `processing_queue.json` (schema v2, `workflow.py:30`),
`project.json` (`workflow.py:225-241`: `schema_version, app_type, web_port, requirement_path,
workspace_mode, created_at, updated_at`), `node_sessions/<node_id>.json`,
`visual_analysis_cache.json`.

**All of it is denied to the agents.** `_build_filesystem_permissions`
(`agents/runtime/factory.py:175-245`) installs a deny rule covering `/workspace/.arc`,
`/workspace/.git`, `/workspace/requirements`, `**/node_modules`, `**/dist`, `**/build`,
`**/coverage`, `**/.vite`, all lockfiles, and every `.env*`, then allows read on `/workspace/**`,
allows write on the configured roots, and ends with a blanket `deny ["/**"]`. Skill files are
readable only at the exact `/skills/<name>/SKILL.md` paths selected for the current stage
(`factory.py:248-282`).

---

## 5. Starter template and the hosted runner

### 5.1 Stack (`template/`)

Declared in `template/template.yaml` as `id: web-react-express`:

- **Frontend**: Vite 7, React 19, React Router 7, TailwindCSS 4, axios, Vitest 4 + Testing Library,
  jsdom.
- **Backend**: Express 5, sqlite3, body-parser, cors; Vitest 4, supertest, Playwright 1.57, bcrypt,
  nodemon.

Scripts (`template/backend/package.json`):

```json
"start": "node src/index.js",
"db:seed": "node src/database/seed_db.js",
"db:prepare:e2e": "node src/database/prepare_e2e.js",
"test": "vitest run --config vitest.config.js",
"test:e2e": "playwright test"
```

`agent_guidance` in `template.yaml` names the expected roots: `ui_root: frontend/src`,
`api_root: backend/src/app.js`, `db_root: backend/src/database`,
**`e2e_test_root: backend/test-e2e`**.

Test placement is enforced three ways: the `agent_guidance` block, the project-structure prompt
context (`web.py:729-731`), and hard path validation (`web.py:752-767`).

### 5.2 `arc-template/catalog.yaml`

Lists four templates — `web-react-fastapi`, `web-react-express`, `mobile-android-java`,
`cli-python` — each with a stack manifest. But `template/template.yaml` pins the shipped agent to
`web-react-express`, and `_resolve_templates_root` copies from `template/`. **The catalog is a menu
the shipped agent never opens.** The FastAPI variant even ships its own
`frontend/playwright.config.ts` and `frontend/e2e/home.spec.ts`, a different layout from the one the
handler validates.

### 5.3 Does the hosted runner use this layout for the official suite?

**No.** The official corpus at `arc-bench/webapp/<app>/` is:

```
requirements/requirements.yaml
requirements/requirements.md
requirements/reference/*.png
tests/helpers.ts
tests/REQ-1.1.spec.ts … tests/REQ-5.2.spec.ts     (32 files for Keep)
```

There is **no `backend/test-e2e`, no `playwright.config`, no `package.json`** anywhere in that tree.
The specs are flat, one per leaf requirement, and every one imports the per-app `helpers.ts` with
its `resolveNamed` locator ladder and `// fixtures:` comments. None of those constructs appear
anywhere in the compiler, either copy.

Conclusion: **the official evaluation suite is authored and executed by separate evaluator
infrastructure that supplies its own Playwright config and `baseURL`.** The compiler's
`backend/test-e2e` convention exists purely for its own internal TDD loop. The compiler's own prompt
confirms the boundary (`agents/context/prompts/common.py:78`):

> Do not infer or copy hidden evaluator fixtures. Use only data requirements visible in the
> requirement snapshot, scenarios, interfaces, and permitted project context; keep seeded records
> ordinary product state rather than a test-specific DSL.

The only thing the two layouts share is the runtime contract: an app served on a single origin at
port 3000 by the backend, after `frontend: npm run build` + `backend: npm run start`.

### 5.4 Platform entry contract

`main.py` in every template takes the same three inputs (`templates/blank/main.py:10-29`):

| Arg | Env fallback |
|---|---|
| `requirement_path` (positional) | `ARCBENCH_TASK_DIR`, default `requirements` |
| `--output-dir` | `ARCBENCH_OUTPUT_DIR`, default `.` |
| `--type` | `ARCBENCH_TASK_TYPE`, default `web` |

Runner-injected model env is `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `MODEL`
(`templates/blank/main.py:73-76`).

The ARC template's shim (`main.py:9-14`) simply injects `--type` from `ARCBENCH_TASK_TYPE` if absent
and prepends the `compile` subcommand before handing off to `arc_main`.

---

## 6. Summary of template-vs-repo differences

| Area | Repo | Template | Anchor |
|---|---|---|---|
| `run_tests` budget per layer | 10 | **5** | `core/phases.py:17` |
| Default web port | 3301 | **3000** | `core/config.py:16` |
| Port placeholder rewrite | rewrites `__ARC_WEB_PORT__` in 3 files | log line only | `app_type_handler/web.py:769` |
| Traceability on init | `init_store(reset=False)` | **`reset=True`** | `core/workflow.py:197` |
| Evolution mode | absent | detects existing app, preserves it, adds 5 prompt lines | `core/workflow.py:154-175`, `prompts/common.py:26-38` |
| `.arc/project.json` | absent | written and validated on resume | `core/workflow.py:55-72, 225-241` |
| Intent-based test gen | absent | `run_test_generation_phase` + `Requested Test Intent` section | `core/phases.py:243-340`, `prompts/test_generator.py:93-108` |
| Selected-test TDD | absent | `run_implement_phase(test_ids=…)` | `core/phases.py:342-418` |
| `initialize_workspace` | always seeds template | `seed_template: bool = True` | `app_type_handler/base.py:51` |
| CLI | full parser in `main.py` | moved to `arc_main.py`, `main.py` is a shim | `main.py:9-14` |
| SKILL.md × 5 | — | **byte-identical** | — |

The skills being identical while the budget halved is the single most actionable discrepancy: the
shipped agent's repair skill and TDD prompt both promise 10 calls where the runner allows 5.

---

## (i) What the hidden tests will look like, as rules a generated app must satisfy

Derived from `agents/context/prompts/test_generator.py`, `skills/leaf-test-layer-selection/SKILL.md`,
`skills/auth-session-consistency/SKILL.md`, and `agents/context/prompts/common.py` — not from
reading the public specs.

1. **Every leaf scenario becomes an E2E test.** Scenario presence is *"a strong signal for E2E
   coverage"* (skill item 2) and the prompt makes it mandatory: *"If `Requirement Snapshot.scenarios`
   is non-empty, you must generate E2E coverage for those scenarios"*
   (`prompts/test_generator.py:121`). Keep has one scenario per leaf and exactly 32 hidden specs —
   a one-to-one match.

2. **GIVEN is setup, WHEN is action, THEN is assertion, and no step may be inverted or skipped.**
   *"If a scenario says a global navigation bar is visible, tests must not assert the navigation or
   logo is absent"* (`prompts/test_generator.py:66`; skill item 9). An app must not hide chrome that
   the requirement declares visible.

3. **Preconditions are ordinary seeded product state reachable through the normal path.** Records a
   requirement says already exist must be created by the app's real database / migration / seed /
   bootstrap path, deterministically and idempotently, available after normal startup or reset
   (`prompts/common.py:70-79`). Tests will *not* write to the DB directly or call a seed endpoint
   (`prompts/test_generator.py:43`). **If your app only materializes those records from a test
   fixture, the hidden test fails.**

4. **Seeded entities must preserve identity, ownership, visibility, permissions, status, ordering,
   and cross-record references** (`prompts/common.py:76`). Getting the row in is not enough; its
   relationships must hold.

5. **Auth transitions are asserted globally, never as a local banner.** A login or registration must
   update shared chrome, current-user display, protected/public route behavior, or a session API
   such as `/api/auth/session` (`prompts/test_generator.py:41, 123`;
   `skills/auth-session-consistency/SKILL.md` items 5-9). A durable **session recovery path across
   refresh/navigation** is explicitly required (auth skill item 6).

6. **Domain state is asserted through the persistence boundary.** Cart, checkout, account, products,
   orders, catalog, inventory must be verified through the API/service/persistence path when the
   contract includes it. *"Do not accept a frontend-only counter or static product array as durable
   behavior"* (`prompts/test_generator.py:42, 124`; skill item 22).

7. **Locators come from requirement wording first, then from a stable accessible contract the
   implementation must align to** (`prompts/test_generator.py:125`; skill item 16). Practically:
   label your controls with the exact words the requirement uses, and expose proper ARIA roles.

8. **Ambiguous accessible names will be disambiguated by scoping, not loosened.** Substring
   collisions like `Password` vs `Confirm password` get exact-role or scoped locators such as
   `page.getByRole('navigation', { name: 'Global' }).getByRole('link', { name: 'Books', exact: true })`
   (skill items 17-18). An app with duplicate visible labels inside one landmark is at risk.

9. **Design scaffolds never count as a pass.** `NOT_IMPLEMENTED`, HTTP 501, TODO text, placeholder
   payloads, fake success messages, and intentionally unimplemented branches must all fail
   (`prompts/test_generator.py:26, 120`; skill item 19).

10. **No obligations outside the node.** A leaf's test may not assert child-owned future behavior or
    a sibling's responsibility, and dependency behavior is setup, not the asserted outcome
    (`prompts/test_generator.py:69-70`).

11. **Tests assert through the real hosted runtime**, i.e. the backend serving `frontend/dist` on
    one origin — *"For web apps, remember that the user will experience the backend-hosted built
    frontend"* (`prompts/common.py:65`). An app that only works under `vite dev` with a proxy will
    fail.

12. **Frontend test files containing JSX are `.test.tsx`/`.spec.tsx`, never a `.ts` bridge**
    (`prompts/test_generator.py:126`; skill items 11-12). This shapes what the generator emits, and
    the TDD agent is forbidden from creating bridge files to hide a parser mismatch
    (`prompts/test_driven_developer.py:134`).

13. **Router harnesses follow the app's own shape.** The generator is told to mount providers and
    routers the way nearby tests do and to avoid rerendering `MemoryRouter` to change
    `initialEntries` (skill items 13-14). An app with an unconventional routing bootstrap makes
    generated tests brittle.

## (ii) Cost drivers of the official pipeline

1. **Session count scales with failure, not with tree size.** Each leaf gets up to
   `budget × len(layers)` TDD sessions (`phases.py:561`), each a fresh full-context agent
   invocation. Keep moves from 96 sessions if everything passes first try to 480 if nothing does —
   a 5× swing from test quality alone.

2. **No token, call, or wall-clock ceiling exists.** The only limit is
   `DEFAULT_RECURSION_LIMIT = 5000` (`runners.py:17`), which is effectively unbounded. Nothing stops
   one TDD session from burning hundreds of turns.

3. **Failure never terminates the run.** A layer that exhausts its budget advances to the next layer
   with a full fresh budget (`phases.py:621-627`), and a failed node does not stop the queue
   (`workflow.py:977`). The pipeline pays full price for every node it will never pass, and then
   keeps going.

4. **Context is rebuilt per session and it is large.** Every invocation assembles requirement focus,
   acceptance gate, tech stack, project structure, node session, resume context, existing-interface
   cards, source cards, test cards, and failure summary (`pipeline.py:461-560`). The cache is
   invalidated on every interface store, test store, and TDD completion
   (`phases.py:138, 216, 666`) and fully cleared on every `configure()` (`pipeline.py:85`), which
   each stage adapter calls on entry.

5. **The entire test manifest is re-serialized into every TDD prompt** — all files plus the
   ordered-layers JSON plus the full node manifest — regardless of which single layer is active
   (`prompts/test_driven_developer.py:105-106`).

6. **Streaming off, usage reporting off.** `disable_streaming=True`, `stream_usage=False`
   (`openai_api_adapter.py:113-114`). There is no incremental signal to abort on and no per-call
   token accounting to throttle against, so overspend is invisible until the run ends.

7. **No shell means more model turns per unit of work.** With `execute` removed
   (`factory.py:29`), every file operation is its own tool round-trip, and `read_file` is capped at
   200 lines per call by policy (`prompts/common.py:125`). Reading one large source file costs
   several turns instead of one `cat`.

8. **The prompt/code budget mismatch wastes calls.** The model is told it has 10 `run_tests` calls
   per layer (`prompts/test_driven_developer.py:124`, skill item 10) while the runner cuts it off at
   5 (`phases.py:17`). It plans a repair cadence it cannot finish and gets truncated
   mid-hypothesis, then the next session re-reads everything to rebuild the same state.

9. **Every E2E `run_tests` call rebuilds the world.** One call = full frontend build (up to 120s) +
   DB prepare + backend boot + Playwright + teardown (`web.py:960-1047`). Five of those per leaf per
   layer is a large share of wall-clock time even when token spend is modest.

10. **Truncation causes re-exploration.** Test output is cut to 4000 chars keeping only the head and
    tail (`web.py:70-71`), and the failure summary keeps just 40 lines (`phases.py:924-928`). When
    the decisive error sits in the elided middle, the agent spends turns re-reading files to
    recover what the harness discarded.

11. **Structured output silently disabled on non-OpenAI gateways** (`factory.py:309-313`) pushes
    both design stages onto the JSON-scraping fallback (`runners.py:106`), which raises the
    malformed-output rate and therefore the retry rate.

12. **Visual analysis is the one well-bounded cost**: 22 model calls for Keep, content-hash cached
    to disk (`visual_analysis.py:197`), reused across runs in the same workspace.
