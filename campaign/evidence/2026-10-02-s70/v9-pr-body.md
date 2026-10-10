An inherited stage workspace contains read-only task documents and reference images alongside the application. These consumed the source snapshot's 2 MiB limit: the observed Stage2 run exited before any model call even though the application itself was only 83 KB.

Exclude the workspace-root `requirements/` from model source snapshots and reject draft/repair writes to it. Preserve its files unchanged during publication. Nested application assets with the same directory name remain in scope; the source size limit is unchanged.

Validation: 280 one-shot tests completed (3 optional skips), 226 legacy tests completed (12 optional skips), no failures. A real upgrade of the failed workspace now completes, preserves all 29 input files byte-for-byte, and retains every previously passing Stage1 diagnostic (28/31 before and after); the new stage passes 26/31 fixed independent checks. The optional source audit returned invalid JSON, so no source-audit success is claimed. The changed diff and 21-file agent package pass secret scans.

No formal submission was replaced. The current submission's completed Sheet87 and S102.28 result are recorded separately from local upgrade evidence.
