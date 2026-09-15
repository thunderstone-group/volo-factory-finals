| Local \ Official | pass | fail |
|---|---:|---:|
| pass | 9 | 0 |
| fail | 8 | 3 |
| unknown | 8 | 4 |

Denominator: 32; official-pass recall: 52.9%; false passes: 0; unknown: 12; acceptance: FAIL.

- REQ-2.2#1 (read-list) Create Note: unsupported: Schema/source validation failed: [
  {
    "code": "custom",
    "message": "THEN name absent from THEN/literals: New\\s+note",
    "path": []
  }
]
- REQ-2.3.3#1 (read-list) Trash list: unsupported: Schema/source validation failed: [
  {
    "code": "custom",
    "message": "Click must name an original verb or quoted literal: Trash",
    "path": []
  }
]
- REQ-2.5.3#1 (read-list) Show archived notes: unsupported: Schema/source validation failed: [
  {
    "code": "custom",
    "message": "Click must name an original verb or quoted literal: Archived",
    "path": []
  }
]
- REQ-2.6.1#1 (edit) Change note color: ambiguous-assertion: The requirement asserts a background color change, which cannot be verified with text presence or absence.
- REQ-2.6.2#1 (create) Choose note color when created: ambiguous-assertion: The requirement asserts the note is saved with a selected color, which cannot be verified with text presence or absence.
- REQ-2.7.4#1 (read-list) Assign default label when creating note: unsupported: Schema/source validation failed: [
  {
    "code": "custom",
    "message": "THEN name absent from THEN/literals: New\\s+note",
    "path": []
  }
]
- REQ-2.7.5#1 (edit) Edit labels: unsupported: The workflow requires clicking Edit Labels, changing a label name, and saving, which exceeds the two-step limit per sentence.
- REQ-2.8.3#1 (create) Pin note when creating it: unsupported: The workflow requires entering title, entering content, clicking pin, and closing the editor, which exceeds the two-step limit per sentence.
- REQ-3.1#1 (search-filter-sort) Initial suggested filters: ambiguous-assertion: The suggested filter to choose is not specified, so the expected filtered results cannot be determined.
- REQ-5.1#1 (state-toggle) Toggle between list and grid views: ambiguous-assertion: The requirement asserts a view mode change, which cannot be verified with text presence or absence.
- REQ-5.2#1 (navigation) Grid View by default: ambiguous-assertion: The requirement asserts the default view mode, which cannot be verified with text presence or absence.
- REQ-6.2#1 (state-toggle) Collapsible Sidebar: ambiguous-assertion: The requirement asserts the sidebar collapses and expands, which cannot be verified with text presence or absence.
