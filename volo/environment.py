"""Bounded tool discovery: try local/provided modules before scanning metadata."""
from __future__ import annotations

import json
import math
import os
import subprocess
from pathlib import Path


# Both filesystem discovery and module loading live in the timed child. Limiting
# only the final require() left the former Python directory walk outside any cap.
PROBE = r"""const fs=require('node:fs'),path=require('node:path');
const cfg=JSON.parse(process.argv[1]);let entries=0;
const visited=new Set();
function probe(candidate){
 if(!candidate||visited.has(candidate))return;visited.add(candidate);
 try{const resolved=require.resolve(candidate,{paths:[process.cwd()]});const pw=require(resolved);
 const executable=pw.chromium.executablePath();
 if(typeof executable==='string'&&fs.existsSync(executable)){
  console.log(JSON.stringify({available:true,module:resolved,chromium_executable:executable}));process.exit(0);
 }}catch{}
}
function children(dir){
 const found=[];let handle;
 try{handle=fs.opendirSync(dir);let item;
  while(entries<cfg.max_entries&&(item=handle.readSync())){entries++;found.push(item);}
 }catch{}finally{if(handle)try{handle.closeSync();}catch{}}
 return found.sort((a,b)=>a.name.localeCompare(b.name));
}
probe('playwright');probe('playwright-core');probe(cfg.provided);
probe('/opt/arcbench/node_modules/playwright');probe('/opt/arcbench/node_modules/playwright-core');
if(cfg.cache&&cfg.cache!=='0'){
 for(const entry of children(path.join(cfg.cache,'.links'))){
  if(!entry.isFile()||entry.isSymbolicLink())continue;
  try{const file=path.join(cfg.cache,'.links',entry.name);
   if(fs.statSync(file).size>4096)continue;
   const module=fs.readFileSync(file,'utf8').trim();probe(path.join(path.dirname(module),'playwright'));probe(module);
  }catch{}
 }
}
const queue=[[path.join(process.cwd(),'node_modules'),0],['/opt',0],
 ['/usr/local/lib/node_modules',0],['/usr/share/nodejs',0]];
const excluded=new Set(['.git','tests','test','examples','docs','browsers']);
while(queue.length&&entries<cfg.max_entries){
 const [dir,depth]=queue.shift();
 if(['playwright','playwright-core'].includes(path.basename(dir))){probe(dir);continue;}
 if(depth>=5)continue;
 for(const entry of children(dir))if(entry.isDirectory()&&!entry.isSymbolicLink()&&!excluded.has(entry.name)){
  queue.push([path.join(dir,entry.name),depth+1]);
 }
}
console.log(JSON.stringify({available:false,reason:'not_found_within_metadata_budget'}));
"""


def discover_playwright(project: Path, *, timeout=3.0, max_entries=2500):
    if not math.isfinite(timeout) or timeout <= 0 or not isinstance(max_entries, int) or max_entries < 1:
        raise ValueError('Discovery requires a positive finite timeout and entry budget')
    config = {'provided': os.getenv('FACTORY_PLAYWRIGHT_MODULE'),
              'cache': os.getenv('PLAYWRIGHT_BROWSERS_PATH'), 'max_entries': max_entries}
    # Discovery does not need model credentials or arbitrary Node preload hooks.
    env = {k: v for k, v in os.environ.items() if k in
           ('PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'SYSTEMROOT', 'WINDIR', 'PLAYWRIGHT_BROWSERS_PATH')}
    env['PLAYWRIGHT_SKIP_BROWSER_GC'] = '1'
    try:
        result = subprocess.run(['node', '-e', PROBE, json.dumps(config)], cwd=project,
                                capture_output=True, text=True, timeout=timeout, env=env)
        value = json.loads(result.stdout) if result.returncode == 0 else {'available': False}
        return value if isinstance(value, dict) and isinstance(value.get('available'), bool) else {'available': False}
    except subprocess.TimeoutExpired:
        return {'available': False, 'reason': 'discovery_timeout'}
    except (OSError, ValueError):
        return {'available': False, 'reason': 'discovery_failed'}
