"""Real isolated browser acceptance of the shared code on synthetic domain data."""
import argparse,json,hashlib,shutil
from pathlib import Path
from oneshot.v2.main import starter
from scripts.evaluate_minimal import evaluate
from scripts.run_minimal_paired import IMAGE

APP='''const UI=VoloInteraction;
const edit=UI.editor({name:'Record editor',presentation:new URLSearchParams(location.search).get('mode')||'dialog',fields:[{name:'name',label:'Name',required:true},{name:'description',label:'Description',type:'richtext'}],saveLabel:'Save record',cancelLabel:'Cancel',
 async onSave(values,id){const response=await fetch('/api/record',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,...values})});if(!response.ok)throw new Error('Save failed');nav.update(await response.json());}});
const nav=VoloNavigation.create({root:document.getElementById('app'),render(route,state,api){
 route=route.split('?')[0];
 const section=document.createElement('section');section.append(api.link('Home','/'),api.link('Records','/records'));
 if(route==='/records'){
  const title=document.createElement('h1');title.textContent='Records';section.append(title);
  for(const record of state.records){const row=document.createElement('article');row.setAttribute('aria-label',record.name);
   row.append(api.link(record.name,'/record/'+record.id));UI.rowActions(row,record.name+' actions',[{label:'Edit record',onClick:()=>edit.open(record,record.id)}]);section.append(row);}
 }else if(route.startsWith('/record/')){const record=state.records.find(x=>x.id===route.split('/').pop());const title=document.createElement('h1');title.textContent=record.name;section.append(title);}
 else {const title=document.createElement('h1');title.textContent='Synthetic records';section.append(title);}
 return section;
}});
'''

def main(root):
 root=Path(root).resolve();root.mkdir(parents=True,exist_ok=True);app=root/'app';app.mkdir();fixed=starter(app)
 source=(app/'backend/server.cjs').read_text().replace('const state={};',"const state={records:[{id:'r1',name:'Alpha',description:'<b>Details</b><img src=x onerror=alert(1)>'},{id:'r2',name:'Gamma',description:'<b>Details</b>'}]};")
 source=source.replace("if(url.pathname==='/api/health')", """if(url.pathname==='/api/record'&&req.method==='POST'){let body='';req.on('data',x=>body+=x);req.on('end',()=>{const data=JSON.parse(body);const record=state.records.find(x=>x.id===data.id);record.name=data.name;record.description=data.description;res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(state));});return;}
 if(url.pathname==='/api/health')""")
 (app/'backend/server.cjs').write_text(source);(app/'frontend/public/app.js').write_text(APP)
 tests=root/'suite';shutil.copytree(Path(__file__).resolve().parents[1]/'tests_oneshot/v2_browser',tests)
 (tests/'shared-hashes.json').write_text(json.dumps({Path(n).name:v for n,v in fixed.items()}))
 result=evaluate(app,tests,root/'evaluation',IMAGE,3)
 (root/'acceptance.json').write_text(json.dumps(result,indent=2)+'\n')
 print(json.dumps({k:result.get(k) for k in ('status','passed','failed','cleanup_verified')},indent=2))
 if result['status']!='scored' or result['passed']!=3 or not result['cleanup_verified']:raise SystemExit(1)

if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('evidence_root',type=Path);main(p.parse_args().evidence_root)
