// E047 diagnostic control: reproduce the public signOut helper, then inspect real state.
// This is a development experiment, never a production rule or an official score.
const {chromium, expect} = require(process.env.CALIBRATION_PLAYWRIGHT_MODULE);
const crypto = require('node:crypto');

(async () => {
  const [baseURL, delayText] = process.argv.slice(2);
  const delayMs = Number(delayText);
  const browser = await chromium.launch({headless: true,
    executablePath: process.env.CALIBRATION_CHROMIUM_EXECUTABLE});
  const result = {delay_ms: delayMs, status: 'error', browser_version: browser.version()};
  try {
    const context = await browser.newContext({baseURL});
    const username = 'cal-' + crypto.randomBytes(6).toString('hex');
    const response = await context.request.post('/api/register', {data: {
      username, password: 'Valid-password-123!', confirm: 'Valid-password-123!',
      idType: '护照', name: 'Calibration User', idNumber: 'P12345678',
      passengerType: '成人', email: username + '@example.test',
      countryCode: '+84', phone: '912345678', agree: true,
    }});
    if (!response.ok()) throw new Error('Fixture registration failed: ' + response.status());
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    page.setDefaultNavigationTimeout(10000);
    await page.route('**/*', route => new URL(route.request().url()).origin === baseURL
      ? route.continue() : route.abort());
    await page.goto('/');
    await expect(page.getByText(username, {exact: true})).toBeVisible();
    const logoutRequests = [];
    page.on('requestfailed', request => {
      if (new URL(request.url()).pathname === '/api/logout') {
        logoutRequests.push({event: 'failed', error: request.failure()?.errorText});
      }
    });
    await page.route('**/api/logout', async route => {
      logoutRequests.push({event: 'intercepted'});
      if (delayMs) await new Promise(resolve => setTimeout(resolve, delayMs));
      try { await route.continue(); }
      catch (error) { logoutRequests.push({event: 'continue_failed', error: error.message}); }
    });

    // Observe the label before clicking; a diagnostic read between click and
    // the assertion can race navigation and change the interaction being measured.
    result.initial_logout_label = await page.getByRole('link', {name: /退出登录|sign out/i}).textContent();
    result.login_pattern_matches_logout_label = /登录|login/i.test(result.initial_logout_label);
    // The two operations below retain the public helper's matching behavior.
    await page.getByRole('link', {name: /退出登录|sign out/i}).click();
    await expect(page.getByRole('link', {name: /登录|login/i})).toBeVisible();
    try { await page.goto('/'); }
    catch (error) { result.navigation_error = error.message; }
    await new Promise(resolve => setTimeout(resolve, delayMs + 250));
    const session = await (await context.request.get('/api/me')).json();
    if (!Object.hasOwn(session, 'user')) throw new Error('Session endpoint omitted its user field');
    result.session_still_active = session.user !== null;
    result.visible_links = await page.getByRole('link').allTextContents();
    result.logout_requests = logoutRequests;
    result.status = !result.navigation_error && !result.session_still_active ? 'passed' : 'failed';
    result.assertion = 'After the public sign-out interaction and next navigation, the session is absent';
    await context.close();
  } catch (error) {
    result.error = error.message;
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify(result));
})().catch(error => { console.error(error); process.exitCode = 2; });
