import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-3-1: Search for and Locate Repositories - Evolution Scenario 1", async ({ page, browser, baseURL }) => {
  // GIVEN: The visitor starts at the application home page in a fresh unauthenticated browser session. The system pre-provisions public repository `evo-search-catalog-s1` and public repository `evo-search-notebook-s2`; their descriptions are searchable and the visitor is not authenticated.
  await page.goto('/');
  // WHEN: The visitor fills the top searchbox named “Search” with `EVO-SEARCH-CATALOG-S1` and presses Enter, then clicks the exact result link named `evo-search-catalog-s1`.
  await visible(named(page, 'searchbox', 'Search')); await named(page, 'searchbox', 'Search').fill("EVO-SEARCH-CATALOG-S1"); await named(page, 'searchbox', 'Search').press('Enter');
  await visible(named(page, "link", "evo-search-catalog-s1")); await named(page, "link", "evo-search-catalog-s1").click();
  // THEN: The repository overview displays a visible heading containing `evo-search-catalog-s1`.
  await visible(page.getByRole('heading').filter({hasText:'evo-search-catalog-s1'}));
});
