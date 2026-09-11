"""Input-derived UI contracts; the harness owns all executable checking logic."""
from __future__ import annotations

import hashlib
import json
import os
import re
import time

from .trace import atomic_json


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
CHECKER = """const {test,assert}=require('./acceptance-browser.cjs');
const pages=__PAGES__;
for(const item of pages){test('UI contract '+item.route,async(page)=>{
  await page.goto(process.env.FACTORY_BASE_URL+item.route);
  for(const check of item.checks){
    const options=check.name?{name:check.name,exact:check.match!=='contains'}:{};
    const control=check.kind==='label'?page.getByLabel(check.name,{exact:check.match!=='contains'}):page.getByRole(check.kind,options);
    await control.waitFor({state:'visible'});
    if(check.kind==='label')assert.ok(await control.evaluate(el=>!!el.labels?.length),'Native label association: '+check.name);
  }
});}
"""
PROMPT = """Extract a concise read-only UI contract BEFORE application implementation.
Return DATA ONLY through define_ui_contract. For each public route, list required visible
headings, form labels, links, buttons, checkboxes and meters in the initial signed-out UI.
Use only the active written requirements and supplied reference observations. Preserve exact
section headings from relevant reference pages. Exclude branding, promotional text and
out-of-scope screenshot features. Written labels, defaults and rules override screenshots.
Use kind=label for every required named form control; it must have a native label association.
Use kind=heading for section titles and the appropriate accessible role for other controls.
Each check must identify one visible control. Choose ONE specified language alias, never merge
aliases. match=exact is the default; use contains only when the specification requires a name
to contain a phrase, such as agreement text. A strength/level indicator has role=meter; its
name may be empty if the specification does not give an accessible name.
Do not invent DOM IDs, CSS selectors, API routes, validation text, actions or test data.
Do not generate JavaScript, register accounts, log in, submit forms or depend on saved state.
This contract covers visible UI structure only. Implementation-authored behavioral tests and
official evaluation separately check state changes, negative cases and persistence."""
KINDS = ('heading', 'label', 'link', 'button', 'checkbox', 'meter')
TOOL = {'type': 'function', 'function': {'name': 'define_ui_contract',
    'description': 'Declare required signed-out public UI without executable code or state changes.',
    'parameters': {'type': 'object', 'properties': {
        'pages': {'type': 'array', 'items': {'type': 'object', 'properties': {
            'route': {'type': 'string'}, 'checks': {'type': 'array', 'items': {
                'type': 'object', 'properties': {'kind': {'type': 'string', 'enum': list(KINDS)},
                    'name': {'type': 'string'}, 'match': {'type': 'string', 'enum': ['exact', 'contains']}},
                'required': ['kind', 'name'], 'additionalProperties': False}}},
            'required': ['route', 'checks'], 'additionalProperties': False}},
        'coverage': {'type': 'array', 'items': {'type': 'string'}}},
        'required': ['pages', 'coverage'], 'additionalProperties': False}}}
POLICY = hashlib.sha256((PROMPT + BROWSER + CHECKER).encode()).hexdigest()


def validate(pages):
    if not isinstance(pages, list) or not 1 <= len(pages) <= 16:
        raise ValueError('Provide 1-16 public pages')
    total = 0
    for page in pages:
        if not isinstance(page, dict) or set(page) != {'route', 'checks'}:
            raise ValueError('Each page needs only route and checks')
        route = page['route']
        if (not isinstance(route, str) or not route.startswith('/') or route.startswith('//')
                or len(route) > 300 or any(c in route for c in '\\?#\r\n')):
            raise ValueError('Use same-origin public paths without query, fragment or backslash')
        checks = page['checks']
        if not isinstance(checks, list) or not 1 <= len(checks) <= 64:
            raise ValueError('Provide 1-64 UI checks per page')
        total += len(checks)
        for check in checks:
            if (not isinstance(check, dict) or set(check) - {'kind', 'name', 'match'}
                    or check.get('kind') not in KINDS or not isinstance(check.get('name'), str)
                    or len(check['name']) > 300 or (not check['name'] and check['kind'] != 'meter')
                    or check.get('match', 'exact') not in ('exact', 'contains')):
                raise ValueError('Use a supported UI role/label, literal name and exact/contains match')
    if total > 128:
        raise ValueError('Keep the UI contract under 128 checks')
    return pages


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
        expected = CHECKER.replace('__PAGES__', json.dumps(validate(record['pages'])))
        if (not re.fullmatch('[0-9a-f]{64}', record['key']) or record['path'] != str(
                (self.trace.directory / ('acceptance-' + record['key'] + '.cjs')).relative_to(self.workspace.root))
                or record['script'] != expected or hashlib.sha256(expected.encode()).hexdigest() != record['sha256']):
            raise ValueError('Invalid cached acceptance contract')
        command = ['node', '--test', record['path']]
        check = {'argv': command, 'files': {record['path']: record['sha256'],
            str(self.helper.relative_to(self.workspace.root)): hashlib.sha256(BROWSER.encode()).hexdigest()}}
        existing = next((item for item in self.workspace.required_checks if item['argv'] == command), None)
        if existing is None:
            self.workspace.required_checks.append(check)
        elif existing != check:
            existing.update(check)
            self.workspace.last_verification = None

    def revise(self, record, pages, reason):
        """Correct training metadata only; never expose an evaluator or program edit."""
        if not isinstance(reason, str) or not 20 <= len(reason.strip()) <= 4000:
            raise ValueError('Explain the specific requirement that the old UI contract misinterpreted')
        if len(record.get('revisions', [])) >= 3:
            raise ValueError('Training contract revision limit reached; continue implementing the requirements')
        pages = validate(pages)
        if pages == record['pages']:
            raise ValueError('The proposed UI contract is unchanged')
        script = CHECKER.replace('__PAGES__', json.dumps(pages))
        revised = {**record, 'pages': pages, 'script': script,
            'sha256': hashlib.sha256(script.encode()).hexdigest(),
            'revisions': [*record.get('revisions', []), {'reason': reason,
                'previous_pages': record['pages'], 'previous_sha256': record['sha256']} ]}
        self.attach(revised)
        path = self.workspace.root / revised['path']
        if path.is_symlink():
            raise ValueError('Training contract must not be a symlink')
        path.write_text(script)
        atomic_json(path.with_suffix('.json'), revised)
        self.records[record['key']] = revised
        self.trace.event('training_contract_revised', **revised)
        return revised

    def prepare(self, nodes, observations, *, guard_budget):
        request = self.requirements.batch_prompt(nodes) + '\nReference observations:\n' + json.dumps(observations, ensure_ascii=False)
        key = hashlib.sha256((POLICY + self.model.model + request).encode()).hexdigest()
        if key in self.records:
            self.trace.event('acceptance_plan_reused', key=key)
            return self.records[key]
        messages = [{'role': 'system', 'content': PROMPT}, {'role': 'user', 'content': request}]
        for attempt in range(2):
            guard_budget()
            message, finish = self.model.complete(messages, [TOOL], forced_tool='define_ui_contract',
                remaining_seconds=self.workspace.deadline - time.monotonic())
            try:
                calls = message.get('tool_calls') or []
                if finish == 'length' or len(calls) != 1 or calls[0]['function']['name'] != 'define_ui_contract':
                    raise ValueError('Return one complete define_ui_contract call')
                args = json.loads(calls[0]['function']['arguments'])
                pages, coverage = validate(args['pages']), args['coverage']
                if not isinstance(coverage, list) or not coverage or not all(isinstance(x, str) for x in coverage):
                    raise ValueError('Provide concise coverage descriptions')
            except (ValueError, KeyError, TypeError) as error:
                self.trace.event('acceptance_plan_rejected', attempt=attempt + 1, error=str(error))
                messages.append({'role': 'user', 'content': 'Previous output was rejected: ' + str(error) +
                                 '. Return a complete valid data-only UI contract.'})
                continue
            script = CHECKER.replace('__PAGES__', json.dumps(pages))
            path = self.trace.directory / ('acceptance-' + key + '.cjs')
            path.write_text(script)
            os.chmod(path, 0o600)
            record = {'key': key, 'policy': POLICY, 'model': self.model.model,
                'requirement_fingerprint': self.requirements.fingerprint,
                'path': str(path.relative_to(self.workspace.root)),
                'sha256': hashlib.sha256(script.encode()).hexdigest(), 'coverage': coverage, 'pages': pages, 'script': script}
            atomic_json(path.with_suffix('.json'), record)
            self.records[key] = record
            self.attach(record)
            self.trace.event('acceptance_plan_created', **record)
            return record
        raise RuntimeError('Could not produce a valid data-only UI contract')
