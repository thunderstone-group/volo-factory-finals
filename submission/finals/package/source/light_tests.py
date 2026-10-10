"""Deterministic, all-or-nothing compilation of the Light interaction grammar.

Only requirements are inputs. No evaluator files, application code, model calls or
optional dependencies are used. Unrecognized steps leave the entire scenario to
the existing writer. Seed GIVEN prose is documentary under the fresh-home contract.
"""
import json
import re

try:
    from . import scenarios
except ImportError:  # flat competition package
    import scenarios

HOME = "The user opens the application home entry in a fresh browser context, signed out."
Q = r'("(?:\\.|[^"\\\n])*")'
SCOPE = rf'(current page|(?:region|form|dialog) named {Q})'
ROLES = r'(region|form|dialog|heading|status|alert|button|img|combobox|navigation|list)'
HELPER_FILE = "light-helpers.cjs"
SPEC_FILE = "t00-light.spec.cjs"

# Browser operations for the explicit semantic sentences accepted below.
HELPERS = '''const { expect } = require('@playwright/test');
const named = (scope, role, name) => scope.getByRole(role, { name, exact: true });
const field = (scope, name) => scope.getByLabel(name, { exact: true });
async function visible(locator) { await expect(locator).toHaveCount(1); await expect(locator).toBeVisible(); }
async function activate(scope, name) {
  const control = named(scope, 'link', name).or(named(scope, 'button', name));
  await visible(control); await expect(control).toBeEnabled(); await control.click();
}
async function button(scope, name) { const control = named(scope, 'button', name); await visible(control); await expect(control).toBeEnabled(); await control.click(); }
async function fill(scope, name, value) { const input = field(scope, name); await visible(input); await input.fill(value); }
async function choose(scope, name, option) {
  const control = named(scope, 'combobox', name); await visible(control);
  const native = await control.evaluate(element => element.tagName === 'SELECT');
  if (native) await control.selectOption({ label: option });
  else { await control.click(); const item = named(scope, 'option', option); await visible(item); await item.click(); }
}
async function selected(scope, name, option) {
  const control = named(scope, 'combobox', name); await visible(control);
  const native = await control.evaluate(element => element.tagName === 'SELECT');
  if (native) await expect(control.locator('option:checked')).toHaveText(option);
  else await expect(control).toHaveText(option);
}
async function checked(scope, name, value) { const control = named(scope, 'checkbox', name); await visible(control); await control.setChecked(value); }
async function text(scope, value) { await visible(scope.getByText(value, { exact: true })); }
async function order(scope, listName, values) { const list = named(scope, 'list', listName); await visible(list); await expect(list.getByRole('listitem')).toHaveText(values); }
module.exports = { named, field, visible, activate, button, fill, choose, selected, checked, text, order };
'''
HEADER = ("const { test, expect } = require('@playwright/test');\n"
          "const { named, field, visible, activate, button, fill, choose, selected, checked, text, order } = "
          "require('./light-helpers.cjs');\n"
          "test.use({ storageState: { cookies: [], origins: [] } });\n\n")


def js(value):
    return json.dumps(value, ensure_ascii=True)


def named(scope, role, name):
    return f"named({scope}, {js(role)}, {js(name)})"


class Unsupported(ValueError):
    pass


class Compiler:
    def __init__(self, description):
        self.scopes = {}
        self.actions = {}
        self.fields = {}
        self.controls = {}
        self.selections = {}
        self.permalinks = {}
        self.current = None
        # Exact action declarations disambiguate button-only actions from navigation.
        declaration = rf'The {SCOPE} contains one (link or button|button) named {Q} when this action is available\.'
        for m in re.finditer(declaration, description):
            scope, _, role, name = m.groups()
            try:
                key = (scope, json.loads(name))
            except ValueError:
                continue  # malformed declarations cannot establish an action contract
            self.actions.setdefault(key, set()).add(role)

    def scope(self, phrase):
        if phrase == 'current page':
            return 'page'
        m = re.fullmatch(rf'(region|form|dialog) named {Q}', phrase)
        if not m:
            raise Unsupported('unknown scope')
        role, name = m[1], json.loads(m[2])
        return self.scopes.get((role, name), named('page', role, name))

    def scope_name(self, name, role=None):
        matches = [value for (r, n), value in self.scopes.items() if n == name and (role is None or r == role)]
        if len(matches) != 1:
            raise Unsupported('unresolved or ambiguous unquoted scope')
        return matches[0]

    def remember(self, role, name, scope):
        self.controls.setdefault((role, name), set()).add(scope)
        return named(scope, role, name)

    def known(self, role, name):
        scopes = set(self.controls.get((role, name), set()))
        for (phrase, control), roles in self.actions.items():
            if control == name and roles == {role}:
                scopes.add(self.scope(phrase))
        if len(scopes) != 1:
            raise Unsupported('unresolved or ambiguous implicit control')
        return named(next(iter(scopes)), role, name)

    def step(self, keyword, content):
        """Return JS statements, or raise Unsupported; never partially emit a step."""
        if keyword == 'GIVEN':
            return ["await page.goto('/');"] if content == HOME else []
        if keyword == 'WHEN':
            m = re.fullmatch(rf'The user activates {Q} in the {SCOPE}\.', content)
            if m:
                name, phrase = json.loads(m[1]), m[2]
                roles = self.actions.get((phrase, name), set())
                if len(roles) != 1:
                    raise Unsupported('missing or conflicting action declaration')
                role = next(iter(roles))
                scope = self.scope(phrase)
                self.remember(role, name, scope)
                return [f"await {'button' if role == 'button' else 'activate'}({scope}, {js(name)});"]
            m = re.fullmatch(rf'The user enters {Q} in the {Q} field in the {SCOPE}\.', content)
            if m:
                value, name, scope = json.loads(m[1]), json.loads(m[2]), self.scope(m[3])
                self.fields.setdefault(name, set()).add(scope)
                return [f'await fill({scope}, {js(name)}, {js(value)});']
            m = re.fullmatch(rf'The user selects {Q} in the {Q} combobox in the {SCOPE}\.', content)
            if m:
                value, name, scope = json.loads(m[1]), json.loads(m[2]), self.scope(m[3])
                self.selections[name] = (scope, value)
                return [f'await choose({scope}, {js(name)}, {js(value)});']
            m = re.fullmatch(rf'The user (checks|unchecks) {Q} in the {SCOPE}\.', content)
            if m:
                return [f'await checked({self.scope(m[3])}, {m[2]}, {js(m[1] == "checks")});']
            m = re.fullmatch(r'The user focuses the textbox labelled ([^"\n]+?)(?: again)?\.', content)
            if m:
                return [f'await field(page, {js(m[1])}).focus();']
            m = re.fullmatch(r'The user presses (Enter|Tab|Escape) in ([^"\n]+)\.', content)
            if m:
                return [f'await field(page, {js(m[2])}).press({js(m[1])});']
            m = re.fullmatch(r'The user selects the ([^"\n]+) radio in the ([^"\n]+) form\.', content)
            if m:
                target = self.remember('radio', m[1], self.scope_name(m[2], 'form'))
                return [f'await visible({target});', f'await {target}.check();']
        if keyword == 'THEN':
            m = re.fullmatch(rf'The (region|form|dialog) named {Q} is visible\.', content)
            if m:
                key = (m[1], json.loads(m[2]))
                lines = []
                if key not in self.scopes:
                    variable = f'scope{len(self.scopes)}'
                    lines.append(f'const {variable} = {named("page", *key)};')
                    self.scopes[key] = variable
                self.current = self.scopes[key]
                return lines + [f'await visible({self.current});']
            m = re.fullmatch(rf'The {ROLES} named {Q} is (visible exactly once|absent) in the {SCOPE}\.', content)
            if m:
                target = self.remember(m[1], json.loads(m[2]), self.scope(m[4]))
                return [f'await visible({target});' if m[3] == 'visible exactly once' else f'await expect({target}).toHaveCount(0);']
            m = re.fullmatch(rf'The exact text {Q} is (visible exactly once|absent) in the {SCOPE}\.', content)
            if m:
                scope, value = self.scope(m[3]), m[1]
                return [f'await text({scope}, {value});' if m[2] == 'visible exactly once'
                        else f'await expect({scope}.getByText({value}, {{ exact: true }})).toHaveCount(0);']
            m = re.fullmatch(rf'The {Q} list in the {SCOPE} contains exactly these entries in order: (\[.*\])\.', content)
            if m:
                values = json.loads(m[4])
                if not isinstance(values, list) or not all(isinstance(v, str) for v in values):
                    raise Unsupported('list entries must be strings')
                return [f'await order({self.scope(m[2])}, {m[1]}, {js(values)});']
            m = re.fullmatch(rf'The {Q} field in the {SCOPE} displays {Q}\.', content)
            if m:
                return [f'await expect(field({self.scope(m[2])}, {m[1]})).toHaveValue({m[4]});']
            m = re.fullmatch(rf'The {Q} checkbox is (checked|unchecked) in the {SCOPE}\.', content)
            if m:
                target = named(self.scope(m[3]), 'checkbox', json.loads(m[1]))
                return [f'await expect({target}).toBeChecked({{ checked: {js(m[2] == "checked")} }});']
            m = re.fullmatch(r'The ([^"\n]+) input masks the password\.', content)
            if m:
                scopes = self.fields.get(m[1], set())
                if len(scopes) != 1:
                    raise Unsupported('password field scope is not established')
                return [f'await expect(field({next(iter(scopes))}, {js(m[1])})).toHaveAttribute("type", "password");']
            m = re.fullmatch(rf'The field labelled {Q} is visible in ([^"\n]+)\.', content)
            if m:
                return [f'await visible(field({self.scope_name(m[2])}, {m[1]}));']
            m = re.fullmatch(r'The textbox labelled ([^"\n]+) remains visible\.', content)
            if m:
                return [f'await visible(field(page, {js(m[1])}));']
            m = re.fullmatch(r'([^"\n]+) remains available as a link or button\.', content)
            if m:
                return [f'await visible({named("page", "link", m[1])}.or({named("page", "button", m[1])}));']
            m = re.fullmatch(r'The [^()\n]+ heading \((U\+[0-9A-Fa-f]{4,6}(?: U\+[0-9A-Fa-f]{4,6})*)\) and [^()\n]+ navigation control \((U\+[0-9A-Fa-f]{4,6}(?: U\+[0-9A-Fa-f]{4,6})*)\) are visible\.', content)
            if m:
                heading, control = [''.join(chr(int(c[2:], 16)) for c in codes.split()) for codes in m.groups()]
                return [f'await visible({named("page", "heading", heading)});',
                        f'await visible({named("page", "link", control)}.or({named("page", "button", control)}));']
            m = re.fullmatch(r'([^"\n]+) is (?:initially )?(unpressed|pressed)\.', content)
            if m:
                return [f'await expect({self.known("button", m[1])}).toHaveAttribute("aria-pressed", {js(str(m[2] == "pressed").lower())});']
            m = re.fullmatch(r'([^"\n]+) is absent from ([^"\n]+)\.', content)
            if m:
                scope = self.scope_name(m[2])
                return [f'await expect({named(scope, "link", m[1])}.or({named(scope, "button", m[1])})).toHaveCount(0);']
            m = re.fullmatch(r'([^"\n]+) remains selected(?: and the ([^"\n]+) form stays visible)?\.', content)
            if m:
                lines = [f'await expect({self.known("radio", m[1])}).toBeChecked();']
                if m[2]:
                    lines.append(f'await visible({self.scope_name(m[2], "form")});')
                return lines
            m = re.fullmatch(r'(.+) remain selected\.', content)
            if m:
                # Resolve unquoted name/value pairs only against earlier explicit selections.
                parts = m[1].split(' and ')
                matches = [[(n, s, v) for n, (s, v) in self.selections.items() if f'{n} {v}' == part] for part in parts]
                if len(parts) < 2 or any(len(found) != 1 for found in matches):
                    raise Unsupported('ambiguous retained selections')
                return [f'await selected({s}, {js(n)}, {js(v)});' for [(n, s, v)] in matches]
            m = re.fullmatch(rf'([^"\n]+) displays exactly one nonempty [^"\n]+ as {Q}\.', content)
            if m:
                pattern = json.loads(m[2])
                if not pattern.endswith('<value>') or pattern.count('<value>') != 1:
                    raise Unsupported('nonempty value needs a literal prefix and <value>')
                regex = '^' + re.escape(pattern[:-7]).replace(r'\ ', ' ') + r'\S.*$'
                return [f'await visible({self.scope_name(m[1])}.getByText(new RegExp({js(regex)})));']
            m = re.fullmatch(r'([^"\n]+) is a readonly input containing an absolute HTTP\(S\) permalink\.', content)
            if m:
                if self.current is None:
                    raise Unsupported('no established input scope')
                target = f'field({self.current}, {js(m[1])})'
                variable = f'permalink{len(self.permalinks)}'
                self.permalinks[m[1]] = variable
                return [f'await visible({target});', f'await expect({target}).toHaveAttribute("readonly", /.*/);',
                        f'const {variable} = await {target}.inputValue();',
                        f'expect(new URL({variable}).protocol).toMatch(/^https?:$/);']
            m = re.fullmatch(r'The browser clipboard contains exactly the displayed ([^"\n]+)\.', content)
            if m and m[1] in self.permalinks:
                return [f'await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe({self.permalinks[m[1]]});']
        raise Unsupported('unrecognized sentence')


def compile_scenario(item, description):
    compiler = Compiler(description)
    steps = item.get('steps') or []
    home = bool(steps and steps[0] == {'keyword': 'GIVEN', 'content': HOME})
    executable = {s['keyword'] for s in steps} >= {'WHEN', 'THEN'}
    lines, rejected, parsed = [], [], 0
    for index, step in enumerate(steps):
        try:
            if not home or not executable:
                raise Unsupported('needs fresh-home GIVEN, WHEN and THEN')
            if index and step['content'] == HOME:
                raise Unsupported('fresh-home GIVEN must occur only at the start')
            result = compiler.step(step['keyword'], step['content'])
        except ValueError as exc:
            rejected.append({**step, 'index': index + 1, 'reason': str(exc)})
            continue
        parsed += 1
        # JSON-escaped line comments keep multiline seed prose/code-like inputs inert.
        lines.append('// ' + step['keyword'] + ': ' + js(step['content']))
        lines.extend(result)
    return {'source': '\n'.join('  ' + line for line in lines) if not rejected else None,
            'parsed': parsed, 'total': len(steps), 'uncompiled': rejected}


def compile_requirements(text):
    """Return each scenario's source/coverage. A None source means model fallback."""
    requirements = scenarios.load_requirements(text)
    by_id = {r['id']: r for r in requirements}
    result = []
    for req in requirements:
        if req['type'] != 'ATOMIC':
            continue
        descriptions, ancestor = [], req
        seen = set()
        while ancestor and ancestor['id'] not in seen:
            seen.add(ancestor['id'])
            descriptions.append(ancestor['description'])
            ancestor = by_id.get(ancestor['parent'])
        for index, item in enumerate(req['scenarios'], 1):
            result.append({'id': req['id'] + (f'#{index}' if index > 1 else ''), 'name': item['name'],
                           **compile_scenario(item, '\n'.join(descriptions))})
    return result


def render(compiled):
    return HEADER + '\n\n'.join('test(' + js(s['id'] + ': ' + s['name']) + ', async ({ page }) => {\n'
                               + s['source'] + '\n});' for s in compiled) + '\n'


def write_compiled(suite, compiled):
    """Materialize already compiled sources in the existing manifest record format."""
    if not compiled:
        return []
    (suite / HELPER_FILE).write_text(HELPERS, encoding='utf-8')
    (suite / SPEC_FILE).write_text(render(compiled), encoding='utf-8')
    return [{'file': SPEC_FILE, 'scenarios': [s['id'] for s in compiled], 'calls': 0,
             'tests': [s['id'] + ': ' + s['name'] for s in compiled], 'compiler': 'light'}]
