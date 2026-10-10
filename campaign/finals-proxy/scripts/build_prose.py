"""Rewrite requirement prose only. Never generates or edits acceptance tests.

Feature paragraphs are hand-written in prose_paragraphs.py. Scenario actions and
assertions are translated without changing their operands, scopes, or order;
adjacent steps of the same kind are combined into natural paragraphs.
"""
import copy
import json
import re
from pathlib import Path
import yaml
from prose_paragraphs import GITHUB, SHEET

ROOT=Path(__file__).resolve().parents[1]
J=r'("(?:[^"\\]|\\.)*")'
S=r'(the current page|the \w+ named "(?:[^"\\]|\\.)*")'
decode=lambda value:json.loads(value,strict=False)
def quote(value):return '“'+str(value)+'”'
def code(value):
    value=str(value).replace('\n','\\n').replace('\r','\\r').replace('\t','\\t')
    fence='``' if '`' in value else '`'
    return fence+value+fence
def location(value):
    if value=='the current page':return ''
    match=re.fullmatch(r'the (\w+) named '+J,value)
    assert match,value
    return 'in the '+quote(decode(match[2]))+' '+match[1]
def phrase(role,name):
    if role=='gridcell':return 'cell '+code(name)
    if role=='tab':return 'the '+quote(name)+' worksheet tab'
    if role=='menuitem':return 'the '+quote(name)+' menu command'
    if role=='menuitemcheckbox':return 'the '+quote(name)+' menuitemcheckbox'
    return 'the '+quote(name)+' '+role

def natural(keyword,content):
    if keyword=='GIVEN':
        if content.startswith('The user opens the application home entry'):
            return 'The visitor starts at the application home page in a fresh, unauthenticated browser session.'
        content=re.sub(J,lambda m:code(decode(m[1])),content)
        content=content.replace('The public repository ', 'The system pre-provisions the public repository ',1)
        content=content.replace('` is owned by repo-admin.', '` owned by repo-admin.',1)
        content=content.replace('The public workbook ', 'The evaluation seed contains the public workbook ',1)
        content=content.replace(' exists independently of every other scenario.', ', separate from the workbooks used in the other scenarios.')
        content=content.replace('The original verified account ', 'The system also pre-provisions the original verified account ',1)
        return content
    if content=='The user reloads the current page.':return 'The user refreshes the current page.'
    if content=='The user returns to the application home entry.':return 'The user returns to the application home page.'
    m=re.fullmatch(r'The user activates '+J+r' in '+S+r'\.',content)
    if m:return f'The user opens {quote(decode(m[1]))} {location(m[2])}.'
    m=re.fullmatch(r'The user (clicks|right-clicks) the (\w+) named '+J+r' in '+S+r'\.',content)
    if m:
        verb='selects' if m[1]=='clicks' and m[2] in ['gridcell','tab','option'] else m[1]
        return f'The user {verb} {phrase(m[2],decode(m[3]))} {location(m[4])}.'
    m=re.fullmatch(r'The user enters '+J+r' in the '+J+r' field in '+S+r'\.',content)
    if m:return f'The user enters {code(decode(m[1]))} in the visibly labeled {quote(decode(m[2]))} field {location(m[3])}.'
    m=re.fullmatch(r'The user presses '+J+r' in the '+J+r' field in '+S+r'\.',content)
    if m:return f'The user presses {code(decode(m[1]))} in {quote(decode(m[2]))} {location(m[3])}.'
    m=re.fullmatch(r'The user presses '+J+r' on the (\w+) named '+J+r' in '+S+r'\.',content)
    if m:return f'The user presses {code(decode(m[1]))} on {phrase(m[2],decode(m[3]))} {location(m[4])}.'
    m=re.fullmatch(r'The user selects '+J+r' in the '+J+r' combobox in '+S+r'\.',content)
    if m:return f'The user selects the {quote(decode(m[1]))} option in the {quote(decode(m[2]))} combobox {location(m[3])}.'
    m=re.fullmatch(r'The '+J+r' combobox in '+S+r' has selected option '+J+r'\.',content)
    if m:return f'The {quote(decode(m[1]))} combobox {location(m[2])} shows {quote(decode(m[3]))} as its selected option.'
    m=re.fullmatch(r'The user (checks|unchecks) '+J+r' in '+S+r'\.',content)
    if m:return f'The user {m[1]} the {quote(decode(m[2]))} checkbox {location(m[3])}.'
    m=re.fullmatch(r'The (\w+) named '+J+r' is (visible exactly once|absent) in '+S+r'\.',content)
    if m:
        subject=phrase(m[1],decode(m[2]));subject=subject[0].upper()+subject[1:]
        return f'{subject} '+('appears once and is visible' if m[3]=='visible exactly once' else 'does not appear')+f' {location(m[4])}.'
    m=re.fullmatch(r'The exact text '+J+r' is visible exactly once in '+S+r'\.',content)
    if m:return f'The complete text {code(decode(m[1]))} appears visibly once {location(m[2])}.'
    m=re.fullmatch(r'The '+J+r' field in '+S+r' displays '+J+r'\.',content)
    if m:return f'The {quote(decode(m[1]))} field {location(m[2])} displays the saved value {code(decode(m[3]))}.'
    m=re.fullmatch(r'The (\w+) named '+J+r' in '+S+r' has exact text '+J+r'\.',content)
    if m:
        subject=phrase(m[1],decode(m[2]));subject=subject[0].upper()+subject[1:]
        return f'{subject} {location(m[3])} displays exactly {code(decode(m[4]))}.'
    m=re.fullmatch(r'The (\w+) named '+J+r' in '+S+r' has (\w+) state '+J+r'\.',content)
    if m:
        subject=phrase(m[1],decode(m[2]));subject=subject[0].upper()+subject[1:]
        yes=decode(m[5])=='true'
        states={'checked':('checked','unchecked'),'disabled':('disabled','enabled'),'selected':('selected','not selected'),'pressed':('pressed','not pressed')}
        return f'{subject} remains visible and is {states[m[4]][0 if yes else 1]} {location(m[3])}.'
    m=re.fullmatch(r'The '+J+r' list in '+S+r' contains exactly these entries in order: (\[.*\])\.',content)
    if m:
        values=json.loads(m[3]);head=f'The {quote(decode(m[1]))} list {location(m[2])}'
        return head+((' shows '+', then '.join(code(x) for x in values)+', in that reading order, with no additional entries.') if values else ' remains visible with no entries.')
    m=re.fullmatch(r'The user drags from gridcell '+J+r' to gridcell '+J+r' in '+S+r'\.',content)
    if m:return f'The user brings cells {code(decode(m[1]))} and {code(decode(m[2]))} into view {location(m[3])}, then drags from {code(decode(m[1]))} to {code(decode(m[2]))} to select that rectangle.'
    raise ValueError(f'Unhandled {keyword}: {content}')

def paragraphs(steps):
    # A GIVEN account may be repeated at a later login in the Light scenario.
    # Provisioning is initial state, so state all distinct facts together first.
    facts=list(dict.fromkeys(natural('GIVEN',x['content']) for x in steps if x['keyword']=='GIVEN'))
    out=[{'keyword':'GIVEN','content':' '.join(facts)}]
    groups=[]
    for step in steps:
        if step['keyword']=='GIVEN':continue
        value=natural(step['keyword'],step['content'])
        if groups and groups[-1][0]==step['keyword']:groups[-1][1].append(value)
        else:groups.append((step['keyword'],[value]))
    for keyword,values in groups:
        if keyword=='WHEN':
            clauses=[x.removeprefix('The user ').removesuffix('.') for x in values]
            joined='The user '+(clauses[0] if len(clauses)==1 else (clauses[0]+' and '+clauses[1] if len(clauses)==2 else ', '.join(clauses[:-1])+', and '+clauses[-1]))+'.'
        else:joined=' '.join(values)
        out.append({'keyword':keyword,'content':joined.replace(' .','.').replace(' ,',',').replace('  and',' and')})
    return out

ROOT_TEXT={
 'github': '''This product extends the participant's selected GitHub collaboration application. Repository browsing, sign-in, organization membership, file management, issues and pull requests retain their existing behavior except where an atomic change below extends it. The additional work concerns issue discovery, repository metadata, discussions and review. Real-time collaboration, Actions, Packages, Wiki, project boards, notification delivery and external Git remote protocols remain outside the product's scope.

Values described as existing accounts, repositories, branches, files, issues, labels, milestones, pull requests or reviews are predefined seed data. The system provisions these before the scenarios begin. Each scenario starts at the home page in a fresh unauthenticated browser session and uses its own EV-suffixed repository and records. Scenarios can be performed independently and in any order against the same running application; they must not depend on resetting another scenario's data. The original accounts are reused with their documented credentials, which these scenarios do not change. Saved application data remains available when the user navigates away or refreshes.

Unless an atomic requirement permits more than one navigation role, quoted user-interface wording is the exact English accessible name; the role, scope and observable-state rules of the atomic requirement are authoritative. Existing permission relationships remain operation-specific. Implementations may choose their framework, storage and page-entry format without depending on a private setup API.''',
 'sheet': '''This product extends the participant's selected online spreadsheet workspace. Workbook and worksheet management, cell editing, formulas, data organization, validation and pivot analysis continue to follow the original requirements, with the changes and additions below. The new work extends formulas, range naming, data cleanup and workbook organization. This remains a public single-user workspace: the original task does not define accounts or passwords. Sharing, real-time collaboration, advanced visual styling, charts, macros and external office integrations remain outside scope.

The workbooks and cell contents described as existing are evaluation seed data, available before the corresponding scenario. Each scenario begins at the home page in a fresh unauthenticated browser session and has a separate EV-suffixed workbook. The scenarios can be performed independently and in any order on one running application, without relying on a server reset or another scenario's changes. Successful edits remain visible through the same workbook when the user navigates away, reopens it or refreshes. Other workbooks and worksheets remain unchanged unless an operation explicitly includes them.

Quoted control wording is the exact English accessible name, and the role, scope and observable-state rules in the atomic requirements determine the visible result. The implementation may choose its framework, storage and workbook-entry format; users perform these operations through the described interface without a private setup API.''',
}
GITHUB_CONTEXT='''The repository is reached through the global “Search” field: the visitor submits its seeded name with Enter and opens the matching entry. Its overview identifies it with an owner/name heading. This operation uses the existing repository context and preserves the original access rules.'''
SIGN_IN='''When sign-in is required below, the visitor opens “Sign in”, fills the visibly labeled “Username or email” and masked “Password” inputs, and submits the “Sign in” button. The signed-in workspace provides the “Account menu” button. Account switches follow “Sign out” and confirm through “Confirm sign out” in the “Sign out” dialog.'''
SHEET_CONTEXT='''The user opens the seeded workbook through its workbook-name entry on the home page. Its active worksheet is displayed by the ARIA grid “Worksheet grid”, with coordinate-named gridcells and selection represented by aria-selected. Worksheet tabs retain their tab role and selected state; row and column headers retain their corresponding header roles. Menu commands use menuitem semantics unless a different role is stated.'''
CONTROL_CONTEXT='''The visible controls used for this workflow are unique within the page or the stated dialog or region. Navigation entries may be links or buttons unless a particular role is stated, while form submissions use buttons and inputs have the visible labels shown below. The named sections, dialogs, articles and lists use their corresponding accessible roles; list items show the complete stated text in reading order. A control described as absent is not present.'''

class Dumper(yaml.SafeDumper):pass
def represent(dumper,value):return dumper.represent_scalar('tag:yaml.org,2002:str',value,style='|' if '\n' in value else None)
Dumper.add_representer(str,represent)

def build(task):
    source=yaml.safe_load((ROOT/task/'requirements/requirements.yaml').read_text())
    result=copy.deepcopy(source);result['name']=source['name'].replace('Light','Prose')
    result['description']=ROOT_TEXT[task]
    narratives=GITHUB if task=='github' else SHEET
    assert set(narratives)=={x['id'] for x in result['children']}
    for old,new in zip(source['children'],result['children']):
        context=GITHUB_CONTEXT if task=='github' else SHEET_CONTEXT
        if task=='github' and any('The original verified account ' in x['content'] for x in old['scenarios'][0]['steps']):context+=' '+SIGN_IN
        context+=' '+CONTROL_CONTEXT
        steps=old['scenarios'][0]['steps']
        if any('combobox' in step['content'] for step in steps):
            context+=' Selecting an option uses the labeled combobox; when collapsed, the selector displays only its selected option.'
        if any(' state ' in step['content'] for step in steps):
            context+=' Checking, selection and pressed states are exposed through their native or ARIA state as well as the visible interface.'
        if any('status' in step['content'] or 'alert' in step['content'] for step in steps):
            context+=' A status or alert carries its complete visible message as its accessible name.'
        new['description']=narratives[old['id']]+'\n\n'+context
        if '\\n' in str(old['scenarios']) or '\n' in ''.join(x['content'] for x in old['scenarios'][0]['steps']):
            new['description']+=' In multiline code literals below, `\\n` denotes a newline character.'
        for before,after in zip(old['scenarios'],new['scenarios']):after['steps']=paragraphs(before['steps'])
    path=ROOT/(task+'-prose')/'requirements/requirements.yaml'
    path.write_text(yaml.dump(result,Dumper=Dumper,sort_keys=False,allow_unicode=True,width=100),encoding='utf-8')
    print(f'{task}-prose: wrote 30 prose requirements; canonical tests untouched')

if __name__=='__main__':
    for task in ['github','sheet']:build(task)
