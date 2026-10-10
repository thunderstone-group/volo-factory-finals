import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-5-5: Add and Remove Issue Reactions - Scenario 3", async ({ page, browser, baseURL }) => {
  // GIVEN: The system pre-provisions public issue `Evo reaction issue s3` with an existing “+1” reaction count. The visitor is unauthenticated.
  await page.goto('/');
  // WHEN: The visitor opens `Evo reaction issue s3`.
  await openPublicIssue(page, 'Evo reaction issue s3');
  // THEN: The existing “+1” count is visible, but no actionable “Add reaction” control is available to the visitor.
  expect(await reactionCount(page)).toBeGreaterThan(0); await unavailable(named(page, 'button', 'Add reaction')); await unavailable(named(page, 'button', 'Remove +1 reaction'));
});
