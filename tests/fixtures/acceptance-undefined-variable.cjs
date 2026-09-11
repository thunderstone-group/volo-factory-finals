// Minimized from generated E022 acceptance script, run 02be3333a76c.
// The original declared t inside uniq but used it inside fillRegister.
const {test,assert}=require('./acceptance-browser.cjs');
function uniq(){const t=Date.now();return `user-${t}`;}
async function fillRegister(page,u,opts={}){
  const o=Object.assign({name:`Ticket User ${t}`},opts);
  await page.getByLabel('姓名').fill(o.name);
}
test('fill valid data',async(page)=>{await fillRegister(page,uniq());});
