"""Bound the model view without rewriting evidence or splitting tool exchanges.

The limit is serialized characters, not a provider token estimate. Projection is
deterministic and uses no model call. Full responses/results remain in the trace.
"""
from __future__ import annotations

import copy
import json


def size(messages):
    return len(json.dumps(messages, ensure_ascii=False))


def excerpt(text, limit=4096):
    if len(text) <= limit:
        return text
    marker = "\n[Omitted from model context; full evidence is in .factory/events.jsonl]\n"
    remaining = max(0, limit - len(marker))
    head = remaining // 3
    return text[:head] + marker + text[-(remaining - head):]


def exchanges(messages):
    """Return complete consecutive exchanges; never invent a missing tool result."""
    blocks = []
    index = 0
    while index < len(messages):
        message = messages[index]
        if message.get("role") == "tool":
            raise ValueError("Context contains an orphan tool result")
        block = [message]
        calls = message.get("tool_calls") or []
        if calls:
            expected = [call["id"] for call in calls]
            if message.get("role") != "assistant" or len(set(expected)) != len(expected):
                raise ValueError("Context contains invalid tool calls")
            results = messages[index + 1:index + 1 + len(calls)]
            actual = [result.get("tool_call_id") for result in results]
            if (any(result.get("role") != "tool" for result in results)
                    or len(actual) != len(expected) or set(actual) != set(expected)):
                raise ValueError("Context contains an incomplete tool exchange")
            block.extend(results)
        blocks.append(block)
        index += len(block)
    return blocks


def project(messages, max_chars, checkpoint):
    """Return a model view and optional audit metadata. Input is never mutated.

    `checkpoint` is evaluated only when pruning old tool output is insufficient.
    It must return fresh system/user messages grounded in the current workspace.
    """
    before = size(messages)
    if before <= max_chars:
        return messages, None
    blocks = exchanges(copy.deepcopy(messages[2:]))
    prefix = copy.deepcopy(messages[:2])
    pruned = []
    # Keep the two most recent exchanges exact, including reasoning_content.
    for block in blocks[:-2]:
        for message in block:
            if message.get("role") == "tool" and len(message.get("content", "")) > 4096:
                message["content"] = excerpt(message["content"])
                pruned.append(message["tool_call_id"])
    view = prefix + [message for block in blocks for message in block]
    dropped = 0
    mode = "prune_tool_output"
    if size(view) > max_chars:
        mode = "workspace_checkpoint"
        prefix = checkpoint()
        if size(prefix) > max_chars:
            raise ValueError("Current requirements and workspace checkpoint exceed the context character limit")
        tail = []
        for block in reversed(blocks):
            candidate = block + tail
            if size(prefix + candidate) > max_chars:
                break
            tail = candidate
        dropped = sum(map(len, blocks)) - len(tail)
        view = prefix + tail
    return view, {"mode": mode, "before_chars": before, "after_chars": size(view),
                  "pruned_tool_call_ids": pruned, "omitted_messages": dropped,
                  "retained_messages": len(view)}
