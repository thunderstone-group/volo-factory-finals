"""Practice-branch execution for the four pinned public small tasks.

The model writes the HTML or exact edits. Only file aliases and execution machinery
are supplied here; there are no prewritten counter/dice product implementations.
"""
import json
import re
import time

from .agent import Agent
from .web_runtime import scaffold


FILES = {'h': 'frontend/public/index.html', 'j': 'frontend/public/app.js', 'a': 'backend/api.cjs'}
HTML_SYSTEM = ('Return only a minimal working HTML fragment with inline JavaScript. '
               'Match labels and data-testid exactly. No document wrappers, CSS, comments or tests.')
EVOLUTION_SYSTEM = ('Update the supplied page. Return only a minimal HTML fragment with all JavaScript inline. '
                    'Preserve existing behavior; test IDs use data-testid. No document wrappers, CSS or tests.')
DEFAULT_API = 'module.exports=async(req,res)=>false;'


def unfence(content):
    if not isinstance(content, str) or not content.strip():
        raise ValueError('The model must return nonempty product code')
    text = content.strip()
    match = re.fullmatch(r'```(?:html|json|javascript|js)?\s*\n(.*?)\n```', text, re.S)
    return match.group(1).strip() if match else text


def source_text(sources):
    labels = {'h': 'Existing HTML', 'j': 'Existing JavaScript'}
    return '\n'.join(f'{labels[key]}:\n{content}' for key, content in sources.items() if key in labels)


class PracticeAgent(Agent):
    def product_sources(self):
        return {key: self.workspace.path(path).read_text()
                for key, path in FILES.items()
                if self.workspace.path(path).is_file() and self.workspace.path(path).stat().st_size}

    def run_batch(self, nodes):
        if not self.public_checks_only:
            return super().run_batch(nodes)
        task = self.workspace.acceptance_suite.bundled_task
        incremental = task.startswith('smoke-evolution--')
        sources = self.product_sources() if incremental else {}
        if incremental and not sources.get('h'):
            raise ValueError('The practice evolution task needs its supplied application')
        if incremental and sources.get('a', '').strip() not in ('', DEFAULT_API):
            return super().run_batch(nodes)
        if sum(len(value) for value in sources.values()) > 12000:
            return super().run_batch(nodes)
        descriptions = [node['description'] for node in nodes]
        if incremental:
            scope = self.workspace.acceptance_requirement_ids
            try:
                self.workspace.acceptance_requirement_ids = ['REQ-1']
                prior = self.workspace.verify([])
            finally:
                self.workspace.acceptance_requirement_ids = scope
            self.trace.event('practice_existing_behavior', passed=prior['passed'],
                             source_fingerprint=prior['source_fingerprint'])
            if prior['passed']:
                descriptions = [node['description'] for node in nodes if node['id'] != 'REQ-1']
            sources = self.product_sources()
        else:
            scaffold(self.workspace)
        prompt = '\n'.join(descriptions)
        if sources:
            prompt += '\n' + source_text(sources)
        messages = [{'role': 'system', 'content': EVOLUTION_SYSTEM if incremental else HTML_SYSTEM},
                    {'role': 'user', 'content': prompt}]
        self.model.thinking = 'disabled'
        maximum = self.model.max_output
        self.model.max_output = min(maximum, 2048)
        self.trace.event('practice_profile', task=task, format='html', incremental=incremental,
                         prompt_chars=len(prompt), requirement_descriptions=descriptions)
        try:
            for attempt in range(3):
                self.guard_budget()
                message, reason = self.model.complete(messages, [],
                    remaining_seconds=self.workspace.deadline - time.monotonic())
                messages.append(message)
                try:
                    if reason == 'length':
                        raise ValueError('Product output was truncated; return a shorter complete response')
                    content = unfence(message.get('content'))
                    result = self.dispatch('build_app', {'index_html': content})
                except (ValueError, TypeError, KeyError, OSError, TimeoutError) as error:
                    result = {'passed': False, 'error': str(error)}
                self.trace.event('practice_attempt', attempt=attempt + 1, passed=result.get('passed', False),
                                 result=result)
                if result.get('passed'):
                    self.check_command = result['check_command']
                    return
                feedback = {'error': result.get('error'),
                            'public_cases': result.get('acceptance', {}).get('cases', [])}
                if incremental:
                    sources = self.product_sources()
                followup = json.dumps(feedback, ensure_ascii=False, separators=(',', ':'))
                if incremental:
                    followup += '\n' + source_text(sources)
                messages.append({'role': 'user', 'content': followup})
        finally:
            self.model.max_output = maximum
        raise RuntimeError('Practice product did not pass fixed acceptance within three attempts')
