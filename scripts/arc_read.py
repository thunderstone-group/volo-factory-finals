"""Read-only CLI calls with bounded retries and retained, redacted diagnostics."""
import json
import os
import re
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

READ_COMMANDS = {'balance', 'runs', 'tasks', 'models'}


def redact(text, secrets=()):
    if isinstance(text, bytes):
        text = text.decode('utf-8', errors='replace')
    text = str(text or '')
    for secret in sorted((s for s in secrets if s), key=len, reverse=True):
        text = text.replace(secret, '[REDACTED]')
    text = re.sub(r'(?i)(Bearer\s+)\S+', r'\1[REDACTED]', text)
    text = re.sub(r'(?i)((?:api[_-]?key|access[_-]?key|(?:access|refresh|auth|session)[_-]?token|token|cookie|password|secret)[\"\x27]?\s*[:=]\s*[\"\x27]?)[^\"\x27\s,}]+', r'\1[REDACTED]', text)
    return text[:16000]


def read_json(cli, args, log_path, *, secrets=(), attempts=3, timeout=35):
    if not args or args[0] not in READ_COMMANDS:
        raise ValueError('Only allowlisted read-only calls may be retried')
    if not 1 <= attempts <= 3:
        raise ValueError('Read-only retries must be between 1 and 3')
    path = Path(log_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    last = None
    for attempt in range(1, attempts + 1):
        start = time.monotonic()
        entry = {'timestamp': datetime.now(timezone.utc).isoformat(), 'command': list(args),
                 'attempt': attempt, 'timeout_seconds': timeout, 'exit_code': None}
        data = None
        try:
            result = subprocess.run([*cli, *args], capture_output=True, text=True, timeout=timeout)
            entry.update(exit_code=result.returncode, stdout=redact(result.stdout, secrets),
                         stderr=redact(result.stderr, secrets),
                         stdout_truncated=len(result.stdout) > 16000,
                         stderr_truncated=len(result.stderr) > 16000)
            if result.returncode:
                entry['error_type'] = 'ProcessExit'
            else:
                data = json.loads(result.stdout)
                if not isinstance(data, (dict, list)):
                    raise ValueError('Expected a JSON object or list')
                entry['status'] = 'ok'
        except subprocess.TimeoutExpired as exc:
            entry.update(error_type='TimeoutExpired', stdout=redact(exc.stdout, secrets),
                         stderr=redact(exc.stderr, secrets))
        except (OSError, ValueError) as exc:
            entry.update(error_type=type(exc).__name__, error=redact(str(exc), secrets))
        entry['elapsed_seconds'] = round(time.monotonic() - start, 3)
        # Open before returning even on success; callers must have a durable receipt.
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_APPEND | os.O_NOFOLLOW, 0o600)
        with os.fdopen(fd, 'a') as handle:
            os.fchmod(handle.fileno(), 0o600)
            handle.write(json.dumps(entry, ensure_ascii=False) + '\n')
        if entry.get('status') == 'ok':
            return data
        last = entry
        if attempt < attempts:
            time.sleep(2)
    raise RuntimeError(f"ARC read failed: {args[0]}; {last['error_type']}; "
                       f"exit={last['exit_code']}; diagnostics={path}")
