import { z } from 'zod';
import { categorySchema, reasonSchema, type Check, type Step } from './steps.js';

// Model-facing format: phase-specific strict objects disallow role/via/scope and
// arbitrary runtime code. Unknown is a CHECK state, not an executable Step.
const names = z.array(z.string().min(1)).min(1).max(3);
const open = z.strictObject({op:z.literal('open')});
const click = z.strictObject({op:z.literal('click'),name:names});
const hover = z.strictObject({op:z.literal('hover'),name:names});
const fill = z.strictObject({op:z.literal('fill'),name:names,value:z.string()});
const check = z.strictObject({op:z.literal('check'),name:names,checked:z.boolean()});
const press = z.strictObject({op:z.literal('press'),key:z.string().min(1)});
export const givenSchema = z.array(z.union([open,click])).min(1);
export const whenSchema = z.array(z.strictObject({sentence:z.number().int().min(0),steps:z.array(z.union([hover,click,fill,check,press])).max(2)}));
export const thenSchema = z.array(z.union([
 z.strictObject({op:z.literal('expectText'),name:names}),
 z.strictObject({op:z.literal('expectAbsent'),name:names}),
])).min(1);
const metadata={version:z.literal(2),scenario:z.string(),requirement:z.string(),title:z.string(),category:categorySchema,rationale:z.string().min(1)};
export const round2CheckSchema = z.discriminatedUnion('status',[
 z.strictObject({...metadata,status:z.literal('compiled'),given:givenSchema,when:whenSchema,then:thenSchema}),
 z.strictObject({...metadata,status:z.literal('unknown'),reason:reasonSchema,detail:z.string().min(1)}),
]);
export type Round2Check=z.infer<typeof round2CheckSchema>;
export const round2ChecksSchema=z.array(round2CheckSchema);
export type ScenarioSource={scenario:string;requirement:string;title:string;group:string;source:unknown};
const escape=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s+');
const quoted=(s:string)=>[...s.matchAll(/["“]([^"”\n]+)["”]|`([^`\n]+)`/g)].map(m=>m[1]??m[2]);
const normalize=(s:string)=>s.toLowerCase().replace(/\s+/g,' ').trim();
const lexical=(s:string):string[]=>normalize(s).match(/[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*/gu)??[];
const verbs=['open','click','view','enter','close','delete','undo','archive','unarchive','choose','select','clear','edit','save','pin','unpin','search','toggle','collapse','expand','cancel','confirm','login','log in','favorite','unfavorite','restore'];
export function sentenceTexts(row:ScenarioSource,keyword:string):string[] {
 const source=row.source as {scenario:{steps:{keyword:string;content:string}[]}};
 return source.scenario.steps.filter(s=>s.keyword.toUpperCase()===keyword).flatMap(s=>s.content.split(/(?<=[.!?])\s+(?=[A-Z])/).filter(Boolean));
}
function sourceText(row:ScenarioSource):string {
 const s=row.source as {requirement:{name:string;description?:string};scenario:{steps:{content:string}[]}};
 return [s.requirement.name,s.requirement.description??'',...s.scenario.steps.map(x=>x.content)].join('\n');
}
function sourcePhrase(pattern:string,sources:string[],literalsOnly=false):boolean {
 // Allow only a source literal with whitespace normalization and optional paired
 // anchors. No invented regex alternatives, wildcards, selectors or lookarounds.
 const p=pattern.startsWith('^')&&pattern.endsWith('$')?pattern.slice(1,-1):pattern;
 return sources.some(s=>{
  if(normalize(escape(s))===normalize(p))return true;
  if(literalsOnly)return false;
  const words=s.match(/[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*|[^\s\p{L}\p{N}]/gu)??[];
  // Runtime names are short contiguous phrases, not entire serialized documents.
  for(let i=0;i<words.length;i++) for(let n=1;n<=8&&i+n<=words.length;n++) {
   const phrase=words.slice(i,i+n).join(' ');
   if(normalize(escape(phrase))===normalize(p))return true;
  }
  return false;
 });
}
function seedTitles(contract:unknown):string[] {
 const titles:string[]=[];
 const walk=(v:any)=>{
  if(!v||typeof v!=='object')return;
  if(typeof v.title==='string')titles.push(v.title);
  for(const x of Object.values(v))if(typeof x==='object')walk(x);
 };
 const c=contract as any;walk(c.seeds);return [...new Set(titles)];
}
export function grounding(row:ScenarioSource,requirementsText:string,contract:unknown) {
 const text=sourceText(row), when=sentenceTexts(row,'WHEN'), then=sentenceTexts(row,'THEN');
 return {whenSentences:when,quotedLiterals:quoted(text),sharedQuotedLiterals:quoted(requirementsText),hoverTitles:seedTitles(contract),thenSentences:then};
}
export function groundedCheckSchema(row:ScenarioSource,requirementsText:string,contract:unknown) {
 const g=grounding(row,requirementsText,contract);
 return round2CheckSchema.superRefine((c,ctx)=>{
  const issue=(message:string)=>ctx.addIssue({code:'custom',message});
  if(c.scenario!==row.scenario||c.requirement!==row.requirement||c.title!==row.title)issue('Scenario identity/title must match assigned input exactly');
  if(c.status==='unknown')return;
  if(c.given[0]?.op!=='open'||c.given.slice(1).some(s=>s.op==='open'))issue('GIVEN must begin with exactly one open; reload is forbidden');
  const navigationNames=new Set<string>();
  for(const s of c.given)if(s.op==='click') {
   for(const name of s.name)if(!sourcePhrase(name,[requirementsText]))issue(`GIVEN navigation name absent from requirements: ${name}`);
   const key=s.name.join('|').toLowerCase();if(navigationNames.has(key))issue('Repeated navigation is not a minimal preparation path');navigationNames.add(key);
  }
  if(c.when.length!==g.whenSentences.length)issue('Exactly one WHEN group per original sentence; do not split comma/AND clauses');
  c.when.forEach((group,i)=>{
   if(group.sentence!==i)issue('WHEN sentence order or index changed');
   const sentence=g.whenSentences[i]??'';
   const words=lexical(sentence);
   const actionWords=verbs.filter(v=>words.includes(v)||normalize(sentence).includes(' '+v+' '));
   for(const s of group.steps) {
    if(s.op==='hover')for(const name of s.name)if(!sourcePhrase(name,g.hoverTitles,true))issue(`Hover must name an exact seed title: ${name}`);
    if(s.op==='click')for(const name of s.name)if(!sourcePhrase(name,[...g.quotedLiterals,...g.sharedQuotedLiterals,...actionWords],true))issue(`Click must name an original verb or quoted literal: ${name}`);
    if(s.op==='fill'||s.op==='check')for(const name of s.name)if(!sourcePhrase(name,[requirementsText]))issue(`Field name absent from requirements: ${name}`);
   }
  });
  for(const s of c.then)for(const name of s.name)if(!sourcePhrase(name,[...g.thenSentences,...g.quotedLiterals,...g.sharedQuotedLiterals]))issue(`THEN name absent from THEN/literals: ${name}`);
 });
}
export function normalizeRound2(c:Round2Check):Check {
 const meta={scenario:c.scenario,requirement:c.requirement,title:c.title,category:c.category,rationale:c.rationale};
 if(c.status==='unknown')return {...meta,given:[],when:[],then:[{op:'unknown',reason:c.reason,detail:c.detail}]};
 const step=(s:any):Step=>{
  if(s.op==='open'||s.op==='press')return s;
  const {name,...rest}=s;return {...rest,target:{name:name.map((regex:string)=>({regex,flags:'i'}))}} as Step;
 };
 return {...meta,given:c.given.map(step),when:c.when.flatMap(g=>g.steps.map(step)),then:c.then.map(step)};
}
