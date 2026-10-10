"""Independent candidate generation from the packaged source and official public requirements, with practice credit."""
import concurrent.futures
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import time
import zipfile
from pathlib import Path

ROOT = Path('~/projects/volo-factory-worktrees/source-owners-20261002')
sys.path.insert(0, str(ROOT))
from scripts.repair_replay import gateway_key

HERE = Path(__file__).resolve().parent
PACKAGE = HERE / 'candidate-controls-v3.zip'
REQS = Path('~/projects/arcbench-campaign/evidence/2026-09-24-hackathon-v2/requirements')
PYTHON = '~/projects/volo-factory/.venv/bin/python'


def run(task):
    root = HERE / ('generate-controls-v3-' + task)
    root.mkdir(exist_ok=False)
    agent = root / 'agent'
    with zipfile.ZipFile(PACKAGE) as archive:
        archive.extractall(agent)
    env = dict(os.environ)
    env['OPENAI_API_KEY'] = gateway_key('~/.config/arcbench/volo.env')
    env['MODEL'] = 'deepseek-v4-flash-vision-exp'
    env.pop('FALLBACK_MODEL', None)
    env['OPENAI_BASE_URL'] = 'https://api.arc-bench.com/v1'
    # Use installed, pinned test runtimes; they are not application dependencies.
    cache = Path(tempfile.gettempdir())
    env['NODE_PATH'] = os.pathsep.join(str(cache / x / 'node_modules')
                                      for x in ['oneshot-playwright-test-1.57.0', 'oneshot-jsdom'])
    # Clear old experiment overrides. The ZIP's defaults are the candidate being validated.
    for name in list(env):
        if name.startswith('ONESHOT_'):
            del env[name]
    started = time.monotonic()
    with (root / 'stdout.log').open('w') as out, (root / 'stderr.log').open('w') as err:
        process = subprocess.Popen([PYTHON, str(agent / 'main.py'), str(REQS / ('hackathon--' + task)),
                                    '--output-dir', str(root / 'application')], cwd=root, env=env, stdout=out, stderr=err)
        (root / 'process.json').write_text(json.dumps({'pid': process.pid, 'task': task,
            'package_sha256': hashlib.sha256(PACKAGE.read_bytes()).hexdigest()}))
        result = process.wait()
    record = {'task': task, 'exit': result, 'seconds': round(time.monotonic() - started, 1),
              'package_sha256': hashlib.sha256(PACKAGE.read_bytes()).hexdigest()}
    (root / 'finished.json').write_text(json.dumps(record, indent=2))
    print(json.dumps(record), flush=True)


if __name__ == '__main__':
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        for future in [pool.submit(run, task) for task in ['github', 'sheet']]:
            future.result()
