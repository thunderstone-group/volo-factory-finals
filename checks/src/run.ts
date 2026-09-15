import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, openSync, closeSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import { checksSchema, resultSchema, emptyResolver, type Check, type Result } from './steps.js';

export const sourceDir=dirname(fileURLToPath(import.meta.url));
const packageDir=resolve(sourceDir,'..');
export const sha=(text:string)=>createHash('sha256').update(text).digest('hex');
export function renderSpec(checks:Check[], resultDir:string):string {
 if(new Set(checks.map(c=>c.requirement)).size!==1) throw Error('A spec must contain exactly one requirement');
 return `import { test, expect } from ${JSON.stringify(join(packageDir,'node_modules/@playwright/test/index.mjs'))};\nimport { executeCheck } from ${JSON.stringify(join(sourceDir,'execute.ts'))};\n`+
 checks.map(c=>`test(${JSON.stringify(c.scenario)}, async ({ page }) => {\n const result = await executeCheck(page, ${JSON.stringify(c)}, ${JSON.stringify(join(resultDir,`${c.scenario.replace(/[^\w.-]/g,'_')}.json`))});\n test.skip(result.status === 'unknown', result.error ?? 'unknown');\n expect(result.status, result.error ?? undefined).toBe('pass');\n});`).join('\n')+'\n';
}
export async function freePort():Promise<number> {
 return new Promise((accept,reject)=>{const server=createServer();server.on('error',reject);server.listen(0,'127.0.0.1',()=>{const address=server.address();if(!address||typeof address==='string')return reject(Error('No TCP port'));server.close(()=>accept(address.port));});});
}
async function stop(process:ChildProcess) {
 if(process.exitCode!==null) return;
 try {process.pid && globalThis.process.kill(-process.pid,'SIGTERM');} catch {process.kill('SIGTERM');}
 await Promise.race([new Promise<void>(r=>process.once('exit',()=>r())),new Promise<void>(r=>setTimeout(r,3000))]);
 if(process.exitCode===null) {try {process.pid && globalThis.process.kill(-process.pid,'SIGKILL');} catch {process.kill('SIGKILL');}}
}
export async function withApp<T>(appDir:string,out:string,fn:(url:string)=>Promise<T>):Promise<T> {
 mkdirSync(out,{recursive:true});
 const app=resolve(out,'app'),data=resolve(out,'data');
 // Historical sources are read-only: run a copy and a fresh data directory.
 if(existsSync(app)) rmSync(app,{recursive:true});
 if(existsSync(data)) rmSync(data,{recursive:true});
 mkdirSync(app,{recursive:true});mkdirSync(data,{recursive:true});
 for(const name of ['backend','frontend']) cpSync(resolve(appDir,name),join(app,name),{recursive:true});
 const port=await freePort(),url=`http://127.0.0.1:${port}`;
 const log=openSync(resolve(out,'server.log'),'w');
 const proc=spawn('npm',['run','start'],{cwd:join(app,'backend'),env:{...process.env,PORT:String(port),APP_DATA_DIR:data},stdio:['ignore',log,log],detached:true});
 let spawnError:Error|undefined;proc.on('error',e=>{spawnError=e;});
 try {
  let ready=false;
  for(let i=0;i<150;i++) {
   if(spawnError)throw spawnError;
   if(proc.exitCode!==null)throw Error(`Backend exited ${proc.exitCode}; see server.log`);
   try {if((await fetch(url+'/api/health',{signal:AbortSignal.timeout(500)})).status===200){ready=true;break;}}catch{}
   await new Promise(r=>setTimeout(r,200));
  }
  if(!ready)throw Error('Backend /api/health did not return HTTP 200');
  const snapshotResponse=await fetch(url+'/__factory/store');
  if(!snapshotResponse.ok)throw Error(`Seed snapshot unavailable: HTTP ${snapshotResponse.status}`);
  const snapshot=await snapshotResponse.text();JSON.parse(snapshot);
  writeFileSync(resolve(out,'seed.json'),snapshot+'\n');
  const restored=await fetch(url+'/__factory/store',{method:'PUT',headers:{'Content-Type':'application/json'},body:snapshot});
  if(!restored.ok)throw Error(`Seed restore failed: HTTP ${restored.status}`);
  writeFileSync(resolve(out,'run-environment.json'),JSON.stringify({application:resolve(appDir),node:process.version,baseURL:url,workers:4,testTimeoutMs:10000,expectTimeoutMs:10000,trace:'off',video:'off',seedRestores:1,seedSha256:sha(snapshot),dataStrategy:'fresh APP_DATA_DIR then one whole-suite snapshot restore',startedAt:new Date().toISOString()},null,2)+'\n');
  return await fn(url);
 } finally {await stop(proc);closeSync(log);}
}
export function writeConfig(out:string,testDir:string,url:string,modules=join(packageDir,'node_modules')) {
 const config=resolve(out,'config.ts');
 writeFileSync(config,`import { defineConfig, devices } from ${JSON.stringify(join(modules,'@playwright/test/index.mjs'))};
export default defineConfig({testDir:${JSON.stringify(testDir)},timeout:10000,expect:{timeout:10000},workers:4,fullyParallel:false,retries:0,reporter:[['list'],['json',{outputFile:${JSON.stringify(resolve(out,'playwright.json'))}}]],outputDir:${JSON.stringify(resolve(out,'artifacts'))},use:{baseURL:${JSON.stringify(url)},trace:'off',video:'off',screenshot:'off'},projects:[{name:'chromium',use:{...devices['Desktop Chrome']}}]});\n`);
 return config;
}
export async function playwright(config:string,modules=join(packageDir,'node_modules')):Promise<number> {
 return new Promise((accept,reject)=>{const proc=spawn(process.execPath,[join(modules,'@playwright/test/cli.js'),'test','--config',config],{cwd:packageDir,env:process.env,stdio:'inherit'});proc.on('error',reject);proc.on('exit',code=>accept(code??1));});
}
export function reportRows(report:any):{title:string;status:string;error:string|null}[] {
 const result:{title:string;status:string;error:string|null}[]=[];
 function walk(suite:any) {
  for(const spec of suite.specs??[]) for(const test of spec.tests??[]) result.push({title:spec.title,status:test.status,error:(test.results??[]).flatMap((r:any)=>r.errors??[]).map((e:any)=>e.message??String(e)).join('\n')||null});
  for(const child of suite.suites??[])walk(child);
 }
 walk(report);return result;
}
export function mergeResults(checks:Check[],parts:Map<string,Result>,report:any):Result[] {
 const rows=reportRows(report);
 return checks.map(c=>{
  const matches=rows.filter(r=>r.title===c.scenario);
  if(matches.length!==1)throw Error(`Missing/duplicate Playwright result for ${c.scenario}`);
  const row=matches[0],part=parts.get(c.scenario);
  const result:Result=part??{scenario:c.scenario,requirement:c.requirement,status:'fail',failedStep:null,resolver:emptyResolver(),error:'Worker failed before executing the first step'};
  if(row.status!=='expected' && !(row.status==='skipped'&&result.status==='unknown')) {
   result.status='fail';result.error=row.error??result.error??`Playwright ${row.status}`;
  } else if(row.status==='expected'&&result.status!=='pass') throw Error(`Worker/report status mismatch ${c.scenario}`);
  return resultSchema.parse(result);
 });
}
export async function run(appDir:string,checksFile:string,out:string):Promise<Result[]> {
 const text=readFileSync(checksFile,'utf8'),checks=checksSchema.parse(JSON.parse(text));
 if(!checks.length||new Set(checks.map(c=>c.scenario)).size!==checks.length) throw Error('Empty/duplicate checks');
 mkdirSync(out,{recursive:true});
 // Never retain previous verdicts when the current invocation fails to start.
 for(const name of ['results.json','playwright.json','results-parts','specs'])if(existsSync(resolve(out,name)))rmSync(resolve(out,name),{recursive:true});
 return withApp(appDir,out,async url=>{
  const specDir=resolve(out,'specs'),resultDir=resolve(out,'results-parts');
  mkdirSync(specDir,{recursive:true});mkdirSync(resultDir,{recursive:true});
  for(const req of new Set(checks.map(c=>c.requirement)))writeFileSync(join(specDir,`${req.replace(/[^\w.-]/g,'_')}.spec.ts`),renderSpec(checks.filter(c=>c.requirement===req),resultDir));
  const code=await playwright(writeConfig(out,specDir,url));
  const reportFile=resolve(out,'playwright.json');
  if(!existsSync(reportFile))throw Error(`Playwright exited ${code} without report`);
  const parts=new Map<string,Result>();
  for(const c of checks) {
   const file=join(resultDir,`${c.scenario.replace(/[^\w.-]/g,'_')}.json`);
   if(existsSync(file))parts.set(c.scenario,resultSchema.parse(JSON.parse(readFileSync(file,'utf8'))));
  }
  const results=mergeResults(checks,parts,JSON.parse(readFileSync(reportFile,'utf8')));
  writeFileSync(resolve(out,'results.json'),JSON.stringify(results,null,2)+'\n');
  writeFileSync(resolve(out,'checks-sha256.txt'),sha(text)+'\n');
  return results;
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
 const {values}=parseArgs({options:{'app-dir':{type:'string'},checks:{type:'string'},out:{type:'string'}}});
 if(!values['app-dir']||!values.checks||!values.out)throw Error('Required: --app-dir --checks --out');
 await run(resolve(values['app-dir']),resolve(values.checks),resolve(values.out));
}
