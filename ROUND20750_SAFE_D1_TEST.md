# Round 20750 — Safe D1 reduction before Worker changes

This branch intentionally avoids Queue and Operations version-gating until the deployed Worker `/api/vehicles/active-version` query is verified lightweight.

## Included
- Inbound version polling: 5s -> 10s (same existing callback/guards; no new endpoint)
- Cache `/api/admin/data-usage` for 10 minutes per browser session
- Cache `/api/admin/data-inspector?...` for 10 minutes per source, max 4 entries
- Cache `/api/admin/archive-history` and `/api/admin/cleanup-history` for 60 seconds
- Explicit reload/retry buttons bypass/clear their caches
- Archive/cleanup mutations clear history cache immediately

## Not included
- No Queue changes
- No Operations changes
- No Worker changes
- No cache for `cleanup-preview`, `archive-preview`, diagnostics, readiness, or any write/action endpoint

## Production test order after approval
1. Login on one admin browser.
2. Confirm Inbound still refreshes after a real vehicle/status change.
3. Open Admin > Data Usage twice within 10 minutes; second visit should reuse browser cache.
4. Open Data Inspector/Structure twice; second visit should reuse browser cache.
5. Keep Dashboard and Datatable disabled during the D1 observation window.
6. Observe Cloudflare D1 Rows Read before/after for at least 30 minutes.

## Rollback
Revert to main commit `35820734aca835e2ae97e134667c1fbd25525e3a` or close this PR without merging.
