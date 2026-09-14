"""Produce docs/evidence/2026-09-14-registration-timing.json from the raw run files."""
from __future__ import annotations

import json, statistics, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bench

REG = 'REQ-1.1: successfully register a new account and remain signed in'
OFFICIAL = {'registration_ms': 10013, 'registration_status': 'timedOut',
            'light_tests_ms': [800, 688, 363, 689, 926, 989, 600, 814, 795],
            'suite_ms': 14570.75, 'workers': 4, 'actual_workers': 2}


def group(runs: list) -> dict:
    out = {}
    for run in runs:
        warm = any(t['title'].startswith('WARMUP') for t in run.get('tests', []))
        key = f"{run['variant']}{'+warmup-spec' if warm else ''}/{run['mode']}"
        reg = [t for t in run.get('tests', []) if t['title'] == REG]
        light = [t['duration'] for t in run.get('tests', [])
                 if t['title'] != REG and not t['title'].startswith('WARMUP')]
        row = out.setdefault(key, {'registration_ms': [], 'registration_status': [],
                                   'light_ms': [], 'suite_ms': [], 'suite_failures': [],
                                   'failures': []})
        if reg:
            row['registration_ms'].append(reg[0]['duration'])
            row['registration_status'].append(reg[0]['status'])
        row['light_ms'].extend(light)
        if 'stats' in run:
            row['suite_ms'].append(round(run['stats']['duration']))
            row['suite_failures'].append(run['stats']['unexpected'])
        for test in run.get('tests', []):
            if test['status'] != 'passed' and not test['title'].startswith('WARMUP'):
                row['failures'].append({'test': test['title'], 'status': test['status'],
                                        'duration': test['duration'],
                                        'error': test['error'].split('\n')[0][:200]})
    for row in out.values():
        row['registration_median_ms'] = (round(statistics.median(row['registration_ms']))
                                         if row['registration_ms'] else None)
        if row['light_ms']:
            ordered = sorted(row['light_ms'])
            row['light_min_ms'] = ordered[0]
            row['light_median_ms'] = round(statistics.median(ordered))
            row['light_max_ms'] = ordered[-1]
        del row['light_ms']
    return out


def timelines(runs: list) -> dict:
    out = {}
    for run in runs:
        if not run.get('timeline'):
            continue
        warm = any(t['title'].startswith('WARMUP') for t in run.get('tests', []))
        key = f"{run['variant']}{'+warmup-spec' if warm else ''}/{run['mode']}/rep{run['rep']}"
        steps = bench.leaves(run['timeline'])
        agg = {}
        for step in steps:
            name = bench.bucket(step['api'])
            agg.setdefault(name, {'steps': 0, 'total_ms': 0.0})
            agg[name]['steps'] += 1
            agg[name]['total_ms'] = round(agg[name]['total_ms'] + step['duration'], 1)
        out[key] = {
            'buckets': dict(sorted(agg.items())),
            'slowest_10': [{'step': s['api'][:90], 'ms': s['duration']}
                           for s in sorted(steps, key=lambda r: -r['duration'])[:10]],
            # The full action list is kept for one repetition per group; the other
            # repetitions keep their bucket totals and ten slowest steps.
            'actions': ([{'step': s['api'][:90], 'start_ms': s['start'], 'ms': s['duration']}
                         for s in steps] if run['rep'] == 0 else None),
        }
    return out


def main(out_path: str, raw_paths: list[str]) -> None:
    runs = []
    for path in raw_paths:
        runs.extend(json.loads(Path(path).read_text()))
    payload = {
        'generated': '2026-09-14',
        'official_e057': OFFICIAL,
        'environment': {
            'host': 'macOS 25.5 (darwin arm64), Playwright 1.57.0, Google Chrome executablePath, '
                    'application in a 1-CPU/256 MB Docker container reached through the volo '
                    'launcher proxy on port 3301',
            'cpuN': 'application AND Playwright runner inside one Docker container '
                    '(hermes-agent:latest, Debian 13, linux/arm64) limited with --cpus=N '
                    '--memory=2g, chromium_headless_shell-1217, application on port 3000',
            'official': 'linux x64, Node 20.19.3, Playwright 1.57.0, channel "chromium", '
                        'trace off, screenshot off, baseURL http://127.0.0.1:3000',
        },
        'summary': group(runs),
        'timelines': timelines(runs),
    }
    Path(out_path).write_text(json.dumps(payload, ensure_ascii=False, indent=1) + '\n')
    print('wrote', out_path)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2:])
