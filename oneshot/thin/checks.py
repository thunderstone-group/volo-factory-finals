"""Deterministic source checks. Node parses code but never runs the application."""
import json
import os
from html.parser import HTMLParser
from pathlib import Path
import shutil
import tempfile
import time
from urllib.parse import urlsplit, unquote
from oneshot import main as core
from oneshot import skill_repair as sr
from oneshot.business_feedback import source_id
from oneshot.minimal_feedback import _process


class Scripts(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.scripts = []
        self.current = None

    def handle_starttag(self, tag, attrs):
        if tag.lower() == 'script':
            self.current = {'attrs': dict(attrs), 'text': ''}

    def handle_data(self, text):
        if self.current is not None:
            self.current['text'] += text

    def handle_endtag(self, tag):
        if tag.lower() == 'script' and self.current is not None:
            self.scripts.append(self.current)
            self.current = None


def check(app, *, node=None, seconds=60):
    """Return per-check evidence; pass covers delivery/syntax, not behavior."""
    app = Path(app)
    original = source_id(app)
    result = {'schema': 'thin-static/v1', 'source_sha256': original,
              'status': 'unknown', 'checks': [], 'runtime_executed': False,
              'browser_executed': False, 'verified_requirements': []}
    rows = result['checks']
    def row(identifier, status, detail=''):
        rows.append({'id': identifier, 'status': status, 'detail': detail[:4096]})
    try:
        blobs = core.read_template(app)
        needed = core.missing_required(app)
        row('delivery', 'product_fail' if needed else 'pass', '; '.join(needed))
        executable = node or shutil.which('node')
        if not executable:
            row('node', 'environment_error', 'Node syntax parser is unavailable')
            return result
        executable = str(Path(executable).resolve())
        with tempfile.TemporaryDirectory(prefix='thin-parse-') as temporary:
            root = Path(temporary).resolve()
            for name, data in blobs.items():
                path = root/name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(data)
            targets = [(name, root/name) for name in sorted(blobs)
                       if Path(name).suffix in ('.js', '.cjs', '.mjs')]
            for name, data in sorted(blobs.items()):
                if Path(name).suffix not in ('.html', '.htm'):
                    continue
                parser = Scripts()
                parser.feed(data.decode('utf-8'))
                for i, script in enumerate(parser.scripts):
                    attributes = script['attrs']
                    kind = (attributes.get('type') or '').strip().lower()
                    if kind not in ('', 'module', 'text/javascript', 'application/javascript'):
                        continue
                    if attributes.get('src'):
                        url = urlsplit(attributes['src'])
                        if url.scheme or url.netloc or url.path.startswith('/api/'):
                            continue  # Remote/dynamic assets are not fetched or claimed checked.
                        resource = unquote(url.path)
                        candidates = ([root/'frontend/public'/resource.lstrip('/'), root/'frontend'/resource.lstrip('/')]
                                      if resource.startswith('/') else [(root/name).parent/resource])
                        present = any(p.resolve().is_relative_to(root) and p.is_file() for p in candidates)
                        row('script-ref:'+name+':'+str(i), 'pass' if present else 'product_fail', resource)
                    elif script['text'].strip():
                        suffix = '.mjs' if kind == 'module' else '.cjs'
                        path = root/('inline-'+str(len(targets))+suffix)
                        path.write_text(script['text'])
                        targets.append((name+'#inline-'+str(i), path))
            deadline = time.monotonic()+seconds
            for name, path in targets:
                remaining = deadline-time.monotonic()
                if remaining <= 0:
                    row('syntax:'+name, 'unknown', 'Static check wall budget exhausted')
                    break
                process = _process([executable, '--check', str(path)], root, min(10, remaining),
                                   env={'PATH': os.defpath, 'HOME': str(root), 'LANG': 'C'}, max_log=4096)
                if process.get('reason'):
                    status = 'environment_error' if process['reason'] == 'spawn_error' else 'unknown'
                elif process['exit_code'] == 0:
                    status = 'pass'
                else:
                    status = 'product_fail' if 'SyntaxError' in process['output'] else 'unknown'
                row('syntax:'+name, status, process['output'].replace(str(root), '<source>'))
    except (OSError, ValueError, UnicodeError) as exc:
        row('checker', 'environment_error', type(exc).__name__)
    finally:
        result['status'] = next((s for s in ('environment_error', 'unknown', 'product_fail')
                                 if any(r['status'] == s for r in rows)), 'pass')
        result['integrity_verified'] = source_id(app) == original
        if not result['integrity_verified']:
            result['status'] = 'environment_error'
    return result


def nonregressing(before, after):
    """Never trade a known pass for failure/unknown or accept incomplete syntax."""
    if not after.get('integrity_verified') or after.get('status') != 'pass':
        return False
    protected = {r['id'] for r in before['checks'] if r['status'] == 'pass'}
    passed = {r['id'] for r in after['checks'] if r['status'] == 'pass'}
    return protected <= passed
