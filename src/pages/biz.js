/**
 * Business Partner workspace. Every list, count, search, figure and detail uses scopeClients("biz"):
 * the partner's assigned clients only. Company-wide finance uses the same sharedProfit() as the Developer
 * Console, so totals are identical; records of other partners' clients keep their amounts and hide their
 * details. Developers can open this workspace read-only to inspect a partner's view.
 */
import { getData, getUi, scopeClients, businessPartnerId, isInspecting, partnerOf, deploymentFor, submitRequest, withdrawRequest, updatePartnerSettings, partnerSettings } from "../store.js";
import { sharedProfit, expenseCategories, distribution, invoiceTotals, currentPricing, chargeBreakdown } from "../finance.js";
import { profitReport, profitFigures, sameBanner, plRows, profitRecords, profitCsv } from "./profit.js";
import { MODULES } from "../seed.js";
import { h, pageHeader, badge, keyFacts, dataTable, sheet, dialog, button, input, select, textarea, formError, readForm, showFormError, closeOverlay, alertBox, card, row, linkTo, moneyCell, emptyLine, figure, figureGrid, scrollList } from "../ui.js";
import { money, pct, formatDate, formatDateTime, MONTHS, monthLabel, monthShort, CURRENT_MONTH, TODAY, sum } from "../util.js";
import { tabs, notFound, periodFilter, clientFilter, selectFilter, getFilter, currentPeriod, periodCaption, invoiceTable } from "./shared.js";
import { describeRequest } from "./dev-ops.js";
import { rerender, notify } from "../registry.js";

const OPEN_START = CURRENT_MONTH + "-01";
const READONLY = "Inspection view is read-only. Switch the preview to the partner to act.";
/** A partner action. In the Developer's inspection view it is shown disabled with the reason. */
const act = (label, action, opts = {}) => (isInspecting() ? button(label, null, { ...opts, disabled: true, disabledReason: READONLY }) : button(label, action, opts));
const liveLabel = (c) => (deploymentFor(c.id)?.status === "Live" ? "Live" : "Not live yet");
const COMMERCIAL_ACTIONS = /^(Subscription|Request|Payment recorded|Commercial adjustment|Enterprise project|Milestone|Client account created|Client details edited|Business partner changed|Enabled modules changed)/;
/** Activity a partner may see: commercial actions on assigned clients. No costs, allocations, sandboxes or deployments. */
function partnerActivity(ids) {
  return getData().audit.filter((a) => a.clientId && ids.includes(a.clientId) && COMMERCIAL_ACTIONS.test(a.action));
}

/* ---------------------------------------------------------------- overview */

export function renderOverview() {
  const d = getData();
  const all = scopeClients("biz");
  const cid = getFilter("bz-client");
  const clients = all.filter((c) => !cid || c.id === cid);
  const ids = clients.map((c) => c.id);
  const p = currentPeriod();
  const sp = sharedProfit(d, p.months);
  const mine = sp.rows.filter((x) => all.some((c) => c.id === x.client.id));
  const invs = d.invoices.filter((i) => ids.includes(i.clientId)).map((i) => invoiceTotals(d, i)).filter((t) => t.outstanding > 0);
  const changes = clients.flatMap((c) => c.subscription.history.filter((x) => p.months.includes(String(x.effective).slice(0, 7))));
  const newSubs = clients.filter((c) => p.months.includes(c.subscription.startDate.slice(0, 7)));
  const dist = p.months.map((m) => distribution(d, m));
  const pl = partnerOf(businessPartnerId());
  return pageHeader({ title: "Business overview", description: "Your assigned clients and the company's shared business profit. The profit figures are the same ones the Developer sees, from the same records." }) +
    '<div class="filters" role="group" aria-label="Overview filters">' + periodFilter() + clientFilter("bz-client", all) + "</div>" +
    '<h2 class="section-title">Clients</h2>' +
    figureGrid([
      figure({ label: "Assigned clients", value: clients.length, icon: "▤", href: "#/biz/clients", testid: "bz-assigned" }),
      figure({ label: "Active subscriptions", value: clients.filter((c) => ["Active", "Past due"].includes(c.subscription.status)).length, badge: "Paid plan", tone: "done", icon: "✓", href: "#/biz/clients?tab=subscriptions" }),
      figure({ label: "Trial accounts", value: clients.filter((c) => c.subscription.status === "Trial").length, icon: "○", href: "#/biz/clients?tab=subscriptions" }),
      figure({ label: "New subscriptions", value: newSubs.length, note: periodCaption(), icon: "+", href: "#/biz/clients" }),
    ], "Client figures") +
    '<h2 class="section-title">Shared business profit <span class="muted small">— ' + h(periodCaption()) + "</span></h2>" + sameBanner(sp, false) +
    profitFigures(sp, "#/biz/finance?tab=profit") +
    figureGrid([
      figure({ label: "Outstanding invoices", value: invs.length, note: money(sum(invs, "outstanding")) + (invs.some((t) => t.status === "Overdue") ? " · includes overdue" : ""), tone: "overdue", badge: invs.some((t) => t.status === "Overdue") ? "Overdue" : null, icon: "receipt-text", href: "#/biz/finance?tab=invoices" }),
      figure({ label: "Subscription changes", value: changes.length, note: periodCaption(), icon: "arrow-down-up", href: "#/biz/clients?tab=subscriptions" }),
      figure({ label: "Revenue from your clients", value: cid ? money(mine.filter((x) => x.client.id === cid).reduce((a, x) => a + x.revenue, 0)) : money(mine.reduce((a, x) => a + x.revenue, 0)), note: "Enterprise " + money(mine.reduce((a, x) => a + x.enterprise, 0)), icon: "chart-no-axes-combined", href: "#/biz/finance?tab=profit&view=client" }),
      figure({ label: "Business Partners combined · 70%", value: money(sum(dist, "partners")), note: "Paid " + money(sum(dist, "paidPartners")) + " · individual shares not defined", icon: "users-round", href: "#/biz/finance?tab=distributions", testid: "bz-partner-pool" }),
    ], "Business figures") +
    card({ title: "Recent business activity", note: "Commercial changes on your assigned clients.", body: scrollList(partnerActivity(ids).slice(0, 15).map((a) => row(h(a.action), formatDateTime(a.at) + " · " + h(getData().clients.find((c) => c.id === a.clientId)?.name || "") + " · " + h(a.after || ""))), { title: "No activity yet", body: "Subscription changes, payments and requests appear here." }) }) +
    '<p class="footer-caption">Profit figures are company-wide and identical in the Developer Console. Individual partner shares within the combined 70% are not defined.</p>';
}

/* ----------------------------------------------------------------- clients */

export function renderClients(r) {
  const tab = r.query.get("tab") || "clients";
  const d = getData();
  const clients = scopeClients("biz");
  const ids = clients.map((c) => c.id);
  const pl = partnerOf(businessPartnerId());
  const t = [{ id: "clients", label: "Clients" }, { id: "subscriptions", label: "Subscriptions and seats" }, { id: "enterprise", label: "Enterprise projects" }];
  const header = pageHeader({ title: "Clients", description: "Clients assigned to " + h(pl.label) + ". Their QMS records and deployment details aren't available here.", actions: pl.canRequestClients ? act("Request new client", "bz-new-client", { cls: "btn-primary" }) : "" }) + tabs(t, tab, "#/biz/clients", "Client views");
  if (tab === "clients") {
    const live = getFilter("bz-live");
    const rows = clients.filter((c) => !live || liveLabel(c) === live);
    return header + dataTable({ id: "bz-clients", caption: "Assigned clients", rows, minWidth: 980,
      toolbar: '<div class="filters">' + selectFilter("bz-live", "Live status", [{ value: "", label: "All" }, { value: "Live", label: "Live" }, { value: "Not live yet", label: "Not live yet" }]) + "</div>",
      search: (c) => c.name + " " + c.contact.name + " " + c.contact.email, searchLabel: "Search clients",
      empty: { title: "No clients assigned", body: "Clients appear here when the platform owner assigns them to you." },
      columns: [
        { key: "n", label: "Client", sort: (c) => c.name, cell: (c) => linkTo(c.name, "#/biz/clients/" + c.id) + '<div class="secondary">' + h(c.contact.email) + "</div>" },
        { key: "live", label: "Live", sort: (c) => liveLabel(c), cell: (c) => badge(liveLabel(c), liveLabel(c) === "Live" ? "done" : "draft") },
        { key: "sub", label: "Subscription", sort: (c) => c.subscription.status, cell: (c) => badge(c.subscription.status) + '<div class="secondary">' + (c.subscription.planId === "trial" ? "Trial" : "Standard") + "</div>" },
        { key: "seats", label: "Seats used / purchased", sort: (c) => c.subscription.purchasedSeats, cell: (c) => h(c.subscription.activeUsers + " / " + c.subscription.purchasedSeats) },
        { key: "bill", label: "Billing status", sort: (c) => billing(c).label, cell: (c) => badge(billing(c).label, billing(c).tone) },
      ] });
  }
  if (tab === "subscriptions") {
    const p = currentPricing(d);
    return header + dataTable({ id: "bz-subs", caption: "Subscriptions and seats", rows: clients, minWidth: 1100, search: (c) => c.name, searchLabel: "Search subscriptions",
      empty: { title: "No subscriptions", body: "Subscriptions of your assigned clients appear here." },
      columns: [
        { key: "n", label: "Client", sort: (c) => c.name, cell: (c) => linkTo(c.name, "#/biz/clients/" + c.id + "?tab=subscription") },
        { key: "plan", label: "Plan", cell: (c) => (c.subscription.planId === "trial" ? "Trial" : "Standard") },
        { key: "st", label: "Status", sort: (c) => c.subscription.status, cell: (c) => badge(c.subscription.status) },
        { key: "seats", label: "Purchased seats", sort: (c) => c.subscription.purchasedSeats, cell: (c) => h(c.subscription.purchasedSeats) },
        { key: "used", label: "Used seats", sort: (c) => c.subscription.activeUsers, cell: (c) => h(c.subscription.activeUsers) },
        { key: "cyc", label: "Billing cycle", cell: (c) => h(c.subscription.billingCycle) },
        { key: "chg", label: "Monthly charge (illustrative)", cell: (c) => (c.subscription.planId === "trial" ? '<span class="muted">No charge</span>' : moneyCell(chargeBreakdown(p, c.subscription.purchasedSeats).total)) },
        { key: "ren", label: "Renewal", cell: (c) => (c.subscription.status === "Trial" ? "Trial ends " + formatDate(c.subscription.trialEnds) : c.subscription.renewalDate ? formatDate(c.subscription.renewalDate) : '<span class="muted">No data</span>') + (c.subscription.scheduled ? '<div class="secondary">' + badge("Scheduled") + "</div>" : "") },
        { key: "x", label: "Request change", srOnly: true, cell: (c) => (["Active", "Trial", "Past due"].includes(c.subscription.status) ? act("Request change", "bz-sub-req", { id: c.id, cls: "btn-small" }) : "") },
      ] });
  }
  if (tab === "enterprise") {
    const projects = d.projects.filter((p) => ids.includes(p.clientId));
    const reqs = d.requests.filter((x) => x.kind === "Enterprise customization" && x.from === businessPartnerId());
    return header + dataTable({ id: "bz-projects", caption: "Enterprise projects", rows: projects, minWidth: 1000, toolbar: '<div class="filters">' + act("Request customization", "bz-ent-req", { cls: "btn-small" }) + "</div>",
      search: (p) => p.name + " " + p.type, searchLabel: "Search projects", empty: { title: "No projects", body: "Customization projects for your clients appear here." },
      columns: [
        { key: "n", label: "Project", sort: (p) => p.name, cell: (p) => '<span class="row-primary">' + h(p.name) + '</span><div class="secondary">' + h(p.type) + " · " + h(p.scope) + "</div>" },
        { key: "c", label: "Client", cell: (p) => h(d.clients.find((c) => c.id === p.clientId)?.name || "") },
        { key: "amt", label: "Commercial amount", sort: (p) => p.amount, cell: (p) => moneyCell(p.amount) + (p.exception ? '<div class="secondary">Approved exception</div>' : "") },
        { key: "ms", label: "Milestones", cell: (p) => h(p.milestones.filter((m) => m.status === "Done").length + " of " + p.milestones.length + " done") },
        { key: "st", label: "Status", sort: (p) => p.status, cell: (p) => badge(p.status) },
        { key: "due", label: "Expected completion", sort: (p) => p.expectedCompletion, cell: (p) => formatDate(p.expectedCompletion) },
      ] }) +
      card({ title: "Your customization requests", body: reqs.map((x) => row(h(x.title), h(describeRequest(x)) + " · " + formatDateTime(x.at), badge(x.status) + (x.status === "Pending" ? " " + act("Withdraw", "bz-withdraw", { id: x.id, cls: "btn-small btn-quiet" }) : ""))).join("") || emptyLine("No requests", "Request a customization for one of your clients.") });
  }
  return notFound();
}
function billing(c) {
  const d = getData();
  const ts = d.invoices.filter((i) => i.clientId === c.id).map((i) => invoiceTotals(d, i));
  if (ts.some((t) => t.status === "Overdue")) return { label: "Overdue", tone: "overdue" };
  if (ts.some((t) => t.outstanding > 0)) return { label: "Open invoice", tone: "progress" };
  if (!ts.length) return { label: "No invoices", tone: "draft" };
  return { label: "Paid", tone: "done" };
}

export function renderClient(id, r) {
  const c = scopeClients("biz").find((x) => x.id === id);
  if (!c) return notFound();
  const d = getData();
  const tab = r.query.get("tab") || "account";
  const t = [{ id: "account", label: "Account" }, { id: "subscription", label: "Subscription and seats" }, { id: "billing", label: "Billing" }, { id: "enterprise", label: "Enterprise" }, { id: "history", label: "History" }];
  const s = c.subscription;
  const p = currentPricing(d);
  let body;
  if (tab === "account") body = card({ title: "Account", note: "Contact and account information for business operations.", body: '<div class="card-body">' + keyFacts([
    ["Client", h(c.name)], ["Industry", h(c.industry)], ["Live status", badge(liveLabel(c), liveLabel(c) === "Live" ? "done" : "draft")], ["Account since", formatDate(c.createdAt)],
    ["Contact", h(c.contact.name)], ["Contact email", h(c.contact.email)], ["Contact phone", h(c.contact.phone || "")], ["Enabled modules", h(c.modules.join(", "))],
  ]) + '<p class="small muted">Deployment details, versions and the client\'s QMS records aren\'t available in the Business workspace.</p></div>' });
  else if (tab === "subscription") {
    const b = chargeBreakdown(p, s.purchasedSeats);
    const usage = Math.min(100, Math.round((s.activeUsers / Math.max(1, s.purchasedSeats)) * 100));
    body = card({ title: "Subscription and seats", note: "Pricing is illustrative and not approved.", action: ["Active", "Trial", "Past due"].includes(s.status) ? act("Request subscription change", "bz-sub-req", { id: c.id, cls: "btn-small" }) : "", body: '<div class="card-body">' + keyFacts([
      ["Plan", s.planId === "trial" ? "Trial" : "Standard"], ["Status", badge(s.status)], ["Billing cycle", h(s.billingCycle)], ["Purchased seats", h(s.purchasedSeats)], ["Used seats", h(s.activeUsers)],
      ["Monthly charge", s.planId === "trial" ? "No charge" : h(money(b.base)) + (b.extra ? " + " + b.extra + " × " + h(money(p.additionalRate)) : "") + " = " + h(money(b.total))], ["Renewal", s.renewalDate ? formatDate(s.renewalDate) : null], ["Trial ends", s.trialEnds ? formatDate(s.trialEnds) : null],
    ]) + '<div class="seat-meter"><div class="seat-bar"><span style="width:' + usage + '%"></span></div><span class="tiny muted">' + s.activeUsers + " of " + s.purchasedSeats + " seats in use</span></div>" +
      (s.scheduled ? alertBox("info", "Scheduled change from " + formatDate(s.scheduled.effective) + ": " + s.scheduled.seats + " seats, " + h(s.scheduled.billingCycle) + ".") : "") + "</div>" }) +
      card({ title: "Subscription changes", body: s.history.map((x) => row(h(x.field) + ": " + h(x.from) + " → " + h(x.to), "Effective " + formatDate(x.effective) + " · " + h(x.reason))).join("") || emptyLine("No changes", "") });
  } else if (tab === "billing") body = invoiceTable("bz-inv-" + c.id, d.invoices.filter((i) => i.clientId === c.id)) + '<p class="footer-caption">Invoice and payment status. Payments are recorded by the platform owner; online payment is a future phase.</p>';
  else if (tab === "enterprise") body = card({ title: "Enterprise projects", action: act("Request customization", "bz-ent-req", { id: c.id, cls: "btn-small" }), body: d.projects.filter((x) => x.clientId === c.id).map((x) => row(h(x.name), h(x.type) + " · " + h(money(x.amount)) + " · expected " + formatDate(x.expectedCompletion), badge(x.status))).join("") || emptyLine("No projects", "") });
  else if (tab === "history") body = card({ title: "Commercial account history", body: partnerActivity([c.id]).map((a) => row(h(a.action), formatDateTime(a.at) + " · " + h(a.actor) + " · " + h(a.before || "—") + " → " + h(a.after || "—") + " · " + h(a.reason || ""))).join("") || emptyLine("No history", "Commercial changes for this client appear here.") });
  else return notFound();
  return pageHeader({ title: c.name, crumbs: [{ label: "Clients", href: "#/biz/clients" }, { label: c.name }], description: badge(liveLabel(c), liveLabel(c) === "Live" ? "done" : "draft") + " " + badge(s.status) }) + tabs(t, tab, "#/biz/clients/" + c.id, "Client sections") + body;
}

/* ----------------------------------------------------------------- finance */

export function renderFinance(r) {
  const tab = r.query.get("tab") || "overview";
  const d = getData();
  const all = scopeClients("biz");
  const ids = all.map((c) => c.id);
  const t = [{ id: "overview", label: "Overview" }, { id: "revenue-expenses", label: "Revenue and expenses" }, { id: "profit", label: "Shared profit reporting" }, { id: "invoices", label: "Invoices" }, { id: "distributions", label: "Distributions" }, { id: "reports", label: "Reports" }];
  const head = pageHeader({ title: "Finance", description: "The company's revenue, actual expenses and shared net profit, the same figures the Developer sees. Details of other partners' clients stay hidden." }) + tabs(t, tab, "#/biz/finance", "Finance sections");
  const p = currentPeriod();
  const sp = sharedProfit(d, p.months);
  if (tab === "overview") {
    const dist = p.months.map((m) => distribution(d, m));
    const trend = MONTHS.map((m) => ({ m, s: sharedProfit(d, [m]) }));
    return head + '<div class="filters">' + periodFilter() + "</div>" + sameBanner(sp, false) + profitFigures(sp, "#/biz/finance?tab=profit") +
      '<section class="split">' + card({ title: "How net profit is worked out", note: h(periodCaption()), body: plRows(sp) }) +
      card({ title: "Distribution to partners", note: "From the same net profit. Losses are not distributed.", body: '<div class="card-body">' + keyFacts([["Shared net profit", h(money(sum(dist, "net")))], ["Business Partners combined · 70%", h(money(sum(dist, "partners")))], ["Paid", h(money(sum(dist, "paidPartners")))], ["Pending", h(money(sum(dist, "pendingPartners")))], ["Individual partner shares", '<span class="muted">Not defined yet</span>']]) + "</div>" }) + "</section>" +
      card({ title: "Month by month", body: '<div class="table-scroll"><table class="data-table" style="min-width:640px"><thead><tr><th scope="col">Month</th><th scope="col">Revenue</th><th scope="col">Recognised expenses</th><th scope="col">Net profit</th><th scope="col">Margin</th></tr></thead><tbody>' + trend.map((x) => "<tr><td>" + h(monthLabel(x.m)) + "</td><td>" + moneyCell(x.s.revenue) + "</td><td>" + moneyCell(x.s.expenses) + "</td><td>" + moneyCell(x.s.net) + "</td><td>" + pct(x.s.margin) + "</td></tr>").join("") + "</tbody></table></div>" });
  }
  if (tab === "revenue-expenses") {
    const cats = expenseCategories(d, p.months);
    const recs = profitRecords(d, p.months).map((x) => (x.clientId && !ids.includes(x.clientId) ? { ...x, hidden: true } : x));
    const byCat = (re) => recs.filter((x) => re.test(x.category));
    return head + '<div class="filters">' + periodFilter() + "</div>" +
      figureGrid([
        figure({ label: "Recognised revenue", value: money(sp.revenue), note: byCat(/revenue|Revenue adjustment/).length + " records", icon: "wallet" }),
        figure({ label: "Actual infrastructure", value: money(sp.direct + sp.shared + sp.unallocated), badge: sp.incomplete ? "Incomplete" : "Complete", tone: sp.incomplete ? "soon" : "done", icon: "server" }),
        figure({ label: "Operating expenses", value: money(sp.opex), icon: "building-2" }),
        figure({ label: "Shared business expenses", value: money(sp.sharedBusiness), icon: "users-round" }),
      ], "Revenue and expense figures") +
      card({ title: "Expenses by category", note: "Every category behind recognised expenses, for all clients.", body: cats.map((x) => row(h(x.name), h(x.group) + " · " + Math.round(x.share * 100) + "%", "<strong>" + h(money(x.amount)) + "</strong>")).join("") || emptyLine("No expenses", "") }) +
      card({ title: "Records behind the totals", note: "Open Shared profit reporting to search every record. Other partners' clients show the amount only.", action: '<a class="table-link" href="#/biz/finance?tab=profit">Open the records</a>', body: '<div class="card-body">' + keyFacts([["Records in the period", h(recs.length)], ["Hidden details (other partners' clients)", h(recs.filter((x) => x.hidden).length)]]) + "</div>" });
  }
  if (tab === "profit") return head + profitReport("biz", r);
  if (tab === "invoices") {
    const st = getFilter("bz-inv-status");
    const invs = d.invoices.filter((i) => ids.includes(i.clientId) && (!st || invoiceTotals(d, i).status === st));
    const totals = invs.map((i) => invoiceTotals(d, i));
    return head + figureGrid([
      figure({ label: "Invoices", value: invs.length, icon: "receipt-text" }), figure({ label: "Invoiced (gross)", value: money(sum(totals, "gross")), icon: "wallet" }),
      figure({ label: "Paid", value: money(sum(totals, "paid")), icon: "circle-check" }), figure({ label: "Outstanding", value: money(sum(totals, "outstanding")), tone: "overdue", badge: totals.some((x) => x.status === "Overdue") ? "Overdue" : null, icon: "triangle-alert" }),
    ], "Invoice figures") + invoiceTable("bz-invoices", invs, { toolbar: '<div class="filters">' + selectFilter("bz-inv-status", "Payment status", [{ value: "", label: "All statuses" }, ...["Issued", "Partly paid", "Paid", "Overdue"].map((x) => ({ value: x, label: x }))]) + "</div>" });
  }
  if (tab === "distributions") {
    const statements = MONTHS.slice().reverse().map((m) => distribution(d, m));
    const visible = statements.filter((x) => x.status !== "Draft");
    const hidden = statements.filter((x) => x.status === "Draft");
    return head + alertBox("info", "Business Partners combined receive <strong>70%</strong> of the shared net profit; the Developer receives 30%. It is the same net profit you see in Shared profit reporting. Losses are not distributed. <strong>Individual partner shares are not defined yet</strong>, so no personal amount is shown. Statements appear here once the platform owner publishes them.") +
      dataTable({ id: "bz-dist", caption: "Published distribution statements", rows: visible, minWidth: 1100,
        empty: { title: "No published statements", body: "Statements appear after a month closes and the platform owner publishes it." },
        columns: [
          { key: "m", label: "Reporting period", cell: (x) => h(monthLabel(x.month)) + '<div class="secondary">Published ' + formatDate(x.publishedAt) + "</div>" },
          { key: "rev", label: "Revenue", cell: (x) => moneyCell(x.revenue) },
          { key: "exp", label: "Recognised expenses", cell: (x) => moneyCell(x.recognisedExpenses) },
          { key: "adj", label: "Approved adjustments", cell: (x) => moneyCell(x.adjustments) },
          { key: "dist", label: "Shared net profit", cell: (x) => moneyCell(x.distributable) },
          { key: "dev", label: "Developer 30%", cell: (x) => moneyCell(x.developer) },
          { key: "par", label: "Partners combined 70%", cell: (x) => moneyCell(x.partners) },
          { key: "paid", label: "Partners paid / pending", cell: (x) => moneyCell(x.paidPartners) + '<div class="secondary">Pending ' + h(money(x.pendingPartners)) + "</div>" },
          { key: "st", label: "Status", cell: (x) => badge(x.status) },
        ] }) +
      (hidden.length ? '<p class="footer-caption">' + h(hidden.map((x) => monthLabel(x.month)).join(", ")) + ": not published yet. Their figures are already visible in Shared profit reporting.</p>" : "");
  }
  if (tab === "reports") {
    return head + '<div class="filters">' + periodFilter() + act("Export CSV", "bz-export", { cls: "btn-small" }) + "</div>" +
      card({ title: "Shared profit statement", note: h(periodCaption()) + ". Identical to the Developer's export for the same period.", body: plRows(sp) }) +
      '<p class="footer-caption">The export contains the statement lines shown here: company-wide totals only, no client details.</p>';
  }
  return notFound();
}

/* ---------------------------------------------------------------- requests */

export function renderRequests() {
  const d = getData();
  const pid = businessPartnerId();
  const pl = partnerOf(pid);
  const rows = d.requests.filter((x) => x.from === pid);
  return pageHeader({ title: "Requests", description: "Requests you sent to the platform owner. Decisions appear here with the reason.",
    actions: act("Request subscription change", "bz-sub-req", { cls: "btn-primary" }) + act("Request customization", "bz-ent-req") + (pl.canRequestClients ? act("Request new client", "bz-new-client") : "") }) +
    dataTable({ id: "bz-requests", caption: "Your requests", rows, minWidth: 1000, search: (x) => x.title + " " + x.kind, searchLabel: "Search requests",
      empty: { title: "No requests yet", body: "Ask for seat changes, customization projects or new client accounts." },
      columns: [
        { key: "k", label: "Type", sort: (x) => x.kind, cell: (x) => badge(x.kind, "progress") },
        { key: "t", label: "Request", sort: (x) => x.title, cell: (x) => '<span class="row-primary">' + h(x.title) + '</span><div class="secondary">' + h(describeRequest(x)) + "</div>" },
        { key: "at", label: "Sent", sort: (x) => x.at, cell: (x) => formatDateTime(x.at) },
        { key: "s", label: "Status", sort: (x) => x.status, cell: (x) => badge(x.status) + (x.decision ? '<div class="secondary">' + h(x.decision.reason) + "</div>" : "") },
        { key: "x", label: "Actions", srOnly: true, cell: (x) => (x.status === "Pending" ? act("Withdraw", "bz-withdraw", { id: x.id, cls: "btn-small btn-quiet" }) : "") },
      ] });
}

/* ---------------------------------------------------------------- settings */

export function renderSettings() {
  const pid = businessPartnerId();
  const pl = partnerOf(pid);
  const s = partnerSettings(pid);
  return pageHeader({ title: "Business settings", description: "Your preferences for the Business workspace." }) +
    card({ title: "Preferences", body: '<form class="card-body" data-inline-form="bz-settings">' + input("Display name", "bs-name", s.displayName) +
      select("Default reporting period", "bs-period", s.reportPeriod, ["Month", "Quarter", "Year"]) +
      '<fieldset class="field"><legend>Notifications</legend><label class="ms-item"><input type="checkbox" name="bs-req" value="1"' + (s.notifyRequests ? " checked" : "") + " /> When a request is decided</label>" +
      '<label class="ms-item"><input type="checkbox" name="bs-inv" value="1"' + (s.notifyInvoices ? " checked" : "") + " /> When a client invoice becomes overdue</label><small>Preview only: no email is sent.</small></fieldset>" +
      formError("bs-error") + act("Save settings", "bz-settings-save", { cls: "btn-primary", submit: true }) + "</form>" }) +
    card({ title: "Your authority", note: "Set by the platform owner.", body: '<div class="card-body">' + keyFacts([["Partner", h(pl.label)], ["Assigned clients", h(scopeClients("biz").length)], ["Seat changes", "Request up to " + pl.seatAuthority + " seats per client; the platform owner approves"], ["New client accounts", pl.canRequestClients ? "By request, approved by the platform owner" : "Not allowed"], ["Sign-in", "Cloudflare Access + WorkOS passkey (production)"]]) + "</div>" });
}

/* ----------------------------------------------------------------- actions */

const formData = (sel = "[data-form]") => readForm(document.querySelector(sel));
function finish(res, msg) { if (!res.ok) return showFormError(res.error); closeOverlay(true); rerender(); notify(msg); }
const clientOptions = () => scopeClients("biz").filter((c) => ["Active", "Trial", "Past due"].includes(c.subscription.status)).map((c) => ({ value: c.id, label: c.name }));

export const actions = {
  "bz-sub-req": (el) => {
    const opts = clientOptions();
    const p = currentPricing(getData());
    sheet({ title: "Request subscription change", description: "The platform owner approves the change. Seat counts can't go below the client's active users.", body:
      select("Client", "br-client", el.dataset.id || "", opts, { placeholder: "Choose a client" }) + '<div class="form-grid">' + input("Purchased seats", "br-seats", el.dataset.id ? scopeClients("biz").find((c) => c.id === el.dataset.id)?.subscription.purchasedSeats : "", { type: "number", min: p.minSeats, hint: "Base includes " + p.baseUsers + " users. Minimum " + p.minSeats + "." }) +
      select("Billing cycle", "br-cycle", "", ["Monthly", "Annual"], { placeholder: "Keep current" }) + input("Effective date", "br-eff", "2026-11-01", { type: "date", min: OPEN_START }) + "</div>" + textarea("Reason", "br-reason", "", { rows: 2 }) + formError(),
      footer: button("Cancel", "close") + button("Send request", "bz-sub-save", { cls: "btn-primary", submit: true, primary: true }) });
  },
  "bz-sub-save": () => { const f = formData(); finish(submitRequest("Seat change", { clientId: f["br-client"], seats: f["br-seats"], billingCycle: f["br-cycle"] || null, effective: f["br-eff"], reason: f["br-reason"] }), "Request sent to the platform owner"); },
  "bz-ent-req": (el) => sheet({ title: "Request customization", description: "Standard one-time fee " + money(currentPricing(getData()).enterpriseFee) + " per client unless an exception is approved.", body:
    select("Client", "be-client", el.dataset.id || "", scopeClients("biz").map((c) => ({ value: c.id, label: c.name })), { placeholder: "Choose a client" }) + input("Project name", "be-name", "") + select("Customization type", "be-type", "Feature", ["Feature", "Integration", "Configuration", "Report"]) + textarea("Scope", "be-scope", "", { rows: 3 }) + textarea("Reason", "be-reason", "", { rows: 2 }) + formError(),
    footer: button("Cancel", "close") + button("Send request", "bz-ent-save", { cls: "btn-primary", submit: true, primary: true }) }),
  "bz-ent-save": () => { const f = formData(); finish(submitRequest("Enterprise customization", { clientId: f["be-client"], name: f["be-name"], type: f["be-type"], scope: f["be-scope"], reason: f["be-reason"] }), "Request sent to the platform owner"); },
  "bz-new-client": () => sheet({ title: "Request new client", description: "The platform owner creates the account after approval. It starts as a trial and isn't deployed until provisioning.", body:
    input("Organisation name", "bn-name", "") + input("Users for the trial", "bn-seats", 10, { type: "number", min: 1, max: 10 }) + input("Client contact email", "bn-email", "", { type: "email" }) + textarea("Reason", "bn-reason", "", { rows: 2 }) + formError(),
    footer: button("Cancel", "close") + button("Send request", "bz-new-save", { cls: "btn-primary", submit: true, primary: true }) }),
  "bz-new-save": () => { const f = formData(); finish(submitRequest("New client account", { name: f["bn-name"], seats: f["bn-seats"], contactEmail: f["bn-email"], reason: f["bn-reason"] }), "Request sent to the platform owner"); },
  "bz-withdraw": (el) => dialog({ title: "Withdraw request?", description: "The platform owner won't be able to decide it.", body: formError(), footer: button("Keep request", "close") + button("Withdraw request", "bz-withdraw-confirm", { id: el.dataset.id, cls: "btn-danger", submit: true }) }),
  "bz-withdraw-confirm": (el) => finish(withdrawRequest(el.dataset.id), "Request withdrawn"),
  "bz-settings-save": () => { const f = formData("[data-inline-form=bz-settings]"); const res = updatePartnerSettings({ displayName: f["bs-name"], reportPeriod: f["bs-period"], notifyRequests: (f["bs-req"] || []).length > 0, notifyInvoices: (f["bs-inv"] || []).length > 0 }); if (!res.ok) return showFormError(res.error, "bs-error"); rerender(); notify("Settings saved"); },
  "bz-export": () => {
    const rows = profitCsv(currentPeriod().months);
    const csv = rows.map((r) => r.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(",")).join("\n");
    window.__lastExport = csv;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "thryvems-shared-profit.csv"; document.body.appendChild(a); a.click(); a.remove();
    notify("Exported " + (rows.length - 1) + " statement lines");
  },
};
export { getUi, MODULES, TODAY };
