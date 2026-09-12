"""Thin, opt-in Pi invocation preparation; no implicit provider or user config.

Preparing an invocation does not execute it. Real model-backed execution needs an
OS sandbox, a gateway budget, and a pre-registered experiment. The offline probe
uses only a local scripted server and fixed safe tool arguments.
"""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

TESTED_PI_VERSION = '0.83.0'


@dataclass
class Invocation:
    argv: list[str]
    env: dict[str, str]
    cwd: Path
    version: str


def prepare_pi(workspace: Path, home: Path, *, gateway: str, model: str,
               api_key: str, executable='pi', expected_version=TESTED_PI_VERSION):
    """Create only fresh private configuration, pinning version and provider.

No API key in argv or on disk. This is configuration hygiene, not protection from
Pi's own tool processes. The caller must sandbox real, model-authored tools.
"""
    parsed = urlparse(gateway)
    local = parsed.scheme == 'http' and parsed.hostname in ('127.0.0.1', '::1')
    official = parsed.scheme == 'https' and parsed.hostname == 'api.arc-bench.com' and parsed.port in (None, 443)
    if (not (local or official) or parsed.username or parsed.password or parsed.query or parsed.fragment
            or parsed.path.rstrip('/') != '/v1'):
        raise ValueError('Gateway must be the organizer HTTPS endpoint or a numeric loopback /v1 fixture')
    if not isinstance(model, str) or not re.fullmatch(r'[A-Za-z0-9_.-]{1,100}', model):
        raise ValueError('Use an exact, non-ambiguous model ID')
    if not isinstance(api_key, str) or not api_key or '\n' in api_key or '\0' in api_key:
        raise ValueError('A valid explicitly supplied key is required')
    workspace, home = workspace.resolve(strict=True), home.resolve()
    if home.exists() or home.is_relative_to(workspace) or workspace.is_relative_to(home):
        raise ValueError('Use a fresh config home outside the candidate workspace')
    binary = shutil.which(executable)
    if not binary:
        raise RuntimeError('Install the explicitly chosen Pi release first; no automatic installation')
    home.mkdir(parents=True, mode=0o700)
    config = home / 'agent'; config.mkdir(mode=0o700)
    env = {'PATH': os.environ.get('PATH', '/usr/local/bin:/usr/bin:/bin'),
           'HOME': str(home), 'PI_CODING_AGENT_DIR': str(config),
           'PI_CODING_AGENT_SESSION_DIR': str(home / 'sessions'),
           'CI': '1', 'NO_COLOR': '1', 'TERM': 'dumb', 'SHELL': '/bin/sh',
           'HARNESS_MODEL_KEY': api_key}
    version = subprocess.run([binary, '--version'], capture_output=True, text=True,
                             timeout=10, env=env, cwd=workspace, check=True).stdout.strip()
    if version != expected_version:
        raise RuntimeError(f'Pi version mismatch: expected {expected_version}, observed {version}')
    settings = {'compaction': {'enabled': False}, 'retry': {'enabled': False,
                'provider': {'maxRetries': 0, 'timeoutMs': 15000}},
                'defaultProjectTrust': 'never'}
    models = {'providers': {'arcbench': {'baseUrl': gateway.rstrip('/'),
              'api': 'openai-completions', 'apiKey': '$HARNESS_MODEL_KEY', 'authHeader': True,
              'compat': {'supportsDeveloperRole': False, 'supportsReasoningEffort': False,
                         'maxTokensField': 'max_tokens'},
              'models': [{'id': model, 'name': model, 'reasoning': False, 'input': ['text'],
                          'contextWindow': 32768, 'maxTokens': 2048}]}}}
    for name, value in [('settings.json', settings), ('models.json', models)]:
        path = config / name
        with path.open('x') as stream:
            os.chmod(path, 0o600)
            json.dump(value, stream)
    argv = [binary, '--print', '--mode', 'json', '--no-session', '--no-approve',
            '--no-context-files', '--no-extensions', '--no-skills', '--no-prompt-templates',
            '--no-themes', '--provider', 'arcbench', '--model', model, '--thinking', 'off',
            '--tools', 'read,write,edit,bash,grep,find,ls']
    return Invocation(argv, env, workspace, version)


def summarize_events(events):
    """Count terminal assistant messages once, never streaming deltas or agent_end copies."""
    messages = [event['message'] for event in events if event.get('type') == 'message_end'
                and isinstance(event.get('message'), dict) and event['message'].get('role') == 'assistant']
    usage = [message.get('usage') for message in messages]
    totals = [item.get('totalTokens') for item in usage if isinstance(item, dict)]
    known = len(totals) == len(messages) and bool(messages) and all(type(n) is int and n >= 0 for n in totals)
    return {'assistant_responses': len(messages),
            'reported_total_tokens': sum(totals) if known else None,
            'billed_cost': None,
            'tool_events': [{'tool': e.get('toolName'), 'error': e.get('isError')} for e in events
                            if e.get('type') == 'tool_execution_end'],
            'agent_ended': any(e.get('type') == 'agent_end' for e in events),
            'official_evaluation': 'not_run'}
