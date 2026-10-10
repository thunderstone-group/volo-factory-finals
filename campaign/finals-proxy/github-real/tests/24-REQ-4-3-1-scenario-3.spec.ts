import { test, expect } from '@playwright/test';
import { openEvolutionRepository } from './evolution-navigation';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-4-3-1: List and Switch Repository Branches - Evolution Scenario 3", async ({ page, browser, baseURL }) => {
  // GIVEN: The system pre-provisions public repository `evo-branch-switch-s3` with active branch `evo-main-s3`, target branch `evo-feature-s3`, and target-only file `evo-target-s3.md`. The visitor can open the repository without signing in.
  await page.goto('/');
  // WHEN: The visitor switches to `evo-feature-s3` through the “Find branch” textbox, then reloads the repository page.
  await openEvolutionRepository(page, "evo-branch-switch-s3");
  const initialAddress = page.url(); await button(page, 'Branch evo-main-s3'); await fill(page, 'Find branch', 'evo-feature-s3');
  await visible(named(page, "option", "evo-feature-s3")); await named(page, "option", "evo-feature-s3").click();
  await page.reload();
  // THEN: The Branch button, page address, and visible file list all remain on `evo-feature-s3` after reload.
  await visible(named(page, 'button', 'Branch evo-feature-s3')); await visible(named(page, 'link', 'evo-target-s3.md')); expect(decodeURIComponent(page.url())).toContain('evo-feature-s3');
});
