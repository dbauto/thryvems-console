/**
 * Shared helpers. No network access, no secrets. All values are synthetic preview data.
 */
export const TODAY = "2026-10-24";
export const MONTHS = ["2026-07", "2026-08", "2026-09", "2026-10"];
export const CURRENT_MONTH = "2026-10";
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const safe = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** PHP with centavos only when present. null/undefined → "No data" (never 0). */
export function money(n, opts = {}) {
  if (n == null || Number.isNaN(n)) return opts.missing || "No data";
  const neg = n < 0;
  const abs = Math.abs(Math.round(n * 100) / 100);
  const hasCents = Math.round(abs * 100) % 100 !== 0;
  const s = abs.toLocaleString("en-PH", { minimumFractionDigits: hasCents ? 2 : 0, maximumFractionDigits: 2 });
  return (neg ? "−₱" : "₱") + s;
}
export const pct = (n) => (n == null || !Number.isFinite(n) ? "No data" : (Math.round(n * 1000) / 10).toFixed(1) + "%");
export const round2 = (n) => Math.round(n * 100) / 100;
export const sum = (items, fn) => round2(items.reduce((a, x) => a + (Number(typeof fn === "function" ? fn(x) : x[fn]) || 0), 0));

/** "2026-10-04" → "4 Oct 2026" (guidelines §6). */
export function formatDate(iso) {
  if (!iso) return "No data";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m) return "No data";
  return (d ? d + " " : "") + SHORT[m - 1] + " " + y;
}
export function formatDateTime(iso) {
  if (!iso) return "No data";
  const t = iso.length > 10 ? iso.slice(11, 16) : "";
  return formatDate(iso) + (t ? ", " + t : "");
}
export const monthLabel = (ym) => MONTH_NAMES[Number(ym.slice(5, 7)) - 1] + " " + ym.slice(0, 4);
export const monthShort = (ym) => SHORT[Number(ym.slice(5, 7)) - 1] + " " + ym.slice(0, 4);
export function lastDay(ym) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
export function addDays(iso, days) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function daysBetween(a, b) {
  return Math.round((new Date(b + "T00:00:00Z") - new Date(a + "T00:00:00Z")) / 86400000);
}

/** Reporting periods: month, quarter or year. Only months with preview data are included. */
export const PERIODS = [
  ...MONTHS.slice().reverse().map((m) => ({ id: "m:" + m, kind: "Month", label: monthLabel(m), months: [m] })),
  { id: "q:2026-Q4", kind: "Quarter", label: "Q4 2026 (1 October – 31 December 2026)", months: ["2026-10"] },
  { id: "q:2026-Q3", kind: "Quarter", label: "Q3 2026 (1 July – 30 September 2026)", months: ["2026-07", "2026-08", "2026-09"] },
  { id: "y:2026", kind: "Year", label: "2026 (preview data from July)", months: MONTHS.slice() },
];
export const periodById = (id) => PERIODS.find((p) => p.id === id) || PERIODS[0];
export function periodRange(p) {
  const first = p.months[0], last = p.months[p.months.length - 1];
  return "1 " + monthLabel(first) + " – " + lastDay(last) + " " + monthLabel(last);
}

/** Deterministic pseudo-random generator so synthetic data is identical on every load. */
export function prng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const clone = (x) => JSON.parse(JSON.stringify(x));
let counter = 0;
export const uid = (prefix) => prefix + "-" + Date.now().toString(36) + "-" + (counter++).toString(36);
export const isHttps = (s) => /^https:\/\/[^\s/$.?#].[^\s]*$/i.test(String(s || "").trim());
export const slugify = (s) => String(s || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
