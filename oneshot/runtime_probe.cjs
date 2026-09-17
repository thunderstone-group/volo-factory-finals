// Trusted, read-only controller. Applications run as a different UID.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const emit = x => process.stdout.write(JSON.stringify(x));
const mode = process.argv[2];
function inventory(root) {
  const result = {};
  function walk(dir) {
    for (const name of fs.readdirSync(dir).sort()) {
      const file = path.join(dir, name), stat = fs.lstatSync(file);
      if (stat.isSymbolicLink()) throw new Error('Source link refused');
      if (stat.isDirectory()) walk(file);
      else if (stat.isFile()) result[path.relative(root, file)] = hash(fs.readFileSync(file));
      else throw new Error('Nonregular source refused');
    }
  }
  walk(root); return result;
}
try {
  if (mode === 'copy') {
    fs.cpSync('/input', '/work', {recursive:true}); emit({copied:true});
  } else if (mode === 'versions') {
    const cp = require('node:child_process');
    emit({node:process.version, npm:cp.execFileSync('npm',['--version'],{timeout:5000}).toString().trim(), uid:process.getuid()});
  } else if (mode === 'integrity') {
    const before = inventory('/input'), changed = [];
    for (const [name, digest] of Object.entries(before)) {
      const p = path.join('/work',name);
      try { if (fs.lstatSync(p).isSymbolicLink() || hash(fs.readFileSync(p)) !== digest) changed.push(name); }
      catch { changed.push(name); }
    }
    emit({changed});
  } else if (mode === 'built') {
    const p = '/work/frontend/dist/index.html', s = fs.lstatSync(p);
    if (!s.isFile() || s.isSymbolicLink() || s.size === 0 || s.size > 1048576) throw new Error('Missing/empty/oversized dist/index.html');
    emit({bytes:s.size, sha256:hash(fs.readFileSync(p))});
  } else if (mode === 'health' || mode === 'home') {
    const request = http.get({host:'127.0.0.1',port:3301,path:mode === 'health' ? '/api/health' : '/',timeout:800}, response => {
      const chunks = []; let size = 0;
      response.on('data', data => {
        size += data.length;
        if (size > 1048576) { request.destroy(new Error('response_limit')); return; }
        chunks.push(data);
      });
      response.on('end', () => {
        const bytes = Buffer.concat(chunks);
        const result = {http_status:response.statusCode, content_type:response.headers['content-type'] || '', bytes:size, sha256:hash(bytes)};
        if (mode === 'health') {
          try { result.json = JSON.parse(bytes.toString()); }
          catch { result.body_excerpt = bytes.toString().slice(0,1024); }
        }
        emit(result);
      });
      response.on('error', error => { emit({error:error.code || error.message}); process.exitCode=2; });
    });
    request.on('timeout', () => request.destroy(new Error('request_timeout')));
    request.on('error', error => { emit({error:error.code || error.message}); process.exitCode=2; });
  } else throw new Error('Unknown probe mode');
} catch (error) { emit({error:error.code || error.message}); process.exitCode=2; }
