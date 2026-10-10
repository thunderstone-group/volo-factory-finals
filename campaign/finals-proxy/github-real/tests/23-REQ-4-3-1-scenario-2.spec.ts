import { test, expect } from '@playwright/test';
import { openEvolutionRepository } from './evolution-navigation';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-4-3-1: List and Switch Repository Branches - Evolution Scenario 2", async ({ page, browser, baseURL }) => {
  // GIVEN: The system pre-provisions public repository `evo-branch-switch-s2` with active branch `evo-main-s2` and an available `evo-feature-s2` branch. The visitor starts at the application home page in a fresh unauthenticated browser session and can open the repository without signing in.
  await page.goto('/');
  // WHEN: The visitor opens the branch selector, enters `evo-missing-s2` in the `Find branch` textbox, observes the no-matching-branch state, and presses Escape.
  await openEvolutionRepository(page, "evo-branch-switch-s2");
  const initialAddress = page.url(); await button(page, 'Branch evo-main-s2'); await fill(page, 'Find branch', 'evo-missing-s2');
  await text(page, 'No matching branch'); await field(page, 'Find branch').press('Escape');
  // THEN: The selector remains on `evo-main-s2`; after reload, the active branch button still displays `evo-main-s2`, and the address still identifies `evo-main-s2`.
  await visible(named(page, 'button', 'Branch evo-main-s2')); expect(page.url()).toBe(initialAddress); await page.reload(); await visible(named(page, 'button', 'Branch evo-main-s2')); expect(decodeURIComponent(page.url())).toContain('evo-main-s2');
});
