import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
const prices:Record<string,[number,number,number]>={'qwen3.8-max':[12,1.5,36],'deepseek-v4-flash':[3,0.1,9]};
export function cost(model:string,usage:any):number {
 const [input,cached,output]=prices[model];
 const hit=usage.prompt_cache_hit_tokens??usage.prompt_tokens_details?.cached_tokens??0;
 return ((usage.prompt_tokens-hit)*input+hit*cached+usage.completion_tokens*output)/1e6;
}
export async function modelCall(args:{model:string;system:string;user:string;ledgerPath:string;out:string;label:string;budget:number;maxTokens:number}):Promise<string> {
 const {model,system,user,ledgerPath,out,label,budget,maxTokens}=args;
 const parameters=model.startsWith('qwen')?{enable_thinking:false}:{thinking:{type:'disabled'}};
 const request={model,messages:[{role:'system',content:system},{role:'user',content:user}],...parameters,temperature:0,max_tokens:maxTokens,response_format:{type:'json_object'}};
 const body=JSON.stringify(request),reserve=(Buffer.byteLength(body)*prices[model][0]+maxTokens*prices[model][2])/1e6;
 mkdirSync(dirname(ledgerPath),{recursive:true});mkdirSync(out,{recursive:true});
 const ledger:any[]=existsSync(ledgerPath)?JSON.parse(readFileSync(ledgerPath,'utf8')):[];
 if(ledger.reduce((a,r)=>a+r.chargedCny,0)+reserve>budget)throw Error(`CNY ${budget} budget cannot reserve next request (${reserve})`);
 const entry:any={model,label,startedAt:new Date().toISOString(),requestSha256:createHash('sha256').update(body).digest('hex'),reservedCny:reserve,chargedCny:reserve,accounting:'reserved',parameters};
 ledger.push(entry);const save=()=>writeFileSync(ledgerPath,JSON.stringify(ledger,null,2)+'\n');save();
 const path=resolve(out,`${label}-call-${ledger.length}`);writeFileSync(path+'-request.json',JSON.stringify(request,null,2)+'\n');
 let response:Response;const start=Date.now();
 try {response=await fetch(`${(process.env.OPENAI_BASE_URL??'https://api.arc-bench.com/v1').replace(/\/$/,'')}/chat/completions`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${process.env.OPENAI_API_KEY??''}`},body,signal:AbortSignal.timeout(180000)});}
 catch(error){const code=(error as any).cause?.code;entry.error=code??String(error);entry.elapsedMs=Date.now()-start;if(['ENOTFOUND','ECONNREFUSED','ENETUNREACH'].includes(code)){entry.chargedCny=0;entry.accounting='not-sent';}save();throw error;}
 const text=await response.text();writeFileSync(path+'-response.json',text);entry.httpStatus=response.status;entry.elapsedMs=Date.now()-start;save();
 if(!response.ok)throw Error(`Gateway HTTP ${response.status}; no transport retry`);
 const data=JSON.parse(text),usage=data.usage;
 if(!usage||!Number.isFinite(usage.prompt_tokens)||!Number.isFinite(usage.completion_tokens))throw Error('Missing usage; stop with reservation retained');
 entry.usage=usage;entry.chargedCny=cost(model,usage);entry.accounting='usage';save();
 if(ledger.reduce((a,r)=>a+r.chargedCny,0)>budget)throw Error('Usage exceeded reserved budget; stop');
 console.log(`${label}: CNY ${entry.chargedCny.toFixed(6)}; cumulative ${ledger.reduce((a,r)=>a+r.chargedCny,0).toFixed(6)}`);
 return data.choices?.[0]?.message?.content??'';
}
