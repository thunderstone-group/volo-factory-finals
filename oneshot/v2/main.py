#!/usr/bin/env python3
"""Opt-in minimal V2: a fixed two-file interaction base, business code from the model."""
import argparse
from contextlib import contextmanager
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import tempfile
import time

try:
    import v1 as adapter
except ModuleNotFoundError:
    from oneshot.v1 import main as adapter
core = adapter.core
HERE = Path(__file__).resolve().parent
PROTECTED = {'frontend/public/volo-interaction.js': 'interaction.js',
             'frontend/public/volo-navigation.js': 'navigation.js',
             'backend/volo-bootstrap.cjs': 'navigation.js'}

INTEGRATION = """
## Supplied application source contract
Extend the supplied empty starter into the requested application. Its two volo-*.js
modules and the backend CommonJS copy are provided implementation: keep their bytes unchanged.
Do not re-emit them. They are retained automatically. Replace the empty business
stub and implement all task behavior. Do not retain a fictitious sample application.

Use VoloInteraction.editor for actual creation AND editing entry paths. Its open(values,
identity) fills and opens the editor; submit awaits onSave(values,identity), then closes.
Specify name, formName, fields [{name,label,type?,required?}], saveLabel and cancelLabel.
Use presentation:'inline' with an owner node for a page/inline editor, or 'dialog' for
a modal editor. These share the same state/save implementation. Choose from task needs,
not a supposed universal test rule. Types include text, email, password, checkbox,
textarea and richtext (basic text formatting only; application-specific tools are yours).
Name fields and actions from the current requirements; define requested labels once
and pass them unchanged. The provided button function keeps names free of decoration.
Use rowActions(owner, name, [{label,onClick}]) for each entity's actions: it rejects
duplicate names in one row. Use popover(owner,name,contentNode) for contextual menus,
color/label choices, keeping their DOM inside the invoking row/editor. These helpers
do not implement business operations, colors, authentication, filters or persistence.
Implement those from the requirements. Style the supplied DOM with your own CSS.

Keep the classic script order: volo-navigation.js, volo-interaction.js,
/api/bootstrap.js, app.js. The server calls writeBootstrap(res, initialStateFor(req))
from ./volo-bootstrap.cjs (the same navigation source, independent of package type);
initialize required seed data before accepting
requests. Include the data needed for immediate view navigation, respecting user/data
access boundaries. This script loads before app.js; never replace it with a late fetch.
Use VoloNavigation.create({root,render(route,state,nav)}). The render callback returns
a DOM node/fragment synchronously. Use the callback's nav argument for its initial
render. Use nav.link(name,route) and nav.go(route) for view/entity navigation; they
render the destination immediately from prepared state. Await API mutations, then
nav.update(theUpdatedState). The server must serve index.html on application routes.
The fixed modules are not a claim about unspecified benchmark roles or exact names.
"""

INDEX = '''<!doctype html><html><head><meta charset="utf-8"><title>Application</title></head>
<body><main id="app"></main>
<script src="/volo-navigation.js"></script><script src="/volo-interaction.js"></script>
<script src="/api/bootstrap.js"></script><script src="/app.js"></script></body></html>'''
SERVER = '''const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {writeBootstrap}=require('./volo-bootstrap.cjs');
// Replace this empty business state, API and views with the supplied requirements.
const state={};
http.createServer((req,res)=>{try{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/api/health'){res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({code:200,message:'Backend Ready'}));}
 if(url.pathname==='/api/bootstrap.js')return writeBootstrap(res,state);
 if(url.pathname.startsWith('/api/')){res.writeHead(404);return res.end('Not found');}
 const root=path.resolve('../frontend/dist');let file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
 if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);return res.end('Forbidden');}
 if(!fs.existsSync(file)||!fs.statSync(file).isFile())file=path.join(root,'index.html');
 const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json'};
 res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(fs.readFileSync(file));
}catch(e){res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:String(e.message)}));}}).listen(process.env.PORT);
'''
APP = '''VoloNavigation.create({root:document.getElementById('app'),render(route,state,nav){
 const section=document.createElement('section');return section;
}});
'''


def diagnostic_transport(opener, budget, key):
    """Observe the existing transport without changing requests, parsing or retries."""
    def clean(value, limit=1024):
        text = str(value)
        if key:
            for secret in (json.dumps(key)[1:-1], key):
                text = text.replace(secret, '[REDACTED]')
        text = re.sub(r'(?i)\bBearer\s+[^\s\"\',;]+', 'Bearer [REDACTED]', text)
        text = re.sub(r'''(?ix)(["']?(?:authorization|x-api-key|api[_-]?key|access_token|refresh_token|cookie|password|secret)["']?\s*[:=]\s*)("[^"\r\n]*"|'[^'\r\n]*'|[^\s,;}]+)''',
                      r'\1"[REDACTED]"', text)
        return text[:limit]

    @contextmanager
    def observed(req, timeout):
        record = budget.attempts[-1]
        d = {'schema': 'minimal-stream/v1', 'http_status': None, 'request_ids': {},
             'bytes_received': 0, 'data_events': 0, 'content_chars': 0,
             'reasoning_chars': 0, 'done': False, 'finish_reason': None, 'tail': []}
        record['transport'] = d

        def emit(stage):
            print('[minimal] transport ' + json.dumps({'call': record['call'], 'stage': stage,
                  **d}, ensure_ascii=False), file=sys.stderr, flush=True)

        def headers(response):
            d['http_status'] = getattr(response, 'status', getattr(response, 'code', None))
            h = getattr(response, 'headers', None) or {}
            d['request_ids'] = {name: clean(h.get(name), 256) for name in
                                ('x-request-id', 'request-id', 'x-correlation-id', 'traceparent')
                                if h.get(name)}

        def lines(response):
            for raw in response:
                d['bytes_received'] += len(raw)
                if raw.startswith(b'data:'):
                    payload = raw[5:].strip()
                    d['data_events'] += 1
                    meta = {'event': d['data_events'], 'bytes': len(payload)}
                    if payload == b'[DONE]':
                        d['done'] = True
                        meta['kind'] = 'done'
                    else:
                        try:
                            obj = json.loads(payload)
                        except (ValueError, UnicodeError):
                            obj = None
                            d['failure_kind'] = 'malformed_event'
                            d['event_preview'] = clean(payload.decode('utf-8', 'replace'))
                        if isinstance(obj, dict):
                            meta['keys'] = [clean(k, 80) for k in list(obj)[:12]]
                            if 'error' in obj:
                                d['failure_kind'] = 'upstream_error_event'
                                d['upstream_error'] = clean(json.dumps(obj['error'], ensure_ascii=False))
                            choices = obj.get('choices')
                            if isinstance(choices, list):
                                for choice in choices:
                                    if not isinstance(choice, dict):
                                        continue
                                    delta = choice.get('delta')
                                    if isinstance(delta, dict):
                                        for field, counter in (('content', 'content_chars'),
                                                               ('reasoning_content', 'reasoning_chars')):
                                            if isinstance(delta.get(field), str):
                                                d[counter] += len(delta[field])
                                    if choice.get('finish_reason'):
                                        d['finish_reason'] = clean(choice['finish_reason'], 80)
                            if obj.get('id') is not None:
                                d['response_id'] = clean(obj['id'], 256)
                        elif 'failure_kind' not in d:
                            d['failure_kind'] = 'invalid_event_shape'
                    d['tail'] = (d['tail'] + [meta])[-6:]
                    if d['data_events'] == 1 or d.get('failure_kind') or d['done']:
                        emit('event')
                yield raw  # The original parser receives exactly the same bytes.

        try:
            with opener(req, timeout=timeout) as response:
                headers(response)
                emit('opened')
                yield lines(response)
        except core.error.HTTPError as exc:
            headers(exc)
            d['failure_kind'] = 'http_error'
            if exc.fp is not None:
                try:
                    body = exc.read(4097)
                    d['http_body_preview'] = clean(body.decode('utf-8', 'replace'))
                    d['http_body_truncated'] = len(body) > 1024
                except Exception as read_error:
                    d['http_body_read_error'] = type(read_error).__name__
            raise
        except Exception as exc:
            d.setdefault('failure_kind', 'parser_error' if isinstance(exc, core.StreamError)
                         else 'transport_error')
            d['exception_type'] = type(exc).__name__
            d['exception_message'] = clean(exc, 512)
            raise
        finally:
            if 'failure_kind' not in d:
                if not d['done']:
                    d['failure_kind'] = 'missing_done_marker'
                elif d['finish_reason'] is None:
                    d['failure_kind'] = 'missing_finish_reason'
                elif d['finish_reason'] not in ('stop', 'length'):
                    d['failure_kind'] = 'unsupported_finish_reason'
                elif not d['content_chars']:
                    d['failure_kind'] = 'empty_content'
            emit('closed')
    return observed


def starter(root):
    files = {'frontend/package.json': json.dumps({'scripts': {'build': 'node build.cjs'}}),
             'frontend/build.cjs': "require('node:fs').cpSync('public','dist',{recursive:true});\n",
             'frontend/public/index.html': INDEX, 'frontend/public/app.js': APP,
             'backend/package.json': json.dumps({'scripts': {'start': 'node server.cjs'}}),
             'backend/server.cjs': SERVER}
    files.update({name: (HERE / source).read_text() for name, source in PROTECTED.items()})
    for name, content in files.items():
        path = root / name; path.parent.mkdir(parents=True, exist_ok=True); path.write_text(content)
    return {name: hashlib.sha256((root / name).read_bytes()).hexdigest() for name in PROTECTED}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('requirement_path', type=Path)
    parser.add_argument('--output-dir', required=True, type=Path)
    parser.add_argument('--type', default='web', choices=('web',))
    args = parser.parse_args(argv)
    key = os.environ.get('OPENAI_API_KEY')
    if not key:
        print('[oneshot] failed: OPENAI_API_KEY is not set', file=sys.stderr); return 1
    budget = adapter.TraceBudget(); started = time.monotonic()
    original_context = core.template_context
    original_open = core._open_model
    out = Path(os.path.abspath(args.output_dir))
    try:
        if out.is_symlink() or (out.exists() and (not out.is_dir() or any(out.iterdir()))):
            raise ValueError('V2 requires an absent or empty output directory')
        document, identity = adapter.load_inputs(args.requirement_path)
        print('[minimal] input ' + json.dumps(identity), file=sys.stderr)
        core.SYSTEM = adapter.SYSTEM
        core.HERE = HERE if (HERE / 'dialect.md').exists() else HERE.parent / 'v1'
        core.template_context = lambda snapshot: INTEGRATION + original_context(snapshot)
        core._open_model = diagnostic_transport(original_open, budget, key)
        out.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix='.minimal-v2-', dir=out.parent) as tmp:
            tmp = Path(tmp); base = tmp / 'starter'; base.mkdir(); protected = starter(base)
            print('[minimal] shared_sources ' + json.dumps(protected), file=sys.stderr)
            files, _ = core.generate(document, os.environ.get('MODEL', 'deepseek-v4-pro'),
                os.environ.get('OPENAI_BASE_URL', core.DEFAULT_BASE), key, tmp / 'candidate', budget, template=base)
            for name, expected in protected.items():
                if hashlib.sha256((tmp / 'candidate' / name).read_bytes()).hexdigest() != expected:
                    raise ValueError('Protected shared implementation changed: ' + name)
            if out.is_symlink() or (out.exists() and (not out.is_dir() or any(out.iterdir()))):
                raise ValueError('Output changed during generation')
            if out.exists(): out.rmdir()
            (tmp / 'candidate').replace(out)
        print(f'[oneshot] wrote {len(files)} files in {time.monotonic()-started:.1f}s'); return 0
    except Exception as exc:
        print(('[oneshot] failed: '+str(exc)).replace(key,'[REDACTED]'),file=sys.stderr); return 1
    finally:
        core.template_context = original_context
        core._open_model = original_open
        for attempt in budget.attempts:
            print('[oneshot] trace '+json.dumps(attempt,ensure_ascii=False).replace(key,'[REDACTED]'),file=sys.stderr)
        print('[oneshot] usage '+json.dumps(budget.summary(),sort_keys=True),file=sys.stderr)


if __name__ == '__main__':
    sys.exit(main())
