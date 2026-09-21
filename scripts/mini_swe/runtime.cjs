// Isolated live app and browser tools. No gateway credentials or evaluator sources are mounted here.
const fs=require('fs'), http=require('http'),{spawn,spawnSync}=require('child_process');
const {chromium,expect}=require('@playwright/test');
const root='/tmp/arc-live';fs.mkdirSync(root,{recursive:true});
fs.cpSync('/workspace/application',root+'/application',{recursive:true});
const app=root+'/application';
const build=spawnSync('npm',['run','build','--silent'],{cwd:app+'/frontend',encoding:'utf8'});
if(build.status){process.stderr.write((build.stdout||'')+(build.stderr||''));process.exit(1);}
const start=JSON.parse(fs.readFileSync(app+'/backend/package.json')).scripts.start.split(/\s+/);
const server=spawn(start[0],start.slice(1),{cwd:app+'/backend',env:{...process.env,PORT:'3000',HOST:'0.0.0.0'},stdio:'ignore'});
let browser,context,page;
async function reset(){if(context)await context.close();context=await browser.newContext({baseURL:'http://127.0.0.1:3000'});page=await context.newPage();page.setDefaultTimeout(10000);await page.goto('/');}
async function main(){
  browser=await chromium.launch({args:['--disable-dev-shm-usage']});
  let ready=false;for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:3000')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
  if(!ready)throw Error('app server not ready');await reset();
  http.createServer(async(req,res)=>{
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    try{
      const body=JSON.parse(Buffer.concat(chunks).toString()||'{}');
      if(body.reset)await reset();
      const log=[];const fn=new (Object.getPrototypeOf(async function(){}).constructor)('page','browser','context','expect','log',body.code||'');
      const value=await fn(page,browser,context,expect,log);
      const snapshot={url:page.url(),text:(await page.locator('body').innerText()).slice(0,14000),controls:await page.locator('input,button,select,a').evaluateAll(ns=>ns.filter(n=>n.getClientRects().length).slice(0,80).map(n=>({tag:n.tagName,text:n.innerText?.slice(0,80),label:n.getAttribute('aria-label'),placeholder:n.getAttribute('placeholder'),type:n.type,value:n.type==='password'?'[fixture password]':n.value})))};
      res.end(JSON.stringify({value,log,snapshot}));
    }catch(e){res.statusCode=400;res.end(JSON.stringify({error:String(e),url:page?.url(),text:page?await page.locator('body').innerText({timeout:1000}).catch(()=>''):''}));}
  }).listen(9222,'127.0.0.1',()=>fs.writeFileSync('/tmp/arc-live-ready','ready'));
}
main().catch(e=>{console.error(String(e));server.kill();process.exit(1)});
