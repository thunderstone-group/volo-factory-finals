"""Read a `node --test` TAP log the way a person reads it: the failures first.

The model never sees the whole log. What it used to see was `excerpt(output, 5000)`,
head 1/3 plus tail 2/3, and TAP puts its failures in the middle: in Keep run 7, 20 of
26 failed verifications showed the model not one failing test name, and the batch that
broke every hover in the application ran five 71-second verifications reading the same
single visible failure. The model's own answer was to spend 40 `run` calls grepping
`.factory/command-*.log` for "not ok".

So the harness extracts what those greps were looking for. `failure_digest` returns
every `not ok` line, grouped by the error text that explains it, with each distinct
error shown once and counted. It is a pure function of the log text: no model call, no
workspace, and the untouched excerpt still follows it.
"""
from __future__ import annotations

import re

DIGEST_LIMIT = 6000
LINE_LIMIT = 200
NAME_LIMIT = 110

_NOT_OK = re.compile(r"^(\s*)not ok\s+(\d+)\s*(?:-\s*)?(.*)$")
_PLAN = re.compile(r"^\s*1\.\.(\d+)\s*$", re.M)
_SCALAR = re.compile(r"^\s*([A-Za-z_][\w]*):\s*(.*)$")
# Playwright writes its "why" into the middle of a call log: the element that took the
# click, and the locator that was being waited for. Both are one line each and both are
# the difference between "a test failed" and "this button covers that title".
_INTERCEPT = re.compile(r"intercepts pointer events")
_TARGET = re.compile(r"waiting for (?:get[A-Za-z]*\(|locator)")
# The seeded store dumped into every browser-check failure. Tens of kilobytes of note
# titles per failure, and it says nothing the failing assertion does not.
_NOISE = re.compile(r"^\s*(?:Browser state:|Call log:)")


def _clip(text, limit=LINE_LIMIT):
    text = text.strip()
    return text if len(text) <= limit else text[:limit - 1] + "…"


def _block(lines, start, indent):
    """The YAML diagnostic block under a `not ok` line, as raw lines."""
    if start >= len(lines) or lines[start].strip() != "---":
        return [], start
    index = start + 1
    body = []
    while index < len(lines):
        stripped = lines[index].strip()
        if stripped == "..." and len(lines[index]) - len(lines[index].lstrip()) <= indent + 2:
            return body, index + 1
        body.append(lines[index])
        index += 1
    return body, index


def _fields(body):
    """The scalar keys of a TAP diagnostic, with block scalars kept as line lists."""
    fields, key, block, block_indent = {}, None, [], 0
    for line in body:
        indent = len(line) - len(line.lstrip())
        if key is not None and (not line.strip() or indent > block_indent):
            block.append(line)
            continue
        if key is not None:
            fields[key] = block
            key, block = None, []
        match = _SCALAR.match(line)
        if not match:
            continue
        name, value = match.group(1), match.group(2).strip()
        if value in ("|-", "|", ">-", ">"):
            key, block, block_indent = name, [], indent
        else:
            fields[name] = value.strip("'\"")
    if key is not None:
        fields[key] = block
    return fields


def _reason(fields):
    """The few lines of a diagnostic that say why the test failed."""
    lines = []
    error = fields.get("error")
    if isinstance(error, list):
        body = [line for line in error if line.strip()]
        if body:
            lines.append(_clip(body[0]))
        for line in body[1:]:
            if _NOISE.match(line) or not (_INTERCEPT.search(line) or _TARGET.search(line)):
                continue
            candidate = _clip(line.lstrip(" -"))
            if candidate not in lines:
                lines.append(candidate)
            if len(lines) >= 4:
                break
    elif isinstance(error, str) and error:
        lines.append(_clip(error))
    for key in ("expected", "actual"):
        value = fields.get(key)
        if isinstance(value, str) and value and len(lines) < 6:
            lines.append(key + ": " + _clip(value, 60))
    # `location` is always the harness wrapper that calls nodeTest.test, so the first
    # stack frame is the only pointer to the check that actually failed.
    stack = fields.get("stack")
    frame = next((line.strip() for line in stack if line.strip()), "") if isinstance(stack, list) else ""
    frame = frame or (fields.get("location") or "")
    if frame:
        lines.append("at " + _clip(frame.rsplit("/", 2)[-1] if "/" in frame else frame, 120))
    if not lines:
        lines.append(_clip(fields.get("failureType") or fields.get("name") or "no diagnostic"))
    return lines


def failing_tests(output):
    """Every `not ok` in a TAP log, with the diagnostic lines that explain it."""
    lines = (output or "").split("\n")
    failures, index = [], 0
    while index < len(lines):
        match = _NOT_OK.match(lines[index])
        if not match:
            index += 1
            continue
        indent = len(match.group(1))
        body, index = _block(lines, index + 1, indent)
        fields = _fields(body)
        failures.append({"number": int(match.group(2)), "name": match.group(3).strip(),
                         "depth": indent, "reason": _reason(fields),
                         "failure_type": fields.get("failureType") or fields.get("name") or ""})
    return failures


def failure_names(output):
    """The set of failing test names, for comparing one verification against another."""
    return {failure["name"] for failure in failing_tests(output) if failure["name"]}


def _requirement_patterns(requirements):
    patterns = []
    for item in requirements or []:
        identifier = str(item).strip()
        if not identifier:
            continue
        escaped = re.escape(identifier.removeprefix("REQ-"))
        patterns.append(re.compile(r"(?<![\w.])(?:REQ-)?" + escaped + r"(?![\w.])", re.IGNORECASE))
    return patterns


def _signature(failure):
    """What makes two failures the same defect rather than two.

    The twenty-eight hover timeouts of batch 10 differ only in which row they were
    reaching for; they name the same intercepting button and they have one repair. So
    the intercepting element joins the message in the key and the locator being waited
    for does not, unless nothing intercepted and the locator is all there is.
    """
    reason = failure["reason"]
    parts = [reason[0] if reason else "", failure["failure_type"]]
    intercepts = [line for line in reason if _INTERCEPT.search(line)]
    parts.extend(intercepts or [line for line in reason if _TARGET.search(line)])
    return "\n".join(parts)


def failure_digest(output, requirements=(), limit=DIGEST_LIMIT):
    """A bounded summary of a TAP log's failures, this batch's tests first.

    Every failing test is named. One error text is written once and counted, so the
    twenty-eight hover timeouts one misplaced button caused read as one defect and not
    as twenty-eight. Returns the empty string when nothing failed.
    """
    failures = failing_tests(output)
    if not failures:
        return ""
    patterns = _requirement_patterns(requirements)
    groups, order = {}, []
    for failure in failures:
        key = _signature(failure)
        if key not in groups:
            groups[key] = {"reason": failure["reason"], "tests": []}
            order.append(key)
        groups[key]["tests"].append(failure)

    def mine(failure):
        return any(pattern.search(failure["name"]) for pattern in patterns)

    labels = {key: "E%d" % (position + 1) for position, key in enumerate(order)}
    named = [(failure, labels[key]) for key in order for failure in groups[key]["tests"]]
    named.sort(key=lambda item: (not mine(item[0]), item[0]["number"]))
    plan = _PLAN.search(output or "")
    head = "%d of %s checks failed." % (len(failures), plan.group(1) if plan else "the")
    if patterns:
        head += " This batch's own tests come first."
    head += " Errors repeated across tests are written once, with their count."

    rows = ["not ok %d - %s  [%s]" % (failure["number"], _clip(failure["name"], NAME_LIMIT), label)
            for failure, label in named]
    parts, used, kept = [head], len(head), 0
    for row in rows:
        if used + len(row) + 1 > limit - 260:
            break
        parts.append(row)
        used += len(row) + 1
        kept += 1
    if kept < len(rows):
        tail = "... and %d more failing checks" % (len(rows) - kept)
        parts.append(tail)
        used += len(tail) + 1
    written = 0
    for key in order:
        group = groups[key]
        count = len(group["tests"])
        detail = "[%s]%s %s" % (labels[key], " x%d" % count if count > 1 else "",
                                "\n     ".join(group["reason"]))
        if used + len(detail) + 2 > limit:
            parts.append("... and %d more distinct errors" % (len(order) - written))
            break
        parts.extend(["", detail])
        used += len(detail) + 2
        written += 1
    return "\n".join(parts)[:limit]
