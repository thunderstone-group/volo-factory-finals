"""Deterministic, opt-in preservation of the supplied application's visible named surface.

This observes accessibility, not functional correctness. No model calls or test generation.
The two-pass baseline is immutable; missing items and unavailable observations are separate.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import tempfile
import threading
import time

try:
    from . import scenario_check, scenarios
except ImportError:
    import scenario_check
    import scenarios

PROBE = Path(__file__).with_name('regression_probe.cjs')
MAX_SCREENS = 60
DEPTH = 3
SECONDS = 80


def path_key(steps):
    return json.dumps([(s['role'], s['name']) for s in steps], ensure_ascii=False)


def item_id(steps, item):
    text = path_key(steps) + json.dumps([item['role'], item['name']], ensure_ascii=False)
    return 'existing:' + hashlib.sha256(text.encode()).hexdigest()[:20]


def stable(first, second):
    """Intersection only: a path and its item must actually be observed in both passes."""
    other = {path_key(s['steps']): s for s in second.get('screens', []) if s['status'] == 'ok'}
    screens = []
    for screen in first.get('screens', []):
        peer = other.get(path_key(screen['steps']))
        if screen['status'] != 'ok' or peer is None:
            continue
        names = {(i['role'], i['name']) for i in peer['items']}
        items = [dict(i, id=item_id(screen['steps'], i)) for i in screen['items'] if (i['role'], i['name']) in names]
        if items:
            screens.append({**screen, 'items': items})
    return {'screens': screens, 'items': sum(len(s['items']) for s in screens),
            'passes': [first, second], 'unavailable': first.get('unavailable') or second.get('unavailable')}


def _texts(record):
    if isinstance(record, dict):
        return ' '.join(_texts(v) for k, v in record.items() if k not in ('children', 'dependencies', 'original_requirement_id'))
    if isinstance(record, list):
        return ' '.join(_texts(v) for v in record)
    return str(record or '')


def exemptions(requirements):
    """Only CHANGE records, or explicit rename/remove declarations. Never waive an entire app."""
    try:
        document = scenarios.load_yaml(requirements or '')
    except ValueError:
        # A malformed requirement is uncertainty, not permission to fight a change described in it.
        return [(None, re.sub(r'\s+', ' ', requirements or '').casefold())]
    found = []
    def walk(record):
        if isinstance(record, list):
            for child in record:
                walk(child)
            return
        if not isinstance(record, dict):
            return
        text = re.sub(r'\s+', ' ', _texts(record)).casefold()
        if str(record.get('change_type', '')).upper() == 'CHANGE' or re.search(r'\b(renam\w*|remov\w*|replac\w*)\b', text):
            found.append((record.get('id'), text))
        for child in record.get('children') or []:
            walk(child)
        if 'requirements' in record:
            walk(record['requirements'])
    walk(document)
    return found


def exemption(item, steps, changes):
    # A renamed navigation entry makes its old path inapplicable too; do not invent a screen-wide regression.
    for name in [item['name']] + item.get('scopes', []) + [s['name'] for s in steps]:
        name = re.sub(r'\s+', ' ', name).casefold()
        for rid, text in changes:
            if name and re.search(r'(?<!\w)' + re.escape(name) + r'(?!\w)', text):
                return {'requirement': rid, 'mentioned_name': name}
    return None


def same_name(a, b):
    # Casing and whitespace are presentation, never evidence that a feature vanished.
    return re.sub(r'\s+', ' ', a).strip().casefold() == re.sub(r'\s+', ' ', b).strip().casefold()


def compatible_role(before, after):
    return (before == after or before in ('link', 'button') and after in ('link', 'button') or
            before in ('heading', 'listitem') and after in ('link', 'button'))


def replacement_exemption(item, current, requirements, changes):
    quoted = {re.sub(r'\s+', ' ', s).casefold() for s in re.findall(r'["`“]([^"`”\n]+)["`”]', requirements or '')}
    words = lambda s: set(re.findall(r'\w+', s.casefold()))
    for peer in current:
        if (item['role'] in ('button', 'radio') and peer['role'] == 'combobox' and
                peer['name'].casefold() in quoted and any(same_name(item['name'], c) for c in peer.get('choices', []))):
            return {'reason': 'choice retained in requirement-named selector', 'selector': peer['name']}
        numeric = item['role'] in ('slider', 'spinbutton', 'textbox') and peer['role'] in ('slider', 'spinbutton', 'textbox')
        if not compatible_role(item['role'], peer['role']) and not numeric:
            continue
        same_target = item.get('href') and item.get('href') == peer.get('href')
        # Only a current label explicitly demanded by the requirements can explain a rename. A shared
        # destination, or overlapping full words in a CHANGE record, supplies the identity evidence.
        old_words, new_words = words(item['name']), words(peer['name'])
        related = (old_words <= new_words or new_words <= old_words) and any(len(w) >= 4 for w in old_words & new_words)
        if numeric and old_words and new_words:
            related = all(any(a == b or min(len(a), len(b)) >= 3 and (a.startswith(b) or b.startswith(a))
                              for b in new_words) for a in old_words) and bool(old_words & new_words)
        if peer['name'].casefold() in quoted and (same_target or related):
            return {'reason': 'requirements name the replacement', 'replacement': peer['name'],
                    'same_destination': bool(same_target)}
    # Date labels are stable within one run but cease to be comparable when a CHANGE explicitly changes
    # the calendar clock/date. This is intentionally narrow: ordinary numbered records remain protected.
    date_label = re.fullmatch(r'(?:\d{4}[-/]\d{1,2}[-/]\d{1,2}|(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*[, ]+.*|'
                             r'(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w* \d{1,2}(?:\D.*)?)', item['name'], re.I)
    if date_label:
        for rid, text in changes:
            if re.search(r'\b(calendar|clock|today|timezone)\b', text) and re.search(r'\b(date|day|time)\b', text):
                return {'requirement': rid, 'reason': 'explicit calendar/date change'}
    return None


def compare(baseline, observed, requirements=''):
    current = {path_key(s['steps']): s for s in observed.get('screens', [])}
    changes = exemptions(requirements)
    relocations = [r for s in observed.get('screens', []) for r in s.get('relocations', [])]
    kept, missing, unknown, waived = [], [], [], []
    for screen in baseline.get('screens', []):
        peer = current.get(path_key(screen['steps']))
        items = (peer or {}).get('items', [])
        for item in screen['items']:
            entry = {**item, 'steps': screen['steps'], 'url': screen.get('url')}
            present = any(compatible_role(item['role'], p['role']) and same_name(item['name'], p['name']) for p in items)
            # A link to the page already open offers no additional destination when its title remains visible.
            if item['role'] == 'link' and item.get('href') == screen.get('url'):
                present |= any(same_name(item['name'], p['name']) for p in items)
            why = exemption(item, screen['steps'], changes)
            if not why and not present:
                why = replacement_exemption(item, items, requirements, changes)
            if not why and not present:
                for renamed in (peer or {}).get('renamed_steps', []):
                    old, new = renamed['before'], renamed['after']
                    if same_name(item['name'], old['name']) and any(same_name(p['name'], new['name']) and
                            compatible_role(item['role'], p['role']) for p in items):
                        why = replacement_exemption(dict(item, href=old.get('href')),
                                                    [dict(new, role=item['role'])], requirements, changes)
                        if why:
                            break
            if not why and not present and item.get('href'):
                for relocation in relocations:
                    old, via = relocation['before'], relocation['via']
                    if (old.get('href') == item['href'] and same_name(old['name'], item['name']) and
                            any(n['name'] == via['name'] for n in (peer or {}).get('navigation', [])) and
                            exemption(via, [], changes)):
                        why = {'reason': 'observed inside requirement-changed navigation', 'via': via['name'],
                               **exemption(via, [], changes)}
                        break
            if why:
                waived.append({**entry, 'exemption': why})
            elif observed.get('unavailable') or peer is None or peer['status'] == 'unobserved':
                unknown.append(entry)
            elif present:
                kept.append(entry['id'])
            else:
                path = ' / '.join(f"{s['role']} {s['name']!r}" for s in screen['steps']) or 'open /'
                entry['observation'] = (f"{item['role']} {item['name']!r} reached by {path} was present before the "
                                        'upgrade and is now missing; restore it unless a requirement changes it')
                if peer.get('failed_step'):
                    entry['failed_step'] = peer['failed_step']
                missing.append(entry)
    return {'kept': kept, 'missing': missing, 'unknown': unknown, 'exempted': waived,
            'observation': observed}


RUNTIME_LOCK = threading.Lock()
RUNNER_IMAGE_MODULES = '/opt/arcbench/node_modules'  # the evaluator image's own @playwright/test install


def _ensure_runtime(env):
    """Make `playwright` and its Chromium available the way main.py's browser probe does (10-06: on the platform the
    baseline ran beside the draft, before anything had installed Playwright, and every observation was unavailable).
    Returns None when ready, else the reason."""
    node, npm = shutil.which('node', path=env.get('PATH')), shutil.which('npm', path=env.get('PATH'))
    if not node:
        return 'node is not on PATH'

    def check(script, timeout):
        try:
            return subprocess.run([node, '-e', script], env=env, capture_output=True, text=True,
                                  timeout=timeout).returncode == 0
        except (OSError, subprocess.TimeoutExpired):
            return False

    module = "require.resolve('playwright')"
    browser = "require('playwright').chromium.launch({timeout: 20000}).then(b => b.close()).catch(() => process.exit(1))"
    with RUNTIME_LOCK:
        if not check(module, 30):
            if not npm:
                return 'Playwright runtime is not installed and npm is unavailable'
            try:
                subprocess.run([npm, 'install', '--prefix', str(scenario_check.PLAYWRIGHT_PREFIX), 'playwright@1.57.0',
                                '--no-audit', '--no-fund', '--silent'], env=env, capture_output=True, timeout=180)
            except (OSError, subprocess.TimeoutExpired):
                pass
            if not check(module, 30):
                return 'Playwright runtime could not be installed'
        if not check(browser, 60):
            try:
                subprocess.run([node, '-e', "process.argv=['node','cli','install','chromium','--only-shell'];"
                                "require(require('path').join(require('path').dirname("
                                "require.resolve('playwright/package.json')),'cli.js'))"],
                               env=env, capture_output=True, timeout=300)
            except (OSError, subprocess.TimeoutExpired):
                pass
            if not check(browser, 60):
                return 'Chromium could not be started'
    return None


def observe(app, paths=None, *, passes=1, work_parent=None):
    """Build an isolated copy once, reset the backend between passes; install Playwright only when it is missing."""
    started = time.monotonic()
    if work_parent is not None:
        work_parent = Path(work_parent).resolve()
    results, backend = [], None
    try:
        with tempfile.TemporaryDirectory(prefix='regression-', dir=work_parent) as temp:
            work = Path(temp)
            (work / 'tmp').mkdir()
            env = scenario_check._child_env(work / 'tmp')
            paths_env = [env.get('NODE_PATH', ''), str(scenario_check.PLAYWRIGHT_PREFIX / 'node_modules'),
                         RUNNER_IMAGE_MODULES]
            global_root = scenario_check._npm_global_root(env)
            if global_root:
                paths_env.append(global_root)
            env['NODE_PATH'] = os.pathsep.join(filter(None, paths_env))
            if 'PLAYWRIGHT_BROWSERS_PATH' in os.environ:
                env['PLAYWRIGHT_BROWSERS_PATH'] = os.environ['PLAYWRIGHT_BROWSERS_PATH']
            missing = _ensure_runtime(env)
            if missing:
                return {'unavailable': missing, 'screens': [], 'seconds': round(time.monotonic() - started, 3)}
            workspace = scenario_check.Workspace(app, work, env)
            for _ in range(passes):
                remaining = SECONDS - (time.monotonic() - started)
                if remaining < 2:
                    results.append({'unavailable': 'observation budget exhausted', 'screens': []})
                    break
                backend = scenario_check.Backend(workspace.root, env, work / 'backend.log')
                try:
                    port = scenario_check._free_port()
                    backend.start(port)
                    ready, why = backend.wait_ready(port, seconds=min(10, remaining))
                    if not ready:
                        raise scenario_check.AppError(why)
                    remaining = max(1, SECONDS - (time.monotonic() - started))
                    payload = {'base': f'http://127.0.0.1:{port}', 'paths': paths, 'max_screens': MAX_SCREENS,
                               'depth': DEPTH, 'seconds': max(1, remaining / (passes - len(results)) - 2)}
                    proc = subprocess.Popen([shutil.which('node', path=env.get('PATH')) or 'node', str(PROBE)],
                                            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                            text=True, env=env, cwd=work, start_new_session=True)
                    try:
                        stdout, _ = proc.communicate(json.dumps(payload), timeout=remaining)
                    finally:
                        if proc.poll() is None:
                            below = scenario_check._descendants(proc.pid)
                            os.killpg(proc.pid, signal.SIGKILL)
                            for pid in below:
                                try:
                                    os.kill(pid, signal.SIGKILL)
                                except ProcessLookupError:
                                    pass
                            proc.communicate()
                    result = json.loads(stdout)
                    results.append(result)
                    if paths is None:
                        paths = [s['steps'] for s in result.get('screens', []) if s['status'] == 'ok']
                finally:
                    backend.stop()
                    backend = None
                workspace.restore()
    except Exception as exc:
        results.append({'unavailable': f'{type(exc).__name__}: {str(exc)[:300]}', 'screens': []})
    result = stable(results[0], results[1]) if passes == 2 and len(results) == 2 else results[-1]
    result['seconds'] = round(time.monotonic() - started, 3)
    return result


class Guard:
    """Own an immutable copy before draft writes; baseline observation overlaps the model stream."""
    def __init__(self, app, work, requirements):
        self.requirements, self.baseline, self.history = requirements, None, []
        self.work = Path(work)
        self.work.mkdir()
        self.source = self.work / 'starting-app'
        self.source.mkdir()
        for part in ('frontend', 'backend'):
            scenario_check.Workspace._copy(Path(app) / part, self.source / part)
        for entry in Path(app).iterdir():
            if entry.is_file() and not entry.is_symlink() and entry.stat().st_size < 5_000_000:
                shutil.copy2(entry, self.source / entry.name)
        self.thread = threading.Thread(target=self._baseline, name='oneshot-regression', daemon=True)
        self.thread.start()

    def _baseline(self):
        try:
            self.baseline = observe(self.source, passes=2, work_parent=self.work)
        except Exception as exc:
            self.baseline = {'screens': [], 'unavailable': f'{type(exc).__name__}: {str(exc)[:300]}'}

    def finish(self):
        self.thread.join()
        return self.baseline

    def check(self, app):
        baseline = self.finish()
        observed = (observe(app, [s['steps'] for s in baseline.get('screens', [])], work_parent=self.work)
                    if baseline.get('screens') else {'unavailable': baseline.get('unavailable') or 'empty stable inventory'})
        result = compare(baseline, observed, self.requirements)
        self.history.append(result)
        return result

    def trace(self):
        return {'baseline': self.finish(), 'observations': self.history}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--app', required=True, type=Path)
    parser.add_argument('--baseline', type=Path)
    parser.add_argument('--requirements', type=Path)
    parser.add_argument('--out', required=True, type=Path)
    args = parser.parse_args()
    if args.baseline:
        baseline = json.loads(args.baseline.read_text())
        result = compare(baseline, observe(args.app, [s['steps'] for s in baseline['screens']]),
                         args.requirements.read_text() if args.requirements else '')
    else:
        result = observe(args.app, passes=2)
    args.out.write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n')
    print(json.dumps({k: (len(result[k]) if isinstance(result[k], list) else result[k])
                      for k in ('items', 'screens', 'seconds', 'missing', 'unknown', 'exempted', 'unavailable') if k in result}))


if __name__ == '__main__':
    main()
