"""Authorized audit baseline: fixed public answers with exactly zero model calls.

This is a disclosed negative control for a model-generation benchmark, not a general
agent. It is excluded from normal uploads. Only the four pinned public inputs match.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from volo.requirements import RequirementSet
from volo.trace import Runtime, Trace, atomic_json
from volo.web_runtime import BUILD, SERVER


BINDINGS = {
    'c6eb72847632e02d92029f4f8123d4270e7d8baa8a5b1e897986bfb4acf27bb0': 'smoke--counter',
    'b5eca1f932497474b15821fe323c7d38fba69cf6dae7fceb68255249b4c568ec': 'smoke--dice',
    'c511fa6ba5f1696912ecac90e615b9dfffdffd697dba6de1d898bfe15c0ed26b': 'smoke-evolution--counter',
    '2a160a8f0e4647ac3b8c18d4cdc6a15f08fc0a656fd48a33d38e502d995703ca': 'smoke-evolution--dice',
}


def fixed_answer(task):
    if task not in BINDINGS.values():
        raise ValueError('The disclosed audit baseline has no answer for this input')
    if task.endswith('--counter'):
        reset = '<button onclick="setCount(0)">Reset</button>' if 'evolution' in task else ''
        return '''<!doctype html><meta charset="utf-8"><output data-testid="count">0</output>
<button onclick="setCount(n+1)">Increment</button><button onclick="setCount(n-1)">Decrement</button>
''' + reset + '''<script>let n=0;function setCount(value){n=value;document.querySelector('[data-testid=count]').textContent=n}</script>'''
    count = '<output data-testid="roll-count">0</output>' if 'evolution' in task else ''
    return '''<!doctype html><meta charset="utf-8"><output data-testid="dice-value">1</output>
''' + count + '''<button onclick="roll()">Roll</button><script>let n=0;function roll(){
document.querySelector('[data-testid=dice-value]').textContent=1+Math.floor(Math.random()*6);
const count=document.querySelector('[data-testid=roll-count]');if(count)count.textContent=++n;}</script>'''


def install(task, output):
    output = Path(output).resolve()
    files = {
        'frontend/package.json': json.dumps({'private': True, 'scripts': {'build': 'node build.cjs'}}),
        'frontend/build.cjs': BUILD,
        'frontend/public/index.html': fixed_answer(task),
        'frontend/public/app.js': '',
        'backend/package.json': json.dumps({'private': True, 'scripts': {'start': 'node server.cjs'}}),
        'backend/server.cjs': SERVER,
        'backend/api.cjs': 'module.exports=async(req,res)=>false;\n',
    }
    for name, content in files.items():
        destination = output / name
        if not destination.resolve().is_relative_to(output):
            raise ValueError('Application path escapes this run output')
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(content)
    return {name: hashlib.sha256(content.encode()).hexdigest() for name, content in files.items()}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('requirement_path', type=Path)
    parser.add_argument('--output-dir', type=Path, required=True)
    args = parser.parse_args(argv)
    requirements = RequirementSet.load(args.requirement_path)
    task = BINDINGS.get(requirements.fingerprint)
    if task is None:
        parser.error('Unrecognized input: the public-answer audit control must stop')
    output = args.output_dir.resolve()
    if output == requirements.root or output.is_relative_to(requirements.root):
        parser.error('Output must not overwrite requirements')
    trace = Trace(output / '.factory')
    ignore = output / '.gitignore'
    existing = ignore.read_text() if ignore.exists() else ''
    ignore.write_text(existing.rstrip() + '\n.factory/\n.env\n.env.*\nnode_modules/\n')
    runtime = Runtime(trace)
    runtime.emit('mark_run_started', 'SECURITY REPRODUCTION: fixed public answers, no model generation')
    manifest = install(task, output)
    result = {'status': 'completed', 'purpose': 'authorized_security_reproduction',
              'method': 'fixed_public_answers', 'general_agent_capability_claimed': False,
              'task': task, 'requirement_fingerprint': requirements.fingerprint,
              'model_calls': 0, 'model_tokens': 0, 'official_evaluation': 'pending',
              'product_sha256': manifest}
    atomic_json(trace.directory / 'security-reproduction.json', result)
    trace.event('security_reproduction', **result)
    for node in requirements.nodes:
        runtime.emit('mark_implementation_done', node['id'], 'Fixed public fixture installed for audit')
    runtime.commit('Security reproduction: install fixed public answers without model calls')
    runtime.emit('mark_run_completed', 'Audit fixture installed; official evaluation is pending')
    print(json.dumps(result, ensure_ascii=False), flush=True)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
