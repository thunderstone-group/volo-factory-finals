"""Trusted native launcher, executed only after Linux-container discovery."""
import ctypes
import json
import os
from pathlib import Path
import resource
import sys


def mount_system(args):
    for name in ('/usr', '/bin', '/sbin', '/lib', '/lib64'):
        p = Path(name)
        if p.is_symlink():
            args += ['--symlink', os.readlink(p), name]
        elif p.is_dir():
            args += ['--ro-bind', name, name]
    # No /etc home directories, credentials, sockets, cwd, requirement tree or
    # evidence directories are exposed. Browser libs/fonts live under /usr.
    args += ['--proc', '/proc', '--dev', '/dev', '--size', str(256*1024*1024), '--tmpfs', '/tmp']


def main():
    if sys.platform != 'linux' or not any(Path(p).is_file() for p in ('/.dockerenv', '/run/.containerenv')):
        return 1
    config = json.loads(Path(sys.argv[1]).read_text())
    mode = config.get('mode', 'observe')
    if mode not in ('observe', 'preflight'):
        return 1
    uid, gid = (65534, 65534) if os.getuid() == 0 else (os.getuid(), os.getgid())
    # The host snapshot is mounted read-only; the trusted driver copies it to a
    # size-bounded private tmpfs before launching any generated application code.
    base = Path(config['app']).parent
    if os.getuid() == 0:
        os.chown(base, uid, gid)
        for root, dirs, files in os.walk(config['app']):
            os.chown(root, uid, gid)
            for f in files:
                os.chown(Path(root)/f, uid, gid)
    Path(config['probe']).chmod(0o755)
    for p in Path(config['probe']).iterdir():
        p.chmod(0o644)
    # Use open directory FDs so private parent permissions need not be widened.
    app_fd = os.open(config['app'], os.O_RDONLY | os.O_DIRECTORY)
    probe_fd = os.open(config['probe'], os.O_RDONLY | os.O_DIRECTORY)
    browser_fd = os.open(config['browsers'], os.O_RDONLY | os.O_DIRECTORY)
    for fd in (app_fd, probe_fd, browser_fd):
        os.set_inheritable(fd, True)
    args = [config['bwrap'], '--unshare-user', '--unshare-pid', '--unshare-net', '--unshare-ipc',
            '--unshare-uts', '--die-with-parent', '--new-session', '--cap-drop', 'ALL',
            '--uid', str(uid), '--gid', str(gid), '--clearenv']
    mount_system(args)
    args += ['--ro-bind-fd', str(app_fd), '/source',
             '--size', str(128*1024*1024), '--tmpfs', '/app',
             '--ro-bind-fd', str(probe_fd), '/probe',
             '--ro-bind-fd', str(browser_fd), '/browsers']
    if not config['modules'].startswith('/usr/'):
        args += ['--ro-bind', config['modules'], config['modules']]
    env = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': '/tmp', 'TMPDIR': '/tmp',
           'LANG': 'C.UTF-8', 'NODE_PATH': config['modules'], 'PLAYWRIGHT_BROWSERS_PATH': '/browsers',
           'PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD': '1', 'CI': '1'}
    for k, v in env.items():
        args += ['--setenv', k, v]
    args += ['--chdir', '/tmp', config['node'], '/probe/runner.cjs', config['bwrap'], config['node'], config['modules'],
             str(app_fd), str(probe_fd), str(browser_fd), mode]
    for kind, limit in ((resource.RLIMIT_CORE, 0), (resource.RLIMIT_NOFILE, 256),
                        (resource.RLIMIT_NPROC, 256), (resource.RLIMIT_FSIZE, 32*1024*1024),
                        (resource.RLIMIT_CPU, 150)):
        resource.setrlimit(kind, (limit, limit))
    if os.getuid() == 0:
        os.setgroups([]); os.setgid(gid); os.setuid(uid)
    if os.getuid() == 0:
        return 1
    if ctypes.CDLL(None, use_errno=True).prctl(38, 1, 0, 0, 0) != 0:  # PR_SET_NO_NEW_PRIVS
        return 1
    os.execve(args[0], args, env)


if __name__ == '__main__':
    raise SystemExit(main())
