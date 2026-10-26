/**
 * ThryveMS console design preview: Developer and Business Partner workspaces.
 * Synthetic data only. No cloud, billing or QMS calls. The "Preview, view as" selector simulates roles;
 * production must enforce role, partner assignment and client isolation on the server.
 */
import * as D from "./data.js";
import * as F from "./finance.js";
import { icon, safe, date, money, pct, pill, tone, header, kpi, button, note, facts, tabs, card, dataTable, tableState, refreshTable, exportCsv } from "./ui.js";

const LEDGER = D.buildLedger();
const STORE_KEY = "thryvems.console.preview.v2";
const LATEST = D.RELEASES.find((r) => r.status === "Released").version;

/* ---------- Stored preview state (this browser only) ---------- */
function loadStore() {
  const blank = { sandboxes: D.START_SANDBOXES.map((s) => ({ ...s, fixes: [...s.fixes], tests: [...s.tests] })), orgs: [], changes: {}, subHistory: [], requests: [], decisions: {}, audit: [], grants: [], releases: {}, prices: {}, settings: {} };
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    if (s && Array.isArray(s.sandboxes) && s.sandboxes.every((x) => x && typeof x.id === "string" && typeof x.client === "string")) return { ...blank, ...s };
  } catch (_) { /* storage can be blocked or corrupt: start from the sample data */ }
  return blank;
}
const store = loadStore();
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (_) { toast("Couldn’t save in this browser. Changes last until you reload.", "warn"); }
}
function audit(what, area) {
  store.audit.unshift({ at: new Date().toISOString().slice(0, 16).replace("T", " "), who: state.role === "developer" ? "Danica Boton" : D.PARTNERS[state.partner]?.name || "Preview user", what, area });
}

let prefs = {};
try { prefs = JSON.parse(localStorage.getItem("thryvems.console.prefs") || "{}"); } catch (_) { prefs = {}; }
const state = { role: "developer", partner: "partner-a", period: "2026-10", pending: false, theme: prefs.theme === "dark" ? "dark" : "light", collapsed: !!prefs.collapsed, drawer: false, open: new Set(), tab: {}, ovClient: "", ovStatus: "", dirty: false };
function savePrefs() { try { localStorage.setItem("thryvems.console.prefs", JSON.stringify({ theme: state.theme, collapsed: state.collapsed })); } catch (_) { /* optional */ } }

/* ---------- Records as this role may see them ---------- */
const allClients = () => D.CLIENTS.concat(store.orgs).map((c) => ({ ...c, ...(store.changes[c.id] || {}) }));
const isDev = () => state.role === "developer";
const assigned = (c) => isDev() || c.partner === state.partner;
const clients = () => allClients().filter(assigned);
const clientById = (id) => allClients().find((c) => c.id === id);
const cname = (id) => clientById(id)?.name || "No data";
const deploymentOf = (id) => D.DEPLOYMENTS.find((d) => d.client === id);
const requests = () => D.START_REQUESTS.concat(store.requests).map((r) => ({ ...r, status: store.decisions[r.id] || r.status }));
const releaseOf = (v) => { const r = D.RELEASES.find((x) => x.version === v); return r && { ...r, ...(store.releases[v] || {}) }; };
const partnerLabel = (id) => (D.PARTNERS[id] ? D.PARTNERS[id].label + ", " + D.PARTNERS[id].name : "Not assigned");
const accountStatus = (c) => (c.trial && c.status === "Active" ? "Trial" : c.status);

/** A ledger row as this viewer may see it: other partners' client details are hidden, amounts are not. */
function viewRow(r) {
  if (isDev() || !r.client) return r;
  const c = clientById(r.client);
  if (c && assigned(c)) return r;
  return { ...r, hidden: true, source: "Details not shared", evidence: "Not shared" };
}
const clientCell = (r) => (r.hidden ? '<span class="muted with-icon">' + icon("lock", "sm") + "Another partner’s client</span>" : r.client ? safe(cname(r.client)) : '<span class="muted">' + safe(r.allocation || "Company-wide") + "</span>");

/* ---------- Navigation ---------- */
const DEV_NAV = [
  { id: "overview", label: "Overview", ic: "grid" },
  { id: "organisations", label: "Organisations", ic: "building" },
  { id: "deployments", label: "Deployments", ic: "server", children: [["production", "Production"], ["sandboxes", "Sandboxes"], ["monitoring", "Monitoring"]] },
  { id: "releases", label: "Releases", ic: "rocket", children: [["registry", "Release registry"], ["history", "Per-client history"]] },
  { id: "finance", label: "Finance", ic: "wallet", children: [["overview", "Overview"], ["revenue", "Revenue"], ["costs", "Costs"], ["profit", "Shared profit reporting"], ["allocations", "Allocations"], ["pricing", "Pricing"], ["subscriptions", "Subscriptions"], ["projects", "Enterprise projects"], ["distributions", "Distributions"]] },
  { id: "requests", label: "Requests", ic: "inbox" },
  { id: "logs", label: "Logs", ic: "file" },
  { id: "jobs", label: "Background jobs", ic: "timer" },
  { id: "support-reports", label: "Support reports", ic: "lifebuoy" },
  { id: "support-access", label: "Support access", ic: "lock" },
  { id: "team", label: "Platform team", ic: "users", children: [["members", "Team"], ["permissions", "Permissions"], ["history", "Change history"], ["settings", "Settings"]] },
];
const PARTNER_NAV = [
  { id: "overview", label: "Overview", ic: "grid" },
  { id: "clients", label: "Clients", ic: "building", children: [["list", "Clients"], ["subscriptions", "Subscriptions and seats"], ["projects", "Enterprise projects"]] },
  { id: "finance", label: "Finance", ic: "wallet", children: [["overview", "Overview"], ["revenue-expenses", "Revenue and expenses"], ["profit", "Shared profit reporting"], ["invoices", "Invoices"], ["distributions", "Distributions"], ["reports", "Reports"]] },
  { id: "requests", label: "Requests", ic: "inbox" },
  { id: "settings", label: "Business settings", ic: "sliders" },
];
const nav = () => (isDev() ? DEV_NAV : PARTNER_NAV);

function route() {
  const raw = (location.hash || "#/overview").slice(1);
  const [path, qs] = raw.split("?");
  const parts = path.split("/").filter(Boolean);
  const query = Object.fromEntries(new URLSearchParams(qs || ""));
  return { parts: parts.length ? parts : ["overview"], query };
}
const go = (h) => { location.hash = h; };

function sidebar() {
  const r = route();
  const items = nav().map((n) => {
    const active = r.parts[0] === n.id;
    if (!n.children) {
      return '<a class="ni' + (active ? " on" : "") + '" href="#/' + n.id + '"' + (active ? ' aria-current="page"' : "") + ' title="' + safe(n.label) + '">' + icon(n.ic) + '<span class="nl">' + safe(n.label) + "</span>" + (n.id === "requests" ? countBadge() : "") + "</a>";
    }
    const open = state.open.has(n.id) || active;
    const sub = n.children.map(([id, label]) => {
      const on = active && r.parts[1] === id;
      return '<a class="sub' + (on ? " on" : "") + '" href="#/' + n.id + "/" + id + '"' + (on ? ' aria-current="page"' : "") + ">" + safe(label) + "</a>";
    }).join("");
    return '<div class="group"><button type="button" class="ni' + (active ? " on" : "") + '" data-act="group" data-id="' + n.id + '" aria-expanded="' + open + '" title="' + safe(n.label) + '">' + icon(n.ic) + '<span class="nl">' + safe(n.label) + "</span>" + icon(open ? "chevronDown" : "chevronRight", "chev") + "</button>" + (open ? '<div class="subs">' + sub + "</div>" : "") + "</div>";
  }).join("");
  const who = isDev() ? ["DB", "Danica Boton", "Platform owner"] : [D.PARTNERS[state.partner].name.split(" ").map((x) => x[0]).join(""), D.PARTNERS[state.partner].name, "Business Partner"];
  return '<aside class="sidebar' + (state.drawer ? " open" : "") + '" aria-label="Console navigation">' +
    '<div class="brand"><button type="button" class="icon-btn" data-act="collapse" aria-label="' + (state.collapsed ? "Expand sidebar" : "Collapse sidebar") + '" aria-expanded="' + !state.collapsed + '">' + icon("panel") + "</button>" +
    '<a href="#/overview" class="logo" aria-label="ThryveMS overview"><img class="logo-full lt" src="./assets/thryvems-logo.png" alt="ThryveMS" /><img class="logo-full dk" src="./assets/thryvems-logo-dark.png" alt="ThryveMS" /><img class="logo-mark lt" src="./assets/thryvems-mark.png" alt="ThryveMS" /><img class="logo-mark dk" src="./assets/thryvems-mark-dark.png" alt="ThryveMS" /></a></div>' +
    '<div class="workspace-chip">' + pill(isDev() ? "Developer" : "Business Partner", isDev() ? "progress" : "done") + '<span class="nl muted tiny">' + (isDev() ? "Platform console" : "Partner console") + "</span></div>" +
    '<nav class="nav" aria-label="' + (isDev() ? "Developer console" : "Business Partner console") + '">' + items + "</nav>" +
    '<div class="who"><span class="avatar">' + safe(who[0]) + '</span><span class="nl"><strong>' + safe(who[1]) + '</strong><span class="muted tiny">' + safe(who[2]) + "</span></span></div></aside>";
}
function countBadge() {
  const n = requests().filter((x) => x.status === "Waiting" && (isDev() || x.from === state.partner)).length;
  return n ? '<span class="count">' + n + "</span>" : "";
}

function topbar() {
  const opt = (v, l, sel) => '<option value="' + v + '"' + (sel ? " selected" : "") + ">" + l + "</option>";
  return '<header class="topbar"><button type="button" class="icon-btn mobile-only" data-act="drawer" aria-label="Open menu" aria-expanded="' + state.drawer + '">' + icon("menu") + "</button>" +
    '<img class="mobile-only top-logo lt" src="./assets/thryvems-logo.png" alt="ThryveMS" /><img class="mobile-only top-logo dk" src="./assets/thryvems-logo-dark.png" alt="ThryveMS" />' +
    '<div class="topbar-right"><label class="viewas"><span class="tiny muted">Preview, view as</span><select id="preview-role" aria-label="Preview, view as">' +
    opt("developer", "Platform owner (Developer)", isDev()) + opt("partner-a", "Partner A, Lea Santos", state.role === "partner" && state.partner === "partner-a") + opt("partner-b", "Partner B, Marco Reyes", state.role === "partner" && state.partner === "partner-b") + opt("client", "Client user (no access)", state.role === "client") +
    "</select></label>" + '<button type="button" class="icon-btn" data-act="theme" aria-label="Toggle light and dark appearance">' + icon(state.theme === "dark" ? "sun" : "moon") + "</button>" + pill("Preview only", "draft") + "</div></header>";
}

/* ---------- Shared page pieces ---------- */
const periodSelect = (id = "period") => '<label class="tf"><span>Period</span><select data-global="' + id + '">' + D.PERIODS.map((p) => "<option value=\"" + p.id + "\"" + (state.period === p.id ? " selected" : "") + ">" + safe(p.label) + "</option>").join("") + "</select></label>";
const pendingSelect = () => '<label class="tf"><span>Status</span><select data-global="pending"><option value="">Reconciled records only</option><option value="1"' + (state.pending ? " selected" : "") + ">Include pending and estimates</option></select></label>";
const sample = () => pill("Sample data · preview", "draft");
const simulated = (what) => note("warn", "<strong>Simulated.</strong> " + what);
const tabOf = (key, first) => state.tab[key] || first;

function financeFilters() {
  return '<div class="filters">' + periodSelect() + pendingSelect() + '<span class="muted small">Basis: ' + F.POLICY.basis.toLowerCase() + " · " + F.POLICY.currency + " · policy " + F.POLICY.id + "</span>" + '<span class="push">' + sample() + "</span></div>";
}
function sameAsBanner(rep) {
  return note("ok", "<strong>Same as the " + (isDev() ? "Business Partner" : "Developer") + " Console.</strong> Net profit " + money(rep.net) + " for " + safe(F.periodOf(state.period).label) + ", " + (state.pending ? "including pending records" : "reconciled records") + ". Both consoles use one calculation and the same records.");
}
function profitBand(rep, link) {
  const d = F.distributionFor(LEDGER, state.period, state.pending);
  const cell = (l, v, s, cls) => '<div class="band-cell"><span class="muted small">' + safe(l) + '</span><span class="band-value' + (cls ? " " + cls : "") + '">' + safe(v) + "</span>" + (s ? '<span class="muted tiny">' + safe(s) + "</span>" : "") + "</div>";
  return '<section class="card" aria-labelledby="band-title"><div class="card-head"><div><h2 id="band-title">Shared business profit, ' + safe(F.periodOf(state.period).label) + '</h2><p>One calculation for both consoles, from the same records.</p></div><div class="row-gap">' + pill(state.pending ? "Includes pending" : "Reconciled", state.pending ? "soon" : "done") + '<a href="' + link + '" class="small strong">See how it’s worked out</a></div></div>' +
    '<div class="band">' + cell("Recognised revenue", money(rep.revenue), "Subscriptions " + money(rep.lines.subscription) + " · Enterprise " + money(rep.lines.enterprise)) +
    cell("Recognised expenses", money(-rep.expenses), "Infrastructure " + money(-rep.lines.infrastructure)) +
    cell("Net profit", money(rep.net), "After adjustments " + money(rep.lines.adjustments), rep.net >= 0 ? "pos" : "neg") +
    cell("Profit margin", pct(rep.margin), "Net profit ÷ revenue") +
    cell("Distribution", "30 / 70", "Developer " + money(d.developer) + " · Partners " + money(d.partners)) + "</div></section>";
}
function plTable(rep) {
  const L = rep.lines;
  const row = (label, recs, basis, amount, cls) => "<tr" + (cls ? ' class="' + cls + '"' : "") + "><td>" + label + "</td><td>" + (recs || "") + "</td><td>" + (basis ? pill(basis) : "") + '</td><td class="num">' + money(amount) + "</td></tr>";
  const n = (cat, word) => { const c = rep.counts[cat] || 0; return c ? '<a href="#/' + (isDev() ? "finance/" + (cat === "Infrastructure" || cat === "Operating" || cat === "Shared business" || cat === "Unallocated" ? "costs" : "revenue") : "finance/revenue-expenses") + '?category=' + encodeURIComponent(cat) + '">' + c + " " + word + (c === 1 ? "" : "s") + "</a>" : '<span class="muted">None</span>'; };
  return '<div class="tbl-scroll plain"><table class="data-table pl"><thead><tr><th scope="col">Line</th><th scope="col">Records</th><th scope="col">Basis</th><th scope="col" class="num">Amount</th></tr></thead><tbody>' +
    row("Subscription revenue", n("Subscription", "invoice"), "Actual", L.subscription) +
    row("Enterprise project revenue", n("Enterprise", "milestone"), "Actual", L.enterprise) +
    row("Revenue adjustments (credits and refunds)", n("Revenue adjustment", "credit note"), "Actual", L.revenueAdjustments) +
    row("Recognised revenue", "", "", rep.revenue, "tot") +
    row("Direct infrastructure (Cloudflare, Neon, email, storage)", n("Infrastructure", "provider invoice"), "Actual", L.infrastructure) +
    row("Operating expenses", n("Operating", "record"), "Actual", L.operating) +
    row("Shared business expenses", n("Shared business", "record"), "Actual", L.shared) +
    row("Unallocated expenses", n("Unallocated", "record"), L.unallocated ? "Actual" : "", L.unallocated) +
    row("Recognised expenses", "", "", rep.expenses, "tot") +
    row("Approved adjustments", n("Approved adjustment", "adjustment"), L.adjustments ? "Approved" : "", L.adjustments) +
    row("Net profit · margin " + pct(rep.margin), "", "", rep.net, "tot net") +
    (rep.pending.length && !state.pending ? row('<span class="muted">Not counted: pending and estimated records</span>', rep.pending.length + " record" + (rep.pending.length === 1 ? "" : "s"), "Pending", rep.pending.reduce((a, r) => a + r.amount, 0), "muted-row") : "") +
    "</tbody></table></div>";
}
function breakdown(rep) {
  const list = F.expenseBreakdown(rep);
  return '<div class="bars">' + (list.length ? list.map((x) => '<div class="bar-row"><span class="bar-label"><span>' + safe(x.name) + '</span><span class="num">' + money(x.amount) + " · " + Math.round(x.share * 100) + '%</span></span><span class="bar" aria-hidden="true"><span style="width:' + Math.max(1, x.share * 100).toFixed(1) + '%"></span></span></div>').join("") : '<p class="muted">No data</p>') + "</div>";
}
function distributionCard() {
  const d = F.distributionFor(LEDGER, state.period, state.pending);
  const rows = isDev()
    ? [["Shared net profit", money(d.net)], ["Adjustments before distribution", money(0) + ' <span class="muted">· none approved</span>'], ["Developer, 30%", money(d.developer) + " " + (d.pendingDev ? pill(money(d.pendingDev) + " pending", "soon") : pill("Paid"))], ["Business Partners together, 70%", money(d.partners) + " " + (d.pendingPartners ? pill(money(d.pendingPartners) + " pending", "soon") : pill("Paid"))]]
    : [["Shared net profit", money(d.net)], ["Adjustments before distribution", money(0) + ' <span class="muted">· none approved</span>'], ["Business Partners together, 70%", money(d.partners)], ["Paid · pending", money(d.paidPartners) + " " + (d.pendingPartners ? pill(money(d.pendingPartners) + " pending", "soon") : pill("Paid"))]];
  return card(isDev() ? "Distribution" : "Your distribution", facts(rows) + '<p class="card-note muted small">Distribution is separate from profit. The split between individual Business Partners is not agreed yet, so no individual share is shown. Months with a loss are not distributed.</p>', '<span class="muted small">30% / 70% of net profit</span>');
}
function ledgerTable(key, rows, title) {
  const cols = [
    { label: "Date", value: (r) => r.date, html: (r) => safe(date(r.date)) },
    { label: "Reference", value: (r) => r.ref },
    { label: "Category", value: (r) => r.category },
    { label: "Source or vendor", value: (r) => r.source, html: (r) => (r.hidden ? '<span class="muted">' + safe(r.source) + "</span>" : safe(r.source) + (r.currency === "USD" && r.usd ? '<span class="muted tiny block">USD ' + r.usd.toFixed(2) + " @ " + r.rate + "</span>" : "")) },
    { label: "Client", value: (r) => (r.hidden ? "Another partner’s client" : r.client ? cname(r.client) : r.allocation || "Company-wide"), html: clientCell },
    { label: "Basis", value: (r) => r.basis, html: (r) => pill(r.basis) },
    { label: "Status", value: (r) => r.status, html: (r) => pill(r.status) },
    { label: "Amount", num: true, value: (r) => r.amount, html: (r) => money(r.amount) },
    { label: "Evidence", value: (r) => r.evidence, html: (r) => (r.hidden ? '<span class="muted">Not shared</span>' : '<button type="button" class="link" data-act="record" data-id="' + safe(r.ref) + '">' + safe(r.evidence) + "</button>") },
  ];
  const cats = [...new Set(rows.map((r) => r.category))];
  return dataTable(key, cols, rows.map(viewRow), { title, search: "Search vendor, client or reference", filters: [{ id: "category", label: "Category", options: cats, value: (r) => r.category }, { id: "status", label: "Status", options: [...new Set(rows.map((r) => r.status))], value: (r) => r.status }], initial: route().query.category ? { category: route().query.category } : null, footNote: "rows add up to the totals" });
}
const periodLedger = (filter) => LEDGER.filter((r) => F.periodOf(state.period).months.includes(r.period)).filter(filter || (() => true)).sort((a, b) => (a.date < b.date ? 1 : -1));

/* ---------- Developer pages ---------- */
function devOverview() {
  let list = allClients();
  if (state.ovClient) list = list.filter((c) => c.id === state.ovClient);
  if (state.ovStatus) list = list.filter((c) => accountStatus(c) === state.ovStatus);
  const ids = list.map((c) => c.id);
  const deps = D.DEPLOYMENTS.filter((d) => ids.includes(d.client));
  const rep = F.report(LEDGER, state.period, state.pending);
  const subs = list.filter((c) => c.status === "Active" && !c.trial);
  const seats = list.reduce((a, c) => a + c.seats, 0), used = list.reduce((a, c) => a + c.used, 0);
  const warn = deps.filter((d) => d.status === "Deploy failed" || !["Healthy", "No data"].includes(d.health));
  const behind = deps.filter((d) => d.status !== "Suspended" && d.version !== LATEST);
  const waitingRel = D.RELEASES.filter((r) => (store.releases[r.version]?.status || r.status) === "In review");
  const sbs = store.sandboxes.filter((s) => s.status !== "Retired" && ids.includes(s.client));
  const attention = [
    ...D.DEPLOYMENTS.filter((d) => ids.includes(d.client) && d.status === "Deploy failed").map((d) => ["Deployment failed: " + cname(d.client), "Production stayed on " + d.version + ". See the logs.", "#/deployments/production/" + d.id, "Failed"]),
    ...waitingRel.map((r) => ["Release " + r.version + " waiting for your approval", r.verification, "#/releases/registry/" + r.version, "Approve"]),
    ...D.DEPLOYMENTS.filter((d) => ids.includes(d.client) && d.health === "Backup late").map((d) => ["Backup late: " + cname(d.client), "The nightly backup did not report.", "#/deployments/production/" + d.id, "Check"]),
    ...list.filter((c) => c.status === "Awaiting provisioning").map((c) => [cname(c.id) + " awaiting provisioning", "Account created. No deployment yet.", "#/organisations/" + c.id, "Waiting"]),
    ...LEDGER.filter((r) => r.status === "Outstanding" && ids.includes(r.client)).map((r) => ["Invoice outstanding: " + cname(r.client), r.ref + " · " + money(r.amount), "#/finance/subscriptions", "Outstanding"]),
  ];
  const reqs = requests().filter((r) => r.status === "Waiting");
  const statuses = ["Active", "Trial", "Awaiting provisioning", "Created", "Suspended", "Archived"];
  return header({ title: "Overview", desc: "Every client, deployment and peso across the platform. Each figure is worked out from its records; select one to see them.", actions: button("Create organisation", "new-org", { cls: "btn-primary", ic: "plus" }) }) +
    '<div class="filters">' + periodSelect() + '<label class="tf"><span>Client</span><select data-global="ovClient"><option value="">All clients</option>' + allClients().map((c) => '<option value="' + c.id + '"' + (state.ovClient === c.id ? " selected" : "") + ">" + safe(c.name) + "</option>").join("") + '</select></label><label class="tf"><span>Status</span><select data-global="ovStatus"><option value="">All statuses</option>' + statuses.map((s) => "<option" + (state.ovStatus === s ? " selected" : "") + ">" + s + "</option>").join("") + '</select></label><span class="push">' + sample() + "</span></div>" +
    '<section aria-labelledby="k1" class="stack"><h2 id="k1">Clients and subscriptions</h2><div class="kpis">' +
    kpi({ ic: "building", badge: "All", value: list.length, label: "Organisations", href: "#/organisations" }) +
    kpi({ ic: "check", badge: "Live", value: list.filter((c) => accountStatus(c) === "Active").length, label: "Active clients", href: "#/organisations?status=Active" }) +
    kpi({ ic: "clock", badge: "Trial", badgeTone: "progress", value: list.filter((c) => accountStatus(c) === "Trial").length, label: "Trial clients", href: "#/organisations?status=Trial" }) +
    kpi({ ic: "refresh", badge: "Waiting", value: list.filter((c) => ["Awaiting provisioning", "Provisioning", "Created"].includes(c.status)).length, label: "Pending provisioning", href: "#/organisations?status=Awaiting%20provisioning" }) +
    kpi({ ic: "archive", badge: "Inactive", value: list.filter((c) => ["Suspended", "Archived"].includes(c.status)).length, label: "Suspended or archived", href: "#/organisations?status=Suspended" }) +
    kpi({ ic: "receipt", badge: "Paying", value: subs.length, label: "Active subscriptions", href: "#/finance/subscriptions" }) +
    kpi({ ic: "users", badge: seats ? Math.round((used / seats) * 100) + "%" : "No data", badgeTone: "done", value: used + " / " + seats, label: "Seats in use", href: "#/finance/subscriptions" }) +
    "</div></section>" +
    '<section aria-labelledby="k2" class="stack"><h2 id="k2">Infrastructure</h2><div class="kpis">' +
    kpi({ ic: "server", badge: "Live", value: deps.filter((d) => d.status === "Live").length, label: "Live production deployments", href: "#/deployments/production" }) +
    kpi({ ic: "flask", badge: "Testing", badgeTone: "progress", value: sbs.length, label: "Active sandboxes", href: "#/deployments/sandboxes" }) +
    kpi({ ic: "alert", badge: warn.some((d) => d.status === "Deploy failed") ? "Failed" : warn.length ? "Warning" : "Clear", badgeTone: warn.some((d) => d.status === "Deploy failed") ? "overdue" : warn.length ? "soon" : "done", value: warn.length, label: "Deployment warnings and failures", href: "#/deployments/production" }) +
    kpi({ ic: "activity", badge: "Sample", badgeTone: "draft", value: "99.96%", label: "Availability, last 30 days", href: "#/deployments/monitoring" }) +
    kpi({ ic: "history", badge: behind.length ? "Behind" : "Current", value: behind.length, label: "Clients on an older version", href: "#/releases/history" }) +
    kpi({ ic: "rocket", badge: waitingRel.length ? "You" : "None", badgeTone: waitingRel.length ? "soon" : "done", value: waitingRel.length, label: "Releases waiting for approval", href: "#/releases/registry" }) +
    "</div></section>" + profitBand(rep, "#/finance/profit") +
    '<div class="grid-2">' + listCard("Needs attention", attention.slice(0, 6), attention.length) + listCard("Pending requests", reqs.slice(0, 5).map((r) => [r.type + (r.client ? ": " + cname(r.client) : ""), r.detail + " · " + date(r.created), "#/requests", r.status]), reqs.length, "#/requests") + "</div>" +
    '<div class="grid-3">' +
    listCard("Release status", D.RELEASES.slice(0, 3).map((r) => { const rr = releaseOf(r.version); return [rr.version + " · " + D.DEPLOYMENTS.filter((d) => d.version === rr.version).length + " deployments", rr.approval, "#/releases/registry/" + rr.version, rr.status]; })) +
    listCard("Deployment incidents", D.DEPLOY_HISTORY.filter((h) => h.result !== "Succeeded").map((h) => [cname(h.client) + ": " + h.from + " → " + h.to, h.note, "#/releases/history", h.result])) +
    listCard("Support reports", D.SUPPORT_REPORTS.map((s) => [s.title, cname(s.client) + " · " + date(s.opened), "#/support-reports", s.priority])) +
    "</div>" + '<div class="grid-2">' +
    listCard("Recent platform activity", store.audit.concat(D.START_AUDIT).slice(0, 5).map((a) => [a.what, a.who + " · " + a.at, "#/team/history", a.area])) +
    listCard("Recent transactions and financial changes", LEDGER.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5).map((r) => [r.ref + " · " + r.source, date(r.date) + " · " + money(r.amount), "#/finance/profit", r.status])) + "</div>";
}
function listCard(title, rows, count, more) {
  return '<section class="card"><div class="card-head"><h2>' + safe(title) + "</h2>" + (more ? '<a class="small strong" href="' + more + '">See all</a>' : count != null ? pill(String(count), count ? "soon" : "done") : "") + "</div>" +
    (rows.length ? rows.map(([t, s, h, st]) => '<div class="rule-row"><span class="rr-main"><a href="' + h + '" class="strong">' + safe(t) + '</a><span class="muted small">' + safe(s) + "</span></span>" + (st ? pill(st) : "") + "</div>").join("") : '<div class="empty small"><strong>Nothing needs attention</strong>All clear for now.</div>') + "</section>";
}

function organisations(r) {
  if (r.parts[1]) return organisationDetail(r.parts[1]);
  const cols = [
    { label: "Organisation", value: (c) => c.name, html: (c) => '<a class="strong" href="#/organisations/' + c.id + '">' + safe(c.name) + '</a><span class="muted tiny block">' + safe(c.id) + "</span>" },
    { label: "Business Partner", value: (c) => partnerLabel(c.partner) },
    { label: "Plan", value: (c) => c.plan + ", " + c.cycle.toLowerCase() },
    { label: "Seats used", num: true, value: (c) => c.used, html: (c) => c.used + " / " + c.seats },
    { label: "Account", value: accountStatus, html: (c) => pill(accountStatus(c)) },
    { label: "Deployment", value: (c) => deploymentOf(c.id)?.status || "None", html: (c) => (deploymentOf(c.id) ? pill(deploymentOf(c.id).status) : '<span class="muted">None</span>') },
    { label: "Version", value: (c) => deploymentOf(c.id)?.version || "No data" },
    { label: "Renewal", value: (c) => c.renewal || "", html: (c) => safe(date(c.renewal)) },
  ];
  return header({ title: "Organisations", desc: "Client accounts. Account status is separate from deployment status, and creating an account never creates a deployment.", actions: button("Create organisation", "new-org", { cls: "btn-primary", ic: "plus" }) }) +
    dataTable("orgs", cols, allClients(), { search: "Search organisations", filters: [{ id: "status", label: "Account", options: ["Active", "Trial", "Created", "Awaiting provisioning", "Provisioning", "Suspended", "Archived", "Failed"], value: accountStatus }, { id: "partner", label: "Partner", options: Object.values(D.PARTNERS).map((p) => p.label + ", " + p.name), value: (c) => partnerLabel(c.partner) }, { id: "plan", label: "Plan", options: ["Team", "Business"], value: (c) => c.plan }], initial: r.query.status ? { status: r.query.status } : null });
}
function organisationDetail(id) {
  const c = clientById(id);
  if (!c || !assigned(c)) return notFound();
  const dep = deploymentOf(id);
  const t = tabOf("org-" + id, "overview");
  const hist = D.SUB_HISTORY.concat(store.subHistory).filter((h) => h.client === id);
  const eligible = ["Suspended", "Created", "Awaiting provisioning", "Failed"].includes(c.status) && (!dep || dep.status === "Suspended");
  let body = "";
  if (t === "overview") body = card("Account", facts([["Name", safe(c.name)], ["Business Partner", safe(partnerLabel(c.partner))], ["Account status", pill(accountStatus(c))], ["Client since", safe(date(c.start))], ["Plan", safe(c.plan + ", " + c.cycle.toLowerCase())], ["Seats", c.used + " active of " + c.seats + " purchased"], ["Renewal", safe(date(c.renewal))]]));
  if (t === "subscription") body = card("Subscription and seats", facts([["Plan", safe(c.plan)], ["Billing cycle", safe(c.cycle)], ["Purchased seats", String(c.seats)], ["Active seats", String(c.used)], ["Base allowance", "10 users, adjustable down to 1"], ["Start", safe(date(c.start))], ["Renewal", safe(date(c.renewal))]]), button("Change subscription", "change-sub", { cls: "btn-small", id }));
  if (t === "modules") body = card("Enabled modules", '<div class="card-body chips">' + c.modules.map((m) => pill(m, "progress")).join(" ") + "</div>", button("Configure modules", "modules", { cls: "btn-small", id }));
  if (t === "billing") body = ledgerTable("org-bill-" + id, LEDGER.filter((r) => r.client === id), "Billing and subscription history");
  if (t === "deployment") body = dep ? card("Assigned deployment", facts([["Deployment", '<a href="#/deployments/production/' + dep.id + '">' + safe(dep.id) + "</a>"], ["Hostname", safe(dep.host)], ["Application version", safe(dep.version + " · " + dep.build)], ["Status", pill(dep.status)], ["Health", pill(dep.health)]])) : card("Assigned deployment", '<div class="empty"><strong>No deployment</strong>An account never creates one automatically. Request provisioning when the client is ready.</div>', button("Request provisioning", "provision", { cls: "btn-small", id }));
  if (t === "lifecycle") body = card("Lifecycle and commercial history", hist.length ? hist.map((h) => '<div class="rule-row"><span class="rr-main"><span class="strong">' + safe(h.change) + '</span><span class="muted small">Effective ' + safe(date(h.effective)) + " · " + safe(h.reason) + " · " + safe(h.by) + "</span></span></div>").join("") : '<div class="empty"><strong>No changes yet</strong>Plan, seat and status changes are recorded here with their date and reason.</div>');
  return header({ crumbs: [["Organisations", "#/organisations"], [c.name]], title: c.name, badge: pill(accountStatus(c)), desc: partnerLabel(c.partner) + " · " + c.plan + " · " + c.used + " of " + c.seats + " seats", actions: button("Edit details", "edit-org", { id }) + button("Assign partner", "assign", { id }) + button("Archive", "archive", { id, cls: "btn-danger", disabled: !eligible || c.status === "Archived", why: "Only suspended accounts, or accounts without a live deployment, can be archived" }) + button("Change subscription", "change-sub", { cls: "btn-primary", id }) }) +
    tabs("org-" + id, [["overview", "Overview"], ["subscription", "Subscription and seats"], ["modules", "Modules"], ["billing", "Billing history"], ["deployment", "Deployment"], ["lifecycle", "Lifecycle history"]], t) + body;
}

function deployments(r) {
  const sub = r.parts[1] || "production";
  if (sub === "production") return r.parts[2] ? deploymentDetail(r.parts[2]) : production();
  if (sub === "sandboxes") return r.parts[2] ? sandboxDetail(r.parts[2]) : sandboxes();
  if (sub === "monitoring") return monitoring();
  return notFound();
}
function infraCost(clientId) {
  return F.allocationTable(LEDGER, state.period, state.pending).filter((a) => a.client === clientId && a.category === "Infrastructure").reduce((s, a) => s + a.amount, 0);
}
function production() {
  const cols = [
    { label: "Client", value: (d) => cname(d.client), html: (d) => '<a class="strong" href="#/deployments/production/' + d.id + '">' + safe(cname(d.client)) + '</a><code class="block">' + safe(d.id) + "</code>" },
    { label: "Hostname", value: (d) => d.host },
    { label: "Version · build", value: (d) => d.version, html: (d) => safe(d.version) + ' · <code>' + safe(d.build) + "</code>" },
    { label: "Channel", value: (d) => d.channel },
    { label: "Deployment", value: (d) => d.status, html: (d) => pill(d.status) },
    { label: "Health", value: (d) => d.health, html: (d) => pill(d.health) },
    { label: "Last deploy", value: (d) => d.lastDeploy, html: (d) => safe(date(d.lastDeploy)) },
    { label: "Last verified", value: (d) => d.verified || "", html: (d) => safe(date(d.verified)) },
    { label: "Sandboxes", num: true, value: (d) => store.sandboxes.filter((s) => s.client === d.client && s.status !== "Retired").length },
    { label: "Infrastructure cost", num: true, value: (d) => infraCost(d.client), html: (d) => money(infraCost(d.client)) },
  ];
  return header({ crumbs: [["Deployments", "#/deployments/production"], ["Production"]], title: "Production", desc: "One isolated Cloudflare deployment and Neon database per client, all on the shared ThryveMS codebase.", actions: button("Request provisioning", "provision", { cls: "btn-primary", ic: "plus" }) }) +
    simulated("Provisioning, deployments and health checks here are a preview. Nothing reaches Cloudflare or Neon until the backend is built and approved.") +
    dataTable("deps", cols, D.DEPLOYMENTS, { search: "Search client or hostname", filters: [{ id: "status", label: "Deployment", options: [...new Set(D.DEPLOYMENTS.map((d) => d.status))], value: (d) => d.status }, { id: "version", label: "Version", options: [...new Set(D.DEPLOYMENTS.map((d) => d.version))], value: (d) => d.version }, { id: "channel", label: "Channel", options: ["Stable", "Early access"], value: (d) => d.channel }], footNote: "costs are allocated by seats for " + F.periodOf(state.period).label });
}
function deploymentDetail(id) {
  const d = D.DEPLOYMENTS.find((x) => x.id === id);
  if (!d) return notFound();
  const t = tabOf("dep-" + id, "overview");
  const c = clientById(d.client);
  const logs = D.LOGS.filter((l) => l.source.includes(id));
  let body = "";
  if (t === "overview") body = '<div class="grid-2">' + card("Deployment", facts([["Client", '<a href="#/organisations/' + d.client + '">' + safe(c.name) + "</a>"], ["Hostname", safe(d.host)], ["Status", pill(d.status)], ["Health", pill(d.health)], ["Last deployment", safe(date(d.lastDeploy))], ["Last verified", safe(date(d.verified))]])) + card("Installed application", facts([["Version", safe(d.version)], ["Build", "<code>" + safe(d.build) + "</code>"], ["Channel", safe(d.channel)], ["Latest released", safe(LATEST)]])) + "</div>";
  if (t === "config") body = card("Environment configuration", facts([["Region", safe(d.region)], ["Database", "Separate Neon project <code>" + safe(d.db) + "</code>"], ["Infrastructure tier", safe(d.tier)], ["Secrets", '<span class="muted">Held by the platform. Never shown here.</span>']]));
  if (t === "releases") body = card("Release history", D.DEPLOY_HISTORY.filter((h) => h.client === d.client).map((h) => '<div class="rule-row"><span class="rr-main"><span class="strong">' + safe(h.from + " → " + h.to) + '</span><span class="muted small">' + safe(date(h.date) + " · " + h.note + " · " + h.by) + "</span></span>" + pill(h.result) + "</div>").join("") || '<div class="empty"><strong>No deployments yet</strong></div>');
  if (t === "modules") body = card("Enabled modules", '<div class="card-body chips">' + c.modules.map((m) => pill(m, "progress")).join(" ") + "</div>");
  if (t === "health") body = card("Health monitoring", facts([["Health", pill(d.health)], ["Availability, 30 days", "99.96% " + pill("Sample", "draft")], ["Last check", safe(date(d.verified))]]));
  if (t === "logs") body = card("Errors and logs", logs.length ? logs.map((l) => '<div class="rule-row"><span class="rr-main"><span>' + safe(l.message) + '</span><span class="muted small">' + safe(l.time) + "</span></span>" + pill(l.level) + "</div>").join("") : '<div class="empty"><strong>No log entries</strong>Nothing logged for this deployment.</div>');
  if (t === "jobs") { const j = D.JOBS.filter((x) => x.target === id); body = card("Background tasks", j.length ? j.map((x) => '<div class="rule-row"><span class="rr-main"><span class="strong">' + safe(x.name) + '</span><span class="muted small">Last ' + safe(x.last) + "</span></span>" + pill(x.status) + "</div>").join("") : '<div class="empty"><strong>No tasks for this deployment</strong></div>'); }
  if (t === "cost") body = card("Infrastructure consumption and cost, " + F.periodOf(state.period).label, facts([["Allocated infrastructure cost", money(infraCost(d.client))], ["Basis", "Provider invoices allocated by purchased seats"], ["Usage figures", '<span class="muted">Not connected. Provider usage appears once metering is integrated.</span>']]));
  if (t === "sandboxes") { const s = store.sandboxes.filter((x) => x.client === d.client); body = card("Related sandboxes", s.length ? s.map((x) => '<div class="rule-row"><span class="rr-main"><a class="strong" href="#/deployments/sandboxes/' + x.id + '">' + safe(x.id + " · " + x.name) + '</a><span class="muted small">' + safe(x.purpose + " · " + x.sourceVersion + " → " + x.target) + "</span></span>" + pill(x.status) + "</div>").join("") : '<div class="empty"><strong>No sandboxes</strong></div>', button("Create sandbox", "new-sandbox", { cls: "btn-small", id: d.client })); }
  return header({ crumbs: [["Deployments", "#/deployments/production"], ["Production", "#/deployments/production"], [d.id]], title: c.name + " production", badge: pill(d.status), desc: d.host + " · " + d.version, actions: button("Roll back", "noop", { disabled: true, why: "Rollback needs Developer approval in the backend release workflow" }) + button("Create sandbox", "new-sandbox", { cls: "btn-primary", id: d.client }) }) +
    simulated("This is a preview of the deployment record. No action here reaches Cloudflare or Neon.") +
    tabs("dep-" + id, [["overview", "Overview"], ["config", "Configuration"], ["releases", "Release history"], ["modules", "Modules"], ["health", "Health"], ["logs", "Errors and logs"], ["jobs", "Background tasks"], ["cost", "Cost"], ["sandboxes", "Sandboxes"]], t) + body;
}
function sandboxes() {
  const cols = [
    { label: "Sandbox", value: (s) => s.id + " " + s.name, html: (s) => '<a class="strong" href="#/deployments/sandboxes/' + s.id + '">' + safe(s.id) + '</a><span class="muted tiny block">' + safe(s.name) + "</span>" },
    { label: "Client", value: (s) => cname(s.client) },
    { label: "Purpose", value: (s) => s.purpose },
    { label: "Versions", value: (s) => s.sourceVersion + " → " + s.target },
    { label: "Linked issue", value: (s) => s.reference || "" },
    { label: "Status", value: (s) => s.status, html: (s) => pill(s.status) },
    { label: "Expires", value: (s) => s.expires, html: (s) => safe(date(s.expires)) },
  ];
  return header({ crumbs: [["Deployments", "#/deployments/production"], ["Sandboxes"]], title: "Sandboxes", desc: "Isolated test environments for one client. Synthetic data only; they never touch a live environment.", actions: button("Create sandbox", "new-sandbox", { cls: "btn-primary", ic: "plus" }) }) +
    simulated("Sandboxes are stored in this browser only. No Cloudflare Worker, Neon branch or hosted URL is created.") +
    dataTable("sandboxes", cols, store.sandboxes, { search: "Search sandboxes", filters: [{ id: "status", label: "Status", options: ["Testing", "Ready for review", "Waiting for approval", "Draft", "Retired"], value: (s) => s.status }, { id: "purpose", label: "Purpose", options: ["Bug fix", "Feature update", "Version testing", "Configuration testing"], value: (s) => s.purpose }], empty: ["No sandboxes", "Create one to test a fix or a version for a client."] });
}
function sandboxDetail(id) {
  const s = store.sandboxes.find((x) => x.id === id);
  if (!s) return notFound();
  const t = tabOf("sb-" + id, "overview");
  const retired = s.status === "Retired";
  const steps = ["Development", "Sandbox testing", "Verification", "Review", "Approval", "Deployment", "Post-deployment check"];
  const at = s.status === "Waiting for approval" ? 4 : s.status === "Ready for review" ? 3 : 1;
  const track = '<section class="card track" aria-label="Release path">' + steps.map((x, i) => '<div class="step' + (i < at ? " done" : i === at ? " now" : "") + '"><span></span>' + safe(x) + "</div>").join("") + "</section>";
  const ready = [["Fix recorded and linked to an issue", s.fixes.length > 0 && !!s.reference], ["Tests recorded", s.tests.length > 0 && s.tests.every((x) => x.result === "Passed")], ["End-to-end tests (runs once the test runner is connected)", false], ["Developer approval", s.status === "Approved"]];
  let body = "";
  if (t === "overview") body = '<div class="grid-2">' + card("Details", facts([["Purpose", safe(s.purpose)], ["Linked issue", safe(s.reference || "Not entered")], ["Description", safe(s.description || "Not entered")], ["Source deployment", "<code>" + safe(s.source) + "</code> on " + safe(s.sourceVersion)], ["Target version", safe(s.target)], ["Test data", safe(s.data)], ["Configuration", safe(s.config)], ["Retention", safe(s.retention + ", expires " + date(s.expires))]])) +
    card("Data safety", '<ul class="checks"><li class="ok">' + icon("check") + "No production data copied</li><li class=\"ok\">" + icon("check") + "No credentials or secrets copied</li><li class=\"ok\">" + icon("check") + "Separate database branch with no link to production</li></ul>" + '<p class="card-note muted small">Promotion to production needs approval and its own verified deployment.</p>') + "</div>";
  if (t === "versions") body = card("Source and target", '<div class="tbl-scroll plain"><table class="data-table"><thead><tr><th scope="col"></th><th scope="col">Production</th><th scope="col">Sandbox</th></tr></thead><tbody><tr><td class="muted">Version</td><td>' + safe(s.sourceVersion) + "</td><td><strong>" + safe(s.target) + '</strong></td></tr><tr><td class="muted">Release notes</td><td>' + safe(releaseOf(s.sourceVersion)?.notes || "No data") + "</td><td>" + safe(releaseOf(s.target)?.notes || "No data") + '</td></tr><tr><td class="muted">Compatibility</td><td>' + safe(releaseOf(s.sourceVersion)?.compat || "No data") + "</td><td>" + safe(releaseOf(s.target)?.compat || "No data") + "</td></tr></tbody></table></div>");
  if (t === "config") body = card("Configuration", facts([["Allowed configuration", safe(s.config)], ["Modules", safe(clientById(s.client).modules.join(", "))], ["Secrets", '<span class="muted">None copied. The sandbox gets its own test credentials.</span>']]));
  if (t === "changes") body = card("Changes made", s.fixes.length ? s.fixes.map((f) => '<div class="rule-row"><span>' + safe(f) + "</span></div>").join("") : '<div class="empty"><strong>No fixes recorded</strong>Record what you changed so reviewers can follow it.</div>', retired ? "" : button("Record a fix", "fix", { cls: "btn-small", id }));
  if (t === "tests") body = card("Test history", s.tests.length ? s.tests.map((x) => '<div class="rule-row"><span>' + safe(x.name) + "</span>" + pill(x.result) + "</div>").join("") : '<div class="empty"><strong>No tests yet</strong>Automatic test runs appear once the runner is connected.</div>', button("Run tests", "noop", { cls: "btn-small", disabled: true, why: "Runs once the test runner is connected" }));
  if (t === "readiness") body = card("Release readiness", '<ul class="checks">' + ready.map(([l, ok]) => '<li class="' + (ok ? "ok" : "no") + '">' + icon(ok ? "check" : "x") + safe(l) + "</li>").join("") + "</ul>", pill(ready.filter((x) => x[1]).length + " of " + ready.length, "soon"));
  if (t === "logs") body = card("Deployment logs and health", '<div class="empty"><strong>Simulated sandbox</strong>Logs and health appear once sandboxes run on real infrastructure.</div>');
  if (t === "cleanup") body = card("Cleanup and expiration", facts([["Retention", safe(s.retention)], ["Expires", safe(date(s.expires))], ["After expiry", "The sandbox and its test data are deleted. Production is not affected."]]), retired ? "" : button("Extend 7 days", "extend", { cls: "btn-small", id }) + " " + button("Retire sandbox", "retire", { cls: "btn-small btn-danger", id }));
  return header({ crumbs: [["Deployments", "#/deployments/production"], ["Sandboxes", "#/deployments/sandboxes"], [s.id]], title: s.name, badge: pill(s.status), desc: s.id + " · " + cname(s.client) + " · from " + s.source + " · created " + date(s.created) + " · expires " + date(s.expires),
    actions: retired ? "" : button("Record a fix", "fix", { id }) + button("Update version", "update-version", { id }) + button("Compare versions", "tab", { id: "versions" }).replace('data-act="tab"', 'data-act="tab" data-key="sb-' + safe(id) + '"') + button("Request production promotion", "noop", { disabled: true, why: "Promotion needs approval and the backend release workflow" }) + button(s.status === "Waiting for approval" ? "Approval requested" : "Request approval", "request-approval", { cls: "btn-primary", id, disabled: s.status === "Waiting for approval", why: "Already requested" }) }) +
    simulated("This sandbox runs on synthetic test data only, never touches " + safe(cname(s.client)) + "’s live environment, and its results are not a real deployment.") + track +
    tabs("sb-" + id, [["overview", "Overview"], ["versions", "Versions"], ["config", "Configuration"], ["changes", "Changes"], ["tests", "Tests"], ["readiness", "Readiness"], ["logs", "Logs and health"], ["cleanup", "Cleanup"]], t) + body;
}
let monitorTries = 0;
function monitoring() {
  const scope = state.tab.monitor || "";
  const rows = [
    ["Cloudflare Workers", "Requests and CPU time", "Healthy", "Sample"], ["Neon PostgreSQL", "Storage and compute hours", "Healthy", "Sample"], ["Storage and exports", "R2 storage, 24-hour exports", "Healthy", "Sample"],
    ["Backup health", "Nightly backups", "Backup late", "Actual"], ["Email service usage", "Messages sent", "Unavailable", "Unavailable"], ["Authentication", "Sign-ins and failures", "Healthy", "Sample"],
    ["Jobs and queues", "Waiting and failed jobs", "Failed", "Actual"], ["Errors and incidents", "Errors in the last 24 hours", "Error", "Actual"], ["Integration failures", "Microsoft 365 link checks", "Healthy", "Sample"], ["Service availability", "Last 30 days", "Healthy", "Sample"],
  ];
  const cols = [{ label: "Service", value: (x) => x[0] }, { label: "What’s measured", value: (x) => x[1] }, { label: "State", value: (x) => x[2], html: (x) => pill(x[2]) }, { label: "Data", value: (x) => x[3], html: (x) => pill(x[3], x[3] === "Actual" ? "done" : x[3] === "Unavailable" ? "soon" : "draft") }, { label: "", sort: false, value: () => "", html: (x) => (x[3] === "Unavailable" ? button("Retry", "retry-monitor", { cls: "btn-small", ic: "refresh" }) : "") }];
  return header({ crumbs: [["Deployments", "#/deployments/production"], ["Monitoring"]], title: "Monitoring", desc: "Service health across all deployments or for one client. Each figure says whether it is measured, estimated, sample or unavailable." }) +
    '<div class="filters"><label class="tf"><span>View</span><select data-global="monitor"><option value="">All deployments</option>' + D.DEPLOYMENTS.map((d) => '<option value="' + d.id + '"' + (scope === d.id ? " selected" : "") + ">" + safe(cname(d.client)) + "</option>").join("") + '</select></label><span class="push">' + sample() + "</span></div>" +
    (monitorTries ? note("warn", "<strong>Email provider data is still unavailable.</strong> Tried " + monitorTries + " time" + (monitorTries === 1 ? "" : "s") + ". The provider isn’t connected in this preview.") : "") +
    dataTable("monitor", cols, rows, { search: "Search services", filters: [{ id: "data", label: "Data", options: ["Actual", "Estimate", "Sample", "Unavailable"], value: (x) => x[3] }] });
}

function releases(r) {
  const sub = r.parts[1] || "registry";
  if (sub === "registry" && r.parts[2]) return releaseDetail(decodeURIComponent(r.parts[2]));
  if (sub === "registry") {
    const cols = [
      { label: "Version", value: (x) => x.version, html: (x) => '<a class="strong" href="#/releases/registry/' + x.version + '">' + safe(x.version) + "</a>" },
      { label: "Status", value: (x) => releaseOf(x.version).status, html: (x) => pill(releaseOf(x.version).status) },
      { label: "Build", value: (x) => x.build, html: (x) => "<code>" + safe(x.build) + "</code>" },
      { label: "Date", value: (x) => x.date, html: (x) => safe(date(x.date)) },
      { label: "Clients", num: true, value: (x) => D.DEPLOYMENTS.filter((d) => d.version === x.version).length },
      { label: "Verification", value: (x) => x.verification },
    ];
    return header({ crumbs: [["Releases", "#/releases/registry"], ["Release registry"]], title: "Release registry", desc: "Every application version, its checks and who approved it. Nothing reaches production without Developer approval." }) +
      workflow() + dataTable("rels", cols, D.RELEASES, { search: "Search versions", filters: [{ id: "status", label: "Status", options: ["In review", "Approved", "Released", "Retired"], value: (x) => releaseOf(x.version).status }] });
  }
  if (sub === "history") {
    const cols = [{ label: "Date", value: (h) => h.date, html: (h) => safe(date(h.date)) }, { label: "Client", value: (h) => cname(h.client), html: (h) => '<a href="#/organisations/' + h.client + '">' + safe(cname(h.client)) + "</a>" }, { label: "From", value: (h) => h.from }, { label: "To", value: (h) => h.to }, { label: "Result", value: (h) => h.result, html: (h) => pill(h.result) }, { label: "Note", value: (h) => h.note }, { label: "By", value: (h) => h.by }];
    return header({ crumbs: [["Releases", "#/releases/registry"], ["Per-client history"]], title: "Per-client history", desc: "Every deployment and rollback for each client." }) +
      dataTable("relhist", cols, D.DEPLOY_HISTORY, { search: "Search clients or versions", filters: [{ id: "client", label: "Client", options: [...new Set(D.DEPLOY_HISTORY.map((h) => cname(h.client)))], value: (h) => cname(h.client) }, { id: "result", label: "Result", options: ["Succeeded", "Failed", "Rolled back"], value: (h) => h.result }] });
  }
  return notFound();
}
function workflow() {
  return '<section class="card track" aria-label="Release workflow">' + ["Development", "Sandbox testing", "Verification", "Review", "Approval", "Deployment", "Post-deployment verification"].map((x) => '<div class="step"><span></span>' + safe(x) + "</div>").join("") + "</section>";
}
function releaseDetail(v) {
  const rel = releaseOf(v);
  if (!rel) return notFound();
  const using = D.DEPLOYMENTS.filter((d) => d.version === v);
  return header({ crumbs: [["Releases", "#/releases/registry"], ["Release registry", "#/releases/registry"], [v]], title: "Release " + v, badge: pill(rel.status), desc: "Build " + rel.build + " · " + date(rel.date),
    actions: button("Deploy to production", "noop", { disabled: true, why: "No automatic production deployment. Needs the approved backend release workflow." }) + (rel.status === "In review" ? button("Approve release", "approve-release", { cls: "btn-primary", id: v }) : "") }) +
    simulated("Approving here records the decision in this preview. It does not deploy anything.") +
    '<div class="grid-2">' + card("Release", facts([["Release notes", safe(rel.notes)], ["Build or commit", "<code>" + safe(rel.build) + "</code>"], ["Compatibility", safe(rel.compat)], ["Testing and verification", safe(rel.verification)], ["Approval", safe(rel.approval)]])) +
    card("Clients using it", using.length ? using.map((d) => '<div class="rule-row"><a class="strong" href="#/deployments/production/' + d.id + '">' + safe(cname(d.client)) + "</a>" + pill(d.status) + "</div>").join("") : '<div class="empty"><strong>No clients on this version</strong></div>') + "</div>" +
    card("Deployments and rollbacks", D.DEPLOY_HISTORY.filter((h) => h.to === v || h.from === v).map((h) => '<div class="rule-row"><span class="rr-main"><span class="strong">' + safe(cname(h.client) + ": " + h.from + " → " + h.to) + '</span><span class="muted small">' + safe(date(h.date) + " · " + h.note) + "</span></span>" + pill(h.result) + "</div>").join("") || '<div class="empty"><strong>No deployments yet</strong></div>');
}

/* ---------- Finance (one model, both workspaces) ---------- */
function financeOverview() {
  const rep = F.report(LEDGER, state.period, state.pending);
  const trend = D.MONTHS.map((m) => ({ m, r: F.report(LEDGER, m, state.pending) }));
  const max = Math.max(...trend.map((x) => Math.max(x.r.revenue, -x.r.expenses)), 1);
  const base = isDev() ? "#/finance/" : "#/finance/";
  return header({ crumbs: [["Finance", base + "overview"], ["Overview"]], title: "Finance", desc: "Company-wide revenue, actual expenses and profit. The Developer and Business Partners see the same figures." }) +
    financeFilters() + sameAsBanner(rep) +
    '<div class="kpis four">' + kpi({ ic: "trending", badge: "Revenue", badgeTone: "done", value: money(rep.revenue), label: "Recognised revenue", href: isDev() ? "#/finance/revenue" : "#/finance/revenue-expenses" }) + kpi({ ic: "receipt", badge: "Expenses", badgeTone: "soon", value: money(-rep.expenses), label: "Recognised expenses", href: isDev() ? "#/finance/costs" : "#/finance/revenue-expenses" }) + kpi({ ic: "wallet", badge: rep.net >= 0 ? "Profit" : "Loss", badgeTone: rep.net >= 0 ? "done" : "overdue", value: money(rep.net), label: "Net profit", href: "#/finance/profit" }) + kpi({ ic: "pie", badge: "Margin", badgeTone: "progress", value: pct(rep.margin), label: "Profit margin", href: "#/finance/profit" }) + "</div>" +
    '<div class="split">' + card("Revenue and expenses by month", '<div class="trend">' + trend.map((x) => '<div class="trend-row"><span class="tiny muted">' + safe(F.periodOf(x.m).label.replace(" 2026", "")) + '</span><span class="trend-bars"><span class="tb rev" style="width:' + ((x.r.revenue / max) * 100).toFixed(1) + '%"></span><span class="tb exp" style="width:' + ((-x.r.expenses / max) * 100).toFixed(1) + '%"></span></span><span class="num small">' + money(x.r.net) + "</span></div>").join("") + '<p class="legend tiny muted"><span class="dot rev"></span>Revenue <span class="dot exp"></span>Expenses · figure = net profit</p></div>') + distributionCard() + "</div>";
}
function financeRevenue() {
  const rep = F.report(LEDGER, state.period, state.pending);
  return header({ crumbs: [["Finance", "#/finance/overview"], ["Revenue"]], title: "Revenue", desc: "Subscription, enterprise and adjustment records behind recognised revenue." }) + financeFilters() +
    '<div class="kpis four">' + kpi({ ic: "trending", badge: "Total", value: money(rep.revenue), label: "Recognised revenue" }) + kpi({ ic: "receipt", badge: "Subscriptions", value: money(rep.lines.subscription), label: "Subscription revenue" }) + kpi({ ic: "briefcase", badge: "Enterprise", badgeTone: "progress", value: money(rep.lines.enterprise), label: "Enterprise project revenue" }) + kpi({ ic: "refresh", badge: "Credits", badgeTone: "soon", value: money(rep.lines.revenueAdjustments), label: "Revenue adjustments" }) + "</div>" +
    ledgerTable("revenue", periodLedger((r) => r.kind === "Revenue"), "Revenue records");
}
function financeCosts() {
  const rep = F.report(LEDGER, state.period, state.pending);
  return header({ crumbs: [["Finance", "#/finance/overview"], ["Costs"]], title: "Costs", desc: "Actual infrastructure, operating and shared business expenses, with their invoices." }) + financeFilters() +
    '<div class="split">' + card("Expenses by category", breakdown(rep)) + card("Totals", facts([["Infrastructure", money(rep.lines.infrastructure)], ["Operating", money(rep.lines.operating)], ["Shared business", money(rep.lines.shared)], ["Unallocated", money(rep.lines.unallocated)], ["Recognised expenses", "<strong>" + money(rep.expenses) + "</strong>"]])) + "</div>" +
    ledgerTable("costs", periodLedger((r) => r.kind === "Expense"), "Expense records");
}
function sharedProfit() {
  const rep = F.report(LEDGER, state.period, state.pending);
  const key = "profit";
  const t = tabOf(key, "pl");
  let body = "";
  if (t === "pl") body = '<div class="split">' + card("How net profit is worked out", plTable(rep), '<span class="muted small">Net profit = recognised revenue − recognised expenses ± approved adjustments</span>') + '<div class="stack">' + card("Expenses by category", breakdown(rep)) + distributionCard() + "</div></div>" +
    ledgerTable("profit-records", periodLedger(), "Records behind the totals");
  if (t === "client") {
    const pc = F.profitByClient(LEDGER, state.period, state.pending);
    const visible = pc.rows.filter((x) => isDev() || assigned(clientById(x.client)));
    const others = pc.rows.filter((x) => !visible.includes(x));
    const sum = (k) => others.reduce((a, x) => a + x[k], 0);
    const rows = visible.map((x) => ({ name: cname(x.client), ...x })).concat(others.length ? [{ name: "Other partners’ clients (" + others.length + ", combined)", revenue: sum("revenue"), costs: sum("costs"), profit: sum("profit"), hidden: true }] : []).concat([{ name: "Company-wide costs and adjustments, not allocated", revenue: 0, costs: pc.companyWide, profit: pc.companyWide, company: true }]);
    body = note("info", "Infrastructure and shared business costs are allocated by purchased seats. Rows add up to net profit " + money(rep.net) + ".") +
      dataTable("by-client", [{ label: "Client", value: (x) => x.name, html: (x) => (x.hidden ? '<span class="muted with-icon">' + icon("lock", "sm") + safe(x.name) + "</span>" : x.company ? '<span class="muted">' + safe(x.name) + "</span>" : safe(x.name)) }, { label: "Revenue", num: true, value: (x) => x.revenue, html: (x) => money(x.revenue) }, { label: "Allocated costs", num: true, value: (x) => x.costs, html: (x) => money(x.costs) }, { label: "Profit", num: true, value: (x) => x.profit, html: (x) => money(x.profit) }], rows, { search: false, footNote: "total " + money(rows.reduce((a, x) => a + x.profit, 0)) });
  }
  if (t === "trends") body = dataTable("trends", [{ label: "Period", value: (x) => x.label }, { label: "Revenue", num: true, value: (x) => x.r.revenue, html: (x) => money(x.r.revenue) }, { label: "Expenses", num: true, value: (x) => x.r.expenses, html: (x) => money(x.r.expenses) }, { label: "Adjustments", num: true, value: (x) => x.r.lines.adjustments, html: (x) => money(x.r.lines.adjustments) }, { label: "Net profit", num: true, value: (x) => x.r.net, html: (x) => money(x.r.net) }, { label: "Margin", num: true, value: (x) => x.r.margin || 0, html: (x) => pct(x.r.margin) }], D.PERIODS.map((p) => ({ label: p.label, r: F.report(LEDGER, p.id, state.pending) })), { search: false });
  if (t === "budget") body = card("Budget versus actual", '<div class="empty"><strong>No budget records yet</strong>Add a budget for a period to compare it with actual figures. Nothing is estimated here.</div>');
  if (t === "statements") body = dataTable("statements", [{ label: "Period", value: (x) => x.label }, { label: "Net profit", num: true, value: (x) => x.net, html: (x) => money(x.net) }, { label: "Status", value: (x) => x.status, html: (x) => pill(x.status) }, { label: "Closed by", value: (x) => x.by }], D.MONTHS.map((m) => ({ label: F.periodOf(m).label, net: F.report(LEDGER, m).net, status: m === "2026-10" ? "Open" : "Closed", by: m === "2026-10" ? "No data" : "Danica Boton" })).reverse(), { search: false });
  return header({ crumbs: [["Finance", "#/finance/overview"], ["Shared profit reporting"]], title: "Shared profit reporting", desc: "The one profit calculation for ThryveMS. Both consoles show the same totals for the same period and status, and every line adds up from its records.", actions: button("Export", "export-pl", { ic: "download" }) + (isDev() ? button("Close period", "noop", { cls: "btn-primary", disabled: true, why: "Closing a period needs the backend ledger" }) : "") }) +
    financeFilters() + sameAsBanner(rep) +
    '<div class="kpis four">' + kpi({ ic: "trending", badge: "Revenue", badgeTone: "done", value: money(rep.revenue), label: "Recognised revenue" }) + kpi({ ic: "receipt", badge: "Expenses", badgeTone: "soon", value: money(-rep.expenses), label: "Recognised expenses" }) + kpi({ ic: "wallet", badge: rep.net >= 0 ? "Profit" : "Loss", badgeTone: rep.net >= 0 ? "done" : "overdue", value: money(rep.net), label: "Net profit" }) + kpi({ ic: "pie", badge: "Margin", badgeTone: "progress", value: pct(rep.margin), label: "Profit margin" }) + "</div>" +
    tabs(key, [["pl", "Profit and loss"], ["client", "By client"], ["trends", "Trends"], ["budget", "Budget vs actual"], ["statements", "Statement history"]], t) + body +
    '<details class="card policy"><summary>Accounting policy ' + safe(F.POLICY.id) + "</summary>" + facts([["Basis", F.POLICY.basis], ["Currency", F.POLICY.currency], ["Refunds and credits", safe(F.POLICY.refunds)], ["Taxes", safe(F.POLICY.tax)], ["Exchange rates", safe(F.POLICY.fx)], ["Allocation", safe(F.POLICY.allocation)]]) + "</details>";
}
function allocations() {
  const rows = F.allocationTable(LEDGER, state.period, state.pending);
  const bySource = new Map();
  for (const a of rows) { const k = a.month + a.ref; const x = bySource.get(k) || { ref: a.ref, source: a.source, month: a.month, original: a.original, allocated: 0, parts: 0 }; x.allocated += a.amount; x.parts++; bySource.set(k, x); }
  return header({ crumbs: [["Finance", "#/finance/overview"], ["Allocations"]], title: "Allocations", desc: "How shared costs are spread across clients. Every allocation adds back to its original expense." }) + financeFilters() +
    note("info", "<strong>Method:</strong> " + safe(F.POLICY.allocation)) +
    dataTable("alloc", [{ label: "Expense", value: (x) => x.ref + " " + x.source, html: (x) => safe(x.ref) + '<span class="muted tiny block">' + safe(x.source) + "</span>" }, { label: "Month", value: (x) => x.month, html: (x) => safe(date(x.month)) }, { label: "Original", num: true, value: (x) => x.original, html: (x) => money(x.original) }, { label: "Allocated to clients", num: true, value: (x) => x.allocated, html: (x) => money(x.allocated) }, { label: "Clients", num: true, value: (x) => x.parts }, { label: "Reconciles", value: (x) => (x.allocated === x.original ? "Yes" : "No"), html: (x) => pill(x.allocated === x.original ? "Reconciled" : "Failed") }], [...bySource.values()], { search: "Search expenses" });
}
function pricing() {
  const price = (id, k) => store.prices[id]?.[k];
  return header({ crumbs: [["Finance", "#/finance/overview"], ["Pricing"]], title: "Pricing", desc: "Plan catalogue and seat rules. Prices are not decided yet, so none is shown as final. Infrastructure tiers are separate from commercial pricing." }) +
    dataTable("plans", [{ label: "Plan", value: (p) => p.name }, { label: "Base seats", num: true, value: (p) => p.baseSeats }, { label: "Minimum seats", num: true, value: (p) => p.minSeats }, { label: "Monthly price", value: (p) => price(p.id, "monthly") ?? "Not set", html: (p) => (price(p.id, "monthly") != null ? money(price(p.id, "monthly")) + " " + pill("Draft", "soon") : pill("Not set")) }, { label: "Extra seat", value: (p) => price(p.id, "extra") ?? "Not set", html: (p) => (price(p.id, "extra") != null ? money(price(p.id, "extra")) + " " + pill("Draft", "soon") : pill("Not set")) }, { label: "Billing", value: (p) => p.cycles }, { label: "", sort: false, value: () => "", html: (p) => button("Edit", "edit-plan", { cls: "btn-small", id: p.id }) }], D.PLANS, { search: false, title: "Subscription plans" }) +
    card("Infrastructure sizing tiers", facts(D.TIERS.map((t) => [t.name, t.users + " users"])) + '<p class="card-note muted small">Tiers size the deployment. They don’t set the price a client pays.</p>') +
    card("Enterprise customisation", facts([["Default fee", money(150000) + " one-time per client"], ["Status", "Subject to approved commercial configuration"]]));
}
function subscriptionsPage(partner) {
  const list = clients();
  const lastInv = (c) => LEDGER.filter((r) => r.client === c.id && r.category === "Subscription").sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const cols = [
    { label: "Client", value: (c) => c.name, html: (c) => (partner ? '<a class="strong" href="#/clients/list/' + c.id + '">' : '<a class="strong" href="#/organisations/' + c.id + '">') + safe(c.name) + "</a>" },
    { label: "Plan", value: (c) => c.plan }, { label: "Cycle", value: (c) => c.cycle },
    { label: "Seats", num: true, value: (c) => c.seats, html: (c) => c.used + " / " + c.seats },
    { label: "Start", value: (c) => c.start, html: (c) => safe(date(c.start)) }, { label: "Renewal", value: (c) => c.renewal || "", html: (c) => safe(date(c.renewal)) },
    { label: "Status", value: accountStatus, html: (c) => pill(accountStatus(c)) },
    { label: "Last invoice", value: (c) => lastInv(c)?.status || "No data", html: (c) => (lastInv(c) ? pill(lastInv(c).status) : '<span class="muted">No data</span>') },
    { label: "", sort: false, value: () => "", html: (c) => (partner ? button("Request change", "new-request", { cls: "btn-small", id: c.id }) : button("Change", "change-sub", { cls: "btn-small", id: c.id })) },
  ];
  const hist = D.SUB_HISTORY.concat(store.subHistory).filter((h) => list.some((c) => c.id === h.client));
  return header({ crumbs: partner ? [["Clients", "#/clients/list"], ["Subscriptions and seats"]] : [["Finance", "#/finance/overview"], ["Subscriptions"]], title: partner ? "Subscriptions and seats" : "Subscriptions", desc: partner ? "Plans and seats for your clients. Ask for changes; the Developer applies them with an effective date." : "Every subscription, its seats, billing cycle and payment status. Changes need an effective date and a reason." }) +
    dataTable(partner ? "p-subs" : "subs", cols, list, { search: "Search clients", filters: [{ id: "status", label: "Status", options: ["Active", "Trial", "Awaiting provisioning", "Suspended"], value: accountStatus }, { id: "cycle", label: "Cycle", options: ["Monthly", "Annual"], value: (c) => c.cycle }] }) +
    dataTable(partner ? "p-subhist" : "subhist", [{ label: "Date", value: (h) => h.date, html: (h) => safe(date(h.date)) }, { label: "Client", value: (h) => cname(h.client) }, { label: "Change", value: (h) => h.change }, { label: "Effective", value: (h) => h.effective, html: (h) => safe(date(h.effective)) }, { label: "Reason", value: (h) => h.reason }, { label: "By", value: (h) => h.by }], hist, { title: "Subscription change history", search: "Search changes" });
}
function projects(r, partner) {
  const list = D.PROJECTS.filter((p) => isDev() || p.partner === state.partner);
  const base = partner ? "#/clients/projects/" : "#/finance/projects/";
  if (r.parts[2]) {
    const p = list.find((x) => x.id === r.parts[2]);
    if (!p) return notFound();
    return header({ crumbs: [[partner ? "Clients" : "Finance", partner ? "#/clients/list" : "#/finance/overview"], ["Enterprise projects", base.slice(0, -1)], [p.id]], title: p.name, badge: pill(p.status), desc: cname(p.client) + " · " + p.type }) +
      '<div class="grid-2">' + card("Project", facts([["Client", safe(cname(p.client))], ["Scope", safe(p.scope)], ["Type", safe(p.type)], ["Business Partner", safe(partnerLabel(p.partner))], ["Developer or team", safe(p.team)], ["Commercial value", money(p.value)], ["Approval", pill(p.approval)], ["Start", safe(date(p.start))], ["Expected completion", safe(date(p.due))], ["Invoice and payment", safe(p.invoice)]])) +
      '<div class="stack">' + card("Milestones", p.milestones.length ? p.milestones.map((m) => '<div class="rule-row"><span class="rr-main"><span class="strong">' + safe(m.name) + '</span><span class="muted small">Due ' + safe(date(m.due)) + "</span></span>" + pill(m.state) + "</div>").join("") : '<div class="empty"><strong>No milestones yet</strong>Milestones are set once the project is approved.</div>') +
      card("Deliverables and change requests", facts([["Deliverables", safe(p.deliverables.join("; ") || "Not set")], ["Change requests", safe(p.changes.join("; ") || "None")]])) + "</div></div>";
  }
  const cols = [{ label: "Project", value: (p) => p.name, html: (p) => '<a class="strong" href="' + base + p.id + '">' + safe(p.name) + '</a><span class="muted tiny block">' + safe(p.id) + "</span>" }, { label: "Client", value: (p) => cname(p.client) }, { label: "Partner", value: (p) => partnerLabel(p.partner) }, { label: "Value", num: true, value: (p) => p.value, html: (p) => money(p.value) }, { label: "Approval", value: (p) => p.approval, html: (p) => pill(p.approval) }, { label: "Status", value: (p) => p.status, html: (p) => pill(p.status) }, { label: "Due", value: (p) => p.due || "", html: (p) => safe(date(p.due)) }];
  return header({ crumbs: [[partner ? "Clients" : "Finance", partner ? "#/clients/list" : "#/finance/overview"], ["Enterprise projects"]], title: "Enterprise projects", desc: "Client customisation projects. Their revenue is recognised in the period each milestone is accepted, in the same ledger as subscriptions.", actions: partner ? button("Propose a project", "new-request", { cls: "btn-primary", ic: "plus", id: "project" }) : "" }) +
    dataTable(partner ? "p-projects" : "projects", cols, list, { search: "Search projects", filters: [{ id: "status", label: "Status", options: ["Proposed", "In progress", "Done"], value: (p) => p.status }] });
}
function distributions() {
  const d = F.distributionFor(LEDGER, state.period, state.pending);
  const cols = [{ label: "Month", value: (x) => x.month, html: (x) => safe(F.periodOf(x.month).label) }, { label: "Net profit", num: true, value: (x) => x.net, html: (x) => money(x.net) }];
  if (isDev()) cols.push({ label: "Developer, 30%", num: true, value: (x) => x.developer, html: (x) => money(x.developer) }, { label: "Developer paid", num: true, value: (x) => x.paidDev, html: (x) => money(x.paidDev) });
  cols.push({ label: "Partners, 70%", num: true, value: (x) => x.partners, html: (x) => money(x.partners) }, { label: "Partners paid", num: true, value: (x) => x.paidPartners, html: (x) => money(x.paidPartners) }, { label: "Status", value: (x) => (x.net <= 0 ? "No distribution" : x.paidPartners < x.partners || x.paidDev < x.developer ? "Pending" : "Paid"), html: (x) => pill(x.net <= 0 ? "No distribution" : x.paidPartners < x.partners || x.paidDev < x.developer ? "Pending" : "Paid") });
  return header({ crumbs: [["Finance", "#/finance/overview"], ["Distributions"]], title: "Distributions", desc: "How shared net profit is paid out: 30% to the Developer and 70% to Business Partners together. Distribution is separate from profit." }) + financeFilters() +
    '<div class="kpis four">' + kpi({ ic: "wallet", badge: "Basis", value: money(d.net), label: "Shared net profit" }) + (isDev() ? kpi({ ic: "users", badge: d.pendingDev ? "Pending" : "Paid", value: money(d.developer), label: "Developer share, 30%" }) : "") + kpi({ ic: "users", badge: d.pendingPartners ? "Pending" : "Paid", value: money(d.partners), label: "Business Partners together, 70%" }) + kpi({ ic: "clock", badge: "Pending", badgeTone: "soon", value: money(d.pendingPartners + (isDev() ? d.pendingDev : 0)), label: "Not paid yet" }) + "</div>" +
    note("info", "<strong>Reconciliation:</strong> shared net profit " + money(d.net) + " − adjustments before distribution " + money(0) + " = amount to distribute " + money(d.net) + ". The split between individual Business Partners is not agreed yet, so no individual share is shown.") +
    dataTable("dist", cols, d.perMonth, { search: false, title: "Distribution history" });
}
function invoices() {
  const rows = LEDGER.filter((r) => r.kind === "Revenue" && r.client && assigned(clientById(r.client)) && r.category !== "Revenue adjustment").sort((a, b) => (a.date < b.date ? 1 : -1));
  return header({ crumbs: [["Finance", "#/finance/overview"], ["Invoices"]], title: "Invoices", desc: "Invoices for your clients and their payment status. Online payment is a later phase; card details are never stored." }) +
    dataTable("invoices", [{ label: "Invoice", value: (r) => r.ref }, { label: "Date", value: (r) => r.date, html: (r) => safe(date(r.date)) }, { label: "Client", value: (r) => cname(r.client) }, { label: "For", value: (r) => r.source }, { label: "Amount", num: true, value: (r) => r.amount, html: (r) => money(r.amount) }, { label: "Payment", value: (r) => r.status, html: (r) => pill(r.status) }], rows, { search: "Search invoices or clients", filters: [{ id: "status", label: "Payment", options: ["Paid", "Outstanding"], value: (r) => r.status }, { id: "client", label: "Client", options: clients().map((c) => c.name), value: (r) => cname(r.client) }] });
}
function reports() {
  const rep = F.report(LEDGER, state.period, state.pending);
  const rows = [{ name: "Profit and loss statement", what: "Company-wide, " + F.periodOf(state.period).label, act: "export-pl" }].concat(clients().map((c) => ({ name: "Client commercial report: " + c.name, what: "Subscription, seats and invoices", act: "export-client", id: c.id })));
  return header({ crumbs: [["Finance", "#/finance/overview"], ["Reports"]], title: "Reports", desc: "Reports you are allowed to export: the company-wide statement and reports for your clients." }) + financeFilters() +
    dataTable("reports", [{ label: "Report", value: (x) => x.name }, { label: "Covers", value: (x) => x.what }, { label: "", sort: false, value: () => "", html: (x) => button("Export CSV", x.act, { cls: "btn-small", ic: "download", id: x.id }) }], rows, { search: "Search reports", footNote: "net profit " + money(rep.net) });
}

/* ---------- Operations ---------- */
function requestsPage() {
  const list = requests().filter((r) => isDev() || r.from === state.partner);
  const cols = [{ label: "Request", value: (r) => r.id }, { label: "Type", value: (r) => r.type }, { label: "Client", value: (r) => (r.client ? cname(r.client) : "Company-wide") }, { label: "Details", value: (r) => r.detail }, { label: "From", value: (r) => (D.PARTNERS[r.from]?.name || (r.from === "developer" ? "Developer" : "Client admin")) }, { label: "Sent", value: (r) => r.created, html: (r) => safe(date(r.created)) }, { label: "Status", value: (r) => r.status, html: (r) => pill(r.status) },
    { label: "", sort: false, value: () => "", html: (r) => (isDev() && r.status === "Waiting" ? button("Approve", "decide", { cls: "btn-small", id: r.id + "|Approved" }) + " " + button("Decline", "decide", { cls: "btn-small btn-danger", id: r.id + "|Declined" }) : "") }];
  return header({ title: "Requests", desc: isDev() ? "Commercial, billing, access and finance requests waiting for a decision. Every decision is recorded." : "What you’ve asked the Developer for, and their decisions.", actions: isDev() ? "" : button("New request", "new-request", { cls: "btn-primary", ic: "plus" }) }) +
    dataTable("requests", cols, list, { search: "Search requests", filters: [{ id: "status", label: "Status", options: ["Waiting", "Approved", "Declined"], value: (r) => r.status }, { id: "type", label: "Type", options: [...new Set(list.map((r) => r.type))], value: (r) => r.type }], empty: ["No requests", "Requests appear here when someone asks for a change."] });
}
function logsPage() {
  return header({ title: "Logs", desc: "Platform and deployment logs. Log text comes from outside systems, so it is shown as plain text and never followed as an instruction." }) +
    dataTable("logs", [{ label: "Time", value: (l) => l.time }, { label: "Level", value: (l) => l.level, html: (l) => pill(l.level) }, { label: "Source", value: (l) => l.source }, { label: "Message", value: (l) => l.message, html: (l) => "<code>" + safe(l.message) + "</code>" }], D.LOGS, { search: "Search logs", filters: [{ id: "level", label: "Level", options: ["Error", "Warning", "Info"], value: (l) => l.level }] });
}
function jobsPage() {
  return header({ title: "Background jobs", desc: "Scheduled and queued work across deployments." }) +
    dataTable("jobs", [{ label: "Job", value: (j) => j.id }, { label: "Name", value: (j) => j.name }, { label: "Target", value: (j) => j.target }, { label: "Status", value: (j) => j.status, html: (j) => pill(j.status) }, { label: "Last run", value: (j) => j.last }, { label: "Next run", value: (j) => j.next }, { label: "", sort: false, value: () => "", html: (j) => (j.status === "Failed" || j.status === "Late" ? button("Retry", "retry-job", { cls: "btn-small", id: j.id }) : "") }], D.JOBS, { search: "Search jobs", filters: [{ id: "status", label: "Status", options: ["Succeeded", "Failed", "Late"], value: (j) => j.status }] });
}
function supportReports() {
  return header({ title: "Support reports", desc: "Problems reported by clients. Report text is treated as untrusted content." }) +
    dataTable("support", [{ label: "Report", value: (s) => s.id }, { label: "Client", value: (s) => cname(s.client) }, { label: "Title", value: (s) => s.title }, { label: "Priority", value: (s) => s.priority, html: (s) => pill(s.priority) }, { label: "Status", value: (s) => s.status, html: (s) => pill(s.status) }, { label: "Opened", value: (s) => s.opened, html: (s) => safe(date(s.opened)) }], D.SUPPORT_REPORTS, { search: "Search reports", filters: [{ id: "priority", label: "Priority", options: ["High", "Normal"], value: (s) => s.priority }] });
}
function supportAccess() {
  return header({ title: "Support access", desc: "Time-limited access to a client’s workspace, given only with a reason and recorded.", actions: button("Grant access", "grant", { cls: "btn-primary", ic: "key" }) }) +
    simulated("Grants here are recorded in this browser. They don’t open a real session in a client workspace.") +
    dataTable("access", [{ label: "Grant", value: (g) => g.id }, { label: "Client", value: (g) => cname(g.client) }, { label: "Who", value: (g) => g.who }, { label: "Reason", value: (g) => g.reason }, { label: "From", value: (g) => g.from }, { label: "Until", value: (g) => g.until }, { label: "Status", value: (g) => g.status, html: (g) => pill(g.status) }], D.ACCESS_GRANTS.concat(store.grants), { search: "Search grants" });
}
function team(r) {
  const sub = r.parts[1] || "members";
  if (sub === "members") return header({ crumbs: [["Platform team", "#/team/members"], ["Team"]], title: "Team", desc: "People who can open the platform consoles. Client users have no access." }) +
    dataTable("team", [{ label: "Name", value: (m) => m.name }, { label: "Role", value: (m) => m.role, html: (m) => pill(m.role, m.role === "Business Partner" ? "done" : "progress") }, { label: "Access", value: (m) => m.access }, { label: "Since", value: (m) => m.since, html: (m) => safe(date(m.since)) }], D.TEAM, { search: "Search people" });
  if (sub === "permissions") {
    const yes = pill("Yes", "done"), no = '<span class="muted">No</span>';
    const rows = [["Deployments, sandboxes and releases", yes, yes, no, no], ["Approve releases and production changes", yes, no, no, no], ["Infrastructure credentials and settings", yes, no, no, no], ["View company-wide finance", yes, yes, yes, no], ["Edit financial records", yes, no, "Request only", no], ["Approve financial adjustments", yes, no, no, no], ["Client records", "All", "All", "Assigned clients", no], ["Grant support access", yes, no, no, no]];
    return header({ crumbs: [["Platform team", "#/team/members"], ["Permissions"]], title: "Permissions", desc: "Financial visibility and financial editing are separate permissions. Seeing the shared profit never gives infrastructure or other clients’ records." }) +
      '<section class="card"><div class="tbl-scroll plain"><table class="data-table"><thead><tr><th scope="col">Permission</th><th scope="col">Platform owner</th><th scope="col">Developer</th><th scope="col">Business Partner</th><th scope="col">Client user</th></tr></thead><tbody>' + rows.map((r) => "<tr>" + r.map((c, i) => "<td>" + (i ? c : safe(c)) + "</td>").join("") + "</tr>").join("") + "</tbody></table></div></section>" +
      note("info", "This preview simulates roles with the “Preview, view as” selector. Production enforces them on the server.");
  }
  if (sub === "history") return header({ crumbs: [["Platform team", "#/team/members"], ["Change history"]], title: "Change history", desc: "Every important financial, administrative and deployment change." }) +
    dataTable("audit", [{ label: "When", value: (a) => a.at }, { label: "Who", value: (a) => a.who }, { label: "Area", value: (a) => a.area, html: (a) => pill(a.area, "draft") }, { label: "Change", value: (a) => a.what }], store.audit.concat(D.START_AUDIT), { search: "Search changes", filters: [{ id: "area", label: "Area", options: ["Deployment", "Sandbox", "Finance", "Subscription", "Organisation", "Release", "Access", "Request"], value: (a) => a.area }] });
  if (sub === "settings") return header({ crumbs: [["Platform team", "#/team/members"], ["Settings"]], title: "Settings", desc: "Platform-wide settings. Changes to accounting rules need approval and apply to both consoles." }) +
    card("Financial reporting", facts([["Accounting policy", safe(F.POLICY.id)], ["Basis", F.POLICY.basis], ["Currency", F.POLICY.currency], ["Distribution split", "Developer 30%, Business Partners 70% together"], ["Split between partners", "Not agreed yet"]])) +
    card("Integrations", facts([["Cloudflare", pill("Not connected", "draft")], ["Neon", pill("Not connected", "draft")], ["Billing and payments", pill("Later phase", "draft")]]));
  return notFound();
}

/* ---------- Business Partner pages ---------- */
function partnerOverview() {
  const list = clients();
  const rep = F.report(LEDGER, state.period, state.pending);
  const d = F.distributionFor(LEDGER, state.period, state.pending);
  const months = F.periodOf(state.period).months;
  const out = LEDGER.filter((r) => r.status === "Outstanding" && list.some((c) => c.id === r.client));
  const mine = requests().filter((r) => r.from === state.partner && r.status === "Waiting");
  const changes = D.SUB_HISTORY.concat(store.subHistory).filter((h) => list.some((c) => c.id === h.client));
  return header({ title: "Overview", desc: "Your clients, their subscriptions and the company’s shared profit. Deployments and releases are run by the Developer; ask for changes in Requests.", actions: button("New request", "new-request", { cls: "btn-primary", ic: "plus" }) }) +
    '<div class="filters">' + periodSelect() + '<span class="push">' + sample() + "</span></div>" +
    '<section class="stack" aria-labelledby="pk"><h2 id="pk">Clients and subscriptions</h2><div class="kpis">' +
    kpi({ ic: "building", badge: "Yours", value: list.length, label: "Assigned clients", href: "#/clients/list" }) +
    kpi({ ic: "check", badge: "Active", value: list.filter((c) => accountStatus(c) === "Active").length, label: "Active subscriptions", href: "#/clients/subscriptions" }) +
    kpi({ ic: "clock", badge: "Trial", badgeTone: "progress", value: list.filter((c) => c.trial).length, label: "Trial accounts", href: "#/clients/subscriptions" }) +
    kpi({ ic: "plus", badge: "This period", value: list.filter((c) => months.some((m) => (c.start || "").startsWith(m))).length, label: "New subscriptions", href: "#/clients/subscriptions" }) +
    kpi({ ic: "refresh", badge: "Next 30 days", badgeTone: "soon", value: list.filter((c) => c.renewal && c.renewal >= D.TODAY && c.renewal <= "2026-11-25").length, label: "Renewals due", href: "#/clients/subscriptions" }) +
    kpi({ ic: "receipt", badge: out.length ? out.length + " open" : "None", badgeTone: out.length ? "soon" : "done", value: money(out.reduce((a, r) => a + r.amount, 0)), label: "Outstanding invoices", href: "#/finance/invoices" }) +
    kpi({ ic: "briefcase", badge: "Projects", badgeTone: "progress", value: D.PROJECTS.filter((p) => p.partner === state.partner).length, label: "Enterprise projects", href: "#/clients/projects" }) +
    kpi({ ic: "users", badge: "Recent", value: changes.length, label: "Client subscription changes", href: "#/clients/subscriptions" }) +
    "</div></section>" + profitBand(rep, "#/finance/profit") +
    '<div class="grid-2">' + listCard("Your pending requests", mine.map((r) => [r.type + (r.client ? ": " + cname(r.client) : ""), r.detail + " · sent " + date(r.created), "#/requests", r.status]), mine.length, "#/requests") +
    listCard("Recent business activity", changes.map((h) => [cname(h.client) + ": " + h.change, date(h.date) + " · " + h.reason, "#/clients/subscriptions", ""]).concat(LEDGER.filter((r) => r.client && list.some((c) => c.id === r.client)).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 3).map((r) => [r.ref + " · " + cname(r.client), date(r.date) + " · " + money(r.amount), "#/finance/invoices", r.status])).slice(0, 6)) + "</div>" +
    '<p class="muted small">Your share this period: Business Partners together receive ' + money(d.partners) + ". Individual shares are not agreed yet.</p>";
}
function partnerClients(r) {
  if (r.parts[2]) {
    const c = clientById(r.parts[2]);
    if (!c || !assigned(c)) return notFound();
    const t = tabOf("pc-" + c.id, "overview");
    let body = "";
    if (t === "overview") body = card("Account", facts([["Account status", pill(accountStatus(c))], ["Plan", safe(c.plan + ", " + c.cycle.toLowerCase())], ["Seats", c.used + " active of " + c.seats], ["Client since", safe(date(c.start))], ["Renewal", safe(date(c.renewal))], ["Deployment", '<span class="muted">Managed by the Developer</span>']]));
    if (t === "invoices") body = ledgerTable("pc-inv-" + c.id, LEDGER.filter((x) => x.client === c.id), "Invoices and billing history");
    if (t === "history") body = card("Commercial history", D.SUB_HISTORY.concat(store.subHistory).filter((h) => h.client === c.id).map((h) => '<div class="rule-row"><span class="rr-main"><span class="strong">' + safe(h.change) + '</span><span class="muted small">Effective ' + safe(date(h.effective)) + " · " + safe(h.reason) + "</span></span></div>").join("") || '<div class="empty"><strong>No changes yet</strong></div>');
    if (t === "info") body = card("Business information", facts([["Billing contact", safe(store.settings["billing-" + c.id] || "Not set")]]), button("Edit", "edit-info", { cls: "btn-small", id: c.id }));
    return header({ crumbs: [["Clients", "#/clients/list"], [c.name]], title: c.name, badge: pill(accountStatus(c)), desc: c.plan + " · " + c.used + " of " + c.seats + " seats", actions: button("Request more seats", "new-request", { id: c.id + "|Seat change" }) + button("Request a change", "new-request", { cls: "btn-primary", id: c.id }) }) +
      tabs("pc-" + c.id, [["overview", "Overview"], ["invoices", "Invoices and billing"], ["history", "Commercial history"], ["info", "Business information"]], t) + body;
  }
  const cols = [{ label: "Client", value: (c) => c.name, html: (c) => '<a class="strong" href="#/clients/list/' + c.id + '">' + safe(c.name) + "</a>" }, { label: "Plan", value: (c) => c.plan }, { label: "Seats", num: true, value: (c) => c.used, html: (c) => c.used + " / " + c.seats }, { label: "Status", value: accountStatus, html: (c) => pill(accountStatus(c)) }, { label: "Renewal", value: (c) => c.renewal || "", html: (c) => safe(date(c.renewal)) }];
  return header({ crumbs: [["Clients", "#/clients/list"], ["Clients"]], title: "Clients", desc: "Clients assigned to you. Their QMS records and deployment details stay with the Developer." }) +
    dataTable("p-clients", cols, clients(), { search: "Search clients", filters: [{ id: "status", label: "Status", options: ["Active", "Trial", "Awaiting provisioning", "Suspended"], value: accountStatus }], empty: ["No clients assigned", "Clients appear here when the platform owner assigns them to you."] });
}
function businessSettings() {
  const s = store.settings;
  return header({ title: "Business settings", desc: "Your contact details and notifications." }) +
    '<form class="card form-card" data-form="biz" novalidate><div class="form-grid"><div class="field"><label for="biz-name">Display name</label><input id="biz-name" value="' + safe(s.bizName || D.PARTNERS[state.partner].name) + '" /></div><div class="field"><label for="biz-email">Billing contact email</label><input id="biz-email" type="email" value="' + safe(s.bizEmail || "") + '" placeholder="name@example.com" /><small>Used for distribution statements.</small></div>' +
    '<div class="field"><label for="biz-notify">Notify me about</label><select id="biz-notify"><option' + (s.bizNotify === "All requests and invoices" ? " selected" : "") + ">All requests and invoices</option><option" + (s.bizNotify === "Decisions on my requests only" ? " selected" : "") + ">Decisions on my requests only</option></select></div></div>" +
    '<p class="err" id="biz-err" role="alert"></p><div class="form-actions">' + button("Save settings", "save-biz", { cls: "btn-primary" }) + "</div></form>";
}

function notFound() { return header({ title: "Page not found", desc: "This page or record doesn’t exist, or you don’t have access to it." }) + '<a class="btn" href="#/overview">Go to the overview</a>'; }
function noAccess() { return '<div class="center-card card"><img src="./assets/thryvems-logo.png" alt="ThryveMS" class="lt" /><img src="./assets/thryvems-logo-dark.png" alt="ThryveMS" class="dk" />' + header({ title: "No access to the platform console", desc: "Client users work in their own ThryveMS workspace. The Developer and Business Partner consoles are not available to them." }) + "</div>"; }

function page() {
  const r = route();
  const [p] = r.parts;
  if (isDev()) {
    switch (p) {
      case "overview": return devOverview();
      case "organisations": return organisations(r);
      case "deployments": return deployments(r);
      case "releases": return releases(r);
      case "finance": return ({ overview: financeOverview, revenue: financeRevenue, costs: financeCosts, profit: sharedProfit, allocations, pricing, subscriptions: () => subscriptionsPage(false), projects: () => projects(r, false), distributions })[r.parts[1] || "overview"]?.() || notFound();
      case "requests": return requestsPage();
      case "logs": return logsPage();
      case "jobs": return jobsPage();
      case "support-reports": return supportReports();
      case "support-access": return supportAccess();
      case "team": return team(r);
      default: return notFound();
    }
  }
  switch (p) {
    case "overview": return partnerOverview();
    case "clients": return ({ list: () => partnerClients(r), subscriptions: () => subscriptionsPage(true), projects: () => projects(r, true) })[r.parts[1] || "list"]?.() || notFound();
    case "finance": return ({ overview: financeOverview, "revenue-expenses": () => header({ crumbs: [["Finance", "#/finance/overview"], ["Revenue and expenses"]], title: "Revenue and expenses", desc: "Every revenue and expense record behind the shared profit. Details of other partners’ clients are hidden; their amounts still count." }) + financeFilters() + '<div class="split">' + card("Expenses by category", breakdown(F.report(LEDGER, state.period, state.pending))) + card("Totals", facts([["Recognised revenue", money(F.report(LEDGER, state.period, state.pending).revenue)], ["Recognised expenses", money(F.report(LEDGER, state.period, state.pending).expenses)], ["Approved adjustments", money(F.report(LEDGER, state.period, state.pending).lines.adjustments)], ["Net profit", "<strong>" + money(F.report(LEDGER, state.period, state.pending).net) + "</strong>"]])) + "</div>" + ledgerTable("p-ledger", periodLedger(), "Revenue and expense records"), profit: sharedProfit, invoices, distributions, reports })[r.parts[1] || "overview"]?.() || notFound();
    case "requests": return requestsPage();
    case "settings": return businessSettings();
    default: return notFound();
  }
}

/* ---------- Render ---------- */
let lastPath = "";
function render(skeleton) {
  document.documentElement.classList.toggle("dark", state.theme === "dark");
  const app = document.getElementById("app");
  if (state.role === "client") {
    app.innerHTML = '<div class="no-shell">' + topbar() + '<main class="content" id="page">' + noAccess() + "</main></div>";
    return;
  }
  const content = skeleton ? '<div class="skeleton" aria-busy="true" aria-label="Loading"><span class="sk h"></span><span class="sk p"></span><div class="kpis">' + '<span class="sk card-sk"></span>'.repeat(4) + '</div><span class="sk block-sk"></span></div>' : page();
  app.innerHTML = '<div class="shell' + (state.collapsed ? " collapsed" : "") + '">' + sidebar() + (state.drawer ? '<button type="button" class="backdrop" data-act="drawer" aria-label="Close menu"></button>' : "") +
    '<div class="main">' + topbar() + '<main class="content" id="page" tabindex="-1">' + content + "</main></div></div>";
}
function navigate() {
  const path = route().parts.join("/");
  const changed = path !== lastPath;
  lastPath = path;
  state.drawer = false;
  if (!changed) return render();
  render(true);
  setTimeout(() => { render(); document.getElementById("page")?.focus({ preventScroll: true }); window.scrollTo(0, 0); }, 120);
}

/* ---------- Dialogs ---------- */
let modalDirty = false, busy = false;
function modal(title, desc, body, footer, wide) {
  modalDirty = false;
  document.getElementById("dialog-root").innerHTML = '<div class="modal-backdrop"><section class="modal' + (wide ? " wide" : "") + '" role="dialog" aria-modal="true" aria-labelledby="dlg-title"><header class="modal-head"><h2 id="dlg-title">' + safe(title) + "</h2>" + (desc ? "<p>" + safe(desc) + "</p>" : "") + '<button type="button" class="icon-btn close" data-act="close" aria-label="Close">' + icon("x") + '</button></header><div class="modal-body">' + body + '</div><footer class="modal-foot">' + (footer || button("Close", "close")) + "</footer></section></div>";
  setTimeout(() => document.querySelector(".modal input:not([disabled]), .modal select, .modal textarea, .modal .modal-foot .btn")?.focus(), 0);
}
function closeModal(force) {
  if (modalDirty && !force) {
    const foot = document.querySelector(".modal-foot");
    if (foot && !foot.dataset.confirm) {
      foot.dataset.confirm = "1";
      foot.innerHTML = '<span class="muted small push-left">You have unsaved changes. Discard them?</span>' + button("Keep editing", "keep") + button("Discard", "discard", { cls: "btn-danger" });
      return;
    }
  }
  modalDirty = false;
  document.getElementById("dialog-root").innerHTML = "";
}
const field = (label, id, input, help) => '<div class="field"><label for="' + id + '">' + safe(label) + "</label>" + input + (help ? "<small>" + help + "</small>" : "") + "</div>";
const input = (id, value, attrs) => '<input id="' + id + '" value="' + safe(value ?? "") + '" ' + (attrs || "") + " />";
const select = (id, options, value) => '<select id="' + id + '">' + options.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return '<option value="' + safe(v) + '"' + (v === value ? " selected" : "") + ">" + safe(l) + "</option>"; }).join("") + "</select>";
const val = (id) => (document.getElementById(id)?.value || "").trim();
const errOut = (msg) => { const e = document.getElementById("dlg-err"); if (e) e.textContent = msg; };
const errBox = '<p class="err" id="dlg-err" role="alert"></p>';

function toast(msg, kind) {
  const root = document.getElementById("toast-root");
  root.innerHTML = '<div class="toast ' + (kind || "ok") + '">' + icon(kind === "warn" ? "alert" : "check") + "<span>" + safe(msg) + "</span></div>";
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (root.innerHTML = ""), 3200);
}

function sandboxDialog(clientId) {
  const live = clients().filter((c) => deploymentOf(c.id)?.status === "Live" || deploymentOf(c.id)?.status === "Deploy failed");
  const c = clientById(clientId) || live[0];
  modal("Create client sandbox", "An isolated copy of one client’s application version and configuration, with synthetic test data.",
    '<div class="form-grid">' + field("Client (type a name to search)", "sb-client", '<input id="sb-client" list="sb-clients" autocomplete="off" value="' + safe(c?.name || "") + '" required /><datalist id="sb-clients">' + live.map((x) => '<option value="' + safe(x.name) + '"></option>').join("") + "</datalist>") +
    field("Source deployment", "sb-source", input("sb-source", deploymentOf(c?.id)?.id || "", "disabled"), "Filled from the client") +
    field("Source version", "sb-from", input("sb-from", deploymentOf(c?.id)?.version || "", "disabled")) +
    field("Target version", "sb-target", select("sb-target", D.RELEASES.filter((r) => r.status !== "Retired").map((r) => [r.version, r.version + " · " + r.status]), D.RELEASES[0].version)) +
    field("Sandbox name", "sb-name", input("sb-name", "", 'placeholder="Export stuck at 90%: fix"')) +
    field("Purpose", "sb-purpose", select("sb-purpose", ["Bug fix", "Feature update", "Version testing", "Configuration testing"], "Bug fix")) +
    field("Issue or change reference", "sb-ref", input("sb-ref", "", 'placeholder="SUP-2026-041"')) +
    field("Allowed configuration", "sb-config", select("sb-config", ["Client modules and settings, no secrets", "Default settings"], "Client modules and settings, no secrets")) +
    field("Test data", "sb-data", select("sb-data", ["Synthetic sample data only", "Synthetic: manufacturing, 60 users", "Synthetic: services, 15 users"], "Synthetic sample data only"), "No production records, secrets, emails, sign-in tokens or database copies.") +
    field("Retention", "sb-ret", select("sb-ret", ["7 days", "14 days", "30 days"], "14 days")) + "</div>" +
    field("Description", "sb-desc", '<textarea id="sb-desc" rows="2"></textarea>') + simulated("This adds a sample record in this browser. It doesn’t create a Cloudflare Worker, Neon branch or hosted URL.") + errBox,
    button("Cancel", "close") + button("Create preview sandbox", "save-sandbox", { cls: "btn-primary" }), true);
}
function createSandbox() {
  const c = clients().find((x) => x.name.toLowerCase() === val("sb-client").toLowerCase());
  const dep = c && deploymentOf(c.id);
  if (!c || !dep) return errOut("Choose a client with a deployment from the matching names.");
  if (store.sandboxes.some((s) => s.client === c.id && s.status !== "Retired")) return errOut("This client already has an active sandbox. Retire it before creating another.");
  const ref = val("sb-ref").slice(0, 60);
  if (!ref) return errOut("Enter the issue or change reference, so the sandbox can be traced.");
  const n = Math.max(14, ...store.sandboxes.map((s) => Number(s.id.slice(3)) || 0)) + 1;
  const days = Number(val("sb-ret")) || parseInt(val("sb-ret"), 10) || 14;
  const exp = new Date(D.TODAY + "T00:00:00"); exp.setDate(exp.getDate() + days);
  const sb = { id: "SB-0" + n, client: c.id, source: dep.id, sourceVersion: dep.version, target: val("sb-target"), name: val("sb-name") || val("sb-purpose") + " for " + c.name, purpose: val("sb-purpose"), reference: ref, description: val("sb-desc"), config: val("sb-config"), data: val("sb-data"), retention: val("sb-ret"), expires: exp.toISOString().slice(0, 10), status: "Draft", created: D.TODAY, fixes: [], tests: [] };
  store.sandboxes.unshift(sb);
  audit("Created sandbox " + sb.id + " for " + c.name + " (" + ref + ")", "Sandbox");
  save(); closeModal(true); toast("Sandbox " + sb.id + " created (simulated)");
  go("#/deployments/sandboxes/" + sb.id);
}

function orgDialog(c) {
  modal(c ? "Edit " + c.name : "Create organisation", c ? "Changes are recorded in the change history." : "Creates the client account only. It doesn’t create a deployment; request provisioning separately.",
    '<div class="form-grid">' + field("Organisation name", "org-name", input("org-name", c?.name || "", "required")) + (c ? "" : field("Business Partner", "org-partner", select("org-partner", Object.values(D.PARTNERS).map((p) => [p.id, p.label + ", " + p.name]), "partner-a")) + field("Plan", "org-plan", select("org-plan", ["Team", "Business"], "Team")) + field("Seats", "org-seats", input("org-seats", "10", 'type="number" min="1" max="100"'), "Base allowance is 10 users; you can go down to 1.") + field("Billing cycle", "org-cycle", select("org-cycle", ["Monthly", "Annual"], "Monthly"))) + "</div>" + errBox,
    button("Cancel", "close") + button(c ? "Save changes" : "Create organisation", "save-org", { cls: "btn-primary", id: c?.id }));
}
function subDialog(c) {
  modal("Change subscription: " + c.name, "Every change needs an effective date and a reason, and is kept in the client’s history.",
    '<div class="form-grid">' + field("Plan", "sub-plan", select("sub-plan", ["Team", "Business"], c.plan)) + field("Billing cycle", "sub-cycle", select("sub-cycle", ["Monthly", "Annual"], c.cycle)) + field("Purchased seats", "sub-seats", input("sub-seats", c.seats, 'type="number" min="1" max="100"'), "At least 1. Active seats now: " + c.used + ".") + field("Effective date", "sub-date", input("sub-date", "", 'type="date"')) + "</div>" + field("Reason", "sub-reason", '<textarea id="sub-reason" rows="2"></textarea>') + errBox,
    button("Cancel", "close") + button("Save change", "save-sub", { cls: "btn-primary", id: c.id }));
}
function requestDialog(clientId, type) {
  const list = clients();
  modal("New request", "The Developer decides and you’re told. Nothing changes until then.",
    '<div class="form-grid">' + field("Type", "rq-type", select("rq-type", ["Seat change", "Plan change", "Billing", "Enterprise project", "Other"], type || (clientId === "project" ? "Enterprise project" : "Seat change"))) + field("Client", "rq-client", select("rq-client", list.map((c) => [c.id, c.name]), clientId)) + "</div>" + field("What do you need?", "rq-detail", '<textarea id="rq-detail" rows="3" placeholder="Add 10 seats from 1 November"></textarea>') + errBox,
    button("Cancel", "close") + button("Send request", "save-request", { cls: "btn-primary" }));
}

/* ---------- Events ---------- */
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]");
  if (!b || b.disabled) return;
  const act = b.dataset.act, id = b.dataset.id;
  if (busy && act.startsWith("save")) return;
  const r = route();
  switch (act) {
    case "group": { if (state.collapsed) { const n = nav().find((x) => x.id === id); go("#/" + id + "/" + n.children[0][0]); break; } state.open.has(id) ? state.open.delete(id) : state.open.add(id); if (r.parts[0] === id && !state.open.has(id)) state.open.add(id); render(); break; }
    case "collapse": state.collapsed = !state.collapsed; savePrefs(); render(); break;
    case "drawer": state.drawer = !state.drawer; render(); break;
    case "theme": state.theme = state.theme === "dark" ? "light" : "dark"; savePrefs(); render(); break;
    case "tab": state.tab[b.dataset.key] = id; render(); break;
    case "sort": { const st = tableState[b.dataset.key]; const i = Number(id); if (st.sort === i) st.dir = -st.dir; else { st.sort = i; st.dir = 1; } refreshTable(b.dataset.key); break; }
    case "page": { const st = tableState[b.dataset.key]; st.page += Number(id); refreshTable(b.dataset.key); break; }
    case "close": case "keep": if (act === "keep") { const f = document.querySelector(".modal-foot"); if (f) { delete f.dataset.confirm; } } act === "keep" ? (document.querySelector(".modal-foot").innerHTML = lastFooter) : closeModal(); break;
    case "discard": closeModal(true); break;
    case "noop": break;
    case "record": { const rec = LEDGER.find((x) => x.ref === id); if (!rec) break; const v = viewRow(rec); modal(v.ref, v.category + " · " + date(v.date), facts([["Accounting period", safe(F.periodOf(v.period).label)], ["Client", clientCell(v)], ["Category", safe(v.category)], ["Source or vendor", safe(v.source)], ["Amount", money(v.amount) + (v.usd ? ' <span class="muted">(USD ' + v.usd.toFixed(2) + " @ " + v.rate + ")</span>" : "")], ["Basis", pill(v.basis)], ["Status", pill(v.status)], ["Evidence", safe(v.evidence) + (v.hidden ? "" : ' <span class="muted">· link opens the stored document in production</span>')], ["Created by", safe(v.createdBy)], ["Approval", safe(v.approval)], ["Change history", safe((v.history || []).join("; "))]])); break; }
    case "new-sandbox": sandboxDialog(id); break;
    case "save-sandbox": busy = true; try { createSandbox(); } finally { busy = false; } break;
    case "fix": modal("Record a fix", "Say what you changed in the sandbox.", field("What changed", "fx-text", '<textarea id="fx-text" rows="3"></textarea>') + errBox, button("Cancel", "close") + button("Record fix", "save-fix", { cls: "btn-primary", id })); break;
    case "save-fix": { const s = store.sandboxes.find((x) => x.id === id); const t = val("fx-text"); if (!t) { errOut("Describe the fix."); break; } s.fixes.push(t.slice(0, 200)); audit("Recorded a fix in " + id, "Sandbox"); save(); closeModal(true); state.tab["sb-" + id] = "changes"; toast("Fix recorded"); render(); break; }
    case "update-version": { const s = store.sandboxes.find((x) => x.id === id); modal("Update sandbox version", s.id + " now targets " + s.target + ".", field("Target version", "uv-target", select("uv-target", D.RELEASES.filter((x) => x.status !== "Retired").map((x) => x.version), s.target)), button("Cancel", "close") + button("Update version", "save-version", { cls: "btn-primary", id })); break; }
    case "save-version": { const s = store.sandboxes.find((x) => x.id === id); s.target = val("uv-target"); audit(id + " target version set to " + s.target, "Sandbox"); save(); closeModal(true); toast("Target version updated (simulated)"); render(); break; }
    case "request-approval": { const s = store.sandboxes.find((x) => x.id === id); s.status = "Waiting for approval"; audit("Requested approval for " + id, "Sandbox"); save(); toast("Approval requested"); render(); break; }
    case "extend": { const s = store.sandboxes.find((x) => x.id === id); const d = new Date(s.expires + "T00:00:00"); d.setDate(d.getDate() + 7); s.expires = d.toISOString().slice(0, 10); audit("Extended " + id + " to " + s.expires, "Sandbox"); save(); toast("Retention extended by 7 days"); render(); break; }
    case "retire": modal("Retire sandbox " + id, "This only removes the sample sandbox record in this browser. Production is not affected.", "<p>Its synthetic test data would be deleted. You can’t undo this.</p>", button("Cancel", "close") + button("Retire sandbox", "confirm-retire", { cls: "btn-danger", id })); break;
    case "confirm-retire": { const s = store.sandboxes.find((x) => x.id === id); s.status = "Retired"; audit("Retired " + id, "Sandbox"); save(); closeModal(true); toast(id + " retired"); render(); break; }
    case "provision": { const free = allClients().filter((c) => !deploymentOf(c.id) && c.status !== "Archived"); modal("Request provisioning", "Steps: choose the client, configure, check, review, request. Provisioning happens only after approval and once the backend exists.", field("1. Client", "pv-client", select("pv-client", free.map((c) => [c.id, c.name]), id && free.some((c) => c.id === id) ? id : free[0]?.id)) + '<div class="form-grid">' + field("2. Region", "pv-region", select("pv-region", ["Asia Pacific"], "Asia Pacific")) + field("Infrastructure tier", "pv-tier", select("pv-tier", D.TIERS.map((t) => t.name + " (" + t.users + ")"), "Micro (1–30)")) + field("Release channel", "pv-chan", select("pv-chan", ["Stable", "Early access"], "Stable")) + field("Version", "pv-ver", select("pv-ver", [LATEST], LATEST)) + "</div>" + '<ul class="checks"><li class="ok">' + icon("check") + "3. Separate Neon project and secrets</li><li class=\"ok\">" + icon("check") + "No production data copied</li><li class=\"no\">" + icon("x") + "Backend provisioning not built yet</li></ul>" + simulated("4–7. Review, request and approval are recorded here. Nothing is provisioned; the outcome shows as waiting for the backend.") + errBox, button("Cancel", "close") + button("Request provisioning", "save-provision", { cls: "btn-primary" }), true); break; }
    case "save-provision": { const cid = val("pv-client"); if (!cid) { errOut("Choose a client without a deployment."); break; } store.requests.push({ id: "REQ-P-" + Date.now().toString().slice(-5), type: "Provisioning", client: cid, from: "developer", detail: "Provision " + val("pv-tier") + ", " + val("pv-chan") + ", " + val("pv-ver") + " (simulated)", status: "Waiting", created: D.TODAY }); audit("Requested provisioning for " + cname(cid) + " (simulated)", "Deployment"); save(); closeModal(true); toast("Provisioning requested. Waiting for approval (simulated)"); render(); break; }
    case "new-org": orgDialog(null); break;
    case "edit-org": orgDialog(clientById(id)); break;
    case "save-org": {
      const name = val("org-name");
      if (name.length < 2) { errOut("Enter the organisation’s name."); break; }
      if (id) { store.changes[id] = { ...(store.changes[id] || {}), name }; audit("Renamed organisation to " + name, "Organisation"); }
      else {
        const seats = Number(val("org-seats"));
        if (!(seats >= 1 && seats <= 100)) { errOut("Seats must be between 1 and 100."); break; }
        const nid = "org-" + Date.now().toString(36);
        store.orgs.push({ id: nid, name, partner: val("org-partner"), plan: val("org-plan"), cycle: val("org-cycle"), seats, used: 0, status: "Created", trial: false, start: D.TODAY, renewal: null, monthly: 0, billFrom: null, modules: ["Documents"] });
        audit("Created organisation " + name + " (no deployment)", "Organisation");
      }
      save(); closeModal(true); toast(id ? "Details saved" : "Organisation created. No deployment was created."); render(); break;
    }
    case "assign": { const c = clientById(id); modal("Assign Business Partner", c.name, field("Business Partner", "as-partner", select("as-partner", Object.values(D.PARTNERS).map((p) => [p.id, p.label + ", " + p.name]), c.partner)) + field("Reason", "as-reason", '<textarea id="as-reason" rows="2"></textarea>') + errBox, button("Cancel", "close") + button("Assign", "save-assign", { cls: "btn-primary", id })); break; }
    case "save-assign": { if (!val("as-reason")) { errOut("Give a reason. It’s kept in the history."); break; } store.changes[id] = { ...(store.changes[id] || {}), partner: val("as-partner") }; audit(cname(id) + " assigned to " + partnerLabel(val("as-partner")) + ": " + val("as-reason"), "Organisation"); save(); closeModal(true); toast("Partner assigned"); render(); break; }
    case "archive": modal("Archive " + cname(id), "The account becomes read-only and leaves the active lists.", "<p>Billing stops. Its records are kept for the retention period.</p>", button("Cancel", "close") + button("Archive account", "confirm-archive", { cls: "btn-danger", id })); break;
    case "confirm-archive": store.changes[id] = { ...(store.changes[id] || {}), status: "Archived" }; audit("Archived " + cname(id), "Organisation"); save(); closeModal(true); toast("Account archived"); render(); break;
    case "change-sub": subDialog(clientById(id)); break;
    case "save-sub": {
      const c = clientById(id), seats = Number(val("sub-seats"));
      if (!(seats >= 1 && seats <= 100)) { errOut("Seats must be between 1 and 100."); break; }
      if (!val("sub-date")) { errOut("Choose the effective date."); break; }
      if (!val("sub-reason")) { errOut("Give a reason. It’s kept in the history."); break; }
      const parts = [];
      if (val("sub-plan") !== c.plan) parts.push(c.plan + " → " + val("sub-plan"));
      if (val("sub-cycle") !== c.cycle) parts.push(c.cycle + " → " + val("sub-cycle"));
      if (seats !== c.seats) parts.push("Seats " + c.seats + " → " + seats);
      if (!parts.length) { errOut("Nothing changed."); break; }
      store.changes[id] = { ...(store.changes[id] || {}), plan: val("sub-plan"), cycle: val("sub-cycle"), seats };
      store.subHistory.unshift({ date: D.TODAY, client: id, change: parts.join(", "), effective: val("sub-date"), reason: val("sub-reason"), by: "Danica Boton" });
      audit(c.name + ": " + parts.join(", ") + ", effective " + val("sub-date") + ", reason: " + val("sub-reason"), "Subscription");
      save(); closeModal(true); toast("Subscription change recorded"); render(); break;
    }
    case "modules": { const c = clientById(id); const all = ["Documents", "Audits", "Risks", "Corrective action", "Management review", "Objectives", "Training"]; modal("Configure modules", c.name, '<fieldset class="checks-f"><legend class="sr-only">Modules</legend>' + all.map((m) => '<label class="check"><input type="checkbox" value="' + safe(m) + '"' + (c.modules.includes(m) ? " checked" : "") + " /> " + safe(m) + "</label>").join("") + "</fieldset>" + errBox, button("Cancel", "close") + button("Save modules", "save-modules", { cls: "btn-primary", id })); break; }
    case "save-modules": { const mods = [...document.querySelectorAll(".modal input[type=checkbox]:checked")].map((x) => x.value); if (!mods.length) { errOut("Keep at least one module."); break; } store.changes[id] = { ...(store.changes[id] || {}), modules: mods }; audit(cname(id) + " modules: " + mods.join(", "), "Organisation"); save(); closeModal(true); toast("Modules saved"); render(); break; }
    case "approve-release": modal("Approve release " + id, "Records your approval. It doesn’t deploy anything; production deployment needs the backend release workflow.", "<p>Check the sandbox results and compatibility notes first.</p>", button("Cancel", "close") + button("Approve release", "confirm-release", { cls: "btn-primary", id })); break;
    case "confirm-release": store.releases[id] = { status: "Approved", approval: "Approved by Danica Boton, " + date(D.TODAY) }; audit("Approved release " + id + " (no deployment)", "Release"); save(); closeModal(true); toast("Release " + id + " approved"); render(); break;
    case "decide": { const [rid, decision] = id.split("|"); modal(decision === "Approved" ? "Approve request" : "Decline request", rid, "<p>The person who asked is told. The decision is recorded.</p>", button("Cancel", "close") + button(decision === "Approved" ? "Approve" : "Decline", "confirm-decide", { cls: decision === "Approved" ? "btn-primary" : "btn-danger", id })); break; }
    case "confirm-decide": { const [rid, decision] = id.split("|"); store.decisions[rid] = decision; audit(decision + " " + rid, "Request"); save(); closeModal(true); toast("Request " + decision.toLowerCase()); render(); break; }
    case "new-request": { const [cid, type] = (id || "").split("|"); requestDialog(cid || clients()[0]?.id, type); break; }
    case "save-request": { if (!val("rq-detail")) { errOut("Say what you need."); break; } const n = 42 + store.requests.length; store.requests.push({ id: "REQ-2026-0" + n, type: val("rq-type"), client: val("rq-client"), from: state.partner, detail: val("rq-detail").slice(0, 200), status: "Waiting", created: D.TODAY }); audit("Sent request REQ-2026-0" + n, "Request"); save(); closeModal(true); toast("Request sent"); render(); break; }
    case "grant": modal("Grant support access", "Time-limited access to one client’s workspace. Recorded in the change history.", '<div class="form-grid">' + field("Client", "gr-client", select("gr-client", allClients().filter((c) => deploymentOf(c.id)).map((c) => [c.id, c.name]))) + field("Hours", "gr-hours", input("gr-hours", "2", 'type="number" min="1" max="8"'), "1 to 8 hours") + "</div>" + field("Reason", "gr-reason", '<textarea id="gr-reason" rows="2"></textarea>') + errBox, button("Cancel", "close") + button("Grant access", "save-grant", { cls: "btn-primary" })); break;
    case "save-grant": { const h = Number(val("gr-hours")); if (!(h >= 1 && h <= 8)) { errOut("Choose 1 to 8 hours."); break; } if (!val("gr-reason")) { errOut("Give a reason."); break; } store.grants.unshift({ id: "ACC-2026-0" + (13 + store.grants.length), client: val("gr-client"), who: "Danica Boton", reason: val("gr-reason"), from: D.TODAY + " now", until: "+" + h + " hours", status: "Simulated" }); audit("Granted " + h + "h support access to " + cname(val("gr-client")) + " (simulated)", "Access"); save(); closeModal(true); toast("Access recorded (simulated)"); render(); break; }
    case "edit-plan": { const p = D.PLANS.find((x) => x.id === id); modal("Edit " + p.name + " plan", "Saved as a draft. Prices become final only once approved.", '<div class="form-grid">' + field("Monthly price (PHP)", "pl-m", input("pl-m", store.prices[id]?.monthly ?? "", 'type="number" min="0" placeholder="Not set"')) + field("Extra seat (PHP)", "pl-x", input("pl-x", store.prices[id]?.extra ?? "", 'type="number" min="0" placeholder="Not set"')) + "</div>" + errBox, button("Cancel", "close") + button("Save draft", "save-plan", { cls: "btn-primary", id })); break; }
    case "save-plan": { const m = val("pl-m"), x = val("pl-x"); store.prices[id] = { monthly: m === "" ? null : Number(m), extra: x === "" ? null : Number(x) }; audit("Draft price for " + id + " plan updated", "Finance"); save(); closeModal(true); toast("Draft saved, not approved"); render(); break; }
    case "edit-info": modal("Business information", cname(id), field("Billing contact email", "bi-email", input("bi-email", store.settings["billing-" + id] || "", 'type="email"')) + errBox, button("Cancel", "close") + button("Save", "save-info", { cls: "btn-primary", id })); break;
    case "save-info": { const em = val("bi-email"); if (em && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { errOut("Enter a valid email address."); break; } store.settings["billing-" + id] = em; save(); closeModal(true); toast("Saved"); render(); break; }
    case "save-biz": { const em = val("biz-email"); if (em && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { document.getElementById("biz-err").textContent = "Enter a valid email address."; break; } store.settings.bizName = val("biz-name"); store.settings.bizEmail = em; store.settings.bizNotify = val("biz-notify"); save(); state.dirty = false; toast("Settings saved"); render(); break; }
    case "retry-monitor": monitorTries++; render(); toast("Still unavailable (simulated)", "warn"); break;
    case "retry-job": toast("Retry queued (simulated). Nothing runs in this preview.", "warn"); break;
    case "export-pl": { const rep = F.report(LEDGER, state.period, state.pending); const L = rep.lines; exportCsv("thryvems-profit-" + state.period + ".csv", [["ThryveMS shared profit", F.periodOf(state.period).label], ["Basis", F.POLICY.basis + ", " + F.POLICY.currency + ", " + F.POLICY.id], [], ["Line", "Amount (PHP)"], ["Subscription revenue", L.subscription], ["Enterprise project revenue", L.enterprise], ["Revenue adjustments", L.revenueAdjustments], ["Recognised revenue", rep.revenue], ["Infrastructure", L.infrastructure], ["Operating", L.operating], ["Shared business", L.shared], ["Unallocated", L.unallocated], ["Recognised expenses", rep.expenses], ["Approved adjustments", L.adjustments], ["Net profit", rep.net], ["Profit margin", rep.margin == null ? "No data" : (rep.margin * 100).toFixed(1) + "%"]]); toast("Report exported"); break; }
    case "export-client": { const c = clientById(id); if (!c || !assigned(c)) break; exportCsv("thryvems-client-" + c.id + ".csv", [["Client", c.name], ["Plan", c.plan], ["Seats", c.used + " of " + c.seats], [], ["Invoice", "Date", "For", "Amount", "Status"]].concat(LEDGER.filter((r) => r.client === c.id).map((r) => [r.ref, r.date, r.source, r.amount, r.status]))); toast("Report exported"); break; }
  }
});
let lastFooter = "";
const observer = new MutationObserver(() => { const f = document.querySelector(".modal-foot"); if (f && !f.dataset.confirm) lastFooter = f.innerHTML; });
observer.observe(document.getElementById("dialog-root"), { childList: true, subtree: true });

document.addEventListener("input", (e) => {
  if (e.target.closest(".modal")) modalDirty = true;
  if (e.target.closest("[data-form]")) state.dirty = true;
  const k = e.target.dataset.search;
  if (k) { tableState[k].q = e.target.value; tableState[k].page = 1; refreshTable(k); }
  if (e.target.id === "sb-client") { const c = clients().find((x) => x.name.toLowerCase() === e.target.value.trim().toLowerCase()); const d = c && deploymentOf(c.id); document.getElementById("sb-source").value = d?.id || ""; document.getElementById("sb-from").value = d?.version || ""; }
});
document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.closest(".modal")) modalDirty = true;
  if (t.id === "preview-role") {
    const v = t.value;
    state.role = v === "developer" ? "developer" : v === "client" ? "client" : "partner";
    if (v.startsWith("partner-")) state.partner = v;
    for (const k of Object.keys(tableState)) delete tableState[k];
    state.tab = {}; state.open.clear(); state.dirty = false;
    closeModal(true);
    if (location.hash !== "#/overview") location.hash = "#/overview"; else { lastPath = ""; navigate(); }
    return;
  }
  if (t.dataset.global) {
    const g = t.dataset.global;
    if (g === "period") state.period = t.value;
    else if (g === "pending") state.pending = !!t.value;
    else if (g === "monitor") state.tab.monitor = t.value;
    else state[g] = t.value;
    render(); return;
  }
  if (t.dataset.filter) { const st = tableState[t.dataset.filter]; st.f[t.dataset.fid] = t.value; st.page = 1; refreshTable(t.dataset.filter); }
  if (t.dataset.size) { const st = tableState[t.dataset.size]; st.size = Number(t.value); st.page = 1; refreshTable(t.dataset.size); }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { if (document.querySelector(".modal")) closeModal(); else if (state.drawer) { state.drawer = false; render(); } }
});
let guardHash = null;
window.addEventListener("hashchange", (e) => {
  if (state.dirty && guardHash === null) {
    guardHash = location.hash;
    history.replaceState(null, "", e.oldURL.slice(e.oldURL.indexOf("#")));
    modal("Leave without saving?", "You have unsaved changes on this page.", "", button("Stay", "close") + '<button type="button" class="btn btn-danger" id="leave-anyway">Leave</button>');
    document.getElementById("leave-anyway").addEventListener("click", () => { const h = guardHash; guardHash = null; state.dirty = false; closeModal(true); location.hash = h; });
    document.querySelector(".modal [data-act=close]")?.addEventListener("click", () => { guardHash = null; });
    return;
  }
  guardHash = null;
  navigate();
});
window.addEventListener("beforeunload", (e) => { if (state.dirty) { e.preventDefault(); e.returnValue = ""; } });

if (!location.hash) history.replaceState(null, "", "#/overview");
lastPath = route().parts.join("/");
render();
