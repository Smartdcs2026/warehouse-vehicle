# Round 20756 — Login credential clear + R5 canary next steps

## Frontend login/logout fix

Prepared on branch `test/d1-worker-r5-round20751` only. `main` is untouched.

Updated `index.html` so that when the app transitions from an authenticated view back to the login view, the login form is reset and both username/password inputs are cleared again after short delays. This is specifically to counter browser/password-manager autofill immediately after logout on shared workstations.

The fix also restores the password input type to `password`, resets the Show/Hide label, and disables autocomplete for the remainder of that logged-out page session.

Commit: `62283ad027c2b4a0437be8d20a633a537066c70b`

## Current Worker canary state from the latest screenshot

- R5 version `9d3ec22e` target traffic: 10%
- Previous production `7d739a07` target traffic: 90%
- Observed traffic in screenshot: R5 1.9%, old version 98.1%
- Error rate: 0% on both versions
- R5 median CPU shown: 3.51 ms
- Old version median CPU shown: 7.99 ms

Observed traffic is still a small sample; do not treat the CPU comparison as conclusive yet.

## Next checkpoint before increasing traffic

Keep the canary at 10%. Collect:

1. Worker Observability screenshot after more real usage.
2. D1 `warehouse-vehicle-flow` Overview screenshot showing Rows read, Rows written, Total queries using the same Last 24 hours range as the baseline.
3. Confirm no user-facing errors in Login, Inbound, Receiving, and one Queue display.

Baseline before canary from screenshot:

- Rows read: 132k
- Rows written: 9k
- Total queries: 7k

Do not increase to 25/50/100% until those checkpoints are reviewed.