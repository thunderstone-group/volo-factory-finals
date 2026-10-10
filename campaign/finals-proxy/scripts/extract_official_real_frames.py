"""Read-only extraction of every visible organizer error frame and scenario result."""
import hashlib,json,re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT.parent/'evidence/2026-10-06-finals/finals-r1'
ANSI=re.compile(r'\x1b\[[0-9;]*m')
LINE=re.compile(r'^\s*>?\s*(\d+)\s*\|(.*)$')

def specs(report):
    for suite in report.get('suites',[]):
        yield from suite.get('specs',[])
        yield from specs(suite)

def main():
    result={};markdown=['# Visible official real-finals code frames','',
      'Extracted from the two read-only finals-r1 Playwright reports. This is partial',
      'test-code evidence, not a reconstruction of the undisclosed full suite.','']
    for task,directory in [('github-real','gh'),('sheet-real','sh')]:
        path=SOURCE/directory/'template/.arc/playwright-report.json';report=json.loads(path.read_text())
        cases=[];frames={};occurrences=[]
        for spec in specs(report):
            for test in spec['tests']:
                runs=test.get('results',[]);last=runs[-1] if runs else {}
                req=re.match(r'(REQ-[\d-]+)',spec['title']).group(1)
                scenario=int(re.search(r'Scenario (\d+)',spec['title'],re.I).group(1))
                case={'key':f'{req}#{scenario}','name':spec['title'],'file':spec['file'],'status':'pass' if last.get('status')=='passed' else 'fail','playwright_status':last.get('status'),'duration_ms':last.get('duration'),'frames':[]}
                for run_index,run in enumerate(runs):
                    errors=run.get('errors',[])+([run['error']] if run.get('error') else [])
                    for error_index,error in enumerate(errors):
                        # The report may put a code frame in message, stack, or snippet.
                        for field in ['message','stack','snippet']:
                            value=ANSI.sub('',error.get(field,'') or '')
                            lines=[{'line':int(match.group(1)),'code':match.group(2)} for line in value.splitlines() if (match:=LINE.match(line))]
                            if not lines:continue
                            location=error.get('location',{})
                            source=location.get('file') or '(file not supplied)'
                            key=json.dumps([source,lines],sort_keys=True)
                            if key not in frames:
                                number=len(frames)+1
                                frames[key]={'id':f'{task}-F{number:02d}','source':source,'location':location,'lines':lines,'cases':[]}
                            frame=frames[key]
                            if case['key'] not in frame['cases']:frame['cases'].append(case['key'])
                            if frame['id'] not in case['frames']:case['frames'].append(frame['id'])
                            occurrences.append({'frame':frame['id'],'case':case['key'],'run_index':run_index,'error_index':error_index,'field':field,'error_text':value})
                cases.append(case)
        assert len(cases)==30 and len({case['key'] for case in cases})==30
        data={'report':str(path),'report_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'official_passed':sum(case['status']=='pass' for case in cases),'cases':cases,'unique_frames':list(frames.values()),'frame_occurrences':occurrences,'config':report['config'],'stats':report['stats']}
        result[task]=data
        markdown+=['## '+task,'',f"Report SHA-256: `{data['report_sha256']}`. Official result: {data['official_passed']}/30.",'']
        for frame in frames.values():
            markdown+=['### '+frame['id'],'',f"Source: `{frame['source']}`; observed in: {', '.join(frame['cases'])}.",'','```ts']
            markdown += [f"{line['line']:4} |{line['code']}" for line in frame['lines']]
            markdown+=['```','']
        print(task,f"{data['official_passed']}/30",len(frames),'unique frames;',len(occurrences),'frame occurrences')
    (ROOT/'results/official-real-frames.json').write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')
    (ROOT/'results/official-real-frames.md').write_text('\n'.join(markdown)+'\n')

if __name__=='__main__':main()
