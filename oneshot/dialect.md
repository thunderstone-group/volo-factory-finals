# Requirement-grounded implementation guidance

The supplied requirements determine the application. Follow their stated roles, accessible names,
attributes, data, permissions and workflows. The scaffold and examples are tools, not additional
requirements. Do not add a region, label, record or interaction solely because an evaluator might look for it.

## Starting context and navigation
Preserve each scenario's GIVEN screen and authentication state. A named account existing in seed data does
not imply a signed-in session. Establish login only when the stated workflow requires it, using provided
credentials. Follow explicit global seed credential rules; do not borrow credentials from unrelated accounts.
When a workflow opens a named record from its starting screen, ensure that it can do so there without
invented parent navigation or extra confirmation. Keep identity, permission scope and canonical routes intact.
Provide navigation and deep links where the requirements call for them or they help the described workflow.
Do not suppress distinct records because their display names happen to match.

## Content and initial state
Distinguish required UI labels/messages, initial records, runtime inputs, examples and explicit absences.
Provision the identities and relationships stated to exist initially. Do not pre-apply later scenario outcomes
or create records explicitly described as absent. Required validation and success messages retain their stated
wording and appear in the specified context. Do not add filler text or unused datasets to echo quoted phrases.
Only the stated action should create, edit, archive, delete, favorite or otherwise change a record.

## Accessible controls and layout
Use semantic HTML suited to the operation. Honor explicitly stated roles and names. Otherwise, choose
buttons for actions, links for navigation, appropriate input types, and useful labels within their context.
A searchbox is appropriate for search unless another role is required. Repeated entities may be articles,
list items, table rows or another appropriate grouping; do not impose one role on every application.
Follow declared labels and placeholders separately. A label does not imply an identical placeholder; an
unspecified placeholder may be omitted. Preserve meaningful readonly fields and use their intended controls.
Similar words or identical actions in separate regions are not defects by themselves. Check the actual
scope and interaction before changing a name or removing a control. Do not globally hide repeated controls.
Keep an explicitly required accessible name intact. Decorative icons can use aria-hidden; counters and
supplementary details must not change a name whose exact value is specified.

Check which layout regions the application needs. Configure header, navigation, account controls, sidebar
and footer only when required or useful for the described workflow. A shared renderer can keep appropriate
regions consistent, but it must not force every region onto every screen. Do not render structural words
such as "Header" or "Footer" merely to announce that a landmark exists. Use headings for actual section
headings and accessible region names where they convey the intended structure.

## Editors, dialogs and transient UI
Implement editing through the paths the requirements support. Use named, labelled controls and preserve
current form values across re-rendering or disclosure changes. For inline editing, check which pointer,
keyboard, commit and cancellation interactions are required or appropriate; do not assume every record
must implement the same gesture set. Display-only content need not become editable.
Modal dialogs isolate their background. Ordinary menus and popovers remain in their intended scope.
A field chooser belongs to the container the requirements identify; a named editor elsewhere does not
imply that every checkbox must move into it. Keep idle overlays from intercepting input. Expose declared
ARIA states on the controls that own them, and update those states with the real interaction.
Preserve requested root attributes. Additional visible state markers are useful when required, but a root
title attribute does not imply that an extra descendant with the same title must be added.

## Runtime behavior
Deliver real state transitions, including rejection paths and unchanged state after failure. Trace state
writers, readers and rendered results through the same identity and storage scope. Keep shared records,
session identity and transient view state distinct, with persistence matching the requirements.
With the scaffold, shared record collections belong in seed.js and ARC.state; session identity is in
ARC.state.session, while drafts, open forms and other view state belong under ARC.state.ui. Use ARC.save()
for required persistence. Adapt this split if the requirements describe different ownership or lifetime.
Handle navigation and data loading predictably, show appropriate loading/error state, and avoid unnecessary
blocking delays. Async loading is acceptable; do not force all data into memory merely for a guessed timeout.
Keep event delegation reachable. Do not destroy a pressed element before the browser can deliver its click.
ARC.render() already defers rendering during the press sequence. Keep typed values stable while editing.
Use normal browser clipboard APIs for required copy/cut/paste workflows. The scaffold's onCopy/onPaste and
copyToClipboard/pasteFromClipboard helpers are available when their behavior fits the required interaction.
Preserve selection for multi-item operations as the workflow specifies; do not impose grid selection rules
on unrelated menus. Native controls retain their standard keyboard and form behavior.
Keep request handlers and rendering errors contained, return useful errors, and preserve a working application
when an optional diagnostic is unavailable. Do not alter visible content or reported state to satisfy a test
that contradicts the supplied requirements.

## Verification
Check the stated starting point, each required transition, persistence, permissions and failure behavior.
Scope observations to the record or container the requirements identify. A generated test can be wrong;
verify its setup and assertions against the requirements before treating its failure as an application defect.
Preserve all known passing behavior while repairing a failure. Treat static source guesses as clues, not
proof that a control is missing, a label must change, or a field must become editable.
