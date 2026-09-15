// Deterministically recompute retained matrices without starting browsers or models.
// Run from checks/: node --import tsx out/recompute-calibration.mjs
import { readFileSync } from 'node:fs';
import { deepStrictEqual, strictEqual } from 'node:assert';
import { calibration } from '../src/calibrate.ts';
import { checksSchema, resultSchema } from '../src/steps.ts';
import { sha } from '../src/run.ts';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
for(const [sample,app,official] of [
 ['keep-5','keep','out/keep-5/official-summary.json'],
 ['keep-7','keep','out/keep-7/official-summary.json'],
 ['bookstack-2','bookstack','out/bookstack-official/official-score.json'],
]) {
 const text=readFileSync(`out/${app}/checks.json`,'utf8');
 const checks=checksSchema.parse(JSON.parse(text));
 const results=read(`out/${sample}/results.json`).map(x=>resultSchema.parse(x));
 const stored=read(`out/${sample}/calibration.json`);
 strictEqual(stored.checksSha256,sha(text));
 const recalculated=calibration(checks,results,read(official));
 for(const [key,value] of Object.entries(recalculated))deepStrictEqual(value,stored[key],`${sample}.${key}`);
 console.log(JSON.stringify({sample,denominator:recalculated.denominator,matrix:recalculated.matrix,recall:recalculated.officialPassRecall,falsePasses:recalculated.falsePasses,unknown:recalculated.unknownCount,accepted:recalculated.accepted}));
}
