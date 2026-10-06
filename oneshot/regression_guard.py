"""Deterministic, opt-in preservation of the supplied application's visible named surface.

This observes accessibility, not functional correctness. No model calls or test generation.
The two-pass baseline is immutable; missing items and unavailable observations are separate.
"""
import argparse
from functools import lru_cache
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


# Descriptions define changes. Scenario navigation is context, never a change declaration.
CONTAINERS = {'region', 'dialog', 'form', 'list', 'group', 'toolbar', 'tabpanel', 'navigation',
              'screen', 'page', 'panel', 'section'}
FIELDS = {'textbox', 'searchbox', 'spinbutton', 'slider', 'combobox', 'input', 'field'}
ROLE_PATTERN = (r'link or button|navigation link|navigation control|multiline textbox|'
                r'textbox|searchbox|spinbutton|combobox|checkbox|radio|slider|button|link|heading|'
                r'region|dialog|form|list|group|toolbar|tabpanel|navigation|screen|page|panel|section|input|field')
QUOTE = r'["`“]([^"`”\n]+)["`”]'
RULES = ('explicit_item', 'explicit_container', 'description_contract', 'selector_migration',
         'menu_migration', 'date_basis')


def normal(text):
    return re.sub(r'\s+', ' ', str(text or '')).strip().casefold()


def _sentences(text):
    return [s.strip() for s in re.split(r'(?<=[.!?;])\s+|\n\s*\n', text or '') if s.strip()]


def exemptions(requirements):
    """Keep description and static GIVEN evidence separate; a parse failure cannot authorize changes."""
    try:
        document = scenarios.load_yaml(requirements or '')
    except ValueError:
        return []
    found = []
    def walk(record):
        if isinstance(record, list):
            for child in record:
                walk(child)
        elif isinstance(record, dict):
            description = str(record.get('description') or '')
            given = [str(step.get('content') or '') for scenario in record.get('scenarios') or []
                     if isinstance(scenario, dict) for step in scenario.get('steps') or []
                     if isinstance(step, dict) and str(step.get('keyword', '')).upper() == 'GIVEN']
            if description or given:
                found.append({'id': record.get('id'), 'change': str(record.get('change_type', '')).upper() == 'CHANGE',
                              'description': description, 'sentences': _sentences(description), 'given': given})
            walk(record.get('children'))
            walk(record.get('requirements'))
    walk(document)
    return found


def same_name(a, b):
    return normal(a) == normal(b)


def compatible_role(before, after):
    return (before == after or before in ('link', 'button') and after in ('link', 'button') or
            before in ('heading', 'listitem') and after in ('link', 'button'))


def _role_matches(declared, actual):
    declared = normal(declared)
    if declared in ('navigation link',):
        return actual == 'link'
    if declared in ('link or button', 'navigation control'):
        return actual in ('link', 'button')
    if declared in ('input', 'field'):
        return actual in FIELDS
    if declared == 'multiline textbox':
        return actual == 'textbox'
    if declared in ('screen', 'page', 'panel', 'section'):
        return actual in CONTAINERS | {'heading', 'link', 'button'}
    return declared == actual


def _proof(rule, record, evidence, **details):
    return {'rule': rule, 'requirement': record['id'], 'evidence': evidence.strip(), **details}


def _location(sentence):
    match = re.search(r'\b(?:in|within|on)\s+(?:the\s+)?(' + ROLE_PATTERN +
                      r')\s+(?:named\s+)?' + QUOTE, sentence, re.I)
    return {'role': normal(match.group(1)), 'name': match.group(2)} if match else None


def _at_location(item, steps, location):
    if not location:
        return True
    return (any(same_name(location['name'], n) for n in item.get('scopes', [])) or
            location['role'] in ('screen', 'page') and bool(steps) and same_name(location['name'], steps[-1]['name']))


@lru_cache(maxsize=2048)
def _explicit(sentence, name):
    """Bind the operation to its object/subject. No verb inside a quoted control name, no 'user removes' action."""
    target = r'(?:["`“]' + re.escape(name) + r'["`”]|(?<!\w)' + re.escape(name) + r'(?!\w))'
    role = r'(?P<role>' + ROLE_PATTERN + r')'
    noun = r'(?:the\s+|a\s+|an\s+)?(?:' + role + r'\s+(?:named\s+|called\s+)?)?' + target
    # Imperative UI change, or a declarative change to the named subject. Navigation/actions mentioning the
    # control ("activate Remove filter", "the user removes ...") cannot match either form.
    match = re.match(r'^(?P<op>rename|remove|replace|hide)\s+' + noun + r'(?P<tail>.*)$', sentence, re.I)
    if not match:
        match = re.match(r'^' + noun + r'(?:\s+(?P<post_role>' + ROLE_PATTERN + r'))?\s+(?:is|will be|must be|should be)\s+'
                         r'(?P<op>renamed|removed|replaced|hidden)\b(?P<tail>.*)$', sentence, re.I)
    if not match:
        return None
    op = {'renamed': 'rename', 'removed': 'remove', 'replaced': 'replace', 'hidden': 'hide'}.get(
        match['op'].lower(), match['op'].lower())
    tail = match['tail'].strip()
    declared = match['role'] or match.groupdict().get('post_role')
    if declared is None:
        trailing = re.match(r'^(?:' + ROLE_PATTERN + r')\b', tail, re.I)
        if trailing:
            declared, tail = trailing[0], tail[trailing.end():].strip()
    replacement, replacement_role = None, None
    if op in ('rename', 'replace'):
        replacement = re.match(r'^(?:to|with|by)\s+(?:the\s+|a\s+|an\s+)?'
                               r'(?:(?P<replacement_role>' + ROLE_PATTERN + r')\s+(?:named\s+)?)?' + QUOTE, tail, re.I)
        if replacement:
            replacement_role, replacement = replacement.group('replacement_role'), replacement.group(2)
        else:
            plain = re.match(r'^(?:to|with|by)\s+([^"`“”\n]{1,100})$', tail, re.I)
            if not plain:
                return None
            replacement = re.split(r'\s+(?:in|within|on)\s+(?:the\s+)?(?:' + ROLE_PATTERN + r')\b',
                                   plain.group(1), maxsplit=1, flags=re.I)[0].rstrip(' .;')
    elif tail and not re.match(r'^(?:[.!;]|from\b|in\b|on\b|entirely\b|permanently\b)', tail, re.I):
        return None  # "Remove filters button opens ..." is a control description, not a removal instruction.
    return {'operation': op, 'role': normal(declared) if declared else None, 'replacement': replacement,
            'replacement_role': normal(replacement_role) if replacement_role else None,
            'location': _location(sentence)}


def exemption(item, steps, changes, current=()):
    """Explicit item changes only. Descendants require an explicitly removed/replaced *container*."""
    for record in changes:
        for sentence in record['sentences']:
            change = _explicit(sentence, item['name'])
            if change and (not change['role'] or _role_matches(change['role'], item.get('role'))) and \
                    _at_location(item, steps, change['location']):
                if change['operation'] in ('rename', 'replace') and not any(
                        same_name(p['name'], change['replacement']) and _same_place(item, p) and
                        (_role_matches(change['replacement_role'], p['role']) if change['replacement_role'] else
                         change['operation'] == 'replace' or compatible_role(item.get('role'), p['role'])) for p in current):
                    continue
                return _proof('explicit_item', record, sentence, **change)
            for container in item.get('scopes', []):
                change = _explicit(sentence, container)
                if (change and change['role'] in CONTAINERS and change['operation'] in ('remove', 'replace')
                        and _at_location(item, steps, change['location'])):
                    return _proof('explicit_container', record, sentence, container=container, **change)
            # A navigation predecessor is not a DOM ancestor. Only an explicitly replaced/removed *current*
            # screen can explain its whole inventory; changing a prior entry page cannot erase later screens.
            if steps:
                change = _explicit(sentence, steps[-1]['name'])
                if (change and change['role'] in ('screen', 'page') and change['operation'] in ('remove', 'replace')
                        and _at_location(item, steps, change['location'])):
                    return _proof('explicit_container', record, sentence, container=steps[-1]['name'], **change)
    return None


def _related_names(a, b):
    old, new = set(re.findall(r'\w+', normal(a))), set(re.findall(r'\w+', normal(b)))
    if not old or not new:
        return False
    subset = old <= new or new <= old
    # Expanding an abbreviated field word (min -> minimum) is plausible only with another full shared word.
    prefixes = all(any(x == y or min(len(x), len(y)) >= 3 and (x.startswith(y) or y.startswith(x))
                       for y in new) for x in old)
    return (subset or prefixes) and any(len(w) >= 4 for w in old & new)


def _same_place(item, peer):
    if item.get('href') or peer.get('href'):
        return bool(item.get('href') and item.get('href') == peer.get('href'))
    return _same_scope(item, peer)


def _same_scope(item, peer):
    if [normal(s) for s in item.get('scopes', [])] == [normal(s) for s in peer.get('scopes', [])]:
        return True
    scopes = lambda x: [s for s in x.get('scopes', []) if not same_name(s, x['name'])]
    old, new = scopes(item), scopes(peer)
    return (not old and not new) or bool(old and new and
                                         (same_name(old[-1], new[-1]) or _related_names(old[-1], new[-1])))


def _declaration(record, item):
    """A positive name/role declaration in the description, not an arbitrary mention or scenario step."""
    return _declared_at(record['description'], item['role'], item['name'], tuple(item.get('scopes', [])))


@lru_cache(maxsize=4096)
def _declared_at(description, actual_role, actual_name, scopes):
    name = r'["`“]' + re.escape(actual_name) + r'["`”]'
    role = r'(?P<role>' + ROLE_PATTERN + r')'
    patterns = [role + r'\s+(?:named|labelled|labeled|called)\s+' + name,
                name + r'\s+as\s+(?:a|an)\s+' + role,
                name + r'\s+' + role + r'\b',
                r'(?<!\w)(?:' + name + '|' + re.escape(actual_name) + r')(?!\w)\s+is\s+(?:a|an)\s+' + role]
    for sentence in _sentences(description):
        if not _at_location({'scopes': scopes}, [], _location(sentence)):
            continue
        for pattern in patterns:
            for match in re.finditer(pattern, sentence, re.I):
                if not _role_matches(match['role'], actual_role):
                    continue
                # A described field inside a named form/region must be observed in that form/region too.
                prefix = sentence[:match.start()]
                scope = re.search(r'(?:form|region|dialog|list|group)\s+named\s+' + QUOTE +
                                  r'\s+(?:contains|exposes|has|includes)', prefix, re.I)
                if scope and not any(same_name(scope.group(1), s) for s in scopes):
                    continue
                return sentence
    return None


_DAY = r'(?:Mon(?:day)?|Tue(?:sday)?|Wed(?:nesday)?|Thu(?:rsday)?|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?)'
_MONTH = (r'(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|'
          r'Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)')
DATE_LABEL = re.compile(r'(?:\d{4}[-/]\d{1,2}[-/]\d{1,2}|(?:' + _DAY + r'[, ]+)?' + _MONTH +
                        r'\.? \d{1,2}(?:[, ]+\d{4})?(?:[, ]+' + _DAY + r')?)', re.I)


def replacement_exemption(item, current, requirements, changes, before=()):
    for record in changes:
        for peer in current:
            declaration = _declaration(record, peer)
            if not declaration:
                continue
            if (item['role'] in ('button', 'radio') and peer['role'] == 'combobox' and _same_scope(item, peer) and
                    any(same_name(item['name'], c) for c in peer.get('choices', []))):
                return _proof('selector_migration', record, declaration, selector=peer['name'], choice=item['name'])
            role_change = item['role'] != peer['role'] and same_name(item['name'], peer['name']) and _same_scope(item, peer)
            if not record['change'] or not (_same_place(item, peer) or role_change):
                continue
            # The old action cannot borrow a different, already-existing peer's contract as its replacement.
            if any((compatible_role(p['role'], peer['role']) or p['role'] in FIELDS and peer['role'] in FIELDS)
                   and same_name(p['name'], peer['name']) and _same_scope(p, peer)
                   for p in before):
                continue
            navigation = item['role'] in ('link', 'button') and peer['role'] in ('link', 'button')
            fields = item['role'] in FIELDS and peer['role'] in FIELDS
            landmarks = item['role'] in CONTAINERS | {'heading'} and peer['role'] in CONTAINERS | {'heading'}
            related = _related_names(item['name'], peer['name'])
            identity = item.get('href') and item.get('href') == peer.get('href') and navigation
            if identity or role_change or related and (item['role'] == peer['role'] or fields or landmarks):
                return _proof('description_contract', record, declaration, original=item['name'],
                              replacement=peer['name'], original_role=item['role'], replacement_role=peer['role'],
                              identity='same exposed destination' if identity else 'same screen and scope, related label, new peer')
        if item['role'] not in ('button', 'tab', 'heading') or not DATE_LABEL.fullmatch(item['name']):
            continue
        # An actual new date strip must still exist. A clock rule cannot excuse deleting the entire calendar.
        dates = [p for p in current if p['role'] == item['role'] and DATE_LABEL.fullmatch(p['name']) and _same_place(item, p)]
        if len(dates) < 2:
            continue
        for sentence in record['sentences'] + record['given']:
            if (re.search(r'\b(calendar|clock)\b', sentence, re.I) and
                    re.search(r'\b(fixed|benchmark|independent of (?:the )?machine clock)\b', sentence, re.I) and
                    re.search(r'\b\d{4}-\d{2}-\d{2}\b', sentence)):
                return _proof('date_basis', record, sentence, original=item['name'],
                              replacements=[p['name'] for p in dates])
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
            if item['role'] == 'link' and item.get('href') == screen.get('url'):
                present |= any(same_name(item['name'], p['name']) for p in items)
            # A mentioned item that still exists is kept, not exempted. Only actual losses need a waiver.
            if present:
                kept.append(entry['id'])
                continue
            if observed.get('unavailable') or peer is None or peer['status'] == 'unobserved':
                unknown.append(entry)
                continue
            why = exemption(item, screen['steps'], changes, items)
            if not why:
                why = replacement_exemption(item, items, requirements, changes, screen['items'])
            if not why and item.get('href'):
                for relocation in relocations:
                    old, via = relocation['before'], relocation['via']
                    if (old.get('href') != item['href'] or not same_name(old['name'], item['name']) or
                            not any(n['name'] == via['name'] for n in peer.get('navigation', []))):
                        continue
                    declaration = next(((r, _declaration(r, via)) for r in changes if _declaration(r, via)), None)
                    if declaration:
                        record, text = declaration
                        why = _proof('menu_migration', record, text, original=item['name'], href=item['href'], via=via['name'])
                        break
            if why:
                waived.append({**entry, 'exemption': why})
            else:
                path = ' / '.join(f"{s['role']} {s['name']!r}" for s in screen['steps']) or 'open /'
                entry['observation'] = (f"{item['role']} {item['name']!r} reached by {path} was present before the "
                                        'upgrade and is now missing; restore it unless a requirement changes it')
                if peer.get('failed_step'):
                    entry['failed_step'] = peer['failed_step']
                missing.append(entry)
    counts = {rule: sum(w['exemption']['rule'] == rule for w in waived) for rule in RULES}
    return {'kept': kept, 'missing': missing, 'unknown': unknown, 'exempted': waived,
            'exemptions_by_rule': counts, 'observation': observed}


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
                      for k in ('items', 'screens', 'seconds', 'missing', 'unknown', 'exempted',
                                'exemptions_by_rule', 'unavailable') if k in result}))


if __name__ == '__main__':
    main()
