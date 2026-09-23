"""Time each phase of the v24 delivery smoke check on a copied application. No model calls."""
import importlib.util, json, os, sys, time, subprocess
S = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('m', os.path.join(S, 'v24zip', 'main.py'))
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
app, req = sys.argv[1], sys.argv[2]
requirements = open(req, encoding='utf-8').read()
timings = []
def timed(name, fn):
    def wrapper(*a, **k):
        t = time.monotonic()
        try:
            return fn(*a, **k)
        finally:
            timings.append((name, round(time.monotonic() - t, 3)))
    return wrapper
orig_run = subprocess.run
def run(cmd, *a, **k):
    t = time.monotonic()
    try:
        return orig_run(cmd, *a, **k)
    finally:
        label = ' '.join(str(c) for c in cmd[:3])
        if 'build' in label: timings.append(('npm run build', round(time.monotonic() - t, 3)))
m.subprocess.run = run
for name in ('_check_syntax', '_check_page', '_check_dom', '_check_semantic_browser'):
    setattr(m, name, timed(name, getattr(m, name)))
orig_fetch = m._fetch_local
state = {'health_first': None, 'popen': None}
orig_popen = subprocess.Popen
def popen(*a, **k):
    state['popen'] = time.monotonic()
    return orig_popen(*a, **k)
m.subprocess.Popen = popen
def fetch(url, timeout=5):
    r = orig_fetch(url, timeout)
    if url.endswith('/api/health') and state['health_first'] is None and r[0] == 200:
        state['health_first'] = round(time.monotonic() - state['popen'], 3)
    return r
m._fetch_local = fetch
diag = []
t0 = time.monotonic()
problems, executed = m.smoke_check(app, requirements, diag)
total = round(time.monotonic() - t0, 3)
t1 = time.monotonic()
static = (m.process_guard_gaps(app) + m.aria_collision_gaps(app, requirements) + m.exact_name_gaps(app, requirements)
          + m.readonly_gaps(app) + m.scaffold_gaps(app))
vocab, missing = m.vocabulary_gaps(app, requirements)
static_s = round(time.monotonic() - t1, 3)
print(json.dumps({'app': os.path.basename(app), 'smoke_total_s': total, 'phases': timings,
                  'backend_start_to_health_s': state['health_first'], 'static_gates_s': static_s,
                  'problems': problems, 'static': static, 'vocab_missing': missing,
                  'probe_screens': [d.get('screens') for d in diag],
                  'probe_actions': [[(a.get('name'), a.get('action')) for a in d.get('actions', [])] for d in diag],
                  'probe_executed': [d.get('executed') for d in diag], 'probe_unavailable': [d.get('unavailable') for d in diag]},
                 ensure_ascii=False, indent=1))
