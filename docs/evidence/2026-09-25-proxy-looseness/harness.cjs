'use strict';
// Strict-probe harness: fresh backend per probe (or shared, for pollution chains), fresh browser
// context per account, strict locators (no .first()), exact names, first failing step recorded.
const P = process.env.TMPDIR + '/oneshot-playwright-test-1.57.0/node_modules/';
const { chromium } = require(P + 'playwright');
const { expect } = require(P + '@playwright/test');
const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = 3205;
const BASE = `http://127.0.0.1:${PORT}`;
const BACKEND = path.resolve(__dirname, '..', 'b-5450', 'template', 'backend');
const STEP_TIMEOUT = 2500;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function restart() {
  try { execSync(`lsof -ti tcp:${PORT} -sTCP:LISTEN | xargs kill -9`, { stdio: 'ignore' }); } catch (e) {}
  await sleep(150);
  const child = spawn('node', ['server.js'], { cwd: BACKEND, env: { ...process.env, PORT: String(PORT) }, detached: true, stdio: 'ignore' });
  child.unref();
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(BASE + '/api/health');
      if (r.ok) return;
    } catch (e) {}
    await sleep(100);
  }
  throw new Error('backend did not come up');
}

class StopProbe extends Error {}

class Probe {
  constructor(browser, key) {
    this.browser = browser; this.key = key; this.log = []; this.fail = null; this.t0 = Date.now(); this.page = null;
    this.contexts = [];
  }
  async newPage() {
    const ctx = await this.browser.newContext({ baseURL: BASE });
    this.contexts.push(ctx);
    const page = await ctx.newPage();
    page.setDefaultTimeout(STEP_TIMEOUT);
    this.page = page;
    return page;
  }
  elapsed() { return ((Date.now() - this.t0) / 1000).toFixed(1); }
  async step(label, fn) {
    if (this.fail) throw new StopProbe();
    try {
      await fn();
      this.log.push(`ok   ${this.elapsed()}s ${label}`);
    } catch (e) {
      if (e instanceof StopProbe) throw e;
      let snap = '';
      try { snap = await this.page.locator('main').ariaSnapshot({ timeout: 1000 }); } catch (e2) { snap = '(no main snapshot)'; }
      let url = ''; try { url = this.page.url(); } catch (e3) {}
      this.fail = { label, error: String(e.message).split('\n').filter(Boolean).slice(0, 4).join(' / '), url, snap };
      this.log.push(`FAIL ${this.elapsed()}s ${label}`);
      throw new StopProbe();
    }
  }
  async close() { for (const c of this.contexts) { try { await c.close(); } catch (e) {} } }
}

const T = { timeout: STEP_TIMEOUT };
const uniq = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ---- shared flows (each step goes through probe.step so the first failure is named) ----
async function signIn(pr, page, user = 'alice-dev', pw = 'Valid-password-123!') {
  await pr.step('goto /', () => page.goto('/'));
  await pr.step('click link "Sign in"', () => page.getByRole('link', { name: 'Sign in', exact: true }).click());
  await pr.step('fill "Username or email"', () => page.getByLabel('Username or email', { exact: true }).fill(user));
  await pr.step('fill "Password"', () => page.getByLabel('Password', { exact: true }).fill(pw));
  await pr.step('click button "Sign in"', () => page.getByRole('button', { name: 'Sign in', exact: true }).click());
  await pr.step(`signed in as ${user} (button "Account menu" visible)`, () => expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible(T));
}

async function register(pr, page, username, email, pw = 'Valid-password-123!') {
  await pr.step('goto /', () => page.goto('/'));
  await pr.step('click link "Sign in"', () => page.getByRole('link', { name: 'Sign in', exact: true }).click());
  await pr.step('click link "Create an account"', () => page.getByRole('link', { name: 'Create an account', exact: true }).click());
  await pr.step('fill Username', () => page.getByLabel('Username', { exact: true }).fill(username));
  await pr.step('fill Email', () => page.getByLabel('Email', { exact: true }).fill(email));
  await pr.step('fill Password', () => page.getByLabel('Password', { exact: true }).fill(pw));
  await pr.step('fill Confirm password', () => page.getByLabel('Confirm password', { exact: true }).fill(pw));
  await pr.step('check "Agree to the terms"', () => page.getByRole('checkbox', { name: 'Agree to the terms', exact: true }).check());
  await pr.step('click "Create account"', () => page.getByRole('button', { name: 'Create account', exact: true }).click());
  await pr.step('sign-in form shown', () => expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible(T));
}

// Open a repository by the REQ-3-1 global-search contract (known to pass hidden REQ-3-1 S1 on this app).
async function openRepo(pr, page, name = 'acme-docs') {
  await pr.step('fill searchbox "Search"', () => page.getByRole('searchbox', { name: 'Search', exact: true }).fill(name));
  await pr.step('press Enter', () => page.getByRole('searchbox', { name: 'Search', exact: true }).press('Enter'));
  await pr.step(`click link "${name}" (strict)`, () => page.getByRole('link', { name, exact: true }).click());
  await pr.step(`heading contains "${name}"`, () => expect(page.getByRole('heading', { name: new RegExp(name) })).toBeVisible(T));
}

async function openAccountMenuLink(pr, page, linkName) {
  await pr.step('click button "Account menu"', () => page.getByRole('button', { name: 'Account menu', exact: true }).click());
  await pr.step(`click link "${linkName}"`, () => page.getByRole('link', { name: linkName, exact: true }).click());
}

async function run(probes, keys, { fresh = true } = {}) {
  const browser = await chromium.launch();
  const results = [];
  for (const key of keys) {
    if (fresh) await restart();
    const pr = new Probe(browser, key);
    try { await probes[key](pr); } catch (e) { if (!(e instanceof StopProbe)) pr.fail = pr.fail || { label: '(probe crashed)', error: String(e.stack).split('\n').slice(0, 3).join(' / '), url: '', snap: '' }; }
    await pr.close();
    results.push({ key, elapsed: pr.elapsed(), passed: !pr.fail, fail: pr.fail, log: pr.log });
    const f = pr.fail;
    console.log(`\n=== ${key}  ${f ? 'FAIL' : 'PASS'}  (${pr.elapsed()}s)`);
    if (f) {
      console.log(`first failing step: ${f.label}\n  error: ${f.error}\n  url: ${f.url}`);
      console.log('  main snapshot:\n' + String(f.snap).split('\n').slice(0, 40).map((l) => '    ' + l).join('\n'));
    }
  }
  await browser.close();
  return results;
}

module.exports = { expect, T, uniq, restart, run, signIn, register, openRepo, openAccountMenuLink, BASE, sleep };
