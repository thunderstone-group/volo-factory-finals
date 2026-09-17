#!/usr/bin/env python3
"""Opt-in DeepSeek low-effort generation; preserve V2 prompts and platform publishing."""
from contextlib import contextmanager
import hashlib
import json
import sys
from urllib import request
try:
    import platform_entry as platform
except ModuleNotFoundError:
    from oneshot import platform_entry as platform


@contextmanager
def low_effort_generation(core):
    original = core._open_model
    def open_request(req, timeout):
        body = json.loads(req.data)
        if not isinstance(body, dict) or not str(body.get('model', '')).lower().startswith('deepseek'):
            raise ValueError('low-effort candidate requires an explicit DeepSeek model')
        if body.get('stream') is not True:
            raise ValueError('generation policy is restricted to the streaming generator')
        body['thinking'] = {'type': 'enabled'}
        body['reasoning_effort'] = 'low'
        raw = json.dumps(body).encode('utf-8')
        amended = request.Request(req.full_url, data=raw, headers=dict(req.header_items()), method=req.get_method())
        print('[minimal] generation_control ' + json.dumps({
            'thinking': 'enabled', 'reasoning_effort': 'low',
            'max_tokens': body.get('max_tokens'), 'request_sha256': hashlib.sha256(raw).hexdigest()}),
            file=sys.stderr, flush=True)
        return original(amended, timeout=timeout)
    core._open_model = open_request
    try:
        yield
    finally:
        core._open_model = original


def main(argv=None):
    with low_effort_generation(platform.implementation.core):
        return platform.main(argv)


if __name__ == '__main__':
    raise SystemExit(main())
