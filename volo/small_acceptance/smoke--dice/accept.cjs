// Execute the unchanged public test bodies with the existing node:test reporter.
// This adapter supports only the pinned, fixture-only JavaScript specs in this bundle.
const fs = require('node:fs');
const path = require('node:path');
const {test: nodeTest} = require('node:test');
const modulePath = process.env.FACTORY_PLAYWRIGHT_MODULE;
if (!modulePath) throw Error('Provided Playwright is required for public acceptance');
const driver = require(modulePath);
const assertions = driver.expect ? driver : require(require.resolve('@playwright/test', {
  paths: [path.dirname(require.resolve(modulePath))]
}));
const expect = assertions.expect.configure({timeout: 10000});
const launch = {headless: true, timeout: 10000};
if (process.env.FACTORY_CHROMIUM_EXECUTABLE) {
  launch.executablePath = process.env.FACTORY_CHROMIUM_EXECUTABLE;
}
function test(name, body) {
  nodeTest(name, {timeout: 10000}, async t => {
    const browser = await driver.chromium.launch(launch);
    t.after(() => browser.close());
    const page = await browser.newPage({baseURL: process.env.FACTORY_BASE_URL});
    page.setDefaultTimeout(10000);
    page.setDefaultNavigationTimeout(10000);
    await body({page});
  });
}
const prefix = "import { test, expect } from '@playwright/test';";
for (const name of fs.readdirSync(__dirname).filter(name => name.endsWith('.spec.ts')).sort()) {
  const source = fs.readFileSync(path.join(__dirname, name), 'utf8');
  if (!source.startsWith(prefix)) throw Error('Unsupported public-spec import: ' + name);
  new Function('test', 'expect', source.slice(prefix.length))(test, expect);
}
