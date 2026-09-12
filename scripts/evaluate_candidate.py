#!/usr/bin/env python3
"""Score an already-running application without starting an agent or model call.

This CLI is worker-neutral: the candidate may come from VOLO, Pi, or another worker.
The operator supplies a reviewed, hash-pinned suite in a separate directory.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from volo.acceptance import AcceptanceSuite
from volo.requirements import RequirementSet
from volo.workspace import EXCLUDED


def fingerprint(root):
    result = hashlib.sha256()
    for directory, dirs, files in os.walk(root):
        dirs[:] = sorted(d for d in dirs if d not in EXCLUDED and d != 'requirements'
                         and not (Path(directory) / d).is_symlink())
        for name in sorted(files):
            path = Path(directory) / name
            if path.is_symlink() or name.startswith('.env'):
                continue
            result.update(str(path.relative_to(root)).encode())
            with path.open('rb') as stream:
                for chunk in iter(lambda: stream.read(65536), b''):
                    result.update(chunk)
    return result.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--requirements', type=Path, required=True)
    parser.add_argument('--application', type=Path, required=True)
    parser.add_argument('--contract', type=Path, required=True)
    parser.add_argument('--base-url', required=True)
    parser.add_argument('--timeout', type=float, default=180)
    parser.add_argument('--playwright-module')
    parser.add_argument('--chromium-executable')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    try:
        if not math.isfinite(args.timeout) or not 0 < args.timeout <= 3600:
            raise ValueError('Timeout must be finite and in (0, 3600]')
        app = args.application.resolve()
        if not app.is_dir():
            raise ValueError('Application directory does not exist')
        requirements = RequirementSet.load(args.requirements)
        ids = [node['id'] for node in requirements.nodes]
        suite = AcceptanceSuite(args.contract, app, requirements.fingerprint, ids)
        if args.output:
            output = args.output.resolve()
            if output.is_relative_to(app) or output.is_relative_to(suite.root) or output.is_relative_to(requirements.root):
                raise ValueError('Write reports outside application, acceptance and input directories')
        env = {}
        if args.playwright_module:
            env['FACTORY_PLAYWRIGHT_MODULE'] = args.playwright_module
        if args.chromium_executable:
            env['FACTORY_CHROMIUM_EXECUTABLE'] = args.chromium_executable
        before = fingerprint(app)
        result = suite.run(args.base_url, ids, timeout=args.timeout, extra_env=env)
        after = fingerprint(app)
        result.update(candidate_fingerprint_before=before, source_fingerprint=after,
                      candidate_tree_changed=before != after, model_api_calls=0)
        # Stateful tests may change application data. Record both trees instead of
        # pretending all observed mutations are source changes or silently ignoring them.
        text = json.dumps(result, ensure_ascii=False, indent=2) + '\n'
        if args.output:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(text)
        print(text, end='')
        return 0 if result['passed'] else 1
    except (OSError, ValueError) as exc:
        print(json.dumps({'passed': False, 'status': 'configuration_error', 'error': str(exc)}))
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
