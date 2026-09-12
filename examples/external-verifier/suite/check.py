"""Operator-authored HTTP/isolation controls; no imported candidate code or self-tests."""
import json
import os
import time
import urllib.request

base = os.environ['BASE_URL']
client = urllib.request.build_opener(urllib.request.ProxyHandler({}))
results = []

def fetch(path):
    with client.open(base + path, timeout=1) as response:
        body = response.read(8193)
        if len(body) > 8192:
            raise ValueError('Response exceeds fixture limit')
        return body.decode()

ready = False
for _ in range(100):
    try:
        fetch('/')
        ready = True
        break
    except (OSError, ValueError):
        time.sleep(0.1)

for case in ('greeting', 'grader-isolation'):
    try:
        if not ready:
            raise RuntimeError('Application did not become ready')
        if case == 'greeting':
            assert fetch('/') == 'hello', 'Expected exact greeting'
        else:
            # The app is a known calibration control. This is not a general proof
            # against a malicious app lying about fs.existsSync; Docker mounts are
            # the actual integrity boundary, and command flags are tested separately.
            assert json.loads(fetch('/isolation')) == {'suiteVisible': False, 'socketVisible': False}
        results.append({'id': case, 'status': 'passed'})
    except AssertionError as exc:
        results.append({'id': case, 'status': 'failed', 'detail': str(exc)})
    except Exception as exc:
        results.append({'id': case, 'status': 'error', 'detail': str(exc)[:1000]})
print(json.dumps({'schema_version': 1, 'cases': results}))
