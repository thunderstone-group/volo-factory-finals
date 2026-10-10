"""Bounded local replays; unique container names are delegated to run_proxy.py."""
import argparse,json,os,signal,subprocess,sys,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--cohort',choices=['official','local'],required=True);parser.add_argument('--workers',type=int,default=3);args=parser.parse_args()
    apps=json.loads((ROOT/'results/calibration-app-provenance-v3.json').read_text())
    pending=[(name,app) for name,app in apps.items() if app['cohort']==args.cohort]
    active={};failed=False
    try:
        while pending or active:
            while pending and len(active)<args.workers:
                name,app=pending.pop(0);out=ROOT/'results'/f'v3-{name}-proxy.json'
                if out.exists():raise RuntimeError('Refusing to overwrite '+str(out))
                log=out.with_suffix('.driver.log').open('w')
                process=subprocess.Popen([sys.executable,str(ROOT/'run_proxy.py'),str(ROOT/app['copy']),app['task'],'--out',str(out),'--keep-work'],cwd=ROOT,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
                active[name]=(process,log,out);print('started',name,'runner PID',process.pid,flush=True)
            completed=[name for name,(process,_,_) in active.items() if process.poll() is not None]
            for name in completed:
                process,log,out=active.pop(name);log.close()
                report=json.loads(out.read_text()) if out.exists() else {}
                if process.returncode not in [0,1] or report.get('infrastructure_error') or report.get('total')!=30:
                    print('STOP: runner/install infrastructure failure',name,report.get('infrastructure_error'),flush=True);failed=True;return 2
                print('completed',name,report['passed'],'/ 30',report['wall_seconds'],'seconds',flush=True)
                subprocess.run([sys.executable,str(ROOT/'scripts/report_real_calibration_v3.py')],cwd=ROOT,check=True)
            if not completed:time.sleep(.25)
        return 0
    finally:
        # Only process groups started by this batch are signalled. Each runner's
        # finally block removes its own uniquely named container and scratch app.
        for process,log,out in active.values():
            if process.poll() is None:os.killpg(process.pid,signal.SIGINT)
        for process,log,out in active.values():
            try:process.wait(timeout=30)
            except subprocess.TimeoutExpired:os.killpg(process.pid,signal.SIGTERM)
            log.close()

if __name__=='__main__':raise SystemExit(main())
