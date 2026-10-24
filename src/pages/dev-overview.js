/** Developer Console › Overview. Every figure is derived from the preview records. */
import { getData, scopeClients, deploymentFor, sandboxStatus, clientById } from "../store.js";
import { developerSummary, distribution } from "../finance.js";
import { ACCOUNT_STATES } from "../seed.js";
import { h, pageHeader, figure, figureGrid, card, row, scrollList, badge, linkTo } from "../ui.js";
import { money, pct, formatDateTime, sum } from "../util.js";
import { periodFilter, clientFilter, selectFilter, getFilter, currentPeriod, periodCaption } from "./shared.js";

export const PENDING_PROVISIONING = ["Account created", "Awaiting provisioning", "Provisioning", "Provisioning failed"];

export function render() {
  const d = getData();
  const all = scopeClients("dev");
  const clientId = getFilter("ov-client");
  const status = getFilter("ov-status", "");
  const clients = all.filter((c) => (!clientId || c.id === clientId) && (!status || c.accountStatus === status));
  const ids = clients.map((c) => c.id);
  const p = currentPeriod();
  const deps = d.deployments.filter((x) => ids.includes(x.clientId));
  const liveDeps = deps.filter((x) => x.status === "Live");
  const sandboxes = d.sandboxes.filter((s) => ids.includes(s.clientId) && !["Retired", "Expired"].includes(sandboxStatus(s)));
  const warnings = deps.filter((x) => ["Warning", "Down"].includes(x.health) || x.status === "Failed");
  const latestStable = d.releases.find((r) => r.approval === "Approved" && r.verification === "Verified");
  const versions = {};
  liveDeps.forEach((x) => { versions[x.version] = (versions[x.version] || 0) + 1; });
  const behind = liveDeps.filter((x) => latestStable && x.version !== latestStable.version);
  const pendingReleases = d.requests.filter((r) => r.kind === "Release promotion" && r.status === "Pending" && (!clientId || r.clientId === clientId));
  const releasesAwaiting = d.releases.filter((r) => r.approval !== "Approved");
  const incidents = d.supportReports.filter((r) => !["Closed", "Deployed"].includes(r.state) && ids.includes(r.clientId));
  const fin = developerSummary(d, p.months, clientId || status ? ids : null);
  const dist = p.months.map((m) => distribution(d, m));
  const devShare = sum(dist, "developer");
  const infra = round(fin.direct + fin.shared + fin.unallocated);
  const filtered = !!(clientId || status);
  const pendingProv = clients.filter((c) => PENDING_PROVISIONING.includes(c.accountStatus));

  const filters = '<div class="filters" role="group" aria-label="Overview filters">' + periodFilter() + clientFilter("ov-client", all) + selectFilter("ov-status", "Account status", [{ value: "", label: "All statuses" }, ...ACCOUNT_STATES.map((s) => ({ value: s, label: s }))]) + "</div>";
  return pageHeader({ title: "Developer overview", description: "Clients, deployments, releases and actual platform finances. Figures come from the preview records below them; select a card to see its records." }) + filters +
    '<h2 class="section-title">Clients</h2>' +
    figureGrid([
      figure({ label: "Client organisations", value: clients.filter((c) => c.accountStatus !== "Archived").length, badge: "Excludes archived", tone: "draft", icon: "▤", href: "#/dev/organisations", testid: "kpi-clients" }),
      figure({ label: "Active clients", value: clients.filter((c) => ["Active", "Past due"].includes(c.subscription.status) && c.accountStatus !== "Archived").length, badge: "Paid plan", tone: "done", icon: "✓", href: "#/dev/organisations?sub=active-any", testid: "kpi-active" }),
      figure({ label: "Trial clients", value: clients.filter((c) => c.subscription.status === "Trial").length, icon: "○", href: "#/dev/organisations?sub=Trial", testid: "kpi-trial" }),
      figure({ label: "Pending client provisioning", value: pendingProv.length, badge: pendingProv.some((c) => c.accountStatus === "Provisioning failed") ? "Includes a failure" : null, tone: "overdue", icon: "◇", href: "#/dev/organisations?status=pending", testid: "kpi-pending" }),
    ], "Client figures") +
    '<h2 class="section-title">Deployments and releases</h2>' +
    figureGrid([
      figure({ label: "Active production deployments", value: liveDeps.length, badge: "Live", tone: "done", icon: "▣", href: "#/dev/deployments", testid: "kpi-live" }),
      figure({ label: "Active sandbox deployments", value: sandboxes.length, badge: "Simulation", tone: "draft", icon: "◇", href: "#/dev/deployments?tab=sandboxes", testid: "kpi-sandboxes" }),
      figure({ label: "Deployment warnings and failures", value: warnings.length, badge: warnings.length ? "Needs a look" : "None", tone: warnings.length ? "soon" : "done", icon: "!", href: "#/dev/deployments?health=attention", testid: "kpi-warnings" }),
      figure({ label: "Release requests awaiting approval", value: pendingReleases.length + releasesAwaiting.length, note: pendingReleases.length + " promotion request(s), " + releasesAwaiting.length + " release(s)", icon: "⇧", href: "#/dev/releases", testid: "kpi-release-approvals" }),
    ], "Deployment figures") +
    '<h2 class="section-title">Finance <span class="muted small">— ' + h(periodCaption()) + (filtered ? " · filtered clients (platform-level costs excluded)" : "") + "</span></h2>" +
    figureGrid([
      figure({ label: "Subscription revenue (recognised)", value: money(fin.subscription), note: "Enterprise " + money(fin.enterprise) + " · total " + money(fin.revenue), icon: "₱", href: "#/dev/finance?tab=revenue", testid: "kpi-sub-revenue" }),
      figure({ label: "Actual infrastructure expenses", value: money(infra), badge: fin.incomplete ? "Incomplete" : "Complete", tone: fin.incomplete ? "soon" : "done", note: "Direct " + money(fin.direct) + " · shared " + money(fin.shared) + (filtered ? "" : " · unallocated " + money(fin.unallocated)), icon: "▣", href: "#/dev/finance?tab=costs", testid: "kpi-infra" }),
      figure({ label: "Other operating expenses", value: filtered ? "No data" : money(fin.opex), note: filtered ? "Platform-level; not split by client" : "Accounting, workspace, licences", icon: "▤", href: "#/dev/finance?tab=costs", testid: "kpi-opex" }),
      figure({ label: "Actual operating profit", value: money(fin.profit), badge: "Margin " + pct(fin.margin), tone: fin.profit >= 0 ? "done" : "overdue", note: "Revenue − actual costs − operating expenses", icon: "✓", href: "#/dev/finance", testid: "kpi-profit" }),
    ], "Finance figures") +
    '<section class="split">' +
    card({ title: "Developer profit allocation", note: "30% of distributable profit (commercial basis), " + h(periodCaption()) + ". Not the same figure as actual operating profit.", action: linkTo("Distributions", "#/dev/finance?tab=distributions"), body:
      row("Distributable profit", "Recognised revenue − allocated service expenses − recognised shared business expenses ± adjustments", '<strong data-testid="ov-distributable">' + h(money(sum(dist, "distributable"))) + "</strong>") +
      row("Developer allocation · 30%", "Paid " + h(money(sum(dist, "paidDeveloper"))) + " · pending " + h(money(sum(dist, "pendingDeveloper"))), '<strong data-testid="ov-dev-share">' + h(money(devShare)) + "</strong>") +
      row("Business partners combined · 70%", "Individual partner shares are not defined yet", "<strong>" + h(money(sum(dist, "partners"))) + "</strong>") }) +
    card({ title: "Current application versions", note: "Live production deployments by version. Latest verified: " + h(latestStable?.version || "none"), action: linkTo("Releases", "#/dev/releases"), body:
      scrollList(Object.entries(versions).sort((a, b) => b[0].localeCompare(a[0], undefined, { numeric: true })).map(([v, n]) => row("v" + h(v), v === latestStable?.version ? "Latest verified release" : "Update available", badge(n + " client" + (n === 1 ? "" : "s"), v === latestStable?.version ? "done" : "soon"))),
        { title: "No live deployments", body: "Versions appear when clients go live." }, '<span>' + behind.length + " deployment(s) behind the latest verified release</span>") }) +
    "</section>" +
    '<section class="split">' +
    card({ title: "Needs attention", note: "Warnings, failures, pending provisioning and open support incidents.", body: scrollList([
      ...warnings.map((x) => row(linkTo(clientById(x.clientId)?.name || x.id, "#/dev/deployments/" + x.id), h(x.status === "Failed" ? "Provisioning failed at " + (x.failures[0]?.step || "unknown step") : (x.failures[0]?.message || x.health)), badge(x.status === "Failed" ? "Failed" : x.health))),
      ...incidents.map((r) => row(linkTo(r.id + " " + r.title, "#/dev/support-reports/" + r.id), h(clientById(r.clientId)?.name || "") + " · " + h(r.severity), badge(r.state))),
      ...pendingProv.filter((c) => c.accountStatus !== "Provisioning failed").map((c) => row(linkTo(c.name, "#/dev/organisations/" + c.id), "Account is not live yet", badge(c.accountStatus))),
    ], { title: "Nothing needs attention", body: "Warnings, failures and open incidents appear here." }, '<span data-testid="ov-incidents">' + incidents.length + " outstanding support incident(s)</span>") }) +
    card({ title: "Recent platform activity", note: "Latest privileged changes. Full record in Platform team › Change history.", action: linkTo("Change history", "#/dev/team?tab=history"), body: scrollList(d.audit.filter((a) => !clientId || a.clientId === clientId).slice(0, 12).map((a) => row(h(a.action), formatDateTime(a.at) + " · " + h(a.actor) + (a.clientId ? " · " + h(clientById(a.clientId)?.name || "") : ""), badge(a.outcome?.startsWith("Simulation") ? "Simulation" : "Recorded", a.outcome?.startsWith("Simulation") ? "draft" : "done"))), { title: "No activity", body: "Changes appear here as they're made." }) }) +
    "</section>";
}
const round = (n) => Math.round(n * 100) / 100;
