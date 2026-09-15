// Read-only selector diagnostics on a fresh copied app, after checks are frozen.
import {chromium} from '../node_modules/playwright/index.mjs';
import {withApp} from '../src/run.ts';
import {resolveNamed} from '../src/ladder.ts';
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const evidence={};
await withApp('~/projects/volo-factory/runs/2026-09-15-bookstack-2/app',resolve('out/diagnostic-bookstack'),async url=>{
 const browser=await chromium.launch();
 try {
  const page=await browser.newPage({baseURL:url,viewport:{width:1280,height:720}});
  page.setDefaultTimeout(3000);await page.goto('/');
  const describe=async l=>({query:l.toString(),count:await l.count(),html:await l.first().evaluate(el=>el.outerHTML.slice(0,800)).catch(()=>null)});
  evidence.booksCandidates=await page.getByRole('link',{name:/Books/i}).evaluateAll(es=>es.map(e=>({text:e.textContent,href:e.getAttribute('href')})));
  evidence.booksUnanchored=await describe(await resolveNamed(page,'Books'));
  evidence.booksAnchored=await describe(await resolveNamed(page,/^Books$/i));
  await (await resolveNamed(page,'Shelves')).click();
  await page.getByText('Shelf 4.4.2',{exact:true}).waitFor();
  await page.getByText('Shelf 4.4.2',{exact:true}).click();
  await page.getByRole('link',{name:/^Delete$/i}).waitFor();
  evidence.deleteButton=await describe(page.getByRole('button',{name:/Delete/i}));
  evidence.deleteLink=await describe(page.getByRole('link',{name:/^Delete$/i}));
  evidence.deleteLadder=await describe(await resolveNamed(page,/Delete/i));
 } finally {await browser.close();}
});
writeFileSync('out/bookstack-diagnostics.json',JSON.stringify(evidence,null,2)+'\n');
console.log('Recorded Books/BookStack ambiguity and Delete role evidence.');
