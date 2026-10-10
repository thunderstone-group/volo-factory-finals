import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test("EV-2.1: Star and unstar a repository", async ({ page }) => {
  // GIVEN: The user opens the application home entry in a fresh browser context, signed out.
  await page.goto('/');
  // GIVEN: The public repository "evolution-EV-2.1" is owned by repo-admin. The original account repo-admin has Admin permission; issue-editor, issue-commenter, file-contributor and pr-contributor have Write permission; issue-viewer and pr-viewer have Read permission; pr-author may manage its own PRs and pr-reviewer may review non-authored PRs. main is the default branch. All records in this scenario belong only to this repository. This repository has no stars.
  // GIVEN: The original verified account "repo-owner" has email "repo-owner@example.test" and password "Valid-password-123!". Its credentials are never changed by these scenarios.
  // WHEN: The user activates "Sign in" in the current page.
  await activate(page, "Sign in");
  // WHEN: The user enters "repo-owner" in the "Username or email" field in the current page.
  await fill(page, "Username or email", "repo-owner");
  // WHEN: The user enters "Valid-password-123!" in the "Password" field in the current page.
  await fill(page, "Password", "Valid-password-123!");
  // WHEN: The user clicks the button named "Sign in" in the current page.
  await button(page, "Sign in");
  // THEN: The button named "Account menu" is visible exactly once in the current page.
  await visible(named(page, "button", "Account menu"));
  // WHEN: The user enters "evolution-EV-2.1" in the "Search" field in the current page.
  await fill(page, "Search", "evolution-EV-2.1");
  // WHEN: The user presses "Enter" in the "Search" field in the current page.
  await visible(field(page, "Search")); await field(page, "Search").press("Enter");
  // WHEN: The user activates "evolution-EV-2.1" in the current page.
  await activate(page, "evolution-EV-2.1");
  // THEN: The heading named "repo-admin/evolution-EV-2.1" is visible exactly once in the current page.
  await visible(named(page, "heading", "repo-admin/evolution-EV-2.1"));
  // WHEN: The user clicks the button named "Star" in the current page.
  await button(page, "Star");
  // THEN: The exact text "1 star" is visible exactly once in the region named "Repository social".
  await text(named(page, "region", "Repository social"), "1 star");
  // WHEN: The user reloads the current page.
  await page.reload();
  // THEN: The button named "Unstar" is visible exactly once in the current page.
  await visible(named(page, "button", "Unstar"));
  // WHEN: The user clicks the button named "Unstar" in the current page.
  await button(page, "Unstar");
  // WHEN: The user reloads the current page.
  await page.reload();
  // THEN: The exact text "0 stars" is visible exactly once in the region named "Repository social".
  await text(named(page, "region", "Repository social"), "0 stars");
  // THEN: The button named "Star" is visible exactly once in the current page.
  await visible(named(page, "button", "Star"));
});
