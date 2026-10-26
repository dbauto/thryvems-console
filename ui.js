/** Shared building blocks: icons (Lucide), formatting, status badges, cards and the ThryveMS table. */

/* Lucide icon paths (lucide.dev), 24px grid, 2px stroke. */
const P = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  building: '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>',
  server: '<rect width="20" height="8" x="2" y="2" rx="2"/><rect width="20" height="8" x="2" y="14" rx="2"/><path d="M6 6h.01"/><path d="M6 18h.01"/>',
  rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
  wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>',
  timer: '<path d="M10 2h4"/><path d="m12 14 3-3"/><circle cx="12" cy="14" r="8"/>',
  lifebuoy: '<circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/><circle cx="12" cy="12" r="4"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  sliders: '<path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  panel: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  flask: '<path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"/><path d="M8.5 2h7"/><path d="M7 16h10"/>',
  activity: '<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  archive: '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  menu: '<path d="M4 12h16"/><path d="M4 6h16"/><path d="M4 18h16"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',
  briefcase: '<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/>',
  refresh: '<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/>',
  trending: '<path d="M22 7 13.5 15.5 8.5 10.5 2 17"/><path d="M16 7h6v6"/>',
  pie: '<path d="M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z"/><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/>',
  sort: '<path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/>',
  more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  compare: '<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><path d="M11 18H8a2 2 0 0 1-2-2V9"/>',
  calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
  key: '<path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".5"/>',
  eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
};
export const icon = (name, cls) => '<svg class="i' + (cls ? " " + cls : "") + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (P[name] || P.info) + "</svg>";

export const safe = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** 26 Oct 2026; keeps a trailing time. Missing → No data. */
export function date(v) {
  if (!v) return "No data";
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?(.*)$/.exec(v);
  if (!m) return v;
  return (m[3] ? Number(m[3]) + " " : "") + MON[Number(m[2]) - 1] + " " + m[1] + (m[4] ? " " + m[4].trim() : "");
}
/** ₱1,234 and −₱1,234. Missing → No data, never an invented zero. */
export function money(n) {
  if (n == null || Number.isNaN(n)) return "No data";
  const s = "₱" + Math.abs(Math.round(n)).toLocaleString("en-PH");
  return n < 0 ? "−" + s : s;
}
export const pct = (n) => (n == null ? "No data" : (n * 100).toFixed(1) + "%");

const TONES = {
  done: ["Active", "Live", "Healthy", "Released", "Paid", "Approved", "Succeeded", "Done", "Actual", "Reconciled", "Passed", "Closed", "Current", "Ended", "Granted"],
  soon: ["Waiting", "Awaiting provisioning", "Backup late", "Pending", "Estimate", "Outstanding", "Late", "In review", "Waiting for approval", "Proposed", "Waiting on client", "Behind", "Ready for review", "Open", "Draft, price not set", "Not set"],
  overdue: ["Failed", "Deploy failed", "Suspended", "Error", "High", "Declined", "Rolled back"],
  progress: ["Testing", "Provisioning", "In progress", "Trial", "Created", "Early access", "In sandbox SB-014", "Info", "Simulated"],
};
export function tone(label) {
  for (const [t, list] of Object.entries(TONES)) if (list.includes(label)) return t;
  return "draft";
}
export const pill = (label, t) => '<span class="pill ' + (t || tone(label)) + '">' + safe(label) + "</span>";

export function header({ crumbs, title, desc, actions, badge }) {
  const bc = crumbs && crumbs.length ? '<nav class="breadcrumb" aria-label="Breadcrumb">' + crumbs.map(([l, h]) => (h ? '<a href="' + h + '">' + safe(l) + "</a>" : '<span aria-current="page">' + safe(l) + "</span>")).join('<span aria-hidden="true">/</span>') + "</nav>" : "";
  return '<section class="page-header"><div class="page-title">' + bc + '<div class="title-row"><h1>' + safe(title) + "</h1>" + (badge || "") + "</div>" + (desc ? "<p>" + safe(desc) + "</p>" : "") + "</div>" + (actions ? '<div class="page-actions">' + actions + "</div>" : "") + "</section>";
}

/** Card style B: icon tile, status badge, primary figure and supporting label. */
export function kpi({ ic, badge, badgeTone, value, label, href }) {
  const inner = '<span class="kpi-top"><span class="tile">' + icon(ic) + "</span>" + (badge ? pill(badge, badgeTone) : "") + '</span><span class="kpi-value">' + safe(value) + '</span><span class="kpi-label">' + safe(label) + "</span>";
  return href ? '<a class="card kpi" href="' + href + '">' + inner + "</a>" : '<div class="card kpi">' + inner + "</div>";
}

export const button = (text, act, opts = {}) =>
  '<button type="button" class="btn ' + (opts.cls || "") + '" data-act="' + act + '"' + (opts.id != null ? ' data-id="' + safe(opts.id) + '"' : "") + (opts.disabled ? ' disabled title="' + safe(opts.why || "Not available in this preview") + '"' : "") + (opts.label ? ' aria-label="' + safe(opts.label) + '"' : "") + ">" + (opts.ic ? icon(opts.ic) : "") + safe(text) + "</button>";

export const note = (kind, html) => '<div class="note ' + kind + '" role="note">' + icon(kind === "warn" ? "alert" : kind === "ok" ? "check" : "info") + "<div>" + html + "</div></div>";

export const facts = (list) => '<dl class="facts">' + list.map(([k, v]) => "<dt>" + safe(k) + "</dt><dd>" + (v == null || v === "" ? '<span class="muted">No data</span>' : v) + "</dd>").join("") + "</dl>";

export function tabs(key, list, current) {
  return '<div class="tabs" role="tablist" aria-label="Sections">' + list.map(([id, label]) => '<button type="button" role="tab" class="tab' + (id === current ? " on" : "") + '" aria-selected="' + (id === current) + '" data-act="tab" data-key="' + safe(key) + '" data-id="' + safe(id) + '">' + safe(label) + "</button>").join("") + "</div>";
}

export const card = (title, body, extra) => '<section class="card"><div class="card-head"><h2>' + safe(title) + "</h2>" + (extra || "") + "</div>" + body + "</section>";

/* ---------- ThryveMS table: search, filters, sorting, 10/50/100 rows, internal scroll, footer ---------- */

export const TABLES = {};
export const tableState = {};

/**
 * cols: { label, value(row) → text used to search and sort, html(row) → cell, num }
 * opts: { filters: [{ id, label, options, value(row) }], empty: [title, body], initial: { filterId: value }, search: placeholder }
 */
export function dataTable(key, cols, rows, opts = {}) {
  TABLES[key] = { cols, rows, opts };
  const st = (tableState[key] ||= { q: "", sort: null, dir: 1, page: 1, size: 10, f: {} });
  if (opts.initial) for (const [k, v] of Object.entries(opts.initial)) if (st.f[k] === undefined) st.f[k] = v;
  const filters = (opts.filters || []).map((f) => '<label class="tf"><span>' + safe(f.label) + '</span><select data-filter="' + safe(key) + '" data-fid="' + safe(f.id) + '"><option value="">All</option>' + f.options.map((o) => '<option' + (st.f[f.id] === o ? " selected" : "") + ">" + safe(o) + "</option>").join("") + "</select></label>").join("");
  const toolbar = opts.search === false ? "" : '<div class="tbl-toolbar"><label class="search">' + icon("search") + '<input type="search" data-search="' + safe(key) + '" value="' + safe(st.q) + '" placeholder="' + safe(opts.search || "Search") + '" aria-label="' + safe(opts.search || "Search") + '" /></label>' + filters + "</div>";
  return '<section class="card table-card">' + (opts.title ? '<div class="card-head"><h2>' + safe(opts.title) + "</h2>" + (opts.extra || "") + "</div>" : "") + toolbar + '<div data-tbody="' + safe(key) + '">' + tableBody(key) + "</div></section>";
}

export function tableBody(key) {
  const { cols, rows, opts } = TABLES[key];
  const st = tableState[key];
  let list = rows.slice();
  const q = st.q.trim().toLowerCase();
  if (q) list = list.filter((r) => cols.some((c) => String(c.value ? c.value(r) : "").toLowerCase().includes(q)));
  for (const f of opts.filters || []) if (st.f[f.id]) list = list.filter((r) => [].concat(f.value(r)).includes(st.f[f.id]));
  if (st.sort != null && cols[st.sort]) {
    const c = cols[st.sort];
    list.sort((a, b) => {
      const x = c.sortValue ? c.sortValue(a) : c.value(a), y = c.sortValue ? c.sortValue(b) : c.value(b);
      return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * st.dir;
    });
  }
  const pages = Math.max(1, Math.ceil(list.length / st.size));
  if (st.page > pages) st.page = pages;
  const start = (st.page - 1) * st.size;
  const shown = list.slice(start, start + st.size);
  const head = cols.map((c, i) => {
    const sorted = st.sort === i;
    const aria = sorted ? (st.dir === 1 ? "ascending" : "descending") : "none";
    return '<th scope="col" aria-sort="' + aria + '"' + (c.num ? ' class="num"' : "") + ">" + (c.sort === false ? safe(c.label) : '<button type="button" class="th-btn" data-act="sort" data-key="' + safe(key) + '" data-id="' + i + '">' + safe(c.label) + icon("sort", "sm") + "</button>") + "</th>";
  }).join("");
  const body = shown.length ? shown.map((r) => "<tr>" + cols.map((c) => "<td" + (c.num ? ' class="num"' : "") + ">" + (c.html ? c.html(r) : safe(c.value(r))) + "</td>").join("") + "</tr>").join("")
    : '<tr><td colspan="' + cols.length + '"><div class="empty"><strong>' + safe((opts.empty || [])[0] || "Nothing here yet") + "</strong>" + safe((opts.empty || [])[1] || (q || Object.values(st.f).some(Boolean) ? "No records match. Clear the search or filters." : "Records appear here.")) + "</div></td></tr>";
  const from = list.length ? start + 1 : 0, to = start + shown.length;
  return '<div class="tbl-scroll"><table class="data-table"><thead><tr>' + head + "</tr></thead><tbody>" + body + "</tbody></table></div>" +
    '<div class="tbl-foot"><label class="rows">Rows per page <select data-size="' + safe(key) + '" aria-label="Rows per page">' + [10, 50, 100].map((n) => "<option" + (st.size === n ? " selected" : "") + ">" + n + "</option>").join("") + "</select></label>" +
    "<span>" + from + "–" + to + " of " + list.length + (opts.footNote ? " · " + safe(opts.footNote) : "") + "</span>" +
    '<span class="pager"><button type="button" class="btn btn-small" data-act="page" data-key="' + safe(key) + '" data-id="-1"' + (st.page <= 1 ? " disabled" : "") + ">" + icon("chevronLeft") + "Previous</button><span>Page " + st.page + " of " + pages + '</span><button type="button" class="btn btn-small" data-act="page" data-key="' + safe(key) + '" data-id="1"' + (st.page >= pages ? " disabled" : "") + ">Next" + icon("chevronRight") + "</button></span></div>";
}

export function refreshTable(key) {
  const el = document.querySelector('[data-tbody="' + CSS.escape(key) + '"]');
  if (el && TABLES[key]) el.innerHTML = tableBody(key);
}

export function exportCsv(name, rows) {
  const csv = rows.map((r) => r.map((v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"').join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
