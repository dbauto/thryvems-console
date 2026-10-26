/**
 * Shared profit reporting: the same view, the same records and the same calculation in the Developer
 * Console and the Business Partner workspace. The only difference is that a partner sees records of clients
 * assigned to other partners with the amount kept and the client, description and evidence hidden.
 * No provider credentials or environment configuration appear here for anyone.
 */
import { getData, scopeClients, clientById, isDeveloper } from "../store.js";
import { sharedProfit, expenseCategories, distribution, invoiceTotals, DEVELOPER_SHARE, PARTNER_SHARE } from "../finance.js";
import { h, badge, card, dataTable, figure, figureGrid, alertBox, moneyCell, basisBadge, keyFacts, svgBars, viewChips } from "../ui.js";
import { money, pct, monthLabel, monthShort, formatDate, MONTHS, sum, round2 } from "../util.js";
import { periodFilter, currentPeriod, periodCaption } from "./shared.js";

export const POLICY = [
  ["Accounting basis", "Accrual. Revenue is recognised by service month; annual invoices are spread over 12 months."],
  ["Taxes", "Amounts exclude 12% VAT. VAT is not revenue or profit."],
  ["Refunds, discounts and credit notes", "Reduce revenue in the month they are recorded."],
  ["Exchange rates", "USD provider invoices use the rate shown on each record (synthetic rates in the preview)."],
  ["Shared infrastructure", "Split among clients live in the month, per active user."],
  ["Missing provider data", "Shown as Not available and marks totals Incomplete. Never counted as 0."],
  ["Approved adjustments", "Recorded on the monthly statement with a reason; part of net profit."],
  ["Distribution", "Developer " + DEVELOPER_SHARE * 100 + "%, Business Partners combined " + PARTNER_SHARE * 100 + "% of net profit. Losses are not distributed. Individual partner shares are not defined."],
];

/** Client ids whose details this viewer may see. */
const visibleIds = () => (isDeveloper() && location.hash.startsWith("#/dev") ? null : scopeClients("biz").map((c) => c.id));
const mask = (clientId, ids) => !!clientId && !!ids && !ids.includes(clientId);

/** Every record behind the totals, in one list, with the fields the reports need. */
export function profitRecords(data, months) {
  const want = (m) => months.includes(m);
  const out = [];
  for (const inv of data.invoices) {
    if (inv.voided) continue;
    for (const line of inv.lines) {
      const share = line.net / line.months.length;
      const n = line.months.filter(want).length;
      if (!n) continue;
      out.push({ date: inv.issueDate, month: line.months.find(want), ref: inv.number, category: inv.kind === "Enterprise" ? "Enterprise revenue" : "Subscription revenue", source: line.description, clientId: inv.clientId, amount: round2(share * n), basis: "Actual", status: invoiceTotals(data, inv).status, evidence: "Invoice " + inv.number });
    }
  }
  for (const a of data.adjustments) if (want(a.month)) out.push({ date: (a.at || a.month).slice(0, 10), month: a.month, ref: a.id, category: "Revenue adjustment", source: a.kind + ": " + a.reason, clientId: a.clientId, amount: -a.amount, basis: "Actual", status: "Approved", evidence: a.approval || "Approved" });
  for (const c of data.costs) if (want(c.month)) out.push({ date: c.month + "-28", month: c.month, ref: c.id, category: c.unallocated ? "Unallocated platform cost" : c.shared ? "Shared infrastructure" : "Direct infrastructure", source: c.category + " · " + c.provider + (c.usd != null ? " (USD " + c.usd.toFixed(2) + (c.fx ? " @ " + c.fx : "") + ")" : ""), clientId: c.clientId || null, amount: c.php == null ? null : -c.php, basis: c.basis, status: c.php == null ? "Not available" : "Recorded", evidence: c.source });
  for (const o of data.opex) if (want(o.month)) out.push({ date: o.month + "-25", month: o.month, ref: o.id, category: "Operating expense", source: o.category, clientId: null, amount: -o.php, basis: o.basis, status: "Recorded", evidence: o.source });
  for (const b of data.sharedBusiness) if (want(b.month)) out.push({ date: b.month + "-25", month: b.month, ref: b.id, category: "Shared business expense", source: b.category, clientId: null, amount: -b.php, basis: b.recognised ? "Actual" : "Pending", status: b.recognised ? "Recognised" : "Not recognised", evidence: "Shared business ledger" });
  for (const st of data.statements) if (want(st.month)) for (const a of st.adjustments) out.push({ date: (a.at || st.month).slice(0, 10), month: st.month, ref: a.id || "Statement " + st.month, category: "Approved adjustment", source: a.reason || "Statement adjustment", clientId: null, amount: a.amount, basis: "Actual", status: "Approved", evidence: "Statement " + monthLabel(st.month) });
  return out.sort((x, y) => (x.date < y.date ? 1 : -1));
}

function recordsTable(id, data, months, ids) {
  const rows = profitRecords(data, months).map((r) => (mask(r.clientId, ids) ? { ...r, hidden: true, source: "Details not shared", evidence: "Not shared" } : r));
  const who = (r) => (r.hidden ? "Another partner's client" : r.clientId ? clientById(r.clientId)?.name || "" : r.category === "Shared infrastructure" ? "Shared, split per active user" : "Company-wide");
  return dataTable({ id, caption: "Records behind the totals", rows, minWidth: 1200,
    search: (r) => r.ref + " " + r.category + " " + r.source + " " + who(r), searchLabel: "Search records",
    empty: { title: "No records", body: "Revenue, expense and adjustment records for the period appear here." },
    columns: [
      { key: "d", label: "Date", sort: (r) => r.date, cell: (r) => formatDate(r.date) + '<div class="secondary">' + h(monthShort(r.month)) + "</div>" },
      { key: "ref", label: "Reference", sort: (r) => r.ref, cell: (r) => "<code>" + h(r.ref) + "</code>" },
      { key: "cat", label: "Category", sort: (r) => r.category, cell: (r) => h(r.category) },
      { key: "src", label: "Source or vendor", cell: (r) => (r.hidden ? '<span class="muted">' + h(r.source) + "</span>" : '<span class="small">' + h(r.source) + "</span>") },
      { key: "c", label: "Client", sort: who, cell: (r) => (r.hidden ? '<span class="muted">' + h(who(r)) + "</span>" : h(who(r))) },
      { key: "b", label: "Basis", sort: (r) => r.basis, cell: (r) => basisBadge(r.basis) },
      { key: "s", label: "Status", sort: (r) => r.status, cell: (r) => badge(r.status) },
      { key: "a", label: "Amount", sort: (r) => r.amount ?? 0, cell: (r) => (r.amount == null ? '<span class="muted">Not available</span>' : moneyCell(r.amount)) },
      { key: "e", label: "Evidence", cell: (r) => '<span class="small' + (r.hidden ? " muted" : "") + '">' + h(r.evidence) + "</span>" },
    ] });
}

export function plRows(p) {
  const line = (label, note, amount, cls) => '<tr' + (cls ? ' class="' + cls + '"' : "") + "><td>" + label + (note ? '<div class="secondary">' + note + "</div>" : "") + "</td><td>" + moneyCell(amount) + "</td></tr>";
  return '<div class="table-scroll plain"><table class="data-table pl"><caption class="sr-only">How net profit is worked out</caption><thead><tr><th scope="col">Line</th><th scope="col">Amount</th></tr></thead><tbody>' +
    line("Subscription revenue", "Invoice lines by service month, excluding VAT", p.subscription) +
    line("Enterprise project revenue", "Customization milestones invoiced", p.enterprise) +
    line("Revenue adjustments", "Discounts and credit notes", p.revenueAdjustments) +
    line("<strong>Recognised revenue</strong>", "", p.revenue, "total") +
    line("Direct infrastructure", "Provider charges for one client" + (p.incomplete ? " · " + p.missingCount + " item(s) not available" : ""), -p.direct) +
    line("Shared infrastructure", "Split per active user among live clients", -p.shared) +
    line("Unallocated platform costs", "Platform tools not charged to a client", -p.unallocated) +
    line("Other operating expenses", "Accounting, workspace, licences", -p.opex) +
    line("Shared business expenses", "Recognised sales, marketing and customer success" + (p.notRecognised ? " · " + h(money(p.notRecognised)) + " not recognised" : ""), -p.sharedBusiness) +
    line("<strong>Recognised expenses</strong>" + (p.incomplete ? " " + badge("Incomplete") : ""), "", -p.expenses, "total") +
    line("Approved adjustments", p.adjustmentList.length + " on the monthly statements", p.approvedAdjustments) +
    line("<strong>Net profit</strong> · margin " + pct(p.margin), "", p.net, "total net") + "</tbody></table></div>";
}

const breakdown = (cats) => '<div class="bars">' + (cats.length ? cats.map((x) => '<div class="bar-row"><span class="bar-label"><span>' + h(x.name) + '</span><span class="num">' + h(money(x.amount)) + " · " + Math.round(x.share * 100) + '%</span></span><span class="bar" aria-hidden="true"><span style="width:' + Math.max(1, x.share * 100).toFixed(1) + '%"></span></span></div>').join("") : '<p class="muted">No data</p>') + "</div>";

function distributionCard(months, dev) {
  const d = getData();
  const rows = months.map((m) => distribution(d, m));
  const facts = [["Shared net profit", h(money(sum(rows, "net")))], ["Adjustments before distribution", h(money(0)) + ' <span class="muted">· none: every adjustment is already in net profit</span>']];
  if (dev) facts.push(["Developer · 30%", h(money(sum(rows, "developer"))) + ' <span class="muted">· pending ' + h(money(sum(rows, "pendingDeveloper"))) + "</span>"]);
  facts.push(["Business Partners combined · 70%", h(money(sum(rows, "partners"))) + ' <span class="muted">· pending ' + h(money(sum(rows, "pendingPartners"))) + "</span>"]);
  facts.push(["Individual partner shares", '<span class="muted">Not defined yet</span>']);
  return card({ title: dev ? "Distribution" : "Distribution to partners", note: "Separate from profit. Months with a loss are not distributed.", action: '<a class="table-link" href="' + (dev ? "#/dev/finance?tab=distributions" : "#/biz/finance?tab=distributions") + '">Statements</a>', body: '<div class="card-body">' + keyFacts(facts) + "</div>" });
}

/** Four figure cards with the shared totals. */
export function profitFigures(p, base) {
  return figureGrid([
    figure({ label: "Recognised revenue", value: money(p.revenue), note: "Subscriptions " + money(p.subscription) + " · enterprise " + money(p.enterprise), icon: "wallet", href: base, testid: "sp-revenue" }),
    figure({ label: "Recognised expenses", value: money(p.expenses), badge: p.incomplete ? "Incomplete" : "Complete", tone: p.incomplete ? "soon" : "done", note: "Infrastructure " + money(p.direct + p.shared + p.unallocated) + " · operating and shared " + money(p.opex + p.sharedBusiness), icon: "receipt-text", href: base, testid: "sp-expenses" }),
    figure({ label: "Shared net profit", value: money(p.net), badge: p.net >= 0 ? "Profit" : "Loss", tone: p.net >= 0 ? "done" : "overdue", note: "After approved adjustments " + money(p.approvedAdjustments), icon: "circle-check", href: base, testid: "sp-net" }),
    figure({ label: "Profit margin", value: pct(p.margin), note: "Net profit ÷ recognised revenue", icon: "percent", href: base, testid: "sp-margin" }),
  ], "Shared profit figures");
}

export const sameBanner = (p, dev) => alertBox("success", "<strong>Same figures in the " + (dev ? "Business Partner workspace" : "Developer Console") + ".</strong> " + h(periodCaption()) + ": net profit " + h(money(p.net)) + ". Both use one calculation and the same records.");

/** The Shared profit reporting page body for either workspace. */
export function profitReport(ws, r) {
  const d = getData();
  const dev = ws === "dev";
  const ids = dev ? null : visibleIds();
  const months = currentPeriod().months;
  const p = sharedProfit(d, months);
  const base = (dev ? "#/dev/finance" : "#/biz/finance") + "?tab=profit";
  const view = r.query.get("view") || "pl";
  const views = [{ id: "pl", label: "Profit and loss" }, { id: "client", label: "By client" }, { id: "trends", label: "Trends" }, { id: "budget", label: "Budget vs actual" }, { id: "statements", label: "Statement history" }];
  let body = "";
  if (view === "pl") body = '<section class="split">' + card({ title: "How net profit is worked out", note: "Net profit = recognised revenue − recognised expenses ± approved adjustments", body: plRows(p) }) +
    '<div class="stack">' + card({ title: "Expenses by category", body: breakdown(expenseCategories(d, months)) }) + distributionCard(months, dev) + "</div></section>" +
    recordsTable(dev ? "sp-records" : "bz-sp-records", d, months, ids);
  if (view === "client") {
    const mine = p.rows.filter((x) => !mask(x.client.id, ids));
    const others = p.rows.filter((x) => mask(x.client.id, ids));
    const rows = mine.map((x) => ({ name: x.client.name, href: (dev ? "#/dev/organisations/" : "#/biz/clients/") + x.client.id, revenue: x.revenue, cost: x.cost, profit: x.profit }))
      .concat(others.length ? [{ name: "Other partners' clients (" + others.length + ", combined)", hidden: true, revenue: sum(others, "revenue"), cost: sum(others, "cost"), profit: sum(others, "profit") }] : [])
      .concat([{ name: "Company-wide costs and approved adjustments", company: true, revenue: 0, cost: round2(-p.companyWide), profit: p.companyWide }]);
    body = alertBox("info", "Infrastructure costs are charged to the client they belong to, and shared infrastructure is split per active user. Other costs and adjustments stay company-wide. Rows add up to net profit " + h(money(p.net)) + ".") +
      dataTable({ id: dev ? "sp-client" : "bz-sp-client", caption: "Profit by client", rows, minWidth: 760,
        columns: [
          { key: "n", label: "Client", cell: (x) => (x.href ? '<a class="table-link" href="' + h(x.href) + '">' + h(x.name) + "</a>" : '<span class="muted">' + h(x.name) + "</span>") },
          { key: "r", label: "Revenue", sort: (x) => x.revenue, cell: (x) => moneyCell(x.revenue) },
          { key: "c", label: "Costs", sort: (x) => x.cost, cell: (x) => moneyCell(x.cost) },
          { key: "p", label: "Profit", sort: (x) => x.profit, cell: (x) => moneyCell(x.profit) },
        ] }) + '<p class="footer-caption" data-testid="sp-client-total">Total ' + h(money(round2(sum(rows, "profit")))) + "</p>";
  }
  if (view === "trends") {
    const t = MONTHS.map((m) => ({ m, p: sharedProfit(d, [m]) }));
    body = card({ title: "Revenue, expenses and net profit by month", body: '<div class="card-body">' + svgBars([{ name: "Revenue", values: t.map((x) => ({ label: monthShort(x.m), value: x.p.revenue })) }, { name: "Expenses", values: t.map((x) => ({ label: monthShort(x.m), value: x.p.expenses })) }, { name: "Net profit", values: t.map((x) => ({ label: monthShort(x.m), value: Math.max(0, x.p.net) })) }], { label: "Revenue, expenses and net profit by month", format: money }) + "</div>" +
      '<div class="table-scroll plain"><table class="data-table"><thead><tr><th scope="col">Month</th><th scope="col">Revenue</th><th scope="col">Expenses</th><th scope="col">Adjustments</th><th scope="col">Net profit</th><th scope="col">Margin</th></tr></thead><tbody>' + t.map((x) => "<tr><td>" + h(monthLabel(x.m)) + "</td><td>" + moneyCell(x.p.revenue) + "</td><td>" + moneyCell(x.p.expenses) + "</td><td>" + moneyCell(x.p.approvedAdjustments) + "</td><td>" + moneyCell(x.p.net) + "</td><td>" + pct(x.p.margin) + "</td></tr>").join("") + "</tbody></table></div>" });
  }
  if (view === "budget") body = card({ title: "Budget versus actual", body: '<div class="empty"><strong>No budget records yet</strong>Add a budget for a period to compare it with actual figures. Nothing is estimated here.</div>' });
  if (view === "statements") body = dataTable({ id: dev ? "sp-statements" : "bz-sp-statements", caption: "Statement history", rows: MONTHS.slice().reverse().map((m) => distribution(d, m)), minWidth: 760,
    columns: [
      { key: "m", label: "Period", cell: (x) => h(monthLabel(x.month)) }, { key: "n", label: "Net profit", cell: (x) => moneyCell(x.net) },
      { key: "s", label: "Statement", cell: (x) => badge(x.status) + (x.publishedAt ? '<div class="secondary">Published ' + formatDate(x.publishedAt) + "</div>" : "") },
    ] });
  return '<div class="filters">' + periodFilter() + '<span class="muted small">Accrual basis · PHP · excludes VAT · synthetic records</span></div>' + sameBanner(p, dev) + profitFigures(p, base) +
    viewChips(views, view, (id) => base + "&view=" + id, "Report views") +
    body + card({ title: "Accounting policy", note: "Applies to every figure in both workspaces.", body: '<div class="card-body">' + keyFacts(POLICY.map(([k, v]) => [k, h(v)])) + "</div>" });
}

/** CSV rows of the statement for the selected period, identical for both workspaces. */
export function profitCsv(months) {
  const p = sharedProfit(getData(), months);
  return [["line", "amount_php"], ["Subscription revenue", p.subscription], ["Enterprise project revenue", p.enterprise], ["Revenue adjustments", p.revenueAdjustments], ["Recognised revenue", p.revenue],
    ["Direct infrastructure", -p.direct], ["Shared infrastructure", -p.shared], ["Unallocated platform costs", -p.unallocated], ["Other operating expenses", -p.opex], ["Shared business expenses", -p.sharedBusiness], ["Recognised expenses", -p.expenses],
    ["Approved adjustments", p.approvedAdjustments], ["Net profit", p.net], ["Profit margin", p.margin == null ? "No data" : (p.margin * 100).toFixed(1) + "%"]];
}
