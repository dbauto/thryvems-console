/** Developer Console › Deployments › Sandboxes. Per-client isolated sandboxes, simulated in the preview. */
import { getData, clientById, deploymentFor, sandboxStatus, activeSandboxes, readiness, createSandbox, advanceSandbox, retrySandbox, changeSandboxTarget, recordSandboxNote, recordSandboxTest, submitSandboxReview, decideSandboxReview, requestPromotion, retireSandbox, extendSandbox } from "../store.js";
import { SANDBOX_STATES, SANDBOX_PURPOSES } from "../seed.js";
import { h, badge, keyFacts, dataTable, sheet, dialog, button, input, select, textarea, combobox, formError, readForm, showFormError, closeOverlay, alertBox, lifecycleTrack, card, row, linkTo, emptyLine, pageHeader, unavailable, simBadge } from "../ui.js";
import { formatDate, formatDateTime, slugify, daysBetween, TODAY } from "../util.js";
import { selectFilter, getFilter, tabs, notFound } from "./shared.js";
import { rerender, go, notify, registry } from "../registry.js";

const TRACK = ["Requested", "Provisioning", "Ready", "Testing", "Ready for review", "Approved for release"];

export function renderListTab() {
  const d = getData();
  const st = getFilter("sb-status"), purpose = getFilter("sb-purpose");
  const rows = d.sandboxes.filter((s) => (!st || sandboxStatus(s) === st || (st === "active" && !["Retired", "Expired"].includes(sandboxStatus(s)))) && (!purpose || s.purpose === purpose));
  const toolbar = '<div class="filters">' + selectFilter("sb-status", "Status", [{ value: "", label: "All statuses" }, { value: "active", label: "Active (not retired or expired)" }, ...SANDBOX_STATES.map((s) => ({ value: s, label: s === "Failed" ? "Provisioning or test failed" : s }))]) +
    selectFilter("sb-purpose", "Purpose", [{ value: "", label: "All purposes" }, ...SANDBOX_PURPOSES.map((p) => ({ value: p, label: p }))]) + "</div>";
  return alertBox("info", "<strong>Sandboxes are simulated.</strong> Each record models an isolated Worker and database with synthetic data and its own credentials. Nothing is created in Cloudflare or Neon, and production is never changed.") +
    dataTable({ id: "sandboxes", caption: "Client sandboxes", rows, minWidth: 1200, toolbar,
      search: (s) => s.name + " " + (clientById(s.clientId)?.name || "") + " " + s.reference + " " + s.targetVersion, searchLabel: "Search sandboxes",
      empty: { title: "No sandboxes", body: "Create a sandbox for any live client to investigate an issue or validate a version." },
      columns: [
        { key: "n", label: "Sandbox", sort: (s) => s.name, cell: (s) => linkTo(s.name, "#/dev/sandboxes/" + s.id) + '<div class="secondary">' + simBadge() + "</div>" },
        { key: "c", label: "Client", sort: (s) => clientById(s.clientId)?.name || "", cell: (s) => h(clientById(s.clientId)?.name || "") },
        { key: "p", label: "Purpose", sort: (s) => s.purpose, cell: (s) => h(s.purpose) },
        { key: "r", label: "Reference", sort: (s) => s.reference, cell: (s) => "<code>" + h(s.reference) + "</code>" },
        { key: "v", label: "Production → sandbox", cell: (s) => "v" + h(s.sourceVersion) + " → v" + h(s.targetVersion) },
        { key: "s", label: "Status", sort: (s) => sandboxStatus(s), cell: (s) => badge(sandboxStatus(s) === "Failed" ? "Failed" : sandboxStatus(s)) },
        { key: "e", label: "Expires", sort: (s) => s.expiresAt, cell: (s) => formatDate(s.expiresAt) },
        { key: "o", label: "Open", srOnly: true, cell: (s) => linkTo("Open", "#/dev/sandboxes/" + s.id) },
      ] });
}

export function renderDetail(id, r) {
  const d = getData();
  const s = d.sandboxes.find((x) => x.id === id);
  if (!s) return notFound();
  const c = clientById(s.clientId);
  const dep = deploymentFor(s.clientId);
  const status = sandboxStatus(s);
  const tab = r.query.get("tab") || "overview";
  const t = [{ id: "overview", label: "Overview" }, { id: "config", label: "Configuration" }, { id: "tests", label: "Test results" }, { id: "changes", label: "Changes and builds" }, { id: "compare", label: "Compare with production" }, { id: "readiness", label: "Release readiness" }, { id: "cleanup", label: "Cleanup" }];
  let body;
  if (tab === "overview") body = overview(s, c, dep, status);
  else if (tab === "config") body = config(s, dep);
  else if (tab === "tests") body = tests(s, status);
  else if (tab === "changes") body = changes(s);
  else if (tab === "compare") body = compare(s, c, dep);
  else if (tab === "readiness") body = readinessTab(s, status);
  else if (tab === "cleanup") body = cleanup(s, status);
  else return notFound();
  return pageHeader({ title: s.name, crumbs: [{ label: "Deployments", href: "#/dev/deployments?tab=sandboxes" }, { label: "Sandboxes", href: "#/dev/deployments?tab=sandboxes" }, { label: s.name }],
    description: badge(status) + " " + simBadge() + " " + h(c.name) + " · " + h(s.purpose) + " · <code>" + h(s.reference) + "</code>", actions: statusActions(s, status) }) +
    tabs(t, tab, "#/dev/sandboxes/" + s.id, "Sandbox sections") + body;
}

function statusActions(s, status) {
  const a = [];
  if (status === "Requested" || status === "Provisioning") a.push(button("Advance simulation", "sb-advance", { id: s.id, cls: "btn-primary" }), button("Simulate a failure", "sb-fail", { id: s.id }));
  if (status === "Failed") a.push(button("Retry", "sb-retry", { id: s.id, cls: "btn-primary" }));
  if (["Ready", "Testing"].includes(status)) a.push(button("Submit for review", "sb-submit", { id: s.id, cls: "btn-primary" }));
  if (status === "Ready for review") a.push(button("Approve review", "sb-review", { id: s.id, arg: "approve", cls: "btn-primary" }), button("Request changes", "sb-review", { id: s.id, arg: "changes" }));
  if (status === "Approved for release" && !s.promotionRequestId) a.push(button("Request production promotion", "sb-promote", { id: s.id, cls: "btn-primary" }));
  if (status === "Approved for release" && s.promotionRequestId) a.push(linkTo("View promotion request", "#/dev/requests"));
  if (status !== "Retired") a.push(button("Retire sandbox", "sb-retire", { id: s.id, cls: "btn-danger" }));
  return a.join("");
}

function overview(s, c, dep, status) {
  const idx = Math.max(0, TRACK.indexOf(status));
  const failedIdx = status === "Failed" ? (s.failure?.step ? 1 : 3) : undefined;
  return card({ title: "Lifecycle", note: "Requested → Provisioning → Ready → Testing → Ready for review → Approved for release. Failed, Expired and Retired can happen at any point.", body: '<div class="card-body">' +
    lifecycleTrack(TRACK, status === "Approved for release" ? 6 : ["Expired", "Retired"].includes(status) ? -1 : status === "Failed" ? failedIdx : idx, failedIdx) +
    (["Expired", "Retired"].includes(status) ? alertBox("info", "This sandbox is <strong>" + h(status) + "</strong>. Its record and history are kept.") : "") +
    (status === "Failed" && s.failure ? alertBox("danger", "<strong>Provisioning or test failed</strong> at " + h(s.failure.step) + " (<code>" + h(s.failure.code) + "</code>). " + h(s.failure.message), "alert") : "") + "</div>" }) +
    '<section class="split">' +
    card({ title: "Source production", body: '<div class="card-body">' + keyFacts([["Client", linkTo(c.name, "#/dev/organisations/" + c.id)], ["Production deployment", dep ? linkTo(dep.worker, "#/dev/deployments/" + dep.id) : null], ["Source version", "v" + h(s.sourceVersion)], ["Production version now", dep?.version ? "v" + h(dep.version) : null]]) + "</div>" }) +
    card({ title: "Sandbox", action: ["Ready", "Testing", "Ready for review"].includes(status) ? button("Change target version", "sb-target", { id: s.id, cls: "btn-small" }) : "", body: '<div class="card-body">' + keyFacts([
      ["Sandbox version", "v" + h(s.targetVersion)], ["Hostname", '<span class="muted">Not assigned (simulation)</span>'], ["Database", '<span class="muted">Separate sandbox database (not created)</span>'], ["Credentials", "Independent, never production secrets"],
      ["Test data", "Synthetic sample data only"], ["Health", badge(s.health.startsWith("Not checked") ? "Not checked" : s.health) + ' <span class="tiny muted">simulation</span>'], ["Created", formatDate(s.createdAt)], ["Expires", formatDate(s.expiresAt) + (status !== "Retired" ? " (" + daysBetween(TODAY, s.expiresAt) + " days)" : "")],
    ]) + '<div class="inline-actions">' + unavailable("Open sandbox app", "No hostname exists: simulated environment") + "</div></div>" }) +
    "</section>" +
    card({ title: "Issue or fix being investigated", action: !["Retired", "Expired"].includes(status) ? button("Record issue or fix", "sb-note", { id: s.id, cls: "btn-small" }) : "", body: '<div class="card-body">' + keyFacts([["Purpose", h(s.purpose)], ["Reference", "<code>" + h(s.reference) + "</code>"], ["Description", h(s.description || "")]]) + "</div>" });
}

function config(s, dep) {
  const cfg = s.config || {};
  return alertBox("info", "Only approved, non-secret settings are reproduced. Secrets, tokens, production database copies and QMS records are never copied.") +
    card({ title: "Environment configuration", body: '<div class="card-body">' + keyFacts([
      ["Enabled modules", cfg.modules ? h(cfg.modules.join(", ")) : '<span class="muted">Not reproduced (defaults)</span>'],
      ["Idle timeout", cfg.idleTimeoutMinutes ? cfg.idleTimeoutMinutes + " minutes" : '<span class="muted">Not reproduced (default 30)</span>'],
      ["Branding version", cfg.brandingVersion ? h(cfg.brandingVersion) : '<span class="muted">Not reproduced</span>'],
      ["Data", "Synthetic sample data, reset on request"], ["Secrets", "Generated for the sandbox; never copied from production"], ["Source deployment", dep ? "<code>" + h(dep.worker) + "</code>" : null],
    ]) + "</div>" });
}

function tests(s, status) {
  const open = ["Ready", "Testing", "Ready for review"].includes(status);
  return card({ title: "Test results", note: "Results are recorded from CI runs or manual testing. The preview doesn't run tests.", action: '<div class="inline-actions">' + unavailable("Run tests", "Needs CI integration") + (open ? button("Record test result", "sb-test", { id: s.id, cls: "btn-small" }) : "") + "</div>",
    body: s.tests.length ? s.tests.slice().reverse().map((t) => row(h(t.name) + " · v" + h(t.version || s.targetVersion), formatDateTime(t.at) + " · " + h(t.by) + (t.notes ? " · " + h(t.notes) : "") + (t.link ? " · " + '<a href="' + h(t.link) + '" target="_blank" rel="noopener">CI run ↗</a>' : ""), badge(t.result))).join("") : emptyLine("No test results", "Record results once the sandbox is Ready.") });
}
function changes(s) {
  return card({ title: "Change history", body: s.changes.slice().reverse().map((x) => row(h(x.text), formatDateTime(x.at) + " · " + h(x.by))).join("") || emptyLine("No changes", "") }) +
    card({ title: "Deployment and build history", note: "Builds in a sandbox are simulated.", body: s.builds.slice().reverse().map((b) => row("v" + h(b.version) + (b.build ? " · <code>" + h(b.build) + "</code>" : ""), formatDateTime(b.at), badge(b.result === "Simulated" ? "Simulation" : b.result, "draft"))).join("") || emptyLine("No builds", "Builds appear once provisioning finishes.") });
}
function compare(s, c, dep) {
  const d = getData();
  const prodRel = d.releases.find((r) => r.version === dep?.version);
  const sbRel = d.releases.find((r) => r.version === s.targetVersion);
  const cfg = s.config || {};
  const between = d.releases.filter((r) => dep?.version && r.date > (prodRel?.date || "") && r.date <= (sbRel?.date || ""));
  const rows = [
    ["Application version", dep?.version ? "v" + dep.version : "No data", "v" + s.targetVersion],
    ["Build", prodRel?.build || "No data", sbRel?.build || "No data"],
    ["Commit", prodRel?.commit || "No data", sbRel?.commit || "No data"],
    ["Schema", dep?.schema || "No data", sbRel?.schema || "No data"],
    ["Enabled modules", c.modules.join(", "), cfg.modules ? cfg.modules.join(", ") : "Defaults"],
    ["Idle timeout", (dep?.config.idleTimeoutMinutes || "") + " minutes", cfg.idleTimeoutMinutes ? cfg.idleTimeoutMinutes + " minutes" : "30 minutes (default)"],
    ["Data", "Client QMS records (never copied)", "Synthetic sample data"],
    ["Credentials", "Production secrets (never copied)", "Separate sandbox credentials"],
    ["Database", dep?.resources.neonProject || "No data", "Separate sandbox database (simulation)"],
  ];
  return card({ title: "Compare with production", note: "Version and configuration differences. Production is not changed by anything in this sandbox.", body:
    '<div class="table-scroll"><table class="data-table compare" style="min-width:720px"><thead><tr><th scope="col">Item</th><th scope="col">Production</th><th scope="col">Sandbox</th><th scope="col">Difference</th></tr></thead><tbody>' +
    rows.map(([k, a, b]) => "<tr><th scope=\"row\">" + h(k) + "</th><td>" + h(a) + "</td><td>" + h(b) + "</td><td>" + badge(a === b ? "Same" : "Different", a === b ? "draft" : "soon") + "</td></tr>").join("") + "</tbody></table></div>" }) +
    card({ title: "Release notes between versions", body: between.map((r) => row("v" + h(r.version) + " · " + h(r.type), formatDate(r.date) + " · " + h(r.notes), badge(r.verification))).join("") || emptyLine("Same version", "The sandbox runs the production version.") }) +
    alertBox("info", "A code-level diff needs the build manifest from the release registry (GitHub integration not connected).");
}
function readinessTab(s, status) {
  const checks = readiness(s);
  const ready = checks.every((x) => x.ok);
  return card({ title: "Release readiness", note: "Every check must pass before production promotion can be requested. Production deployment itself stays disabled in the preview.", body:
    '<ul class="checklist card-body">' + checks.map((x) => '<li class="' + (x.ok ? "ok" : "bad") + '">' + badge(x.ok ? "Passed" : "Not yet", x.ok ? "done" : "soon") + " " + h(x.label) + "</li>").join("") + "</ul>" +
    '<div class="card-body">' + (ready ? alertBox("info", "<strong>Ready.</strong> " + (s.promotionRequestId ? "Promotion requested (" + h(s.promotionRequestId) + ")." : "You can request production promotion.")) : alertBox("warning", "Not ready for promotion yet.")) +
    '<div class="inline-actions">' + (status === "Approved for release" && !s.promotionRequestId ? button("Request production promotion", "sb-promote", { id: s.id, cls: "btn-primary" }) : "") + unavailable("Deploy to production", "Needs the approved backend pipeline and the owner's approval in GitHub") + "</div></div>" });
}
function cleanup(s, status) {
  return card({ title: "Cleanup and expiration", note: "Sandboxes expire after their retention period and are then retired. In production, retirement deletes the sandbox Worker and database.", body: '<div class="card-body">' +
    keyFacts([["Retention", s.retentionDays + " days"], ["Expires", formatDate(s.expiresAt)], ["Status", badge(status)]]) +
    '<div class="inline-actions">' + (status !== "Retired" ? button("Extend retention", "sb-extend", { id: s.id }) + button("Retire sandbox", "sb-retire", { id: s.id, cls: "btn-danger" }) : '<span class="muted">Retired. The record is kept for history.</span>') + "</div></div>" });
}

/* ------------------------------------------------------------- create sheet */

let form = null;
function createSheet() {
  const d = getData();
  const eligible = d.clients.filter((c) => deploymentFor(c.id)?.status === "Live");
  const c = form.clientId ? clientById(form.clientId) : null;
  const dep = c ? deploymentFor(c.id) : null;
  const n = c ? activeSandboxes(c.id).length : 0;
  sheet({ title: "Create sandbox", description: "An isolated environment for one client. Simulated in this preview: no cloud resources are created and production is never changed.", wide: true, body:
    combobox("Client organisation", "sb-client", c?.name || "", eligible.map((x) => x.name), { hint: "Type to search clients with a live production deployment." }) +
    (c ? '<p class="small muted" data-testid="sb-source">Source production: <code>' + h(dep.worker) + "</code> · v" + h(dep.version) + " · " + n + " of " + d.settings.sandboxMaxPerClient + " active sandboxes</p>" : "") +
    '<div class="form-grid">' +
    input("Source production environment", "sb-source-env", dep ? dep.worker : "", { disabled: true, hint: "Taken from the client's production deployment." }) +
    input("Source application version", "sb-source-ver", dep ? dep.version : "", { disabled: true }) +
    select("Target application version", "sb-target", form.target || dep?.version || "", d.releases.map((r) => ({ value: r.version, label: "v" + r.version + " · " + r.type + " · " + r.verification })), { hint: "Same as source unless you are validating another version." }) +
    input("Sandbox name", "sb-name", form.name || (c ? c.slug + "-" + (form.reference || "test").toLowerCase() : ""), { hint: "Lowercase letters, numbers and hyphens." }) +
    select("Purpose", "sb-purpose", form.purpose || "Bug fix", SANDBOX_PURPOSES) +
    input("Issue or change reference", "sb-reference", form.reference || "", { placeholder: "SR-1035 or CHG-140" }) +
    input("Retention (days)", "sb-retention", form.retention || d.settings.sandboxRetentionDays, { type: "number", min: 1, max: 30, hint: "1 to 30 days. Expired sandboxes are retired." }) +
    input("Test data", "sb-data", "Synthetic sample data only", { disabled: true, hint: "Production QMS records, emails and secrets are never copied." }) + "</div>" +
    textarea("Description (optional)", "sb-desc", form.desc || "", { rows: 2 }) +
    '<fieldset class="field"><legend>Approved non-secret configuration to reproduce</legend>' +
    [["modules", "Enabled modules"], ["idleTimeoutMinutes", "Session idle timeout"], ["brandingVersion", "Branding version"]].map(([v, l]) => '<label class="ms-item"><input type="checkbox" name="sb-config" value="' + v + '"' + ((form.config || ["modules"]).includes(v) ? " checked" : "") + " /> " + h(l) + "</label>").join("") +
    '<small>Secrets, credentials and integration tokens are never reproducible.</small></fieldset>' +
    alertBox("warning", "<strong>Simulation.</strong> This records a sandbox request. No Worker, Neon project or hostname is created.") + formError(),
    footer: button("Cancel", "close") + button("Create sandbox", "sb-save", { cls: "btn-primary", submit: true, primary: true }) });
}
registry.changes["sb-client"] = () => {};
function captureForm() {
  const f = readForm(document.querySelector("[data-form]"));
  const c = getData().clients.find((x) => x.name.toLowerCase() === String(f["sb-client"] || "").trim().toLowerCase());
  const changed = (c?.id || null) !== (form?.clientId || null);
  form = { clientId: c?.id || null, typed: f["sb-client"], target: f["sb-target"], name: f["sb-name"], purpose: f["sb-purpose"], reference: f["sb-reference"], retention: f["sb-retention"], desc: f["sb-desc"], config: f["sb-config"] || [] };
  if (changed) { form.target = undefined; form.name = undefined; }
  return { f, c };
}

export const actions = {
  "sb-create": (el) => {
    form = { clientId: el.dataset.id && deploymentFor(el.dataset.id)?.status === "Live" ? el.dataset.id : null };
    const report = el.dataset.arg ? getData().supportReports.find((r) => r.id === el.dataset.arg) : null;
    if (report) { form.clientId = report.clientId; form.reference = report.id; form.purpose = "Bug fix"; form.desc = report.title; }
    createSheet();
    document.getElementById("sb-client")?.setAttribute("data-change", "sb-client-pick");
  },
  "sb-save": () => {
    const { f, c } = captureForm();
    const dep = c ? deploymentFor(c.id) : null;
    const res = createSandbox({ clientId: c?.id, sourceVersion: dep?.version, targetVersion: f["sb-target"], name: f["sb-name"], purpose: f["sb-purpose"], reference: f["sb-reference"], description: f["sb-desc"], retentionDays: f["sb-retention"], config: f["sb-config"] || [] });
    if (!res.ok) return showFormError(res.error);
    closeOverlay(true); notify("Sandbox requested (simulation)"); go("#/dev/sandboxes/" + res.id);
  },
  "sb-advance": (el) => { const res = advanceSandbox(el.dataset.id); if (!res.ok) return notify(res.error); rerender(); notify("Simulation advanced to " + sandboxStatus(getData().sandboxes.find((s) => s.id === el.dataset.id))); },
  "sb-fail": (el) => { const res = advanceSandbox(el.dataset.id, "fail"); if (!res.ok) return notify(res.error); rerender(); notify("Simulated provisioning failure recorded"); },
  "sb-retry": (el) => { const res = retrySandbox(el.dataset.id); if (!res.ok) return notify(res.error); rerender(); notify("Retry requested"); },
  "sb-target": (el) => {
    const s = getData().sandboxes.find((x) => x.id === el.dataset.id);
    dialog({ title: "Change target version", description: "Earlier test results won't count toward readiness for the new version.", body: select("Target version", "t-ver", s.targetVersion, getData().releases.map((r) => ({ value: r.version, label: "v" + r.version + " · " + r.verification }))) + textarea("Reason", "t-reason", "", { rows: 2 }) + formError(),
      footer: button("Cancel", "close") + button("Change version", "sb-target-save", { id: s.id, cls: "btn-primary", submit: true, primary: true }) });
  },
  "sb-target-save": (el) => { const f = readForm(document.querySelector("[data-form]")); finish(changeSandboxTarget(el.dataset.id, f["t-ver"], f["t-reason"]), "Target version changed"); },
  "sb-note": (el) => dialog({ title: "Record issue or fix", description: "Add what you found or changed. It goes into the sandbox change history.", body: textarea("Issue or fix", "n-text", "", { rows: 4 }) + formError(), footer: button("Cancel", "close") + button("Record", "sb-note-save", { id: el.dataset.id, cls: "btn-primary", submit: true }) }),
  "sb-note-save": (el) => finish(recordSandboxNote(el.dataset.id, readForm(document.querySelector("[data-form]"))["n-text"]), "Recorded in change history"),
  "sb-test": (el) => dialog({ title: "Record test result", description: "Record a result from CI or manual testing. The preview doesn't run tests.", body: input("Test or suite name", "x-name", "Playwright e2e suite") + select("Result", "x-result", "Passed", ["Passed", "Failed"]) + input("Link to CI run (optional)", "x-link", "", { hint: "Full https:// link." }) + textarea("Notes", "x-notes", "", { rows: 2 }) + formError(),
    footer: button("Cancel", "close") + button("Record result", "sb-test-save", { id: el.dataset.id, cls: "btn-primary", submit: true, primary: true }) }),
  "sb-test-save": (el) => { const f = readForm(document.querySelector("[data-form]")); finish(recordSandboxTest(el.dataset.id, { name: f["x-name"], result: f["x-result"], link: f["x-link"], notes: f["x-notes"] }), "Test result recorded"); },
  "sb-submit": (el) => { const res = submitSandboxReview(el.dataset.id); if (!res.ok) { dialog({ title: "Not ready for review", description: "", body: alertBox("warning", h(res.error), "alert") + '<p><a href="#/dev/sandboxes/' + h(el.dataset.id) + '?tab=readiness">See release readiness</a></p>' }); return; } rerender(); notify("Submitted for review"); },
  "sb-review": (el) => {
    const approve = el.dataset.arg === "approve";
    dialog({ title: approve ? "Approve review?" : "Request changes?", description: approve ? "Approval marks the sandbox Approved for release. It doesn't deploy anything." : "The sandbox returns to Testing.", body: textarea("Reason", "rv-reason", "", { rows: 2 }) + formError(),
      footer: button("Cancel", "close") + button(approve ? "Approve review" : "Request changes", "sb-review-save", { id: el.dataset.id, arg: el.dataset.arg, cls: "btn-primary", submit: true }) });
  },
  "sb-review-save": (el) => finish(decideSandboxReview(el.dataset.id, el.dataset.arg === "approve", readForm(document.querySelector("[data-form]"))["rv-reason"]), el.dataset.arg === "approve" ? "Review approved" : "Changes requested"),
  "sb-promote": (el) => dialog({ title: "Request production promotion?", description: "Creates a request for the platform owner's approval in Requests. Production deployment stays unavailable in the preview.", body: textarea("Reason", "pr-reason", "", { rows: 2 }) + formError(), footer: button("Cancel", "close") + button("Request promotion", "sb-promote-save", { id: el.dataset.id, cls: "btn-primary", submit: true }) }),
  "sb-promote-save": (el) => finish(requestPromotion(el.dataset.id, readForm(document.querySelector("[data-form]"))["pr-reason"]), "Promotion requested. Approve it in Requests."),
  "sb-retire": (el) => {
    const s = getData().sandboxes.find((x) => x.id === el.dataset.id);
    dialog({ title: "Retire " + s.name + "?", description: "The sandbox stops and its record is kept. In production this deletes the sandbox Worker and database. Production is not affected.", body: textarea("Reason", "rt-reason", "", { rows: 2 }) + formError(),
      footer: button("Keep sandbox", "close") + button("Retire sandbox", "sb-retire-save", { id: s.id, cls: "btn-danger", submit: true }) });
  },
  "sb-retire-save": (el) => finish(retireSandbox(el.dataset.id, readForm(document.querySelector("[data-form]"))["rt-reason"]), "Sandbox retired"),
  "sb-extend": (el) => dialog({ title: "Extend retention", description: "", body: input("Extend by (days)", "ex-days", 7, { type: "number", min: 1, max: 30 }) + textarea("Reason", "ex-reason", "", { rows: 2 }) + formError(), footer: button("Cancel", "close") + button("Extend", "sb-extend-save", { id: el.dataset.id, cls: "btn-primary", submit: true, primary: true }) }),
  "sb-extend-save": (el) => { const f = readForm(document.querySelector("[data-form]")); finish(extendSandbox(el.dataset.id, f["ex-days"], f["ex-reason"]), "Retention extended"); },
};
registry.changes["sb-client-pick"] = () => {
  captureForm();
  createSheet();
  document.getElementById("sb-client")?.setAttribute("data-change", "sb-client-pick");
  document.getElementById("sb-target")?.focus();
};
function finish(res, msg) { if (!res.ok) return showFormError(res.error); closeOverlay(true); rerender(); notify(msg); }
