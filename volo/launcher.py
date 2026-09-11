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
const {spawn} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'launch.json'), 'utf8'));
const port = Number(process.env.PORT || config.entrypoints[0]);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Invalid PORT');
const child = spawn(config.command, {cwd: root, shell: true, detached: true,
  stdio: 'inherit', env: {...process.env, PORT: String(port)}});
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
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop(signal));
child.on('error', error => { console.error(error.message); stop('SIGTERM'); process.exitCode = 1; });
child.on('exit', (code, signal) => {
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
