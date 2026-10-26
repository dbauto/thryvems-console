# Console UI and backend impact

24 October 2026 — frontend design for dbauto/thryvems-console.

## Developer

- Dark platform navigation, organisations and client account/provisioning status.
- Per-client production version, isolated sandbox preview records and app version choice.
- Compare environment version labels; production promotion/rollback deliberately disabled until a qualified backend exists.
- Superseded 26 Oct 2026: finance now uses one shared ledger and one profit calculation for both workspaces (see progress and backend ADR-004).
- Platform team role-boundary explanation.
- All actions and numbers are illustrative; sandbox creation operates only in browser storage.

## Business partner

- Clients strictly assigned to the selected partner within the preview.
- Same company-wide revenue, expenses and net profit as the Developer; other partners' client details hidden; 30%/70% distribution shown separately.
- No deployment controls, sandbox controls, credentials or QMS records presented.
- Production must deliver server-filtered partner projections, not client-side filters.

## Backend impact assessment — Pending

| Area | Impact |
| --- | --- |
| Schema / relationships | Platform clients, partner assignments, environments, sandbox lineage, release history, approvals, cost ledgers and allocation policies |
| APIs | Role-scoped summaries; version registry; sandbox request, status and retirement; approval, promotion/rollback; finance reports |
| Workflows | Sandbox request → provision → test → review → owner approval → release / rollback |
| Permissions | Developer-only environments, actual costs and release controls; partners assigned-client business figures only |
| Security | Cloudflare Access + WorkOS, immutable client+environment identity, independent secrets/database, no production QMS copies |
| Integrations | Cloudflare Workers, Neon, GitHub builds/releases, monitoring and billing |
| Events | Provision requested/completed/failed, test verified, version promoted/rolled back, cost allocation changed |
| Tests | Cross-client negatives, assignment, environment isolation, idempotency, rollback, audits, browser role tests |

Backend synchronization is **Pending**, and server implementation is deferred. Link the backend architecture change PR before accepting the frontend PR.

## Quality

Check: typecheck, build and browser e2e. UI guide §10: no page overflow at 390/768/1280/1920, light/dark screenshots, access checks and manual review. Do not mark complete until checks and screenshots are verified.
