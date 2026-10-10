import { test, expect } from '@playwright/test';
import { openEvolutionRepository, clickEvolutionTarget } from './evolution-navigation';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-3-5: Archive and Restore a Repository - Scenario 2", async ({ page, browser, baseURL }) => {
  // GIVEN: The system pre-provisions archived repository `evo-archive-repository-s2` with existing file `README.md`, and Member account `evo-archive-viewer` with email `evo.archive.viewer@evolution.test` and password `Evo-Password-987!`.

  // WHEN: The Member signs in and opens the archived repository.
  await page.goto('/');
  await visible(named(page.getByRole('main'), 'link', 'Sign in')); await named(page.getByRole('main'), 'link', 'Sign in').click();
  await fill(page, 'Username or email', "evo-archive-viewer"); await fill(page, 'Password', "Evo-Password-987!");
  await button(page, 'Sign in');
  await openEvolutionRepository(page, "evo-archive-repository-s2");
  // THEN: The repository remains readable and displays “Archived”, while file-edit, issue-create, and pull-request-create controls are not actionable.
  await text(page, 'Archived'); await visible(named(page, 'link', 'README.md'));
  await unavailable(named(page, 'button', 'Add file'));
  await clickEvolutionTarget(page, 'README.md'); await unavailable(named(page, 'button', 'Edit file').or(named(page, 'link', 'Edit file')));
  await clickEvolutionTarget(page, 'Issues'); await unavailable(named(page, 'link', 'New issue').or(named(page, 'button', 'New issue')));
  await clickEvolutionTarget(page, 'Pull requests'); await unavailable(named(page, 'link', 'New pull request').or(named(page, 'button', 'New pull request')));
});
