import { test, expect } from '@playwright/test';
import { clickEvolutionTarget } from './evolution-navigation';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-2-1-2: Create an Organization After Authentication - Evolution Scenario 2", async ({ page, browser, baseURL }) => {
  // GIVEN: The visitor starts at the application home page in a fresh unauthenticated browser session. The system pre-provisions the verified account `evo-org-owner` with email `evo.org.owner@evolution.test` and password `Evo-Password-987!`; the account can create organizations. Organization identifier `evo-lab-02` already exists with display name `Evo Lab Two`.

  // WHEN: The visitor signs in as `evo-org-owner`, opens the “Account menu”, clicks “Your organizations”, clicks “New organization”, enters the existing identifier `EVO-LAB-02` in the visibly labeled “Organization name” field, enters `Evo Lab Duplicate` in the “Display name” field, and clicks “Create organization”.
  await page.goto('/');
  await visible(named(page.getByRole('main'), 'link', 'Sign in')); await named(page.getByRole('main'), 'link', 'Sign in').click();
  await fill(page, 'Username or email', "evo-org-owner"); await fill(page, 'Password', "Evo-Password-987!");
  await button(page, 'Sign in');
  await button(page, 'Account menu'); await page.getByRole('menu').getByRole('link', {name:'Your organizations',exact:true}).click(); await clickEvolutionTarget(page, 'New organization');
  await fill(page, 'Organization name', "EVO-LAB-02"); await fill(page, 'Display name', "Evo Lab Duplicate"); await button(page, 'Create organization');
  // THEN: The page displays the exact message “Organization name already exists” and does not display an organization heading for the attempted existing organization creation.
  await text(page, 'Organization name already exists'); await expect(page.getByRole('heading').filter({hasText:/evo-lab-02/i})).toHaveCount(0); await visible(field(page, 'Organization name'));
});
