"""Run the two fixed independent judges once each local generation exits."""
import datetime
import json
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
PYTHON = '~/projects/volo-factory/.venv/bin/python'
pending = {'vision-sheet-1': 'judge_generated.py', 'vision-github-1': 'judge_github.py'}
if len(sys.argv) > 1:
    pending = {}
    for name in sys.argv[1:]:
        task = json.loads((HERE / name / 'process.json').read_text())['task']
        pending[name] = 'judge_github.py' if task == 'github' else 'judge_generated.py'
deadline = time.monotonic() + 5 * 3600
while pending and time.monotonic() < deadline:
    for name, script in list(pending.items()):
        finished = HERE / name / 'finished.json'
        if not finished.exists():
            continue
        record = {'app': name, 'generation': json.loads(finished.read_text()),
                  'observed_at': datetime.datetime.now().astimezone().isoformat()}
        if not (HERE / name / 'application').is_dir():
            record['judges'] = 'not run: no final application'
        else:
            run = subprocess.run([PYTHON, str(HERE / script), name], capture_output=True, text=True)
            record.update(judge_exit_code=run.returncode, stdout=run.stdout, stderr=run.stderr[-2000:])
        (HERE / name / 'independent-validation.json').write_text(json.dumps(record, indent=2))
        print(json.dumps(record), flush=True)
        del pending[name]
    if pending:
        time.sleep(15)
if pending:
    raise SystemExit('Local generation deadline reached; pending: ' + ', '.join(pending))
