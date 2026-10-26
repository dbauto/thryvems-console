# Console design, decisions and backend impact

24 October 2026 · branch `feat/console-complete-20261024` · supersedes the PR #1 version of this file.

## Navigation (approved by the owner in this session, 24 Oct 2026)

**Developer Console** (`#/dev`): Overview · Organisations · Deployments (Production, Sandboxes, Monitoring) · Releases (Registry, Per-client history) · Finance (Overview, Revenue, Costs, Allocations, Pricing, Subscriptions, Enterprise, Distributions) · Requests · Logs · Background jobs · Support reports · Support access · Platform team (Team, Permissions, Change history, Settings). Requests to Support access are the approved platform pages from the client app restored, not new items.

**Business workspace** (`#/biz`): Overview · Clients (Clients, Subscriptions and seats, Enterprise projects) · Finance (Overview, Invoices, Distributions, Reports) · Requests · sidebar footer link Business settings.

Same dark console shell, Public Sans, existing tokens and card style B. Navigation within a menu stays in the same tab; tabs are links so each has an address.

## Structure

Static ES modules, no bundler and no dependencies (as PR #1): `src/seed.js` synthetic records (60 fictional organisations), `src/finance.js` pure calculations (unit-tested), `src/store.js` validated mutations + audit, `src/ui.js` building blocks, `src/pages/*` screens, `src/main.js` router and role guard. Preview data persists in `localStorage` key `thryvems.console.v2`; the v1 sandbox key is migrated once. No secrets are stored; the build fails if a module contains a key pattern or any network call.

## Honesty rules applied

- Account lifecycle and deployment lifecycle are separate. Provisioning simulation can pass but never sets a deployment Live.
- Sandboxes carry a Simulation badge, have no hostname, and use synthetic data only. Test results are recorded from CI, not run.
- Release approval records a decision. Production deployment and rollback are disabled with the reason.
- Health, logs and jobs are labelled sample data; provider usage is Unavailable; costs show their basis (Reconciled, Manual, Estimate, Not available). Missing values are "No data", never 0.
- Invoices and payouts are records; payment is a disabled future-phase design. No card data is requested.

## Decisions needed (conflicts recorded, approved rules preserved)

| # | Topic | Conflict | Preview behaviour | Recommendation |
|---|---|---|---|---|
| D-1 | Seat counting | Plan v3 §43: per active user per month. Brief: base subscription with 10 users + purchased seats | Invoices from purchased seats; allocations from active users | Adopt purchased seats for billing via ADR; keep active users for capacity and allocation |
| D-2 | Sandbox environments | Plan v3 §29: one shared `sandbox` env, nightly reset. Brief: per-client sandboxes with retention | Per-client, synthetic only, 1–30 day retention, max 3 active per client | ADR: per-client sandboxes in the Neon Launch organisation and a separate Cloudflare account or token scope (plan §24), still synthetic-only |
| D-3 | Distribution visibility | Pool totals reveal other partners' aggregate revenue to each partner | Partners see pool totals only in statements the owner publishes; otherwise only their clients' contribution | Confirm, or show partners only the combined 70% figure |
| D-4 | Distributable profit basis | One shared net profit for Developer and Partners: recognised revenue − recognised expenses (actual infrastructure, operating, recognised shared business) ± approved adjustments (owner decision 26 Oct 2026, backend ADR-004) | Decided; backend sync Pending | Confirm basis, tax treatment and reconciliation before real accounting |
| D-5 | Identity | Brief: centrally governed authentication under developer-controlled infrastructure | Matches plan v3 D9 (Cloudflare Access + WorkOS passkeys for platform principals); partners become platform principals with their own Access policy | Compatible; no architecture change requested. Record partner principals in the platform DB (backend PR #14) |
| D-6 | Payments | Brief wants future checkout; plan v3 D21 excludes payments from release 1 | Disabled future-phase design; PayMongo "under evaluation" | Separate architecture approval before any integration |

## Backend impact assessment — **Pending**

| Area | Impact |
|---|---|
| Schema | Platform DB: `client_accounts` (account status separate from deployment), `partner_assignments` (effective dates), `subscriptions` + `subscription_changes` (scheduled), `pricing_versions`, `deployments`, `provisioning_requests`, `provisioning_runs`, `sandboxes`, `sandbox_tests`, `sandbox_changes`, `releases`, `release_approvals`, `release_history`, `promotion_requests`, `invoices`, `invoice_lines` (service months), `payments`, `commercial_adjustments`, `actual_costs` (basis, FX, source), `allocation_formulas` (default + per client, revert markers), `shared_business_expenses`, `distribution_statements`, `distribution_adjustments`, `payouts`, `enterprise_projects`, `milestones`, `partner_requests`, `platform_settings`, `platform_audit` |
| Relationships | Partner ↔ client via dated assignments; sandbox → client + source deployment; promotion request → sandbox → release; milestone → invoice |
| APIs | `/papi/v1` Developer: all of the above. Partner audience: scope-filtered serializers with no actual-cost, allocation-formula-internal, deployment or sandbox fields; CSV exports from the same serializers |
| Workflows | Provisioning request → approve (re-auth) → run → Live/Failed → retry/cancel; sandbox Requested → … → Approved for release → promotion request → owner approval → trusted pipeline; statement draft → publish → payouts → paid |
| Permissions | Developer only: costs, allocations, deployments, sandboxes, releases, logs, settings. Partner: assigned clients, the shared profit totals and categories (other partners' client details hidden), own requests. Client users: none |
| Security | Server-side scope joins on every partner query; field-level leak tests; immutable client + environment identity; no production data or secrets in sandboxes; audit for every change |
| Integrations | Cloudflare, Neon, AWS billing imports (Reconciled basis); GitHub release provenance; FX source; future payment provider (not approved) |
| Events | `client_account.created`, `subscription.changed/scheduled`, `deployment.requested/approved/failed/live`, `sandbox.*`, `release.approved`, `promotion.requested/approved`, `allocation.changed`, `statement.published`, `payout.recorded` |
| Tests | Partner cross-scope denial on every endpoint and export; reconciliation property (per client + company-wide = shared net profit; identical in both workspaces); 30/70 never on gross revenue; closed-period immutability; "Not available" never 0 |

Linked change record: dbauto/thryvems-backend issue #13 and PR #14 (extended on its branch). Synchronization stays **Pending** until documented, verified and approved.
