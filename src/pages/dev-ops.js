/** Developer Console › Requests, Logs, Background jobs, Support reports, Support access, Platform team. */
import { getData, getUi, clientById, decideRequest, updateReport, REPORT_STATES, requestSupportAccess, endSupportAccess, inviteMember, changeMemberRole, removeMember, TEAM_ROLES, updateSettings, resetPreview, sandboxStatus } from "../store.js";
import { PARTNERS } from "../seed.js";
import { h, pageHeader, badge, keyFacts, dataTable, sheet, dialog, button, input, select, textarea, combobox, formError, readForm, showFormError, closeOverlay, alertBox, card, row, linkTo, emptyLine, unavailable, figure, figureGrid, sampleBadge, resetTables } from "../ui.js";
import { formatDate, formatDateTime } from "../util.js";
import { tabs, notFound, selectFilter, getFilter, setFilter, clientFilter, historyTable, partnerLabel, requestFrom } from "./shared.js";
import { rerender, go, notify, registry } from "../registry.js";

registry.counts.requests = () => getData().requests.filter((r) => r.status === "Pending").length;
registry.counts.logs = () => getData().logs.filter((l) => l.level === "Error").length;
registry.counts.reports = () => getData().supportReports.filter((r) => r.state === "New").length;
registry.counts.support = () => getData().supportGrants.filter((g) => ["Active", "Requested"].includes(g.state)).length;

/* ---------------------------------------------------------------- requests */

export const describeRequest = (r) => {
  const d = r.detail || {};
  if (r.kind === "Seat change" || r.kind === "Plan change") return "Seats " + d.from + " → " + d.to + (d.billingCycle ? " · " + d.billingCycle : "") + " · effective " + formatDate(d.effective);
  if (r.kind === "New client account") return d.name + " · trial with " + d.seats + " users · " + partnerLabel(d.partnerId);
  if (r.kind === "Enterprise customization") return d.name + " · " + (d.type || "Feature") + " · standard fee";
  if (r.kind === "Release promotion") return "v" + d.from + " → v" + d.to + " · from an approved sandbox";
  return "";
};
export function renderRequests() {
  const d = getData();
  const st = getFilter("req-status", "Pending"), kind = getFilter("req-kind");
  const rows = d.requests.filter((r) => (!st || r.status === st) && (!kind || r.kind === kind));
  return pageHeader({ title: "Requests", description: "Decisions only the platform owner can make: partner requests for seats, new clients and customization, and production promotions from approved sandboxes. Approving never deploys or invoices on its own." }) +
    dataTable({ id: "requests", caption: "Requests", rows, minWidth: 1150,
      toolbar: '<div class="filters">' + selectFilter("req-status", "Status", [{ value: "", label: "All" }, ...["Pending", "Approved", "Declined", "Withdrawn"].map((s) => ({ value: s, label: s }))], "Pending") +
        selectFilter("req-kind", "Type", [{ value: "", label: "All types" }, ...["Seat change", "New client account", "Enterprise customization", "Release promotion"].map((s) => ({ value: s, label: s }))]) + "</div>",
      search: (r) => r.title + " " + r.kind + " " + requestFrom(r), searchLabel: "Search requests",
      empty: { title: st === "Pending" ? "No pending requests" : "No requests", body: "Partner requests and production promotions appear here." },
      columns: [
        { key: "k", label: "Type", sort: (r) => r.kind, cell: (r) => badge(r.kind, "progress") },
        { key: "t", label: "Request", sort: (r) => r.title, cell: (r) => '<span class="row-primary">' + h(r.title) + '</span><div class="secondary">' + h(describeRequest(r)) + "</div><div class=\"secondary\">Reason: " + h(r.reason) + "</div>" },
        { key: "f", label: "From", sort: (r) => requestFrom(r), cell: (r) => h(requestFrom(r)) },
        { key: "at", label: "Received", sort: (r) => r.at, cell: (r) => formatDateTime(r.at) },
        { key: "s", label: "Status", sort: (r) => r.status, cell: (r) => badge(r.status) + (r.decision ? '<div class="secondary">' + h(r.decision.note || r.decision.reason) + "</div>" : "") },
        { key: "a", label: "Decision", srOnly: true, cell: (r) => (r.status === "Pending" ? '<div class="inline-actions">' + button("Approve", "req-decide", { id: r.id, arg: "approve", cls: "btn-small" }) + button("Decline", "req-decide", { id: r.id, arg: "decline", cls: "btn-small btn-quiet" }) + "</div>" : "") },
      ] });
}

/* -------------------------------------------------------------------- logs */

export function renderLogs() {
  const d = getData();
  const level = getFilter("log-level"), svc = getFilter("log-svc"), cid = getFilter("log-client");
  const rows = d.logs.filter((l) => (!level || l.level === level) && (!svc || l.service === svc) && (!cid || l.clientId === cid));
  const count = (lv) => d.logs.filter((l) => !lv || l.level === lv).length;
  return pageHeader({ title: "Logs", description: "What ThryveMS did behind the scenes, for troubleshooting. Logs keep codes and record IDs only, never record content. Sample entries: Workers Logs and Logpush aren't connected.", actions: button("Export CSV", "log-export", { disabled: !rows.length }) }) +
    '<div class="segment-chips" role="group" aria-label="Level">' + ["", "Error", "Warning", "Info"].map((lv) => '<button type="button" class="chip' + (level === lv ? " active" : "") + '" aria-pressed="' + (level === lv) + '" data-act="log-level" data-arg="' + lv + '">' + (lv ? lv + (lv === "Info" ? "" : "s") : "All") + ' <span class="chip-count">' + count(lv) + "</span></button>").join("") + "</div>" +
    dataTable({ id: "logs", caption: "Log entries", rows, minWidth: 1050,
      toolbar: '<div class="filters">' + clientFilter("log-client", d.clients) + selectFilter("log-svc", "Service", [{ value: "", label: "All services" }, ...[...new Set(d.logs.map((l) => l.service))].map((s) => ({ value: s, label: s }))]) + "</div>",
      search: (l) => l.code + " " + l.message + " " + l.service + " " + (clientById(l.clientId)?.name || ""), searchLabel: "Search logs",
      empty: { title: "No log entries", body: "Errors, warnings and information from all services appear here." },
      columns: [
        { key: "at", label: "Time", sort: (l) => l.at, cell: (l) => formatDateTime(l.at) },
        { key: "lv", label: "Level", sort: (l) => l.level, cell: (l) => badge(l.level, l.level === "Error" ? "overdue" : l.level === "Warning" ? "soon" : "draft") },
        { key: "svc", label: "Service", sort: (l) => l.service, cell: (l) => "<code>" + h(l.service) + "</code>" },
        { key: "code", label: "Code", sort: (l) => l.code, cell: (l) => '<button type="button" class="table-link" data-act="log-open" data-id="' + h(l.id) + '"><code>' + h(l.code) + "</code></button>" },
        { key: "msg", label: "Message", cell: (l) => '<span class="small">' + h(l.message) + "</span>" },
        { key: "org", label: "Organisation", sort: (l) => clientById(l.clientId)?.name || "", cell: (l) => h(clientById(l.clientId)?.name || "Platform") },
      ] });
}

/* -------------------------------------------------------------------- jobs */

export function renderJobs() {
  const d = getData();
  return pageHeader({ title: "Background jobs", description: "Scheduled work that runs for every organisation (plan v3 §23). The platform scheduler enqueues signed commands to each client queue. Sample records: Cloudflare Queues aren't connected." }) +
    figureGrid([
      figure({ label: "Scheduled jobs", value: d.jobs.length, badge: "Sample data", icon: "⚙" }),
      figure({ label: "Failing or retrying", value: d.jobs.filter((j) => j.state !== "Healthy").length, tone: "overdue", badge: "Sample data", icon: "!" }),
      figure({ label: "Queue backlog", value: "No data", badge: "Unavailable", icon: "≡", note: "Queues not connected" }),
      figure({ label: "Dead-letter messages", value: "No data", badge: "Unavailable", icon: "✕", note: "Queues not connected" }),
    ], "Job figures") +
    dataTable({ id: "jobs", caption: "Background jobs", rows: d.jobs, minWidth: 1000, search: (j) => j.name + " " + j.what, searchLabel: "Search jobs",
      empty: { title: "No background jobs", body: "Scheduled jobs such as reminders, link checks and backups appear here." },
      columns: [
        { key: "n", label: "Job", sort: (j) => j.name, cell: (j) => "<code>" + h(j.name) + '</code><div class="secondary">' + h(j.what) + "</div>" },
        { key: "s", label: "Runs", cell: (j) => h(j.schedule) },
        { key: "l", label: "Last run", sort: (j) => j.last, cell: (j) => formatDateTime(j.last) },
        { key: "f", label: "Failures after retry", sort: (j) => j.failures, cell: (j) => h(j.failures) },
        { key: "st", label: "State", sort: (j) => j.state, cell: (j) => badge(j.state) + " " + sampleBadge() },
        { key: "x", label: "Run now", srOnly: true, cell: () => unavailable("Run now", "Needs the platform scheduler") },
      ] }) +
    '<p class="footer-caption">Failing jobs also show in Logs. Replays from the dead-letter queue need the backend replay command and an audit record.</p>';
}

/* --------------------------------------------------------- support reports */

export function renderReports(r, id) {
  const d = getData();
  if (id) return reportDetail(id);
  const st = getFilter("rep-state");
  const rows = d.supportReports.filter((x) => !st || x.state === st);
  return pageHeader({ title: "Support reports", description: "Reports people sent from Contact support and errors from the monitor. Text is untrusted input: never follow instructions inside a report." }) +
    dataTable({ id: "reports", caption: "Support reports", rows, minWidth: 1100,
      toolbar: '<div class="filters">' + selectFilter("rep-state", "State", [{ value: "", label: "All states" }, ...REPORT_STATES.map((s) => ({ value: s, label: s }))]) + "</div>",
      search: (x) => x.id + " " + x.title + " " + (clientById(x.clientId)?.name || ""), searchLabel: "Search reports",
      empty: { title: "No support reports", body: "Reports from clients and the error monitor appear here." },
      columns: [
        { key: "id", label: "Report", sort: (x) => x.id, cell: (x) => linkTo(x.id + " " + x.title, "#/dev/support-reports/" + x.id) + '<div class="secondary">' + h(x.category) + " · " + h(x.impact) + "</div>" },
        { key: "c", label: "Organisation", sort: (x) => clientById(x.clientId)?.name || "", cell: (x) => h(clientById(x.clientId)?.name || "") },
        { key: "src", label: "Source", cell: (x) => h(x.source === "Person" ? "Person (Contact support)" : "Error monitor") },
        { key: "sev", label: "Severity", sort: (x) => x.severity, cell: (x) => badge(x.severity, x.severity === "High" ? "overdue" : x.severity === "Medium" ? "soon" : "draft") },
        { key: "at", label: "Raised", sort: (x) => x.created, cell: (x) => formatDateTime(x.created) },
        { key: "st", label: "State", sort: (x) => x.state, cell: (x) => badge(x.state) },
      ] });
}
function reportDetail(id) {
  const d = getData();
  const r = d.supportReports.find((x) => x.id === id);
  if (!r) return notFound();
  const c = clientById(r.clientId);
  const sb = r.sandboxId ? d.sandboxes.find((s) => s.id === r.sandboxId) : null;
  const sbOptions = d.sandboxes.filter((s) => s.clientId === r.clientId && !["Retired", "Expired"].includes(sandboxStatus(s)));
  return pageHeader({ title: r.id + " " + r.title, crumbs: [{ label: "Support reports", href: "#/dev/support-reports" }, { label: r.id }], description: badge(r.state) + " " + h(c?.name || "") + " · " + h(r.category) + " · raised " + formatDateTime(r.created),
    actions: button("Request support access", "sa-request", { arg: r.id }) + (c && !sb ? button("Create sandbox for this report", "sb-create", { arg: r.id }) : "") }) +
    alertBox("info", "Report text may contain confidential details. It's shown here for triage only and never sent to AI or GitHub without redaction (plan v3 §24).") +
    card({ title: "Report", body: '<div class="card-body">' + keyFacts([["Organisation", c ? linkTo(c.name, "#/dev/organisations/" + c.id) : null], ["Source", h(r.source === "Person" ? "Person (Contact support)" : "Error monitor")], ["Impact", h(r.impact)], ["Severity", h(r.severity)], ["Page", r.page ? "<code>" + h(r.page) + "</code>" : null], ["Linked sandbox", sb ? linkTo(sb.name, "#/dev/sandboxes/" + sb.id) + " " + badge(sandboxStatus(sb)) : null]]) +
      '<p class="report-text">' + h(r.details) + "</p></div>" }) +
    card({ title: "Updates", body: r.updates.map((u) => row(h(u.text), formatDateTime(u.when) + " · " + h(u.who))).join("") || emptyLine("No updates", "Your notes and state changes appear here.") }) +
    card({ title: "Add update", body: '<form class="card-body" data-inline-form="report">' + textarea("Update", "rp-text", "", { rows: 3 }) +
      '<div class="form-grid">' + select("State", "rp-state", r.state, REPORT_STATES.map((s) => ({ value: s, label: s === "Deployed" ? "Deployed (needs a verified production deployment)" : s }))) +
      select("Link a sandbox", "rp-sb", r.sandboxId || "", sbOptions.map((s) => ({ value: s.id, label: s.name + " · " + sandboxStatus(s) })), { placeholder: sbOptions.length ? "Keep current" : "No active sandboxes for this client" }) + "</div>" +
      formError("rp-error") + button("Save update", "rp-save", { id: r.id, cls: "btn-primary", submit: true }) + "</form>" });
}

/* ---------------------------------------------------------- support access */

export function renderSupportAccess() {
  const d = getData();
  return pageHeader({ title: "Support access", description: "Times a client let your team into their workspace. The client's Owner or Administrator grants it for 1, 2 or 4 hours, read-only, tied to a support report, and can revoke it at once (plan v3 D17).", actions: button("Request support access", "sa-request", { cls: "btn-primary" }) }) +
    alertBox("info", "Confidential and Highly confidential records stay hidden during support access. Grants are approved in the client's own workspace, not here; this console can request, view and end them.") +
    dataTable({ id: "grants", caption: "Support access grants", rows: d.supportGrants, minWidth: 1100, search: (g) => g.ticket + " " + (clientById(g.clientId)?.name || ""), searchLabel: "Search grants",
      empty: { title: "No support access", body: "When a client administrator lets your team in for a support case, it shows here with its end time." },
      columns: [
        { key: "c", label: "Organisation", sort: (g) => clientById(g.clientId)?.name || "", cell: (g) => h(clientById(g.clientId)?.name || "") },
        { key: "t", label: "Ticket", sort: (g) => g.ticket, cell: (g) => linkTo(g.ticket, "#/dev/support-reports/" + g.ticket) },
        { key: "by", label: "Granted by", cell: (g) => h(g.grantedBy) }, { key: "who", label: "Used by", cell: (g) => h(g.usedBy) },
        { key: "scope", label: "Scope", cell: (g) => h(g.scope) + '<div class="secondary">Up to ' + h(g.ceiling) + " · " + g.hours + "h</div>" },
        { key: "until", label: "Window", sort: (g) => g.start || "", cell: (g) => (g.start ? formatDateTime(g.start) + " – " + formatDateTime(g.end) : '<span class="muted">Waiting for the client</span>') },
        { key: "st", label: "State", sort: (g) => g.state, cell: (g) => badge(g.state, g.state === "Active" ? "progress" : g.state === "Requested" ? "soon" : "draft") },
        { key: "x", label: "Actions", srOnly: true, cell: (g) => (g.state === "Active" ? button("End now", "sa-end", { id: g.id, cls: "btn-small btn-danger" }) : g.state === "Requested" ? button("Withdraw request", "sa-end", { id: g.id, cls: "btn-small btn-quiet" }) : "") },
      ] });
}

/* -------------------------------------------------------------------- team */

const PERMISSIONS = [
  ["Developer Console", "View, change", "No access", "No access"], ["Business workspace", "View (inspection)", "Own assigned clients", "No access"],
  ["Client accounts", "Create, edit, archive", "View assigned; request new clients", "Own organisation (Settings)"], ["Plan, seats, billing cycle", "Change and approve", "View; request changes", "View; request changes"],
  ["Modules", "Change", "View", "No access"], ["Deployments, provisioning, health", "Request, approve, view", "Live or not live only", "No access"],
  ["Sandboxes", "Create, change, retire", "No access", "No access"], ["Releases and production approval", "Approve (deployment via pipeline)", "No access", "No access"],
  ["Provider credentials and configuration", "References only, never values", "No access", "No access"], ["Actual provider costs and actual profit", "View, record", "No access", "No access"],
  ["Allocated expenses (commercial)", "Configure", "View assigned", "No access"], ["Invoices and payments", "Record, view", "View assigned", "Own invoices"],
  ["Distribution statements", "Prepare, publish, record payouts", "View published", "No access"], ["Logs, jobs, support reports", "View", "No access", "Own support reports"],
  ["Support access to client QMS records", "Only with a client grant (D17)", "Never", "Grants and revokes"], ["Client QMS records", "Never by role", "Never", "By role, process scope and classification"],
];
export function renderTeam(r) {
  const tab = r.query.get("tab") || "team";
  const t = [{ id: "team", label: "Team" }, { id: "permissions", label: "Permissions" }, { id: "history", label: "Change history" }, { id: "settings", label: "Settings" }];
  const d = getData();
  let body;
  if (tab === "team") body = dataTable({ id: "team", caption: "Platform team", rows: d.team, minWidth: 980, search: (p) => p.name + " " + p.email + " " + p.role, searchLabel: "Search people",
    empty: { title: "No one on the platform team yet", body: "Invite the people who run ThryveMS for all clients." },
    columns: [
      { key: "n", label: "Person", sort: (p) => p.name, cell: (p) => '<span class="row-primary">' + h(p.name) + '</span><div class="secondary">' + h(p.email) + "</div>" },
      { key: "r", label: "Role", sort: (p) => p.role, cell: (p) => h(p.role) },
      { key: "s", label: "Scope", cell: (p) => (p.partnerId ? linkTo(d.clients.filter((c) => c.partnerId === p.partnerId && c.accountStatus !== "Archived").length + " assigned clients", "#/dev/organisations") : h(p.scope)) },
      { key: "m", label: "Sign-in", cell: (p) => h(p.mfa) },
      { key: "st", label: "Status", sort: (p) => p.status, cell: (p) => badge(p.status, p.status === "Active" ? "done" : "soon") },
      { key: "l", label: "Last active", sort: (p) => p.last || "", cell: (p) => formatDateTime(p.last) },
      { key: "x", label: "Actions", srOnly: true, cell: (p) => (p.role === "Platform owner" ? '<span class="tiny muted">Owner</span>' : button("Change role", "tm-role", { id: p.id, cls: "btn-small" }) + button("Remove access", "tm-remove", { id: p.id, cls: "btn-small btn-danger" })) },
    ] }) + card({ title: "Partner assignments", note: "Change a client's partner from its organisation page. Partners see only their assigned clients.", body: PARTNERS.map((p) => row(h(p.label) + " · " + h(p.person), d.clients.filter((c) => c.partnerId === p.id && c.accountStatus !== "Archived").length + " assigned clients · seat authority up to " + p.seatAuthority + " seats per request", badge("Business partner", "progress"))).join("") });
  else if (tab === "permissions") body = alertBox("info", "In production these are enforced by the server behind Cloudflare Access and WorkOS passkeys (plan v3 D9).") +
    '<div class="card"><div class="table-scroll"><table class="data-table" style="min-width:900px"><caption class="sr-only">Permission matrix</caption><thead><tr><th scope="col">Capability</th><th scope="col">Platform owner (Developer)</th><th scope="col">Business partner</th><th scope="col">Client administrator</th></tr></thead><tbody>' +
    PERMISSIONS.map((p) => '<tr><th scope="row">' + h(p[0]) + "</th>" + p.slice(1).map((x) => "<td>" + (x === "No access" || x === "Never" ? badge(x, "draft") : h(x)) + "</td>").join("") + "</tr>").join("") + "</tbody></table></div></div>";
  else if (tab === "history") { const cid = getFilter("hist-client"); body = historyTable("audit", d.audit.filter((a) => !cid || a.clientId === cid), { toolbar: '<div class="filters">' + clientFilter("hist-client", d.clients) + "</div>" }); }
  else if (tab === "settings") body = settings();
  else return notFound();
  return pageHeader({ title: "Platform team", description: "Your own staff and business partners who can open a console. Nobody here can open client records without client-granted support access.", actions: tab === "team" ? button("Add team member", "tm-add", { cls: "btn-primary" }) : "" }) + tabs(t, tab, "#/dev/team", "Platform team sections") + body;
}
function settings() {
  const d = getData();
  const s = d.settings;
  return card({ title: "Sandboxes and seats", body: '<form class="card-body" data-inline-form="settings"><div class="form-grid">' +
    input("Default sandbox retention (days)", "st-ret", s.sandboxRetentionDays, { type: "number", min: 1, max: 30 }) + input("Active sandboxes allowed per client", "st-max", s.sandboxMaxPerClient, { type: "number", min: 1, max: 5 }) +
    input("Seats needing a commercial approval reference", "st-large", s.largeSeatApproval, { type: "number", min: 50, max: 1000, hint: "Subscriptions above this need an approval reference." }) + "</div>" + textarea("Reason for the change", "st-reason", "", { rows: 2 }) + formError("st-error") + button("Save settings", "st-save", { cls: "btn-primary", submit: true }) + "</form>" }) +
    card({ title: "Commercial and reporting", body: '<div class="card-body">' + keyFacts([["Reporting currency", h(s.currency)], ["Exchange rates", h(s.fxSource)], ["Seat counting", h(s.seatBasis) + ' <span class="muted small">(plan v3 §43 default is active users; needs decision)</span>'], ["Period close", h(s.periodClose)], ["Distribution", "30% Developer, 70% business partners combined, of distributable profit"], ["Payments", "Out of scope for release 1 (D21)"]]) + "</div>" }) +
    card({ title: "Identity and security (approved architecture, read-only)", note: "Changing these needs an ADR and the owner's approval.", body: '<div class="card-body">' + keyFacts([
      ["Console access", "Cloudflare Access in front of the platform hostname + WorkOS sign-in with passkeys (D9)"], ["Business partners", "Platform principals with their own role and Access policy; MFA required"], ["Client users", "Microsoft Entra OIDC or WorkOS AuthKit in their own workspace (D7, D8); never this console"],
      ["Sessions", "Idle 15/30/60 minutes, absolute 8 or 12 hours, step-up for sensitive actions (D15)"], ["MFA", "Always for platform admins and privileged client roles (D16)"], ["Support access", "Client-granted, 1/2/4 hours, read-only (D17)"],
    ]) + "</div>" }) +
    card({ title: "Provider integrations", body: d.integrations.map((i) => row(h(i.name), h(i.purpose), badge(i.status, "overdue"))).join("") });
}

/* ----------------------------------------------------------------- actions */

const formData = (sel = "[data-form]") => readForm(document.querySelector(sel));
function finish(res, msg, errId) { if (!res.ok) return showFormError(res.error, errId); closeOverlay(true); rerender(); notify(msg); }
let logsCache = [];

export const actions = {
  "req-decide": (el) => {
    const r = getData().requests.find((x) => x.id === el.dataset.id);
    const approve = el.dataset.arg === "approve";
    const what = { "Seat change": "updates the subscription with the requested effective date", "New client account": "creates a trial account (not provisioned) assigned to the partner", "Enterprise customization": "creates a project in Scoping", "Release promotion": "records your approval. production deployment is a separate step" }[r.kind] || "";
    dialog({ title: (approve ? "Approve" : "Decline") + " request?", description: h(r.title) + ". " + (approve ? "Approving " + h(what) + "." : "The requester sees your reason."), body: '<p class="small">' + h(describeRequest(r)) + "</p>" + textarea("Reason", "rq-reason", "", { rows: 2 }) + formError(),
      footer: button("Cancel", "close") + button(approve ? "Approve request" : "Decline request", "req-decide-save", { id: r.id, arg: el.dataset.arg, cls: approve ? "btn-primary" : "btn-danger", submit: true }) });
  },
  "req-decide-save": (el) => { const res = decideRequest(el.dataset.id, el.dataset.arg === "approve", formData()["rq-reason"]); finish(res, el.dataset.arg === "approve" ? "Request approved" + (res.note ? ". " + res.note : "") : "Request declined"); },
  "log-level": (el) => { setFilter("log-level", el.dataset.arg); rerender(); },
  "log-open": (el) => {
    const l = getData().logs.find((x) => x.id === el.dataset.id);
    dialog({ title: l.code, description: formatDateTime(l.at) + " · " + h(l.service), body: keyFacts([["Level", badge(l.level)], ["Organisation", h(clientById(l.clientId)?.name || "Platform")], ["Message", h(l.message)], ["Entry ID", "<code>" + h(l.id) + "</code>"]]) + '<p class="tiny muted">Sample entry. Real logs keep record IDs only.</p>',
      footer: button("Copy entry ID", "log-copy", { id: l.id }) + button("Close", "close") });
  },
  "log-copy": (el) => { navigator.clipboard?.writeText(el.dataset.id).then(() => notify("Entry ID copied"), () => notify("Copy isn't allowed in this browser")); },
  "log-export": () => {
    const d = getData();
    const level = getFilter("log-level"), svc = getFilter("log-svc"), cid = getFilter("log-client");
    logsCache = d.logs.filter((l) => (!level || l.level === level) && (!svc || l.service === svc) && (!cid || l.clientId === cid));
    const csv = ["time,level,service,code,message,organisation"].concat(logsCache.map((l) => [l.at, l.level, l.service, l.code, l.message, clientById(l.clientId)?.name || "Platform"].map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(","))).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "thryvems-sample-logs.csv"; document.body.appendChild(a); a.click(); a.remove();
    notify("Exported " + logsCache.length + " sample log entries");
  },
  "rp-save": (el) => { const f = formData("[data-inline-form=report]"); const r = getData().supportReports.find((x) => x.id === el.dataset.id); const res = updateReport(el.dataset.id, { text: f["rp-text"], state: f["rp-state"], sandboxId: f["rp-sb"] && f["rp-sb"] !== r.sandboxId ? f["rp-sb"] : null }); if (!res.ok) return showFormError(res.error, "rp-error"); rerender(); notify("Update saved"); },
  "sa-request": (el) => {
    const d = getData();
    const r = el.dataset.arg ? d.supportReports.find((x) => x.id === el.dataset.arg) : null;
    const reports = d.supportReports.filter((x) => !["Closed"].includes(x.state));
    sheet({ title: "Request support access", description: "The client's Owner or Administrator approves the request in their workspace. You can't grant it here.", body:
      combobox("Organisation", "sa-client", r ? clientById(r.clientId).name : "", [...new Set(reports.map((x) => clientById(x.clientId)?.name).filter(Boolean))]) +
      select("Support report", "sa-ticket", r?.id || "", reports.map((x) => ({ value: x.id, label: x.id + " · " + (clientById(x.clientId)?.name || "") + " · " + x.title })), { placeholder: "Choose a report" }) +
      select("Duration", "sa-hours", "1", [{ value: "1", label: "1 hour" }, { value: "2", label: "2 hours" }, { value: "4", label: "4 hours" }]) +
      alertBox("info", "Read-only. Confidential and Highly confidential records stay hidden. Every record opened is logged on the client's side.") + formError(),
      footer: button("Cancel", "close") + button("Send request", "sa-save", { cls: "btn-primary", submit: true, primary: true }) });
  },
  "sa-save": () => { const f = formData(); const c = getData().clients.find((x) => x.name.toLowerCase() === String(f["sa-client"] || "").trim().toLowerCase()); finish(requestSupportAccess({ clientId: c?.id, ticket: f["sa-ticket"], hours: f["sa-hours"] }), "Support access requested. Waiting for the client."); },
  "sa-end": (el) => {
    const g = getData().supportGrants.find((x) => x.id === el.dataset.id);
    dialog({ title: g.state === "Active" ? "End support access now?" : "Withdraw request?", description: h(clientById(g.clientId)?.name || "") + " · " + h(g.ticket), body: '<p class="small">Access stops for every request after this. The client sees it ended.</p>' + formError(),
      footer: button("Cancel", "close") + button(g.state === "Active" ? "End now" : "Withdraw request", "sa-end-confirm", { id: g.id, cls: "btn-danger", submit: true }) });
  },
  "sa-end-confirm": (el) => finish(endSupportAccess(el.dataset.id), "Support access ended"),
  "tm-add": () => sheet({ title: "Add team member", description: "Creates a preview record only. No invitation is sent; real access needs Cloudflare Access and WorkOS.", body: input("Name", "tm-name", "") + input("Email", "tm-email", "", { type: "email" }) + select("Role", "tm-role", "", TEAM_ROLES.slice(1), { placeholder: "Choose a role" }) + formError(),
    footer: button("Cancel", "close") + button("Add team member", "tm-add-save", { cls: "btn-primary", submit: true, primary: true }) }),
  "tm-add-save": () => { const f = formData(); finish(inviteMember({ name: f["tm-name"], email: f["tm-email"], role: f["tm-role"] }), "Team member added (invitation not sent)"); },
  "tm-role": (el) => { const p = getData().team.find((x) => x.id === el.dataset.id); dialog({ title: "Change role", description: h(p.name), body: select("Role", "tr-role", p.role, TEAM_ROLES.slice(1)) + textarea("Reason", "tr-reason", "", { rows: 2 }) + formError(), footer: button("Cancel", "close") + button("Change role", "tm-role-save", { id: p.id, cls: "btn-primary", submit: true }) }); },
  "tm-role-save": (el) => { const f = formData(); finish(changeMemberRole(el.dataset.id, f["tr-role"], f["tr-reason"]), "Role changed"); },
  "tm-remove": (el) => { const p = getData().team.find((x) => x.id === el.dataset.id); dialog({ title: "Remove " + p.name + "?", description: "They lose console access at the next request.", body: textarea("Reason", "rm-reason", "", { rows: 2 }) + formError(), footer: button("Cancel", "close") + button("Remove access", "tm-remove-save", { id: p.id, cls: "btn-danger", submit: true }) }); },
  "tm-remove-save": (el) => finish(removeMember(el.dataset.id, formData()["rm-reason"]), "Access removed"),
  "st-save": () => { const f = formData("[data-inline-form=settings]"); const res = updateSettings({ sandboxRetentionDays: f["st-ret"], sandboxMaxPerClient: f["st-max"], largeSeatApproval: f["st-large"], reason: f["st-reason"] }); if (!res.ok) return showFormError(res.error, "st-error"); rerender(); notify("Settings saved"); },
  "reset-preview": () => dialog({ title: "Reset preview data?", description: "Every change made in this browser is lost and the synthetic records are restored.", body: "", footer: button("Cancel", "close") + button("Reset preview data", "reset-confirm", { cls: "btn-danger", submit: true }) }),
  "reset-confirm": () => { resetPreview(); resetTables(); closeOverlay(true); go("#/dev"); rerender(); notify("Preview data reset"); },
};
export { getUi };
