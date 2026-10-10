"""Explicit report-frame calibration of frozen v1. Does not read application code."""
import difflib,hashlib,json,re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
changes=[];diff=[]
def write(path, text, frames):
    before=path.read_text() if path.exists() else ''
    if before==text:return
    name=str(path.relative_to(ROOT))
    changes.append({'file':name,'frames':frames,'before_sha256':hashlib.sha256(before.encode()).hexdigest() if before else None,'after_sha256':hashlib.sha256(text.encode()).hexdigest()})
    diff.extend(difflib.unified_diff(before.splitlines(True),text.splitlines(True),fromfile='v1/'+name,tofile='v2/'+name))
    path.write_text(text)

def main():
    for task in ['github-real','sheet-real']:
        manifest=json.loads((ROOT/task/'FROZEN.json').read_text());assert manifest['version']==1,'Run only once from v1'
        for name,digest in manifest['files'].items():assert hashlib.sha256((ROOT/task/name).read_bytes()).hexdigest()==digest

    navigation="""import { type Page } from '@playwright/test';
import { named, visible } from './helpers';

// Visible official support/evolution-e2e.ts:105-110 (github-real-F04).
export async function openEvolutionRepository(page: Page, name: string) {
  if (await page.getByRole('banner').count() === 0) await page.goto('/');
  const search = page.getByRole('banner').getByRole('searchbox', { name: 'Search', exact: true });
  await visible(search); await search.fill(name); await search.press('Enter');
  const result = page.getByRole('main').getByRole('link', { name, exact: true });
  await visible(result); await result.click();
}
"""
    write(ROOT/'github-real/tests/evolution-navigation.ts',navigation,['github-real-F04'])
    for path in sorted((ROOT/'github-real/tests').glob('*.spec.ts')):
        text=path.read_text();frames=[]
        for page in ['page','other']:
            for label in ['Sign in','Create an account']:
                old=f"named({page}, 'link', '{label}')"
                if old in text:
                    text=text.replace(old,f"named({page}.getByRole('main'), 'link', '{label}')")
                    frames.extend(['github-real-F01' if 'REQ-1-1-1-' in path.name else 'github-real-F02' if 'REQ-1-1-2-' in path.name else 'github-real-F03'])
        # Repository-opening scaffolding is separate from the actual search scenarios.
        if 'REQ-3-1-' not in path.name:
            pattern=r"await visible\(named\(page, 'searchbox', 'Search'\)\);\n  await named\(page, 'searchbox', 'Search'\)\.fill\((\"[^\"]+\")\); await named\(page, 'searchbox', 'Search'\)\.press\('Enter'\);\n  await visible\(named\(page, \"link\", \1\)\); await named\(page, \"link\", \1\)\.click\(\);"
            text,n=re.subn(pattern,r'await openEvolutionRepository(page, \1);',text)
            if n:
                text=text.replace("import { test, expect } from '@playwright/test';","import { test, expect } from '@playwright/test';\nimport { openEvolutionRepository } from './evolution-navigation';")
                frames.append('github-real-F04')
        write(path,text,sorted(set(frames)))

    path=ROOT/'github-real/tests/interactions.ts';text=path.read_text();start=text.index('export async function openPublicIssue')
    text=text[:start]+"""export async function openPublicIssue(page: Page, title: string) {
  // The frames reveal the banner-search entry, but not the repository argument
  // used for these two unnamed issue seeds. Retain public-link discovery.
  if (await page.getByRole('banner').count() === 0) await page.goto('/');
  const search=page.getByRole('banner').getByRole('searchbox',{name:'Search',exact:true});
  await visible(search); await search.fill(''); await search.press('Enter');
  const main=page.getByRole('main'); await visible(main);
  const resultsAddress=page.url();
  const links=await main.getByRole('link').evaluateAll(elements => elements.map(e=>({name:(e.getAttribute('aria-label') || e.textContent || '').trim(),href:(e as HTMLAnchorElement).href})).filter(e=>e.name));
  for(const link of links) {
    if(page.url()!==resultsAddress) await page.goto(resultsAddress);
    const result=page.getByRole('main').getByRole('link',{name:link.name,exact:true});
    await visible(result); await result.click();
    const issues=named(page,'link','Issues').or(named(page,'button','Issues'));
    if(await issues.count()!==1) continue;
    await issues.click();
    const issue=named(page,'link',title);
    if(await issue.count()) { await visible(issue); await issue.click(); await visible(page.getByRole('heading').filter({hasText:title})); return; }
  }
  throw new Error('No public UI link found for the pre-provisioned issue '+title);
}
"""
    write(path,text,['github-real-F04'])

    path=ROOT/'sheet-real/tests/10-REQ-5-1-2-scenario-1.spec.ts';text=path.read_text()
    start=text.index("  await rectangle(page, 'D3', 'F7');");end=text.index('  await command(page, "Data"); await command(page, "Save filter view");',start)
    text=text[:start]+"""  // Visible official applyCondition entry: sheet-real-F01, lines 7-10.
  await button(page, 'Create filter');
  let filter = named(page, 'dialog', 'Filter'); await visible(filter);
  await fill(filter, 'Range', 'D3:F7'); await fill(filter, 'Column', 'D');
  await choose(filter, 'Condition', 'Text contains'); await fill(filter, 'Value', 'Atlas'); await button(filter, 'Apply');
  await button(page, 'Create filter');
  filter = named(page, 'dialog', 'Filter'); await visible(filter);
  await fill(filter, 'Range', 'D3:F7'); await fill(filter, 'Column', 'F');
  await choose(filter, 'Condition', 'Greater than'); await fill(filter, 'Value', '20'); await button(filter, 'Apply');
"""+text[end:]
    write(path,text,['sheet-real-F01'])
    # The Filter views command's menuitem role is explicitly visible in F02:64.
    for path in sorted((ROOT/'sheet-real/tests').glob('*REQ-5-1-2-*.spec.ts')):
        text=path.read_text().replace('await command(page, "Filter views");',"await visible(named(page, 'menuitem', 'Filter views')); await named(page, 'menuitem', 'Filter views').click();")
        if 'scenario-3' in path.name:
            text=text.replace("await text(page, 'Filter view name already exists'); await visible(field(page, 'Filter view name')); await dismissDialogs(page);", "await expect(page.getByRole('alert')).toContainText('Filter view name already exists');\n  const saveDialog = page.getByRole('dialog').filter({ has: page.getByLabel('Filter view name', { exact: true }) });\n  await button(saveDialog, 'Close');")
        write(path,text,['sheet-real-F02'])

    for i,message in [(1,'Capacity must be from 25 to 75'),(2,'Choose a queue state'),(3,'Allocate between 25 and 75')]:
        path=next((ROOT/'sheet-real/tests').glob(f'*REQ-5-2-1-scenario-{i}.spec.ts'));text=path.read_text()
        text=re.sub(r"await text\(page,\s*'"+re.escape(message)+r"'\);",f"await expect(page.getByRole('alert')).toContainText('{message}');",text)
        if i==2:
            text=text.replace("await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.type('Paused'); await page.keyboard.press('Enter');","await page.locator(':focus').fill('Paused'); await page.locator(':focus').press('Enter');")
            text=text.replace("named(page, 'gridcell', \"K8\")).toHaveText(\"Ready\")","named(page, 'gridcell', \"K8\")).toContainText(\"Ready\")")
        write(path,text,[f'sheet-real-F0{i+2}'])

    path=ROOT/'sheet-real/tests/22-REQ-7-1-1-scenario-1.spec.ts';text=path.read_text()
    text=text.replace("await button(page,'Save'); await dismissDialogs(page);", """await button(page,'Save');
  // F06:22 ends an unseen conditional; retain reopening when Save closes the panel.
  if (!await dialog.isVisible()) { await command(page, 'Data'); await command(page, 'Named ranges'); }
  await expect(page.getByRole('dialog', { name: 'Named ranges', exact: true })).toContainText('CapacityPlan');
  await button(page.getByRole('dialog', { name: 'Named ranges', exact: true }), 'Close');""")
    text=text.replace('  await command(page, "Data"); await command(page, "Named ranges");\n  await visible(dialog); await text(dialog,\'CapacityPlan\'); await page.reload();', '  await page.reload();')
    write(path,text,['sheet-real-F06'])

    for i,ref in [(1,'D8'),(2,'F6'),(3,'J3')]:
        path=next((ROOT/'sheet-real/tests').glob(f'*REQ-8-1-1-scenario-{i}.spec.ts'));text=path.read_text()
        text=text.replace(f"await button(page,'Open note for {ref}');",f"await button(page.getByRole('gridcell', {{name:'{ref}',exact:true}}), 'Open note for {ref}');")
        text=text.replace('await dismissDialogs(page); ', '')
        if i<3:
            text=re.sub(r'await text\(dialog,("[^\"]+")\);',r"await expect(page.getByLabel('Note', {exact:true})).toHaveValue(\1);",text)
        if i==2:text=text.replace("await button(dialog,'Edit note');","await button(page,'Edit note');")
        if i==3:
            text=text.replace("await button(dialog,'Delete note');","await button(page,'Delete note');")
            text=text.replace("named(page,'button','Open note for J3')).toBeHidden()","named(page,'button','Open note for J3')).toHaveCount(0)")
        write(path,text,[f'sheet-real-F0{i+6}'])

    (ROOT/'results/calibration-v2-test-changes.json').write_text(json.dumps(changes,indent=2)+'\n')
    (ROOT/'results/calibration-v2-test-changes.diff').write_text(''.join(diff))
    print(len(changes),'recorded edits; titles and original sample helpers retained')

if __name__=='__main__':main()
