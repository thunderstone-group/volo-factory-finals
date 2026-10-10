import { expect, type Locator, type Page } from '@playwright/test';
import { named, visible } from './helpers';

// Visible official support/evolution-e2e.ts:105-110 (github-real-F04).
export async function openEvolutionRepository(page: Page, name: string) {
  if (await page.getByRole('banner').count() === 0) await page.goto('/');
  const search = page.getByRole('banner').getByRole('searchbox', { name: 'Search', exact: true });
  await visible(search); await search.fill(name); await search.press('Enter');
  const result = page.getByRole('main').getByRole('link', { name, exact: true });
  await visible(result); await result.click();
}

// F06 exposes the poll and its strict per-candidate isVisible call. The candidate
// array itself is not visible; retain v2's link/button roles in that order.
export async function clickEvolutionTarget(page: Page, name: string) {
  const candidates = [
    page.getByRole('link', {name, exact:true}),
    page.getByRole('button', {name, exact:true}),
  ];
  let selected: Locator | null = null;
  await expect.poll(async () => {
    for (const candidate of candidates) {
      if ((await candidate.count()) > 0 && (await candidate.isVisible())) { selected = candidate; return true; }
    }
    return false;
  }).toBe(true);
  await selected!.click();
}
