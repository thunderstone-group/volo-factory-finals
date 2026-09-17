"""Local Docker isolation for a fixed build/start/health contract, never behavior scoring.

No pull/install, host ports, host-execution fallback or evaluator inputs. The
controller uses a different UID from application code and reads real exit/HTTP data.
"""
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import shutil
import tempfile
import time
import uuid

from oneshot import main as baseline
from oneshot.minimal_feedback import _process, identity, redact

SOURCE = 'runtime:isolated-node-build-health/v1.1'
PROBE = Path(__file__).with_name('runtime_probe.cjs')
APP_UID, CHECK_UID = '10001:10001', '20002:20002'
CLEAN = ['/usr/bin/env', '-i', 'PATH=/usr/local/bin:/usr/bin:/bin', 'HOME=/tmp', 'TMPDIR=/tmp',
         'PORT=3301', 'npm_config_audit=false', 'npm_config_fund=false', 'npm_config_update_notifier=false']
TEXT_TYPES = {'.js', '.cjs', '.mjs', '.json', '.html', '.css', '.ts', '.jsx', '.tsx'}


def source_files(blobs):
    return {n:b for n,b in blobs.items() if n.startswith(('frontend/','backend/'))}


def editable_files(blobs):
    result = set()
    for name, content in source_files(blobs).items():
        if Path(name).suffix in TEXT_TYPES and not any(p.lower() in ('checks','tests','test','__tests__') for p in Path(name).parts) and not re.search(r'\.(?:test|spec)\.', name):
            try: content.decode('utf-8')
            except UnicodeDecodeError: continue
            result.add(name)
    return result


def process_status(result):
    """Docker/controller failures never become product-repair instructions."""
    text = result.get('output','')
    if result.get('reason') in ('spawn_error','capture_error') or result.get('exit_code') == 125 or re.search(
            r'(?im)^(?:Error response from daemon:|Cannot connect to the Docker daemon|OCI runtime exec failed|Error: No such container|error during connect:)',text):
        return 'environment_error'
    code = result.get('exit_code')
    if result.get('reason') or code is None or code < 0 or code in (137,143):
        return 'unknown'
    return 'pass' if code == 0 else 'product_fail'


class DockerRuntime:
    def __init__(self, image, *, seconds=60):
        if not re.fullmatch(r'(?:sha256:[0-9a-f]{64}|[^\s]+@sha256:[0-9a-f]{64})', image):
            raise ValueError('Use an explicitly selected immutable local image ID/digest')
        if not 5 <= seconds <= 300:
            raise ValueError('Runtime deadline must be 5..300 seconds')
        self.image, self.seconds = image, seconds
        self.docker = shutil.which('docker')
        self.prefix = [self.docker] if self.docker else []
        self.env = {'PATH':os.defpath,'HOME':str(Path.home()),'LANG':'C','NO_COLOR':'1'}
        self.environment = None

    def command(self, args, timeout=10):
        return _process(self.prefix + args, Path.cwd(), timeout, env=self.env)

    def preflight(self):
        if not self.docker:
            return {'status':'environment_error','reason':'docker_unavailable'}
        context = self.command(['context','show'])
        if context['exit_code'] != 0 or context.get('reason'):
            return {'status':'environment_error','reason':'docker_context_unavailable','diagnostic':context}
        name = context['output'].strip()
        endpoint = self.command(['context','inspect',name,'--format','{{json .Endpoints.docker.Host}}'])
        try: local = json.loads(endpoint['output']).startswith('unix://')
        except (ValueError,AttributeError): local = False
        if not local:
            return {'status':'environment_error','reason':'local_docker_context_required','diagnostic':endpoint}
        self.prefix = [self.docker,'--context',name]
        inspected = self.command(['image','inspect',self.image])
        try:
            info = json.loads(inspected['output'])[0]
            if inspected.get('reason') or inspected['exit_code'] != 0 or not info['Id'].startswith('sha256:'):
                raise ValueError('Image unavailable')
        except (ValueError,KeyError,IndexError,TypeError):
            return {'status':'environment_error','reason':'docker_or_local_image_unavailable','diagnostic':inspected}
        self.image = info['Id']
        self.environment = {'image_id':self.image,'repo_digests':info.get('RepoDigests',[]),
                            'architecture':info.get('Architecture'),'docker_context':name,
                            'network':'none','app_uid':APP_UID,'verifier_uid':CHECK_UID}
        return {'status':'pass',**self.environment}

    def create_args(self, name, source):
        return ['create','--pull=never','--name',name,'--label','volo.minimal.runtime=v1',
                '--label','volo.minimal.instance='+name,
                '--network=none','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges',
                '--memory=2g','--memory-swap=2g','--cpus=1','--pids-limit=96',
                '--user',CHECK_UID,'--init','--log-driver=none','--no-healthcheck','--workdir','/tmp',
                '--tmpfs','/opt/arc:ro,nosuid,nodev,size=4096,mode=000',
                '--tmpfs','/work:rw,nosuid,nodev,size=268435456,mode=0755,uid=10001,gid=10001',
                '--tmpfs','/tmp:rw,nosuid,nodev,size=67108864,mode=1777',
                '--mount',f'type=bind,src={source},dst=/input,readonly',
                '--mount',f'type=bind,src={PROBE.resolve()},dst=/verifier.cjs,readonly',
                '--entrypoint',CLEAN[0],self.image,*CLEAN[1:],'node','-e','setInterval(()=>{},1000)']

    def check(self, app):
        report = {'source':SOURCE,'status':'unknown','scope':'build_start_health_home',
                  'checks':[],'behavior':'unknown','verified_requirements':[],'cleanup_verified':False}
        try: blobs = baseline.read_template(app)
        except (OSError,ValueError) as exc:
            return {**report,'reason':'unsafe_or_missing_input','error':str(exc)}
        report['candidate_source_sha256'] = identity(blobs)
        preflight = self.preflight()
        report['environment'] = preflight
        if preflight['status'] != 'pass':
            return {**report,'status':'environment_error','reason':preflight['reason']}
        name = 'volo-minimal-' + uuid.uuid4().hex
        report['container_name'] = name
        start = time.monotonic(); deadline = start + self.seconds
        server = None; pool = concurrent.futures.ThreadPoolExecutor(max_workers=1)
        def row(identifier, status, **extra):
            value = {'id':identifier,'status':status,'source':SOURCE,**extra}
            report['checks'].append(value); return value
        def execute(argv, cwd='/work', uid=APP_UID, limit=20):
            return self.command(['exec','--user',uid,'--workdir',cwd,name,*CLEAN,*argv],
                                max(.01,min(limit,deadline-time.monotonic())))
        def probe(mode):
            result = execute(['node','/verifier.cjs',mode],uid=CHECK_UID,limit=3)
            try: data = json.loads(result['output'])
            except ValueError: data = {'error':'invalid_probe_response'}
            return result,data
        def result_status(result):
            return process_status(result)
        with tempfile.TemporaryDirectory(prefix='minimal-runtime-input-') as temp:
            source = Path(temp)/'source'; source.mkdir(mode=0o755); source.chmod(0o755)
            for n,b in source_files(blobs).items():
                target = source/n; target.parent.mkdir(parents=True,exist_ok=True,mode=0o755)
                target.write_bytes(b); target.chmod(0o644)
            for directory in source.rglob('*'):
                if directory.is_dir(): directory.chmod(0o755)
            try:
                for phase,args in [('container_create',self.create_args(name,source)),('container_start',['start',name])]:
                    r=self.command(args)
                    if r.get('reason') or r['exit_code'] != 0:
                        row(phase,'environment_error',diagnostic=r); return report
                r,data=probe('versions')
                if r.get('reason') or r['exit_code'] != 0 or not data.get('node') or not data.get('npm'):
                    row('tools','environment_error',diagnostic=r); return report
                report['environment'].update(data)
                copied=execute(['node','/verifier.cjs','copy'])
                if copied['exit_code'] != 0 or copied.get('reason'):
                    row('snapshot','environment_error',diagnostic=copied); return report
                needed=baseline.missing_required(source)
                if needed:
                    row('delivery','product_fail',errors=needed); return report
                row('delivery','pass')
                for n in sorted(source_files(blobs)):
                    if Path(n).suffix not in ('.js','.cjs','.mjs'): continue
                    r=execute(['node','--check','/work/'+n]); status=result_status(r)
                    if status=='product_fail' and not re.search(r'^SyntaxError:',r['output'],re.M): status='unknown'
                    row('syntax:'+n,status,path=n,diagnostic=r)
                    if status!='pass': return report
                build=execute(['npm','run','build'],cwd='/work/frontend',limit=25)
                if result_status(build)!='pass':
                    row('build',result_status(build),diagnostic=build);return report
                r,built=probe('built')
                if r.get('reason'):
                    row('build','unknown',diagnostic=r); return report
                if r['exit_code']!=0:
                    row('build','product_fail',diagnostic=r); return report
                row('build','pass',artifact=built)
                command=shlex.split(json.loads(blobs['backend/package.json'])['scripts']['start'])
                server=pool.submit(execute,command,'/work/backend',APP_UID,self.seconds)
                last=None; ready_until=min(deadline,time.monotonic()+10)
                while time.monotonic()<ready_until:
                    if server.done():
                        crashed=server.result(); status=result_status(crashed)
                        row('start','product_fail' if status=='pass' else status,diagnostic=crashed);return report
                    r,health=probe('health');last=(r,health)
                    if r['exit_code']==0 and not r.get('reason') and 'http_status' in health:
                        row('start','pass')
                        ok=health['http_status']==200 and health.get('json')=={'code':200,'message':'Backend Ready'}
                        row('health','pass' if ok else 'product_fail',response=health)
                        if not ok:return report
                        break
                    time.sleep(.1)
                else:
                    row('health','unknown',reason='health_deadline',diagnostic=last);return report
                r,home=probe('home')
                if r['exit_code']!=0 or r.get('reason'):
                    row('home','unknown',diagnostic=r);return report
                readable=home.get('http_status')==200 and home.get('bytes',0)>0 and 'text/html' in home.get('content_type','').lower()
                if not readable:
                    row('home','product_fail',response=home)
                elif home.get('sha256')!=built.get('sha256'):
                    # SSR/bootstrap injection can legitimately change served HTML.
                    # A hash mismatch alone is not actionable product-failure evidence.
                    row('home','unknown',reason='served_home_differs_from_build',response=home)
                else:
                    row('home','pass',response=home)
            except (OSError,ValueError,KeyError,TypeError) as exc:
                row('controller','environment_error',error=redact(str(exc)))
            finally:
                if not any(r['id'] in ('container_create','container_start') for r in report['checks']):
                    r,data=probe('integrity')
                    row('source_integrity','pass' if r['exit_code']==0 and not r.get('reason') and data.get('changed')==[] else 'unknown',diagnostic=data)
                own=self.command(['inspect',name,'--format','{{json .Config.Labels}}'])
                try: owned=json.loads(own['output']).get('volo.minimal.instance')==name
                except (ValueError,AttributeError): owned=False
                removed=self.command(['rm','-f',name]) if owned else own
                remaining=self.command(['ps','-aq','--filter','name=^/'+name+'$'])
                report['cleanup_verified']=remaining['exit_code']==0 and not remaining.get('reason') and not remaining['output'].strip()
                if not report['cleanup_verified']:row('cleanup','environment_error',diagnostic=removed)
                pool.shutdown(wait=True)
                if server is not None:report['server_exit']=server.result()
                report['elapsed_seconds']=round(time.monotonic()-start,3)
                statuses={r['status'] for r in report['checks']}
                report['status']=next((s for s in ('environment_error','unknown','product_fail') if s in statuses),'pass')
                required={'delivery','build','start','health','home','source_integrity'}
                report['required_checks']=sorted(required|{'syntax:'+n for n in source_files(blobs) if Path(n).suffix in ('.js','.cjs','.mjs')})
                if report['status']=='pass' and not set(report['required_checks']) <= {r['id'] for r in report['checks'] if r['status']=='pass'}:
                    report.update(status='unknown',reason='missing_required_evidence')
        return report
