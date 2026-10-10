"""One backend per suite, no reset hooks and no private seed injection."""
import argparse,json,os,subprocess,time,urllib.request
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--work',type=Path,required=True);p.add_argument('--task',required=True);p.add_argument('--list',action='store_true');p.add_argument('--grep');a=p.parse_args()
w=a.work;app=w/'application';backend=None
config={'testDir':f'/proxy/{a.task}/tests','testMatch':'**/*.spec.ts','timeout':10000,'expect':{'timeout':10000},'fullyParallel':False,'workers':1,'retries':0,'reporter':[['json',{'outputFile':str(w/'playwright-report.json')}]],'outputDir':str(w/'test-results'),'use':{'baseURL':'http://127.0.0.1:3000','channel':'chromium','trace':'off','screenshot':'off','video':'off'}}
(w/'playwright.config.cjs').write_text('module.exports = '+json.dumps(config)+';\n')
cmd=['npx','--no-install','--prefix','/opt/arcbench','playwright','test','--config',str(w/'playwright.config.cjs')]
try:
    if a.list:
        result=subprocess.run(cmd+['--list','--reporter=list'],text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
        (w/'list.txt').write_text(result.stdout);raise SystemExit(result.returncode)
    for directory in ['frontend','backend']:
        d=app/directory;pkg=json.loads((d/'package.json').read_text())
        if pkg.get('dependencies') or pkg.get('devDependencies'):
            # One attempt only. A failed install is an infrastructure failure.
            subprocess.run(['npm','ci' if (d/'package-lock.json').exists() else 'install','--no-audit','--no-fund'],cwd=d,check=True,timeout=240)
    subprocess.run(['npm','run','build'],cwd=app/'frontend',check=True,timeout=120)
    with (w/'backend.log').open('w') as log:
        backend=subprocess.Popen(['npm','run','start'],cwd=app/'backend',env={**os.environ,'HOST':'0.0.0.0','PORT':'3000'},stdout=log,stderr=subprocess.STDOUT)
        deadline=time.monotonic()+120
        while True:
            if backend.poll() is not None:raise RuntimeError((w/'backend.log').read_text())
            try:
                with urllib.request.urlopen('http://127.0.0.1:3000',timeout=2) as response:
                    if response.status==200:break
            except Exception:pass
            if time.monotonic()>deadline:raise RuntimeError('Application readiness deadline exceeded')
            time.sleep(.1)
        if a.grep:cmd+=['--grep',a.grep]
        result=subprocess.run(cmd,timeout=650)
        raise SystemExit(result.returncode)
finally:
    if backend and backend.poll() is None:
        backend.terminate()
        try:backend.wait(timeout=5)
        except subprocess.TimeoutExpired:backend.kill()
