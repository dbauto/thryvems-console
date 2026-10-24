/** Developer Console › Releases: version registry, workflow, approvals, per-client history. No automatic production deployments. */
import { getData, clientById, sandboxStatus, approveRelease } from "../store.js";
import { RELEASE_STAGES } from "../seed.js";
import { h, pageHeader, badge, keyFacts, dataTable, dialog, button, textarea, formError, readForm, showFormError, closeOverlay, alertBox, lifecycleTrack, card, row, linkTo, emptyLine, figure, figureGrid, unavailable } from "../ui.js";
import { formatDate, formatDateTime } from "../util.js";
import { tabs, notFound, clientFilter, getFilter } from "./shared.js";
import { rerender, notify } from "../registry.js";

const usingVersion = (v) => getData().deployments.filter((d) => d.status === "Live" && d.version === v);
const rollbackFor = (r) => getData().releases.filter((x) => x.date < r.date && x.schema === r.schema && x.verification === "Verified")[0];

export function renderList(r) {
  const d = getData();
  const tab = r.query.get("tab") || "registry";
  const latest = d.releases.find((x) => x.approval === "Approved" && x.verification === "Verified");
  const awaiting = d.releases.filter((x) => x.approval !== "Approved");
  const promos = d.requests.filter((x) => x.kind === "Release promotion" && x.status === "Pending");
  const header = pageHeader({ title: "Releases", description: "Application versions for every client deployment. Production releases need the platform owner's approval; nothing deploys automatically, and the preview never deploys." }) +
    figureGrid([
      figure({ label: "Versions in the registry", value: d.releases.length, icon: "⇧" }),
      figure({ label: "Latest verified release", value: latest ? "v" + latest.version : "No data", note: latest ? usingVersion(latest.version).length + " live clients on it" : "", icon: "✓" }),
      figure({ label: "Releases awaiting approval", value: awaiting.length, badge: awaiting.length ? "Pending" : "None", icon: "○" }),
      figure({ label: "Promotion requests", value: promos.length, badge: promos.length ? "Pending" : "None", icon: "✉", href: "#/dev/requests" }),
    ], "Release figures") +
    card({ title: "Release workflow", note: "Every production change follows these stages. The preview stops before production deployment.", body: '<div class="card-body">' + lifecycleTrack(RELEASE_STAGES, 5) + '<p class="small muted">Production deployment and verification require the GitHub production environment approval and the trusted pipeline (plan v3 §29, §32).</p></div>' }) +
    tabs([{ id: "registry", label: "Release registry" }, { id: "history", label: "Per-client release history" }], tab, "#/dev/releases", "Release views");
  if (tab === "history") {
    const cid = getFilter("rh-client");
    const rows = d.releaseHistory.filter((x) => !cid || x.clientId === cid);
    return header + dataTable({ id: "rel-history", caption: "Per-client release history", rows, minWidth: 1300, toolbar: '<div class="filters">' + clientFilter("rh-client", d.clients) + "</div>",
      search: (x) => (clientById(x.clientId)?.name || "") + " " + x.ref + " " + x.to, searchLabel: "Search history",
      empty: { title: "No release history", body: "Version changes per client appear here." },
      columns: [
        { key: "at", label: "Date", sort: (x) => x.at, cell: (x) => formatDateTime(x.at) },
        { key: "c", label: "Client", sort: (x) => clientById(x.clientId)?.name || "", cell: (x) => h(clientById(x.clientId)?.name || "") },
        { key: "f", label: "Previous version", cell: (x) => "v" + h(x.from) }, { key: "t", label: "Target version", sort: (x) => x.to, cell: (x) => "v" + h(x.to) },
        { key: "e", label: "Environment", cell: (x) => h(x.env) }, { key: "ref", label: "Change reference", sort: (x) => x.ref, cell: (x) => "<code>" + h(x.ref) + "</code>" },
        { key: "by", label: "Requested by", cell: (x) => h(x.requestedBy) }, { key: "ap", label: "Approval", cell: (x) => h(x.approval) },
        { key: "res", label: "Deployment result", sort: (x) => x.result, cell: (x) => badge(x.result, x.result === "Succeeded" ? "done" : "soon") },
        { key: "v", label: "Verification", cell: (x) => h(x.verification) }, { key: "rb", label: "Rollback reference", cell: (x) => h(x.rollbackRef || "—") },
      ] });
  }
  if (tab !== "registry") return notFound();
  return header + dataTable({ id: "releases", caption: "Release registry", rows: d.releases, minWidth: 1400,
    search: (x) => x.version + " " + x.type + " " + x.notes + " " + x.commit, searchLabel: "Search releases",
    empty: { title: "No releases", body: "Releases appear when the build pipeline registers them." },
    columns: [
      { key: "v", label: "Version", sort: (x) => x.date, cell: (x) => linkTo("v" + x.version, "#/dev/releases/" + encodeURIComponent(x.version)) },
      { key: "type", label: "Release type", sort: (x) => x.type, cell: (x) => h(x.type) },
      { key: "build", label: "Build / commit", cell: (x) => "<code>" + h(x.build) + "</code><div class=\"secondary\"><code>" + h(x.commit) + "</code></div>" },
      { key: "date", label: "Release date", sort: (x) => x.date, cell: (x) => formatDate(x.date) },
      { key: "notes", label: "Release notes", cell: (x) => '<span class="small">' + h(x.notes) + "</span>" },
      { key: "compat", label: "Compatibility", cell: (x) => "Schema " + h(x.schema) + '<div class="secondary">' + (rollbackFor(x) ? "Rollback-compatible with v" + h(rollbackFor(x).version) : "No compatible rollback") + "</div>" },
      { key: "ver", label: "Verification", sort: (x) => x.verification, cell: (x) => badge(x.verification) },
      { key: "ap", label: "Approval", sort: (x) => x.approval, cell: (x) => badge(x.approval === "Not requested" ? "Not requested" : x.approval, x.approval === "Approved" ? "done" : "soon") },
      { key: "use", label: "Clients using", sort: (x) => usingVersion(x.version).length, cell: (x) => h(usingVersion(x.version).length) },
      { key: "rb", label: "Rollback version", cell: (x) => (rollbackFor(x) ? "v" + h(rollbackFor(x).version) : '<span class="muted">None</span>') },
    ] });
}

export function renderDetail(version) {
  const d = getData();
  const r = d.releases.find((x) => x.version === version);
  if (!r) return notFound();
  const deps = usingVersion(r.version);
  const sbs = d.sandboxes.filter((s) => s.targetVersion === r.version);
  const validated = sbs.some((s) => sandboxStatus(s) === "Approved for release");
  const promos = d.requests.filter((x) => x.kind === "Release promotion" && x.detail?.to === r.version);
  const rb = rollbackFor(r);
  return pageHeader({ title: "v" + r.version, crumbs: [{ label: "Releases", href: "#/dev/releases" }, { label: "v" + r.version }], description: h(r.type) + " · " + badge(r.verification) + " " + badge(r.approval, r.approval === "Approved" ? "done" : "soon"),
    actions: (r.approval !== "Approved" ? button("Approve release", "rel-approve", { id: r.version, cls: "btn-primary" }) : "") + unavailable("Deploy to production", "Needs the trusted pipeline and GitHub production approval") }) +
    card({ title: "Workflow stage", body: '<div class="card-body">' + lifecycleTrack(RELEASE_STAGES, r.stage) + (r.approval !== "Approved" && !validated && r.verification !== "Verified" ? alertBox("warning", "Approval needs a sandbox review approved for this version, or a verified release.") : "") + "</div>" }) +
    card({ title: "Release details", body: '<div class="card-body">' + keyFacts([["Version", "v" + h(r.version)], ["Release type", h(r.type)], ["Build", "<code>" + h(r.build) + "</code>"], ["Commit", "<code>" + h(r.commit) + "</code>"], ["Release date", formatDate(r.date)], ["Schema", h(r.schema)], ["Release notes", h(r.notes)], ["Rollback version", rb ? "v" + h(rb.version) + " (same schema " + h(rb.schema) + ")" : "None compatible"]]) + "</div>" }) +
    card({ title: "Rollback", note: "Application rollback is allowed only to a version with a compatible schema. A Worker rollback doesn't revert data, queued effects or configuration.", body: '<div class="card-body">' + (rb ? alertBox("info", "Compatible rollback target: <strong>v" + h(rb.version) + "</strong>.") : alertBox("warning", "No compatible rollback target. Recovery would need the database restore runbook.")) + '<div class="inline-actions">' + unavailable("Roll back clients", "Controlled, audited rollback needs the backend runbook") + "</div></div>" }) +
    card({ title: "Clients using this version", body: deps.map((x) => row(linkTo(clientById(x.clientId).name, "#/dev/deployments/" + x.id), h(x.channel) + " · deployed " + formatDate(x.lastDeployed), badge(x.health))).join("") || emptyLine("No live clients", "Clients appear after a verified production deployment.") }) +
    card({ title: "Sandboxes validating this version", body: sbs.map((s) => row(linkTo(s.name, "#/dev/sandboxes/" + s.id), h(clientById(s.clientId)?.name || "") + " · " + h(s.reference), badge(sandboxStatus(s)))).join("") || emptyLine("No sandboxes", "Create a sandbox with this target version to validate it.") }) +
    card({ title: "Promotion requests", body: promos.map((p) => row(h(p.title), formatDateTime(p.at) + (p.decision ? " · " + h(p.decision.note || p.decision.reason) : ""), badge(p.status))).join("") || emptyLine("No promotion requests", "Requests from approved sandboxes appear here.") }) +
    card({ title: "Approval history", body: r.approvalHistory.map((a) => row(h(a.decision), formatDateTime(a.at) + " · " + h(a.by) + " · " + h(a.reason))).join("") || emptyLine("No decisions yet", "") });
}

export const actions = {
  "rel-approve": (el) => dialog({ title: "Approve release v" + el.dataset.id + "?", description: "Approval records your decision. It doesn't deploy the release to any client.", body: textarea("Reason", "ra-reason", "", { rows: 2 }) + formError(),
    footer: button("Cancel", "close") + button("Approve release", "rel-approve-save", { id: el.dataset.id, cls: "btn-primary", submit: true }) }),
  "rel-approve-save": (el) => {
    const res = approveRelease(el.dataset.id, readForm(document.querySelector("[data-form]"))["ra-reason"]);
    if (!res.ok) return showFormError(res.error);
    closeOverlay(true); rerender(); notify("Release approved. Nothing was deployed.");
  },
};
