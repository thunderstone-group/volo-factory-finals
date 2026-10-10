import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-3-1: Search for and Locate Repositories - Evolution Scenario 2", async ({ page, browser, baseURL }) => {
  // GIVEN: The visitor starts at the application home page in a fresh unauthenticated browser session. The system pre-provisions public repository `evo-search-notebook-s2` with description containing `evolution-notebook`; the visitor is not authenticated.
  await page.goto('/');
  // WHEN: The visitor fills the top searchbox named “Search” with `evolution-notebook` and presses Enter.
  await visible(named(page, 'searchbox', 'Search')); await named(page, 'searchbox', 'Search').fill("evolution-notebook"); await named(page, 'searchbox', 'Search').press('Enter');
  // THEN: The search results contain the exact link named `evo-search-notebook-s2`.
  await visible(named(page, 'link', 'evo-search-notebook-s2'));
});
