"""Run a packaged agent on a finals-proxy evolution task the way the platform does, then judge it.

Main-session tool (the proxy is hidden from executors). Layout per run, under runs/<task>-<label>/:
  agent/        the unzipped package (byte-identical to the upload)
  source/       requirements given on the command line (requirements.yaml + empty prerequisites.md)
  workspace/    output-dir: the starting application + requirements/ + .arc/stdout.log the agent's output is
                appended to while it runs (the platform does this; the in-place publish must survive it)
  record.json   exit code, seconds, package hash, proxy and regression results
"""
import argparse, hashlib, json, os, shutil, subprocess, sys, time, zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROXY = Path('~/projects/arcbench-campaign/finals-proxy')
BASES = {'github': Path('~/projects/arcbench-campaign/evidence/2026-10-02-s70/v7-official-github-79/application'),
         'sheet': Path('~/projects/arcbench-campaign/evidence/2026-10-02-s70/v7-official-sheet-87/application')}
REAL = Path('~/projects/arcbench-campaign/evidence/2026-10-06-finals/finals-open/req')
VENV = Path('~/projects/volo-factory/.venv/bin/python')


def gateway_key():
    for line in Path('~/.config/arcbench/volo.env').expanduser().read_text().splitlines():
        name, _, value = line.partition('=')
        if name.strip() == 'ARC_BENCH_API_KEY':
            return value.strip().strip('\'"')
    raise SystemExit('no ARC_BENCH_API_KEY')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('task', choices=sorted(BASES) + [k + s for k in sorted(BASES) for s in ('-prose', '-real')])
    ap.add_argument('package', type=Path)
    ap.add_argument('label')
    ap.add_argument('--direct', action='store_true', help='bypass the local proxy via the curl adapter')
    ap.add_argument('--judge-only', action='store_true')
    ap.add_argument('--env', action='append', default=[], help='KEY=VALUE for the agent (e.g. ONESHOT_REGRESSION_GUARD=1)')
    a = ap.parse_args()
    run = HERE / 'runs' / f'{a.task}-{a.label}'
    ws = run / 'workspace'
    record = {'task': a.task, 'label': a.label, 'package_sha256': hashlib.sha256(a.package.read_bytes()).hexdigest()}
    if not a.judge_only:
        run.mkdir(parents=True, exist_ok=False)
        with zipfile.ZipFile(a.package) as z:
            z.extractall(run / 'agent')
        req = PROXY / a.task / 'requirements' / 'requirements.yaml'
        if a.task.endswith('-real'):  # the published finals requirements, with their reference images
            req = REAL / ('hackathon-evolution--' + a.task.split('-')[0]) / 'requirements.yaml'
        (run / 'source').mkdir()
        shutil.copy(req, run / 'source' / 'requirements.yaml')
        if (req.parent / 'reference').is_dir():
            shutil.copytree(req.parent / 'reference', run / 'source' / 'reference')
        (run / 'source' / 'prerequisites.md').write_text('')
        shutil.copytree(BASES[a.task.split('-')[0]], ws, ignore=shutil.ignore_patterns('node_modules', 'dist'))
        shutil.copytree(run / 'source', ws / 'requirements')
        (ws / '.arc').mkdir()
        log = ws / '.arc' / 'stdout.log'
        env = {k: v for k, v in os.environ.items() if not k.startswith('ONESHOT_')}
        env.update(OPENAI_API_KEY=REDACTED OPENAI_BASE_URL='https://api.arc-bench.com/v1',
                   MODEL='deepseek-v4-flash-vision-exp')
        env.pop('FALLBACK_MODEL', None)
        env.update(dict(item.split('=', 1) for item in a.env))
        record['agent_env'] = a.env
        tmp = Path('/tmp')
        env['NODE_PATH'] = os.pathsep.join(str(tmp / n / 'node_modules')
                                           for n in ['oneshot-playwright-test-1.57.0', 'oneshot-jsdom'])
        cmd = ([sys.executable, str(HERE / 'run_agent_direct_gateway.py'), str(run / 'agent')] if a.direct
               else [str(VENV), str(run / 'agent' / 'main.py')])
        cmd += [str(run / 'source'), '--output-dir', str(ws)]
        started = time.monotonic()
        with log.open('a') as out:
            proc = subprocess.run(cmd, env=env, cwd=run, stdout=out, stderr=subprocess.STDOUT)
        record.update(exit=proc.returncode, seconds=round(time.monotonic() - started, 1))
        shutil.copy(log, run / 'agent-output.log')
    for kind, script in (('proxy', 'run_proxy.py'), ('regression', 'run_regression.py')):
        report = PROXY / 'results' / 'local' / f'{a.task}-{a.label}-{kind}.json'
        report.parent.mkdir(parents=True, exist_ok=True)
        task = a.task if kind == 'proxy' else a.task.split('-')[0]
        r = subprocess.run([sys.executable, str(PROXY / script), str(ws), task, '--out', str(report)],
                           capture_output=True, text=True)
        record[kind] = {'exit': r.returncode, 'tail': (r.stdout + r.stderr)[-1500:], 'report': str(report)}
        if report.exists():
            shutil.copy(report, run / f'{kind}.json')
    (run / 'record.json').write_text(json.dumps(record, indent=2))
    print(json.dumps({k: v for k, v in record.items() if k not in ('proxy', 'regression')}))


if __name__ == '__main__':
    main()
