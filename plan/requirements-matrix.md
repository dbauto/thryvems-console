# Requirements traceability matrix

Console completion, 24 Oct 2026, branch `feat/console-complete-20261024`. Source brief: "Complete ThryveMS Developer & Business Partner Console" (sections §1–§14).

Status: **Done** = works on synthetic data and is covered by a test or checked in the browser crawl; **Simulated** = cloud-dependent step modelled honestly, never shown as real; **Unavailable** = visible, disabled, with the reason; **Deferred** = not built in this phase (backend or decision needed).

Tests: `U` = `tests/finance.test.mjs` (node:test), `E` = `tests/console.spec.mjs` (Playwright), `C` = route crawl (all 58 routes, zero script errors, run during development).

## Audit findings (Phase A)

| Finding | Action |
|---|---|
| Console PR #1 merged: 6 Developer + 3 Partner pages, flat client record mixing revenue, allocated and infra costs | Rebuilt as modules with separate ledgers; all figures derived |
| PR #1 dropped the approved platform pages Requests, Logs, Background jobs, Support reports, Support access (client app `pages/platform`, plan v3 §4) | Restored; menu approved by owner in this session |
| Client PR #35 open, unmerged (same features inside the client app) | Not duplicated; console repo is the platform console. Reconcile #35 by closing or narrowing it (owner decision) |
| Backend PR #14 draft, issue #13 open | Extended on the same branch (no duplicate record) |
| `UI-GUIDELINES.md` §10 screenshot gate removed 24 Oct, but the brief asks for screenshots | Screenshots produced (brief is newer and explicit) |
| Plan v3 §43 seat counting default "per active user"; brief says base 10 users + purchased seats | Conflict recorded (D-1). Preview bills purchased seats; allocations use active users |
| Plan v3 §29 defines one shared nightly-reset `sandbox` environment; brief needs per-client sandboxes with retention | Conflict recorded (D-2). Designed as per-client, synthetic-only, Neon Launch organisation |
| Approved plan (21 Oct) says partner view "isn't a payout or profit share"; brief adds 30/70 distribution | Both kept: contribution ≠ payout; pool 30/70 shown only in published statements (D-3) |
| Distribution pool totals reveal aggregate revenue of other partners' clients | Partners see pool totals only after the owner publishes a statement (D-3) |

## Developer Console

| § | Requirement | Screen / interaction | Test | Status |
|---|---|---|---|---|
| 3.1 | Clients total, active, trial, pending provisioning | Overview › Clients cards → Organisations filtered | E record-derived, C | Done |
| 3.1 | Production deployments, sandboxes, warnings/failures, versions, pending updates | Overview › Deployments cards, Current versions card | C | Done |
| 3.1 | Subscription revenue, infra, other opex, actual profit, margin, developer 30% | Overview › Finance cards, Developer profit allocation card | U, C | Done |
| 3.1 | Recent activity, support incidents, release approvals | Needs attention, Recent activity, release-approvals card | C | Done |
| 3.1 | Filters period / client / status; cards navigate | Period, searchable client, account status; cards are links | E | Done |
| 3.2 | Create, edit, assign partner, plan, seats, modules | Organisations › Create; detail › Edit details, Change partner, Subscription, Modules | E | Done |
| 3.2 | Subscription, deployment status, version, history, search/filter | Organisation tabs Summary, Subscription, Deployment, History; list search + 3 filters | E, C | Done |
| 3.2 | Archive eligible inactive accounts; never silently archive live deployments | Archive dialog with blocker reasons | C | Done |
| 3.2 | Separate account and deployment lifecycles (7 account states) | Account lifecycle track vs deployment track | E | Done |
| 3.2 | Effective date, reason, audit on plan/seat/assignment | All change sheets; Change history | E | Done |
| 3.3 | Deployment list (13 columns) | Deployments › Production | C | Done |
| 3.3 | Deployment detail (production, sandboxes, releases, config, modules, health, failures, logs, usage, cost) | Deployment detail, 7 tabs | C | Done |
| 3.3 | Guided provisioning: configure, validate, review, status | Request provisioning wizard → approve → simulation (pass/fail), retry, cancel | E | Simulated (never sets Live) |
| 3.4 | Create sandbox for any live client with all fields, searchable client | Create sandbox sheet (from Deployments, organisation, deployment, support report) | E | Done |
| 3.4 | Synthetic data, no production records/secrets, production unchanged | Fixed "Synthetic sample data only"; config limited to non-secret keys | E, C | Done |
| 3.4 | Detail sections: overview, versions, config, changes, issue, tests, builds, health, compare, readiness, cleanup | Sandbox detail, 7 tabs | E | Done |
| 3.4 | Lifecycle: Requested … Retired (9 states) | Lifecycle track, status filter | E | Simulated provisioning |
| 3.4 | Actions: create, open, change version, record issue, tests, compare, submit, readiness, promote, retire | All present; Run tests and Open sandbox app Unavailable | E | Done / Unavailable |
| 3.5 | Release registry (10 fields) | Releases › Release registry | C | Done |
| 3.5 | Per-client release history (9 fields) | Releases › Per-client history; deployment Release history | C | Done |
| 3.5 | Workflow, owner approval, no automatic deploy, controlled rollback | Workflow track; Approve release needs validated sandbox; Deploy / Roll back disabled | E | Done / Unavailable |
| 3.6 | Monitoring by client and consolidated; actual vs estimate vs unavailable vs disconnected | Deployments › Monitoring | C | Done (usage Unavailable: providers not connected) |
| 3.7 | Actual costs, categories, direct vs shared, financial dashboard, per-client, MoM, 30% | Finance › Overview, Costs, Revenue | U, E | Done |
| 9 | Requests, Logs, Background jobs, Support reports, Support access, Platform team, Change history, Settings | Restored menu items; Platform team tabs | E, C | Done |

## Business Partner Console

| § | Requirement | Screen / interaction | Test | Status |
|---|---|---|---|---|
| 4.1 | 13 overview figures; month/quarter/year/client filters | Business overview | E | Done |
| 4.2 | Assigned clients, contact, plan, seats, billing, invoices, history, live/not live | Clients (3 tabs), client detail (5 tabs) | E | Done |
| 4.2 | Subscription change requests within authority; customization requests | Request sheets; owner decides in Requests | E | Done |
| 4.2 | Restrictions; unauthorized records absent from lists, search, counts, details | `scopeClients("biz")` everywhere; Not found | E | Done |
| 4.3 | Business revenue, per client, allocated, reported profit, margin, by period | Finance › Overview, Reports | U, E | Done |
| 4.3 | Developer configures allocated expenses; auditable; distinct from actual | Developer Finance › Allocations | U | Done |
| 4.4 | 30/70 of distributable profit; summary fields; no invented partner shares | Developer Finance › Distributions; Partner Finance › Distributions | U | Done |
| 9 | Overview, Clients, Finance, Requests, Business settings | Menu + footer link | C | Done |

## Cross-cutting

| § | Requirement | Where | Test | Status |
|---|---|---|---|---|
| 2 | Preview role, clearly not authentication; Developer may inspect partner view read-only | "Preview, view as"; Inspection view | E | Done |
| 5 | Plan catalog, pricing config, base 10, extra rate, min 1, cycles, history, renewals, adjustments; capacity tiers separate; ₱150,000 enterprise | Finance › Pricing, Subscriptions | U, E | Done (prices illustrative) |
| 5 | Enterprise projects (13 fields), milestones, revenue | Finance › Enterprise | C | Done |
| 6 | Future payment UI: methods, pay, processing, success, failure, pending, retry, references, history, refunds | Invoice sheet › Online payment (future phase) | E | Unavailable (design states only) |
| 7 | Identity architecture assessed, not replaced | Platform team › Settings; console-design.md | — | Done |
| 8 | Audit model (actor … outcome), confirmations, double-submit guard, no secrets in storage | `audit()`, `data-submit`, build secret scan | E | Done |
| 10 | Loading, empty, error, success, not found, confirm, search/filter/sort, responsive, keyboard, themes | Data state control, DataTable, dialogs with focus trap | E | Done |
| 11 | 50–100 clients: pagination 10/50/100, internal scroll | 60 synthetic organisations | E | Done |

## Deferred (backend or decision required)

- All real provisioning, sandbox creation, deployments, rollbacks, provider usage and billing imports, test execution, invoices sent, payments, emails, authentication (Cloudflare Access + WorkOS), server-side authorization.
- Partner's own business expenses (approved plan decision 4): not in the brief; not built.
- Period close and reopening workflow (approved plan decision 8): statements publish after month end; formal close not built.
- Individual partner shares within the 70% (not defined by the owner).
- Decisions D-1 to D-5 in `console-design.md`.
