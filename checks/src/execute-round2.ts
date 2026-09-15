import { expect, type Locator, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { fillField, hoverNamed, resolveNamed } from './ladder.js';
import { normalizeRound2, round2CheckSchema, type Round2Check } from './round2-schema.js';
import { emptyResolver, resultSchema, type Result, type Step } from './steps.js';

export async function executeRound2Check(page:Page,input:Round2Check,file:string):Promise<Result> {
 const check=round2CheckSchema.parse(input),normalized=normalizeRound2(check);
 const result:Result={scenario:check.scenario,requirement:check.requirement,status:'fail',failedStep:null,resolver:emptyResolver(),error:'Test did not finish'};
 const save=()=>writeFileSync(file,JSON.stringify(resultSchema.parse(result),null,2)+'\n');
 if(check.status==='unknown') {
  result.status='unknown';result.failedStep={phase:'compile',index:'unknown',step:normalized.then[0]};result.error=`${check.reason}: ${check.detail}`;save();return result;
 }
 const selected=(l:Locator)=>{
  const query=l.toString();
  result.resolver.rungHit=query.includes('getByRole')?query.match(/getByRole\(['"]([^'"]+)/)?.[1]??'role':query.includes('getByLabel')?'label':query.includes('getByPlaceholder')?'placeholder':query.includes('getByText')?'text':query.includes('textarea')?'textarea':null;
  save();
 };
 // Observe existing helper calls synchronously; do not issue an extra locator
 // query, visibility check, DOM snapshot, sleep or assertion before any action.
 const wrap=(original:any):any=>new Proxy(original,{get(target,key){
  const member=Reflect.get(target,key,target);
  if(typeof member!=='function'||key==='constructor')return member;
  return (...args:any[])=>{
   if(['click','hover','fill','check','uncheck'].includes(String(key)))selected(target);
   const answer=member.apply(target,args);
   return answer&&typeof answer==='object'&&!(answer instanceof Promise)&&typeof answer.locator==='function'?wrap(answer):answer;
  };
 }});
 const observed=wrap(page) as Page;
 async function perform(step:Step,phase:string,index:string) {
  result.failedStep={phase,index,step};result.resolver=emptyResolver();
  const names='target' in step&&step.target?(step.target.name??[]).map(n=>new RegExp(typeof n==='string'?n:n.regex,'i')):[];
  result.resolver.pattern=names.length?names.map(String).join(' | '):null;save();
  switch(step.op) {
   case 'open':await page.goto('/');break;
   case 'click':await (await resolveNamed(observed,names)).click();break;
   case 'hover':await hoverNamed(observed,names);break;
   case 'fill':await fillField(observed,names,step.value as string);break;
   case 'check':{const l=await resolveNamed(observed,names);if(step.checked)await l.check();else await l.uncheck();break;}
   case 'press':await page.keyboard.press(step.key);break;
   case 'expectText':{const l=await resolveNamed(page,names);selected(l);await expect(l).toBeVisible();break;}
   case 'expectAbsent':{const l=page.getByText(names[0]);selected(l);await expect(l).toHaveCount(0);break;}
   default:throw Error(`Forbidden round-two operation ${step.op}`);
  }
 }
 try {
  for(const [i,s] of normalized.given.entries())await perform(s,'given',String(i));
  let n=0;for(const group of check.when)for(const [i] of group.steps.entries())await perform(normalized.when[n++],'when',`${group.sentence}.${i}`);
  for(const [i,s] of normalized.then.entries())await perform(s,'then',String(i));
  result.status='pass';result.failedStep=null;result.error=null;
 } catch(error){result.error=error instanceof Error?error.message:String(error);}
 save();return result;
}
