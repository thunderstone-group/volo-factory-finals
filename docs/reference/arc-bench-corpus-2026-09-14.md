# The official ARC-Bench corpus: what it runs, what it demands, what it implies

Catalogued 2026-09-14 against the organizers' repository
`https://github.com/code-philia/arc-bench.git`, cloned at
`~/projects/arcbench-campaign/upstream/arc-bench`, commit `a0d049c` dated 2026-09-12.
Machine: macOS arm64, Node 22.22.0, Docker 29.3.1.
Evidence record: [`evidence/2026-09-14-arc-bench-corpus.json`](../evidence/2026-09-14-arc-bench-corpus.json).

Nothing was uploaded, no model was called, and the arc-bench clone was modified only by
`npm install` and `git submodule update --init`. Temporary Playwright configurations live in the
session scratch directory, never in the clone.

## 1. Results

### 1.1 Corpus is runnable locally

| Step | Result |
|---|---|
| `npm install` | clean, 4 packages, Playwright 1.61.1 |
| `npm run test:audit` | exit 0, `Benchmark test contract audit passed.` |
| `git submodule update --init` | **succeeded** on git's automatic retry |
| `npm run docker:build` | image `arc-reproduction:latest`, 5.75 GB |
| `npm run reference:12306` | ran end to end, `receipt_status=completed` |

The `agentic-requirement-compiler` submodule is **public, not private**. The first clone attempt
died with `LibreSSL SSL_connect: SSL_ERROR_SYSCALL in connection to github.com:443`; git retried
automatically and checked out commit `2feea34` dated 2026-08-19. It contains `src/`, `example/`,
`assets/`, `pyproject.toml` and a `CONTRIBUTING.md`. This is the tool the organizers' own Docker
entrypoint invokes as `arc compile` (`docker/entrypoint.sh:87-91`) — the requirement-to-test
compiler that produces the packages we are scored against.

### 1.2 The 12306 reference under five configurations

Same reference build, same host, fresh SQLite database before every run, 135 tests each.

| # | Config | Test timeout | Workers | Trace/video | Passed | Failed | Wall |
|---|---|---|---|---|---|---|---|
| 1 | Repository `playwright.config.ts` | 60 s | 1 | on | 121 | 14 | 416 s |
| 2 | `npm run reference:12306` (Docker) | 15 s | 1 | on | 119 | 16 | 331 s |
| 3 | Hosted-runner copy | 10 s | 4 | off | **135** | **0** | 38 s |
| 4 | Control: hosted, workers forced to 1 | 10 s | 1 | off | 133 | 2 | 124 s |
| 5 | Control: repo timeout, artifacts off | 60 s | 1 | off | **135** | **0** | 122 s |

**The organizers' reference passes its own suite perfectly, and the repository's default
configuration is what makes it look broken.** Rows 1 and 5 differ only in
`trace: 'retain-on-failure'`, `video: 'retain-on-failure'` and `screenshot: 'only-on-failure'`.
Turning that capture off moves the result from 121/135 to 135/135 and cuts wall time from 416 s to
122 s. Row 2 reproduces the same effect inside the organizers' own Docker image, so it is not an
artifact of our local Node or browser installation. It is still the same physical machine, so the
absolute overhead is ours; the direction of the effect is theirs.

Rows 3, 4 and 5 answer the question the task asked about the 10-second limit: **an official-style
suite is barely sensitive to it.** Holding artifacts off, dropping the per-test budget from 60 s to
10 s costs two tests out of 135 at one worker (REQ-3.2.10 and REQ-3.2.11, both result-list filters)
and zero at four workers. That is roughly 1.5% of the suite sitting within noise of the limit, not
a cliff. The real cliff is instrumentation overhead.

Failures under row 1 (14): REQ-2.4.6, REQ-4.3.6, REQ-4.3.7, REQ-5.2.3, REQ-5.2.5, REQ-5.2.7,
REQ-5.3.1 (both scenarios), REQ-5.3.2 through REQ-5.3.7.
Failures under row 2 (16): the same family plus REQ-2.4.3, REQ-2.4.5 and REQ-3.2.9, minus REQ-5.2.7.
The failure set is not stable between runs, which is itself the signature of a timing problem
rather than a contract violation. Three of them timed out at the per-test limit; the rest are
`toBeVisible` or `toBeChecked` assertions on elements that had not appeared yet.

### 1.3 Corpus size

| App | Requirements (ATOMIC) | Spec files | `test()` cases | Seed-dependent specs |
|---|---|---|---|---|
| ctrip | 125 | 125 | 125 | 114 |
| 12306 | 117 | 117 | 135 | 112 |
| prestashop | 86 | 86 | 86 | 75 |
| stackoverflow | 66 | 66 | 66 | 63 |
| bookstack | 34 | 34 | 34 | 32 |
| keep | 32 | 32 | 32 | 30 |
| **Total** | **460** | **460** | **478** | **426** |

Only 12306 ships a reference implementation. Note the brief's figure of "117 tests" for 12306 is
the spec-file count; the suite contains 135 `test()` cases because twelve specs carry more than one
scenario.

## 2. The test contract

Everything here is enforced mechanically by `upstream/arc-bench/scripts/audit-benchmark-tests.js`
or is visible in the published specs. Paths below are relative to the arc-bench clone root.

### 2.1 Structure: one spec per ATOMIC requirement, one test per scenario

The audit walks `arc-bench/webapp/<app>/requirements/requirements.yaml`, collects every
requirement whose `type` is `ATOMIC`, and demands a matching `REQ-<id>.spec.ts`
(`scripts/audit-benchmark-tests.js:135-137`). Each spec must carry a `// requirement: REQ-<id>`
comment (`:145-148`), every `test(...)` title in the file must be prefixed with that same ID
(`:150-156`), and the titles after the prefix must equal the requirement's `scenarios[].name`
values **in order** (`:158-164`). The counts confirm the mapping is exact, with no slack:

| App | ATOMIC requirements | Spec files | `test()` cases | Scenarios |
|---|---|---|---|---|
| 12306 | 117 | 117 | 135 | 135 |
| ctrip | 125 | 125 | 125 | 125 |
| prestashop | 86 | 86 | 86 | 86 |
| stackoverflow | 66 | 66 | 66 | 66 |
| bookstack | 34 | 34 | 34 | 34 |
| keep | 32 | 32 | 32 | 32 |

### 2.2 Forbidden selector and access strategies

`scripts/audit-benchmark-tests.js:39-46` rejects a spec outright if it contains any of:

| Pattern | Rejected as |
|---|---|
| `page.goto(` | direct page navigation |
| `request.` or the literal `/api/` | direct API access |
| `localStorage` / `sessionStorage` | browser storage access |
| `.evaluate(` / `.route(` | page internals or request interception |
| `toHaveURL(` / `page.url()` | internal URL assertion |
| `.locator('.…')`, `.locator('#…')`, `.locator('[data-…')` | class, id, or data-attribute selector |

All six of these except the navigation rule also apply to `helpers.ts` (`:172-174`). The
consequence for a generated application is blunt: **`data-testid` buys nothing, and CSS hooks
buy nothing.** Only the accessibility tree and visible text are reachable.

### 2.3 The permitted ladder: roles, labels, placeholders, then text

Every app's `helpers.ts` resolves a target by walking a fixed list of role-based locators and
taking the first visible one. In 12306 the click resolver is
`arc-bench/webapp/12306/tests/helpers.ts:260-291`:

```ts
const locator = await firstVisible([
  page.getByRole('button', { name }), page.getByRole('link', { name }),
  page.getByRole('tab', { name }), page.getByRole('menuitem', { name }),
  page.getByRole('option', { name }), page.getByText(name),
]);
```

The visibility assertion ladder (`helpers.ts:303-321`) is wider: `getByText`, then the `heading`,
`button`, `link`, `tab`, `cell`, `columnheader`, `textbox` and `combobox` roles, then `getByLabel`
and `getByPlaceholder`. Form filling (`helpers.ts:341-351`) tries `getByLabel`, `getByPlaceholder`,
then the `textbox`, `combobox` and `spinbutton` roles.

Across all six `helpers.ts` files the roles actually used are, by frequency: `button` (17),
`textbox` (14), `link` (11), `combobox` (9), `checkbox` (9), `tab` (8), `heading` (7), `radio` (6),
`option` (6), `menuitem` (6), `searchbox` (5), `spinbutton` (4), `cell` (4), `status` (3), `row` (3),
`alert` (3), `dialog` (2), and one each of `region`, `group`, `columnheader` and `article`.

### 2.4 Names are case-insensitive regexes, not exact strings

`arc-bench/webapp/12306/tests/helpers.ts:237-240` converts every string to a loose pattern:

```ts
export function toPattern(value: string | RegExp): RegExp {
  if (value instanceof RegExp) return value;
  return new RegExp(escapeRegExp(value).replace(/\s+/g, '\\s+'), 'i');
}
```

This is a *substring* match, case-insensitive, with any run of whitespace made flexible.
`exact: true` is rare and only 12306 uses it: three times in its helpers
(`helpers.ts:561,591,595`) and 23 times across its specs.

The looseness is a trap, not a convenience, and it is what broke the organizers' own reference
twice in our run. `signOutAndOpenLogin` calls `clickNamed(page, /login/i)`
(`helpers.ts:466-470`); on the account-security page the reference renders a
`<button class="edit-button">Login password</button>`, that button matches `/login/i`, it is
resolved first, and the click never reaches the real login link. Both REQ-4.3.6 and REQ-4.3.7
died that way. **A generated app must not render any control whose accessible name contains a
keyword the suite uses for navigation** ("login", "register", "search", "book", "delete").

### 2.5 How requirement text becomes assertions

Quoted literals in a requirement's `description` and its `THEN` step become the strings the test
looks for. Five concrete pairs:

1. **Literal error message.** `12306/requirements/requirements.yaml:104` says `Reject registration
   when any required field is missing and show the message "Please fill in all required fields.".`
   → `12306/tests/REQ-2.1.4.spec.ts:10`:
   `await h.expectErrorFeedback(page, 'Please fill in all required fields.');`

2. **Enumerated field labels.** `12306/requirements/requirements.yaml:71-90` lists the registration
   fields `"Nationality"`, `"Name"`, `"Passport number"`, … → `12306/tests/helpers.ts:394-408`
   asserts each of those eleven strings visible, and `REQ-2.1.2.spec.ts:8-9` calls it.

3. **THEN nouns become regex aliases.** `prestashop/requirements/requirements.yaml:185` reads
   `Display carousel, Popular Products, promotion area, Newsletter subscription, footer` →
   `prestashop/tests/REQ-2.1.spec.ts:9`:
   `await h.expectTextsVisible(page, [/carousel/i, /popular products/i, /newsletter/i, /footer/i]);`
   Note the test asserts a *subset*: "promotion area" is dropped. The words that survive must
   appear literally in the rendered page.

4. **A named section becomes an ARIA region.** `12306/requirements/requirements.yaml:1286`
   describes the `"Contact information"` section → `12306/tests/REQ-4.3.3.spec.ts:9`:
   `const section = page.getByRole('region', { name: 'Contact information' });`
   That only resolves if the app emits a landmark (`<section aria-label="Contact information">`
   or equivalent). A styled `<div>` with a heading does not satisfy it.

5. **Round-tripped persistence.** The same spec (`REQ-4.3.3.spec.ts:15-18`) signs out, signs back
   in with the *new* email, and asserts the sign-out button is visible again. Requirement text
   saying data is "saved" is tested as durable server-side state, not as a UI echo.

### 2.6 Seed data: declared once in prose, assumed forever after

There is no reset API and no fixture-loading hook anywhere in the corpus. Seed state is stated in
the requirement `description` as a trailing sentence and then assumed by every later test.
Two phrasings dominate:

- `The system contains a deletable regular note titled "Delete me 2.3.1".`
  (`keep/requirements/requirements.yaml:74`)
- `A verified account named "profile_contact_user" with email "profile_contact_user@example.com",
  mobile number "13800000132", and password "Password123!" has editable contact information.`
  (`12306/requirements/requirements.yaml:1286`)

Counting those sentences per app: 12306 12, keep 22, bookstack 28, stackoverflow 24,
prestashop 19, ctrip 28. That is far fewer than the number of tests that need seeded state,
because **an identity is declared once and reused silently**. `registered_user` appears exactly
once in 12306's requirements (`requirements.yaml:194`) and is the default login for ten specs.

Each spec records what it needs in a `// fixtures:` comment. This comment is *not* audited; it is
documentation. Tallying it gives the dependence on seeded state:

| App | Specs | Pure UI (no seed beyond `public_homepage`) | Seed-dependent | Distinct fixture names |
|---|---|---|---|---|
| 12306 | 117 | 5 | 112 | 33 |
| ctrip | 125 | 11 | 114 | 70 |
| prestashop | 86 | 11 | 75 | 36 |
| stackoverflow | 66 | 3 | 63 | 54 |
| bookstack | 34 | 2 | 32 | 35 |
| keep | 32 | 2 | 30 | 13 |
| **Total** | **460** | **34** | **426** | — |

**93% of the corpus depends on pre-seeded state.** And the naming shows how the organizers keep
sequential mutating tests from colliding without a reset: every destructive test gets its own
private row, named after the requirement that consumes it. bookstack has `book_5_4_1`,
`book_5_4_2`, `book_6_1_1`, `book_6_1_2`, `book_6_1_3`; keep has `delete231Title: 'Delete me 2.3.1'`,
`delete232Title`, `delete233Title` (`keep/tests/helpers.ts:13-15`); stackoverflow has
`accounts.answerDeleteUser`, `accounts.answerEditUser`, `accounts.commentDeleteUser`;
ctrip has `address_delete_account`, `address_delete_dataset`. 12306 seeds 26 distinct user rows
(`arc-bench/webapp/12306/project/backend/src/database/seed_db.js:17-44`), most of them existing
only so one test can mutate one account.

### 2.7 Navigation: the root URL is the only entry point

The audit requires `helpers.ts` to contain exactly one navigation call and for it to be
`page.goto('/')` (`scripts/audit-benchmark-tests.js:166-170`), and forbids `page.goto` in specs
entirely. We confirmed zero spec files contain it. Combined with the ban on `toHaveURL` and
`page.url()`, this means **routing is unobservable and every screen must be reachable by clicking
from `/`**. Deep links are neither required nor testable.

### 2.8 Dates and environment variables

`ARC_TEST_DATE` is the only environment variable read by any test file in the entire corpus, and
only 12306 reads it (`arc-bench/webapp/12306/tests/helpers.ts:3`):

```ts
export const TEST_DATE = process.env.ARC_TEST_DATE || new Date().toISOString().slice(0, 10);
```

`dateOffset(days)` (`:5-9`) derives relative dates from it. The reference backend reads the same
variable when seeding (`backend/src/database/seed_db.js:12`), so app and tests agree on "today".

ctrip solves the same problem differently and without any variable: it freezes the browser clock
to a hard-coded instant on every entry (`ctrip/tests/helpers.ts:30,383-386`):

```ts
testDate: '2026-07-19T12:00:00+08:00',
...
export async function openHome(page: Page): Promise<void> {
  await page.clock.setFixedTime(FIXTURES.testDate);
  await page.goto('/');
}
```

An app that reads the date server-side will disagree with a ctrip-style suite, because
`page.clock` only affects the browser. The other four apps pin no date at all.

## 3. The reference template

`arc-bench/webapp/12306/project` is the only reference implementation in the corpus. The other
five apps ship requirements and tests but no `project/` directory, so this one file tree is the
whole statement of what the organizers expect a generated application to look like.

### 3.1 Stack and layout

| Piece | Choice | Source |
|---|---|---|
| Frontend | React 19, Vite 7, Tailwind 4, react-router-dom 7, axios | `project/frontend/package.json` |
| Backend | Express 5, `sqlite3` 5.1, `body-parser`, `cors` | `project/backend/package.json` |
| Unit tests | Vitest both sides, Testing Library on the frontend | both `package.json` files |
| Entry | `backend/src/index.js` | `project/README.md` |
| App | `backend/src/app.js` | `project/README.md` |
| Routes | `backend/src/routes/{auth,search,account,orders}.js` | directory listing |
| Data | `backend/src/database/{init_db,seed_db,db_runtime,prepare_e2e,test_harness}.js` | directory listing |

It is deliberately **single-port**: the backend serves `/api/*` and also hosts the compiled
frontend from `frontend/dist`, with an SPA fallback for everything that is not an API path
(`backend/src/app.js:40-47`):

```js
app.use(express.static(frontendDistPath));
app.get(/^(?!\/api(?:\/|$)).*/, (req, res) => {
  res.sendFile(path.join(frontendDistPath, 'index.html'));
});
```

### 3.2 Build and start

`project/README.md` states the production-style runtime is backend-led: build the frontend first,
then start the backend.

```bash
cd frontend && npm install && npm run build
cd ../backend && npm install && PORT=<port> npm run start
```

`backend/src/index.js:3-6` reads `PORT` and falls back to 3000. `SIGINT`/`SIGTERM` close the
server and the database handle (`:20-27`).

### 3.3 Health and seeding are the same gate

This is the most load-bearing detail in the template. `/api/health` does not answer until the
database has been initialized **and seeded** (`backend/src/app.js:19-33`):

```js
const startupReady = initializeDatabase().then(() => seedDatabase()).catch(...);
app.get('/api/health', async (req, res) => {
  try { await startupReady; } catch { return res.status(503).json({ code: 503, ... }); }
  res.json({ code: 200, message: 'Backend Ready' });
});
```

Seeding runs on every startup, not from a separate command. `seed_db.js` uses
`INSERT OR IGNORE` followed by an `UPDATE` for accounts (`seed_db.js:46-51`) and `DELETE` plus
`INSERT` for rows a test will mutate, so a restart restores the fixture world. It reads
`ARC_TEST_DATE` (`seed_db.js:12`) and derives next/previous/upcoming dates from it, so seeded
orders stay in the right tab relative to the test's idea of today.

The data store is SQLite in a single file, `database.db` by default, overridable with
`ARC_DB_FILE` or `DATABASE_FILE` (`backend/src/database/init_db.js:5-10`).

### 3.4 What the Docker harness imposes

`Dockerfile` and `docker/*.sh` bound a generated app more tightly than the README does:

| Constraint | Value | Source |
|---|---|---|
| Shared app/test port | 3301 | `Dockerfile` (`ENV ARC_RUNTIME_PORT=3301`, `EXPOSE 3301`) |
| Health path | `/api/health` | `docker/reference-entrypoint.sh:17` |
| Startup budget | 60 polls at 1 s | `docker/reference-entrypoint.sh:18`, `:326-338` |
| Per-test timeout, reference mode | 15,000 ms | `docker/reference-entrypoint.sh:19` |
| Hard process cap | 600,000 ms | `docker/reference-entrypoint.sh:20` |
| Suite global timeout | process cap minus 30 s | `docker/reference-entrypoint.sh:39-45` |
| Start command | `PORT=<port> npm run start` in the project or `backend/` | `docker/reference-entrypoint.sh:318-324` |
| Install/build | `npm install` at root, `frontend/`, `backend/`; `npm run build` where present | `docker/reference-entrypoint.sh:131-186` |
| Base image | `mcr.microsoft.com/playwright:v1.54.0-noble` | `Dockerfile:1` |

Note the base image pins Playwright 1.54.0 but `npm ci` installs the repo's 1.61.1 and then
re-installs browsers, so the effective version in the container is 1.61.1.

The *other* entrypoint, `docker/entrypoint.sh`, is the organizers' own generation pipeline: it
runs `arc compile <requirementDir> -o <workspace> --type web --clean`, starts the result on 3301,
waits for `/api/health`, and runs the suite. `arc` comes from the `agentic-requirement-compiler`
submodule, which is public and clones fine (commit `2feea34`, 2026-08-19). That submodule is the
requirement-to-test compiler; its presence means the requirement packages we receive in the
competition are machine-generated from the same YAML shape catalogued above.

### 3.5 Difference from what our harness generates today

Skimmed only; `volo/` was not modified.

| Aspect | arc-bench reference | `volo/web_runtime.py` today |
|---|---|---|
| Server | Express 5 | bare `node:http` with a `backend/api.cjs` handler (`volo/web_runtime.py:9-33`) |
| Default port | `PORT` else 3000 (`backend/src/index.js:3-4`) | `PORT` else 3000 (`volo/web_runtime.py:33`) |
| `/api/health` | present, gates on seeding | **absent** — no match for `health` anywhere in `volo/*.py` |
| Frontend build | Vite build to `frontend/dist` | `fs.cpSync('public','dist')` (`volo/web_runtime.py:36-38`) |
| UI framework | React + react-router + Tailwind | hand-written `frontend/public/index.html` + `app.js` (`volo/web_runtime.py:102-103`) |
| Data store | SQLite file, `ARC_DB_FILE` overridable | none supplied by the runtime |
| Startup seeding | mandatory, awaited by health | none |
| SPA fallback | regex excluding `/api` | extension/`/api/` heuristic (`volo/web_runtime.py:26`) |

The port and the SPA fallback already line up. Health, seeding and a data store do not.

## 4. Runner comparison: repository versus hosted competition

| Setting | arc-bench repository | Hosted competition runner | Evidence or inference |
|---|---|---|---|
| Playwright | 1.61.1 | 1.57.0 | **Evidence** both sides: `package.json` `devDependencies`, verified by `npx playwright --version`; hosted from `docs/evidence/2026-09-12-runner-rules.json` |
| Source date | commit `a0d049c`, 2026-09-12 | observed 2026-09-12 | **Evidence**: `git log -1`; probe `observed_at` |
| Node / OS | 22.22.0 / darwin arm64 (our host) | 20.19.3 / linux x64 | **Evidence** both; our host version is ours, not the organizers' |
| Test timeout | 60,000 ms default | 10,000 ms | **Evidence**: `playwright.config.ts:4`; hosted config capture |
| Expect timeout | 10,000 ms | 10,000 ms | **Evidence** both |
| Workers | 1, forced | 4 configured | **Evidence**: `playwright.config.ts`, plus `scripts/run-playwright.js:243-245` appends `--workers 1` after user args, and `scripts/audit-benchmark-tests.js:24-33` fails the build if that is removed |
| fullyParallel | false | false | **Evidence** both |
| Retries | 0 local, 1 under `CI` | 0 | **Evidence**: `playwright.config.ts:10`; hosted effective report |
| baseURL | `http://127.0.0.1:3301` | `http://127.0.0.1:3000` | **Evidence** both |
| Trace / screenshot / video | retain-on-failure / only-on-failure / retain-on-failure | off / off / not stated | **Evidence** both |
| Reference-mode test timeout | 15,000 ms | n/a | **Evidence**: `docker/reference-entrypoint.sh:19` |
| Suite hard cap | 600,000 ms process, 570,000 ms global | not captured | **Evidence** repo side only |

Three readings that are **inference, not evidence**:

- The hosted runner almost certainly enforces the same spec-writing contract, because the repo's
  audit script and the hosted suites share the `REQ-<id>: <scenario name>` title shape. We have
  not seen the hosted audit run.
- `workers: 4` with `fullyParallel: false` parallelises at *file* granularity. With one spec file
  per ATOMIC requirement, that means up to four requirements exercised concurrently against one
  backend and one database. The corpus's one-seed-row-per-mutating-test convention (section 2.6)
  is exactly what makes that safe. We infer the convention exists for this reason; the organizers
  do not say so.
- Our Ticket Booking task is a 10-test Chinese-language derivative and is not one of these six
  apps. We treat the six as *style* evidence for what the hidden competition tests will look like,
  not as the tests themselves.

### 4.1 Sensitivity to the 10-second limit

Measured directly in section 1.2, same host, same reference build, fresh database per run.
Holding artifact capture off, moving the per-test budget from 60 s to 10 s costs two of 135 tests
at one worker and none at four. The hosted runner's shorter timeout is therefore **not** the risk
it looks like on paper. The repository's default trace and video capture costs fourteen tests and
triples wall time, and the hosted runner disables exactly that. When rehearsing locally against
this corpus, match the hosted runner's `trace: off` / `video: off` or the numbers will mislead.

## 5. What the corpus implies for our harness, ranked

Every item names the test or helper that motivates it and what it would change in the applications
`volo/` generates. Nothing here has been implemented; `volo/` was not modified.

### 5.1 Emit `/api/health`, and do not let it answer before seeding is committed

**Motivating citation.** `docker/reference-entrypoint.sh:17-18` sets `HEALTH_PATH=/api/health` and
`START_TIMEOUT=60`, then `:326-338` polls that path once a second and aborts the entire run with
`runtime_status=1` if it never returns 200. The reference satisfies it by awaiting the seed:
`arc-bench/webapp/12306/project/backend/src/app.js:19-33`.

**What changes.** `volo/web_runtime.py` contains no health route; a grep for `health` across
`volo/*.py` returns nothing. The generated server scaffold would gain a `/api/health` handler that
resolves only after the seed transaction commits, and returns 503 if seeding threw. This is the
single highest-value change because failing it scores zero on every test, not one.

### 5.2 Seed a dedicated row per mutating requirement, at startup, idempotently

**Motivating citation.** 426 of 460 specs depend on pre-seeded state (section 2.6) and there is no
reset API anywhere in the corpus. The reference seeds 26 user rows in one startup transaction
(`arc-bench/webapp/12306/project/backend/src/database/seed_db.js:17-44`), using `INSERT OR IGNORE`
plus `UPDATE` so a restart restores the world. The naming shows the rule: one private row per
destructive test — `keep/tests/helpers.ts:13-15` (`'Delete me 2.3.1'`, `2.3.2`, `2.3.3`),
bookstack's `book_5_4_1` / `book_5_4_2`, stackoverflow's `accounts.answerDeleteUser`.

**What changes.** Generation must treat quoted identities in requirement descriptions as a seed
specification, not as prose, and emit a startup seeder. Crucially it must allocate a *separate*
row per mutating scenario rather than reusing one account, because with `workers: 4` the hosted
runner can execute four requirement files against one database at once.

### 5.3 Eliminate ambiguity on the actual interaction path

**Motivating citation.** This is what broke the organizers' own reference under artifact capture.
`toPattern` (`12306/tests/helpers.ts:237-240`) turns every string into a case-insensitive
*substring* regex, and `firstVisible` (`helpers.ts:242-254`) takes whichever candidate is visible first,
polling five times at 100 ms. `signOutAndOpenLogin` (`:466-470`) signs out and immediately clicks
`/login/i`. On the account-security page the reference renders
`<button class="edit-button">Login password</button>`; while the sign-out transition is still on
screen that button matches, wins the race, and the click never reaches the login link. The
Playwright call log names it explicitly:

```
- waiting for getByRole('button', { name: /login/i }).first()
  - locator resolved to <button class="edit-button">Login password</button>
```

REQ-4.3.6 and REQ-4.3.7 failed this way in both artifact-capturing runs and passed in all three
runs with capture off, which is what identifies it as a transition race rather than a fixed defect.

**What changes.** Two generation constraints. First, on the path the suite actually interacts
with, no other visible control may be a candidate for the name the suite is looking for: at the
moment of a navigation click, exactly one visible element may match that substring regex. That is
a constraint on the interaction path and on the transition, not a global ban on business
vocabulary. A blanket rule forbidding `login`, `register`, `search`, `book`, `delete`, `save` and
`edit` in every accessible name would contradict requirement text that names those controls
explicitly, and a required label that the specification states verbatim always wins. Second, a
view transition must unmount the old view rather than cross-fade it, so no stale control is
momentarily visible alongside the new one; that is what actually created the observed race.

### 5.4 Build the DOM for the accessibility tree; `data-testid` is worthless here

**Motivating citation.** `scripts/audit-benchmark-tests.js:39-46` rejects any spec containing a
class, id, or `data-` selector, `localStorage`, `.evaluate(`, `.route(`, `toHaveURL(` or the literal
`/api/`. Named sections must be real landmarks: `12306/tests/REQ-4.3.3.spec.ts:9` uses
`page.getByRole('region', { name: 'Contact information' })`, which a styled `<div>` does not satisfy.

**What changes.** Generated markup uses semantic elements and `aria-label` / `<label for>` for
every field, button, tab, dialog, alert, status, row and named section. Test-id attributes can be
dropped from the generator entirely.

### 5.5 Make every screen reachable by clicking from `/`

**Motivating citation.** `scripts/audit-benchmark-tests.js:166-170` requires `helpers.ts` to
contain exactly one navigation and for it to be `page.goto('/')`; `page.goto` is forbidden in
specs and we confirmed zero specs contain it. `toHaveURL` and `page.url()` are also forbidden.

**What changes.** Routing style is free, but no screen may be reachable only by URL. The
generator should assert a click path from the root to every requirement's entry screen.

### 5.6 Render the requirement's own vocabulary verbatim

**Motivating citation.** `prestashop/requirements/requirements.yaml:185` says
`Display carousel, Popular Products, promotion area, Newsletter subscription, footer`, and
`prestashop/tests/REQ-2.1.spec.ts:9` asserts `[/carousel/i, /popular products/i, /newsletter/i,
/footer/i]`. The word "carousel" must literally appear as visible text or an accessible name.
Quoted error strings are matched exactly the same way: `12306/requirements/requirements.yaml:104`
→ `REQ-2.1.4.spec.ts:10` asserts `'Please fill in all required fields.'`.

**What changes.** Copy for headings, section names, buttons and error messages is taken verbatim
from the requirement rather than paraphrased. Synonyms lose points silently.

### 5.7 Design to a 10-second test budget, but do not over-weight it

**Motivating citation.** The hosted runner uses a 10,000 ms test timeout against the repository's
60,000 ms default, and the repo's reference mode uses 15,000 ms
(`docker/reference-entrypoint.sh:19`). Section 1.2 measures the cost: with artifact capture off,
the shorter budget loses two of 135 tests at one worker and none at four. The two casualties,
REQ-3.2.10 and REQ-3.2.11, are result-list filter tests that re-query a table after a control
changes.

**What changes.** No generated flow should need more than a couple of seconds of settling; avoid
artificial delays, animation-gated visibility and post-submit redirect chains. But this is a
smaller lever than 5.1 through 5.3, and it is listed here rather than higher because the
measurement says so. The corresponding change to our *rehearsal* setup matters more than the
change to generated apps: local acceptance runs must disable trace and video, or they will
manufacture failures the hosted runner would never see.

### 5.8 Persistence must round-trip through a fresh session

**Motivating citation.** `12306/tests/REQ-4.3.3.spec.ts:15-18` saves a new email, signs out, and
signs back in with the new address. A UI echo without a server write fails.

**What changes.** Mutations write through to the store before the success message renders.

### 5.9 Read `ARC_TEST_DATE` server-side and survive a frozen browser clock

**Motivating citation.** `12306/tests/helpers.ts:3` is the only environment variable read anywhere
in the corpus, and the reference seeder reads the same one (`seed_db.js:12`). ctrip instead pins
the browser clock to `'2026-07-19T12:00:00+08:00'` (`ctrip/tests/helpers.ts:30,383-386`), which
does not reach the server.

**What changes.** Server-side date logic honours `ARC_TEST_DATE`; client-side date display derives
from the browser clock so a `page.clock` freeze stays consistent with what is rendered.

### 5.10 Keep the corpus as an opt-in local acceptance rig

**Motivating citation.** `npm run test:audit` passes on the published corpus and
`npm run reference:12306` completes end to end in 5.5 minutes on this machine, so the six apps are
a usable rehearsal target that costs nothing and calls no model.

**What changes.** `harness_lab/arc_bench_corpus.py` (added here) runs one app's official suite
against any target URL under either profile. It is opt-in and wired into no default path, in line
with the `harness_lab/` rule in `AGENTS.md`.

## 6. Using the local rig

`harness_lab/arc_bench_corpus.py` runs one app's official suite against any target URL through the
organizers' own clone, so the pinned Playwright version, the config and the specs stay untouched.
It is opt-in and no default harness path calls it.

```bash
# Repository profile: 60 s per test, 10 s per assertion.
python harness_lab/arc_bench_corpus.py --app 12306 --target-url http://127.0.0.1:3301

# Hosted profile: 10 s per test, matching the observed competition runner.
python harness_lab/arc_bench_corpus.py --app keep --target-url http://127.0.0.1:3000 \
    --profile hosted --report-dir /tmp/arc-report --json /tmp/arc-result.json

# One requirement family only.
python harness_lab/arc_bench_corpus.py --app bookstack --target-url http://127.0.0.1:3000 \
    --grep 'REQ-4\.'
```

It requires `npm install` to have been run once in the clone and exits with a clear message
otherwise. `--clone` points it at a different checkout. Worker count stays at 1 in both profiles
because `scripts/run-playwright.js:243-245` appends `--workers 1` after any user argument; running
with four workers requires a separate config file, which is what section 1.2 row 3 used.

### Reproducing the 12306 reference by hand

```bash
cd arc-bench/webapp/12306/project/frontend && npm install && npm run build
cd ../backend && npm install && PORT=3301 node src/index.js
# then, from the arc-bench root
npm run test -- --app 12306 --target-url http://127.0.0.1:3301
```

Delete `backend/database.db` between runs; it is not reset automatically and the suite mutates it.

## 7. Boundaries of this catalog

- One run per configuration. The failure sets in rows 1 and 2 of section 1.2 differ, so single-run
  failure lists are indicative, not exact.
- Only 12306 was executed. The other five apps were read, not run, because they ship no reference
  implementation to run against.
- The hosted runner's settings come from one authorized Smoke probe on 2026-09-12, not from this
  work. Whether the hidden competition tests use the same helper style as these six apps is an
  inference from the shared `REQ-<id>: <scenario>` title shape and the shared compiler, not a fact.
- `volo/` was read and not modified. None of section 5 has been implemented.
