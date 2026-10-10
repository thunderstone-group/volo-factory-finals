'use strict';
const fs = require('node:fs');
const acorn = require('/var/folders/j8/60kxyby16mzdsdsy73k7w4bc0000gn/T/oneshot-contract-parser/node_modules/acorn');
const sources = JSON.parse(fs.readFileSync(0, 'utf8'));
const index = [];
for (const [file, source] of Object.entries(sources)) {
  const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
  function add(name, kind, node, scope, mutable=false, method=false) {
    let code = source.slice(node.start, node.end);
    if (method && node.type === 'FunctionExpression') code = (node.async ? 'async ' : '') + 'function' + code;
    const callable = ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(node.type);
    index.push({ file, name, kind, scope, code, callable, mutable, node_type: node.type,
                 line: source.slice(0,node.start).split('\n').length });
  }
  function walk(node, scope='root', parent=null) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'FunctionDeclaration' && node.id) add(node.id.name, 'function', node, scope);
    if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier' && node.init) {
      const callable = ['FunctionExpression', 'ArrowFunctionExpression'].includes(node.init.type);
      add(node.id.name, callable ? 'function' : 'value', node.init, scope, parent && parent.kind !== 'const');
    }
    if (node.type === 'Property' && !node.computed &&
        ['FunctionExpression', 'ArrowFunctionExpression'].includes(node.value.type)) {
      const name = node.key.type === 'Identifier' ? node.key.name : node.key.value;
      if (typeof name === 'string') add(name, 'method', node.value, scope, false, node.method);
    }
    const nextScope = ['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(node.type)
      ? 'function@' + node.start : scope;
    for (const [key, value] of Object.entries(node)) {
      if (['start','end','loc'].includes(key)) continue;
      if (Array.isArray(value)) value.forEach(child => { if (child && child.type) walk(child,nextScope,node); });
      else if (value && typeof value === 'object' && value.type) walk(value,nextScope,node);
    }
  }
  walk(ast);
}
process.stdout.write(JSON.stringify(index));
