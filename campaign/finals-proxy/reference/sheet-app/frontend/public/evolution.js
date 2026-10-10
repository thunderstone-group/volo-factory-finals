'use strict';
(function () {
  const A=window.ARC,P=window.APP,H=P.helpers,esc=A.esc;
  const w=H.currentWorkbook,s=H.currentSheet,view=()=>A.state.ui||(A.state.ui={});
  const clone=x=>JSON.parse(JSON.stringify(x));
  const button=(label,action,extra='')=>`<button type="button" data-action="${action}" ${extra}>${esc(label)}</button>`;
  const input=(label,name,value='',multi=false)=>`<label>${esc(label)}${multi?`<textarea name="${name}" aria-label="${esc(label)}">${esc(value)}</textarea>`:`<input name="${name}" aria-label="${esc(label)}" value="${esc(value)}">`}</label>`;
  const check=(label,name)=>`<label><input type="checkbox" name="${name}">${esc(label)}</label>`;
  const select=(label,name,options,value)=>A.combobox({label,name,options,value});
  const form=(action,html,submit,extra='')=>`<form data-action="${action}" ${extra}>${html}<button type="submit">${esc(submit)}</button></form>`;
  const dialog=(title,html)=>A.openDialog(html,{title});
  const region=(name,html)=>`<section role="region" aria-label="${esc(name)}">${html}</section>`;
  const done=()=>{H.touch(w());A.save();A.closeDialog();A.render();};
  const selectedRef=()=>{const sel=H.normSel(s().selection);return H.refOf(sel.r1,sel.c1);};
  const old={...P.actions};
  const beforeRender=P.afterRender;
  P.afterRender=function(...args){
    beforeRender?.apply(this,args);if(!w()||!s())return;
    const book=w(),sheet=s(),toolbar=document.querySelector('.toolbar'),tabbar=document.querySelector('.tabbar');
    toolbar.insertAdjacentHTML('beforeend',`<span class="menu-wrap">${button('View','view-menu')}</span>`+button('Find and replace','find-dialog')+button('Insert note','note-new')+button('Make a copy','workbook-copy'));
    tabbar.insertAdjacentHTML('beforeend',button('Hidden sheets','hidden-sheets'));
    const grid=document.querySelector('[data-grid]');
    const frozen=Number(sheet.frozenRows||0);
    grid.insertAdjacentHTML('beforebegin',region('Frozen rows',`<span>${frozen} ${frozen===1?'row':'rows'} frozen</span>`)+(sheet.hiddenCols||[]).map(c=>button('Show column '+H.colName(c),'show-column',`data-c="${c}"`)).join(''));
    if(frozen){
      grid.style.maxHeight='60vh';const rows=[...grid.children];let offset=0;
      rows.slice(0,frozen+1).forEach(row=>{Object.assign(row.style,{position:'sticky',top:offset+'px',zIndex:'3',background:'#fff'});offset+=row.getBoundingClientRect().height;});
    }
    for(const [ref,note] of Object.entries(sheet.notes||{})){
      const cell=grid.querySelector(`[data-ref="${ref}"]`);if(!cell||!note)continue;
      cell.insertAdjacentHTML('afterend',`<button type="button" class="note-indicator" aria-label="Show note for ${ref}" data-action="note-open" data-ref="${ref}"></button>`);
    }
    const ref=selectedRef(),rule=H.ruleAt(sheet,ref);
    if(rule?.invalidAction==='Show warning'&&H.checkValidation(sheet,ref,sheet.cells[ref],true))grid.insertAdjacentHTML('beforebegin','<p role="status" aria-label="Validation warning">Validation warning</p>');
    if(view().namedRangesOpen)document.querySelector('.editor-head').insertAdjacentHTML('afterend',namedPanel(book));
  };
  function menuExtra(items){const wrap=A._popover;if(wrap)wrap.insertAdjacentHTML('beforeend',items.map(([label,action,extra=''])=>button(label,action,`role="menuitem" ${extra}`)).join(''));}
  P.actions['open-data-menu']=function(ctx){old['open-data-menu'].call(this,ctx);menuExtra([['Named ranges','named-ranges'],['Trim whitespace','trim-space'],['Split text to columns','split-dialog'],['Remove duplicates','duplicates-dialog']]);};
  P.actions['sheet-menu']=function(ctx){old['sheet-menu'].call(this,ctx);menuExtra([['Duplicate','sheet-duplicate',`data-id="${esc(ctx.id)}"`],['Hide','sheet-hide',`data-id="${esc(ctx.id)}"`],['Move left','sheet-left',`data-id="${esc(ctx.id)}"`]]);};
  P.actions['grid-paste-values']=()=>{const text=H.copiedValues();if(text!==null)H.pasteInto(text,null);};
  P.actions['view-menu']=ctx=>A.openPopover(ctx.el.parentElement,button('Freeze rows','freeze-dialog','role="menuitem"')+button('Show formulas','show-formulas',`role="menuitemcheckbox" aria-checked="${!!s().showFormulas}"`),{kind:'menu'});
  P.actions['show-formulas']=()=>{s().showFormulas=!s().showFormulas;done();};
  P.actions['freeze-dialog']=()=>dialog('Freeze rows',form('freeze-save',input('Rows to freeze','rows',s().frozenRows||0),'Save'));
  P.actions['freeze-save']=ctx=>{const n=Number(ctx.form.rows);if(!Number.isInteger(n)||n<0||n>1000){A.notify('Enter a valid row count');return;}s().frozenRows=n;done();};
  P.actions['hide-column']=ctx=>{const c=Number(ctx.data.c);s().hiddenCols=[...new Set([...(s().hiddenCols||[]),c])].sort((a,b)=>a-b);done();};
  P.actions['show-column']=ctx=>{s().hiddenCols=(s().hiddenCols||[]).filter(c=>c!==Number(ctx.data.c));done();};

  function parseRange(text){const parts=text.trim().toUpperCase().split(':');if(parts.length>2)return null;const a=H.parseRef(parts[0]),b=H.parseRef(parts[1]||parts[0]);if(!a||!b||a.r<0||b.r<0||a.c<0||b.c<0||a.r>=1000||b.r>=1000||a.c>=702||b.c>=702)return null;return H.normSel({r0:a.r,c0:a.c,r1:b.r,c1:b.c});}
  function namedPanel(book){return region('Named ranges',`<h2>Named ranges</h2>${button('Add named range','range-new')}${(book.namedRanges||[]).map(n=>region(n.name,`<h3>${esc(n.name)}</h3><p>${esc(n.range)}</p>${button('Edit','range-edit',`data-id="${esc(n.id)}"`)}${button('Delete','range-delete',`data-id="${esc(n.id)}"`)}`)).join('')}`);}
  function rangeDialog(n){dialog('Named range',form('range-save',input('Name','name',n?.name||'')+input('Range','range',n?.range||H.rangeLabel(H.normSel(s().selection))),'Save',`data-id="${esc(n?.id||'')}"`));}
  P.actions['named-ranges']=()=>{view().namedRangesOpen=true;A.save();A.render();};
  P.actions['range-new']=()=>rangeDialog(null);
  P.actions['range-edit']=ctx=>rangeDialog((w().namedRanges||[]).find(n=>n.id===ctx.id));
  P.actions['range-save']=ctx=>{
    const name=ctx.form.name.trim(),range=parseRange(ctx.form.range),book=w();
    book.namedRanges=book.namedRanges||[];
    if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)||H.parseRef(name)||!range||book.namedRanges.some(n=>n.name.toLowerCase()===name.toLowerCase()&&n.id!==ctx.id)){A.notify('Invalid or duplicate named range');return;}
    let n=book.namedRanges.find(n=>n.id===ctx.id);
    if(n&&name!==n.name){const previous=n.name.toLowerCase();for(const sheet of book.sheets)for(const ref of Object.keys(sheet.cells)){const raw=sheet.cells[ref];if(raw.startsWith('='))sheet.cells[ref]=raw.replace(/"(?:""|[^"])*"|[A-Za-z_][A-Za-z0-9_]*/g,token=>token.toLowerCase()===previous?name:token);}}
    if(!n){n={id:A.uid('range'),sheetId:s().id};book.namedRanges.push(n);}
    Object.assign(n,{name,range:H.rangeLabel(range)});done();
  };
  P.actions['range-delete']=ctx=>dialog('Delete named range',`<p>Remove this range definition and keep its cells?</p>${button('Delete','range-delete-confirm',`data-id="${esc(ctx.id)}"`)}${button('Cancel','arc:close')}`);
  P.actions['range-delete-confirm']=ctx=>{w().namedRanges=(w().namedRanges||[]).filter(n=>n.id!==ctx.id);done();};

  let findCursor=-1,findSignature='';
  P.actions['find-dialog']=()=>{findCursor=-1;findSignature='';dialog('Find and replace',`<form>${input('Find','find')}${input('Replace with','replace')}${check('Match case','matchCase')}${check('Search in formulas','formulas')}${button('Find next','find-next')}${button('Replace all','replace-all')}${button('Close','arc:close')}<p role="status" aria-label="Find result" data-find-status></p></form>`);};
  function findOptions(ctx){return Object.fromEntries(new FormData(ctx.el.closest('form')));}
  function literalRegex(text,caseSensitive){return new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),caseSensitive?'g':'gi');}
  function sortedRefs(sheet){return Object.keys(sheet.cells).sort((a,b)=>{const x=H.parseRef(a),y=H.parseRef(b);return x.r-y.r||x.c-y.c;});}
  P.actions['find-next']=ctx=>{
    const opts=findOptions(ctx);if(!opts.find)return;
    const sig=JSON.stringify(opts),val=H.makeValuer(s());if(sig!==findSignature){findCursor=-1;findSignature=sig;}
    const matches=sortedRefs(s()).filter(ref=>literalRegex(opts.find,opts.matchCase).test(opts.formulas?s().cells[ref]:H.display(s(),val,ref)));
    if(!matches.length){document.querySelector('[data-find-status]').textContent='No matches';return;}
    const ref=matches[(++findCursor)%matches.length],pos=H.parseRef(ref);s().selection={r0:pos.r,c0:pos.c,r1:pos.r,c1:pos.c};A.save();A.render();document.querySelector('[data-find-status]').textContent='Match '+ref;
  };
  P.actions['replace-all']=ctx=>{
    const opts=findOptions(ctx);if(!opts.find)return;let count=0;const copy=clone(s()),updates=[];
    for(const ref of sortedRefs(copy)){
      const raw=String(copy.cells[ref]);if(raw.startsWith('=')&&!opts.formulas)continue;
      const next=raw.replace(literalRegex(opts.find,opts.matchCase),()=>{count++;return opts.replace||'';});
      if(next!==raw)updates.push({ref,text:next});
    }
    const err=H.applyCells(copy,updates);if(err){A.notify(String(err));return;}
    if(updates.length)H.commitSheet(w(),s(),copy);A.render();document.querySelector('[data-find-status]').textContent=`${count} ${count===1?'replacement':'replacements'}`;
  };

  P.actions['sheet-duplicate']=ctx=>{
    const book=w(),source=book.sheets.find(sh=>sh.id===ctx.id);if(!source)return;
    const copy=clone(source);copy.id=A.uid('sheet');let name='Copy of '+source.name,n=2;while(book.sheets.some(sh=>sh.name===name))name='Copy of '+source.name+' '+n++;
    copy.name=name;copy.hidden=false;copy.validations=(copy.validations||[]).map(v=>({...v,id:A.uid('rule')}));H.pushHistory(book);book.sheets.splice(book.sheets.indexOf(source)+1,0,copy);book.activeSheetId=copy.id;done();
  };
  P.actions['sheet-hide']=ctx=>{
    const book=w(),target=book.sheets.find(sh=>sh.id===ctx.id),visible=book.sheets.filter(sh=>!sh.hidden);if(!target)return;
    if(visible.length===1){A.notify('A workbook must contain at least one visible worksheet');return;}
    H.pushHistory(book);target.hidden=true;if(book.activeSheetId===target.id){const index=visible.indexOf(target);book.activeSheetId=visible[index?index-1:1].id;}done();
  };
  P.actions['hidden-sheets']=()=>dialog('Hidden sheets',w().sheets.filter(sh=>sh.hidden).map(sh=>button('Show '+sh.name,'sheet-show',`data-id="${esc(sh.id)}"`)).join('')+button('Close','arc:close'));
  P.actions['sheet-show']=ctx=>{const target=w().sheets.find(sh=>sh.id===ctx.id);if(!target)return;target.hidden=false;w().activeSheetId=target.id;done();};
  P.actions['sheet-left']=ctx=>{const book=w(),index=book.sheets.findIndex(sh=>sh.id===ctx.id);if(index<=0)return;H.pushHistory(book);const [sheet]=book.sheets.splice(index,1);book.sheets.splice(index-1,0,sheet);done();};

  function noteDialog(ref){dialog('Cell note',form('note-save',input('Note','note',s().notes?.[ref]||'',true),'Save',`data-ref="${ref}"`)+(s().notes?.[ref]?button('Delete note','note-delete',`data-ref="${ref}"`):'')+button('Close','arc:close'));}
  P.actions['note-new']=()=>noteDialog(selectedRef());
  P.actions['note-open']=ctx=>noteDialog(ctx.data.ref);
  P.actions['note-save']=ctx=>{s().notes=s().notes||{};if(ctx.form.note)s().notes[ctx.data.ref]=ctx.form.note;else delete s().notes[ctx.data.ref];done();};
  P.actions['note-delete']=ctx=>{delete s().notes[ctx.data.ref];done();};

  function cellsInSelection(){const sel=H.normSel(s().selection),refs=[];for(let r=sel.r0;r<=sel.r1;r++)for(let c=sel.c0;c<=sel.c1;c++)refs.push(H.refOf(r,c));return refs;}
  function apply(updates){const copy=clone(s()),err=H.applyCells(copy,updates);if(err){A.notify(String(err));return false;}H.commitSheet(w(),s(),copy);A.closeDialog();A.render();return true;}
  P.actions['trim-space']=()=>apply(cellsInSelection().map(ref=>({ref,text:String(s().cells[ref]??'')})).filter(x=>!x.text.startsWith('=')).map(x=>({...x,text:x.text.replace(/^ +| +$/g,'').replace(/ +/g,' ')})));
  P.actions['split-dialog']=()=>dialog('Split text to columns',form('split-save',select('Separator','separator',['Comma','Semicolon','Space'],'Comma'),'Split'));
  P.actions['split-save']=ctx=>{const sel=H.normSel(s().selection);if(sel.c0!==sel.c1){A.notify('Select one column');return;}const delimiter={Comma:',',Semicolon:';',Space:' '}[ctx.form.separator];const updates=[];for(let r=sel.r0;r<=sel.r1;r++){String(s().cells[H.refOf(r,sel.c0)]??'').split(delimiter).forEach((text,index)=>updates.push({ref:H.refOf(r,sel.c0+index),text}));}apply(updates);};
  P.actions['duplicates-dialog']=()=>dialog('Remove duplicates',form('duplicates-save',check('Data has header row','header'),'Remove duplicates'));
  P.actions['duplicates-save']=ctx=>{
    const sel=H.normSel(s().selection),start=sel.r0+(ctx.form.header?1:0),seen=new Set(),rows=[];let removed=0;
    for(let r=start;r<=sel.r1;r++){const row=[];for(let c=sel.c0;c<=sel.c1;c++)row.push(String(s().cells[H.refOf(r,c)]??''));const key=JSON.stringify(row);if(seen.has(key))removed++;else{seen.add(key);rows.push(row);}}
    const updates=[];for(let r=start;r<=sel.r1;r++)for(let c=sel.c0;c<=sel.c1;c++)updates.push({ref:H.refOf(r,c),text:rows[r-start]?.[c-sel.c0]??''});
    if(apply(updates))A.notify(`${removed} ${removed===1?'duplicate removed':'duplicates removed'}`);
  };
  P.actions['workbook-copy']=()=>dialog('Copy workbook',form('workbook-copy-save',input('Workbook name','name','Copy of '+w().name),'Create copy'));
  P.actions['workbook-copy-save']=ctx=>{
    const name=ctx.form.name.trim();if(!name||H.workbooks().some(w=>w.name===name)){A.notify('Enter a unique workbook name');return;}
    const copy=clone(w()),ids=new Map();copy.id=A.uid('wb');copy.name=name;
    for(const sh of copy.sheets){const next=A.uid('sheet');ids.set(sh.id,next);sh.id=next;sh.validations=(sh.validations||[]).map(v=>({...v,id:A.uid('rule')}));}
    copy.activeSheetId=ids.get(copy.activeSheetId);
    for(const sh of copy.sheets)if(sh.pivot)sh.pivot.sourceId=ids.get(sh.pivot.sourceId)||sh.pivot.sourceId;
    copy.namedRanges=(copy.namedRanges||[]).map(n=>({...n,id:A.uid('range'),sheetId:ids.get(n.sheetId)}));
    H.touch(copy);H.workbooks().push(copy);A.save();A.closeDialog();A.navigate('#/sheet/'+copy.id);
  };
})();
