# Application construction guide — minimal V1

These are implementation conventions, not additional business requirements or a
description of hidden tests. Use the task's own vocabulary, fields, routes, records
and requested behavior. Explicit task instructions override the defaults below.

## Build complete flows

Account for every required scenario before writing code: initial state, action,
mutation, visible result and how the user reaches it. Implement the underlying
relationships, filters, permissions, errors, undo and persistence, not only a screen
that resembles the result. Initialize every explicitly supplied seed record and its
properties once. Do not turn quoted control labels or example success messages into
seed records. Keep domain data coherent across views and browser reloads as required;
keep visitor-specific form drafts, selections and temporary UI state local to that
visitor. A successful mutation must actually update the state before showing success.

## Controls have one purpose

Opening an editor, submitting, deleting or toggling an in-place view is a button
action. Entering text is an input action. Do not use a textarea as the control that
opens a collapsed editor, or make an entire card pretend to be its action button.
Use real links for routes, real buttons for actions, and labeled native fields. A
text search field may simply use `type="text"`; use `type="search"` when the task
specifically calls for a searchbox. Do not add conflicting ARIA roles to native inputs.

Parameterized examples (substitute the actual task's names; do not print braces):

```html
<button type="button" onclick="openEditor()">{requested create/open label}</button>
<label for="query">{requested search field label}</label>
<input id="query" type="text" placeholder="{requested search field label}">
<nav aria-label="{navigation purpose}">
  <a href="{required route}">{requested navigation label}</a>
</nav>
```

Keep exact explicitly quoted labels and messages. For unspecified names use a short,
predictable description of the visible purpose. Icon-only controls need an accessible
name. Do not concatenate every possible synonym into a label or add hidden aliases.

## Names and containment work together

Expose repeated entities as named articles or semantic table rows, with a real visible
heading for each entity title. A heading can contain a link or button to open it.
Put each entity's actions inside its own article/row. Never use one global set of
actions for many cards. Give forms a name based on their purpose, conventionally
"{purpose} form". Give modal editors a visible heading and a matching accessible
name, conventionally "{entity type} editor" when the task does not specify a name.
Use a native dialog opened with showModal() for an actual modal, including focus and
close handling. Inline expandable forms need their own named container as well.

```html
<article aria-labelledby="entity-42-title">
  <h2 id="entity-42-title"><a href="{entity route}">{entity title}</a></h2>
  <p>{entity summary}</p>
  <button type="button" aria-label="{requested action name}">{action text}</button>
</article>
<dialog aria-labelledby="editor-heading">
  <h2 id="editor-heading">{entity type} editor</h2>
  <form aria-label="{purpose} form">
    <label for="title">{requested title field label}</label><input id="title">
    <label for="body">{requested content field label}</label><textarea id="body"></textarea>
    <button type="submit">{requested save/close label}</button>
  </form>
</dialog>
```

Buttons for contextual actions belong within the opened menu/editor's container.
Color choices, checkboxes and labels need their own names and observable selected
state. Repeated edit/save/delete actions in management lists stay inside the named
row for the item. Keep a single canonical visible success/status message; expose it
as a status or alert and include requested follow-up actions such as undo there.
Do not repeat indistinguishable buttons or identity values in the same scope.

## A visible view must be ready to use

Prepare deterministic initial data before showing the first view. Prefer a shared
seed snapshot usable by frontend and backend so required initial cards and controls
can render synchronously, then reconcile with persisted data. Do not briefly display
an empty list with live navigation while loading its known initial records. For
small apps, keep the current domain snapshot in frontend state: in-place navigation
can render its destination immediately, while successful mutations update both the
server and the snapshot. If an operation really must wait for a request, disable its
dependent actions and show a real loading state until the destination is complete.
Do not use arbitrary sleeps, dead readiness flags or fake success announcements.

Remove obsolete controls when switching views. Keep text input focus stable; do not
replace the focused input on every keystroke. Save the requested state before closing
an editor, reflect changes in every relevant list, and support reopening the same
entity. Use semantic headings for page titles, proper selected/expanded state for
controls, and native progress/meter elements when the task asks for a quantitative
indicator. Spend output on full behavior before decorative styling.
