/** Developer Console › Organisations: client accounts, partner assignment, subscriptions, modules, archive. */
import { getData, scopeClients, clientById, deploymentFor, activeSandboxes, sandboxStatus, createClient, updateClient, changePartner, setModules, changeSubscription, cancelSubscription, reinstateSubscription, archiveClient, archiveBlocker } from "../store.js";
import { PARTNERS, MODULES, CORE_MODULE, ACCOUNT_STATES, SUBSCRIPTION_STATES, CAPACITY_TIERS } from "../seed.js";
import { currentPricing, chargeBreakdown, capacityTierFor, revenueByClient } from "../finance.js";
import { h, pageHeader, badge, keyFacts, dataTable, sheet, dialog, button, input, select, textarea, multiselect, formError, readForm, showFormError, closeOverlay, alertBox, lifecycleTrack, card, row, linkTo, moneyCell, emptyLine } from "../ui.js";
import { money, formatDate, TODAY, CURRENT_MONTH, MONTHS } from "../util.js";
import { selectFilter, getFilter, setFilter, tabs, invoiceTable, historyTable, partnerLabel, notFound } from "./shared.js";
import { PENDING_PROVISIONING } from "./dev-overview.js";
import { rerender, go, notify, registry } from "../registry.js";

const OPEN_MONTH_START = CURRENT_MONTH + "-01";

export function renderList(r) {
  // Figure cards link here with ?status= or ?sub=; apply once, then keep the filter in the page state.
  if (r.query.get("status") || r.query.get("sub")) {
    setFilter("org-status", r.query.get("status") || ""); setFilter("org-sub", r.query.get("sub") || "");
    history.replaceState(null, "", "#/dev/organisations");
  }
  const st = getFilter("org-status"), sub = getFilter("org-sub"), partner = getFilter("org-partner");
  const rows = scopeClients("dev").filter((c) => (!st || (st === "pending" ? PENDING_PROVISIONING.includes(c.accountStatus) : c.accountStatus === st)) && (!sub || c.subscription.status === sub || (sub === "active-any" && ["Active", "Past due"].includes(c.subscription.status))) && (!partner || c.partnerId === partner));
  const toolbar = '<div class="filters">' +
    selectFilter("org-status", "Account status", [{ value: "", label: "All statuses" }, { value: "pending", label: "Pending provisioning (any)" }, ...ACCOUNT_STATES.map((s) => ({ value: s, label: s }))]) +
    selectFilter("org-sub", "Subscription", [{ value: "", label: "All subscriptions" }, { value: "active-any", label: "Active or past due" }, ...SUBSCRIPTION_STATES.map((s) => ({ value: s, label: s }))]) +
    selectFilter("org-partner", "Business partner", [{ value: "", label: "All partners" }, ...PARTNERS.map((p) => ({ value: p.id, label: p.label }))]) + "</div>";
  return pageHeader({ title: "Organisations", description: "Client accounts. Creating an account doesn't deploy anything: provisioning is a separate, approved step.", actions: button("Create organisation", "org-create", { cls: "btn-primary" }) }) +
    dataTable({
      id: "orgs", caption: "Client organisations", rows, minWidth: 1080, toolbar,
      search: (c) => c.name + " " + c.hostname + " " + c.contact.email + " " + partnerLabel(c.partnerId), searchLabel: "Search organisations",
      empty: { title: "No organisations", body: "Create an organisation to add a client account. It starts as Account created." },
      columns: [
        { key: "name", label: "Organisation", sort: (c) => c.name, cell: (c) => linkTo(c.name, "#/dev/organisations/" + c.id) + '<div class="secondary">' + h(c.hostname) + "</div>" },
        { key: "partner", label: "Partner", sort: (c) => partnerLabel(c.partnerId), cell: (c) => h(partnerLabel(c.partnerId)) },
        { key: "acct", label: "Account status", sort: (c) => c.accountStatus, cell: (c) => badge(c.accountStatus) },
        { key: "sub", label: "Subscription", sort: (c) => c.subscription.status, cell: (c) => badge(c.subscription.status) + '<div class="secondary">' + (c.subscription.planId === "trial" ? "Trial" : "Standard") + " · " + h(c.subscription.billingCycle) + "</div>" },
        { key: "seats", label: "Seats used", sort: (c) => c.subscription.purchasedSeats, cell: (c) => h(c.subscription.activeUsers + " of " + c.subscription.purchasedSeats) },
        { key: "dep", label: "Deployment", sort: (c) => deploymentFor(c.id)?.status || "Not provisioned", cell: (c) => { const d = deploymentFor(c.id); return d ? badge(d.status) + (d.status === "Live" ? '<div class="secondary">Health: ' + h(d.health) + "</div>" : "") : badge("Not provisioned"); } },
        { key: "ver", label: "Version", sort: (c) => deploymentFor(c.id)?.version || "", cell: (c) => { const d = deploymentFor(c.id); return d?.version ? "v" + h(d.version) : '<span class="muted">No data</span>'; } },
      ],
    });
}

export function renderDetail(id, r) {
  const c = scopeClients("dev").find((x) => x.id === id);
  if (!c) return notFound();
  const tab = r.query.get("tab") || "summary";
  const d = deploymentFor(c.id);
  const block = archiveBlocker(c);
  const canProvision = ["Account created", "Provisioning failed"].includes(c.accountStatus) && ["Active", "Trial"].includes(c.subscription.status);
  const actions = button("Edit details", "org-edit", { id: c.id }) +
    (canProvision ? button("Request provisioning", "prov-request", { id: c.id }) : "") +
    button("Archive", "org-archive", { id: c.id, cls: "btn-danger" });
  const t = [{ id: "summary", label: "Summary" }, { id: "subscription", label: "Subscription" }, { id: "modules", label: "Modules" }, { id: "deployment", label: "Deployment" }, { id: "enterprise", label: "Enterprise" }, { id: "history", label: "History" }];
  let body = "";
  if (tab === "summary") body = summary(c, d);
  else if (tab === "subscription") body = subscription(c);
  else if (tab === "modules") body = modules(c);
  else if (tab === "deployment") body = deployment(c, d);
  else if (tab === "enterprise") body = enterprise(c);
  else if (tab === "history") body = historyTable("org-history-" + c.id, getData().audit.filter((a) => a.clientId === c.id), { caption: "Account history" });
  else return notFound();
  return pageHeader({ title: c.name, crumbs: [{ label: "Organisations", href: "#/dev/organisations" }, { label: c.name }], description: badge(c.accountStatus) + " " + badge(c.subscription.status) + ' <span class="muted small">' + h(c.hostname) + "</span>", actions }) +
    (block && c.accountStatus !== "Archived" ? "" : "") + tabs(t, tab, "#/dev/organisations/" + c.id, "Organisation sections") + body;
}

const ACCOUNT_TRACK = ["Account created", "Awaiting provisioning", "Provisioning", "Live"];
function summary(c, d) {
  const idx = c.accountStatus === "Provisioning failed" ? 2 : Math.max(0, ACCOUNT_TRACK.indexOf(c.accountStatus));
  const live = c.accountStatus === "Live";
  return card({ title: "Account lifecycle", note: "Separate from the deployment lifecycle. Creating an account never means a deployment exists.", body: '<div class="card-body">' + lifecycleTrack(ACCOUNT_TRACK, live ? 4 : idx, c.accountStatus === "Provisioning failed" ? 2 : undefined) +
    (["Suspended", "Archived"].includes(c.accountStatus) ? alertBox("warning", "Account is <strong>" + h(c.accountStatus) + "</strong>" + (c.archivedAt ? " since " + formatDate(c.archivedAt) : "") + ".") : "") + "</div>" }) +
    card({ title: "Details", action: button("Change partner", "org-partner", { id: c.id, cls: "btn-small" }), body: '<div class="card-body">' + keyFacts([
      ["Business partner", h(partnerLabel(c.partnerId))], ["Industry", h(c.industry)], ["Hostname", h(c.hostname)], ["Created", formatDate(c.createdAt)],
      ["Contact", h(c.contact.name)], ["Contact email", h(c.contact.email)], ["Contact phone", h(c.contact.phone || "")], ["Notes", h(c.notes || "")],
      ["Plan", c.subscription.planId === "trial" ? "Trial" : "Standard"], ["Seats", h(c.subscription.activeUsers + " active of " + c.subscription.purchasedSeats + " purchased")],
      ["Deployment", d ? badge(d.status) + (d.version ? " v" + h(d.version) : "") : badge("Not provisioned")], ["Capacity sizing", h(capacityTierFor(CAPACITY_TIERS, c.subscription.purchasedSeats).name) + ' <span class="muted small">(infrastructure, not pricing)</span>'],
    ]) + "</div>" });
}

function subscription(c) {
  const d = getData();
  const s = c.subscription;
  const p = currentPricing(d);
  const b = chargeBreakdown(p, s.purchasedSeats);
  const usage = Math.min(100, Math.round((s.activeUsers / Math.max(1, s.purchasedSeats)) * 100));
  const editable = ["Active", "Trial", "Past due"].includes(s.status);
  const rev = revenueByClient(d, MONTHS).get(c.id);
  return card({ title: "Subscription", note: "Pricing shown is illustrative and not approved. Changes need an effective date and reason.",
    action: '<div class="inline-actions">' + (editable ? button("Change plan or seats", "sub-change", { id: c.id, cls: "btn-small" }) + button("Cancel subscription", "sub-cancel", { id: c.id, cls: "btn-small btn-danger" }) : button("Reinstate", "sub-reinstate", { id: c.id, cls: "btn-small", disabled: c.accountStatus === "Archived" })) + "</div>",
    body: '<div class="card-body">' + keyFacts([
      ["Plan", s.planId === "trial" ? "Trial (30 days, up to 10 users)" : "Standard"], ["Status", badge(s.status)], ["Billing cycle", h(s.billingCycle)],
      ["Purchased seats", h(s.purchasedSeats)], ["Active users", h(s.activeUsers)], ["Started", formatDate(s.startDate)],
      ["Renewal", s.renewalDate ? formatDate(s.renewalDate) : null], ["Trial ends", s.trialEnds ? formatDate(s.trialEnds) : null],
      ["Monthly charge (illustrative)", s.planId === "trial" ? "No charge" : h(money(b.base)) + " base for " + p.baseUsers + " users" + (b.extra ? " + " + b.extra + " × " + h(money(p.additionalRate)) + " = " + h(money(b.total)) : " = " + h(money(b.total)))],
      ["Recognised revenue, Jul–Oct 2026", rev ? h(money(rev.total)) : null],
    ]) +
    '<div class="seat-meter" aria-label="Seat usage ' + usage + '%"><div class="seat-bar"><span style="width:' + usage + '%"></span></div><span class="tiny muted">' + s.activeUsers + " of " + s.purchasedSeats + " seats in use (" + usage + "%)</span></div>" +
    (s.scheduled ? alertBox("info", "<strong>Scheduled change</strong> from " + formatDate(s.scheduled.effective) + ": " + h((s.scheduled.planId === "trial" ? "Trial" : "Standard") + ", " + s.scheduled.seats + " seats, " + s.scheduled.billingCycle) + ".") : "") + "</div>" }) +
    card({ title: "Subscription history", note: "Plan, seat, cycle, partner and status changes with effective dates.", body: s.history.length ? s.history.map((x) => row(h(x.field) + ": " + h(x.from) + " → " + h(x.to), "Effective " + formatDate(x.effective) + " · " + h(x.reason) + " · " + h(x.by), x.scheduled && x.effective > TODAY ? badge("Scheduled") : badge("Applied", "done"))).join("") : emptyLine("No changes yet", "Changes to plan, seats and billing appear here.") }) +
    '<h2 class="section-title">Invoices</h2>' + invoiceTable("org-inv-" + c.id, d.invoices.filter((i) => i.clientId === c.id)) +
    card({ title: "Commercial adjustments", note: "Discounts and credit notes reduce recognised revenue in the month recorded.", action: linkTo("Record adjustment", "#/dev/finance?tab=subscriptions"), body: d.adjustments.filter((a) => a.clientId === c.id).map((a) => row(h(a.kind) + " " + h(money(a.amount)), formatDate(a.month) + " · " + h(a.reason), badge(a.approval ? "Approved" : "Recorded", "done"))).join("") || emptyLine("No adjustments", "Discounts and credit notes appear here.") });
}

function modules(c) {
  return card({ title: "Enabled modules", note: "Changes need a reason and are recorded. Core QMS is always on. Production enforcement is server-side (feature flags).", body: '<form class="card-body" data-inline-form="modules">' +
    multiselect("Modules", "mod", MODULES, c.modules, { locked: [CORE_MODULE] }) + textarea("Reason for the change", "mod-reason", "", { rows: 2 }) + formError("mod-error") +
    button("Save modules", "mod-save", { id: c.id, cls: "btn-primary", submit: true }) + "</form>" });
}

function deployment(c, d) {
  const sbs = getData().sandboxes.filter((s) => s.clientId === c.id);
  return card({ title: "Production deployment", note: "One isolated Worker and Neon project per client.", action: d ? linkTo("Open deployment", "#/dev/deployments/" + d.id) : "", body: '<div class="card-body">' +
    (d ? keyFacts([["Status", badge(d.status)], ["Health", badge(d.health)], ["Version", d.version ? "v" + h(d.version) : null], ["Hostname", h(d.hostname)], ["Release channel", h(d.channel)], ["Last deployment", d.lastDeployed ? formatDate(d.lastDeployed) : null]])
      : emptyLine("Not provisioned", "This account has no deployment. Request provisioning when the subscription is ready.")) + "</div>" }) +
    card({ title: "Sandboxes", note: activeSandboxes(c.id).length + " active. Isolated, synthetic data only.", action: d?.status === "Live" ? button("Create sandbox", "sb-create", { id: c.id, cls: "btn-small" }) : '<span class="tiny muted">Needs a live production deployment</span>',
      body: sbs.map((s) => row(linkTo(s.name, "#/dev/sandboxes/" + s.id), h(s.purpose) + " · " + h(s.reference) + " · target v" + h(s.targetVersion), badge(sandboxStatus(s)))).join("") || emptyLine("No sandboxes", "Create one to investigate an issue or validate a version.") });
}

function enterprise(c) {
  const ps = getData().projects.filter((p) => p.clientId === c.id);
  return card({ title: "Enterprise and customization projects", action: linkTo("All projects", "#/dev/finance?tab=enterprise"), body: ps.map((p) => row(h(p.name), h(p.type) + " · " + h(money(p.amount)) + (p.exception ? " (exception " + h(p.exception.reference) + ")" : "") + " · expected " + formatDate(p.expectedCompletion), badge(p.status))).join("") || emptyLine("No projects", "One-time customization projects for this client appear here.") });
}

/* ------------------------------------------------------------------ sheets */

function createSheet() {
  const p = currentPricing(getData());
  sheet({ title: "Create organisation", description: "Creates the client account only. Nothing is deployed; request provisioning afterwards.", wide: true, body:
    alertBox("info", "The account starts as <strong>Account created</strong>. A deployment exists only after provisioning is requested, approved and completed by the backend.") +
    '<div class="form-grid">' + input("Organisation name", "o-name", "", { required: true }) + input("Hostname", "o-slug", "", { hint: "Letters, numbers and hyphens. Becomes <name>.thryvems.example (placeholder domain)." }) +
    select("Business partner", "o-partner", "", PARTNERS.map((x) => ({ value: x.id, label: x.label })), { placeholder: "Choose a partner" }) + input("Industry", "o-industry", "") +
    select("Plan", "o-plan", "standard", [{ value: "standard", label: "Standard" }, { value: "trial", label: "Trial (30 days, up to 10 users)" }]) + select("Billing cycle", "o-cycle", "Monthly", ["Monthly", "Annual"]) +
    input("Purchased seats", "o-seats", 10, { type: "number", min: p.minSeats, hint: "Base subscription includes " + p.baseUsers + " users. Minimum " + p.minSeats + "." }) + input("Commercial approval reference", "o-ref", "", { hint: "Only for more than " + getData().settings.largeSeatApproval + " seats." }) +
    input("Contact name", "o-cname", "") + input("Contact email", "o-cemail", "", { type: "email" }) + input("Contact phone", "o-cphone", "") + "</div>" +
    multiselect("Enabled modules", "o-mods", MODULES, MODULES, { locked: [CORE_MODULE] }) + textarea("Reason", "o-reason", "", { rows: 2 }) + formError(),
    footer: button("Cancel", "close") + button("Create account", "org-save", { cls: "btn-primary", submit: true, primary: true }) });
}

export const actions = {
  "org-create": createSheet,
  "org-save": () => {
    const f = readForm(document.querySelector("[data-form]"));
    const res = createClient({ name: f["o-name"], slug: f["o-slug"], partnerId: f["o-partner"], industry: f["o-industry"], planId: f["o-plan"], billingCycle: f["o-cycle"], seats: f["o-seats"], commercialReference: f["o-ref"], contactName: f["o-cname"], contactEmail: f["o-cemail"], contactPhone: f["o-cphone"], modules: f["o-mods"] || [], reason: f["o-reason"] });
    if (!res.ok) return showFormError(res.error);
    closeOverlay(true); notify("Account created. Infrastructure isn't deployed yet."); go("#/dev/organisations/" + res.id);
  },
  "org-edit": (el) => {
    const c = clientById(el.dataset.id);
    sheet({ title: "Edit details", description: h(c.name), body: input("Organisation name", "e-name", c.name) + input("Industry", "e-industry", c.industry) + input("Contact name", "e-cname", c.contact.name) + input("Contact email", "e-cemail", c.contact.email, { type: "email" }) + input("Contact phone", "e-cphone", c.contact.phone) + textarea("Notes", "e-notes", c.notes) + textarea("Reason for the change", "e-reason", "", { rows: 2 }) + formError(),
      footer: button("Cancel", "close") + button("Save details", "org-edit-save", { id: c.id, cls: "btn-primary", submit: true, primary: true }) });
  },
  "org-edit-save": (el) => {
    const f = readForm(document.querySelector("[data-form]"));
    const res = updateClient(el.dataset.id, { name: f["e-name"], industry: f["e-industry"], contactName: f["e-cname"], contactEmail: f["e-cemail"], contactPhone: f["e-cphone"], notes: f["e-notes"] }, f["e-reason"]);
    if (!res.ok) return showFormError(res.error);
    closeOverlay(true); rerender(); notify("Details saved");
  },
  "org-partner": (el) => {
    const c = clientById(el.dataset.id);
    sheet({ title: "Change business partner", description: h(c.name) + " is assigned to " + h(partnerLabel(c.partnerId)) + ". The new partner sees this client from the effective date; the old one stops seeing it.", body:
      select("New business partner", "p-partner", "", PARTNERS.filter((p) => p.id !== c.partnerId).map((p) => ({ value: p.id, label: p.label })), { placeholder: "Choose a partner" }) + input("Effective date", "p-eff", TODAY, { type: "date", min: OPEN_MONTH_START }) + textarea("Reason", "p-reason", "", { rows: 2 }) + formError(),
      footer: button("Cancel", "close") + button("Change partner", "org-partner-save", { id: c.id, cls: "btn-primary", submit: true, primary: true }) });
  },
  "org-partner-save": (el) => {
    const f = readForm(document.querySelector("[data-form]"));
    const res = changePartner(el.dataset.id, f["p-partner"], f["p-eff"], f["p-reason"]);
    if (!res.ok) return showFormError(res.error);
    closeOverlay(true); rerender(); notify("Business partner changed");
  },
  "mod-save": (el) => {
    const form = document.querySelector("[data-inline-form=modules]");
    const f = readForm(form);
    const res = setModules(el.dataset.id, f.mod || [], f["mod-reason"]);
    if (!res.ok) return showFormError(res.error, "mod-error");
    rerender(); notify("Modules saved");
  },
  "sub-change": (el) => {
    const c = clientById(el.dataset.id), s = c.subscription;
    const p = currentPricing(getData());
    sheet({ title: "Change plan or seats", description: h(c.name) + " · " + s.activeUsers + " active users. Changes apply from the effective date; closed months keep their invoices.", body:
      '<div class="form-grid">' + select("Plan", "s-plan", s.planId, [{ value: "standard", label: "Standard" }, { value: "trial", label: "Trial (up to 10 users)" }]) + select("Billing cycle", "s-cycle", s.billingCycle, ["Monthly", "Annual"]) +
      input("Purchased seats", "s-seats", s.purchasedSeats, { type: "number", min: p.minSeats, hint: "Base includes " + p.baseUsers + " users; each additional seat " + money(p.additionalRate) + " (illustrative)." }) + input("Effective date", "s-eff", TODAY, { type: "date", min: OPEN_MONTH_START }) +
      input("Commercial approval reference", "s-ref", "", { hint: "Needed above " + getData().settings.largeSeatApproval + " seats." }) + "</div>" +
      '<p class="small" data-testid="charge-preview" id="charge-preview">' + h(chargeLine(p, s.purchasedSeats)) + "</p>" + textarea("Reason", "s-reason", "", { rows: 2 }) + formError(),
      footer: button("Cancel", "close") + button("Save change", "sub-save", { id: c.id, cls: "btn-primary", submit: true, primary: true }) });
    document.getElementById("s-seats").setAttribute("data-change", "charge-preview");
  },
  "sub-save": (el) => {
    const f = readForm(document.querySelector("[data-form]"));
    const res = changeSubscription(el.dataset.id, { planId: f["s-plan"], seats: f["s-seats"], billingCycle: f["s-cycle"], commercialReference: f["s-ref"] }, f["s-eff"], f["s-reason"]);
    if (!res.ok) return showFormError(res.error);
    closeOverlay(true); rerender(); notify(res.scheduled ? "Subscription change scheduled" : "Subscription changed");
  },
  "sub-cancel": (el) => {
    const c = clientById(el.dataset.id);
    dialog({ title: "Cancel subscription?", description: h(c.name) + ". Access and billing stop from the effective date. The deployment isn't removed by this action.", body: input("Effective date", "x-eff", TODAY, { type: "date", min: OPEN_MONTH_START }) + textarea("Reason", "x-reason", "", { rows: 2 }) + formError(),
      footer: button("Keep subscription", "close") + button("Cancel subscription", "sub-cancel-confirm", { id: c.id, cls: "btn-danger", submit: true }) });
  },
  "sub-cancel-confirm": (el) => {
    const f = readForm(document.querySelector("[data-form]"));
    const res = cancelSubscription(el.dataset.id, f["x-eff"], f["x-reason"]);
    if (!res.ok) return showFormError(res.error);
    closeOverlay(true); rerender(); notify("Subscription cancelled");
  },
  "sub-reinstate": (el) => {
    const c = clientById(el.dataset.id);
    dialog({ title: "Reinstate subscription?", description: h(c.name), body: textarea("Reason", "ri-reason", "", { rows: 2 }) + formError(), footer: button("Cancel", "close") + button("Reinstate", "sub-reinstate-confirm", { id: c.id, cls: "btn-primary", submit: true }) });
  },
  "sub-reinstate-confirm": (el) => {
    const res = reinstateSubscription(el.dataset.id, readForm(document.querySelector("[data-form]"))["ri-reason"]);
    if (!res.ok) return showFormError(res.error);
    closeOverlay(true); rerender(); notify("Subscription reinstated");
  },
  "org-archive": (el) => {
    const c = clientById(el.dataset.id);
    const block = archiveBlocker(c);
    dialog({ title: "Archive " + c.name + "?", description: "Archived accounts are hidden from partners and kept for history. Live production deployments are never archived silently.", body:
      (block ? alertBox("danger", "<strong>Can't archive yet.</strong> " + h(block), "alert") : textarea("Reason", "a-reason", "", { rows: 2 }) + formError()),
      footer: button("Cancel", "close") + button("Archive account", "org-archive-confirm", { id: c.id, cls: "btn-danger", disabled: !!block, submit: true }) });
  },
  "org-archive-confirm": (el) => {
    const res = archiveClient(el.dataset.id, readForm(document.querySelector("[data-form]"))["a-reason"]);
    if (!res.ok) return showFormError(res.error);
    closeOverlay(true); rerender(); notify("Account archived");
  },
};
function chargeLine(p, seats) {
  const b = chargeBreakdown(p, Number(seats) || 0);
  return "Monthly charge (illustrative): " + money(b.base) + (b.extra ? " + " + b.extra + " × " + money(p.additionalRate) : "") + " = " + money(b.total) + " before VAT.";
}
registry.changes["charge-preview"] = (t) => { const el = document.getElementById("charge-preview"); if (el) el.textContent = chargeLine(currentPricing(getData()), t.value); };
