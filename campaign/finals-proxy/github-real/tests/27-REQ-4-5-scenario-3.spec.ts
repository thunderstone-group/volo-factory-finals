import { test, expect } from '@playwright/test';
import { openEvolutionRepository, clickEvolutionTarget } from './evolution-navigation';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-4-5: Create and View Repository Releases - Scenario 3", async ({ page, browser, baseURL }) => {
  // GIVEN: The system pre-provisions repository `evo-release-repository-s3`, an existing tag `evo-v0-1-s3`, and Owner account `evo-release-owner` with email `evo.release.owner@evolution.test` and password `Evo-Password-987!`.

  // WHEN: The Owner opens “New release”, enters the existing tag `evo-v0-1-s3`, a new title, and a description, then clicks “Publish release”.
  await page.goto('/');
  await visible(named(page.getByRole('main'), 'link', 'Sign in')); await named(page.getByRole('main'), 'link', 'Sign in').click();
  await fill(page, 'Username or email', "evo-release-owner"); await fill(page, 'Password', "Evo-Password-987!");
  await button(page, 'Sign in');
  await openEvolutionRepository(page, "evo-release-repository-s3");
  await clickEvolutionTarget(page, 'Releases'); await clickEvolutionTarget(page, 'New release'); await fill(page, 'Tag name', 'evo-v0-1-s3'); await fill(page, 'Release title', 'A second release'); await fill(page, 'Description', 'This duplicate must not be published.'); await button(page, 'Publish release');
  // THEN: The form displays “Tag already exists” and no duplicate release is created.
  await text(page, 'Tag already exists'); await expect(page.getByText('evo-v0-1-s3', {exact:true})).toHaveCount(1); await visible(field(page, 'Tag name')); await expect(field(page, 'Tag name')).toHaveValue('evo-v0-1-s3');
});
