"""Startup seeding, a shared store and health gating for a contract-driven app.

The generated application receives one harness-written module, `backend/state.cjs`,
carrying three things the requirement prose assumes but never asks for explicitly:

* the rows declared in requirement descriptions, applied once at startup,
* a small persistent store the product code mutates,
* a readiness promise so `/api/health` cannot answer before seeding commits.

The seeder is written by the harness from the extracted contract, not by the model,
so a batch cannot invent its own copy of a shared row. Product behaviour, UI and
API routing stay generated.

Nothing here is specific to any corpus application: the collections, fields and rows
all come from the contract extracted from the requirements in hand.
"""
from __future__ import annotations

import json

from .web_runtime import SERVER

DATA_DIRECTORY = "backend/data"

STATE = r"""'use strict';
// Harness-managed shared state: startup seeding, persistence and readiness.
// Product code reads and mutates rows through `store`; it must not re-create seeded rows.
const fs = require('node:fs');
const path = require('node:path');
// Product code requires this module at load time. A broken seeder must therefore
// surface as a 503 from /api/health, not as a process that never binds its port.
let seed = {rows: [], collections: []};
let seedError = null;
try { seed = require('./seed.cjs'); } catch (error) { seedError = error; }
const directory = process.env.APP_DATA_DIR || path.join(__dirname, 'data');
const file = path.join(directory, 'store.json');
let db = {version: 1, applied: [], collections: {}};

function persist() {
  fs.mkdirSync(directory, {recursive: true});
  const temporary = file + '.tmp';
  fs.writeFileSync(temporary, JSON.stringify(db));
  fs.renameSync(temporary, file);
}

function load() {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (parsed && typeof parsed === 'object' && parsed.collections) {
      db = {version: 1, applied: Array.isArray(parsed.applied) ? parsed.applied : [],
            collections: parsed.collections};
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

function rows(name) {
  if (!Array.isArray(db.collections[name])) db.collections[name] = [];
  return db.collections[name];
}

function copy(value) {
  return value === undefined || value === null ? value : JSON.parse(JSON.stringify(value));
}

let counter = 0;
function nextId(name) {
  counter += 1;
  return name + '-' + Date.now().toString(36) + '-' + counter.toString(36);
}

const store = {
  collections() { return Object.keys(db.collections); },
  list(name, predicate) {
    const all = rows(name).map(copy);
    return typeof predicate === 'function' ? all.filter(predicate) : all;
  },
  get(name, id) {
    const found = rows(name).find(item => String(item.id) === String(id));
    return found ? copy(found) : null;
  },
  find(name, predicate) {
    const found = rows(name).find(predicate);
    return found ? copy(found) : null;
  },
  insert(name, data) {
    const record = Object.assign({}, copy(data));
    if (record.id === undefined || record.id === null || record.id === '') record.id = nextId(name);
    record.id = String(record.id);
    rows(name).push(record);
    persist();
    return copy(record);
  },
  update(name, id, patch) {
    const list = rows(name);
    const index = list.findIndex(item => String(item.id) === String(id));
    if (index < 0) return null;
    list[index] = Object.assign({}, list[index], copy(patch), {id: list[index].id});
    persist();
    return copy(list[index]);
  },
  remove(name, id) {
    const list = rows(name);
    const index = list.findIndex(item => String(item.id) === String(id));
    if (index < 0) return false;
    list.splice(index, 1);
    persist();
    return true;
  },
  replace(name, values) {
    db.collections[name] = (Array.isArray(values) ? values : []).map(copy);
    persist();
    return store.list(name);
  },
};

// Idempotent: a seed row is applied at most once for the lifetime of the data file,
// so restarting the server never duplicates a row and never resurrects one the user
// deleted. Rows a requirement says are mutable stay owned by the application.
function applySeed() {
  const applied = new Set(db.applied);
  let added = 0;
  for (const row of seed.rows) {
    if (applied.has(row.id)) continue;
    const list = rows(row.collection);
    if (!list.some(item => String(item.id) === String(row.id))) {
      list.push(Object.assign({}, copy(row.data), {id: row.id}));
      added += 1;
    }
    applied.add(row.id);
  }
  db.applied = Array.from(applied);
  persist();
  return added;
}

const ready = (async () => {
  if (seedError) throw seedError;
  load();
  for (const name of seed.collections) rows(name);
  const added = applySeed();
  return {seeded: added, collections: seed.collections};
})();
ready.catch(() => {});

module.exports = {ready, store, seed, dataFile: file};
"""



def seed_module(contract) -> str:
    """Write `backend/seed.cjs` from the contract. Deterministic, no model call."""
    from .contract import collections as contract_collections

    rows = []
    for seed in contract.get("seeds", []):
        data = {key: value for key, value in seed["data"].items() if key != "id"}
        rows.append({"id": seed["id"], "collection": seed["collection"],
                     "declaredBy": seed.get("declared_by", ""), "data": data})
    names = contract_collections(contract)
    payload = {"rows": rows, "collections": names}
    return ("'use strict';\n"
            "// Generated from the global state contract. Startup rows declared in the\n"
            "// requirement prose; edit the requirements, not this file.\n"
            "module.exports = " + json.dumps(payload, ensure_ascii=False, indent=1) + ";\n")


def contract_files(contract):
    """The three harness-owned files a contract-driven application starts from."""
    return [
        {"path": "backend/seed.cjs", "content": seed_module(contract)},
        {"path": "backend/state.cjs", "content": STATE},
        {"path": "backend/server.cjs", "content": SERVER},
    ]


def install(workspace, contract):
    workspace.write_files(contract_files(contract))
    ignore = workspace.root / ".gitignore"
    existing = ignore.read_text() if ignore.exists() else ""
    if DATA_DIRECTORY + "/" not in existing.splitlines():
        ignore.write_text(existing.rstrip() + "\n" + DATA_DIRECTORY + "/\n")


STORE_CONTRACT = """The harness has already written three backend files. Do not rewrite them:
  backend/seed.cjs   the rows the requirements declare as already existing at startup
  backend/state.cjs  the shared persistent store and the startup readiness promise
  backend/server.cjs the static server, SPA fallback and /api/health gate

In backend/api.cjs use the shared store instead of your own storage:
  const {store} = require('./state.cjs');
  store.list(name[, predicate]) -> array of records      store.get(name, id) -> record or null
  store.find(name, predicate)   -> record or null        store.insert(name, data) -> record with id
  store.update(name, id, patch) -> record or null        store.remove(name, id) -> boolean
  store.replace(name, array)    -> the new array
Every mutation is written to disk immediately, so a value survives a reload and a restart.
Collection names come from the contract. Never seed rows yourself and never keep product
state in a module-level variable, a global, or browser storage: the evaluator reloads the
page and expects the server to remember. /api/health is already served; do not redefine it."""


HARNESS_OWNED = ("backend/seed.cjs", "backend/state.cjs", "backend/server.cjs",
                 "frontend/build.cjs", "frontend/package.json", "backend/package.json")

CHECKED_SOURCE = (".js", ".cjs", ".mjs")


def syntax_findings(workspace, written):
    """Parse each JavaScript file this batch just wrote, and report the first error.

    Run 'keep i1' spent nine of its twenty-one calls running ad-hoc `node -e` scripts
    to locate a syntax error in a file it had written itself. The parser already knows
    the line; handing it back with the write costs one subprocess and no model call.
    """
    findings = []
    for name in written:
        if not name.endswith(CHECKED_SOURCE):
            continue
        try:
            path = workspace.path(name)
        except ValueError:
            continue
        if not path.is_file():
            continue
        result = workspace.run(["node", "--check", name], ".", 20)
        if result.get("exit_code"):
            findings.append({"file": name,
                             "error": str(result.get("output", ""))[-800:]})
    return findings


def coerce_file_batch(args):
    """Accept the single-file shape a model reaches for, instead of spending a call.

    Run 'keep i2' lost a call to write_files({path, content}) rather than
    write_files({files: [{path, content}]}). The intent is unambiguous, so execute it.
    """
    if isinstance(args, dict) and "files" not in args and {"path", "content"} <= set(args):
        return {"files": [{"path": args["path"], "content": args["content"]}]}
    if isinstance(args, dict) and isinstance(args.get("files"), dict):
        return {**args, "files": [args["files"]]}
    return args
