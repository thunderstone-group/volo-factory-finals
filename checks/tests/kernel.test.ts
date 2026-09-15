import { describe, it, expect } from 'vitest';
import { firstVisible, namedLocators, resolveNamed, fillField, toPatterns } from '../src/ladder.js';
import { checksSchema, resultSchema, emptyResolver, type Check, type Result } from '../src/steps.js';
import { inputApp, scenarios, validateCoverage } from '../src/compile.js';
import { renderSpec, mergeResults } from '../src/run.js';
import { calibration, officialMap } from '../src/calibrate.js';

// Synthetic locator doubles: these exercise control flow, not browser fidelity.
function fake(visible:boolean, count=1) {
 const calls:string[]=[];
 const locator:any={first:()=>locator,isVisible:async()=>{calls.push('visible');return visible;},count:async()=>{calls.push('count');return count;},fill:async(value:string)=>{calls.push('fill:'+value);}};
 return {locator,calls};
}
const check:Check={scenario:'REQ-1#1',requirement:'REQ-1',title:'Home',category:'navigation',rationale:'Synthetic unit fixture',given:[{op:'open'}],when:[],then:[{op:'expectText',target:{name:['Home']}}]};
const result:Result={scenario:check.scenario,requirement:check.requirement,status:'pass',failedStep:null,resolver:emptyResolver(),error:null};

describe('official Keep ladder semantics',()=>{
 it('retains all ten rungs in exact order',()=>{
  const order:string[]=[];
  const scope:any={getByRole:(role:string)=>{order.push(role);return fake(true).locator;},getByLabel:()=>{order.push('label');return fake(true).locator;},getByPlaceholder:()=>{order.push('placeholder');return fake(true).locator;},getByText:()=>{order.push('text');return fake(true).locator;}};
  namedLocators(scope,/name/i);
  expect(order).toEqual(['button','link','menuitem','tab','checkbox','heading','option','label','placeholder','text']);
 });
 it('checks the FIRST candidate of each rung, then existing hidden candidates',async()=>{
  const hidden=fake(false),visible=fake(true);
  expect(await firstVisible([hidden.locator,visible.locator])).toBe(visible.locator);
  expect(hidden.calls).toEqual(['visible']);
  const missing=fake(false,0);
  expect(await firstVisible([missing.locator,hidden.locator])).toBe(hidden.locator);
  expect(hidden.calls.at(-1)).toBe('count');
 });
 it('returns the first rung when every candidate is missing',async()=>{
  const a=fake(false,0),b=fake(false,0);
  expect(await firstVisible([a.locator,b.locator])).toBe(a.locator);
 });
 it('uses alternate patterns before falling back to hidden first-pattern matches',async()=>{
  const first=fake(false),second=fake(true);
  const get=(_role:any,{name}:any)=>name.source==='second'?second.locator:first.locator;
  const scope:any={getByRole:get,getByLabel:(p:any)=>get('',{name:p}),getByPlaceholder:(p:any)=>get('',{name:p}),getByText:(p:any)=>get('',{name:p})};
  expect(await resolveNamed(scope,[/first/,/second/])).toBe(second.locator);
 });
 it('escapes literal punctuation and expands whitespace',()=>{
  expect(toPatterns('A (B)   C')[0].test('a (b)\n c')).toBe(true);
  expect(toPatterns('A.B')[0].test('axb')).toBe(false);
 });
 it('retains searchbox and unnamed textarea fallback in fillField',async()=>{
  const hidden=fake(false,0),textarea=fake(true);const names:string[]=[];
  const scope:any={getByLabel:()=>hidden.locator,getByPlaceholder:()=>hidden.locator,getByRole:(role:string)=>{names.push(role);return hidden.locator;},locator:(selector:string)=>{names.push(selector);return textarea.locator;}};
  await fillField(scope,'Content','example');
  expect(names).toEqual(['textbox','searchbox','textbox','textarea']);expect(textarea.calls).toContain('fill:example');
 });
});
describe('schema and fixed scene denominator',()=>{
 it('recognizes the real Bookstack requirement root title',()=>{
  expect(inputApp('BookStack Knowledge Base System')).toBe('bookstack');
  expect(inputApp('Keep')).toBe('keep');
  expect(()=>inputApp('Different application')).toThrow('Unsupported application');
 });
 it('enumerates sibling scenarios without deduplicating requirement IDs',()=>{
  const rows=scenarios({id:'ROOT',name:'Keep',type:'FOLDER',children:[{id:'REQ-1',name:'Home',type:'ATOMIC',scenarios:[{name:'A',steps:[]},{name:'B',steps:[]}]}]});
  expect(rows.map(r=>r.scenario)).toEqual(['REQ-1#1','REQ-1#2']);
  expect(()=>validateCoverage([check],rows)).toThrow('Expected 2');
  expect(()=>validateCoverage([check,check],rows)).toThrow('duplicate');
 });
 it('rejects ungrounded navigation and malformed unknown reasons',()=>{
  expect(()=>checksSchema.parse([{...check,given:[{op:'open',url:'/admin'}]}])).toThrow();
  expect(()=>checksSchema.parse([{...check,then:[{op:'unknown',reason:'timeout',detail:'network'}]}])).toThrow();
  expect(()=>validateCoverage([{...check,then:[{op:'click',target:{name:['Home']}}]}],[{scenario:check.scenario,requirement:check.requirement,title:check.title,group:'ROOT',source:{}}])).toThrow('No THEN assertion');
 });
 it('supports nested scopes, select, captures, count/state and all unknown reasons',()=>{
  for(const reason of ['unsupported','no-preparation-path','ambiguous-assertion']) {
   expect(checksSchema.parse([{...check,when:[{op:'selectOption',target:{via:'role',role:'combobox',within:{via:'role',role:'dialog',name:['Form']}},label:'A'},{op:'press',key:'Escape'},{op:'capture',target:{name:['Home']},variable:'before',kind:'screenshot'}],then:[{op:'expectCount',target:{via:'text',name:['A']},count:0},{op:'expectState',target:{name:['A']},state:'disabled',value:true},{op:'unknown',reason,detail:'Not observable'}]}])).toHaveLength(1);
  }
 });
});
describe('Step rendering and result integrity',()=>{
 it('serializes JSON without executing strings as generated code',()=>{
  const malicious={...check,title:"'); process.exit(1); //",when:[{op:'bind' as const,variable:'v',value:'` ${process.env.SECRET}',source:'Synthetic'}]};
  const spec=renderSpec([malicious],'/tmp/results');
  expect(spec).toContain(JSON.stringify(malicious));expect(spec).toContain('executeCheck');expect(spec).not.toContain('beforeEach');
  expect(()=>renderSpec([check,{...check,requirement:'REQ-2'}],'/tmp/results')).toThrow();
 });
 it('bounds diagnostics and requires structured failure fields',()=>{
  expect(resultSchema.parse(result)).toEqual(result);
  expect(()=>resultSchema.parse({...result,resolver:{...emptyResolver(),candidates:Array(41).fill('x')}})).toThrow();
  expect(()=>resultSchema.parse({...result,status:'skipped'})).toThrow();
 });
 it('a Playwright timeout overrides stale pass and retains failed-step evidence',()=>{
  const partial={...result,failedStep:{phase:'when',index:'0',step:{op:'click' as const,target:{name:['Save']}}}};
  const report={suites:[{specs:[{title:check.scenario,tests:[{status:'unexpected',results:[{errors:[{message:'Timeout 10000ms exceeded'}]}]}]}]}]};
  const merged=mergeResults([check],new Map([[check.scenario,partial]]),report);
  expect(merged[0].status).toBe('fail');expect(merged[0].failedStep?.step.op).toBe('click');expect(merged[0].error).toContain('Timeout');
  expect(()=>mergeResults([check],new Map(),{suites:[]})).toThrow('Missing');
 });
});
describe('calibration cannot manufacture agreement',()=>{
 const c2={...check,scenario:'REQ-2#1',requirement:'REQ-2'};
 const official={profile:'hosted',workers:4,test_timeout_ms:10000,total:2,passed:1,failed:1,failed_titles:['REQ-2: Home']};
 it('counts all six cells and rejects any false pass',()=>{
  const cal=calibration([check,c2],[result,{...result,scenario:c2.scenario,requirement:c2.requirement}],official);
  expect(cal.matrix.pass).toEqual({pass:1,fail:1});expect(cal.accepted).toBe(false);expect(cal.falsePasses).toEqual(['REQ-2#1']);
 });
 it('unknown preserves the denominator and does not count towards recall',()=>{
  const unknown={...check,then:[{op:'unknown' as const,reason:'unsupported' as const,detail:'Missing primitive'}]};
  const cal=calibration([unknown,c2],[{...result,status:'unknown'},{...result,scenario:c2.scenario,requirement:c2.requirement,status:'fail'}],official);
  expect(cal.unknownCount).toBe(1);expect(cal.officialPassRecall).toBe(0);expect(cal.denominator).toBe(2);expect(cal.accepted).toBe(false);
 });
 it('requires complete one-to-one evidence',()=>{
  expect(()=>officialMap([check,c2],{...official,failed_titles:['REQ-99: Unknown']})).toThrow('Unmapped');
  expect(()=>officialMap([check,{...check,scenario:'REQ-1#2'}],official)).toThrow('Multiple scenarios');
  expect(()=>calibration([check,c2],[result,result],official)).toThrow('denominator');
 });
});

describe('interpreter boundaries (synthetic Page, not browser evidence)',()=>{
 it('unknown short-circuits even in nested fallback without touching the page',async()=>{
  const {executeCheck}=await import('../src/execute.js');
  const {mkdirSync,readFileSync,rmSync}=await import('node:fs');
  mkdirSync('out/test',{recursive:true});
  const input:Check={...check,when:[{op:'try',steps:[{op:'click',target:{name:['Save']}}],fallback:[{op:'unknown',reason:'no-preparation-path',detail:'Missing route'}]}]};
  const page=new Proxy({},{get(){throw Error('No browser operation allowed');}});
  try {
   const r=await executeCheck(page as any,input,'out/test/unknown.json');
   expect(r.status).toBe('unknown');expect(r.error).toContain('no-preparation-path');
   expect(resultSchema.parse(JSON.parse(readFileSync('out/test/unknown.json','utf8')))).toEqual(r);
  } finally {rmSync('out/test',{recursive:true,force:true});}
 });
 it('captures and compares actual values, and persists unbound variable failure',async()=>{
  const {executeCheck}=await import('../src/execute.js');
  const {mkdirSync,rmSync}=await import('node:fs');
  mkdirSync('out/test',{recursive:true});
  const target={via:'text' as const,name:['Value']};let current='before';
  const locator:any={first:()=>locator,toString:()=>"getByText('Value').first()",innerText:async()=>current,evaluateAll:async()=>[]};
  const page:any={getByText:()=>locator,goto:async(path:string)=>expect(path).toBe('/'),keyboard:{press:async()=>{current='after';}}};
  const input:Check={...check,given:[{op:'open'},{op:'capture',target,variable:'before',kind:'text'}],when:[{op:'press',key:'Enter'},{op:'capture',target,variable:'after',kind:'text'}],then:[{op:'compare',left:'before',right:'after',relation:'notEqual'}]};
  try {
   expect((await executeCheck(page,input,'out/test/capture.json')).status).toBe('pass');
   const bad=await executeCheck(page,{...input,then:[{op:'compare',left:'missing',right:'after',relation:'equal'}]},'out/test/missing.json');
   expect(bad.status).toBe('fail');expect(bad.failedStep?.phase).toBe('then');expect(bad.error).toContain('unbound capture');
  } finally {rmSync('out/test',{recursive:true,force:true});}
 });
});
