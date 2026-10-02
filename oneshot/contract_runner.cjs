'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const strictAssert = require('node:assert/strict');
const probes = JSON.parse(fs.readFileSync(0, 'utf8'));
const results = [];
for (const p of probes) {
  const calls = Object.create(null);
  let assertions = 0;
  const assert = new Proxy(strictAssert, {
    apply(target, self, args) { assertions++; return Reflect.apply(target, self, args); },
    get(target, key) {
      const value = Reflect.get(target, key);
      return typeof value === 'function' && key !== 'AssertionError'
        ? (...args) => { assertions++; return Reflect.apply(value, target, args); } : value;
    }
  });
  const context = vm.createContext({ assert, clearTimeout, clearInterval });
  context.window = context;
  const globalObject = vm.runInContext('globalThis', context);
  const originals = Object.create(null);
  function lookup(path) {
    let value = vm.runInContext(path[0], context, {timeout: 1000});
    for (const part of path.slice(1)) value = value[part];
    return value;
  }
  function ownerOf(f) { return lookup(f.owner || f.member.slice(0,-1)); }
  let phase = 'initializer';
  try {
    for (const source of p.initializers || []) vm.runInContext(source.code, context, {timeout: 1000});
    for (const f of p.functions.filter(f => f.callable !== false)) {
      const fn = vm.runInContext('"use strict"; (' + f.code + ')', context, { timeout: 1000 });
      if (typeof fn !== 'function') throw new Error('Source binding is not callable: ' + f.alias);
      originals[f.alias] = fn;
      calls[f.alias] = 0;
      Object.defineProperty(context, f.alias, { configurable: false, writable: false,
        value: function (...args) {
          calls[f.alias]++;
          const self = (f.owner || f.member) && (this == null || this === globalObject || this === context)
            ? ownerOf(f) : this;
          return Reflect.apply(originals[f.alias], self, args);
        } });
    }
    phase = 'setup';
    vm.runInContext('"use strict";\n' + p.setup, context, { timeout: 1000 });
    function installMember(f) {
      if (!f.member) return;
      const owner = vm.runInContext(f.member[0], context, {timeout: 1000});
      if (!owner || (typeof owner !== 'object' && typeof owner !== 'function'))
        throw new Error('Source namespace is not an object: ' + f.member[0]);
      Object.defineProperty(owner, f.member[1], {value: context[f.alias],
        writable: f.callable === false && Boolean(f.mutable), configurable: false});
    }
    function bindValue(f) {
      const value = vm.runInContext('"use strict"; (' + f.code + ')', context, { timeout: 1000 });
      Object.defineProperty(context, f.alias, {value, writable: Boolean(f.mutable), configurable: false});
      installMember(f);
    }
    const values = p.functions.filter(f => f.callable === false && !f.member)
      .sort((a,b) => a.file.localeCompare(b.file) || a.line-b.line);
    for (const f of values) bindValue(f);
    for (const f of p.functions.filter(f => f.callable !== false && f.member)) installMember(f);
    for (const f of p.functions.filter(f => f.callable === false && f.member)) bindValue(f);
    for (const f of p.functions.filter(f => f.callable !== false && f.owner)) {
      const owner = ownerOf(f), actual = owner[f.property];
      if (typeof actual !== 'function') throw new Error('Source owner method is not callable: ' + f.qualified_name);
      let code = Function.prototype.toString.call(actual);
      if (f.method) code = (code.startsWith('async ') ? 'async ' : '') +
        'function' + (f.code.includes('function*') ? '*' : '') + code.slice(code.indexOf('('));
      if (code !== f.code) throw new Error('Object method no longer matches its exact source: ' + f.qualified_name);
      originals[f.alias] = actual;
      Object.defineProperty(owner, f.property, {value: context[f.alias], writable: false, configurable: false});
    }
    phase = 'precondition';
    vm.runInContext('"use strict";\n{\n' + (p.precondition || '') + '\n}', context, { timeout: 1000 });
    phase = 'check';
    assertions = 0;
    for (const alias of Object.keys(calls)) calls[alias] = 0;
    vm.runInContext('"use strict";\n{\n' + p.check + '\n}', context, { timeout: 1000 });
    if (!calls[p.subject]) throw new Error('The principal source function was never exercised');
    if (!assertions) throw new Error('The probe contains no executed assertion');
    results.push({ id: p.id, status: 'pass', calls, assertions });
  } catch (e) {
    const status = phase === 'check' && e.code === 'ERR_ASSERTION' && calls[p.subject] ? 'fail' : 'error';
    results.push({ id: p.id, status, calls, assertions, phase, error_name: e.name,
      message: String(e.message || e).slice(0, 1500), error: String(e.stack || e).slice(0, 2500) });
  }
}
process.stdout.write(JSON.stringify(results));
