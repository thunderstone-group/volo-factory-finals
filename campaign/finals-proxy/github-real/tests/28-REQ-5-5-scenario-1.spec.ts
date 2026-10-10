import { test, expect } from '@playwright/test';
import { openEvolutionRepository, clickEvolutionTarget } from './evolution-navigation';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-5-5: Add and Remove Issue Reactions - Scenario 1", async ({ page, browser, baseURL }) => {
  // GIVEN: The system pre-provisions public repository `evo-reaction-repository-s1`, issue `Evo reaction issue s1`, and account `evo-reaction-author` with email `evo.reaction.author@evolution.test` and password `Evo-Password-987!`.

  // WHEN: The user signs in, opens `Evo reaction issue s1`, activates “Add reaction”, chooses “+1”, and reloads the issue.
  await page.goto('/');
  await visible(named(page.getByRole('main'), 'link', 'Sign in')); await named(page.getByRole('main'), 'link', 'Sign in').click();
  await fill(page, 'Username or email', "evo-reaction-author"); await fill(page, 'Password', "Evo-Password-987!");
  await button(page, 'Sign in');
  await openEvolutionRepository(page, "evo-reaction-repository-s1");
  await clickEvolutionTarget(page, 'Issues'); await clickEvolutionTarget(page, 'Evo reaction issue s1');
  await button(page, 'Add reaction'); const reactionMenu = page.getByRole('menu'); await visible(reactionMenu); await visible(named(reactionMenu, 'menuitem', '+1')); await named(reactionMenu, 'menuitem', '+1').click(); await visible(named(page, 'button', 'Remove +1 reaction'));
  await expect(page.getByText('1 reaction', {exact:true})).toBeVisible();
  await expect(page.getByText('Evo reaction issue s1', {exact:true}).first()).toBeVisible();
  await page.reload();
  // THEN: The issue displays the “+1” reaction with the updated count and keeps the user reaction highlighted after reload.
  await visible(named(page, 'button', 'Remove +1 reaction')); await expect(page.getByText('1 reaction', {exact:true})).toBeVisible(); await visible(page.getByRole('heading').filter({hasText:'Evo reaction issue s1'}));
});
