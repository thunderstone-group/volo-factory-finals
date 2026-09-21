// Requirement-derived fixed acceptance for the booking-to-payment experiment.
// Appended to the existing regression probe, with a shared backend across all cases.
test.beforeEach(async({page})=>page.setDefaultTimeout(10000));
async function bookForGoal(page,alreadyLoggedIn=false){
  if(!alreadyLoggedIn){await fillLogin(page);await expect(page.getByText(/尊敬的/).first()).toBeVisible();}
  await search(page);
  const expand=page.getByRole('button',{name:/展开/}).first();
  if(await expand.isVisible())await expand.click();
  await page.getByRole('button',{name:'预订',exact:true}).first().click();
  await expect(page.getByRole('heading',{name:'订单总价',exact:true})).toBeVisible();
}
function feePanel(page){return page.locator('aside').filter({has:page.getByRole('heading',{name:'订单总价',exact:true})}).first();}
async function amount(page){const txt=await feePanel(page).innerText();const m=txt.match(/订单总价\s*[¥￥]?\s*(\d+(?:\.\d+)?)/);if(!m)throw Error('No numerical order total: '+txt);return Number(m[1]);}
function insuranceSection(page){return page.locator('section').filter({has:page.getByRole('heading',{name:'航意航延组合险',exact:true})});}
async function onePassenger(page){await page.getByRole('checkbox',{name:'张三',exact:true}).check();}
async function validContact(page){await page.getByLabel(/联系人.*手机|联系手机|手机号码|联系方式/).and(page.locator('input:visible')).first().fill('13900000088');}
async function orderList(page){await page.getByText('订单',{exact:true}).first().hover();await navigation(page,'机票+相关订单').click();}
test('ORDER-GOAL REQ-4.1.2.1 + REQ-4.1.6.1: passenger selection changes quantity and price coherently',async({page})=>{
  await bookForGoal(page);await onePassenger(page);const one=await amount(page);
  await page.getByRole('checkbox',{name:'李四',exact:true}).check();
  await feePanel(page).getByRole('button',{name:'明细',exact:true}).click();await expect(feePanel(page)).toContainText(/x\s*2/);expect(await amount(page)).toBe(one*2);
  await page.getByRole('checkbox',{name:'李四',exact:true}).uncheck();expect(await amount(page)).toBe(one);
});
test('ORDER-GOAL REQ-4.1.3.2: invalid passenger identity is rejected on blur',async({page})=>{
  await bookForGoal(page);
  let id=page.getByLabel(/证件号码|身份证号/).and(page.locator('input:visible'));
  if(!await id.count()){await page.getByRole('button',{name:/新增乘机人/}).click();id=page.getByLabel(/证件号码|身份证号/).and(page.locator('input:visible'));}
  await page.getByLabel(/^姓名(?:\s|$)/).and(page.locator('input:visible')).fill('测试旅客');
  await id.fill('123');await id.press('Tab');
  await expect(page.getByText('请输入正确的证件号码',{exact:true})).toBeVisible();
});
test('ORDER-GOAL REQ-4.1.5.1: invalid contact prevents order submission with useful feedback',async({page})=>{
  await bookForGoal(page);await onePassenger(page);
  const contact=page.getByLabel(/联系人.*手机|联系手机|手机号码|联系方式/).and(page.locator('input:visible')).first();
  await contact.fill('123');await contact.press('Tab');
  await page.getByRole('button',{name:'提交订单',exact:true}).click();
  await expect(contact).toBeVisible();
  const invalid=await contact.evaluate(e=>e.getAttribute('aria-invalid')==='true'||!e.validity.valid);
  if(!invalid)await expect(page.getByText(/(?:手机|联系).*(?:正确|错误|格式)|(?:正确|错误|格式).*(?:手机|联系)/).first()).toBeVisible();
});
test('ORDER-GOAL REQ-4.2.1.1 + REQ-4.2.5.2: insurance adds and removes its actual fee',async({page})=>{
  await bookForGoal(page);await onePassenger(page);const base=await amount(page);
  await insuranceSection(page).getByRole('button',{name:'添加',exact:true}).click();
  await expect(insuranceSection(page).getByRole('button',{name:'已选',exact:true})).toBeVisible();expect(await amount(page)).toBe(base+40);
  await insuranceSection(page).getByRole('button',{name:'已选',exact:true}).click();expect(await amount(page)).toBe(base);
});
test('ORDER-GOAL REQ-4.2.2.2: purchased baggage changes price and displayed allowance',async({page})=>{
  await bookForGoal(page);await onePassenger(page);
  const section=page.locator('section').filter({has:page.getByRole('heading',{name:'行李额',exact:true})});
  const before=await section.innerText();const match=before.match(/(?:免费携带|免费托运|免费行李)\s*(\d+)\s*KG/i);
  expect(match,'The free baggage allowance must be a real numeric amount').not.toBeNull();
  const free=Number(match[1]),base=await amount(page);
  await section.getByRole('button',{name:/\+\s*10\s*KG/i}).click();expect(await amount(page)).toBeGreaterThan(base);
  await expect(section).toContainText(new RegExp('(?:合计|总|可携带|已选)[^\\d]*'+(free+10)+'\\s*KG','i'));
});
test('ORDER-GOAL REQ-4.2.5.1: added service is represented in the visible fee breakdown',async({page})=>{
  await bookForGoal(page);await onePassenger(page);await insuranceSection(page).getByRole('button',{name:'添加',exact:true}).click();
  await feePanel(page).getByRole('button',{name:'明细',exact:true}).click();await expect(feePanel(page)).toContainText('航意航延组合险');await expect(feePanel(page)).toContainText(/40/);
});
test('ORDER-GOAL REQ-4.3.1: submitted order opens a live payment countdown',async({page})=>{
  await bookForGoal(page);await onePassenger(page);await validContact(page);await page.getByRole('button',{name:'提交订单',exact:true}).click();
  const countdown=page.getByText(/剩余时间.*\d{2}:\d{2}/).first();await expect(countdown).toBeVisible();
  function seconds(s){const m=s.match(/(?:(\d{2}):)?(\d{2}):(\d{2})/);if(!m)throw Error('Invalid countdown');return Number(m[1]||0)*3600+Number(m[2])*60+Number(m[3]);}
  const first=seconds(await countdown.innerText());await page.waitForTimeout(1200);expect(seconds(await countdown.innerText())).toBeLessThan(first);
});
test('ORDER-GOAL REQ-4.3.2: simulated payment updates the newly created order and survives reload',async({page})=>{
  await fillLogin(page);await expect(page.getByText(/尊敬的/).first()).toBeVisible();await orderList(page);
  const before=new Set(((await page.locator('body').innerText()).match(/(?:CTRIP|ORD)\d+/g)||[]));
  await page.goto('/');await bookForGoal(page,true);await onePassenger(page);await validContact(page);await page.getByRole('button',{name:'提交订单',exact:true}).click();
  await page.getByRole('button',{name:'支付宝',exact:true}).click();await orderList(page);
  const ids=((await page.locator('body').innerText()).match(/(?:CTRIP|ORD)\d+/g)||[]).filter(x=>!before.has(x));expect(ids.length).toBeGreaterThan(0);
  const row=page.locator('article,tr,[role="row"]').filter({hasText:ids[0]}).first();await expect(row).toContainText(/未出行|待出行|已支付|已完成/);
  await page.reload();await expect(page.locator('article,tr,[role="row"]').filter({hasText:ids[0]}).first()).toContainText(/未出行|待出行|已支付|已完成/);
});

test('ORDER-GOAL REQ-4.1.3.1: valid-format passenger identity does not produce a validation error',async({page})=>{
  await bookForGoal(page);
  let id=page.getByLabel(/证件号码|身份证号/).and(page.locator('input:visible'));
  if(!await id.count()){await page.getByRole('button',{name:/新增乘机人/}).click();id=page.getByLabel(/证件号码|身份证号/).and(page.locator('input:visible'));}
  await page.getByLabel(/^姓名(?:\s|$)/).and(page.locator('input:visible')).fill('测试旅客');
  await id.fill('110101199001019992');await id.press('Tab');
  await expect(page.getByText('请输入正确的证件号码',{exact:true})).not.toBeVisible();
});
