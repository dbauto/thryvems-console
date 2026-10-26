/** Pieces shared by both workspaces: Not found, filters, invoice sheet (with future payment design), history table. */
import { getUi, saveUi, getData, clientById, isDeveloper, recordPayment, partnerOf } from "../store.js";
import { invoiceTotals } from "../finance.js";
import { h, pageHeader, badge, keyFacts, dataTable, sheet, button, input, formError, readForm, showFormError, closeOverlay, alertBox, moneyCell, viewChips } from "../ui.js";
import { PERIODS, periodById, periodRange, money, formatDate, formatDateTime, TODAY } from "../util.js";
import { registry, rerender, notify } from "../registry.js";

export function notFound() {
  const ui = getUi();
  const home = ui.role === "partner" ? "#/biz" : ui.role === "developer" ? "#/dev" : null;
  return pageHeader({ title: "Page not found", description: "This page or record doesn't exist, or you don't have access to it." }) +
    (home ? '<p><a href="' + home + '">Go to the overview</a></p>' : '<p class="muted">Client users sign in to their own ThryveMS workspace. The platform and business consoles are not available to them.</p>');
}

/* ------------------------------------------------------------------ filters */

const filters = new Map();
export const getFilter = (key, def = "") => (filters.has(key) ? filters.get(key) : def);
export const setFilter = (key, v) => filters.set(key, v);

export function periodFilter(id = "period") {
  const ui = getUi();
  return '<div class="field compact"><label for="' + id + '">Reporting period</label><select id="' + id + '" data-change="period">' +
    ["Month", "Quarter", "Year"].map((kind) => '<optgroup label="' + kind + '">' + PERIODS.filter((p) => p.kind === kind).map((p) => '<option value="' + p.id + '"' + (p.id === ui.period ? " selected" : "") + ">" + h(p.label) + "</option>").join("") + "</optgroup>").join("") + "</select></div>";
}
export const currentPeriod = () => periodById(getUi().period);
export const periodCaption = () => { const p = currentPeriod(); return p.kind + ": " + periodRange(p); };

/** Searchable client filter. Typing matches names; choosing "All clients" clears it. */
export function clientFilter(key, clients) {
  const sel = getFilter(key);
  const c = sel ? clients.find((x) => x.id === sel) : null;
  return '<div class="field compact"><label for="cf-' + key + '">Client</label><input id="cf-' + key + '" type="search" list="cf-' + key + '-list" autocomplete="off" placeholder="All clients — type to search" value="' + h(c ? c.name : "") + '" data-change="client-filter" data-key="' + key + '" /><datalist id="cf-' + key + '-list">' + clients.map((x) => '<option value="' + h(x.name) + '"></option>').join("") + "</datalist></div>";
}
export function selectFilter(key, label, options, def = "") {
  const v = getFilter(key, def);
  return '<div class="field compact"><label for="sf-' + key + '">' + h(label) + '</label><select id="sf-' + key + '" data-change="filter" data-key="' + key + '">' + options.map((o) => { const val = typeof o === "string" ? o : o.value, l = typeof o === "string" ? o : o.label; return '<option value="' + h(val) + '"' + (val === v ? " selected" : "") + ">" + h(l) + "</option>"; }).join("") + "</select></div>";
}
registry.changes.period = (t) => { const ui = getUi(); ui.period = t.value; saveUi(); rerender(); };
registry.changes.filter = (t) => { setFilter(t.dataset.key, t.value); rerender(); };
registry.changes["client-filter"] = (t) => {
  const name = t.value.trim().toLowerCase();
  const c = getData().clients.find((x) => x.name.toLowerCase() === name);
  setFilter(t.dataset.key, c ? c.id : "");
  rerender();
};

/** Tabs for a page, as links so each tab has its own address. */
export const tabs = (items, active, base, label) => viewChips(items, active, (id) => base + "?tab=" + id, label);

/* ------------------------------------------------------------------ invoices */

export function invoiceRows(invoices) {
  const d = getData();
  return invoices.map((inv) => ({ inv, t: invoiceTotals(d, inv), client: clientById(inv.clientId) }));
}
export function invoiceTable(id, invoices, opts = {}) {
  return dataTable({
    id, caption: "Invoices", rows: invoiceRows(invoices), minWidth: 900,
    search: (r) => r.inv.number + " " + (r.client?.name || "") + " " + r.t.status,
    searchLabel: "Search invoices", toolbar: opts.toolbar,
    empty: { title: "No invoices", body: "Invoices for the selected clients and period appear here." },
    columns: [
      { key: "n", label: "Invoice", sort: (r) => r.inv.number, cell: (r) => '<button type="button" class="table-link" data-act="open-invoice" data-id="' + h(r.inv.id) + '">' + h(r.inv.number) + '</button><div class="secondary">' + h(r.inv.kind) + "</div>" },
      { key: "c", label: "Client", sort: (r) => r.client?.name || "", cell: (r) => h(r.client?.name || "") },
      { key: "d", label: "Issued", sort: (r) => r.inv.issueDate, cell: (r) => formatDate(r.inv.issueDate) },
      { key: "due", label: "Due", sort: (r) => r.inv.dueDate, cell: (r) => formatDate(r.inv.dueDate) },
      { key: "g", label: "Gross (incl. VAT)", sort: (r) => r.t.gross, cell: (r) => moneyCell(r.t.gross) },
      { key: "o", label: "Outstanding", sort: (r) => r.t.outstanding, cell: (r) => moneyCell(r.t.outstanding) },
      { key: "s", label: "Payment status", sort: (r) => r.t.status, cell: (r) => badge(r.t.status) },
    ],
  });
}

const PAYMENT_STATES = {
  processing: ["Payment processing", "The payment provider is confirming the payment. Don't close the page.", "progress"],
  success: ["Payment received", "Reference shown here once the provider confirms it by signed webhook.", "done"],
  failure: ["Payment failed", "The provider declined the payment. Nothing was charged. Try another method.", "overdue"],
  pending: ["Payment pending", "Bank or e-wallet confirmation can take up to 1 business day.", "soon"],
  retry: ["Retry payment", "Start a new hosted checkout for the outstanding amount.", "progress"],
  refund: ["Refund requested", "Refunds are reviewed by the platform owner and shown on the invoice when issued as a credit note.", "soon"],
};
let paymentPreview = "processing";

export function openInvoice(id) {
  const d = getData();
  const inv = d.invoices.find((x) => x.id === id);
  const c = inv && clientById(inv.clientId);
  // Partners only reach invoices of assigned clients; anything else is Not found.
  if (!inv || !c || (!isDeveloper() && c.partnerId !== (getUi().role === "partner" ? getUi().partner : getUi().inspect))) {
    sheet({ title: "Invoice not found", description: "This invoice doesn't exist or you don't have access to it.", body: "" });
    return;
  }
  const t = invoiceTotals(d, inv);
  const pays = d.payments.filter((p) => p.invoiceId === inv.id);
  const canRecord = isDeveloper() && getUi().role === "developer" && location.hash.startsWith("#/dev") && t.outstanding > 0;
  const state = PAYMENT_STATES[paymentPreview];
  const body = keyFacts([
    ["Client", h(c.name)], ["Invoice", h(inv.number)], ["Kind", h(inv.kind)], ["Status", badge(t.status)],
    ["Issued", formatDate(inv.issueDate)], ["Due", formatDate(inv.dueDate)],
    ["Net", h(money(t.net))], ["VAT 12%", h(money(t.vat))], ["Gross", h(money(t.gross))], ["Paid", h(money(t.paid))], ["Outstanding", h(money(t.outstanding))],
  ]) +
    "<h3>Lines</h3>" + inv.lines.map((l) => '<div class="rule-row compact"><div>' + h(l.description) + '<div class="secondary">Service period: ' + h(l.months.length > 1 ? formatDate(l.months[0]) + " – " + formatDate(l.months[l.months.length - 1]) + " (recognised monthly)" : formatDate(l.months[0])) + "</div></div><strong>" + h(money(l.net)) + "</strong></div>").join("") +
    "<h3>Payments and references</h3>" + (pays.length ? pays.map((p) => '<div class="rule-row compact"><div>' + h(p.reference) + '<div class="secondary">' + formatDate(p.date) + " · " + h(p.method) + "</div></div><strong>" + h(money(p.amount)) + "</strong></div>").join("") : '<p class="muted small">No payments recorded.</p>') +
    (canRecord ? '<fieldset class="inline-form"><legend>Record a payment received</legend>' + input("Amount received (₱)", "pay-amount", t.outstanding, { type: "number", min: 0, step: "0.01" }) + input("Date received", "pay-date", TODAY, { type: "date", max: TODAY }) + input("Bank or payment reference", "pay-ref", "", { hint: "As shown on the bank statement. No card or account numbers." }) +
      '<p class="tiny muted">Records money received outside ThryveMS.</p>' + formError("pay-error") + button("Record payment", "record-payment", { cls: "btn-small", id: inv.id, testid: "record-payment", submit: true }) + "</fieldset>" : "") +
    '<section class="future-pay" aria-labelledby="fp-h"><h3 id="fp-h">Online payment (future phase)</h3>' +
    alertBox("warning", "<strong>Not connected.</strong> Payments are out of scope for release 1 (plan v3 D21) and need architecture approval. The intended model is provider-hosted checkout (PayMongo is being evaluated, not approved). ThryveMS will never ask for or store card numbers, CVV or wallet credentials.") +
    '<p class="small">Designed methods: Card, GCash, Maya and online banking, all on the provider\'s hosted page.</p>' +
    '<div class="inline-actions">' + button("Pay " + money(t.outstanding) + " online", null, { cls: "btn-primary btn-small", disabled: true, disabledReason: "Payment gateway not approved or connected" }) + button("Request refund", null, { cls: "btn-small", disabled: true, disabledReason: "Refunds are handled by the platform owner as credit notes" }) + "</div>" +
    '<p class="tiny muted">Online payment opens once the payment gateway is connected.</p></section>';
  sheet({ title: inv.number, description: h(c.name) + " · " + h(inv.kind) + " invoice.", body, wide: true });
}

export const actions = {
  "open-invoice": (el) => openInvoice(el.dataset.id),
  "payment-state": (el) => { paymentPreview = el.dataset.arg; openInvoice(el.dataset.id); },
  "record-payment": (el) => {
    const f = readForm(document.querySelector("[data-form]"));
    const res = recordPayment(el.dataset.id, { amount: f["pay-amount"], date: f["pay-date"], reference: f["pay-ref"] });
    if (!res.ok) return showFormError(res.error, "pay-error");
    closeOverlay(true); rerender(); notify("Payment recorded");
  },
};

/* ------------------------------------------------------------------ history */

export function historyTable(id, entries, opts = {}) {
  return dataTable({
    id, caption: opts.caption || "Change history", rows: entries, minWidth: 1100,
    search: (a) => [a.actor, a.action, a.target, a.reason, clientById(a.clientId)?.name || ""].join(" "), searchLabel: "Search history", toolbar: opts.toolbar,
    empty: { title: "No changes recorded", body: "Every privileged change is recorded here with who, what, when and why." },
    columns: [
      { key: "at", label: "Date and time", sort: (a) => a.at, cell: (a) => formatDateTime(a.at) },
      { key: "actor", label: "Actor", sort: (a) => a.actor, cell: (a) => h(a.actor) },
      { key: "action", label: "Action", sort: (a) => a.action, cell: (a) => '<span class="row-primary">' + h(a.action) + '</span><div class="secondary">' + h(a.target || "") + "</div>" },
      { key: "client", label: "Client", sort: (a) => clientById(a.clientId)?.name || "", cell: (a) => h(clientById(a.clientId)?.name || "Platform") },
      { key: "change", label: "Previous → new", cell: (a) => '<span class="small">' + h(a.before || "—") + " → " + h(a.after || "—") + "</span>" },
      { key: "reason", label: "Reason", cell: (a) => '<span class="small">' + h(a.reason || "—") + "</span>" },
      { key: "approval", label: "Approval", cell: (a) => '<span class="small">' + h(a.approval || "—") + "</span>" },
      { key: "outcome", label: "Outcome", sort: (a) => a.outcome, cell: (a) => badge(a.outcome, a.outcome?.startsWith("Simulation") ? "draft" : "done") },
    ],
  });
}

export const partnerLabel = (id) => partnerOf(id)?.label || "Unassigned";
export const requestFrom = (r) => (r.from === "developer" ? "Platform owner" : partnerLabel(r.from));
