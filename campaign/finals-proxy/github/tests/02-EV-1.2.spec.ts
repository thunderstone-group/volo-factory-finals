import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test("EV-1.2: Sort the filtered issue list", async ({ page }) => {
  // GIVEN: The user opens the application home entry in a fresh browser context, signed out.
  await page.goto('/');
  // GIVEN: The public repository "evolution-EV-1.2" is owned by repo-admin. The original account repo-admin has Admin permission; issue-editor, issue-commenter, file-contributor and pr-contributor have Write permission; issue-viewer and pr-viewer have Read permission; pr-author may manage its own PRs and pr-reviewer may review non-authored PRs. main is the default branch. All records in this scenario belong only to this repository. Open issues "First EV-1.2", "Second EV-1.2", "Third EV-1.2" were created on 2030-01-01, 2030-01-02 and 2030-01-03 respectively, with no other issues.
  // WHEN: The user enters "evolution-EV-1.2" in the "Search" field in the current page.
  await fill(page, "Search", "evolution-EV-1.2");
  // WHEN: The user presses "Enter" in the "Search" field in the current page.
  await visible(field(page, "Search")); await field(page, "Search").press("Enter");
  // WHEN: The user activates "evolution-EV-1.2" in the current page.
  await activate(page, "evolution-EV-1.2");
  // THEN: The heading named "repo-admin/evolution-EV-1.2" is visible exactly once in the current page.
  await visible(named(page, "heading", "repo-admin/evolution-EV-1.2"));
  // WHEN: The user activates "Issues" in the current page.
  await activate(page, "Issues");
  // WHEN: The user selects "Oldest" in the "Issue sort" combobox in the region named "Issues".
  await choose(named(page, "region", "Issues"), "Issue sort", "Oldest");
  // THEN: The "Issue titles" list in the region named "Issues" contains exactly these entries in order: ["First EV-1.2", "Second EV-1.2", "Third EV-1.2"].
  await order(named(page, "region", "Issues"), "Issue titles", ["First EV-1.2", "Second EV-1.2", "Third EV-1.2"]);
  // WHEN: The user reloads the current page.
  await page.reload();
  // THEN: The "Issue sort" combobox in the region named "Issues" has selected option "Oldest".
  await selected(named(page, "region", "Issues"), "Issue sort", "Oldest");
  // WHEN: The user selects "Newest" in the "Issue sort" combobox in the region named "Issues".
  await choose(named(page, "region", "Issues"), "Issue sort", "Newest");
  // THEN: The "Issue titles" list in the region named "Issues" contains exactly these entries in order: ["Third EV-1.2", "Second EV-1.2", "First EV-1.2"].
  await order(named(page, "region", "Issues"), "Issue titles", ["Third EV-1.2", "Second EV-1.2", "First EV-1.2"]);
});
