// Post-compilation diagnostics only. Never used as compiler input or score.
import { chromium } from '../node_modules/playwright/index.mjs';
import { withApp } from '../src/run.ts';
import { resolveNamed, fillField } from '../src/ladder.ts';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const observations=[];
for (const [sample,source] of [['keep-5','2026-09-14-keep-full-5'],['keep-7','2026-09-15-keep-full-7']]) {
 await withApp(`~/projects/volo-factory/runs/${source}/app`,resolve(`out/diagnostic-${sample}`),async url=>{
  const browser=await chromium.launch();
  try {
   const context=await browser.newContext({baseURL:url,viewport:{width:1280,height:720}});
   const page=await context.newPage();page.setDefaultTimeout(1500);
   await page.goto('/');
   const describe=async locator=>({query:locator.toString(),count:await locator.count(),visible:await locator.first().isVisible(),html:await locator.first().evaluate(el=>el.outerHTML.slice(0,800)).catch(()=>null)});
   const row={sample,observations:{}};
   row.observations.takeNoteText=await describe(page.getByText(/take a note/i));
   row.observations.takeNoteLadder=await describe(await resolveNamed(page,/take a note/i));
   row.observations.workLink=await describe(page.getByRole('link',{name:/Work/i}));
   row.observations.workLadder=await describe(await resolveNamed(page,/Work/i));
   row.observations.settingsExactButton=await describe(page.getByRole('button',{name:/^Settings$/i}));
   row.observations.settingsLadder=await describe(await resolveNamed(page,/settings/i));
   row.observations.collapseNames=await describe(await resolveNamed(page,/collapse sidebar|hide sidebar|minimize sidebar|sidebar collapse/i));
   row.observations.menuLadder=await describe(await resolveNamed(page,/main menu|menu|sidebar/i));
   const title=page.getByText('Travel plans 2.5.1').first();await title.hover();
   row.observations.archiveWithinTitle=await describe(title.getByRole('button',{name:/archive/i}));
   row.observations.archiveLadder=await describe(await resolveNamed(page,/archive/i));
   await (await resolveNamed(page,'Take a note')).click();
   await fillField(page,['Title','Note title'],'Diagnostic creation');
   await fillField(page,['Take a note...','Take a note','Note text','Content'],'Diagnostic body');
   row.observations.fieldsBeforeEscape=await page.locator('input,textarea').evaluateAll(es=>es.map(e=>({label:e.getAttribute('aria-label'),placeholder:e.getAttribute('placeholder'),value:e.value})));
   await page.keyboard.press('Escape');
   await page.waitForTimeout(250);
   row.observations.createdAfterEscape=await describe(page.getByText('Diagnostic creation',{exact:true}));
   row.observations.titleFieldAfterEscape=await describe(page.getByLabel(/Title/i));
   try { row.observations.storeContainsCreatedTitle=JSON.stringify(await (await fetch(url+'/__factory/store')).json()).includes('Diagnostic creation'); } catch (error) { row.observations.storeReadError=String(error); }
   observations.push(row);writeFileSync('out/keep-diagnostics.json',JSON.stringify(observations,null,2)+'\n');await context.close();
  } finally {await browser.close();}
 });
}
writeFileSync('out/keep-diagnostics.json',JSON.stringify(observations,null,2)+'\n');
console.log('Recorded post-compilation selector and Escape diagnostics for both Keep samples.');
