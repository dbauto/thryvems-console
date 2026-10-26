/** Developer Console › Finance. One shared profit calculation (finance.sharedProfit) is used here and in the Business Partner workspace. */
import { getData, clientById, scopeClients, addCost, COST_CATEGORIES, updatePricing, addAdjustment, createProject, updateProject, completeMilestone, addMilestone, editMilestoneAmount, PROJECT_STATES, publishStatement, addDistributionAdjustment, recordPayout } from "../store.js";
import { sharedProfit, actualCosts, distribution, currentPricing, chargeBreakdown, invoiceTotals, revenueByClient, liveInMonth, activeUsersAt, DEVELOPER_SHARE, PARTNER_SHARE } from "../finance.js";
import { profitReport, profitFigures, sameBanner, plRows, profitCsv, profitChart } from "./profit.js";
import { PLANS, CAPACITY_TIERS, PARTNERS } from "../seed.js";
import { h, pageHeader, badge, keyFacts, dataTable, sheet, dialog, button, input, select, textarea, combobox, formError, readForm, showFormError, closeOverlay, alertBox, card, row, linkTo, moneyCell, emptyLine, figure, figureGrid, basisBadge, svgBars } from "../ui.js";
import { money, pct, formatDate, formatDateTime, MONTHS, monthShort, monthLabel, CURRENT_MONTH, TODAY, sum, addDays } from "../util.js";
import { tabs, notFound, periodFilter, clientFilter, selectFilter, getFilter, currentPeriod, periodCaption, invoiceTable, historyTable, partnerLabel } from "./shared.js";
import { rerender, notify } from "../registry.js";

const TABS = [["overview", "Overview"], ["revenue", "Revenue"], ["costs", "Costs"], ["profit", "Shared profit reporting"], ["allocations", "Allocations"], ["pricing", "Pricing"], ["subscriptions", "Subscriptions"], ["enterprise", "Enterprise"], ["distributions", "Distributions"]].map(([id, label]) => ({ id, label }));

export function render(r) {
  const tab = r.query.get("tab") || "overview";
  const fn = { overview, revenue, costs, profit: () => profitReport("dev", r), allocations, pricing, subscriptions, enterprise, distributions }[tab];
  if (!fn) return notFound();
  return pageHeader({ title: "Finance", description: "Revenue, actual expenses and one shared net profit. Business Partners see the same totals for the same period; provider credentials and configuration stay here.", actions: tab === "profit" ? button("Export statement", "sp-export", { cls: "btn-small" }) : "" }) +
    tabs(TABS, tab, "#/dev/finance", "Finance sections") + fn();
}
const filters = (withClient = true) => '<div class="filters">' + periodFilter() + (withClient ? clientFilter("fin-client", scopeClients("dev")) : "") + "</div>";
const selectedIds = () => { const id = getFilter("fin-client"); return id ? [id] : null; };
const formula = (name, text, source) => row("<strong>" + h(name) + "</strong>", h(text) + (source ? ' <span class="muted">· Source: ' + h(source) + "</span>" : ""));

/* ---------------------------------------------------------------- overview */

function overview() {
  const d = getData();
  const p = currentPeriod();
  const ids = selectedIds();
  const sp = sharedProfit(d, p.months);
  const dist = p.months.map((m) => distribution(d, m));
  const trend = MONTHS.map((m) => ({ m, s: sharedProfit(d, [m]) }));
  const one = ids ? sp.rows.find((x) => x.client.id === ids[0]) : null;
  return filters() + '<p class="small muted">' + h(periodCaption()) + "</p>" + sameBanner(sp, true) + profitFigures(sp, "#/dev/finance?tab=profit") +
    figureGrid([
      figure({ label: "Actual infrastructure expenses", value: money(sp.direct + sp.shared + sp.unallocated), badge: sp.incomplete ? "Incomplete" : "Complete", tone: sp.incomplete ? "soon" : "done", note: "Direct " + money(sp.direct) + " · shared " + money(sp.shared) + " · unallocated " + money(sp.unallocated), icon: "server", href: "#/dev/finance?tab=costs", testid: "fin-infra" }),
      figure({ label: "Operating and shared business expenses", value: money(sp.opex + sp.sharedBusiness), note: "Operating " + money(sp.opex) + " · shared business " + money(sp.sharedBusiness), icon: "building-2", href: "#/dev/finance?tab=costs", testid: "fin-opex" }),
      figure({ label: "Developer distribution · 30%", value: money(sum(dist, "developer")), note: "Paid " + money(sum(dist, "paidDeveloper")), icon: "users", href: "#/dev/finance?tab=distributions", testid: "fin-dev-share" }),
      figure({ label: "Business Partners combined · 70%", value: money(sum(dist, "partners")), note: "Individual shares not defined", icon: "users-round", href: "#/dev/finance?tab=distributions" }),
    ], "Expense and distribution figures") +
    (one ? card({ title: "Selected client: " + h(one.client.name), note: "Revenue minus this client's direct and shared infrastructure. Company-wide costs are not split by client.", body: '<div class="card-body">' + keyFacts([["Revenue", h(money(one.revenue))], ["Direct infrastructure", h(money(one.direct))], ["Shared infrastructure share", h(money(one.shared))], ["Profit from this client", h(money(one.profit)) + " · margin " + pct(one.margin)]]) + "</div>" }) : "") +
    card({ title: "Month-over-month trend", note: "Company-wide, one calculation.", body: '<div class="card-body">' +
      profitChart(trend) +
      '<div class="table-scroll"><table class="data-table" style="min-width:720px"><thead><tr><th scope="col">Month</th><th scope="col">Revenue</th><th scope="col">Recognised expenses</th><th scope="col">Net profit</th><th scope="col">Margin</th><th scope="col">Change in profit</th></tr></thead><tbody>' +
      trend.map((t, i) => { const prev = trend[i - 1]; const delta = prev ? t.s.net - prev.s.net : null; return "<tr><td>" + h(monthLabel(t.m)) + "</td><td>" + moneyCell(t.s.revenue) + "</td><td>" + moneyCell(t.s.expenses) + (t.s.incomplete ? " " + badge("Incomplete") : "") + "</td><td>" + moneyCell(t.s.net) + "</td><td>" + pct(t.s.margin) + "</td><td>" + (delta == null ? '<span class="muted">No data</span>' : moneyCell(delta)) + "</td></tr>"; }).join("") + "</tbody></table></div></div>" }) +
    '<h2 class="section-title">Profit by client</h2>' +
    dataTable({ id: "fin-clients", caption: "Revenue, cost and profit per client", rows: sp.rows, minWidth: 1100,
      search: (x) => x.client.name, searchLabel: "Search clients", empty: { title: "No financial records", body: "Clients with revenue or costs in the period appear here." },
      columns: [
        { key: "c", label: "Client", sort: (x) => x.client.name, cell: (x) => linkTo(x.client.name, "#/dev/organisations/" + x.client.id) },
        { key: "rev", label: "Revenue", sort: (x) => x.revenue, cell: (x) => moneyCell(x.revenue) },
        { key: "dir", label: "Direct infrastructure", sort: (x) => x.direct, cell: (x) => moneyCell(x.direct) + (x.incomplete ? " " + badge("Incomplete") : "") },
        { key: "sh", label: "Shared share", sort: (x) => x.shared, cell: (x) => moneyCell(x.shared) },
        { key: "profit", label: "Profit from client", sort: (x) => x.profit, cell: (x) => moneyCell(x.profit) },
        { key: "m", label: "Margin", sort: (x) => x.margin ?? -1, cell: (x) => pct(x.margin) },
      ] }) + '<p class="footer-caption">Client rows plus company-wide costs and adjustments (' + h(money(sp.companyWide)) + ") equal net profit " + h(money(sp.net)) + ".</p>";
}

/* ----------------------------------------------------------------- revenue */

function revenue() {
  const d = getData();
  const p = currentPeriod();
  const ids = selectedIds();
  const rev = revenueByClient(d, p.months);
  const rows = d.clients.filter((c) => rev.has(c.id) && (!ids || ids.includes(c.id))).map((c) => ({ c, r: rev.get(c.id) }));
  const issued = d.invoices.filter((i) => p.months.includes(i.issueDate.slice(0, 7)) && (!ids || ids.includes(i.clientId)));
  const status = getFilter("inv-status");
  const shown = issued.filter((i) => !status || invoiceTotals(d, i).status === status);
  const totals = shown.map((i) => invoiceTotals(d, i));
  return filters() + figureGrid([
    figure({ label: "Subscription revenue", value: money(sum(rows, (x) => x.r.subscription)), icon: "₱" }),
    figure({ label: "Enterprise and customization revenue", value: money(sum(rows, (x) => x.r.enterprise)), icon: "◆", href: "#/dev/finance?tab=enterprise" }),
    figure({ label: "Invoiced in period (gross)", value: money(sum(totals, "gross")), note: shown.length + " invoice(s)", icon: "▤" }),
    figure({ label: "Outstanding", value: money(sum(totals, "outstanding")), badge: totals.some((t) => t.status === "Overdue") ? "Includes overdue" : null, tone: "overdue", icon: "!" }),
  ], "Revenue figures") +
    dataTable({ id: "rev-clients", caption: "Recognised revenue per client", rows, minWidth: 900, search: (x) => x.c.name, searchLabel: "Search clients",
      empty: { title: "No revenue", body: "Recognised revenue appears for clients with invoices covering the period." },
      columns: [
        { key: "c", label: "Client", sort: (x) => x.c.name, cell: (x) => linkTo(x.c.name, "#/dev/organisations/" + x.c.id) + '<div class="secondary">' + h(partnerLabel(x.c.partnerId)) + "</div>" },
        { key: "s", label: "Subscription", sort: (x) => x.r.subscription, cell: (x) => moneyCell(x.r.subscription) },
        { key: "e", label: "Enterprise", sort: (x) => x.r.enterprise, cell: (x) => moneyCell(x.r.enterprise) },
        { key: "a", label: "Discounts and credits", sort: (x) => x.r.adjustments, cell: (x) => moneyCell(x.r.adjustments) },
        { key: "t", label: "Revenue per client", sort: (x) => x.r.total, cell: (x) => moneyCell(x.r.total) },
      ] }) +
    '<h2 class="section-title">Invoices issued in the period</h2>' +
    invoiceTable("fin-invoices", shown, { toolbar: '<div class="filters">' + selectFilter("inv-status", "Payment status", [{ value: "", label: "All statuses" }, "Issued", "Partly paid", "Paid", "Overdue", "Void"].map((x) => (typeof x === "string" ? { value: x, label: x } : x))) + "</div>" }) +
    '<p class="footer-caption">Invoices are recorded here. Payments received are recorded against them.</p>';
}

/* ------------------------------------------------------------------- costs */

function costs() {
  const d = getData();
  const p = currentPeriod();
  const k = actualCosts(d, p.months);
  const cat = getFilter("cost-cat"), basis = getFilter("cost-basis"), scope = getFilter("cost-scope");
  const entries = d.costs.filter((c) => p.months.includes(c.month) && (!cat || c.category === cat) && (!basis || c.basis === basis) && (!scope || (scope === "shared" ? c.shared : scope === "unallocated" ? c.unallocated : !c.shared && !c.unallocated)));
  const byCat = COST_CATEGORIES.map((c) => ({ c, v: sum(d.costs.filter((x) => p.months.includes(x.month) && x.category === c && x.php != null), "php"), missing: d.costs.filter((x) => p.months.includes(x.month) && x.category === c && x.php == null).length })).filter((x) => x.v || x.missing);
  return '<div class="filters">' + periodFilter() + "</div>" +
    alertBox("info", "Actual provider costs from the cost ledger. Business Partners see the same amounts and categories in Shared profit reporting; provider accounts, credentials and configuration stay in the Developer Console.") +
    figureGrid([
      figure({ label: "Direct (per client)", value: money(k.direct), badge: k.missing.length ? "Incomplete" : "Complete", tone: k.missing.length ? "soon" : "done", note: k.missing.length + " item(s) not available", icon: "▣" }),
      figure({ label: "Shared (split per active user)", value: money(k.shared), icon: "◫" }),
      figure({ label: "Unallocated platform tools", value: money(k.unallocated), note: "Stays at platform level", icon: "◌" }),
      figure({ label: "Other operating expenses", value: money(k.opex), icon: "▤" }),
    ], "Cost figures") +
    card({ title: "By category", note: h(periodCaption()), body: byCat.map((x) => row(h(x.c), x.missing ? x.missing + " item(s) not available" : "", "<strong>" + h(money(x.v)) + "</strong>" + (x.missing ? " " + badge("Incomplete") : ""))).join("") || emptyLine("No costs", "") }) +
    dataTable({ id: "cost-ledger", caption: "Actual cost ledger", rows: entries, minWidth: 1200,
      toolbar: '<div class="filters">' + selectFilter("cost-cat", "Category", [{ value: "", label: "All categories" }, ...COST_CATEGORIES.map((c) => ({ value: c, label: c }))]) +
        selectFilter("cost-basis", "Basis", [{ value: "", label: "All bases" }, ...["Reconciled", "Manual", "Estimate", "Not available"].map((b) => ({ value: b, label: b }))]) +
        selectFilter("cost-scope", "Scope", [{ value: "", label: "All" }, { value: "client", label: "Direct (client)" }, { value: "shared", label: "Shared" }, { value: "unallocated", label: "Unallocated" }]) + button("Add cost entry", "cost-add", { cls: "btn-small" }) + "</div>",
      search: (c) => c.category + " " + c.provider + " " + (clientById(c.clientId)?.name || "") + " " + c.source, searchLabel: "Search costs",
      empty: { title: "No cost entries", body: "Add manual or estimated entries; reconciled amounts come from provider imports later." },
      columns: [
        { key: "m", label: "Month", sort: (c) => c.month, cell: (c) => h(monthShort(c.month)) },
        { key: "cat", label: "Category", sort: (c) => c.category, cell: (c) => h(c.category) + '<div class="secondary">' + h(c.provider) + "</div>" },
        { key: "scope", label: "Applies to", sort: (c) => (c.shared ? "Shared" : c.unallocated ? "Unallocated" : clientById(c.clientId)?.name || ""), cell: (c) => (c.shared ? badge("Shared", "progress") : c.unallocated ? badge("Unallocated", "draft") : h(clientById(c.clientId)?.name || "")) },
        { key: "orig", label: "Original", cell: (c) => (c.usd != null ? "USD " + h(c.usd.toFixed(2)) + (c.fx ? '<div class="secondary">@ ' + h(c.fx) + "</div>" : "") : '<span class="muted">PHP</span>') },
        { key: "php", label: "PHP", sort: (c) => c.php ?? -1, cell: (c) => (c.php == null ? '<span class="muted">Not available</span>' : moneyCell(c.php)) },
        { key: "basis", label: "Basis", sort: (c) => c.basis, cell: (c) => basisBadge(c.basis) },
        { key: "src", label: "Source", cell: (c) => '<span class="small">' + h(c.source) + "</span>" },
      ] });
}

/* ------------------------------------------------------------- allocations */

function allocations() {
  const d = getData();
  const p = currentPeriod();
  const rows = [];
  for (const m of p.months) {
    const live = d.clients.filter((c) => liveInMonth(c, m));
    const users = live.reduce((a, c) => a + activeUsersAt(c), 0);
    for (const x of d.costs.filter((k) => k.month === m && k.shared && k.php != null)) {
      const parts = live.map((c) => ({ c, amount: users > 0 ? (x.php * activeUsersAt(c)) / users : 0 }));
      rows.push({ m, x, users, clients: live.length, allocated: sum(parts, "amount"), parts });
    }
  }
  const sbe = d.sharedBusiness.filter((x) => p.months.includes(x.month));
  return '<div class="filters">' + periodFilter() + "</div>" +
    alertBox("info", "<strong>Method:</strong> shared infrastructure costs are split among clients live in the month, per active user. Unallocated platform costs, operating and shared business expenses stay company-wide. Every split adds back to its original expense, and the same figures appear in the Business Partner workspace.") +
    dataTable({ id: "alloc-shared", caption: "Shared infrastructure allocations", rows, minWidth: 1100, search: (r) => r.x.category + " " + r.x.provider, searchLabel: "Search shared costs",
      empty: { title: "No shared costs", body: "Shared provider costs for the period appear here." },
      columns: [
        { key: "m", label: "Month", sort: (r) => r.m, cell: (r) => h(monthShort(r.m)) },
        { key: "c", label: "Shared cost", sort: (r) => r.x.category, cell: (r) => h(r.x.category) + '<div class="secondary">' + h(r.x.provider) + " · " + h(r.x.source) + "</div>" },
        { key: "o", label: "Original", sort: (r) => r.x.php, cell: (r) => moneyCell(r.x.php) },
        { key: "n", label: "Split among", cell: (r) => h(r.clients + " clients, " + r.users + " active users") },
        { key: "a", label: "Allocated", sort: (r) => r.allocated, cell: (r) => moneyCell(r.allocated) },
        { key: "ok", label: "Reconciles", cell: (r) => badge(Math.abs(r.allocated - r.x.php) < 0.02 ? "Reconciled" : "Not allocated", Math.abs(r.allocated - r.x.php) < 0.02 ? "done" : "soon") },
      ] }) +
    card({ title: "Shared business expenses", note: "Recognised amounts are part of recognised expenses in both workspaces.", body: sbe.map((x) => row(h(x.category), monthShort(x.month), "<strong>" + h(money(x.php)) + "</strong> " + badge(x.recognised ? "Recognised" : "Not recognised", x.recognised ? "done" : "draft"))).join("") || emptyLine("No shared business expenses", "") });
}

/* ----------------------------------------------------------------- pricing */

function pricing() {
  const d = getData();
  const p = currentPricing(d);
  const future = d.pricing.filter((x) => x.effectiveFrom > TODAY);
  return alertBox("warning", "<strong>Prices are illustrative and not approved.</strong> Final monthly prices haven't been decided. Change them here with a future effective date; issued invoices keep their prices.") +
    card({ title: "Pricing in force", action: button("Change pricing", "price-edit", { cls: "btn-small btn-primary" }), body: '<div class="card-body">' + keyFacts([
      ["Base subscription", h(money(p.basePrice)) + " per month " + badge("Illustrative", "draft")], ["Base users included", h(p.baseUsers)], ["Additional seat rate", h(money(p.additionalRate)) + " per seat per month"], ["Minimum seats", h(p.minSeats)],
      ["Billing cycles", "Monthly; Annual (12 × monthly, no discount assumed)"], ["Enterprise customization", h(money(p.enterpriseFee)) + " one-time per client, unless an approved exception applies"], ["Effective from", formatDate(p.effectiveFrom)], ["Example", h(exampleLine(p, 32))],
    ]) + (future.length ? alertBox("info", "Scheduled: " + future.map((f) => h(money(f.basePrice)) + " base from " + formatDate(f.effectiveFrom)).join("; ")) : "") + "</div>" }) +
    card({ title: "Plan catalog", body: PLANS.map((pl) => row(h(pl.name), h(pl.description), badge(pl.chargeable ? "Chargeable" : "No charge", pl.chargeable ? "progress" : "draft"))).join("") }) +
    card({ title: "Capacity sizing (infrastructure planning, not pricing)", note: "Used to size Neon compute and alerts. These tiers are not subscription plans.", body: CAPACITY_TIERS.map((t) => row(h(t.name), h(t.min + (t.max ? "–" + t.max : "+") + " users · " + t.note), badge(d.clients.filter((c) => c.subscription.purchasedSeats >= t.min && (t.max == null || c.subscription.purchasedSeats <= t.max) && c.accountStatus === "Live").length + " live clients", "draft"))).join("") }) +
    dataTable({ id: "price-versions", caption: "Pricing versions", rows: d.pricing.slice().reverse(), minWidth: 900, empty: { title: "No pricing", body: "" },
      columns: [
        { key: "e", label: "Effective from", cell: (x) => formatDate(x.effectiveFrom) }, { key: "b", label: "Base", cell: (x) => moneyCell(x.basePrice) }, { key: "u", label: "Users included", cell: (x) => h(x.baseUsers) },
        { key: "r", label: "Additional seat", cell: (x) => moneyCell(x.additionalRate) }, { key: "m", label: "Minimum seats", cell: (x) => h(x.minSeats) }, { key: "f", label: "Enterprise fee", cell: (x) => moneyCell(x.enterpriseFee) },
        { key: "why", label: "Reason", cell: (x) => '<span class="small">' + h(x.reason) + " · " + h(x.by) + "</span>" },
      ] });
}
const exampleLine = (p, seats) => { const b = chargeBreakdown(p, seats); return seats + " seats: " + money(b.base) + (b.extra ? " + " + b.extra + " × " + money(p.additionalRate) : "") + " = " + money(b.total) + " per month before VAT"; };

/* ----------------------------------------------------------- subscriptions */

function subscriptions() {
  const d = getData();
  const st = getFilter("subs-status"), cyc = getFilter("subs-cycle");
  const p = currentPricing(d);
  const rows = d.clients.filter((c) => c.accountStatus !== "Archived" && (!st || c.subscription.status === st) && (!cyc || c.subscription.billingCycle === cyc));
  const hist = d.clients.flatMap((c) => c.subscription.history.map((x) => ({ ...x, client: c })));
  const renewal = (c) => { const s = c.subscription; return s.status === "Cancelled" ? "Cancelled " + formatDate(s.cancelledAt) : s.status === "Trial" ? "Trial ends " + formatDate(s.trialEnds) : s.status === "Suspended" ? "Suspended" : "Renews " + formatDate(s.renewalDate); };
  return figureGrid([
    figure({ label: "Active subscriptions", value: d.clients.filter((c) => c.subscription.status === "Active").length, icon: "✓" }),
    figure({ label: "Trials", value: d.clients.filter((c) => c.subscription.status === "Trial").length, icon: "○" }),
    figure({ label: "Past due or suspended", value: d.clients.filter((c) => ["Past due", "Suspended"].includes(c.subscription.status)).length, tone: "overdue", badge: "Needs a look", icon: "!" }),
    figure({ label: "Purchased seats (active and trial)", value: sum(d.clients.filter((c) => ["Active", "Trial", "Past due"].includes(c.subscription.status)), (c) => c.subscription.purchasedSeats), note: sum(d.clients, (c) => c.subscription.activeUsers) + " active users", icon: "♙" }),
  ], "Subscription figures") +
    dataTable({ id: "subs", caption: "Subscriptions", rows, minWidth: 1250,
      toolbar: '<div class="filters">' + selectFilter("subs-status", "Status", [{ value: "", label: "All statuses" }, ...["Trial", "Active", "Past due", "Suspended", "Cancelled"].map((x) => ({ value: x, label: x }))]) + selectFilter("subs-cycle", "Billing cycle", [{ value: "", label: "All cycles" }, { value: "Monthly", label: "Monthly" }, { value: "Annual", label: "Annual" }]) + button("Record adjustment", "adj-add", { cls: "btn-small" }) + "</div>",
      search: (c) => c.name + " " + partnerLabel(c.partnerId), searchLabel: "Search subscriptions", empty: { title: "No subscriptions", body: "Subscriptions appear when client accounts are created." },
      columns: [
        { key: "c", label: "Client", sort: (c) => c.name, cell: (c) => linkTo(c.name, "#/dev/organisations/" + c.id + "?tab=subscription") },
        { key: "plan", label: "Plan", sort: (c) => c.subscription.planId, cell: (c) => (c.subscription.planId === "trial" ? "Trial" : "Standard") },
        { key: "st", label: "Status", sort: (c) => c.subscription.status, cell: (c) => badge(c.subscription.status) },
        { key: "cy", label: "Billing cycle", sort: (c) => c.subscription.billingCycle, cell: (c) => h(c.subscription.billingCycle) },
        { key: "seats", label: "Seats used / purchased", sort: (c) => c.subscription.purchasedSeats, cell: (c) => h(c.subscription.activeUsers + " / " + c.subscription.purchasedSeats) },
        { key: "chg", label: "Monthly charge (illustrative)", sort: (c) => (c.subscription.planId === "trial" ? 0 : chargeBreakdown(p, c.subscription.purchasedSeats).total), cell: (c) => (c.subscription.planId === "trial" ? '<span class="muted">No charge</span>' : moneyCell(chargeBreakdown(p, c.subscription.purchasedSeats).total)) },
        { key: "ren", label: "Renewal", sort: (c) => c.subscription.renewalDate || "", cell: (c) => h(renewal(c)) + (c.subscription.scheduled ? '<div class="secondary">' + badge("Scheduled") + " change " + formatDate(c.subscription.scheduled.effective) + "</div>" : "") },
      ] }) +
    '<h2 class="section-title">Upgrades, downgrades and other changes</h2>' +
    dataTable({ id: "subs-history", caption: "Subscription history", rows: hist, minWidth: 1000, search: (x) => x.client.name + " " + x.field + " " + x.reason, searchLabel: "Search changes",
      empty: { title: "No changes", body: "Plan, seat and billing changes appear here." },
      columns: [
        { key: "at", label: "Recorded", sort: (x) => x.at, cell: (x) => formatDateTime(x.at) }, { key: "c", label: "Client", sort: (x) => x.client.name, cell: (x) => h(x.client.name) },
        { key: "f", label: "Change", cell: (x) => h(x.field) + ": " + h(x.from) + " → " + h(x.to) + (x.field === "Purchased seats" ? " " + badge(Number(x.to) > Number(x.from) ? "Upgrade" : "Downgrade", "progress") : "") },
        { key: "e", label: "Effective", sort: (x) => x.effective, cell: (x) => formatDate(x.effective) }, { key: "r", label: "Reason", cell: (x) => '<span class="small">' + h(x.reason) + "</span>" },
      ] }) +
    card({ title: "Commercial adjustments", note: "Discounts and credit notes reduce recognised revenue in the month recorded.", body: d.adjustments.slice().reverse().map((a) => row(h(a.kind) + " · " + h(clientById(a.clientId)?.name || ""), monthShort(a.month) + " · " + h(a.reason) + " · " + h(a.approval || ""), "<strong>" + h(money(-a.amount)) + "</strong>")).join("") || emptyLine("No adjustments", "") });
}

/* -------------------------------------------------------------- enterprise */

function projectFinance(p) {
  const d = getData();
  const invs = d.invoices.filter((i) => i.projectId === p.id).map((i) => invoiceTotals(d, i));
  return { invoiced: sum(invs, "net"), paid: sum(invs, "paid"), outstanding: sum(invs, "outstanding") };
}
function enterprise() {
  const d = getData();
  const st = getFilter("ent-status");
  const rows = d.projects.filter((p) => !st || p.status === st);
  const all = d.projects.map((p) => ({ p, f: projectFinance(p) }));
  return figureGrid([
    figure({ label: "Projects", value: d.projects.length, note: d.projects.filter((p) => ["Scoping", "In progress"].includes(p.status)).length + " open", icon: "◆" }),
    figure({ label: "Contracted amount", value: money(sum(d.projects, "amount")), icon: "₱" }),
    figure({ label: "Invoiced (net)", value: money(sum(all, (x) => x.f.invoiced)), note: "Recognised in the month invoiced", icon: "▤" }),
    figure({ label: "Outstanding (gross)", value: money(sum(all, (x) => x.f.outstanding)), icon: "!" }),
  ], "Enterprise figures") +
    dataTable({ id: "projects", caption: "Enterprise and customization projects", rows, minWidth: 1300,
      toolbar: '<div class="filters">' + selectFilter("ent-status", "Status", [{ value: "", label: "All statuses" }, ...PROJECT_STATES.map((s) => ({ value: s, label: s }))]) + button("Create project", "ent-create", { cls: "btn-small btn-primary" }) + "</div>",
      search: (p) => p.name + " " + (clientById(p.clientId)?.name || "") + " " + p.type, searchLabel: "Search projects",
      empty: { title: "No projects", body: "One-time customization projects (₱150,000 standard) appear here." },
      columns: [
        { key: "n", label: "Project", sort: (p) => p.name, cell: (p) => '<button type="button" class="table-link" data-act="ent-open" data-id="' + h(p.id) + '">' + h(p.name) + '</button><div class="secondary">' + h(p.type) + "</div>" },
        { key: "c", label: "Client", sort: (p) => clientById(p.clientId)?.name || "", cell: (p) => h(clientById(p.clientId)?.name || "") },
        { key: "pt", label: "Business partner", cell: (p) => h(partnerLabel(clientById(p.clientId)?.partnerId)) },
        { key: "amt", label: "Commercial amount", sort: (p) => p.amount, cell: (p) => moneyCell(p.amount) + (p.exception ? '<div class="secondary">Exception ' + h(p.exception.reference) + "</div>" : '<div class="secondary">Standard one-time fee</div>') },
        { key: "st", label: "Status", sort: (p) => p.status, cell: (p) => badge(p.status) },
        { key: "ms", label: "Milestones", cell: (p) => h(p.milestones.filter((m) => m.status === "Done").length + " of " + p.milestones.length + " done") },
        { key: "inv", label: "Invoiced / paid", cell: (p) => { const f = projectFinance(p); return moneyCell(f.invoiced) + '<div class="secondary">Paid ' + h(money(f.paid)) + "</div>"; } },
        { key: "due", label: "Expected completion", sort: (p) => p.expectedCompletion, cell: (p) => formatDate(p.expectedCompletion) },
      ] });
}
function openProject(id) {
  const d = getData();
  const p = d.projects.find((x) => x.id === id);
  const c = clientById(p.clientId);
  const f = projectFinance(p);
  sheet({ title: p.name, description: h(c.name) + " · " + h(partnerLabel(c.partnerId)), wide: true, body:
    keyFacts([["Customization type", h(p.type)], ["Scope", h(p.scope)], ["Commercial amount", h(money(p.amount))], ["One-time fee", p.exception ? "Exception " + h(p.exception.reference) + ": " + h(p.exception.reason) : "Standard " + h(money(currentPricing(d).enterpriseFee))], ["Invoiced (net)", h(money(f.invoiced))], ["Paid (gross)", h(money(f.paid))], ["Outstanding", h(money(f.outstanding))]]) +
    "<h3>Milestones</h3>" + p.milestones.map((m) => '<div class="rule-row compact"><div><strong>' + h(m.name) + '</strong><div class="secondary">Due ' + formatDate(m.due) + (m.invoiceMonth ? " · invoiced " + monthShort(m.invoiceMonth) : "") + "</div></div>" +
      '<div class="inline-actions">' + (m.status === "Done" ? "" : input("Amount", "ms-amt-" + m.id, m.amount, { type: "number", min: 0 }).replace('class="field"', 'class="field compact"') + button("Save amount", "ms-amount", { id: p.id, arg: m.id, cls: "btn-small" }) + button("Mark done", "ms-done", { id: p.id, arg: m.id, cls: "btn-small" })) + badge(m.status) + " <strong>" + h(money(m.amount)) + "</strong></div></div>").join("") +
    '<fieldset class="inline-form"><legend>Add milestone</legend><div class="form-grid">' + input("Name", "nm-name", "") + input("Amount (₱)", "nm-amount", "", { type: "number", min: 0 }) + input("Due date", "nm-due", addDays(TODAY, 30), { type: "date" }) + "</div>" + formError("ms-error") + button("Add milestone", "ms-add", { id: p.id, cls: "btn-small", submit: true }) + "</fieldset>" +
    '<fieldset class="inline-form"><legend>Status and notes</legend><div class="form-grid">' + select("Project status", "pe-status", p.status, PROJECT_STATES) + input("Expected completion", "pe-due", p.expectedCompletion, { type: "date" }) + "</div>" +
    textarea("Implementation notes", "pe-notes", p.notes) + textarea("Approved change (optional)", "pe-change", "", { rows: 2, hint: "Recorded in the approved changes list." }) + textarea("Reason", "pe-reason", "", { rows: 2 }) + formError() + "</fieldset>" +
    "<h3>Approved changes</h3>" + (p.approvedChanges.map((a) => row(h(a.text), formatDate(a.at) + " · " + h(a.by))).join("") || '<p class="muted small">None.</p>'),
    footer: button("Close", "close") + button("Save project", "ent-save", { id: p.id, cls: "btn-primary", submit: true }) });
}

/* ----------------------------------------------------------- distributions */

function distributions() {
  const d = getData();
  const rows = MONTHS.slice().reverse().map((m) => distribution(d, m));
  return alertBox("info", "Distribution starts from the shared net profit, the same figure Business Partners see: 30% Developer, 70% Business Partners combined. Losses are not distributed. Individual partner shares are not defined. Payouts are records only; no money is moved.") +
    figureGrid([
      figure({ label: "Shared net profit, Jul–Oct 2026", value: money(sum(rows, "distributable")), icon: "circle-check" }),
      figure({ label: "Developer · 30%", value: money(sum(rows, "developer")), note: "Pending " + money(sum(rows, "pendingDeveloper")), icon: "♙" }),
      figure({ label: "Business partners combined · 70%", value: money(sum(rows, "partners")), note: "Pending " + money(sum(rows, "pendingPartners")), icon: "♟" }),
      figure({ label: "Paid in total", value: money(sum(rows, "paid")), note: "Pending " + money(sum(rows, "pending")), icon: "✓" }),
    ], "Distribution figures") +
    dataTable({ id: "dist", caption: "Distribution statements", rows, minWidth: 1300, empty: { title: "No statements", body: "Monthly statements appear as periods are recorded." },
      columns: [
        { key: "m", label: "Reporting period", sort: (x) => x.month, cell: (x) => '<button type="button" class="table-link" data-act="dist-open" data-id="' + h(x.month) + '">' + h(monthLabel(x.month)) + "</button>" },
        { key: "rev", label: "Revenue", cell: (x) => moneyCell(x.revenue) },
        { key: "exp", label: "Recognised business expenses", cell: (x) => moneyCell(x.recognisedExpenses) },
        { key: "adj", label: "Adjustments", cell: (x) => moneyCell(x.adjustments) },
        { key: "dist", label: "Shared net profit", cell: (x) => moneyCell(x.distributable) },
        { key: "dev", label: "Developer 30%", cell: (x) => moneyCell(x.developer) },
        { key: "par", label: "Partners 70%", cell: (x) => moneyCell(x.partners) },
        { key: "paid", label: "Paid", cell: (x) => moneyCell(x.paid) },
        { key: "pend", label: "Pending", cell: (x) => moneyCell(x.pending) },
        { key: "st", label: "Status", cell: (x) => badge(x.status) },
      ] });
}
function openStatement(month) {
  const x = distribution(getData(), month);
  sheet({ title: "Distribution statement · " + monthLabel(month), description: badge(x.status) + (x.publishedAt ? " Published " + formatDate(x.publishedAt) : " Not visible to partners until published."), wide: true, body:
    keyFacts([["Recognised revenue (all clients)", h(money(x.revenue))], ["Recognised expenses", "− " + h(money(x.recognisedExpenses))], ["Approved adjustments", h(money(x.adjustments))], ["Shared net profit (to distribute)", "<strong>" + h(money(x.distributable)) + "</strong>"],
      ["Developer allocation · 30%", h(money(x.developer)) + " (paid " + h(money(x.paidDeveloper)) + ", pending " + h(money(x.pendingDeveloper)) + ")"], ["Business partners combined · 70%", h(money(x.partners)) + " (paid " + h(money(x.paidPartners)) + ", pending " + h(money(x.pendingPartners)) + ")"], ["Partner-level allocation rule", '<span class="muted">Not defined. No individual shares are calculated.</span>']]) +
    "<h3>Adjustments</h3>" + (x.adjustmentList.map((a) => row(h(money(a.amount)), formatDateTime(a.at) + " · " + h(a.by) + " · " + h(a.reason))).join("") || '<p class="muted small">None.</p>') +
    (x.status !== "Paid" ? '<fieldset class="inline-form"><legend>Add adjustment</legend>' + input("Amount (₱, negative to reduce)", "da-amount", "", { type: "number", step: "0.01" }) + textarea("Reason", "da-reason", "", { rows: 2 }) + formError("da-error") + button("Add adjustment", "dist-adj", { id: month, cls: "btn-small", submit: true }) + "</fieldset>" : "") +
    "<h3>Payouts</h3>" + (x.payouts.map((p) => row(h(p.recipient), formatDate(p.date) + " · " + h(p.reference), "<strong>" + h(money(p.amount)) + "</strong>")).join("") || '<p class="muted small">No payouts recorded.</p>') +
    (x.status !== "Draft" && x.pending > 0 ? '<fieldset class="inline-form"><legend>Record payout made outside ThryveMS</legend>' + select("Recipient", "po-to", "Developer", ["Developer", "Partners (combined)"]) + input("Amount (₱)", "po-amount", "", { type: "number", min: 0, step: "0.01" }) + input("Transfer reference", "po-ref", "") + formError("po-error") + button("Record payout", "dist-payout", { id: month, cls: "btn-small", submit: true }) + "</fieldset>" : ""),
    footer: button("Close", "close") + (x.status === "Draft" ? button("Publish to partners", "dist-publish", { id: month, cls: "btn-primary", disabled: month >= CURRENT_MONTH, disabledReason: "The period is still open" }) : "") });
}

/* ----------------------------------------------------------------- actions */

const formData = () => readForm(document.querySelector("[data-form]"));
function finish(res, msg, errId) { if (!res.ok) return showFormError(res.error, errId); closeOverlay(true); rerender(); notify(msg); }

export const actions = {
  "sp-export": () => { const csv = profitCsv(currentPeriod().months).map((r) => r.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(",")).join("\n"); window.__lastExport = csv; const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "thryvems-shared-profit.csv"; document.body.appendChild(a); a.click(); a.remove(); notify("Statement exported"); },
  "cost-add": () => sheet({ title: "Add cost entry", description: "Manual or estimated actual cost. Reconciled amounts come from provider imports (not connected).", body:
    '<div class="form-grid">' + select("Category", "c-cat", "", COST_CATEGORIES, { placeholder: "Choose a category" }) + input("Provider", "c-prov", "") + select("Month", "c-month", CURRENT_MONTH, MONTHS.map((m) => ({ value: m, label: monthLabel(m) }))) + select("Basis", "c-basis", "Manual", ["Manual", "Estimate"]) +
    combobox("Applies to", "c-scope", "", ["Shared", "Unallocated", ...getData().clients.filter((c) => ["Live", "Suspended"].includes(c.accountStatus)).map((c) => c.name)], { hint: "Type a client name, Shared or Unallocated." }) + input("Amount (₱)", "c-php", "", { type: "number", min: 0, step: "0.01" }) + "</div>" + input("Source", "c-src", "", { hint: "Where the amount comes from, e.g. 'AWS bill October'." }) + formError(),
    footer: button("Cancel", "close") + button("Add cost", "cost-save", { cls: "btn-primary", submit: true, primary: true }) }),
  "cost-save": () => {
    const f = formData();
    const sc = String(f["c-scope"] || "").trim().toLowerCase();
    const scope = sc === "shared" ? "shared" : sc === "unallocated" ? "unallocated" : getData().clients.find((c) => c.name.toLowerCase() === sc)?.id || "";
    finish(addCost({ category: f["c-cat"], provider: f["c-prov"], month: f["c-month"], basis: f["c-basis"], scope, php: f["c-php"], source: f["c-src"] }), "Cost entry added");
  },
  "price-edit": () => {
    const p = currentPricing(getData());
    sheet({ title: "Change pricing", description: "New pricing applies from a future date. Prices remain illustrative until approved.", body:
      '<div class="form-grid">' + input("Base subscription per month (₱)", "pr-base", p.basePrice, { type: "number", min: 0 }) + input("Base users included", "pr-users", p.baseUsers, { type: "number", min: 1 }) + input("Additional seat rate (₱)", "pr-rate", p.additionalRate, { type: "number", min: 0 }) +
      input("Minimum seats", "pr-min", p.minSeats, { type: "number", min: 1 }) + input("Enterprise customization fee (₱)", "pr-ent", p.enterpriseFee, { type: "number", min: 0 }) + input("Effective from", "pr-eff", "2026-11-01", { type: "date", min: addDays(TODAY, 1) }) + "</div>" + textarea("Reason", "pr-reason", "", { rows: 2 }) + formError(),
      footer: button("Cancel", "close") + button("Save pricing", "price-save", { cls: "btn-primary", submit: true, primary: true }) });
  },
  "price-save": () => { const f = formData(); finish(updatePricing({ basePrice: f["pr-base"], baseUsers: f["pr-users"], additionalRate: f["pr-rate"], minSeats: f["pr-min"], enterpriseFee: f["pr-ent"], effectiveFrom: f["pr-eff"], reason: f["pr-reason"] }), "Pricing scheduled from " + formatDate(f["pr-eff"])); },
  "adj-add": () => sheet({ title: "Record commercial adjustment", description: "Recorded in " + monthLabel(CURRENT_MONTH) + " (the open month).", body:
    combobox("Client", "j-client", "", getData().clients.filter((c) => c.accountStatus !== "Archived").map((c) => c.name)) + select("Kind", "j-kind", "Discount", ["Discount", "Credit note"]) + input("Amount, net of VAT (₱)", "j-amt", "", { type: "number", min: 0, step: "0.01" }) + textarea("Reason and approval", "j-reason", "", { rows: 2 }) + formError(),
    footer: button("Cancel", "close") + button("Record adjustment", "adj-save", { cls: "btn-primary", submit: true, primary: true }) }),
  "adj-save": () => { const f = formData(); const c = getData().clients.find((x) => x.name.toLowerCase() === String(f["j-client"] || "").trim().toLowerCase()); finish(addAdjustment({ clientId: c?.id, kind: f["j-kind"], amount: f["j-amt"], reason: f["j-reason"] }), "Adjustment recorded"); },
  "ent-create": () => sheet({ title: "Create enterprise project", description: "Standard one-time fee " + money(currentPricing(getData()).enterpriseFee) + " per client. Other amounts need an approved exception.", body:
    combobox("Client", "en-client", "", getData().clients.filter((c) => c.accountStatus !== "Archived").map((c) => c.name)) + '<div class="form-grid">' + input("Project name", "en-name", "") + select("Customization type", "en-type", "Feature", ["Feature", "Integration", "Configuration", "Report"]) +
    input("Commercial amount (₱)", "en-amt", currentPricing(getData()).enterpriseFee, { type: "number", min: 0 }) + input("Expected completion", "en-due", addDays(TODAY, 90), { type: "date" }) + input("Exception reference", "en-exref", "", { hint: "EXC-123, only for non-standard amounts." }) + input("Exception reason", "en-exwhy", "") + "</div>" + textarea("Scope", "en-scope", "", { rows: 3 }) + formError(),
    footer: button("Cancel", "close") + button("Create project", "ent-create-save", { cls: "btn-primary", submit: true, primary: true }) }),
  "ent-create-save": () => {
    const f = formData(); const c = getData().clients.find((x) => x.name.toLowerCase() === String(f["en-client"] || "").trim().toLowerCase());
    const res = createProject({ clientId: c?.id, name: f["en-name"], type: f["en-type"], amount: f["en-amt"], expectedCompletion: f["en-due"], exceptionRef: f["en-exref"], exceptionReason: f["en-exwhy"], scope: f["en-scope"], reason: "Created by platform owner" });
    if (!res.ok) return showFormError(res.error);
    closeOverlay(true); rerender(); notify("Project created in Scoping");
  },
  "ent-open": (el) => openProject(el.dataset.id),
  "ent-save": (el) => { const f = formData(); finish(updateProject(el.dataset.id, { status: f["pe-status"], expectedCompletion: f["pe-due"], notes: f["pe-notes"], approvedChange: f["pe-change"] }, f["pe-reason"]), "Project saved"); },
  "ms-done": (el) => { const res = completeMilestone(el.dataset.id, el.dataset.arg, "Milestone accepted"); if (!res.ok) return showFormError(res.error, "ms-error"); rerender(); openProject(el.dataset.id); notify("Milestone done. Invoice record " + res.number + " created (not sent)."); },
  "ms-amount": (el) => { const v = document.getElementById("ms-amt-" + el.dataset.arg)?.value; const res = editMilestoneAmount(el.dataset.id, el.dataset.arg, v); if (!res.ok) return showFormError(res.error, "ms-error"); rerender(); openProject(el.dataset.id); notify("Milestone amount saved"); },
  "ms-add": (el) => { const f = formData(); const res = addMilestone(el.dataset.id, { name: f["nm-name"], amount: f["nm-amount"], due: f["nm-due"] }); if (!res.ok) return showFormError(res.error, "ms-error"); rerender(); openProject(el.dataset.id); notify("Milestone added"); },
  "dist-open": (el) => openStatement(el.dataset.id),
  "dist-publish": (el) => { const res = publishStatement(el.dataset.id); if (!res.ok) return showFormError(res.error); closeOverlay(true); rerender(); notify("Statement published to partners"); },
  "dist-adj": (el) => { const f = formData(); const res = addDistributionAdjustment(el.dataset.id, { amount: f["da-amount"], reason: f["da-reason"] }); if (!res.ok) return showFormError(res.error, "da-error"); rerender(); openStatement(el.dataset.id); notify("Adjustment added"); },
  "dist-payout": (el) => { const f = formData(); const res = recordPayout(el.dataset.id, { recipient: f["po-to"], amount: f["po-amount"], reference: f["po-ref"] }); if (!res.ok) return showFormError(res.error, "po-error"); rerender(); openStatement(el.dataset.id); notify("Payout recorded"); },
};
