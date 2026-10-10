"""Report-derived v2 -> v3 changes; never reads an application implementation."""
import difflib,hashlib,json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
CHANGES=[];DIFF=[]
def write(path,text,frames,reason):
    old=path.read_text()
    if old==text:return
    name=str(path.relative_to(ROOT))
    CHANGES.append({'file':name,'frames':frames,'reason':reason,'before_sha256':hashlib.sha256(old.encode()).hexdigest(),'after_sha256':hashlib.sha256(text.encode()).hexdigest()})
    DIFF.extend(difflib.unified_diff(old.splitlines(True),text.splitlines(True),fromfile='v2/'+name,tofile='v3/'+name))
    path.write_text(text)
def spec(task,req,number):return next((ROOT/(task+'-real')/'tests').glob(f'*-{req}-scenario-{number}.spec.ts'))

def main():
    for task in ['github-real','sheet-real']:
        manifest=json.loads((ROOT/task/'FROZEN.json').read_text());assert manifest['version']==2
        for name,sha in manifest['files'].items():assert hashlib.sha256((ROOT/task/name).read_bytes()).hexdigest()==sha
    p=ROOT/'github-real/tests/evolution-navigation.ts';s=p.read_text().replace("import { type Page }", "import { expect, type Locator, type Page }")
    s+='''
// F06 exposes the poll and its strict per-candidate isVisible call. The candidate
// array itself is not visible; retain v2's link/button roles in that order.
export async function clickEvolutionTarget(page: Page, name: string) {
  const candidates = [
    page.getByRole('link', {name, exact:true}),
    page.getByRole('button', {name, exact:true}),
  ];
  let selected: Locator | null = null;
  await expect.poll(async () => {
    for (const candidate of candidates) {
      if ((await candidate.count()) > 0 && (await candidate.isVisible())) { selected = candidate; return true; }
    }
    return false;
  }).toBe(true);
  await selected!.click();
}
'''
    write(p,s,['github-v3-F06','github-v3-F12'],'Mirror the observed candidate polling body; retain the previously supported link/button candidates because the actual list is unseen.')
    for p in (ROOT/'github-real/tests').glob('*.spec.ts'):
        s=p.read_text()
        if 'await activate(page,' not in s:continue
        s=s.replace('await activate(page,','await clickEvolutionTarget(page,')
        if "import { openEvolutionRepository } from './evolution-navigation';" in s:s=s.replace('import { openEvolutionRepository }','import { openEvolutionRepository, clickEvolutionTarget }')
        else:s=s.replace("import { test, expect } from '@playwright/test';","import { test, expect } from '@playwright/test';\nimport { clickEvolutionTarget } from './evolution-navigation';")
        write(p,s,['github-v3-F06'],'Use the observed polling navigation convention for existing exact-name link/button targets.')
    for i in [1,2,3]:
        p=spec('github','REQ-2-1-2',i);s=p.read_text().replace("await clickEvolutionTarget(page, 'Your organizations');","await page.getByRole('menu').getByRole('link', {name:'Your organizations',exact:true}).click();")
        write(p,s,['github-v3-F12'],'Scope Your organizations to a link in the Account menu, as shown at line 12.')
    for i in [1,2]:
        p=spec('github','REQ-2-4',i);s=p.read_text()
        s=s.replace("await button(page, 'Account menu'); await clickEvolutionTarget(page, 'Your organizations'); await clickEvolutionTarget(page, 'evo-audit-org');", "await clickEvolutionTarget(page, 'evo-audit-org');")
        write(p,s,['github-v3-F06'],'Owner audit setup opens the named organization directly from the signed-in home, then polls Audit log. The caller sequence is inferred from the requirement; the report exposes only the polling helper and caller line.')
    p=spec('github','REQ-1-4',2);s=p.read_text().replace("await button(page, 'Revoke session');","await page.getByRole('button', {name:/revoke session/i}).first().click();")
    a=s.index('  const revokedMessage=');b=s.index('  await otherContext.close();',a)
    s=s[:a]+'''  await expect(page.getByText(/revoked|inactive/i)).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', {name:'Active sessions',exact:true})).toBeVisible();
  await expect(page.getByText(/revoked|inactive/i)).toBeVisible();
'''+s[b:]
    write(p,s,['github-v3-F05'],'Use the exact strict revoked/inactive regex before and after reload, including the observed first revoke button; do not choose between two matching markers.')
    p=spec('github','REQ-1-4',3);s=p.read_text().replace("await button(page, 'Revoke session');","await page.getByRole('button', {name:/revoke session/i}).first().click();")
    a=s.index("  await visible(field(other, 'Username or email'))");b=s.index(' await otherContext.close();',a)
    s=s[:a]+'''  await expect(other.getByRole('main').getByRole('link', {name:'Sign in',exact:true})).toBeVisible();
  await expect(page.getByText('evo-session-owner-s3', {exact:true}).first()).toBeVisible();'''+s[b:]
    write(p,s,['github-v3-F11','github-v3-F05'],'The revoked page must show the main Sign in link. Preserve the other page as shown, without an additional reload or sign-in-form requirement.')
    p=spec('github','REQ-3-5',3);s=p.read_text();needle='  await openEvolutionRepository(page, "evo-archive-repository-s3");';position=s.rindex(needle)
    s=s[:position]+"  await expect(page.getByText('Archived', {exact:true})).toHaveCount(0);\n  await expect(page.getByText(/active/i).first()).toBeVisible();\n"+s[position:]
    write(p,s,['github-v3-F07'],'Check the visible Active text immediately after restore, before reopening and reloading the repository.')
    p=spec('github','REQ-4-5',1);s=p.read_text();old="for (const value of ['evo-v0-1-s1','Evolution Preview','Evolution release description','evo-main-s1']) await text(page, value);"
    replacement="""await expect(page.getByRole('heading', {name:'evo-v0-1-s1',exact:true})).toBeVisible();
  await expect(page.getByText('Evolution Preview', {exact:true})).toBeVisible();
  await expect(page.getByText('Evolution release description', {exact:true})).toBeVisible();
  await expect(page.getByText(/target branch:\\s*evo-main-s1/i)).toBeVisible();"""
    assert s.count(old)==2;s=s.replace(old,replacement)
    write(p,s,['github-v3-F13'],'Require a tag heading and the exact target-branch regex, retaining the published title/description and persistence checks.')
    p=spec('github','REQ-4-5',2);s=p.read_text();a=s.index("  for (const value of ['evo-v0-1-s2'");b=s.index("  await unavailable",a)
    s=s[:a]+"""  await expect(page.getByRole('heading', {name:'evo-v0-1-s2',exact:true})).toBeVisible();
  await expect(page.getByText('Existing Evolution Release', {exact:true})).toBeVisible();
  await expect(page.getByText('Evolution release', {exact:true})).toBeVisible();
  await expect(page.getByText(/target branch:\\s*evo-main-s2/i)).toBeVisible();
"""+s[b:]
    write(p,s,['github-v3-F08'],'Replace the unspecified-description approximation with the now-observed Evolution release seed, tag heading and target-branch regex.')
    p=spec('github','REQ-4-5',3);s=p.read_text();needle="await text(page, 'Tag already exists');";assert needle in s
    s=s.replace(needle,needle+" await expect(page.getByText('evo-v0-1-s3', {exact:true})).toHaveCount(1);")
    write(p,s,['github-v3-F09'],'The resolved official seed RELEASE_TAG_S3 must occur as text exactly once after the duplicate error; an input value alone does not satisfy this.')
    p=spec('github','REQ-5-5',1);s=p.read_text();s=s.replace('  const before = await reactionCount(page);\n','')
    needle='  await page.reload();'
    s=s.replace(needle,"  await expect(page.getByText('1 reaction', {exact:true})).toBeVisible();\n  await expect(page.getByText('Evo reaction issue s1', {exact:true}).first()).toBeVisible();\n"+needle,1)
    s=s.replace("expect(await reactionCount(page)).toBe(before + 1);", "await expect(page.getByText('1 reaction', {exact:true})).toBeVisible();")
    write(p,s,['github-v3-F10'],'Assert the exact 1 reaction label before and after reload; remove the prior +1-count-only approximation.')
    p=ROOT/'github-real/tests/interactions.ts';s=p.read_text()
    s=s.replace("import { named, visible } from './helpers';","import { named, visible } from './helpers';\nimport { clickEvolutionTarget } from './evolution-navigation';")
    s=s.replace("const count=page.getByText(/^\\+1\\s+\\d+$/);", "const count=page.getByText(/^\\d+ reactions?$/).or(page.getByText(/^\\+1\\s+\\d+$/));")
    s=s.replace("return Number((await count.innerText()).trim().match(/(\\d+)$/)![1]);", "return Number((await count.innerText()).trim().match(/(?:^|\\s)(\\d+)(?: reactions?)?$/)![1]);")
    s=s.replace("Add reaction|Remove \\+1 reaction|\\+1\\s+\\d+", "Add reaction|Remove \\+1 reaction|\\+1\\s+\\d+|\\d+ reactions?")
    s=s.replace("await visible(issue); await issue.click();", "await clickEvolutionTarget(page,title);")
    write(p,s,['github-v3-F10','github-v3-F06'],'Recognize the observed reaction-count label in unchanged scenarios, exclude it from issue-content preservation comparison, and use the candidate poll when selecting a discovered issue.')

    menus={
      'Save filter view':'sheet-v3-F12','Data validation':'sheet-v3-F13',
      'Find and replace':'sheet-v3-F15','Named ranges':'sheet-v3-F16',
      'Conditional formatting':'sheet-v3-F17','Add note':'sheet-v3-F18',
      'Freeze rows through 1':'sheet-v3-F14','Freeze columns through A':'sheet-v3-F14','Freeze panes at C4':'sheet-v3-F14'}
    for p in (ROOT/'sheet-real/tests').glob('*.spec.ts'):
        s=p.read_text();sources=set()
        for name,frame in menus.items():
            pattern=r'await command\(page,\s*([\'\"])'+re.escape(name)+r'\1\);'
            s,n=re.subn(pattern,"await page.getByRole('menuitem', {name:"+json.dumps(name)+",exact:true}).click();",s)
            if n:sources.add(frame)
        for name,frame in [('View','sheet-v3-F14'),('Edit','sheet-v3-F15'),('Format','sheet-v3-F17'),('Insert','sheet-v3-F18')]:
            pattern=r'await command\(page,\s*([\'\"])'+name+r'\1\);'
            s,n=re.subn(pattern,"await button(page, '"+name+"');",s)
            if n:sources.add(frame)
        if 'REQ-5-1-2' in p.name:
            s=s.replace("await savedView(page, 'Queued lanes');", "await page.getByRole('dialog', {name:'Filter views',exact:true}).getByRole('button', {name:'Queued lanes',exact:true}).click();")
            if 'scenario-2' in p.name or 'scenario-3' in p.name:sources.add('sheet-v3-F11')
        if 'REQ-7-1-1-scenario-3' in p.name:
            s=s.replace("await fill(page,'Range','ForecastModel!K2:K4'); await button(page,'Save');", "await dialog.getByLabel('Range', {exact:true}).fill('ForecastModel!K2:K4'); await dialog.getByRole('button', {name:'Save',exact:true}).click();")
            sources.add('sheet-v3-F10')
        write(p,s,sorted(sources),'Mirror the newly observed exact menuitem/button/dialog scopes; retain unobserved gestures and assertions.')

    (ROOT/'results/calibration-v3-test-changes.json').write_text(json.dumps(CHANGES,indent=2)+'\n')
    (ROOT/'results/calibration-v3-test-changes.diff').write_text(''.join(DIFF))
    print(len(CHANGES),'recorded edits in',len({change['file'] for change in CHANGES}),'files')

if __name__=='__main__':main()
