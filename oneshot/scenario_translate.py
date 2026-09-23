"""Model fallback for scenarios the rules cannot read (Python standard library only).

One call per requirements document: every unparsed scenario, with the requirements it depends on, goes to
the model in a single request, and the reply must be strict JSON in the executor's step format. Each
translated scenario is validated on its own: only step types the executor supports, only ARIA roles and
keys from fixed lists, and every element name, option and expected text copied verbatim from the
requirements (or typed earlier in the same scenario). A scenario that fails validation stays unparsed.

The reply is cached by the SHA-256 of the requirements text (plus the prompt version and model), so repair
rounds on the same task never call again; validation runs on every read, so a stricter validator applies to
old replies too. The gateway and key come from OPENAI_BASE_URL / OPENAI_API_KEY, as in main.py.
"""
import hashlib
import http.client
import json
import os
import re
import tempfile
import time
from pathlib import Path
from urllib import error, request

try:
    from . import scenarios
except ImportError:  # run as a script, or from the flat package next to main.py
    import scenarios

MODEL = "deepseek-v4-flash"
DEFAULT_BASE = "https://api.arc-bench.com/v1"
VERSION = "3"  # prompt and reply format; part of the cache key
MAX_TOKENS = 65536
TIMEOUT_SECONDS = 600
# CNY per million tokens (input, cache-hit input, output), read with `arcbench models` on 2026-09-23.
PRICES = {"deepseek-v4-flash": (3.0, 0.1, 9.0)}
CACHE_DIR = Path(os.environ.get("SCENARIO_CACHE_DIR") or Path(tempfile.gettempdir()) / "oneshot-scenario-cache")

ROLES = {"button", "link", "heading", "textbox", "searchbox", "combobox", "spinbutton", "checkbox", "radio", "switch",
         "tab", "tabpanel", "tablist", "menu", "menubar", "menuitem", "menuitemcheckbox", "menuitemradio", "option",
         "listbox", "list", "listitem", "region", "form", "dialog", "alertdialog", "alert", "status", "article",
         "navigation", "complementary", "banner", "main", "contentinfo", "search", "group", "row", "cell", "gridcell",
         "columnheader", "rowheader", "grid", "table", "img", "toolbar", "tree", "treeitem", "progressbar", "slider",
         "tooltip", "separator", "log", "marquee", "timer", "figure", "note", "definition", "term"}
FIELD_ROLES = {"textbox", "searchbox", "combobox", "spinbutton"}
STRUCTURE_ROLES = ROLES - FIELD_ROLES - {"button", "link", "checkbox", "radio", "switch", "tab", "menuitem",
                                         "menuitemcheckbox", "menuitemradio", "option", "treeitem", "slider"}
TAGS = {"mark", "strong", "em", "b", "i", "u", "s", "code", "pre", "blockquote", "p", "span", "label", "li", "ul",
        "ol", "table", "tr", "td", "th", "h1", "h2", "h3", "h4", "h5", "h6", "img", "svg", "time", "small", "sup",
        "sub", "del", "ins", "abbr", "kbd", "figcaption", "caption", "legend", "summary", "details", "output"}
KEYS = {"Enter", "Escape", "Tab", "Space", "Backspace", "Delete", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
        "Home", "End", "PageUp", "PageDown"}
STYLE_PROPS = {"background-color", "color", "display", "visibility", "opacity", "font-weight", "font-style",
               "text-decoration-line", "border-color"}
ATTR = re.compile(r"^(?:aria-[a-z]+|title|role|alt|placeholder|href|value|name|type|data-[a-z0-9-]+)$")
ACTIONS = {"click", "dblclick", "hover", "focus", "fill", "check", "uncheck", "select", "press"}
# ARIA states an expectation may check, and the roles that support them (WAI-ARIA 1.2).
ARIA_SUPPORT = {"aria-pressed": {"button"},
                "aria-checked": {"checkbox", "radio", "switch", "menuitemcheckbox", "menuitemradio", "option", "treeitem"},
                "aria-selected": {"option", "tab", "row", "gridcell", "treeitem", "columnheader", "rowheader"},
                "aria-expanded": {"button", "combobox", "link", "menuitem", "row", "tab", "treeitem", "gridcell",
                                  "listbox", "checkbox", "menuitemcheckbox", "menuitemradio", "switch", "rowheader",
                                  "columnheader"}}
DOES = ACTIONS | {"open", "wait", "expect"}
RECORD_ROLES = {"article", "listitem", "row", "group", "cell", "gridcell", "region", "list", "heading", "treeitem"}
IMAGE = re.compile(r"!\[[^\]]*\]\([^)]*\)")

SYSTEM = """You translate acceptance scenarios of a web application's requirements into steps for a browser test executor.
Reply with one JSON object and nothing else: {"scenarios": [...]}, one entry per requested scenario id, in any order.

Each entry is {"id": "<scenario id>", "steps": [<step>, ...]} or {"id": "<scenario id>", "untranslatable": "<why>"}.
A step is an object with "phase" ("given", "when" or "then") and "do", plus fields per "do":
- "open": load the application URL (the home page). The first step of every scenario must be open.
- "click", "dblclick", "hover", "focus": {"role", "name"} of the element; optional "in", optional "unique": true.
- "fill": {"role", "name", "value"}: replace a field's text. "check" / "uncheck": {"role", "name"} of a checkbox.
- "select": {"role", "name", "option"}: choose an option of a select or combobox.
- "press": {"key"}: one of Enter, Escape, Tab, Space, Backspace, Delete, ArrowUp, ArrowDown, ArrowLeft, ArrowRight.
- "wait": {"ms"} up to 3000, only when the scenario itself says the system is still working.
- "expect": {"role", "name", "count"} checks what is visible now. "count" is "any" (at least one, the default),
  "one" (exactly one: use it when the text says unique / exactly one) or "none" (absent, closed, removed, not shown).
  Optional "attr": {"aria-pressed": "true"} or other attribute values the text states, "checked": true/false,
  "style": {"background-color": "rgb(...)"} for a computed color the text states, and "in".
Element fields: "role" is an ARIA role (button, link, heading, textbox, searchbox, combobox, checkbox, radio, switch,
tab, menu, menuitem, option, listbox, list, listitem, region, form, dialog, alert, status, article, navigation,
complementary, banner, main, group, row, cell, table, img, toolbar ...), or "text" for plain visible text, or null when
the text does not say. "name" is the accessible name, copied character for character from a quoted name in the
requirements (backticks or quotes) or a value an earlier "fill" step of the same scenario typed; never invented, never
translated, never reworded. For an HTML element the text names only by tag (for example `mark`), use
{"tag": "mark", "name": "<text it contains>"} instead of role. "in" is the container to look inside:
{"role": ..., "name": ...} with the same rules (for example the note article, the dialog, the sidebar region).

Rules:
- Every scenario starts in a new browser with the application in its initial seed state; nothing is shared between
  scenarios. Build the GIVEN state with steps: open, then the actions of the prerequisite requirements that lead to
  it (their WHEN steps), using this scenario's own seed data names where its requirement names different seed items.
- Then the scenario's WHEN actions, then its THEN checks. A THEN that describes a state after one of several actions
  ("after the first activation") goes right after that action.
- Check only what the THEN step states, with the names it gives. A check the text makes without any name you can
  copy (for example "the corresponding page opens") is left out; if nothing checkable remains, the scenario is
  untranslatable. Do not add checks the scenario does not state.
- When a step needs a name the requirements do not give (for example "the target item" with no seed item that
  identifies it), mark the scenario untranslatable instead of guessing.
- Cover every action of the WHEN step, in order. If an action names nothing you can copy (for example "opens the
  draft actions" with no quoted control), the scenario is untranslatable: never skip an action.
- When the text places a control in an area (the sidebar, a dialog, a listbox, a menu, a named region or article),
  give "in" with that area's role; give its name only when the text quotes it.
- To come back to the home page, use the control some requirement names for it (for example a brand or home button);
  use open only when no requirement names one.
- Use "unique": true on an action only when the text says the control is unique.
- Each requested scenario comes with the fragment a rule-based reader could not read ("unread"); make sure your steps
  cover that fragment exactly as the text states it.
- Keep every location the text gives: "in the top navigation bar" -> "in": {"role": "navigation"}, "in the sidebar"
  -> "in": {"role": "complementary"}, "inside the `X` article" -> "in": {"role": "article", "name": "X"}.
- "known_steps" lists, for requirements a rule-based reader did read, the steps of their WHEN part. When a scenario
  needs a prerequisite from that list, copy its steps, replacing only the seed item names by this scenario's own.
- When a requirement's seed data names a user account, or its text says the user is authenticated or the page is the
  authenticated one, first log in with the steps of the requirement that logs in.
- Put an ARIA state (aria-pressed, aria-expanded, aria-checked, aria-selected) on the control the text says carries
  it, such as the toggle button, never on the region it opens or closes.
- Use every quoted name of the scenario's own GIVEN, WHEN and THEN text in your steps; a scenario you cannot
  express that way is untranslatable.

Example (for an unrelated application):
{"scenarios": [{"id": "REQ-9.9", "steps": [
 {"phase": "given", "do": "open"},
 {"phase": "given", "do": "click", "role": "link", "name": "Projects"},
 {"phase": "when", "do": "hover", "role": "article", "name": "Project Alpha 9.9"},
 {"phase": "when", "do": "click", "role": "button", "name": "Archive", "in": {"role": "article", "name": "Project Alpha 9.9"}},
 {"phase": "then", "do": "expect", "role": "article", "name": "Project Alpha 9.9", "count": "none"},
 {"phase": "then", "do": "expect", "role": "text", "name": "Project archived"},
 {"phase": "when", "do": "click", "role": "button", "name": "Undo", "unique": true},
 {"phase": "then", "do": "expect", "role": "button", "name": "Watch", "attr": {"aria-pressed": "false"}}]},
 {"id": "REQ-9.10", "untranslatable": "the target row is never named"}]}"""


class TranslateError(Exception):
    pass


def _clean(text):
    return re.sub(r"\s+", " ", IMAGE.sub("", scenarios._text(text))).strip()


def _context(requirements, wanted):
    """Compact records of the requested requirements, their dependencies and folders, and every other requirement
    (a scenario's controls are often described elsewhere, such as the home button of a navigation requirement)."""
    records = []
    for requirement in requirements:  # document order
        record = {"id": requirement["id"], "type": requirement["type"], "name": requirement["name"],
                  "description": _clean(requirement["description"]), "dependencies": requirement["dependencies"]}
        if requirement["parent"]:
            record["parent"] = requirement["parent"]
        if requirement["scenarios"]:
            record["scenarios"] = [{"name": s["name"], "steps": [f"{st['keyword']}: {_clean(st['content'])}"
                                                                  for st in s["steps"]]} for s in requirement["scenarios"]]
        records.append(record)
    return records


def _model_step(op):
    """A rules-parsed op in the reply schema (for `known_steps`)."""
    if op["op"] == "goto":
        return {"do": "open"}
    if op["op"] not in ("click", "hover", "focus", "fill", "check", "select", "press"):
        return None
    if op["op"] == "press":
        return {"do": "press", "key": "Space" if op["key"] == " " else op["key"]}
    target = op["target"]
    roles = target.get("roles") or []
    step = {"do": "uncheck" if op["op"] == "check" and not op.get("checked", True) else
            "dblclick" if op.get("double") else op["op"],
            "role": roles[0] if len(roles) == 1 else None, "name": target["name"]}
    scope = target.get("scope") or {}
    if scope.get("type") == "named":
        step["in"] = {"role": (scope.get("roles") or [None])[0], "name": scope["name"]}
    elif scope.get("type") == "landmark":
        step["in"] = {"role": "navigation"}
    elif scope.get("type") == "role":
        step["in"] = {"role": scope["roles"][0]}
    if op.get("unique"):
        step["unique"] = True
    if op["op"] == "fill":
        step["value"] = op["value"]
    if op["op"] == "select":
        step["option"] = op["option"]
    return step


def build_messages(requirements, unparsed, known=None):
    """unparsed: [{"id", "requirement"}] -> chat messages for one call. `known`: {requirement id: WHEN ops}."""
    wanted = sorted({item["requirement"] for item in unparsed})
    known_steps = {}
    for rid, ops in (known or {}).items():
        steps = [step for step in (_model_step(op) for op in ops) if step]
        if steps:
            known_steps[rid] = steps
    payload = {"requirements": _context(requirements, wanted),
               "translate": [{"id": item["id"], "requirement": item["requirement"], "scenario": item.get("name", ""),
                              "unread": (item.get("fragment") or {}).get("text", "")[:300]} for item in unparsed]}
    user = ("Requirements (JSON records in document order; dependencies list the prerequisite requirement ids):\n"
            + json.dumps(payload["requirements"], ensure_ascii=False, indent=0)
            + "\n\nknown_steps (WHEN steps of requirements already read by rules):\n"
            + json.dumps(known_steps, ensure_ascii=False)
            + "\n\nTranslate these scenarios (the id selects a scenario; `#2` is the requirement's second scenario):\n"
            + json.dumps(payload["translate"], ensure_ascii=False))
    return [{"role": "system", "content": SYSTEM}, {"role": "user", "content": user}]


class _NoRedirect(request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise error.HTTPError(req.full_url, code, "model redirect refused", headers, fp)


def call_model(messages, base, key, model=MODEL, timeout=TIMEOUT_SECONDS):
    """One streamed chat completion; returns (content, usage, finish_reason, seconds). Never logs the key."""
    payload = {"model": model, "messages": messages, "max_tokens": MAX_TOKENS, "temperature": 0.0,
               "stream": True, "stream_options": {"include_usage": True}, "reasoning_effort": "low"}
    req = request.Request(base.rstrip("/") + "/chat/completions", data=json.dumps(payload).encode("utf-8"),
                          headers={"Content-Type": "application/json", "Authorization": "Bearer " + key},
                          method="POST")
    started = time.monotonic()
    content, usage, finish, done = [], {}, None, False
    try:
        with request.build_opener(_NoRedirect()).open(req, timeout=timeout) as response:
            for line in response:
                if not line.startswith(b"data:"):
                    continue
                chunk = line[5:].strip()
                if chunk == b"[DONE]":
                    done = True
                    break
                obj = json.loads(chunk)
                if not isinstance(obj, dict) or "error" in obj:
                    raise TranslateError("the gateway streamed an error object")
                if isinstance(obj.get("usage"), dict):
                    usage = obj["usage"]
                for choice in obj.get("choices") or []:
                    delta = (choice.get("delta") or {}).get("content")
                    if isinstance(delta, str):
                        content.append(delta)
                    if choice.get("finish_reason"):
                        finish = choice["finish_reason"]
    except error.HTTPError as exc:
        raise TranslateError(f"model HTTP {exc.code}") from None
    except (error.URLError, OSError, http.client.IncompleteRead, ValueError) as exc:
        raise TranslateError(f"model stream failed ({type(exc).__name__})") from None
    if not done or finish is None:
        raise TranslateError("the model stream ended without completion markers")
    return "".join(content), usage, finish, round(time.monotonic() - started, 1)


def cost_cny(usage, model=MODEL):
    """Cost of one call from its reported usage; None when the model's price or the usage is unknown."""
    price = PRICES.get(model)
    prompt, completion = usage.get("prompt_tokens"), usage.get("completion_tokens")
    if not price or not isinstance(prompt, int) or not isinstance(completion, int):
        return None
    hit = usage.get("prompt_cache_hit_tokens")
    if not isinstance(hit, int):
        hit = ((usage.get("prompt_tokens_details") or {}).get("cached_tokens") or 0)
    return round(((prompt - hit) * price[0] + hit * price[1] + completion * price[2]) / 1e6, 6)


def _parse_reply(content):
    text = content.strip()
    fenced = re.search(r"```(?:json)?\s*(.*?)```", text, re.S)
    if fenced:
        text = fenced.group(1).strip()
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end < start:
        raise TranslateError("the reply holds no JSON object")
    try:
        value = json.loads(text[start:end + 1])
    except ValueError as exc:
        items = _salvage(text)
        if items:
            return items  # a reply cut off at the token limit keeps the scenarios it completed
        raise TranslateError(f"the reply is not valid JSON ({exc})") from None
    items = value.get("scenarios") if isinstance(value, dict) else None
    if not isinstance(items, list):
        raise TranslateError("the reply has no `scenarios` list")
    return items


def _salvage(text):
    """The complete entries of a `scenarios` array whose reply ended early."""
    match = re.search(r'"scenarios"\s*:\s*\[', text)
    if not match:
        return []
    decoder, index, items = json.JSONDecoder(), match.end(), []
    while True:
        while index < len(text) and text[index] in " \t\r\n,":
            index += 1
        try:
            item, index = decoder.raw_decode(text, index)
        except ValueError:
            return items
        if isinstance(item, dict):
            items.append(item)


# ------------------------------------------------------------------------------ validation

class Invalid(Exception):
    pass


def _string(step, field, limit=300, required=True):
    value = step.get(field)
    if value is None and not required:
        return None
    if not isinstance(value, str) or not value.strip() or len(value) > limit:
        raise Invalid(f"`{field}` must be a non-empty string")
    return value


def _bare(text):
    return text.strip().rstrip(".,;:!?").strip()


def _verbatim(name, corpus, typed, what):
    """A name must be one of the requirements' quoted names (backticks or quotes; trailing punctuation aside)
    or a value typed earlier in the same scenario: a word merely occurring in prose is not a name."""
    if name in typed or _bare(name) in corpus:
        return name
    raise Invalid(f"{what} `{name[:60]}` is not a quoted name in the requirements")


def _element(step, corpus, typed, where="element", nameless=False):
    """{"role", "name"} or {"tag", "name"} -> executor target. `nameless`: an expect may count a role alone."""
    if "tag" in step and step["tag"] is not None:
        tag = step["tag"]
        if tag not in TAGS:
            raise Invalid(f"tag `{tag}` is not supported")
        _verbatim(tag, corpus, typed, "tag")
        name = step.get("name") or ""
        if name:
            _verbatim(name, corpus, typed, "text")
        return {"name": name, "roles": [], "kind": "tag", "tag": tag}
    role = step.get("role")
    if role in TAGS and role not in ROLES:  # "role": "mark" names the element by its tag
        return _element(dict(step, tag=role, role=None), corpus, typed, where)
    if nameless and step.get("name") in (None, "") and role in ROLES:
        kind = "field" if role in FIELD_ROLES else "structure" if role in STRUCTURE_ROLES else "control"
        return {"name": "", "roles": [role], "kind": kind}
    name = _verbatim(_string(step, "name"), corpus, typed, where)
    if role in (None, "", "text"):
        return {"name": name, "roles": [], "kind": "text" if role == "text" else "any"}
    if role not in ROLES:
        raise Invalid(f"role `{role}` is not an ARIA role the executor supports")
    kind = "field" if role in FIELD_ROLES else "structure" if role in STRUCTURE_ROLES else "control"
    return {"name": name, "roles": [role], "kind": kind}


def _scope(step, corpus, typed):
    scope = step.get("in")
    if scope is None:
        return None
    if not isinstance(scope, dict):
        raise Invalid("`in` must be an object")
    if scope.get("name") in (None, "") and scope.get("role") in ("navigation", "banner"):
        return {"type": "landmark"}  # "in the top navigation bar": navigation landmarks, then the banner, then the page
    if scope.get("name") in (None, "") and scope.get("role") in ROLES:  # "in the sidebar"
        return {"type": "role", "roles": [scope["role"]], "strict": scope["role"] in scenarios._STRICT_ROLE_SCOPES}
    inner = _element(scope, corpus, typed, "container")
    if inner["kind"] == "tag":
        raise Invalid("a container is named by role, not tag")
    return {"type": "named", "name": inner["name"], "roles": inner["roles"], "strict": True}


def _used(ops):
    """Names a translation uses: element, container, typed, option, attribute and style values, roles and tags."""
    every, checked = set(), set()
    for op in ops:
        target = op.get("target") or {}
        names = {target.get("name"), (target.get("scope") or {}).get("name"), op.get("value"), op.get("option"),
                 target.get("tag")} | set(target.get("roles") or []) | set((target.get("scope") or {}).get("roles") or [])
        names |= set((op.get("attrs") or {}).values()) | set((op.get("style") or {}).values())
        names = {_bare(n) for n in names if isinstance(n, str) and n}
        every |= names
        if op["op"] == "expect":
            checked |= names
    return every, checked


def _coverage(ops, scenario):
    """Every quoted name of the scenario's GIVEN and WHEN is used by some step, and every quoted name of its THEN
    by some expectation: a translation that drops one has left out part of the scenario."""
    every, checked = _used(ops)
    for step in scenario["steps"]:
        _, names = scenarios.mask(step["content"])
        missing = [n for n in names if _bare(n) and _bare(n) not in (checked if step["keyword"] == "THEN" else every)]
        if missing:
            raise Invalid(f"the {step['keyword']} name `{missing[0][:60]}` is not used by any "
                          f"{'expectation' if step['keyword'] == 'THEN' else 'step'}")


def _normalise(ops, known):
    """An action on a control the rules also read keeps the rules' location when the reply gave none
    ("in the top navigation bar" is easy to drop)."""
    index = {}
    for rule_ops in known.values():
        for op in rule_ops:
            if op["op"] in ("click", "hover", "focus", "fill", "check", "select"):
                index.setdefault((op["op"], op["target"]["name"]), []).append(op)
    for op in ops:
        target = op.get("target")
        if not target or target.get("scope") or op["op"] not in ("click", "hover", "focus", "fill", "check", "select"):
            continue
        scopes = {json.dumps(r["target"].get("scope"), sort_keys=True) for r in index.get((op["op"], target["name"]), [])}
        if len(scopes) == 1:
            scope = json.loads(scopes.pop())
            if scope and scope.get("type") in ("landmark", "role"):
                target["scope"] = scope
    return ops


def validate(item, corpus, requirement_id, entities=frozenset(), scenario=None, known=None):
    """One translated scenario -> executor ops; raises Invalid with the first problem."""
    steps = item.get("steps")
    if not isinstance(steps, list) or not steps or len(steps) > 80:
        raise Invalid("`steps` must be a list of 1 to 80 steps")
    ops, typed, expects, last_phase = [], set(), 0, "given"
    order = {"given": 0, "when": 1, "then": 1}
    for index, step in enumerate(steps):
        if not isinstance(step, dict):
            raise Invalid(f"step {index + 1} is not an object")
        do, phase = step.get("do"), step.get("phase")
        if do not in DOES:
            raise Invalid(f"step {index + 1}: `{do}` is not a supported step type")
        if phase not in order:
            raise Invalid(f"step {index + 1}: phase must be given, when or then")
        if order[phase] < order[last_phase]:
            raise Invalid(f"step {index + 1}: a given step after the scenario's actions")
        last_phase = phase
        where = f"step {index + 1}"
        op = {"src": requirement_id, "phase": phase}
        try:
            if do == "open":
                op.update(op="goto", path="/")
            elif do == "wait":
                ms = step.get("ms", 500)
                if not isinstance(ms, int) or isinstance(ms, bool) or not 0 <= ms <= 3000:
                    raise Invalid("`ms` must be 0 to 3000")
                op.update(op="wait", ms=ms)
            elif do == "press":
                if step.get("key") not in KEYS:
                    raise Invalid("`key` is not a supported key")
                op.update(op="press", key=" " if step["key"] == "Space" else step["key"])
            else:
                target = _element(step, corpus, typed, nameless=do == "expect")
                scope = _scope(step, corpus, typed)
                if scope and do != "expect" and scope["type"] == "named" and set(scope["roles"]) & RECORD_ROLES:
                    scope["strict"] = False  # act inside the record first; its editor may open outside it
                if scope:
                    target["scope"] = scope
                if do in ("fill", "select", "focus") and target["kind"] in ("any", "text"):
                    target["kind"], target["roles"] = "field", sorted(FIELD_ROLES)
                elif target["kind"] == "any":
                    target["kind"] = "control" if do in ACTIONS else "text"
                unique = step.get("unique") is True
                if do in ("click", "dblclick", "hover", "focus"):
                    op.update(op="hover" if do == "hover" else "focus" if do == "focus" else "click",
                              target=target, unique=unique)
                    if do == "dblclick":
                        op["double"] = True
                    if op["op"] == "click" and target["name"] in entities:
                        op["entity"] = True
                elif do == "fill":
                    value = step.get("value")
                    if not isinstance(value, str) or len(value) > 500:
                        raise Invalid("`value` must be a string")
                    typed.add(value)
                    op.update(op="fill", target=target, value=value, unique=unique)
                elif do in ("check", "uncheck"):
                    if not target["roles"]:
                        target["roles"], target["kind"] = ["checkbox", "radio", "switch"], "control"
                    op.update(op="check", target=target, checked=do == "check", unique=unique)
                elif do == "select":
                    option = _verbatim(_string(step, "option"), corpus, typed, "option")
                    op.update(op="select", target=target, option=option, unique=unique)
                else:  # expect
                    count = step.get("count", "any")
                    if count not in ("any", "one", "none"):
                        raise Invalid("`count` must be any, one or none")
                    op.update(op="expect", target=target, count=count)
                    attrs = step.get("attr")
                    if attrs is not None:
                        if not isinstance(attrs, dict) or not attrs or not all(
                                isinstance(k, str) and ATTR.match(k) and isinstance(v, (str, bool)) for k, v in attrs.items()):
                            raise Invalid("`attr` must map attribute names to values")
                        op["attrs"] = {k: (str(v).lower() if isinstance(v, bool) else v) for k, v in attrs.items()}
                        for key in op["attrs"]:
                            support = ARIA_SUPPORT.get(key)
                            if support and target["roles"] and not set(target["roles"]) & support:
                                raise Invalid(f"{key} is not a state of role {target['roles'][0]}")
                        for key, value in op["attrs"].items():
                            if value not in ("true", "false", "mixed"):
                                _verbatim(value, corpus, typed, f"{key} value")
                        if target["kind"] == "text":
                            target["kind"] = "control"
                    if "checked" in step:
                        if not isinstance(step["checked"], bool):
                            raise Invalid("`checked` must be true or false")
                        op["states"] = {"checked": step["checked"]}
                    style = step.get("style")
                    if style is not None:
                        if not isinstance(style, dict) or not style or not all(
                                k in STYLE_PROPS and isinstance(v, str) for k, v in style.items()):
                            raise Invalid("`style` must map a supported CSS property to a value")
                        for value in style.values():
                            _verbatim(value, corpus, typed, "style value")
                        op["style"] = dict(style)
                    expects += 1
        except Invalid as exc:
            raise Invalid(f"{where}: {exc}") from None
        op["text"] = "model: " + json.dumps({k: v for k, v in step.items() if k != "phase"}, ensure_ascii=False)[:200]
        ops.append(op)
    if not expects:
        raise Invalid("no expect step")
    if ops[0]["op"] != "goto":
        ops.insert(0, {"op": "goto", "path": "/", "src": requirement_id, "phase": "given", "text": "open the application URL"})
    if scenario is not None:
        _coverage(ops, scenario)
    return _normalise(ops, known or {})


def _corpus(requirements):
    """Every quoted span of the requirements: `backticks`, "double" and “curly” quotes."""
    names = set()
    for requirement in requirements:
        parts = [requirement["description"]]
        for scenario in requirement["scenarios"]:
            parts.extend(step["content"] for step in scenario["steps"])
        for part in parts:
            text = scenarios._text(part)
            names.update(_bare(m) for m in re.findall(r"`([^`\n]+)`", text))
            names.update(_bare(a or b) for a, b in re.findall(r'"([^"\n]+)"|“([^”\n]+)”', text))
    names.discard("")
    return names


# ----------------------------------------------------------------------------------- entry

def cache_path(text, model=MODEL, cache_dir=None):
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
    return Path(cache_dir or CACHE_DIR) / f"{digest}-v{VERSION}-{model}.json"


def translate(text, planned, base=None, key=None, model=None, cache_dir=None, call=None):
    """Translate the unparsed scenarios of a plan. Returns a summary with `accepted` {id: ops} and `rejected`."""
    model = model or os.environ.get("SCENARIO_MODEL") or MODEL
    call = call or call_model
    cache_dir = cache_dir or CACHE_DIR
    unparsed = [s for s in planned["scenarios"] if s["status"] != "parsed"]
    summary = {"status": "not_needed", "model": model, "requested": len(unparsed), "accepted": {}, "rejected": {},
               "calls": 0, "usage": {}, "cost_cny": 0.0}
    if not unparsed:
        return summary
    path = cache_path(text, model, cache_dir)
    summary["cache"] = str(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    # Parallel checks of one task make one call, not several (the lock lives outside the cache directory).
    with open(Path(tempfile.gettempdir()) / (path.name + ".lock"), "w") as lock:
        try:
            import fcntl
            fcntl.flock(lock, fcntl.LOCK_EX)
        except (ImportError, OSError):
            pass
        record = _cached_or_called(text, planned, unparsed, path, summary, base, key, model, call)
    if record is None:
        return summary
    return _accept(text, planned, unparsed, record, summary)


def _cached_or_called(text, planned, unparsed, path, summary, base, key, model, call):
    if path.is_file():
        summary["status"] = "cached"
        return json.loads(path.read_text(encoding="utf-8"))
    key = key if key is not None else os.environ.get("OPENAI_API_KEY", "")
    if not key:
        summary["status"] = "no_key"
        return None
    base = base or os.environ.get("OPENAI_BASE_URL") or DEFAULT_BASE
    messages = build_messages(scenarios.load_requirements(text), unparsed, planned.get("known_steps"))
    started_at = time.time()
    try:
        content, usage, finish, seconds = call(messages, base, key, model)
    except TranslateError as exc:
        summary.update(status="failed", error=str(exc), calls=1)
        return None
    record = {"requirements_sha256": hashlib.sha256(text.encode("utf-8")).hexdigest(), "version": VERSION,
              "model": model, "started_at": started_at, "seconds": seconds, "finish_reason": finish,
              "usage": usage, "cost_cny": cost_cny(usage, model), "messages": messages, "content": content}
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(record, ensure_ascii=False, indent=1), encoding="utf-8")
    temporary.replace(path)
    summary.update(status="called", calls=1)
    return record


def _accept(text, planned, unparsed, record, summary):
    summary.update(usage=record.get("usage") or {}, seconds=record.get("seconds"),
                   finish_reason=record.get("finish_reason"), started_at=record.get("started_at"))
    summary["cost_cny"] = record.get("cost_cny") if summary["status"] == "called" else 0.0
    summary["original_cost_cny"] = record.get("cost_cny")
    requirements = scenarios.load_requirements(text)
    corpus = _corpus(requirements)
    wanted = {s["id"]: s for s in unparsed}
    by_id = {r["id"]: r for r in requirements}

    def scenario_of(sid):
        rid, _, number = sid.partition("#")
        found = by_id.get(rid)
        index = int(number) - 1 if number.isdigit() else 0
        return found["scenarios"][index] if found and index < len(found["scenarios"]) else None
    entities = set(planned.get("entities") or [])
    try:
        items = _parse_reply(record.get("content") or "")
    except TranslateError as exc:
        summary["rejected"] = {sid: str(exc) for sid in wanted}
        summary["reply_error"] = str(exc)
        return summary
    seen = set()
    for item in items:
        sid = item.get("id") if isinstance(item, dict) else None
        if sid not in wanted or sid in seen:
            continue
        seen.add(sid)
        if "untranslatable" in item:
            summary["rejected"][sid] = "model: " + str(item.get("untranslatable"))[:200]
            continue
        try:
            summary["accepted"][sid] = validate(item, corpus, wanted[sid]["requirement"], entities, scenario_of(sid),
                                                planned.get("known_steps"))
        except Invalid as exc:
            summary["rejected"][sid] = str(exc)
    for sid in wanted:
        if sid not in seen:
            summary["rejected"][sid] = "the reply has no entry for this scenario"
    return summary
