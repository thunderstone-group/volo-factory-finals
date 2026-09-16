"""Opt-in macOS Chrome GET transport. Cookies stay in Chrome; no credential export."""
import json
import re
import subprocess
import sys
import time
import uuid

from .client import Client, ForumError, MAX_RESPONSE, ORIGIN, positive_id, read_route

# Only forum tab identifiers leave this script. It never returns unrelated tab URLs.
_DISCOVER = '''
if application "Google Chrome" is not running then return "NO_CHROME"
tell application "Google Chrome"
    if (count of windows) is 0 then return "NO_TAB"
    set frontTab to active tab of front window
    set frontURL to URL of frontTab
    if frontURL is "https://bbs.qiwoo.edu.cn" or frontURL starts with "https://bbs.qiwoo.edu.cn/" then
        return "OK " & (id of front window as text) & " " & (id of frontTab as text)
    end if
    set candidates to {}
    repeat with w in windows
        repeat with t in tabs of w
            set u to URL of t
            if u is "https://bbs.qiwoo.edu.cn" or u starts with "https://bbs.qiwoo.edu.cn/" then
                set end of candidates to "OK " & (id of w as text) & " " & (id of t as text)
            end if
        end repeat
    end repeat
    if (count of candidates) is 0 then return "NO_TAB"
    if (count of candidates) is not 1 then return "MULTIPLE_TABS"
    return item 1 of candidates
end tell
'''

# Arguments are JSON literals produced locally, never forum text or caller JavaScript.
# Async fetch avoids blocking Chrome's renderer. Both network and abandoned state expire.
_START = r'''(cfg => {
  if (location.origin !== cfg.origin) return JSON.stringify({error: "origin_changed"});
  const controller = new AbortController();
  const state = {done: false, controller};
  window[cfg.key] = state;
  state.expiry = setTimeout(() => { controller.abort(); delete window[cfg.key]; }, 30000);
  const deadline = setTimeout(() => controller.abort(), 15000);
  const finish = result => { state.result = result; state.done = true; };
  (async () => {
    try {
      const response = await fetch(cfg.origin + cfg.path, {
        method: "GET", credentials: "same-origin", mode: "same-origin",
        redirect: "error", cache: "no-store", signal: controller.signal,
        headers: {Accept: "application/json", "X-Requested-With": "XMLHttpRequest"}
      });
      if (response.url !== cfg.origin + cfg.path || response.redirected) {
        finish({error: "redirect"}); return;
      }
      if (response.status !== 200) {
        finish({state: "done", status: response.status, data: null}); return;
      }
      const type = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      if (type !== "application/json") { finish({error: "not_json"}); return; }
      if (!response.body) { finish({error: "invalid_json"}); return; }
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8", {fatal: true});
      let size = 0, text = "";
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > cfg.limit) {
          await reader.cancel(); finish({error: "too_large"}); return;
        }
        text += decoder.decode(chunk.value, {stream: true});
      }
      text += decoder.decode();
      const data = JSON.parse(text);
      if (!data || Array.isArray(data) || typeof data !== "object" || "errors" in data) {
        finish({error: "invalid_json"}); return;
      }
      let selected;
      if (cfg.path === "/session/current.json") {
        if (!("current_user" in data)) { finish({error: "invalid_json"}); return; }
        // In particular, never return the full user/session blob (email, tokens, etc.).
        const user = data.current_user;
        selected = {current_user: user == null ? null : {id: user.id, username: user.username}};
      } else {
        const stream = data.post_stream;
        const posts = stream && stream.posts;
        selected = {id: data.id, title: data.title, post_stream: {
          stream: stream && stream.stream,
          posts: Array.isArray(posts) ? posts.map(p => ({
            id: p.id, topic_id: p.topic_id, post_number: p.post_number,
            username: p.username, created_at: p.created_at, cooked: p.cooked,
            reply_to_post_number: p.reply_to_post_number
          })) : null
        }};
      }
      finish({state: "done", status: 200, data: selected});
    } catch (_) {
      finish({error: controller.signal.aborted ? "timeout" : "request_failed"});
    } finally { clearTimeout(deadline); controller.abort(); }
  })();
  return JSON.stringify({state: "started"});
})'''

_ERRORS = {
    "origin_changed": ("论坛标签页已跳转到其他来源；已停止，不会更换标签页重试。", 3),
    "state_lost": ("论坛标签页已刷新或请求状态已过期；未返回不完整结果。", 3),
    "redirect": ("已阻止论坛重定向；请在 Chrome 中确认仍已登录。", 3),
    "not_json": ("论坛未返回 JSON；请在 Chrome 中确认登录和页面状态。", 3),
    "invalid_json": ("论坛响应不符合数据契约；正文已省略。", 1),
    "too_large": ("论坛响应超过安全上限；未返回不完整结果。", 1),
    "timeout": ("Chrome 论坛请求超时；未自动重试。", 1),
    "request_failed": ("Chrome 论坛请求失败或重定向被阻止；连接细节已省略。", 1),
}


def _browser_route(path):
    if path == "/session/current.json":
        return
    if not isinstance(path, str):
        raise ForumError("无效只读请求路径。", 2)
    read_route(ORIGIN + path)


def start_script(path, key):
    _browser_route(path)
    if not re.fullmatch(r"__qiwoo_[a-f0-9]{32}", key):
        raise ForumError("无效浏览器请求标识。", 2)
    return _START + "(" + json.dumps({"origin": ORIGIN, "path": path,
                                      "key": key, "limit": MAX_RESPONSE}) + ")"


def _decode(raw):
    try:
        if len(raw.encode("utf-8")) > MAX_RESPONSE * 6 + 4096:
            raise ValueError
        value = json.loads(raw)
        if not isinstance(value, dict):
            raise ValueError
    except (ValueError, UnicodeError, RecursionError):
        raise ForumError("Chrome 返回无效或过大的数据；内容已省略。") from None
    if "error" in value:
        code = value["error"]
        fallback = ("Chrome 请求失败；细节已省略。", 1)
        message, exit_code = _ERRORS.get(code, fallback) if isinstance(code, str) else fallback
        raise ForumError(message, exit_code)
    return value


class ChromeBridge:
    """Pin a selected forum tab; never open, navigate, activate, or close browser tabs."""

    def __init__(self):
        self.tab = None

    def _run(self, script):
        if sys.platform != "darwin":
            raise ForumError("--chrome 当前仅支持 macOS 的 Google Chrome。", 2)
        try:
            result = subprocess.run(["/usr/bin/osascript", "-"], input=script,
                                    capture_output=True, text=True, timeout=8)
        except subprocess.TimeoutExpired:
            raise ForumError("Chrome Apple 事件超时；未自动重试。") from None
        except (OSError, UnicodeError):
            raise ForumError("无法调用 macOS Chrome；系统错误细节已省略。", 3) from None
        if result.returncode:
            error = result.stderr.casefold()
            if "javascript" in error and any(word in error for word in ("turned off", "disabled", "停用", "禁用", "关闭")):
                raise ForumError("Chrome 页面脚本权限未开启。请勾选屏幕顶部菜单：查看 → 开发者 → 允许来自 Apple 事件的 JavaScript。", 3)
            if "-1743" in error or "not authorized to send apple events" in error:
                raise ForumError("macOS 未授权控制 Chrome；请检查系统设置中的自动化权限。", 3)
            raise ForumError("Chrome AppleScript 执行失败；系统错误细节已省略。", 3)
        return result.stdout.strip()

    def _discover(self):
        result = self._run(_DISCOVER)
        errors = {
            "NO_CHROME": "Google Chrome 未运行；请打开已登录的论坛页面。",
            "NO_TAB": "未找到论坛标签页；请在 Chrome 打开 bbs.qiwoo.edu.cn 并登录。",
            "MULTIPLE_TABS": "有多个论坛标签页；请将要使用的论坛标签页切到 Chrome 最前窗口的活动标签，再重试。",
        }
        if result in errors:
            raise ForumError(errors[result], 3)
        match = re.fullmatch(r"OK ([1-9][0-9]{0,18}) ([1-9][0-9]{0,18})", result)
        if not match:
            raise ForumError("Chrome 标签页信息无效；内容已省略。", 3)
        self.tab = (int(match[1]), int(match[2]))

    def execute(self, javascript):
        if self.tab is None:
            self._discover()
        window_id, tab_id = self.tab
        # JSON escaping is compatible with AppleScript strings for this ASCII source.
        # No post body or external JavaScript is ever passed here.
        script = '''
if application "Google Chrome" is not running then return "NO_CHROME"
tell application "Google Chrome"
    repeat with w in windows
        if (id of w as text) is "WINDOW_ID" then
            repeat with t in tabs of w
                if (id of t as text) is "TAB_ID" then
                    set u to URL of t
                    if u is "https://bbs.qiwoo.edu.cn" or u starts with "https://bbs.qiwoo.edu.cn/" then
                        return execute t javascript JAVASCRIPT
                    end if
                    return "ORIGIN_CHANGED"
                end if
            end repeat
        end if
    end repeat
end tell
return "TAB_GONE"'''.replace("WINDOW_ID", str(window_id)).replace("TAB_ID", str(tab_id)).replace("JAVASCRIPT", json.dumps(javascript, ensure_ascii=True))
        result = self._run(script)
        if result in ("NO_CHROME", "TAB_GONE", "ORIGIN_CHANGED"):
            raise ForumError("指定论坛标签页已关闭或改变来源；已停止，不会切换账号重试。", 3)
        return result

    def get_json(self, path):
        _browser_route(path)  # Reject before any browser access.
        key = "__qiwoo_" + uuid.uuid4().hex
        args = json.dumps({"origin": ORIGIN, "key": key})
        poll = '''(cfg => {
          if (location.origin !== cfg.origin) return JSON.stringify({error: "origin_changed"});
          const s = window[cfg.key];
          if (!s) return JSON.stringify({error: "state_lost"});
          if (!s.done) return JSON.stringify({state: "pending"});
          clearTimeout(s.expiry); delete window[cfg.key];
          return JSON.stringify(s.result);
        })(''' + args + ")"
        cleanup = '''(cfg => {
          if (location.origin !== cfg.origin) return "";
          const s = window[cfg.key];
          if (s) { s.controller.abort(); clearTimeout(s.expiry); delete window[cfg.key]; }
          return "";
        })(''' + args + ")"
        try:
            initial = _decode(self.execute(start_script(path, key)))
            if initial != {"state": "started"}:
                raise ForumError("Chrome 未确认请求启动；未自动重试。")
            deadline = time.monotonic() + 20
            while time.monotonic() < deadline:
                data = _decode(self.execute(poll))
                if data.get("state") == "done":
                    if type(data.get("status")) is not int or not 100 <= data["status"] <= 599:
                        raise ForumError("Chrome 返回无效 HTTP 状态。")
                    return data
                if data != {"state": "pending"}:
                    raise ForumError("Chrome 返回无效请求状态。")
                time.sleep(0.15)
            raise ForumError("Chrome 论坛请求超时；未自动重试。")
        finally:
            # Best effort after interruption; browser-side expiry also bounds abandoned state.
            try:
                if self.tab is not None:
                    self.execute(cleanup)
            except ForumError:
                pass


class ChromeClient(Client):
    def __init__(self, bridge=None):
        super().__init__()
        self.bridge = bridge if bridge is not None else ChromeBridge()
        self._identity = None

    def auth_status(self):
        if self._identity is not None:
            return dict(self._identity)
        response = self.bridge.get_json("/session/current.json")
        status = response["status"]
        base = {"origin": ORIGIN, "transport": "chrome", "network_validated": True}
        if status in (401, 403, 404):
            return dict(base, authenticated=False, username=None)
        if status != 200:
            raise ForumError(f"论坛 HTTP {status}；认证结果未知，正文已省略。")
        data = response.get("data")
        if not isinstance(data, dict) or "current_user" not in data:
            raise ForumError("论坛登录响应不符合数据契约。")
        user = data["current_user"]
        if user is None:
            return dict(base, authenticated=False, username=None)
        if (not isinstance(user, dict) or not positive_id(user.get("id"))
                or not isinstance(user.get("username"), str) or not user["username"]
                or len(user["username"]) > 200 or any(ord(c) < 32 for c in user["username"])):
            raise ForumError("论坛登录身份字段无效；内容已省略。")
        self._identity = dict(base, authenticated=True, username=user["username"])
        return dict(self._identity)

    def get_json(self, path):
        read_route(ORIGIN + path)
        if not self.auth_status()["authenticated"]:
            raise ForumError("Chrome 论坛会话未登录或已过期；请在论坛页面重新登录。", 3)
        response = self.bridge.get_json(path)
        status = response["status"]
        if status in (401, 403):
            raise ForumError("论坛拒绝访问；会话可能已过期或没有读取权限。", 3)
        if status != 200:
            raise ForumError(f"论坛 HTTP {status}；正文已省略，未自动重试。")
        data = response.get("data")
        if not isinstance(data, dict) or "errors" in data:
            raise ForumError("论坛响应不符合主题数据契约；正文已省略。")
        return data
