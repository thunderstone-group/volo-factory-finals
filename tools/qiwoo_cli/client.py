"""Standard-library Discourse reader. Site contract awaits authenticated validation."""
import json
import http.client
import re
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from html.parser import HTMLParser

ORIGIN = "https://bbs.qiwoo.edu.cn"
ALIASES = {"course": 15, "competition": 16}
MAX_POSTS = 10000
BATCH_SIZE = 20
MAX_RESPONSE = 4 * 1024 * 1024


class ForumError(Exception):
    """Messages are fixed local strings, never upstream bodies or URLs."""

    def __init__(self, message, code=1):
        super().__init__(message)
        self.code = code


def positive_id(value):
    return type(value) is int and 0 < value <= 2**63 - 1


def topic_id(value):
    if value in ALIASES:
        return ALIASES[value]
    if isinstance(value, str) and re.fullmatch(r"[0-9]{1,19}", value):
        number = int(value)
        if positive_id(number):
            return number
    raise ForumError("主题须为 course、competition 或正整数 topic ID。", 2)


def read_route(url):
    """Reject credentials, alternate origins and any non-reading URL before I/O."""
    if not isinstance(url, str) or any(ord(c) <= 32 or ord(c) >= 127 for c in url):
        raise ForumError("拒绝不安全的请求地址。")
    try:
        parsed = urllib.parse.urlsplit(url)
    except ValueError:
        raise ForumError("拒绝不安全的请求地址。") from None
    if (parsed.scheme != "https" or parsed.netloc != "bbs.qiwoo.edu.cn"
            or parsed.fragment):
        raise ForumError("凭据和请求仅允许精确 HTTPS 同源；已阻止重定向。")
    match = re.fullmatch(r"/t/(?:[A-Za-z0-9_-]+/)?([0-9]+)\.json", parsed.path)
    kind = "topic"
    if not match:
        match = re.fullmatch(r"/t/([0-9]+)/posts\.json", parsed.path)
        kind = "posts"
    if not match or not positive_id(int(match[1])):
        raise ForumError("仅允许主题 JSON 只读地址；登录跳转须由用户另行处理。", 3)
    query = urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
    if kind == "topic" and parsed.query:
        raise ForumError("拒绝非预期的请求参数。")
    if kind == "posts" and (not 1 <= len(query) <= BATCH_SIZE or any(
        key != "post_ids[]" or not re.fullmatch(r"[0-9]{1,19}", val)
        or not positive_id(int(val)) for key, val in query
    )):
        raise ForumError("拒绝非预期的请求参数。")
    return kind, int(match[1]), parsed.query


class SafeRedirect(urllib.request.HTTPRedirectHandler):
    max_redirections = 4
    max_repeats = 2

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if req.get_method() != "GET" or read_route(req.full_url) != read_route(newurl):
            raise ForumError("已阻止改变目标或参数的重定向。")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


class TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.hidden = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.hidden += 1
        elif not self.hidden and tag in ("br", "p", "div", "li", "pre", "blockquote"):
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.hidden = max(0, self.hidden - 1)
        elif not self.hidden and tag in ("p", "div", "li", "pre", "blockquote"):
            self.parts.append("\n")

    def handle_data(self, data):
        if not self.hidden:
            self.parts.append(data)


def normalize_post(post, target):
    if not isinstance(post, dict) or not positive_id(post.get("id")) or not positive_id(post.get("post_number")):
        raise ForumError("帖子 ID 或楼层字段不符合待验证的 Discourse 契约。")
    if "topic_id" in post and (type(post["topic_id"]) is not int or post["topic_id"] != target):
        raise ForumError("响应包含其他主题的帖子。")
    author, created, cooked = (post.get(key) for key in ("username", "created_at", "cooked"))
    if not all(isinstance(value, str) for value in (author, created, cooked)) or not author:
        raise ForumError("帖子作者、时间或正文字段缺失。")
    try:
        if datetime.fromisoformat(created.replace("Z", "+00:00")).tzinfo is None:
            raise ValueError
    except ValueError:
        raise ForumError("帖子时间格式不符合预期。") from None
    reply_to = post.get("reply_to_post_number")
    if reply_to is not None and not positive_id(reply_to):
        raise ForumError("被回复的楼层字段无效。")
    parser = TextExtractor()
    parser.feed(cooked)
    parser.close()
    return {
        "id": post["id"], "topic_id": target, "post_number": post["post_number"],
        "created_at": created, "author": author, "reply_to_post_number": reply_to,
        "url": f"{ORIGIN}/t/topic/{target}/{post['post_number']}",
        "body": "".join(parser.parts).strip(),
    }


class Client:
    def __init__(self, session=None, opener=None):
        # Do not accept arbitrary headers or origins from a session file.
        from .storage import validate_session
        self.session = validate_session(session) if session is not None else None
        self.opener = opener if opener is not None else urllib.request.build_opener(SafeRedirect())
        # Command-lifetime memory only: no persisted authenticated forum content.
        self._topics = {}

    def get_json(self, path):
        url = ORIGIN + path
        route = read_route(url)
        headers = {"Accept": "application/json", "User-Agent": "qiwoo-cli/0.1",
                   "Accept-Encoding": "identity"}
        if self.session:
            headers["Cookie"] = self.session["cookie"]
        request = urllib.request.Request(url, headers=headers, method="GET")
        try:
            with self.opener.open(request, timeout=15) as response:
                if read_route(response.geturl()) != route:
                    raise ForumError("响应地址与请求目标不一致。")
                if response.status != 200:
                    raise ForumError("论坛未返回成功响应。")
                if response.headers.get_content_type() != "application/json":
                    raise ForumError("未取得 JSON；可能需要认证或站点契约不同。", 3)
                raw = response.read(MAX_RESPONSE + 1)
                if len(raw) > MAX_RESPONSE:
                    raise ForumError("响应超过安全上限；未返回不完整结果。")
        except urllib.error.HTTPError as exc:
            status = exc.code
            if exc.fp is not None:
                exc.close()
            if status in (401, 403):
                raise ForumError("论坛拒绝访问；需要用户授权且有效的会话。", 3) from None
            raise ForumError(f"论坛 HTTP {status}；响应正文已省略。") from None
        except (OSError, ValueError, urllib.error.URLError, http.client.HTTPException):
            raise ForumError("HTTPS 请求失败；连接细节已脱敏。") from None
        try:
            data = json.loads(raw)
        except (ValueError, UnicodeError, RecursionError):
            raise ForumError("论坛响应不是有效 JSON。") from None
        if not isinstance(data, dict) or "errors" in data:
            raise ForumError("论坛响应不符合主题数据契约；错误正文已省略。")
        return data

    def topic(self, target):
        if not positive_id(target):
            raise ForumError("无效 topic ID。", 2)
        if target in self._topics:
            return self._topics[target]
        data = self.get_json(f"/t/{target}.json")
        stream = data.get("post_stream")
        if type(data.get("id")) is not int or data["id"] != target or not isinstance(data.get("title"), str) or not isinstance(stream, dict):
            raise ForumError("主题响应不符合待验证的 Discourse 契约。")
        ids = stream.get("stream")
        if (not isinstance(ids, list) or not ids or len(ids) > MAX_POSTS
                or any(not positive_id(item) for item in ids) or len(set(ids)) != len(ids)):
            raise ForumError("完整帖子索引缺失、重复或超过 10000 条；未返回部分结果。")
        collected = {}

        def collect(posts, expected):
            if not isinstance(posts, list):
                raise ForumError("帖子批次缺失。")
            seen = set()
            for post in posts:
                normalized = normalize_post(post, target)
                key = normalized["id"]
                if key not in expected or key in seen:
                    raise ForumError("帖子批次含非预期或重复 ID。")
                seen.add(key)
                collected[key] = normalized
            return seen

        collect(stream.get("posts"), set(ids))
        missing = [key for key in ids if key not in collected]
        for start in range(0, len(missing), BATCH_SIZE):
            batch = missing[start:start + BATCH_SIZE]
            query = urllib.parse.urlencode({"post_ids[]": batch}, doseq=True)
            page = self.get_json(f"/t/{target}/posts.json?{query}").get("post_stream")
            if not isinstance(page, dict) or collect(page.get("posts"), set(batch)) != set(batch):
                raise ForumError("帖子批次不完整；未返回部分结果，请稍后重新查询。")
        posts = [collected[key] for key in ids]
        if len({post["post_number"] for post in posts}) != len(posts):
            raise ForumError("帖子楼层重复，无法确认完整主题。")
        result = {"topic_id": target, "title": data["title"],
                  "url": f"{ORIGIN}/t/topic/{target}", "posts": posts}
        self._topics[target] = result
        return result

    def search(self, query, targets):
        terms = query.casefold().split()
        if not terms:
            raise ForumError("查询不能为空。", 2)
        results = []
        for target in dict.fromkeys(targets):
            topic = self.topic(target)
            for post in topic["posts"]:
                haystack = "\n".join((topic["title"], post["author"], post["body"])).casefold()
                if all(term in haystack for term in terms):
                    results.append(dict(post, topic_title=topic["title"]))
        return results
