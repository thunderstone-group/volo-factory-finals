import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test("EV-2.6: Read an archived repository as a visitor", async ({ page }) => {
  // GIVEN: The user opens the application home entry in a fresh browser context, signed out.
  await page.goto('/');
  // GIVEN: The public repository "evolution-EV-2.6" is owned by repo-admin. The original account repo-admin has Admin permission; issue-editor, issue-commenter, file-contributor and pr-contributor have Write permission; issue-viewer and pr-viewer have Read permission; pr-author may manage its own PRs and pr-reviewer may review non-authored PRs. main is the default branch. All records in this scenario belong only to this repository. The repository is archived with Open issue "Read only EV-2.6", description "Historical discussion.".
  // WHEN: The user enters "evolution-EV-2.6" in the "Search" field in the current page.
  await fill(page, "Search", "evolution-EV-2.6");
  // WHEN: The user presses "Enter" in the "Search" field in the current page.
  await visible(field(page, "Search")); await field(page, "Search").press("Enter");
  // WHEN: The user activates "evolution-EV-2.6" in the current page.
  await activate(page, "evolution-EV-2.6");
  // THEN: The heading named "repo-admin/evolution-EV-2.6" is visible exactly once in the current page.
  await visible(named(page, "heading", "repo-admin/evolution-EV-2.6"));
  // THEN: The exact text "Archived" is visible exactly once in the region named "Repository status".
  await text(named(page, "region", "Repository status"), "Archived");
  // WHEN: The user activates "Issues" in the current page.
  await activate(page, "Issues");
  // WHEN: The user activates "Read only EV-2.6" in the current page.
  await activate(page, "Read only EV-2.6");
  // THEN: The heading named "Read only EV-2.6" is visible exactly once in the current page.
  await visible(named(page, "heading", "Read only EV-2.6"));
  // THEN: The exact text "Historical discussion." is visible exactly once in the region named "Issue".
  await text(named(page, "region", "Issue"), "Historical discussion.");
  // THEN: The button named "Close issue" is absent in the region named "Issue".
  await expect(named(named(page, "region", "Issue"), "button", "Close issue")).toHaveCount(0);
  // WHEN: The user reloads the current page.
  await page.reload();
  // THEN: The exact text "Historical discussion." is visible exactly once in the region named "Issue".
  await text(named(page, "region", "Issue"), "Historical discussion.");
});
