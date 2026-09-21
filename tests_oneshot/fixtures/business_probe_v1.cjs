// Pilot diagnostics authored from requirements.yaml, never from evaluator code.
// This is a fixed Ctrip experiment probe, not a general requirement compiler.
const {test, expect} = require('@playwright/test');
const {spawn} = require('child_process');
const fs = require('fs');
const app = '/workspace/application';
let server;
test.beforeEach(async ({page}) => {
  page.observation = {actions: [], page_errors: []};
  page.on('pageerror', e => page.observation.page_errors.push(String(e.message)));
  const start = JSON.parse(fs.readFileSync(app + '/backend/package.json')).scripts.start.split(/\s+/);
  const log = fs.openSync('/workspace/probe-server.log', 'a');
  server = spawn(start[0], start.slice(1), {cwd: app + '/backend', detached: true,
    env: {...process.env, PORT: '3000', HOST: '0.0.0.0'}, stdio: ['ignore', log, log]});
  const until = Date.now() + 10000;
  while (Date.now() < until) {
    try {if ((await fetch('http://127.0.0.1:3000')).ok) break;} catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  await page.goto('/', {waitUntil: 'domcontentloaded'});
});
test.afterEach(async ({page}, info) => {
  try {
    const visible = await page.locator('body').innerText({timeout: 2000});
    const controls = await page.locator('input,button,select').evaluateAll(nodes => nodes
      .filter(n => n.getClientRects().length).slice(0,60).map(n => ({tag:n.tagName, type:n.type,
        text:(n.innerText || '').slice(0,80), label:n.getAttribute('aria-label'),
        placeholder:n.getAttribute('placeholder'), value:n.type==='password'?'[fixture password]':n.value})));
    await info.attach('business-observation', {body: Buffer.from(JSON.stringify({
      ...page.observation, url:page.url(), visible_text:visible.slice(0,6000), controls})), contentType:'application/json'});
  } finally {
    if (server) {try {process.kill(-server.pid, 'SIGTERM');} catch {} await new Promise(r => setTimeout(r,200));}
  }
});
async function action(page, description, fn) {page.observation.actions.push(description); return await fn();}
async function loginForm(page) {
  await action(page, 'Open password login from the homepage 登录 control', () => page.getByRole('button',{name:'登录',exact:true}).click());
  const account = page.getByPlaceholder('邮箱/用户名/手机号', {exact:true});
  if (!await account.isVisible()) await page.getByText('账号登录', {exact:true}).click();
  await expect(account).toBeVisible();
  return {account, password:page.locator('input[type="password"]:visible'),
    agreement:page.getByRole('checkbox', {name:/阅读并同意/})};
}
async function fillLogin(page, {account='ctrip_user',password='Travel1234',agree=true}={}) {
  const form = await loginForm(page);
  if (account) await action(page, 'Enter requirement-provided account identifier', () => form.account.fill(account));
  if (password) await action(page, 'Enter requirement-provided password', () => form.password.fill(password));
  if (agree) await action(page, 'Accept the service/privacy agreement', () => form.agreement.check());
  await action(page, 'Submit the login form', () => page.getByRole('button',{name:'登录',exact:true}).click());
}
async function search(page, origin='成都(CTU)', destination='广州(CAN)') {
  for (const [label,value] of [['出发城市',origin],['到达城市',destination],['出发日期','2026-07-21']]) {
    await action(page, `Fill ${label} with ${value}`, () => page.getByLabel(label,{exact:true}).fill(value));
    await page.getByLabel(label,{exact:true}).press('Tab');
  }
  await action(page,'Submit the flight search',() => page.getByRole('button',{name:'搜索',exact:true}).click());
}
test('REQ-3.1: homepage exposes a usable flight search form', async ({page}) => {
  for (const name of ['出发城市','到达城市','出发日期']) await expect(page.getByLabel(name,{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'搜索',exact:true})).toBeVisible();
});
test('REQ-2.4.1 + REQ-2.7.1: valid login and logout update the visible session state', async ({page}) => {
  await fillLogin(page);
  await expect(page.getByText(/尊敬的/).first()).toBeVisible();
  const greeting=page.getByText(/尊敬的/).first(); await expect(greeting).toBeVisible();
  await action(page,'Open the signed-in user menu',() => greeting.hover());
  await action(page,'Log out through 退出登录',() => page.getByRole('button',{name:'退出登录',exact:true}).click());
  await expect(page.getByRole('button',{name:'登录',exact:true})).toBeVisible();
});
for (const [id,name,options,message] of [
  ['REQ-2.4.2','missing account',{account:''},'请输入用户名'],
  ['REQ-2.4.3','missing password',{password:''},'请输入登录密码'],
  ['REQ-2.4.4','incorrect password',{password:'Incorrect1234'},'用户名或密码错误'],
  ['REQ-2.4.5','agreement not accepted',{agree:false},'请先阅读并勾选协议'],
]) test(`${id}: login rejects ${name} with the required message`, async ({page}) => {
  await fillLogin(page,options); await expect(page.getByText(message,{exact:true})).toBeVisible();
});
test('REQ-3.2.3: same-city search is rejected and stays editable', async ({page}) => {
  await search(page,'成都(CTU)','成都(CTU)');
  await expect(page.getByText('出发城市和到达城市不能相同',{exact:true})).toBeVisible();
  await expect(page.getByLabel('出发城市',{exact:true})).toBeVisible();
});
test('REQ-3.2.4: the fixed-clock past day is visible and disabled', async ({page}) => {
  await page.getByLabel('出发日期',{exact:true}).click();
  const past=page.getByRole('button',{name:'2026-07-18',exact:true});
  await expect(past).toBeVisible(); await expect(past).toBeDisabled();
});
test('REQ-3.4.1 + REQ-3.5.4.2: a valid search opens fares and a usable booking page', async ({page}) => {
  await search(page);
  await expect(page.getByRole('button',{name:/预订|展开/}).first()).toBeVisible();
  const expand=page.getByRole('button',{name:/展开/}).first();
  if (await expand.isVisible()) await action(page,'Expand a flight fare list',() => expand.click());
  await action(page,'Book an available fare',() => page.getByRole('button',{name:'预订',exact:true}).first().click());
  await expect(page.getByText('订单总价',{exact:false}).first()).toBeVisible();
  await expect(page.getByText('张三',{exact:false}).first()).toBeVisible();
  await expect(page.getByLabel(/联系人.*手机|联系手机|手机号码/).first()).toBeVisible();
});
test('REQ-3.4.2: saved history runs a valid search instead of only changing the route', async ({page}) => {
  await action(page,'Reuse the supplied 成都 - 广州 history entry',() => page.getByRole('button',{name:'成都 - 广州',exact:true}).click());
  await expect(page.getByText(/[¥￥]\s*\d+/).first()).toBeVisible();
  await expect(page.getByRole('button',{name:/预订|展开/}).first()).toBeVisible();
});
async function personal(page, account) {
  await fillLogin(page,{account});
  await page.getByText(/尊敬的/).first().hover();
  await page.getByRole('button',{name:'尊敬的用户',exact:true}).click();
}
test('REQ-6.2.1: edited profile values remain visible after save and re-entry', async ({page}) => {
  await personal(page,'ctrip_profile_edit@example.com');
  await action(page,'Open 我的信息 and enable editing',async () => {
    await page.getByRole('button',{name:'我的信息',exact:true}).click();
    await page.getByRole('button',{name:'编辑',exact:true}).click();
  });
  await page.getByLabel('昵称',{exact:true}).fill('回放旅客');
  await page.getByLabel('真实姓名',{exact:true}).fill('周九');
  await action(page,'Save changed profile information',() => page.getByRole('button',{name:'保存',exact:true}).click());
  await expect(page.getByText('回放旅客',{exact:true})).toBeVisible();
  await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.getByText('回放旅客',{exact:true})).toBeVisible();
  await expect(page.getByText('周九',{exact:true})).toBeVisible();
});
test('REQ-5.5.2.1 + REQ-5.5.3.1: create a default contact, reload it, then delete it', async ({page}) => {
  await personal(page,'ctrip_contact_create@example.com');
  await page.getByRole('button',{name:'常用联系人',exact:true}).click();
  await action(page,'Create a contact through the UI',() => page.getByRole('button',{name:/新增联系人|添加联系人/}).click());
  await page.getByLabel('姓名',{exact:true}).fill('实验联系人');
  await page.getByLabel('手机号',{exact:true}).fill('13900000088');
  await page.getByLabel('邮箱',{exact:true}).fill('business_probe@example.com');
  await page.getByRole('checkbox',{name:'设置为默认联系人',exact:true}).check();
  await page.getByRole('button',{name:'保存',exact:true}).click();
  await expect(page.getByText('实验联系人',{exact:false}).first()).toBeVisible();
  await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.getByText('实验联系人',{exact:false}).first()).toBeVisible();
  await expect(page.getByText(/默认/).first()).toBeVisible();
  await page.getByRole('button',{name:'删除',exact:true}).first().click();
  await page.getByRole('button',{name:/^(确定|确认|确认删除)$/}).click();
  await expect(page.locator('article,tr,[role="row"]').filter({hasText:'实验联系人'})).toHaveCount(0);
});
test('REQ-4.5.1.2: cancel the seeded unpaid order and retain its closed status', async ({page}) => {
  await fillLogin(page,{account:'ctrip_order_cancel@example.com'});
  await page.getByText('订单',{exact:true}).first().hover();
  await page.getByRole('button',{name:'机票+相关订单',exact:true}).click();
  await page.getByText(/CTRIP\d+/).first().click();
  await action(page,'Cancel the current pending-payment order',() => page.getByRole('button',{name:'取消订单',exact:true}).click());
  await page.getByRole('button',{name:/^(确认取消|确定|确认)$/}).click();
  await expect(page.getByText(/^已(?:取消|关闭)$/).first()).toBeVisible();
  await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.getByText(/^已(?:取消|关闭)$/).first()).toBeVisible();
});
