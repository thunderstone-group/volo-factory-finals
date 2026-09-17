// Fixed, domain-neutral probes. Configuration is caller-audited public requirement data.
// Never import a benchmark helper, forward page stdout, or interpret application success logs.
const {test, expect} = require('@playwright/test');
const config = require('./probe-input.json');
const MARKER = 'VOLO_BUSINESS_OBSERVATION ';
const TIMEOUT = 1800;
class Uncertain extends Error {}
class ProductFailure extends Error {}
function control(root, name) {
  return root.getByRole('button', {name, exact: true})
    .or(root.getByRole('link', {name, exact: true})).filter({visible: true});
}
async function unique(locator, description) {
  try { await expect(locator).toHaveCount(1, {timeout: TIMEOUT}); await expect(locator).toBeVisible({timeout: TIMEOUT}); }
  catch (_) { throw new Uncertain(description + ': expected one visible target; observed ' + await locator.count()); }
  return locator;
}
async function click(root, name) { await (await unique(control(root,name), 'Action ' + name)).click(); }
async function field(page, name) {
  return unique(page.getByLabel(name,{exact:true}).or(page.getByPlaceholder(name,{exact:true})).filter({visible:true}), 'Field '+name);
}
async function route(page, names) { for (const name of names) await click(page,name); }
async function setup(page) {
  await page.goto('/');
  const auth = config.login;
  if (!auth) return;
  // Scope the setup entry to the caller-identified navigation landmark.
  // Multiple valid login links elsewhere are not an application defect.
  const entryScope=auth.scope==='header' ? page.locator('header') : auth.scope ? page.getByRole(auth.scope) : page;
  await click(entryScope,auth.open);
  let email;
  for (const [name,value] of Object.entries(auth.fields)) {
    const item = await field(page,name); await item.fill(value); email ||= item;
  }
  const form = await unique(page.locator('form').filter({has:email}), 'Login form containing entered field');
  await click(form,auth.submit);
  await expect(page.getByText(auth.ready,{exact:true}).filter({visible:true})).toHaveCount(1,{timeout:TIMEOUT});
}
async function assertValue(item, expected, label) {
  try { await expect(item).toHaveValue(expected,{timeout:TIMEOUT}); }
  catch (_) {
    const actual = await item.inputValue().catch(()=>null);
    if (actual === null) throw new Uncertain('Readback target disappeared');
    throw new ProductFailure(label+': expected '+JSON.stringify(expected)+'; observed '+JSON.stringify(actual));
  }
}
for (const flow of config.flows) {
 test(flow.id, async ({page}) => {
  page.setDefaultTimeout(TIMEOUT);
  const record = {id:flow.id, status:'unknown', phase:'setup', observation:'', contract_sha256:config.contract_sha256};
  const errors=[]; page.on('pageerror',e=>errors.push(String(e).slice(0,400)));
  try {
    await setup(page);
    record.phase='navigate'; await route(page,flow.navigate);
    if (flow.kind === 'favorite') {
      record.phase='favorite';
      const action = control(page,flow.enable);
      try { await expect(action).toHaveCount(1,{timeout:TIMEOUT}); }
      catch (_) {
        if (await action.count() === 0 && await control(page,flow.disable).count() === 0)
          throw new ProductFailure('Reached requested entity view, but neither '+JSON.stringify(flow.enable)+' nor '+JSON.stringify(flow.disable)+' is an available action.');
        throw new Uncertain('Favorite action is ambiguous or initial state already selected');
      }
      await action.click();
      try { await expect(control(page,flow.disable)).toHaveCount(1,{timeout:TIMEOUT}); }
      catch (_) { throw new ProductFailure('Clicked '+flow.enable+' but the required '+flow.disable+' state did not appear.'); }
      record.observation='Reached entity, clicked '+flow.enable+'; action changed to '+flow.disable+'.';
    } else {
      record.phase='open'; await click(page,flow.open);
      let input = await field(page,flow.field); const before=await input.inputValue();
      const changed='Observed '+Date.now()+' '+Math.random().toString(36).slice(2,6);
      await input.fill(changed);
      const action=flow.kind==='cancel' ? flow.cancel : flow.save;
      record.phase=flow.kind==='cancel'?'cancel':'save';
      const form=await unique(page.locator('form').filter({has:input}), 'Editor form containing edited field');
      await click(form,action);
      record.phase='reopen'; await click(page,flow.open); input=await field(page,flow.field);
      await assertValue(input,flow.kind==='cancel'?before:changed,
        flow.kind==='cancel'?'Cancel changed the stored value':'Saved value was not reflected on reopen');
      record.observation=flow.kind==='cancel'?'Changed a draft, cancelled, reopened: original field value preserved.':'Changed field, saved, reopened: entered value retained.';
    }
    record.status='pass';
  } catch (e) {
    record.status=e instanceof ProductFailure?'product_fail':'unknown';
    record.observation='At '+record.phase+': '+String(e.message||e).slice(0,1200);
  } finally {
    if (errors.length) {record.status='unknown';record.observation+='; page errors: '+errors.slice(0,3).join('; ');}
    record.observation += ' Current route: '+new URL(page.url()).pathname;
    console.log(MARKER+JSON.stringify(record));
  }
  // A test process pass means that an observation was emitted, not business success.
 });
}
