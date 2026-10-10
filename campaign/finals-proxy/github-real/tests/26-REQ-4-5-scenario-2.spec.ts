import { test, expect } from '@playwright/test';
import { openEvolutionRepository, clickEvolutionTarget } from './evolution-navigation';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-4-5: Create and View Repository Releases - Scenario 2", async ({ page, browser, baseURL }) => {
  // GIVEN: The system pre-provisions public repository `evo-release-repository-s2` with published tag `evo-v0-1-s2` targeting branch `evo-main-s2`, title `Existing Evolution Release`, and its release description. The visitor is unauthenticated.
  await page.goto('/');
  // WHEN: The visitor opens “Releases” and opens the exact `evo-v0-1-s2` release.
  await openEvolutionRepository(page, "evo-release-repository-s2");
  await clickEvolutionTarget(page, 'Releases'); await clickEvolutionTarget(page, 'evo-v0-1-s2');
  // THEN: The release detail displays the exact tag, title, description, and target branch information.
  await expect(page.getByRole('heading', {name:'evo-v0-1-s2',exact:true})).toBeVisible();
  await expect(page.getByText('Existing Evolution Release', {exact:true})).toBeVisible();
  await expect(page.getByText('Evolution release', {exact:true})).toBeVisible();
  await expect(page.getByText(/target branch:\s*evo-main-s2/i)).toBeVisible();
  await unavailable(named(page, 'button', 'Publish release'));
});
