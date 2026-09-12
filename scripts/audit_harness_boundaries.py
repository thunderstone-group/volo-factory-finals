#!/usr/bin/env python3
"""Offline boundary diagnostic, not a model benchmark or an official score.

Uses synthetic model responses and a tiny authored HTTP fixture in temporary
workspaces. No model client, platform API, credentials, or official tests are used.
A successful diagnostic means the observation completed, NOT that the harness is
correct. --expect-baseline asserts the known defects at the audited revision.
"""
from __future__ import annotations

import argparse
import contextlib
import hashlib
import io
import json
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from volo.agent import Agent
from volo.model import Usage
from volo.requirements import RequirementSet
from volo.trace import Trace
from volo.workspace import Workspace

AUDITED_HEAD = '80955003090c2f50f7a666bfb6f355ebbefbbfbc'
REQUIREMENT = ('id: ROOT\nname: Greeting\ntype: FOLDER\nchildren:\n'
               '  - id: R1\n    name: Greeting\n    type: ATOMIC\n'
               '    description: Return the exact text hello over HTTP.\n')
CHECK = ("fetch(process.env.FACTORY_BASE_URL).then(r=>r.text())"
         ".then(t=>require('node:assert/strict').equal(t,'hello'))"
         ".catch(e=>{console.error(e.message);process.exitCode=1});\n")


def make_workspace(base: Path):
    req = base / 'input'
    req.mkdir(parents=True)
    (req / 'requirements.yaml').write_text(REQUIREMENT)
    out = base / 'app'
    trace = Trace(out / '.factory')
    return RequirementSet.load(req), Workspace(out, req, trace, time.monotonic() + 45)


class SyntheticTruncatingModel:
    """In-process scripted fixture. No HTTP requests and no real token usage."""
    model = 'synthetic-truncating-fixture'

    def __init__(self):
        self.usage = Usage()
        self.requests = []

    def complete(self, messages, tools, *, remaining_seconds=None, forced_tool=None):
        self.usage.calls += 1
        self.requests.append({'forced_tool': forced_tool,
                              'tools': [t['function']['name'] for t in tools]})
        return {'role': 'assistant', 'content': ''}, 'length'


def diagnose():
    if not shutil.which('node') or not shutil.which('npm'):
        raise RuntimeError('Installed Node and npm are required; this script does not install them')
    report = {
        'schema_version': 1,
        'audited_head': AUDITED_HEAD,
        'executed_head': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
        'kind': 'offline diagnostic with synthetic model responses and real local HTTP execution',
        'model_api_calls': 0,
        'official_evaluations': 0,
        'node_version': subprocess.check_output(['node', '--version'], text=True).strip(),
    }
    with tempfile.TemporaryDirectory(prefix='volo-boundary-audit-') as tmp:
        root = Path(tmp)
        _, workspace = make_workspace(root / 'acceptance')
        files = [
            {'path': 'frontend/package.json', 'content': json.dumps({'scripts': {'build': 'node build.cjs'}})},
            {'path': 'frontend/build.cjs', 'content': "require('node:fs').writeFileSync('built.txt','ok');"},
            {'path': 'backend/package.json', 'content': json.dumps({'scripts': {'start': 'node server.cjs'}})},
            {'path': 'backend/server.cjs', 'content': "require('node:http').createServer((q,s)=>s.end('wrong')).listen(process.env.PORT,'0.0.0.0');"},
            {'path': 'checks/greeting.cjs', 'content': CHECK},
        ]
        workspace.write_files(files)
        product = workspace.root / 'backend/server.cjs'
        product_before = hashlib.sha256(product.read_bytes()).hexdigest()
        noop = workspace.verify(['node', '-e', 'process.exit(0)'])
        honest = workspace.verify(['node', 'checks/greeting.cjs'])
        workspace.edit('checks/greeting.cjs', CHECK, 'process.exit(0);\n')
        weakened = workspace.verify(['node', 'checks/greeting.cjs'])
        report['acceptance'] = {
            'fixture_requirement': 'HTTP body must equal hello',
            'fixture_actual_body': 'wrong',
            'registered_fixed_checks': len(workspace.required_checks),
            'zero_assertion_command_accepted': noop['passed'],
            'honest_behavioral_check_passed': honest['passed'],
            'weakened_check_accepted': weakened['passed'],
            'product_source_unchanged': hashlib.sha256(product.read_bytes()).hexdigest() == product_before,
            'scope': 'production Workspace.verify path; tiny authored fixture, not an official task',
        }
        requirements, workspace = make_workspace(root / 'truncation')
        model = SyntheticTruncatingModel()
        agent = Agent(requirements, model, workspace, runtime=None, max_calls=4, references=None)
        terminal_error = None
        with contextlib.redirect_stdout(io.StringIO()):
            try:
                agent.run_batch(requirements.nodes)
            except RuntimeError as exc:
                terminal_error = str(exc)
        report['truncation'] = {
            'synthetic_responses': len(model.requests),
            'requests': model.requests,
            'all_requests_forced_full_bundle': bool(model.requests) and all(
                r['forced_tool'] == 'build_app' and r['tools'] == ['build_app'] for r in model.requests),
            'product_generated': (workspace.root / 'frontend/public/index.html').exists(),
            'terminal_error': terminal_error,
            'scope': 'run_batch control-flow probe; does not measure any real model',
        }
    a, t = report['acceptance'], report['truncation']
    report['baseline_defects_reproduced'] = {
        'zero_assertion_acceptance': a['zero_assertion_command_accepted'] and not a['honest_behavioral_check_passed'],
        'acceptance_weakening': a['weakened_check_accepted'] and a['product_source_unchanged'] and not a['honest_behavioral_check_passed'],
        'truncation_never_changes_action_space': t['synthetic_responses'] == 4 and t['all_requests_forced_full_bundle'] and not t['product_generated'],
    }
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--expect-baseline', action='store_true', help='Expect the three audited defects; not a quality gate')
    args = parser.parse_args()
    try:
        report = diagnose()
    except Exception as exc:
        print(json.dumps({'diagnostic_completed': False, 'error_type': type(exc).__name__, 'error': str(exc)}))
        return 2
    text = json.dumps(report, ensure_ascii=False, indent=2) + '\n'
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(text)
    print(text, end='')
    return int(args.expect_baseline and not all(report['baseline_defects_reproduced'].values()))


if __name__ == '__main__':
    raise SystemExit(main())
