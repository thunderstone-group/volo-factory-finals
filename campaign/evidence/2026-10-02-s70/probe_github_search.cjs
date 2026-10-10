const cp=require('node:child_process'),path=require('node:path'),fs=require('node:fs');
const {chromium,expect}=require('@playwright/test');
const app=process.argv[2],output=process.argv[3];
async function run(){
  cp.execFileSync('npm',['--prefix',path.join(app,'frontend'),'run','build'],{stdio:'ignore'});
  const server=cp.spawn('node',['server.js'],{cwd:path.join(app,'backend'),env:{...process.env,PORT:'45674'},stdio:'ignore'});
  const browser=await chromium.launch();
  try{
    for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:45674/api/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
    const page=await browser.newPage(),results=[];
    await page.goto('http://127.0.0.1:45674');
    await page.getByRole('link',{name:'acme-docs',exact:true}).click();
    const search=page.getByLabel('Search',{exact:true});
    await search.fill('search flow');await search.press('Enter');
    await page.getByRole('link',{name:'Code',exact:true}).click();
    await expect(search).toHaveValue('search flow');
    await page.getByRole('link',{name:'README.md',exact:true}).click();
    await expect(page.getByText('search flow',{exact:true})).toBeVisible();
    await page.reload();
    await expect(page.getByText('search flow',{exact:true})).toBeVisible();
    results.push('matching file and reload retain the actual matched text');
    for(let i=0;i<2;i++){
      await page.goto('http://127.0.0.1:45674');
      await page.getByRole('link',{name:'acme-docs',exact:true}).click();
      await search.fill('no-such-token');await search.press('Enter');
      await page.getByRole('link',{name:'Code',exact:true}).click();
      await expect(page.getByText('No code results',{exact:true})).toBeVisible();
      await expect(search).toHaveValue('no-such-token');
    }
    results.push('absent query retains its value and empty results on repeat');
    fs.writeFileSync(output,JSON.stringify({results},null,2));console.log(JSON.stringify({results}));
  }finally{await browser.close();server.kill();}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
