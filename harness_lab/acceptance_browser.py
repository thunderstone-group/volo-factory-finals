"""Restricted browser actions, not a desktop controller or an OS sandbox."""
from __future__ import annotations

import json
import os
import signal
import subprocess
from pathlib import Path
from urllib.parse import urlsplit


def local_url(value: str) -> str:
    parsed = urlsplit(value)
    if (parsed.scheme != "http" or parsed.hostname not in ("127.0.0.1", "localhost", "::1")
            or parsed.username or parsed.password or parsed.query or parsed.fragment):
        raise ValueError("Use an HTTP loopback URL for a disposable test application")
    if parsed.port is not None and not 1 <= parsed.port <= 65535:
        raise ValueError("Invalid application port")
    return value


BROWSER = r"""'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require(process.argv[1]);
const cfg = JSON.parse(fs.readFileSync(0, 'utf8'));
const origin = new URL(cfg.base_url).origin;
let browser;
async function stop() { if (browser) await browser.close(); }
process.on('SIGTERM', () => stop().finally(() => process.exit(143)));
function allowed(value) {
  const u = new URL(value, cfg.base_url);
  return u.origin === origin && !u.username && !u.password;
}
async function open() {
  const context = await browser.newContext({baseURL:cfg.base_url,
    viewport:{width:1280,height:900}, serviceWorkers:'block', acceptDownloads:false});
  if (typeof context.routeWebSocket !== 'function') throw Error('Playwright >= 1.49 required');
  await context.routeWebSocket('**/*', socket => socket.close());
  await context.route('**/*', async route => {
    try {
      if (!allowed(route.request().url())) return await route.abort('blockedbyclient');
      // Never let the HTTP helper follow an off-origin redirect behind the route guard.
      const response = await route.fetch({maxRedirects:0, timeout:5000});
      const location = response.headers()['location'];
      if (location && !allowed(new URL(location, route.request().url()).href))
        return await route.abort('blockedbyclient');
      await route.fulfill({response});
    } catch (_) { try { await route.abort('failed'); } catch (_) {} }
  });
  const page = await context.newPage();
  context.on('page', other => { if (other !== page) other.close().catch(() => {}); });
  page.on('download', download => download.cancel());
  page.on('dialog', dialog => dialog.dismiss());
  page.setDefaultTimeout(3000);
  page.setDefaultNavigationTimeout(10000);
  await page.goto(cfg.base_url, {waitUntil:'domcontentloaded'});
  return {context,page};
}
function target(page, t) {
  if (t.by === 'role') return page.getByRole(t.role, {name:t.name, exact:true});
  if (t.by === 'label') return page.getByLabel(t.name, {exact:true});
  if (t.by === 'placeholder') return page.getByPlaceholder(t.name, {exact:true});
  if (t.by === 'text') return page.getByText(t.name, {exact:true});
  throw Error('Unsupported locator');
}
async function assertion(read, expected) {
  const deadline = Date.now() + 3000;
  let actual;
  do {
    actual = await read();
    if (actual === expected) return actual;
    await new Promise(resolve => setTimeout(resolve, 100));
  } while (Date.now() < deadline);
  throw Error('Expected '+JSON.stringify(expected)+'; observed '+JSON.stringify(actual));
}
async function action(page, step) {
  if (step.op === 'goto') {
    const url = new URL(step.value, cfg.base_url).href;
    if (!allowed(url)) throw Error('Navigation outside the application is forbidden');
    await page.goto(url, {waitUntil:'domcontentloaded'}); return page.url();
  }
  if (step.op === 'reload') { await page.reload({waitUntil:'domcontentloaded'}); return page.url(); }
  const loc = target(page, step.target);
  switch (step.op) {
    case 'click': await loc.click(); break;
    case 'fill': await loc.fill(step.value); break;
    case 'press': await loc.press(step.value); break;
    case 'check': await loc.check(); break;
    case 'uncheck': await loc.uncheck(); break;
    case 'select': await loc.selectOption(step.value); break;
    case 'expect_visible': return await assertion(() => loc.isVisible(), step.value);
    case 'expect_text': return await assertion(() => loc.innerText(), step.value);
    case 'expect_value': return await assertion(() => loc.inputValue(), step.value);
    case 'expect_checked': return await assertion(() => loc.isChecked(), step.value);
    case 'expect_count': return await assertion(() => loc.count(), step.value);
    default: throw Error('Unsupported action');
  }
  return null;
}
async function snapshot(page, name) {
  const result = {url:page.url()};
  try { result.accessibility = (await page.locator('body').ariaSnapshot({timeout:3000})).slice(0,12000); }
  catch (error) { result.snapshot_error = error.message.slice(0,2000); }
  try {
    const file = path.join(cfg.output, name+'.png');
    await page.screenshot({path:file, timeout:5000, mask:[page.locator('input[type="password"]')]});
    fs.chmodSync(file, 0o600); result.screenshot = path.basename(file);
  } catch (error) { result.screenshot_error = error.message.slice(0,2000); }
  return result;
}
(async () => {
  browser = await chromium.launch({headless:true, executablePath:cfg.executable || undefined,
    timeout:20000});
  if (cfg.inspect) {
    const {context,page} = await open();
    const initial = await snapshot(page, 'initial');
    await context.close();
    if (!initial.accessibility) throw Error('No initial accessibility snapshot available');
    return {initial};
  }
  const results = [];
  for (const [index,check] of cfg.checks.entries()) {
    const result = {requirement_id:check.requirement_id, name:check.name, status:'passed', steps:[]};
    let context, page;
    try {
      ({context,page} = await open());
      for (const step of check.steps) {
        const evidence = {action:step}; result.steps.push(evidence);
        try { evidence.actual = await action(page, step); evidence.ok = true; }
        catch (error) {
          evidence.ok = false; evidence.error = error.message.slice(0,4000);
          result.status = step.op.startsWith('expect_') ? 'failed_check' : 'blocked'; break;
        }
      }
    } catch (error) { result.status = 'blocked'; result.error = error.message.slice(0,4000); }
    finally {
      if (page) result.evidence = await snapshot(page, 'check-'+String(index+1).padStart(2,'0'));
      if (context) await context.close();
    }
    results.push(result);
  }
  return {checks:results};
})().then(result => { console.log(JSON.stringify(result)); })
  .catch(error => { console.log(JSON.stringify({error:error.message})); process.exitCode=1; })
  .finally(stop);
"""


class Browser:
    def __init__(self, base_url: str, module: str, output: Path, executable: str | None = None):
        self.base_url = local_url(base_url)
        self.module = str(Path(module).expanduser().resolve())
        if not Path(self.module).exists():
            raise ValueError("Set FACTORY_PLAYWRIGHT_MODULE to an installed Playwright package")
        self.output, self.executable = output.resolve(), executable

    def execute(self, checks: list[dict], *, timeout: float, inspect: bool = False) -> dict:
        if timeout <= 0:
            raise TimeoutError("Acceptance wall-time budget exhausted")
        # No model credentials, user browser profile, shell tool or arbitrary JS is delegated.
        env = {k: v for k, v in os.environ.items()
               if k in ("PATH", "HOME", "TMPDIR", "TMP", "TEMP", "LANG", "SYSTEMROOT")}
        payload = {"base_url": self.base_url, "checks": checks, "inspect": inspect,
                   "output": str(self.output), "executable": self.executable}
        process = subprocess.Popen(["node", "-e", BROWSER, self.module],
                                   stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                   text=True, cwd=self.output, env=env, start_new_session=True)
        try:
            stdout, stderr = process.communicate(json.dumps(payload), timeout=timeout)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGTERM)
            try:
                process.communicate(timeout=2)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.communicate()
            raise TimeoutError("Acceptance browser exceeded the wall-time budget") from None
        try:
            result = json.loads(stdout)
        except ValueError:
            raise RuntimeError("Browser returned no valid evidence: " + stderr[-2000:]) from None
        if process.returncode or result.get("error"):
            raise RuntimeError(result.get("error") or stderr[-2000:])
        return result
