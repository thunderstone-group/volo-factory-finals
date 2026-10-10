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
_TOKEN = REDACTED"«(\d+)»")
_LIST_TOKEN = REDACTED"‹(\d+)›")


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
    """Split a sentence into clauses at `,` `;` `and` `then`, keeping short enumerations (`a folder, file, or page view`)."""
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
    (r"list ?box(?:es)?", ["listbox"], "structure"),
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
    (r"regions?", ["region"], "structure"),
    (r"sections?", ["region", "heading"], "structure"),
    (r"forms?", ["form"], "structure"),
    (r"dialogs?|modals?|pop-?ups?", ["dialog", "alertdialog"], "structure"),
    (r"lists?", ["list"], "structure"),
    (r"rows?", ["row"], "entry"),
    (r"tables?|grids?", ["table", "grid"], "structure"),
    (r"images?|icons?|logos?|pictures?", ["img"], "structure"),
    (r"navigation(?: bar)?|nav(?: ?bar)?", ["navigation"], "structure"),
    (r"side ?bars?|side panels?", ["complementary"], "structure"),
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
_SCOPE_SPLIT = re.compile(r"^(?P<core>.*?«\d+».*?)\s+(?:in|inside|within|on|from|under|at|of|for|to)\s+"
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
    found = _roles_in(text, True)
    roles = [r for r in (found[0] if found and found[1] == "structure" else []) if r not in ("heading", "img")]
    return {"type": "phrase", "text": re.sub(r"^(?:the|a|an|this|its|their)\s+", "", text), "roles": roles}


_PRE_DENY = re.compile(r"\b(?:after|before|first|second|third|fourth|last|twice|thrice|then|once|until|not|no|never|"
                       r"without|except|another|other|every|each|all|both|least|most|more|less|than|order|sorted|"
                       r"above|below|between|next|previous|times)\b")
_POST_NOUNS = {"a", "an", "the", "note", "notes", "card", "cards", "entry", "entries", "item", "items", "text", "message",
               "label", "labels", "title", "value", "element", "elements", "control", "controls", "icon", "icons",
               "chip", "chips", "tag", "tags", "badge", "toggle", "row", "tile", "record", "result", "visible",
               "unique", "named", "option", "field", "fields", "box"}


_THEN_PRE_DENY = re.compile(r"\b(?:to|into|by|via|using|from|in|inside|within|on|changes?|becomes?|turns?|moves?|sets?|"
                            r"is|are|was|were|be|been|has|have|had|appears?|computed|background|style|font|size|"
                            r"position|order|count|number|attribute|property|width|height|colou?rs?)\b")


def _leftover(pre, post, then=False):
    """Words of a target phrase that change its meaning and that no shape reads (so it must not be guessed)."""
    if _PRE_DENY.search(pre) or _PRE_DENY.search(post):
        return (_PRE_DENY.search(pre) or _PRE_DENY.search(post)).group(0)
    if then and _THEN_PRE_DENY.search(pre):
        return _THEN_PRE_DENY.search(pre).group(0)
    rest = _ROLE_RE.sub(" ", post)
    words = [w for w in re.findall(r"[a-z][a-z'-]*", rest) if w not in _POST_NOUNS]
    return " ".join(words)


def _target(phrase, names, default_kind, allow_scope=True, then=False):
    """`the unique link or button named «0» in the item list` -> target dict and unique flag."""
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
    if _leftover(pre, post, then):
        return None
    unique = bool(_UNIQUE.search(pre))
    placeholder = bool(_PLACEHOLDER.search(pre))
    found = _roles_in(_NAMING.sub(" ", pre), True) or _roles_in(post, True)
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


_CONTAINERS = {"article", "group", "row", "listitem", "region", "dialog", "alertdialog", "form", "list", "complementary",
               "navigation", "menu", "listbox", "table", "grid", "tabpanel", "treeitem", "cell"}
_FOCUS = re.compile(r"^(?:focus(?:es)?(?: on)?|puts? (?:the )?focus (?:on|in)|moves? focus to)\s+(?P<obj>.+)$")
_REPEAT = re.compile(r"\s+(?P<n>twice|two times|three times|thrice)$")
_IN_PREFIX = re.compile(r"^(?:in|inside|within|on) (?:the |its )?«(?P<n>\d+)»(?: (?P<noun>[a-z ]+))?$")


def _apply_context(target, pre, context, clause):
    """`its «Delete» button` after `hover the article for «X»`: scope to the last named container of the step.
    `In the «X» article, activate ...`: the step's prefix scope, searched first (soft)."""
    if target.get("scope"):
        return target
    if re.search(r"\b(?:its|their)\b", pre):
        entity = context.get("entity")
        if not entity:
            raise Unparsed("when", clause, "`its` has no named container earlier in the step")
        target["scope"] = {"type": "named", "name": entity["name"], "roles": entity["roles"], "strict": False}
    elif context.get("prefix"):
        target["scope"] = dict(context["prefix"])
    return target


def _remember(target, context):
    if set(target.get("roles") or []) & _CONTAINERS:
        context["entity"] = {"name": target["name"], "roles": target["roles"]}


def _when_clause(clause, names, context=None):
    """One WHEN clause -> list of ops. Raises Unparsed. `context` carries pronoun and prefix scopes of a step."""
    context = {} if context is None else context
    text = re.sub(r"^(?:then|and|also|finally|next|first|afterwards)\s+", "", clause)
    text = _ACTOR.sub("", text)
    match = _IN_PREFIX.match(text)
    if match:
        found = _roles_in(match.group("noun") or "", True)
        roles = found[0] if found else []
        context["prefix"] = {"type": "named", "name": names[int(match.group("n"))], "roles": roles, "strict": False}
        context["entity"] = {"name": names[int(match.group("n"))], "roles": roles}
        return []
    repeat = 1
    match = _REPEAT.search(text)
    if match:
        repeat = {"twice": 2, "two times": 2, "three times": 3, "thrice": 3}[match.group("n")]
        text = text[:match.start()]
    ops = _when_core(text, clause, names, context)
    if repeat > 1:
        if len(ops) != 1 or ops[0]["op"] not in ("click", "press"):
            raise Unparsed("when", clause, "only a single activation can be repeated")
        ops = [dict(ops[0]) for _ in range(repeat)]
    return ops


def _when_core(text, clause, names, context):
    if _SYSTEM.match(text) and not _TOKEN.search(text):
        return [{"op": "wait", "ms": 400}]
    if _GOTO.match(text):
        return [{"op": "goto", "path": "/"}]
    if _LOOK.match(text) and not _TOKEN.search(text):
        return [{"op": "wait", "ms": 100}]
    match = _PRESS.match(text)
    if match and not match.group("obj"):
        return [{"op": "press", "key": _KEYS[match.group("key")]}]
    match = _FOCUS.match(text)
    if match:
        found = _target(match.group("obj"), names, "field")
        if not found:
            raise Unparsed("when", clause, "the focus phrase does not name exactly one element")
        target, unique, _ = found
        if not target["roles"]:
            target["kind"], target["roles"] = "field", list(_FIELD)
        return [{"op": "focus", "target": _apply_context(target, match.group("obj").split("«")[0], context, clause),
                 "unique": unique}]
    match = _FILL_INTO.match(text) or _FILL_WITH.match(text)
    if match:
        found = _target(match.group("field"), names, "field")
        if not found:
            raise Unparsed("when", clause, "the field phrase does not name exactly one field")
        target, unique, _ = found
        _apply_context(target, match.group("field").split("«")[0], context, clause)
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
            _apply_context(target, obj.split("«")[0], context, clause)
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
        _apply_context(target, match.group("obj").split("«")[0], context, clause)
        _remember(target, context)
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
        _apply_context(target, obj.split("«")[0], context, clause)
        _remember(target, context)
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
    re.compile(r"^(?:the )?user has (?:already )?(?:opened|loaded|launched|accessed|visited) the (?:application|app|system|site|"
               r"website|web application|home ?page)$"),
    re.compile(r"^(?:the )?(?:system|application|app|database|data) (?:has been|is) (?:initiali[sz]ed|started|seeded|reset|"
               r"set up|prepared|loaded)$"),
    re.compile(r"^(?:the )?(?:user )?(?:can|could) (?:see|view) (?:the |a |an |at least one |some |its |their )?[a-z -]+$"),
    re.compile(r"^(?:the )?(?:sidebar|side bar|side panel|navigation(?: bar)?|menu|header|toolbar) (?:is|are) "
               r"(?:visible|expanded|displayed|shown|open|available)$"),
]
_OPEN_GIVEN = re.compile(r"^(?:(?:the )?user has (?:just |already )?opened (?:the |a )?«(?P<a>\d+)»|(?:the |a )?«(?P<b>\d+)») ?"
                         r"(?P<noun>editor|dialog|form|menu|panel|popover|modal|drawer|window|sheet|list|view|tab|picker)?"
                         r"(?: (?:is|are) (?:open|opened|visible|displayed|shown|active|expanded))?$")
_EFFECT_STOP = {"the", "a", "an", "user", "has", "have", "had", "just", "already", "is", "are", "was", "were", "been", "be",
                "on", "in", "of", "to", "from", "after", "with", "and", "or", "visible", "shown", "displayed", "page",
                "home", "homepage", "that", "this", "it", "its", "their", "some", "one", "at", "least", "now", "still"}
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
    masked, names = mask(content)
    try:
        return _given_masked(masked, names)
    except Unparsed as exc:
        raise Unparsed(exc.phase, _restore(exc.text, names), exc.reason) from None


def _given_masked(masked, names):
    """GIVEN step -> {auth, location, open, effects}. Raises Unparsed.

    `open`: a quoted control whose activation opens the stated editor or dialog (`the "New item" editor is
    open`). `effects`: state clauses that describe the result of the dependency's action (`the note is
    pinned`); the planner accepts them only when they share a distinctive word with that dependency's name."""
    state = {"auth": None, "location": None, "open": None, "effects": []}
    for clause in _clauses(masked):
        text = re.sub(r"^(?:and|also|then)\s+", "", clause)
        match = _OPEN_GIVEN.match(text)
        if match and (match.group("a") or (match.group("b") and match.group("noun"))):
            state["open"] = names[int(match.group("a") or match.group("b"))]
            continue
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
        if not _TOKEN.search(text) and re.search(r"\b(?:is|are|has|have|was|were)\b|\b[a-z]+ed\b", text):
            state["effects"].append(text)
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

    `the folder details page` -> [{folder, detail}]; `the homepage` -> [{home}];
    `a supported folder, file, chapter, or page view` -> one key per entity;
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
    if len(keys) > 1:  # "a folder, file, or page view": the last word types every alternative
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
                              r"rendered|there)|not in the list)(?P<rest>\s+.*)?$")
_NEGATIVE_PREFIX = re.compile(r"^(?:does not|doesn't|no longer|never) (?:display|show|contain|list|include|render|"
                              r"appear)s?\s+(?:any |the |a |an )?|^no\s+(?:longer\s+)?")
_POSITIVE_SUFFIX = re.compile(r"\s+(?:is|are)(?: still| now)? (?:visible|displayed|shown|present|listed|rendered|"
                              r"available|there)(?P<rest>\s+.*)?$|\s+appears?$")
_SCOPE_REST = re.compile(r"^\s*(?:again|on (?:the )?screen|on the page|to the user)?\s*$|"
                         r"^\s*(?P<prep>from|in|inside|within|on|under|at) (?P<phrase>.+)$")
_ATTR = re.compile(r"\s*,?\s*(?:with|and|has|having)\s+(?P<k>aria-[a-z-]+)\s*=\s*[\"']?(?P<v>true|false|mixed|[a-z0-9-]+)[\"']?")
_STATE = re.compile(r"\s+(?:is|are)(?: now)? (?P<neg>not |un)?(?P<s>checked|selected|pressed|expanded|collapsed|"
                    r"disabled|enabled)$")
_TEXT_NOUN = re.compile(r"^(?:the |an? )?(?:nickname|name|user ?name|display name|message|text|title|label|value|"
                        r"error(?: message)?|notification|toast|status(?: message)?|confirmation(?: message)?|caption|"
                        r"greeting|count|total|price|summary|hint|tooltip|placeholder text|content|description)"
                        r"\s*:?\s*(?=«)")


_TEMPORAL = re.compile(r"\s*,?\s*(?:right |just |immediately )?after (?:the )?(?P<n>first|second|third|fourth|fifth|last|"
                       r"\d+(?:st|nd|rd|th)?) (?:activation|click|action|press|toggle|step|time|one)s?$")
_ORDINALS = {"first": 1, "second": 2, "third": 3, "fourth": 4, "fifth": 5, "last": -1}
_CLOSES = re.compile(r"\s+(?:closes|is closed|disappears|is dismissed|is hidden|goes away|vanishes|"
                     r"is no longer (?:open|visible|shown|displayed))$")
_MOVE_IN = re.compile(r"\s+(?:appears?|reappears?|returns?|comes back|goes back|moves|is moved|is returned|"
                      r"(?:is|are)(?: still| now)? (?:shown|listed|displayed|present|visible|kept|stored|restored|placed|"
                      r"available))(?: back)?\s+(?:to|in|into|inside|within|on)\s+")
_RESTORED = re.compile(r"\s+(?:is|are) (?:restored|back|returned)$|\s+(?:reappears?|returns?|comes back)$")
_SUBJECT = re.compile(r"^(?P<subject>(?:the |a |an )?(?:visible )?(?:[a-z-]+ ){0,4}?[a-z-]+) (?:still |now |then )?"
                      r"(?:contains|includes|shows|displays|lists|has|holds|presents|exposes|renders)(?P<rest> .*)$")
_IN_NAMED = re.compile(r"^(?:the |a |an )?«(?P<c>\d+)»(?: (?P<role>[a-z ]+?))? (?:still |now )?(?:displays|shows|contains|"
                       r"includes|lists|has|reads)(?: the)?(?: (?:text|value|content|label|title|message))?"
                       r"(?: exactly)? «(?P<n>\d+)»$")
_STATUS = re.compile(r"^(?:a |the |an )?(?:visible )?(?:status|notification|toast|snackbar|alert|confirmation|error|"
                     r"success|info)(?: message| text| notice)?(?: that)?(?: (?:displays|shows|reads|says|contains|"
                     r"with|of|is))?(?: the text)?(?: exactly)?\s*(?=«)")
_STYLE = re.compile(r"\s+(?:is saved with|is shown with|has|with|gets|shows|displays|uses|changes to)(?: a| the| its)?"
                    r" (?:computed )?(?P<prop>background(?:-| )colou?r)(?: of)? «(?P<v>\d+)»$")


def _assertion(phrase, names, lists, clause, scope=None):
    """An assertion phrase (no location) -> list of expect ops; [] for narrative without names.
    Every word must be read by a shape; a qualifier no shape reads makes the clause unparsed."""
    text = phrase.strip()
    text = re.sub(r"^(?:and|then|also|where|with|that|which|while)\s+", "", text)
    text = re.sub(r"^(?:the )?(?:system|application|app|page|ui|site|user|screen)\s+(?:still\s+|now\s+|then\s+)?", "", text)
    if not _TOKEN.search(text) and not _LIST_TOKEN.search(text):
        return []  # narrative ("the system persists the folder"): nothing named to check
    after = None
    match = _TEMPORAL.search(text)
    if match:
        word = match.group("n")
        after = _ORDINALS.get(word) or int(re.match(r"\d+", word).group(0))
        text = text[:match.start()]
    attrs = {}
    for match in _ATTR.finditer(text):
        attrs[match.group("k")] = match.group("v")
    text = _ATTR.sub("", text)
    style = {}
    match = _STYLE.search(text)
    if match:
        style["background-color"] = names[int(match.group("v"))]
        text = text[:match.start()]

    def finish(ops):
        for op in ops:
            if after is not None:
                op["after"] = after
            if scope and not op["target"].get("scope"):
                op["target"]["scope"] = dict(scope)
        return ops

    # "shows «A» with a unique «B» button": two assertions.
    halves = re.split(r",?\s+with\s+", text, maxsplit=1)
    if len(halves) == 2 and all(_TOKEN.search(h) or _LIST_TOKEN.search(h) for h in halves):
        return finish(_assertion(halves[0], names, lists, clause) + _assertion(halves[1], names, lists, clause))
    if len(halves) == 2 and (_TOKEN.search(halves[1]) or _LIST_TOKEN.search(halves[1])):
        # "shows the expanded sidebar with unique buttons named A, B": B is looked for inside the sidebar.
        inner = _scope(re.sub(r"^(?:shows?|displays?|contains?|has|includes?|renders?)\s+", "", halves[0]), names)
        ops = _assertion(halves[1], names, lists, clause)
        for op in ops:
            if op["count"] == "none" and inner and inner.get("type") == "phrase":
                raise Unparsed("then", clause, "an absence inside a container the requirement does not name")
            if inner and inner.get("type") != "named" and not op["target"].get("scope"):
                op["target"]["scope"] = dict(inner)
        return finish(ops)
    # A subject that is a container: "the notes list contains «X»", "the sidebar includes a unique button named «X»".
    match = _SUBJECT.match(text)
    if match and not (_TOKEN.search(match.group("subject")) or _LIST_TOKEN.search(match.group("subject"))):
        subject = match.group("subject")
        if not re.fullmatch(r"(?:the |a |an )?(?:system|application|app|page|ui|site|user|screen)", subject):
            inner = _scope(subject, names)
            ops = _assertion(match.group("rest"), names, lists, clause)
            for op in ops:
                if op["count"] == "none" and inner and inner.get("type") == "phrase":
                    raise Unparsed("then", clause, "an absence inside a container the requirement does not name")
                if inner and inner.get("type") != "named" and not op["target"].get("scope"):
                    op["target"]["scope"] = dict(inner)
            return finish(ops)
    # "the «X» article displays «Y»": Y inside the named container X.
    match = _IN_NAMED.match(text)
    if match:
        found = _roles_in(match.group("role") or "", True)
        container = {"type": "named", "name": names[int(match.group("c"))], "roles": found[0] if found else [],
                     "strict": True}
        return finish([{"op": "expect", "count": "any",
                        "target": {"name": names[int(match.group("n"))], "roles": [], "kind": "text", "scope": container}}])
    # Several names at once: "visible headings or named regions exactly matching «0», «1», and «2»".
    match = re.fullmatch(r"(?:(?:displays?|shows?|contains?|has|includes?|lists?)\s+)?(?:the |all |both |only )?"
                         r"(?:visible )?(?P<roles>[a-z ]*?)\s*(?:exactly )?(?:matching|named|titled|called)?\s*"
                         r"‹(?P<l>\d+)›(?P<post>(?: [a-z]+)*)", text)
    if match:
        if _leftover(match.group("roles"), match.group("post")):
            raise Unparsed("then", clause, "a qualifier on a list of names that no shape reads")
        found = _roles_in(match.group("roles") + " " + match.group("post"), True)
        roles, kind = found if found else ([], "text")
        count = "one" if _UNIQUE.search(match.group("roles")) else "any"
        return finish([{"op": "expect", "target": {"name": names[i], "roles": roles, "kind": kind if roles else "text"},
                        "count": count} for i in lists[int(match.group("l"))]])
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
            return finish([op])
    count = "any"
    match = _CLOSES.search(text)
    if match:
        text, count = text[:match.start()], "none"
    text = _MOVE_IN.sub(" in ", text)
    text = _RESTORED.sub("", text)
    remainder = None
    negative = _NEGATIVE_SUFFIX.search(text)
    if negative:
        text, count, remainder = text[:negative.start()], "none", negative.group("rest")
    else:
        prefixed = _NEGATIVE_PREFIX.match(text)
        if prefixed:
            text, count = text[prefixed.end():], "none"
        else:
            positive = _POSITIVE_SUFFIX.search(text)
            if positive:
                text, remainder = text[:positive.start()], positive.groupdict().get("rest")
    if remainder and remainder.strip():
        # "is absent from the target note article": the trailing words are a scope, or the clause is not read.
        match = _SCOPE_REST.match(remainder)
        if not match:
            raise Unparsed("then", clause, f"a qualifier no shape reads: '{remainder.strip()}'")
        if match.group("phrase"):
            if _TOKEN.search(match.group("phrase")) or count != "none":
                text = f"{text} in {match.group('phrase')}"
            else:
                raise Unparsed("then", clause, "an absence inside a container the requirement does not name")
    states = {}
    match = _STATE.search(text)
    if match:
        state, negated = match.group("s"), bool(match.group("neg"))
        flip = {"collapsed": ("expanded", False), "enabled": ("disabled", False)}
        name, value = flip.get(state, (state, True))
        states[name] = (not value) if negated else value
        text = text[:match.start()]
    if re.match(r"^(?:has|have|exposes?|carries|with|shows?) (?:the |a |an )?(?:title|tooltip|aria-label|label|"
                r"placeholder|value)(?: attribute)? «\d+»$", text):
        raise Unparsed("then", clause, "an attribute of an element the clause does not name")
    text = _STRIP_VERB.sub("", text)
    heading = re.search(r"\s+as (?:a |an |the )?(?:visible )?(?P<u>unique |single )?(?P<r>headings?|titles?|"
                        r"links? or buttons?|buttons? or links?|buttons?|links?)$", text)
    as_roles = None
    if heading:
        as_roles = _roles_in(heading.group("r"), False)
        if heading.group("u"):
            count = "one" if count == "any" else count
        text = text[:heading.start()]
    noun = _TEXT_NOUN.match(text) or _STATUS.match(text)
    if noun:
        text = text[noun.end():]
    found = _target(text, names, "text", then=True)
    if not found:
        raise Unparsed("then", clause, "the expectation does not name exactly one element in a known shape")
    target, unique, post = found
    if (attrs or states) and not target["roles"]:
        target["kind"] = "control"  # a pressed / expanded / checked state belongs to the control, not its text
    if post and _TOKEN.search(post):
        raise Unparsed("then", clause, "a second name in the expectation is not consumed")
    if as_roles:
        target["roles"], target["kind"] = as_roles
    if unique and count == "any":
        count = "one"
    op = {"op": "expect", "target": target, "count": count}
    if attrs:
        op["attrs"] = attrs
    if states:
        op["states"] = states
    if style:
        op["style"] = style
    return finish([op])


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


_ACTIONS = ("click", "fill", "check", "select", "press", "hover", "focus")
# "in the sidebar", "in the suggestions listbox": these roles name one widget or landmark, so the lookup stays inside
# it; "in the notes list" or "in the regular section" may be any wrapper, so those scopes fall back to the page.
_STRICT_ROLE_SCOPES = {"listbox", "dialog", "alertdialog", "menu", "menubar", "complementary", "navigation", "tablist",
                       "toolbar", "grid", "table", "form", "tree"}


def _stem(word):
    for suffix in ("ations", "ation", "ings", "ing", "ions", "ion", "ed", "es", "s", "e"):
        if word.endswith(suffix) and len(word) - len(suffix) >= 3:
            return word[:-len(suffix)]
    return word


def _stem_match(a, b):
    short, long_ = sorted((a, b), key=len)
    return len(short) >= 3 and long_.startswith(short)


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
        self.entity_types = self._entity_types()
        self.values = {op["value"] for p in self.parsed.values() for op in p["when"] if op.get("op") == "fill"}
        self.containers = self._containers()
        self.signatures = self._signatures()
        self.full_cache = {}

    def _entity_types(self):
        """Entity types come from seed declarations or an explicitly named list/detail scope, never a label suffix."""
        found = {}
        for requirement in self.atomic:
            for name in _seeds(requirement):
                match = re.search(r'\b([A-Za-z][A-Za-z-]*)\s+[`"“]' + re.escape(name) + r'[`"”]',
                                  requirement['description'])
                if match:
                    found.setdefault(name, set()).add(_singular(match.group(1).lower()))
        for parsed in self.parsed.values():
            for op in parsed['when']:
                target = op.get('target') or {}
                scope = target.get('scope') or {}
                if op['op'] not in ('click', 'hover') or scope.get('type') != 'phrase':
                    continue
                keys = _page_key(scope['text']) or []
                if len(keys) == 1 and isinstance(keys[0], frozenset):
                    nouns = keys[0] - _TYPES
                    if len(nouns) == 1:
                        found.setdefault(target['name'], set()).update(nouns)
        return {name: next(iter(kinds)) for name, kinds in found.items() if len(kinds) == 1}

    # -- parsing
    def _parse(self, requirement, scenario):
        result = {"given": {"auth": None, "location": None, "open": None, "effects": []}, "when": [], "then": [],
                  "error": None, "fragments": []}
        givens, whens, thens = [], [], []
        for step in scenario["steps"]:
            {"GIVEN": givens, "WHEN": whens, "THEN": thens}.get(step["keyword"], whens).append(step["content"])
        try:
            for content in givens:
                state = _given(content)
                for key in ("auth", "location", "open"):
                    if state[key] is not None:
                        result["given"][key] = state[key]
                result["given"].setdefault("effects", []).extend(state["effects"])
            for content in whens:
                masked, names = mask(content)
                context = {}
                for clause in _clauses(masked):
                    try:
                        clause_ops = _when_clause(clause, names, context)
                    except Unparsed as exc:
                        raise Unparsed(exc.phase, _restore(exc.text, names), exc.reason) from None
                    for op in clause_ops:
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
        kinds = {self.entity_types.get(s) for s in _seeds(requirement)} - {None}
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
            substitutable = any(self.entity_types.get(op["target"]["name"]) in kinds for op in clicks)
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
        for effect in given.get("effects") or []:
            self._check_effect(requirement, effect, base)
        if given.get("open"):
            base.append(self._opener(rid, given["open"]))
        return base

    def _distinctive(self):
        """Words that appear in few requirement names (a word in most names says nothing about a state)."""
        if not hasattr(self, "_rare"):
            counts = {}
            for requirement in self.atomic:
                for word in {_stem(w) for w in re.findall(r"[a-z]+", requirement["name"].lower())}:
                    counts[word] = counts.get(word, 0) + 1
            limit = max(2, len(self.atomic) // 5)
            self._rare = {word for word, count in counts.items() if count <= limit}
        return self._rare

    def _check_effect(self, requirement, effect, base):
        """`the note is pinned` holds after a dependency whose name says so (`Pin note`); otherwise unparsed."""
        words = {_stem(w) for w in re.findall(r"[a-z]+", effect.lower()) if w not in _EFFECT_STOP}
        words &= self._distinctive()
        executed = [s["src"] for s in base if s["phase"] == "when"]
        for dep in reversed(executed):
            dep_words = {_stem(w) for w in re.findall(r"[a-z]+", self.by_id[dep]["name"].lower())}
            if any(_stem_match(a, b) for a in words for b in dep_words):
                return
        raise _Unresolved(f"GIVEN '{effect}' is not a state any executed prerequisite's name describes")

    def _opener(self, rid, name):
        """GIVEN `the "X" editor is open`: the activation of the control named X that a requirement's WHEN starts with."""
        for requirement in self.atomic:
            parsed = self.parsed[(requirement["id"], 0)]
            if requirement["id"] == rid or not parsed["when"] or (parsed["error"] and parsed["error"].phase != "then"):
                continue
            first = parsed["when"][0]
            if first["op"] == "click" and first["target"]["name"] == name:
                return {"src": requirement["id"], "phase": "given", "ops": [first]}
        raise _Unresolved(f"GIVEN needs `{name}` open, but no parsed requirement starts by activating it")

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

        `The user is on the folder creation page` + sibling `activates New Folder, fills Name, ...` with the
        same dependencies -> activate `New Folder`. The page's type word must occur in the sibling's or the
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
        for index, segment in enumerate(segments):
            for op in segment["ops"]:
                ops.append(dict(op, phase="given" if segment["src"] != requirement["id"] else op["phase"],
                                src=segment["src"], _segment=index))
        substitutions = self._substitute(requirement, ops)
        ops = self._prune(requirement, parsed, segments, ops)
        own_when = [dict(op) for op in parsed["when"]]
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
        # "`List view` has aria-pressed=true after the first activation": check it right after that action.
        actions = [i for i, op in enumerate(own_when) if op["op"] in _ACTIONS]
        placed, rest = {}, []
        for op in then_ops:
            after = op.pop("after", None)
            if after is None:
                rest.append(op)
                continue
            if not actions or after > len(actions):
                return dict(base, status="unparsed", reason=f"THEN refers to activation {after} of {len(actions)}",
                            fragment={"phase": "then", "text": op.get("text", ""), "reason": "no such activation"})
            placed.setdefault(actions[after - 1] if after > 0 else actions[-1], []).append(op)
        for index, op in enumerate(own_when):
            ops.append(op)
            ops.extend(placed.get(index, []))
        ops.extend(rest)
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

    def _prune(self, requirement, parsed, segments, ops):
        """Drop a prerequisite's data entry (a segment that fills, checks or selects) unless it logs in for a
        GIVEN that needs a login or acts on this requirement's own seed items: creating an unrelated note first
        establishes nothing the scenario reads, and only adds a way to fail before the scenario starts."""
        seeds = set(_seeds(requirement))
        keep = set()
        for index, segment in enumerate(segments):
            mine = [op for op in ops if op.get("_segment") == index]
            if segment.get("page") is not None or segment["src"] == requirement["id"] or segment["phase"] != "when":
                keep.add(index)
            elif not any(op["op"] in ("fill", "check", "select") for op in mine):
                keep.add(index)
            elif parsed["given"]["auth"] is True and self._logs_in(segment["src"]):
                keep.add(index)
            elif any(op["op"] in ("click", "hover", "focus") and (op["target"]["name"] in seeds or (
                    op["target"].get("scope") or {}).get("name") in seeds) for op in mine):
                keep.add(index)
        kept = []
        for op in ops:
            index = op.pop("_segment", None)
            if index is not None and index not in keep:
                continue
            if kept and op["op"] == "goto" and kept[-1]["op"] == "goto":
                continue
            kept.append(op)
        return kept

    def _substitute(self, requirement, ops):
        """Instantiate a prerequisite workflow with this requirement's sole seed of the explicitly declared entity type."""
        seeds = {}
        for name in _seeds(requirement):
            kind = self.entity_types.get(name)
            if kind:
                seeds.setdefault(kind, []).append(name)
        own = {op["target"]["name"] for parsed in [self.parsed[(requirement["id"], 0)]] for op in parsed["when"]
               if "target" in op}
        done = {}

        def swap(name):
            kind = self.entity_types.get(name)
            if not kind or len(seeds.get(kind, [])) != 1 or name in own or name in seeds[kind]:
                return None
            return seeds[kind][0]

        for op in ops:
            if "target" not in op or op["src"] == requirement["id"]:
                continue
            target = dict(op["target"])
            new_name = swap(target["name"]) if op["op"] in ("click", "hover", "check", "focus") else None
            if new_name:
                done[target["name"]] = new_name
                target["name"] = new_name
            scope = target.get("scope")
            if scope and scope.get("type") == "named" and swap(scope["name"]):
                done[scope["name"]] = swap(scope["name"])
                target["scope"] = dict(scope, name=done[scope["name"]])
            if target != op["target"]:
                op["target"] = target
                op["text"] = f"{op.get('text', '')} [{', '.join(f'`{b}` for `{a}`' for a, b in done.items())}]"
        return done

    def _resolve_scopes(self, ops):
        """An unquoted scope phrase becomes the quoted container it names (`the item list` -> `Item list`), else a
        soft role scope when it names a role (`the visible suggestions listbox`), else it is dropped."""
        for op in ops:
            target = op.get("target")
            scope = target.get("scope") if target else None
            if not scope or scope.get("type") != "phrase":
                continue
            words = scope["text"].split()
            candidates = [" ".join(words[i:j]) for i in range(len(words)) for j in range(len(words), i, -1)]
            name = next((self.containers[c] for c in candidates if c in self.containers), None)
            if name:
                target["scope"] = {"type": "named", "name": name, "roles": [], "strict": False}
            elif scope.get("roles"):
                target["scope"] = {"type": "role", "roles": scope["roles"],
                                   "strict": bool(set(scope["roles"]) & _STRICT_ROLE_SCOPES)}
            else:
                target.pop("scope")

    def _entity(self, name):
        if name in self.seed_names and name in self.entity_types:
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
    known = {}  # WHEN steps the rules read, also for requirements whose GIVEN or THEN they could not
    for requirement in planner.atomic:
        found = planner.parsed[(requirement["id"], 0)]
        if found["when"] and not (found["error"] and found["error"].phase == "when"):
            known[requirement["id"]] = found["when"]
    return {"scenarios": scenarios, "coverage": {"total": len(scenarios), "parsed": parsed}, "entities": entities,
            "known_steps": known}


def shape(text):
    """A fragment's sentence shape: quoted names become «», so frequent unparsed shapes group together."""
    masked, _ = mask(text)
    return _TOKEN.sub("«»", masked)


if __name__ == "__main__":  # debugging aid: print the plan of a requirements file
    import json
    import sys

    with open(sys.argv[1], encoding="utf-8") as handle:
        print(json.dumps(plan(handle.read()), indent=1, ensure_ascii=False, default=str))
