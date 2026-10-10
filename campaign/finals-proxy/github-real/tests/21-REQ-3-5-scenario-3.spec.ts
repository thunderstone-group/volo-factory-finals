import { test, expect } from '@playwright/test';
import { openEvolutionRepository, clickEvolutionTarget } from './evolution-navigation';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-3-5: Archive and Restore a Repository - Scenario 3", async ({ page, browser, baseURL }) => {
  // GIVEN: The system pre-provisions archived repository `evo-archive-repository-s3` and Admin account `evo-archive-admin` with email `evo.archive.admin@evolution.test` and password `Evo-Password-987!`; the repository contains `README.md`.

  // WHEN: The Admin opens Settings, activates “Restore repository”, confirms the dialog, and reloads the repository overview.
  await page.goto('/');
  await visible(named(page.getByRole('main'), 'link', 'Sign in')); await named(page.getByRole('main'), 'link', 'Sign in').click();
  await fill(page, 'Username or email', "evo-archive-admin"); await fill(page, 'Password', "Evo-Password-987!");
  await button(page, 'Sign in');
  await openEvolutionRepository(page, "evo-archive-repository-s3");
  await clickEvolutionTarget(page, 'Settings'); await button(page, 'Restore repository');
  const dialog = named(page, 'dialog', 'Restore repository'); await visible(dialog); await button(dialog, 'Confirm restore');
  await expect(page.getByText('Archived', {exact:true})).toHaveCount(0);
  await expect(page.getByText(/active/i).first()).toBeVisible();
  await openEvolutionRepository(page, "evo-archive-repository-s3");
  await page.reload();
  // THEN: The Archived marker is gone, the repository is Active, and its existing content remains visible.
  await expect(page.getByText('Archived', {exact:true})).toHaveCount(0); await visible(named(page, 'link', 'README.md')); await visible(page.getByRole('heading').filter({hasText:'evo-archive-repository-s3'}));
});
