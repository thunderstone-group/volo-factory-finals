"""Extract all visible code, locator and assertion evidence from finals-r1..r5."""
import hashlib,json,re
from pathlib import Path
from extract_official_real_frames import specs,ANSI,LINE

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT.parent/'evidence/2026-10-06-finals'
def strings(value):
    if isinstance(value,str):yield value
    elif isinstance(value,dict):
        for item in value.values():yield from strings(item)
    elif isinstance(value,list):
        for item in value:yield from strings(item)

def main():
    frames={'github':{},'sheet':{}};reports={};occurrences=[]
    for run in range(1,6):
        for task,short in [('github','gh'),('sheet','sh')]:
            path=SOURCE/f'finals-r{run}'/short/'template/.arc/playwright-report.json'
            raw=json.loads(path.read_text());cases=[];found=0
            for spec in specs(raw):
                for test in spec['tests']:
                    req=re.match(r'(REQ-[\d-]+)',spec['title']).group(1)
                    number=int(re.search(r'Scenario (\d+)',spec['title'],re.I).group(1))
                    key=f'{req}#{number}';last=test.get('results',[])[-1]
                    case={'key':key,'name':spec['title'],'file':spec['file'],'status':'pass' if last.get('status')=='passed' else 'fail','playwright_status':last.get('status'),'duration_ms':last.get('duration'),'frames':[],'errors':[]}
                    for result_index,result in enumerate(test.get('results',[])):
                        errors=result.get('errors',[])+([result['error']] if result.get('error') else [])
                        for error_index,error in enumerate(errors):
                            clean={field:ANSI.sub('',error.get(field,'') or '') for field in ['message','stack','snippet']}
                            clean['location']=error.get('location',{})
                            case['errors'].append(clean)
                            for field in ['message','stack','snippet']:
                                lines=[{'line':int(m.group(1)),'code':m.group(2)} for line in clean[field].splitlines() if (m:=LINE.match(line))]
                                if not lines:continue
                                found+=1;location=error.get('location',{});source=location.get('file','(unknown)')
                                identity=json.dumps([source,lines],sort_keys=True)
                                if identity not in frames[task]:
                                    frames[task][identity]={'id':f'{task}-v3-F{len(frames[task])+1:02d}','source':source,'lines':lines,'observations':[]}
                                frame=frames[task][identity]
                                observation={'run':run,'case':key,'location':location}
                                if observation not in frame['observations']:frame['observations'].append(observation)
                                if frame['id'] not in case['frames']:case['frames'].append(frame['id'])
                                occurrences.append({'run':run,'task':task,'case':key,'frame':frame['id'],'result_index':result_index,'error_index':error_index,'field':field})
                    cases.append(case)
            assert len(cases)==len({case['key'] for case in cases})==30
            all_frames=sum(any(LINE.match(line) for line in ANSI.sub('',value).splitlines()) for value in strings(raw))
            assert found==all_frames,(run,task,found,all_frames)
            reports[f'r{run}-{task}']={'source':str(path),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'run':run,'task':task,'passed':sum(case['status']=='pass' for case in cases),'total':len(cases),'cases':cases,'visible_frame_occurrences':found,'stats':raw['stats'],'config':raw['config']}
    result={'reports':reports,'frames':{task:list(items.values()) for task,items in frames.items()},'occurrences':occurrences}
    (ROOT/'results/official-real-frames-v3.json').write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')
    md=['# Official finals-r1..r5 visible code evidence','',
        'All ten reports were scanned recursively to confirm every visible frame occurrence',
        'is represented. Error messages preserve resolved locators, expected values, regexes,',
        'and call logs in the structured extraction. No application source is used here.','']
    for task,items in result['frames'].items():
        md+=['## '+task,'']
        for frame in items:
            observations=', '.join(f"r{o['run']} {o['case']}" for o in frame['observations'])
            md+=['### '+frame['id'],'',f"Source: `{frame['source']}`; observations: {observations}.",'','```ts']
            md += [f"{line['line']:4} |{line['code']}" for line in frame['lines']]
            md+=['```','']
    (ROOT/'results/official-real-frames-v3.md').write_text('\n'.join(md)+'\n')
    observed=['# Resolved official locators and assertion values','']
    for name,report in reports.items():
        observed+=['## '+name,'']
        for case in report['cases']:
            if case['status']=='pass':continue
            messages=[]
            for error in case['errors']:
                message=error['message'];head=message.split('Call log:')[0].strip()
                waits=[line.strip() for line in message.splitlines() if 'waiting for ' in line]
                data=head+'\n'+'\n'.join(dict.fromkeys(waits))
                if data.strip() and data not in messages:messages.append(data)
            observed+=['### '+case['key']+' — '+', '.join(case['frames']),'','```text','\n'.join(messages),'```','']
    (ROOT/'results/official-real-observations-v3.md').write_text('\n'.join(observed)+'\n')
    for name,report in reports.items():print(name,report['passed'],'/ 30,',report['visible_frame_occurrences'],'frame occurrences')
    print('Unique frames:',{task:len(items) for task,items in result['frames'].items()})

if __name__=='__main__':main()
