# Round 20757 — D1 Rows Read Instrumentation (R6 preparation)

Date: 2026-09-17
Base branch: `test/d1-worker-r5-round20751`
New branch: `test/d1-worker-r6-round20757`
Current canary: R5 `9d3ec22e` at target 10%, production `7d739a07` remains the dominant observed traffic.

## Why this round exists

The current Cloudflare Observability events prove that both the old Worker and R5 return HTTP 200 / outcome `ok` for `/api/vehicles/active?page=receiving`, but `wallTimeMs` and `cpuTimeMs` do not tell us how many D1 rows are scanned.

The D1 dashboard increased from roughly 132k rows read before the canary checkpoint to roughly 2M rows read later in the rolling 24-hour view. The rolling window and rounded dashboard values mean this is not an exact delta, so the next decision must be based on per-query D1 metadata instead of timing alone.

Cloudflare D1 `D1Result.meta` exposes `rows_read`, `rows_written`, and database execution `duration` for statements executed with `.all()` / `.run()` and for batch results.

## Safety decision

- Keep R5 canary at 10%.
- Do not increase traffic while collecting instrumentation.
- Do not change schema in this round.
- Do not add indexes yet; first identify the expensive statement.
- Do not log credentials, Authorization headers, vehicle payloads, or personal data.
- Do not change response JSON returned to the frontend.
- Instrumentation is temporary and must be removable after diagnosis.

## Target endpoint

Primary target:

`GET /api/vehicles/active?page=receiving`

Secondary target if inexpensive to instrument at the same code location:

`GET /api/vehicles/active?page=inbound`

## Required log format

For every D1 statement used to build the response of the target endpoint, emit one compact JSON log entry only after the D1 call completes:

```js
console.log(JSON.stringify({
  tag: "D1_READ_DIAG",
  round: "20757",
  workerRevision: WORKER_REVISION,
  endpoint: "/api/vehicles/active",
  page,
  query: "<stable short label, not raw SQL>",
  rowsRead: Number(result?.meta?.rows_read || 0),
  rowsWritten: Number(result?.meta?.rows_written || 0),
  d1DurationMs: Number(result?.meta?.duration || 0)
}));
```

Use stable query labels such as:

- `active_vehicle_list`
- `active_vehicle_count`
- `door_lookup`
- `queue_state_lookup`
- `workflow_state_lookup`

Do **not** log raw SQL or bound values if those may contain vehicle/user information.

## Minimal helper (optional)

If the endpoint executes several `.all()` / `.run()` calls, add a tiny helper near the endpoint code:

```js
function logD1ReadDiag({page,query,result}){
  try{
    console.log(JSON.stringify({
      tag:"D1_READ_DIAG",
      round:"20757",
      workerRevision:WORKER_REVISION,
      endpoint:"/api/vehicles/active",
      page:String(page||""),
      query:String(query||"unknown"),
      rowsRead:Number(result?.meta?.rows_read||0),
      rowsWritten:Number(result?.meta?.rows_written||0),
      d1DurationMs:Number(result?.meta?.duration||0)
    }));
  }catch(_){ }
}
```

Then immediately after an existing D1 result:

```js
const result = await env.DB.prepare(SQL).bind(...args).all();
logD1ReadDiag({page,query:"active_vehicle_list",result});
```

or:

```js
const result = await env.DB.prepare(SQL).bind(...args).run();
logD1ReadDiag({page,query:"active_vehicle_list",result});
```

Do not replace `.first()` blindly. Cloudflare `.first()` returns the first row directly and does not return metadata. If the current endpoint uses `.first()`, do not alter that statement in this round until its behavior is reviewed separately.

## Important: batch() handling

If the endpoint uses `env.DB.batch([...])`, every returned item has its own `meta` object. Log each item with a fixed label:

```js
const results = await env.DB.batch(statements);
results.forEach((result,index)=>{
  logD1ReadDiag({page,query:`active_batch_${index+1}`,result});
});
```

If we know the statement order, replace the numeric labels with stable names before testing.

## Expected test procedure (Cloudflare UI only; no CMD)

1. Do not edit the deployed R5 version in place.
2. In Cloudflare Worker editor, create/save a new version based on the current R5 source.
3. Change only:
   - build/revision label to R6 diagnostic candidate
   - temporary D1 diagnostic logging around the `/api/vehicles/active` D1 calls
4. Save as a version only first; do not immediately promote to 100%.
5. Verify `/api/health/revision` returns the R6 diagnostic revision.
6. Authenticate through the HTTP tester.
7. Call exactly once:
   - `/api/vehicles/active?page=receiving`
8. In Observability filter for `D1_READ_DIAG` and record each `query` + `rowsRead`.
9. Repeat once for `page=inbound` only if needed.
10. Do not repeatedly refresh the endpoint while diagnosing, because that itself consumes D1 reads.

## Decision thresholds for the next round

These are diagnostic categories, not hard Cloudflare limits:

- Tiny: tens of rows/read — usually not the source of the 2M spike.
- Moderate: hundreds to low thousands/read — relevant if called every 10–15 seconds or from multiple screens.
- Large: many thousands/read per request — likely a primary candidate for query/index redesign.

The actual decision must use observed `rowsRead`, call frequency, and number of active screens together.

## What we already know from canary logs

Old production `7d739a07` receiving samples:

- wall 170 ms / CPU 5 ms
- wall 418 ms / CPU 14 ms

R5 `9d3ec22e` receiving samples:

- wall 234 ms / CPU 27 ms
- wall 105 ms / CPU 15 ms

These timing samples are not enough to attribute D1 usage. This round replaces timing guesswork with per-statement `rows_read`.

## Gate for any traffic increase

Do not increase R5/R6 traffic above 10% until:

1. R6 diagnostic test identifies the receiving endpoint rows read per statement.
2. Any unexpectedly large scan is understood or patched.
3. Observability remains at 0 worker errors for the test window.
4. Queue/Inbound/Receiving behavior remains functionally correct.

## Rollback

Production rollback target remains the currently known production version `7d739a07` if any diagnostic candidate causes functional errors. The diagnostic version itself should initially be tested through the Cloudflare HTTP tester before any split deployment.
