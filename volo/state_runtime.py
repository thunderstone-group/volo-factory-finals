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

from .web_runtime import OVERLAY_PATH, OVERLAY_URL, SERVER

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
  // Used by the harness-owned interface check, which reaches an application's states by
  // clicking its own controls and must put every row back where it found it.
  snapshot() { return copy(db); },
  restore(value) {
    if (!value || typeof value !== 'object' || !value.collections) return false;
    db = {version: 1, applied: Array.isArray(value.applied) ? value.applied : [],
          collections: copy(value.collections)};
    persist();
    return true;
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


INTERFACE_CHECK_PATH = "checks/interface.spec.cjs"

# Written by the harness, from the contract, never by the model. It encodes what the
# 2026-09-14 Keep rehearsal measured, not what its rules assumed:
#
#   * six of the eight attributable official failures picked the wrong row while the
#     page had zero duplicate accessible names, because the published helpers search a
#     bare verb as a substring and take .first(). Nineteen buttons named
#     "Archive for <title>" are nineteen matches for /archive/i,
#   * every one of those failures happened in a state the old check never visited: it
#     loaded the entry page once and never interacted,
#   * one failure typed a title, clicked a pin toggle in the same composer and saved an
#     empty row, because the re-render emitted the inputs without their values.
#
# So the rules are: one visible control per action verb, in every state one interaction
# away; a chooser makes the page behind it inert; typing survives a click that writes
# nothing. Namelessness still fails. A name that matches no requirement text is reported
# and not failed: it is a soft signal, and failing a run on it would buy exactly the
# repair loop this branch spent CNY 13 learning to avoid.
INTERFACE_CHECK = r"""const {test, assert} = require('./browser.cjs');
const vocabulary = require('./vocabulary.cjs');

const ACTION_ROLES = ['button', 'link', 'menuitem', 'tab', 'option', 'checkbox', 'radio'];
const NAMED_ROLES = ['textbox', 'searchbox', 'combobox', 'spinbutton', 'checkbox', 'radio',
                     'meter', 'progressbar', 'slider'];
const TEXT_ROLES = ['textbox', 'searchbox', 'spinbutton'];
const CHOOSER_ROLES = ['dialog', 'listbox', 'menu', 'group'];
// The bare patterns arc-bench's helpers hand to clickFirstAvailable, grouped the way the
// helpers group them (helpers.ts:255-300): one action, several spellings, and the group is
// satisfied when any one of them resolves inside the container.
const VERB_GROUPS = [{action: 'menu', patterns: ['more', 'options', 'menu']},
                     {action: 'labels', patterns: ['labels']},
                     {action: 'color', patterns: ['color', 'colour']},
                     {action: 'pin', patterns: ['pin']},
                     {action: 'archive', patterns: ['archive']},
                     {action: 'delete', patterns: ['delete']}];
// Only the actions the contract's own words declare. A fixed list of eight verbs reported
// every row of every application, whether or not a requirement asked for that action on
// that entity, and a gate that demands work no requirement asked for is a gate that gets
// wrong behaviour built into the product. `vocabulary.actions` is written from the
// requirement text the contract preserved; an application that predates it is checked
// with the whole list, exactly as before.
const DECLARED = new Set(Array.isArray(vocabulary.actions) ? vocabulary.actions
                                                           : VERB_GROUPS.map(group => group.action));
const ROW_GROUPS = VERB_GROUPS.filter(group => DECLARED.has(group.action));
// The composer's own subset: the published helpers open a row menu, archive and delete
// from a row, and only choose a colour, pin, and set labels while creating.
const COMPOSER_GROUPS = ROW_GROUPS.filter(group => group.action !== 'archive'
                                                   && group.action !== 'delete');

const CLICK_BUDGET = 60;      // distinct controls clicked from the entry page
const HOVER_BUDGET = 12;      // seeded row titles hovered
const FORM_BUDGET = 6;        // distinct input groups probed for durability
const BUTTONS_PER_FORM = 6;
const OVERLAY_BUDGET = 4;     // distinct dialog-opening controls whose lifecycle is driven
const OVERLAY_WALL = 13000;   // ms for the whole overlay phase
const WALL_BUDGET = 36000;    // ms for the whole walk, whatever the application's size

function normalize(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

// The row titles the contract seeds. A row-scoped name such as "Archive for Sprint goals"
// is allowed wherever a row's actions are always visible, and the title is exactly the part
// of such a name the evaluator never searches for, so it is stripped before two names are
// compared.
const TITLE_PATTERNS = (vocabulary.titles || [])
  .map(title => normalize(title))
  .filter(title => title.length >= 3)
  .sort((left, right) => right.length - left.length)
  .map(title => {
    const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp((/^[A-Za-z0-9]/.test(title) ? '\\b' : '') + escaped
                      + (/[A-Za-z0-9]$/.test(title) ? '\\b' : ''), 'gi');
  });

// What the published helpers actually search for: the verb, not the whole name.
// "Archive for Sprint goals", "Archive for Groceries" and "Archive" all collapse to
// "archive", which is what `clickFirstAvailable(/archive/i)` resolves and then `.first()`s.
function collapse(name) {
  let value = normalize(name);
  value = value.replace(/\s+for\s+[\s\S]+$/i, ' ');
  value = value.replace(/^[^:]{1,80}:\s+/, ' ');
  for (const pattern of TITLE_PATTERNS) value = value.replace(pattern, ' ');
  return normalize(value).replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

// The bucket a helper's bare pattern would resolve to. Case-insensitively, as the
// helpers match; collapse() keeps the application's own spelling for the report.
function verbOf(name) {
  return collapse(name).toLowerCase();
}

function snapshotPage(config) {
  const {actionRoles, namedRoles, textRoles, chooserRoles} = config;

  function roleOf(element) {
    const explicit = (element.getAttribute('role') || '').trim().toLowerCase().split(/\s+/)[0];
    if (explicit) return explicit;
    const tag = element.tagName.toLowerCase();
    if (tag === 'button' || tag === 'summary') return 'button';
    if (tag === 'a') return element.hasAttribute('href') ? 'link' : '';
    if (tag === 'meter') return 'meter';
    if (tag === 'progress') return 'progressbar';
    if (tag === 'textarea') return 'textbox';
    if (tag === 'option') return 'option';
    if (tag === 'dialog') return 'dialog';
    if (tag === 'select') return element.multiple || element.size > 1 ? 'listbox' : 'combobox';
    if (tag === 'input') {
      const type = (element.getAttribute('type') || 'text').toLowerCase();
      if (['button', 'submit', 'reset', 'image'].includes(type)) return 'button';
      if (type === 'checkbox') return 'checkbox';
      if (type === 'radio') return 'radio';
      if (type === 'range') return 'slider';
      if (type === 'number') return 'spinbutton';
      if (type === 'search') return 'searchbox';
      if (type === 'hidden') return '';
      return 'textbox';
    }
    return '';
  }

  function labelOf(element) {
    const labelled = element.getAttribute('aria-labelledby');
    const target = labelled ? document.getElementById(labelled.split(/\s+/)[0]) : null;
    const id = element.getAttribute('id');
    const label = id ? document.querySelector('label[for="' + CSS.escape(id) + '"]') : null;
    return element.getAttribute('aria-label')
      || (target ? target.textContent : '')
      || (label ? label.textContent : '')
      || (element.closest('label') ? element.closest('label').textContent : '')
      || element.getAttribute('title')
      || element.getAttribute('placeholder')
      || '';
  }

  function nameOf(element) {
    const tag = element.tagName.toLowerCase();
    const fromLabel = labelOf(element);
    if (fromLabel) return String(fromLabel).replace(/\s+/g, ' ').trim();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') return '';
    return String(element.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function visible(element) {
    const box = element.getBoundingClientRect();
    if (!(box.width > 0 && box.height > 0)) return false;
    const style = getComputedStyle(element);
    if (style.visibility === 'hidden' || style.display === 'none') return false;
    // getByRole resolves against the accessibility tree, so these are not addressable
    // however they are painted. opacity and transform are not on this list on purpose.
    return !element.closest('[aria-hidden="true"], [inert]');
  }

  function groupRoot(node) {
    const bad = 'main, nav, header, aside, body, [role="main"], [role="navigation"]';
    const scoped = node.closest('form, [role="form"], [role="dialog"], [role="search"], [role="group"]');
    if (scoped && !scoped.matches(bad) && !scoped.querySelector(bad)) return scoped;
    let candidate = node.parentElement;
    for (let step = 0; step < 4; step += 1) {
      if (!candidate || candidate === document.body) return null;
      if (candidate.matches(bad) || candidate.querySelector(bad)) return null;
      if (candidate.querySelector('button, [role="button"], input[type="submit"], input[type="button"]')) {
        return candidate;
      }
      candidate = candidate.parentElement;
    }
    return null;
  }

  const elements = [];
  const controls = [];
  // Present in the document and not reachable: display:none, visibility:hidden, inert or
  // aria-hidden. The overlay rule needs these, because a control an overlay hid and never
  // put back is still in the document, while one a navigation legitimately replaced is not.
  const hidden = [];
  const hiddenSeen = new Set();
  for (const element of document.querySelectorAll('*')) {
    const role = roleOf(element);
    if (!role) continue;
    if (!actionRoles.includes(role) && !namedRoles.includes(role)) continue;
    if (!visible(element)) {
      const name = nameOf(element);
      const key = role + '|' + name;
      if (name && !hiddenSeen.has(key)) {
        hiddenSeen.add(key);
        hidden.push({role, name});
      }
      continue;
    }
    elements.push(element);
    // Whether this control is a navigation item. The published helpers reach a sidebar
    // destination with an anchored pattern and a row action with an unanchored one, so
    // a row action whose name the anchored pattern also matches steals the sidebar's
    // click; naming that collision needs to know which controls are navigation.
    controls.push({role, name: nameOf(element), tag: element.tagName.toLowerCase(),
                   nav: !!element.closest('nav, [role="navigation"], aside, [role="complementary"]')});
  }

  const choosers = [];
  const chooserElements = [];
  for (const element of document.querySelectorAll('*')) {
    const role = roleOf(element);
    if (!chooserRoles.includes(role) || !visible(element)) continue;
    const inside = [];
    elements.forEach((node, index) => {
      if (node !== element && element.contains(node)) inside.push(index);
    });
    if (!inside.length) continue;
    chooserElements.push(element);
    choosers.push({role, name: String(labelOf(element) || '').replace(/\s+/g, ' ').trim(),
                   modal: element.getAttribute('aria-modal') === 'true', inside});
  }

  // The container under the mouse, for the rule that an action the requirement attaches
  // to a row must be reachable from that row. The deepest hovered element is usually the
  // row's title text, which holds no controls, so walk out to the first ancestor that
  // does and stop well short of the page's landmarks.
  const chain = document.querySelectorAll(':hover');
  let hoveredRoot = null;
  if (chain.length) {
    const bad = 'main, nav, header, aside, body, html, [role="main"], [role="navigation"]';
    let candidate = chain[chain.length - 1];
    while (candidate && !candidate.matches(bad)) {
      if (elements.some(node => candidate !== node && candidate.contains(node))) {
        hoveredRoot = candidate;
        break;
      }
      candidate = candidate.parentElement;
    }
  }
  const hovered = [];
  if (hoveredRoot) {
    elements.forEach((node, index) => {
      if (hoveredRoot.contains(node)) hovered.push(index);
    });
  }

  const groups = [];
  const roots = new Map();
  elements.forEach((node, index) => {
    if (!textRoles.includes(controls[index].role)) return;
    const root = groupRoot(node);
    if (!root) return;
    let group = roots.get(root);
    if (!group) {
      // A group that lies inside an open chooser, or that wraps one, is governed by the
      // inertness rule instead: the question there is what leaks out of the chooser, not
      // what the container fails to offer. One generated application renders its search
      // filter dialog inside the banner, so the banner's search box and the dialog's own
      // buttons would otherwise be read as one container.
      group = {inputs: [], buttons: [],
               spansChooser: chooserElements.some(chooser =>
                 chooser.contains(root) || root.contains(chooser))};
      roots.set(root, group);
      elements.forEach((other, position) => {
        if (other !== root && root.contains(other)
            && controls[position].role === 'button' && controls[position].name) {
          group.buttons.push(position);
        }
      });
      groups.push(group);
    }
    group.inputs.push(index);
  });

  return {controls, choosers, groups, hovered, hidden,
          url: location.pathname + location.search};
}

async function capture(page) {
  return page.evaluate(snapshotPage, {actionRoles: ACTION_ROLES, namedRoles: NAMED_ROLES,
                                      textRoles: TEXT_ROLES, chooserRoles: CHOOSER_ROLES});
}

async function settle(page, budget = 400) {
  const started = Date.now();
  let previous = -1;
  while (Date.now() - started < budget) {
    let count = 0;
    try {
      count = await page.evaluate(() => document.querySelectorAll('*').length);
    } catch (error) {
      return;
    }
    if (count === previous && count > 0) return;
    previous = count;
    await page.waitForTimeout(40);
  }
}

async function reload(page, saved) {
  // Put the rows back before reloading. The walk reaches a state by clicking the
  // application's own controls, so one iteration's archive or delete would otherwise
  // decide what the next iteration sees, and a control missing from a reloaded page
  // would mean nothing.
  if (saved) await restoreStore(process.env.FACTORY_BASE_URL, saved);
  await page.goto(process.env.FACTORY_BASE_URL);
  await settle(page);
}

function locate(page, control) {
  return page.getByRole(control.role, {name: control.name, exact: true}).first();
}

async function act(page, control, action) {
  try {
    const locator = locate(page, control);
    if (!await locator.count()) return false;
    await locator[action]({timeout: 1500});
    await settle(page, 400);
    return true;
  } catch (error) {
    return false;
  }
}

// A click that does not wait for the page to settle. The overlay defect needs the second
// interaction to arrive while the first one's request is still in flight, which is exactly
// what `act` is careful to avoid everywhere else.
async function actNow(page, control) {
  try {
    const locator = locate(page, control);
    if (!await locator.count()) return false;
    await locator.click({timeout: 1500, force: true, noWaitAfter: true});
    return true;
  } catch (error) {
    return false;
  }
}

function signature(snapshot, group) {
  return JSON.stringify([group.inputs.map(index => snapshot.controls[index].name).sort(),
                         group.buttons.map(index => snapshot.controls[index].name).sort()]);
}

// One defect, reported once. The same nineteen archive buttons are visible in every
// state this check walks, and a repair prompt carrying the finding twenty-seven times
// costs tokens without telling the model anything the first copy did not.
function collector(limit) {
  const seen = new Set();
  const items = [];
  return {items, add(key, value) {
    if (seen.has(key) || items.length >= limit) return;
    seen.add(key);
    items.push(value);
  }};
}

function auditNames(state, snapshot, findings) {
  const unnamed = [...new Set(snapshot.controls
    .filter(item => NAMED_ROLES.includes(item.role) && !item.name)
    .map(item => item.role + ':' + item.tag))];
  if (unnamed.length) findings.nameless.add(unnamed.join(','), {state, unnamed});

  const buckets = new Map();
  for (const item of snapshot.controls) {
    if (!ACTION_ROLES.includes(item.role) || !item.name) continue;
    const verb = verbOf(item.name);
    if (!verb) continue;
    buckets.set(verb, [...(buckets.get(verb) || []), item.name]);
  }
  for (const [verb, names] of buckets) {
    if (names.length > 1) {
      findings.ambiguous.add(verb, {state, verb, count: names.length,
                                    examples: [...new Set(names)].slice(0, 3)});
    }
  }

  // RE. A row action named with a bare verb that a navigation item's name extends.
  // Keep run 7 lost REQ-2.5.3 and, by contagion, REQ-2.7.1 to exactly one instance:
  // the row button was named "Archive" and the sidebar link "Archived". archiveNote
  // searches an unanchored /archive/i and is happy either way, but openArchive searches
  // the anchored /^archived?$/i, which "Archive" also satisfies, and the helper's role
  // ladder puts button above link. So the click that should have opened the archive
  // list archived a second row instead, and the row it archived was another spec's
  // fixture. A name that is not an anchored prefix of any navigation item is free of it.
  const navigation = snapshot.controls.filter(item => item.nav && item.name);
  for (const item of snapshot.controls) {
    if (item.nav || !ACTION_ROLES.includes(item.role) || !item.name) continue;
    const bare = normalize(item.name);
    if (!bare) continue;
    const pattern = new RegExp('^' + bare.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                               + '(?:d|ed|s)?$', 'i');
    for (const destination of navigation) {
      if (!pattern.test(normalize(destination.name))) continue;
      findings.navCollision.add(bare.toLowerCase() + '|' + destination.name.toLowerCase(),
        {state, action: item.name, navigation: destination.name, role: item.role});
      break;
    }
  }
}

function auditInertness(state, before, after, findings) {
  const baseline = new Map();
  for (const chooser of before.choosers) {
    const key = chooser.role + '|' + chooser.name.toLowerCase();
    baseline.set(key, (baseline.get(key) || 0) + 1);
  }
  const seen = new Map();
  for (const chooser of after.choosers) {
    const key = chooser.role + '|' + chooser.name.toLowerCase();
    const index = seen.get(key) || 0;
    seen.set(key, index + 1);
    if (index < (baseline.get(key) || 0)) continue;              // was already open
    // aria-modal earns no exemption. Playwright's getByRole honours aria-hidden and
    // inert and ignores aria-modal, so a page that is modal only by declaration is
    // still fully addressable: measured with one generated Edit labels dialog open,
    // getByRole('textbox') returned the in-dialog field and the banner's search box.
    const within = new Set(chooser.inside);
    const label = chooser.role + ' "' + chooser.name + '"';
    const outside = after.controls.filter((item, position) => !within.has(position));

    const inside = chooser.inside.map(position => after.controls[position].name).filter(Boolean);
    const rivals = outside.filter(item => ACTION_ROLES.includes(item.role) && item.name.length > 1);
    const leaks = [];
    for (const name of inside) {
      const lowered = name.toLowerCase();
      for (const other of rivals) {
        const rival = other.name.toLowerCase();
        if (lowered.includes(rival) || rival.includes(lowered)) {
          leaks.push({inside: name, outside: other.name});
        }
      }
    }
    if (leaks.length) {
      findings.leaky.add(key, {state, chooser: label, count: leaks.length,
                               examples: leaks.slice(0, 4)});
    }

    // Only a dialog owns the page. An inline colour palette, a dropdown menu and a
    // listbox are opened over live content on purpose, and asking every one of them to
    // make the whole page inert is asking for behaviour no requirement wants. A name
    // that collides across the boundary is still a defect above, because its repair is
    // a rename and not an inert attribute.
    if (chooser.role !== 'dialog' && !chooser.modal) continue;

    // The evaluator's last resort for filling a field has no name at all: fillField
    // ends at getByRole('textbox').first(). Any visible text input outside an open
    // dialog is therefore a candidate for text meant for the dialog.
    const exposed = outside
      .filter(item => TEXT_ROLES.includes(item.role))
      .map(item => item.name || item.role + ':' + item.tag);
    if (exposed.length) {
      findings.exposed.add(key, {state, chooser: label, inputs: [...new Set(exposed)].slice(0, 4)});
    }
  }
}

// RB. A row title must not be answered by a control that exists only while the row is
// hovered. The published helpers reach a row by resolving its title through the same
// role ladder they use for actions, and rung 1 is button: with the row hovered, a
// button named "Color for <title>" beats the row's own title text at rung 10, and the
// first re-render hides it again. Measured on one generated application: from an
// unhovered page every action role returns 0 for the title, and while the row is
// hovered `button` returns three, the first of which is the colour button.
function auditTitles(title, resting, hovered, findings) {
  const needle = title.toLowerCase();
  const answering = snapshot => new Set(snapshot.controls
    .filter(item => ACTION_ROLES.includes(item.role) && item.name.toLowerCase().includes(needle))
    .map(item => item.name));
  const atRest = answering(resting);
  const appeared = [...answering(hovered)].filter(name => !atRest.has(name));
  if (appeared.length) {
    findings.titleControl.add(title, {title, revealed_by_hover: appeared.slice(0, 3),
                                      answering_at_rest: [...atRest].slice(0, 3)});
  }
}

// RC. Every action a requirement attaches to a row or to the composer has to be
// reachable from inside it by the bare verb the helpers search for. A verb that
// resolves only outside the container the test is working in is the defect: with no
// more/options/menu control in the composer, the ladder left it for the page banner.
// Only actions the contract declares are checked, and only where the page already
// carries that verb somewhere: an action no requirement mentions is never a finding.
function auditContainer(state, snapshot, inside, findings, groups) {
  const within = new Set(inside);
  if (!within.size) return;
  for (const group of groups) {
    const matches = snapshot.controls
      .map((item, position) => ({item, position}))
      .filter(({item}) => ACTION_ROLES.includes(item.role)
        && group.patterns.some(pattern => item.name.toLowerCase().includes(pattern)));
    if (!matches.length) continue;
    if (matches.some(({position}) => within.has(position))) continue;
    // Every row shows the same defect, so key it by the action and the kind of container
    // and keep the first row as the example.
    findings.strayVerb.add(group.action + '|' + (state.startsWith('after hovering') ? 'row' : state),
      {state, verb: group.action, patterns: group.patterns,
       resolves_to: [...new Set(matches.map(({item}) => item.name))].slice(0, 3)});
  }
}

// RD. A control that hides its rivals owns a hide and a restore, and one generated
// application applied the hide after an async fetch while restoring synchronously. A
// freshly loaded entry page must carry every control the first load carried.
function auditRecovery(target, baseline, fresh, findings) {
  const counts = new Map();
  for (const item of fresh.controls) {
    if (!item.name) continue;
    const key = item.role + '|' + item.name;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const missing = [];
  for (const item of baseline.controls) {
    if (!item.name) continue;
    const key = item.role + '|' + item.name;
    const left = counts.get(key) || 0;
    if (!left) {
      if (!missing.includes(item.name)) missing.push(item.name);
      continue;
    }
    counts.set(key, left - 1);
  }
  if (missing.length) {
    findings.lostControl.add(target.name, {after_clicking: target.name,
                                           missing: missing.slice(0, 6)});
  }
}

// RE. An overlay owns a lifecycle, and the run-5 Keep generation owned only half of one:
// its settings dialog was created after an awaited fetch and hid the controls outside it
// on that async path, while both of its restores were synchronous. An open superseded
// before its own fetch resolved left the page with every control named like the dialog's
// hidden and no dialog to close, and `clickNamed(/^settings$/i)` then blocked forever.
//
// The old recovery rule could not see it, because it reloaded the page between the click
// and the assertion and a reload repairs exactly this. So drive the lifecycle on one page:
// open and close, open and close again, supersede an open with a second one, and interrupt
// an open with the application's next control. After every one of those, with nothing left
// open, every control the entry page carried must still be reachable.
const CLOSE_EXACT = /^(close|cancel|done|dismiss|back|ok|×|x)$/i;
const CLOSE_LOOSE = /close|cancel|dismiss|done/i;

// The dialogs open now that were not open at rest. A non-modal menu or palette is not one:
// it does not own the page, and the application is free to leave it open.
function modalChoosers(snapshot, baseline) {
  const before = new Map();
  for (const chooser of (baseline ? baseline.choosers : [])) {
    if (chooser.role !== 'dialog' && !chooser.modal) continue;
    const key = chooser.role + '|' + chooser.name.toLowerCase();
    before.set(key, (before.get(key) || 0) + 1);
  }
  const open = [];
  const seen = new Map();
  for (const chooser of snapshot.choosers) {
    if (chooser.role !== 'dialog' && !chooser.modal) continue;
    const key = chooser.role + '|' + chooser.name.toLowerCase();
    const index = seen.get(key) || 0;
    seen.set(key, index + 1);
    if (index < (before.get(key) || 0)) continue;
    open.push(chooser);
  }
  return open;
}

function closersIn(snapshot, chooser) {
  const inside = chooser.inside.map(position => snapshot.controls[position])
    .filter(item => item && ACTION_ROLES.includes(item.role) && item.name);
  return [...inside.filter(item => CLOSE_EXACT.test(item.name)),
          ...inside.filter(item => !CLOSE_EXACT.test(item.name) && CLOSE_LOOSE.test(item.name))];
}

// Put the page back to nothing-open, using the controls the application itself offers.
// Whatever this cannot close, the evaluator cannot close either.
async function dismissOverlays(page, baseline, closers) {
  let snapshot = await capture(page);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const open = modalChoosers(snapshot, baseline);
    if (!open.length) return snapshot;
    let acted = false;
    const candidates = [...closers];
    for (const chooser of open) candidates.push(...closersIn(snapshot, chooser));
    for (const control of candidates) {
      if (await act(page, control, 'click')) { acted = true; break; }
    }
    if (!acted) {
      try { await page.keyboard.press('Escape'); } catch (error) { /* no focus, no Escape */ }
      await settle(page, 300);
    }
    snapshot = await capture(page);
  }
  return snapshot;
}

function auditOverlay(phase, opener, baseline, after, findings) {
  const stuck = modalChoosers(after, baseline);
  if (stuck.length) {
    findings.overlayLeak.add(opener.name + '|stuck',
      {control: opener.name, phase,
       still_open: [...new Set(stuck.map(item => item.name || item.role))].slice(0, 3)});
    return;
  }
  const reachable = new Set(after.controls.filter(item => item.name)
    .map(item => item.role + '|' + item.name));
  const unreachable = new Set(after.hidden.map(item => item.role + '|' + item.name));
  const lost = [];
  for (const item of baseline.controls) {
    if (!item.name) continue;
    const key = item.role + '|' + item.name;
    // Still in the document but no longer reachable. A control a navigation replaced
    // outright is in neither set, and is not this rule's business.
    if (reachable.has(key) || !unreachable.has(key)) continue;
    if (!lost.includes(item.name)) lost.push(item.name);
  }
  if (lost.length) {
    findings.overlayLeak.add(opener.name + '|hidden',
      {control: opener.name, phase, hidden_with_nothing_open: lost.slice(0, 6)});
  }
}

// The same overlay open twice at once. Late work that never asked whether its open was
// still the current one builds a second copy on top of the first, and the evaluator then
// resolves that overlay's own buttons to two controls and clicks the covered one.
function auditOverlayOpen(phase, opener, baseline, snapshot, findings) {
  const counts = new Map();
  for (const chooser of modalChoosers(snapshot, baseline)) {
    const key = (chooser.name || chooser.role).toLowerCase();
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const doubled = [...counts].filter(([, count]) => count > 1).map(([name]) => name);
  if (doubled.length) {
    findings.overlayLeak.add(opener.name + '|double',
      {control: opener.name, phase, opened_on_top_of_itself: doubled.slice(0, 3)});
  }
}

// The race needs the second interaction to arrive while the first one's request is
// still in flight, and on a developer machine a local request resolves between two
// Playwright clicks. So hold the application's own API responses back for the length of
// the probe rather than clicking faster: the hosted runner is slow, and the official
// failure this reproduces was latency-dependent, not click-speed-dependent.
async function withSlowApi(page, action) {
  let routed = false;
  try {
    await page.route('**/api/**', async route => {
      await new Promise(resolve => setTimeout(resolve, 500));
      try { await route.continue(); } catch (error) { /* the page went away */ }
    });
    routed = true;
  } catch (error) {
    // A runner without request interception simply probes at full speed.
  }
  try {
    await action();
  } finally {
    if (routed) {
      try { await page.unroute('**/api/**'); } catch (error) { /* already gone */ }
    }
  }
}

function otherControl(entry, opener, openers) {
  const alternative = openers.find(item => item.name !== opener.name);
  if (alternative) return alternative;
  return entry.controls.find(item => ACTION_ROLES.includes(item.role) && item.name
    && item.name !== opener.name && verbOf(item.name) !== verbOf(opener.name)) || null;
}

async function settled(page, saved) {
  await reload(page, saved);
  await page.mouse.move(0, 0);
  await settle(page, 200);
}

async function probeOverlays(page, entry, openers, findings, saved, deadline) {
  let driven = 0;
  for (const opener of openers) {
    if (Date.now() > deadline) return;
    // How this overlay opens and closes, on a page nothing else has touched.
    await settled(page, saved);
    const baseline = await capture(page);
    if (!await act(page, opener, 'click')) continue;
    const opened = await capture(page);
    const open = modalChoosers(opened, baseline);
    if (!open.length) continue;
    const closers = [];
    for (const chooser of open) closers.push(...closersIn(opened, chooser));
    let after = await dismissOverlays(page, baseline, closers);
    // Nothing is asserted about an overlay this check could not close: the finding would
    // be about the closing, and a check that cannot drive a control says nothing about it.
    if (modalChoosers(after, baseline).length) continue;
    driven += 1;
    auditOverlay('opened and closed once', opener, baseline, after, findings);

    // Again, on the same page. A restore that only half happens shows on the second
    // cycle, and a reload between the two would repair it before it could be seen.
    if (await act(page, opener, 'click')) {
      after = await dismissOverlays(page, baseline, closers);
      auditOverlay('opened and closed twice without reloading', opener, baseline, after, findings);
    }

    // Supersede the open before its own work finishes. This is the run-5 defect exactly.
    if (Date.now() > deadline) return;
    await settled(page, saved);
    await withSlowApi(page, async () => {
      await actNow(page, opener);
      await actNow(page, opener);
      // A real wait, not settle: settle returns as soon as the document stops changing,
      // which is immediately, and the held-back response has not landed yet.
      await page.waitForTimeout(1200);
      await settle(page, 400);
    });
    const superseded = 'opened twice before the first open finished';
    auditOverlayOpen(superseded, opener, baseline, await capture(page), findings);
    after = await dismissOverlays(page, baseline, closers);
    auditOverlay(superseded, opener, baseline, after, findings);

    // Interrupt the open with whatever the application offers next. Two openers are
    // enough: the interruption is by another overlay opener wherever the application has
    // one, so repeating it for every opener buys the same evidence twice.
    if (Date.now() > deadline || driven >= 2) continue;
    const other = otherControl(entry, opener, openers);
    if (!other) continue;
    await settled(page, saved);
    await withSlowApi(page, async () => {
      await actNow(page, opener);
      await actNow(page, other);
      await page.waitForTimeout(1200);
      await settle(page, 400);
    });
    const interrupted = 'interrupted by ' + JSON.stringify(other.name);
    auditOverlayOpen(interrupted, opener, baseline, await capture(page), findings);
    after = await dismissOverlays(page, baseline, closers);
    auditOverlay(interrupted, opener, baseline, after, findings);
  }
}

async function readValues(page, names) {
  return page.evaluate((wanted) => {
    const values = {};
    for (const element of document.querySelectorAll('input, textarea')) {
      const box = element.getBoundingClientRect();
      if (!(box.width > 0 && box.height > 0)) continue;
      const id = element.getAttribute('id');
      const label = id ? document.querySelector('label[for="' + CSS.escape(id) + '"]') : null;
      const name = String(element.getAttribute('aria-label') || (label ? label.textContent : '')
        || element.getAttribute('title') || element.getAttribute('placeholder') || '')
        .replace(/\s+/g, ' ').trim();
      if (wanted.includes(name) && !(name in values)) values[name] = element.value;
    }
    return values;
  }, names);
}

async function probeForm(page, probe, findings, writes, saved) {
  for (const button of probe.buttons.slice(0, BUTTONS_PER_FORM)) {
    await reload(page, saved);
    if (probe.opener && !await act(page, probe.opener, 'click')) return;
    const markers = new Map();
    let ready = true;
    for (const [index, input] of probe.inputs.entries()) {
      const marker = 'marker' + index + 'x' + Date.now().toString(36);
      try {
        await locate(page, input).fill(marker, {timeout: 1500});
      } catch (error) {
        ready = false;
        break;
      }
      markers.set(input.name, marker);
    }
    if (!ready || !markers.size) return;
    writes.length = 0;
    if (!await act(page, button, 'click')) continue;
    // A click that sends a write to the server is a submission, and a form that clears
    // itself after a successful submission is behaving correctly. Only a click that
    // changed nothing outside the page is held to the durability rule.
    if (writes.length) continue;
    const values = await readValues(page, [...markers.keys()]);
    for (const [name, marker] of markers) {
      if (!(name in values)) continue;   // the field is gone; there is nothing to judge
      if (!String(values[name]).includes(marker)) {
        findings.volatile.add(name + '|' + button.name,
                              {state: probe.state, input: name, clicked: button.name,
                               value: String(values[name]).slice(0, 40)});
      }
    }
  }
}

async function snapshotStore(base) {
  try {
    const response = await fetch(base + '/__factory/store');
    return response.ok ? await response.text() : null;
  } catch (error) {
    return null;
  }
}

async function restoreStore(base, saved) {
  if (!saved) return;
  try {
    await fetch(base + '/__factory/store',
                {method: 'PUT', headers: {'content-type': 'application/json'}, body: saved});
  } catch (error) {
    // The walk mutated rows and the store could not be put back. Say so rather than
    // leaving a later check to fail on data this check moved.
    console.log('[interface] could not restore the store after the state walk');
  }
}

test('every state one interaction away is nameable and unambiguous', async (page, assert) => {
  const base = process.env.FACTORY_BASE_URL;
  const started = Date.now();
  const findings = {nameless: collector(6), ambiguous: collector(8), leaky: collector(6),
                    exposed: collector(4), titleControl: collector(4), strayVerb: collector(8),
                    navCollision: collector(4), lostControl: collector(4),
                    overlayLeak: collector(4), volatile: collector(6)};
  const writes = [];
  page.on('request', request => {
    const method = request.method().toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') writes.push(method + ' ' + request.url());
  });
  const saved = await snapshotStore(base);
  const probes = [];
  const known = new Set();
  const openers = [];
  let entry = null;
  let visited = 0;

  function collect(state, opener, snapshot) {
    for (const group of snapshot.groups) {
      if (probes.length >= FORM_BUDGET) return;
      const key = signature(snapshot, group);
      if (known.has(key) || !group.inputs.length || !group.buttons.length) continue;
      known.add(key);
      probes.push({state, opener, signature: key,
                   inputs: group.inputs.map(index => snapshot.controls[index]),
                   buttons: group.buttons.map(index => snapshot.controls[index])});
    }
  }

  try {
    await settle(page);
    entry = await capture(page);
    visited += 1;
    auditNames('the entry page', entry, findings);
    collect('the entry page', null, entry);

    // One click apiece, deduplicated by the verb the helpers search for: clicking all
    // nineteen archive buttons reaches one state, clicking nineteen different verbs
    // reaches nineteen. The entry page's own list decides the targets, so a click that
    // changes the page never compounds with the next one.
    const targets = [];
    const verbs = new Set();
    for (const control of entry.controls) {
      if (!control.name || targets.length >= CLICK_BUDGET) continue;
      const verb = control.role + '|' + verbOf(control.name);
      if (verbs.has(verb)) continue;
      verbs.add(verb);
      targets.push(control);
    }
    let clicked = null;
    for (const target of targets) {
      if (Date.now() - started > WALL_BUDGET) break;
      await reload(page, saved);
      // The page the previous click left behind, reloaded from the seeded rows. Only a
      // defect can keep a control off it, so this costs one snapshot and no navigation.
      if (clicked && saved) auditRecovery(clicked, entry, await capture(page), findings);
      if (!await act(page, target, 'click')) continue;
      clicked = target;
      const state = 'after clicking ' + JSON.stringify(target.name);
      const after = await capture(page);
      visited += 1;
      auditNames(state, after, findings);
      auditInertness(state, entry, after, findings);
      // A control that opens a dialog owns an overlay lifecycle, which the walk drives
      // on one page once the cheap audits are done.
      if (openers.length < OVERLAY_BUDGET && modalChoosers(after, entry).length) {
        openers.push(target);
      }
      collect(state, target, after);
    }
    if (clicked && saved) {
      await reload(page, saved);
      auditRecovery(clicked, entry, await capture(page), findings);
    }

    // Hovering a row is the other permitted shape, and the one the published helpers
    // drive: hoverNamed(title) then clickFirstAvailable(/archive/i).
    await reload(page, saved);
    await page.mouse.move(0, 0);
    await settle(page, 200);
    const resting = await capture(page);
    const titles = (vocabulary.titles || []).slice(0, HOVER_BUDGET);
    let hovered = 0;
    for (const title of titles) {
      if (Date.now() - started > WALL_BUDGET) break;
      const locator = page.getByText(title, {exact: false}).first();
      try {
        if (!await locator.count()) continue;
        await locator.hover({timeout: 1500});
      } catch (error) {
        continue;
      }
      await settle(page, 300);
      hovered += 1;
      const state = 'after hovering ' + JSON.stringify(title);
      const after = await capture(page);
      visited += 1;
      auditNames(state, after, findings);
      auditContainer(state, after, after.hovered, findings, ROW_GROUPS);
      auditTitles(title, resting, after, findings);
    }

    if (openers.length && Date.now() - started < WALL_BUDGET) {
      await probeOverlays(page, entry, openers, findings, saved,
                          Math.min(started + WALL_BUDGET, Date.now() + OVERLAY_WALL));
    }

    for (const probe of probes) {
      if (Date.now() - started > WALL_BUDGET) break;
      await reload(page, saved);
      if (!probe.opener || await act(page, probe.opener, 'click')) {
        const opened = await capture(page);
        const group = opened.groups.find(item => signature(opened, item) === probe.signature);
        if (group && !group.spansChooser) {
          auditContainer(probe.state, opened, [...group.inputs, ...group.buttons], findings,
                         COMPOSER_GROUPS);
        }
      }
      await probeForm(page, probe, findings, writes, saved);
    }
  } finally {
    await restoreStore(base, saved);
  }

  console.log('[interface] ' + visited + ' states inspected, ' + probes.length
    + ' input groups probed, ' + openers.length + ' overlays driven, '
    + Math.round(Date.now() - started) + ' ms');

  // Vocabulary. Reported, never failed: a name outside the requirement's own words is a
  // smell, not a defect, and this check must not start a repair loop over a smell.
  if (vocabulary.terms.length && entry) {
    const outside = [...new Set(entry.controls.map(item => item.name).filter(Boolean)
      .map(collapse).filter(Boolean))].filter(name => !vocabulary.matches(name));
    if (outside.length) {
      console.log('[interface] names matching no requirement text (reported, not failed): '
        + JSON.stringify(outside.slice(0, 20))
        + (outside.length > 20 ? ' and ' + (outside.length - 20) + ' more' : ''));
    }
  }

  assert.deepEqual(findings.nameless.items, [],
    'Visible controls have no accessible name. Give each one an aria-label, a <label for>, or a '
    + 'placeholder, using the wording the requirements use. Unnamed: '
    + JSON.stringify(findings.nameless.items));

  assert.deepEqual(findings.ambiguous.items, [],
    'Two or more controls carrying the same action verb are visible at the same moment. The '
    + 'evaluator resolves an action by its verb alone, as a case-insensitive substring, and takes '
    + 'the first match in DOM order, so the row it acts on is decided by position and not by the '
    + 'name. Putting the row title in the name does not fix this on its own: nineteen buttons '
    + 'named "Archive for <title>" are nineteen matches for "archive". Reveal a row\'s actions '
    + 'only while that row is hovered or focused, with display:none or visibility:hidden (never '
    + 'opacity or off-screen positioning, which stay in the accessibility tree), and name each '
    + 'revealed action by its verb alone: "Archive", never "Archive for <title>". Only one row '
    + 'shows its actions at a time, so the bare verb is already unambiguous there, and a '
    + 'hover-revealed name carrying the row title also breaks the row lookup. The one bare verb '
    + 'to avoid is a word a navigation item\'s name extends: with an "Archived" destination in '
    + 'the sidebar, name the row action "Archive note", not "Archive". Where a row\'s '
    + 'actions are always visible a row-scoped name is allowed, and this rule still applies to '
    + 'it. At most one control per action verb may be visible at any moment. '
    + 'Ambiguous: ' + JSON.stringify(findings.ambiguous.items));

  assert.deepEqual(findings.leaky.items, [],
    'A chooser opened over the page, and a control outside it still answers to a name a control '
    + 'inside it carries, so the evaluator clicks the page behind the chooser. It resolves a name '
    + 'as a case-insensitive substring and walks button, link, menuitem, tab, checkbox before '
    + 'anything else, so the outside control usually wins. Give the two controls names that do '
    + 'not contain one another. For a dialog, also put the inert attribute or aria-hidden="true" '
    + 'on everything outside it and take them off again when it closes; aria-modal is not enough, '
    + 'because the evaluator resolves controls with getByRole, which honours inert and aria-hidden '
    + 'and ignores aria-modal. An inline picker that is not a dialog does not have to make the '
    + 'page inert: rename instead. Leaked: ' + JSON.stringify(findings.leaky.items));

  assert.deepEqual(findings.exposed.items, [],
    'A dialog is open and a text input outside it is still visible. The evaluator fills a field '
    + 'by name and, when no name matches, falls back to the first textbox on the page, so text '
    + 'meant for the dialog lands in that input instead. Put the inert attribute or '
    + 'aria-hidden="true" on everything outside the dialog while it is open. Exposed: '
    + JSON.stringify(findings.exposed.items));

  assert.deepEqual(findings.titleControl.items, [],
    'A row title is answered by a control that exists only while the row is hovered. The '
    + 'evaluator reaches a row by resolving its title through the same role ladder it uses for '
    + 'actions, and that ladder tries button, link, menuitem, tab, checkbox and heading before '
    + 'plain text, so with the row hovered it resolves the title to the hover-revealed action '
    + 'button and not to the title itself. The next re-render hides that button and the row can '
    + 'never be found again. When a row reveals its actions on hover, name them by their verb '
    + 'alone, or by the verb and what it acts on where a navigation item\'s name would extend '
    + 'the bare verb: only one row shows its actions at a time, so the verb is unambiguous, and '
    + 'the row title then belongs to the row text and to nothing else. Titles answered by a '
    + 'hover-only control: ' + JSON.stringify(findings.titleControl.items));

  assert.deepEqual(findings.strayVerb.items, [],
    'An action verb resolves only outside the row or composer the evaluator is working in. It '
    + 'hovers a row, or opens the composer, and then clicks the first control matching a bare verb '
    + 'such as "more", "labels" or "color"; with no such control inside, it lands on a page banner '
    + 'or a sidebar item and acts on something else entirely. Every action a requirement attaches '
    + 'to a row or to the composer must be reachable inside it by that verb. Resolved outside: '
    + JSON.stringify(findings.strayVerb.items));

  assert.deepEqual(findings.navCollision.items, [],
    'A row action is named with a word that a navigation item\'s name extends, so the '
    + 'evaluator clicks the row action when it means to open the destination. It reaches a '
    + 'sidebar destination with an anchored pattern, /^archived?$/i for the archive list, and '
    + 'a row action with an unanchored one, /archive/i; a button named "Archive" satisfies '
    + 'both, and the role ladder tries button before link, so the row button wins and the '
    + 'page never navigates. The row it acts on is whichever one is hovered, which in one run '
    + 'was another test\'s fixture. Keep the verb and add the object: "Archive note", '
    + '"Archive for <title>", "Move to archive". Do not rename the navigation item, which the '
    + 'requirements name, and do not scope the selector. Colliding: '
    + JSON.stringify(findings.navCollision.items));

  assert.deepEqual(findings.lostControl.items, [],
    'A freshly loaded entry page is missing controls it carried before, so a click left the '
    + 'application in a state a reload does not recover from. Whatever hides controls, for a '
    + 'dialog or a menu, must restore them synchronously and must not apply the hide after an '
    + 'await: an open that is superseded while its request is in flight otherwise leaves the page '
    + 'hidden with nothing open. Missing: ' + JSON.stringify(findings.lostControl.items));

  assert.deepEqual(findings.overlayLeak.items, [],
    'An overlay left the page in a state it cannot be driven out of. After a dialog is '
    + 'opened and closed, opened again and closed, superseded by a second open, or '
    + 'interrupted by another control, the page must carry every control it carried before '
    + 'and no dialog may be left open. Do not hand-roll this: open every dialog, menu, '
    + 'palette and settings panel with the harness-owned openOverlay(id, render) from '
    + '/factory/overlay.js and close it with closeOverlay(id). It gives the open a sequence '
    + 'number, so late work checks handle.isCurrent() before touching the DOM; it makes the '
    + 'rest of the page inert on the same synchronous path that creates the overlay, and '
    + 'restores it on every close path. The defect this catches is a hide applied after an '
    + 'await with a restore that runs synchronously: an open superseded while its request is '
    + 'in flight leaves the page hidden with nothing open. Leaked: '
    + JSON.stringify(findings.overlayLeak.items));

  assert.deepEqual(findings.volatile.items, [],
    'Text typed into a form was lost when another control in the same form was clicked. A '
    + 're-render must carry the current field values into the new markup, through the value '
    + 'attribute, the textarea body, or by not rebuilding the field at all. The evaluator types a '
    + 'title, clicks a toggle in the same composer and then saves; a lost value saves an empty '
    + 'row. Lost: ' + JSON.stringify(findings.volatile.items));
});
"""


# The generic actions the published helpers reach for by a bare verb, and the words in
# requirement prose that declare one. The interface check asks that a declared action be
# reachable inside the row or composer the requirement attaches it to; an action nothing
# declares is never checked, so a page that simply has no colour picker is not told to
# grow one because some banner control happens to contain the word.
ACTION_WORDS = {
    "menu": ("more option", "more action", "overflow menu", "options menu", "context menu",
             "row menu", "dropdown menu", "kebab menu", "three-dot menu", "menu button",
             "menu item", "opens a menu", "open the menu"),
    "labels": ("label",),
    "color": ("color", "colour"),
    "pin": ("pin",),
    "archive": ("archive",),
    "delete": ("delete", "trash"),
}


def contract_prose(contract, observations=None):
    """Every string in the contract that came from requirement prose.

    Schema-side values are left out on purpose: `navigation[].control` says "menuitem"
    for any sidebar entry, which would declare a row menu in every application that has
    a sidebar. Only words the requirements themselves used may declare an action.
    """
    parts = []
    app = contract.get("app") or {}
    if isinstance(app, dict):
        parts.extend(str(app.get(key, "")) for key in ("name", "summary"))
    for entry in contract.get("exact_texts", []) or []:
        parts.extend(str(value) for value in (entry or {}).get("texts", []) or [])
    for item in contract.get("navigation", []) or []:
        if isinstance(item, dict):
            parts.extend(str(item.get(key, "")) for key in ("name", "screen", "from"))
    for entity in contract.get("entities", []) or []:
        if not isinstance(entity, dict):
            continue
        parts.append(str(entity.get("name", "")))
        for field in entity.get("fields", []) or []:
            if isinstance(field, dict):
                parts.extend(str(field.get(key, "")) for key in ("name", "notes"))
    for seed in contract.get("seeds", []) or []:
        for value in (seed or {}).get("data", {}).values():
            if isinstance(value, str):
                parts.append(value)
    for key in ("persistence", "conventions", "unresolved_seed_sentences"):
        parts.extend(str(value) for value in contract.get(key, []) or [])
    for item in contract.get("api", []) or []:
        if isinstance(item, dict):
            parts.extend(str(item.get(key, "")) for key in ("purpose", "path"))
    parts.extend(str(value) for value in observations or [])
    return " \n".join(part for part in parts if part)


def declared_actions(contract, observations=None, requirement_text=None):
    """Which generic row or composer actions the requirements actually ask for."""
    prose = (contract_prose(contract, observations) + " \n" + (requirement_text or "")).lower()
    return [action for action, words in sorted(ACTION_WORDS.items())
            if any(word in prose for word in words)]


def vocabulary_module(contract, observations=None, requirement_text=None):
    """The words the requirements actually use, for the reported vocabulary check."""
    terms = []
    for entry in contract.get("exact_texts", []):
        terms.extend(entry.get("texts", []))
    for item in contract.get("navigation", []):
        if isinstance(item, dict) and item.get("name"):
            terms.append(str(item["name"]))
    for entity in contract.get("entities", []):
        if isinstance(entity, dict):
            terms.append(str(entity.get("name", "")))
            for field in entity.get("fields", []) or []:
                terms.append(str(field.get("name", "")))
    for seed in contract.get("seeds", []):
        for value in seed.get("data", {}).values():
            if isinstance(value, str):
                terms.append(value)
    # A reference observation is sometimes the only place a required heading appears: the
    # Ticket register page's "账户信息" is named by the image and by no requirement sentence.
    for text in observations or []:
        terms.append(str(text))
    # The seeded row titles, on their own. A row-scoped action name is allowed where a
    # row's actions are always visible, and the title is the part of such a name the
    # evaluator never searches for, so the interface check strips it before comparing
    # two names.
    titles = []
    for seed in contract.get("seeds", []):
        for value in seed.get("data", {}).values():
            if isinstance(value, str) and len(value.strip()) >= 3:
                titles.append(value.strip())
    for entity in contract.get("entities", []):
        if isinstance(entity, dict) and str(entity.get("title", "")).strip():
            titles.append(str(entity["title"]).strip())
    titles = sorted({title for title in titles}, key=lambda title: (-len(title), title))
    terms = sorted({term.strip() for term in terms if term and term.strip()})
    return ("'use strict';\n"
            "// Generated from the global state contract. The words the requirements use.\n"
            "const terms = " + json.dumps(terms, ensure_ascii=False, indent=1) + ";\n"
            "// The row titles the contract seeds, longest first.\n"
            "const titles = " + json.dumps(titles, ensure_ascii=False, indent=1) + ";\n"
            "// The generic actions the requirements declare, for the container rule.\n"
            "const actions = " + json.dumps(declared_actions(contract, observations,
                                                             requirement_text)) + ";\n"
            "const lowered = terms.map(t => t.toLowerCase());\n"
            "function matches(name) {\n"
            "  const value = String(name || '').toLowerCase().trim();\n"
            "  if (!value) return false;\n"
            "  return lowered.some(term => term.includes(value) || value.includes(term));\n"
            "}\n"
            "module.exports = {terms, titles, actions, matches};\n")


def contract_files(contract, observations=None, requirement_text=None):
    """The harness-owned files a contract-driven application starts from."""
    return [
        {"path": "backend/seed.cjs", "content": seed_module(contract)},
        {"path": "backend/state.cjs", "content": STATE},
        {"path": "backend/server.cjs", "content": SERVER},
        {"path": "checks/vocabulary.cjs",
         "content": vocabulary_module(contract, observations, requirement_text)},
        {"path": INTERFACE_CHECK_PATH, "content": INTERFACE_CHECK},
    ]


def install(workspace, contract, observations=None, requirement_text=None):
    workspace.write_files(contract_files(contract, observations, requirement_text))
    ignore = workspace.root / ".gitignore"
    existing = ignore.read_text() if ignore.exists() else ""
    if DATA_DIRECTORY + "/" not in existing.splitlines():
        ignore.write_text(existing.rstrip() + "\n" + DATA_DIRECTORY + "/\n")


INTERFACE_RULES = """Seven rules the harness checks mechanically, on the entry page and in every
state one click or one hover away from it. Each one is a failure two generated applications
actually lost specs to, so none of them is a style preference:

1. At most one control carrying a given action verb is visible at any moment. The evaluator
   resolves an action by the verb alone, "archive", "pin", "more", "color", matches it as a
   case-insensitive substring of the accessible name, and takes the first match in DOM order.
   Nineteen rows each showing "Archive for <title>" are nineteen matches for "archive", so the row
   acted on is decided by DOM position and not by the name. Render a row's actions only while that
   row is hovered or focused, and hide them with display:none or visibility:hidden. opacity:0, a
   transparent overlay and off-screen positioning all stay in the accessibility tree and still
   match.
2. A row's own title is answered by the row's text and by nothing else. The evaluator reaches a
   row by resolving its title through the same ladder it uses for actions, and that ladder tries
   button, link, menuitem, tab, checkbox and heading before plain text. So when a row's actions
   are revealed on hover, name them by the verb alone, "Archive", not "Archive for <title>":
   only one row shows its actions at a time, so the verb is already unambiguous, and a
   hover-revealed button carrying the title is circular, since the row would have to be hovered
   already for its own title to be found. A row-scoped name is not forbidden in itself, because
   the evaluator searches the bare verb and "Archive for Sprint goals" still matches "archive".
   It is only safe where a row's actions are always visible, and rule 1 then applies to them.
   The bare verb has one restriction, and one run lost two specs to it: it must not be a word
   that a navigation item's name extends. The evaluator opens a destination with an anchored
   pattern, /^archived?$/i for the archive list, and acts on a row with an unanchored one,
   /archive/i. A row button named "Archive" matches both, and the role ladder tries button
   before link, so while a row is hovered the click meant for the sidebar's "Archived" hits
   that button and archives another row instead of navigating. Where a destination's name
   extends the verb, name the row action for what it acts on: "Archive note", "Archive for
   <title>", "Move to archive". Rename the action, never the destination: the destination's
   name is the requirement's own word.
3. Every input, select, textarea, colour swatch, dialog field, toggle and meter carries an
   accessible name, through aria-label, <label for> or placeholder, using the requirement's own
   wording. A control with no name cannot be reached at all: a note body with no label matching
   the requirement's word for it sends the test's typing into the search box instead.
4. While a dialog is open, meaning a role="dialog" element or anything that declares
   aria-modal="true", put the inert attribute or aria-hidden="true" on everything outside it, and
   take them off when it closes. aria-modal is not enough on its own: the evaluator resolves
   controls with getByRole, which honours inert and aria-hidden and ignores aria-modal. Two things
   go wrong without it. A sidebar item named "Work" is reached before the dialog's own checkbox
   "Work for Sprint goals", because menuitem is two rungs above checkbox. And a visible text input
   outside the dialog takes the text meant for it, because the evaluator's last resort for filling
   a field is the first textbox on the page, with no name at all. Rule 7 does all of this for you.
   An inline colour palette, a dropdown menu or a listbox that is not a dialog is opened over live
   content on purpose and must not make the page inert. What still applies to it is naming: no
   control outside it may answer to a name a control inside it carries, because the evaluator
   matches a name as a substring and reaches the outside control first. Rename, do not hide.
5. Every action your requirements actually ask for on a row or in the composer is reachable
   inside that row or composer by the bare verb the evaluator uses: more, options or menu for a
   menu, then labels, color, pin, archive, delete. The evaluator hovers the row, or opens the
   composer, and then clicks the first control matching the verb wherever it is on the page. A
   composer with no more, options or menu control sends it to the page banner's own "Menu"
   button, and a row with no labels control sends it to the sidebar's "Edit Labels", which is how
   one run assigned a label to nothing at all. Only the actions your own requirements name are
   checked, so an application whose requirements never mention archiving is never asked to grow
   an archive control.
6. Text already typed into a form survives a click on another control in the same form, and
   whatever hides controls restores them synchronously. When a state change re-renders the form,
   carry the current values into the new markup, through the value attribute, the textarea body,
   or by not rebuilding the fields at all. Never apply a hide after an await, and let rule 7 own
   the hiding for you. A freshly loaded page must always carry every control it carried before.

7. Every dialog, menu, palette and settings panel is opened through the harness-owned overlay
   module. Load it once, first, in frontend/public/index.html:
     <script src="/factory/overlay.js"></script>
   and then, wherever you would have written your own open, hide, restore and close:
     const handle = openOverlay('settings', container => container.appendChild(spinner()));
     const saved = await fetch('/api/settings').then(response => response.json());
     if (!handle.isCurrent()) return;         // a newer open, or a close, superseded this one
     handle.container.appendChild(settingsDialog(saved, () => closeOverlay('settings')));
   openOverlay(id, render) puts the container in the document and makes the rest of the page
   inert before it returns, on the same synchronous path, so an open whose request never
   resolves cannot leave the page hidden with nothing open. closeOverlay(id), handle.close(),
   the Escape key, a second openOverlay with the same id, and product code that removes the
   container all run the one cleanup, which restores the page exactly once. Pass
   {modal: false} as a third argument for a menu or palette that must not make the page inert.
   Never hand-roll a hide and a restore around an await. That is the exact defect this
   replaces: a run lost a spec to a settings dialog that hid its rivals after an awaited
   fetch and restored them synchronously, so an open superseded before its fetch resolved
   left the page hidden with no dialog to close. The harness drives every dialog-opening
   control on one page, without reloading, and fails a run that leaves an overlay open on top
   of itself, leaves one open after a close, or leaves a control hidden with nothing open.

And two rules about the checks you write, which the harness cannot enforce for you:

8. A self-check for an action on a named row asserts on that row afterwards: it is in the
   destination list, or it carries the attribute the requirement names. Never assert only that a
   toast, snackbar or notification appeared. Four of one run's specs passed against a toast while
   the action had gone to the wrong row.
9. A self-check reaches a row's action the way the evaluator does: hover the row's title text
   first (page.getByText(title).first().hover()), then locate the action by its verb. Rule 1 hides
   the action until then, so a check that waits for an action name without hovering times out
   against a correct page. One batch of run 5 spent its whole call budget on exactly that."""


STORE_CONTRACT = """The harness has already written these files. Do not rewrite them:
  backend/seed.cjs   the rows the requirements declare as already existing at startup
  backend/state.cjs  the shared persistent store and the startup readiness promise
  backend/server.cjs the static server, SPA fallback and /api/health gate
  frontend/public/factory/overlay.js  the overlay lifecycle, described in rule 7 below

backend/api.cjs must export `async (req, res) => boolean`. When a request belongs to your API,
answer it and return true. For every other request return false without touching `res`: the
server then serves the built frontend and the single-page fallback. A handler that answers
everything, for example with a trailing `send(res, 404, ...)`, makes the application serve no
pages at all and fails verification before a single test runs.

In backend/api.cjs use the shared store instead of your own storage:
  const {store} = require('./state.cjs');
  store.list(name[, predicate]) -> array of records      store.get(name, id) -> record or null
  store.find(name, predicate)   -> record or null        store.insert(name, data) -> record with id
  store.update(name, id, patch) -> record or null        store.remove(name, id) -> boolean
  store.replace(name, array)    -> the new array
Every mutation is written to disk immediately, so a value survives a reload and a restart.
Collection names come from the contract. Never seed rows yourself and never keep product
state in a module-level variable, a global, or browser storage: the evaluator reloads the
page and expects the server to remember. /api/health is already served; do not redefine it.

""" + INTERFACE_RULES


HARNESS_OWNED = ("backend/seed.cjs", "backend/state.cjs", "backend/server.cjs",
                 "frontend/build.cjs", "frontend/package.json", "backend/package.json",
                 OVERLAY_PATH, INTERFACE_CHECK_PATH, "checks/vocabulary.cjs")

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
        args = {**args, "files": [args["files"]]}
    if isinstance(args, dict) and set(args) - {"files"}:
        # A batch that also passes check_command means to write and then verify; the
        # write is unambiguous, so do it rather than returning a TypeError.
        return {"files": args["files"]} if "files" in args else args
    return args


HARNESS_SUMMARY = {
    "backend/state.cjs": "Harness-owned. Exports {ready, store, seed}. The store API and the "
                         "readiness contract are stated in your instructions in full.",
    "backend/seed.cjs": "Harness-owned data file. Every row it contains is already listed under "
                        "`seeds` in the global state contract you were given.",
    "backend/server.cjs": "Harness-owned. Serves /api/health, the built frontend and the SPA "
                          "fallback, and delegates every other request to your backend/api.cjs.",
    "frontend/build.cjs": "Harness-owned. Copies frontend/public to frontend/dist.",
    "frontend/package.json": 'Harness-owned. {"scripts":{"build":"node build.cjs"}}',
    "backend/package.json": 'Harness-owned. {"scripts":{"start":"node server.cjs"}}',
    INTERFACE_CHECK_PATH: "Harness-owned. Walks every state one click or one hover from the "
                          "entry page, drives every dialog-opening control's overlay lifecycle "
                          "on one page, and asserts the seven interface rules in your "
                          "instructions: one visible control per action verb, a row title "
                          "answered only by the row's text, a name on every field, an inert "
                          "page behind an open dialog, every declared row and composer action "
                          "reachable inside it, a form that keeps its text, and overlays opened "
                          "through /factory/overlay.js. Do not edit it; satisfy it.",
    "checks/vocabulary.cjs": "Harness-owned data: the words the requirements use.",
    OVERLAY_PATH: "Harness-owned. The build emits it; it is served at " + OVERLAY_URL
                  + " and defines openOverlay(id, render) and closeOverlay(id) on window, "
                    "with the open sequence, the inertness and the cleanup described in your "
                    "instructions. Load it from index.html with a <script src> tag and use it "
                    "for every dialog, menu, palette and settings panel. Do not write this path.",
    "checks/browser.cjs": "Harness-owned helper. Exports test(name, async (page, assert) => {}). "
                          "`page` is a Playwright page already on the entry URL; `assert` is "
                          "node:assert/strict. Await Playwright results and pass the values to "
                          "assert, never to Playwright's expect.",
}


def regression_check_summary(requirements, current_check_path):
    """One line for an earlier batch's check file, in place of its bytes.

    A previous batch's `checks/batch-N.spec.cjs` is a regression check: it passes
    against the current tree, it runs again with every later batch, and the current
    batch must not edit it. One Keep generation re-read those files at the start of
    nearly every batch, and by batch 11 four of them alone exceeded the read bound.
    """
    covered = ", ".join(requirements) if requirements else "earlier requirements"
    return ("An earlier batch's regression check, covering " + covered + ". It passes "
            "against the current application and runs again with this batch. Do not edit "
            "it and do not read it: keep those requirements working, and write this "
            "batch's own checks in " + current_check_path + ".")


REGRESSION_EDIT_REFUSAL = ("{path} is an earlier batch's regression check and was not "
                           "changed. It passed against the application as that batch left "
                           "it, so a failure there is a regression in the application, not a "
                           "defect in the check. Fix the application instead, and write this "
                           "batch's own checks in {current}.")


def harness_read(paths, owned=None):
    """Answer a read of harness-owned files without spending the read on their bytes.

    Runs i1 and i3 each spent three or more calls reading 14 KB of files the agent is
    told not to modify. Returning the contract instead keeps the call productive.

    ``owned`` carries additional path-to-summary entries the caller owns for the
    current batch, which is how earlier batches' regression checks are answered.

    A read that mixes owned and product files is answered in two parts: the owned
    names come back as their summaries under ``files`` and the product names are
    listed under ``product`` for the caller to read verbatim. The first full Keep run
    on this branch lost a call to exactly that mix, because the owned bytes counted
    against the 12,000-byte read bound.
    """
    summaries = {**HARNESS_SUMMARY, **(owned or {})}
    names = [paths] if isinstance(paths, str) else list(paths or ())
    known = [name for name in names if name in summaries]
    if not known:
        return None
    product = [name for name in names if name not in summaries]
    answer = {"files": {name: summaries[name] for name in known},
              "note": "These files are managed by the harness or by an earlier batch and were "
                      "not returned verbatim. Do not modify them. Implement your requirements "
                      "in backend/api.cjs, frontend/public/* and this batch's own check file."}
    if product:
        answer["product"] = product
    return answer


