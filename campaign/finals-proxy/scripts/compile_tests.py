"""Translate the public scenario prose to official-style Playwright steps.

Input is requirements.yaml only. Unknown prose fails closed. This tool never
reads application source or creates seed records through a private interface.
"""
import json
import re
import shutil
from pathlib import Path
import yaml

ROOT=Path(__file__).resolve().parents[1]
OFFICIAL=Path('~/projects/arcbench-campaign/evidence/2026-10-06-finals/packs/arc-bench-evolution--keep/helpers.ts')
J=r'("(?:[^"\\]|\\.)*")'
S=r'(the current page|the \w+ named "(?:[^"\\]|\\.)*")'
def js(s):return json.dumps(s,ensure_ascii=False)
def decode(s):return json.loads(s)
def scope(s):
    if s=='the current page':return 'page'
    m=re.fullmatch(r'the (\w+) named '+J,s)
    assert m,s
    return f'named(page, {js(m[1])}, {m[2]})'
def named(s,role,name):return f'named({scope(s)}, {js(role)}, {name})'
def translate(keyword,c):
    if keyword=='GIVEN':return "await page.goto('/');" if c.startswith('The user opens the application home entry') else ''
    if c=='The user reloads the current page.':return 'await page.reload();'
    if c=='The user returns to the application home entry.':return "await page.goto('/');"
    m=re.fullmatch(r'The user activates '+J+r' in '+S+r'\.',c)
    if m:return f'await activate({scope(m[2])}, {m[1]});'
    m=re.fullmatch(r'The user (clicks|right-clicks) the (\w+) named '+J+r' in '+S+r'\.',c)
    if m:
        loc=named(m[4],m[2],m[3])
        if m[1]=='clicks' and m[2]=='button':return f'await button({scope(m[4])}, {m[3]});'
        return f'await visible({loc}); await {loc}.click('+('{ button: "right" }' if m[1]=='right-clicks' else '')+');'
    m=re.fullmatch(r'The user enters '+J+r' in the '+J+r' field in '+S+r'\.',c)
    if m:return f'await fill({scope(m[3])}, {m[2]}, {m[1]});'
    m=re.fullmatch(r'The user presses '+J+r' in the '+J+r' field in '+S+r'\.',c)
    if m:return f'await visible(field({scope(m[3])}, {m[2]})); await field({scope(m[3])}, {m[2]}).press({m[1]});'
    m=re.fullmatch(r'The user presses '+J+r' on the (\w+) named '+J+r' in '+S+r'\.',c)
    if m:
        loc=named(m[4],m[2],m[3]);return f'await visible({loc}); await {loc}.press({m[1]});'
    m=re.fullmatch(r'The user selects '+J+r' in the '+J+r' combobox in '+S+r'\.',c)
    if m:return f'await choose({scope(m[3])}, {m[2]}, {m[1]});'
    m=re.fullmatch(r'The '+J+r' combobox in '+S+r' has selected option '+J+r'\.',c)
    if m:return f'await selected({scope(m[2])}, {m[1]}, {m[3]});'
    m=re.fullmatch(r'The user (checks|unchecks) '+J+r' in '+S+r'\.',c)
    if m:return f'await checked({scope(m[3])}, {m[2]}, {str(m[1]=="checks").lower()});'
    m=re.fullmatch(r'The (\w+) named '+J+r' is (visible exactly once|absent) in '+S+r'\.',c)
    if m:
        loc=named(m[4],m[1],m[2]);return f'await visible({loc});' if m[3]=='visible exactly once' else f'await expect({loc}).toHaveCount(0);'
    m=re.fullmatch(r'The exact text '+J+r' is visible exactly once in '+S+r'\.',c)
    if m:return f'await text({scope(m[2])}, {m[1]});'
    m=re.fullmatch(r'The '+J+r' field in '+S+r' displays '+J+r'\.',c)
    if m:return f'await visible(field({scope(m[2])}, {m[1]})); await expect(field({scope(m[2])}, {m[1]})).toHaveValue({m[3]});'
    m=re.fullmatch(r'The (\w+) named '+J+r' in '+S+r' has exact text '+J+r'\.',c)
    if m:
        loc=named(m[3],m[1],m[2]);return f'await visible({loc}); await expect({loc}).toHaveText({m[4]});'
    m=re.fullmatch(r'The (\w+) named '+J+r' in '+S+r' has (\w+) state '+J+r'\.',c)
    if m:
        loc=named(m[3],m[1],m[2]);value=decode(m[5]);prefix=f'await visible({loc}); '
        if m[4]=='disabled':return prefix+f'await expect({loc}).'+('toBeDisabled();' if value=='true' else 'toBeEnabled();')
        if m[4]=='checked':return prefix+f'await expect({loc}).toBeChecked({{ checked: {value} }});'
        return prefix+f'await expect({loc}).toHaveAttribute("aria-{m[4]}", {m[5]});'
    m=re.fullmatch(r'The '+J+r' list in '+S+r' contains exactly these entries in order: (\[.*\])\.',c)
    if m:return f'await order({scope(m[2])}, {m[1]}, {m[3]});'
    m=re.fullmatch(r'The user drags from gridcell '+J+r' to gridcell '+J+r' in '+S+r'\.',c)
    if m:
        a=named(m[3],'gridcell',m[1]);b=named(m[3],'gridcell',m[2])
        return f'{{ await visible({a}); await visible({b}); await {a}.scrollIntoViewIfNeeded(); await {b}.scrollIntoViewIfNeeded(); const a = (await {a}.boundingBox())!; const b = (await {b}.boundingBox())!; await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down(); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, {{ steps: 8 }}); await page.mouse.up(); }}'
    raise ValueError(f'Untranslated {keyword}: {c}')

def main():
    for task in ['github','sheet']:
        data=yaml.safe_load((ROOT/task/'requirements/requirements.yaml').read_text())
        assert data['id']=='ROOT' and data['type']=='FOLDER'
        assert len(data['children'])==30
        for i,req in enumerate(data['children'],1):
            assert req['type']=='ATOMIC' and len(req['scenarios'])==1
            scenario=req['scenarios'][0]
            lines=["import { test, expect } from '@playwright/test';", "import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';",'', 'test.use({ storageState: { cookies: [], origins: [] } });','',f'test({js(req["id"]+": "+scenario["name"])}, async ({{ page }}) => {{']
            for step in scenario['steps']:
                lines.append('  // '+step['keyword']+': '+step['content'].replace('\n','\\n'))
                code=translate(step['keyword'],step['content'])
                if code:lines.append('  '+code)
            lines.extend(['});',''])
            (ROOT/task/'tests'/f'{i:02d}-{req["id"]}.spec.ts').write_text('\n'.join(lines))
        shutil.copyfile(OFFICIAL,ROOT/task/'tests/helpers.ts')
        print(f'{task}: 30 requirements, 30 scenarios, 30 tests; official helper copied verbatim')

if __name__=='__main__':main()
