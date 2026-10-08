# Requirement-grounded implementation guidance

The supplied requirements determine the application. Follow their stated roles, accessible names,
attributes, data, permissions and workflows. The scaffold and examples are tools, not additional
requirements. Apply the display conventions below; beyond them, do not add a region, label, record or interaction the
requirements do not call for.

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
Provision the identities and relationships stated to exist initially. A record the requirements identify only by an identifier gets that identifier as its displayed name; do not invent a separate display name for it. Do not pre-apply later scenario outcomes
or create records explicitly described as absent. When the requirements allow alternative indications, show one of
them (see Display conventions). Required messages retain their stated
wording and context. Announce dynamic feedback with semantics appropriate to its urgency: when the application refuses
an action the user just attempted (a save, edit or entry it rejects), that is time-sensitive, so announce it with
role="alert" beside the control; use a status for non-urgent updates. This lets
assistive technology convey feedback without unnecessary interruptions (WAI-ARIA APG Alert; WCAG 4.1.3).
Honor an explicitly required message role. When the requirements name a message by its role (the status or alert
named X), give that element the accessible name X with aria-label: ARIA does not derive the name of an alert or
status from its content (WAI-ARIA accname). Do not add filler text or unused datasets to echo quoted phrases.
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
When the requirements place a control in a region (the main content, the page header, a dialog, a row or a
cell), render it inside that landmark or element. Which container and which pages does the requirement actually
specify? "Global" describes availability, not necessarily a banner; a control the requirements put at the top of the
application (a "top" search or navigation) belongs in the page header that every page shares. Move controls when relocation is required;
retain useful repeated entry points in distinct contexts. Scope and purpose disambiguate them for users; a role and
name need not be unique across an entire page. A control the requirements add to a cell, row or record
goes inside that element, even where the existing application keeps other controls beside it; when the requirements
state that element's displayed text, the control carries an accessible name and no visible text of its own.

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
Modal dialogs isolate their background and manage focus. Provide a visible, accessibly named dismissal control and
keyboard dismissal so users can leave the dialog (WAI-ARIA APG Dialog). Use the name the requirements specify;
otherwise name it Close, the conventional label users and assistive technology expect. Ordinary menus and popovers remain
in their intended scope. Use the APG menu-button roles, states and keyboard behavior for a command menu; a disclosure
of ordinary navigation links can keep link semantics. This preserves the interaction assistive technology expects.
A field chooser belongs to the container the requirements identify; a named editor elsewhere does not
imply that every checkbox must move into it. Keep idle overlays from intercepting input. Expose declared
ARIA states on the controls that own them, and update those states with the real interaction.
Preserve requested root attributes. Additional visible state markers are useful when required, but a root
title attribute does not imply that an extra descendant with the same title must be added.

## Display conventions
Follow these when the requirements do not prescribe another presentation:
- A count is shown with its noun as one text: "1 comment", "0 comments", "3 stars" (singular for one, plural
  otherwise), outside any control whose name the requirements specify. Keep showing it at zero.
- A record's detail page is headed by the exact name the requirements use to open or refer to it (its title, tag,
  key or name); other descriptive fields follow as text.
- A record's own text fields other than the one in its heading (its title, description or body) appear on its detail
  page as their exact text, each in its own element, without a label prefix. Each other attribute or state the requirements name (what it targets or
  belongs to, its status) is shown as "Label: value" in one text, with the requirements' label: "Owner: alice",
  "Status: Active". Show the current state by its stated name, including the default state.
- A record is linked by the identifier the requirements use for it; a display name may accompany the link but does
  not replace its text.
- When a state change may be indicated in alternative ways ("X or Y"), show one indication once, and do not repeat
  the state's words in other text on the page: no confirmation message that restates a state the page already shows,
  and no timestamp or label that repeats it.
- When a submission is rejected because the item already exists, show the message and link the existing item by its
  identifier so the user can open it; do not create or list a second one.
- When a page loses its session (signed out, revoked or expired), render the signed-out entry, including a sign-in
  link the requirements place in the main content, instead of the protected page.
- A command the requirements name stays available under that name while it can be used again (for example to apply
  another condition); do not replace it after its first use unless the requirements say so.
- When the requirements place a command in a menu and that command turns a feature on for the current data (for
  example creating a filter), also offer it as a toolbar button with the same name next to the menu; keep the menu
  entry as well.
- A record's current state ("Status: Active", "Status: Archived") is shown on the record's main page, the page the
  user is on after changing that state, not only in its settings.
- Reaction counts read "1 reaction" or "N reactions" (also "0 reactions") as their own text beside the reaction
  controls, not as a bare number.
- After a submission is rejected because its name, tag or key already exists, the page shows that existing item's
  identifier exactly once, as a link to it, next to the message.

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
