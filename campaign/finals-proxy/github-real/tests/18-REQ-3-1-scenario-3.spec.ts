import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-3-1: Search for and Locate Repositories - Evolution Scenario 3", async ({ page, browser, baseURL }) => {
  // GIVEN: The visitor starts at the application home page in a fresh unauthenticated browser session. The system pre-provisions the evolution search repositories and none contains the query `evo-search-empty-s3`; the visitor is not authenticated.
  await page.goto('/');
  // WHEN: The visitor fills the top searchbox named “Search” with `evo-search-empty-s3` and presses Enter.
  await visible(named(page, 'searchbox', 'Search')); await named(page, 'searchbox', 'Search').fill("evo-search-empty-s3"); await named(page, 'searchbox', 'Search').press('Enter');
  // THEN: The page displays a no-results message such as “No results” or “No repositories”.
  await visible(page.getByText('No results', {exact:true}).or(page.getByText('No repositories', {exact:true})));
});
