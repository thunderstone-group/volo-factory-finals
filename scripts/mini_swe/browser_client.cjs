const fs=require('fs');
(async()=>{const body=fs.readFileSync(0,'utf8');const r=await fetch('http://127.0.0.1:9222',{method:'POST',body});process.stdout.write(await r.text());process.exitCode=r.ok?0:1;})().catch(e=>{console.error(String(e));process.exitCode=1;});
