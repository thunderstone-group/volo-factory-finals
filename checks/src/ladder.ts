// Copied verbatim from Keep tests/helpers.ts; compiler never imports this module.
// Bookstack differences: firstVisible has no count fallback; click has five rungs
// (button, link, tab, menuitem, text); text assertions prefer heading; fillField
// takes one string and has no unnamed textbox/textarea fallback. This runner uses
// the requested Keep ladder for both apps; calibration reports that limitation.
import { expect, type Locator, type Page } from '@playwright/test';
type Scope = Page | Locator;
type Match = string | RegExp | Array<string | RegExp>;
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toPatterns(value: Match): RegExp[] {
  const items = Array.isArray(value) ? value : [value];
  return items.map((item) => item instanceof RegExp ? item : new RegExp(escapeRegExp(item).replace(/\s+/g, '\\s+'), 'i'));
}

function target(scope: Scope): any {
  return scope as any;
}

async function firstVisible(locators: Locator[]): Promise<Locator> {
  for (const locator of locators) {
    const candidate = locator.first();
    try {
      if (await candidate.isVisible({ timeout: 500 })) return candidate;
    } catch {
      // continue
    }
  }
  for (const locator of locators) {
    const candidate = locator.first();
    try {
      if (await candidate.count()) return candidate;
    } catch {
      // continue
    }
  }
  return locators[0].first();
}

function namedLocators(scope: Scope, pattern: RegExp): Locator[] {
  const t = target(scope);
  return [
    t.getByRole('button', { name: pattern }),
    t.getByRole('link', { name: pattern }),
    t.getByRole('menuitem', { name: pattern }),
    t.getByRole('tab', { name: pattern }),
    t.getByRole('checkbox', { name: pattern }),
    t.getByRole('heading', { name: pattern }),
    t.getByRole('option', { name: pattern }),
    t.getByLabel(pattern),
    t.getByPlaceholder(pattern),
    t.getByText(pattern),
  ];
}

async function resolveNamed(scope: Scope, value: Match): Promise<Locator> {
  const patterns = toPatterns(value);
  for (const pattern of patterns) {
    const locator = await firstVisible(namedLocators(scope, pattern));
    try {
      if (await locator.isVisible({ timeout: 200 })) return locator;
    } catch {
      // continue
    }
  }
  return firstVisible(namedLocators(scope, patterns[0]));
}

export async function fillField(scope: Scope, labelOrPlaceholder: Match, value: string): Promise<void> {
  const patterns = toPatterns(labelOrPlaceholder);
  for (const pattern of patterns) {
    const locator = await firstVisible([
      target(scope).getByLabel(pattern),
      target(scope).getByPlaceholder(pattern),
      target(scope).getByRole('textbox', { name: pattern }),
      target(scope).getByRole('searchbox', { name: pattern }),
    ]);
    try {
      if (await locator.isVisible({ timeout: 200 })) {
        await locator.fill(value);
        return;
      }
    } catch {
      // continue
    }
  }
  const fallback = await firstVisible([
    target(scope).getByRole('textbox'),
    target(scope).locator('textarea'),
  ]);
  await fallback.fill(value);
}

export { firstVisible, namedLocators, resolveNamed, toPatterns };

// Same Keep helper as upstream; no added waits or text-only shortcut.
export async function hoverNamed(scope: Scope, value: Match): Promise<void> {
  const locator = await resolveNamed(scope, value);
  await locator.hover();
}
