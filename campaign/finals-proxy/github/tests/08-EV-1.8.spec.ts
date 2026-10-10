import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test("EV-1.8: Switch the pull request diff layout", async ({ page }) => {
  // GIVEN: The user opens the application home entry in a fresh browser context, signed out.
  await page.goto('/');
  // GIVEN: The public repository "evolution-EV-1.8" is owned by repo-admin. The original account repo-admin has Admin permission; issue-editor, issue-commenter, file-contributor and pr-contributor have Write permission; issue-viewer and pr-viewer have Read permission; pr-author may manage its own PRs and pr-reviewer may review non-authored PRs. main is the default branch. All records in this scenario belong only to this repository. "Layout EV-1.8" is Open, with one changed file src/message.txt replacing "hello before" with "hello after".
  // WHEN: The user enters "evolution-EV-1.8" in the "Search" field in the current page.
  await fill(page, "Search", "evolution-EV-1.8");
  // WHEN: The user presses "Enter" in the "Search" field in the current page.
  await visible(field(page, "Search")); await field(page, "Search").press("Enter");
  // WHEN: The user activates "evolution-EV-1.8" in the current page.
  await activate(page, "evolution-EV-1.8");
  // THEN: The heading named "repo-admin/evolution-EV-1.8" is visible exactly once in the current page.
  await visible(named(page, "heading", "repo-admin/evolution-EV-1.8"));
  // WHEN: The user activates "Pull requests" in the current page.
  await activate(page, "Pull requests");
  // WHEN: The user activates "Layout EV-1.8" in the current page.
  await activate(page, "Layout EV-1.8");
  // THEN: The heading named "Layout EV-1.8" is visible exactly once in the current page.
  await visible(named(page, "heading", "Layout EV-1.8"));
  // WHEN: The user activates "Files changed" in the current page.
  await activate(page, "Files changed");
  // WHEN: The user selects "Split" in the "Diff layout" combobox in the current page.
  await choose(page, "Diff layout", "Split");
  // THEN: The exact text "hello before" is visible exactly once in the region named "Before".
  await text(named(page, "region", "Before"), "hello before");
  // THEN: The exact text "hello after" is visible exactly once in the region named "After".
  await text(named(page, "region", "After"), "hello after");
  // WHEN: The user reloads the current page.
  await page.reload();
  // THEN: The "Diff layout" combobox in the current page has selected option "Split".
  await selected(page, "Diff layout", "Split");
  // WHEN: The user selects "Unified" in the "Diff layout" combobox in the current page.
  await choose(page, "Diff layout", "Unified");
  // THEN: The exact text "-hello before" is visible exactly once in the region named "Unified diff".
  await text(named(page, "region", "Unified diff"), "-hello before");
  // THEN: The exact text "+hello after" is visible exactly once in the region named "Unified diff".
  await text(named(page, "region", "Unified diff"), "+hello after");
});
