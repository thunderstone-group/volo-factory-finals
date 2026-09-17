// Trusted observer driver inside the outer namespace; application has a separate
// PID/mount namespace. Application stdout is never a probe receipt.
const fs = require('node:fs'), {spawn} = require('node:child_process');
const [bwrap, node, modules] = process.argv.slice(2,5);
const mode = process.argv[8] || 'observe';
// bubblewrap passes inherited descriptors onward. Close the mount-source handles
// before any browser or app subprocess; none may retain an old-root directory FD.
for(const [index,path] of ['/source','/probe','/browsers'].entries()) {
  const fd=Number(process.argv[5+index]);
  if(!Number.isInteger(fd)||fd<3)throw new Error('invalid mount descriptor');
  try {const a=fs.fstatSync(fd), b=fs.statSync(path);if(a.dev===b.dev&&a.ino===b.ino)fs.closeSync(fd);}
  catch(e){if(e.code!=='EBADF')throw e;}
}
const children = new Set();
const fail = code => { throw Object.assign(new Error(code), {code}); };
function child(cmd, args, options={}) {
  const p=spawn(cmd,args,{env:process.env,stdio:['ignore','pipe','pipe'],...options});
  children.add(p); p.on('error',()=>{}); p.once('close',()=>children.delete(p)); return p;
}
function bounded(p, seconds, capture=false) {
  return new Promise((resolve,reject)=>{
    let text='', bytes=0, done=false;
    const end=(error,value)=>{if(done)return;done=true;clearTimeout(timer);error?reject(error):resolve(value);};
    const timer=setTimeout(()=>{p.kill('SIGKILL');end(Object.assign(new Error(),{code:'output_limit'}));},seconds*1000);
    for(const stream of [p.stdout,p.stderr]) stream.on('data',b=>{
      bytes+=b.length;
      if(bytes>2*1024*1024){p.kill('SIGKILL');end(Object.assign(new Error(),{code:'output_limit'}));}
      else if(capture && stream===p.stdout) text+=b.toString();
    });
    p.on('error',()=>end(Object.assign(new Error(),{code:'isolation_unavailable'})));
    p.on('close',code=>end(null,{code,text}));
  });
}
function appArgs(cwd, command) {
  const a=['--unshare-user','--unshare-pid','--unshare-ipc','--unshare-uts',
    '--die-with-parent','--new-session','--cap-drop','ALL','--clearenv',
    '--uid',String(process.getuid()),'--gid',String(process.getgid())];
  for(const p of ['/usr','/bin','/sbin','/lib','/lib64']) {
    if(!fs.existsSync(p))continue;
    if(fs.lstatSync(p).isSymbolicLink())a.push('--symlink',fs.readlinkSync(p),p);
    else a.push('--ro-bind',p,p);
  }
  a.push('--proc','/proc','--dev','/dev','--size',String(64*1024*1024),'--tmpfs','/tmp','--bind','/app','/app');
  for(const [k,v] of Object.entries({PATH:'/usr/local/bin:/usr/bin:/bin',HOME:'/tmp',TMPDIR:'/tmp',
    LANG:'C.UTF-8',PORT:'3301',npm_config_offline:'true',npm_config_audit:'false',npm_config_update_notifier:'false'}))a.push('--setenv',k,v);
  return [...a,'--chdir',cwd,...command];
}
async function main(){
  if(process.getuid()===0 || !['observe','preflight'].includes(mode))fail('isolation_unavailable');
  // Test the exact application boundary with trusted code before generated code.
  const isolation=await bounded(child(bwrap,appArgs('/app',[node,'-e',
    "if(process.getuid()===0||require('fs').existsSync('/probe'))process.exit(1)"])),10);
  if(isolation.code!==0)fail('isolation_unavailable');
  try {const browser=await require('@playwright/test').chromium.launch({headless:true,timeout:10000});await browser.close();}
  catch(_){fail('browser_unavailable');}
  if(mode==='preflight')return {status:'ready',checks:{isolation:true,browser:true}};
  fs.cpSync('/source','/app',{recursive:true});
  const build=await bounded(child(bwrap,appArgs('/app/frontend',['npm','run','build'])),40);
  if(build.code!==0)fail('build_failed');
  // V2 already validates this command; candidate is checked again before execution.
  const manifest=JSON.parse(fs.readFileSync('/app/backend/package.json','utf8'));
  const start=manifest.scripts?.start;
  if(typeof start!=='string'||!/^node [a-zA-Z0-9_./-]+\.(?:js|cjs|mjs)$/.test(start))fail('health_failed');
  const server=child(bwrap,appArgs('/app/backend',[node,start.slice(5)]));
  let serverFailed=false;
  bounded(server,110).then(()=>{serverFailed=true;},()=>{serverFailed=true;});
  const until=Date.now()+12000;let ready=false;
  while(Date.now()<until&&!serverFailed){
    try {const r=await fetch('http://127.0.0.1:3301/api/health',{signal:AbortSignal.timeout(600)});
      const reader=r.body.getReader();let text='',bytes=0;
      while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.length;
        if(bytes>4096){await reader.cancel();throw new Error('health_limit');}text+=Buffer.from(part.value).toString();}
      const body=JSON.parse(text);ready=r.status===200&&body.code===200&&body.message==='Backend Ready';
    }catch(_){}
    if(ready)break;await new Promise(r=>setTimeout(r,150));
  }
  if(!ready)fail('health_failed');
  const check=await bounded(child(node,[modules+'/@playwright/test/cli.js','test','--config=/probe/config.cjs']),80,true);
  if(check.code!==0)fail('probe_failed');
  return {status:'observed',report:JSON.parse(check.text)};
}
main().then(r=>process.stdout.write(JSON.stringify(r))).catch(e=>{
  const allowed=['browser_unavailable','isolation_unavailable','build_failed','health_failed','probe_failed','output_limit'];
  process.stdout.write(JSON.stringify({status:'environment_error',code:allowed.includes(e.code)?e.code:'probe_failed'}));
}).finally(()=>{for(const p of children)p.kill('SIGKILL');});
