"""Explicit lab-only probe, injected by scripts/package_rule_probe.py.

Reads the test directory named in our official run report. It never changes tests,
executes test source, exports credentials, traverses host directories, or opens a network
connection. The normal agent package does not include this module.
"""
import os
import subprocess
from pathlib import Path


SOURCE = r'''const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const DEFAULT_ROOT='/workspace/tests', MAX_FILE=65536, MAX_TOTAL=1048576;
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function redact(text){
  for(const [key,value] of Object.entries(process.env)){
    if(value.length>=8&&/api.?key|token|secret|password|cookie|authorization|session/i.test(key))
      text=text.split(value).join('[REDACTED]');
  }
  return text.replace(/((?:api[_-]?key|access[_-]?token|secret|password|authorization|cookie)\s*[=:]\s*)(["'])([^"'\n]*)\2/gi,
    (_,prefix,quote)=>prefix+quote+'[REDACTED]'+quote)
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi,'Bearer [REDACTED]');
}
function readRule(root,relative,budget,includeContent){
  const record={path:relative};let fd;
  try{
    let current=root;
    for(const part of relative.split('/')){
      if(!part||part==='.'||part==='..')throw Object.assign(new Error(),{code:'INVALID_PATH'});
      current=path.join(current,part);
      if(fs.lstatSync(current).isSymbolicLink())throw Object.assign(new Error(),{code:'SYMLINK_SKIPPED'});
    }
    fd=fs.openSync(current,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK);
    const stat=fs.fstatSync(fd);
    if(!stat.isFile())throw Object.assign(new Error(),{code:'NOT_REGULAR_FILE'});
    if(stat.size>MAX_FILE||stat.size>budget.remaining)throw Object.assign(new Error(),{code:'SIZE_LIMIT'});
    const buffer=Buffer.alloc(Math.min(MAX_FILE,budget.remaining)+1);
    let length=0,read;
    while(length<buffer.length&&(read=fs.readSync(fd,buffer,length,buffer.length-length,length)))length+=read;
    if(length>MAX_FILE||length>budget.remaining)throw Object.assign(new Error(),{code:'SIZE_LIMIT'});
    const raw=buffer.subarray(0,length);budget.remaining-=length;
    Object.assign(record,{status:'read',bytes:length,sha256:hash(raw)});
    if(includeContent){const content=redact(raw.toString('utf8'));
      record.content=content;record.redacted=content!==raw.toString('utf8');}
  }catch(error){record.status=String(error.code||'READ_FAILED');}
  finally{if(fd!==undefined)fs.closeSync(fd);}
  return record;
}
function capture(output,phase='agent',root=DEFAULT_ROOT){
  const report={schema_version:1,scope:'current_run_test_configuration',phase,
    collected_at:new Date().toISOString(),test_root:root,
    process:{node:process.versions.node,platform:process.platform,arch:process.arch},
    files:[],test_inventory:[],limits:{max_file_bytes:MAX_FILE,max_total_bytes:MAX_TOTAL,max_test_files:32}};
  try{
    if(fs.realpathSync(root)!==path.resolve(root))throw Object.assign(new Error(),{code:'SYMLINK_ROOT_SKIPPED'});
    const budget={remaining:MAX_TOTAL};
    for(const relative of ['playwright.config.ts','package.json','support/e2e.ts'])
      report.files.push(readRule(root,relative,budget,true));
    // Bound both directory enumeration and file reads; no recursive discovery.
    const dir=fs.opendirSync(root);let count=0,item;const names=[];
    try{while(count++<128&&(item=dir.readSync())){
      if(item.isFile()&&/\.(spec|test)\.[cm]?[jt]sx?$/.test(item.name))names.push(item.name);
    }}finally{dir.closeSync();}
    report.inventory_truncated=count>128||names.length>32;
    for(const name of names.sort().slice(0,32))report.test_inventory.push(readRule(root,name,budget,false));
    report.bytes_read=MAX_TOTAL-budget.remaining;
    const config=report.files[0];
    report.status=config.status==='read'&&config.bytes>0&&/defineConfig|module\.exports|export\s+default/.test(config.content)
      ?'config_captured':'config_unavailable';
  }catch(error){report.status=String(error.code||'PROBE_FAILED');}
  try{
    fs.mkdirSync(path.dirname(output),{recursive:true,mode:0o700});
    const temporary=output+'.tmp-'+process.pid;
    fs.writeFileSync(temporary,JSON.stringify(report,null,2)+'\n',{mode:0o600,flag:'wx'});
    fs.renameSync(temporary,output);
  }catch(error){console.error('[VOLO rules probe] output unavailable: '+String(error.code||'WRITE_FAILED'));}
  console.error('[VOLO rules probe] '+phase+': '+report.status);
  return report;
}
function watch(output){
  const initial=capture(output,'server_start');
  if(initial.status==='config_captured')return;
  // Runner logs show that configuration is prepared after starting our server.
  // Observe only that exact file, for at most 20 seconds; never extend server life.
  let attempts=0;const timer=setInterval(()=>{
    attempts++;
    if(fs.existsSync(path.join(DEFAULT_ROOT,'playwright.config.ts'))||attempts>=40){
      const report=capture(output,'server_after_config');
      if(report.status==='config_captured'||attempts>=40)clearInterval(timer);
    }
  },500);timer.unref();
}
module.exports={capture,watch};
if(require.main===module)capture(process.argv[2],'agent');
'''


def capture_agent_rules(directory: Path):
    script = directory / 'runner_rules_probe.cjs'
    script.write_text(SOURCE)
    os.chmod(script, 0o600)
    env = {key: value for key, value in os.environ.items()
           if key not in ('NODE_OPTIONS', 'NODE_PATH')}
    try:
        subprocess.run(['node', str(script), str(directory / 'runner-rules-agent.json')],
                       env=env, timeout=3, check=False)
    except (OSError, subprocess.TimeoutExpired) as error:
        print('[VOLO rules probe] agent: ' + type(error).__name__, flush=True)
