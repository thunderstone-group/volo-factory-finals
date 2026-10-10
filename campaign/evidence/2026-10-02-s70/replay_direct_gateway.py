"""Local transport control: preserve TLS hostname and request bytes, bind curl to en0.

This diagnostic is not shipped in the agent. Credentials travel on curl's stdin,
never its command line. The normal agent parses the captured SSE unchanged.
"""
import contextlib
import hashlib
import json
import os
from pathlib import Path
import runpy
import subprocess
import sys
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit

ROOT = Path('~/projects/volo-factory')
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
from oneshot import main as adapter

PUBLIC_IP = '189.1.235.72'  # Public DNS answer independently verified before this control.
LABEL = Path(sys.argv[sys.argv.index('--out') + 1]).name
records = []
base_budget = adapter.CallBudget

class SingleAttemptBudget(base_budget):
    def __init__(self, *args, **kwargs):
        kwargs['fail_limit'] = 1
        super().__init__(*args, **kwargs)
        self.progress_path = HERE / (LABEL + '-progress.json')

@contextlib.contextmanager
def direct_open(req, timeout):
    if records:
        raise RuntimeError('The diagnostic permits only one actual model request')
    url = urlsplit(req.full_url)
    if url.scheme != 'https' or url.hostname != 'api.arc-bench.com' or url.port not in (None, 443):
        raise ValueError('Unexpected model origin')
    record = {'interface': 'en0', 'resolved_ip': PUBLIC_IP,
              'request_sha256': hashlib.sha256(req.data).hexdigest(),
              'request_bytes': len(req.data)}
    records.append(record)
    with tempfile.TemporaryDirectory(prefix='arc-direct-stream-') as td:
        body, result = Path(td) / 'request.json', Path(td) / 'response.sse'
        body.write_bytes(req.data)
        body.chmod(0o600)
        result.touch(mode=0o600)
        config = ''.join('header = ' + json.dumps(k + ': ' + v) + '\n'
                         for k, v in req.header_items())
        command = ['curl', '--silent', '--show-error', '--http1.1', '--no-buffer',
                   '--interface', 'en0', '--resolve', 'api.arc-bench.com:443:' + PUBLIC_IP,
                   '--connect-timeout', '20', '--max-time', str(timeout),
                   '--request', 'POST', '--config', '-', '--data-binary', '@' + str(body),
                   '--output', str(result), '--write-out', '%{http_code}', req.full_url]
        started = time.monotonic()
        run = subprocess.run(command, input=config.encode(), capture_output=True)
        status = int(run.stdout.strip()) if run.stdout.strip().isdigit() else 0
        record.update(http_status=status, curl_exit=run.returncode,
                      seconds=round(time.monotonic()-started, 3), received_bytes=result.stat().st_size)
        (HERE / (LABEL + '-transport.json')).write_text(json.dumps(records, indent=2) + '\n')
        if status >= 400:
            raise HTTPError(req.full_url, status, 'model HTTP failure', None, None)
        with result.open('rb') as stream:
            yield stream
        if run.returncode:
            raise URLError('curl transport failed with exit ' + str(run.returncode))

adapter.CallBudget = SingleAttemptBudget
adapter._open_model = direct_open
os.environ['FALLBACK_MODEL'] = ''
os.environ['ONESHOT_REPAIR_CALLS'] = '1'
runpy.run_path(str(ROOT / 'scripts/repair_replay.py'), run_name='__main__')
