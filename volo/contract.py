"""A global state contract extracted once from the complete requirement package.

A large requirement package is implemented in batches, and a later batch is shown
only the names and dependencies of earlier ones. Seed identities, exact copy,
navigation entry points and API shapes are declared once in requirement prose and
then assumed silently by every later requirement, so independent batches invent
mutually inconsistent versions of the same shared state.

This module extracts that shared state once, before any page is generated, and
hands the same document to every batch verbatim.

Two properties matter more than the model's own judgement:

* Quoted literals and seed sentences are recovered **deterministically** from the
  requirement text. The model organizes them; it cannot lose them. Anything the
  model drops is reattached mechanically by :func:`reconcile`.
* The contract is derived from the requirements alone. Acceptance tests never
  reach this path.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

# Quoted literals in requirement prose become the strings an evaluator looks for.
# Both straight and typographic quotes appear in published requirement packages.
QUOTED = re.compile(r'"([^"\n]{1,160})"|“([^”\n]{1,160})”')

# "The system contains a deletable regular note titled "Delete me 2.3.1"." is the
# dominant way a seed row is declared. Keep the sentence split conservative: a
# period followed by a space and a capital, not inside a quoted span.
SENTENCE = re.compile(r'(?<=[.!?])\s+(?=[A-Z])')
SEED_MARKERS = (
    'the system contains', 'the system has', 'a verified account',
    'an existing', 'there is an existing', 'the application contains',
    'is pre-registered', 'already exists', 'has been created',
    'the system includes', 'the system provides', 'default',
)

SCHEMA_HINT = {
    "version": 1,
    "app": {"name": "<application name>", "entry": "/", "summary": "<one sentence>"},
    "entities": [{
        "name": "<singular entity>", "collection": "<plural store key>",
        "fields": [{"name": "<field>", "type": "string|number|boolean|array|object",
                    "default": "<value or null>", "notes": "<optional>"}],
    }],
    "seeds": [{
        "id": "<stable kebab-case id, unique>", "collection": "<store key>",
        "declared_by": "<REQ id whose description declares it>",
        "data": {"<field>": "<value>"},
        "mutated_by": ["<REQ ids that delete or modify this exact row>"],
    }],
    "exact_texts": [{"requirement": "<REQ id>", "texts": ["<verbatim visible string>"]}],
    "navigation": [{"name": "<accessible name of the control>", "from": "<screen>",
                    "screen": "<screen it opens>", "control": "link|button|tab|menuitem"}],
    "persistence": ["<one sentence per durability requirement>"],
    "api": [{"method": "GET|POST|PATCH|DELETE", "path": "/api/<resource>",
             "purpose": "<one clause>"}],
    "conventions": ["<shared decision every batch must follow>"],
}

INSTRUCTION = """You are preparing the shared-state contract for one web application that
several independent implementation batches will build. Each batch sees this contract and its
own requirements, never the other batches' code. Anything two batches must agree on belongs
here; anything only one batch needs does not.

Return ONE JSON object and nothing else. No prose, no markdown fence.

Rules:
1. `seeds` must contain one row for every initial entity or account the requirement prose
   declares as already existing. The supplied `declared_seed_sentences` are the evidence;
   every one of them must produce at least one seed row. Give each row a stable unique id.
   When several requirements each declare their own private row (titles that differ only by
   a requirement number), keep them as separate rows. Never merge them.
2. `exact_texts` carries strings that must appear verbatim in the rendered UI as visible text
   or an accessible name: button labels, menu items, headings, section names, messages,
   filter and label names. Every string in `quoted_literals` belongs to the requirement it
   came from unless it is plainly a field value of a seed row you already listed.
3. `entities` must cover every field any requirement reads or writes, including state flags
   implied by verbs such as pin, archive, delete, or color. Give each a default.
4. `navigation` lists how to reach each screen by clicking, starting at the entry URL. Routing
   is unobservable to the evaluator; every screen must be reachable from the entry page.
5. `api` fixes the shared HTTP shapes so batches do not invent conflicting endpoints.
6. `conventions` records cross-batch decisions: identifier shape, ordering, timestamps, how a
   list renders an item, which control carries which accessible name.
7. Do not invent product features the requirements do not state. Do not paraphrase quoted
   strings. Copy them exactly, including capitalisation and punctuation.

Return the object with exactly these top-level keys, in exactly this shape:
""" + json.dumps(SCHEMA_HINT, indent=1)

TOP_LEVEL = ("version", "app", "entities", "seeds", "exact_texts",
             "navigation", "persistence", "api", "conventions")


def _text_of(node) -> str:
    parts = [str(node.get("name") or ""), str(node.get("description") or "")]
    for scenario in node.get("scenarios") or []:
        parts.append(str(scenario.get("name") or ""))
        for step in scenario.get("steps") or []:
            parts.append(str(step.get("content") or ""))
    return " ".join(part for part in parts if part)


def walk_nodes(document):
    """Yield every node of the requirement tree, containers included."""
    stack = [document]
    while stack:
        node = stack.pop(0)
        if not isinstance(node, dict):
            continue
        yield node
        stack = list(node.get("children") or []) + stack


def quoted_literals(document):
    """Recover every quoted literal, keyed by the requirement that states it.

    Deterministic. The model organizes these; :func:`reconcile` guarantees none is
    lost, so a dropped literal cannot silently become a missing button label.
    """
    found = []
    seen = set()
    for node in walk_nodes(document):
        key = str(node.get("id") or "")
        for match in QUOTED.finditer(_text_of(node)):
            text = (match.group(1) or match.group(2) or "").strip()
            if not text or text.startswith("./") or text.startswith("http"):
                continue
            if (key, text) in seen:
                continue
            seen.add((key, text))
            found.append({"requirement": key, "text": text})
    return found


def seed_sentences(document):
    """Recover the sentences that declare pre-existing state, with their source id."""
    sentences = []
    seen = set()
    for node in walk_nodes(document):
        key = str(node.get("id") or "")
        description = str(node.get("description") or "")
        # Strip image references so a sentence split does not break on a filename.
        description = re.sub(r'!\[[^\]]*\]\([^)]*\)', ' ', description)
        for sentence in SENTENCE.split(description):
            sentence = " ".join(sentence.split())
            # Stripping an image reference leaves its caption behind ("Dropdown image:").
            sentence = re.sub(r'^[A-Za-z ]{0,40}\bimages?( for [A-Za-z ]{1,30})?:\s*', '', sentence)
            if not sentence:
                continue
            lowered = sentence.lower()
            if not any(marker in lowered for marker in SEED_MARKERS):
                continue
            if not QUOTED.search(sentence):
                continue
            if sentence in seen:
                continue
            seen.add(sentence)
            sentences.append({"requirement": key, "sentence": sentence})
    return sentences


def evidence(requirements):
    """The deterministic input to the single contract call."""
    document = requirements.document
    return {
        "application": {key: value for key, value in document.items() if key != "children"},
        "requirement_outline": [
            {"id": node["id"], "name": node.get("name", ""),
             "dependencies": node.get("dependencies", []), "parents": node["parents"]}
            for node in requirements.nodes],
        "declared_seed_sentences": seed_sentences(document),
        "quoted_literals": quoted_literals(document),
    }


def _as_json_object(text):
    """Read one JSON object out of a completion that may carry a fence or prose."""
    if not isinstance(text, str) or not text.strip():
        raise ValueError("Contract extraction returned no content")
    stripped = text.strip()
    fence = re.match(r'^```(?:json)?\s*(.*?)\s*```$', stripped, re.DOTALL)
    if fence:
        stripped = fence.group(1).strip()
    try:
        value = json.loads(stripped)
    except ValueError:
        start, end = stripped.find("{"), stripped.rfind("}")
        if start < 0 or end <= start:
            raise ValueError("Contract extraction returned no JSON object")
        value = json.loads(stripped[start:end + 1])
    if not isinstance(value, dict):
        raise ValueError("Contract must be a JSON object")
    return value


# Carries a mapping key alongside an entry's own fields without colliding with them.
KEY = "__contract_key__"
SEED_META = (KEY, "id", "type", "entity", "kind", "collection", "declared_by", "declaredBy",
             "requirement", "mutated_by", "mutatedBy", "data", "fields", "values")


def _listify(value):
    """Accept a list, a single item, or a mapping, and return a list of entries."""
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, dict):
        entries = []
        for key, item in value.items():
            if isinstance(item, dict):
                # The mapping key is the entry's identity. A "name" key inside the value
                # is one of its fields, so carry the identity separately rather than
                # letting either overwrite the other.
                entries.append({KEY: key, **item})
            elif isinstance(item, list):
                entries.append({KEY: key, "items": item})
            else:
                entries.append({KEY: key, "value": item})
        return entries
    return [value]


def pluralize(name):
    """A store key readable enough that a model keeps using the same one."""
    lowered = name.lower()
    if lowered.endswith("s") and not lowered.endswith("ss"):
        return name
    if lowered.endswith("y") and not lowered.endswith(("ay", "ey", "iy", "oy", "uy")):
        return name[:-1] + "ies"
    if lowered.endswith(("s", "x", "z", "ch", "sh")):
        return name + "es"
    return name + "s"


def _entities(value):
    """Normalize entities written as a list, or as {name: {field: type}}."""
    result = []
    for entry in _listify(value):
        if not isinstance(entry, dict):
            continue
        name = str(entry.get(KEY) or entry.get("name") or entry.get("entity") or "").strip()
        raw = entry.get("fields", {key: item for key, item in entry.items()
                                   if key not in (KEY, "entity", "collection", "fields", "notes")
                                   and not (key == "name" and not entry.get(KEY))})
        fields = []
        for field in _listify(raw):
            if not isinstance(field, dict):
                continue
            field_name = str(field.get(KEY) or field.get("name") or "").strip()
            if not field_name:
                continue
            kind = field.get("type")
            if not isinstance(kind, str):
                kind = str(field.get("value") or "string")
            fields.append({"name": field_name, "type": kind,
                           "default": field.get("default")})
        if not name:
            continue
        collection = str(entry.get("collection") or "").strip()
        if not collection:
            collection = pluralize(name)
        result.append({"name": name, "collection": collection, "fields": fields})
    return result


def _seed_collection(entry, entities):
    """Pick the store key for a seed row, preferring an entity the contract declares."""
    explicit = str(entry.get("collection") or "").strip()
    if explicit:
        return explicit
    kind = str(entry.get("type") or entry.get("entity") or entry.get("kind") or "").strip()
    for entity in entities:
        if kind and kind.lower() in (entity["name"].lower(), entity["collection"].lower()):
            return entity["collection"]
    if kind:
        return pluralize(kind)
    return entities[0]["collection"] if entities else "records"


def normalize(value):
    """Coerce a model-returned object into the contract shape, dropping nothing.

    The extraction runs against whatever package the competition hands us, and a
    model that is right about the content is routinely wrong about the container:
    entities arrive as a mapping, seed fields arrive inline instead of under `data`.
    Reshaping here costs nothing; a second call to correct the shape costs a call.
    """
    contract = {key: value.get(key) for key in TOP_LEVEL}
    contract["version"] = 1
    app = contract["app"]
    if isinstance(app, str):
        app = {"name": app}
    contract["app"] = app if isinstance(app, dict) else {}
    contract["app"].setdefault("entry", "/")
    contract["entities"] = _entities(contract["entities"])
    for key in ("persistence", "conventions"):
        items = _listify(contract[key])
        contract[key] = [item if isinstance(item, str) else json.dumps(item, ensure_ascii=False)
                         for item in items]
    contract["navigation"] = [item for item in _listify(contract["navigation"]) if isinstance(item, dict)]
    contract["api"] = [item for item in _listify(contract["api"]) if isinstance(item, dict)]

    seeds, ids = [], set()
    for index, seed in enumerate(_listify(contract["seeds"])):
        if not isinstance(seed, dict):
            continue
        data = seed.get("data") if isinstance(seed.get("data"), dict) else None
        if data is None and isinstance(seed.get("fields"), dict):
            data = seed["fields"]
        if data is None:
            data = {key: item for key, item in seed.items() if key not in SEED_META}
        if not data:
            continue
        key = str(seed.get("id") or "").strip() or f"seed-{index + 1}"
        key = re.sub(r'[^a-zA-Z0-9._-]+', '-', key).strip('-') or f"seed-{index + 1}"
        while key in ids:
            key = f"{key}-{index + 1}"
        ids.add(key)
        mutated = seed.get("mutated_by") or seed.get("mutatedBy") or []
        seeds.append({"id": key,
                      "collection": _seed_collection(seed, contract["entities"]),
                      "declared_by": str(seed.get("declared_by") or seed.get("declaredBy")
                                         or seed.get("requirement") or ""),
                      "data": {name: item for name, item in data.items() if name != "id"},
                      "mutated_by": [str(item) for item in _listify(mutated)
                                     if isinstance(item, (str, int))]})
    contract["seeds"] = seeds

    texts = []
    for entry in _listify(contract["exact_texts"]):
        if not isinstance(entry, dict):
            continue
        values = entry.get("texts", entry.get("items", entry.get("value")))
        values = [values] if isinstance(values, str) else values
        if not isinstance(values, list):
            continue
        texts.append({"requirement": str(entry.get("requirement") or entry.get("name") or ""),
                      "texts": [str(item) for item in values if isinstance(item, (str, int))]})
    contract["exact_texts"] = texts
    return contract


def reconcile(contract, facts):
    """Reattach every deterministic literal and seed sentence the model dropped.

    Returns the contract plus an audit block. Acceptance criterion 1 is that no
    named identity can be lost between the requirement prose and the contract; this
    function is what makes that mechanical rather than a hope about the model.
    """
    blob = json.dumps(contract, ensure_ascii=False)
    by_requirement = {entry["requirement"]: entry for entry in contract["exact_texts"]}
    recovered = []
    for literal in facts["quoted_literals"]:
        if literal["text"] in blob:
            continue
        entry = by_requirement.get(literal["requirement"])
        if entry is None:
            entry = {"requirement": literal["requirement"], "texts": []}
            by_requirement[literal["requirement"]] = entry
            contract["exact_texts"].append(entry)
        entry["texts"].append(literal["text"])
        recovered.append(literal)

    seed_blob = json.dumps(contract["seeds"], ensure_ascii=False)
    unresolved = []
    for item in facts["declared_seed_sentences"]:
        quotes = [(match.group(1) or match.group(2) or "").strip()
                  for match in QUOTED.finditer(item["sentence"])]
        quotes = [quote for quote in quotes if quote]
        if quotes and any(quote in seed_blob for quote in quotes):
            continue
        unresolved.append(item)
    contract["unresolved_seed_sentences"] = unresolved
    contract["audit"] = {
        "quoted_literals_declared": len(facts["quoted_literals"]),
        "quoted_literals_recovered_mechanically": len(recovered),
        "seed_sentences_declared": len(facts["declared_seed_sentences"]),
        "seed_sentences_unresolved": len(unresolved),
        "seed_rows": len(contract["seeds"]),
        "entities": len(contract["entities"]),
    }
    return contract


def extract(requirements, model, trace=None):
    """One model call over the complete requirement package. Returns the contract."""
    facts = evidence(requirements)
    request = json.dumps({"requirements": requirements.document, **facts},
                         ensure_ascii=False, separators=(",", ":"))
    before = model.usage.total_tokens, model.usage.calls
    previous = model.thinking
    model.thinking = "disabled"
    try:
        message, reason = model.complete(
            [{"role": "system", "content": INSTRUCTION},
             {"role": "user", "content": request}], tools=[])
    finally:
        model.thinking = previous
    if reason == "length":
        raise ValueError("Contract extraction exceeded the output limit")
    contract = reconcile(normalize(_as_json_object(message.get("content"))), facts)
    contract["cost"] = {"calls": model.usage.calls - before[1],
                        "tokens": model.usage.total_tokens - before[0]}
    if trace is not None:
        trace.event("state_contract_extracted", **contract["audit"], **contract["cost"])
    return contract


DOCUMENT_HEADER = """GLOBAL STATE CONTRACT — authoritative for every batch of this application.

This document was derived once from the complete requirement package. Every batch receives
it unchanged. It is the single source of truth for shared state: entity fields, seeded rows,
exact visible copy, how each screen is reached by clicking, persistence and HTTP shapes.
Implement against it exactly. Do not rename a field, an endpoint, a route or a visible string
that another batch will also use. Do not re-seed rows the startup seeder already creates; read
them from the shared store. If your requirements need a field the contract does not list, add
the field without changing any listed name.

`exact_texts` are rendered verbatim as visible text or accessible names. `seeds` already exist
at startup: the harness writes the seeder, and your code must read and mutate those rows through
the shared store rather than creating its own copies."""


def document(contract) -> str:
    """The verbatim text handed to every batch."""
    body = {key: contract[key] for key in TOP_LEVEL if key in contract}
    if contract.get("unresolved_seed_sentences"):
        body["unresolved_seed_sentences"] = contract["unresolved_seed_sentences"]
    return DOCUMENT_HEADER + "\n\n" + json.dumps(body, ensure_ascii=False, indent=1)


def save(contract, directory: Path) -> Path:
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / "state-contract.json"
    path.write_text(json.dumps(contract, ensure_ascii=False, indent=2) + "\n")
    return path


def load(path: Path):
    return json.loads(Path(path).read_text())


def collections(contract):
    """Store keys the contract declares, seeds first so a batch cannot invent a name."""
    names = []
    for seed in contract.get("seeds", []):
        if seed["collection"] not in names:
            names.append(seed["collection"])
    for entity in contract.get("entities", []):
        if isinstance(entity, dict):
            name = str(entity.get("collection") or entity.get("name") or "").strip()
            if name and name not in names:
                names.append(name)
    return names


def requirement_state(contract):
    """Map each requirement id to the collections its contract entries touch.

    Used to batch by shared business state instead of by document order.
    """
    touches = {}
    for seed in contract.get("seeds", []):
        key = seed.get("declared_by") or ""
        if key:
            touches.setdefault(key, set()).add(seed["collection"])
        for key in seed.get("mutated_by", []):
            touches.setdefault(key, set()).add(seed["collection"])
    return {key: sorted(value) for key, value in touches.items()}


def state_batches(requirements, contract, *, max_nodes=6, max_chars=24000):
    """Group requirements that share business state, keeping dependency order.

    The schedule stays a topological order of the requirement graph. Within it, a
    node joins the open batch unless it would put *disjoint* shared state in the
    same batch: two requirements that mutate different collections are the pair most
    likely to invent conflicting shapes for them, so they are separated. A node that
    touches no shared state conflicts with nothing and simply fills space.

    A top-level folder boundary also closes a batch once it is at least half full,
    which keeps a screen and the behaviour on it in one conversation without
    producing a batch per requirement.
    """
    touches = requirement_state(contract)
    batches, current, size, keys = [], [], 0, set()
    current_group = None
    for node in requirements.nodes:
        node_keys = set(touches.get(node["id"], ()))
        group = node["parents"][1] if len(node["parents"]) > 1 else node["id"]
        length = len(json.dumps(node, ensure_ascii=False))
        disjoint = bool(node_keys) and bool(keys) and not (node_keys & keys)
        full = len(current) >= max_nodes or size + length > max_chars
        boundary = group != current_group and len(current) >= max(2, max_nodes // 2)
        if current and (full or disjoint or boundary):
            batches.append(current)
            current, size, keys, current_group = [], 0, set(), None
        current.append(node)
        size += length
        keys |= node_keys
        if current_group is None:
            current_group = group
    if current:
        batches.append(current)
    return batches
