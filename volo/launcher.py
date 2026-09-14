"""Serve one application on the runner and published browser-test entrypoints."""
from __future__ import annotations

import json
from pathlib import Path

from .trace import atomic_json


START = "node .volo/launcher.cjs"
ENTRYPOINTS = (3000, 3301)
LAUNCHER = r"""'use strict';
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const os = require('node:os');
const {spawn} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'launch.json'), 'utf8'));
const port = Number(process.env.PORT || config.entrypoints[0]);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Invalid PORT');
const child = spawn(config.command, {cwd: root, shell: true, detached: true,
  stdio: 'inherit', env: {...process.env, PORT: String(port)}});
// Diagnostic only: never create .factory, retain secrets, or keep the app alive.
function startProbe() {
  const noop = {event() {}, close() {}};
  const safe = fn => { try { return fn(); } catch (_) { return null; } };
  const read = file => safe(() => fs.readFileSync(file, 'utf8'));
  const number = value => value == null || String(value).trim() === '' ? null :
    (Number.isFinite(Number(value)) ? Number(value) : null);
  const pairs = raw => Object.fromEntries((raw || '').trim().split('\n').map(line => {
    const [key, value] = line.trim().split(/\s+/);
    return [key, number(value)];
  }));
  const select = (values, keys) => Object.fromEntries(keys.map(key => [key, values[key] ?? null]));
  const pressure = raw => {
    const values = {};
    for (const line of (raw || '').split('\n')) {
      const match = line.match(/^(some|full)\s+avg10=([\d.]+)/);
      if (match) values[match[1]] = number(match[2]);
    }
    return {some: values.some ?? null, full: values.full ?? null};
  };
  const shm = () => safe(() => {
    const stat = fs.statfsSync('/dev/shm');
    return {total_bytes: stat.blocks * stat.bsize,
      used_bytes: (stat.blocks - stat.bfree) * stat.bsize};
  });
  try {
    const directory = path.join(root, '..', '.factory');
    if (!safe(() => fs.statSync(directory).isDirectory())) return noop;
    const file = path.join(directory, 'probe.jsonl');
    // Each launcher start (self-checks, then the official test phase) gets a fresh file.
    safe(() => fs.renameSync(file, path.join(directory, 'probe.prev.jsonl')));
    const started = process.hrtime.bigint();
    const timers = [];
    let disabled = false;
    const close = () => { for (const timer of timers) clearInterval(timer); };
    const write = record => {
      if (disabled) return;
      try {
        const line = JSON.stringify({ts_ms: Date.now(), ...record}) + '\n';
        let size;
        try { size = fs.statSync(file).size; }
        catch (error) { if (error.code !== 'ENOENT') throw error; size = 0; }
        if (size + Buffer.byteLength(line) > 3000000) { disabled = true; close(); return; }
        fs.appendFileSync(file, line);
      } catch (_) { disabled = true; close(); }
    };
    const base = '/sys/fs/cgroup/';
    const v2Files = ['memory.max', 'memory.current', 'memory.events', 'memory.stat',
      'memory.pressure', 'cpu.max', 'cpu.stat', 'cpu.pressure', 'pids.max', 'pids.current'];
    const v1Files = ['memory/memory.limit_in_bytes', 'memory/memory.usage_in_bytes',
      'memory/memory.oom_control', 'memory/memory.failcnt', 'memory/memory.stat',
      'cpu/cpu.cfs_quota_us', 'cpu/cpu.cfs_period_us', 'cpu/cpu.stat',
      'cpuacct/cpuacct.usage', 'pids/pids.max', 'pids/pids.current'];
    const snapshot = files => Object.fromEntries(files.map(name => [name, read(base + name)]));
    const envKeys = ['PORT', 'E2E_BASE_URL', 'TARGET_URL', 'PLAYWRIGHT_BASE_URL',
      'PLAYWRIGHT_BROWSERS_PATH', 'CI', 'NODE_ENV', 'HOME', 'USER'];
    write({kind: 'boot', launcher_pid: process.pid, child_pid: child.pid ?? null,
      env: Object.fromEntries(envKeys.map(key => [key, process.env[key] ?? null])),
      other_env_keys: Object.keys(process.env).filter(key => !envKeys.includes(key)).sort(),
      cpu_count: safe(() => os.cpus().length), totalmem_bytes: safe(() => os.totalmem()),
      hostname: safe(() => os.hostname()), self_cgroup: read('/proc/self/cgroup'),
      cgroup: {v2: snapshot(v2Files), v1: snapshot(v1Files)},
      shm_total_bytes: shm()?.total_bytes ?? null});
    const sample = () => {
      const memoryV2 = read(base + 'memory.current');
      const memoryStatV2 = read(base + 'memory.stat');
      const memoryStat = pairs(memoryStatV2 ?? read(base + 'memory/memory.stat'));
      const events = pairs(read(base + 'memory.events'));
      const oomControl = pairs(read(base + 'memory/memory.oom_control'));
      const cpuV2 = read(base + 'cpu.stat');
      const cpu = pairs(cpuV2 ?? read(base + 'cpu/cpu.stat'));
      const cpuStat = select(cpu, ['usage_usec', 'nr_periods', 'nr_throttled', 'throttled_usec']);
      if (cpuV2 === null) {
        const usage = number(read(base + 'cpuacct/cpuacct.usage'));
        cpuStat.usage_usec = usage === null ? null : usage / 1000;
        cpuStat.throttled_usec = cpu.throttled_time == null ? null : cpu.throttled_time / 1000;
      }
      const load = read('/proc/loadavg');
      const available = read('/proc/meminfo')?.match(/^MemAvailable:\s+(\d+)/m);
      write({kind: 'sample',
        'memory.current': number(memoryV2 ?? read(base + 'memory/memory.usage_in_bytes')),
        'memory.events': {...select(events, ['oom', 'oom_kill', 'max', 'high']),
          oom_kill: events.oom_kill ?? oomControl.oom_kill ?? null},
        'memory.failcnt': number(read(base + 'memory/memory.failcnt')),
        'memory.stat': memoryStatV2 === null ? {
          anon: memoryStat.total_rss ?? memoryStat.rss ?? null,
          file: memoryStat.total_cache ?? memoryStat.cache ?? null,
          shmem: memoryStat.total_shmem ?? memoryStat.shmem ?? null,
        } : select(memoryStat, ['anon', 'file', 'shmem']),
        'cpu.stat': cpuStat,
        'memory.pressure': pressure(read(base + 'memory.pressure')),
        'cpu.pressure': pressure(read(base + 'cpu.pressure')),
        'proc.pressure.memory': pressure(read('/proc/pressure/memory')),
        'proc.pressure.cpu': pressure(read('/proc/pressure/cpu')),
        'pids.current': number(read(base + 'pids.current') ?? read(base + 'pids/pids.current')),
        loadavg: load === null ? null : load.trim().split(/\s+/).slice(0, 3).map(number),
        mem_available_kb: number(available?.[1]), shm_used_bytes: shm()?.used_bytes ?? null});
    };
    const procs = () => {
      const entries = safe(() => fs.readdirSync('/proc'));
      const processes = entries === null ? null : entries.filter(name => /^\d+$/.test(name)).map(name => {
        const prefix = '/proc/' + name + '/';
        const status = read(prefix + 'status');
        const field = key => status?.match(new RegExp('^' + key + ':\\s*(.*)$', 'm'))?.[1] ?? null;
        return {pid: Number(name), ppid: number(field('PPid')),
          comm: read(prefix + 'comm')?.trim() ?? null,
          state: field('State')?.split(/\s+/)[0] ?? null,
          rss_kb: number(field('VmRSS')?.split(/\s+/)[0]),
          oom_score: number(read(prefix + 'oom_score')),
          cmdline: read(prefix + 'cmdline')?.replace(/\0/g, ' ').slice(0, 120) ?? null};
      }).sort((a, b) => (b.rss_kb ?? -1) - (a.rss_kb ?? -1)).slice(0, 60);
      write({kind: 'procs', processes});
    };
    const schedule = (fn, interval) => {
      const timer = setInterval(() => {
        if (disabled || Number(process.hrtime.bigint() - started) / 1e9 >= 900) { close(); return; }
        safe(fn);
      }, interval);
      timer.unref();
      timers.push(timer);
    };
    if (!disabled) { schedule(sample, 500); schedule(procs, 2000); }
    return {event: data => write({kind: 'event', ...data}), close};
  } catch (_) { return noop; }
}
const probe = startProbe();
const servers = [], sockets = new Set();
let stopping = false;
let stopSignal = 'SIGTERM', killTimer;
function killChild(signal) {
  if (!child.pid) return;
  try { process.kill(-child.pid, signal); } catch (_) { child.kill(signal); }
}
function stop(signal) {
  if (stopping) return;
  stopping = true;
  stopSignal = signal;
  for (const server of servers) server.close();
  for (const socket of sockets) socket.destroy();
  killChild(signal);
  killTimer = setTimeout(() => killChild('SIGKILL'), 2000);
  killTimer.unref();
}
child.on('spawn', () => { if (stopping) killChild(stopSignal); });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  probe.event({event: 'signal', signal});
  stop(signal);
});
child.on('error', error => { console.error(error.message); stop('SIGTERM'); process.exitCode = 1; });
child.on('exit', (code, signal) => {
  probe.event({event: 'child_exit', code, signal});
  probe.close();
  stop('SIGTERM');
  clearTimeout(killTimer);
  process.exitCode = process.exitCode || (code === null ? (signal === 'SIGINT' ? 130 : 143) : code);
});
// Custom PORT values are respected, without claiming the runner's fixed ports.
for (const alias of config.entrypoints.includes(port) ? config.entrypoints : []) {
  if (alias === port) continue;
  const server = net.createServer(incoming => {
    const upstream = net.connect(port, '127.0.0.1');
    for (const socket of [incoming, upstream]) {
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
    }
    incoming.on('error', () => upstream.destroy());
    upstream.on('error', () => incoming.destroy());
    incoming.on('close', () => upstream.destroy());
    upstream.on('close', () => incoming.destroy());
    incoming.pipe(upstream).pipe(incoming);
  });
  server.on('error', error => {
    console.error('Application entrypoint ' + alias + ': ' + error.message);
    process.exitCode = 1;
    stop('SIGTERM');
  });
  servers.push(server);
  server.listen(alias, '0.0.0.0');
}
"""


def install(root: Path, entrypoints=ENTRYPOINTS):
    """Wrap the real npm start command, without changing product code or tests."""
    backend = root / "backend"
    manifest = backend / "package.json"
    if not backend.resolve().is_relative_to(root.resolve()) or manifest.is_symlink():
        raise ValueError("Backend manifest must stay within the application")
    package = json.loads(manifest.read_text())
    command = package.get("scripts", {}).get("start")
    if not isinstance(command, str) or not command.strip():
        raise ValueError("Missing backend npm start command")
    directory = backend / ".volo"
    if directory.is_symlink():
        raise ValueError("Launcher directory must not be a symlink")
    config_path = directory / "launch.json"
    if command == START:
        if not config_path.is_file():
            raise ValueError("Existing launcher is missing its original start command")
        command = json.loads(config_path.read_text())["command"]
    if not isinstance(command, str) or not command.strip() or command == START:
        raise ValueError("Invalid original application start command")
    directory.mkdir(exist_ok=True)
    for path in (directory / "launcher.cjs", config_path):
        if path.is_symlink():
            raise ValueError("Launcher files must not be symlinks")
    (directory / "launcher.cjs").write_text(LAUNCHER)
    atomic_json(config_path, {"command": command, "entrypoints": list(entrypoints)})
    package["scripts"]["start"] = START
    atomic_json(manifest, package)
    return {"command": command, "entrypoints": list(entrypoints)}
