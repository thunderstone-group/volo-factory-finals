const {test, expect} = require('@playwright/test');

test("REQ-1-1-3#entry-1: Initial visible entry Sign in", async ({page}) => {
  await page.goto('/');
  const name = "Sign in";
  await expect.poll(async () => {
    for (const role of ['button','link','tab','menuitem','option']) {
      for (const item of await page.getByRole(role, {name, exact: true}).all()) {
        if (await item.isVisible()) return true;
      }
    }
    for (const item of await page.getByText(name, {exact: true}).all()) {
      if (await item.isVisible() && await item.evaluate(el => !!el.closest(
        'a[href],button,[role=button],[role=link],[role=tab],[role=menuitem],[data-action]:not(form),[onclick]'
      ))) return true;
    }
    return false;
  }, {message: 'The first WHEN target must be interactive at the stated initial home: ' + name}).toBe(true);
});

test("REQ-3-3#entry-1: Initial visible entry acme-docs", async ({page}) => {
  await page.goto('/');
  const name = "acme-docs";
  await expect.poll(async () => {
    for (const role of ['button','link','tab','menuitem','option']) {
      for (const item of await page.getByRole(role, {name, exact: true}).all()) {
        if (await item.isVisible()) return true;
      }
    }
    for (const item of await page.getByText(name, {exact: true}).all()) {
      if (await item.isVisible() && await item.evaluate(el => !!el.closest(
        'a[href],button,[role=button],[role=link],[role=tab],[role=menuitem],[data-action]:not(form),[onclick]'
      ))) return true;
    }
    return false;
  }, {message: 'The first WHEN target must be interactive at the stated initial home: ' + name}).toBe(true);
});

test("REQ-4-2-1#entry-1: Initial visible entry acme-docs", async ({page}) => {
  await page.goto('/');
  const name = "acme-docs";
  await expect.poll(async () => {
    for (const role of ['button','link','tab','menuitem','option']) {
      for (const item of await page.getByRole(role, {name, exact: true}).all()) {
        if (await item.isVisible()) return true;
      }
    }
    for (const item of await page.getByText(name, {exact: true}).all()) {
      if (await item.isVisible() && await item.evaluate(el => !!el.closest(
        'a[href],button,[role=button],[role=link],[role=tab],[role=menuitem],[data-action]:not(form),[onclick]'
      ))) return true;
    }
    return false;
  }, {message: 'The first WHEN target must be interactive at the stated initial home: ' + name}).toBe(true);
});

test("REQ-5-1-1#entry-1: Initial visible entry Issues", async ({page}) => {
  await page.goto('/');
  const name = "Issues";
  await expect.poll(async () => {
    for (const role of ['button','link','tab','menuitem','option']) {
      for (const item of await page.getByRole(role, {name, exact: true}).all()) {
        if (await item.isVisible()) return true;
      }
    }
    for (const item of await page.getByText(name, {exact: true}).all()) {
      if (await item.isVisible() && await item.evaluate(el => !!el.closest(
        'a[href],button,[role=button],[role=link],[role=tab],[role=menuitem],[data-action]:not(form),[onclick]'
      ))) return true;
    }
    return false;
  }, {message: 'The first WHEN target must be interactive at the stated initial home: ' + name}).toBe(true);
});

test("REQ-5-1-1#entry-2: Initial visible entry Issues", async ({page}) => {
  await page.goto('/');
  const name = "Issues";
  await expect.poll(async () => {
    for (const role of ['button','link','tab','menuitem','option']) {
      for (const item of await page.getByRole(role, {name, exact: true}).all()) {
        if (await item.isVisible()) return true;
      }
    }
    for (const item of await page.getByText(name, {exact: true}).all()) {
      if (await item.isVisible() && await item.evaluate(el => !!el.closest(
        'a[href],button,[role=button],[role=link],[role=tab],[role=menuitem],[data-action]:not(form),[onclick]'
      ))) return true;
    }
    return false;
  }, {message: 'The first WHEN target must be interactive at the stated initial home: ' + name}).toBe(true);
});

test("REQ-5-1-2#entry-1: Initial visible entry Improve onboarding", async ({page}) => {
  await page.goto('/');
  const name = "Improve onboarding";
  await expect.poll(async () => {
    for (const role of ['button','link','tab','menuitem','option']) {
      for (const item of await page.getByRole(role, {name, exact: true}).all()) {
        if (await item.isVisible()) return true;
      }
    }
    for (const item of await page.getByText(name, {exact: true}).all()) {
      if (await item.isVisible() && await item.evaluate(el => !!el.closest(
        'a[href],button,[role=button],[role=link],[role=tab],[role=menuitem],[data-action]:not(form),[onclick]'
      ))) return true;
    }
    return false;
  }, {message: 'The first WHEN target must be interactive at the stated initial home: ' + name}).toBe(true);
});

test("REQ-5-1-2#entry-2: Initial visible entry Improve onboarding", async ({page}) => {
  await page.goto('/');
  const name = "Improve onboarding";
  await expect.poll(async () => {
    for (const role of ['button','link','tab','menuitem','option']) {
      for (const item of await page.getByRole(role, {name, exact: true}).all()) {
        if (await item.isVisible()) return true;
      }
    }
    for (const item of await page.getByText(name, {exact: true}).all()) {
      if (await item.isVisible() && await item.evaluate(el => !!el.closest(
        'a[href],button,[role=button],[role=link],[role=tab],[role=menuitem],[data-action]:not(form),[onclick]'
      ))) return true;
    }
    return false;
  }, {message: 'The first WHEN target must be interactive at the stated initial home: ' + name}).toBe(true);
});

test("REQ-5-1-2#entry-3: Initial visible entry Improve onboarding", async ({page}) => {
  await page.goto('/');
  const name = "Improve onboarding";
  await expect.poll(async () => {
    for (const role of ['button','link','tab','menuitem','option']) {
      for (const item of await page.getByRole(role, {name, exact: true}).all()) {
        if (await item.isVisible()) return true;
      }
    }
    for (const item of await page.getByText(name, {exact: true}).all()) {
      if (await item.isVisible() && await item.evaluate(el => !!el.closest(
        'a[href],button,[role=button],[role=link],[role=tab],[role=menuitem],[data-action]:not(form),[onclick]'
      ))) return true;
    }
    return false;
  }, {message: 'The first WHEN target must be interactive at the stated initial home: ' + name}).toBe(true);
});

test("REQ-6-2-1#entry-1: Initial visible entry Pull requests", async ({page}) => {
  await page.goto('/');
  const name = "Pull requests";
  await expect.poll(async () => {
    for (const role of ['button','link','tab','menuitem','option']) {
      for (const item of await page.getByRole(role, {name, exact: true}).all()) {
        if (await item.isVisible()) return true;
      }
    }
    for (const item of await page.getByText(name, {exact: true}).all()) {
      if (await item.isVisible() && await item.evaluate(el => !!el.closest(
        'a[href],button,[role=button],[role=link],[role=tab],[role=menuitem],[data-action]:not(form),[onclick]'
      ))) return true;
    }
    return false;
  }, {message: 'The first WHEN target must be interactive at the stated initial home: ' + name}).toBe(true);
});

test("REQ-6-2-1#entry-2: Initial visible entry Pull requests", async ({page}) => {
  await page.goto('/');
  const name = "Pull requests";
  await expect.poll(async () => {
    for (const role of ['button','link','tab','menuitem','option']) {
      for (const item of await page.getByRole(role, {name, exact: true}).all()) {
        if (await item.isVisible()) return true;
      }
    }
    for (const item of await page.getByText(name, {exact: true}).all()) {
      if (await item.isVisible() && await item.evaluate(el => !!el.closest(
        'a[href],button,[role=button],[role=link],[role=tab],[role=menuitem],[data-action]:not(form),[onclick]'
      ))) return true;
    }
    return false;
  }, {message: 'The first WHEN target must be interactive at the stated initial home: ' + name}).toBe(true);
});

test("REQ-6-3-1#entry-1: Initial visible entry Overview onboarding PR", async ({page}) => {
  await page.goto('/');
  const name = "Overview onboarding PR";
  await expect.poll(async () => {
    for (const role of ['button','link','tab','menuitem','option']) {
      for (const item of await page.getByRole(role, {name, exact: true}).all()) {
        if (await item.isVisible()) return true;
      }
    }
    for (const item of await page.getByText(name, {exact: true}).all()) {
      if (await item.isVisible() && await item.evaluate(el => !!el.closest(
        'a[href],button,[role=button],[role=link],[role=tab],[role=menuitem],[data-action]:not(form),[onclick]'
      ))) return true;
    }
    return false;
  }, {message: 'The first WHEN target must be interactive at the stated initial home: ' + name}).toBe(true);
});
