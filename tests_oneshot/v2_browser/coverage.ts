import {createHash} from 'node:crypto';
export async function coverage(page:any){
 await page.coverage.startJSCoverage({resetOnNavigation:false});
 return async()=>{
  const entries=await page.coverage.stopJSCoverage();
  return entries.filter((x:any)=>/\/volo-(interaction|navigation)\.js(?:\?|$)/.test(x.url)).map((entry:any)=>({
   url:entry.url,sha256:entry.source===undefined?null:createHash('sha256').update(entry.source).digest('hex'),
   called:entry.functions.filter((f:any)=>f.ranges[0].count>0).map((f:any)=>f.functionName),
   counts:Object.fromEntries(entry.functions.filter((f:any)=>f.functionName).map((f:any)=>[f.functionName,f.ranges[0].count]))
  }));
 };
}
