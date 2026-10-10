import { expect, type Locator, type Page } from '@playwright/test';
import { named, visible } from './helpers';
export async function command(page: Page, name: string) {
  const control=named(page,'menuitem',name).or(named(page,'button',name)).or(named(page,'link',name));
  await visible(control); await expect(control).toBeEnabled(); await control.click();
}
export async function unavailable(control: Locator) {
  expect(await control.count()).toBeLessThanOrEqual(1);
  await expect.poll(async () => !await control.isVisible() || !await control.isEnabled()).toBe(true);
}
export async function rectangle(page: Page, first: string, last: string) {
  const a=named(page,'gridcell',first), b=named(page,'gridcell',last);
  await visible(a); await visible(b); await a.click(); await b.click({modifiers:['Shift']});
}
export async function dismissDialogs(page: Page) {
  // Native keyboard dismissal avoids prescribing an unpublished close-button label.
  for(let i=0;i<3 && await page.getByRole('dialog').count();i++) await page.keyboard.press('Escape');
}
export async function savedView(page: Page, name: string) {
  const control=named(page,'button',name).or(named(page,'option',name)); await visible(control); await control.click();
}
export async function reactionCount(page: Page) {
  const count=page.getByText(/^\+1\s+\d+$/);
  expect(await count.count()).toBeLessThanOrEqual(1);
  if (!await count.count()) return 0;
  await visible(count); return Number((await count.innerText()).trim().match(/(\d+)$/)![1]);
}
export async function issueContent(page: Page) {
  const main=page.getByRole('main'); await visible(main);
  return (await main.innerText()).replace(/Add reaction|Remove \+1 reaction|\+1\s+\d+/g,'').replace(/\s+/g,' ').trim();
}
export async function openPublicIssue(page: Page, title: string) {
  // These two published seeds omit their repository name. Discover real links,
  // never guess a route, read storage, or send a private request.
  await page.goto('/');
  const direct=named(page,'link',title);
  if(await direct.count()) { await visible(direct); await direct.click(); await visible(page.getByRole('heading').filter({hasText:title})); return; }
  const search=named(page,'searchbox','Search'); await visible(search);
  await search.fill(''); await search.press('Enter');
  const main=page.getByRole('main'); await visible(main);
  const links=await main.getByRole('link').evaluateAll(elements => elements.map(e=>({name:(e.getAttribute('aria-label') || e.textContent || '').trim(),href:(e as HTMLAnchorElement).href})).filter(e=>e.name));
  for(const link of links) {
    await page.goto(link.href);
    const issues=named(page,'link','Issues').or(named(page,'button','Issues'));
    if(await issues.count()!==1) continue;
    await issues.click();
    const issue=named(page,'link',title);
    if(await issue.count()) { await visible(issue); await issue.click(); await visible(page.getByRole('heading').filter({hasText:title})); return; }
  }
  throw new Error('No public UI link found for the pre-provisioned issue '+title);
}
