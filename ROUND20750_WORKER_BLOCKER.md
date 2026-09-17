# Round 20750 — Worker blocker evidence

Historical repository source before `worker.js` was deleted on 2026-08-16 shows that `/api/vehicles/active-version` used a multi-table aggregate query:

- `COUNT(*)` active vehicles
- `MAX(vehicles.updated_at)`
- `COUNT(*)` active `workflow_events` joined to vehicles
- `MAX(doors.updated_at)` and active door count
- `MAX(alert_rules.updated_at)`
- default workflow updated time
- plus an `alertTick` that changed every 30 seconds

This historical implementation is **not** acceptable as the long-term lightweight version endpoint for Queue/Operations/Inbound polling. It can force version changes even without operational data changes and can repeatedly scan more rows than necessary.

## Required Worker target before full D1 optimization PR can merge

Use a persisted runtime version value (for example a row in `system_settings`) that is updated only when relevant operational/configuration data changes. The GET `/api/vehicles/active-version` hot path should read only the auth/session rows required by the current security model plus a constant-size version row; it must not count or aggregate historical tables on every poll.

Relevant mutations must bump the runtime version after successful changes, including Gate sync changes that affect active vehicles, Inbound workflow actions, receiving start/complete/reject, document return, queue call/recall/door change, Gate Out, and queue/workflow/door/alert settings that change the display result.

## Acceptance criteria

1. No `COUNT(*)` over `workflow_events`, `queue_calls`, or full vehicle history in `active-version`.
2. No time-based version tick that changes when data has not changed.
3. Queue snapshot can be cached/reused by multiple display screens for the same server version.
4. D1 metadata/analytics shows version checks remain constant-size as data history grows.
5. One-screen queue test for 30–60 minutes before three-screen test.
