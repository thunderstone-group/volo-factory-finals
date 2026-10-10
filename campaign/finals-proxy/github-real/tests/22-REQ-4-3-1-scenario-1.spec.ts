import { test, expect } from '@playwright/test';
import { openEvolutionRepository } from './evolution-navigation';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-4-3-1: List and Switch Repository Branches - Evolution Scenario 1", async ({ page, browser, baseURL }) => {
  // GIVEN: The visitor starts at the application home page in a fresh unauthenticated browser session. The system pre-provisions public repository `evo-branch-switch-s1` with active branch `evo-main-s1`, target branch `evo-feature-s1`, and file `evo-target-s1.md` available only on the target branch; the visitor can open the repository without signing in.
  await page.goto('/');
  // WHEN: The visitor opens the branch selector, enters `evo-feature-s1` in the `Find branch` textbox, and clicks the exact `evo-feature-s1` option.
  await openEvolutionRepository(page, "evo-branch-switch-s1");
  const initialAddress = page.url(); await button(page, 'Branch evo-main-s1'); await fill(page, 'Find branch', 'evo-feature-s1');
  await visible(named(page, "option", "evo-feature-s1")); await named(page, "option", "evo-feature-s1").click();
  // THEN: The branch selector displays `evo-feature-s1`, the page exposes the exact `evo-target-s1.md` file link, and the page address identifies `evo-feature-s1`.
  await visible(named(page, 'button', 'Branch evo-feature-s1')); await visible(named(page, 'link', 'evo-target-s1.md')); expect(decodeURIComponent(page.url())).toContain('evo-feature-s1');
});
