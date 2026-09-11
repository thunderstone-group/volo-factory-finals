// Static analysis only: never evaluate the generated acceptance script.
const fs = require('node:fs');
const acorn = require('acorn');
const scope = require('eslint-scope');

const globals = new Set([...Object.getOwnPropertyNames(globalThis),
  'require', 'module', 'exports', '__filename', '__dirname',
  'window', 'document', 'navigator', 'location', 'localStorage', 'sessionStorage',
  'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'HTMLTextAreaElement',
  'MouseEvent', 'KeyboardEvent', 'Event', 'CustomEvent', 'MutationObserver']);

try {
  const source = fs.readFileSync(0, 'utf8');
  const ast = acorn.parse(source, {ecmaVersion: 2022, sourceType: 'script', ranges: true, locations: true});
  const manager = scope.analyze(ast, {ecmaVersion: 2022, sourceType: 'script', nodejsScope: true});
  const errors = manager.globalScope.through
    .filter(reference => !globals.has(reference.identifier.name))
    .map(reference => ({name: reference.identifier.name, line: reference.identifier.loc.start.line}));
  if (errors.length) {
    process.stderr.write('Undefined acceptance variables: ' + JSON.stringify(errors.slice(0, 20)) + '\n');
    process.exitCode = 1;
  }
} catch (error) {
  process.stderr.write('Acceptance JavaScript analysis failed: ' + error.message + '\n');
  process.exitCode = 1;
}
