import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-5-5: Add and Remove Issue Reactions - Scenario 2", async ({ page, browser, baseURL }) => {
  // GIVEN: The system pre-provisions public issue `Evo reaction issue s2` and account `evo-reaction-user` with email `evo.reaction.user@evolution.test` and password `Evo-Password-987!`; the account has not reacted to the issue and no other “+1” reaction exists.

  // WHEN: The user signs in, adds the “+1” reaction, and activates that same reaction again.
  await page.goto('/');
  await visible(named(page.getByRole('main'), 'link', 'Sign in')); await named(page.getByRole('main'), 'link', 'Sign in').click();
  await fill(page, 'Username or email', "evo-reaction-user"); await fill(page, 'Password', "Evo-Password-987!");
  await button(page, 'Sign in');
  await openPublicIssue(page, 'Evo reaction issue s2'); const before = await issueContent(page); expect(await reactionCount(page)).toBe(0);
  await button(page, 'Add reaction'); const reactionMenu = page.getByRole('menu'); await visible(reactionMenu); await visible(named(reactionMenu, 'menuitem', '+1')); await named(reactionMenu, 'menuitem', '+1').click(); await visible(named(page, 'button', 'Remove +1 reaction'));
  await button(page, 'Remove +1 reaction');
  // THEN: The user reaction is removed and the “+1” count returns to its original value without changing the issue content.
  await expect(named(page, 'button', 'Remove +1 reaction')).toHaveCount(0); expect(await reactionCount(page)).toBe(0); expect(await issueContent(page)).toBe(before);
});
