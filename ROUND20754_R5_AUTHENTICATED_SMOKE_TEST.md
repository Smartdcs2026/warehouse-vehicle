# Round 20754 — R5 authenticated smoke test without production traffic

Date: 2026-09-17
Worker candidate: `9d3ec22e` — `Candidate R5 Round20752 D1 Test`
Production deployment: `7d739a07` at 100%

## Decision
Do NOT use the Dashboard split-deployment dialog for this smoke test. The UI offered R5 at 10% and production at 90%, which would send real production requests to R5 before authenticated smoke testing is complete.

Keep production at `7d739a07 = 100%`.

Use the Cloudflare Edit code HTTP tester while `9d3ec22e Latest` is selected. This tester has already verified the candidate directly without changing production traffic.

## Already passed
- `GET /api/health/revision` → 200
  - build: `2026.09.17-round207.51-d1-constant-version`
  - workerRevision: `d1-free-plan-v160-candidate-20260917-r5`
- `GET /api/health` → 200
- `GET /api/voice/status` → 200, READY
- `GET /api/public/queue` without auth correctly rejected with `กรุณาเข้าสู่ระบบ`

## Next smoke test
Authenticate against the selected R5 version using the HTTP tester only.

1. POST `/api/auth/login`
2. JSON body: `{ "name": "<user enters locally>", "password": "<user enters locally>" }`
3. Do not share the password or a screenshot containing it.
4. Copy the returned `token` locally.
5. Test these endpoints with header `Authorization: Bearer <token>`:
   - `GET /api/vehicles/active-version`
   - `GET /api/vehicles/active`
   - `GET /api/public/queue`
6. Expected: HTTP 200, correct R5 response, no Production deployment change.
7. After test, call `POST /api/auth/logout` with the same Bearer token.

## Safety rules
- Do not click Deploy while smoke testing.
- Do not click Promote version.
- Do not click Split versions.
- Do not paste passwords or Bearer tokens into chat/GitHub.
- If a request fails, stop and inspect before any traffic shift.

## Gate before production canary
Only after authenticated endpoints pass do we consider a short 10% canary from the Dashboard. Before that canary, record D1 Rows Read baseline and prepare immediate rollback to `7d739a07`.
