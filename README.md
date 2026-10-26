# ThryveMS platform console

Frontend-only **design preview** for two management workspaces, using the visual reference of ThryveMS: Public Sans, dark console sidebar, surface/card tokens, status labels and sentence-case wording.

## Workspaces

- **Developer:** Overview, Organisations, Deployments (Production, Sandboxes, Monitoring), Releases (Release registry, Per-client history), Finance (Overview, Revenue, Costs, Shared profit reporting, Allocations, Pricing, Subscriptions, Enterprise projects, Distributions), Requests, Logs, Background jobs, Support reports, Support access and Platform team (Team, Permissions, Change history, Settings).
- **Business Partner:** Overview, Clients (Clients, Subscriptions and seats, Enterprise projects), Finance (Overview, Revenue and expenses, Shared profit reporting, Invoices, Distributions, Reports), Requests and Business settings.

## One financial model

Both workspaces read one ledger (`data.js`) through one calculation (`finance.js`):
net profit = recognised revenue − recognised expenses ± approved adjustments. There is no separate
"partner profit". Partners see the same totals and categories; records of clients assigned to other partners
show their amounts but hide their details. Distribution (30% Developer, 70% Business Partners together) starts
from that same net profit and is shown separately. Individual partner percentages are not decided and are not shown.

Use the **Preview, view as** selector to switch roles. It is not authentication. All records are synthetic and
bundled into the frontend. Sandboxes, requests and other preview changes are stored in this browser under
`thryvems.console.preview.v2`. Nothing provisions, deploys, bills or opens a client workspace.

## Development

Node.js 22:
- npm install
- npm run typecheck — JavaScript syntax check
- npm run build — copies the page, modules and logo assets to dist/
- npm run e2e — Playwright browser tests after the build (needs Chromium)

The GitHub Check workflow runs these and collects screenshots. Until it passes, the UI PR is not complete.

## Security and architecture

Production must enforce Cloudflare Access + WorkOS passkey, server permissions and partner assignments, independent environment credentials and immutable client/environment identity. Never infer access from the preview selector or client id. Provisioning and rollback need approvals, idempotency, test gates and an audit record. Sandboxes must use synthetic or explicitly authorized sanitized data, never copy live QMS data or secrets. See the linked change-management record in dbauto/thryvems-backend.

Do not deploy this frontend preview as a live platform console.
