"""Requirement scenarios as executable browser steps (Python standard library only).

`load_yaml` reads the YAML subset the requirement files use: block mappings and sequences,
plain / single / double quoted scalars (also across lines), `>` and `|` blocks and simple
flow collections. `plan` turns every ATOMIC requirement's GIVEN/WHEN/THEN scenario into a
list of steps for `scenario_check.cjs`.

Only fixed sentence shapes are parsed. Names come from backticks (from double quotes when a
sentence has no backticks). A clause that matches no shape, or a quoted name no shape consumes,
makes the whole scenario `unparsed`; nothing is guessed. GIVEN state comes from the dependency
chain: the prerequisites' WHEN steps run first (their THEN steps are not asserted), then the
scenario's own WHEN steps, then only its own THEN steps are asserted.
"""
import datetime
import re

__all__ = ["YAMLError", "load_yaml", "load_requirements", "plan", "mask"]


# ------------------------------------------------------------------------------ YAML subset

class YAMLError(ValueError):
    """The text uses YAML this subset does not read."""


_KEY = re.compile(r"""^(?P<key>[^\s'"\[\]{},#&*!|>%@`-](?:[^:\n]|:(?=\S))*?|-(?=\S)(?:[^:\n]|:(?=\S))*?)"""
                  r"""[ \t]*:(?:[ \t]+(?P<rest>.*))?$""")
_BLOCK_HEADER = re.compile(r"^([|>])([+-]?)([1-9]?)([+-]?)[ \t]*(?:#.*)?$")
_NULL = {"", "~", "null", "Null", "NULL"}
_BOOL = {**{w: True for w in ("yes", "Yes", "YES", "true", "True", "TRUE", "on", "On", "ON")},
         **{w: False for w in ("no", "No", "NO", "false", "False", "FALSE", "off", "Off", "OFF")}}
_INT = re.compile(r"^[-+]?(?:0|[1-9][0-9_]*)$")
_INT_BASE = re.compile(r"^([-+]?)0(b[01_]+|x[0-9a-fA-F_]+|[0-7_]+)$")
_FLOAT = re.compile(r"^(?:[-+]?[0-9][0-9_]*\.[0-9_]*(?:[eE][-+][0-9]+)?|\.[0-9][0-9_]*(?:[eE][-+][0-9]+)?)$")
_DATE = re.compile(r"^([0-9]{4})-([0-9]{2})-([0-9]{2})$")
_ESCAPES = {"0": "\0", "a": "\a", "b": "\b", "t": "\t", "\t": "\t", "n": "\n", "v": "\v", "f": "\f",
            "r": "\r", "e": "\x1b", " ": " ", '"': '"', "/": "/", "\\": "\\", "N": "\x85", "_": "\xa0",
            "L": " ", "P": " "}


def _resolve(text):
    """Implicit typing of a plain scalar, as PyYAML's YAML 1.1 resolver does for these cases."""
    if text in _NULL:
        return None
    if text in _BOOL:
        return _BOOL[text]
    if _INT.match(text):
        return int(text.replace("_", ""))
    match = _INT_BASE.match(text)
    if match:
        body = match.group(2).replace("_", "")
        base, digits = (2, body[1:]) if body[0] == "b" else (16, body[1:]) if body[0] == "x" else (8, body)
        return (-1 if match.group(1) == "-" else 1) * int(digits or "0", base)
    if _FLOAT.match(text):
        return float(text.replace("_", ""))
    if re.match(r"^[-+]?\.(?:inf|Inf|INF)$", text):
        return float("-inf") if text.startswith("-") else float("inf")
    if re.match(r"^\.(?:nan|NaN|NAN)$", text):
        return float("nan")
    match = _DATE.match(text)
    if match:
        try:
            return datetime.date(*(int(part) for part in match.groups()))
        except ValueError:
            return text
    return text


def _quote_end(text, start, quote):
    """Index of the quote closing a scalar whose body starts at `start`, or None."""
    i = start
    while i < len(text):
        if quote == '"' and text[i] == "\\":
            i += 2
            continue
        if text[i] == quote:
            if quote == "'" and text[i + 1:i + 2] == "'":
                i += 2
                continue
            return i
        i += 1
    return None


def _unescape(body):
    out, i = [], 0
    while i < len(body):
        if body[i] != "\\":
            out.append(body[i])
            i += 1
            continue
        code = body[i + 1:i + 2]
        if code in _ESCAPES:
            out.append(_ESCAPES[code])
            i += 2
        elif code in ("x", "u", "U"):
            width = {"x": 2, "u": 4, "U": 8}[code]
            try:
                out.append(chr(int(body[i + 2:i + 2 + width], 16)))
            except ValueError:
                raise YAMLError(f"bad escape \\{code}{body[i + 2:i + 2 + width]}") from None
            i += 2 + width
        else:
            raise YAMLError(f"unknown escape \\{code}")
    return "".join(out)


def _unquote(body, quote):
    return body.replace("''", "'") if quote == "'" else _unescape(body)


def _fold(lines):
    """Flow folding: a line break becomes a space, a run of n empty lines becomes n newlines."""
    out, empties = lines[0], 0
    for index in range(1, len(lines)):
        line = lines[index]
        if line == "" and index < len(lines) - 1:
            empties += 1
            continue
        out += "\n" * empties if empties else " "
        out += line
        empties = 0
    return out


def _strip_comment(text):
    match = re.search(r"[ \t]#", text)
    return (text[:match.start()] if match else text).strip()


class _Incomplete(Exception):
    pass


def _skip_space(text, i):
    while i < len(text) and text[i] in " \t":
        i += 1
    return i


def _flow(text, i, key=False):
    """One flow node at text[i:]; returns (value, index after it). Raises _Incomplete at end of text."""
    i = _skip_space(text, i)
    if i >= len(text):
        raise _Incomplete
    head = text[i]
    if head in "[{":
        close, items, mapping = ("]" if head == "[" else "}"), [], {}
        i += 1
        while True:
            i = _skip_space(text, i)
            if i >= len(text):
                raise _Incomplete
            if text[i] == close:
                return (items if head == "[" else mapping), i + 1
            if head == "[":
                value, i = _flow(text, i)
                items.append(value)
            else:
                name, i = _flow(text, i, key=True)
                i = _skip_space(text, i)
                value = None
                if i < len(text) and text[i] == ":":
                    value, i = _flow(text, i + 1)
                mapping[name] = value
            i = _skip_space(text, i)
            if i >= len(text):
                raise _Incomplete
            if text[i] == ",":
                i += 1
            elif text[i] != close:
                raise YAMLError(f"unexpected {text[i]!r} in flow collection")
    if head in "'\"":
        end = _quote_end(text, i + 1, head)
        if end is None:
            raise _Incomplete
        return _unquote(text[i + 1:end], head), end + 1
    j = i
    while j < len(text) and text[j] not in ",]}" and not (text[j] == "#" and text[j - 1] in " \t"):
        if text[j] == ":" and (j + 1 == len(text) or text[j + 1] in " \t,]}"):
            break
        j += 1
    raw = text[i:j].strip()
    return (raw if key else _resolve(raw)), j


class _Parser:
    def __init__(self, text):
        self.lines = text.lstrip("﻿").replace("\r\n", "\n").replace("\r", "\n").split("\n")

    @staticmethod
    def indent(line):
        return len(line) - len(line.lstrip(" "))

    def skip(self, i):
        """Index of the next line with content (not blank, a comment or a document marker)."""
        while i < len(self.lines):
            stripped = self.lines[i].strip()
            marker = self.lines[i][:3] in ("---", "...") and stripped in ("---", "...")
            if stripped and not stripped.startswith("#") and not marker:
                return i
            i += 1
        return i

    def document(self):
        i = self.skip(0)
        if i >= len(self.lines):
            return None
        value, i = self.node(i, self.indent(self.lines[i]), -1)
        i = self.skip(i)
        if i < len(self.lines):
            raise YAMLError(f"line {i + 1}: unexpected content {self.lines[i].strip()[:60]!r}")
        return value

    def node(self, i, indent, parent):
        content = self.lines[i][indent:]
        if content == "-" or content.startswith("- "):
            return self.sequence(i, indent)
        if self.key(content) is not None:
            return self.mapping(i, indent)
        return self.scalar(i, content, parent)

    def key(self, content):
        if content[:1] in ("'", '"'):
            end = _quote_end(content, 1, content[0])
            if end is None or not re.match(r":(?:[ \t]|$)", content[end + 1:]):
                return None
            return _unquote(content[1:end], content[0]), content[end + 2:].strip()
        match = _KEY.match(content)
        if not match:
            return None
        return match.group("key"), (match.group("rest") or "").strip()

    def mapping(self, i, indent):
        result = {}
        while True:
            i = self.skip(i)
            if i >= len(self.lines):
                return result, i
            line = self.lines[i]
            level = self.indent(line)
            if level < indent:
                return result, i
            if level > indent:
                raise YAMLError(f"line {i + 1}: unexpected indentation")
            pair = self.key(line[indent:])
            if pair is None:
                return result, i
            name, rest = pair
            result[name], i = self.value(i, indent, rest)

    def value(self, i, indent, rest):
        if not rest or rest.startswith("#"):
            j = self.skip(i + 1)
            if j < len(self.lines):
                line = self.lines[j]
                level = self.indent(line)
                if level > indent:
                    return self.node(j, level, indent)
                if level == indent and (line[level:] == "-" or line[level:].startswith("- ")):
                    return self.sequence(j, level)
            return None, i + 1
        return self.scalar(i, rest, indent)

    def sequence(self, i, indent):
        result = []
        while True:
            i = self.skip(i)
            if i >= len(self.lines):
                return result, i
            line = self.lines[i]
            level = self.indent(line)
            if level < indent:
                return result, i
            if level > indent:
                raise YAMLError(f"line {i + 1}: unexpected indentation")
            content = line[indent:]
            if not (content == "-" or content.startswith("- ")):
                return result, i
            after = content[1:]
            item = after.lstrip(" ")
            if not item or item.startswith("#"):
                j = self.skip(i + 1)
                if j < len(self.lines) and self.indent(self.lines[j]) > indent:
                    value, i = self.node(j, self.indent(self.lines[j]), indent)
                else:
                    value, i = None, i + 1
                result.append(value)
                continue
            column = indent + 1 + len(after) - len(item)
            self.lines[i] = " " * column + item  # the entry's content now starts a node at its own column
            value, i = self.node(i, column, indent)
            result.append(value)

    def scalar(self, i, text, parent):
        head = text[:1]
        if head in "|>" and _BLOCK_HEADER.match(text):
            return self.block(i, text, parent)
        if head in "[{":
            return self.flow(i, text)
        if head in "'\"":
            return self.quoted(i, text)
        return self.plain(i, text, parent)

    def plain(self, i, text, parent):
        parts, j = [_strip_comment(text)], i + 1
        while j < len(self.lines):
            line = self.lines[j]
            stripped = line.strip()
            if not stripped:
                parts.append("")
                j += 1
                continue
            if self.indent(line) <= parent or stripped.startswith("#"):
                break
            parts.append(_strip_comment(stripped))
            j += 1
        while len(parts) > 1 and parts[-1] == "":
            parts.pop()
        return _resolve(_fold(parts)), j

    def quoted(self, i, text):
        quote, buffer, pieces, j = text[0], text[1:], [], i
        while True:
            end = _quote_end(buffer, 0, quote)
            if end is not None:
                pieces.append(buffer[:end])
                tail = buffer[end + 1:].strip()
                if tail and not tail.startswith("#"):
                    raise YAMLError(f"line {j + 1}: unexpected text after a quoted scalar")
                break
            pieces.append(buffer)
            j += 1
            if j >= len(self.lines):
                raise YAMLError(f"line {i + 1}: unterminated quoted scalar")
            buffer = self.lines[j].lstrip(" \t")
        if len(pieces) == 1:
            return _unquote(pieces[0], quote), j + 1
        merged = []
        for piece in pieces:  # a backslash before a line break joins the lines without a space
            if merged and quote == '"' and re.search(r"(?<!\\)(?:\\\\)*\\$", merged[-1]):
                merged[-1] = merged[-1][:-1] + piece
            else:
                merged.append(piece)
        lines = [merged[0].rstrip(" \t")] + [p.strip(" \t") for p in merged[1:-1]] + (
            [merged[-1]] if len(merged) > 1 else [])
        return _unquote(_fold(lines), quote), j + 1

    def flow(self, i, text):
        buffer, j = text, i
        while True:
            try:
                value, end = _flow(buffer, 0)
            except _Incomplete:
                j += 1
                if j >= len(self.lines):
                    raise YAMLError(f"line {i + 1}: unterminated flow collection") from None
                buffer += " " + self.lines[j].strip()
                continue
            tail = buffer[end:].strip()
            if tail and not tail.startswith("#"):
                raise YAMLError(f"line {j + 1}: unexpected text after a flow collection")
            return value, j + 1

    def block(self, i, text, parent):
        style, chomp_a, digit, chomp_b = _BLOCK_HEADER.match(text).groups()
        chomp = chomp_a or chomp_b
        j = i + 1
        if digit:
            content_indent = max(parent, 0) + int(digit)
        else:
            k = j
            while k < len(self.lines) and not self.lines[k].strip():
                k += 1
            content_indent = max(self.indent(self.lines[k]) if k < len(self.lines) else 0, parent + 1)
        raw = []
        while j < len(self.lines):
            line = self.lines[j]
            if not line.strip():
                raw.append("")
            elif self.indent(line) < content_indent:
                break
            else:
                raw.append(line[content_indent:])
            j += 1
        # Port of PyYAML's scan_block_scalar folding and chomping.
        index, breaks, chunks, line_break = 0, [], [], ""
        while index < len(raw) and raw[index] == "":
            breaks.append("\n")
            index += 1
        while index < len(raw):
            chunks.extend(breaks)
            current = raw[index]
            leading_non_space = not current.startswith((" ", "\t"))
            chunks.append(current)
            line_break = "\n"
            index += 1
            breaks = []
            while index < len(raw) and raw[index] == "":
                breaks.append("\n")
                index += 1
            if index >= len(raw):
                break
            if style == ">" and leading_non_space and not raw[index].startswith((" ", "\t")):
                if not breaks:
                    chunks.append(" ")
            else:
                chunks.append(line_break)
        if chomp != "-":
            chunks.append(line_break)
        if chomp == "+":
            chunks.extend(breaks)
        return "".join(chunks), j


def load_yaml(text):
    """Parse the YAML subset used by requirement files into dicts, lists and scalars."""
    return _Parser(text).document()


# ------------------------------------------------------------------------ requirement tree

def _text(value):
    if value is None:
        return ""
    return value if isinstance(value, str) else str(value)


def _steps(raw):
    steps, previous = [], "GIVEN"
    for step in raw or []:
        if isinstance(step, dict):
            keyword, content = _text(step.get("keyword")).strip().upper(), _text(step.get("content")).strip()
        else:
            match = re.match(r"^\s*(GIVEN|WHEN|THEN|AND|BUT)\b[:\s]*(.*)$", _text(step), re.I | re.S)
            keyword, content = (match.group(1).upper(), match.group(2).strip()) if match else ("", _text(step))
        if keyword in ("AND", "BUT", ""):
            keyword = previous
        previous = keyword
        steps.append({"keyword": keyword, "content": content})
    return steps


def load_requirements(text):
    """Flatten the requirement tree: [{id, name, type, description, dependencies, scenarios, parent}]."""
    document = load_yaml(text)
    if isinstance(document, dict) and "requirements" in document and "id" not in document:
        document = document["requirements"]
    out = []

    def walk(node, parent):
        if isinstance(node, list):
            for item in node:
                walk(item, parent)
            return
        if not isinstance(node, dict):
            return
        rid = _text(node.get("id")).strip()
        scenarios = []
        for index, scenario in enumerate(node.get("scenarios") or []):
            if isinstance(scenario, dict):
                scenarios.append({"name": _text(scenario.get("name")) or f"scenario {index + 1}",
                                  "steps": _steps(scenario.get("steps"))})
        if not scenarios and node.get("steps"):
            scenarios.append({"name": _text(node.get("name")), "steps": _steps(node.get("steps"))})
        kind = _text(node.get("type")).strip().upper() or ("ATOMIC" if scenarios else "FOLDER")
        dependencies = node.get("dependencies") or []
        if isinstance(dependencies, str):
            dependencies = [dependencies]
        if rid:
            out.append({"id": rid, "name": _text(node.get("name")), "type": kind,
                        "description": _text(node.get("description")),
                        "dependencies": [_text(d).strip() for d in dependencies if _text(d).strip()],
                        "scenarios": scenarios, "parent": parent})
        walk(node.get("children") or [], rid or parent)

    walk(document, None)
    return out


# ----------------------------------------------------------------------------- sentences

_TICK = re.compile(r"`([^`\n]*)`")
_DOUBLE = re.compile(r'"([^"\n]+)"|“([^”\n]+)”')
_TOKEN = re.compile(r"«(\d+)»")
_LIST_TOKEN = re.compile(r"‹(\d+)›")


def mask(sentence):
    """Replace quoted names with «n» tokens: backticks, or double quotes when there are no backticks."""
    names = []

    def keep(match):
        names.append(next(group for group in match.groups() if group is not None))
        return f"«{len(names) - 1}»"

    masked = (_TICK if "`" in sentence else _DOUBLE).sub(keep, sentence)
    masked = re.sub(r"\s+", " ", masked).strip()
    masked = re.sub(r"[\s.!]+$", "", masked)
    return masked.lower(), names


def _restore(text, names, lists=()):
    text = _LIST_TOKEN.sub(lambda m: ", ".join(f"`{names[i]}`" for i in lists[int(m.group(1))]), text)
    return _TOKEN.sub(lambda m: f"`{names[int(m.group(1))]}`", text)


def _merge_lists(text):
    """`«0», «1», and «2»` -> one list token, so a THEN clause can name several things."""
    lists = []

    def keep(match):
        lists.append([int(n) for n in _TOKEN.findall(match.group(0))])
        return f"‹{len(lists) - 1}›"

    pattern = r"«\d+»(?:\s*,\s*«\d+»)*\s*,?\s*(?:and|or)\s+«\d+»"
    return re.sub(pattern, keep, text), lists


_SPLIT = re.compile(r"\s*;\s*|,\s*(?:and\s+then|then|and|while|but)\s+|\s+(?:and\s+then|then)\s+|"
                    r",\s*(?=where\b)|\s+and\s+|,\s+")


_ENUM = re.compile(r"\b[a-z-]+(?: [a-z-]+)?(?:, [a-z-]+(?: [a-z-]+)?)+,? (?:or|and) [a-z-]+(?: [a-z-]+){0,2}\b")
_COMMA = "\ue000"


def _clauses(text):
    """Split a sentence into clauses at `,` `;` `and` `then`, keeping short enumerations (`a shelf, book, or page view`)."""
    text = _ENUM.sub(lambda m: m.group(0).replace(",", _COMMA), text)
    return [part.strip().replace(_COMMA, ",") for part in _SPLIT.split(text) if part and part.strip()]


class Unparsed(Exception):
    def __init__(self, phase, text, reason):
        super().__init__(f"{phase.upper()} {text!r}: {reason}")
        self.phase, self.text, self.reason = phase, text, reason


# Role vocabulary: (pattern, roles, kind). Longer phrases first.
_FIELD = ["textbox", "searchbox", "combobox", "spinbutton"]
_ROLE_TABLE = [
    (r"links? or buttons?|buttons? or links?", ["link", "button"], "control"),
    (r"headings? or (?:named )?regions?|regions? or (?:named )?headings?", ["heading", "region"], "structure"),
    (r"menu ?items?", ["menuitem"], "control"),
    (r"list ?items?", ["listitem"], "entry"),
    (r"radio(?: buttons?)?", ["radio"], "control"),
    (r"check ?box(?:es)?", ["checkbox"], "control"),
    (r"toggles?|switch(?:es)?", ["switch", "button"], "control"),
    (r"tab ?panels?", ["tabpanel"], "structure"),
    (r"(?:(?:multi-?line|password|email|search|text|number|date|single-line)\s+)*"
     r"(?:text ?box(?:es)?|text ?areas?|text fields?|input fields?|fields?|inputs?|search ?box(?:es)?|editors?)",
     _FIELD, "field"),
    (r"combo ?box(?:es)?|drop-?downs?|select(?: box)?(?:es)?|pickers?", ["combobox", "listbox"], "field"),
    (r"tabs?", ["tab"], "control"),
    (r"buttons?", ["button"], "control"),
    (r"links?", ["link"], "control"),
    (r"options?", ["option"], "control"),
    (r"headings?|titles?", ["heading"], "structure"),
    (r"regions?|sections?", ["region"], "structure"),
    (r"forms?", ["form"], "structure"),
    (r"dialogs?|modals?|pop-?ups?", ["dialog", "alertdialog"], "structure"),
    (r"lists?", ["list"], "structure"),
    (r"rows?", ["row"], "entry"),
    (r"tables?|grids?", ["table", "grid"], "structure"),
    (r"images?|icons?|logos?|pictures?", ["img"], "structure"),
    (r"navigation(?: bar)?|nav(?: ?bar)?", ["navigation"], "structure"),
    (r"menus?", ["menu"], "structure"),
    (r"alerts?", ["alert"], "structure"),
    (r"articles?", ["article"], "structure"),
    (r"groups?", ["group"], "structure"),
    (r"sliders?", ["slider"], "control"),
    (r"controls?|elements?|widgets?", [], "control"),
    (r"entries|entry|items?|cards?|tiles?|records?|results?", [], "entry"),
]
_ROLE_RE = re.compile(r"\b(?:" + "|".join(f"({p})" for p, _, _ in _ROLE_TABLE) + r")\b")
_UNIQUE = re.compile(r"\b(?:exactly one|only one|a single|single|a unique|the unique|unique|uniquely|one)\b")
_NAMING = re.compile(r"\b(?:named|labell?ed|called|titled|with (?:the )?(?:accessible )?name|"
                     r"with (?:the )?(?:exact )?text|with (?:the )?(?:exact )?(?:label|title)|reading|"
                     r"(?:exactly )?matching)\b")
_PLACEHOLDER = re.compile(r"\bwith (?:the |an? )?(?:exact )?placeholder\b|\bplaceholder\b")
_SCOPE_SPLIT = re.compile(r"^(?P<core>.*?«\d+».*?)\s+(?:in|inside|within|on|from|under|at|of|for)\s+"
                          r"(?P<scope>(?:the|a|an|this|that|its|their|each|every|any|all)\b.*|«\d+».*)$")
_LANDMARK = re.compile(r"\b(?:nav(?:igation)?|navbar|menu ?bar|header|top bar|app ?bar|toolbar|banner|masthead)\b")


def _roles_in(text, prefer_last):
    found = [(m.start(), next(i for i, g in enumerate(m.groups()) if g)) for m in _ROLE_RE.finditer(text)]
    if not found:
        return None
    _, index = found[-1] if prefer_last else found[0]
    _, roles, kind = _ROLE_TABLE[index]
    return list(roles), kind


def _scope(text, names):
    """A scope phrase after in/inside/within/on: a quoted container, a navigation landmark or a phrase."""
    text = text.strip()
    match = re.fullmatch(r"(?:the |a |an )?«(\d+)»(?: (?P<role>.+))?", text)
    if match:
        found = _roles_in(match.group("role") or "", False)
        return {"type": "named", "name": names[int(match.group(1))], "roles": found[0] if found else [],
                "strict": True}
    if _TOKEN.search(text):
        return None  # a quoted name inside an unrecognised scope phrase: do not guess
    if _LANDMARK.search(text):
        return {"type": "landmark"}
    return {"type": "phrase", "text": re.sub(r"^(?:the|a|an|this|its|their)\s+", "", text)}


def _target(phrase, names, default_kind, allow_scope=True):
    """`the unique link or button named «0» in the shelf list` -> target dict and unique flag."""
    phrase = phrase.strip()
    scope = None
    if allow_scope:
        match = _SCOPE_SPLIT.match(phrase)
        if match and len(_TOKEN.findall(match.group("core"))) == 1:
            scope = _scope(match.group("scope"), names)
            if scope is None:
                return None
            phrase = match.group("core")
    tokens = _TOKEN.findall(phrase)
    if len(tokens) != 1:
        return None
    pre, post = phrase.split(f"«{tokens[0]}»", 1)
    unique = bool(_UNIQUE.search(pre))
    placeholder = bool(_PLACEHOLDER.search(pre))
    found = _roles_in(_NAMING.sub(" ", pre), True) or _roles_in(post, False)
    roles, kind = found if found else ([], default_kind)
    if kind == "structure" and not roles:
        kind = default_kind
    target = {"name": names[int(tokens[0])], "roles": roles, "kind": kind}
    if placeholder:
        target["kind"], target["roles"] = "field", _FIELD
    if scope:
        target["scope"] = scope
    return target, unique, post.strip()


# --------------------------------------------------------------------------------- WHEN

_ACTOR = re.compile(r"^(?:the |a |an )?(?:user|visitor|customer|admin(?:istrator)?|guest|reader|member|shopper|"
                    r"traveller|traveler|passenger|buyer|seller|editor|author|owner)\s+")
_GOTO = re.compile(r"^(?:opens?|visits?|loads?|launch(?:es)?|navigates? to|goes to|go to|enters?|accesses|access|"
                   r"browses? to|points the browser to|types)\s+(?:the |an? )?(?:application|app|system|site|website|"
                   r"web ?site|web application|home ?page|landing page|home|root url|entry url|base url)"
                   r"(?:'s)?(?:\s+(?:entry|root|base|home|start))?(?:\s+(?:url|address|link|page))?"
                   r"(?:\s+in (?:the|a|his|her) (?:web )?browser)?$")
_ACTIVATE = re.compile(r"^(?P<verb>activates?|clicks?(?: on)?|double[- ]clicks?(?: on)?|presses?|taps?(?: on)?|"
                       r"selects?|chooses?|opens?|toggles?|expands?|collapses?|follows?|hits?|triggers?|"
                       r"submits?|uses?)\s+(?P<obj>.+)$")
_FILL_INTO = re.compile(r"^(?:enters?|types?|inputs?|writes?|provides?|puts?|pastes?|fills? in|keys? in)\s+"
                        r"«(?P<v>\d+)»\s+(?:in|into|as|for|on|inside)\s+(?P<field>.+)$")
_FILL_WITH = re.compile(r"^(?:fills?(?: in| out)?|sets?|populates?|completes?|updates?|changes?|replaces?)\s+"
                        r"(?P<field>.+?)\s+(?:with|to|as)\s+«(?P<v>\d+)»$")
_CLEAR = re.compile(r"^(?:clears?|empties)\s+(?P<field>.*«\d+».*)$")
_CHECK = re.compile(r"^(?P<verb>checks?|ticks?|unchecks?|unticks?|deselects?|enables?|disables?|selects?)\s+"
                    r"(?P<obj>.*«\d+».*)$")
_HOVER = re.compile(r"^(?:hovers?(?: over| on)?|mouses? over|moves the (?:mouse|pointer) over|points at)\s+(?P<obj>.+)$")
_KEYS = {"enter": "Enter", "return": "Enter", "escape": "Escape", "esc": "Escape", "tab": "Tab", "space": " ",
         "backspace": "Backspace", "delete": "Delete", "arrow up": "ArrowUp", "arrow down": "ArrowDown",
         "arrow left": "ArrowLeft", "arrow right": "ArrowRight", "up arrow": "ArrowUp", "down arrow": "ArrowDown"}
_PRESS = re.compile(r"^(?:presses?|hits?|types?)\s+(?:the\s+)?(?P<key>" + "|".join(sorted(_KEYS, key=len, reverse=True))
                    + r")(?:\s+key)?(?:\s+(?:in|on|inside)\s+(?P<obj>.+))?$")
_LOOK = re.compile(r"^(?:reviews?|views?|looks? at|observes?|reads?|inspects?|checks?|examines?|scrolls?|waits?)\b")
_SYSTEM = re.compile(r"^(?:the |an? )?(?:system|application|app|page|browser|server|site|platform)\b")


def _when_clause(clause, names):
    """One WHEN clause -> list of ops. Raises Unparsed."""
    text = re.sub(r"^(?:then|and|also|finally|next|first|afterwards)\s+", "", clause)
    text = _ACTOR.sub("", text)
    if _SYSTEM.match(text) and not _TOKEN.search(text):
        return [{"op": "wait", "ms": 400}]
    if _GOTO.match(text):
        return [{"op": "goto", "path": "/"}]
    if _LOOK.match(text) and not _TOKEN.search(text):
        return [{"op": "wait", "ms": 100}]
    match = _PRESS.match(text)
    if match and not match.group("obj"):
        return [{"op": "press", "key": _KEYS[match.group("key")]}]
    match = _FILL_INTO.match(text) or _FILL_WITH.match(text)
    if match:
        found = _target(match.group("field"), names, "field")
        if not found:
            raise Unparsed("when", clause, "the field phrase does not name exactly one field")
        target, unique, _ = found
        target["kind"] = "field"
        if not target["roles"] or not set(target["roles"]) <= set(_FIELD + ["listbox"]):
            target["roles"] = list(_FIELD)
        return [{"op": "fill", "target": target, "value": names[int(match.group("v"))], "unique": unique}]
    match = _CLEAR.match(text)
    if match:
        found = _target(match.group("field"), names, "field")
        if found:
            target, unique, _ = found
            target["kind"], target["roles"] = "field", _FIELD
            return [{"op": "fill", "target": target, "value": "", "unique": unique}]
    match = _CHECK.match(text)
    if match:
        verb, obj = match.group("verb"), match.group("obj")
        checkable = re.search(r"\b(?:check ?box|radio|switch|toggle)", obj)
        if verb.startswith(("check", "tick", "uncheck", "untick")) or checkable:
            found = _target(obj, names, "control")
            if not found:
                raise Unparsed("when", clause, "the checkbox phrase does not name exactly one control")
            target, unique, _ = found
            if not target["roles"] or target["roles"] == ["button"]:
                target["roles"] = ["checkbox", "radio", "switch"]
            state = not verb.startswith(("uncheck", "untick", "deselect", "disable"))
            return [{"op": "check", "target": target, "checked": state, "unique": unique}]
    match = _HOVER.match(text)
    if match:
        found = _target(match.group("obj"), names, "control")
        if not found:
            raise Unparsed("when", clause, "the hover phrase does not name exactly one element")
        target, unique, _ = found
        return [{"op": "hover", "target": target, "unique": unique}]
    match = _ACTIVATE.match(text)
    if match:
        verb, obj = match.group("verb"), match.group("obj")
        selected = re.fullmatch(r"(?:the )?(?:option )?«(\d+)»(?: option)?\s+(?:from|in|within)\s+(?P<field>.*«\d+».*)", obj)
        if verb.startswith(("select", "choose")) and selected:
            found = _target(selected.group("field"), names, "field", allow_scope=False)
            if found:
                target, unique, _ = found
                target["kind"] = "field"
                target["roles"] = ["combobox", "listbox"] if not target["roles"] or target["roles"] == _FIELD else target["roles"]
                return [{"op": "select", "target": target, "option": names[int(selected.group(1))], "unique": unique}]
        if verb.startswith(("press", "hit")):
            key = re.fullmatch(r"(?:the )?«(\d+)»(?: key)?", obj)
            if key and names[int(key.group(1))].lower() in _KEYS:
                return [{"op": "press", "key": _KEYS[names[int(key.group(1))].lower()]}]
        found = _target(obj, names, "control")
        if not found:
            raise Unparsed("when", clause, "the activation phrase does not name exactly one control")
        target, unique, _ = found
        op = {"op": "click", "target": target, "unique": unique}
        if verb.startswith("double"):
            op["double"] = True
        return [op]
    if _TOKEN.search(text):
        raise Unparsed("when", clause, "no step shape matches this action")
    raise Unparsed("when", clause, "the action names no control")


# ---------------------------------------------------------------------------------- GIVEN

_TRIVIAL_GIVEN = [
    re.compile(r"^(?:the |an? )?(?:system|application|app|site|website|service|server|backend|web application)"
               r"(?: is| has been| are)? (?:accessible|available|running|online|up|started|deployed|reachable|open)(?: .*)?$"),
    re.compile(r"^(?:the )?user has (?:a|an) (?:web )?browser(?: .*)?$"),
    re.compile(r"^(?:the )?(?:global |top |main |primary |site |homepage )?(?:navigation(?: bar)?|nav(?: ?bar)?|header|menu)"
               r"(?: bar)? (?:is|are) (?:visible|displayed|shown|present|available)$"),
    re.compile(r"^(?:the )?(?:user )?(?:can|is able to) (?:access|see|use|reach) (?:the |an? )?[a-z -]*?"
               r"(?:panel|area|bar|menu|actions?|toolbar|section|controls?|buttons?)$"),
    re.compile(r"^at least (?:one|1|a) [a-z -]+? (?:is|are) (?:visible|listed|shown|displayed|present|available)(?: [a-z -]+)?$"),
    re.compile(r"^(?:an? |the )?[a-z -]+ (?:already )?exists?(?: [a-z -]+)?$"),
]
_AUTH_NO = re.compile(r"^(?:the )?(?:user )?(?:is |has )?(?:not|never) (?:yet )?(?:logged|signed) (?:in|on)$|"
                      r"^(?:the )?user is (?:anonymous|a guest|unauthenticated|logged out|signed out)$")
_AUTH = re.compile(r"^(?:the )?user (?:is|has|has been|was) (?:already |successfully )?(?:logged|signed) (?:in|on)"
                   r"(?: successfully)?(?: [a-z -]+)?$|^(?:the )?user is authenticated$|"
                   r"^(?:the )?user has (?:successfully )?(?:logged|signed) (?:in|on)(?: successfully)?$")
_WHERE = re.compile(r"^(?:the |an? )?(?P<who>(?:authenticated |logged-in |signed-in |anonymous |unauthenticated )?"
                    r"(?:user|visitor|guest|customer|reader|admin(?:istrator)?|member))"
                    r"(?: is| remains| stays)?(?: currently| already)? (?:on|at|in|viewing|browsing|visiting|using|"
                    r"looking at) (?P<where>.+)$")


def _given(content):
    """GIVEN step -> {auth: True/False/None, location: phrase or None}. Raises Unparsed."""
    masked, _ = mask(content)
    state = {"auth": None, "location": None}
    for clause in _clauses(masked):
        text = re.sub(r"^(?:and|also|then)\s+", "", clause)
        if _AUTH_NO.match(text):
            state["auth"] = False
            continue
        if _AUTH.match(text):
            state["auth"] = True
            continue
        if any(pattern.match(text) for pattern in _TRIVIAL_GIVEN) and not _TOKEN.search(text):
            continue
        match = _WHERE.match(text)
        if match and not _TOKEN.search(text):
            if re.match(r"(?:authenticated|logged-in|signed-in)", match.group("who")):
                state["auth"] = True
            where = match.group("where")
            if _page_key(where) is None:
                raise Unparsed("given", clause, "the location is not a page this checker can identify")
            state["location"] = where
            continue
        raise Unparsed("given", clause, "the state is neither trivial, a login state nor a page location")
    return state


# --------------------------------------------------------------------------------- pages

_TYPE_WORDS = {
    "detail": "detail", "details": "detail", "view": "detail", "viewer": "detail",
    "list": "list", "listing": "list", "lists": "list", "index": "list", "overview": "list",
    "creation": "create", "create": "create", "new": "create", "add": "create", "adding": "create",
    "edit": "edit", "editing": "edit", "editor": "edit", "update": "edit",
    "delete": "delete", "deletion": "delete", "remove": "delete", "removal": "delete",
    "confirmation": "confirm", "confirm": "confirm",
    "reading": "read", "read": "read", "reader": "read",
    "home": "home", "homepage": "home", "dashboard": "home", "landing": "home",
    "login": "login", "log-in": "login", "signin": "login", "sign-in": "login",
    "register": "register", "registration": "register", "signup": "register", "sign-up": "register",
    "form": "form", "search": "search", "settings": "settings", "setting": "settings",
}
_PAGE_STOP = {"the", "a", "an", "its", "their", "his", "her", "my", "your", "current", "related", "resulting",
              "selected", "corresponding", "same", "supported", "default", "authenticated", "logged-in", "this",
              "that", "of", "for", "with", "within", "in", "on", "to", "and", "or", "any", "some", "user's",
              "respective", "target", "chosen", "previous", "original", "main", "whole", "entire", "its own"}


def _singular(word):
    if word.endswith("ves") and len(word) > 4:
        return word[:-3] + "f"
    if word.endswith("ies") and len(word) > 4:
        return word[:-3] + "y"
    if word.endswith("s") and not word.endswith("ss") and len(word) > 3 and word not in ("details", "settings", "status"):
        return word[:-1]
    return word


def _page_key(phrase):
    """A page phrase -> list of alternative keys (frozensets of words); None when it is not a page.

    `the shelf details page` -> [{shelf, detail}]; `the homepage` -> [{home}];
    `a supported shelf, book, chapter, or page view` -> one key per entity;
    `a page where the navigation bar is visible` -> [] (any page); `a non-homepage page` -> ['non-home'].
    """
    text = phrase.strip().lower()
    text = re.sub(r"[.!]+$", "", text)
    if re.match(r"^(?:any|a|some) (?:page|screen)(?: (?:where|with|that|in which)\b.*)?$", text):
        return []
    if re.search(r"\bnon[- ]?home ?page\b|\bother than the home ?page\b|\bany other page\b", text):
        return ["non-home"]
    listed = re.fullmatch(r"(?:the |a |an )?list of [a-z ]+? (?:within|in|inside|of|for) (?:the |a |an )?(?P<c>[a-z ,]+)", text)
    if listed:
        return [frozenset({_singular(w), "detail"}) for w in re.split(r",\s*(?:or\s+)?|\s+or\s+", listed.group("c")) if w]
    text = re.sub(r"\bhome page\b", "homepage", text)
    extra = re.search(r"\s+for (?:the |a |an |its )?(?:current |selected |corresponding )?(?P<e>[a-z-]+)$", text)
    entity = set()
    if extra:
        entity.add(_singular(extra.group("e")))
        text = text[:extra.start()]
    if not re.search(r"(?:page|view|screen|dashboard|homepage|list|form|editor)$", text):
        return None
    alternatives = [part.strip() for part in re.split(r",\s*(?:or\s+|and\s+)?|\s+or\s+", text) if part.strip()]
    keys = []
    for index, alternative in enumerate(alternatives):
        words = alternative.split()
        if index == len(alternatives) - 1 and len(words) > 1 and words[-1] in ("page", "screen"):
            words = words[:-1]
        key = set(entity)
        for word in words:
            if word in _PAGE_STOP or not word:
                continue
            key.add(_TYPE_WORDS.get(word, _TYPE_WORDS.get(_singular(word), _singular(word))))
        keys.append(frozenset(key))
    if len(keys) > 1:  # "a shelf, book, or page view": the last word types every alternative
        types = {w for w in keys[-1] if w in _TYPE_WORDS.values()}
        keys = [frozenset(k | types) if not (k & set(_TYPE_WORDS.values())) else k for k in keys]
    return keys or None


_TYPES = set(_TYPE_WORDS.values())


def _key_match(want, have):
    """Does page key `have` satisfy the location `want`?"""
    if want == have:
        return True
    want_entities, have_entities = want - _TYPES, have - _TYPES
    if (not want_entities or not have_entities) and (want & _TYPES) == (have & _TYPES):
        return True
    return False


def _location_satisfied(keys, have):
    if keys == []:
        return True
    if keys == ["non-home"]:
        return have is not None and "home" not in have
    return have is not None and any(_key_match(key, have) for key in keys)


# ---------------------------------------------------------------------------------- THEN

_LOC_WORDS = r"(?:page|view|screen|dashboard|homepage|home page|list|form|editor)"
_LOC_VERB = re.compile(
    r"^(?:displays|shows|opens|reopens|returns to|navigates to|redirects to|goes to|goes back to|lands on|stays on|"
    r"remains on|is redirected to|is returned to|is taken to|takes the user to|brings the user to|navigates the user to|"
    r"returns the user to|redirects the user to|switches to|reloads|loads|renders|enters|keeps the user on)\s+"
    r"(?P<page>(?:the |a |an |its |their )?(?:[a-z-]+ ){0,5}?" + _LOC_WORDS +
    r"(?: for (?:the |a |its )?(?:current |selected )?[a-z-]+)?)"
    r"(?: without [a-z ]+)?(?:,? (?:with|where|displaying|showing|containing|listing|in which|which shows|that shows)"
    r"\s+(?P<rest>.+))?$")
_LOC_PASSIVE = re.compile(
    r"^(?P<page>(?:the |a |an )?(?:[a-z-]+ ){0,5}?" + _LOC_WORDS + r")(?: [a-z]+)? (?:is|are) "
    r"(?:displayed|shown|opened|visible|rendered|loaded|presented)(?: as (?:the |a |an )?[a-z -]+?)?"
    r"(?:,? (?:with|where|showing|containing)\s+(?P<rest>.+))?$")
_STRIP_VERB = re.compile(
    r"^(?:displays?|shows?|contains?|has|have|lists?|includes?|renders?|presents?|exposes?|provides?|sees?|"
    r"adds?|highlights?|reveals?|displaying|showing|containing|listing|including|now shows|still shows|"
    r"still displays|now displays)\s+")
_NEGATIVE_SUFFIX = re.compile(r"\s+(?:is|are)(?: now)? (?:absent|gone|removed|deleted|hidden|not (?:visible|displayed|"
                              r"shown|present|listed|rendered)|no longer (?:visible|displayed|shown|present|listed|"
                              r"rendered|there)|not in the list)(?:\s+.*)?$")
_NEGATIVE_PREFIX = re.compile(r"^(?:does not|doesn't|no longer|never) (?:display|show|contain|list|include|render|"
                              r"appear)s?\s+(?:any |the |a |an )?|^no\s+(?:longer\s+)?")
_POSITIVE_SUFFIX = re.compile(r"\s+(?:is|are)(?: still| now)? (?:visible|displayed|shown|present|listed|rendered|"
                              r"available|there)(?:\s+.*)?$|\s+appears?$")
_ATTR = re.compile(r"\s*,?\s*(?:with|and|has|having)\s+(?P<k>aria-[a-z-]+)\s*=\s*[\"']?(?P<v>true|false|mixed|[a-z0-9-]+)[\"']?")
_STATE = re.compile(r"\s+(?:is|are)(?: now)? (?P<neg>not |un)?(?P<s>checked|selected|pressed|expanded|collapsed|"
                    r"disabled|enabled)$")
_TEXT_NOUN = re.compile(r"^(?:the |an? )?(?:nickname|name|user ?name|display name|message|text|title|label|value|"
                        r"error(?: message)?|notification|toast|status(?: message)?|confirmation(?: message)?|caption|"
                        r"greeting|count|total|price|summary|hint|tooltip|placeholder text|content|description)"
                        r"\s*:?\s*(?=«)")


def _assertion(phrase, names, lists, clause):
    """An assertion phrase (no location) -> list of expect ops; [] for narrative without names."""
    text = phrase.strip()
    text = re.sub(r"^(?:and|then|also|where|with|that|which|while)\s+", "", text)
    text = re.sub(r"^(?:the )?(?:system|application|app|page|ui|site|user|screen)\s+(?:still\s+|now\s+|then\s+)?", "", text)
    if not _TOKEN.search(text) and not _LIST_TOKEN.search(text):
        return []  # narrative ("the system persists the shelf"): nothing named to check
    attrs = {}
    for match in _ATTR.finditer(text):
        attrs[match.group("k")] = match.group("v")
    text = _ATTR.sub("", text)
    # Several names at once: "visible headings or named regions exactly matching «0», «1», and «2»".
    match = re.fullmatch(r"(?:(?:displays?|shows?|contains?|has|includes?)\s+)?(?:the |all |both )?(?:visible )?"
                         r"(?P<roles>[a-z ]*?)\s*(?:exactly )?(?:matching|named|titled|called)?\s*‹(?P<l>\d+)›"
                         r"(?P<post>(?: [a-z]+)*)", text)
    if match:
        found = _roles_in(match.group("roles") + " " + match.group("post"), False)
        roles, kind = found if found else ([], "text")
        return [{"op": "expect", "target": {"name": names[i], "roles": roles, "kind": kind if roles else "text"},
                 "count": "any"} for i in lists[int(match.group("l"))]]
    if _LIST_TOKEN.search(text):
        raise Unparsed("then", clause, "a list of names in a shape this checker does not read")
    # Special shapes.
    special = [
        (r"^(?:changes?|updates?|switch(?:es)?|toggles?|renames?) (?:the |its |that )?(?:same )?(?:control|button|label|"
         r"toggle|text|link|state|name)(?: name)? to «(?P<n>\d+)»$", "control"),
        (r"^associates? (?:it|them|the [a-z ]+?) with «(?P<n>\d+)»$", "text"),
        (r"^(?:keeps|retains|preserves|leaves) (?:the |its )?(?:[a-z ]+? (?:named|called|titled) )?«(?P<n>\d+)» "
         r"(?:unchanged|intact|as is|in place)$", "text"),
        (r"^(?:the |its )?(?:[a-z ]+? (?:named|called|titled) )?«(?P<n>\d+)» (?:remains|stays|is still|is kept) "
         r"(?:unchanged|visible|displayed|shown|listed|present|the same|intact)$", "text"),
    ]
    for pattern, kind in special:
        match = re.fullmatch(pattern, text)
        if match:
            target = {"name": names[int(match.group("n"))], "roles": [], "kind": kind}
            op = {"op": "expect", "target": target, "count": "any"}
            if attrs:
                op["attrs"] = attrs
            return [op]
    count = "any"
    negative = _NEGATIVE_SUFFIX.search(text)
    if negative:
        text, count = text[:negative.start()], "none"
    else:
        prefixed = _NEGATIVE_PREFIX.match(text)
        if prefixed:
            text, count = text[prefixed.end():], "none"
        else:
            text = _POSITIVE_SUFFIX.sub("", text)
    states = {}
    match = _STATE.search(text)
    if match:
        state, negated = match.group("s"), bool(match.group("neg"))
        flip = {"collapsed": ("expanded", False), "enabled": ("disabled", False)}
        name, value = flip.get(state, (state, True))
        states[name] = (not value) if negated else value
        text = text[:match.start()]
    text = _STRIP_VERB.sub("", text)
    heading = re.search(r"\s+as (?:a |an |the )?(?:visible )?(?P<u>unique |single )?(?P<r>headings?|titles?|"
                        r"links? or buttons?|buttons? or links?|buttons?|links?)$", text)
    as_roles = None
    if heading:
        as_roles = _roles_in(heading.group("r"), False)
        if heading.group("u"):
            count = "one" if count == "any" else count
        text = text[:heading.start()]
    noun = _TEXT_NOUN.match(text)
    default_kind = "text" if noun else "text"
    if noun:
        text = text[noun.end():]
    found = _target(text, names, default_kind)
    if not found:
        raise Unparsed("then", clause, "the expectation does not name exactly one element in a known shape")
    target, unique, post = found
    if post and _TOKEN.search(post):
        raise Unparsed("then", clause, "a second name in the expectation is not consumed")
    if as_roles:
        target["roles"], target["kind"] = as_roles
    if unique and count == "any":
        count = "one"
    if target["kind"] == "field" and count != "none" and not states:
        target["kind"] = "field"
    op = {"op": "expect", "target": target, "count": count}
    if attrs:
        op["attrs"] = attrs
    if states:
        op["states"] = states
    return [op]


def _then(content):
    """THEN step -> {"clauses": [{location, ops, home}], "names"}; raises Unparsed."""
    masked, names = mask(content)
    masked, lists = _merge_lists(masked)
    parsed = []
    for clause in _clauses(masked):
        text = re.sub(r"^(?:and|then|also|still)\s+", "", clause)
        home = False
        match = re.fullmatch(r"(?P<core>.+?),?\s+on the (?:homepage|home page|dashboard)", text)
        if match and (_TOKEN.search(match.group("core")) or _LIST_TOKEN.search(match.group("core"))):
            text, home = match.group("core"), True
        body = re.sub(r"^(?:the )?(?:system|application|app|ui|site|user)\s+(?:then\s+|still\s+|now\s+)?", "", text)
        location, rest = None, body
        match = _LOC_VERB.match(body) or _LOC_PASSIVE.match(text)
        if match:
            location, rest = match.group("page"), match.group("rest")
            if _page_key(location) is None:
                location = None
        readable = _restore(clause, names, lists)
        ops = _assertion(rest, names, lists, readable) if rest else []
        parsed.append({"location": location, "ops": ops, "home": home, "text": readable})
    return parsed, names


# ------------------------------------------------------------------------------- planning

_KIND = re.compile(r"^(?P<kind>[A-Za-z][A-Za-z ]*?)\s+(?P<num>\d+(?:[.\-_]\d+)*)$")


def _kind(name):
    match = _KIND.match(name.strip())
    return match.group("kind").lower() if match else None


def _seeds(requirement):
    match = re.search(r"seed(?:ed)? data\s*:\s*(.*)$", requirement["description"], re.I | re.S)
    if not match:
        return []
    segment = match.group(1)
    names = _TICK.findall(segment)
    for pair in _DOUBLE.findall(segment):
        names.append(pair[0] or pair[1])
    return names


class _Unresolved(Exception):
    pass


class _Planner:
    def __init__(self, requirements):
        self.all = requirements
        self.by_id = {r["id"]: r for r in requirements}
        self.atomic = [r for r in requirements if r["type"] == "ATOMIC" and r["scenarios"]]
        self.parsed = {}  # (rid, index) -> parsed scenario
        for requirement in self.atomic:
            for index, scenario in enumerate(requirement["scenarios"]):
                self.parsed[(requirement["id"], index)] = self._parse(requirement, scenario)
        self.seed_names = {n for r in self.atomic for n in _seeds(r)}
        self.values = {op["value"] for p in self.parsed.values() for op in p["when"] if op.get("op") == "fill"}
        self.containers = self._containers()
        self.signatures = self._signatures()
        self.full_cache = {}

    # -- parsing
    def _parse(self, requirement, scenario):
        result = {"given": {"auth": None, "location": None}, "when": [], "then": [], "error": None,
                  "fragments": []}
        givens, whens, thens = [], [], []
        for step in scenario["steps"]:
            {"GIVEN": givens, "WHEN": whens, "THEN": thens}.get(step["keyword"], whens).append(step["content"])
        try:
            for content in givens:
                state = _given(content)
                for key in ("auth", "location"):
                    if state[key] is not None:
                        result["given"][key] = state[key]
            for content in whens:
                masked, names = mask(content)
                for clause in _clauses(masked):
                    for op in _when_clause(clause, names):
                        op["src"], op["phase"], op["text"] = requirement["id"], "when", _restore(clause, names)
                        result["when"].append(op)
            if not thens:
                raise Unparsed("then", "", "the scenario has no THEN step")
            for content in thens:
                clauses, _ = _then(content)
                result["then"].extend(clauses)
            if not any(clause["ops"] or clause["location"] for clause in result["then"]):
                raise Unparsed("then", " ".join(thens), "the outcome names nothing this checker can observe")
        except Unparsed as exc:
            result["error"] = exc
        return result

    def _containers(self):
        """Quoted names the requirements use for regions, lists, sections, forms and dialogs."""
        found = {}
        for parsed in self.parsed.values():
            for clause in parsed["then"]:
                for op in clause["ops"]:
                    target = op["target"]
                    scope = target.get("scope")
                    if scope and scope.get("type") == "named":
                        found[scope["name"].lower()] = scope["name"]
                    if set(target["roles"]) & {"region", "list", "form", "dialog"}:
                        found[target["name"].lower()] = target["name"]
        return found

    def _constant(self, name):
        return not re.search(r"\d", name) and name not in self.seed_names and name not in self.values

    def _signatures(self):
        """Page key -> headings the requirements say that page shows (constant names only)."""
        signatures = {}
        for requirement in self.atomic:
            parsed = self.parsed[(requirement["id"], 0)]
            if parsed["error"]:
                continue
            for clause in parsed["then"]:
                if not clause["location"]:
                    continue
                keys = _page_key(clause["location"]) or []
                if len(keys) != 1 or keys[0] == "non-home":
                    continue
                for op in clause["ops"]:
                    target = op["target"]
                    if target["roles"] == ["heading"] and op["count"] != "none" and self._constant(target["name"]) \
                            and not target.get("scope"):
                        signatures.setdefault(keys[0], {"from": requirement["id"], "names": []})
                        if target["name"] not in signatures[keys[0]]["names"]:
                            signatures[keys[0]]["names"].append(target["name"])
        return signatures

    # -- chains
    def page_of(self, rid):
        """The page a requirement's own THEN says it ends on (key), or None."""
        parsed = self.parsed.get((rid, 0))
        if not parsed or parsed["error"]:
            return None
        page = None
        for clause in parsed["then"]:
            if clause["location"]:
                keys = _page_key(clause["location"]) or []
                if len(keys) == 1 and keys[0] != "non-home":
                    page = keys[0]
        return page

    def end_page(self, segments):
        for segment in reversed(segments):
            if segment.get("page") is not None:
                return segment["page"]
            if segment["phase"] == "when":
                page = self.page_of(segment["src"])
                if page is not None:
                    return page
        return frozenset({"home"})

    def atomic_deps(self, requirement):
        return [d for d in requirement["dependencies"] if d in self.by_id and self.by_id[d]["type"] == "ATOMIC"
                and self.by_id[d]["scenarios"]]

    def full(self, rid, stack=()):
        """Segments that perform requirement `rid` (its setup, then its own WHEN)."""
        if rid in self.full_cache:
            result = self.full_cache[rid]
            if isinstance(result, _Unresolved):
                raise result
            return result
        try:
            parsed = self.parsed[(rid, 0)]
            if parsed["error"] and parsed["error"].phase in ("given", "when"):
                raise _Unresolved(f"prerequisite {rid} is not parsed ({parsed['error']})")
            segments = self.setup(rid, parsed, stack + (rid,)) + [
                {"src": rid, "phase": "when", "ops": parsed["when"]}]
            self.full_cache[rid] = segments
            return segments
        except _Unresolved as exc:
            self.full_cache[rid] = exc
            raise

    def _choose_deps(self, requirement):
        deps = self.atomic_deps(requirement)
        kinds = {_kind(s) for s in _seeds(requirement)} - {None}
        if len(deps) < 2 or not kinds:
            return deps
        scored = []
        for order, dep in enumerate(deps):
            try:
                segments = self.full(dep)
            except _Unresolved:
                scored.append((2, 0, order, dep))
                continue
            clicks = [op for s in segments for op in s["ops"] if op["op"] in ("click", "hover")]
            substitutable = any(_kind(op["target"]["name"]) in kinds for op in clicks)
            scored.append((0 if substitutable else 1, sum(len(s["ops"]) for s in segments), order, dep))
        return [dep for *_, dep in sorted(scored)]

    def setup(self, rid, parsed, stack=()):
        requirement = self.by_id[rid]
        deps = [d for d in self._choose_deps(requirement) if d not in stack]
        base, errors = None, []
        for dep in deps or [None]:
            try:
                base = list(self.full(dep, stack)) if dep else []
                break
            except _Unresolved as exc:
                errors.append(exc)
        if base is None:
            raise errors[0]
        given = parsed["given"]
        if given["auth"] is True and not any(self._logs_in(s["src"]) for s in base if s["phase"] == "when"):
            login = self._login(rid)
            if login is None:
                raise _Unresolved("GIVEN needs a logged-in user, but no parsed requirement logs in")
            first = list(self.full(login, stack))
            done = {(s["src"], s["phase"]) for s in first}
            base = first + [s for s in base if (s["src"], s["phase"]) not in done]
        if given["auth"] is False and any(self._logs_in(s["src"]) for s in base if s["phase"] == "when"):
            raise _Unresolved("GIVEN says the user is not logged in, but the dependency chain logs in")
        if given["location"]:
            keys = _page_key(given["location"])
            end = self.end_page(base)
            if keys == ["non-home"]:
                if end is None or "home" in end:
                    base.append(self._leave_home(rid, base))
            elif not _location_satisfied(keys, end):
                base.append(self._sibling_prefix(requirement, given["location"], keys, end))
        return base

    def _logs_in(self, rid):
        parsed = self.parsed.get((rid, 0))
        if not parsed or parsed["error"]:
            return False
        return any(re.search(r"\b(?:logs?|signs?) (?:the user |them |him |her )?(?:in|on)\b|\blogged in\b|\bsigned in\b",
                             clause["text"].lower()) and not re.search(r"\bnot (?:logged|signed) in\b", clause["text"].lower())
                   for clause in parsed["then"]) and any(op["op"] == "fill" for op in parsed["when"])

    def _login(self, rid):
        for requirement in self.atomic:
            if requirement["id"] != rid and self._logs_in(requirement["id"]):
                try:
                    self.full(requirement["id"])
                    return requirement["id"]
                except _Unresolved:
                    continue
        return None

    def _leave_home(self, rid, base):
        """GIVEN `a non-homepage page`: the first single navigation activation that leaves the homepage
        (a content page before a login or registration page, which often hides the global navigation)."""
        found = []
        for requirement in self.atomic:
            if requirement["id"] == rid:
                continue
            parsed = self.parsed[(requirement["id"], 0)]
            ops = parsed["when"]
            if parsed["error"] or len(ops) != 1 or ops[0]["op"] != "click":
                continue
            if (ops[0]["target"].get("scope") or {}).get("type") != "landmark":
                continue
            page = self.page_of(requirement["id"])
            if page is None or "home" in page:
                continue
            found.append((bool(page & {"login", "register"}), len(found), requirement["id"], ops, page))
        if not found:
            raise _Unresolved("GIVEN needs a page other than the homepage, but no navigation requirement leaves it")
        _, _, source, ops, page = min(found, key=lambda f: f[:2])
        return {"src": source, "phase": "given", "ops": ops, "page": page}

    def _sibling_prefix(self, requirement, location, keys, end):
        """GIVEN on a page the chain does not reach: the opening activations of a sibling that goes there.

        `The user is on the shelf creation page` + sibling `activates New Shelf, fills Name, ...` with the
        same dependencies -> activate `New Shelf`. The page's type word must occur in the sibling's or the
        parent folder's name, so an unrelated sibling is never borrowed."""
        parent = self.by_id.get(requirement["parent"]) or {"name": ""}
        wanted_types = set().union(*[set(k) & _TYPES for k in keys]) if keys else set()
        candidates = []
        for sibling in self.atomic:
            if sibling["id"] == requirement["id"] or sibling["parent"] != requirement["parent"]:
                continue
            if set(sibling["dependencies"]) != set(requirement["dependencies"]):
                continue
            parsed = self.parsed[(sibling["id"], 0)]
            ops = parsed["when"]
            if parsed["error"] and parsed["error"].phase in ("given", "when"):
                continue
            first_input = next((i for i, op in enumerate(ops) if op["op"] in ("fill", "check", "select")), None)
            if first_input is not None:
                prefix = ops[:first_input]
            elif len(ops) >= 2 and all(op["op"] == "click" for op in ops):
                prefix = ops[:-1]
            else:
                prefix = []
            if not prefix or len(prefix) == len(ops) or any(op["op"] != "click" for op in prefix):
                continue
            words = set()
            for word in re.findall(r"[a-z-]+", (sibling["name"] + " " + parent["name"]).lower()):
                words.add(_TYPE_WORDS.get(word, _TYPE_WORDS.get(_singular(word), _singular(word))))
            if wanted_types and not (wanted_types & words):
                continue
            overlap = max(len(set(k) & words) for k in keys) if keys else 0
            candidates.append((-overlap, sibling["id"], prefix))
        if not candidates:
            ends = "+".join(sorted(end)) if end else "an unknown page"
            raise _Unresolved(f"GIVEN location '{location}' is not reached by the dependency chain (it ends on {ends})")
        candidates.sort(key=lambda c: c[:2])
        _, source, prefix = candidates[0]
        return {"src": source, "phase": "given", "ops": prefix, "page": keys[0] if keys else None}

    def go_home(self, rid):
        """Ops that return to the homepage: a single activation whose THEN lands on it, else the app URL."""
        for requirement in self.atomic:
            if requirement["id"] == rid:
                continue
            parsed = self.parsed[(requirement["id"], 0)]
            ops = parsed["when"]
            if parsed["error"] or len(ops) != 1 or ops[0]["op"] != "click":
                continue
            page = self.page_of(requirement["id"])
            if page is not None and "home" in page and len(page) == 1:
                return [dict(ops[0], src=requirement["id"], phase="then")]
        return [{"op": "goto", "path": "/", "src": rid, "phase": "then", "text": "open the application URL"}]

    # -- one scenario
    def scenario(self, requirement, index):
        parsed = self.parsed[(requirement["id"], index)]
        base = {"requirement": requirement["id"], "name": requirement["scenarios"][index]["name"]}
        if parsed["error"]:
            error = parsed["error"]
            return dict(base, status="unparsed", reason=str(error),
                        fragment={"phase": error.phase, "text": error.text, "reason": error.reason})
        try:
            segments = self.setup(requirement["id"], parsed, (requirement["id"],))
        except _Unresolved as exc:
            return dict(base, status="unparsed", reason=str(exc), fragment={"phase": "given", "text": str(exc),
                                                                         "reason": "setup"})
        ops = [{"op": "goto", "path": "/", "src": requirement["id"], "phase": "given", "text": "open the application URL"}]
        for segment in segments:
            for op in segment["ops"]:
                if ops and op["op"] == "goto" and ops[-1]["op"] == "goto":
                    continue
                ops.append(dict(op, phase="given" if segment["src"] != requirement["id"] else op["phase"],
                                src=segment["src"]))
        substitutions = self._substitute(requirement, ops)
        ops.extend(dict(op) for op in parsed["when"])
        then_ops = []
        asserted = {op["target"]["name"] for clause in parsed["then"] for op in clause["ops"]}
        for clause in parsed["then"]:
            clause_ops = [dict(op, src=requirement["id"], phase="then", text=clause["text"]) for op in clause["ops"]]
            if clause["home"]:
                then_ops.extend(self.go_home(requirement["id"]))
            if clause["location"] and not clause["ops"]:
                for key in _page_key(clause["location"]) or []:
                    signature = self.signatures.get(key) if key != "non-home" else None
                    if signature and signature["from"] != requirement["id"]:
                        for name in (n for n in signature["names"] if n not in asserted):
                            then_ops.append({"op": "expect", "count": "any", "src": requirement["id"], "phase": "then",
                                             "target": {"name": name, "roles": ["heading"], "kind": "structure"},
                                             "text": f"{clause['text']} (the page {signature['from']} shows with heading `{name}`)"})
            then_ops.extend(clause_ops)
        if not any(op["op"] == "expect" for op in then_ops):
            return dict(base, status="unparsed", reason="THEN: nothing named to observe after resolving locations",
                        fragment={"phase": "then", "text": " ".join(c["text"] for c in parsed["then"]),
                                  "reason": "no checkable assertion"})
        ops.extend(then_ops)
        self._resolve_scopes(ops)
        for op in ops:
            if op["op"] in ("click", "hover") and self._entity(op["target"]["name"]):
                op["entity"] = True
        chain = []
        for op in ops:
            if op["src"] != requirement["id"] and op["src"] not in chain and op["phase"] == "given":
                chain.append(op["src"])
        result = dict(base, status="parsed", ops=ops, chain=chain)
        if substitutions:
            result["substitutions"] = substitutions
        return result

    def _substitute(self, requirement, ops):
        """Prerequisite activations of a sibling entity (`Shelf 4.2.1`) use this requirement's seed of that kind."""
        seeds = {}
        for name in _seeds(requirement):
            kind = _kind(name)
            if kind:
                seeds.setdefault(kind, []).append(name)
        own = {op["target"]["name"] for parsed in [self.parsed[(requirement["id"], 0)]] for op in parsed["when"]
               if "target" in op}
        done = {}
        for op in ops:
            if op["op"] not in ("click", "hover", "check") or op["src"] == requirement["id"]:
                continue
            name = op["target"]["name"]
            kind = _kind(name)
            if not kind or len(seeds.get(kind, [])) != 1 or name in own or name in seeds[kind]:
                continue
            op["target"] = dict(op["target"], name=seeds[kind][0])
            op["text"] = f"{op.get('text', '')} [with `{seeds[kind][0]}` for `{name}`]"
            done[name] = seeds[kind][0]
        return done

    def _resolve_scopes(self, ops):
        for op in ops:
            target = op.get("target")
            scope = target.get("scope") if target else None
            if not scope or scope.get("type") != "phrase":
                continue
            phrase = re.sub(r"\s+(?:region|section|list|area|panel)$", "", scope["text"])
            name = self.containers.get(scope["text"]) or self.containers.get(phrase)
            if name:
                target["scope"] = {"type": "named", "name": name, "roles": [], "strict": False}
            else:
                target.pop("scope")

    def _entity(self, name):
        if name in self.seed_names and _kind(name):
            return True
        for requirement in self.atomic:
            parsed = self.parsed[(requirement["id"], 0)]
            if parsed["error"]:
                continue
            clicked = any(op["op"] == "click" and op["target"]["name"] == name for op in parsed["when"])
            shown = any(op["target"]["name"] == name and "heading" in op["target"]["roles"]
                        for clause in parsed["then"] for op in clause["ops"])
            if clicked and shown:
                return True
        return False


def plan(requirements_text):
    """Plan every ATOMIC scenario: {"scenarios": [...], "coverage": {"total", "parsed"}, "entities": [...]}"""
    planner = _Planner(load_requirements(requirements_text))
    scenarios = []
    for requirement in planner.atomic:
        count = len(requirement["scenarios"])
        for index in range(count):
            item = planner.scenario(requirement, index)
            item["id"] = requirement["id"] + (f"#{index + 1}" if index else "")
            scenarios.append(item)
    parsed = sum(1 for s in scenarios if s["status"] == "parsed")
    entities = sorted({op["target"]["name"] for s in scenarios if s["status"] == "parsed"
                       for op in s["ops"] if op.get("entity")})
    return {"scenarios": scenarios, "coverage": {"total": len(scenarios), "parsed": parsed}, "entities": entities}


def shape(text):
    """A fragment's sentence shape: quoted names become «», so frequent unparsed shapes group together."""
    masked, _ = mask(text)
    return _TOKEN.sub("«»", masked)


if __name__ == "__main__":  # debugging aid: print the plan of a requirements file
    import json
    import sys

    with open(sys.argv[1], encoding="utf-8") as handle:
        print(json.dumps(plan(handle.read()), indent=1, ensure_ascii=False, default=str))
