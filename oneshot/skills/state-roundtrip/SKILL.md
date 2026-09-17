---
name: state-roundtrip
description: Trace save decoding, store updates, and reopen or refresh consistency.
---

# State roundtrip

Use when saving appears successful but reopening or refreshing shows stale data.
Trace the submitted value through the server mutation, actual response decoder,
frontend store update, and the read path used to reopen the editor. Determine the
response shape from the selected server/client source and caller observations.
There is no mandated top-level or nested response envelope.

Decode the response once at the application boundary. Update the store with the
confirmed representation before rendering or reporting success. For example,
compare the decoded entity identity and changed field with the value read when
the same entity is reopened; then check the read used after refresh. Preserve
explicit clears when required, and retain relevant unrelated state when merging
partial responses. A successful HTTP status alone does not prove a correct save.

Evidence and limits: a local response-decoding mismatch motivated this diagnostic
sequence. It is not a universal backend schema or a demonstrated general repair.
Source inspection and a proposal cannot prove persistence, concurrency behavior,
or browser roundtrips. The caller must check the requested behavior independently.
