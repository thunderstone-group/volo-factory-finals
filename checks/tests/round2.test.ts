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
