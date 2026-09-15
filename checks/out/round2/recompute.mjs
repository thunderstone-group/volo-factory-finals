// Run from checks/: node --import tsx out/round2/recompute.mjs
import fs from 'node:fs';
import {deepStrictEqual,strictEqual} from 'node:assert';
import {loadChecks,sha} from '../../src/run.ts';
import {calibration} from '../../src/calibrate.ts';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
for(const model of ['qwen','deepseek'])for(const [sample,app,official] of [
 ['keep-5','keep','out/keep-5/official-summary.json'],
 ['keep-7','keep','out/keep-7/official-summary.json'],
 ['bookstack-2','bookstack','out/bookstack-official/official-score.json'],
]) {
 const dir=`out/round2/${model}/${sample}`;
 if(!fs.existsSync(dir+'/calibration.json')){console.log(JSON.stringify({model,sample,status:'not-run'}));continue;}
 const text=fs.readFileSync(`out/round2/${model}/${app}/checks.json`,'utf8'),{checks}=loadChecks(text);
 const expected=read(dir+'/calibration.json'),actual=calibration(checks,read(dir+'/results.json'),read(official),true);
 strictEqual(expected.checksSha256,sha(text));
 for(const [key,value] of Object.entries(actual))deepStrictEqual(value,expected[key],`${model}/${sample}/${key}`);
 console.log(JSON.stringify({model,sample,matrix:actual.matrix,recall:actual.officialPassRecall,coverage:actual.coverage,falsePasses:actual.falsePasses,unknown:actual.unknownCount,accepted:actual.accepted}));
}
