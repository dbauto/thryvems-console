# ThryveMS platform console

Frontend-only **design preview** for two management workspaces, using the visual reference of ThryveMS: Public Sans, dark console sidebar, surface/card tokens, status labels and sentence-case wording.

## Workspaces

- Developer: Overview, Organisations, Deployments, Releases, Finance (actual expenses) and Platform team. Preview a per-client sandbox, select a version, compare labels and remove local preview records.
- Business partner: Overview, assigned Clients and Finance (allocated business expenses, not actual infrastructure costs). Partner A and Partner B show separate synthetic accounts.

Use the **Preview, view as** selector to see the designs. It is not authentication. All records and costs are synthetic, bundled into the frontend and visible in its source code. No real secrets, client files, deployment URLs, account integrations or QMS records are present.

New preview sandbox entries are stored locally under key thryvems.console.demo.v1. Nothing provisions, clones a live client database, sends a message or promotes an application version.

## Development

Node.js 22:
- npm install
- npm run typecheck — JavaScript syntax check
- npm run build — copies validated static assets to dist/
- npm run e2e — Playwright browser tests after the build (needs Chromium)

The GitHub Check workflow runs these and collects screenshots. Until it passes, the UI PR is not complete.

## Security and architecture

Production must enforce Cloudflare Access + WorkOS passkey, server permissions and partner assignments, independent environment credentials and immutable client/environment identity. Never infer access from the preview selector or client id. Provisioning and rollback need approvals, idempotency, test gates and an audit record. Sandboxes must use synthetic or explicitly authorized sanitized data, never copy live QMS data or secrets. See the linked change-management record in dbauto/thryvems-backend.

Do not deploy this frontend preview as a live platform console.
