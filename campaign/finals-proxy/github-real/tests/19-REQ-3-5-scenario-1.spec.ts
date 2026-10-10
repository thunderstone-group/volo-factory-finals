import { test, expect } from '@playwright/test';
import { openEvolutionRepository, clickEvolutionTarget } from './evolution-navigation';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-3-5: Archive and Restore a Repository - Scenario 1", async ({ page, browser, baseURL }) => {
  // GIVEN: The system pre-provisions active repository `evo-archive-repository-s1` and Admin account `evo-archive-admin` with email `evo.archive.admin@evolution.test`, password `Evo-Password-987!`, and repository-administrator permission.

  // WHEN: The Admin signs in, opens the repository, opens “Settings”, activates “Archive repository”, and confirms the archive dialog.
  await page.goto('/');
  await visible(named(page.getByRole('main'), 'link', 'Sign in')); await named(page.getByRole('main'), 'link', 'Sign in').click();
  await fill(page, 'Username or email', "evo-archive-admin"); await fill(page, 'Password', "Evo-Password-987!");
  await button(page, 'Sign in');
  await openEvolutionRepository(page, "evo-archive-repository-s1");
  await clickEvolutionTarget(page, 'Settings'); await button(page, 'Archive repository');
  const dialog = named(page, 'dialog', 'Archive repository'); await visible(dialog); await button(dialog, 'Confirm archive');
  await openEvolutionRepository(page, "evo-archive-repository-s1");
  // THEN: The repository overview displays the exact “Archived” marker and retains it after reload.
  await text(page, 'Archived'); await page.reload(); await text(page, 'Archived');
});
