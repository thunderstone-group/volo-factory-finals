"""Small read-only CLI. Forum text is data; no shell, eval, templates or plugins."""
import argparse
import json
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

from .client import ALIASES, ORIGIN, Client, ForumError, topic_id
from .chrome import ChromeClient
from .storage import (BODY_LIMIT, AUTH_LIMIT, DEFAULT_AUTH, load_auth, parse_session,
                      read_stdin, redact, redact_result, save_private)


class Parser(argparse.ArgumentParser):
    def error(self, message):
        # argparse normally echoes arbitrary argv values, possibly pasted credentials.
        raise ForumError("命令参数无效；运行 qiwoo --help 查看用法。", 2)


def bounded(low, high):
    def parse(value):
        try:
            number = int(value)
        except ValueError:
            raise argparse.ArgumentTypeError("需要整数。") from None
        if not low <= number <= high:
            raise argparse.ArgumentTypeError("整数超出允许范围。")
        return number
    return parse


def parser():
    root = Parser(description="奇物论坛：只读查询、本地草稿和显式 Chrome 会话复用。")
    auth = root.add_mutually_exclusive_group()
    auth.add_argument("--auth-file", type=Path, help="独立 0600 认证文件路径；凭据仅从 stdin 导入")
    auth.add_argument("--anonymous", action="store_true", help="不读取认证文件")
    auth.add_argument("--chrome", action="store_true", help="复用 macOS Chrome 已登录的论坛标签页；不导出 Cookie")
    commands = root.add_subparsers(dest="command", required=True)
    for command in ("topic", "course", "competition", "search"):
        child = commands.add_parser(command)
        if command == "topic":
            child.add_argument("topic", help="topic ID、course 或 competition")
        if command == "search":
            child.add_argument("query", help="完整主题内按空白分词、全部匹配，不执行查询文本")
            child.add_argument("--topic", action="append", help="可重复；默认 course 和 competition")
        child.add_argument("--offset", type=bounded(0, 1000000), default=0)
        child.add_argument("--limit", type=bounded(1, 100), default=20)
        child.add_argument("--body-limit", type=bounded(0, 10000), default=2000)
    auth_cmd = commands.add_parser("auth", help="导入独立 session 或检查 Chrome 登录身份")
    auth_commands = auth_cmd.add_subparsers(dest="auth_command", required=True)
    auth_commands.add_parser("import")
    auth_commands.add_parser("status", help="配合 --chrome 检查实时登录身份")
    draft = commands.add_parser("draft", help="正文从 stdin 读取，仅写本地 JSON")
    draft.add_argument("topic")
    draft.add_argument("--reply-to", type=bounded(1, 2**63 - 1), help="被回复的 post_number，不是帖子 ID")
    draft.add_argument("--output", type=Path, help="新文件路径，父目录须为 0700；不覆盖已有文件")
    commands.add_parser("publish", help="未实现；始终失败且不发送请求")
    return root


def page(items, args):
    selected = []
    for item in items[args.offset:args.offset + args.limit]:
        row = dict(item)
        row["body"] = item["body"][:args.body_limit]
        row["body_truncated"] = len(item["body"]) > args.body_limit
        selected.append(row)
    next_offset = args.offset + len(selected)
    return {"total": len(items), "offset": args.offset, "limit": args.limit,
            "next_offset": next_offset if next_offset < len(items) else None, "posts": selected}


def main(argv=None):
    session = None
    exit_code = 0
    try:
        args = parser().parse_args(argv)
        if args.command == "publish":
            raise ForumError("发布未实现；未发送任何请求。请保存本地 draft 并另行审阅。", 4)
        if args.command == "auth":
            if args.auth_command == "status":
                if not args.chrome:
                    raise ForumError("登录检查请使用 qiwoo --chrome auth status。", 2)
                result = ChromeClient().auth_status()
                exit_code = 0 if result["authenticated"] else 3
            else:
                if args.anonymous or args.chrome:
                    raise ForumError("auth import 不能与 --anonymous 或 --chrome 同用。", 2)
                session = parse_session(read_stdin(sys.stdin, AUTH_LIMIT, private=True))
                save_private(args.auth_file or DEFAULT_AUTH, session, replace=True)
                result = {"status": "imported", "origin": ORIGIN, "network_validated": False}
        elif args.command == "draft":
            if args.chrome:
                raise ForumError("draft 仅保存本地草稿，无需 --chrome。", 2)
            target = topic_id(args.topic)
            body = read_stdin(sys.stdin, BODY_LIMIT)
            if not body.strip():
                raise ForumError("草稿正文不能为空。", 2)
            output = args.output or (Path.home() / ".local/share/qiwoo/drafts" / (uuid.uuid4().hex + ".json"))
            draft = {"status": "local_draft", "origin": ORIGIN, "topic_id": target,
                     "topic_url": f"{ORIGIN}/t/topic/{target}",
                     "reply_to_post_number": args.reply_to, "raw": body,
                     "created_at": datetime.now(timezone.utc).isoformat(), "target_validated": False}
            save_private(output, draft)
            result = {"status": "local_draft", "path": str(output), "topic_id": target,
                      "reply_to_post_number": args.reply_to, "sent": False}
        else:
            if args.command == "search":
                targets = list(dict.fromkeys(topic_id(value) for value in (args.topic or list(ALIASES))))
                if not args.query.strip() or len(args.query) > 1000 or len(targets) > 10:
                    raise ForumError("搜索须为 1–1000 字符，最多 10 个不同主题。", 2)
            else:
                target = topic_id(args.topic if args.command == "topic" else args.command)
            if args.chrome:
                client = ChromeClient()
            else:
                if not args.anonymous:
                    session = load_auth(args.auth_file or DEFAULT_AUTH, required=args.auth_file is not None)
                client = Client(session)
            if args.command == "search":
                result = dict(page(client.search(args.query, targets), args), topic_ids=targets)
            else:
                topic = client.topic(target)
                result = dict(page(topic["posts"], args), topic_id=target, title=topic["title"], url=topic["url"])
            result.update({"complete_stream": True, "contract": "discourse_site_unverified",
                           "scope": "accessible_post_stream_snapshot"})
            if args.chrome:
                result.update(client.auth_status())
                result["contract"] = "discourse_read_contract_v1"
        # ASCII JSON escapes terminal control sequences in untrusted forum/draft text.
        print(json.dumps(redact_result(result, session), ensure_ascii=True))
        return exit_code
    except ForumError as exc:
        print("qiwoo: " + redact(str(exc), session), file=sys.stderr)
        return exc.code
    except (OSError, UnicodeError, ValueError, RecursionError):
        print("qiwoo: 本地读写或数据处理失败；细节已脱敏。", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("qiwoo: 已取消。", file=sys.stderr)
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
