| Local \ Official | pass | fail |
|---|---:|---:|
| pass | 0 | 1 |
| fail | 5 | 1 |
| unknown | 6 | 21 |

Denominator: 34; official-pass recall: 0.0%; false passes: 1; unknown: 27; acceptance: FAIL.

- REQ-1.2#1 (read-list) Back to Homepage from Other Pages: unsupported: Schema/source validation failed: [
  {
    "code": "custom",
    "message": "Click must name an original verb or quoted literal: BookStack logo",
    "path": []
  }
]
- REQ-2.2#1 (create) Log In Successfully: unsupported: Single WHEN sentence contains four distinct operations exceeding the two-step maximum.
- REQ-3.1#1 (read-list) Enter Authenticated Homepage: no-preparation-path: Cannot reach authenticated homepage because login workflow exceeds the two-step WHEN cap.
- REQ-4.3.1#1 (create) Create Shelf: unsupported: Create workflow requires more than two operations in a single WHEN sentence.
- REQ-4.3.2#1 (create) Cancel Creation: no-preparation-path: Cannot navigate to shelf creation page within allowed GIVEN steps.
- REQ-4.4.1#1 (delete) Confirm Delete Shelf: unsupported: Delete confirmation spans multiple pages requiring more than two steps in one sentence.
- REQ-4.4.2#1 (delete) Cancel Delete Shelf: no-preparation-path: Cannot prepare delete confirmation page state within allowed GIVEN navigation.
- REQ-4.5.1#1 (edit) Save Shelf Edits: unsupported: Edit workflow requires more than two operations in a single WHEN sentence.
- REQ-4.5.2#1 (edit) Cancel Shelf Edits: no-preparation-path: Cannot prepare shelf edit page state within allowed GIVEN navigation.
- REQ-5.3.1#1 (create) Fill out and Save Book: unsupported: Create workflow requires more than two operations in a single WHEN sentence.
- REQ-5.3.2#1 (create) Cancel Creating Book: no-preparation-path: Cannot navigate to create new book page within allowed GIVEN steps.
- REQ-5.4.1#1 (edit) Save Book Edits: unsupported: Edit workflow requires more than two operations in a single WHEN sentence.
- REQ-5.4.2#1 (edit) Cancel Book Edits: no-preparation-path: Cannot prepare book edit page state within allowed GIVEN navigation.
- REQ-5.5.1#1 (delete) Confirm Delete Book: unsupported: Delete confirmation spans multiple pages requiring more than two steps in one sentence.
- REQ-5.5.2#1 (delete) Cancel Delete Book: no-preparation-path: Cannot prepare delete confirmation page state within allowed GIVEN navigation.
- REQ-5.6.1#1 (create) Fill out and Save Book with Shelf: unsupported: Create workflow requires more than two operations in a single WHEN sentence.
- REQ-6.1.1#1 (create) Save Page: unsupported: Create workflow requires more than two operations in a single WHEN sentence.
- REQ-6.1.2#1 (create) Save Draft: unsupported: Draft save requires filling content and clicking an unnamed save draft control, ambiguous within 2 steps.
- REQ-6.1.3#1 (delete) Delete Draft: unsupported: Delete draft workflow requires more than two operations in a single WHEN sentence.
- REQ-6.2.1#1 (create) Create Chapter: unsupported: Create workflow requires more than two operations in a single WHEN sentence.
- REQ-6.3.1#1 (navigation) Enter Page Reading Page: no-preparation-path: Cannot prepare a page list view within allowed GIVEN navigation without prior creation workflows.
- REQ-6.3.2#1 (edit) Redirect to Page Edit Page: no-preparation-path: Cannot prepare page reading page state within allowed GIVEN navigation.
- REQ-7.1#1 (state-toggle) Add to Recently Viewed: ambiguous-assertion: WHEN sentence provides multiple alternative navigation targets that cannot be resolved to a single executable path.
- REQ-7.2#1 (navigation) Quick Navigation from Recently Viewed: no-preparation-path: Cannot seed My Recently Viewed list within allowed GIVEN navigation.
- REQ-8.1#1 (state-toggle) Favorite Items: no-preparation-path: Cannot reach a supported content view to favorite without authentication and prior navigation exceeding limits.
- REQ-8.2#1 (navigation) Quick Navigation from Favorites: no-preparation-path: Cannot seed My Most Viewed Favorites list within allowed GIVEN navigation.
- REQ-9.1#1 (navigation) Quick Navigation from Recently Updated: no-preparation-path: Cannot seed Recently Updated Pages list within allowed GIVEN navigation.
