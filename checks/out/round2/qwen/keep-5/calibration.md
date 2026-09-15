| Local \ Official | pass | fail |
|---|---:|---:|
| pass | 7 | 0 |
| fail | 0 | 1 |
| unknown | 18 | 6 |

Denominator: 32; official-pass recall: 100.0%; false passes: 0; unknown: 24; acceptance: PASS.

- REQ-2.2#1 (create) Create Note: unsupported: Single WHEN sentence contains click, fill title, fill content, and close actions exceeding the two-step limit.
- REQ-2.3.1#1 (delete) Delete: unsupported: WHEN requires hover, click More options, and click Delete Note in one sentence, exceeding the 2-step limit.
- REQ-2.3.2#1 (state-toggle) Notification and Undo: no-preparation-path: Cannot prepare deleted-note state in GIVEN without performing delete operations.
- REQ-2.3.3#1 (read-list) Trash list: unsupported: Schema/source validation failed: [
  {
    "code": "custom",
    "message": "Click must name an original verb or quoted literal: Trash",
    "path": []
  }
]
- REQ-2.4#1 (edit) Update Note: unsupported: Single WHEN sentence contains open, edit, and close actions exceeding the two-step limit.
- REQ-2.5.1#1 (state-toggle) Archive: ambiguous-assertion: Cannot assert note moved to archive list using only expectText or expectAbsent on the current page.
- REQ-2.5.2#1 (state-toggle) Archive Undo: no-preparation-path: Cannot prepare archive notification state in GIVEN without performing archive operations.
- REQ-2.5.3#1 (read-list) Show archived notes: unsupported: Schema/source validation failed: [
  {
    "code": "custom",
    "message": "Click must name an original verb or quoted literal: Archived",
    "path": []
  }
]
- REQ-2.6.1#1 (edit) Change note color: ambiguous-assertion: Color change is a visual style property that cannot be verified with expectText or expectAbsent.
- REQ-2.6.2#1 (create) Choose note color when created: unsupported: Single WHEN sentence contains multiple actions exceeding the two-step limit.
- REQ-2.7.1#1 (edit) Assign label to a note: unsupported: Single WHEN sentence contains three sequential actions exceeding the two-step limit.
- REQ-2.7.2#1 (edit) Remove label from a note: unsupported: Single WHEN sentence contains three sequential actions exceeding the two-step limit.
- REQ-2.7.4#1 (create) Assign default label when creating note: no-preparation-path: Cannot open Take a note editor in GIVEN without a click, and WHEN has too many actions.
- REQ-2.7.5#1 (edit) Edit labels: unsupported: Single WHEN sentence contains three sequential actions exceeding the two-step limit.
- REQ-2.8.1#1 (state-toggle) Pin note: ambiguous-assertion: Pin state and pinned section placement are visual properties not verifiable with expectText or expectAbsent.
- REQ-2.8.2#1 (state-toggle) Unpin note: no-preparation-path: Cannot prepare pinned note state in GIVEN without performing pin operations.
- REQ-2.8.3#1 (create) Pin note when creating it: no-preparation-path: Cannot open Take a note editor in GIVEN without a click, and WHEN has too many actions.
- REQ-3.1#1 (search-filter-sort) Initial suggested filters: ambiguous-assertion: No specific filter name or expected result text available for expectText assertion.
- REQ-4.1#1 (navigation) Setting options list: ambiguous-assertion: No specific settings option text available for expectText assertion.
- REQ-4.2#1 (navigation) Detailed settings: no-preparation-path: Cannot prepare settings dropdown open state in GIVEN without a click.
- REQ-5.1#1 (state-toggle) Toggle between list and grid views: ambiguous-assertion: View mode switching is a layout property not verifiable with expectText or expectAbsent.
- REQ-5.2#1 (read-list) Grid View by default: ambiguous-assertion: Grid view default and toolbar toggle visibility are layout properties not verifiable with expectText or expectAbsent.
- REQ-6.1#1 (read-list) Items and styling: ambiguous-assertion: Sidebar styling and icon consistency are visual properties not verifiable with expectText or expectAbsent.
- REQ-6.2#1 (state-toggle) Collapsible Sidebar: ambiguous-assertion: Sidebar collapse and expand states are layout properties not verifiable with expectText or expectAbsent.
