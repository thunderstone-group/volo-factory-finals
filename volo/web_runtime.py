"""Task-independent runtime for small web applications.

Only build, serving and browser-test lifecycle are supplied here. Product UI,
behavior, data/API logic and assertions are always generated from requirements.
"""
import json
import re


SERVER = r"""const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const base = path.resolve(__dirname, '../frontend/dist');
const api = require('./api.cjs');
if(typeof api !== 'function') throw new Error('backend/api.cjs must export a request handler function');
// Optional harness-managed shared state (volo/state_runtime.py). When backend/state.cjs is
// absent this block is inert and the server behaves exactly as it did before.
let state = null;
try { if (require('node:fs').existsSync(path.join(__dirname, 'state.cjs'))) state = require('./state.cjs'); }
catch (error) { state = {ready: Promise.reject(error)}; }
if (state) state.ready.catch(() => {});
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml'};
http.createServer(async (req,res) => {
  try {
    if (state) {
      const route = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (route === '/api/health') {
        try { await state.ready; }
        catch (error) {
          res.writeHead(503, {'content-type':'application/json'});
          res.end(JSON.stringify({code:503,message:'Backend not ready',error:String(error && error.message || error)}));
          return;
        }
        res.writeHead(200, {'content-type':'application/json'});
        res.end(JSON.stringify({code:200,message:'Backend Ready'}));
        return;
      }
      await state.ready;
    }
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


def implement(workspace, index_html, app_js, checks_js=None, api_js=None, check_command=None):
    """Write the product bundle; prepared checks are written by the caller."""
    files = [{"path": "frontend/public/index.html", "content": index_html}]
    # An empty app.js only invited edits to a file the prompt forbids referencing.
    if app_js and app_js.strip():
        files.append({"path": "frontend/public/app.js", "content": app_js})
    if checks_js is not None:
        files.append({"path": "checks/requirements.cjs", "content": checks_js})
    if api_js is not None and api_js.strip():
        files.append({"path": "backend/api.cjs", "content": api_js})
    workspace.write_files(files)
    result = workspace.verify(check_command or ["node", "--test", "--test-reporter=tap", "checks/requirements.cjs"])
    retained = workspace.capture_failed_prepared_check(result)
    if retained:
        result['retained_self_check'] = retained
    return result


TEST_ID = re.compile(r'(?:test[\s-]?id|data-testid)[s]?\s+(?:of\s+|is\s+|=\s*)?"([^"\n]{1,60})"', re.I)
BUTTON_NAMES = re.compile(r'buttons?\s+(?:named|labell?ed|called)\s+((?:"[^"\n]{1,60}"(?:\s*(?:,|and|or)\s*)?)+)', re.I)
QUOTED = re.compile(r'"([^"\n]{1,60})"')
PREPARED_HEADER = "const {test,assert}=require('./browser.cjs');\n"


def prepared_assertions(text):
    """Derive presence assertions from names the requirement states literally.

    Only quoted literals are used, and only for existence of the exact test id or
    button accessible name the requirement names. This is deterministic harness
    input, never a model claim, and it asserts strictly less than the written
    requirement; behavioral outcomes stay with the official evaluation.
    """
    lines, seen = [], set()
    for name in TEST_ID.findall(text or ''):
        if ('testid', name) in seen:
            continue
        seen.add(('testid', name))
        locator = 'page.getByTestId(%s)' % json.dumps(name)
        lines.append('  await %s.first().waitFor({state:"attached"});' % locator)
        lines.append('  assert.equal(await %s.count(),1,%s);'
                     % (locator, json.dumps('Expected exactly one element with test id ' + name)))
    for group in BUTTON_NAMES.findall(text or ''):
        for name in QUOTED.findall(group):
            if ('button', name) in seen:
                continue
            seen.add(('button', name))
            # Name matching and waiting follow the public specifications: a role/name
            # lookup that retries, never a stricter or a substring match.
            lines.append('  await page.getByRole("button",{name:%s}).waitFor({state:"visible"});'
                         % json.dumps(name))
    return lines


def prepared_check(text):
    """A complete executable check file; the wrapper also rejects page errors."""
    body = prepared_assertions(text) or ['  assert.equal(await page.locator("body").count(),1);']
    return (PREPARED_HEADER + "test('prepared interface check',async(page,assert)=>{\n"
            + '\n'.join(body) + '\n});\n')
