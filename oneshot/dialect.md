# Accessibility guidance for the application in the supplied requirements

This is diagnostic guidance carried over from an earlier candidate's observed locator
behavior. It is not a calibrated acceptance suite or a claim about every ARC task.
The supplied requirements determine entities, actions, state, routing and seed data.
Do not invent a note-taking application, an archive workflow, or any other task's features.

## Semantic controls and names

Use native buttons, links, labeled inputs and real landmarks. Give controls accessible
names that match the requested vocabulary. A named section can use
`<section aria-label="…">`. Do not rely exclusively on CSS classes or data attributes
for identifying an action.

Observed helpers may try button/link/tab/menuitem/option roles before visible text.
Field helpers may use labels, placeholders and textbox/combobox/spinbutton roles.
Names may be case-insensitive substring matches or exact matches. Preserve quoted
labels from the requirements and distinguish navigation from actions on an entity.
Preserve required section headings as visible text, not only as accessibility labels.
Use a native meter or progress element with its accessible name and changing value for
quantitative indicators; a styled div with an ID alone does not expose a semantic role.

## Avoid ambiguous targets

Automated checks act on a list item by hovering its title and then clicking the first
visible button on the whole page whose name matches the action verb. Therefore per-item
actions (pin, archive, more options, change color, delete, restore, …) must be hidden at
rest and revealed only while their own item is hovered or focused (`.item:hover .actions,
.item:focus-within .actions { display: flex }`), so that at any moment at most one item's
action buttons are visible. Always-visible per-item actions make the first item win every
time. Navigation entries in sidebars, tabs and menus must be `<a>` links (with `href`),
never `<button>`, so a navigation label cannot be mistaken for an item action with the
same verb. Do not turn an entity's title into the accessible name of an unrelated action.
Keep requested row/editor actions inside their own context instead of requiring an
unrelated global menu.
Render singular identity or status values once per screen. Repeating the same standalone
username or success text in a header and the page body makes an exact-text query ambiguous;
use one canonical display and different surrounding prose where repetition is necessary.

When an actual modal dialog is open, move focus into it and make background controls
inert until it closes. A nonmodal menu should retain the interactions its requirements
need. Avoid duplicate visible controls with indistinguishable names in the same context.

## Requirements, state and seed data

Create the initial entities and values explicitly required by the task. Quoted button
labels and expected messages are not automatically seed records. Use the required
relationships and state transitions, and persist a mutation before announcing success.
Do not assume a worker count, test order, or isolation policy. Never depend on another
test first constructing a fixture. Health readiness follows initialization of seed data.

## Interaction mechanics

Make required screens discoverable through the requested navigation. Preserve deep links
when the requirements ask for them. Remove obsolete controls on a view transition and
keep typing/focus stable across state updates. Avoid artificial delays and animations
that block input. Report required notifications with appropriate status or alert semantics.
