#!/usr/bin/env python3
"""Local packaged-agent mechanics measurement; no platform client or platform API.

Inputs are copied, never modified. All artifacts, temporary files and npm caches live in --work.
The wrapper only records draft/check artifacts and meters the unchanged gateway transport. Unknown
usage consumes the full reservation. Stop before a call that could exceed the shared CNY limit.
"""
import argparse
import collections
import contextlib
import fcntl
import hashlib
import importlib
import json
import os
from pathlib import Path
import re
import shlex
import shutil
import sys
import threading
import time
import uuid
from urllib import request
from urllib.parse import urlparse
import zipfile


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


class Ledger:
    def __init__(self, path, limit):
        self.path, self.limit = path, limit
        self.lock = threading.Lock()

    def update(self, callback):
        with self.lock, self.path.open('a+') as stream:
            fcntl.flock(stream, fcntl.LOCK_EX)
            stream.seek(0)
            value = json.loads(stream.read() or '{"calls": []}')
            value['limit_cny'] = self.limit
            result = callback(value)
            stream.seek(0)
            stream.truncate()
            json.dump(value, stream, ensure_ascii=False, indent=2)
            stream.flush()
            return result

    def reserve(self, payload, run):
        # UTF-8 bytes bound text token count conservatively; add framing overhead per message.
        # Prices: CNY 1/M uncached input, 0.02/M cache input, 4/M output (repository gateway catalogue).
        if payload['model'] != 'deepseek-v4-flash-vision-exp':
            raise RuntimeError('measurement permits only the authorized model')
        prompt_bound = len(json.dumps(payload['messages'], ensure_ascii=False).encode()) + 1024
        maximum = (prompt_bound + payload['max_tokens'] * 4) / 1e6
        ident = uuid.uuid4().hex
        def reserve(value):
            committed = sum(c.get('cost_cny', c['reserved_cny']) for c in value['calls'])
            if committed + maximum > self.limit:
                raise RuntimeError('measurement budget exhausted before gateway request')
            value['calls'].append({'id': ident, 'run': run, 'reserved_cny': maximum,
                                   'request_sha256': hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest(),
                                   'status': 'reserved'})
        self.update(reserve)
        return ident

    def finish(self, ident, usage, sent=True):
        def settle(value):
            item = next(c for c in value['calls'] if c['id'] == ident)
            if usage and all(isinstance(usage.get(k), int) for k in ('prompt_tokens', 'completion_tokens')):
                hit = (usage.get('prompt_tokens_details') or {}).get('cached_tokens',
                       usage.get('prompt_cache_hit_tokens', 0)) or 0
                hit = min(usage['prompt_tokens'], hit)
                item.update(usage=usage, cost_cny=((usage['prompt_tokens'] - hit) + hit * .02 +
                                                  usage['completion_tokens'] * 4) / 1e6, status='reported_usage')
            elif not sent:
                item.update(cost_cny=0, status='not_sent')
            else:
                item.update(cost_cny=item['reserved_cny'], status='unknown_usage_full_reservation')
        self.update(settle)


def preservation(before, after):
    """Multiset of exact nonblank lines per source file; measures retained text, not retained behavior."""
    rows = []
    function = re.compile(r'\bfunction\s+([A-Za-z_$][\w$]*)\s*\(')
    for name, original in sorted(before.items()):
        if Path(name).suffix not in ('.js', '.cjs', '.mjs', '.html', '.css'):
            continue
        try:
            old, new = original.decode('utf-8'), after.get(name, b'').decode('utf-8')
        except UnicodeDecodeError:
            continue
        lines = collections.Counter(x for x in old.splitlines() if x.strip())
        current = collections.Counter(x for x in new.splitlines() if x.strip())
        names = set(function.findall(old))
        kept = names & set(function.findall(new))
        rows.append({'path': name, 'source_lines': sum(lines.values()), 'retained_lines': sum((lines & current).values()),
                     'named_functions': len(names), 'retained_functions': len(kept),
                     'lost_functions': sorted(names - kept)})
    total = {key: sum(r[key] for r in rows) for key in ('source_lines', 'retained_lines',
                                                      'named_functions', 'retained_functions')}
    return total | {'line_retention': total['retained_lines'] / max(1, total['source_lines']), 'files': rows}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--package', type=Path, required=True)
    parser.add_argument('--base', type=Path, required=True)
    parser.add_argument('--requirements', type=Path, required=True)
    parser.add_argument('--work', type=Path, required=True)
    parser.add_argument('--ledger', type=Path, required=True)
    parser.add_argument('--budget-cny', type=float, default=15)
    parser.add_argument('--flag', choices=('0', '1'), required=True)
    parser.add_argument('--env-file', type=Path, required=True)
    args = parser.parse_args()
    args.work = args.work.resolve()
    if Path.cwd().resolve() not in args.work.parents or Path.cwd().resolve() not in args.ledger.resolve().parents:
        raise ValueError('measurement output must be inside the current worktree')
    args.work.mkdir(parents=True, exist_ok=False)
    # Parse only the requested credential; no source/echo and no credential in argv, artifacts or logs.
    key = None
    for line in args.env_file.read_text().splitlines():
        match = re.match(r'\s*(?:export\s+)?ARC_BENCH_API_KEY\s*=\s*(.*)', line)
        if match:
            key = shlex.split(match[1])[0]
    if not key:
        raise ValueError('practice credential is unavailable')
    os.environ.update(OPENAI_API_KEY=key, OPENAI_BASE_URL='https://api.arc-bench.com/v1',
                      MODEL='deepseek-v4-flash-vision-exp', FALLBACK_MODEL='', ONESHOT_UPGRADE_PATCH=args.flag,
                      PYTHONDONTWRITEBYTECODE='1')
    package = args.work / 'package'
    with zipfile.ZipFile(args.package) as archive:
        archive.extractall(package)
    out = args.work / 'application'
    shutil.copytree(args.base, out, ignore=shutil.ignore_patterns('node_modules', 'dist', '.arc', 'requirements'))
    shutil.copytree(args.requirements, out / 'requirements')
    sys.path.insert(0, str(package))
    agent = importlib.import_module('main')
    before = agent.read_template(out)
    manifest = {'package_sha256': hashlib.sha256(args.package.read_bytes()).hexdigest(),
                'flag': args.flag, 'model': os.environ['MODEL'], 'base': str(args.base),
                'requirements': str(args.requirements),
                'requirements_sha256': hashlib.sha256((out/'requirements/requirements.yaml').read_bytes()).hexdigest(),
                'base_hashes': {n: hashlib.sha256(b).hexdigest() for n, b in before.items()},
                'repair_cny_limit': os.environ.get('ONESHOT_REPAIR_CNY', '10'),
                'draft_call_limit': os.environ.get('ONESHOT_DRAFT_CALLS', '4')}
    write_json(args.work / 'inputs.json', manifest)
    ledger = Ledger(args.ledger, args.budget_cny)
    original_open = request.OpenerDirector.open

    class Metered:
        def __init__(self, response, ident):
            self.response, self.ident, self.usage = response, ident, None

        def __enter__(self):
            self.response.__enter__()
            return self

        def __exit__(self, *exc):
            try:
                return self.response.__exit__(*exc)
            finally:
                ledger.finish(self.ident, self.usage)

        def __iter__(self):
            for line in self.response:
                if line.startswith(b'data:'):
                    try:
                        event = json.loads(line[5:])
                        if isinstance(event.get('usage'), dict):
                            self.usage = event['usage']
                    except (ValueError, AttributeError):
                        pass
                yield line

        def __getattr__(self, name):
            return getattr(self.response, name)

    def open_metered(opener, req, *pos, **kw):
        url = req.full_url if isinstance(req, request.Request) else req
        if urlparse(url).hostname in ('localhost', '127.0.0.1', '::1'):
            return original_open(opener, req, *pos, **kw)
        if url != 'https://api.arc-bench.com/v1/chat/completions':
            raise RuntimeError('only the authorized gateway completion endpoint is allowed')
        ident = ledger.reserve(json.loads(req.data), args.work.name)
        try:
            return Metered(original_open(opener, req, *pos, **kw), ident)
        except Exception:
            ledger.finish(ident, None)  # conservatively reserve even a transport failure
            raise

    # Covers the scenario translator's separate urllib transport as well as the normal agent/test writer.
    request.OpenerDirector.open = open_metered
    original_draft = agent.draft_application
    original_repair = agent.repair_delivery
    result = {}

    def capture_draft(stage, files, messages, model, base, key, budget, template):
        conversation = original_draft(stage, files, messages, model, base, key, budget, template)
        after = agent.read_template(stage, bounded=False)
        for name, data in after.items():
            target = args.work / 'draft' / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
        calls = [r for r in budget.attempts if r['phase'] in ('draft', 'draft_correction')]
        result['draft'] = {'preservation': preservation(before, after),
                           'completion_tokens': sum(r['usage'].get('completion_tokens', 0) for r in calls),
                           'cost_cny': sum(agent.call_cost(r) for r in calls),
                           'usage_complete': all('completion_tokens' in r['usage'] for r in calls),
                           'calls': len(calls), 'protocol': getattr(budget, 'upgrade_patch', None),
                           'changed_files': sorted(n for n in after if before.get(n) != after[n])}
        if not getattr(budget, 'upgrade_patch', None):
            result['draft']['full_file_blocks'] = sorted({b['path'] for r in calls
                                                         for b in agent.salvage_blocks(r['content'])[0]})
        write_json(args.work / 'draft-measurement.json', result['draft'])
        return conversation

    def capture_repair(*pos, **kw):
        tests = kw.get('tests')
        if tests:
            shutil.copytree(tests, args.work / 'acceptance-tests', dirs_exist_ok=True)
        return original_repair(*pos, **kw)

    agent.draft_application, agent.repair_delivery = capture_draft, capture_repair
    started = time.monotonic()
    with (args.work / 'agent.log').open('w') as log, contextlib.redirect_stdout(log), contextlib.redirect_stderr(log):
        status = agent.main([str(out / 'requirements'), '--output-dir', str(out), '--type', 'web'])
    result.update(exit_code=status, seconds=time.monotonic()-started, inputs=manifest,
                  final_preservation=preservation(before, agent.read_template(out, bounded=False)))
    # Agent logs redact the key already; assert that the measurement artifacts obey that boundary too.
    for line in (args.work / 'agent.log').read_text().splitlines():
        if key in line:
            raise RuntimeError('credential redaction failed')
        for prefix, field in (('[oneshot] usage ', 'usage'), ('[oneshot] smoke ', 'smoke')):
            if line.startswith(prefix):
                result[field] = json.loads(line[len(prefix):])
    write_json(args.work / 'result.json', result)
    print(json.dumps({'run': args.work.name, 'exit_code': status, 'seconds': result['seconds'],
                      'draft_cost_cny': result.get('draft', {}).get('cost_cny'),
                      'total_cost_cny': result.get('usage', {}).get('estimated_cost_cny')}))
    return status


if __name__ == '__main__':
    sys.exit(main())
