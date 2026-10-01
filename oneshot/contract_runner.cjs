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
  let phase = 'initializer';
  try {
    for (const source of p.initializers || []) vm.runInContext(source.code, context, {timeout: 1000});
    for (const f of p.functions.filter(f => f.callable !== false)) {
      const fn = vm.runInContext('"use strict"; (' + f.code + ')', context, { timeout: 1000 });
      if (typeof fn !== 'function') throw new Error('Source binding is not callable: ' + f.alias);
      calls[f.alias] = 0;
      Object.defineProperty(context, f.alias, { configurable: false, writable: false,
        value: function (...args) { calls[f.alias]++; return Reflect.apply(fn, this, args); } });
    }
    phase = 'setup';
    vm.runInContext('"use strict";\n' + p.setup, context, { timeout: 1000 });
    const values = p.functions.filter(f => f.callable === false);
    for (const f of values) {
      const value = vm.runInContext('"use strict"; (' + f.code + ')', context, { timeout: 1000 });
      Object.defineProperty(context, f.alias, {value, writable: Boolean(f.mutable), configurable: false});
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
