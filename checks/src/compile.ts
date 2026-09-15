import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { parse } from 'yaml';
import { z } from 'zod';
import { checksSchema, flatten, type Check } from './steps.js';

type Requirement = { id: string; name: string; type: string; description?: string; dependencies?: string[]; children?: Requirement[]; scenarios?: {name: string; steps: unknown[]}[] };
export function scenarios(root: Requirement) {
 const rows: {scenario: string; requirement: string; title: string; group: string; source: unknown}[] = [];
 function visit(node: Requirement, parents: Requirement[]) {
  (node.scenarios ?? []).forEach((s,i) => rows.push({ scenario: `${node.id}#${i+1}`, requirement: node.id, title:s.name,
   group: parents.at(-1)?.id ?? node.id, source: { requirement: {...node, children:undefined}, scenario:s, ancestors:parents.map(p=>({id:p.id,name:p.name,description:p.description})) } }));
  (node.children ?? []).forEach(c=>visit(c,[...parents,node]));
 }
 visit(root,[]); return rows;
}
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
export function validateCoverage(value: unknown, expected: ReturnType<typeof scenarios>): Check[] {
 const checks=checksSchema.parse(value);
 if(checks.length!==expected.length) throw Error(`Expected ${expected.length} checks, received ${checks.length}`);
 const ids=new Set<string>();
 for(const c of checks) {
  const row=expected.find(r=>r.scenario===c.scenario);
  if(!row || row.requirement!==c.requirement || ids.has(c.scenario)) throw Error(`Unexpected/duplicate scenario ${c.scenario}`);
  ids.add(c.scenario);
  const all=flatten([...c.given,...c.when,...c.then]);
  if(!all.some(s=>s.op==='unknown') && !flatten(c.then).some(s=>s.op.startsWith('expect') || s.op==='compare')) throw Error(`No THEN assertion: ${c.scenario}`);
  for(const s of all) {
   if('target' in s && s.target) checkRegex(s.target);
  }
 }
 return expected.map(r=>checks.find(c=>c.scenario===r.scenario)!);
}
function checkRegex(v: unknown): void {
 if(!v || typeof v!=='object') return;
 if('regex' in v) new RegExp(String(v.regex), 'flags' in v ? String(v.flags) : 'i');
 Object.values(v).forEach(x=>Array.isArray(x)?x.forEach(checkRegex):checkRegex(x));
}
const instructions = `Compile natural-language GIVEN/WHEN/THEN into executable UI checks for Keep or Bookstack.
The ONLY evidence is the requirements tree and state contract supplied below. No test source, app source, screenshots, official verdicts or previous runs are available. Never invent known test expectations.
Return a JSON object {"checks": Check[]} only. Every assigned scenario needs exactly one Check with its supplied scenario ID and requirement ID; preserve title. Explain preparation and any inferred UI route in rationale. Categories: read-list, create, delete, edit, state-toggle, search-filter-sort, navigation.
Plan every GIVEN from a fresh browser context and seed state. The entire suite shares one seeded server with four workers; never depend on another scenario to prepare data. Use the scenario's own seed when available. Derive dependencies and navigation from the full tree. Restore/unpin/unarchive requires performing delete/pin/archive first when the seed is active. All navigation begins with open; it only calls page.goto('/'). Later navigation uses visible UI controls, never URL paths. Do not reload or use APIs.
Targets: {name:[string or {regex,flags:"i"}],via:"ladder"|"text"|"role"|"field",role?,exact?,within?:Target}. Default ladder selects first visible FIRST candidate per rung: button,link,menuitem,tab,checkbox,heading,option,label,placeholder,text. Names are case-insensitive escaped regex with flexible whitespace; regex objects preserve explicit regex. Alternative names are ordered. Use via:text for content cards and DOM-absence assertions; via:role for explicit roles. Do not invent structural CSS selectors. within scopes every action and observation, but use it only when scope can be grounded. Fill uses label,placeholder,named textbox,searchbox then unnamed textbox/textarea fallback. Role radio is supported by check.
Primitives: open; click/hover(target); fill(target,value); check(target,checked,clickFallback?); press(key,target?); selectOption(target,label); expectText(target) asserts visible; expectAbsent(target) asserts DOM count ZERO; expectCount(target,count); expectState(target,state:visible|hidden|checked|disabled|enabled|editable,value:boolean); expectField(target,value:string|regex|{variable}); expectFeedback(kind:error|success,target?); bind(variable,value,source); capture(target,variable,kind:text|value|count|screenshot,padding?); compare(left:variableName,right:variableName,relation:equal|notEqual); if(target,state:visible|exists,then:Step[],else:Step[]); try(steps:Step[],fallback:Step[]); unknown(reason:unsupported|no-preparation-path|ambiguous-assertion,detail).
For generated form values use bind with a unique scenario-derived string and source explaining why it is valid; use {variable:"name"} in fill/expectField. In target text you may reference a bound value with "\${name}". Capture screenshots before/after the same region for visual changes, include surrounding region with padding if useful. Dismiss overlays and keep hover state consistent before comparing. Values and captures exist only within that scenario. Never substitute an unrelated visible text for a required state transition. For 'only' include both a positive and negative seed. If a THEN clause cannot be observed, emit unknown instead of silently dropping it. Dates, numeric ranges, ordering assertions and arbitrary code are unsupported. Missing images are not evidence of UI structure. Do not demand exact unquoted success/error wording. A button often names the action it WILL perform, not current state.
Checks contain scenario,requirement,title,category,rationale,given:Step[],when:Step[],then:Step[]. Each Step is an object with op plus the described fields. Actions/assertions may be interleaved. No extra fields. JSON schema follows:
`;
export async function compile(requirements: string, contract: string, out: string, ledgerPath: string) {
 const requirementText=readFileSync(requirements,'utf8'), contractText=readFileSync(contract,'utf8');
 const root=parse(requirementText) as Requirement, rows=scenarios(root);
 const app=root.name.toLowerCase();
 const expected=app==='keep'?32:app==='bookstack'?34:undefined;
 if(!expected || rows.length!==expected) throw Error(`Unsupported app or wrong denominator: ${app} ${rows.length}`);
 mkdirSync(out,{recursive:true}); mkdirSync(dirname(ledgerPath),{recursive:true});
 const schema=JSON.stringify(z.toJSONSchema(checksSchema));
 const system=instructions+schema;
 const groups=[...new Set(rows.map(r=>r.group))];
 const ledger: any[]=existsSync(ledgerPath)?JSON.parse(readFileSync(ledgerPath,'utf8')):[];
 const all: Check[]=[];
 const model='deepseek-v4-flash';
 for(const group of groups) {
  const assigned=rows.filter(r=>r.group===group);
  const prompt=JSON.stringify({requirements:root,contract:JSON.parse(contractText),assigned});
  const messages=[{role:'system',content:system},{role:'user',content:prompt}];
  let done:Check[]|undefined;
  for(let attempt=0;attempt<2;attempt++) {
   const request={model,messages,max_tokens:10000,temperature:0,reasoning_effort:'low',response_format:{type:'json_object'}};
   // UTF-8 bytes upper-bound tokens; reserve full output including hidden reasoning.
   const reserve=(Buffer.byteLength(JSON.stringify(request))*3+10000*9)/1e6;
   const spent=ledger.reduce((s,r)=>s+r.chargedCny,0);
   if(spent+reserve>8) throw Error(`Budget cap: spent ${spent}, reservation ${reserve}`);
   const record:any={app,group,attempt,model,requestHash:sha(JSON.stringify(request)),started:new Date().toISOString(),reservedCny:reserve,chargedCny:reserve,accounting:'reserved'};
   ledger.push(record);writeFileSync(ledgerPath,JSON.stringify(ledger,null,2)+'\n');
   const evidence=resolve(out,`${group}-call-${ledger.length}-attempt-${attempt+1}`);
   writeFileSync(evidence+'-request.json',JSON.stringify(request,null,2)+'\n');
   const start=Date.now();
   let response: Response;
   try { response=await fetch(`${(process.env.OPENAI_BASE_URL??'https://api.arc-bench.com/v1').replace(/\/$/,'')}/chat/completions`,{
    method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${process.env.OPENAI_API_KEY??''}`},body:JSON.stringify(request),signal:AbortSignal.timeout(180000)
   });
   } catch(error) {
    const code=(error as {cause?:{code?:string}}).cause?.code;
    record.elapsedMs=Date.now()-start;record.transportError=code??String(error);
    if(code==='ENOTFOUND'||code==='ECONNREFUSED'||code==='ENETUNREACH') {record.chargedCny=0;record.accounting='not-sent';}
    writeFileSync(ledgerPath,JSON.stringify(ledger,null,2)+'\n');
    throw Error(`Gateway unavailable (${code??'transport failure'}); no transport retry`);
   }
   const body=await response.text();
   writeFileSync(evidence+'-response.json',body);
   record.elapsedMs=Date.now()-start;record.httpStatus=response.status;
   if(!response.ok) {writeFileSync(ledgerPath,JSON.stringify(ledger,null,2)+'\n');throw Error(`Gateway HTTP ${response.status}; reserved charge retained; no transport retry`);}
   const data=JSON.parse(body),usage=data.usage;
   if(!usage || !Number.isFinite(usage.prompt_tokens) || !Number.isFinite(usage.completion_tokens)) throw Error('Missing usage; reserved charge retained; stopping');
   const cached=usage.prompt_cache_hit_tokens??usage.prompt_tokens_details?.cached_tokens??0;
   record.usage=usage;record.chargedCny=((usage.prompt_tokens-cached)*3+cached*0.1+usage.completion_tokens*9)/1e6;record.accounting='usage';
   writeFileSync(ledgerPath,JSON.stringify(ledger,null,2)+'\n');
   try {
    const content=data.choices[0].message.content.replace(/^```(?:json)?\s*|\s*```$/g,'');
    const parsed=JSON.parse(content);
    done=validateCoverage(parsed.checks,assigned);
    record.validation='valid'; break;
   } catch(error) {
    record.validation=String(error);
    messages.push({role:'assistant',content:data.choices?.[0]?.message?.content??''},{role:'user',content:`Schema/coverage invalid: ${String(error).slice(0,8000)}. Return corrected full group once. Never drop any assigned scenario.`});
   } finally {writeFileSync(ledgerPath,JSON.stringify(ledger,null,2)+'\n');}
  }
  if(!done) done=assigned.map(r=>({scenario:r.scenario,requirement:r.requirement,title:r.title,category:'read-list',rationale:'Both schema/coverage attempts failed; see request/response evidence.',given:[],when:[],then:[{op:'unknown',reason:'unsupported',detail:'Compiler schema/coverage validation failed twice.'}]}));
  all.push(...done);
  console.log(`${app} ${group}: ${done.length} checks; CNY ${ledger.reduce((s,r)=>s+r.chargedCny,0).toFixed(6)}`);
 }
 const checks=validateCoverage(all,rows);
 const json=JSON.stringify(checks,null,2)+'\n';
 writeFileSync(resolve(out,'checks.json'),json);
 writeFileSync(resolve(out,'manifest.json'),JSON.stringify({app,scenarios:rows.length,groups:groups.length,model,requirements:resolve(requirements),contract:resolve(contract),requirementsSha256:sha(requirementText),contractSha256:sha(contractText),checksSha256:sha(json),compiledAt:new Date().toISOString(),compilerInputs:['requirements','contract'],calibrated:false},null,2)+'\n');
 return checks;
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
 const {values}=parseArgs({options:{requirements:{type:'string'},contract:{type:'string'},out:{type:'string'},ledger:{type:'string'}}});
 if(!values.requirements||!values.contract||!values.out) throw Error('Required: --requirements --contract --out [--ledger]');
 await compile(values.requirements,values.contract,resolve(values.out),resolve(values.ledger??'out/usage.json'));
}
