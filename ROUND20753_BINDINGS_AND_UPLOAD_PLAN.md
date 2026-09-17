# Round 20753 — Bindings inventory and safe Version-only upload plan

## Bindings confirmed from Cloudflare Dashboard
Visible connected resource bindings for `warehouse-vehicle-flow-api`:

- D1 `APPOINTMENT_DEV_DB` -> `warehouse-vehicle-appointment-dev`
- R2 `ARCHIVE_BUCKET` -> `warehouse-vehicle-archive`
- D1 `DB` -> `warehouse-vehicle-flow`
- R2 `VOICE_BUCKET` -> connected (bucket value not fully visible in the submitted screenshot, so do not guess it)

Do not expose or copy secret values into GitHub/chat.

## Why not upload R5 with an ad-hoc Wrangler config
Worker versions include code, bindings and compatibility settings. The R5 test version must preserve the production Worker's remote configuration. Manually recreating the config from screenshots is risky because D1 IDs, secret bindings, compatibility flags or other remote settings may be omitted.

## Safe path
1. Use Wrangler `init --from-dash warehouse-vehicle-flow-api` to fetch an initialized local project/config from the existing Dashboard Worker.
2. Verify the generated Wrangler config contains the expected D1/R2 binding names before any upload.
3. Replace only the fetched Worker entry-point code with the verified R5 candidate.
4. Run `npx wrangler versions upload ... --strict --keep-vars` (Version-only, not `wrangler deploy`).
5. Confirm a new R5 entry appears under Version History and the active Production deployment remains unchanged at 100% traffic.
6. Test the new version via version Preview URL / preview alias.
7. Only after smoke tests and D1 rows-read checks pass, create a controlled split deployment for the one-screen Queue pilot.

## Required checks before upload
- `npx wrangler --version`
- `npx wrangler whoami`
- generated config is for Worker `warehouse-vehicle-flow-api`
- expected bindings exist: `APPOINTMENT_DEV_DB`, `ARCHIVE_BUCKET`, `DB`, `VOICE_BUCKET`
- no secrets are printed or copied
- command used is `versions upload`, never `deploy`

## Pilot order
1. `/api/health/revision`
2. login
3. `/api/vehicles/active-version`
4. idle > 60s: version must stay stable when no operational/config data changed
5. queue call / recall / notice: version must change after successful mutation
6. Inbound / Receiving / Gate sync smoke test
7. inspect D1 rows read
8. Queue 1 screen 30–60 min
9. Queue 3 screens 30–60 min
10. only then consider merge/canary

Production `main` and current Worker deployment must remain untouched until the above passes.
