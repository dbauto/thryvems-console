/**
 * ThryveMS Console: shell, router, sign-in and event wiring.
 * Sign-in is UI only (no credential check) until the backend auth lands (plan v3 D9: Cloudflare Access + WorkOS
 * passkeys, server-side authorization). It selects the signed-in account's role; it is not a security boundary.
 */
import { getUi, saveUi, isDeveloper, partnerOf, businessPartnerId, isInspecting, getData } from "./store.js";
import { PARTNERS } from "./seed.js";
import { h, closeOverlay, getTableState, loadingState, errorState, markDirty, toast } from "./ui.js";
import { icon as lucideIcon } from "./icons.js";
import { wordmark } from "./logo.js";
import { registry } from "./registry.js";
import * as devOverview from "./pages/dev-overview.js";
import * as devOrgs from "./pages/dev-orgs.js";
import * as devDeploy from "./pages/dev-deploy.js";
import * as devSandbox from "./pages/dev-sandbox.js";
import * as devReleases from "./pages/dev-releases.js";
import * as devFinance from "./pages/dev-finance.js";
import * as devOps from "./pages/dev-ops.js";
import * as biz from "./pages/biz.js";
import * as shared from "./pages/shared.js";

for (const m of [devOverview, devOrgs, devDeploy, devSandbox, devReleases, devFinance, devOps, biz, shared]) Object.assign(registry.actions, m.actions || {});

export const NAV_DEV = [
  ["overview", "Overview", "layout-dashboard", "#/dev"], ["organisations", "Organisations", "building-2", "#/dev/organisations"], ["deployments", "Deployments", "server", "#/dev/deployments"],
  ["releases", "Releases", "git-branch", "#/dev/releases"], ["finance", "Finance", "wallet", "#/dev/finance"], ["requests", "Requests", "mail", "#/dev/requests"],
  ["logs", "Logs", "scroll-text", "#/dev/logs"], ["jobs", "Background jobs", "settings", "#/dev/jobs"], ["reports", "Support reports", "flag", "#/dev/support-reports"],
  ["support", "Support access", "life-buoy", "#/dev/support-access"], ["team", "Platform team", "users", "#/dev/team"],
];
export const NAV_BIZ = [["overview", "Overview", "layout-dashboard", "#/biz"], ["clients", "Clients", "building-2", "#/biz/clients"], ["finance", "Finance", "wallet", "#/biz/finance"], ["requests", "Requests", "mail", "#/biz/requests"], ["settings", "Business settings", "settings", "#/biz/settings"]];
// Approved sub-pages, shown under the active menu group. Each one is a ?tab= view of that page.
const T = (base, list) => list.map(([id, label]) => [label, base + "?tab=" + id, id]);
export const SUBNAV = {
  dev: {
    deployments: T("#/dev/deployments", [["production", "Production"], ["sandboxes", "Sandboxes"], ["monitoring", "Monitoring"]]),
    releases: T("#/dev/releases", [["registry", "Release registry"], ["history", "Per-client history"]]),
    finance: T("#/dev/finance", [["overview", "Overview"], ["revenue", "Revenue"], ["costs", "Costs"], ["profit", "Shared profit reporting"], ["allocations", "Allocations"], ["pricing", "Pricing"], ["subscriptions", "Subscriptions"], ["enterprise", "Enterprise"], ["distributions", "Distributions"]]),
    team: T("#/dev/team", [["team", "Team"], ["permissions", "Permissions"], ["history", "Change history"], ["settings", "Settings"]]),
  },
  biz: {
    clients: T("#/biz/clients", [["clients", "Clients"], ["subscriptions", "Subscriptions and seats"], ["enterprise", "Enterprise projects"]]),
    finance: T("#/biz/finance", [["overview", "Overview"], ["revenue-expenses", "Revenue and expenses"], ["profit", "Shared profit reporting"], ["invoices", "Invoices"], ["distributions", "Distributions"], ["reports", "Reports"]]),
  },
};

export function parseRoute() {
  const raw = (location.hash || "").replace(/^#/, "") || "/";
  const [path, qs] = raw.split("?");
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
  return { ws: parts[0] || "", parts: parts.slice(1), query: new URLSearchParams(qs || ""), path: "#" + path };
}
export const navigate = (hash) => { if (location.hash === hash) render(); else location.hash = hash; };

function devPage(r) {
  const [a, b, c] = r.parts;
  switch (a) {
    case undefined: return ["overview", devOverview.render(r)];
    case "organisations": return ["organisations", b ? devOrgs.renderDetail(b, r) : devOrgs.renderList(r)];
    case "deployments": return ["deployments", b ? devDeploy.renderDetail(b, r) : devDeploy.renderList(r)];
    case "sandboxes": return ["deployments", b ? devSandbox.renderDetail(b, r) : null];
    case "releases": return ["releases", b ? devReleases.renderDetail(b, r) : devReleases.renderList(r)];
    case "finance": return ["finance", devFinance.render(r)];
    case "requests": return ["requests", devOps.renderRequests(r)];
    case "logs": return ["logs", devOps.renderLogs(r)];
    case "jobs": return ["jobs", devOps.renderJobs(r)];
    case "support-reports": return ["reports", devOps.renderReports(r, b)];
    case "support-access": return ["support", devOps.renderSupportAccess(r)];
    case "team": return ["team", devOps.renderTeam(r)];
    default: return [null, null, c];
  }
}
function bizPage(r) {
  const [a, b] = r.parts;
  switch (a) {
    case undefined: return ["overview", biz.renderOverview(r)];
    case "clients": return ["clients", b ? biz.renderClient(b, r) : biz.renderClients(r)];
    case "finance": return ["finance", biz.renderFinance(r)];
    case "requests": return ["requests", biz.renderRequests(r)];
    case "settings": return ["settings", biz.renderSettings(r)];
    default: return [null, null];
  }
}

let lastPath = null;
// Presentation-only preference; no client data or authorization is stored.
let sidebarCollapsed = false;
let drawerOpen = false;
export function render() {
  const ui = getUi();
  document.documentElement.classList.toggle("dark", ui.theme === "dark");
  const r = parseRoute();
  if (!ui.signedIn) { renderLogin(); return; }
  if (r.ws === "login") { location.replace(ui.role === "partner" ? "#/biz" : "#/dev"); return; }
  // Default landing per role.
  if (!r.ws) { location.replace(ui.role === "partner" ? "#/biz" : "#/dev"); return; }
  const role = ui.role;
  let ws = r.ws === "dev" ? "dev" : r.ws === "biz" ? "biz" : null;
  let active = null, content = null;
  const allowed = role === "client" ? false : ws === "dev" ? role === "developer" : ws === "biz";
  if (allowed) {
    if (ui.dataState === "Loading") { content = loadingState("Loading " + (ws === "dev" ? "Developer Console" : "Business workspace")); active = (ws === "dev" ? devPage : bizPage)({ ...r, dry: true })[0]; }
    else if (ui.dataState === "Error") { content = errorState("This page couldn't load", "Something went wrong while loading this page. Try again."); active = (ws === "dev" ? devPage : bizPage)(r)[0]; }
    else { [active, content] = (ws === "dev" ? devPage : bizPage)(r); }
  }
  if (!content) content = shared.notFound();
  const nav = ws === "biz" ? NAV_BIZ : NAV_DEV;
  const showNav = allowed;
  const title = ws === "biz" ? "ThryveMS Business" : "ThryveMS Platform";
  const sub = ws === "biz" ? (partnerOf(businessPartnerId())?.label || "") + " · Business management" : "Developer Console";
  const curTab = r.query.get("tab");
  const subs = (id) => {
    const list = SUBNAV[ws]?.[id];
    if (!list || active !== id || sidebarCollapsed) return "";
    const cur = curTab || list[0][2];
    return '<div class="nav-sub" role="group" aria-label="' + h(id) + ' pages">' + list.map(([label, href, tid]) => '<a href="' + href + '" class="sub' + (cur === tid && r.parts.length < 2 ? " active" : "") + '"' + (cur === tid && r.parts.length < 2 ? ' aria-current="page"' : "") + ">" + h(label) + "</a>").join("") + "</div>";
  };
  const menu = showNav ? nav.map(([id, label, iconName, href]) => '<a href="' + href + '" title="' + h(label) + '" aria-label="' + h(label) + '" class="' + (active === id ? "active" : "") + '"' + (active === id && !SUBNAV[ws]?.[id] ? ' aria-current="page"' : "") + '><span class="nav-icon" aria-hidden="true">' + lucideIcon(iconName) + '</span><span class="nav-text">' + h(label) + '</span>' + devCount(id) + "</a>" + subs(id)).join("") : "";
  const focus = captureFocus();
  document.getElementById("app").innerHTML =
    '<a class="skip-link" href="#page">Skip to content</a><div class="app-shell"><div class="drawer-backdrop' + (drawerOpen ? " open" : "") + '" data-act="close-drawer"></div><aside id="console-sidebar" class="sidebar' + (sidebarCollapsed ? ' collapsed' : '') + (drawerOpen ? ' drawer-open' : '') + '" aria-label="Console navigation"><div class="brand"><img class="product-symbol" src="./assets/thryvems-mark.png" width="34" height="28" alt="" /><span class="brand-details"><strong class="brand-name" aria-label="' + h(title) + '">' + wordmark() + "</strong><small>" + h(sub) + "</small></span></div>" +
    (showNav ? '<nav class="nav" aria-label="' + (ws === "biz" ? "Business" : "Developer") + ' menu"><div class="nav-label">' + (ws === "biz" ? "Business" : "Platform") + "</div>" + menu + "</nav>" : '<div class="nav"></div>') +
    '<div class="sidebar-tools"><button type="button" class="sidebar-pin" data-act="toggle-sidebar" aria-label="' + (sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar') + '" aria-expanded="' + (!sidebarCollapsed) + '">' + lucideIcon(sidebarCollapsed ? "panel-left-open" : "panel-left-close") + '<span class="nav-text">' + (sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar') + '</span></button></div>' +
    '<div class="sidebar-footer">' + accountCard() + "</div></aside>" +
    '<div class="workspace"><header class="topbar"><div class="topbar-left">' + (showNav ? '<button type="button" class="btn btn-small mobile-toggle" data-act="open-drawer" aria-controls="console-sidebar" aria-expanded="' + drawerOpen + '" aria-label="Open menu">' + lucideIcon("menu") + "</button>" : "") + '<img class="product-symbol small" src="./assets/thryvems-mark.png" width="30" height="24" alt="" /><strong class="brand-name" aria-label="' + h(title) + '">' + wordmark() + ' <span class="brand-ws">' + (ws === "biz" ? "Business" : "Platform") + "</span></strong>" + (isInspecting() && ws === "biz" ? " " + '<span class="pill progress">Inspection view</span>' : "") + "</div>" +
    '<div class="topbar-right">' + topControls(ws) + "</div></header>" +
    '<main class="content" id="page" tabindex="-1">' + content + "</main></div></div>" + '<div id="toast-region" class="toast-region" role="status" aria-live="polite"></div>';
  restoreFocus(focus, r.path + "?" + r.query.toString());
}
function devCount(id) {
  if (!isDeveloper()) return "";
  const n = registry.counts?.[id]?.();
  return n ? '<span class="nav-count" aria-label="' + n + ' need attention">' + n + "</span>" : "";
}
export const ACCOUNTS = [
  { email: "owner@platform.example", role: "developer", name: "Platform owner", title: "Developer" },
  { email: "partner-a@partners.example", role: "partner", partner: "partner-a", name: "Mara Santos", title: "Business partner · Partner A" },
  { email: "partner-b@partners.example", role: "partner", partner: "partner-b", name: "Jun Reyes", title: "Business partner · Partner B" },
];
function currentAccount() {
  const ui = getUi();
  return ACCOUNTS.find((a) => a.email === ui.email) || ACCOUNTS.find((a) => a.role === ui.role && (a.role !== "partner" || a.partner === ui.partner)) || ACCOUNTS[0];
}
const initials = (n) => n.split(/\s+/).map((x) => x[0]).join("").slice(0, 2).toUpperCase();
function accountCard() {
  const a = currentAccount();
  return '<div class="account-card"><span class="avatar" aria-hidden="true">' + h(initials(a.name)) + '</span><span class="account-text"><strong>' + h(a.name) + "</strong><small>" + h(a.title) + "</small></span></div>";
}
function topControls(ws) {
  const ui = getUi();
  let html = "";
  if (ui.role === "developer") {
    html += '<div class="segment" role="group" aria-label="Workspace"><a href="#/dev" class="' + (ws === "dev" ? "active" : "") + '"' + (ws === "dev" ? ' aria-current="true"' : "") + '>Developer</a><a href="#/biz" class="' + (ws === "biz" ? "active" : "") + '"' + (ws === "biz" ? ' aria-current="true"' : "") + ">Business</a></div>";
    if (ws === "biz") html += '<div class="field compact"><label for="inspect-partner">Inspect as</label><select id="inspect-partner" data-change="inspect-partner">' + PARTNERS.map((p) => '<option value="' + p.id + '"' + (ui.inspect === p.id ? " selected" : "") + ">" + h(p.label) + "</option>").join("") + "</select></div>";
  }
  const a = currentAccount();
  html += '<button type="button" class="btn btn-small btn-quiet icon-btn" data-act="theme" aria-label="Toggle light and dark appearance" title="' + (ui.theme === "dark" ? "Light appearance" : "Dark appearance") + '">' + lucideIcon(ui.theme === "dark" ? "sun" : "moon") + "</button>";
  html += '<details class="account-menu"><summary aria-label="Account menu"><span class="avatar" aria-hidden="true">' + h(initials(a.name)) + '</span></summary><div class="account-pop" role="menu"><div class="account-who"><strong>' + h(a.name) + "</strong><small>" + h(a.email) + "</small><small>" + h(a.title) + '</small></div><button type="button" role="menuitem" class="btn btn-small" data-act="sign-out">' + lucideIcon("log-out") + " Sign out</button></div></details>";
  return html;
}
let loginState = { error: "", info: "", email: "owner@platform.example" };
function renderLogin() {
  const ui = getUi();
  document.documentElement.classList.toggle("dark", ui.theme === "dark");
  if (location.hash !== "#/login") history.replaceState(null, "", "#/login");
  document.title = "Sign in · ThryveMS Console";
  document.getElementById("app").innerHTML =
    '<main class="login-shell" id="page"><div class="login-card"><div class="login-brand"><img class="product-symbol" src="./assets/thryvems-mark.png" width="40" height="32" alt="" />' + wordmark() + ' <span class="brand-ws">Console</span></div>' +
    '<h1>Sign in</h1><p class="muted">Platform owner and Business Partner accounts only.</p>' +
    (loginState.error ? '<div class="alert alert-danger" role="alert" id="login-error">' + h(loginState.error) + "</div>" : "") +
    (loginState.info ? '<div class="alert alert-info" role="status">' + h(loginState.info) + "</div>" : "") +
    '<form class="login-form" data-login novalidate><div class="field"><label for="login-email">Work email</label><input id="login-email" name="email" type="email" autocomplete="username" required value="' + h(loginState.email) + '" /></div>' +
    '<div class="field"><div class="label-row"><label for="login-password">Password</label><button type="button" class="table-link small" data-act="forgot-password">Forgot password?</button></div><input id="login-password" name="password" type="password" autocomplete="current-password" required /></div>' +
    '<label class="check"><input type="checkbox" name="remember" checked /> Keep me signed in on this device</label>' +
    '<button type="submit" class="btn btn-primary login-submit">Sign in</button></form>' +
    '<p class="login-foot">Client users sign in to their own ThryveMS workspace, not this console.</p></div></main>';
  document.getElementById(loginState.error ? "login-password" : "login-email")?.focus();
}
document.addEventListener("submit", (e) => {
  const f = e.target.closest("[data-login]");
  if (!f) return;
  e.preventDefault();
  const email = String(f.email.value || "").trim().toLowerCase();
  loginState = { error: "", info: "", email };
  // UI only: no credential check. A partner email opens that partner's workspace; anything else signs in as the platform owner.
  const acct = ACCOUNTS.find((a) => a.email === email) || ACCOUNTS[0];
  const ui = getUi();
  ui.signedIn = true; ui.email = acct.email; ui.role = acct.role; if (acct.partner) ui.partner = acct.partner;
  saveUi(); loginState = { error: "", info: "", email: "" };
  document.title = "ThryveMS Console";
  location.hash = acct.role === "partner" ? "#/biz" : "#/dev";
  render();
});

function captureFocus() {
  const el = document.activeElement;
  if (!el || !el.id || el === document.body) return null;
  return { id: el.id, start: el.selectionStart, end: el.selectionEnd };
}
function restoreFocus(f, path) {
  if (path !== lastPath) {
    const first = lastPath === null;
    lastPath = path;
    if (!first) document.querySelector("main h1")?.setAttribute("tabindex", "-1"), document.querySelector("main h1")?.focus({ preventScroll: false });
    return;
  }
  if (!f) return;
  const el = document.getElementById(f.id);
  if (!el) return;
  el.focus();
  try { if (f.start != null) el.setSelectionRange(f.start, f.end); } catch (_) { /* not a text input */ }
}

/* ------------------------------------------------------------------ events */

const builtins = {
  close: () => closeOverlay(),
  backdrop: (el, e) => { if (e.target === el) closeOverlay(); },
  discard: () => closeOverlay(true),
  "keep-editing": () => { const w = document.querySelector(".dirty-warning"); if (w) w.hidden = true; document.querySelector(".modal-content input,.modal-content textarea,.modal-content select")?.focus(); },
  "sign-out": () => { const ui = getUi(); ui.signedIn = false; ui.email = ""; saveUi(); closeOverlay(true); loginState = { error: "", info: "You've been signed out.", email: "owner@platform.example" }; renderLogin(); },
  "forgot-password": () => { const v = document.getElementById("login-email")?.value || ""; loginState = { error: "", info: "If an account exists for that email, a reset link will be sent. Ask the platform owner if you don't receive it.", email: v }; renderLogin(); },
  theme: () => { const ui = getUi(); ui.theme = ui.theme === "dark" ? "light" : "dark"; saveUi(); render(); },
  "open-drawer": () => { drawerOpen = true; render(); document.querySelector(".sidebar .nav a")?.focus(); },
  "close-drawer": () => { drawerOpen = false; render(); document.querySelector(".mobile-toggle")?.focus(); },
  "toggle-sidebar": () => { sidebarCollapsed = !sidebarCollapsed; render(); document.querySelector(".sidebar-pin")?.focus(); },
  "tbl-sort": (el) => { const st = getTableState(el.dataset.id); if (st.sort === el.dataset.arg) st.dir = -st.dir; else { st.sort = el.dataset.arg; st.dir = 1; } st.page = 0; render(); },
  "tbl-page": (el) => { const st = getTableState(el.dataset.id); st.page = Math.max(0, st.page + Number(el.dataset.arg)); render(); },
  "retry-load": () => { const ui = getUi(); ui.dataState = "Normal"; saveUi(); render(); },
};
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-act]");
  if (!el || el.disabled) return;
  const act = el.dataset.act;
  const fn = builtins[act] || registry.actions[act];
  if (!fn) return;
  if (act !== "backdrop") e.preventDefault();
  // Double-submit guard: a submit control is disabled while its action runs.
  if (el.hasAttribute("data-submit")) {
    if (el.getAttribute("aria-busy") === "true") return;
    el.setAttribute("aria-busy", "true"); el.disabled = true;
    try { fn(el, e); } finally { if (document.contains(el)) { el.disabled = false; el.removeAttribute("aria-busy"); } }
    return;
  }
  fn(el, e);
});
document.addEventListener("input", (e) => {
  const t = e.target;
  if (t.dataset.tableSearch) { const st = getTableState(t.dataset.tableSearch); st.q = t.value; st.page = 0; render(); return; }
  if (t.dataset.msFilter) {
    const q = t.value.toLowerCase();
    t.closest(".multiselect").querySelectorAll(".ms-item").forEach((li) => { li.hidden = !li.dataset.msLabel.includes(q); });
    return;
  }
  if (t.closest("[data-form]")) markDirty(true);
});
document.addEventListener("change", (e) => {
  const t = e.target;
  const ui = getUi();
  if (t.dataset.tablePer) { const st = getTableState(t.dataset.tablePer); st.per = Number(t.value); st.page = 0; render(); return; }
  if (t.closest("[data-form]")) { markDirty(true); }
  const key = t.dataset.change;
  if (key === "inspect-partner") { ui.inspect = t.value; saveUi(); render(); return; }
  if (key && registry.changes[key]) registry.changes[key](t, e);
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && document.getElementById("dialog-root").innerHTML) { closeOverlay(); return; }
  if (e.key === "Enter" && e.target.closest("[data-form]") && e.target.tagName === "INPUT" && e.target.type !== "checkbox") {
    e.preventDefault();
    document.querySelector(".modal-footer [data-primary]")?.click();
  }
  // Keep keyboard focus inside an open dialog.
  if (e.key === "Tab") {
    const dlg = document.querySelector("#dialog-root [role=dialog]");
    if (!dlg) return;
    const items = [...dlg.querySelectorAll("button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea,a[href]")].filter((x) => !x.closest("[hidden]"));
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
document.addEventListener("submit", (e) => e.preventDefault());
window.addEventListener("hashchange", () => { drawerOpen = false; closeOverlay(true); render(); });
window.addEventListener("keydown", (e) => { if (e.key === "Escape" && drawerOpen) { drawerOpen = false; render(); document.querySelector(".mobile-toggle")?.focus(); } });
registry.render = render;
registry.navigate = navigate;
registry.toast = toast;
render();
