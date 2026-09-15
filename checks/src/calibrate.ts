import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { checksSchema, flatten, type Check, type Result } from './steps.js';
import { run, reportRows, withApp, playwright, writeConfig, sha, loadChecks } from './run.js';

export function officialMap(checks:Check[],official:any):Map<string,'pass'|'fail'> {
 const map=new Map<string,'pass'|'fail'>();
 const rows=official.suites?reportRows(official):undefined;
 if(!rows) {
  if(official.profile!=='hosted'||official.workers!==4||official.test_timeout_ms!==10000)throw Error('Official summary is not the hosted profile');
  if(official.total!==checks.length||official.passed+official.failed!==official.total||official.failed_titles?.length!==official.failed)throw Error('Official summary denominator/skips mismatch');
  // A failed_titles-only summary cannot identify multiple scenarios per requirement.
  if(new Set(checks.map(c=>c.requirement)).size!==checks.length)throw Error('Multiple scenarios per requirement require the full official JSON report');
 }
 const used=new Set<string>();
 for(const c of checks) {
  const titles:string[]=rows?rows.map(r=>r.title):official.failed_titles;
  const reqMatches=titles.filter(title=>title.match(/\bREQ-[\d.]+(?=[:\s]|$)/)?.[0]===c.requirement);
  let title=reqMatches[0];
  if(reqMatches.length>1) {
   const exact=reqMatches.filter(t=>t.slice(t.indexOf(':')+1).trim().toLowerCase()===c.title.toLowerCase());
   if(exact.length!==1)throw Error(`Ambiguous official mapping ${c.scenario}`);
   title=exact[0];
  }
  if(rows&&!title)throw Error(`Official scenario missing ${c.scenario}`);
  if(title&&used.has(title))throw Error(`Official title reused ${title}`);
  if(title)used.add(title);
  if(rows) {
   const row=rows.find(r=>r.title===title)!;
   if(!['expected','unexpected','flaky'].includes(row.status))throw Error(`Official non-verdict status ${row.status}`);
   map.set(c.scenario,row.status==='expected'?'pass':'fail');
  } else map.set(c.scenario,title?'fail':'pass');
 }
 if(used.size!==(rows?rows.length:official.failed_titles.length))throw Error('Unmapped official results');
 return map;
}
export function calibration(checks:Check[],results:Result[],official:any,excludeUnknown=false) {
 const map=officialMap(checks,official);
 if(results.length!==checks.length||new Set(results.map(r=>r.scenario)).size!==checks.length)throw Error('Local result denominator mismatch');
 const matrix={pass:{pass:0,fail:0},fail:{pass:0,fail:0},unknown:{pass:0,fail:0}};
 const falsePasses:string[]=[],falseFails:string[]=[];
 for(const r of results) {
  const verdict=map.get(r.scenario);if(!verdict)throw Error(`Unmapped local scenario ${r.scenario}`);
  matrix[r.status][verdict]++;
  if(r.status==='pass'&&verdict==='fail')falsePasses.push(r.scenario);
  if(r.status==='fail'&&verdict==='pass')falseFails.push(r.scenario);
 }
 const officialPass=matrix.pass.pass+matrix.fail.pass+matrix.unknown.pass;
 const recallDenominator=officialPass-(excludeUnknown?matrix.unknown.pass:0);
 const recall=recallDenominator?matrix.pass.pass/recallDenominator:null;
 const unknown=results.filter(r=>r.status==='unknown').map(r=>{
  const c=checks.find(c=>c.scenario===r.scenario)!;
  return {scenario:c.scenario,requirement:c.requirement,title:c.title,category:c.category,reasons:flatten([...c.given,...c.when,...c.then]).filter(s=>s.op==='unknown'),error:r.error};
 });
 return {...(excludeUnknown?{recallPolicy:'exclude-unknown',recallDenominator,officialPassCount:officialPass,fullDenominatorRecall:officialPass?matrix.pass.pass/officialPass:null,coverage:(checks.length-matrix.unknown.pass-matrix.unknown.fail)/checks.length}:{}),denominator:checks.length,matrix,officialPassRecall:recall,falsePasses,falseFails,unknownCount:unknown.length,unknown,
  accepted:falsePasses.length===0&&recall!==null&&recall>=0.85,
  interpretation:'Diagnostic calibration only; matching failure status does not establish matching failure cause.'};
}
export function markdown(c:ReturnType<typeof calibration>):string {
 return `| Local \\ Official | pass | fail |\n|---|---:|---:|\n`+
 (['pass','fail','unknown'] as const).map(k=>`| ${k} | ${c.matrix[k].pass} | ${c.matrix[k].fail} |`).join('\n')+
 `\n\nDenominator: ${c.denominator}; official-pass recall: ${c.officialPassRecall===null?'N/A':(100*c.officialPassRecall).toFixed(1)+'%'}; false passes: ${c.falsePasses.length}; unknown: ${c.unknownCount}; acceptance: ${c.accepted?'PASS':'FAIL'}.\n\n`+
 c.unknown.map(u=>`- ${u.scenario} (${u.category}) ${u.title}: ${u.reasons.map(r=>r.op==='unknown'?`${r.reason}: ${r.detail}`:'').join('; ')}`).join('\n')+'\n';
}
export async function scoreOfficial(appDir:string,testsDir:string,out:string) {
 return withApp(appDir,out,async url=>{
  // The official suite and runner must import the SAME physical Playwright copy.
  const modules=resolve(testsDir,'../../../../node_modules');
  await playwright(writeConfig(out,testsDir,url,modules),modules);
  return JSON.parse(readFileSync(resolve(out,'playwright.json'),'utf8'));
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
 const {values}=parseArgs({options:{'app-dir':{type:'string'},checks:{type:'string'},official:{type:'string'},'official-tests':{type:'string'},out:{type:'string'}}});
 if(!values['app-dir']||!values.checks||!values.out)throw Error('Required: --app-dir --checks --out and --official or --official-tests');
 const out=resolve(values.out);mkdirSync(out,{recursive:true});
 const checkText=readFileSync(values.checks,'utf8'),{checks,round2}=loadChecks(checkText);
 // Freeze first; only this calibration module reads official reports/tests.
 writeFileSync(resolve(out,'frozen-checks-sha256.txt'),sha(checkText)+'\n');
 const results=await run(resolve(values['app-dir']),resolve(values.checks),out);
 const official=values.official?JSON.parse(readFileSync(values.official,'utf8')):values['official-tests']?await scoreOfficial(resolve(values['app-dir']),resolve(values['official-tests']),resolve(out,'official')):undefined;
 if(!official)throw Error('Missing official evidence');
 const summary=calibration(checks,results,official,!!round2);
 writeFileSync(resolve(out,'calibration.json'),JSON.stringify({...summary,checksSha256:sha(checkText),officialSha256:sha(JSON.stringify(official))},null,2)+'\n');
 writeFileSync(resolve(out,'calibration.md'),markdown(summary));console.log(markdown(summary));
}
