// Local evaluation only. Generated applications and evaluator sources are separate mounts.
const fs = require('fs');
const path = require('path');
const {spawn, spawnSync} = require('child_process');
const {chromium} = require('@playwright/test');
const app = '/workspace/application';
const mode = process.argv[2];
const modulePath = '/opt/business-experiment/node_modules';
if (!fs.existsSync('/workspace/node_modules')) fs.symlinkSync(modulePath, '/workspace/node_modules');
const build = spawnSync('npm', ['run', 'build', '--silent'], {cwd: app + '/frontend', encoding: 'utf8'});
fs.writeFileSync('/workspace/build.log', (build.stdout || '') + (build.stderr || ''));
if (build.status) {
  fs.writeFileSync('/workspace/application-failure.json', JSON.stringify({
    stage:'frontend_build', exit_code:build.status, error:((build.stdout||'')+(build.stderr||'')).slice(-4000)}));
  process.exit(0);
}
const config = {
  testDir: '/workspace/checks', timeout: mode === 'probe' ? 45000 : 10000,
  expect: {timeout: 10000}, fullyParallel: false, retries: 0, workers: 1,
  reporter: [['json', {outputFile: '/workspace/report.json'}]],
  outputDir: '/workspace/test-artifacts',
  use: {baseURL: 'http://127.0.0.1:3000', headless: true, trace: 'off', screenshot: 'off', video: 'off',
        viewport: {width: 1280, height: 720}, timezoneId: 'UTC'},
};
fs.writeFileSync('/workspace/playwright.config.cjs', 'module.exports=' + JSON.stringify(config));
async function main() {
  const browser = await chromium.launch();
  const metadata = {node: process.version, playwright: require('@playwright/test/package.json').version,
    chromium: browser.version(), arch: process.arch, mode, workers: 1,
    server_lifecycle: mode === 'score' || process.env.ARC_PROBE_SHARED_SERVER === '1' ? 'shared' : 'per_check',
    cpu_max: fs.readFileSync('/sys/fs/cgroup/cpu.max', 'utf8').trim(),
    memory_max: fs.readFileSync('/sys/fs/cgroup/memory.max', 'utf8').trim()};
  await browser.close();
  fs.writeFileSync('/workspace/runtime.json', JSON.stringify(metadata, null, 2));
  let server;
  if (mode === 'score' || process.env.ARC_PROBE_SHARED_SERVER === '1') {
    const start = JSON.parse(fs.readFileSync(app + '/backend/package.json')).scripts.start.split(/\s+/);
    const log = fs.openSync('/workspace/server.log', 'a');
    server = spawn(start[0], start.slice(1), {cwd: app + '/backend', detached: true,
      env: {...process.env, PORT: '3000', HOST: '0.0.0.0'}, stdio: ['ignore', log, log]});
    const until = Date.now() + 120000;
    let ready = false;
    while (Date.now() < until && server.exitCode === null) {
      try {const r = await fetch('http://127.0.0.1:3000'); if (r.status < 500) {ready = true; break;}} catch {}
      await new Promise(r => setTimeout(r, 200));
    }
    if (!ready) throw new Error('application did not become ready');
  }
  try {
    const result = spawnSync('node', [modulePath + '/@playwright/test/cli.js', 'test', '--config', '/workspace/playwright.config.cjs'],
      {cwd: '/workspace', env: {...process.env, E2E_BASE_URL: 'http://127.0.0.1:3000',
        PLAYWRIGHT_BASE_URL: 'http://127.0.0.1:3000', ARC_WEB_BASE_URL: 'http://127.0.0.1:3000'}, encoding: 'utf8'});
    fs.writeFileSync('/workspace/playwright.log', (result.stdout || '') + (result.stderr || ''));
    // Test failures are measurements. Missing reports are infrastructure failures.
    if (!fs.existsSync('/workspace/report.json')) throw new Error('Playwright produced no report');
  } finally {
    if (server) {try {process.kill(-server.pid, 'SIGTERM');} catch {}}
  }
}
main().catch(e => {fs.writeFileSync('/workspace/infrastructure-error.txt', String(e.stack)); process.exitCode = 1;});
