/**
 * Preview store. Synthetic records only, persisted in this browser under STORAGE_KEY.
 * No secrets, tokens or credentials are ever stored. Every privileged change writes an audit record.
 * Production must enforce all of this on the server; the preview role is not authentication.
 */
import { buildSeed, PARTNERS, SANDBOX_PURPOSES, CORE_MODULE, MODULES } from "./seed.js";
import { TODAY, CURRENT_MONTH, addDays, clone, uid, isHttps, slugify, round2, sum } from "./util.js";
import { validateSeats, invoiceTotals, distribution, currentPricing } from "./finance.js";

export const STORAGE_KEY = "thryvems.console.v2";
const LEGACY_KEY = "thryvems.console.demo.v1";
const UI_KEY = "thryvems.console.ui.v1";
const NOW = TODAY + "T14:00";

let data = load();
const ui = loadUi();
/** Data as the page sees it. The "Empty" preview state shows every list with no records. */
export const getData = () => (ui.dataState === "Empty" ? emptyView() : data);
function emptyView() {
  const keep = ["version", "pricing", "allocationDefault", "settings", "integrations", "partnerSettings"];
  const out = {};
  for (const [k, v] of Object.entries(data)) out[k] = keep.includes(k) ? v : Array.isArray(v) ? [] : v;
  return out;
}
export const getUi = () => ui;

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved && saved.version === 2 && Array.isArray(saved.clients)) return saved;
  } catch (_) { /* fall through to seed */ }
  const seed = buildSeed();
  migrateLegacy(seed);
  return seed;
}
/** v1 kept preview sandboxes for demo-01..03 only. Carry them over as simulated Requested sandboxes. */
function migrateLegacy(seed) {
  try {
    const old = JSON.parse(localStorage.getItem(LEGACY_KEY) || "null");
    if (!Array.isArray(old)) return;
    const map = { "demo-01": "Demo Manufacturing", "demo-02": "Sample Services", "demo-03": "Example Logistics" };
    for (const s of old) {
      if (!s || !String(s.id || "").startsWith("sb-preview-")) continue;
      const c = seed.clients.find((x) => x.name === map[s.clientId]);
      if (!c) continue;
      seed.sandboxes.push({ id: uid("sb"), name: c.slug + "-migrated", clientId: c.id, sourceVersion: s.version, targetVersion: s.version, purpose: SANDBOX_PURPOSES.includes(s.purpose) ? s.purpose : "Version validation", reference: String(s.reference || "MIGRATED").slice(0, 40), description: "Carried over from the earlier preview.", retentionDays: 14, createdAt: TODAY, expiresAt: addDays(TODAY, 14), status: "Requested", simulated: true, health: "Not checked (simulation)", changes: [{ at: NOW, by: "Preview", text: "Migrated from earlier preview storage." }], builds: [], tests: [], review: null, promotionRequestId: null, config: { modules: c.modules.slice() } });
    }
    localStorage.removeItem(LEGACY_KEY);
  } catch (_) { /* ignore */ }
}
function loadUi() {
  const base = { role: "developer", partner: "partner-a", inspect: "partner-a", theme: "light", dataState: "Normal", period: "m:2026-10", rows: 10 };
  try { return { ...base, ...JSON.parse(localStorage.getItem(UI_KEY) || "{}") }; } catch (_) { return base; }
}
export function saveUi() { try { localStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch (_) { /* storage may be blocked */ } }
function persist() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (_) { /* storage may be blocked; preview keeps working in memory */ } }
export function resetPreview() { localStorage.removeItem(STORAGE_KEY); data = buildSeed(); persist(); }

/* ------------------------------------------------------------------ access */

export const isDeveloper = () => ui.role === "developer";
export const partnerOf = (id) => PARTNERS.find((p) => p.id === id);
/** The partner whose projection is shown in the Business workspace. Developers inspect read-only. */
export const businessPartnerId = () => (ui.role === "partner" ? ui.partner : ui.inspect);
export const isInspecting = () => ui.role === "developer";
/** Clients visible in the current workspace. Partners see assigned clients only — lists, counts, search and details. */
export function scopeClients(workspace) {
  const d = getData();
  if (workspace === "dev") return isDeveloper() ? d.clients : [];
  if (workspace === "biz") {
    if (ui.role === "client") return [];
    const pid = businessPartnerId();
    const pol = partnerAccess(pid);
    return d.clients.filter((c) => c.partnerId === pid && c.accountStatus !== "Archived" && (pol.clientMode !== "selected" || pol.clients.includes(c.id)));
  }
  return [];
}
export const clientById = (id) => data.clients.find((c) => c.id === id);

/* ---------------------------------------------------------- partner access */

/**
 * What the platform owner shares with each Business Partner. Hidden areas simply don't exist in the partner's
 * workspace: no menu item, no tab, no figure, and direct links show the ordinary "Page not found". Nothing in the
 * partner UI says that access is limited. Access can only be narrowed to the partner's own assigned clients.
 */
export const PARTNER_AREAS = [
  { id: "clients", group: "Clients", label: "Client list" },
  { id: "clients.subscriptions", group: "Clients", label: "Subscriptions and seats" },
  { id: "clients.enterprise", group: "Clients", label: "Enterprise projects" },
  { id: "client.billing", group: "Clients", label: "Client billing details" },
  { id: "finance.overview", group: "Finance", label: "Finance overview" },
  { id: "finance.revenue-expenses", group: "Finance", label: "Revenue and expenses" },
  { id: "finance.profit", group: "Finance", label: "Shared profit reporting and profit figures" },
  { id: "finance.invoices", group: "Finance", label: "Invoices" },
  { id: "finance.distributions", group: "Finance", label: "Distributions" },
  { id: "finance.reports", group: "Finance", label: "Reports and export" },
  { id: "requests", group: "Workspace", label: "Requests" },
  { id: "settings", group: "Workspace", label: "Business settings" },
];
export function partnerAccess(pid) {
  const saved = (data.partnerAccess || {})[pid] || {};
  const areas = {};
  for (const a of PARTNER_AREAS) areas[a.id] = saved.areas?.[a.id] !== false;
  return { clientMode: saved.clientMode === "selected" ? "selected" : "all", clients: Array.isArray(saved.clients) ? saved.clients : [], areas };
}
/** For the Business workspace: is this area shared with the partner being viewed? */
export const partnerCan = (area) => ui.role === "client" ? false : partnerAccess(businessPartnerId()).areas[area] !== false;
export function setPartnerAccess(pid, policy, reason) {
  return run(() => {
    requireDev(); requireReason(reason);
    need(PARTNERS.some((p) => p.id === pid), "Unknown partner.");
    const assigned = data.clients.filter((c) => c.partnerId === pid).map((c) => c.id);
    const clients = (policy.clients || []).filter((id) => assigned.includes(id));
    need(policy.clientMode !== "selected" || clients.length > 0, "Select at least one client, or share all assigned clients.");
    const before = partnerAccess(pid);
    data.partnerAccess = { ...(data.partnerAccess || {}), [pid]: { clientMode: policy.clientMode === "selected" ? "selected" : "all", clients, areas: { ...policy.areas } } };
    const after = partnerAccess(pid);
    const hidden = PARTNER_AREAS.filter((a) => !after.areas[a.id]).map((a) => a.label);
    audit({ action: "Partner access changed: " + partnerOf(pid).label, before: before.clientMode === "selected" ? before.clients.length + " selected clients" : "All assigned clients",
      after: (after.clientMode === "selected" ? after.clients.length + " selected clients" : "All assigned clients") + (hidden.length ? " · hidden: " + hidden.join(", ") : " · everything shared"), reason });
    return ok();
  });
}
export const deploymentFor = (clientId) => data.deployments.find((d) => d.clientId === clientId && d.env === "Production");
export const actorName = () => (ui.role === "developer" ? "Platform owner" : partnerOf(ui.partner)?.label || "Unknown");

/* ------------------------------------------------------------------- audit */

export function audit(entry) {
  data.audit.unshift({ id: uid("au"), at: NOW, actor: actorName(), approval: "Not required", outcome: "Recorded (preview)", before: "—", after: "—", clientId: null, ...entry });
}
const fail = (message) => ({ ok: false, error: message });
const ok = (extra = {}) => { persist(); return { ok: true, ...extra }; };
const need = (cond, message) => { if (!cond) throw new Error(message); };
/** Run a mutation; validation errors come back as { ok:false, error }. */
function run(fn) {
  try { return fn(); } catch (e) { return fail(e.message); }
}
const requireDev = () => need(isDeveloper(), "Only the platform owner can do this.");
const requireReason = (reason) => need(String(reason || "").trim().length >= 3, "Enter a reason (at least 3 characters).");
const firstOfOpenMonth = CURRENT_MONTH + "-01";
const requireEffective = (date) => {
  need(/^\d{4}-\d{2}-\d{2}$/.test(String(date || "")), "Choose an effective date.");
  need(date >= firstOfOpenMonth, "Choose a date on or after 1 Oct 2026. Closed months keep their figures.");
};

/* ------------------------------------------------------------ organisations */

export function createClient(f) {
  return run(() => {
    requireDev();
    const name = String(f.name || "").trim();
    need(name.length >= 2, "Enter the organisation name.");
    const slug = slugify(f.slug || name);
    need(slug.length >= 2, "Enter a hostname made of letters, numbers and hyphens.");
    need(!data.clients.some((c) => c.name.toLowerCase() === name.toLowerCase()), "An organisation with this name already exists.");
    need(!data.clients.some((c) => c.slug === slug), "This hostname is already used by another organisation.");
    need(PARTNERS.some((p) => p.id === f.partnerId), "Choose a business partner.");
    const trial = f.planId === "trial";
    const seats = Number(f.seats);
    const err = validateSeats(data, null, seats, { largeSeatApproval: data.settings.largeSeatApproval, commercialReference: f.commercialReference });
    need(!err, err);
    need(!trial || seats <= 10, "Trials allow up to 10 users.");
    need(String(f.contactEmail || "").includes("@"), "Enter the client contact email.");
    const modules = Array.from(new Set([CORE_MODULE, ...(f.modules || [])])).filter((m) => MODULES.includes(m));
    const c = {
      id: "c-" + slug, slug, name, partnerId: f.partnerId, industry: f.industry || "Not set", hostname: slug + ".thryvems.example",
      contact: { name: String(f.contactName || "Account contact").trim(), email: String(f.contactEmail).trim(), phone: String(f.contactPhone || "").trim() },
      accountStatus: "Account created", createdAt: TODAY, archivedAt: null, modules, notes: "",
      subscription: { planId: trial ? "trial" : "standard", status: trial ? "Trial" : "Active", billingCycle: f.billingCycle === "Annual" ? "Annual" : "Monthly", purchasedSeats: seats, activeUsers: 0, startDate: TODAY, renewalDate: trial ? null : (f.billingCycle === "Annual" ? "2027-10-24" : "2026-11-24"), trialEnds: trial ? addDays(TODAY, 30) : null, cancelledAt: null, history: [] },
    };
    data.clients.unshift(c);
    audit({ action: "Client account created", clientId: c.id, target: "Organisation", after: c.name + " · " + (trial ? "Trial" : "Standard") + " · " + seats + " seats", reason: f.reason || "New client account." });
    return ok({ id: c.id });
  });
}

export function updateClient(id, f, reason) {
  return run(() => {
    requireDev();
    const c = clientById(id);
    need(c, "Organisation not found.");
    requireReason(reason);
    const before = c.name + " · " + c.contact.email;
    const name = String(f.name || "").trim();
    need(name.length >= 2, "Enter the organisation name.");
    need(!data.clients.some((x) => x !== c && x.name.toLowerCase() === name.toLowerCase()), "An organisation with this name already exists.");
    need(String(f.contactEmail || "").includes("@"), "Enter the client contact email.");
    c.name = name; c.industry = f.industry || c.industry;
    c.contact = { name: String(f.contactName || "").trim() || c.contact.name, email: String(f.contactEmail).trim(), phone: String(f.contactPhone || "").trim() };
    c.notes = String(f.notes || "").slice(0, 500);
    audit({ action: "Client details edited", clientId: id, target: "Organisation", before, after: c.name + " · " + c.contact.email, reason });
    return ok();
  });
}

export function changePartner(id, partnerId, effective, reason) {
  return run(() => {
    requireDev();
    const c = clientById(id);
    need(c, "Organisation not found.");
    need(PARTNERS.some((p) => p.id === partnerId), "Choose a business partner.");
    need(partnerId !== c.partnerId, "This client is already assigned to that partner.");
    requireEffective(effective); requireReason(reason);
    const before = partnerOf(c.partnerId).label;
    c.partnerId = partnerId;
    c.subscription.history.unshift({ id: uid("sh"), at: NOW, effective, field: "Business partner", from: before, to: partnerOf(partnerId).label, reason, by: actorName() });
    audit({ action: "Business partner changed", clientId: id, target: "Partner assignment", before, after: partnerOf(partnerId).label + " from " + effective, reason });
    return ok();
  });
}

export function setModules(id, modules, reason) {
  return run(() => {
    requireDev();
    const c = clientById(id);
    need(c, "Organisation not found.");
    requireReason(reason);
    const next = Array.from(new Set([CORE_MODULE, ...modules])).filter((m) => MODULES.includes(m));
    const before = c.modules.join(", ");
    c.modules = next;
    audit({ action: "Enabled modules changed", clientId: id, target: "Modules", before, after: next.join(", "), reason });
    return ok();
  });
}

/** Plan, seats and billing cycle change with effective date and reason. Applies now if effective is today or earlier. */
export function changeSubscription(id, f, effective, reason, opts = {}) {
  return run(() => {
    if (!opts.fromRequest) requireDev();
    const c = clientById(id);
    need(c, "Organisation not found.");
    requireEffective(effective); requireReason(reason);
    const s = c.subscription;
    const planId = f.planId || s.planId;
    const seats = f.seats == null || f.seats === "" ? s.purchasedSeats : Number(f.seats);
    const cycle = f.billingCycle || s.billingCycle;
    need(["Active", "Trial", "Past due"].includes(s.status), "Reinstate the subscription before changing it.");
    if (planId === "trial") need(seats <= 10, "Trials allow up to 10 users.");
    const err = validateSeats(data, { ...c, subscription: { ...s, planId } }, seats, { largeSeatApproval: data.settings.largeSeatApproval, commercialReference: f.commercialReference });
    need(!err, err);
    const changes = [];
    if (planId !== s.planId) changes.push(["Plan", s.planId === "trial" ? "Trial" : "Standard", planId === "trial" ? "Trial" : "Standard"]);
    if (seats !== s.purchasedSeats) changes.push(["Purchased seats", s.purchasedSeats, seats]);
    if (cycle !== s.billingCycle) changes.push(["Billing cycle", s.billingCycle, cycle]);
    need(changes.length, "Nothing changed. Change the plan, seats or billing cycle.");
    for (const [field, from, to] of changes) s.history.unshift({ id: uid("sh"), at: NOW, effective, field, from, to, reason, by: actorName(), scheduled: effective > TODAY });
    if (effective <= TODAY) {
      if (planId !== s.planId) { s.planId = planId; s.status = planId === "trial" ? "Trial" : "Active"; s.trialEnds = planId === "trial" ? s.trialEnds : null; }
      s.purchasedSeats = seats; s.billingCycle = cycle;
    } else {
      s.scheduled = { effective, planId, seats, billingCycle: cycle };
    }
    audit({ action: "Subscription changed", clientId: id, target: "Subscription", before: changes.map((x) => x[0] + ": " + x[1]).join("; "), after: changes.map((x) => x[0] + ": " + x[2]).join("; ") + " from " + effective, reason, approval: opts.approval || "Not required" });
    return ok({ scheduled: effective > TODAY });
  });
}

export function cancelSubscription(id, effective, reason) {
  return run(() => {
    requireDev();
    const c = clientById(id); need(c, "Organisation not found.");
    requireEffective(effective); requireReason(reason);
    need(c.subscription.status !== "Cancelled", "This subscription is already cancelled.");
    const before = c.subscription.status;
    c.subscription.status = "Cancelled"; c.subscription.cancelledAt = effective;
    c.subscription.history.unshift({ id: uid("sh"), at: NOW, effective, field: "Status", from: before, to: "Cancelled", reason, by: actorName() });
    audit({ action: "Subscription cancelled", clientId: id, target: "Subscription", before, after: "Cancelled from " + effective, reason });
    return ok();
  });
}
export function reinstateSubscription(id, reason) {
  return run(() => {
    requireDev();
    const c = clientById(id); need(c, "Organisation not found.");
    requireReason(reason);
    need(["Cancelled", "Suspended", "Past due"].includes(c.subscription.status), "Only cancelled, suspended or past-due subscriptions can be reinstated.");
    need(c.accountStatus !== "Archived", "Archived accounts can't be reinstated. Create a new account instead.");
    const before = c.subscription.status;
    c.subscription.status = c.subscription.planId === "trial" ? "Trial" : "Active"; c.subscription.cancelledAt = null;
    c.subscription.history.unshift({ id: uid("sh"), at: NOW, effective: TODAY, field: "Status", from: before, to: c.subscription.status, reason, by: actorName() });
    audit({ action: "Subscription reinstated", clientId: id, target: "Subscription", before, after: c.subscription.status, reason });
    return ok();
  });
}

/** Why an account can't be archived, or null. Live production deployments are never silently archived. */
export function archiveBlocker(c) {
  const d = deploymentFor(c.id);
  if (c.accountStatus === "Archived") return "This account is already archived.";
  if (d && ["Live", "Provisioning", "Approved", "Deprovisioning"].includes(d.status)) return "The production deployment is " + d.status.toLowerCase() + ". Deprovisioning needs the backend workflow first.";
  if (["Active", "Past due"].includes(c.subscription.status)) return "Cancel the subscription first.";
  const open = data.invoices.filter((i) => i.clientId === c.id).some((i) => invoiceTotals(data, i).outstanding > 0);
  if (open) return "Settle or void outstanding invoices first.";
  if (data.sandboxes.some((s) => s.clientId === c.id && !["Retired", "Expired"].includes(sandboxStatus(s)))) return "Retire this client's sandboxes first.";
  return null;
}
export function archiveClient(id, reason) {
  return run(() => {
    requireDev();
    const c = clientById(id); need(c, "Organisation not found.");
    requireReason(reason);
    const block = archiveBlocker(c); need(!block, block);
    const before = c.accountStatus;
    c.accountStatus = "Archived"; c.archivedAt = TODAY;
    audit({ action: "Client account archived", clientId: id, target: "Organisation", before, after: "Archived", reason });
    return ok();
  });
}

/* ---------------------------------------------------- provisioning (simulated) */

export const PROVISION_STEPS = ["Database and roles", "Worker and static assets", "Queue and bindings", "DNS and hostname", "Identity redirect", "Smoke test"];

export function requestProvisioning(clientId, f) {
  return run(() => {
    requireDev();
    const c = clientById(clientId); need(c, "Organisation not found.");
    need(["Account created", "Provisioning failed"].includes(c.accountStatus), "Provisioning can only be requested for a new account or after a failed attempt.");
    need(["Active", "Trial"].includes(c.subscription.status), "The subscription must be Active or Trial.");
    const host = slugify(f.hostname || c.slug);
    need(host.length >= 2, "Enter a hostname made of letters, numbers and hyphens.");
    need(!data.deployments.some((d) => d.clientId !== clientId && d.hostname === host + ".thryvems.example"), "This hostname is already used by another deployment.");
    const rel = data.releases.find((r) => r.version === f.version);
    need(rel, "Choose a release from the registry.");
    need(rel.verification === "Verified" && rel.approval === "Approved", "Choose a verified and approved release.");
    requireReason(f.reason);
    let d = deploymentFor(clientId);
    if (!d) {
      d = { id: "dep-" + c.slug, clientId, env: "Production", worker: "client-" + c.slug, hostname: host + ".thryvems.example", channel: f.channel === "Pilot" ? "Pilot" : "Stable", resources: { neonProject: "client-" + c.slug, region: "aws-ap-southeast-1 (Singapore)", queue: "q-" + c.slug, r2Prefix: "iqms-exports/" + c.slug + "/", secrets: "Not set", entraRedirect: "Not registered" }, config: { idleTimeoutMinutes: 30, absoluteSessionHours: 8, mfaPrivilegedRoles: "Required", diagnostics: "Off by default", brandingVersion: "v1" }, failures: [], lastDeployed: null, lastCheck: null, version: null, build: null, schema: null, health: "Not checked" };
      data.deployments.push(d);
    }
    d.hostname = host + ".thryvems.example"; d.targetVersion = rel.version; d.status = "Requested"; d.requestedAt = TODAY; d.channel = f.channel === "Pilot" ? "Pilot" : "Stable";
    c.accountStatus = "Awaiting provisioning"; c.hostname = d.hostname;
    audit({ action: "Provisioning requested", clientId, target: "Deployment " + d.id, before: "Not provisioned", after: "Requested · " + d.hostname + " · " + rel.version, reason: f.reason });
    return ok({ id: d.id });
  });
}
export function approveProvisioning(depId, reason) {
  return run(() => {
    requireDev();
    const d = data.deployments.find((x) => x.id === depId); need(d, "Deployment not found.");
    need(d.status === "Requested", "Only requested deployments can be approved.");
    requireReason(reason);
    d.status = "Approved"; d.approvedAt = NOW;
    audit({ action: "Provisioning approved", clientId: d.clientId, target: "Deployment " + d.id, before: "Requested", after: "Approved", reason, approval: "Platform owner (re-confirmed)" });
    return ok();
  });
}
/** Walks the steps in simulation. Never sets Live: no infrastructure exists. */
export function simulateProvisioning(depId, outcome) {
  return run(() => {
    requireDev();
    const d = data.deployments.find((x) => x.id === depId); need(d, "Deployment not found.");
    need(d.status === "Approved", "Approve the request before running the simulation.");
    const c = clientById(d.clientId);
    const failAt = outcome === "fail" ? 3 : -1;
    const steps = PROVISION_STEPS.map((name, i) => ({ name, result: failAt === -1 || i < failAt ? "Passed in simulation" : i === failAt ? "Failed in simulation" : "Not run" }));
    const runRec = { id: uid("run"), depId, at: NOW, outcome: failAt === -1 ? "Simulation passed" : "Simulation failed", steps };
    data.provisioningRuns.unshift(runRec);
    if (failAt >= 0) {
      d.status = "Failed";
      d.failures.unshift({ at: NOW, step: PROVISION_STEPS[failAt], message: "Simulated failure: hostname validation record not found.", code: "PRV-DNS-02" });
      c.accountStatus = "Provisioning failed";
    } else {
      d.lastSimulation = NOW;
    }
    audit({ action: "Provisioning simulation run", clientId: d.clientId, target: "Deployment " + d.id, before: "Approved", after: runRec.outcome + (failAt >= 0 ? " at " + PROVISION_STEPS[failAt] : ""), reason: "Preview simulation. No infrastructure is created.", outcome: "Simulation only" });
    return ok({ run: runRec });
  });
}
export function retryProvisioning(depId, reason) {
  return run(() => {
    requireDev();
    const d = data.deployments.find((x) => x.id === depId); need(d, "Deployment not found.");
    need(d.status === "Failed", "Only failed provisioning can be retried.");
    requireReason(reason);
    d.status = "Approved";
    const c = clientById(d.clientId); c.accountStatus = "Awaiting provisioning";
    audit({ action: "Provisioning retry approved", clientId: d.clientId, target: "Deployment " + d.id, before: "Failed", after: "Approved", reason });
    return ok();
  });
}
export function cancelProvisioning(depId, reason) {
  return run(() => {
    requireDev();
    const d = data.deployments.find((x) => x.id === depId); need(d, "Deployment not found.");
    need(["Requested", "Approved", "Failed"].includes(d.status), "Only requested, approved or failed provisioning can be cancelled.");
    requireReason(reason);
    const before = d.status;
    data.deployments = data.deployments.filter((x) => x !== d);
    const c = clientById(d.clientId); c.accountStatus = "Account created";
    audit({ action: "Provisioning cancelled", clientId: d.clientId, target: "Deployment " + d.id, before, after: "Not provisioned", reason });
    return ok();
  });
}

/* --------------------------------------------------------------- sandboxes */

export function sandboxStatus(s) {
  if (["Retired", "Expired", "Approved for release"].includes(s.status)) return s.status;
  if (s.expiresAt && s.expiresAt < TODAY) return "Expired";
  return s.status;
}
export const activeSandboxes = (clientId) => data.sandboxes.filter((s) => (!clientId || s.clientId === clientId) && !["Retired", "Expired"].includes(sandboxStatus(s)));
const sb = (id) => { const s = data.sandboxes.find((x) => x.id === id); need(s, "Sandbox not found."); return s; };
const sbLog = (s, text) => s.changes.push({ at: NOW, by: actorName(), text });
const REF_RE = /^[A-Z]{2,6}-\d{1,6}$/;

export function createSandbox(f) {
  return run(() => {
    requireDev();
    const c = clientById(f.clientId); need(c, "Choose a client from the matching names.");
    const d = deploymentFor(c.id);
    need(d && d.status === "Live", "This client has no live production deployment to use as a source.");
    need(f.sourceVersion === d.version, "The source version must match the production version (" + d.version + ").");
    const target = data.releases.find((r) => r.version === f.targetVersion); need(target, "Choose a target version from the registry.");
    const name = slugify(f.name);
    need(name.length >= 3, "Enter a sandbox name of at least 3 letters or numbers.");
    need(!data.sandboxes.some((s) => s.name === name), "Another sandbox already uses this name.");
    need(SANDBOX_PURPOSES.includes(f.purpose), "Choose a purpose.");
    const ref = String(f.reference || "").trim().toUpperCase();
    need(REF_RE.test(ref), "Enter an issue or change reference such as SR-1035 or CHG-140.");
    const days = Number(f.retentionDays);
    need(Number.isInteger(days) && days >= 1 && days <= 30, "Retention must be between 1 and 30 days.");
    need(activeSandboxes(c.id).length < data.settings.sandboxMaxPerClient, "This client already has " + data.settings.sandboxMaxPerClient + " active sandboxes. Retire one first.");
    const allowed = ["modules", "idleTimeoutMinutes", "brandingVersion"];
    const config = {};
    for (const k of f.config || []) if (allowed.includes(k)) config[k] = k === "modules" ? c.modules.slice() : d.config[k];
    const s = { id: uid("sb"), name, clientId: c.id, sourceDeployment: d.id, sourceVersion: d.version, targetVersion: target.version, purpose: f.purpose, reference: ref, description: String(f.description || "").slice(0, 500), retentionDays: days, createdAt: TODAY, expiresAt: addDays(TODAY, days), status: "Requested", simulated: true, health: "Not checked (simulation)", config, changes: [], builds: [], tests: [], review: null, promotionRequestId: null };
    sbLog(s, "Sandbox requested from production " + d.version + (target.version !== d.version ? ", target " + target.version : "") + ". Synthetic data only.");
    data.sandboxes.unshift(s);
    audit({ action: "Sandbox requested", clientId: c.id, target: "Sandbox " + s.name, after: s.purpose + " · " + ref + " · target " + target.version, reason: s.description || s.purpose, outcome: "Simulation only" });
    return ok({ id: s.id });
  });
}
/** Moves a simulated sandbox one step: Requested → Provisioning → Ready. "fail" stops it at Database and roles. */
export function advanceSandbox(id, outcome) {
  return run(() => {
    requireDev();
    const s = sb(id);
    const st = sandboxStatus(s);
    need(["Requested", "Provisioning"].includes(st), "Only requested or provisioning sandboxes can advance.");
    if (outcome === "fail") {
      s.status = "Failed"; s.failure = { step: "Database and roles", code: "PRV-DB-01", message: "Simulated failure: sandbox database could not be created." };
      sbLog(s, "Simulated provisioning failed at Database and roles (PRV-DB-01).");
    } else if (st === "Requested") { s.status = "Provisioning"; sbLog(s, "Simulated provisioning started."); }
    else { s.status = "Ready"; s.builds.push({ at: NOW, version: s.targetVersion, build: (data.releases.find((r) => r.version === s.targetVersion) || {}).build, result: "Simulated" }); sbLog(s, "Simulated provisioning finished. No cloud resources exist."); }
    audit({ action: "Sandbox simulation advanced", clientId: s.clientId, target: "Sandbox " + s.name, before: st, after: s.status, reason: "Preview simulation", outcome: "Simulation only" });
    return ok();
  });
}
export function retrySandbox(id) {
  return run(() => {
    requireDev();
    const s = sb(id); need(sandboxStatus(s) === "Failed", "Only failed sandboxes can be retried.");
    s.status = "Requested"; s.failure = null; sbLog(s, "Retry requested.");
    audit({ action: "Sandbox retry", clientId: s.clientId, target: "Sandbox " + s.name, before: "Failed", after: "Requested", reason: "Retry after failure", outcome: "Simulation only" });
    return ok();
  });
}
export function changeSandboxTarget(id, version, reason) {
  return run(() => {
    requireDev();
    const s = sb(id); const st = sandboxStatus(s);
    need(["Ready", "Testing", "Ready for review"].includes(st), "The target version can be changed when the sandbox is Ready, Testing or Ready for review.");
    const r = data.releases.find((x) => x.version === version); need(r, "Choose a version from the registry.");
    need(version !== s.targetVersion, "This is already the target version.");
    requireReason(reason);
    const before = s.targetVersion;
    s.targetVersion = version; s.status = "Ready"; s.review = null;
    s.builds.push({ at: NOW, version, build: r.build, result: "Simulated" });
    sbLog(s, "Target version changed " + before + " → " + version + ". Earlier test results no longer count toward readiness. Reason: " + reason);
    audit({ action: "Sandbox target version changed", clientId: s.clientId, target: "Sandbox " + s.name, before, after: version, reason, outcome: "Simulation only" });
    return ok();
  });
}
export function recordSandboxNote(id, text) {
  return run(() => {
    requireDev();
    const s = sb(id); need(!["Retired", "Expired"].includes(sandboxStatus(s)), "This sandbox is closed.");
    const t = String(text || "").trim(); need(t.length >= 3, "Describe the issue or fix (at least 3 characters).");
    sbLog(s, t.slice(0, 500));
    audit({ action: "Sandbox issue or fix recorded", clientId: s.clientId, target: "Sandbox " + s.name, after: t.slice(0, 120), reason: s.reference });
    return ok();
  });
}
export function recordSandboxTest(id, f) {
  return run(() => {
    requireDev();
    const s = sb(id); const st = sandboxStatus(s);
    need(["Ready", "Testing", "Ready for review"].includes(st), "Record test results once the sandbox is Ready.");
    const name = String(f.name || "").trim(); need(name.length >= 3, "Enter the test or suite name.");
    need(["Passed", "Failed"].includes(f.result), "Choose Passed or Failed.");
    const link = String(f.link || "").trim(); need(!link || isHttps(link), "Paste a full https:// link to the CI run, or leave it empty.");
    s.tests.push({ id: uid("t"), name, result: f.result, at: NOW, by: actorName(), link, notes: String(f.notes || "").slice(0, 300), version: s.targetVersion });
    if (st === "Ready") s.status = "Testing";
    if (st === "Ready for review" && f.result === "Failed") { s.status = "Testing"; s.review = null; }
    sbLog(s, "Test result recorded: " + name + " — " + f.result + ".");
    audit({ action: "Sandbox test result recorded", clientId: s.clientId, target: "Sandbox " + s.name, after: name + ": " + f.result, reason: "Recorded from CI or manual testing" });
    return ok();
  });
}
/** Release readiness checks. Every item must pass before review and promotion. */
export function readiness(s) {
  const rel = data.releases.find((r) => r.version === s.targetVersion);
  const current = s.tests.filter((t) => !t.version || t.version === s.targetVersion);
  const latestByName = new Map();
  for (const t of current) latestByName.set(t.name, t);
  const latest = [...latestByName.values()];
  const d = deploymentFor(s.clientId);
  const compatible = rel && d && d.schema ? (rel.schema === d.schema || rel.schema > d.schema) : false;
  return [
    { label: "Issue or change reference recorded", ok: REF_RE.test(s.reference || "") },
    { label: "Target version is in the release registry", ok: !!rel },
    { label: "At least one test result recorded for the target version", ok: latest.length > 0 },
    { label: "Latest result of every test passed", ok: latest.length > 0 && latest.every((t) => t.result === "Passed") },
    { label: "Schema is forward-compatible with production (" + (d?.schema || "no schema") + " → " + (rel?.schema || "?") + ")", ok: compatible },
    { label: "Sandbox has not expired", ok: sandboxStatus(s) !== "Expired" },
    { label: "Review approved by the platform owner", ok: s.review?.decision === "Approved" },
  ];
}
export function submitSandboxReview(id) {
  return run(() => {
    requireDev();
    const s = sb(id); need(["Testing", "Ready"].includes(sandboxStatus(s)), "Only sandboxes in Ready or Testing can be submitted.");
    const checks = readiness(s).slice(0, 6); const missing = checks.filter((c) => !c.ok);
    need(!missing.length, "Not ready: " + missing.map((m) => m.label.toLowerCase()).join("; ") + ".");
    s.status = "Ready for review"; s.review = { submittedAt: NOW, decision: null };
    sbLog(s, "Submitted for review.");
    audit({ action: "Sandbox submitted for review", clientId: s.clientId, target: "Sandbox " + s.name, before: "Testing", after: "Ready for review", reason: s.reference });
    return ok();
  });
}
export function decideSandboxReview(id, approve, reason) {
  return run(() => {
    requireDev();
    const s = sb(id); need(sandboxStatus(s) === "Ready for review", "This sandbox is not waiting for review.");
    requireReason(reason);
    s.review = { ...s.review, decision: approve ? "Approved" : "Changes requested", by: actorName(), at: NOW, reason };
    s.status = approve ? "Approved for release" : "Testing";
    sbLog(s, approve ? "Review approved: " + reason : "Changes requested: " + reason);
    audit({ action: approve ? "Sandbox review approved" : "Sandbox changes requested", clientId: s.clientId, target: "Sandbox " + s.name, before: "Ready for review", after: s.status, reason, approval: approve ? "Platform owner" : "—" });
    return ok();
  });
}
export function requestPromotion(id, reason) {
  return run(() => {
    requireDev();
    const s = sb(id); need(sandboxStatus(s) === "Approved for release", "Approve the review before requesting promotion.");
    need(!s.promotionRequestId, "Promotion has already been requested.");
    requireReason(reason);
    const c = clientById(s.clientId); const d = deploymentFor(s.clientId);
    const req = { id: uid("req"), kind: "Release promotion", from: "developer", clientId: s.clientId, title: "Promote " + s.targetVersion + " to " + c.name + " production", detail: { sandboxId: s.id, from: d?.version, to: s.targetVersion }, reason, status: "Pending", at: NOW, decision: null };
    data.requests.unshift(req);
    s.promotionRequestId = req.id;
    sbLog(s, "Production promotion requested (" + req.id + ").");
    audit({ action: "Production promotion requested", clientId: s.clientId, target: "Deployment " + (d?.id || "—"), before: d?.version || "—", after: s.targetVersion, reason, approval: "Awaiting platform owner" });
    return ok({ id: req.id });
  });
}
export function retireSandbox(id, reason) {
  return run(() => {
    requireDev();
    const s = sb(id); need(sandboxStatus(s) !== "Retired", "This sandbox is already retired.");
    requireReason(reason);
    const before = sandboxStatus(s);
    s.status = "Retired"; sbLog(s, "Retired. Reason: " + reason);
    audit({ action: "Sandbox retired", clientId: s.clientId, target: "Sandbox " + s.name, before, after: "Retired", reason, outcome: "Simulation only (no cloud resources removed)" });
    return ok();
  });
}
export function extendSandbox(id, days, reason) {
  return run(() => {
    requireDev();
    const s = sb(id); need(!["Retired"].includes(sandboxStatus(s)), "Retired sandboxes can't be extended.");
    const n = Number(days); need(Number.isInteger(n) && n >= 1 && n <= 30, "Extend by 1 to 30 days.");
    requireReason(reason);
    const before = s.expiresAt; const base = s.expiresAt > TODAY ? s.expiresAt : TODAY;
    s.expiresAt = addDays(base, n); if (s.status === "Expired") s.status = "Ready";
    sbLog(s, "Retention extended to " + s.expiresAt + ". Reason: " + reason);
    audit({ action: "Sandbox retention extended", clientId: s.clientId, target: "Sandbox " + s.name, before, after: s.expiresAt, reason });
    return ok();
  });
}

/* ---------------------------------------------------------------- releases */

export function approveRelease(version, reason) {
  return run(() => {
    requireDev();
    const r = data.releases.find((x) => x.version === version); need(r, "Release not found.");
    need(r.approval !== "Approved", "This release is already approved.");
    requireReason(reason);
    const validated = data.sandboxes.some((s) => s.targetVersion === version && sandboxStatus(s) === "Approved for release");
    need(r.verification === "Verified" || validated, "Approve a sandbox review for this version first. Releases need a validated sandbox or verification.");
    const before = r.approval;
    r.approval = "Approved"; r.stage = Math.max(r.stage, 4);
    r.approvalHistory.push({ at: NOW, by: actorName(), decision: "Approved", reason });
    audit({ action: "Release approved", target: "Release " + version, before, after: "Approved (production deployment not executed)", reason, approval: "Platform owner" });
    return ok();
  });
}

/* ---------------------------------------------------------------- requests */

export function submitRequest(kind, f) {
  return run(() => {
    need(ui.role === "partner", "Only business partners submit requests here.");
    const pid = ui.partner;
    requireReason(f.reason);
    let req;
    if (kind === "Seat change" || kind === "Plan change") {
      const c = clientById(f.clientId);
      need(c && c.partnerId === pid, "Client not found.");
      const seats = Number(f.seats);
      const err = validateSeats(data, c, seats, { largeSeatApproval: partnerOf(pid).seatAuthority, commercialReference: null });
      if (err) throw new Error(err.replace("needs a commercial approval reference", "is above your authority. Ask the platform owner"));
      need(seats !== c.subscription.purchasedSeats || (f.billingCycle && f.billingCycle !== c.subscription.billingCycle), "Nothing changed. Change the seats or billing cycle.");
      requireEffective(f.effective);
      need(!data.requests.some((r) => r.clientId === c.id && r.status === "Pending" && ["Seat change", "Plan change"].includes(r.kind)), "A subscription change for this client is already waiting for a decision.");
      req = { kind: "Seat change", clientId: c.id, title: "Change subscription for " + c.name, detail: { field: "purchasedSeats", from: c.subscription.purchasedSeats, to: seats, billingCycle: f.billingCycle || c.subscription.billingCycle, effective: f.effective } };
    } else if (kind === "Enterprise customization") {
      const c = clientById(f.clientId); need(c && c.partnerId === pid, "Client not found.");
      need(String(f.name || "").trim().length >= 3, "Enter the project name.");
      need(String(f.scope || "").trim().length >= 10, "Describe the scope (at least 10 characters).");
      req = { kind, clientId: c.id, title: "Customization request for " + c.name, detail: { name: String(f.name).trim(), type: f.type || "Feature", scope: String(f.scope).trim(), amount: currentPricing(data).enterpriseFee } };
    } else if (kind === "New client account") {
      need(partnerOf(pid).canRequestClients, "You can't request new client accounts.");
      const name = String(f.name || "").trim(); need(name.length >= 2, "Enter the organisation name.");
      need(!data.clients.some((c) => c.name.toLowerCase() === name.toLowerCase()), "An organisation with this name already exists.");
      const seats = Number(f.seats); need(Number.isInteger(seats) && seats >= 1 && seats <= 10, "Trial accounts start with 1 to 10 users.");
      need(String(f.contactEmail || "").includes("@"), "Enter the client contact email.");
      req = { kind, clientId: null, title: "New client: " + name, detail: { name, seats, partnerId: pid, contactEmail: String(f.contactEmail).trim() } };
    } else throw new Error("Unknown request type.");
    const full = { id: uid("req"), from: pid, status: "Pending", at: NOW, decision: null, reason: String(f.reason).trim(), ...req };
    data.requests.unshift(full);
    audit({ action: "Request submitted: " + full.kind, clientId: full.clientId, target: "Request " + full.id, after: full.title, reason: full.reason, approval: "Awaiting platform owner" });
    return ok({ id: full.id });
  });
}
export function withdrawRequest(id) {
  return run(() => {
    const r = data.requests.find((x) => x.id === id); need(r, "Request not found.");
    need(ui.role === "partner" && r.from === ui.partner, "You can only withdraw your own requests.");
    need(r.status === "Pending", "Only pending requests can be withdrawn.");
    r.status = "Withdrawn"; r.decision = { by: actorName(), at: NOW, reason: "Withdrawn by requester" };
    audit({ action: "Request withdrawn", clientId: r.clientId, target: "Request " + id, before: "Pending", after: "Withdrawn", reason: "Withdrawn by requester" });
    return ok();
  });
}
export function decideRequest(id, approve, reason) {
  return run(() => {
    requireDev();
    const r = data.requests.find((x) => x.id === id); need(r, "Request not found.");
    need(r.status === "Pending", "This request has already been decided.");
    requireReason(reason);
    let note = "";
    if (approve) {
      if (r.kind === "Seat change" || r.kind === "Plan change") {
        const res = changeSubscription(r.clientId, { seats: r.detail.to, billingCycle: r.detail.billingCycle }, r.detail.effective < firstOfOpenMonth ? firstOfOpenMonth : r.detail.effective, r.reason, { fromRequest: true, approval: "Request " + r.id });
        need(res.ok, res.error);
        note = res.scheduled ? "Scheduled from " + r.detail.effective : "Applied";
      } else if (r.kind === "New client account") {
        const res = createClient({ name: r.detail.name, partnerId: r.detail.partnerId, planId: "trial", seats: r.detail.seats, contactEmail: r.detail.contactEmail || "admin@" + slugify(r.detail.name) + ".example", reason: "Approved request " + r.id });
        need(res.ok, res.error);
        r.clientId = res.id; note = "Account created (not provisioned)";
      } else if (r.kind === "Enterprise customization") {
        const res = createProject({ clientId: r.clientId, name: r.detail.name, type: r.detail.type, scope: r.detail.scope || r.reason, amount: r.detail.amount, expectedCompletion: addDays(TODAY, 90), reason: "Approved request " + r.id });
        need(res.ok, res.error);
        note = "Project created in Scoping";
      } else if (r.kind === "Release promotion") {
        note = "Approved. Production deployment is unavailable in the preview and was not executed.";
        const s = data.sandboxes.find((x) => x.id === r.detail.sandboxId);
        if (s) sbLog(s, "Promotion approved (" + r.id + "). Production deployment not executed in preview.");
      }
    }
    r.status = approve ? "Approved" : "Declined";
    r.decision = { by: actorName(), at: NOW, reason, note };
    audit({ action: "Request " + (approve ? "approved" : "declined") + ": " + r.kind, clientId: r.clientId, target: "Request " + id, before: "Pending", after: r.status + (note ? " — " + note : ""), reason, approval: "Platform owner" });
    return ok({ note });
  });
}

/* ------------------------------------------------------------------ finance */

export function updatePricing(f) {
  return run(() => {
    requireDev();
    requireEffective(f.effectiveFrom); requireReason(f.reason);
    need(f.effectiveFrom > TODAY, "New pricing applies from a future date so issued invoices keep their prices.");
    const nums = ["basePrice", "baseUsers", "additionalRate", "minSeats", "enterpriseFee"].map((k) => [k, Number(f[k])]);
    for (const [k, v] of nums) need(Number.isFinite(v) && v >= 0, "Enter a number for " + k.replace(/([A-Z])/g, " $1").toLowerCase() + ".");
    const o = Object.fromEntries(nums);
    need(o.baseUsers >= 1, "Base users must be at least 1.");
    need(o.minSeats >= 1 && o.minSeats <= o.baseUsers, "Minimum seats must be between 1 and the base users.");
    const prev = currentPricing(data);
    const v = { id: uid("pv"), effectiveFrom: f.effectiveFrom, ...o, annualMonths: 12, reason: f.reason, by: actorName(), at: NOW };
    data.pricing.push(v);
    audit({ action: "Pricing changed", target: "Pricing", before: "Base ₱" + prev.basePrice + " for " + prev.baseUsers + " users, +₱" + prev.additionalRate + " per seat", after: "Base ₱" + o.basePrice + " for " + o.baseUsers + " users, +₱" + o.additionalRate + " per seat from " + f.effectiveFrom, reason: f.reason });
    return ok();
  });
}
export const COST_CATEGORIES = ["Cloudflare Workers", "Cloudflare paid plans and features", "Neon databases and compute", "R2 storage and exports", "AWS S3 backups", "Amazon SES email", "Authentication providers", "Domains and DNS-related services", "Monitoring and logging", "Other platform operational tools"];
export function addCost(f) {
  return run(() => {
    requireDev();
    need(COST_CATEGORIES.includes(f.category), "Choose a cost category.");
    need(/^\d{4}-\d{2}$/.test(f.month) && f.month <= CURRENT_MONTH, "Choose a month up to the current month.");
    need(["Manual", "Estimate"].includes(f.basis), "Choose Manual or Estimate. Reconciled amounts come from provider imports.");
    const php = Number(f.php); need(Number.isFinite(php) && php >= 0, "Enter the amount in PHP.");
    const scope = f.scope;
    need(scope === "shared" || scope === "unallocated" || clientById(scope), "Choose a client, Shared or Unallocated.");
    need(String(f.source || "").trim().length >= 3, "Say where the amount comes from.");
    const rec = { id: uid("cost"), month: f.month, category: f.category, provider: f.provider || "Manual entry", clientId: clientById(scope) ? scope : null, shared: scope === "shared", unallocated: scope === "unallocated", usd: null, fx: null, php: round2(php), basis: f.basis, source: String(f.source).trim() };
    data.costs.push(rec);
    audit({ action: "Actual cost entry added", clientId: rec.clientId, target: "Cost " + rec.category + " · " + rec.month, after: "₱" + rec.php + " (" + rec.basis + ")", reason: rec.source });
    return ok();
  });
}
export function recordPayment(invoiceId, f) {
  return run(() => {
    requireDev();
    const inv = data.invoices.find((i) => i.id === invoiceId); need(inv, "Invoice not found.");
    const t = invoiceTotals(data, inv);
    need(t.outstanding > 0, "This invoice has nothing outstanding.");
    const amount = Number(f.amount); need(Number.isFinite(amount) && amount > 0, "Enter the amount received.");
    need(amount <= t.outstanding + 0.001, "The amount is more than the outstanding ₱" + t.outstanding.toLocaleString("en-PH") + ".");
    need(/^\d{4}-\d{2}-\d{2}$/.test(f.date || "") && f.date <= TODAY, "Choose the date the payment was received (today or earlier).");
    const ref = String(f.reference || "").trim(); need(ref.length >= 3, "Enter the bank or payment reference.");
    need(!data.payments.some((p) => p.reference === ref && p.invoiceId === invoiceId), "This reference is already recorded for this invoice.");
    data.payments.push({ id: uid("pay"), invoiceId, date: f.date, amount: round2(amount), reference: ref, method: "Bank transfer (recorded manually)" });
    audit({ action: "Payment recorded", clientId: inv.clientId, target: "Invoice " + inv.number, before: "Outstanding ₱" + t.outstanding, after: "Received ₱" + round2(amount) + " (" + ref + ")", reason: "Received outside ThryveMS. No money moved by the preview." });
    return ok();
  });
}
export function addAdjustment(f) {
  return run(() => {
    requireDev();
    const c = clientById(f.clientId); need(c, "Choose a client.");
    need(["Discount", "Credit note"].includes(f.kind), "Choose Discount or Credit note.");
    const amount = Number(f.amount); need(Number.isFinite(amount) && amount > 0, "Enter an amount above 0.");
    requireReason(f.reason);
    data.adjustments.push({ id: uid("adj"), clientId: c.id, kind: f.kind, month: CURRENT_MONTH, amount: round2(amount), reason: f.reason, by: actorName(), at: NOW, approval: "Approved by platform owner" });
    audit({ action: "Commercial adjustment recorded", clientId: c.id, target: f.kind, after: "₱" + round2(amount) + " in " + CURRENT_MONTH, reason: f.reason, approval: "Platform owner" });
    return ok();
  });
}

/* ------------------------------------------------------------ distributions */

export function publishStatement(month) {
  return run(() => {
    requireDev();
    const st = data.statements.find((s) => s.month === month); need(st, "Statement not found.");
    need(st.status === "Draft", "Only draft statements can be published.");
    need(month < CURRENT_MONTH, "The period is still open. Statements can be published after the month closes.");
    st.status = "Published"; st.publishedAt = TODAY;
    audit({ action: "Distribution statement published", target: "Statement " + month, before: "Draft", after: "Published to partners", reason: "Period closed" });
    return ok();
  });
}
export function addDistributionAdjustment(month, f) {
  return run(() => {
    requireDev();
    const st = data.statements.find((s) => s.month === month); need(st, "Statement not found.");
    need(st.status !== "Paid", "Paid statements can't change. Record the adjustment in the open month.");
    const amount = Number(f.amount); need(Number.isFinite(amount) && amount !== 0, "Enter a positive or negative amount.");
    requireReason(f.reason);
    st.adjustments.push({ id: uid("da"), amount: round2(amount), reason: f.reason, at: NOW, by: actorName() });
    audit({ action: "Distribution adjustment", target: "Statement " + month, after: (amount > 0 ? "+" : "") + "₱" + round2(amount), reason: f.reason });
    return ok();
  });
}
export function recordPayout(month, f) {
  return run(() => {
    requireDev();
    const st = data.statements.find((s) => s.month === month); need(st, "Statement not found.");
    need(st.status !== "Draft", "Publish the statement before recording payouts.");
    need(["Developer", "Partners (combined)"].includes(f.recipient), "Choose who was paid.");
    const d = distribution(data, month);
    const pending = f.recipient === "Developer" ? d.pendingDeveloper : d.pendingPartners;
    const amount = Number(f.amount); need(Number.isFinite(amount) && amount > 0, "Enter the amount paid.");
    need(amount <= pending + 0.001, "The amount is more than the pending ₱" + pending.toLocaleString("en-PH") + ".");
    const ref = String(f.reference || "").trim(); need(ref.length >= 3, "Enter the transfer reference.");
    st.payouts.push({ id: uid("po"), recipient: f.recipient, amount: round2(amount), date: TODAY, reference: ref });
    const after = distribution(data, month);
    if (after.pending <= 0.004) st.status = "Paid";
    audit({ action: "Distribution payout recorded", target: "Statement " + month, after: f.recipient + " ₱" + round2(amount) + " (" + ref + ")", reason: "Paid outside ThryveMS. No money moved by the preview." });
    return ok();
  });
}

/* --------------------------------------------------------------- enterprise */

export const PROJECT_STATES = ["Requested", "Scoping", "In progress", "Completed", "On hold", "Cancelled"];
export function createProject(f) {
  return run(() => {
    need(isDeveloper() || String(f.reason || "").startsWith("Approved request"), "Only the platform owner can create projects.");
    const c = clientById(f.clientId); need(c, "Choose a client.");
    const name = String(f.name || "").trim(); need(name.length >= 3, "Enter the project name.");
    const fee = currentPricing(data).enterpriseFee;
    const amount = f.amount === "" || f.amount == null ? fee : Number(f.amount);
    need(Number.isFinite(amount) && amount > 0, "Enter the commercial amount.");
    const exception = amount !== fee ? { reference: String(f.exceptionRef || "").trim(), reason: String(f.exceptionReason || "").trim(), approvedBy: actorName(), at: TODAY } : null;
    if (exception) need(/^EXC-\d{1,5}$/.test(exception.reference) && exception.reason.length >= 5, "Amounts other than the standard ₱" + fee.toLocaleString("en-PH") + " need an approved exception reference (EXC-123) and reason.");
    const p = { id: uid("ent"), clientId: c.id, name, type: f.type || "Feature", scope: String(f.scope || "").trim(), amount, exception, status: "Scoping", expectedCompletion: f.expectedCompletion || addDays(TODAY, 90), notes: "", approvedChanges: [], milestones: [{ id: uid("ms"), name: "Scope agreed", due: addDays(TODAY, 21), status: "Not started", amount, invoiceMonth: null }] };
    data.projects.unshift(p);
    audit({ action: "Enterprise project created", clientId: c.id, target: "Project " + name, after: "₱" + amount + (exception ? " (exception " + exception.reference + ")" : ""), reason: f.reason || "New project" });
    return ok({ id: p.id });
  });
}
export function updateProject(id, f, reason) {
  return run(() => {
    requireDev();
    const p = data.projects.find((x) => x.id === id); need(p, "Project not found.");
    requireReason(reason);
    need(PROJECT_STATES.includes(f.status), "Choose a status.");
    if (f.status === "Completed") need(p.milestones.every((m) => m.status === "Done"), "Mark every milestone done before completing the project.");
    const before = p.status + " · " + p.expectedCompletion;
    p.status = f.status; p.expectedCompletion = f.expectedCompletion || p.expectedCompletion; p.notes = String(f.notes || "").slice(0, 800);
    if (f.approvedChange && String(f.approvedChange).trim()) p.approvedChanges.push({ at: TODAY, text: String(f.approvedChange).trim(), by: actorName() });
    audit({ action: "Enterprise project updated", clientId: p.clientId, target: "Project " + p.name, before, after: p.status + " · " + p.expectedCompletion, reason });
    return ok();
  });
}
/** Marks a milestone done and creates an invoice record for its amount in the open month. The invoice is not sent. */
export function completeMilestone(projectId, msId, reason) {
  return run(() => {
    requireDev();
    const p = data.projects.find((x) => x.id === projectId); need(p, "Project not found.");
    const ms = p.milestones.find((m) => m.id === msId); need(ms, "Milestone not found.");
    need(ms.status !== "Done", "This milestone is already done.");
    requireReason(reason);
    ms.status = "Done";
    const id = uid("inv");
    const number = "INV-" + CURRENT_MONTH.replace("-", "") + "-P" + String(data.invoices.length + 1).padStart(4, "0");
    data.invoices.push({ id, number, clientId: p.clientId, kind: "Enterprise", projectId: p.id, milestoneId: ms.id, issueDate: TODAY, dueDate: addDays(TODAY, 14), vatRate: 0.12, lines: [{ description: p.name + " — " + ms.name, net: ms.amount, months: [CURRENT_MONTH] }], voided: false });
    ms.invoiceMonth = CURRENT_MONTH; ms.invoiceId = id;
    if (p.status === "Scoping") p.status = "In progress";
    audit({ action: "Milestone completed; invoice record created", clientId: p.clientId, target: "Project " + p.name, after: ms.name + " · " + number + " (not sent)", reason });
    return ok({ number });
  });
}
export function addMilestone(projectId, f) {
  return run(() => {
    requireDev();
    const p = data.projects.find((x) => x.id === projectId); need(p, "Project not found.");
    const name = String(f.name || "").trim(); need(name.length >= 3, "Enter the milestone name.");
    const amount = Number(f.amount); need(Number.isFinite(amount) && amount >= 0, "Enter the milestone amount (0 or more).");
    const planned = sum(p.milestones, "amount");
    need(planned + amount <= p.amount + 0.001, "Milestones would exceed the project amount of ₱" + p.amount.toLocaleString("en-PH") + ". Reduce another milestone first.");
    need(/^\d{4}-\d{2}-\d{2}$/.test(f.due || ""), "Choose a due date.");
    p.milestones.push({ id: uid("ms"), name, due: f.due, status: "Not started", amount: round2(amount), invoiceMonth: null });
    audit({ action: "Milestone added", clientId: p.clientId, target: "Project " + p.name, after: name + " ₱" + amount, reason: "Milestone plan" });
    return ok();
  });
}
export function editMilestoneAmount(projectId, msId, amount) {
  return run(() => {
    requireDev();
    const p = data.projects.find((x) => x.id === projectId); need(p, "Project not found.");
    const ms = p.milestones.find((m) => m.id === msId); need(ms && ms.status !== "Done", "Only open milestones can change.");
    const n = Number(amount); need(Number.isFinite(n) && n >= 0, "Enter an amount of 0 or more.");
    const others = sum(p.milestones.filter((m) => m !== ms), "amount");
    need(others + n <= p.amount + 0.001, "Milestones would exceed the project amount.");
    const before = ms.amount; ms.amount = round2(n);
    audit({ action: "Milestone amount changed", clientId: p.clientId, target: "Project " + p.name, before: "₱" + before, after: "₱" + ms.amount, reason: "Milestone plan" });
    return ok();
  });
}

/* --------------------------------------------------------- support and team */

export const REPORT_STATES = ["New", "Investigating", "Fix in sandbox", "Waiting for approval", "Deployed", "Closed"];
export function updateReport(id, f) {
  return run(() => {
    requireDev();
    const r = data.supportReports.find((x) => x.id === id); need(r, "Report not found.");
    const text = String(f.text || "").trim();
    const state = f.state || r.state;
    need(REPORT_STATES.includes(state), "Choose a state.");
    need(state !== "Deployed", "Deployed needs a verified production deployment. It can't be set in the preview.");
    if (state === "Fix in sandbox") need(r.sandboxId || f.sandboxId, "Link a sandbox first.");
    need(text.length >= 3 || state !== r.state || f.sandboxId, "Write an update or change the state.");
    const before = r.state;
    if (f.sandboxId) r.sandboxId = f.sandboxId;
    r.state = state;
    if (text) r.updates.push({ when: NOW, who: actorName(), text: text.slice(0, 600) });
    audit({ action: "Support report updated", clientId: r.clientId, target: r.id, before, after: state, reason: text.slice(0, 120) || "State change" });
    return ok();
  });
}
export function requestSupportAccess(f) {
  return run(() => {
    requireDev();
    const c = clientById(f.clientId); need(c, "Choose a client.");
    const r = data.supportReports.find((x) => x.id === f.ticket && x.clientId === c.id); need(r, "Choose a support report for this client.");
    need([1, 2, 4].includes(Number(f.hours)), "Choose 1, 2 or 4 hours.");
    need(!data.supportGrants.some((g) => g.clientId === c.id && ["Requested", "Active"].includes(g.state)), "There is already a pending or active grant for this client.");
    const g = { id: uid("SG"), clientId: c.id, ticket: r.id, grantedBy: "Waiting for the client administrator", usedBy: actorName(), hours: Number(f.hours), start: null, end: null, scope: "Read-only", ceiling: "Internal", state: "Requested" };
    data.supportGrants.unshift(g);
    audit({ action: "Support access requested", clientId: c.id, target: g.id, after: g.hours + " hours, read-only, " + r.id, reason: "Client administrator must approve in their workspace (D17)", approval: "Awaiting client" });
    return ok();
  });
}
export function endSupportAccess(id) {
  return run(() => {
    requireDev();
    const g = data.supportGrants.find((x) => x.id === id); need(g, "Grant not found.");
    need(["Active", "Requested"].includes(g.state), "This grant has already ended.");
    const before = g.state; g.state = before === "Requested" ? "Withdrawn" : "Ended"; g.end = g.end && before === "Active" ? NOW : g.end;
    audit({ action: before === "Requested" ? "Support access request withdrawn" : "Support access ended early", clientId: g.clientId, target: g.id, before, after: g.state, reason: "Ended by platform owner" });
    return ok();
  });
}
export const TEAM_ROLES = ["Platform owner", "Platform engineer (read-only logs)", "Business partner"];
export function inviteMember(f) {
  return run(() => {
    requireDev();
    const name = String(f.name || "").trim(); need(name.length >= 2, "Enter the person's name.");
    const email = String(f.email || "").trim(); need(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email), "Enter a valid email address.");
    need(!data.team.some((p) => p.email.toLowerCase() === email.toLowerCase()), "This person is already on the platform team.");
    need(TEAM_ROLES.slice(1).includes(f.role), "Choose a role. Platform owner can't be granted here.");
    const m = { id: uid("pt"), name, email, role: f.role, scope: f.role === "Business partner" ? "No clients assigned yet" : "All clients", status: "Invitation not sent (preview)", last: null, mfa: "Passkey required" };
    data.team.push(m);
    audit({ action: "Platform team member added", target: m.email, after: m.role + " · invitation not sent", reason: "Preview record only. Real access needs Cloudflare Access and WorkOS (D9)." });
    return ok();
  });
}
export function changeMemberRole(id, role, reason) {
  return run(() => {
    requireDev();
    const m = data.team.find((x) => x.id === id); need(m, "Person not found.");
    need(m.role !== "Platform owner", "The platform owner's role can't be changed here.");
    need(TEAM_ROLES.slice(1).includes(role) && role !== m.role, "Choose a different role.");
    requireReason(reason);
    const before = m.role; m.role = role;
    audit({ action: "Platform role changed", target: m.email, before, after: role, reason });
    return ok();
  });
}
export function removeMember(id, reason) {
  return run(() => {
    requireDev();
    const m = data.team.find((x) => x.id === id); need(m, "Person not found.");
    need(m.role !== "Platform owner", "The last platform owner can't be removed.");
    requireReason(reason);
    data.team = data.team.filter((x) => x !== m);
    audit({ action: "Platform access removed", target: m.email, before: m.role, after: "No access", reason });
    return ok();
  });
}
export function updateSettings(f) {
  return run(() => {
    requireDev();
    const days = Number(f.sandboxRetentionDays), max = Number(f.sandboxMaxPerClient), large = Number(f.largeSeatApproval);
    need(Number.isInteger(days) && days >= 1 && days <= 30, "Default retention must be 1 to 30 days.");
    need(Number.isInteger(max) && max >= 1 && max <= 5, "Allow 1 to 5 active sandboxes per client.");
    need(Number.isInteger(large) && large >= 50 && large <= 1000, "Large-seat approval threshold must be 50 to 1,000.");
    requireReason(f.reason);
    const before = JSON.stringify({ r: data.settings.sandboxRetentionDays, m: data.settings.sandboxMaxPerClient, l: data.settings.largeSeatApproval });
    Object.assign(data.settings, { sandboxRetentionDays: days, sandboxMaxPerClient: max, largeSeatApproval: large });
    audit({ action: "Platform settings changed", target: "Settings", before, after: JSON.stringify({ r: days, m: max, l: large }), reason: f.reason });
    return ok();
  });
}
export const partnerProfiles = {};
export function updatePartnerSettings(f) {
  return run(() => {
    need(ui.role === "partner", "Only business partners change these settings.");
    const name = String(f.displayName || "").trim(); need(name.length >= 2, "Enter a display name.");
    data.partnerSettings = data.partnerSettings || {};
    const before = JSON.stringify(data.partnerSettings[ui.partner] || {});
    data.partnerSettings[ui.partner] = { displayName: name, notifyRequests: !!f.notifyRequests, notifyInvoices: !!f.notifyInvoices, reportPeriod: f.reportPeriod || "Month" };
    audit({ action: "Business settings changed", target: partnerOf(ui.partner).label, before, after: JSON.stringify(data.partnerSettings[ui.partner]), reason: "Partner preference" });
    return ok();
  });
}
export const partnerSettings = (pid) => (data.partnerSettings || {})[pid] || { displayName: partnerOf(pid)?.person, notifyRequests: true, notifyInvoices: true, reportPeriod: "Month" };
