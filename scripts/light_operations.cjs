// Offline semantic recorder for public Light specs and emitted CommonJS tests.
// Independent of the Python sentence parser. No browser or application is loaded.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { babelTransform } = require(path.join(path.dirname(require.resolve('playwright/package.json')), 'lib/transform/babelBundle.js'));
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const normalize = value => {
  if (value instanceof Locator) return value.parts;
  if (Object.prototype.toString.call(value) === '[object RegExp]') return { regex: value.source, flags: value.flags };
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k, normalize(v)]));
  return value === undefined ? null : value;
};
let operations = [], steps = [], native = true;
function record(operation, target, value) {
  const parts = target instanceof Locator ? target.parts : [];
  const last = parts.at(-1) || ['page', null];
  operations.push([operation, last[0], normalize(last[1]), normalize(parts.slice(0, -1)), normalize(value)]);
}
class Locator {
  constructor(parts = []) { this.parts = parts; }
  getByRole(role, options) {
    if (options && options.exact !== true) throw Error('non-exact role locator');
    return new Locator([...this.parts, [role, options?.name ?? null]]);
  }
  getByLabel(name, options) {
    if (options?.exact !== true) throw Error('non-exact field locator');
    return new Locator([...this.parts, ['label', name]]);
  }
  getByText(name, options) {
    if (typeof name === 'string' && options?.exact !== true) throw Error('non-exact text locator');
    return new Locator([...this.parts, ['text', name]]);
  }
  locator(selector) { return new Locator([...this.parts, ['selector', selector]]); }
  or(other) {
    if (JSON.stringify(normalize(this.parts.slice(0,-1))) !== JSON.stringify(normalize(other.parts.slice(0,-1))) ||
        JSON.stringify(normalize(this.parts.at(-1)[1])) !== JSON.stringify(normalize(other.parts.at(-1)[1]))) throw Error('unsupported locator union');
    return new Locator([...this.parts.slice(0,-1), [this.parts.at(-1)[0] + '|' + other.parts.at(-1)[0], this.parts.at(-1)[1]]]);
  }
  async goto(value) { record('goto', this, value); }
  async focus() { record('focus', this); }
  async press(value) { record('press', this, value); }
  async check() { record('check', this); }
  async click() { record('click', this); }
  async fill(value) { record('fill', this, value); }
  async setChecked(value) { record('setChecked', this, value); }
  async selectOption(value) { record('selectOption', this, value); }
  async inputValue() { record('inputValue', this); return 'https://example.invalid/record'; }
  async evaluate(fn) {
    const source = fn.toString();
    if (/element\.tagName === ['"]SELECT['"]/.test(source)) { record('nativeSelect', this); return native; }
    if (/navigator\.clipboard\.readText\(\)/.test(source)) { record('clipboardRead', this); return 'https://example.invalid/record'; }
    throw Error('unrecognized evaluate: ' + source);
  }
}
function expect(target) {
  return new Proxy({}, { get(_, method) {
    if (method === 'then') return undefined;
    return (...args) => record(String(method), target, { args, ...(target instanceof Locator ? {} : {actual: target}) });
  }});
}
expect.poll = fn => new Proxy({}, {get(_,method) {
  return async (...args) => { const value = await fn(); record('poll.' + String(method), null, {args, actual:value}); };
}});
const helpers = {
  named: (scope, role, name) => scope.getByRole(role, {name, exact:true}),
  field: (scope, name) => scope.getByLabel(name, {exact:true}),
  visible: async locator => record('visible', locator),
  activate: async (scope,name) => record('activate', scope.getByRole('link', {name,exact:true}).or(scope.getByRole('button',{name,exact:true}))),
  button: async (scope,name) => record('button', scope.getByRole('button',{name,exact:true})),
  fill: async (scope,name,value) => record('fill', scope.getByLabel(name,{exact:true}), value),
  choose: async (scope,name,value) => record('choose', scope.getByRole('combobox',{name,exact:true}), value),
  selected: async (scope,name,value) => record('selected', scope.getByRole('combobox',{name,exact:true}), value),
  checked: async (scope,name,value) => record('checked', scope.getByRole('checkbox',{name,exact:true}), value),
  text: async (scope,value) => record('text', scope.getByText(value,{exact:true})),
  order: async (scope,name,value) => record('order', scope.getByRole('list',{name,exact:true}), value),
};
function load(file, test, helperModule = helpers) {
  const mod = {exports:{}};
  let source = fs.readFileSync(file, 'utf8');
  source = source.replace(/^\s*\/\/ (GIVEN|WHEN|THEN): (.*)$/gm, (_,keyword,raw) => {
    const content = raw.startsWith('"') ? JSON.parse(raw) : raw;
    return `markStep(${JSON.stringify(keyword)}, ${JSON.stringify(content)});`;
  });
  const code = babelTransform(source, file, false, [], []).code;
  const sandbox = {module: mod, exports: mod.exports, URL, Buffer, RegExp,
    markStep(keyword,content) { operations=[]; steps.push({keyword,content,operations}); },
    require(name) {
      if (name === '@playwright/test') return {test,expect};
      if (name === './helpers' || name === './light-helpers.cjs') return helperModule;
      throw Error('unexpected import: ' + name);
    }};
  vm.runInNewContext(code, sandbox, {filename:file,timeout:1000});
  return mod.exports;
}
(async () => {
  const result = {};
  for (const file of input.files || []) {
    const cases=[], use=[];
    function test(title,fn) { cases.push({title,fn}); }
    test.use = options => use.push(options);
    load(file,test);
    for (const {title,fn} of cases) {
      if (input.ids && !input.ids.includes(title.split(': ')[0])) continue;
      steps=[]; operations=[];
      await fn({page:new Locator()});
      result[title.split(': ')[0]] = {title,steps,storage:use.find(v=>v.storageState)?.storageState};
    }
  }
  if (input.helper) {
    const h=load(input.helper, () => {});
    const page=new Locator(); const scope=page.getByRole('region',{name:'Container',exact:true});
    operations=[];
    await h.visible(h.named(scope,'heading','Heading'));
    await h.activate(scope,'Go'); await h.button(scope,'Submit'); await h.fill(scope,'Input','Value');
    for (const branch of [true,false]) {native=branch; await h.choose(scope,'Choice','Option'); await h.selected(scope,'Choice','Option');}
    await h.checked(scope,'Toggle',true); await h.checked(scope,'Toggle',false);
    await h.text(scope,'Message'); await h.order(scope,'Entries',['Alpha','Beta']);
    result.helpers=operations;
  }
  process.stdout.write(JSON.stringify(result));
})().catch(error => {console.error(error.stack); process.exitCode=1;});
