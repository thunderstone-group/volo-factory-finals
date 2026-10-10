#!/usr/bin/env python3
"""Check every frozen test's names against its corresponding prose requirement.

Default invocation uses PyYAML already installed in the official Docker image,
with networking disabled. No host Python packages or installation are needed.
The scanner reads executable test expressions, ignoring comments and strings
that are not call arguments; it does not use the prose generator's locator list.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[1]
HELPERS={'named','field','activate','button','fill','choose','selected','checked','text','order'}
CONTAINERS={'region','dialog','grid','article','list','form'}

def skip_string(source,start):
    quote=source[start];i=start+1
    while i<len(source):
        if source[i]=='\\':i+=2;continue
        if source[i]==quote:return i+1
        i+=1
    raise ValueError('Unterminated JavaScript string')

def arguments(source,opening):
    out=[];start=opening+1;i=start;depth=0
    while i<len(source):
        c=source[i]
        if c in '\"\'`':i=skip_string(source,i);continue
        if c in '([{':depth+=1
        elif c in ')]}':
            if depth==0:
                if c!=')':raise ValueError('Unbalanced JavaScript call')
                out.append(source[start:i].strip());return out
            depth-=1
        elif c==',' and depth==0:out.append(source[start:i].strip());start=i+1
        i+=1
    raise ValueError('Unterminated JavaScript call')

def calls(source):
    i=0
    while i<len(source):
        if source.startswith('//',i):
            end=source.find('\n',i);i=end if end>=0 else len(source);continue
        if source.startswith('/*',i):
            end=source.find('*/',i+2)
            if end<0:raise ValueError('Unterminated comment')
            i=end+2;continue
        if source[i] in '\"\'`':i=skip_string(source,i);continue
        if source[i].isalpha() or source[i] in '_$':
            start=i;i+=1
            while i<len(source) and (source[i].isalnum() or source[i] in '_$'):i+=1
            name=source[start:i];end=i
            while end<len(source) and source[end].isspace():end+=1
            if end<len(source) and source[end]=='(':
                yield name,arguments(source,end),source.count('\n',0,start)+1
            continue
        i+=1

def literal(value):
    # The frozen specs use JSON double-quoted literals for every semantic operand.
    if not value.startswith('"'):raise ValueError('Nonliteral test operand: '+value)
    parsed=json.loads(value)
    if not isinstance(parsed,str):raise ValueError('Expected a string operand')
    return parsed

def scan_test(source):
    names={};values=set();test_titles=[]
    def add(kind,name,line):
        names.setdefault((kind,name),{'kind':kind,'name':name,'test_lines':[]})['test_lines'].append(line)
    for func,args,line in calls(source):
        if func=='test':test_titles.append(literal(args[0]))
        if func=='named':add(literal(args[1]),literal(args[2]),line)
        elif func=='field':add('label',literal(args[1]),line)
        elif func=='activate':add('navigation',literal(args[1]),line)
        elif func in {'button','checked'}:add('checkbox' if func=='checked' else 'button',literal(args[1]),line)
        elif func=='fill':add('label',literal(args[1]),line);values.add(literal(args[2]))
        elif func in {'choose','selected'}:add('combobox',literal(args[1]),line);add('option',literal(args[2]),line)
        elif func=='text':add('text',literal(args[1]),line)
        elif func=='order':
            add('list',literal(args[1]),line)
            items=json.loads(args[2]);assert isinstance(items,list) and all(isinstance(x,str) for x in items)
            values.update(items)
        elif func in {'toHaveText','toHaveValue'}:values.add(literal(args[0]))
        elif func=='press':values.add(literal(args[0]))
        elif func.startswith('getBy') or func in {'locator','filter','nth','first','last'}:
            raise ValueError(f'Unreviewed selector in frozen spec on line {line}: {func}')
    assert len(test_titles)==1,test_titles
    return test_titles[0],list(names.values()),sorted(values)

def atoms(text):
    # Inline code preserves leading/trailing spaces. Escape sequences in multiline
    # literal examples represent the actual line breaks documented in that atomic.
    pattern=r'“([^”]*)”|(`{1,2})([\s\S]*?)\2'
    for match in re.finditer(pattern,text):
        value=match[1] if match[1] is not None else match[3]
        value=value.replace('\\n','\n').replace('\\r','\r').replace('\\t','\t')
        yield value,match.start(),match.end()

def requirement_parts(req):
    yield 'description',req['description']
    for si,scenario in enumerate(req['scenarios']):
        for n,step in enumerate(scenario['steps']):yield f'scenarios[{si}].steps[{n}].content',step['content']

def quote_occurrences(req):
    found={}
    for part,text in requirement_parts(req):
        for value,start,end in atoms(text):
            found.setdefault(value,[]).append({'part':part,'excerpt':text[max(0,start-65):min(len(text),end+65)]})
    return found

def role_in_prose(req,role,name):
    for _,text in requirement_parts(req):
        for value,start,end in atoms(text):
            if value!=name:continue
            after=text[end:end+30];before=text[max(0,start-50):start]
            if re.match(r'\s+'+re.escape(role)+r'\b',after,re.I):return True
            if re.search(r'\b'+re.escape(role)+r'(?:\s+(?:named|called|identified as|identified by))?\s*$',before,re.I):return True
    return False

def check():
    import yaml
    from freeze import digest,files,verify
    from build_prose import paragraphs
    probe='test("probe", async () => { // button(page, "Comment decoy");\n const example = "button(page, \\"String decoy\\")"; await button(page, "Save"); });'
    _,probe_names,_=scan_test(probe)
    assert [(x['kind'],x['name']) for x in probe_names]==[('button','Save')]
    probe_req={'description':'The “Save” button submits the form.','scenarios':[]}
    assert 'Save' in quote_occurrences(probe_req) and 'Cancel' not in quote_occurrences(probe_req)
    assert not role_in_prose(probe_req,'region','Save')
    report={'all_names_present':True,'test_files_unchanged':True,'metadata_unchanged':True,'scenario_operands_and_order_preserved':True,'scanner_self_checks':True,'requirements':[],'tasks':{}}
    rows=['| Task | Test | Names found / used | Containers found / used | Names and exact-text locators checked |','|---|---|---:|---:|---|']
    for base in ['github','sheet']:
        task=base+'-prose';freeze_hash=verify(task)
        original=yaml.safe_load((ROOT/base/'requirements/requirements.yaml').read_text())
        prose=yaml.safe_load((ROOT/task/'requirements/requirements.yaml').read_text())
        assert prose['id']==original['id']=='ROOT' and prose['type']==original['type']=='FOLDER'
        assert len(prose['children'])==len(original['children'])==30
        all_text='\n'.join(text for r in prose['children'] for _,text in requirement_parts(r))+'\n'+prose['description']
        assert 'Benchmark interaction contract' not in all_text
        assert not re.search(r'A visible \w+ named|The current page contains one|The (?:region|dialog|grid) named .*?(?:contains|exposes)',all_text)
        assert '“' in all_text and '`' in all_text
        canonical_files={n:s for n,s in files(base).items() if n.startswith('tests/')}
        alias_files={n:s for n,s in files(task).items() if n.startswith('tests/')}
        assert canonical_files==alias_files and len(alias_files)==31
        assert (ROOT/task/'tests').resolve()==(ROOT/base/'tests').resolve()
        records=[]
        for old,new,spec in zip(original['children'],prose['children'],sorted((ROOT/base/'tests').glob('*.spec.ts'))):
            old_metadata={k:v for k,v in old.items() if k not in ['description','scenarios']}
            new_metadata={k:v for k,v in new.items() if k not in ['description','scenarios']}
            assert old_metadata==new_metadata,(task,old['id'],'metadata')
            assert len(old['scenarios'])==len(new['scenarios'])==1
            assert old['scenarios'][0]['name']==new['scenarios'][0]['name']
            assert new['scenarios'][0]['steps']==paragraphs(old['scenarios'][0]['steps']),(task,old['id'],'scenario translation')
            title,names,values=scan_test(spec.read_text())
            assert title.split(': ',1)[0]==new['id']
            found=quote_occurrences(new);missing=[]
            for entry in names:
                entry['present']=entry['name'] in found
                entry['evidence']=found.get(entry['name'],[])[:2]
                if entry['kind'] in CONTAINERS:entry['role_present']=role_in_prose(new,entry['kind'],entry['name'])
                if not entry['present'] or entry.get('role_present') is False:missing.append(entry)
            missing_values=[v for v in values if v not in found]
            # Empty cell assertions are rendered as an empty inline code literal;
            # recognize the explicit empty-code notation without adding seed data.
            if '' in missing_values and '``' in '\n'.join(t for _,t in requirement_parts(new)):missing_values.remove('')
            if missing or missing_values:report['all_names_present']=False
            containers=[n for n in names if n['kind'] in CONTAINERS]
            record={'task':task,'id':new['id'],'test_title':title,'file':str(spec.relative_to(ROOT)),'test_sha256':digest(spec),'names':names,'names_found':sum(n['present'] for n in names),'names_used':len(names),'containers_found':sum(n.get('role_present',False) for n in containers),'containers_used':len(containers),'missing':missing,'literal_values_checked':values,'missing_literal_values':missing_values,'scenario_steps_before':len(old['scenarios'][0]['steps']),'scenario_steps_after':len(new['scenarios'][0]['steps'])}
            records.append(record);report['requirements'].append(record)
            unique=sorted({n['name'] for n in names})
            shown=', '.join('`'+n.replace('|','\\|').replace('`','&#96;').replace('\n','\\n')+'`' for n in unique)
            rows.append(f'| {task} | {new["id"]} | {record["names_found"]}/{record["names_used"]} | {record["containers_found"]}/{record["containers_used"]} | {shown} |')
        report['tasks'][task]={'requirements':30,'tests':30,'frozen_manifest_sha256':freeze_hash,'requirements_sha256':digest(ROOT/task/'requirements/requirements.yaml'),'canonical_task':base,'shared_test_suite_sha256':hashlib.sha256(json.dumps(canonical_files,sort_keys=True,separators=(',',':')).encode()).hexdigest(),'all_30_covered':all(not r['missing'] and not r['missing_literal_values'] for r in records),'tests_sha256':canonical_files}
    (ROOT/'results/prose-name-coverage.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
    (ROOT/'results/prose-name-coverage.md').write_text('\n'.join(rows)+'\n')
    for task,data in report['tasks'].items():print(task, '30/30 covered' if data['all_30_covered'] else 'COVERAGE MISSING',flush=True)
    for r in report['requirements']:
        if r['missing'] or r['missing_literal_values']:print(r['task'],r['id'],'missing',[(x['kind'],x['name'],x.get('role_present')) for x in r['missing']],r['missing_literal_values'])
    return 0 if report['all_names_present'] and all(x['all_30_covered'] for x in report['tasks'].values()) else 1

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--inside',action='store_true',help=argparse.SUPPRESS);args=p.parse_args()
    if args.inside:return check()
    command=['docker','run','--rm','--network','none','--platform','linux/amd64','--mount',f'type=bind,source={ROOT},target=/proxy','--env','PYTHONDONTWRITEBYTECODE=1','--entrypoint','python3','gyataro/arcbench-runner:local-base','/proxy/scripts/check_prose_coverage.py','--inside']
    return subprocess.run(command,timeout=120).returncode
if __name__=='__main__':raise SystemExit(main())
