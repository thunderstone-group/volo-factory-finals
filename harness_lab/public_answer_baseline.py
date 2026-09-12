"""Authorized audit controls: fixed public answers with an optional tiny model router.

This is a disclosed negative control for a model-generation benchmark, not a general
agent. It is excluded from normal uploads. Only the four pinned public inputs match.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
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


def main(argv=None, *, tiny_router=False):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('requirement_path', type=Path)
    parser.add_argument('--output-dir', type=Path, required=True)
    args = parser.parse_args(argv)
    requirements = RequirementSet.load(args.requirement_path)
    requested_task = BINDINGS.get(requirements.fingerprint)
    if requested_task is None:
        parser.error('Unrecognized input: the public-answer audit control must stop')
    output = args.output_dir.resolve()
    if output == requirements.root or output.is_relative_to(requirements.root):
        parser.error('Output must not overwrite requirements')
    trace = Trace(output / '.factory')
    ignore = output / '.gitignore'
    existing = ignore.read_text() if ignore.exists() else ''
    ignore.write_text(existing.rstrip() + '\n.factory/\n.env\n.env.*\nnode_modules/\n')
    runtime = Runtime(trace)
    runtime.emit('mark_run_started', 'SECURITY REPRODUCTION: fixed public answers; no model-generated application')
    task, usage = requested_task, None
    if tiny_router:
        from volo.model import Model
        model = Model(os.environ['OPENAI_BASE_URL'], os.environ['OPENAI_API_KEY'],
                      os.environ['MODEL'], trace, max_output=4, timeout=30, max_attempts=1)
        model.thinking = 'disabled'
        trace.event('audit_model_role', role='task_classifier', application_generated_by_model=False)
        message, _ = model.complete([{'role': 'user', 'content':
            'counter or dice? One word.\n' + requirements.document['name']}], [])
        label = (message.get('content') or '').strip().lower()
        match = re.fullmatch(r'(counter|dice)[.!]?', label)
        if not match:
            raise ValueError('Task classifier did not return a supported label')
        # The response determines the installed product. A wrong classification
        # installs the wrong public fixture and must fail the real external test.
        task = requested_task.split('--')[0] + '--' + match.group(1)
        usage = model.usage
    manifest = install(task, output)
    result = {'status': 'completed', 'purpose': 'authorized_security_reproduction',
              'method': 'fixed_public_answers_with_tiny_router' if tiny_router else 'fixed_public_answers',
              'general_agent_capability_claimed': False, 'application_generated_by_model': False,
              'model_role': 'task_classifier' if tiny_router else 'none',
              'requested_task': requested_task, 'task': task, 'requirement_fingerprint': requirements.fingerprint,
              'model_calls': usage.calls if usage else 0,
              'model_tokens': (None if usage.missing_usage_calls else usage.total_tokens) if usage else 0,
              'official_evaluation': 'pending',
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
