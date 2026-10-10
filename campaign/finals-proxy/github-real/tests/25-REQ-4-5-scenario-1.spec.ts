import { test, expect } from '@playwright/test';
import { openEvolutionRepository, clickEvolutionTarget } from './evolution-navigation';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-4-5: Create and View Repository Releases - Scenario 1", async ({ page, browser, baseURL }) => {
  // GIVEN: The system pre-provisions public repository `evo-release-repository-s1`, branch `evo-main-s1`, and Owner account `evo-release-owner` with email `evo.release.owner@evolution.test`, password `Evo-Password-987!`, and Write permission.

  // WHEN: The Owner opens “Releases”, clicks “New release”, enters tag `evo-v0-1-s1`, title `Evolution Preview`, description `Evolution release description`, selects target branch `evo-main-s1`, and clicks “Publish release”.
  await page.goto('/');
  await visible(named(page.getByRole('main'), 'link', 'Sign in')); await named(page.getByRole('main'), 'link', 'Sign in').click();
  await fill(page, 'Username or email', "evo-release-owner"); await fill(page, 'Password', "Evo-Password-987!");
  await button(page, 'Sign in');
  await openEvolutionRepository(page, "evo-release-repository-s1");
  await clickEvolutionTarget(page, 'Releases'); await clickEvolutionTarget(page, 'New release');
  await fill(page, 'Tag name', 'evo-v0-1-s1'); await fill(page, 'Release title', 'Evolution Preview'); await fill(page, 'Description', 'Evolution release description'); await choose(page, 'Target branch', 'evo-main-s1'); await button(page, 'Publish release');
  // THEN: The release detail displays `evo-v0-1-s1`, `Evolution Preview`, `Evolution release description`, and target branch `evo-main-s1`; the same release detail remains visible after reload.
  await expect(page.getByRole('heading', {name:'evo-v0-1-s1',exact:true})).toBeVisible();
  await expect(page.getByText('Evolution Preview', {exact:true})).toBeVisible();
  await expect(page.getByText('Evolution release description', {exact:true})).toBeVisible();
  await expect(page.getByText(/target branch:\s*evo-main-s1/i)).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', {name:'evo-v0-1-s1',exact:true})).toBeVisible();
  await expect(page.getByText('Evolution Preview', {exact:true})).toBeVisible();
  await expect(page.getByText('Evolution release description', {exact:true})).toBeVisible();
  await expect(page.getByText(/target branch:\s*evo-main-s1/i)).toBeVisible();
});
