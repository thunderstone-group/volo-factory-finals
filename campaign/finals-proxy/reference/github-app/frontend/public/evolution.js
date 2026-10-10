'use strict';
// Ordinary repository, issue and review features layered over the selected base.
// All behavior is data-driven. Scenario names are confined to seed.js.
(function () {
  const A = window.ARC, P = window.APP, H = P.helpers;
  const { repoByPath, repoById, repoHref, repoRole, repoHead, issuesOf, labelsOf,
    milestonesOf, prsOf, fileAt, statusLabel } = H;
  const esc = A.esc, state = () => A.state, view = () => state().ui || (state().ui = {});
  const user = () => A.currentUser();
  const repo = () => { const p = A.route().params; return repoByPath(p[0], p[1]); };
  const issue = (id) => (state().issues || []).find(x => x.id === id);
  const pull = (id) => (state().prs || []).find(x => x.id === id);
  const write = (r) => !!(user() && !r.archived && ['write','maintain','admin'].includes(repoRole(r,user())));
  const admin = (r) => !!(user() && repoRole(r,user()) === 'admin');
  const manage = (r) => !!(user() && !r.archived && ['triage','maintain','admin'].includes(repoRole(r,user())));
  const finish = () => { A.save(); A.closeDialog(); A.render(); };
  const button = (label,action,extra='') => `<button type="button" data-action="${action}" ${extra}>${esc(label)}</button>`;
  const region = (name,html) => `<section role="region" aria-label="${esc(name)}">${html}</section>`;
  const status = (text) => `<p role="status" aria-label="${esc(text)}">${esc(text)}</p>`;
  const input = (label,name,value='',multiline=false) => `<label>${esc(label)}${multiline ? `<textarea name="${name}" aria-label="${esc(label)}">${esc(value)}</textarea>` : `<input name="${name}" aria-label="${esc(label)}" value="${esc(value)}">`}</label>`;
  const select = (label,name,options,value,change) => A.combobox({label,name,options,value,change});
  const form = (action,html,submit,extra='') => `<form data-action="${action}" ${extra}>${html}<button type="submit">${esc(submit)}</button></form>`;
  const dialog = (title,html) => A.openDialog(html,{title});
  const tree = (html) => {const t=document.createElement('template');t.innerHTML=html;return t;};
  const original = {...P.screens}, actions = {...P.actions};
  function md(text) {
    return String(text||'').split(/\n\n/).map(block => {
      let s=esc(block).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code>$1</code>');
      const m=/^(#{1,6}) (.*)$/.exec(s);
      return m ? `<h${m[1].length}>${m[2]}</h${m[1].length}>` : `<p>${s.replace(/\n/g,'<br>')}</p>`;
    }).join('');
  }
  function queryMatches(record,q,kind) {
    const tokens=(q||'').match(/(?:[^\s"]+|"[^"]*")+/g)||[];
    return tokens.every(token => {
      const match=/^(is|label|author):(.+)$/i.exec(token);
      if (!match) return record.title.toLowerCase().includes(token.replace(/^"|"$/g,'').toLowerCase());
      const [,key,value]=match;
      if(key.toLowerCase()==='is')return record.status===value.toLowerCase();
      if(key.toLowerCase()==='author')return record.author.toLowerCase()===value.toLowerCase();
      return kind==='issue' && (record.labels||[]).some(x=>x.toLowerCase()===value.toLowerCase());
    });
  }
  function listState(r,kind) {const key=kind+'List';const map=view()[key]||(view()[key]={});return map[r.id]||(map[r.id]={query:'',sort:'Newest'});}
  function issueRows(r,statusFilter) {
    const v=listState(r,'issue');const override=/\bis:(?:open|closed)\b/i.test(v.query);
    const list=issuesOf(r.id).filter(i=>(override||statusFilter==='all'||i.status===statusFilter)&&queryMatches(i,v.query,'issue'));
    list.sort((a,b)=>((a.createdAt||a.number)>(b.createdAt||b.number)?1:-1)*(v.sort==='Oldest'?1:-1));
    return `<ul aria-label="Issue titles">${list.map(i=>`<li class="issue-row" data-issue-row data-title="${esc(i.title.toLowerCase())}"><a href="${repoHref(r)}/issues/${i.number}">${esc(i.title)}</a></li>`).join('')}</ul>`;
  }
  P.screens.repoIssues=function(r,role,rest) {
    if(rest[0]==='labels')return labelsPage(r);
    if(rest[0]==='milestones')return milestonesPage(r);
    if(rest[0]&&!['open','closed'].includes(rest[0]))return original.repoIssues.call(this,r,r.archived?'read':role,rest);
    const v=listState(r,'issue'),filter=rest[0]||'all';
    const pinned=issuesOf(r.id).filter(i=>i.pinned).sort((a,b)=>(a.pinnedAt||0)-(b.pinnedAt||0));
    return repoHead(r)+region('Pinned issues',`<ul aria-label="Pinned issue titles">${pinned.map(i=>`<li>${esc(i.title)}</li>`).join('')}</ul>`)+
      region('Issues',`<h2>Issues</h2><nav><a href="${repoHref(r)}/issues/open">Open</a> <a href="${repoHref(r)}/issues/closed">Closed</a> <a href="${repoHref(r)}/issues/labels">Labels</a> <a href="${repoHref(r)}/issues/milestones">Milestones</a></nav>`+
      `<label>Search issues<input type="search" aria-label="Search issues" value="${esc(v.query)}" data-change="filter-issues"></label>`+
      select('Issue sort','issueSort',['Newest','Oldest'],v.sort,'issue-sort')+
      (write(r)?`<p><a href="${repoHref(r)}/issues/new">New issue</a></p>`:'')+`<div id="issue-results">${issueRows(r,filter)}</div>`);
  };
  P.actions['filter-issues']=function(ctx){const r=repo();listState(r,'issue').query=ctx.el.value;A.save();document.getElementById('issue-results').innerHTML=issueRows(r,A.route().params[3]||'all');};
  P.actions['issue-sort']=function(ctx){listState(repo(),'issue').sort=ctx.value;A.save();A.render();};

  P.screens.repoPulls=function(r,role,rest) {
    if(rest[0]&&!['open','closed'].includes(rest[0]))return original.repoPulls.call(this,r,r.archived?'read':role,rest);
    const v=listState(r,'pr'),filter=rest[0]||'open';
    return repoHead(r)+region('Pull requests',`<h2>Pull requests</h2><nav><a href="${repoHref(r)}/pulls/open">Open</a> <a href="${repoHref(r)}/pulls/closed">Closed</a></nav>`+
      `<label>Search pull requests<input type="search" aria-label="Search pull requests" value="${esc(v.query)}" data-change="filter-prs"></label>`+
      (write(r)?`<p><a href="${repoHref(r)}/pulls/new">New pull request</a></p>`:'')+`<div id="pr-results">${prRows(r,filter)}</div>`);
  };
  function prRows(r,filter) {
    const q=listState(r,'pr').query,override=/\bis:/i.test(q);
    const list=prsOf(r.id).filter(p=>(override||(filter==='closed'?['closed','merged']:['open','draft']).includes(p.status))&&queryMatches(p,q,'pr'));
    return `<ul aria-label="Pull request titles">${list.map(p=>`<li><a href="${repoHref(r)}/pulls/${p.number}">${esc(p.title)}</a></li>`).join('')}</ul>`;
  }
  P.actions['filter-prs']=ctx=>{const r=repo();listState(r,'pr').query=ctx.el.value;A.save();document.getElementById('pr-results').innerHTML=prRows(r,A.route().params[3]||'open');};

  P.screens.issueDetail=function(r,role,i) {
    const t=tree(original.issueDetail.call(this,r,r.archived?'read':role,i)),root=t.content;
    const ex=`data-issue="${esc(i.id)}"`;
    const close=root.querySelector('[data-action="issue-close"]');
    if(close&&manage(r))close.insertAdjacentHTML('beforebegin',select('Close reason','closeReason',['Completed','Not planned'],'Completed'));
    if(!manage(r))root.querySelectorAll('[data-action="issue-close"],[data-action="issue-reopen"]').forEach(el=>el.remove());
    if(i.status==='closed'&&i.closeReason)root.querySelector('.state').insertAdjacentHTML('afterend',status('Closed as '+i.closeReason.toLowerCase()));
    const description=root.querySelector('.description');
    const tasks=String(i.description||'').split('\n').filter(line=>/^- \[[ xX]\] /.test(line));
    if(tasks.length) {
      let n=0;
      const replacement=document.createElement('div');
      replacement.innerHTML=String(i.description).split('\n').map(line=>{
        const m=/^- \[([ xX])\] (.*)$/.exec(line);if(!m)return `<p>${esc(line)}</p>`;
        return `<label><input type="checkbox" data-action="issue-task" ${ex} data-task="${n++}"${m[1]!==' '?' checked':''}${!write(r)?' disabled':''}>${esc(m[2])}</label>`;
      }).join('')+status(`${tasks.filter(x=>/^- \[[xX]\]/.test(x)).length} of ${tasks.length} tasks complete`);
      description.replaceWith(replacement);
    }
    const comments=root.querySelectorAll('article.comment');
    const discussion=document.createElement('section');discussion.setAttribute('role','region');discussion.setAttribute('aria-label','Discussion');
    if(comments.length)comments[0].before(discussion);
    else root.append(discussion);
    const records=H.commentsOf(i.id);
    comments.forEach((el,index)=>{
      const c=records[index];
      if(c){
        el.setAttribute('aria-label','Comment by '+c.author);
        const p=el.querySelector('p');p.outerHTML=md(c.body);
        if(c.edited)el.insertAdjacentHTML('beforeend','<span>Edited</span>');
        if(user()&&user().name===c.author&&!r.archived)el.insertAdjacentHTML('beforeend',button('Edit comment','comment-edit',`data-id="${esc(c.id)}"`)+button('Delete comment','comment-delete',`data-id="${esc(c.id)}"`));
      }
      discussion.append(el);
    });
    const editor=root.querySelector('form[data-action="issue-comment"]');
    if(editor){
      if(i.locked&&!admin(r))editor.remove();
      else {
        const draft=(view().commentDrafts||{})[i.id]||'';editor.querySelector('textarea').textContent=draft;
        editor.insertAdjacentHTML('afterbegin',button('Preview','comment-preview',ex)+button('Write','comment-write',ex)+button('Insert saved reply','reply-insert',ex));
        if(view().commentPreview===i.id){editor.querySelector('textarea').hidden=true;editor.insertAdjacentHTML('beforeend',region('Comment preview',md(draft)));}
      }
    }
    let extra='';
    if(i.locked)extra+=status('Locked: '+i.lockReason);
    if(admin(r)&&!r.archived){
      extra+=button(i.locked?'Unlock conversation':'Lock conversation',i.locked?'issue-unlock':'issue-lock',ex);
      extra+=button(i.pinned?'Unpin issue':'Pin issue','issue-pin',ex);
    }
    const reactions=i.reactions||[];
    if(user())extra+=`<button type="button" data-action="issue-react" ${ex} aria-pressed="${reactions.includes(user().name)}">Thumbs up</button>`;
    extra+=region('Reaction count',`<span>${reactions.length} ${reactions.length===1?'reaction':'reactions'}</span>`);
    return region('Issue',t.innerHTML+extra);
  };
  P.actions['issue-close']=ctx=>{const i=issue(ctx.data.issue);if(!i||!manage(repoById(i.repo)))return;i.closeReason=(document.querySelector('[name="closeReason"]')||{}).value||'Completed';actions['issue-close'](ctx);};
  P.actions['issue-reopen']=ctx=>{const i=issue(ctx.data.issue);if(!i||!manage(repoById(i.repo)))return;delete i.closeReason;actions['issue-reopen'](ctx);};
  P.actions['issue-task']=ctx=>{const i=issue(ctx.data.issue);if(!i||!write(repoById(i.repo)))return;let n=0;i.description=i.description.split('\n').map(line=>{if(!/^- \[[ xX]\]/.test(line))return line;return n++===Number(ctx.data.task)?line.replace(/\[[ xX]\]/,ctx.el.checked?'[x]':'[ ]'):line;}).join('\n');finish();};
  P.actions['comment-preview']=ctx=>{const drafts=view().commentDrafts||(view().commentDrafts={});drafts[ctx.data.issue]=document.querySelector('#ic-body').value;view().commentPreview=ctx.data.issue;A.save();A.render();};
  P.actions['comment-write']=()=>{view().commentPreview=null;A.save();A.render();};
  P.actions['issue-comment']=ctx=>{const i=issue(ctx.data.issue);if(!i||!write(repoById(i.repo))||(i.locked&&!admin(repoById(i.repo))))return;view().commentPreview=null;if(view().commentDrafts)delete view().commentDrafts[i.id];actions['issue-comment'](ctx);};
  P.actions['issue-lock']=ctx=>{const i=issue(ctx.data.issue);if(!admin(repoById(i.repo)))return;dialog('Lock conversation',form('issue-lock-save',select('Lock reason','reason',['Off-topic','Too heated','Resolved','Spam'],'Off-topic'),'Lock',`data-issue="${esc(i.id)}"`));};
  P.actions['issue-lock-save']=ctx=>{const i=issue(ctx.data.issue);if(!admin(repoById(i.repo)))return;i.locked=true;i.lockReason=ctx.form.reason;finish();};
  P.actions['issue-unlock']=ctx=>{const i=issue(ctx.data.issue);if(!admin(repoById(i.repo)))return;i.locked=false;delete i.lockReason;finish();};
  P.actions['issue-pin']=ctx=>{const i=issue(ctx.data.issue);if(!admin(repoById(i.repo)))return;i.pinned=!i.pinned;i.pinnedAt=Date.now();finish();};
  P.actions['issue-react']=ctx=>{if(!user())return;const i=issue(ctx.data.issue);i.reactions=i.reactions||[];const at=i.reactions.indexOf(user().name);if(at<0)i.reactions.push(user().name);else i.reactions.splice(at,1);finish();};
  P.actions['labels-open']=function(ctx){actions['labels-open'].call(this,ctx);A._popover.insertAdjacentHTML('afterbegin','<label>Filter labels<input aria-label="Filter labels" data-change="option-filter"></label>');};
  P.actions['comment-edit']=ctx=>{const c=state().issueComments.find(x=>x.id===ctx.id);if(!c||!user()||c.author!==user().name)return;dialog('Edit comment',form('comment-save',input('Comment body','body',c.body,true),'Save comment',`data-id="${esc(c.id)}"`));};
  P.actions['comment-save']=ctx=>{const c=state().issueComments.find(x=>x.id===ctx.id);if(!c||!user()||c.author!==user().name||!ctx.form.body.trim())return;c.body=ctx.form.body;c.edited=true;finish();};
  P.actions['comment-delete']=ctx=>{const c=state().issueComments.find(x=>x.id===ctx.id);if(!c||!user()||c.author!==user().name)return;dialog('Delete comment',`<p>Delete this comment?</p>${button('Delete','comment-delete-confirm',`data-id="${esc(c.id)}"`)}${button('Cancel','arc:close')}`);};
  P.actions['comment-delete-confirm']=ctx=>{const c=state().issueComments.find(x=>x.id===ctx.id);if(!c||!user()||c.author!==user().name)return;state().issueComments=state().issueComments.filter(x=>x.id!==c.id);finish();};

  P.screens.repoNewFile=function(r,role,branch) {
    let html=original.repoNewFile.call(this,r,r.archived?'read':role,branch);if(!write(r))return html;
    const t=tree(html),f=t.content.querySelector('form');
    const draft=(view().fileDrafts||{})[r.id];
    if(draft){f.querySelector('[name="path"]').value=draft.path;f.querySelector('[name="path"]').setAttribute('value',draft.path);f.querySelector('[name="content"]').textContent=draft.content;f.querySelector('[name="message"]').setAttribute('value',draft.message);}
    f.insertAdjacentHTML('afterbegin',button('Preview file','file-preview')+button('Edit file','file-edit'));
    if(view().filePreview===r.id)f.insertAdjacentHTML('afterend',region('File preview',md(draft?.content||'')));
    return t.innerHTML;
  };
  P.actions['file-preview']=ctx=>{const f=ctx.el.closest('form');const drafts=view().fileDrafts||(view().fileDrafts={});drafts[repo().id]=Object.fromEntries(new FormData(f));view().filePreview=repo().id;A.save();A.render();};
  P.actions['file-edit']=()=>{view().filePreview=null;A.save();A.render();};
  P.screens.repoBlob=function(r,role,branch,path){return original.repoBlob.call(this,r,role,branch,path)+`<p>${esc(path)}</p>`;};
  P.actions['file-create']=ctx=>{if(!write(repo()))return;actions['file-create'](ctx);};
  P.actions['issue-create']=ctx=>{if(!write(repoById(ctx.data.repo)))return;actions['issue-create'](ctx);};

  P.screens.prCompare=function(r,role) {
    const t=tree(original.prCompare.call(this,r,role));const f=t.content.querySelector('form[data-action="compare"]');
    if(f)f.insertAdjacentHTML('beforeend',button('Swap branches','compare-swap'));
    const v=view().compare;
    return t.innerHTML+(v?.done?region('Comparison summary',`<p>base: ${esc(v.base)}; compare: ${esc(v.compare)}</p>`):'');
  };
  P.actions['compare-swap']=ctx=>{const values=Object.fromEntries(new FormData(ctx.el.closest('form')));view().compare={base:values.compare,compare:values.base,done:false};A.save();A.render();};
  P.screens.prDetail=function(r,role,p,tab) {
    let html=original.prDetail.call(this,r,r.archived?'read':role,p,tab);
    if(tab==='files') {
      const layout=(view().diffLayouts||{})[p.id]||'Unified';
      html+=select('Diff layout','diffLayout',['Unified','Split'],layout,'diff-layout');
      const before=(p.changedFiles||[]).map(f=>f.beforeText??fileAt(r.id,p.target,f.path)?.content??'').join('\n');
      const after=(p.changedFiles||[]).map(f=>f.afterText??fileAt(r.id,p.source,f.path)?.content??'').join('\n');
      html+=layout==='Split'?`<div class="diff-split">${region('Before',`<pre>${esc(before)}</pre>`)}${region('After',`<pre>${esc(after)}</pre>`)}</div>`:region('Unified diff',before.split('\n').map(line=>`<pre>-${esc(line)}</pre>`).join('')+after.split('\n').map(line=>`<pre>+${esc(line)}</pre>`).join(''));
      html+=(p.threads||[]).map(t=>region(t.title,`<p>${esc(t.body)}</p>${t.resolved?status('Resolved'):''}`+(user()&&(user().name===t.author||user().name===p.author||admin(r))?button(t.resolved?'Unresolve conversation':'Resolve conversation','thread-toggle',`data-pr="${esc(p.id)}" data-id="${esc(t.id)}"`):''))).join('');
    }
    if(tab==='conversation'&&user()?.name===p.author&&p.status==='open'&&!r.archived)html+=button('Convert to draft','pr-convert',`data-pr="${esc(p.id)}"`);
    return region('Pull request',html);
  };
  P.actions['diff-layout']=ctx=>{const r=repo(),p=H.prByNumber(r.id,A.route().params[3]);(view().diffLayouts||(view().diffLayouts={}))[p.id]=ctx.value;A.save();A.render();};
  P.actions['pr-convert']=ctx=>{const p=pull(ctx.data.pr);if(user()?.name!==p.author||p.status!=='open')return;dialog('Convert to draft',`<p>Mark this work as a draft?</p>${button('Convert to draft','pr-convert-confirm',`data-pr="${esc(p.id)}"`)}`);};
  P.actions['pr-convert-confirm']=ctx=>{const p=pull(ctx.data.pr);if(user()?.name!==p.author||p.status!=='open')return;p.status='draft';finish();};
  P.actions['thread-toggle']=ctx=>{const p=pull(ctx.data.pr),t=p.threads.find(x=>x.id===ctx.id);if(!user()||!(user().name===t.author||user().name===p.author||admin(repoById(p.repo))))return;t.resolved=!t.resolved;finish();};

  P.screens.repoCode=function(r,role,branch,path) {
    let html=original.repoCode.call(this,r,r.archived?'read':role,branch,path);const stars=r.stars||[];
    html+=region('Repository social',(user()?button(stars.includes(user().name)?'Unstar':'Star','repo-star',`data-repo="${esc(r.id)}"`):'')+`<span>${stars.length} ${stars.length===1?'star':'stars'}</span>`);
    html+=region('About',`<ul aria-label="Topics">${(r.topics||[]).map(t=>`<li>${esc(t)}</li>`).join('')}</ul>`+(admin(r)&&!r.archived?button('Edit topics','repo-topics',`data-repo="${esc(r.id)}"`):''));
    return html;
  };
  P.screens.repo=function(route){const r=repoByPath(route.params[0],route.params[1]);const html=original.repo.call(this,route);return html+(r&&r.archived&&repoRole(r,user())?region('Repository status',status('Archived')):'');};
  P.actions['repo-star']=ctx=>{const r=repoById(ctx.data.repo);if(!user()||!repoRole(r,user()))return;r.stars=r.stars||[];const at=r.stars.indexOf(user().name);if(at<0)r.stars.push(user().name);else r.stars.splice(at,1);finish();};
  P.actions['repo-topics']=ctx=>{const r=repoById(ctx.data.repo);if(!admin(r))return;dialog('Edit topics',form('repo-topics-save',input('Topics','topics',(r.topics||[]).join(', ')),'Save',`data-repo="${esc(r.id)}"`));};
  P.actions['repo-topics-save']=ctx=>{const r=repoById(ctx.data.repo);if(!admin(r))return;const topics=[...new Set(ctx.form.topics.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean))];if(topics.some(x=>!(/^[a-z0-9-]+$/).test(x))){A.notify('Invalid topic');return;}r.topics=topics;finish();};
  P.screens.repoSettings=function(r,role,rest){return original.repoSettings.call(this,r,role,rest)+(admin(r)&&(!rest[0]||rest[0]==='general')&&!r.archived?button('Archive repository','repo-archive',`data-repo="${esc(r.id)}"`):'');};
  P.actions['repo-archive']=ctx=>{const r=repoById(ctx.data.repo);if(!admin(r))return;dialog('Archive repository',form('repo-archive-save',`<p>Enter ${esc(r.name)} to make this repository read-only.</p>`+input('Repository name','name'),'Archive',`data-repo="${esc(r.id)}"`));};
  P.actions['repo-archive-save']=ctx=>{const r=repoById(ctx.data.repo);if(!admin(r))return;if(ctx.form.name!==r.name){A.notify('Repository name does not match');return;}r.archived=true;finish();};

  function managementNav(r){return `<nav><a href="${repoHref(r)}/issues/labels">Labels</a> <a href="${repoHref(r)}/issues/milestones">Milestones</a></nav>`;}
  function labelsPage(r){return repoHead(r)+managementNav(r)+`<h2>Labels</h2>`+(admin(r)?button('New label','label-new'):'')+labelsOf(r.id).map(l=>region(l.name,`<h3>${esc(l.name)}</h3><p>${esc(l.description||'')}</p><span class="label-swatch" style="background:${/^#[0-9a-f]{6}$/i.test(l.color)?l.color:'#aaa'}"></span>`+(admin(r)?button('Edit','label-edit',`data-id="${esc(l.id)}"`):''))).join('');}
  function labelDialog(l){dialog(l?'Edit label':'New label',form('label-save',input('Label name','name',l?.name||'')+input('Description','description',l?.description||'')+input('Color','color',l?.color||'#aaaaaa'),l?'Save':'Create label',`data-id="${esc(l?.id||'')}"`));}
  P.actions['label-new']=()=>{if(admin(repo()))labelDialog(null);};
  P.actions['label-edit']=ctx=>{const l=state().labels.find(x=>x.id===ctx.id);if(admin(repoById(l.repo)))labelDialog(l);};
  P.actions['label-save']=ctx=>{const r=repo();if(!admin(r))return;const f=ctx.form,name=f.name.trim();if(!name||!/^#[0-9a-f]{6}$/i.test(f.color)||labelsOf(r.id).some(x=>x.name===name&&x.id!==ctx.id)){A.notify('Invalid or duplicate label');return;}let l=state().labels.find(x=>x.id===ctx.id);if(l){const old=l.name;issuesOf(r.id).forEach(i=>i.labels=(i.labels||[]).map(x=>x===old?name:x));}else{l={id:A.uid('label'),repo:r.id};state().labels.push(l);}Object.assign(l,{name,description:f.description,color:f.color});finish();};
  function milestonesPage(r){return repoHead(r)+managementNav(r)+`<h2>Milestones</h2>`+(admin(r)?button('New milestone','milestone-new'):'')+milestonesOf(r.id).map(m=>region(m.title,`<h3>${esc(m.title)}</h3><p>${esc(m.description||'')}</p><p>${esc(m.due||'')}</p><span>${m.closed?'Closed':'Open'}</span>`+(admin(r)?button(m.closed?'Reopen milestone':'Close milestone','milestone-cycle',`data-id="${esc(m.id)}"`):''))).join('');}
  P.actions['milestone-new']=()=>{if(!admin(repo()))return;dialog('New milestone',form('milestone-create',input('Title','title')+input('Description','description','',true)+input('Due date','due'),'Create milestone'));};
  P.actions['milestone-create']=ctx=>{if(!admin(repo()))return;const f=ctx.form;if(!f.title.trim()||milestonesOf(repo().id).some(m=>m.title===f.title)||f.due&&!/^\d{4}-\d{2}-\d{2}$/.test(f.due)){A.notify('Invalid milestone');return;}state().milestones.push({id:A.uid('milestone'),repo:repo().id,title:f.title,description:f.description,due:f.due,closed:false});finish();};
  P.actions['milestone-cycle']=ctx=>{const m=state().milestones.find(x=>x.id===ctx.id);if(!admin(repoById(m.repo)))return;m.closed=!m.closed;finish();};

  P.actions['account-menu']=function(ctx){actions['account-menu'].call(this,ctx);if(A._popover)A._popover.querySelector('[role="menu"]').insertAdjacentHTML('beforeend','<a href="#/replies">Saved replies</a>');};
  P.screens.replies=function(){if(!user())return '<h1>Sign in required</h1>';return `<h1>Saved replies</h1>${button('New saved reply','reply-new')}<ul>${(state().savedReplies||[]).filter(x=>x.author===user().name).map(x=>`<li>${esc(x.title)}</li>`).join('')}</ul>`;};
  P.actions['reply-new']=()=>{if(user())dialog('Saved reply',form('reply-save',input('Reply title','title')+input('Reply body','body','',true),'Save'));};
  P.actions['reply-save']=ctx=>{if(!user()||!ctx.form.title.trim()||!ctx.form.body.trim())return;state().savedReplies=state().savedReplies||[];if(state().savedReplies.some(x=>x.author===user().name&&x.title===ctx.form.title)){A.notify('Reply title already exists');return;}state().savedReplies.push({id:A.uid('reply'),author:user().name,...ctx.form});finish();};
  P.actions['reply-insert']=ctx=>{if(!user())return;A.openPopover(ctx.el,(state().savedReplies||[]).filter(x=>x.author===user().name).map(x=>`<div role="option" tabindex="0" data-action="reply-pick" data-id="${esc(x.id)}">${esc(x.title)}</div>`).join(''));};
  P.actions['reply-pick']=ctx=>{const r=(state().savedReplies||[]).find(x=>x.id===ctx.id&&x.author===user()?.name);if(!r)return;document.querySelector('#ic-body').value=r.body;A.closePopover();};
})();
