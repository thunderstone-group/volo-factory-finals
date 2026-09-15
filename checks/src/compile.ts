import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { parse } from 'yaml';
import { z } from 'zod';
import { checksSchema, flatten, type Check } from './steps.js';
import { round2ChecksSchema, groundedCheckSchema, grounding, type Round2Check } from './round2-schema.js';
import { modelCall } from './model-call.js';

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
export function inputApp(name: string): 'keep' | 'bookstack' {
 const names:Record<string,'keep'|'bookstack'>={'keep':'keep','bookstack':'bookstack','bookstack knowledge base system':'bookstack'};
 const app=names[name.trim().toLowerCase()];
 if(!app)throw Error(`Unsupported application name: ${name}`);
 return app;
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
 const app=inputApp(root.name);
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
   // Reserve from request bytes and the requested output cap. Observed gateway
   // reasoning can exceed max_tokens; this reservation is not a proven hard bound.
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
export const round2SystemPrompt = String.raw`Compile GIVEN/WHEN/THEN into a deliberately literal, minimal Playwright check. Treat only requirements and the supplied contract as evidence. Never read or infer official tests or historical verdicts.
Output {"checks":[...]} with exactly one Check per assigned scenario, preserving identity/title. Set version=2. A compiled Check has status=compiled, given, when, then. An unknown Check has status=unknown, reason (unsupported/no-preparation-path/ambiguous-assertion), detail and NO executable phases. Keep rationale/detail concise.
GIVEN allows exactly one open first, followed only by the MINIMUM clicks needed to reach the page described by GIVEN. Names must appear in the original requirements. No expect, hover, fill, check, press, setup mutations, login preparation, extra navigation, reload or waits. Never prepare deleted/archived/pinned state through forbidden operations. If that prerequisite cannot be reached, return no-preparation-path. Do not visit an extra page to help selectors settle.
WHEN is grouped by the original supplied sentence indices. Each sentence allows AT MOST TWO steps, selected ONLY from hover, click, fill, check, press. Never split comma-separated clauses, AND clauses or actions into invented sentences. No open here: entry navigation is the GIVEN open. Pure view/open scenarios may have zero WHEN actions. Do NOT omit requested actions to fit the cap: create/login/edit workflows that require more than two operations must be unknown (unsupported). Do not move WHEN work into GIVEN or THEN.
A hover names a seed row TITLE, but runtime always resolves it through hoverNamed/resolveNamed; NEVER request via:text. Click names must be bare action verbs literally present in that WHEN sentence or quoted/backticked literals from the original requirements. No synonyms or invented action names. fill takes one named field and one string value; no multi-field packed actions. check takes name and checked boolean. press takes one key.
THEN allows ONLY expectText and expectAbsent; names must come from THEN sentences or quoted/backticked requirement literals. Prefer one direct visible-text assertion when it expresses the scenario. No additional readiness assertions, no expects before THEN, no navigation in THEN. Do not turn style, color, count or state requirements into unrelated text assertions; mark unknown if text presence/absence cannot express them. No expectCount/expectState/capture/compare/if/try or custom code anywhere.
Names are arrays of one to three regex TEXT STRINGS, case-insensitive at runtime. Encode source words literally (escape punctuation, replace whitespace with \s+); optional paired ^ and $ anchors are allowed. No regex wildcards, alternatives or lookarounds. Never provide role, via, exact, within, CSS or selector objects. All click/hover/check/expectText use the fixed named ladder; fill uses the unchanged fillField helper; expectAbsent is getByText(...).toHaveCount(0). No extra sleeps, polls or auto-repairs.
Both apps are fresh browser contexts against one seeded server; cannot rely on other scenarios. Preserve the full scenario denominator with explicit unknowns. Schema and source-grounding validation are enforced.
`;
export async function compileRound2(requirements:string,contract:string,out:string,ledgerPath:string,model:string,responses?:string[]) {
 if(!['qwen3.8-max','deepseek-v4-flash'].includes(model))throw Error('Round two only supports the two requested models');
 const requirementText=readFileSync(requirements,'utf8'),contractText=readFileSync(contract,'utf8');
 const root=parse(requirementText) as Requirement,contractData=JSON.parse(contractText),rows=scenarios(root),app=inputApp(root.name);
 if(rows.length!==(app==='keep'?32:34))throw Error('Wrong scenario denominator');
 mkdirSync(out,{recursive:true});
 const system=round2SystemPrompt+JSON.stringify(z.toJSONSchema(round2ChecksSchema));
 const shared=grounding(rows[0],requirementText,contractData);
 const context={requirements:root,contract:contractData,sharedQuotedLiterals:shared.sharedQuotedLiterals,hoverTitles:shared.hoverTitles};
 const accepted=new Map<string,Round2Check>(),errors:Record<string,string>={};
 let assigned=rows;
 for(let attempt=0;attempt<2&&assigned.length;attempt++) {
  const user=JSON.stringify({...context,assigned:assigned.map(r=>{const {sharedQuotedLiterals,hoverTitles,...local}=grounding(r,requirementText,contractData);return {scenario:r.scenario,requirement:r.requirement,title:r.title,grounding:local,previousValidationError:errors[r.scenario]};})});
  const response=responses?responses[attempt]??'{}':await modelCall({model,system,user,ledgerPath,out,label:`${app}-attempt-${attempt+1}`,budget:5,maxTokens:12000});
  let candidates:any[]=[];
  try {const parsed=JSON.parse(response.replace(/^```(?:json)?\s*|\s*```$/g,''));if(!Array.isArray(parsed.checks))throw Error('Missing checks array');candidates=parsed.checks;}
  catch(error){for(const r of assigned)errors[r.scenario]=String(error);}
  const pending:typeof rows=[];
  for(const row of assigned) {
   const matches=candidates.filter(c=>c?.scenario===row.scenario);
   const validated=matches.length===1?groundedCheckSchema(row,requirementText,contractData).safeParse(matches[0]):null;
   if(validated?.success)accepted.set(row.scenario,validated.data);
   else {errors[row.scenario]=validated&&!validated.success?validated.error.message.slice(0,3000):errors[row.scenario]??'Missing/duplicate scenario';pending.push(row);}
  }
  writeFileSync(resolve(out,`validation-${attempt+1}.json`),JSON.stringify({accepted:[...accepted.keys()],pending:pending.map(r=>r.scenario),errors},null,2)+'\n');
  assigned=pending;
 }
 for(const row of assigned)accepted.set(row.scenario,{version:2,status:'unknown',scenario:row.scenario,requirement:row.requirement,title:row.title,category:'read-list',rationale:'Compiler output failed source/schema validation twice.',reason:'unsupported',detail:`Schema/source validation failed: ${errors[row.scenario]}`});
 const checks=round2ChecksSchema.parse(rows.map(r=>accepted.get(r.scenario))),json=JSON.stringify(checks,null,2)+'\n';
 writeFileSync(resolve(out,'checks.json'),json);
 writeFileSync(resolve(out,'manifest.json'),JSON.stringify({version:2,app,model,scenarios:rows.length,requirementsSha256:sha(requirementText),contractSha256:sha(contractText),checksSha256:sha(json),compiledAt:new Date().toISOString(),compilerInputs:['requirements','contract'],unknown:checks.filter(c=>c.status==='unknown').length,recallPolicy:'exclude-unknown'},null,2)+'\n');
 console.log(`${model} ${app}: ${checks.length} scenarios; ${checks.filter(c=>c.status==='unknown').length} unknown`);
 return checks;
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
 const {values}=parseArgs({options:{requirements:{type:'string'},contract:{type:'string'},out:{type:'string'},ledger:{type:'string'},round2:{type:'boolean'},model:{type:'string'}}});
 if(!values.requirements||!values.contract||!values.out) throw Error('Required: --requirements --contract --out [--ledger]');
 if(values.round2)await compileRound2(values.requirements,values.contract,resolve(values.out),resolve(values.ledger??'out/round2/usage.json'),values.model??'qwen3.8-max');
 else await compile(values.requirements,values.contract,resolve(values.out),resolve(values.ledger??'out/usage.json'));
}
