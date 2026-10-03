# Scaffold primitives

The scaffold is a starting point for an application, not an additional product specification.
Select and adapt its regions and controls to the supplied requirements. Keep working mechanics while
changing behavior that the actual task requires; do not retain an unsuitable default merely for a locator.

| File or primitive | Purpose |
|---|---|
| backend/server.js | Serve the application, report startup health, and persist shared records through the supplied API. Extend domain routes where required. |
| frontend/public/seed.js | Define only the initial records and relationships required by the task. |
| frontend/public/app.js | Replace the demonstration views and actions with the required application. |
| ARC.layout | Render configured brand/navigation/account/sidebar/footer regions around the main content. Omit unused regions. The brand is a single link by default, or a button when brandRole: button is required. Sidebar destinations are links by default; an explicitly required button can use role: button. |
| ARC.route / ARC.navigate | Read and change hash routes, preserving consistent application state. |
| ARC.openDialog / ARC.closeDialog | Manage a named modal and isolate its background while open. Use a non-modal primitive for non-modal interactions. |
| ARC.openPopover | Place a menu or contextual panel in its intended scope; use menu/menuitem roles when the UI is a menu. |
| ARC.combobox | Provide a labelled native select, form value and change callback. Supported browsers display the selected value through selectedcontent; other browsers keep native behavior. |
| ARC.render | Render the current view without destroying a pressed target before its click completes. |
| Clipboard helpers | Integrate required copy/cut/paste operations with the browser clipboard and application-specific structured data. |
| ARC.notify | Display an application message, optionally with a meaningful Undo action. |
| ARC.rowActions | Associate actions with a record identity. Choose visibility and labels from the actual workflow. |
| Event delegation | Dispatch data-action and data-change to application handlers and preserve form behavior. |

Delivery checks cover syntax, build, startup, assets and actual browser errors. Requirement-derived checks
judge the requested behavior. Similar names, readonly fields, repeated controls or omitted optional layout
regions are not application defects by themselves.
