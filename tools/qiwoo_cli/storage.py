"""Private local files. No browser access, keychain integration or session discovery."""
import json
import os
import re
import stat
import uuid
from pathlib import Path

from .client import ForumError, ORIGIN

AUTH_LIMIT = 16384
BODY_LIMIT = 128000
DEFAULT_AUTH = Path.home() / ".config/qiwoo/auth.json"


def validate_session(data):
    if not isinstance(data, dict) or set(data) != {"origin", "cookie"} or data.get("origin") != ORIGIN:
        raise ForumError("会话必须且仅包含 origin 和 cookie，origin 须为精确论坛 HTTPS 同源。", 2)
    cookie = data["cookie"]
    if not isinstance(cookie, str) or not cookie or len(cookie) > AUTH_LIMIT // 2:
        raise ForumError("无效会话格式。", 2)
    # RFC 6265 cookie-octet; excludes controls, whitespace, quotes and backslash.
    pair = r"[!#$%&'*+.^_`|~0-9A-Za-z-]+=[\x21\x23-\x2b\x2d-\x3a\x3c-\x5b\x5d-\x7e]+"
    if not re.fullmatch(pair + r"(?:; " + pair + r")*", cookie):
        raise ForumError("无效 Cookie 格式；禁止控制字符和额外请求头。", 2)
    names = [part.split("=", 1)[0] for part in cookie.split("; ")]
    if len(set(names)) != len(names):
        raise ForumError("会话包含重复 Cookie 名称。", 2)
    return {"origin": ORIGIN, "cookie": cookie}


def read_stdin(stream, limit, private=False):
    if private and stream.isatty():
        raise ForumError("auth import 仅接收重定向的 stdin，以避免终端回显凭据。", 2)
    value = stream.read(limit + 1)
    if len(value.encode("utf-8")) > limit:
        raise ForumError("stdin 内容超过大小限制。", 2)
    return value


def parse_session(value):
    try:
        def unique(pairs):
            data = {}
            for key, val in pairs:
                if key in data:
                    raise ValueError
                data[key] = val
            return data
        return validate_session(json.loads(value, object_pairs_hook=unique))
    except (ValueError, UnicodeError, RecursionError):
        raise ForumError("会话 JSON 无效；输入已省略。", 2) from None


def private_dir(path, create=False):
    if create:
        path.mkdir(mode=0o700, parents=True, exist_ok=True)
    fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    info = os.fstat(fd)
    if info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) != 0o700:
        os.close(fd)
        raise ForumError("私有文件的直接父目录必须属于当前用户且权限为 0700。", 2)
    return fd


def check_file(info):
    if (not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid()
            or stat.S_IMODE(info.st_mode) != 0o600 or info.st_nlink != 1):
        raise ForumError("私有文件须属于当前用户、为非链接普通文件且权限为 0600。", 2)


def load_auth(path, required=False):
    path = Path(path)
    # Missing defaults are anonymous; malformed existing files always fail closed.
    try:
        path.lstat()
    except FileNotFoundError:
        if required:
            raise ForumError("指定的认证文件不存在。", 2) from None
        return None
    directory = private_dir(path.parent)
    try:
        fd = os.open(path.name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=directory)
        with os.fdopen(fd, "rb") as source:
            check_file(os.fstat(source.fileno()))
            raw = source.read(AUTH_LIMIT + 1)
            if len(raw) > AUTH_LIMIT:
                raise ForumError("认证文件超过大小限制。", 2)
        return parse_session(raw)
    finally:
        os.close(directory)


def save_private(path, data, replace=False):
    path = Path(path)
    directory = private_dir(path.parent, create=True)
    temporary = ".qiwoo-" + uuid.uuid4().hex
    created = False
    try:
        if replace:
            try:
                check_file(os.stat(path.name, dir_fd=directory, follow_symlinks=False))
            except FileNotFoundError:
                pass
        fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
                     0o600, dir_fd=directory)
        created = True
        with os.fdopen(fd, "w", encoding="utf-8") as output:
            os.fchmod(output.fileno(), 0o600)
            json.dump(data, output, ensure_ascii=True, indent=2)
            output.write("\n")
            output.flush()
            os.fsync(output.fileno())
        if replace:
            os.replace(temporary, path.name, src_dir_fd=directory, dst_dir_fd=directory)
        else:
            # Atomic no-clobber publication, without following a destination symlink.
            os.link(temporary, path.name, src_dir_fd=directory, dst_dir_fd=directory)
    finally:
        if created:
            try:
                os.unlink(temporary, dir_fd=directory)
            except FileNotFoundError:
                pass
        os.close(directory)


def redact(text, session):
    if session:
        values = [session["cookie"]] + [part.split("=", 1)[1] for part in session["cookie"].split("; ")]
        for value in sorted(values, key=len, reverse=True):
            text = text.replace(value, "[REDACTED]")
    return text


def redact_result(value, session):
    if isinstance(value, str):
        return redact(value, session)
    if isinstance(value, list):
        return [redact_result(item, session) for item in value]
    if isinstance(value, dict):
        return {key: redact_result(item, session) for key, item in value.items()}
    return value
