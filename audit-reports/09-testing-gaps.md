# Testing gaps

## Existing tests and validation evidence

The repo includes meaningful checks in a few areas:

- `tests/unit/access.test.ts` for access normalization and merchant access rules
- `scripts/tests/stock-race.ts` for stock concurrency stress behavior
- standard project scripts for type checking and linting in `package.json`

## Gaps and risks

1. No complete end-to-end payment flow tests were proven in this audit
2. No verified webhook replay / deduplication tests for payment events
3. No explicit tenant-isolation test suite covering all store-scoped collections
4. No tested failed-checkout recovery scenarios proving inventory release under crash or timeout
5. No full refund/reconciliation tests tied to provider-verified payment events
6. No verified security tests covering admin access boundaries for all collections
7. No production-readiness suite proving environment config, backups, and restore compatibility

## Production readiness conclusion

A few focused checks exist, but the project still lacks a complete, production-grade verification suite for the business-critical path: checkout, stock, payment, and tenant access.
