# Visible official real-finals code frames

Extracted from the two read-only finals-r1 Playwright reports. This is partial
test-code evidence, not a reconstruction of the undisclosed full suite.

## github-real

Report SHA-256: `0d4dd60dc3c0737150407c3b79def51ff5f86ca9417c6b880aa7f9bacd109097`. Official result: 3/30.

### github-real-F01

Source: `/workspace/tests/REQ-1-1-1-registration.spec.ts`; observed in: REQ-1-1-1#1, REQ-1-1-1#2, REQ-1-1-1#3.

```ts
   7 | async function openEvolutionSignUp(page: Page): Promise<void> {
   8 |   await openEvolutionAccountAccess(page);
   9 |   await page.getByRole('main').getByRole('link', { name: 'Sign in', exact: true }).click();
  10 |   await page.getByRole('main').getByRole('link', { name: 'Create an account', exact: true }).click();
  11 | }
  12 |
```

### github-real-F02

Source: `/workspace/tests/REQ-1-1-2-sign-in.spec.ts`; observed in: REQ-1-1-2#1, REQ-1-1-2#2, REQ-1-1-2#3.

```ts
   7 | async function openEvolutionSignIn(page: import('@playwright/test').Page): Promise<void> {
   8 |   await openEvolutionAccountAccess(page);
   9 |   await page.getByRole('main').getByRole('link', { name: 'Sign in', exact: true }).click();
  10 | }
  11 |
  12 | test('REQ-1-1-2: Sign In with an Existing Account - Evolution Scenario 1', async ({ page }, testInfo) => {
```

### github-real-F03

Source: `/workspace/tests/support/evolution-e2e.ts`; observed in: REQ-1-4#1, REQ-1-4#2, REQ-1-4#3, REQ-2-1-2#1, REQ-2-1-2#2, REQ-2-1-2#3, REQ-2-4#1, REQ-2-4#2, REQ-2-4#3, REQ-3-5#1, REQ-3-5#2, REQ-3-5#3, REQ-4-5#1, REQ-4-5#3, REQ-5-5#1, REQ-5-5#2.

```ts
  95 | export async function signInEvolution(page: Page, account: EvolutionAccount): Promise<void> {
  96 |   await openEvolutionAccountAccess(page);
  97 |   await page.getByRole('main').getByRole('link', { name: 'Sign in', exact: true }).click();
  98 |   await page.getByLabel('Username or email', { exact: true }).fill(account.username);
  99 |   await page.getByLabel('Password', { exact: true }).fill(account.password);
 100 |   await page.getByRole('button', { name: 'Sign in', exact: true }).click();
```

### github-real-F04

Source: `/workspace/tests/support/evolution-e2e.ts`; observed in: REQ-4-3-1#1, REQ-4-3-1#2, REQ-4-3-1#3, REQ-4-5#2, REQ-5-5#3.

```ts
 105 |   if (await page.getByRole('banner').count() === 0) await page.goto(evolutionBaseUrl());
 106 |   const search = page.getByRole('banner').getByRole('searchbox', { name: 'Search', exact: true });
 107 |   await search.fill(name);
 108 |   await search.press('Enter');
 109 |   const result = page.getByRole('main').getByRole('link', { name, exact: true });
 110 |   await expect(result).toBeVisible();
```

## sheet-real

Report SHA-256: `32b5e5e2d964a9bde1d02d1f27c0493baf7915fb6c53625de4d031ead7921f87`. Official result: 21/30.

### sheet-real-F01

Source: `/workspace/tests/REQ-5-1-2-filter-views-evolution.spec.ts`; observed in: REQ-5-1-2#1.

```ts
   5 |
   6 | async function applyCondition(page: Page, header: string, option: string, value: string): Promise<void> {
   7 |   await page.getByRole('button', { name: 'Create filter', exact: true }).click();
   8 |   const dialog = page.getByRole('dialog', { name: 'Filter', exact: true });
   9 |   await dialog.getByLabel('Range', { exact: true }).fill('D3:F7');
  10 |   await dialog.getByLabel('Column', { exact: true }).fill(header === 'Workstream' ? 'D' : 'F');
```

### sheet-real-F02

Source: `/workspace/tests/REQ-5-1-2-filter-views-evolution.spec.ts`; observed in: REQ-5-1-2#3.

```ts
  59 |   await saveName.fill(' queued lanes ');
  60 |   await page.getByRole('button', { name: 'Save view', exact: true }).click();
  61 |   await expect(page.getByRole('alert')).toContainText('Filter view name already exists');
  62 |   await page.getByRole('dialog').filter({ has: page.getByLabel('Filter view name', { exact: true }) }).getByRole('button', { name: 'Close', exact: true }).click();
  63 |   await openDataMenu(page);
  64 |   await page.getByRole('menuitem', { name: 'Filter views', exact: true }).click();
```

### sheet-real-F03

Source: `/workspace/tests/REQ-5-2-1-validation-message-evolution.spec.ts`; observed in: REQ-5-2-1#1.

```ts
  16 |   await formulaBar(page).fill('88');
  17 |   await formulaBar(page).press('Enter');
  18 |   await expect(page.getByRole('alert')).toContainText('Capacity must be from 25 to 75');
  19 |   await expect(gridCell(page, 'J6')).toHaveText('37');
  20 |   await page.reload();
  21 |   await gridCell(page, 'J6').click();
```

### sheet-real-F04

Source: `/workspace/tests/REQ-5-2-1-validation-message-evolution.spec.ts`; observed in: REQ-5-2-1#2.

```ts
  31 |   await editor.fill('Paused');
  32 |   await editor.press('Enter');
  33 |   await expect(page.getByRole('alert')).toContainText('Choose a queue state');
  34 |   await expect(gridCell(page, 'K8')).toContainText('Ready');
  35 |   await page.reload();
  36 |   await gridCell(page, 'K8').dblclick();
```

### sheet-real-F05

Source: `/workspace/tests/REQ-5-2-1-validation-message-evolution.spec.ts`; observed in: REQ-5-2-1#3.

```ts
  48 |   await formulaBar(page).fill('24');
  49 |   await formulaBar(page).press('Enter');
  50 |   await expect(page.getByRole('alert')).toContainText('Allocate between 25 and 75');
  51 |   await expect(gridCell(page, 'L4')).toHaveText('42');
  52 |   await page.reload();
  53 |   await expect((await openValidation(page, 'L4')).getByLabel('Error message', { exact: true })).toHaveValue('Allocate between 25 and 75');
```

### sheet-real-F06

Source: `/workspace/tests/REQ-7-1-1-named-ranges.spec.ts`; observed in: REQ-7-1-1#1.

```ts
  22 |   }
  23 |   await expect(page.getByRole('dialog', { name: 'Named ranges', exact: true })).toContainText('CapacityPlan');
  24 |   await page.getByRole('dialog', { name: 'Named ranges', exact: true }).getByRole('button', { name: 'Close', exact: true }).click();
  25 |   await gridCell(page, 'L3').click();
  26 |   await formulaBar(page).fill('=SUM(CapacityPlan)');
  27 |   await formulaBar(page).press('Enter');
```

### sheet-real-F07

Source: `/workspace/tests/REQ-8-1-1-cell-notes.spec.ts`; observed in: REQ-8-1-1#1.

```ts
  18 |   await addNote(page, 'D8', note);
  19 |   await expect(gridCell(page, 'D8')).toHaveText('Manifest R41');
  20 |   await gridCell(page, 'D8').getByRole('button', { name: 'Open note for D8', exact: true }).click();
  21 |   await expect(page.getByLabel('Note', { exact: true })).toHaveValue(note);
  22 |   await page.reload();
  23 |   await gridCell(page, 'D8').getByRole('button', { name: 'Open note for D8', exact: true }).click();
```

### sheet-real-F08

Source: `/workspace/tests/REQ-8-1-1-cell-notes.spec.ts`; observed in: REQ-8-1-1#2.

```ts
  27 | test('REQ-8-1-1: Cell notes - Scenario 2', async ({ page }) => {
  28 |   await openVisibleWorkbook(page, 'EVO-N05-NOTE-EDIT');
  29 |   await gridCell(page, 'F6').getByRole('button', { name: 'Open note for F6', exact: true }).click();
  30 |   await page.getByRole('button', { name: 'Edit note', exact: true }).click();
  31 |   const dialog = page.getByRole('dialog', { name: 'Note for F6', exact: true });
  32 |   const noteField = dialog.getByLabel('Note', { exact: true });
```

### sheet-real-F09

Source: `/workspace/tests/REQ-8-1-1-cell-notes.spec.ts`; observed in: REQ-8-1-1#3.

```ts
  44 | test('REQ-8-1-1: Cell notes - Scenario 3', async ({ page }) => {
  45 |   await openVisibleWorkbook(page, 'EVO-N05-NOTE-DELETE');
  46 |   await gridCell(page, 'J3').getByRole('button', { name: 'Open note for J3', exact: true }).click();
  47 |   await page.getByRole('button', { name: 'Delete note', exact: true }).click();
  48 |   await expect(page.getByRole('button', { name: 'Open note for J3', exact: true })).toHaveCount(0);
  49 |   await expect(gridCell(page, 'J3')).toHaveText('Route Zeta');
```

