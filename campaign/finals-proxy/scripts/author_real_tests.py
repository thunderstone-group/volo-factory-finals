"""Explicit, hand-authored scenario translations. Never reads application source."""
import json, shutil
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OFFICIAL=ROOT.parent/'evidence/2026-10-06-finals/packs/arc-bench-evolution--keep/helpers.ts'
requirements={t:json.loads((ROOT/'scripts'/f'{t}_real_requirements.json').read_text()) for t in ['github','sheet']}
bodies={'github':{},'sheet':{}}
def add(task,req,scenario,*steps): bodies[task][req,scenario]=steps
def q(s): return json.dumps(s,ensure_ascii=False)
def click(role,name,scope='page'):
    return f'await visible(named({scope}, {q(role)}, {q(name)})); await named({scope}, {q(role)}, {q(name)}).click();'
def signin(user,page='page',password='Evo-Password-987!'):
    return f'''await {page}.goto('/');
await visible(named({page}, 'link', 'Sign in')); await named({page}, 'link', 'Sign in').click();
await fill({page}, 'Username or email', {q(user)}); await fill({page}, 'Password', {q(password)});
await button({page}, 'Sign in');'''
def repo(name):
    return f'''await visible(named(page, 'searchbox', 'Search'));
await named(page, 'searchbox', 'Search').fill({q(name)}); await named(page, 'searchbox', 'Search').press('Enter');
{click('link',name)}'''
def menu(name,item): return f'await command(page, {q(name)}); await command(page, {q(item)});'
def sheetopen(name): return f"await page.goto('/'); await activate(page, {q(name)});"
def cell(name,value): return f"await visible(named(page, 'gridcell', {q(name)})); await expect(named(page, 'gridcell', {q(name)})).toHaveText({q(value)});"
def select(name): return click('gridcell',name)
def formula(value): return f"await fill(page, 'Formula bar', {q(value)}); await field(page, 'Formula bar').press('Enter');"
def reload(): return "await page.reload();"

# GitHub: registration. Original error/credential controls are retained.
registration="""await page.goto('/');
await visible(named(page, 'link', 'Sign in')); await named(page, 'link', 'Sign in').click();
await visible(named(page, 'link', 'Create an account')); await named(page, 'link', 'Create an account').click();
for (const name of ['Username', 'Email', 'Password', 'Confirm password']) await visible(field(page, name));
await visible(named(page, 'checkbox', 'Agree to the terms'));
await expect(named(page, 'checkbox', 'Agree to the terms')).not.toBeChecked();
await visible(named(page, 'button', 'Create account'));"""
for i,user,email in [(1,'evo_user_01','evo.register.s1@evolution.test'),(2,'EvoUpper01','evo.register.s2@evolution.test'),(3,'evo-register-existing','evo.register.s3@evolution.test')]:
    entry=f"""await fill(page, 'Username', {q(user)}); await fill(page, 'Email', {q(email)});
await fill(page, 'Password', 'Evo-Password-987!'); await fill(page, 'Confirm password', 'Evo-Password-987!');
await expect(field(page, 'Password')).toHaveAttribute('type', 'password');
await expect(field(page, 'Confirm password')).toHaveAttribute('type', 'password');
await checked(page, 'Agree to the terms', true); await button(page, 'Create account');"""
    if i==1:
        then="""await visible(field(page, 'Username or email')); await visible(field(page, 'Password'));
await fill(page, 'Username or email', 'evo.register.s1@evolution.test'); await fill(page, 'Password', 'Evo-Password-987!');
await button(page, 'Sign in'); await text(page, 'evo_user_01');"""
        last="await page.reload(); await text(page, 'evo_user_01');"
    else:
        then=f"await text(page, {q('Username format is invalid' if i==2 else 'Username already exists')}); await expect(field(page, 'Username')).toHaveValue({q(user)});"
        if i==3: then+=f" await expect(field(page, 'Email')).toHaveValue({q(email)});"
        last="""for (const name of ['Username','Email','Password','Confirm password']) await visible(field(page, name));
await expect(field(page, 'Password')).toHaveValue(''); await expect(field(page, 'Confirm password')).toHaveValue('');
await visible(named(page, 'checkbox', 'Agree to the terms')); await visible(named(page, 'button', 'Create account'));
await expect(named(page, 'button', 'Sign in')).toHaveCount(0);"""
    add('github','REQ-1-1-1',i,registration,entry,then,last)
for i,user,pw in [(1,'evo-login-case','Evo-Password-987!'),(2,'EVO.LOGIN.CASE@EVOLUTION.TEST','Evo-Password-987!'),(3,'evo.login.case@evolution.test','Evo-Password-987!-incorrect')]:
    steps=['',signin(user,password=pw),"await text(page, 'Invalid credentials'); await visible(named(page, 'button', 'Sign in')); await expect(named(page, 'button', 'Account menu')).toHaveCount(0);" if i==3 else "await text(page, 'evo-login-case');"]
    if i==1: steps.append("await page.reload(); await text(page, 'evo-login-case');")
    add('github','REQ-1-1-2',i,*steps)

# Sessions: two actual independent browser contexts, both authenticated through UI.
settings="await button(page, 'Account menu'); await activate(page, 'Settings'); await activate(page, 'Active sessions');"
current="""await visible(named(page, 'heading', 'Active sessions'));
const current = page.getByRole('row').or(page.getByRole('listitem')).filter({hasText: /current (?:browser )?session/i});
await visible(current); await expect(current).toContainText('Last active');
const currentText = await current.innerText();
expect(currentText.replace(/current (?:browser )?session|last active|[\d\s:./-]/gi, '').trim().length).toBeGreaterThan(0);
await expect(current.getByRole('button', {name:'Revoke session', exact:true})).toHaveCount(0);
await expect(page.getByText(/(?:session[_ -]?(?:secret|token)|token)\s*[:=]\s*\S+/i)).toHaveCount(0);"""
add('github','REQ-1-4',1,'',signin('evo-session-owner')+'\n'+settings,current)
for i in [2,3]:
    setup=f"""const otherContext = await browser.newContext({{baseURL, storageState: {{cookies:[], origins:[]}}}});
const other = await otherContext.newPage();
{signin(f'evo-session-owner-s{i}')}
{signin(f'evo-session-owner-s{i}',page='other')}
await text(other, 'evo-session-owner-s{i}');"""
    action=settings+"\nawait button(page, 'Revoke session');"
    if i==2:
        then="""const revokedMessage=page.getByText('Session revoked',{exact:true});
if(await revokedMessage.count()) await visible(revokedMessage); else await visible(page.getByText(/^inactive$/i));
await text(page, 'evo-session-owner-s2'); await page.reload();
await visible(named(page, 'heading', 'Active sessions')); await text(page, 'evo-session-owner-s2');
await expect(named(page, 'button', 'Revoke session')).toHaveCount(0);
await otherContext.close();"""
    else:
        action+="\nawait other.reload();"
        then="""await visible(field(other, 'Username or email')); await visible(field(other, 'Password'));
await visible(named(other, 'button', 'Sign in')); await expect(named(other, 'button', 'Account menu')).toHaveCount(0);
await page.reload(); await text(page, 'evo-session-owner-s3'); await otherContext.close();"""
    add('github','REQ-1-4',i,setup,action,then)

# Organizations and owner-only audit table.
for i,ident,display in [(1,'Evo-Lab-01','Evo Lab One'),(2,'EVO-LAB-02','Evo Lab Duplicate'),(3,'-invalid-organization','   ')]:
    action=signin('evo-org-owner')+f"""
await button(page, 'Account menu'); await activate(page, 'Your organizations'); await activate(page, 'New organization');
await fill(page, 'Organization name', {q(ident)}); await fill(page, 'Display name', {q(display)}); await button(page, 'Create organization');"""
    outcome=["await visible(page.getByRole('heading').filter({hasText:'evo-lab-01'}));","await text(page, 'Organization name already exists'); await expect(page.getByRole('heading').filter({hasText:/evo-lab-02/i})).toHaveCount(0); await visible(field(page, 'Organization name'));","await text(page, 'Organization name format is invalid'); await text(page, 'Display name is required'); await visible(field(page, 'Organization name'));"][i-1]
    steps=['',action,outcome]
    if i==1: steps.append("await page.reload(); await visible(page.getByRole('heading').filter({hasText:'evo-lab-01'}));")
    add('github','REQ-2-1-2',i,*steps)
auditnav="await button(page, 'Account menu'); await activate(page, 'Your organizations'); await activate(page, 'evo-audit-org');"
auditrows="""const table = page.getByRole('table'); await visible(table);
for (const header of ['Actor','Action','Target','Timestamp']) await visible(named(table, 'columnheader', header));
const rows = table.getByRole('row').filter({has:page.getByRole('cell')}); await expect(rows).not.toHaveCount(0);
for (const row of await rows.all()) { const cells = row.getByRole('cell'); await expect(cells).toHaveCount(4); for (const c of await cells.all()) await expect(c).not.toHaveText(''); }"""
add('github','REQ-2-4',1,'',signin('evo-audit-owner')+'\n'+auditnav+" await activate(page, 'Audit log');","await visible(named(page, 'heading', 'Audit log'));\n"+auditrows)
add('github','REQ-2-4',2,'',signin('evo-audit-owner')+'\n'+auditnav+" await activate(page, 'Audit log'); await choose(page, 'Filter action', 'Member added'); await page.reload();",auditrows+"""
await selected(page, 'Filter action', 'Member added');
for (const row of await rows.all()) await expect(row.getByRole('cell').nth(1)).toHaveText('Member added');
await choose(page, 'Filter action', 'All actions');
await visible(named(table, 'cell', 'Repository created'));""")
add('github','REQ-2-4',3,'',signin('evo-audit-viewer')+'\n'+auditnav,"await unavailable(named(page, 'link', 'Audit log').or(named(page, 'button', 'Audit log')));")

# Repository search and lifecycle.
for i,query in [(1,'EVO-SEARCH-CATALOG-S1'),(2,'evolution-notebook'),(3,'evo-search-empty-s3')]:
    action=f"await visible(named(page, 'searchbox', 'Search')); await named(page, 'searchbox', 'Search').fill({q(query)}); await named(page, 'searchbox', 'Search').press('Enter');"
    if i==1: action+='\n'+click('link','evo-search-catalog-s1')
    then=["await visible(page.getByRole('heading').filter({hasText:'evo-search-catalog-s1'}));","await visible(named(page, 'link', 'evo-search-notebook-s2'));","await visible(page.getByText('No results', {exact:true}).or(page.getByText('No repositories', {exact:true})));"][i-1]
    add('github','REQ-3-1',i,"await page.goto('/');",action,then)
for i in [1,3]:
    name=f'evo-archive-repository-s{i}'; verb='Archive' if i==1 else 'Restore'
    action=signin('evo-archive-admin')+'\n'+repo(name)+f"""
await activate(page, 'Settings'); await button(page, '{verb} repository');
const dialog = named(page, 'dialog', '{verb} repository'); await visible(dialog); await button(dialog, 'Confirm {verb.lower()}');
"""+repo(name)
    then="await text(page, 'Archived'); await page.reload(); await text(page, 'Archived');" if i==1 else "await expect(page.getByText('Archived', {exact:true})).toHaveCount(0); await visible(named(page, 'link', 'README.md')); await visible(page.getByRole('heading').filter({hasText:'evo-archive-repository-s3'}));"
    if i==3: action+='\nawait page.reload();'
    add('github','REQ-3-5',i,'',action,then)
add('github','REQ-3-5',2,'',signin('evo-archive-viewer')+'\n'+repo('evo-archive-repository-s2'),"""await text(page, 'Archived'); await visible(named(page, 'link', 'README.md'));
await unavailable(named(page, 'button', 'Add file'));
await activate(page, 'README.md'); await unavailable(named(page, 'button', 'Edit file').or(named(page, 'link', 'Edit file')));
await activate(page, 'Issues'); await unavailable(named(page, 'link', 'New issue').or(named(page, 'button', 'New issue')));
await activate(page, 'Pull requests'); await unavailable(named(page, 'link', 'New pull request').or(named(page, 'button', 'New pull request')));""")
for i in [1,2,3]:
    initial=f'evo-main-s{i}';target=f'evo-feature-s{i}'
    action=repo(f'evo-branch-switch-s{i}')+f"\nconst initialAddress = page.url(); await button(page, 'Branch {initial}'); await fill(page, 'Find branch', '{'evo-missing-s2' if i==2 else target}');"
    if i==2: action+="\nawait text(page, 'No matching branch'); await field(page, 'Find branch').press('Escape');"
    else: action+='\n'+click('option',target)
    if i==3: action+='\nawait page.reload();'
    if i==2:
        then=f"await visible(named(page, 'button', 'Branch {initial}')); expect(page.url()).toBe(initialAddress); await page.reload(); await visible(named(page, 'button', 'Branch {initial}')); expect(decodeURIComponent(page.url())).toContain('{initial}');"
    else: then=f"await visible(named(page, 'button', 'Branch {target}')); await visible(named(page, 'link', 'evo-target-s{i}.md')); expect(decodeURIComponent(page.url())).toContain('{target}');"
    add('github','REQ-4-3-1',i,"await page.goto('/');",action,then)

# Releases: free-form values in Scenario 3 are test inputs, not required seed literals.
releasefields="await fill(page, 'Tag name', 'evo-v0-1-s1'); await fill(page, 'Release title', 'Evolution Preview'); await fill(page, 'Description', 'Evolution release description'); await choose(page, 'Target branch', 'evo-main-s1'); await button(page, 'Publish release');"
releasecheck="for (const value of ['evo-v0-1-s1','Evolution Preview','Evolution release description','evo-main-s1']) await text(page, value);"
add('github','REQ-4-5',1,'',signin('evo-release-owner')+'\n'+repo('evo-release-repository-s1')+"\nawait activate(page, 'Releases'); await activate(page, 'New release');\n"+releasefields,releasecheck+'\nawait page.reload();\n'+releasecheck)
add('github','REQ-4-5',2,"await page.goto('/');",repo('evo-release-repository-s2')+"\nawait activate(page, 'Releases'); await activate(page, 'evo-v0-1-s2');","""for (const value of ['evo-v0-1-s2','Existing Evolution Release','evo-main-s2']) await text(page, value);
// No literal description was published for this seed. Check that readable prose is present.
const prose = page.getByRole('main').locator('p').filter({hasNot:page.getByRole('button')});
expect((await prose.allTextContents()).some(value => value.trim().length > 0)).toBe(true);
await unavailable(named(page, 'button', 'Publish release'));""")
add('github','REQ-4-5',3,'',signin('evo-release-owner')+'\n'+repo('evo-release-repository-s3')+"\nawait activate(page, 'Releases'); await activate(page, 'New release'); await fill(page, 'Tag name', 'evo-v0-1-s3'); await fill(page, 'Release title', 'A second release'); await fill(page, 'Description', 'This duplicate must not be published.'); await button(page, 'Publish release');","await text(page, 'Tag already exists'); await visible(field(page, 'Tag name')); await expect(field(page, 'Tag name')).toHaveValue('evo-v0-1-s3');")

# Reactions. Unnamed repositories in scenarios 2/3 are discovered from public UI links.
reaction="await button(page, 'Add reaction'); const reactionMenu = page.getByRole('menu'); await visible(reactionMenu); await visible(named(reactionMenu, 'menuitem', '+1')); await named(reactionMenu, 'menuitem', '+1').click(); await visible(named(page, 'button', 'Remove +1 reaction'));"
add('github','REQ-5-5',1,'',signin('evo-reaction-author')+'\n'+repo('evo-reaction-repository-s1')+"\nawait activate(page, 'Issues'); await activate(page, 'Evo reaction issue s1');\nconst before = await reactionCount(page);\n"+reaction+"\nawait page.reload();","await visible(named(page, 'button', 'Remove +1 reaction')); expect(await reactionCount(page)).toBe(before + 1); await visible(page.getByRole('heading').filter({hasText:'Evo reaction issue s1'}));")
add('github','REQ-5-5',2,'',signin('evo-reaction-user')+"\nawait openPublicIssue(page, 'Evo reaction issue s2'); const before = await issueContent(page); expect(await reactionCount(page)).toBe(0);\n"+reaction+"\nawait button(page, 'Remove +1 reaction');","await expect(named(page, 'button', 'Remove +1 reaction')).toHaveCount(0); expect(await reactionCount(page)).toBe(0); expect(await issueContent(page)).toBe(before);")
add('github','REQ-5-5',3,"await page.goto('/');","await openPublicIssue(page, 'Evo reaction issue s3');","expect(await reactionCount(page)).toBeGreaterThan(0); await unavailable(named(page, 'button', 'Add reaction')); await unavailable(named(page, 'button', 'Remove +1 reaction'));")

# Sheet: naming limits and rejected-value retention.
for i,name,value in [(1,'EVO-M01-RENAME-OK','  FY26 Procurement Ledger  '),(2,'EVO-M01-RENAME-DUP','evo-m01-archive-reserved'),(3,'EVO-M01-RENAME-LIMIT','EVO-'+'A'*77)]:
    action=sheetopen(name)+f"\nawait button(page, 'Rename workbook'); await fill(page, 'Workbook name', {q(value)}); await button(page, 'Save');"
    if i==1: then="await visible(named(page, 'heading', 'FY26 Procurement Ledger')); await page.reload(); await button(page, 'Rename workbook'); await expect(field(page, 'Workbook name')).toHaveValue('FY26 Procurement Ledger');\n"+cell('F3','unreviewed')
    elif i==2: then=f"await text(page, 'Workbook name already exists'); await visible(named(page, 'heading', '{name}')); await expect(field(page, 'Workbook name')).toHaveValue('{name}'); await page.reload(); await visible(named(page, 'heading', '{name}')); await button(page, 'Rename workbook'); await expect(field(page, 'Workbook name')).toHaveValue('{name}');"
    else: then=f"await text(page, 'Workbook name must be 80 characters or fewer'); await page.reload(); await visible(named(page, 'heading', '{name}'));\n"+cell('C2','limit sentinel')
    add('sheet','REQ-1-2-2',i,'',action,then)
for i,name,old,new in [(1,'EVO-M02-SHEET-OK','HarborDraft','  Dispatch Register  '),(2,'EVO-M02-SHEET-DUP','ArchiveBay','meridian'),(3,'EVO-M02-SHEET-LIMIT','LengthGauge','B'*51)]:
    action=sheetopen(name)+f"\nawait button(page, 'Worksheet options for {old}'); await command(page, 'Rename'); const dialog = named(page, 'dialog', 'Rename worksheet'); await visible(dialog); await fill(dialog, 'Worksheet name', {q(new)}); await button(dialog, 'Save');"
    active=new.strip() if i==1 else old
    then=''
    if i>1: then+=f"await text(page, {q('Worksheet name already exists' if i==2 else 'Worksheet name must be 50 characters or fewer')}); "
    then+=f"await visible(named(page, 'tab', '{active}')); await expect(named(page, 'tab', '{active}')).toHaveAttribute('aria-selected', 'true'); await page.reload(); await expect(named(page, 'tab', '{active}')).toHaveAttribute('aria-selected', 'true');\n"
    if i in [1,3]: then+=cell('D5' if i==1 else 'G4','dock marker' if i==1 else 'sheet sentinel')+'\n'
    if i!=3: then+=f"await button(page, 'Worksheet options for {active}'); await command(page, 'Rename'); await visible(dialog); await expect(field(dialog, 'Worksheet name')).toHaveValue('{active}');"
    add('sheet','REQ-2-1-3',i,'',action,then)
for i,name,coords in [(1,'EVO-M03-CLEAR-TEXT',['H4']),(2,'EVO-M03-CLEAR-FORMULA',['C7']),(3,'EVO-M03-CLEAR-RANGE',['H4','I4','H5','I5'])]:
    action=sheetopen(name)+'\n'+(select(coords[0]) if i!=3 else "await rectangle(page, 'H4', 'I5');")+"\nawait page.keyboard.press('Delete');"
    check='\n'.join(cell(c,'') for c in coords)
    then=check+'\n'
    if i!=2: then+='\n'.join(f"await expect(named(page, 'gridcell', '{c}')).toHaveAttribute('aria-selected','true');" for c in coords)+'\n'
    if i!=3: then+="await expect(field(page, 'Formula bar')).toHaveValue('');\n"
    if i==2: then+=cell('D7','2')+'\n'
    then+="await page.reload();\n"+check
    if i!=3: then+='\n'+select(coords[0])+"\nawait expect(field(page, 'Formula bar')).toHaveValue('');"
    if i==2: then+='\n'+cell('D7','2')
    add('sheet','REQ-3-1-1',i,'',action,then)

# Filter views. Only the source records within D3:F7 are subject to row visibility checks.
filtercreate="await rectangle(page, 'D3', 'F7');\n"+menu('Data','Create filter')
filterrows="""for (const r of [4,6,7]) await expect(named(page, 'gridcell', 'D'+r)).toBeHidden();
"""+cell('D5','Atlas')+'\n'+cell('E5','Active')+'\n'+cell('F5','31')
queued="""for (const [r,values] of [[4,['Atlas','Queued','17']],[6,['Beacon','Queued','22']],[7,['Cirrus','Queued','9']]] as const) {
  for (const [i,c] of ['D','E','F'].entries()) { await visible(named(page,'gridcell',c+r)); await expect(named(page,'gridcell',c+r)).toHaveText(values[i]); }
}
await expect(named(page,'gridcell','D5')).toBeHidden();"""
conditions="""await button(page, 'Filter Workstream'); let filter = named(page, 'dialog', 'Filter Workstream'); await visible(filter);
await choose(filter, 'Condition', 'Text contains'); await fill(filter, 'Value', 'Atlas'); await button(filter, 'Apply');
await button(page, 'Filter Load'); filter = named(page, 'dialog', 'Filter Load'); await visible(filter);
await choose(filter, 'Condition', 'Greater than'); await fill(filter, 'Value', '20'); await button(filter, 'Apply');"""
add('sheet','REQ-5-1-2',1,'',sheetopen('EVO-M04-FILTER-SAVE')+'\n'+filtercreate+'\n'+conditions+'\n'+menu('Data','Save filter view')+"\nawait fill(page, 'Filter view name', 'Atlas active load'); await button(page, 'Save view');",filterrows+"\nawait page.reload();\n"+menu('Data','Filter views')+"\nawait visible(named(page,'button','Atlas active load').or(named(page,'option','Atlas active load')));\n"+filterrows)
add('sheet','REQ-5-1-2',2,'',sheetopen('EVO-M04-FILTER-APPLY')+'\n'+menu('Data','Filter views')+"\nawait savedView(page, 'Queued lanes');",queued+"\nawait page.reload();\n"+queued)
allrows="""for (const [r,values] of [[4,['Atlas','Queued','17']],[5,['Atlas','Active','31']],[6,['Beacon','Queued','22']],[7,['Cirrus','Queued','9']]] as const) {
  for (const [i,c] of ['D','E','F'].entries()) { await visible(named(page,'gridcell',c+r)); await expect(named(page,'gridcell',c+r)).toHaveText(values[i]); }
}"""
add('sheet','REQ-5-1-2',3,'',sheetopen('EVO-M04-FILTER-DELETE')+'\n'+filtercreate+'\n'+menu('Data','Save filter view')+"\nawait fill(page, 'Filter view name', ' queued lanes '); await button(page, 'Save view');\n// The published THEN refers to this intermediate rejected save, before the deletion.\nawait text(page, 'Filter view name already exists'); await visible(field(page, 'Filter view name')); await dismissDialogs(page);\n"+menu('Data','Filter views')+"\nawait savedView(page, 'Queued lanes'); await button(page, 'Delete filter view');","await expect(named(page,'button','Queued lanes').or(named(page,'option','Queued lanes'))).toHaveCount(0);\n"+allrows+"\nawait page.reload();\n"+menu('Data','Filter views')+"\nawait expect(named(page,'button','Queued lanes').or(named(page,'option','Queued lanes'))).toHaveCount(0);\n"+allrows)

# Validation through both user entry paths and edited rule persistence.
invalidformula=select('J6')+'\n'+formula('88')
checkformula="await text(page, 'Capacity must be from 25 to 75');\n"+cell('J6','37')
add('sheet','REQ-5-2-1',1,'',sheetopen('EVO-M05-VALIDATION-FORMULA')+'\n'+invalidformula,checkformula+"\nawait page.reload();\n"+invalidformula+'\n'+checkformula)
gridentry="await visible(named(page, 'gridcell', 'K8')); await named(page, 'gridcell', 'K8').dblclick(); await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.type('Paused'); await page.keyboard.press('Enter');"
gridcheck="await text(page, 'Choose a queue state');\n"+cell('K8','Ready')
add('sheet','REQ-5-2-1',2,'',sheetopen('EVO-M05-VALIDATION-GRID')+'\n'+gridentry,gridcheck+"\nawait page.reload();\n"+gridentry+'\n'+gridcheck)
add('sheet','REQ-5-2-1',3,'',sheetopen('EVO-M05-VALIDATION-EDIT')+'\n'+select('L4')+'\n'+menu('Data','Data validation')+"\nconst dialog=named(page,'dialog','Data validation'); await visible(dialog); await fill(dialog,'Error message','Allocate between 25 and 75'); await button(dialog,'Save');\n"+select('L4')+'\n'+formula('24'),"await text(page,'Allocate between 25 and 75');\n"+cell('L4','42')+"\nawait page.reload();\n"+select('L4')+'\n'+menu('Data','Data validation')+"\nawait expect(field(dialog,'Error message')).toHaveValue('Allocate between 25 and 75');")

# Freeze panes and displayed-value find/replace.
for i,name,coord,item,state in [(1,'ROW','B1','Freeze rows through 1','1; columns: 0'),(2,'COLUMN','A8','Freeze columns through A','0; columns: 1'),(3,'BOTH','C4','Freeze panes at C4','3; columns: 2')]:
    check=f"await visible(named(page,'button','Frozen rows: {state}'));"
    add('sheet','REQ-6-1-1',i,'',sheetopen('EVO-N01-FREEZE-'+name)+'\n'+select(coord)+'\n'+menu('View',item),check+'\nawait page.reload();\n'+check)
findopen=menu('Edit','Find and replace')+"\nconst dialog=named(page,'dialog','Find and replace'); await visible(dialog); await fill(dialog,'Find','Cobalt');"
add('sheet','REQ-6-2-1',1,'',sheetopen('EVO-N02-FIND-NEXT')+'\n'+select('A1')+'\n'+findopen+"\nawait button(dialog,'Find next'); await button(dialog,'Find next');","await expect(named(page,'gridcell','E7')).toHaveAttribute('aria-selected','true'); await text(dialog,'Match 2 of 3');")
for i,name,replacement,values in [(2,'EVO-N02-REPLACE-ALL','Indigo',{'F3':'Indigo','F6':'Indigo','F9':'Indigo','F12':'Copper'}),(3,'EVO-N02-CASE-SENSITIVE','Azure',{'G3':'Azure','G4':'cobalt','G5':'Cobalt-7'})]:
    action=sheetopen(name)+'\n'+findopen+f"\nawait fill(dialog,'Replace with','{replacement}');"
    if i==3: action+=" await checked(dialog,'Match case',true);"
    action+=" await button(dialog,'Replace all');"
    cells='\n'.join(cell(k,v) for k,v in values.items())
    add('sheet','REQ-6-2-1',i,'',action,f"await text(dialog,'Replaced {3 if i==2 else 1} cells');\n"+cells+'\nawait page.reload();\n'+cells)

# Named ranges.
namedopen=menu('Data','Named ranges')+"\nconst dialog=named(page,'dialog','Named ranges'); await visible(dialog);"
add('sheet','REQ-7-1-1',1,'',sheetopen('EVO-N03-NAMED-CREATE')+'\n'+namedopen+"\nawait button(page,'Add named range'); await fill(page,'Name','CapacityPlan'); await fill(page,'Range','ForecastModel!J3:J5'); await button(page,'Save'); await dismissDialogs(page);\n"+select('L3')+'\n'+formula('=SUM(CapacityPlan)'),cell('L3','73')+'\n'+menu('Data','Named ranges')+"\nawait visible(dialog); await text(dialog,'CapacityPlan'); await page.reload();\n"+select('L3')+"\nawait expect(field(page,'Formula bar')).toHaveValue('=SUM(CapacityPlan)');")
add('sheet','REQ-7-1-1',2,'',sheetopen('EVO-N03-NAMED-INVALID')+'\n'+namedopen+"\nawait button(page,'Add named range'); await fill(page,'Name','1stBatch'); await fill(page,'Range','ForecastModel!K2:K3'); await button(page,'Save');","await text(page,'Named range must start with a letter'); await page.reload();\n"+menu('Data','Named ranges')+"\nawait visible(dialog); await expect(dialog.getByText('1stBatch',{exact:true})).toHaveCount(0); await expect(named(dialog,'button','Edit 1stBatch')).toHaveCount(0);")
add('sheet','REQ-7-1-1',3,'',sheetopen('EVO-N03-NAMED-UPDATE')+'\n'+namedopen+"\nawait button(page,'Edit MarginBase'); await fill(page,'Range','ForecastModel!K2:K4'); await button(page,'Save');",cell('M2','25')+"\nawait page.reload();\n"+menu('Data','Named ranges')+"\nawait button(page,'Edit MarginBase'); await expect(field(page,'Range')).toHaveValue('ForecastModel!K2:K4');\n"+cell('M2','25'))

# Conditional fills use the published exact CSS colors, including negative controls.
cfopen=menu('Format','Conditional formatting')+"\nconst dialog=named(page,'dialog','Conditional formatting'); await visible(dialog);"
for i,name,start,end,condition,value,style,color,positive,negative in [(1,'NUMBER','J4','J6','Greater than','25','Red fill','rgb(254, 226, 226)',['J5','J6'],['J4']),(2,'TEXT','K4','K6','Text contains','Watch','Yellow fill','rgb(254, 249, 195)',['K4'],['K5','K6'])]:
    action=sheetopen('EVO-N04-FORMAT-'+name)+f"\nawait rectangle(page,'{start}','{end}');\n"+cfopen+f"\nawait choose(dialog,'Condition','{condition}'); await fill(dialog,'Value','{value}'); await choose(dialog,'Style','{style}'); await button(dialog,'Save');"
    colors='\n'.join(f"await expect(named(page,'gridcell','{c}')).{'' if c in positive else 'not.'}toHaveCSS('background-color','{color}');" for c in positive+negative)
    then=colors+'\nawait page.reload();\n'+colors
    if i==2: then+='\n'+menu('Format','Conditional formatting')+"\nawait visible(named(page,'button','Edit rule 1'));"
    add('sheet','REQ-7-2-1',i,'',action,then)
noformat="""for (const c of ['L3','L4','L5']) for (const color of ['rgb(254, 226, 226)','rgb(254, 249, 195)','rgb(220, 252, 231)']) await expect(named(page,'gridcell',c)).not.toHaveCSS('background-color',color);"""
add('sheet','REQ-7-2-1',3,'',sheetopen('EVO-N04-FORMAT-EDIT')+'\n'+cfopen+"\nawait button(dialog,'Edit rule 1'); await choose(dialog,'Style','Green fill'); await button(dialog,'Save');\n// Observe the intermediate edited style before executing the published deletion.\nfor (const c of ['L4','L5']) await expect(named(page,'gridcell',c)).toHaveCSS('background-color','rgb(220, 252, 231)'); await dismissDialogs(page);\n"+menu('Format','Conditional formatting')+"\nawait button(page,'Delete rule 1');",noformat+'\nawait page.reload();\n'+noformat)

# Notes: exact text and cell-value preservation across reload.
for i,name,coord,value,note in [(1,'CREATE','D8','Manifest R41','Confirm the harbor reference before release'),(2,'EDIT','F6','Gate Rho','Controller signed at 14:20'),(3,'DELETE','J3','Route Zeta','')]:
    action=sheetopen('EVO-N05-NOTE-'+name)+'\n'
    if i==1: action+=select(coord)+'\n'+menu('Insert','Add note')+f"\nconst dialog=named(page,'dialog','Note for {coord}'); await visible(dialog); await fill(dialog,'Note',{q(note)}); await button(dialog,'Save note');"
    else:
        action+=f"await button(page,'Open note for {coord}'); const dialog=named(page,'dialog','Note for {coord}'); await visible(dialog); "
        if i==2: action+=f"await button(dialog,'Edit note'); await fill(dialog,'Note',{q(note)}); await button(dialog,'Save note');"
        else: action+="await button(dialog,'Delete note');"
    if i==3: check=f"await expect(named(page,'button','Open note for {coord}')).toBeHidden();\n"+cell(coord,value);then=check+'\nawait page.reload();\n'+check
    else:
        check=cell(coord,value)+f"\nawait dismissDialogs(page); await button(page,'Open note for {coord}'); await visible(dialog); await text(dialog,{q(note)});"
        then=check+'\nawait page.reload();\n'+check
    add('sheet','REQ-8-1-1',i,'',action,then)

COMMON="""import { expect, type Locator, type Page } from '@playwright/test';
import { named, visible } from './helpers';
export async function command(page: Page, name: string) {
  const control=named(page,'menuitem',name).or(named(page,'button',name)).or(named(page,'link',name));
  await visible(control); await expect(control).toBeEnabled(); await control.click();
}
export async function unavailable(control: Locator) {
  expect(await control.count()).toBeLessThanOrEqual(1);
  await expect.poll(async () => !await control.isVisible() || !await control.isEnabled()).toBe(true);
}
export async function rectangle(page: Page, first: string, last: string) {
  const a=named(page,'gridcell',first), b=named(page,'gridcell',last);
  await visible(a); await visible(b); await a.click(); await b.click({modifiers:['Shift']});
}
export async function dismissDialogs(page: Page) {
  // Native keyboard dismissal avoids prescribing an unpublished close-button label.
  for(let i=0;i<3 && await page.getByRole('dialog').count();i++) await page.keyboard.press('Escape');
}
export async function savedView(page: Page, name: string) {
  const control=named(page,'button',name).or(named(page,'option',name)); await visible(control); await control.click();
}
export async function reactionCount(page: Page) {
  const count=page.getByText(/^\\+1\\s+\\d+$/);
  expect(await count.count()).toBeLessThanOrEqual(1);
  if (!await count.count()) return 0;
  await visible(count); return Number((await count.innerText()).trim().match(/(\\d+)$/)![1]);
}
export async function issueContent(page: Page) {
  const main=page.getByRole('main'); await visible(main);
  return (await main.innerText()).replace(/Add reaction|Remove \\+1 reaction|\\+1\\s+\\d+/g,'').replace(/\\s+/g,' ').trim();
}
export async function openPublicIssue(page: Page, title: string) {
  // These two published seeds omit their repository name. Discover real links,
  // never guess a route, read storage, or send a private request.
  await page.goto('/');
  const direct=named(page,'link',title);
  if(await direct.count()) { await visible(direct); await direct.click(); await visible(page.getByRole('heading').filter({hasText:title})); return; }
  const search=named(page,'searchbox','Search'); await visible(search);
  await search.fill(''); await search.press('Enter');
  const main=page.getByRole('main'); await visible(main);
  const links=await main.getByRole('link').evaluateAll(elements => elements.map(e=>({name:(e.getAttribute('aria-label') || e.textContent || '').trim(),href:(e as HTMLAnchorElement).href})).filter(e=>e.name));
  for(const link of links) {
    await page.goto(link.href);
    const issues=named(page,'link','Issues').or(named(page,'button','Issues'));
    if(await issues.count()!==1) continue;
    await issues.click();
    const issue=named(page,'link',title);
    if(await issue.count()) { await visible(issue); await issue.click(); await visible(page.getByRole('heading').filter({hasText:title})); return; }
  }
  throw new Error('No public UI link found for the pre-provisioned issue '+title);
}
"""

def main():
    for task in ['github','sheet']:
        path=ROOT/(task+'-real')/'tests';path.mkdir(exist_ok=True)
        shutil.copyfile(OFFICIAL,path/'helpers.ts')
        (path/'interactions.ts').write_text(COMMON)
        index=0
        for req in requirements[task]:
            for i,scenario in enumerate(req['scenarios'],1):
                index+=1; steps=bodies[task][req['id'],i]
                assert len(steps)==len(scenario['steps']),(task,req['id'],i,len(steps))
                code="import { test, expect } from '@playwright/test';\nimport { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';\nimport { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';\n\ntest.use({ storageState: { cookies: [], origins: [] } });\n\n"
                code+=f"test({q(scenario['name'])}, async ({{ page, browser, baseURL }}) => {{\n"
                for step,body in zip(scenario['steps'],steps):
                    code+='  // '+step['keyword']+': '+step['content'].replace('\n',' ')+'\n'
                    code+='\n'.join('  '+line for line in body.splitlines())+'\n'
                code+='});\n'
                (path/f'{index:02d}-{req["id"]}-scenario-{i}.spec.ts').write_text(code)
        assert index==30 and len(list(path.glob('*.spec.ts')))==30
        print(task,index,'scenario tests')

if __name__=='__main__': main()
