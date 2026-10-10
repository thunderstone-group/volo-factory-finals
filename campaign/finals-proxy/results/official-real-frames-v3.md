# Official finals-r1..r5 visible code evidence

All ten reports were scanned recursively to confirm every visible frame occurrence
is represented. Error messages preserve resolved locators, expected values, regexes,
and call logs in the structured extraction. No application source is used here.

## github

### github-v3-F01

Source: `/workspace/tests/REQ-1-1-1-registration.spec.ts`; observations: r1 REQ-1-1-1#1, r1 REQ-1-1-1#2, r1 REQ-1-1-1#3, r3 REQ-1-1-1#1, r3 REQ-1-1-1#2, r3 REQ-1-1-1#3.

```ts
   7 | async function openEvolutionSignUp(page: Page): Promise<void> {
   8 |   await openEvolutionAccountAccess(page);
   9 |   await page.getByRole('main').getByRole('link', { name: 'Sign in', exact: true }).click();
  10 |   await page.getByRole('main').getByRole('link', { name: 'Create an account', exact: true }).click();
  11 | }
  12 |
```

### github-v3-F02

Source: `/workspace/tests/REQ-1-1-2-sign-in.spec.ts`; observations: r1 REQ-1-1-2#1, r1 REQ-1-1-2#2, r1 REQ-1-1-2#3, r3 REQ-1-1-2#1, r3 REQ-1-1-2#2, r3 REQ-1-1-2#3.

```ts
   7 | async function openEvolutionSignIn(page: import('@playwright/test').Page): Promise<void> {
   8 |   await openEvolutionAccountAccess(page);
   9 |   await page.getByRole('main').getByRole('link', { name: 'Sign in', exact: true }).click();
  10 | }
  11 |
  12 | test('REQ-1-1-2: Sign In with an Existing Account - Evolution Scenario 1', async ({ page }, testInfo) => {
```

### github-v3-F03

Source: `/workspace/tests/support/evolution-e2e.ts`; observations: r1 REQ-1-4#1, r1 REQ-1-4#2, r1 REQ-1-4#3, r1 REQ-2-1-2#1, r1 REQ-2-1-2#2, r1 REQ-2-1-2#3, r1 REQ-2-4#1, r1 REQ-2-4#2, r1 REQ-2-4#3, r1 REQ-3-5#1, r1 REQ-3-5#2, r1 REQ-3-5#3, r1 REQ-4-5#1, r1 REQ-4-5#3, r1 REQ-5-5#1, r1 REQ-5-5#2, r3 REQ-1-4#1, r3 REQ-1-4#2, r3 REQ-1-4#3, r3 REQ-2-1-2#1, r3 REQ-2-1-2#2, r3 REQ-2-1-2#3, r3 REQ-2-4#1, r3 REQ-2-4#2, r3 REQ-2-4#3, r3 REQ-3-5#1, r3 REQ-3-5#2, r3 REQ-3-5#3, r3 REQ-4-5#1, r3 REQ-4-5#3, r3 REQ-5-5#1, r3 REQ-5-5#2.

```ts
  95 | export async function signInEvolution(page: Page, account: EvolutionAccount): Promise<void> {
  96 |   await openEvolutionAccountAccess(page);
  97 |   await page.getByRole('main').getByRole('link', { name: 'Sign in', exact: true }).click();
  98 |   await page.getByLabel('Username or email', { exact: true }).fill(account.username);
  99 |   await page.getByLabel('Password', { exact: true }).fill(account.password);
 100 |   await page.getByRole('button', { name: 'Sign in', exact: true }).click();
```

### github-v3-F04

Source: `/workspace/tests/support/evolution-e2e.ts`; observations: r1 REQ-4-3-1#1, r1 REQ-4-3-1#2, r1 REQ-4-3-1#3, r1 REQ-4-5#2, r1 REQ-5-5#3, r3 REQ-4-3-1#1, r3 REQ-4-3-1#2, r3 REQ-4-3-1#3, r3 REQ-4-5#2, r3 REQ-5-5#3, r4 REQ-3-5#1, r4 REQ-3-5#2, r4 REQ-3-5#3, r4 REQ-4-3-1#1, r4 REQ-4-3-1#2, r4 REQ-4-3-1#3, r4 REQ-4-5#1, r4 REQ-4-5#2, r4 REQ-4-5#3, r4 REQ-5-5#1, r4 REQ-5-5#2, r4 REQ-5-5#3.

```ts
 105 |   if (await page.getByRole('banner').count() === 0) await page.goto(evolutionBaseUrl());
 106 |   const search = page.getByRole('banner').getByRole('searchbox', { name: 'Search', exact: true });
 107 |   await search.fill(name);
 108 |   await search.press('Enter');
 109 |   const result = page.getByRole('main').getByRole('link', { name, exact: true });
 110 |   await expect(result).toBeVisible();
```

### github-v3-F05

Source: `/workspace/tests/REQ-1-4-active-sessions.spec.ts`; observations: r2 REQ-1-4#2, r5 REQ-1-4#2.

```ts
  34 |   await page.getByRole('button', { name: /revoke session/i }).first().click();
  35 |
  36 |   await expect(page.getByText(/revoked|inactive/i)).toBeVisible();
  37 |   await page.reload();
  38 |   await expect(page.getByRole('heading', { name: 'Active sessions', exact: true })).toBeVisible();
  39 |   await expect(page.getByText(/revoked|inactive/i)).toBeVisible();
```

### github-v3-F06

Source: `/workspace/tests/support/evolution-e2e.ts`; observations: r2 REQ-2-4#1, r2 REQ-2-4#2, r2 REQ-5-5#2, r2 REQ-5-5#3, r4 REQ-2-4#1, r4 REQ-2-4#2, r5 REQ-2-4#1, r5 REQ-2-4#2, r5 REQ-5-5#2, r5 REQ-5-5#3.

```ts
 119 |   ];
 120 |   let selected: Locator | null = null;
 121 |   await expect.poll(async () => {
 122 |     for (const candidate of candidates) {
 123 |       if ((await candidate.count()) > 0 && (await candidate.isVisible())) { selected = candidate; return true; }
 124 |     }
```

### github-v3-F07

Source: `/workspace/tests/REQ-3-5-archive-repository.spec.ts`; observations: r2 REQ-3-5#3, r5 REQ-3-5#3.

```ts
  54 |
  55 |   await expect(page.getByText('Archived', { exact: true })).toHaveCount(0);
  56 |   await expect(page.getByText(/active/i).first()).toBeVisible();
  57 |   await openEvolutionRepository(page, repository);
  58 |   await page.reload();
  59 |   await expect(page.getByText('Archived', { exact: true })).toHaveCount(0);
```

### github-v3-F08

Source: `/workspace/tests/REQ-4-5-releases.spec.ts`; observations: r2 REQ-4-5#2, r5 REQ-4-5#2.

```ts
  42 |   await expect(page.getByRole('heading', { name: tag, exact: true })).toBeVisible();
  43 |   await expect(page.getByText('Existing Evolution Release', { exact: true })).toBeVisible();
  44 |   await expect(page.getByText('Evolution release', { exact: true })).toBeVisible();
  45 |   await expect(page.getByText(/target branch:\s*evo-main-s2/i)).toBeVisible();
  46 | });
  47 |
```

### github-v3-F09

Source: `/workspace/tests/REQ-4-5-releases.spec.ts`; observations: r2 REQ-4-5#3, r5 REQ-4-5#3.

```ts
  55 |
  56 |   await expect(page.getByText('Tag already exists', { exact: true })).toBeVisible();
  57 |   await expect(page.getByText(evolutionSeedValue(testInfo, 'RELEASE_TAG_S3'), { exact: true })).toHaveCount(1);
  58 | });
  59 |
```

### github-v3-F10

Source: `/workspace/tests/REQ-5-5-issue-reactions.spec.ts`; observations: r2 REQ-5-5#1, r5 REQ-5-5#1.

```ts
  24 |
  25 |   await expect(page.getByRole('button', { name: 'Remove +1 reaction', exact: true })).toBeVisible();
  26 |   await expect(page.getByText('1 reaction', { exact: true })).toBeVisible();
  27 |   await expect(page.getByText(issue, { exact: true }).first()).toBeVisible();
  28 |   await page.reload();
  29 |   await expect(page.getByRole('button', { name: 'Remove +1 reaction', exact: true })).toBeVisible();
```

### github-v3-F11

Source: `/workspace/tests/REQ-1-4-active-sessions.spec.ts`; observations: r4 REQ-1-4#3, r5 REQ-1-4#3.

```ts
  54 |
  55 |   await revokedPage.reload();
  56 |   await expect(revokedPage.getByRole('main').getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
  57 |   await expect(page.getByText(account.username, { exact: true }).first()).toBeVisible();
  58 |   await revokedContext.close();
  59 | });
```

### github-v3-F12

Source: `/workspace/tests/REQ-2-1-2-create-organization.spec.ts`; observations: r5 REQ-2-1-2#1, r5 REQ-2-1-2#2, r5 REQ-2-1-2#3.

```ts
  10 |   await signInEvolution(page, owner);
  11 |   await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  12 |   await page.getByRole('menu').getByRole('link', { name: 'Your organizations', exact: true }).click();
  13 |   await clickEvolutionTarget(page, 'New organization');
  14 | }
  15 |
```

### github-v3-F13

Source: `/workspace/tests/REQ-4-5-releases.spec.ts`; observations: r5 REQ-4-5#1.

```ts
  27 |   await expect(page.getByText('Evolution Preview', { exact: true })).toBeVisible();
  28 |   await expect(page.getByText('Evolution release description', { exact: true })).toBeVisible();
  29 |   await expect(page.getByText(/target branch:\s*evo-main-s1/i)).toBeVisible();
  30 |   await page.reload();
  31 |   await expect(page.getByRole('heading', { name: tag, exact: true })).toBeVisible();
  32 |   await expect(page.getByText('Evolution Preview', { exact: true })).toBeVisible();
```

## sheet

### sheet-v3-F01

Source: `/workspace/tests/REQ-5-1-2-filter-views-evolution.spec.ts`; observations: r1 REQ-5-1-2#1, r2 REQ-5-1-2#1, r3 REQ-5-1-2#1, r4 REQ-5-1-2#1, r5 REQ-5-1-2#1.

```ts
   5 |
   6 | async function applyCondition(page: Page, header: string, option: string, value: string): Promise<void> {
   7 |   await page.getByRole('button', { name: 'Create filter', exact: true }).click();
   8 |   const dialog = page.getByRole('dialog', { name: 'Filter', exact: true });
   9 |   await dialog.getByLabel('Range', { exact: true }).fill('D3:F7');
  10 |   await dialog.getByLabel('Column', { exact: true }).fill(header === 'Workstream' ? 'D' : 'F');
```

### sheet-v3-F02

Source: `/workspace/tests/REQ-5-1-2-filter-views-evolution.spec.ts`; observations: r1 REQ-5-1-2#3, r3 REQ-5-1-2#3.

```ts
  59 |   await saveName.fill(' queued lanes ');
  60 |   await page.getByRole('button', { name: 'Save view', exact: true }).click();
  61 |   await expect(page.getByRole('alert')).toContainText('Filter view name already exists');
  62 |   await page.getByRole('dialog').filter({ has: page.getByLabel('Filter view name', { exact: true }) }).getByRole('button', { name: 'Close', exact: true }).click();
  63 |   await openDataMenu(page);
  64 |   await page.getByRole('menuitem', { name: 'Filter views', exact: true }).click();
```

### sheet-v3-F03

Source: `/workspace/tests/REQ-5-2-1-validation-message-evolution.spec.ts`; observations: r1 REQ-5-2-1#1.

```ts
  16 |   await formulaBar(page).fill('88');
  17 |   await formulaBar(page).press('Enter');
  18 |   await expect(page.getByRole('alert')).toContainText('Capacity must be from 25 to 75');
  19 |   await expect(gridCell(page, 'J6')).toHaveText('37');
  20 |   await page.reload();
  21 |   await gridCell(page, 'J6').click();
```

### sheet-v3-F04

Source: `/workspace/tests/REQ-5-2-1-validation-message-evolution.spec.ts`; observations: r1 REQ-5-2-1#2.

```ts
  31 |   await editor.fill('Paused');
  32 |   await editor.press('Enter');
  33 |   await expect(page.getByRole('alert')).toContainText('Choose a queue state');
  34 |   await expect(gridCell(page, 'K8')).toContainText('Ready');
  35 |   await page.reload();
  36 |   await gridCell(page, 'K8').dblclick();
```

### sheet-v3-F05

Source: `/workspace/tests/REQ-5-2-1-validation-message-evolution.spec.ts`; observations: r1 REQ-5-2-1#3.

```ts
  48 |   await formulaBar(page).fill('24');
  49 |   await formulaBar(page).press('Enter');
  50 |   await expect(page.getByRole('alert')).toContainText('Allocate between 25 and 75');
  51 |   await expect(gridCell(page, 'L4')).toHaveText('42');
  52 |   await page.reload();
  53 |   await expect((await openValidation(page, 'L4')).getByLabel('Error message', { exact: true })).toHaveValue('Allocate between 25 and 75');
```

### sheet-v3-F06

Source: `/workspace/tests/REQ-7-1-1-named-ranges.spec.ts`; observations: r1 REQ-7-1-1#1.

```ts
  22 |   }
  23 |   await expect(page.getByRole('dialog', { name: 'Named ranges', exact: true })).toContainText('CapacityPlan');
  24 |   await page.getByRole('dialog', { name: 'Named ranges', exact: true }).getByRole('button', { name: 'Close', exact: true }).click();
  25 |   await gridCell(page, 'L3').click();
  26 |   await formulaBar(page).fill('=SUM(CapacityPlan)');
  27 |   await formulaBar(page).press('Enter');
```

### sheet-v3-F07

Source: `/workspace/tests/REQ-8-1-1-cell-notes.spec.ts`; observations: r1 REQ-8-1-1#1, r3 REQ-8-1-1#1, r5 REQ-8-1-1#1.

```ts
  18 |   await addNote(page, 'D8', note);
  19 |   await expect(gridCell(page, 'D8')).toHaveText('Manifest R41');
  20 |   await gridCell(page, 'D8').getByRole('button', { name: 'Open note for D8', exact: true }).click();
  21 |   await expect(page.getByLabel('Note', { exact: true })).toHaveValue(note);
  22 |   await page.reload();
  23 |   await gridCell(page, 'D8').getByRole('button', { name: 'Open note for D8', exact: true }).click();
```

### sheet-v3-F08

Source: `/workspace/tests/REQ-8-1-1-cell-notes.spec.ts`; observations: r1 REQ-8-1-1#2, r3 REQ-8-1-1#2, r4 REQ-8-1-1#2, r5 REQ-8-1-1#2.

```ts
  27 | test('REQ-8-1-1: Cell notes - Scenario 2', async ({ page }) => {
  28 |   await openVisibleWorkbook(page, 'EVO-N05-NOTE-EDIT');
  29 |   await gridCell(page, 'F6').getByRole('button', { name: 'Open note for F6', exact: true }).click();
  30 |   await page.getByRole('button', { name: 'Edit note', exact: true }).click();
  31 |   const dialog = page.getByRole('dialog', { name: 'Note for F6', exact: true });
  32 |   const noteField = dialog.getByLabel('Note', { exact: true });
```

### sheet-v3-F09

Source: `/workspace/tests/REQ-8-1-1-cell-notes.spec.ts`; observations: r1 REQ-8-1-1#3, r3 REQ-8-1-1#3, r4 REQ-8-1-1#3, r5 REQ-8-1-1#3.

```ts
  44 | test('REQ-8-1-1: Cell notes - Scenario 3', async ({ page }) => {
  45 |   await openVisibleWorkbook(page, 'EVO-N05-NOTE-DELETE');
  46 |   await gridCell(page, 'J3').getByRole('button', { name: 'Open note for J3', exact: true }).click();
  47 |   await page.getByRole('button', { name: 'Delete note', exact: true }).click();
  48 |   await expect(page.getByRole('button', { name: 'Open note for J3', exact: true })).toHaveCount(0);
  49 |   await expect(gridCell(page, 'J3')).toHaveText('Route Zeta');
```

### sheet-v3-F10

Source: `/workspace/tests/REQ-7-1-1-named-ranges.spec.ts`; observations: r3 REQ-7-1-1#3.

```ts
  51 |   await dialog.getByLabel('Range', { exact: true }).fill('ForecastModel!K2:K4');
  52 |   await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  53 |   await expect(gridCell(page, 'M2')).toHaveText('25');
  54 |   await page.reload();
  55 |   const reopened = await namedRanges(page);
  56 |   await reopened.getByRole('button', { name: 'Edit MarginBase', exact: true }).click();
```

### sheet-v3-F11

Source: `/workspace/tests/REQ-5-1-2-filter-views-evolution.spec.ts`; observations: r4 REQ-5-1-2#2.

```ts
  42 |   await openVisibleWorkbook(page, 'EVO-M04-FILTER-APPLY');
  43 |   await openDataMenu(page);
  44 |   await page.getByRole('menuitem', { name: 'Filter views', exact: true }).click();
  45 |   await page.getByRole('dialog', { name: 'Filter views', exact: true }).getByRole('button', { name: 'Queued lanes', exact: true }).click();
  46 |   for (const row of ['4', '6', '7']) await expect(gridCell(page, `D${row}`)).toBeVisible();
  47 |   await expect(gridCell(page, 'D5')).not.toBeVisible();
```

### sheet-v3-F12

Source: `/workspace/tests/REQ-5-1-2-filter-views-evolution.spec.ts`; observations: r4 REQ-5-1-2#3.

```ts
  55 |   await createFilter(page);
  56 |   await openDataMenu(page);
  57 |   await page.getByRole('menuitem', { name: 'Save filter view', exact: true }).click();
  58 |   const saveName = page.getByLabel('Filter view name', { exact: true });
  59 |   await saveName.fill(' queued lanes ');
  60 |   await page.getByRole('button', { name: 'Save view', exact: true }).click();
```

### sheet-v3-F13

Source: `/workspace/tests/REQ-5-2-1-validation-message-evolution.spec.ts`; observations: r4 REQ-5-2-1#3.

```ts
   7 |   await selectCellRange(page, cell, cell);
   8 |   await openDataMenu(page);
   9 |   await page.getByRole('menuitem', { name: 'Data validation', exact: true }).click();
  10 |   return page.getByRole('dialog', { name: 'Data validation', exact: true });
  11 | }
  12 |
```

### sheet-v3-F14

Source: `/workspace/tests/REQ-6-1-1-freeze-panes.spec.ts`; observations: r4 REQ-6-1-1#1, r4 REQ-6-1-1#2, r4 REQ-6-1-1#3.

```ts
   7 |   await gridCell(page, cell).click();
   8 |   await page.getByRole('button', { name: 'View', exact: true }).click();
   9 |   await page.getByRole('menuitem', { name: action, exact: true }).click();
  10 | }
  11 |
  12 | test('REQ-6-1-1: Freeze panes - Scenario 1', async ({ page }) => {
```

### sheet-v3-F15

Source: `/workspace/tests/REQ-6-2-1-find-replace.spec.ts`; observations: r4 REQ-6-2-1#1, r4 REQ-6-2-1#2, r4 REQ-6-2-1#3.

```ts
   6 | async function findDialog(page: Page) {
   7 |   await page.getByRole('button', { name: 'Edit', exact: true }).click();
   8 |   await page.getByRole('menuitem', { name: 'Find and replace', exact: true }).click();
   9 |   return page.getByRole('dialog', { name: 'Find and replace', exact: true });
  10 | }
  11 |
```

### sheet-v3-F16

Source: `/workspace/tests/REQ-7-1-1-named-ranges.spec.ts`; observations: r4 REQ-7-1-1#1, r4 REQ-7-1-1#2, r4 REQ-7-1-1#3.

```ts
   6 | async function namedRanges(page: Page) {
   7 |   await openDataMenu(page);
   8 |   await page.getByRole('menuitem', { name: 'Named ranges', exact: true }).click();
   9 |   return page.getByRole('dialog', { name: 'Named ranges', exact: true });
  10 | }
  11 |
```

### sheet-v3-F17

Source: `/workspace/tests/REQ-7-2-1-conditional-formatting.spec.ts`; observations: r4 REQ-7-2-1#1, r4 REQ-7-2-1#2, r4 REQ-7-2-1#3.

```ts
   7 |   await selectCellRange(page, start, end);
   8 |   await page.getByRole('button', { name: 'Format', exact: true }).click();
   9 |   await page.getByRole('menuitem', { name: 'Conditional formatting', exact: true }).click();
  10 |   return page.getByRole('dialog', { name: 'Conditional formatting', exact: true });
  11 | }
  12 |
```

### sheet-v3-F18

Source: `/workspace/tests/REQ-8-1-1-cell-notes.spec.ts`; observations: r4 REQ-8-1-1#1.

```ts
   7 |   await gridCell(page, cell).click();
   8 |   await page.getByRole('button', { name: 'Insert', exact: true }).click();
   9 |   await page.getByRole('menuitem', { name: 'Add note', exact: true }).click();
  10 |   const dialog = page.getByRole('dialog', { name: `Note for ${cell}`, exact: true });
  11 |   await dialog.getByLabel('Note', { exact: true }).fill(note);
  12 |   await dialog.getByRole('button', { name: 'Save note', exact: true }).click();
```

