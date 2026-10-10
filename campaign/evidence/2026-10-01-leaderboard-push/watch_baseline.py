"""Read-only watcher using the existing ARC CLI client; never uploads, starts, retries, or cancels a run."""
import datetime
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, '~/projects/arcbench-cli/src')
from arcbench_cli.client import OfficialClient, SubmitConfig, load_env, summarize_run

HERE = Path(__file__).resolve().parent
IDS = {'49930bdb20c3', '06836d4c5363'}
cfg = SubmitConfig.from_env(load_env(Path('~/.config/arcbench/volo.env')))
cfg.timeout = 20
client = OfficialClient(cfg)
previous = None
for _ in range(720):
    try:
        rows = [summarize_run(r) for r in client.list_runs(limit=100) if r.get('id') in IDS]
        observed = {'at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'runs': rows}
        temporary = HERE / 'baseline-latest.tmp'
        temporary.write_text(json.dumps(observed, ensure_ascii=False, indent=2))
        temporary.replace(HERE / 'baseline-latest.json')
        signature = json.dumps(rows, sort_keys=True)
        if signature != previous:
            with (HERE / 'baseline-watch.jsonl').open('a') as log:
                log.write(json.dumps(observed, ensure_ascii=False) + '\n')
            print(json.dumps(observed, ensure_ascii=False), flush=True)
            previous = signature
        if len(rows) == 2 and all(r.get('status') not in ['RUNNING', 'PENDING', 'QUEUED'] for r in rows):
            (HERE / 'baseline-finished.json').write_text(json.dumps(observed, ensure_ascii=False, indent=2))
            break
    except Exception as exc:
        print(json.dumps({'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),
                          'read_error': type(exc).__name__ + ': ' + str(exc)[:200]}), flush=True)
    time.sleep(30)
else:
    raise SystemExit('Watcher deadline reached; remote runs were left unchanged.')
