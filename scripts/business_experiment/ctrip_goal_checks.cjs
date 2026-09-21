// Appended to the calibrated 14-check probe. Authored from requirements, not evaluator code.
async function section(page, account, name) {
  await personal(page,account);
  await navigation(page,name === '常用旅客' ? /^常用旅客(?:信息)?$/ : name).first().click();
}
async function visibleInput(page, names) {
  const input=page.getByLabel(names).and(page.locator('input:visible'));
  await expect(input).toHaveCount(1);
  return input;
}
async function addContact(page,name) {
  await page.getByRole('button',{name:/新增联系人|添加联系人/}).click();
  await page.getByLabel('姓名',{exact:true}).fill(name);
  await page.getByLabel('手机号',{exact:true}).fill('13900000088');
  await page.getByLabel('邮箱',{exact:true}).fill('goal_probe@example.com');
  await page.getByRole('button',{name:'保存',exact:true}).click();
  await expect(page.getByText(name,{exact:false}).first()).toBeVisible();
}
async function independentSession(page,browser,fn) {
  const context=await browser.newContext({baseURL:'http://127.0.0.1:3000'});
  const other=await context.newPage();
  other.observation=page.observation;
  try {await other.goto('/'); await fn(other);}
  finally {
    page.observation.independent_session_text=await other.locator('body').innerText({timeout:2000}).catch(()=>'<unavailable>');
    await context.close();
  }
}
test('REQ-2.5.2: SMS login rejects a missing mobile number',async ({page})=>{
  await loginForm(page);
  await navigation(page,'验证码登录').click();
  const mobile=await visibleInput(page,/手机号|手机号码/);
  await mobile.fill('');
  const form=page.locator('form').filter({has:mobile});
  await form.getByRole('checkbox',{name:/阅读并同意/}).check();
  await form.getByRole('button',{name:'登录',exact:true}).click();
  await expect(page.getByText('请输入手机号',{exact:true})).toBeVisible();
});
test('REQ-2.6.4.1: registration creates an account that can actually log in',async ({page})=>{
  await navigation(page,'注册').click();
  const agree=page.getByRole('button',{name:/^同意(?:并继续|并注册|并开始注册)?$/});
  if(await agree.isVisible()) await agree.click();
  const mobile=await visibleInput(page,/手机号|手机号码/);
  await mobile.fill('13900000917');
  await (await visibleInput(page,/验证码/)).fill('123456');
  await page.getByRole('button',{name:/^下一步/}).click();
  const passwords=page.locator('input[type=password]:visible');
  await expect(passwords).toHaveCount(2);
  await passwords.nth(0).fill('GoalTravel1234'); await passwords.nth(1).fill('GoalTravel1234');
  await page.locator('form').filter({has:passwords.first()}).getByRole('button',{name:/^(完成注册|完成|注册)$/}).click();
  // Enter through the homepage; auto-login is allowed, but then verify a fresh session separately.
  await page.context().clearCookies(); await page.evaluate(()=>localStorage.clear());
  await page.goto('/');
  await fillLogin(page,{account:'13900000917',password:'GoalTravel1234'});
  await expect(page.getByText(/尊敬的/).first()).toBeVisible();
});
test('REQ-5.3.2.2: traveler save explains a missing name',async ({page})=>{
  await section(page,'ctrip_traveler_create@example.com','常用旅客');
  await page.getByRole('button',{name:/^新增(?:旅客)?$/}).click();
  await page.getByRole('dialog').getByRole('button',{name:'保存',exact:true}).click();
  await expect(page.getByText('中文名与英文名两者必填一项',{exact:true})).toBeVisible();
});
test('REQ-5.3.2.1: a created traveler survives page reload',async ({page})=>{
  await section(page,'ctrip_traveler_create@example.com','常用旅客');
  await page.getByRole('button',{name:/^新增(?:旅客)?$/}).click();
  await page.getByLabel('中文名',{exact:true}).fill('目标旅客');
  await page.getByLabel('手机号',{exact:true}).fill('13900000088');
  await page.getByLabel('证件号码',{exact:true}).fill('110101199001011234');
  await page.getByRole('dialog').getByRole('button',{name:'保存',exact:true}).click();
  await expect(page.getByText('目标旅客',{exact:true})).toBeVisible();
  await page.reload(); await expect(page.getByText('目标旅客',{exact:true})).toBeVisible();
});
test('REQ-5.4.2.1: a saved recipient address survives page reload',async ({page})=>{
  await section(page,'ctrip_address_create@example.com','常用地址');
  await page.getByRole('button',{name:/^新增(?:地址)?$/}).click();
  for(const [name,value] of [['收件人','目标收件人'],['所在地区','四川省 成都市 武侯区'],['详细地址','测试路 17 号'],['手机号','13900000088']]) await page.getByLabel(name,{exact:true}).fill(value);
  await page.getByRole('dialog').getByRole('button',{name:'保存',exact:true}).click();
  await expect(page.getByText('目标收件人',{exact:false}).first()).toBeVisible();
  await page.reload(); await expect(page.getByText('测试路 17 号',{exact:false}).first()).toBeVisible();
});
test('REQ-5.6.2.1: invoice creation rejects an invalid company tax identifier',async ({page})=>{
  await section(page,'ctrip_user','常用报销凭证');
  await page.getByRole('button',{name:/^新增(?:抬头|发票)?$/}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByRole('radio',{name:'企业',exact:true}).check();
  await (await visibleInput(page,/抬头名称|发票抬头/)).fill('目标测试公司');
  await (await visibleInput(page,/纳税人识别号|税号/)).fill('INVALID');
  await dialog.getByRole('button',{name:'保存',exact:true}).click();
  await expect(dialog).toBeVisible();
  await expect(await visibleInput(page,/纳税人识别号|税号/)).toHaveValue('INVALID');
});
test('REQ-5.6.2.2: selecting a special VAT invoice reveals registration fields',async ({page})=>{
  await section(page,'ctrip_user','常用报销凭证');
  await page.getByRole('button',{name:/^新增(?:抬头|发票)?$/}).click();
  const address=page.getByLabel('注册地址',{exact:true});
  await expect(address).not.toBeVisible();
  await page.getByLabel('增值税专用发票',{exact:true}).selectOption({label:'需要'});
  await expect(address).toBeVisible();
  await expect(page.getByLabel(/银行账号|银行账户/)).toBeVisible();
});
test('REQ-7.2.1.1 + REQ-7.3.2.1: flight-number search exposes ground-service details',async ({page})=>{
  await navigation(page,'航班动态').first().click();
  await page.getByRole('radio',{name:'搜航班号',exact:true}).check();
  const flight=await visibleInput(page,/^航班号/); await flight.fill('JD5162');
  await page.locator('form').filter({has:flight}).getByRole('button',{name:/^(搜索|查询)$/}).click();
  await expect(page.getByRole('heading',{name:/JD5162/})).toBeVisible();
  for(const text of ['值机柜台','登机口','行李转盘']) await expect(page.getByText(text,{exact:false}).first()).toBeVisible();
});
test('REQ-7.2.3.2: clearing flight-status history removes the existing entries',async ({page})=>{
  await navigation(page,'航班动态').first().click();
  await expect(page.getByRole('button',{name:'MU5234',exact:true})).toBeVisible();
  await navigation(page,'清除历史记录').click();
  await expect(page.getByRole('button',{name:'MU5234',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'JD5162',exact:true})).toHaveCount(0);
});
test('REQ-9.3.2.1: airport transport shows a real timetable',async ({page})=>{
  if (!await navigation(page,'机场攻略').count()) await navigation(page,'更多服务').hover();
  await navigation(page,'机场攻略').first().click();
  await navigation(page,'北京首都').click();
  await navigation(page,'机场交通').click();
  await expect(page.getByText('市内巴士',{exact:true})).toBeVisible();
  await expect(page.getByText(/首班.*\d{2}:\d{2}.*末班/).first()).toBeVisible();
});
test('account persistence: a saved profile is readable in an independent browser session',async ({page,browser})=>{
  await section(page,'ctrip_profile_edit@example.com','我的信息');
  await page.getByRole('button',{name:'编辑',exact:true}).click();
  await field(page,'昵称').fill('跨会话旅客');
  await field(page,'真实姓名').fill('周九');
  await page.getByRole('button',{name:'保存',exact:true}).click();
  await expect(page.getByText('跨会话旅客',{exact:true})).toBeVisible();
  await independentSession(page,browser,async(other)=>{
    await section(other,'ctrip_profile_edit@example.com','我的信息');
    await expect(other.getByText('跨会话旅客',{exact:true})).toBeVisible();
  });
});
test('account persistence: a saved contact is readable in an independent browser session',async ({page,browser})=>{
  await section(page,'ctrip_contact_create@example.com','常用联系人');
  await addContact(page,'跨会话联系人');
  await independentSession(page,browser,async(other)=>{
    await section(other,'ctrip_contact_create@example.com','常用联系人');
    await expect(other.getByText('跨会话联系人',{exact:false}).first()).toBeVisible();
  });
});

test('REQ-5.6.2.1: invoice creation accepts and retains a valid company identifier',async ({page})=>{
  await section(page,'ctrip_user','常用报销凭证');
  await page.getByRole('button',{name:/^新增(?:抬头|发票)?$/}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByRole('radio',{name:'企业',exact:true}).check();
  await (await visibleInput(page,/抬头名称|发票抬头/)).fill('目标有效公司');
  await (await visibleInput(page,/纳税人识别号|税号/)).fill('91310115MA1K12345X');
  await dialog.getByRole('button',{name:'保存',exact:true}).click();
  await expect(page.getByText('目标有效公司',{exact:false}).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText('目标有效公司',{exact:false}).first()).toBeVisible();
});
