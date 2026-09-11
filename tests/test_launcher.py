"""Exercise the actual managed process and both application entrypoints."""
import json
import socket
import subprocess
import tempfile
import time
import unittest
import urllib.request
from pathlib import Path

from volo.launcher import install, START
from volo.workspace import stop_process, tool_environment


def free_port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]


class LauncherTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='volo-launcher-')
        self.root = Path(self.temp.name)
        self.backend = self.root / 'backend'
        self.backend.mkdir()
        self.manifest = self.backend / 'package.json'
        self.manifest.write_text(json.dumps({'name': 'test-app', 'scripts': {'start': 'node server.cjs'}}))
        (self.backend / 'server.cjs').write_text('''const http=require('node:http');
let state='initial'; http.createServer((req,res)=>{
 let body='';req.on('data',s=>body+=s);req.on('end',()=>{
 if(req.method==='POST')state=body;
 res.setHeader('Content-Type','application/json');
 res.end(JSON.stringify({state,pid:process.pid,url:req.url}));
 });
}).listen(Number(process.env.PORT),'127.0.0.1');''')
        first, second = free_port(), free_port()
        while second == first:
            second = free_port()
        self.ports = (first, second)
        self.process = None
        self.output = (self.root / 'server.log').open('wb')

    def tearDown(self):
        if self.process is not None:
            stop_process(self.process)
        self.output.close()
        self.temp.cleanup()

    def start(self):
        self.process = subprocess.Popen(['node', '.volo/launcher.cjs'], cwd=self.backend,
            env=tool_environment({'PORT': str(self.ports[0])}), start_new_session=True,
            stdout=self.output, stderr=subprocess.STDOUT)

    def request(self, port, body=None):
        url = 'http://127.0.0.1:' + str(port) + '/account?test=1'
        request = urllib.request.Request(url, data=body)
        with urllib.request.build_opener(urllib.request.ProxyHandler({})).open(request, timeout=1) as response:
            return json.load(response)

    def test_both_entrypoints_share_state_and_stop_with_the_launcher(self):
        install(self.root, self.ports)
        self.start()
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            try:
                first = self.request(self.ports[0])
                break
            except OSError:
                time.sleep(.05)
        else:
            self.fail('Application never became ready')
        via_alias = self.request(self.ports[1], b'updated')
        via_primary = self.request(self.ports[0])
        self.assertEqual(via_alias, via_primary)
        self.assertEqual(via_alias['state'], 'updated')
        self.assertEqual(via_alias['pid'], first['pid'])
        self.assertEqual(via_alias['url'], '/account?test=1')
        stop_process(self.process)
        for port in self.ports:
            with socket.socket() as sock:
                self.assertNotEqual(sock.connect_ex(('127.0.0.1', port)), 0)

    def test_reserved_port_conflict_fails_and_does_not_leave_the_child_running(self):
        install(self.root, self.ports)
        with socket.socket() as occupied:
            occupied.bind(('0.0.0.0', self.ports[1]))
            occupied.listen()
            self.start()
            self.assertNotEqual(self.process.wait(timeout=5), 0)
        with socket.socket() as sock:
            self.assertNotEqual(sock.connect_ex(('127.0.0.1', self.ports[0])), 0)

    def test_install_is_idempotent_and_refuses_external_manifest_symlinks(self):
        first = install(self.root, self.ports)
        self.assertEqual(install(self.root, self.ports), first)
        self.assertEqual(first['command'], 'node server.cjs')
        self.assertEqual(json.loads(self.manifest.read_text())['scripts']['start'], START)
        with tempfile.TemporaryDirectory() as other:
            target = Path(other) / 'package.json'
            target.write_text('{}')
            self.manifest.unlink()
            self.manifest.symlink_to(target)
            with self.assertRaisesRegex(ValueError, 'within the application'):
                install(self.root, self.ports)
            self.assertEqual(target.read_text(), '{}')
