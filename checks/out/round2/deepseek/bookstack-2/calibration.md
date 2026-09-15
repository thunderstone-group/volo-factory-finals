| Local \ Official | pass | fail |
|---|---:|---:|
| pass | 4 | 2 |
| fail | 3 | 7 |
| unknown | 4 | 14 |

Denominator: 34; official-pass recall: 57.1%; false passes: 2; unknown: 18; acceptance: FAIL.

- REQ-1.2#1 (navigation) Back to Homepage from Other Pages: ambiguous-assertion: Click name 'BookStack logo' is not a bare action verb or quoted literal; cannot compile.
- REQ-2.2#1 (navigation) Log In Successfully: unsupported: WHEN sentence requires fill email, fill password, check Remember Me, and click Login, exceeding two-step limit.
- REQ-3.1#1 (read-list) Enter Authenticated Homepage: unsupported: WHEN sentence describes system navigation, not user actions; no valid steps.
- REQ-4.3.1#1 (create) Create Shelf: unsupported: WHEN sentence requires click New Shelf, fill information, and click Save Shelf, exceeding two-step limit.
- REQ-4.4.1#1 (delete) Confirm Delete Shelf: unsupported: WHEN sentence requires click Delete and confirm deletion, exceeding two-step limit.
- REQ-4.5.1#1 (edit) Save Shelf Edits: unsupported: WHEN sentence requires click Edit, update information, and click Save Shelf, exceeding two-step limit.
- REQ-5.3.1#1 (create) Fill out and Save Book: unsupported: WHEN sentence requires click Create New Book, fill information, and click Save Book, exceeding two-step limit.
- REQ-5.4.1#1 (edit) Save Book Edits: unsupported: WHEN sentence requires click Edit, update information, and click Save Book, exceeding two-step limit.
- REQ-5.5.1#1 (delete) Confirm Delete Book: unsupported: WHEN sentence requires click Delete and confirm deletion, exceeding two-step limit.
- REQ-5.6.1#1 (create) Fill out and Save Book with Shelf: unsupported: WHEN sentence requires click Create New Book, fill information, and click Save Book, exceeding two-step limit.
- REQ-6.1.1#1 (create) Save Page: unsupported: WHEN sentence requires click New Page, fill information, and click Save Page, exceeding two-step limit.
- REQ-6.1.2#1 (create) Save Draft: unsupported: WHEN sentence requires fill content and save draft, exceeding two-step limit.
- REQ-6.1.3#1 (delete) Delete Draft: unsupported: WHEN sentence requires open actions, click Delete Draft, and confirm, exceeding two-step limit.
- REQ-6.2.1#1 (create) Create Chapter: unsupported: WHEN sentence requires click New Chapter, fill information, and click Save Chapter, exceeding two-step limit.
- REQ-7.1#1 (read-list) Add to Recently Viewed: unsupported: Schema/source validation failed: [
  {
    "code": "custom",
    "message": "Exactly one WHEN group per original sentence; do not split comma/AND clauses",
    "path": []
  }
]
- REQ-7.2#1 (navigation) Quick Navigation from Recently Viewed: no-preparation-path: Cannot prepare homepage with recently viewed item without forbidden setup mutations.
- REQ-8.2#1 (navigation) Quick Navigation from Favorites: no-preparation-path: Cannot prepare homepage with favorite item without forbidden setup mutations.
- REQ-9.1#1 (navigation) Quick Navigation from Recently Updated: no-preparation-path: Cannot prepare homepage with recently updated item without forbidden setup mutations.
