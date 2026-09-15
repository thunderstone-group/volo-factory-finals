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
      // Harness-owned, like /api/health. The interface check reaches the application's
      // states by clicking its own controls, which moves rows; it saves the store here
      // before the walk and puts it back afterwards, so a later check still finds the
      // rows the contract seeded. Product code never needs this route.
      if (route === '/__factory/store' && state.store && typeof state.store.snapshot === 'function') {
        if (req.method === 'GET') {
          res.writeHead(200, {'content-type':'application/json'});
          res.end(JSON.stringify(state.store.snapshot()));
          return;
        }
        if (req.method === 'PUT') {
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          let restored = false;
          try { restored = state.store.restore(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
          catch (error) { restored = false; }
          res.writeHead(restored ? 200 : 400, {'content-type':'application/json'});
          res.end(JSON.stringify({restored}));
          return;
        }
      }
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

# Where the overlay module is served, and the source path the model is told not to
# write. The file itself is emitted by the build into frontend/dist, not shipped in
# frontend/public: creating that directory would make a batch that writes no index.html
# build successfully and then wait out the readiness poll, instead of failing at once.
OVERLAY_URL = "/factory/overlay.js"
OVERLAY_PATH = "frontend/public/factory/overlay.js"

# Harness-owned, served with the scaffold and loaded by the generated index.html.
#
# Run 5 of the 2026-09-14 Keep rehearsal lost REQ-4.2 to a hand-rolled overlay: the
# settings dialog was created after an awaited fetch and hid the controls outside it in
# that async path, while both of its restores were synchronous. An open superseded
# before its fetch resolved left the page hidden with no dialog, and the run never
# recovered. The defect is not specific to settings, to Keep, or to fetch: any overlay
# whose hide runs late and whose restore runs early can reach the same state.
#
# So the harness owns the lifecycle instead of asking every generated application to get
# it right: one open sequence per overlay id, a container that exists from the moment of
# the click, container-level inertness applied and removed on the same synchronous path,
# and one cleanup that every close route funnels through.
OVERLAY = r"""'use strict';
// Harness-owned overlay lifecycle. Do not edit; use it for every dialog, menu,
// palette and settings panel instead of hand-rolling hide and restore.
//
//   const handle = openOverlay('settings', (container, handle) => { ... });
//   fetch('/api/settings').then(r => r.json()).then(data => {
//     if (!handle.isCurrent()) return;            // a newer open superseded this one
//     handle.container.appendChild(renderDialog(data));
//   });
//   closeOverlay('settings');                     // Cancel, Save, Escape, backdrop
//
// The container is in the document before openOverlay returns, so the page is never
// left inert with nothing open: the hide and the restore are both synchronous and both
// tied to the container's lifetime.
(function (global) {
  var records = Object.create(null);    // id -> the currently open record
  var sequences = Object.create(null);  // id -> how many opens that id has had
  var modals = 0;
  var observer = null;

  function overlayContainers() {
    return global.document.querySelectorAll('[data-factory-overlay]');
  }

  // Everything that is not an overlay container becomes unreachable while a modal
  // overlay is open. inert and aria-hidden are the two the accessibility tree honours;
  // aria-modal alone is not, so it is never the only thing applied.
  function hideOutside() {
    var body = global.document.body;
    if (!body) return;
    for (var index = 0; index < body.children.length; index += 1) {
      var node = body.children[index];
      if (node.hasAttribute('data-factory-overlay')) continue;
      if (node.hasAttribute('data-factory-inert')) continue;
      node.setAttribute('data-factory-inert', node.hasAttribute('inert') ? 'kept' : 'added');
      node.setAttribute('inert', '');
      node.setAttribute('aria-hidden', 'true');
    }
  }

  function showOutside() {
    var marked = global.document.querySelectorAll('[data-factory-inert]');
    for (var index = 0; index < marked.length; index += 1) {
      var node = marked[index];
      if (node.getAttribute('data-factory-inert') !== 'kept') {
        node.removeAttribute('inert');
        node.removeAttribute('aria-hidden');
      }
      node.removeAttribute('data-factory-inert');
    }
  }

  // Every close route ends here: closeOverlay, handle.close, a superseding open,
  // Escape, and product code that removes the container itself.
  function finish(id, record) {
    if (!record || records[id] !== record) return;
    delete records[id];
    if (record.container && record.container.parentNode) {
      record.container.parentNode.removeChild(record.container);
    }
    if (record.modal) {
      modals -= 1;
      if (modals <= 0) { modals = 0; showOutside(); }
    }
    if (typeof record.onClose === 'function') {
      try { record.onClose(); } catch (error) { /* a close never throws */ }
    }
  }

  function watch() {
    if (observer || !global.MutationObserver || !global.document.body) return;
    observer = new global.MutationObserver(function () {
      for (var id in records) {
        var record = records[id];
        if (record && record.container && !record.container.isConnected) finish(id, record);
      }
    });
    observer.observe(global.document.body, {childList: true, subtree: true});
  }

  function closeOverlay(id) {
    finish(String(id), records[String(id)]);
  }

  function isOpen(id) {
    return Boolean(records[String(id)]);
  }

  function openOverlay(id, render, options) {
    id = String(id);
    options = options || {};
    var modal = options.modal !== false;
    closeOverlay(id);
    var sequence = sequences[id] = (sequences[id] || 0) + 1;
    var container = global.document.createElement('div');
    container.setAttribute('data-factory-overlay', id);
    if (options.className) container.className = options.className;
    var record = {sequence: sequence, container: container, modal: modal,
                  onClose: options.onClose};
    records[id] = record;
    global.document.body.appendChild(container);
    if (modal) { modals += 1; hideOutside(); }
    watch();
    var handle = {
      id: id,
      sequence: sequence,
      container: container,
      isCurrent: function () { return records[id] === record; },
      close: function () { finish(id, record); },
    };
    if (typeof render === 'function') {
      var result;
      try {
        result = render(container, handle);
      } catch (error) {
        handle.close();
        throw error;
      }
      if (result && typeof result.then === 'function') {
        result.then(null, function () { handle.close(); });
      }
    }
    return handle;
  }

  // One always-available close route, so a superseded or half-rendered overlay is
  // never a trap. The topmost modal overlay closes first.
  global.document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape' && event.keyCode !== 27) return;
    var open = [];
    for (var id in records) if (records[id].modal) open.push(id);
    if (!open.length) return;
    open.sort(function (left, right) { return records[left].sequence - records[right].sequence; });
    closeOverlay(open[open.length - 1]);
  });

  var api = {openOverlay: openOverlay, closeOverlay: closeOverlay, isOpen: isOpen,
             openCount: function () { return Object.keys(records).length; },
             containers: overlayContainers};
  global.factoryOverlay = api;
  global.openOverlay = openOverlay;
  global.closeOverlay = closeOverlay;
})(typeof window !== 'undefined' ? window : globalThis);
"""

# The handler scaffold writes before the model has written anything: a product file by
# path, and no implementation at all. The agent compares against it to tell a batch that
# has written nothing from one that has.
API_STUB = "module.exports=async(req,res)=>false;\n"

BUILD = ("""const fs=require('node:fs');
fs.rmSync('dist',{recursive:true,force:true});
fs.cpSync('public','dist',{recursive:true});
// Harness-owned overlay lifecycle, served at """ + OVERLAY_URL + """.
fs.mkdirSync('dist/factory',{recursive:true});
fs.writeFileSync('dist/factory/overlay.js', """ + json.dumps(OVERLAY) + """);
""")

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
        {"path": "backend/api.cjs", "content": API_STUB},
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
