// Independent entry-path checks derived from public requirements. No official assertions imported.
import {test,expect} from '@playwright/test';
import {coverage} from './coverage';
import config from './flow-input.json';
const input:any=config;
async function action(root:any,name:string|RegExp){
 const target=root.getByRole('button',{name,exact:typeof name==='string'}).or(root.getByRole('link',{name,exact:typeof name==='string'})).filter({visible:true});
 await expect(target.first()).toBeVisible({timeout:2500});return target.first();
}
async function login(page:any){
 await (await action(page,'Login')).click();
 const email=page.getByLabel('Email address',{exact:true});await email.fill(input.auth.email);
 await page.getByLabel('Password',{exact:true}).fill(input.auth.password);
 const form=page.locator('form').or(page.getByRole('form')).filter({has:email}).first();
 await form.getByRole('button',{name:'Login',exact:true}).click();
 await expect(page.getByText(input.auth.nickname,{exact:true}).filter({visible:true}).first()).toBeVisible({timeout:4000});
}
function attest(records:any[],file:string,names:string[]){
 const entries=records.filter(x=>new URL(x.url).pathname.endsWith('/'+file));expect(entries.length).toBeGreaterThan(0);
 for(const entry of entries)expect(entry.sha256).toBe(input.sharedHashes[file]);
 const calls=entries.flatMap(x=>x.called);for(const name of names)expect(calls).toContain(name);
 return calls;
}
async function runObserved(page:any,path:string,run:(record:any)=>Promise<void>){
 test.setTimeout(18000);page.setDefaultTimeout(2500);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(String(e)));
 const record:any={path,scope:'two public interaction paths only',phase:'load',errors};let finish:any;
 try{
  await page.goto('/');if(input.task==='bookstack'){record.phase='login';await login(page);}
  finish=await coverage(page);await run(record);record.domPathPassed=true;
 }finally{
  record.coverage=finish?await finish():[];record.tree=(await page.locator('body').ariaSnapshot()).slice(0,16000);
  console.log('INTERACTION_EVIDENCE '+JSON.stringify(record));
 }
 expect(errors).toEqual([]);
 return record;
}
test('public editor save and reopen uses shared implementation',async({page})=>{
 const record=await runObserved(page,'editor',async record=>{
  record.phase='open';const value='V2 shared path '+Date.now();record.value=value;
  if(input.task==='keep'){
   await (await action(page,/^Take a note(?:\.\.\.)?$/i)).click();
   const title=page.getByRole('textbox',{name:'Title',exact:true});await title.fill(value);
   const content=page.getByRole('textbox',{name:'Note content',exact:true});await content.fill('Saved through the shared editor');
   const form=page.locator('form').filter({has:title});await expect(form).toHaveCount(1);
   record.phase='save';await form.getByRole('button',{name:'Close',exact:true}).click();await expect(form).toBeHidden({timeout:3000});
   record.phase='reopen';await page.getByText(value,{exact:true}).filter({visible:true}).first().click();
   await expect(page.getByRole('textbox',{name:'Title',exact:true})).toHaveValue(value);
   await expect(page.getByRole('textbox',{name:'Note content',exact:true})).toHaveValue('Saved through the shared editor');
  }else{
   await (await action(page,'Shelves')).click();await page.getByText(input.editEntity,{exact:true}).filter({visible:true}).first().click();
   await (await action(page,'Edit')).click();const name=page.getByRole('textbox',{name:'Name',exact:true});await name.fill(value);
   const form=page.locator('form').filter({has:name});await expect(form).toHaveCount(1);
   record.phase='save';await form.getByRole('button',{name:'Save Shelf',exact:true}).click();await expect(form).toBeHidden({timeout:3000});
   record.phase='reopen';await (await action(page,'Edit')).click();await expect(page.getByRole('textbox',{name:'Name',exact:true})).toHaveValue(value);
  }
 });
 attest(record.coverage,'volo-interaction.js',['open','submit']);
 attest(record.coverage,'volo-navigation.js',['update']);
});
test('public navigation list and entity opening uses prepared data',async({page})=>{
 const record=await runObserved(page,'navigation',async record=>{
  record.phase='navigate';
  if(input.task==='keep'){
   await (await action(page,'Archived')).click();await (await action(page,'Notes')).click();
  }else await (await action(page,'Shelves')).click();
  const entity=page.getByText(input.listEntity,{exact:true}).filter({visible:true}).first();
  record.phase='ready';expect(await entity.isVisible()).toBe(true);
  record.phase='open_entity';const before=await page.locator('[data-route]').first().innerText();await entity.click();
  if(input.task==='keep')await expect(page.getByRole('textbox',{name:'Title',exact:true})).toHaveValue(input.listEntity);
  else {await expect(await action(page,'Edit')).toBeVisible();expect(await page.locator('[data-route]').first().innerText()).not.toBe(before);}
 });
 const calls=attest(record.coverage,'volo-navigation.js',['renderCurrent']);expect(calls.some(x=>x==='go'||x==='update')).toBe(true);
 attest(record.coverage,'volo-interaction.js',['rowActions']);
 const transitions=record.coverage.filter((x:any)=>new URL(x.url).pathname.endsWith('/volo-navigation.js')).reduce((n:number,x:any)=>n+(x.counts.go||0)+(x.counts.update||0),0);expect(transitions).toBeGreaterThanOrEqual(2);
 if(input.task==='keep')attest(record.coverage,'volo-interaction.js',['open']);
});
