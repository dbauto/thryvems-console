/**
 * The one business profit calculation. The Developer and Business Partner workspaces both call
 * report(); there is no second formula. Partner screens only hide details of records belonging to
 * clients outside their assignment; amounts and totals stay identical.
 *
 * Net profit = recognised revenue − recognised expenses ± approved adjustments
 * Recognised = basis Actual and status not Pending. Pending and estimated records are listed separately
 * and never counted unless "include pending" is chosen, which both workspaces apply the same way.
 */
import { CLIENTS, PERIODS, PAYMENTS, SPLIT } from "./data.js";

export const POLICY = {
  basis: "Accrual",
  currency: "PHP",
  id: "FIN-POL-01 v2",
  refunds: "Credits and refunds reduce revenue in the period the credit note is issued.",
  tax: "Amounts exclude VAT. Taxes are not part of profit.",
  fx: "Foreign-currency invoices use the rate on the invoice date, shown on each record.",
  allocation: "Infrastructure and shared business costs are allocated to clients by purchased seats in the period. Operating and unallocated costs stay company-wide.",
};

export const periodOf = (id) => PERIODS.find((p) => p.id === id) || PERIODS[0];
const counted = (r, includePending) => includePending || (r.status !== "Pending" && r.basis === "Actual");

export function recordsFor(ledger, periodId, includePending) {
  const months = periodOf(periodId).months;
  return ledger.filter((r) => months.includes(r.period) && counted(r, includePending));
}
export function pendingFor(ledger, periodId) {
  const months = periodOf(periodId).months;
  return ledger.filter((r) => months.includes(r.period) && !counted(r, false));
}

const total = (rows) => rows.reduce((a, r) => a + r.amount, 0);
const by = (rows, cat) => rows.filter((r) => r.category === cat);

export function report(ledger, periodId, includePending = false) {
  const rows = recordsFor(ledger, periodId, includePending);
  const lines = {
    subscription: total(by(rows, "Subscription")),
    enterprise: total(by(rows, "Enterprise")),
    revenueAdjustments: total(by(rows, "Revenue adjustment")),
    infrastructure: total(by(rows, "Infrastructure")),
    operating: total(by(rows, "Operating")),
    shared: total(by(rows, "Shared business")),
    unallocated: total(by(rows, "Unallocated")),
    adjustments: total(by(rows, "Approved adjustment")),
  };
  const revenue = lines.subscription + lines.enterprise + lines.revenueAdjustments;
  const expenses = lines.infrastructure + lines.operating + lines.shared + lines.unallocated;
  const net = revenue + expenses + lines.adjustments;
  const counts = {};
  for (const r of rows) counts[r.category] = (counts[r.category] || 0) + 1;
  return { periodId, includePending, rows, lines, revenue, expenses, net, margin: revenue ? net / revenue : null, counts, pending: pendingFor(ledger, periodId) };
}

/** Expense categories, with infrastructure split by provider, for the breakdown both roles see. */
export function expenseBreakdown(rep) {
  const groups = new Map();
  for (const r of rep.rows.filter((x) => x.kind === "Expense")) {
    const key = r.category === "Infrastructure" ? r.source : r.category;
    groups.set(key, (groups.get(key) || 0) + -r.amount);
  }
  const sum = [...groups.values()].reduce((a, b) => a + b, 0);
  return [...groups.entries()].map(([name, amount]) => ({ name, amount, share: sum ? amount / sum : 0 })).sort((a, b) => b.amount - a.amount);
}

/** Splits an amount over clients by weight; the last client takes the rounding so it reconciles exactly. */
function allocate(amount, weights) {
  const sum = weights.reduce((a, w) => a + w.weight, 0);
  let left = amount;
  return weights.map((w, i) => {
    const part = i === weights.length - 1 ? left : Math.round((amount * w.weight) / sum);
    left -= part;
    return { client: w.client, amount: part };
  });
}

/** Seats billed per client in each month of the period: the documented allocation basis. */
export function allocationTable(ledger, periodId, includePending = false) {
  const months = periodOf(periodId).months;
  const out = [];
  for (const m of months) {
    const billed = ledger.filter((r) => r.period === m && r.category === "Subscription").map((r) => r.client);
    const weights = CLIENTS.filter((c) => billed.includes(c.id)).map((c) => ({ client: c.id, weight: c.seats }));
    const sources = recordsFor(ledger, m, includePending).filter((r) => r.allocation === "By purchased seats");
    for (const s of sources) for (const part of allocate(s.amount, weights)) out.push({ month: m, ref: s.ref, source: s.source, category: s.category, client: part.client, amount: part.amount, original: s.amount });
  }
  return out;
}

/** Profit by client. Rows plus the company-wide row add up to the same net profit as report(). */
export function profitByClient(ledger, periodId, includePending = false) {
  const rows = recordsFor(ledger, periodId, includePending);
  const alloc = allocationTable(ledger, periodId, includePending);
  const res = CLIENTS.map((c) => {
    const revenue = total(rows.filter((r) => r.client === c.id));
    const costs = alloc.filter((a) => a.client === c.id).reduce((a, x) => a + x.amount, 0);
    return { client: c.id, revenue, costs, profit: revenue + costs };
  }).filter((r) => r.revenue || r.costs);
  const companyWide = total(rows.filter((r) => !r.client && r.allocation !== "By purchased seats"));
  return { rows: res, companyWide };
}

/** Distribution per month, with what has been paid and what is pending. */
export function distributionFor(ledger, periodId, includePending = false) {
  const months = periodOf(periodId).months;
  let net = 0, developer = 0, partners = 0, paidDev = 0, paidPartners = 0;
  const perMonth = months.map((m) => {
    const r = report(ledger, m, includePending);
    // a loss is not distributed; it shows as no distribution for that month
    const dev = r.net > 0 ? Math.round(r.net * SPLIT.developer) : 0;
    const par = r.net > 0 ? r.net - dev : 0;
    const pay = PAYMENTS[m] || {};
    const pd = pay.developer === "all" ? dev : Number(pay.developer) || 0;
    const pp = pay.partners === "all" ? par : Number(pay.partners) || 0;
    net += r.net; developer += dev; partners += par; paidDev += pd; paidPartners += pp;
    return { month: m, net: r.net, developer: dev, partners: par, paidDev: pd, paidPartners: pp };
  });
  return { net, adjustments: 0, developer, partners, paidDev, paidPartners, pendingDev: developer - paidDev, pendingPartners: partners - paidPartners, perMonth };
}
