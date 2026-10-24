/**
 * Financial calculations for the preview. Pure functions over synthetic records.
 *
 * Two separate bases, never presented as the same figure:
 *  - Actual operating profit (Developer only)
 *      = recognised revenue − direct actual costs − shared actual costs − unallocated actual costs − other operating expenses
 *  - Reported profit (commercial basis, shown to partners for their assigned clients)
 *      = recognised revenue − allocated service expenses
 *  - Distributable profit (profit-sharing pool, per month)
 *      = recognised revenue (all clients) − allocated service expenses (all clients)
 *        − recognised shared business expenses + adjustments
 *    Developer 30%, business partners combined 70%. Individual partner shares are not defined.
 *
 * Revenue is recognised by service month, net of VAT and discounts (approved plan, decision 7).
 * Missing actual cost data is "Not available" and marks totals "Incomplete"; it is never counted as 0.
 */
import { round2, sum, TODAY } from "./util.js";
import { subscriptionCharge, seatsAt } from "./seed.js";

export const DEVELOPER_SHARE = 0.3;
export const PARTNER_SHARE = 0.7;

const inMonths = (months) => (m) => months.includes(m);

/** Live in a month: a deployment existed and the subscription had started. Drives costs and allocations. */
export function liveInMonth(client, month) {
  if (!["Live", "Suspended"].includes(client.accountStatus)) return false;
  return client.subscription.startDate.slice(0, 7) <= month;
}
export const activeUsersAt = (client) => Number(client.subscription.activeUsers) || 0;

/* ---------------------------------------------------------------- invoices */

export function invoiceTotals(data, inv) {
  const net = sum(inv.lines, "net");
  const vat = round2(net * inv.vatRate);
  const gross = round2(net + vat);
  const paid = sum(data.payments.filter((p) => p.invoiceId === inv.id), "amount");
  const outstanding = inv.voided ? 0 : round2(gross - paid);
  let status = "Issued";
  if (inv.voided) status = "Void";
  else if (outstanding <= 0.004) status = "Paid";
  else if (paid > 0) status = inv.dueDate < TODAY ? "Overdue" : "Partly paid";
  else if (inv.dueDate < TODAY) status = "Overdue";
  return { net, vat, gross, paid, outstanding, status };
}

/* ----------------------------------------------------------------- revenue */

/** Recognised revenue per client for the months given. Returns Map clientId → {subscription, enterprise, adjustments, total}. */
export function revenueByClient(data, months) {
  const out = new Map();
  const row = (id) => {
    if (!out.has(id)) out.set(id, { subscription: 0, enterprise: 0, adjustments: 0, total: 0 });
    return out.get(id);
  };
  const want = inMonths(months);
  for (const inv of data.invoices) {
    if (inv.voided) continue;
    for (const line of inv.lines) {
      const share = line.net / line.months.length;
      const count = line.months.filter(want).length;
      if (!count) continue;
      const r = row(inv.clientId);
      r[inv.kind === "Enterprise" ? "enterprise" : "subscription"] += share * count;
    }
  }
  for (const a of data.adjustments) {
    if (!want(a.month)) continue;
    row(a.clientId).adjustments -= a.amount;
  }
  for (const r of out.values()) {
    r.subscription = round2(r.subscription);
    r.enterprise = round2(r.enterprise);
    r.adjustments = round2(r.adjustments);
    r.total = round2(r.subscription + r.enterprise + r.adjustments);
  }
  return out;
}

/* ----------------------------------------------------------- actual costs */

/**
 * Actual provider costs (Developer only). Shared costs are split per active user among clients live in that month
 * (approved decision 5). Unallocated costs stay at platform level.
 */
export function actualCosts(data, months) {
  const want = inMonths(months);
  const perClient = new Map();
  const row = (id) => {
    if (!perClient.has(id)) perClient.set(id, { direct: 0, shared: 0, missing: [], basis: new Set() });
    return perClient.get(id);
  };
  let sharedTotal = 0, unallocated = 0, directTotal = 0;
  const missing = [];
  for (const m of months) {
    const live = data.clients.filter((c) => liveInMonth(c, m));
    const users = live.reduce((a, c) => a + activeUsersAt(c), 0);
    const sharedMonth = data.costs.filter((x) => x.month === m && x.shared && x.php != null);
    const sharedSum = sum(sharedMonth, "php");
    sharedTotal += sharedSum;
    for (const c of live) {
      const share = users > 0 ? (sharedSum * activeUsersAt(c)) / users : 0;
      row(c.id).shared += share;
    }
  }
  for (const x of data.costs) {
    if (!want(x.month) || x.shared) continue;
    if (x.unallocated) { if (x.php != null) unallocated += x.php; continue; }
    if (!x.clientId) continue;
    const r = row(x.clientId);
    if (x.php == null) { r.missing.push(x.category + " (" + x.month + ")"); missing.push(x); continue; }
    r.direct += x.php;
    r.basis.add(x.basis);
    directTotal += x.php;
  }
  for (const r of perClient.values()) {
    r.direct = round2(r.direct);
    r.shared = round2(r.shared);
    r.total = round2(r.direct + r.shared);
    r.incomplete = r.missing.length > 0;
    r.basis = [...r.basis];
  }
  const opex = round2(sum(data.opex.filter((o) => want(o.month)), "php"));
  return { perClient, direct: round2(directTotal), shared: round2(sharedTotal), unallocated: round2(unallocated), opex, missing };
}

/* ------------------------------------------------------- allocated expense */

/** Formula in force for a client and month: client override first, then the default. */
export function allocationFormula(data, clientId, month) {
  const start = month + "-01";
  const pick = (list) => list.filter((f) => f.effectiveFrom <= start).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
  const own = pick(data.allocationOverrides.filter((o) => o.clientId === clientId));
  const def = pick(data.allocationDefault);
  if (own && !own.revert) return { ...own, own: true };
  return def ? { ...def, own: false } : null;
}
export function allocatedExpense(data, client, month) {
  if (!liveInMonth(client, month)) return null;
  const f = allocationFormula(data, client.id, month);
  if (!f) return null;
  const users = activeUsersAt(client);
  return { amount: round2(f.fixed + f.perUser * users), formula: "₱" + f.fixed.toLocaleString("en-PH") + " + " + users + " × ₱" + f.perUser.toLocaleString("en-PH"), own: f.own };
}
export function allocatedByClient(data, months, clients = data.clients) {
  const out = new Map();
  for (const c of clients) {
    let total = 0, any = false;
    const lines = [];
    for (const m of months) {
      const a = allocatedExpense(data, c, m);
      if (a) { total += a.amount; any = true; lines.push({ month: m, ...a }); }
    }
    out.set(c.id, any ? { amount: round2(total), lines } : null);
  }
  return out;
}

/* ------------------------------------------------------------- summaries */

export function developerSummary(data, months, clientIds = null) {
  const clients = clientIds ? data.clients.filter((c) => clientIds.includes(c.id)) : data.clients;
  const rev = revenueByClient(data, months);
  const costs = actualCosts(data, months);
  const rows = clients.map((c) => {
    const r = rev.get(c.id) || { subscription: 0, enterprise: 0, adjustments: 0, total: 0 };
    const k = costs.perClient.get(c.id) || { direct: 0, shared: 0, total: 0, incomplete: false, missing: [], basis: [] };
    const profit = round2(r.total - k.total);
    return { client: c, revenue: r.total, subscription: r.subscription, enterprise: r.enterprise, adjustments: r.adjustments, direct: k.direct, shared: k.shared, cost: k.total, profit, margin: r.total > 0 ? profit / r.total : null, incomplete: k.incomplete, missing: k.missing, basis: k.basis };
  });
  const filtered = !!clientIds;
  const revenue = sum(rows, "revenue");
  const direct = sum(rows, "direct");
  const shared = filtered ? sum(rows, "shared") : costs.shared;
  const unallocated = filtered ? 0 : costs.unallocated;
  const opex = filtered ? 0 : costs.opex;
  const profit = round2(revenue - direct - shared - unallocated - opex);
  return {
    rows, revenue, subscription: sum(rows, "subscription"), enterprise: sum(rows, "enterprise"), adjustments: sum(rows, "adjustments"),
    direct, shared, unallocated, opex, profit, margin: revenue > 0 ? profit / revenue : null,
    incomplete: rows.some((r) => r.incomplete), missingCount: rows.reduce((a, r) => a + r.missing.length, 0), filtered,
  };
}

/** Commercial (reported) basis for a set of clients. Contains no actual-cost fields by construction. */
export function commercialSummary(data, months, clients) {
  const rev = revenueByClient(data, months);
  const alloc = allocatedByClient(data, months, clients);
  const rows = clients.map((c) => {
    const r = rev.get(c.id) || { subscription: 0, enterprise: 0, adjustments: 0, total: 0 };
    const a = alloc.get(c.id);
    const allocated = a ? a.amount : null;
    const reported = round2(r.total - (allocated || 0));
    return { clientId: c.id, name: c.name, revenue: r.total, subscription: r.subscription, enterprise: r.enterprise, adjustments: r.adjustments, allocated, allocationLines: a ? a.lines : [], reportedProfit: reported, margin: r.total > 0 ? reported / r.total : null };
  });
  const revenue = sum(rows, "revenue");
  const allocated = sum(rows, (r) => r.allocated || 0);
  const reportedProfit = round2(revenue - allocated);
  return { rows, revenue, subscription: sum(rows, "subscription"), enterprise: sum(rows, "enterprise"), allocated, reportedProfit, margin: revenue > 0 ? reportedProfit / revenue : null };
}

/* ---------------------------------------------------------- distributions */

export function distribution(data, month) {
  const st = data.statements.find((s) => s.month === month) || { month, status: "Draft", adjustments: [], payouts: [] };
  const all = commercialSummary(data, [month], data.clients);
  const sharedBusiness = sum(data.sharedBusiness.filter((x) => x.month === month && x.recognised), "php");
  const adjustments = sum(st.adjustments, "amount");
  const recognisedExpenses = round2(all.allocated + sharedBusiness);
  const distributable = round2(all.revenue - recognisedExpenses + adjustments);
  const developer = round2(Math.max(0, distributable) * DEVELOPER_SHARE);
  const partners = round2(Math.max(0, distributable) * PARTNER_SHARE);
  const paidDeveloper = sum(st.payouts.filter((p) => p.recipient === "Developer"), "amount");
  const paidPartners = sum(st.payouts.filter((p) => p.recipient === "Partners (combined)"), "amount");
  return {
    month, status: st.status, publishedAt: st.publishedAt, revenue: all.revenue, allocated: all.allocated, sharedBusiness, recognisedExpenses, adjustments,
    adjustmentList: st.adjustments, payouts: st.payouts, distributable, developer, partners,
    paidDeveloper, paidPartners, pendingDeveloper: round2(developer - paidDeveloper), pendingPartners: round2(partners - paidPartners),
    paid: round2(paidDeveloper + paidPartners), pending: round2(developer - paidDeveloper + partners - paidPartners),
  };
}

/** A partner's contribution to the pool from their assigned clients. Not their payout. */
export function partnerContribution(data, months, partnerId) {
  const clients = data.clients.filter((c) => c.partnerId === partnerId);
  const s = commercialSummary(data, months, clients);
  return { revenue: s.revenue, allocated: s.allocated, contribution: s.reportedProfit };
}

/* ------------------------------------------------------------ subscriptions */

export function currentPricing(data, date = TODAY) {
  return data.pricing.filter((p) => p.effectiveFrom <= date).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
}
export function monthlyCharge(data, client, month) {
  const sub = client.subscription;
  if (sub.planId !== "standard") return 0;
  const p = currentPricing(data, month + "-01");
  return subscriptionCharge(p, seatsAt(sub, month));
}
export function chargeBreakdown(pricing, seats) {
  const extra = Math.max(0, seats - pricing.baseUsers);
  return { base: pricing.basePrice, extra, extraAmount: round2(extra * pricing.additionalRate), total: subscriptionCharge(pricing, seats) };
}

/** Seat validation. Returns an error sentence or null. */
export function validateSeats(data, client, seats, opts = {}) {
  const n = Number(seats);
  const p = currentPricing(data);
  if (!Number.isInteger(n)) return "Enter a whole number of seats.";
  if (n < p.minSeats) return "Seats can't be fewer than " + p.minSeats + ".";
  if (client && n < activeUsersAt(client)) return "This client has " + activeUsersAt(client) + " active users. Deactivate users first or keep at least that many seats.";
  if (client && client.subscription.planId === "trial" && n > 10) return "Trials allow up to 10 users. Change the plan to Standard first.";
  if (n > (opts.largeSeatApproval || 100) && !opts.commercialReference) return "More than " + (opts.largeSeatApproval || 100) + " seats needs a commercial approval reference.";
  return null;
}

export const capacityTierFor = (tiers, seats) => tiers.find((t) => seats >= t.min && (t.max == null || seats <= t.max)) || tiers[tiers.length - 1];
