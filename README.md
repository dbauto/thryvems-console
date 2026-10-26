# ThryveMS platform console

Frontend **design preview** of the Developer Console and the Business Partner workspace, in the ThryveMS visual system (Public Sans, dark console sidebar, existing tokens and card style B). All records are synthetic and bundled in the source.

- **Developer Console**: Overview, Organisations, Deployments (production, per-client sandboxes, monitoring), Releases, Finance (actual costs, allocations, pricing, subscriptions, enterprise projects, distributions), Requests, Logs, Background jobs, Support reports, Support access, Platform team.
- **Business workspace**: Overview, Clients, Finance (the same shared business profit as the Developer; other partners' client details hidden), Requests, Business settings, for the partner's assigned clients.

Use **Preview, view as** to switch between the platform owner, Partner A, Partner B and a client user. It is a simulation, not authentication. **Data state** shows the loading, empty and error states.

Nothing is provisioned, deployed, invoiced, paid or sent. Cloud-dependent steps are labelled Simulation or shown disabled with the reason. Preview changes are kept in this browser under `thryvems.console.v2` (no secrets).

## Development

Node.js 22, no runtime dependencies:

- `npm install`
- `npm run typecheck` — parses every file and links every module
- `npm run unit` — finance calculation tests
- `npm run build` — copies the static preview to `dist/` and refuses secrets or network calls
- `npm run e2e` — Playwright browser tests (needs Chromium)

See `plan/console-design.md` (navigation, decisions, backend impact) and `plan/requirements-matrix.md` (traceability). Do not deploy this preview as a live console.
