import { expect, type Locator, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { fillField, firstVisible, namedLocators, resolveNamed, toPatterns } from './ladder.js';
import { emptyResolver, flatten, resultSchema, type Check, type Match, type Result, type Step, type Target, type Value } from './steps.js';

type Scope = Page | Locator;
export function pattern(m: Match, variables: Map<string, unknown>, exact = false): RegExp {
 if(typeof m !== 'string') return new RegExp(m.regex,m.flags);
 const text=m.replace(/\$\{([^}]+)\}/g,(_,key)=>{
  if(!variables.has(key)) throw Error(`Unbound variable ${key}`);
  return String(variables.get(key));
 });
 const p=toPatterns(text)[0];return exact?new RegExp(`^(?:${p.source})$`,p.flags):p;
}
function value(v: Value, variables: Map<string, unknown>): string {
 if(typeof v==='string') return v;
 if(!variables.has(v.variable)) throw Error(`Unbound variable ${v.variable}`);
 return String(variables.get(v.variable));
}
const rungs=['button','link','menuitem','tab','checkbox','heading','option','label','placeholder','text'];
export async function executeCheck(page: Page, check: Check, resultFile: string): Promise<Result> {
 const result:Result={scenario:check.scenario,requirement:check.requirement,status:'fail',failedStep:null,resolver:emptyResolver(),error:'Test did not finish'};
 const save=()=>writeFileSync(resultFile,JSON.stringify(resultSchema.parse(result),null,2)+'\n');
 const variables=new Map<string,unknown>();
 let diagnostic: {scope:Scope; candidates: {name:string; locator:Locator}[]} | undefined;
 const unknown=flatten([...check.given,...check.when,...check.then]).find(s=>s.op==='unknown');
 if(unknown?.op==='unknown') {
  result.status='unknown';result.error=`${unknown.reason}: ${unknown.detail}`;
  const phase=(['given','when','then'] as const).find(p=>flatten(check[p]).includes(unknown))!;
  result.failedStep={phase,index:'unknown',step:unknown};save();return result;
 }
 async function target(t:Target, scope:Scope=page):Promise<Locator> {
  if(t.within) scope=await target(t.within,scope);
  const patterns=(t.name??[]).map(m=>pattern(m,variables,t.exact));
  const via=t.via??'ladder';
  result.resolver={...emptyResolver(),scope:t.within?JSON.stringify(t.within):'page',pattern:patterns.map(String).join(' | ')};
  let choices:{name:string;locator:Locator}[]=[];
  if(via==='role') choices=[{name:`role:${t.role}`,locator:scope.getByRole(t.role as Parameters<Scope['getByRole']>[0],{name:patterns[0],exact:t.exact})}];
  else if(via==='text') choices=patterns.map(p=>({name:'text',locator:scope.getByText(p)}));
  else if(via==='field') choices=patterns.flatMap(p=>[
   {name:'label',locator:scope.getByLabel(p)}, {name:'placeholder',locator:scope.getByPlaceholder(p)},
   {name:'textbox',locator:scope.getByRole('textbox',{name:p})},{name:'searchbox',locator:scope.getByRole('searchbox',{name:p})},
  ]);
  else choices=patterns.flatMap(p=>namedLocators(scope,p).map((locator,i)=>({name:rungs[i],locator})));
  diagnostic={scope,candidates:choices};
  const locator=via==='ladder'?await resolveNamed(scope,patterns):via==='field'?await firstVisible(choices.map(c=>c.locator)):choices[0].locator.first();
  const hit=choices.find(c=>c.locator.first().toString()===locator.toString());
  result.resolver.rungHit=hit?.name??null;save();return locator;
 }
 async function collection(t:Target):Promise<Locator> {
  const loc=await target(t);
  // Count/absence operate on the entire matching locator, never the .first().
  return diagnostic!.candidates.find(c=>c.locator.first().toString()===loc.toString())?.locator??loc;
 }
 async function diagnose() {
  if(!diagnostic) return;
  const candidates:string[]=[],hidden:string[]=[];
  for(const {name,locator} of diagnostic.candidates) {
   if(candidates.length>=40) break;
   const rows=await locator.evaluateAll((elements,limit)=>elements.slice(0,limit).map(el=>({
    label:`${el.tagName.toLowerCase()}: ${el.getAttribute('aria-label')??el.getAttribute('placeholder')??el.textContent??''}`.replace(/\s+/g,' ').slice(0,220),
    visible:!!(el.getClientRects().length) && getComputedStyle(el).visibility!=='hidden',
   })),40-candidates.length).catch(()=>[]);
   for(const row of rows) {const label=`${name}: ${row.label}`;candidates.push(label);if(!row.visible)hidden.push(label);}
  }
  result.resolver.candidates=candidates;result.resolver.hidden=hidden;save();
 }
 // Preserve the copied fillField's exact control flow; observe the actual .fill
 // call (including fallback/retries) through a proxy instead of resolving twice.
 function observe(scope:Scope):Scope {
  const wrap=(obj:any):any=>new Proxy(obj,{get(original,key){
   const member=Reflect.get(original,key,original);
   if(typeof member!=='function') return member;
   return (...args:any[])=>{
    if(key==='fill') {
     const description=original.toString();
     result.resolver.rungHit=description.includes('getByLabel')?'label':description.includes('getByPlaceholder')?'placeholder':description.includes('searchbox')?'searchbox':description.includes('textarea')?'textarea':'textbox';
     save();
    }
    const answer=member.apply(original,args);
    return answer && typeof answer==='object' && typeof answer.locator==='function' && !(answer instanceof Promise)?wrap(answer):answer;
   };
  }});
  return wrap(scope);
 }
 async function perform(step:Step):Promise<void> {
  switch(step.op) {
   case 'open': await page.goto('/'); break;
   case 'bind': variables.set(step.variable,step.value); break;
   case 'click': await (await target(step.target)).click(); break;
   case 'hover': await (await target(step.target)).hover(); break;
   case 'fill': {
    const scope=step.target.within?await target(step.target.within):page;
    const patterns=(step.target.name??[]).map(m=>pattern(m,variables,step.target.exact));
    if(step.target.via==='role'||step.target.via==='text') await (await target(step.target)).fill(value(step.value,variables));
    else {
     // Build diagnostics, but let the unmodified helper perform all selections.
     result.resolver={...emptyResolver(),pattern:patterns.map(String).join(' | '),scope:step.target.within?JSON.stringify(step.target.within):'page'};
     diagnostic={scope,candidates:patterns.flatMap(p=>[
      {name:'label',locator:scope.getByLabel(p)},{name:'placeholder',locator:scope.getByPlaceholder(p)},
      {name:'textbox',locator:scope.getByRole('textbox',{name:p})},{name:'searchbox',locator:scope.getByRole('searchbox',{name:p})},
     ]).concat([{name:'textbox-fallback',locator:scope.getByRole('textbox')},{name:'textarea-fallback',locator:scope.locator('textarea')}])};
     await fillField(observe(scope),patterns,value(step.value,variables));
    }
    break;
   }
   case 'check': { const l=await target(step.target);try {await l.setChecked(step.checked);} catch(e) {if(!step.clickFallback)throw e;await l.click();}break; }
   case 'press': if(step.target) await (await target(step.target)).press(step.key);else await page.keyboard.press(step.key);break;
   case 'selectOption': await (await target(step.target)).selectOption({label:step.label});break;
   case 'expectText': await expect(await target(step.target)).toBeVisible();break;
   case 'expectAbsent': await expect(await collection(step.target)).toHaveCount(0);break;
   case 'expectCount': await expect(await collection(step.target)).toHaveCount(step.count);break;
   case 'expectState': {
    const l=await target(step.target), assertion=step.value?expect(l):expect(l).not;
    switch(step.state) {
     case 'visible': await assertion.toBeVisible();break; case 'hidden':await assertion.toBeHidden();break;
     case 'checked':await assertion.toBeChecked();break;case 'disabled':await assertion.toBeDisabled();break;
     case 'enabled':await assertion.toBeEnabled();break;case 'editable':await assertion.toBeEditable();break;
    }break;
   }
   case 'expectField': await expect(await target(step.target)).toHaveValue(typeof step.value==='object' && 'regex' in step.value?pattern(step.value,variables):value(step.value as Value,variables));break;
   case 'expectFeedback': {
    if(step.target) await expect(await target(step.target)).toBeVisible();
    else {
     const p=step.kind==='success'?/success|saved|created|deleted|updated/i:/error|invalid|required|incorrect|failed/i;
     const choices=[page.getByRole('alert'),page.getByRole('status'),page.getByText(p)];
     diagnostic={scope:page,candidates:choices.map((locator,i)=>({name:['alert','status','text'][i],locator}))};
     const l=await firstVisible(choices);
     result.resolver={...emptyResolver(),pattern:String(p),rungHit:diagnostic.candidates.find(c=>c.locator.first().toString()===l.toString())?.name??null};save();
     await expect(l).toBeVisible();
    }break;
   }
   case 'capture': {
    const l=await target(step.target);let captured:unknown;
    if(step.kind==='count') captured=await (await collection(step.target)).count();
    else if(step.kind==='text') captured=await l.innerText();
    else if(step.kind==='value') captured=await l.inputValue();
    else {
     await expect(l).toBeVisible();const box=await l.boundingBox(),viewport=page.viewportSize(),padding=step.padding??0;
     if(!box||!viewport)throw Error('Capture target has no bounding box or viewport');
     const x=Math.max(0,box.x-padding),y=Math.max(0,box.y-padding);
     captured=await page.screenshot({clip:{x,y,width:Math.min(viewport.width-x,box.width+padding*2),height:Math.min(viewport.height-y,box.height+padding*2)}});
    }
    variables.set(step.variable,captured);break;
   }
   case 'compare': {
    if(!variables.has(step.left)||!variables.has(step.right)) throw Error('Compare references an unbound capture');
    const assertion=step.relation==='equal'?expect(variables.get(step.left)):expect(variables.get(step.left)).not;
    assertion.toEqual(variables.get(step.right));break;
   }
   case 'unknown': throw Error(`${step.reason}: ${step.detail}`);
   case 'if': case 'try': throw Error('Compound step must be dispatched by walk');
  }
 }
 async function walk(steps:Step[],phase:string,prefix='') {
  for(const [i,step] of steps.entries()) {
   const index=`${prefix}${i}`;
   result.failedStep={phase,index,step};result.resolver=emptyResolver();diagnostic=undefined;save();
   if(step.op==='if') {
    const l=await target(step.target),condition=step.state==='exists'?await l.count()>0:await l.isVisible();
    await walk(condition?step.then:step.else,phase,index+(condition?'.then.':'.else.'));
   } else if(step.op==='try') {
    try {await walk(step.steps,phase,index+'.try.');} catch {await walk(step.fallback,phase,index+'.fallback.');}
   } else await perform(step);
  }
 }
 save();
 try {
  for(const phase of ['given','when','then'] as const) await walk(check[phase],phase);
  result.status='pass';result.failedStep=null;result.error=null;save();
 } catch(error) {
  result.status='fail';result.error=error instanceof Error?error.message:String(error);save();
  await diagnose().catch(()=>{});
 }
 return result;
}
