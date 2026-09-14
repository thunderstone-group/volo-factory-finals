"""Exercise the actual managed process and both application entrypoints."""
import json
import os
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

    def wait_ready(self):
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            try:
                return self.request(self.ports[0])
            except OSError:
                time.sleep(.05)
        self.fail('Application never became ready')

    def probe_records(self):
        file = self.root / '.factory' / 'probe.jsonl'
        return [json.loads(line) for line in file.read_text().splitlines()] if file.exists() else []

    def assert_stopped(self, *pids):
        deadline = time.monotonic() + 2
        while time.monotonic() < deadline:
            alive = []
            for pid in pids:
                try:
                    os.kill(pid, 0)
                    alive.append(pid)
                except ProcessLookupError:
                    pass
            if not alive:
                break
            time.sleep(.05)
        self.assertEqual(alive, [], 'Launcher or child process survived shutdown')
        for port in self.ports:
            with socket.socket() as sock:
                self.assertNotEqual(sock.connect_ex(('127.0.0.1', port)), 0)

    def test_probe_records_resources_without_changing_app_or_shutdown(self):
        (self.root / '.factory').mkdir()
        install(self.root, self.ports)
        started = time.monotonic()
        self.start()
        first = self.wait_ready()
        while time.monotonic() - started < 2:
            records = self.probe_records()
            if any(row['kind'] == 'sample' for row in records):
                break
            time.sleep(.05)
        self.assertLess(time.monotonic() - started, 2)
        self.assertEqual(records[0]['kind'], 'boot')
        boot = records[0]
        self.assertEqual(boot['env']['PORT'], str(self.ports[0]))
        self.assertEqual(boot['launcher_pid'], self.process.pid)
        self.assertEqual(set(boot['env']), {'PORT', 'E2E_BASE_URL', 'TARGET_URL',
            'PLAYWRIGHT_BASE_URL', 'PLAYWRIGHT_BROWSERS_PATH', 'CI', 'NODE_ENV', 'HOME', 'USER'})
        self.assertIsInstance(boot['other_env_keys'], list)
        self.assertIn('memory.max', boot['cgroup']['v2'])
        self.assertIn('memory/memory.limit_in_bytes', boot['cgroup']['v1'])
        sample = next(row for row in records if row['kind'] == 'sample')
        self.assertGreaterEqual(sample['ts_ms'] - boot['ts_ms'], 450)
        self.assertIn('oom_kill', sample['memory.events'])
        self.assertIn('throttled_usec', sample['cpu.stat'])
        self.assertEqual(self.request(self.ports[1], b'probe-enabled'), self.request(self.ports[0]))
        while time.monotonic() - started < 3:
            if any(row['kind'] == 'procs' for row in self.probe_records()):
                break
            time.sleep(.05)
        self.assertTrue(any(row['kind'] == 'procs' for row in self.probe_records()))
        stop_process(self.process)
        self.assert_stopped(self.process.pid, boot['child_pid'], first['pid'])
        records = self.probe_records()
        self.assertTrue(any(row.get('event') == 'signal' and row['signal'] == 'SIGTERM' for row in records))
        self.assertTrue(any(row.get('event') == 'child_exit' for row in records))
        self.output.flush()
        self.assertEqual((self.root / 'server.log').read_text(), '')

    def test_probe_is_disabled_without_factory_directory(self):
        install(self.root, self.ports)
        files = set(self.root.rglob('*'))
        self.start()
        first = self.wait_ready()
        time.sleep(.6)
        self.assertEqual(self.request(self.ports[1], b'no-probe'), self.request(self.ports[0]))
        self.assertEqual(set(self.root.rglob('*')), files)
        self.assertFalse((self.root / '.factory').exists())
        stop_process(self.process)
        self.assert_stopped(self.process.pid, first['pid'])

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
        with socket.socket() as occupied:
            occupied.bind(('0.0.0.0', 0))
            self.ports = (free_port(), occupied.getsockname()[1])
            install(self.root, self.ports)
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


class ProbeLinuxFixtureTests(unittest.TestCase):
    def test_synthetic_v1_and_v2_readings_and_natural_child_exit(self):
        # Synthetic Linux files on any host; this is not a hosted-runner test.
        for version in ('v1', 'v2'):
            with self.subTest(version=version), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                backend = root / 'backend'
                backend.mkdir()
                (root / '.factory').mkdir()
                (backend / 'package.json').write_text(json.dumps({'scripts': {
                    'start': 'node -e "setTimeout(() => {}, 2200)"'}}))
                install(root, ())  # No relay or server: resource collection needs no sockets.
                cgroup = {
                    'v2': {'memory.max': '8000', 'memory.current': '4096',
                           'memory.events': 'oom 2\noom_kill 1\nmax 5\nhigh 3\n',
                           'memory.stat': 'anon 100\nfile 200\nshmem 50\n',
                           'cpu.max': '200000 100000',
                           'cpu.stat': 'usage_usec 1200\nnr_periods 10\nnr_throttled 2\nthrottled_usec 500\n',
                           'memory.pressure': 'some avg10=1.25 avg60=0.00\nfull avg10=0.5\n',
                           'cpu.pressure': 'some avg10=2.5\n', 'pids.current': '3'},
                    'v1': {'memory/memory.limit_in_bytes': '8000',
                           'memory/memory.usage_in_bytes': '4096',
                           'memory/memory.oom_control': 'oom_kill_disable 0\nunder_oom 0\noom_kill 1\n',
                           'memory/memory.failcnt': '5',
                           'memory/memory.stat': 'rss 100\ncache 200\nshmem 50\n',
                           'cpu/cpu.cfs_period_us': '100000', 'cpu/cpu.cfs_quota_us': '200000',
                           'cpu/cpu.stat': 'nr_periods 10\nnr_throttled 2\nthrottled_time 500000\n',
                           'cpuacct/cpuacct.usage': '1200000', 'pids/pids.current': '3'},
                }[version]
                files = {'/sys/fs/cgroup/' + key: value for key, value in cgroup.items()}
                files.update({'/proc/self/cgroup': '0::/synthetic\n',
                              '/proc/loadavg': '1.0 2.0 3.0 1/20 99\n',
                              '/proc/meminfo': 'MemAvailable: 1234 kB\n',
                              '/proc/pressure/memory': 'some avg10=4.5\nfull avg10=0.1\n',
                              '/proc/pressure/cpu': 'some avg10=5.5\n',
                              '/proc/42/status': 'PPid:\t1\nState:\tS (sleeping)\nVmRSS:\t123 kB\n',
                              '/proc/42/comm': 'chrome\n', '/proc/42/oom_score': '77',
                              '/proc/42/cmdline': 'chrome\x00' + 'x' * 150})
                preload = root / 'synthetic.cjs'
                preload.write_text('const files = ' + json.dumps(files) + ';\n' + r'''
const fs = require('node:fs');
const read = fs.readFileSync, readdir = fs.readdirSync;
fs.readFileSync = function(file, ...args) {
  if (Object.hasOwn(files, file)) return files[file];
  if (String(file).startsWith('/sys/') || String(file).startsWith('/proc/'))
    throw Error('Synthetic missing field');
  return read.call(this, file, ...args);
};
fs.readdirSync = function(file, ...args) {
  return file === '/proc' ? ['42', 'self', 'gone'] : readdir.call(this, file, ...args);
};
fs.statfsSync = () => ({blocks: 100, bsize: 4096, bfree: 25});
''')
                result = subprocess.run(['node', '--require', str(preload), '.volo/launcher.cjs'],
                    cwd=backend, env=tool_environment({'PORT': '12345', 'PROBE_TEST_SECRET': 'do-not-record'}),
                    capture_output=True, text=True, timeout=5)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(result.stderr, '')
                raw = (root / '.factory/probe.jsonl').read_text()
                self.assertNotIn('do-not-record', raw)
                rows = [json.loads(line) for line in raw.splitlines()]
                self.assertIn('PROBE_TEST_SECRET', rows[0]['other_env_keys'])
                self.assertEqual(rows[0]['shm_total_bytes'], 409600)
                sample = next(row for row in rows if row['kind'] == 'sample')
                self.assertEqual(sample['memory.current'], 4096)
                self.assertEqual(sample['memory.events']['oom_kill'], 1)
                self.assertEqual(sample['memory.stat'], {'anon': 100, 'file': 200, 'shmem': 50})
                self.assertEqual(sample['cpu.stat'], {'usage_usec': 1200, 'nr_periods': 10,
                    'nr_throttled': 2, 'throttled_usec': 500})
                self.assertEqual(sample['proc.pressure.memory']['some'], 4.5)
                self.assertEqual(sample['loadavg'], [1, 2, 3])
                self.assertEqual(sample['mem_available_kb'], 1234)
                self.assertEqual(sample['shm_used_bytes'], 307200)
                process = next(row for row in rows if row['kind'] == 'procs')['processes'][0]
                self.assertEqual((process['pid'], process['ppid'], process['state'], process['rss_kb']),
                                 (42, 1, 'S', 123))
                self.assertEqual(len(process['cmdline']), 120)
                self.assertEqual(rows[-1]['event'], 'child_exit')
