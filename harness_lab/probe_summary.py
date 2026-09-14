"""Summarize a launcher's probe.jsonl using only the standard library.

Usage: python -m harness_lab.probe_summary /path/to/probe.jsonl
CPU ratios use counter deltas over the sampling window, with period in usec.
Process counts cover the retained (at most 60) rows, not an uncapped census.
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path


def get(record, *keys):
    for key in keys:
        if not isinstance(record, dict):
            return None
        record = record.get(key)
    return record


def numeric(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def display(value):
    if value is None:
        return 'n/a'
    if isinstance(value, float):
        return f'{value:.6g}'
    if isinstance(value, (list, dict)):
        return json.dumps(value, ensure_ascii=False)
    return str(value).strip()


def read_records(path):
    try:
        with Path(path).open(encoding='utf-8', errors='replace') as stream:
            for line in stream:
                try:
                    record = json.loads(line)
                except ValueError:
                    continue  # A killed writer may leave a partial final line.
                if isinstance(record, dict):
                    yield record
    except OSError:
        return


def summarize(records):
    records = list(records)
    boot = next((row for row in records if row.get('kind') == 'boot'), {})
    samples = [row for row in records if row.get('kind') == 'sample']
    procs = [row for row in records if row.get('kind') == 'procs']
    lines = []

    def emit(label, value):
        lines.append(f'{label}: {display(value)}')

    for key in ('PORT', 'E2E_BASE_URL', 'TARGET_URL', 'PLAYWRIGHT_BASE_URL',
                'PLAYWRIGHT_BROWSERS_PATH', 'CI', 'NODE_ENV', 'HOME', 'USER'):
        emit(f'env.{key}', get(boot, 'env', key))
    for version in ('v2', 'v1'):
        snapshot = get(boot, 'cgroup', version)
        if isinstance(snapshot, dict) and snapshot:
            for key, value in snapshot.items():
                emit(f'cgroup.{version}.{key}', value)
        else:
            emit(f'cgroup.{version}', None)

    times = [row['ts_ms'] for row in samples if numeric(row.get('ts_ms'))]
    emit('sample duration (s)', (max(times) - min(times)) / 1000 if times else None)
    memories = [row for row in samples if numeric(row.get('memory.current'))]
    peak = max(memories, key=lambda row: row['memory.current']) if memories else {}
    emit('memory.current peak (bytes)', peak.get('memory.current'))
    emit('memory.current peak ts_ms', peak.get('ts_ms'))

    def delta(*keys):
        values = [get(row, *keys) for row in samples]
        # Do not silently shorten the measurement window when an endpoint is absent.
        if len(values) < 2 or not numeric(values[0]) or not numeric(values[-1]):
            return None
        return values[-1] - values[0] if values[-1] >= values[0] else None

    emit('oom_kill delta', delta('memory.events', 'oom_kill'))
    period = None
    cpu_max = get(boot, 'cgroup', 'v2', 'cpu.max')
    v1_period = get(boot, 'cgroup', 'v1', 'cpu/cpu.cfs_period_us')
    try:
        period = float(cpu_max.split()[1]) if isinstance(cpu_max, str) else float(v1_period)
    except (ValueError, TypeError, IndexError):
        pass
    periods = delta('cpu.stat', 'nr_periods')
    throttled = delta('cpu.stat', 'throttled_usec')
    count = delta('cpu.stat', 'nr_throttled')
    valid = numeric(periods) and periods > 0
    emit('CPU throttled_usec / (nr_periods * period)',
         throttled / (periods * period) if valid and numeric(throttled)
         and numeric(period) and period > 0 else None)
    emit('CPU nr_throttled / nr_periods', count / periods if valid and numeric(count) else None)
    for source in ('memory.pressure', 'cpu.pressure', 'proc.pressure.memory', 'proc.pressure.cpu'):
        for level in ('some', 'full'):
            values = [get(row, source, level) for row in samples]
            emit(f'{source} {level} avg10 max', max((v for v in values if numeric(v)), default=None))

    candidates = [row for row in procs if numeric(row.get('ts_ms'))]
    nearest = min(candidates, key=lambda row: abs(row['ts_ms'] - peak['ts_ms'])) \
        if candidates and numeric(peak.get('ts_ms')) else {}
    emit('nearest procs ts_ms', nearest.get('ts_ms'))
    processes = nearest.get('processes')
    lines.append('RSS top 10 near memory peak:')
    if isinstance(processes, list) and processes:
        rows = [row for row in processes if isinstance(row, dict)]
        rows.sort(key=lambda row: row['rss_kb'] if numeric(row.get('rss_kb')) else -1, reverse=True)
        for row in rows[:10]:
            lines.append('  ' + ' '.join(f'{key}={display(row.get(key))}'
                         for key in ('pid', 'rss_kb', 'comm', 'cmdline')))
    else:
        lines.append('  n/a')
    lines.append('chromium/chrome count by ts_ms (retained process rows):')
    if not procs:
        lines.append('  n/a')
    for row in procs:
        rows = row.get('processes')
        count = None
        if isinstance(rows, list):
            count = sum(1 for process in rows if isinstance(process, dict)
                        and any(name in (str(process.get('comm') or '') + ' ' +
                                         str(process.get('cmdline') or '')).lower()
                                for name in ('chromium', 'chrome')))
        emit(f'  {display(row.get("ts_ms"))}', count)
    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('probe', type=Path)
    args = parser.parse_args()
    print(summarize(read_records(args.probe)))


if __name__ == '__main__':
    main()
