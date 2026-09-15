import { describe,it,expect } from 'vitest';
import { groundedCheckSchema, round2CheckSchema, normalizeRound2 } from '../src/round2-schema.js';
import { cost } from '../src/model-call.js';
const row={scenario:'REQ-1#1',requirement:'REQ-1',title:'Delete',group:'ROOT',source:{requirement:{name:'Delete',description:'Seed titled "Note A".'},scenario:{steps:[{keyword:'GIVEN',content:'User is on the home page.'},{keyword:'WHEN',content:'Hover the note and click Delete.'},{keyword:'THEN',content:'"Note A" is absent.'}]}}};
const document='The "Notes" navigation displays the "Note A" title. The user can click Delete.';
const contract={seeds:[{fields:{title:'Note A'}}]};
const check:any={version:2,status:'compiled',scenario:row.scenario,requirement:row.requirement,title:row.title,category:'delete',rationale:'Synthetic schema test',given:[{op:'open'}],when:[{sentence:0,steps:[{op:'hover',name:['Note\\s+A']},{op:'click',name:['Delete']}]}],then:[{op:'expectAbsent',name:['Note\\s+A']}]};
describe('round two enforced compiler contract',()=>{
 it('accepts only source-grounded names and translates to the ladder',()=>{
  const parsed=groundedCheckSchema(row,document,contract).parse(check),runtime=normalizeRound2(parsed);
  expect(runtime.when[0]).toEqual({op:'hover',target:{name:[{regex:'Note\\s+A',flags:'i'}]}});
  expect(JSON.stringify(runtime)).not.toContain('via');
  expect(groundedCheckSchema(row,document,contract).safeParse({...check,then:[{op:'expectAbsent',name:['Note A']}]}).success).toBe(true);
 });
 it('rejects every non-navigation GIVEN op and expects before THEN',()=>{
  for(const op of ['expectText','expectAbsent','hover','fill','check','press'])expect(()=>round2CheckSchema.parse({...check,given:[{op,name:['Notes']}]})).toThrow();
  expect(()=>round2CheckSchema.parse({...check,when:[{sentence:0,steps:[{op:'expectText',name:['Notes']}]}]})).toThrow();
 });
 it('rejects role, via, exact, scope and compound actions',()=>{
  for(const forbidden of [{via:'text'},{role:'button'},{exact:true},{within:{name:['Notes']}}])expect(()=>round2CheckSchema.parse({...check,when:[{sentence:0,steps:[{op:'hover',name:['Note\\s+A'],...forbidden}]}]})).toThrow();
  for(const op of ['expectState','expectCount','capture','compare','if','try','selectOption','click'])expect(()=>round2CheckSchema.parse({...check,then:[{op,name:['Note\\s+A']}]})).toThrow();
 });
 it('enforces two steps per original sentence without invented splitting',()=>{
  expect(()=>round2CheckSchema.parse({...check,when:[{sentence:0,steps:[...check.when[0].steps,{op:'press',key:'Escape'}]}]})).toThrow();
  expect(()=>groundedCheckSchema(row,document,contract).parse({...check,when:[...check.when,{sentence:1,steps:[]}]})).toThrow('original sentence');
 });
 it('rejects invented names, arbitrary regex, non-seed hover and repeated navigation',()=>{
  for(const name of ['Invented','.*','Note.*','Delete|Save'])expect(()=>groundedCheckSchema(row,document,contract).parse({...check,when:[{sentence:0,steps:[{op:'hover',name:[name]}]}]})).toThrow('exact seed title');
  expect(()=>groundedCheckSchema(row,document,contract).parse({...check,when:[{sentence:0,steps:[{op:'click',name:['Publish']}]}]})).toThrow('verb or quoted literal');
  expect(()=>groundedCheckSchema(row,document,contract).parse({...check,then:[{op:'expectText',name:['Saved successfully']}]})).toThrow('THEN name');
  expect(()=>groundedCheckSchema(row,document,contract).parse({...check,given:[{op:'open'},{op:'click',name:['Notes']},{op:'click',name:['Notes']}]})).toThrow('minimal');
 });
 it('cannot move WHEN navigation into initial-page GIVEN',()=>{
  expect(()=>groundedCheckSchema(row,document,contract).parse({...check,given:[{op:'open'},{op:'click',name:['Notes']}],when:[{sentence:0,steps:[]}]})).toThrow('extra navigation');
 });
 it('keeps unknown out of all executable phases',()=>{
  const {given,when,then,...meta}=check;
  const unknown=round2CheckSchema.parse({...meta,status:'unknown',reason:'unsupported',detail:'Three required actions exceed the two-step cap.'});
  expect(normalizeRound2(unknown).then[0].op).toBe('unknown');
  expect(()=>round2CheckSchema.parse({...unknown,given:[{op:'open'}]})).toThrow();
 });
 it('accounts both requested models including cache discounts',()=>{
  const usage={prompt_tokens:1000,prompt_tokens_details:{cached_tokens:500},completion_tokens:100};
  expect(cost('qwen3.8-max',usage)).toBeCloseTo(0.01035);
  expect(cost('deepseek-v4-flash',usage)).toBeCloseTo(0.00245);
 });
});

describe('round two execution and recall policy',()=>{
 it('hover uses the named ladder, without an extra visibility probe',async()=>{
  const {executeRound2Check}=await import('../src/execute-round2.js');
  const {mkdirSync,rmSync}=await import('node:fs');
  const events:string[]=[];
  const locator:any={locator:()=>locator,first:()=>locator,toString:()=>"getByRole('button', { name: /Note A/i }).first()",isVisible:async()=>{events.push('visible');return true;},count:async()=>{events.push('count');return 1;},hover:async()=>{events.push('hover');},click:async()=>{throw Error('synthetic action failure');}};
  const page:any={goto:async()=>events.push('open'),locator:()=>locator,getByRole:()=>locator,getByLabel:()=>locator,getByPlaceholder:()=>locator,getByText:()=>{throw Error('Text-only selection bypassed the ladder');}};
  // namedLocators constructs its final text rung, but must not query or hover it.
  page.getByText=()=>({first:()=>{throw Error('Text rung was queried');}});
  mkdirSync('out/test',{recursive:true});
  try {
   const result=await executeRound2Check(page,{...check,when:[{sentence:0,steps:[{op:'hover',name:['Note A']},{op:'click',name:['Delete']}]}]},'out/test/round2-hover.json');
   expect(result.status).toBe('fail');
   expect(events).toEqual(['open','visible','visible','hover','visible','visible']);
   expect(result.failedStep?.index).toBe('0.1');
  } finally {rmSync('out/test',{recursive:true,force:true});}
 });
 it('excludes unknown from recall but rejects a zero observed denominator',async()=>{
  const {calibration}=await import('../src/calibrate.js');
  const {emptyResolver}=await import('../src/steps.js');
  const c1=normalizeRound2(check),c2={...c1,scenario:'REQ-2#1',requirement:'REQ-2'};
  const official={profile:'hosted',workers:4,test_timeout_ms:10000,total:2,passed:2,failed:0,failed_titles:[]};
  const results=[c1,c2].map((c,i)=>({scenario:c.scenario,requirement:c.requirement,status:(i?'unknown':'pass') as 'pass'|'unknown',failedStep:null,resolver:emptyResolver(),error:null}));
  const r=calibration([c1,c2],results,official,true);
  expect(r.officialPassRecall).toBe(1);expect(r.denominator).toBe(2);expect(r.coverage).toBe(0.5);expect(r.fullDenominatorRecall).toBe(0.5);
  const none=calibration([c1,c2],results.map(r=>({...r,status:'unknown' as const})),official,true);
  expect(none.officialPassRecall).toBe(null);expect(none.accepted).toBe(false);
 });
});
