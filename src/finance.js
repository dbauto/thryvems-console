/**
 * Financial calculations for the preview. Pure functions over synthetic records.
 *
 * ONE business profit for the Developer and every Business Partner (owner decision, 26 Oct 2026; backend ADR-004):
 *   Net profit = recognised revenue − recognised expenses ± approved adjustments
 *   recognised revenue  = subscription + enterprise revenue by service month, net of VAT, minus discounts and credit notes
 *   recognised expenses = actual direct infrastructure + shared infrastructure + unallocated platform costs
 *                         + other operating expenses + recognised shared business expenses
 *   approved adjustments = adjustments recorded on the monthly statements
 * Both workspaces call sharedProfit(); there is no second formula. Partners only see other partners' client
 * details hidden; totals are identical.
 *
 * Distribution starts from the same net profit: Developer 30%, Business Partners combined 70%, losses not
 * distributed. Individual partner shares are not defined.
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

/* ------------------------------------------------------ shared net profit */

/**
 * The single profit calculation used by both workspaces. Per-client rows (revenue − direct − shared share)
 * plus the company-wide line always add up to net profit.
 */
export function sharedProfit(data, months) {
  const want = inMonths(months);
  const rev = revenueByClient(data, months);
  const costs = actualCosts(data, months);
  let subscription = 0, enterprise = 0, revenueAdjustments = 0;
  for (const r of rev.values()) { subscription += r.subscription; enterprise += r.enterprise; revenueAdjustments += r.adjustments; }
  subscription = round2(subscription); enterprise = round2(enterprise); revenueAdjustments = round2(revenueAdjustments);
  const revenue = round2(subscription + enterprise + revenueAdjustments);
  const businessList = data.sharedBusiness.filter((x) => want(x.month));
  const sharedBusiness = round2(sum(businessList.filter((x) => x.recognised), "php"));
  const notRecognised = round2(sum(businessList.filter((x) => !x.recognised), "php"));
  const adjustmentList = data.statements.filter((st) => want(st.month)).flatMap((st) => st.adjustments.map((a) => ({ ...a, month: st.month })));
  const approvedAdjustments = round2(sum(adjustmentList, "amount"));
  const expenses = round2(costs.direct + costs.shared + costs.unallocated + costs.opex + sharedBusiness);
  const net = round2(revenue - expenses + approvedAdjustments);
  const rows = data.clients.map((c) => {
    const r = rev.get(c.id) || { subscription: 0, enterprise: 0, adjustments: 0, total: 0 };
    const k = costs.perClient.get(c.id) || { direct: 0, shared: 0, total: 0, incomplete: false, missing: [], basis: [] };
    const profit = round2(r.total - k.total);
    return { client: c, revenue: r.total, subscription: r.subscription, enterprise: r.enterprise, adjustments: r.adjustments, direct: k.direct, shared: k.shared, cost: k.total, profit, margin: r.total > 0 ? profit / r.total : null, incomplete: k.incomplete, missing: k.missing, basis: k.basis };
  }).filter((x) => x.revenue || x.cost);
  // Unallocated platform costs, operating and shared business expenses and approved adjustments stay company-wide.
  const companyWide = round2(net - sum(rows, "profit"));
  return {
    months, revenue, subscription, enterprise, revenueAdjustments,
    direct: costs.direct, shared: costs.shared, unallocated: costs.unallocated, opex: costs.opex, sharedBusiness, notRecognised,
    expenses, approvedAdjustments, adjustmentList, net, margin: revenue > 0 ? net / revenue : null,
    rows, companyWide, incomplete: costs.missing.length > 0, missingCount: costs.missing.length,
  };
}

/** Expense categories behind recognised expenses, for the transparent breakdown both roles see. */
export function expenseCategories(data, months) {
  const want = inMonths(months);
  const p = sharedProfit(data, months);
  const byCat = new Map();
  for (const x of data.costs) if (want(x.month) && x.php != null) byCat.set(x.category, round2((byCat.get(x.category) || 0) + x.php));
  const list = [...byCat.entries()].map(([name, amount]) => ({ name, amount, group: "Infrastructure" }));
  list.push({ name: "Other operating expenses", amount: p.opex, group: "Operating" });
  if (p.sharedBusiness) list.push({ name: "Shared business expenses", amount: p.sharedBusiness, group: "Shared business" });
  const total = sum(list, "amount");
  return list.filter((x) => x.amount).map((x) => ({ ...x, share: total ? x.amount / total : 0 })).sort((a, b) => b.amount - a.amount);
}

/* ---------------------------------------------------------- distributions */

export function distribution(data, month) {
  const st = data.statements.find((s) => s.month === month) || { month, status: "Draft", adjustments: [], payouts: [] };
  const p = sharedProfit(data, [month]);
  const distributable = p.net;
  const base = Math.max(0, distributable);
  const developer = round2(base * DEVELOPER_SHARE);
  const partners = round2(base - developer);
  const paidDeveloper = sum(st.payouts.filter((x) => x.recipient === "Developer"), "amount");
  const paidPartners = sum(st.payouts.filter((x) => x.recipient === "Partners (combined)"), "amount");
  return {
    month, status: st.status, publishedAt: st.publishedAt, revenue: p.revenue, sharedBusiness: p.sharedBusiness, recognisedExpenses: p.expenses, adjustments: p.approvedAdjustments,
    adjustmentList: st.adjustments, payouts: st.payouts, net: p.net, distributable, developer, partners,
    paidDeveloper, paidPartners, pendingDeveloper: round2(developer - paidDeveloper), pendingPartners: round2(partners - paidPartners),
    paid: round2(paidDeveloper + paidPartners), pending: round2(developer - paidDeveloper + partners - paidPartners),
  };
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
