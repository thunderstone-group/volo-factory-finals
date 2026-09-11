const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const destination = path.resolve(__dirname, '../../volo/vendor');
fs.mkdirSync(destination, {recursive: true});
esbuild.buildSync({entryPoints: [path.join(__dirname, 'index.cjs')], bundle: true,
  platform: 'node', format: 'cjs', target: 'node20', minify: true,
  outfile: path.join(destination, 'acceptance-lint.cjs'), legalComments: 'inline'});
const packages = ['acorn', 'eslint-scope', 'estraverse', 'esrecurse'];
const licenses = packages.map(name => {
  const directory = path.join(__dirname, 'node_modules', name);
  const info = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
  const filename = ['LICENSE', 'LICENSE.BSD'].find(file => fs.existsSync(path.join(directory, file)));
  const license = filename ? fs.readFileSync(path.join(directory, filename), 'utf8')
    : fs.readFileSync(path.join(directory, 'esrecurse.js'), 'utf8').split('*/', 1)[0] + '*/';
  return name + '@' + info.version + '\n' + license;
});
fs.writeFileSync(path.join(destination, 'THIRD_PARTY_LICENSES.txt'), licenses.join('\n\n'));
