const { test } = require('./browser.cjs');
test('debug page', async (page, assert) => {
  await page.getByText('Sprint goals').first().waitFor({ timeout: 10000 });
  const html = await page.locator('#app').innerHTML();
  const i = html.indexOf('<header');
  console.log('HEADER_BEGIN\n' + html.slice(i, i + 1200) + '\nHEADER_END');
  const searchbox = await page.getByRole('searchbox').count();
  const search = await page.getByRole('search').count();
  const ph = await page.getByPlaceholder('Search').count();
  const aria = await page.locator('input[aria-label="Search"]').count();
  console.log('roles searchbox=', searchbox, 'search=', search, 'placeholder=', ph, 'aria=', aria);
  assert.ok(true);
});
