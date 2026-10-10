const { expect } = require('@playwright/test');
const named = (scope, role, name) => scope.getByRole(role, { name, exact: true });
const field = (scope, name) => scope.getByLabel(name, { exact: true });
async function visible(locator) { await expect(locator).toHaveCount(1); await expect(locator).toBeVisible(); }
async function activate(scope, name) {
  const control = named(scope, 'link', name).or(named(scope, 'button', name));
  await visible(control); await expect(control).toBeEnabled(); await control.click();
}
async function button(scope, name) { const control = named(scope, 'button', name); await visible(control); await expect(control).toBeEnabled(); await control.click(); }
async function fill(scope, name, value) { const input = field(scope, name); await visible(input); await input.fill(value); }
async function choose(scope, name, option) {
  const control = named(scope, 'combobox', name); await visible(control);
  const native = await control.evaluate(element => element.tagName === 'SELECT');
  if (native) await control.selectOption({ label: option });
  else { await control.click(); const item = named(scope, 'option', option); await visible(item); await item.click(); }
}
async function selected(scope, name, option) {
  const control = named(scope, 'combobox', name); await visible(control);
  const native = await control.evaluate(element => element.tagName === 'SELECT');
  if (native) await expect(control.locator('option:checked')).toHaveText(option);
  else await expect(control).toHaveText(option);
}
async function checked(scope, name, value) { const control = named(scope, 'checkbox', name); await visible(control); await control.setChecked(value); }
async function text(scope, value) { await visible(scope.getByText(value, { exact: true })); }
async function order(scope, listName, values) { const list = named(scope, 'list', listName); await visible(list); await expect(list.getByRole('listitem')).toHaveText(values); }
module.exports = { named, field, visible, activate, button, fill, choose, selected, checked, text, order };
