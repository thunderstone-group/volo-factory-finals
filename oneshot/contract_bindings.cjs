'use strict';
const fs = require('node:fs');
const acorn = require('acorn');
const sources = JSON.parse(fs.readFileSync(0, 'utf8'));
const index = [];
for (const [file, source] of Object.entries(sources)) {
  let ast;
  try { ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'script' }); }
  catch (_) { ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module' }); }
  function add(name, kind, node, scope, mutable=false, method=false) {
    let code = source.slice(node.start, node.end);
    if (method && node.type === 'FunctionExpression')
      code = (node.async ? 'async ' : '') + 'function' + (node.generator ? '*' : '') + code;
    const callable = ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(node.type);
    index.push({ file, name, kind, scope, code, callable, mutable, method, node_type: node.type,
                 line: source.slice(0,node.start).split('\n').length });
  }
  function memberPath(node) {
    if (node && node.type === 'Identifier') return [node.name];
    if (!node || node.type !== 'MemberExpression') return [];
    const parent = memberPath(node.object);
    const key = node.computed ? (node.property.type === 'Literal' ? node.property.value : null) : node.property.name;
    return parent.length && typeof key === 'string' ? parent.concat(key) : [];
  }
  function normalized(path) {
    return path.length > 1 && ['window','globalThis'].includes(path[0]) ? path.slice(1) : path;
  }
  function propertyName(node) {
    if (node.computed && node.key.type !== 'Literal') return null;
    return node.key.type === 'Identifier' ? node.key.name : node.key.value;
  }
  function walk(node, scope='root', parent=null, owner=[]) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'FunctionDeclaration' && node.id) add(node.id.name, 'function', node, scope);
    if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier' && node.init) {
      const callable = ['FunctionExpression', 'ArrowFunctionExpression'].includes(node.init.type);
      add(node.id.name, callable ? 'function' : 'value', node.init, scope, parent && parent.kind !== 'const');
    }
    if (node.type === 'AssignmentExpression' && node.operator === '=' &&
        node.left.type === 'MemberExpression' && node.left.object.type === 'Identifier' &&
        (!node.left.computed || node.left.property.type === 'Literal')) {
      const root = node.left.object.name;
      const property = node.left.computed ? node.left.property.value : node.left.property.name;
      if (typeof property === 'string' && /^[A-Za-z_$][\w$]*$/.test(property)) {
        const callable = ['FunctionExpression', 'ArrowFunctionExpression'].includes(node.right.type);
        add(root + '.' + property, callable ? 'method' : 'value', node.right, scope, true);
        Object.assign(index[index.length - 1], {member: [root, property], leaf_name: property});
      }
    }
    if (node.type === 'Property' && node.kind === 'init' &&
        ['FunctionExpression', 'ArrowFunctionExpression'].includes(node.value.type)) {
      const name = propertyName(node);
      if (typeof name === 'string') {
        add(name, 'method', node.value, scope, false, node.method);
        if (owner.length) Object.assign(index[index.length - 1],
          {owner, property: name, qualified_name: owner.concat(name).join('.')});
      }
    }
    const nextScope = ['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(node.type)
      ? 'function@' + node.start : scope;
    for (const [key, value] of Object.entries(node)) {
      if (['start','end','loc'].includes(key)) continue;
      let childOwner = nextScope === scope ? owner : [];
      if (node.type === 'VariableDeclarator' && key === 'init' && node.id.type === 'Identifier')
        childOwner = [node.id.name];
      if (node.type === 'AssignmentExpression' && key === 'right') childOwner = normalized(memberPath(node.left));
      if (node.type === 'Property' && key === 'value') {
        const name = propertyName(node);
        childOwner = owner.length && typeof name === 'string' ? owner.concat(name) : [];
      }
      if (Array.isArray(value)) value.forEach(child => { if (child && child.type) walk(child,nextScope,node,childOwner); });
      else if (value && typeof value === 'object' && value.type) walk(value,nextScope,node,childOwner);
    }
  }
  walk(ast);
}
process.stdout.write(JSON.stringify(index));
