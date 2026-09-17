## Round 20750 — Worker-independent D1 reduction

This change is intentionally separated from PR #1 so it can be tested without depending on a new Worker build.

### Changes
- Inbound version polling 5s -> 10s (same existing endpoint/callback, no new API)
- Cache Admin `/api/admin/data-usage` 10 minutes per browser session
- Cache Admin `/api/admin/data-inspector` 10 minutes per source
- Cache archive/cleanup history 60 seconds
- Reload/retry explicitly bypasses relevant cache
- Archive/cleanup write actions clear history cache
- Service Worker cache bumped for delivery

### Excluded on purpose
- No Queue changes
- No Operations changes
- No Worker changes
- No cache for cleanup/archive preview or diagnostics/readiness

### Safety
This branch starts directly from current `main` and does not contain the Worker-dependent Queue/Operations changes from PR #1.

### Test
After approval, merge this safe PR first and observe D1 Rows Read for at least 30 minutes with Dashboard/Datatable disabled. Full Queue optimization remains blocked until current Worker `/api/vehicles/active-version` is verified lightweight.
