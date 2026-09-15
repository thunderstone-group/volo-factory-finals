| Local \ Official | pass | fail |
|---|---:|---:|
| pass | 3 | 0 |
| fail | 2 | 2 |
| unknown | 6 | 21 |

Denominator: 34; official-pass recall: 60.0%; false passes: 0; unknown: 27; acceptance: FAIL.

- REQ-1.2#1 (navigation) Back to Homepage from Other Pages: ambiguous-assertion: Click name 'BookStack logo' is not a bare action verb or quoted literal; cannot compile.
- REQ-2.2#1 (navigation) Log In Successfully: unsupported: WHEN sentence requires fill email, fill password, check Remember Me, and click Login, exceeding two-step limit.
- REQ-3.1#1 (read-list) Enter Authenticated Homepage: unsupported: WHEN sentence describes system navigation, not user actions; no valid steps.
- REQ-4.3.1#1 (create) Create Shelf: unsupported: WHEN sentence requires click New Shelf, fill information, and click Save Shelf, exceeding two-step limit.
- REQ-4.3.2#1 (read-list) Cancel Creation: unsupported: Schema/source validation failed: [
  {
    "code": "custom",
    "message": "GIVEN navigation name absent from requirements: Shelf\\s+4\\.3\\.2",
    "path": []
  }
]
- REQ-4.4.1#1 (delete) Confirm Delete Shelf: unsupported: WHEN sentence requires click Delete and confirm deletion, exceeding two-step limit.
- REQ-4.4.2#1 (read-list) Cancel Delete Shelf: unsupported: Schema/source validation failed: [
  {
    "code": "custom",
    "message": "GIVEN navigation name absent from requirements: Shelf\\s+4\\.4\\.2",
    "path": []
  }
]
- REQ-4.5.1#1 (edit) Save Shelf Edits: unsupported: WHEN sentence requires click Edit, update information, and click Save Shelf, exceeding two-step limit.
- REQ-4.5.2#1 (read-list) Cancel Shelf Edits: unsupported: Schema/source validation failed: [
  {
    "code": "custom",
    "message": "GIVEN navigation name absent from requirements: Shelf\\s+4\\.5\\.2",
    "path": []
  }
]
- REQ-5.2.2#1 (read-list) Enter Book Details Page through Shelf Details Page: unsupported: Schema/source validation failed: [
  {
    "code": "custom",
    "message": "GIVEN navigation name absent from requirements: Shelf\\s+5\\.2\\.2",
    "path": []
  }
]
- REQ-5.3.1#1 (create) Fill out and Save Book: unsupported: WHEN sentence requires click Create New Book, fill information, and click Save Book, exceeding two-step limit.
- REQ-5.4.1#1 (edit) Save Book Edits: unsupported: WHEN sentence requires click Edit, update information, and click Save Book, exceeding two-step limit.
- REQ-5.4.2#1 (read-list) Cancel Book Edits: unsupported: Schema/source validation failed: [
  {
    "code": "custom",
    "message": "GIVEN navigation name absent from requirements: Book\\s+5\\.4\\.2",
    "path": []
  }
]
- REQ-5.5.1#1 (delete) Confirm Delete Book: unsupported: WHEN sentence requires click Delete and confirm deletion, exceeding two-step limit.
- REQ-5.5.2#1 (read-list) Cancel Delete Book: unsupported: Schema/source validation failed: [
  {
    "code": "custom",
    "message": "GIVEN navigation name absent from requirements: Book\\s+5\\.5\\.2",
    "path": []
  }
]
- REQ-5.6.1#1 (create) Fill out and Save Book with Shelf: unsupported: WHEN sentence requires click Create New Book, fill information, and click Save Book, exceeding two-step limit.
- REQ-6.1.1#1 (create) Save Page: unsupported: WHEN sentence requires click New Page, fill information, and click Save Page, exceeding two-step limit.
- REQ-6.1.2#1 (create) Save Draft: unsupported: WHEN sentence requires fill content and save draft, exceeding two-step limit.
- REQ-6.1.3#1 (delete) Delete Draft: unsupported: WHEN sentence requires open actions, click Delete Draft, and confirm, exceeding two-step limit.
- REQ-6.2.1#1 (create) Create Chapter: unsupported: WHEN sentence requires click New Chapter, fill information, and click Save Chapter, exceeding two-step limit.
- REQ-6.3.1#1 (read-list) Enter Page Reading Page: unsupported: Schema/source validation failed: [
  {
    "code": "custom",
    "message": "GIVEN navigation name absent from requirements: Book\\s+6\\.3\\.1",
    "path": []
  }
]
- REQ-6.3.2#1 (read-list) Redirect to Page Edit Page: unsupported: Schema/source validation failed: [
  {
    "code": "custom",
    "message": "GIVEN navigation name absent from requirements: Book\\s+6\\.3\\.2",
    "path": []
  },
  {
    "code": "custom",
    "message": "GIVEN navigation name absent from requirements: Page\\s+6\\.3\\.2",
    "path": []
  }
]
- REQ-7.1#1 (read-list) Add to Recently Viewed: unsupported: Schema/source validation failed: [
  {
    "code": "custom",
    "message": "GIVEN navigation name absent from requirements: Shelf\\s+7\\.1",
    "path": []
  },
  {
    "code": "custom",
    "message": "Exactly one WHEN group per original sentence; do not split comma/AND clauses",
    "path": []
  }
]
- REQ-7.2#1 (navigation) Quick Navigation from Recently Viewed: no-preparation-path: Cannot prepare homepage with recently viewed item without forbidden setup mutations.
- REQ-8.1#1 (read-list) Favorite Items: unsupported: Schema/source validation failed: [
  {
    "code": "custom",
    "message": "GIVEN navigation name absent from requirements: Book\\s+8\\.1",
    "path": []
  }
]
- REQ-8.2#1 (navigation) Quick Navigation from Favorites: no-preparation-path: Cannot prepare homepage with favorite item without forbidden setup mutations.
- REQ-9.1#1 (navigation) Quick Navigation from Recently Updated: no-preparation-path: Cannot prepare homepage with recently updated item without forbidden setup mutations.
