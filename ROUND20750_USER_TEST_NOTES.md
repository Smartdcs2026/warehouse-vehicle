# User test notes

Do not change GitHub branch protection for this test.

The first safe production trial can begin only after explicit approval to merge the worker-independent safe PR. That trial does not change Queue or Worker behavior; it only reduces Inbound version-check frequency and avoids repeated Admin read-only queries.

The full Queue/Operations optimization must wait for current Worker source verification because historical Worker code shows the old `/api/vehicles/active-version` query was not lightweight.
