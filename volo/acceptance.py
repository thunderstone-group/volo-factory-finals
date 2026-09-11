"""Generate browser acceptance checks from inputs before exposing implementation code."""
from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import time

from .trace import atomic_json
from .workspace import tool_environment


BROWSER = """const nodeTest=require('node:test');
const assert=require('node:assert/strict');
function test(name,check){nodeTest.test(name,async()=>{
  const {chromium}=require(process.env.FACTORY_PLAYWRIGHT_MODULE);
  const browser=await chromium.launch();
  try{const page=await browser.newPage();const errors=[];
    page.setDefaultTimeout(5000);
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(process.env.FACTORY_BASE_URL);
    await check(page,assert);
    assert.deepEqual(errors,[], 'Browser JavaScript errors');
  }finally{await browser.close();}
});}
module.exports={test,assert};
"""
PROMPT = """Write independent browser acceptance checks BEFORE an application is implemented.
Only the product requirements and observed reference images are available. Do not invent APIs,
DOM IDs, CSS classes or implementation details. Test the public UI using specified routes,
exact visible text, native labels and accessible roles. Follow the given valid example data
and negative cases. Use unique test data for persistent state. Cover every listed scenario.

Include exact main section headings from the relevant reference pages, even when omitted from
the prose, unless the written requirements explicitly replace or exclude them. Exclude unrelated
branding, promotional content and out-of-scope screenshot features. Written validation rules,
labels and defaults override conflicting screenshots. A measured level/rating/strength widget
is a named meter with a changing value, while operation completion is a progressbar.
Required dynamic identifiers must be independently locatable as exact text.

Call define_checks with executable CommonJS JavaScript and concise coverage descriptions.
The harness supplies ./acceptance-browser.cjs with {test,assert}. Use:
const {test,assert}=require('./acceptance-browser.cjs');
test('scenario',async(page)=>{ /* page starts on home; Playwright page and Node assert */ });
Await Playwright operations before passing values to Node assertions. Use locator.waitFor()
for eventual visibility and page.waitForURL()/waitForFunction() for asynchronous changes.
Each test gets a fresh browser. Use process.env.FACTORY_BASE_URL for absolute navigations.
Do not import @playwright/test, install dependencies, launch browsers, read application source,
write files, call process.exit, skip assertions or change tests/evaluation infrastructure.
Keep shared form-filling helpers concise. Output only the requested tool call."""
TOOL = {'type': 'function', 'function': {'name': 'define_checks',
    'description': 'Provide input-derived browser assertions, without application implementation.',
    'parameters': {'type': 'object', 'properties': {
        'script': {'type': 'string'}, 'coverage': {'type': 'array', 'items': {'type': 'string'}}},
        'required': ['script', 'coverage'], 'additionalProperties': False}}}
POLICY = hashlib.sha256((PROMPT + BROWSER).encode()).hexdigest()


class AcceptancePlan:
    def __init__(self, requirements, model, workspace):
        self.requirements, self.model, self.workspace = requirements, model, workspace
        self.trace = workspace.trace
        self.helper = self.trace.directory / 'acceptance-browser.cjs'
        if self.helper.is_symlink():
            raise ValueError('Acceptance helper must not be a symlink')
        self.helper.write_text(BROWSER)
        os.chmod(self.helper, 0o600)
        self.records = {}
        for path in sorted(self.trace.directory.glob('acceptance-*.json')):
            record = json.loads(path.read_text())
            if (record.get('policy') == POLICY and record.get('model') == model.model
                    and record.get('requirement_fingerprint') == requirements.fingerprint):
                self.records[record['key']] = record
                self.attach(record)

    def attach(self, record):
        if (not re.fullmatch('[0-9a-f]{64}', record['key']) or record['path'] != str(
                (self.trace.directory / ('acceptance-' + record['key'] + '.cjs')).relative_to(self.workspace.root))
                or hashlib.sha256(record['script'].encode()).hexdigest() != record['sha256']):
            raise ValueError('Invalid cached acceptance contract')
        command = ['node', '--test', record['path']]
        if not any(item['argv'] == command for item in self.workspace.required_checks):
            self.workspace.required_checks.append({'argv': command, 'files': {
                record['path']: record['sha256'],
                str(self.helper.relative_to(self.workspace.root)): hashlib.sha256(BROWSER.encode()).hexdigest()}})

    def prepare(self, nodes, observations, *, guard_budget):
        request = self.requirements.batch_prompt(nodes) + '\nReference observations:\n' + json.dumps(observations, ensure_ascii=False)
        key = hashlib.sha256((POLICY + self.model.model + request).encode()).hexdigest()
        if key in self.records:
            self.trace.event('acceptance_plan_reused', key=key)
            return self.records[key]
        messages = [{'role': 'system', 'content': PROMPT}, {'role': 'user', 'content': request}]
        for attempt in range(2):
            guard_budget()
            message, finish = self.model.complete(messages, [TOOL], forced_tool='define_checks',
                remaining_seconds=self.workspace.deadline - time.monotonic())
            try:
                calls = message.get('tool_calls') or []
                if finish == 'length' or len(calls) != 1 or calls[0]['function']['name'] != 'define_checks':
                    raise ValueError('Return one complete define_checks tool call')
                args = json.loads(calls[0]['function']['arguments'])
                script, coverage = args['script'], args['coverage']
                if (not isinstance(script, str) or not script.strip() or len(script.encode()) > 160000
                        or 'acceptance-browser.cjs' not in script or not re.search(r'\btest\s*\(', script)
                        or not isinstance(coverage, list) or not coverage):
                    raise ValueError('Provide nonempty checks and coverage')
                checked = subprocess.run(['node', '--check', '-'], input=script, text=True,
                    capture_output=True, timeout=10, env=tool_environment())
                if checked.returncode:
                    raise ValueError('JavaScript syntax check failed: ' + checked.stderr[-2000:])
            except (ValueError, KeyError, TypeError) as error:
                self.trace.event('acceptance_plan_rejected', attempt=attempt + 1, error=str(error))
                messages.append({'role': 'user', 'content': 'Previous output was rejected: ' + str(error) +
                                 '. Return a smaller complete valid define_checks call.'})
                continue
            path = self.trace.directory / ('acceptance-' + key + '.cjs')
            path.write_text(script)
            os.chmod(path, 0o600)
            record = {'key': key, 'policy': POLICY, 'model': self.model.model,
                'requirement_fingerprint': self.requirements.fingerprint,
                'path': str(path.relative_to(self.workspace.root)),
                'sha256': hashlib.sha256(script.encode()).hexdigest(), 'coverage': coverage, 'script': script}
            atomic_json(path.with_suffix('.json'), record)
            self.records[key] = record
            self.attach(record)
            self.trace.event('acceptance_plan_created', **record)
            return record
        raise RuntimeError('Could not produce a complete browser acceptance plan')
