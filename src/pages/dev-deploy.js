/** Developer Console › Deployments: production registry, provisioning (simulated), monitoring. */
import { getData, clientById, deploymentFor, sandboxStatus, requestProvisioning, approveProvisioning, simulateProvisioning, retryProvisioning, cancelProvisioning, PROVISION_STEPS } from "../store.js";
import { actualCosts } from "../finance.js";
import { DEPLOYMENT_STATES } from "../seed.js";
import { h, pageHeader, badge, keyFacts, dataTable, sheet, dialog, button, input, select, textarea, formError, readForm, showFormError, closeOverlay, alertBox, lifecycleTrack, card, row, linkTo, moneyCell, emptyLine, basisBadge, svgBars, figure, figureGrid, unavailable } from "../ui.js";
import { money, formatDate, formatDateTime, slugify, MONTHS, monthShort, sum } from "../util.js";
import { selectFilter, getFilter, setFilter, tabs, notFound, periodFilter, currentPeriod, periodCaption } from "./shared.js";
import * as sandboxPages from "./dev-sandbox.js";
import { rerender, go, notify } from "../registry.js";

const PROD_TRACK = ["Not provisioned", "Requested", "Approved", "Provisioning", "Live"];

export function renderList(r) {
  const tab = r.query.get("tab") || "production";
  if (r.query.get("health")) { setFilter("dep-health", r.query.get("health")); history.replaceState(null, "", "#/dev/deployments"); }
  const t = [{ id: "production", label: "Production" }, { id: "sandboxes", label: "Sandboxes" }, { id: "monitoring", label: "Monitoring" }];
  const header = pageHeader({ title: "Deployments", description: "One isolated Cloudflare Worker and Neon project per client, from one shared codebase. This registry is a preview: provisioning and health come from simulated or sample records.", actions: tab === "sandboxes" ? button("Create sandbox", "sb-create", { cls: "btn-primary" }) : "" });
  if (tab === "sandboxes") return header + tabs(t, tab, "#/dev/deployments", "Deployment views") + sandboxPages.renderListTab();
  if (tab === "monitoring") return header + tabs(t, tab, "#/dev/deployments", "Deployment views") + monitoring();
  if (tab !== "production") return notFound();
  const d = getData();
  const st = getFilter("dep-status"), health = getFilter("dep-health"), ch = getFilter("dep-channel");
  const rows = d.deployments.filter((x) => (!st || x.status === st) && (!ch || x.channel === ch) && (!health || (health === "attention" ? ["Warning", "Down"].includes(x.health) || x.status === "Failed" : x.health === health)));
  const toolbar = '<div class="filters">' + selectFilter("dep-status", "Provisioning status", [{ value: "", label: "All statuses" }, ...DEPLOYMENT_STATES.map((s) => ({ value: s, label: s }))]) +
    selectFilter("dep-health", "Health", [{ value: "", label: "All health" }, { value: "attention", label: "Warnings and failures" }, ...["Healthy", "Warning", "Down", "Not checked"].map((s) => ({ value: s, label: s }))]) +
    selectFilter("dep-channel", "Release channel", [{ value: "", label: "All channels" }, "Stable", "Pilot"].map((x) => (typeof x === "string" ? { value: x, label: x } : x))) + "</div>";
  return header + tabs(t, tab, "#/dev/deployments", "Deployment views") +
    dataTable({
      id: "deps", caption: "Production deployments", rows, minWidth: 1700, toolbar,
      search: (x) => (clientById(x.clientId)?.name || "") + " " + x.id + " " + x.hostname + " " + (x.version || ""), searchLabel: "Search deployments",
      empty: { title: "No deployments", body: "Deployments appear after provisioning is requested for a client account." },
      columns: [
        { key: "client", label: "Client", sort: (x) => clientById(x.clientId)?.name || "", cell: (x) => linkTo(clientById(x.clientId)?.name || x.clientId, "#/dev/deployments/" + x.id) },
        { key: "env", label: "Environment", cell: (x) => h(x.env) },
        { key: "id", label: "Deployment ID", sort: (x) => x.id, cell: (x) => '<code>' + h(x.worker) + "</code>" },
        { key: "host", label: "Hostname", cell: (x) => h(x.hostname) },
        { key: "ver", label: "Version", sort: (x) => x.version || "", cell: (x) => (x.version ? "v" + h(x.version) : '<span class="muted">No data</span>') },
        { key: "build", label: "Build", cell: (x) => (x.build ? "<code>" + h(x.build) + "</code>" : '<span class="muted">No data</span>') },
        { key: "ch", label: "Channel", sort: (x) => x.channel, cell: (x) => h(x.channel) },
        { key: "st", label: "Provisioning status", sort: (x) => x.status, cell: (x) => badge(x.status) },
        { key: "health", label: "Health", sort: (x) => x.health, cell: (x) => badge(x.health) + '<div class="secondary">Sample</div>' },
        { key: "last", label: "Last deployment", sort: (x) => x.lastDeployed || "", cell: (x) => formatDateTime(x.lastDeployed) },
        { key: "check", label: "Last successful check", sort: (x) => x.lastCheck || "", cell: (x) => (x.health === "Healthy" ? formatDateTime(x.lastCheck) : '<span class="muted">No data</span>') },
        { key: "res", label: "Assigned resources", cell: (x) => '<span class="small">' + h(x.resources.neonProject) + "<br/>" + h(x.resources.queue) + "</span>" },
        { key: "sb", label: "Sandboxes", sort: (x) => d.sandboxes.filter((s) => s.clientId === x.clientId && !["Retired", "Expired"].includes(sandboxStatus(s))).length, cell: (x) => { const n = d.sandboxes.filter((s) => s.clientId === x.clientId && !["Retired", "Expired"].includes(sandboxStatus(s))).length; return n ? linkTo(n + " active", "#/dev/deployments/" + x.id + "?tab=sandboxes") : '<span class="muted">None</span>'; } },
      ],
    });
}

export function renderDetail(id, r) {
  const d = getData();
  const x = d.deployments.find((y) => y.id === id);
  if (!x) return notFound();
  const c = clientById(x.clientId);
  const tab = r.query.get("tab") || "overview";
  const t = [{ id: "overview", label: "Production" }, { id: "sandboxes", label: "Sandboxes" }, { id: "releases", label: "Release history" }, { id: "config", label: "Configuration" }, { id: "health", label: "Health and failures" }, { id: "logs", label: "Logs" }, { id: "usage", label: "Resources and cost" }];
  let body;
  if (tab === "overview") body = overview(x, c);
  else if (tab === "sandboxes") body = sandboxes(x);
  else if (tab === "releases") body = releaseHistory(x);
  else if (tab === "config") body = config(x, c);
  else if (tab === "health") body = healthTab(x);
  else if (tab === "logs") body = logs(x);
  else if (tab === "usage") body = usage(x);
  else return notFound();
  return pageHeader({ title: c.name + " · Production", crumbs: [{ label: "Deployments", href: "#/dev/deployments" }, { label: c.name }], description: badge(x.status) + " " + badge(x.health) + ' <code class="small">' + h(x.worker) + "</code> " + h(x.hostname),
    actions: linkTo("Open organisation", "#/dev/organisations/" + c.id) + (x.status === "Live" ? button("Create sandbox", "sb-create", { id: c.id }) : "") }) +
    tabs(t, tab, "#/dev/deployments/" + x.id, "Deployment sections") + body;
}

function overview(x, c) {
  const d = getData();
  const idx = PROD_TRACK.indexOf(x.status);
  const failed = x.status === "Failed";
  const runs = d.provisioningRuns.filter((p) => p.depId === x.id);
  let actions = "";
  if (x.status === "Requested") actions = button("Approve provisioning", "prov-approve", { id: x.id, cls: "btn-primary" }) + button("Cancel request", "prov-cancel", { id: x.id, cls: "btn-danger" });
  if (x.status === "Approved") actions = button("Run provisioning simulation", "prov-sim", { id: x.id, arg: "pass", cls: "btn-primary" }) + button("Simulate a failure", "prov-sim", { id: x.id, arg: "fail" }) + button("Cancel", "prov-cancel", { id: x.id, cls: "btn-danger" });
  if (failed) actions = button("Retry from failed step", "prov-retry", { id: x.id, cls: "btn-primary" }) + button("Cancel and clean up", "prov-cancel", { id: x.id, cls: "btn-danger" });
  if (x.status === "Live") actions = unavailable("Deploy a version", "Production deployment needs the approved backend pipeline (Releases)") + unavailable("Roll back", "Rollback needs compatibility checks and the backend runbook");
  return card({ title: "Provisioning and lifecycle", note: "Deployment lifecycle, separate from the account lifecycle (" + h(c.accountStatus) + ").", body: '<div class="card-body">' +
    lifecycleTrack(PROD_TRACK, failed ? 3 : x.status === "Live" ? 5 : Math.max(0, idx), failed ? 3 : undefined) +
    (x.status === "Approved" && x.lastSimulation ? alertBox("info", "<strong>Simulation passed</strong> " + formatDateTime(x.lastSimulation) + ". No infrastructure was created. The deployment stays Approved until real provisioning is connected and run by the backend.") : "") +
    (["Requested", "Approved", "Failed"].includes(x.status) ? alertBox("warning", "<strong>Preview simulation.</strong> No Worker, database, queue or DNS record is created. Live is only set by a verified backend provisioning run.") : "") +
    '<div class="inline-actions">' + actions + "</div></div>" }) +
    card({ title: "Production environment", body: '<div class="card-body">' + keyFacts([
      ["Client", linkTo(c.name, "#/dev/organisations/" + c.id)], ["Environment", h(x.env)], ["Deployment ID", "<code>" + h(x.worker) + "</code>"], ["Hostname", h(x.hostname)],
      ["Application version", x.version ? "v" + h(x.version) : (x.targetVersion ? "Target v" + h(x.targetVersion) : null)], ["Build", x.build ? "<code>" + h(x.build) + "</code>" : null], ["Schema", h(x.schema || "")], ["Release channel", h(x.channel)],
      ["Last deployment", x.lastDeployed ? formatDateTime(x.lastDeployed) : null], ["Region", h(x.resources.region)],
    ]) + "</div>" }) +
    (runs.length ? card({ title: "Simulation runs", note: "Each step is simulated. Nothing is provisioned.", body: runs.map((p) => '<div class="rule-row"><div class="rule-main"><div class="row-primary">' + h(p.outcome) + " · " + formatDateTime(p.at) + '</div><ol class="steps">' + p.steps.map((s) => "<li>" + h(s.name) + " — " + badge(s.result, s.result.startsWith("Passed") ? "done" : s.result.startsWith("Failed") ? "overdue" : "draft") + "</li>").join("") + "</ol></div></div>").join("") }) : "");
}
function sandboxes(x) {
  const list = getData().sandboxes.filter((s) => s.clientId === x.clientId);
  return card({ title: "Sandbox environments", note: "Isolated environments for this client. Synthetic data only; never production records or secrets.", action: x.status === "Live" ? button("Create sandbox", "sb-create", { id: x.clientId, cls: "btn-small" }) : "",
    body: list.map((s) => row(linkTo(s.name, "#/dev/sandboxes/" + s.id), h(s.purpose) + " · " + h(s.reference) + " · v" + h(s.sourceVersion) + " → v" + h(s.targetVersion) + " · expires " + formatDate(s.expiresAt), badge(sandboxStatus(s)))).join("") || emptyLine("No sandboxes", "Create a sandbox to test a fix or a new version without touching production.") });
}
function releaseHistory(x) {
  const rows = getData().releaseHistory.filter((r) => r.clientId === x.clientId);
  return dataTable({ id: "dep-rh-" + x.id, caption: "Release history", rows, minWidth: 1100, empty: { title: "No releases yet", body: "Version changes for this client appear here." },
    columns: [
      { key: "at", label: "Date", sort: (r) => r.at, cell: (r) => formatDateTime(r.at) },
      { key: "from", label: "Previous", cell: (r) => "v" + h(r.from) }, { key: "to", label: "Target", cell: (r) => "v" + h(r.to) },
      { key: "env", label: "Environment", cell: (r) => h(r.env) }, { key: "ref", label: "Change reference", cell: (r) => h(r.ref) },
      { key: "by", label: "Requested by", cell: (r) => h(r.requestedBy) }, { key: "ap", label: "Approval", cell: (r) => h(r.approval) },
      { key: "res", label: "Deployment result", cell: (r) => badge(r.result, r.result === "Succeeded" ? "done" : "soon") },
      { key: "ver", label: "Verification", cell: (r) => h(r.verification) }, { key: "rb", label: "Rollback reference", cell: (r) => h(r.rollbackRef || "—") },
    ] });
}
function config(x, c) {
  return card({ title: "Application configuration", note: "Non-secret settings only. Secret values are never shown or sent to the browser.", body: '<div class="card-body">' + keyFacts([
    ["Idle timeout", x.config.idleTimeoutMinutes + " minutes"], ["Absolute session", x.config.absoluteSessionHours + " hours"], ["MFA for privileged roles", h(x.config.mfaPrivilegedRoles)], ["Browser diagnostics", h(x.config.diagnostics)], ["Branding version", h(x.config.brandingVersion)],
    ["Neon project", "<code>" + h(x.resources.neonProject) + "</code>"], ["Queue", "<code>" + h(x.resources.queue) + "</code>"], ["R2 prefix", "<code>" + h(x.resources.r2Prefix) + "</code>"], ["Worker secrets", h(x.resources.secrets)], ["Entra redirect URI", h(x.resources.entraRedirect)],
  ]) + "</div>" }) +
    card({ title: "Enabled modules", action: linkTo("Change modules", "#/dev/organisations/" + c.id + "?tab=modules"), body: '<div class="card-body chip-list">' + c.modules.map((m) => badge(m, "progress")).join(" ") + "</div>" });
}
function healthTab(x) {
  return alertBox("warning", "<strong>Health is sample data.</strong> Cloudflare and Neon are not connected, so checks shown here are illustrative. A deployment is never shown as Healthy without a recorded check.") +
    card({ title: "Health checks", body: '<div class="card-body">' + keyFacts([["Current health", badge(x.health)], ["Last check", x.lastCheck ? formatDateTime(x.lastCheck) : null], ["Next check", "Unavailable — scheduler not connected"]]) + "</div>" }) +
    card({ title: "Deployment failures", note: "Safe messages and codes only; no SQL, secrets or record content.", body: x.failures.map((f) => row(h(f.step) + " · <code>" + h(f.code) + "</code>", h(f.message) + " · " + formatDateTime(f.at), badge("Failed"))).join("") || emptyLine("No failures recorded", "Provisioning and health failures appear here.") });
}
function logs(x) {
  const list = getData().logs.filter((l) => l.clientId === x.clientId);
  return card({ title: "Logs and technical diagnostics", note: "Sample entries with record IDs only.", action: linkTo("All logs", "#/dev/logs"), body: list.map((l) => row(badge(l.level, l.level === "Error" ? "overdue" : l.level === "Warning" ? "soon" : "draft") + " <code>" + h(l.code) + "</code>", formatDateTime(l.at) + " · " + h(l.service) + " · " + h(l.message))).join("") || emptyLine("No log entries", "Errors and warnings for this deployment appear here.") });
}
function usage(x) {
  const d = getData();
  const p = currentPeriod();
  const k = actualCosts(d, p.months).perClient.get(x.clientId);
  const entries = d.costs.filter((c) => c.clientId === x.clientId && p.months.includes(c.month));
  return '<div class="filters">' + periodFilter() + "</div>" +
    card({ title: "Resource usage", note: "Provider integrations are not connected, so usage figures are unavailable.", body: '<div class="card-body">' + keyFacts([
      ["Worker requests", badge("Unavailable")], ["CPU time", badge("Unavailable")], ["Neon compute hours", badge("Unavailable")], ["Database storage", badge("Unavailable")], ["Queue backlog", badge("Unavailable")], ["R2 storage", badge("Unavailable")],
    ]) + "</div>" }) +
    card({ title: "Infrastructure cost summary", note: h(periodCaption()) + ". Developer only.", body: '<div class="card-body">' + (k ? keyFacts([["Direct actual costs", h(money(k.direct)) + (k.incomplete ? " " + badge("Incomplete") : "")], ["Shared costs (per active user)", h(money(k.shared))], ["Total", h(money(k.total))]]) : emptyLine("No costs", "Costs appear once the client is live.")) + "</div>" +
      entries.map((e) => row(h(e.category), monthShort(e.month) + " · " + h(e.source), (e.php == null ? '<span class="muted">Not available</span>' : "<strong>" + h(money(e.php)) + "</strong>") + " " + basisBadge(e.basis))).join("") });
}

/* --------------------------------------------------------------- monitoring */

function monitoring() {
  const d = getData();
  const deps = d.deployments.filter((x) => x.status === "Live");
  const by = (hname) => deps.filter((x) => x.health === hname).length;
  const errors = d.logs.filter((l) => l.level === "Error").length;
  const failingJobs = d.jobs.filter((j) => j.state !== "Healthy").length;
  const series = ["Reconciled", "Estimate", "Manual"].map((basis) => ({ name: basis, values: MONTHS.map((m) => ({ label: monthShort(m), value: sum(d.costs.filter((c) => c.month === m && c.basis === basis && c.php != null), "php") })) }));
  const p = currentPeriod();
  const costs = actualCosts(d, p.months);
  return alertBox("warning", "<strong>Provider integrations are not connected.</strong> Live usage and availability are unavailable. Health states below are sample records; costs come from the cost ledger with their basis shown.") +
    card({ title: "What the values mean", body: '<div class="card-body legend-grid">' +
      [["Reconciled", "done", "Verified actual value from a provider bill."], ["Estimate", "soon", "Calculated from the cost model or volumes. Replaced when reconciled."], ["Unavailable", "draft", "No source connected, so no figure is shown."], ["Not connected", "overdue", "The provider integration is disconnected."]].map(([l, t, s]) => '<div>' + badge(l, t) + '<p class="small">' + h(s) + "</p></div>").join("") + "</div>" }) +
    figureGrid([
      figure({ label: "Live deployments, sample health", value: deps.length, note: by("Healthy") + " healthy · " + by("Warning") + " warning · " + by("Down") + " down · " + by("Not checked") + " not checked", icon: "▣", href: "#/dev/deployments?health=attention" }),
      figure({ label: "Error log entries (sample)", value: errors, icon: "!", href: "#/dev/logs" }),
      figure({ label: "Jobs failing or retrying (sample)", value: failingJobs, badge: failingJobs ? "Needs a look" : "None", tone: failingJobs ? "soon" : "done", icon: "⚙", href: "#/dev/jobs" }),
      figure({ label: "Actual infrastructure charges", value: money(costs.direct + costs.shared + costs.unallocated), badge: costs.missing.length ? "Incomplete" : "Complete", tone: costs.missing.length ? "soon" : "done", note: periodCaption(), icon: "₱", href: "#/dev/finance?tab=costs" }),
    ], "Monitoring figures") +
    card({ title: "Provider integrations", body: d.integrations.map((i) => row(h(i.name), h(i.purpose), badge(i.status, i.status === "Connected" ? "done" : "overdue"))).join("") }) +
    card({ title: "Service consumption trend", note: "Cost ledger by month and basis (PHP). Usage volumes are unavailable until providers are connected.", body: '<div class="card-body">' + svgBars(series, { label: "Infrastructure cost by month and basis", format: (v) => money(v) }) + "</div>" }) +
    '<div class="filters">' + periodFilter("mon-period") + "</div>" +
    dataTable({ id: "mon-clients", caption: "Usage and charges by client", rows: d.clients.filter((c) => costs.perClient.has(c.id)), minWidth: 1100,
      search: (c) => c.name, searchLabel: "Search clients", empty: { title: "No live clients", body: "Usage appears for live deployments." },
      columns: [
        { key: "c", label: "Client", sort: (c) => c.name, cell: (c) => { const dep = deploymentFor(c.id); return dep ? linkTo(c.name, "#/dev/deployments/" + dep.id + "?tab=usage") : h(c.name); } },
        { key: "req", label: "Worker requests", cell: () => badge("Unavailable") },
        { key: "neon", label: "Neon compute", cell: () => badge("Unavailable") },
        { key: "stor", label: "Storage and exports", cell: () => badge("Unavailable") },
        { key: "rec", label: "Reconciled", sort: (c) => sum(d.costs.filter((x) => x.clientId === c.id && p.months.includes(x.month) && x.basis === "Reconciled"), "php"), cell: (c) => moneyCell(sum(d.costs.filter((x) => x.clientId === c.id && p.months.includes(x.month) && x.basis === "Reconciled"), "php")) },
        { key: "est", label: "Estimated", sort: (c) => sum(d.costs.filter((x) => x.clientId === c.id && p.months.includes(x.month) && ["Estimate", "Manual"].includes(x.basis)), "php"), cell: (c) => moneyCell(sum(d.costs.filter((x) => x.clientId === c.id && p.months.includes(x.month) && ["Estimate", "Manual"].includes(x.basis)), "php")) },
        { key: "tot", label: "Direct + shared", sort: (c) => costs.perClient.get(c.id).total, cell: (c) => { const k = costs.perClient.get(c.id); return moneyCell(k.total) + (k.incomplete ? " " + badge("Incomplete") : ""); } },
      ] });
}

/* ------------------------------------------------------- provisioning wizard */

let wiz = null;
function wizardSheet() {
  const d = getData();
  const c = clientById(wiz.clientId);
  const releases = d.releases.filter((r) => r.verification === "Verified" && r.approval === "Approved");
  const steps = ["Configure", "Validate", "Review"];
  const stepper = '<ol class="wizard-steps">' + steps.map((s, i) => '<li class="' + (i === wiz.step ? "current" : i < wiz.step ? "done" : "") + '"' + (i === wiz.step ? ' aria-current="step"' : "") + ">" + (i + 1) + ". " + h(s) + "</li>").join("") + "</ol>";
  let body = stepper, footer = button("Cancel", "close");
  if (wiz.step === 0) {
    body += '<div class="form-grid">' + input("Hostname", "w-host", wiz.values.hostname, { hint: "Becomes <hostname>.thryvems.example" }) +
      select("Application version", "w-ver", wiz.values.version, releases.map((r) => ({ value: r.version, label: "v" + r.version + " · " + r.type + " · verified" }))) +
      select("Release channel", "w-ch", wiz.values.channel, ["Stable", "Pilot"]) + input("Region", "w-region", "aws-ap-southeast-1 (Singapore)", { disabled: true, hint: "Fixed by the architecture (plan v3 D2)." }) + "</div>" +
      textarea("Reason", "w-reason", wiz.values.reason, { rows: 2 }) + '<p class="small muted">Enabled modules come from the account: ' + h(c.modules.join(", ")) + ".</p>";
    footer += button("Check configuration", "wiz-next", { cls: "btn-primary", primary: true });
  } else if (wiz.step === 1) {
    const host = slugify(wiz.values.hostname);
    const rel = d.releases.find((r) => r.version === wiz.values.version);
    const checks = [
      ["Hostname uses letters, numbers and hyphens", host.length >= 2 && host === String(wiz.values.hostname).trim().toLowerCase()],
      ["Hostname isn't used by another deployment", !d.deployments.some((x) => x.clientId !== c.id && x.hostname === host + ".thryvems.example")],
      ["Release is verified and approved", !!rel && rel.verification === "Verified" && rel.approval === "Approved"],
      ["Subscription is Active or Trial", ["Active", "Trial"].includes(c.subscription.status)],
      ["Business partner assigned", !!c.partnerId],
      ["Client contact email recorded", String(c.contact.email).includes("@")],
      ["Reason entered", String(wiz.values.reason || "").trim().length >= 3],
    ];
    wiz.valid = checks.every((x) => x[1]);
    body += '<ul class="checklist">' + checks.map(([l, ok]) => '<li class="' + (ok ? "ok" : "bad") + '">' + badge(ok ? "Passed" : "Failed") + " " + h(l) + "</li>").join("") + "</ul>" +
      (wiz.valid ? alertBox("info", "All checks passed.") : alertBox("danger", "Fix the failed checks before continuing.", "alert"));
    footer += button("Back", "wiz-back") + button("Continue to review", "wiz-next", { cls: "btn-primary", disabled: !wiz.valid, primary: true });
  } else {
    body += keyFacts([["Client", h(c.name)], ["Hostname", h(slugify(wiz.values.hostname) + ".thryvems.example")], ["Version", "v" + h(wiz.values.version)], ["Channel", h(wiz.values.channel)], ["Region", "Singapore"], ["Reason", h(wiz.values.reason)]]) +
      "<h3>What happens next</h3><ol class=\"small\"><li>The request is recorded as <strong>Requested</strong> and the account becomes <strong>Awaiting provisioning</strong>.</li><li>You approve it (re-confirmation).</li><li>The backend runs: " + h(PROVISION_STEPS.join(", ")) + ".</li><li>Only a verified run sets the deployment Live.</li></ol>" +
      alertBox("warning", "<strong>Preview:</strong> this records a request only. No Cloudflare, Neon or DNS resource is created.") + formError();
    footer += button("Back", "wiz-back") + button("Submit provisioning request", "wiz-submit", { cls: "btn-primary", submit: true, primary: true });
  }
  sheet({ title: "Request provisioning", description: h(c.name) + " · guided provisioning", body, footer, wide: true });
}
function captureWizard() {
  const f = readForm(document.querySelector("[data-form]"));
  if (wiz.step === 0) wiz.values = { hostname: f["w-host"], version: f["w-ver"], channel: f["w-ch"], reason: f["w-reason"] };
}

export const actions = {
  "prov-request": (el) => {
    const c = clientById(el.dataset.id);
    const rel = getData().releases.find((r) => r.verification === "Verified" && r.approval === "Approved");
    wiz = { clientId: c.id, step: 0, values: { hostname: c.slug, version: rel?.version, channel: "Stable", reason: "" } };
    wizardSheet();
  },
  "wiz-next": () => { captureWizard(); wiz.step = Math.min(2, wiz.step + 1); wizardSheet(); },
  "wiz-back": () => { wiz.step = Math.max(0, wiz.step - 1); wizardSheet(); },
  "wiz-submit": () => {
    const res = requestProvisioning(wiz.clientId, wiz.values);
    if (!res.ok) return showFormError(res.error);
    closeOverlay(true); notify("Provisioning requested. Nothing is deployed yet."); go("#/dev/deployments/" + res.id);
  },
  "prov-approve": (el) => confirmReason("Approve provisioning?", "Re-confirm that this client should be provisioned. In the preview this only changes the request state.", "Approve provisioning", "prov-approve-confirm", el.dataset.id),
  "prov-approve-confirm": (el) => done(approveProvisioning(el.dataset.id, reasonValue()), "Provisioning approved"),
  "prov-sim": (el) => { const res = simulateProvisioning(el.dataset.id, el.dataset.arg); if (!res.ok) return notify(res.error); rerender(); notify(el.dataset.arg === "fail" ? "Simulation failed at " + res.run.steps.find((s) => s.result.startsWith("Failed")).name : "Simulation passed. Nothing was provisioned."); },
  "prov-retry": (el) => confirmReason("Retry provisioning?", "The request returns to Approved and resumes from the failed step.", "Retry", "prov-retry-confirm", el.dataset.id),
  "prov-retry-confirm": (el) => done(retryProvisioning(el.dataset.id, reasonValue()), "Retry approved"),
  "prov-cancel": (el) => confirmReason("Cancel provisioning?", "The account returns to Account created. In production, completed steps would be cleaned up.", "Cancel provisioning", "prov-cancel-confirm", el.dataset.id, true),
  "prov-cancel-confirm": (el) => { const dep = getData().deployments.find((x) => x.id === el.dataset.id); const cid = dep?.clientId; const res = cancelProvisioning(el.dataset.id, reasonValue()); if (!res.ok) return showFormError(res.error); closeOverlay(true); notify("Provisioning cancelled"); go("#/dev/organisations/" + cid); },
};
function confirmReason(title, desc, label, act, id, danger) {
  dialog({ title, description: h(desc), body: textarea("Reason", "cr-reason", "", { rows: 2 }) + formError(), footer: button("Cancel", "close") + button(label, act, { id, cls: danger ? "btn-danger" : "btn-primary", submit: true, primary: true }) });
}
const reasonValue = () => readForm(document.querySelector("[data-form]"))["cr-reason"];
function done(res, msg) { if (!res.ok) return showFormError(res.error); closeOverlay(true); rerender(); notify(msg); }
export { confirmReason, reasonValue, done };
