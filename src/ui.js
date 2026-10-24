/**
 * UI building blocks matching the ThryveMS client app (UI-GUIDELINES §2):
 * PageHeader, FigureGrid (max 4), DataTable (10 rows in view, internal scroll, 10/50/100 footer),
 * ViewChips, Badge, KeyFacts, LifecycleTrack, Alert, EmptyState, Sheet, Dialog, toast.
 */
import { safe, money } from "./util.js";

export const h = safe;

/* ------------------------------------------------------------------ badges */

const TONES = {
  done: ["Live", "Healthy", "Active", "Paid", "Passed", "Verified", "Approved", "Released", "Completed", "Done", "Approved for release", "Reconciled", "Ended", "Simulation passed", "Published", "Connected"],
  progress: ["Testing", "Provisioning", "In progress", "In testing", "Investigating", "Fix in sandbox", "Ready", "Scoping", "Requested", "Approved (not executed)", "Trial", "Issued", "Partly paid", "Running"],
  soon: ["Warning", "Awaiting provisioning", "Ready for review", "Waiting for approval", "Pending", "Awaiting approval", "Estimate", "Past due", "Retrying", "New", "Incomplete", "Draft", "On hold", "Scheduled", "Manual"],
  overdue: ["Down", "Failed", "Provisioning failed", "Overdue", "Failing", "Error", "Declined", "Simulation failed"],
};
export function toneFor(value) {
  for (const [tone, list] of Object.entries(TONES)) if (list.includes(value)) return tone;
  return "draft";
}
export const badge = (text, tone) => '<span class="pill ' + (tone || toneFor(text)) + '">' + h(text) + "</span>";
export const simBadge = () => badge("Simulation", "draft");
export const sampleBadge = () => badge("Sample data", "draft");

/* ------------------------------------------------------------------ layout */

export function pageHeader({ title, description, crumbs, actions }) {
  return '<section class="page-header"><div>' +
    (crumbs && crumbs.length ? '<nav class="breadcrumb" aria-label="Breadcrumb">' + crumbs.map((c) => (c.href ? '<a href="' + h(c.href) + '">' + h(c.label) + "</a>" : "<span>" + h(c.label) + "</span>")).join(' <span aria-hidden="true">›</span> ') + "</nav>" : "") +
    "<h1>" + h(title) + "</h1>" + (description ? "<p>" + description + "</p>" : "") + "</div>" +
    (actions ? '<div class="inline-actions">' + actions + "</div>" : "") + "</section>";
}

/** Card style B: icon tile, status badge, big value, small label. Links when href is given. */
export function figure({ label, value, badge: b, tone, icon, href, note, testid }) {
  const inner = '<div class="metric-top"><span class="metric-icon" aria-hidden="true">' + h(icon || "▦") + "</span>" + (b ? badge(b, tone) : "") + "</div>" +
    "<div><strong>" + h(value) + '</strong><div class="metric-label">' + h(label) + "</div>" + (note ? '<div class="metric-note">' + h(note) + "</div>" : "") + "</div>";
  const tid = testid ? ' data-testid="' + h(testid) + '"' : "";
  return href ? '<a class="metric metric-link" href="' + h(href) + '"' + tid + ">" + inner + "</a>" : '<article class="metric"' + tid + ">" + inner + "</article>";
}
export const figureGrid = (cards, label) => '<section class="metrics" aria-label="' + h(label || "Figures") + '">' + cards.slice(0, 4).join("") + "</section>";

export function card({ title, note, action, body, id }) {
  return '<article class="card"' + (id ? ' id="' + h(id) + '"' : "") + '><div class="card-head"><div><h2>' + h(title) + "</h2>" + (note ? "<p>" + note + "</p>" : "") + "</div>" + (action || "") + "</div>" + body + "</article>";
}
export const row = (primary, secondary, right) => '<div class="rule-row"><div class="rule-main"><div class="row-primary">' + primary + "</div>" + (secondary ? '<div class="secondary">' + secondary + "</div>" : "") + "</div>" + (right ? '<div class="rule-side">' + right + "</div>" : "") + "</div>";

/** Short list inside a card: 4 rows in view, then scrolls, with a footer. */
export function scrollList(rows, empty, footer) {
  return (rows.length ? '<div class="scroll-list" tabindex="0">' + rows.join("") + "</div>" : emptyLine(empty?.title || "Nothing here yet", empty?.body || "")) +
    (footer ? '<div class="table-footer">' + footer + "</div>" : "");
}

export function keyFacts(pairs) {
  return '<div class="detail-grid">' + pairs.filter(Boolean).map(([k, v]) => '<div class="fact"><span class="fact-label">' + h(k) + "</span><strong>" + (v == null || v === "" ? '<span class="muted">No data</span>' : v) + "</strong></div>").join("") + "</div>";
}

export function viewChips(items, active, hrefFor, label) {
  return '<nav class="view-chips" aria-label="' + h(label || "Views") + '">' + items.map((it) =>
    '<a href="' + h(hrefFor(it.id)) + '"' + (it.id === active ? ' aria-current="page" class="active"' : "") + ">" + h(it.label) + (it.count != null ? ' <span class="chip-count">' + h(it.count) + "</span>" : "") + "</a>").join("") + "</nav>";
}

/** Progress of a record. failed: index of the failed stage (optional). */
export function lifecycleTrack(stages, current, failed) {
  return '<ol class="track" aria-label="Lifecycle">' + stages.map((s, i) => {
    const state = failed === i ? "failed" : i < current ? "done" : i === current ? "current" : "todo";
    const word = { failed: "Failed", done: "Done", current: "Current", todo: "Not started" }[state];
    return '<li class="track-step ' + state + '"' + (state === "current" ? ' aria-current="step"' : "") + '><span class="track-dot" aria-hidden="true"></span><span class="track-label">' + h(s) + '</span><span class="sr-only"> — ' + word + "</span></li>";
  }).join("") + "</ol>";
}

export const alertBox = (tone, html, role) => '<div class="alert alert-' + (tone || "info") + '" role="' + (role || "note") + '">' + html + "</div>";
export const emptyLine = (title, body) => '<div class="empty"><strong>' + h(title) + "</strong>" + h(body || "") + "</div>";
export function emptyState(title, body, action) {
  return '<section class="card empty-state"><div class="empty"><strong>' + h(title) + "</strong>" + h(body) + (action ? '<div class="empty-action">' + action + "</div>" : "") + "</div></section>";
}
export function loadingState(label) {
  return '<div class="loading" role="status" aria-live="polite"><span class="sr-only">' + h(label || "Loading") + '</span><div class="skeleton skeleton-title"></div><div class="metrics">' + '<div class="skeleton skeleton-card"></div>'.repeat(4) + '</div><div class="skeleton skeleton-table"></div></div>';
}
export function errorState(title, body) {
  return '<section class="card" role="alert"><div class="empty"><strong>' + h(title) + "</strong>" + h(body) + '<div class="empty-action"><button type="button" class="btn btn-small" data-act="retry-load">Try again</button></div></div></section>';
}

/* ------------------------------------------------------------------ buttons */

export function button(text, act, opts = {}) {
  const attrs = [
    'type="' + (opts.type || "button") + '"',
    'class="btn ' + (opts.cls || "") + '"',
    act ? 'data-act="' + h(act) + '"' : "",
    opts.id != null ? 'data-id="' + h(opts.id) + '"' : "",
    opts.arg != null ? 'data-arg="' + h(opts.arg) + '"' : "",
    opts.disabled ? "disabled" : "",
    opts.disabledReason ? 'aria-describedby="' + h(opts.describe || "") + '" title="' + h(opts.disabledReason) + '"' : "",
    opts.label ? 'aria-label="' + h(opts.label) + '"' : "",
    opts.testid ? 'data-testid="' + h(opts.testid) + '"' : "",
    opts.submit ? "data-submit" : "",
    opts.primary ? "data-primary" : "",
  ].filter(Boolean).join(" ");
  return "<button " + attrs + ">" + h(text) + "</button>";
}
/** A control that is unavailable in the preview, with a visible reason (not a toast). */
export function unavailable(text, reason) {
  return '<span class="unavailable"><button type="button" class="btn btn-small" disabled aria-disabled="true">' + h(text) + '</button><span class="tiny muted">' + h(reason) + "</span></span>";
}
export const linkTo = (label, href, opts = {}) => '<a class="table-link" href="' + h(href) + '"' + (opts.newTab ? ' target="_blank" rel="noopener" aria-label="' + h(label) + ' (opens in a new tab)"' : "") + ">" + h(label) + (opts.newTab ? ' <span aria-hidden="true">↗</span>' : "") + "</a>";

/* ------------------------------------------------------------------- forms */

export function field(label, control, hint, id) {
  return '<div class="field"><label' + (id ? ' for="' + h(id) + '"' : "") + ">" + h(label) + "</label>" + control + (hint ? '<small id="' + h((id || "f") + "-hint") + '">' + h(hint) + "</small>" : "") + "</div>";
}
export function input(label, id, value, opts = {}) {
  const ctl = '<input id="' + h(id) + '" name="' + h(id) + '" type="' + h(opts.type || "text") + '" value="' + h(value ?? "") + '"' +
    (opts.min != null ? ' min="' + h(opts.min) + '"' : "") + (opts.max != null ? ' max="' + h(opts.max) + '"' : "") + (opts.step != null ? ' step="' + h(opts.step) + '"' : "") +
    (opts.list ? ' list="' + h(opts.list) + '" autocomplete="off"' : "") + (opts.required ? " required" : "") + (opts.disabled ? " disabled" : "") +
    (opts.placeholder ? ' placeholder="' + h(opts.placeholder) + '"' : "") + (opts.hint ? ' aria-describedby="' + h(id) + '-hint"' : "") + (opts.inputmode ? ' inputmode="' + h(opts.inputmode) + '"' : "") + " />";
  return field(label, ctl, opts.hint, id);
}
export function textarea(label, id, value, opts = {}) {
  return field(label, '<textarea id="' + h(id) + '" name="' + h(id) + '" rows="' + (opts.rows || 3) + '"' + (opts.hint ? ' aria-describedby="' + h(id) + '-hint"' : "") + ">" + h(value || "") + "</textarea>", opts.hint, id);
}
export function select(label, id, value, options, opts = {}) {
  const ctl = '<select id="' + h(id) + '" name="' + h(id) + '"' + (opts.hint ? ' aria-describedby="' + h(id) + '-hint"' : "") + (opts.disabled ? " disabled" : "") + ">" +
    (opts.placeholder ? '<option value="">' + h(opts.placeholder) + "</option>" : "") +
    options.map((o) => { const v = typeof o === "string" ? o : o.value; const l = typeof o === "string" ? o : o.label; return '<option value="' + h(v) + '"' + (String(v) === String(value) ? " selected" : "") + ">" + h(l) + "</option>"; }).join("") + "</select>";
  return field(label, ctl, opts.hint, id);
}
/** Searchable dropdown: type a keyword, matching options are suggested; the value is validated on save. */
export function combobox(label, id, value, options, opts = {}) {
  const list = id + "-options";
  return input(label, id, value, { ...opts, list }) + '<datalist id="' + h(list) + '">' + options.map((o) => '<option value="' + h(o) + '"></option>').join("") + "</datalist>";
}
/** Searchable multiselect: a filter box above a checkbox list. */
export function multiselect(label, id, options, selected, opts = {}) {
  return '<fieldset class="field multiselect" data-ms="' + h(id) + '"><legend>' + h(label) + "</legend>" +
    '<input type="search" class="ms-filter" aria-label="Filter ' + h(label.toLowerCase()) + '" placeholder="Type to filter" data-ms-filter="' + h(id) + '" />' +
    '<div class="ms-list">' + options.map((o) => {
      const v = typeof o === "string" ? o : o.value, l = typeof o === "string" ? o : o.label, locked = opts.locked && opts.locked.includes(v);
      return '<label class="ms-item" data-ms-label="' + h(String(l).toLowerCase()) + '"><input type="checkbox" name="' + h(id) + '" value="' + h(v) + '"' + (selected.includes(v) ? " checked" : "") + (locked ? " disabled" : "") + " /> " + h(l) + (locked ? ' <span class="tiny muted">(always on)</span>' : "") + "</label>";
    }).join("") + "</div>" + (opts.hint ? "<small>" + h(opts.hint) + "</small>" : "") + "</fieldset>";
}
export const formError = (id) => '<p class="form-error" id="' + h(id || "form-error") + '" role="alert"></p>';
export function readForm(root) {
  const out = {};
  root.querySelectorAll("input,select,textarea").forEach((el) => {
    if (!el.name || el.classList.contains("ms-filter")) return;
    if (el.type === "checkbox") { if (!out[el.name]) out[el.name] = []; if (el.checked) out[el.name].push(el.value); return; }
    if (el.type === "radio") { if (el.checked) out[el.name] = el.value; return; }
    out[el.name] = el.value;
  });
  return out;
}

/* --------------------------------------------------------------- data table */

const tableState = new Map();
export const getTableState = (id) => {
  if (!tableState.has(id)) tableState.set(id, { q: "", sort: null, dir: 1, page: 0, per: 10 });
  return tableState.get(id);
};
export const resetTables = () => tableState.clear();

/**
 * columns: [{ key, label, cell(row) → html, sort?(row) → comparable, className? }]
 * opts: { id, rows, search?(row) → text, searchLabel, toolbar html, empty {title, body}, minWidth, caption }
 */
export function dataTable(opts) {
  const st = getTableState(opts.id);
  let rows = opts.rows;
  if (opts.search && st.q) {
    const q = st.q.toLowerCase();
    rows = rows.filter((r) => opts.search(r).toLowerCase().includes(q));
  }
  const col = opts.columns.find((c) => c.key === st.sort && c.sort);
  if (col) rows = rows.slice().sort((a, b) => { const x = col.sort(a), y = col.sort(b); return (x > y ? 1 : x < y ? -1 : 0) * st.dir; });
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / st.per));
  if (st.page >= pages) st.page = pages - 1;
  const view = rows.slice(st.page * st.per, st.page * st.per + st.per);
  const head = opts.columns.map((c) => {
    if (!c.sort) return '<th scope="col"' + (c.className ? ' class="' + c.className + '"' : "") + ">" + (c.srOnly ? '<span class="sr-only">' + h(c.label) + "</span>" : h(c.label)) + "</th>";
    const on = st.sort === c.key;
    const aria = on ? (st.dir === 1 ? "ascending" : "descending") : "none";
    return '<th scope="col" aria-sort="' + aria + '"><button type="button" class="th-sort" data-act="tbl-sort" data-id="' + h(opts.id) + '" data-arg="' + h(c.key) + '">' + h(c.label) + '<span aria-hidden="true" class="sort-ind">' + (on ? (st.dir === 1 ? " ▲" : " ▼") : " ↕") + "</span></button></th>";
  }).join("");
  const body = view.length ? view.map((r) => "<tr>" + opts.columns.map((c) => "<td" + (c.className ? ' class="' + c.className + '"' : "") + ">" + c.cell(r) + "</td>").join("") + "</tr>").join("")
    : '<tr><td colspan="' + opts.columns.length + '">' + emptyLine(st.q ? "No matching records" : (opts.empty?.title || "No records"), st.q ? "Try another search term or clear the search." : (opts.empty?.body || "")) + "</td></tr>";
  const search = opts.search ? '<div class="field table-search"><label for="' + h(opts.id) + '-q">' + h(opts.searchLabel || "Search") + '</label><input id="' + h(opts.id) + '-q" type="search" data-table-search="' + h(opts.id) + '" value="' + h(st.q) + '" placeholder="Type to search" /></div>' : "";
  const from = total ? st.page * st.per + 1 : 0, to = Math.min(total, (st.page + 1) * st.per);
  return '<div class="card data-card" data-table="' + h(opts.id) + '">' +
    ((search || opts.toolbar) ? '<div class="table-toolbar">' + search + (opts.toolbar || "") + "</div>" : "") +
    '<div class="table-scroll" tabindex="0" role="region" aria-label="' + h(opts.caption || opts.id) + '"><table class="data-table" style="min-width:' + (opts.minWidth || 720) + 'px"><caption class="sr-only">' + h(opts.caption || "") + "</caption><thead><tr>" + head + "</tr></thead><tbody>" + body + "</tbody></table></div>" +
    '<div class="table-footer"><span data-testid="' + h(opts.id) + '-count">' + (total ? from + "–" + to + " of " + total + " record" + (total === 1 ? "" : "s") : "0 records") + "</span>" +
    '<span class="pager"><label class="tiny" for="' + h(opts.id) + '-per">Rows per page</label> <select id="' + h(opts.id) + '-per" data-table-per="' + h(opts.id) + '">' + [10, 50, 100].map((n) => '<option value="' + n + '"' + (n === st.per ? " selected" : "") + ">" + n + "</option>").join("") + "</select>" +
    ' <button type="button" class="btn btn-small btn-quiet" data-act="tbl-page" data-id="' + h(opts.id) + '" data-arg="-1"' + (st.page === 0 ? " disabled" : "") + ' aria-label="Previous page">‹</button>' +
    '<span class="tiny">Page ' + (st.page + 1) + " of " + pages + "</span>" +
    '<button type="button" class="btn btn-small btn-quiet" data-act="tbl-page" data-id="' + h(opts.id) + '" data-arg="1"' + (st.page >= pages - 1 ? " disabled" : "") + ' aria-label="Next page">›</button></span></div></div>';
}

/* ----------------------------------------------------------- sheets/dialogs */

let lastFocus = null;
let dirty = false;
export const markDirty = (v = true) => { dirty = v; };
export const isDirty = () => dirty;
function overlay(kind, { title, description, body, footer, wide }) {
  lastFocus = document.activeElement;
  dirty = false;
  const root = document.getElementById("dialog-root");
  root.innerHTML = '<div class="modal-backdrop ' + kind + '-backdrop" data-act="backdrop"><section class="' + kind + (wide ? " wide" : "") + '" role="dialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="dialog-desc">' +
    '<div class="modal-header"><div><h2 id="dialog-title">' + h(title) + '</h2><p id="dialog-desc">' + (description || "") + '</p></div><button type="button" class="btn btn-quiet btn-small" data-act="close" aria-label="Close">✕</button></div>' +
    '<form class="modal-content" data-form novalidate>' + body + '<div class="dirty-warning" hidden role="alert">You have unsaved changes. <button type="button" class="btn btn-small btn-danger" data-act="discard">Discard changes</button> <button type="button" class="btn btn-small" data-act="keep-editing">Keep editing</button></div></form>' +
    '<div class="modal-footer">' + (footer || button("Close", "close")) + "</div></section></div>";
  const first = root.querySelector(".modal-content input:not([disabled]):not(.ms-filter),.modal-content select,.modal-content textarea,.modal-footer button:not([disabled])");
  (first || root.querySelector("[data-act=close]"))?.focus();
}
export const sheet = (o) => overlay("sheet", o);
export const dialog = (o) => overlay("modal", o);
export function closeOverlay(force) {
  const root = document.getElementById("dialog-root");
  if (!root.innerHTML) return true;
  if (dirty && !force) {
    const w = root.querySelector(".dirty-warning");
    if (w) { w.hidden = false; w.querySelector("[data-act=discard]")?.focus(); }
    return false;
  }
  root.innerHTML = "";
  dirty = false;
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  return true;
}
export function showFormError(message, id) {
  const el = document.getElementById(id || "form-error");
  if (el) { el.textContent = message; el.focus?.(); }
}

/* ------------------------------------------------------------------- toasts */

/** Confirmation after a real preview change. The text repeats what actually happened. */
export function toast(message) {
  const region = document.getElementById("toast-region");
  if (!region) return;
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  region.appendChild(el);
  setTimeout(() => el.remove(), 4500);
}

/* -------------------------------------------------------------- formatting */

export const moneyCell = (n, opts) => '<span class="num">' + h(money(n, opts)) + "</span>";
export const basisBadge = (basis) => badge(basis, basis === "Reconciled" ? "done" : basis === "Estimate" ? "soon" : basis === "Not available" ? "overdue" : "draft");
export function svgBars(series, { label, format }) {
  const max = Math.max(1, ...series.flatMap((s) => s.values.map((v) => v.value || 0)));
  const W = 560, H = 180, pad = 28, groups = series[0].values.length, gw = (W - pad * 2) / groups, bw = Math.min(28, (gw - 12) / series.length);
  let bars = "";
  series[0].values.forEach((v, gi) => {
    series.forEach((s, si) => {
      const val = s.values[gi].value || 0;
      const bh = Math.round((val / max) * (H - 50));
      const x = pad + gi * gw + (gw - bw * series.length) / 2 + si * bw;
      bars += '<rect class="bar bar-' + si + '" x="' + x.toFixed(1) + '" y="' + (H - 24 - bh) + '" width="' + (bw - 2).toFixed(1) + '" height="' + bh + '"><title>' + h(s.name + ", " + v.label + ": " + format(val)) + "</title></rect>";
    });
    bars += '<text class="axis" x="' + (pad + gi * gw + gw / 2).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">' + h(v.label) + "</text>";
  });
  const legend = series.map((s, si) => '<span class="legend-item"><span class="legend-swatch bar-' + si + '" aria-hidden="true"></span>' + h(s.name) + "</span>").join("");
  const table = '<div class="sr-only"><table><caption>' + h(label) + "</caption><thead><tr><th>Month</th>" + series.map((s) => "<th>" + h(s.name) + "</th>").join("") + "</tr></thead><tbody>" +
    series[0].values.map((v, gi) => "<tr><td>" + h(v.label) + "</td>" + series.map((s) => "<td>" + h(format(s.values[gi].value)) + "</td>").join("") + "</tr>").join("") + "</tbody></table></div>";
  return '<figure class="chart"><svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + h(label) + '" preserveAspectRatio="xMidYMid meet">' + '<line class="axis-line" x1="' + pad + '" x2="' + (W - pad) + '" y1="' + (H - 24) + '" y2="' + (H - 24) + '"></line>' + bars + "</svg><figcaption class=\"legend\">" + legend + "</figcaption>" + table + "</figure>";
}
