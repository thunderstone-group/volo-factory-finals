'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const result = { browser: browser.version(), purpose: 'Native customizable select interaction contract, outside candidate code' };
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(2500);
    await page.setContent(`<!doctype html>
      <style>select, select::picker(select) { appearance: base-select; } select:not(:open) option { display: none; }</style>
      <form>
        <label>Rows<select name="rows"><option value="a">Alpha</option><option value="b">Beta</option></select></label>
        <label>Columns<select name="cols"><option value="a">Alpha</option><option value="b">Beta</option></select></label>
      </form>`);
    result.css_supported = await page.evaluate(() => CSS.supports('appearance', 'base-select'));
    result.closed_options = await page.getByRole('option').count();
    const rows = page.getByRole('combobox', { name: 'Rows', exact: true });
    const cols = page.getByRole('combobox', { name: 'Columns', exact: true });
    await rows.click();
    result.open_options = await page.getByRole('option').count();
    await page.getByRole('option', { name: 'Beta', exact: true }).click();
    assert.equal(await rows.inputValue(), 'b');
    result.click_option = true;
    await cols.selectOption({ label: 'Beta' });
    assert.equal(await cols.inputValue(), 'b');
    result.select_option = true;
    await rows.click();
    await page.keyboard.press('Escape');
    result.escape_closes = !(await rows.evaluate(e => e.matches(':open')));
    await page.screenshot({path: process.argv[3]});
    result.form = await page.evaluate(() => Object.fromEntries(new FormData(document.querySelector('form'))));
    assert.deepEqual(result.form, { rows: 'b', cols: 'b' });
  } catch (error) {
    result.error = String(error.message).slice(0, 1600);
    process.exitCode = 1;
  } finally {
    await browser.close();
    fs.writeFileSync(process.argv[2], JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  }
})();
