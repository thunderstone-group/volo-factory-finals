const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const {chromium} = require('playwright');
const app = process.argv[2];
const output = process.argv[3];
async function main() {
  cp.execFileSync('npm', ['--prefix', path.join(app, 'frontend'), 'run', 'build'], {stdio:'ignore'});
  const port = 45673;
  const server = cp.spawn('node', ['server.js'], {cwd:path.join(app,'backend'),env:{...process.env,PORT:String(port)},stdio:'ignore'});
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage();
    for(let i=0;i<50;i++){try{if((await fetch(`http://127.0.0.1:${port}/api/health`)).ok)break;}catch{} await new Promise(r=>setTimeout(r,100));}
    await page.goto(`http://127.0.0.1:${port}`);
    await page.getByRole('link',{name:'Q3 Sales',exact:true}).click();
    const grid = page.getByRole('grid',{name:'Worksheet grid',exact:true});
    const start = await grid.getByRole('gridcell',{name:'A1',exact:true}).boundingBox();
    const end = await grid.getByRole('gridcell',{name:'C4',exact:true}).boundingBox();
    await page.mouse.move(start.x+start.width/2,start.y+start.height/2);await page.mouse.down();
    await page.mouse.move(end.x+end.width/2,end.y+end.height/2,{steps:8});await page.mouse.up();
    await page.getByRole('button',{name:'Data',exact:true}).click();
    await page.getByRole('menuitem',{name:'Create filter',exact:true}).click();
    await page.evaluate(()=>{
      window.pointerEvidence=[];
      for(const kind of ['mousedown','mouseup','click'])document.addEventListener(kind,e=>{
        const t=e.target;
        const row={kind,tag:t.tagName,action:t.getAttribute('data-action'),name:t.getAttribute('aria-label')};
        window.pointerEvidence.push(row);queueMicrotask(()=>row.connectedAfter=t.isConnected);
      },true);
    });
    await page.getByRole('button',{name:'Filter Region',exact:true}).click();
    const result = {filterDialogVisible:await page.getByRole('dialog',{name:'Filter Region',exact:true}).isVisible(),
      clearSelectionVisible:await page.getByRole('button',{name:'Clear selection',exact:true}).isVisible(),
      events:await page.evaluate(()=>window.pointerEvidence)};
    fs.writeFileSync(output,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
  } finally {await browser.close();server.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
