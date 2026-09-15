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

## Avoid ambiguous targets

Make repeated row actions identifiable in their row. If contextual actions are hidden
at rest, reveal them on keyboard focus as well as pointer hover. Do not turn an entity's
title into the accessible name of an unrelated action. Keep requested row/editor actions
inside their own context instead of requiring an unrelated global menu.

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
