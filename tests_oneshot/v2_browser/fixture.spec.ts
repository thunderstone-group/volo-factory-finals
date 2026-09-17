// Synthetic domain. These checks are component acceptance, not benchmark scores.
import {test,expect} from '@playwright/test';
import {coverage} from './coverage';
import hashes from './shared-hashes.json';
function checked(records:any[],file:string,names:string[]){
 const items=records.filter(x=>new URL(x.url).pathname.endsWith('/'+file));expect(items.length).toBeGreaterThan(0);
 for(const item of items)expect(item.sha256).toBe((hashes as any)[file]);
 const called=items.flatMap(x=>x.called);for(const name of names)expect(called).toContain(name);
}
test('navigate list and open entity using prepared state',async({page})=>{
 await page.goto('/');const finish=await coverage(page);
 for(let i=0;i<3;i++){
  await page.getByRole('link',{name:'Records',exact:true}).click();
  expect(await page.getByRole('link',{name:'Alpha',exact:true}).isVisible()).toBe(true);
  await page.getByRole('link',{name:'Alpha',exact:true}).click();
  expect(await page.getByRole('heading',{name:'Alpha',exact:true}).isVisible()).toBe(true);
  await page.getByRole('link',{name:'Home',exact:true}).click();
 }
 const records=await finish();checked(records,'volo-navigation.js',['go','renderCurrent']);
 checked(records,'volo-interaction.js',['rowActions']);console.log('COMPONENT_EVIDENCE '+JSON.stringify({path:'navigation',records}));
});
for(const mode of ['dialog','inline']) test('open save and reopen '+mode+', awaiting the real mutation',async({page})=>{
 const original=mode==='dialog'?'Alpha':'Gamma',updated=mode==='dialog'?'Beta':'Delta';
 await page.goto('/records?mode='+mode);const finish=await coverage(page);
 await page.getByRole('article',{name:original,exact:true}).getByRole('button',{name:'Edit record',exact:true}).click();
 const dialog=page.getByRole(mode==='dialog'?'dialog':'region',{name:'Record editor',exact:true});
 await expect(dialog).toBeVisible();await dialog.getByRole('textbox',{name:'Name',exact:true}).fill(updated);
 await expect(dialog.getByRole('textbox',{name:'Description'}).locator('b')).toHaveText('Details');
 await expect(dialog.locator('img')).toHaveCount(0);
 let begin:any,release:any;const requested=new Promise(r=>begin=r),hold=new Promise(r=>release=r);
 await page.route('**/api/record',async route=>{begin();await hold;await route.continue();});
 await dialog.getByRole('button',{name:'Save record',exact:true}).click();await requested;
 await expect(dialog).toBeVisible();await expect(dialog.getByRole('button',{name:'Save record',exact:true})).toBeDisabled();
 release();await expect(dialog).toBeHidden();await page.unroute('**/api/record');
 await page.getByRole('article',{name:updated,exact:true}).getByRole('button',{name:'Edit record',exact:true}).click();
 await expect(dialog.getByRole('textbox',{name:'Name',exact:true})).toHaveValue(updated);
 await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.reload();await expect(page.getByRole('article',{name:updated,exact:true})).toBeVisible();
 const records=await finish();checked(records,'volo-interaction.js',['open','submit']);
 checked(records,'volo-navigation.js',['update','renderCurrent']);console.log('COMPONENT_EVIDENCE '+JSON.stringify({path:'editor',records}));
});
