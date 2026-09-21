"""Fetch a detached relay request by resumable chunks; never restart its inference."""
import base64
import fcntl
import uuid
import hashlib
import json
from pathlib import Path
import shlex
import subprocess
import time

from experiment_recovery import atomic_json

LAUNCH='''import json,os,pathlib,subprocess,sys,fcntl,hashlib
os.umask(0o077)
p=json.load(sys.stdin);root=pathlib.Path(p.pop("directory"));root.mkdir(mode=0o700,exist_ok=True)
lock=(root/"launch.lock").open("a+");fcntl.flock(lock,fcntl.LOCK_EX)
marker=root/"launch.json"
if marker.exists():
 print(marker.read_text(),flush=True);sys.exit(0)
(root/"worker.py").write_text(p.pop("worker_source"))
marker.write_text(json.dumps({"directory":str(root),"state":"reserved"}))
log=(root/"worker.log").open("w")
proc=subprocess.Popen([sys.executable,str(root/"worker.py")],stdin=subprocess.PIPE,stdout=log,stderr=log,start_new_session=True)
proc.stdin.write(json.dumps(p).encode());proc.stdin.close()
marker.write_text(json.dumps({"directory":str(root),"pid":proc.pid,"state":"started"}))
print(marker.read_text(),flush=True)
'''

class RemoteResponse:
    def __init__(self,request,key,out,observed,route,http_version,expected_hash=None):
        self.out=Path(out);self.observed=observed;self.key=key;self.stream=None;self.job=None;self.started=time.time()
        self.host='hk-zyl';self.control='/tmp/arc-mini-ssh-'+hashlib.sha256(str(Path(__file__).resolve().parents[2]).encode()).hexdigest()[:12];body=request.data or b'';sha=hashlib.sha256(body).hexdigest()
        if expected_hash and sha!=expected_hash:raise ValueError('request bytes differ; nothing sent')
        observed.update(request_sha256=sha,route='detached HTTPS on hk-zyl')
        (self.out/'request.json').write_bytes(body);(self.out/'request.json').chmod(0o600)
        try:
            job_file=self.out/'remote-job.json'
            if job_file.exists():
                self.job=json.loads(job_file.read_text())
            else:
                self.job={'directory':'/tmp/arc-mini-transport-'+uuid.uuid4().hex,'state':'not_launched'}
                atomic_json(job_file,self.job)
            if self.job.get('state')=='not_launched':
                payload={'worker_source':Path(__file__).with_name('remote_worker.py').read_text(),'key':key,'body':base64.b64encode(body).decode(),'url':request.full_url,'method':request.get_method(),'directory':self.job['directory']}
                self.job=json.loads(self.ssh(LAUNCH,stdin=json.dumps(payload),timeout=45))
                atomic_json(job_file,self.job)
            if not self.job['directory'].startswith('/tmp/arc-mini-transport-'):raise ValueError('unexpected relay directory')
            directory=self.job['directory'];deadline=time.time()+1380;errors=0
            while time.time()<deadline:
                code='import json; from pathlib import Path; p=Path('+repr(directory)+'); f=p/"done.json"; raw=p/"provider.sse"; print(f.read_text() if f.exists() else json.dumps({"pending":True,"received_bytes":raw.stat().st_size if raw.exists() else 0}))'
                try:status=json.loads(self.ssh(code,timeout=30));errors=0
                except (RuntimeError,subprocess.TimeoutExpired,json.JSONDecodeError):
                    errors+=1
                    if errors>=5:raise RuntimeError('relay status unavailable; preserved job must be recovered, never reissued')
                    time.sleep(2);continue
                if not status.get('pending'):break
                atomic_json(self.out/'remote-progress.json',{**status,'elapsed_seconds':round(time.time()-self.started,3)})
                time.sleep(3)
            else:raise RuntimeError('relay deadline; inspect preserved remote job')
            observed.update(status)
            if status['request_sha256']!=sha:raise ValueError('relay request hash mismatch')
            raw=self.out/'provider.sse';offset=0
            with raw.open('wb') as stream:
                raw.chmod(0o600)
                while offset<status['bytes']:
                    size=min(262144,status['bytes']-offset)
                    code='import base64,json; f=open('+repr(directory+'/provider.sse')+',"rb"); f.seek('+str(offset)+'); b=f.read('+str(size)+'); print(json.dumps({"data":base64.b64encode(b).decode(),"bytes":len(b)}))'
                    for attempt in range(4):
                        try:
                            chunk=json.loads(self.ssh(code,timeout=45));data=base64.b64decode(chunk['data'])
                            if len(data)!=size:raise ValueError('short relay chunk')
                            break
                        except (RuntimeError,subprocess.TimeoutExpired,json.JSONDecodeError,ValueError):
                            if attempt==3:raise
                    stream.write(data);offset+=len(data)
                    atomic_json(self.out/'transfer.json',{'received_bytes':offset,'expected_bytes':status['bytes'],'remote_inference_not_repeated':True})
            if hashlib.sha256(raw.read_bytes()).hexdigest()!=status['sha256']:raise ValueError('relay response hash mismatch')
            try:
                err=self.ssh('from pathlib import Path; print((Path('+repr(directory)+')/"curl.stderr").read_text())',timeout=30)
                (self.out/'curl.stderr').write_text(err.replace(key,'[REDACTED]'))
                self.ssh('import shutil; shutil.rmtree('+repr(directory)+',ignore_errors=True)',timeout=30)
                observed['remote_cleanup_complete']=True
            except (RuntimeError,subprocess.TimeoutExpired) as cleanup_error:
                observed['remote_cleanup_complete']=False
                observed['cleanup_error']=str(cleanup_error).replace(key,'[REDACTED]')
            self.stream=raw.open('rb')
        except BaseException as e:
            observed.update(bridge_error=str(e).replace(key,'[REDACTED]'),remote_job=self.job)
            raise
        finally:observed['bridge_elapsed_seconds']=round(time.time()-self.started,3)

    def ssh(self,code,stdin=None,timeout=30):
        # One ephemeral authenticated master per worktree avoids bursts of SSH logins.
        # Commands are idempotent: launcher reserves a fixed job id before inference.
        with open(self.control+'.lock','a+') as lock:
            fcntl.flock(lock,fcntl.LOCK_EX)
            for attempt in range(3):
                try:
                    r=subprocess.run(['ssh','-S',self.control,'-o','ControlMaster=auto','-o','ControlPersist=60','-o','ServerAliveInterval=15','-o','ServerAliveCountMax=2','-o','BatchMode=yes','-o','ConnectTimeout=12',self.host,'python3 -c '+shlex.quote(code)],input=stdin,text=True,capture_output=True,timeout=timeout)
                    if r.returncode==0:return r.stdout
                    error='relay SSH failed: '+r.stderr.replace(self.key,'[REDACTED]')[-500:]
                except subprocess.TimeoutExpired:
                    error='relay SSH command timed out'
                if attempt<2:time.sleep(2)
            raise RuntimeError(error)
    def __enter__(self):return self
    def __exit__(self,*args):
        if self.stream:self.stream.close()
    def __iter__(self):
        for line in self.stream:
            self.observed['lines']+=1
            if line.startswith(b'data:'):
                self.observed['sse_events']+=1;chunk=line[5:].strip()
                if chunk==b'[DONE]':self.observed['saw_done']=True
                else:
                    try:
                        value=json.loads(chunk);self.observed['request_id']=value.get('id',self.observed.get('request_id'));self.observed['response_model']=value.get('model',self.observed.get('response_model'))
                        for c in value.get('choices') or []:
                            d=c.get('delta') or {};self.observed['reasoning_chars']+=len(d.get('reasoning_content') or '');self.observed['content_chars']+=len(d.get('content') or '')
                    except ValueError:pass
            yield line
