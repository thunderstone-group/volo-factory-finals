| Local \ Official | pass | fail |
|---|---:|---:|
| pass | 11 | 2 |
| fail | 7 | 7 |
| unknown | 4 | 1 |

Denominator: 32; official-pass recall: 50.0%; false passes: 2; unknown: 5; acceptance: FAIL.

- REQ-2.1#1 (read-list) Note Listing: ambiguous-assertion: The exact section heading or visual separator text for pinned vs regular notes is not declared in the contract exact-text list, so the two seeded cards are asserted individually.
- REQ-2.6.1#1 (edit) Change note color: unsupported: The change to a light green background cannot be asserted with the available primitives (no style/color inspection), so this part of the THEN clause is unobservable.
- REQ-2.6.2#1 (create) Choose note color when created: unsupported: The selected light green color of the created note cannot be asserted with available primitives (no style/color inspection).
- REQ-3.2#1 (search-filter-sort) Search by keyword: unsupported: Highlighting of matching text cannot be observed via DOM text assertions.
- REQ-6.1#1 (navigation) Items and styling: ambiguous-assertion: Consistent icons and alignment styling cannot be verified via text/DOM observations.
