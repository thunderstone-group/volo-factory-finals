"""Task-independent runtime for small web applications.

Only build, serving and browser-test lifecycle are supplied here. Product UI,
behavior, data/API logic and assertions are always generated from requirements.
"""
import json


SERVER = r"""const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const base = path.resolve(__dirname, '../frontend/dist');
const api = require('./api.cjs');
if(typeof api !== 'function') throw new Error('backend/api.cjs must export a request handler function');
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml'};
http.createServer(async (req,res) => {
  try {
    if (await api(req,res) || res.writableEnded) return;
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file = path.resolve(base, '.' + pathname);
    if (file !== base && !file.startsWith(base + path.sep)) {res.writeHead(403);res.end();return;}
    if (file === base) file = path.join(base, 'index.html');
    let body;
    try {body=await fs.readFile(file);}
    catch(err) {
      if(path.extname(file) || pathname.startsWith('/api/')) {res.writeHead(404);res.end('Not found');return;}
      file=path.join(base,'index.html');body=await fs.readFile(file);
    }
    res.writeHead(200, {'content-type':types[path.extname(file)] || 'application/octet-stream'});
    res.end(body);
  } catch(err) {res.writeHead(500);res.end('Server error');console.error(err);}
}).listen(Number(process.env.PORT || 3000), '0.0.0.0');
"""

BUILD = """const fs=require('node:fs');
fs.rmSync('dist',{recursive:true,force:true});
fs.cpSync('public','dist',{recursive:true});
"""

BROWSER_CHECK = r"""const nodeTest=require('node:test');
const assert=require('node:assert/strict');
function test(name,check){
  nodeTest.test(name,async()=>{
    if(!process.env.FACTORY_PLAYWRIGHT_MODULE) throw new Error('Provided Playwright is unavailable');
    const {chromium}=require(process.env.FACTORY_PLAYWRIGHT_MODULE);
    const browser=await chromium.launch();
    let page;const errors=[];const pending=new Map();
    try{page=await browser.newPage({baseURL:process.env.FACTORY_BASE_URL});
      page.setDefaultTimeout(5000);page.setDefaultNavigationTimeout(15000);
      page.on('pageerror',error=>errors.push(error.message));
      page.on('request',request=>pending.set(request,request.method()+' '+new URL(request.url()).pathname));
      page.on('requestfinished',request=>pending.delete(request));
      page.on('requestfailed',request=>pending.delete(request));
      await page.goto(process.env.FACTORY_BASE_URL);
      if(errors.length) throw new Error('Browser JavaScript errors: '+errors.join('; '));
      await check(page,assert);
      if(errors.length) throw new Error('Browser JavaScript errors: '+errors.join('; '));
      const repeated=await page.getByRole('link').evaluateAll(links=>{
        const primary=new Set();const targets=new Map();
        for(const link of links){
          const raw=link.getAttribute('href');if(!raw||raw.startsWith('#'))continue;
          const url=new URL(raw,location.href);
          if(url.origin!==location.origin||(url.pathname==='/'&&!url.search))continue;
          const target=url.pathname+url.search+url.hash;
          if(link.closest('nav,[role="navigation"],#nav'))primary.add(target);
          const labels=targets.get(target)||[];
          labels.push(link.getAttribute('aria-label')||link.textContent.trim());targets.set(target,labels);
        }
        return [...primary].filter(target=>targets.get(target).length>1)
          .map(target=>({target,labels:targets.get(target)}));
      });
      assert.equal(repeated.length,0,'Keep one visible link to each primary page; remove repeated shortcuts: '+JSON.stringify(repeated));
      assert.equal(await page.getByRole('meter',{name:/^\s*$/}).count(),0,
        'Visible meters must have an accessible name from a label or aria-label');
    }catch(error){
      try{error.message+='\nBrowser state: '+JSON.stringify({
        url:page.url(),visible_text:(await page.locator('body').innerText({timeout:1000})).slice(0,6000),
        pending_requests:[...pending.values()].slice(0,10),page_errors:errors.slice(0,10)});
      }catch{}
      throw error;
    }finally{await browser.close();}
  });
}
module.exports={test,assert};
"""


def scaffold(workspace):
    workspace.write_files([
        {"path": "frontend/package.json", "content": json.dumps({"private": True, "scripts": {"build": "node build.cjs"}})},
        {"path": "frontend/build.cjs", "content": BUILD},
        {"path": "backend/package.json", "content": json.dumps({"private": True, "scripts": {"start": "node server.cjs"}})},
        {"path": "backend/server.cjs", "content": SERVER},
        {"path": "backend/api.cjs", "content": "module.exports=async(req,res)=>false;\n"},
        {"path": "checks/browser.cjs", "content": BROWSER_CHECK},
    ])


def implement(workspace, index_html, app_js, checks_js, api_js=None):
    files = [
        {"path": "frontend/public/index.html", "content": index_html},
        {"path": "frontend/public/app.js", "content": app_js},
        {"path": "checks/requirements.cjs", "content": checks_js},
    ]
    if api_js is not None and api_js.strip():
        files.append({"path": "backend/api.cjs", "content": api_js})
    workspace.write_files(files)
    return workspace.verify(["node", "--test", "checks/requirements.cjs"])
