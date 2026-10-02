# Release check

Run `npm ci`, `npm audit --audit-level=high`, and `npm run verify` before deployment. The same checks run on pushes and pull requests in GitHub Actions. Node 20.9 or later is required.

The order upgrade adds a database function and an index when the app first opens the orders schema. It leaves existing tables and orders intact. Use a separate staging database copied from production data, with Paystack test keys, to check:

- Product edits and visibility in the existing admin and storefront.
- Two checkouts for the last unit: one succeeds, one gets a stock error.
- A multi-product checkout with one unavailable item: no stock or order changes.
- A test payment, return page, webhook retry, order tracking, and reconciliation.
- A manual admin order and duplicate submission with the same request ID.

After release, watch failed checkout requests, payment confirmations awaiting reconciliation, and stock-release errors. If the application must be rolled back, redeploy the previous build. The new function and index can stay in place; old code does not call the function. Do not roll back order data or stock counts while paid orders may still be settling.
