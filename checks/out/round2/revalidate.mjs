// Revalidate retained responses without a model call; first valid candidate wins.
import {readFileSync,readdirSync} from 'node:fs';
import {compileRound2} from '../../src/compile.ts';
const [modelDir,app]=process.argv.slice(2);
const out=`out/round2/${modelDir}/${app}`;
const model=modelDir==='qwen'?'qwen3.8-max':'deepseek-v4-flash';
const names=readdirSync(out).filter(n=>n.endsWith('-response.json')).sort((a,b)=>Number(a.match(/call-(\d+)/)[1])-Number(b.match(/call-(\d+)/)[1]));
const responses=names.map(n=>JSON.parse(readFileSync(`${out}/${n}`,'utf8')).choices?.[0]?.message?.content).filter(Boolean);
const run=app==='keep'?'2026-09-15-keep-full-7':'2026-09-15-bookstack-2';
await compileRound2(`~/projects/arcbench-campaign/upstream/arc-bench/arc-bench/webapp/${app}/requirements/requirements.yaml`,`~/projects/volo-factory/runs/${run}/app/.factory/state-contract.json`,out,'out/round2/usage.json',model,responses);
