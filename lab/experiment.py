"""Run the registration-timing experiment matrix and write raw evidence JSON."""
from __future__ import annotations

import json, sys, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bench

REG = 'REQ-1.1: successfully register a new account and remain signed in'


def one(variant: str, mode: str, rep: int, tests: Path = bench.TESTS) -> dict:
    tag = f'{variant}__{mode}__{rep}'
    out = bench.SCRATCH / 'runs' / tag
    out.mkdir(parents=True, exist_ok=True)
    app = bench.build_app(variant, bench.SCRATCH / 'apps' / variant)
    if mode == 'host':
        row = bench.run_host(app, out, tests)
    else:
        row = bench.run_container(app, out, tests, mode.replace('cpu', '').replace('_', '.'))
    row['variant'] = variant
    row['mode'] = mode
    row['rep'] = rep
    row['timeline'] = bench.extract_trace(out) if 'tests' in row else []
    return row


def main(argv: list[str]) -> None:
    plan = json.loads(Path(argv[0]).read_text())
    results = []
    target = Path(argv[1])
    for item in plan:
        for rep in range(item.get('reps', 3)):
            started = time.time()
            row = one(item['variant'], item['mode'], rep,
                      Path(item['tests']) if item.get('tests') else bench.TESTS)
            reg = [t for t in row.get('tests', []) if t['title'] == REG]
            print(f"{item['variant']:<24} {item['mode']:<6} rep{rep} "
                  f"reg={reg[0]['duration'] if reg else 'NA'}ms "
                  f"status={reg[0]['status'] if reg else 'NA'} "
                  f"suite={row.get('stats', {}).get('duration', 'NA')} "
                  f"failed={row.get('stats', {}).get('unexpected', 'NA')} "
                  f"({time.time() - started:.0f}s)", flush=True)
            results.append(row)
            target.write_text(json.dumps(results, ensure_ascii=False))
    print('done')


if __name__ == '__main__':
    main(sys.argv[1:])
