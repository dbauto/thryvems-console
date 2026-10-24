/**
 * Synthetic preview records. Every name, domain, amount and identifier is fictional.
 * Figures on screen are derived from these records by src/finance.js, never typed in separately.
 * No real secrets, client data, QMS records, deployment URLs or provider bills.
 */
import { MONTHS, prng, slugify, addDays, round2 } from "./util.js";

export const PARTNERS = [
  { id: "partner-a", label: "Partner A", person: "Mara Santos", email: "partner-a@partners.example", seatAuthority: 100, canRequestClients: true },
  { id: "partner-b", label: "Partner B", person: "Jun Reyes", email: "partner-b@partners.example", seatAuthority: 100, canRequestClients: true },
];

export const MODULES = ["Core QMS", "Documents", "Risks & Opportunities", "Evidence", "Audits", "Management Review", "Corrective Action", "Objectives & KPIs", "Certification readiness"];
export const CORE_MODULE = "Core QMS";

export const ACCOUNT_STATES = ["Account created", "Awaiting provisioning", "Provisioning", "Live", "Suspended", "Archived", "Provisioning failed"];
export const DEPLOYMENT_STATES = ["Not provisioned", "Requested", "Approved", "Provisioning", "Live", "Failed", "Suspended", "Deprovisioning", "Deprovisioned"];
export const SUBSCRIPTION_STATES = ["Trial", "Active", "Past due", "Suspended", "Cancelled"];
export const SANDBOX_STATES = ["Requested", "Provisioning", "Ready", "Testing", "Ready for review", "Approved for release", "Failed", "Expired", "Retired"];
export const SANDBOX_PURPOSES = ["Bug fix", "Feature update", "Version validation", "Configuration testing"];

/** Commercial capacity sizing for infrastructure planning only. Not subscription plans or prices. */
export const CAPACITY_TIERS = [
  { id: "micro", name: "Micro", min: 1, max: 30, note: "0.25 CU autoscaling, suspend after 15 minutes idle" },
  { id: "small", name: "Small", min: 31, max: 50, note: "0.25–0.5 CU autoscaling" },
  { id: "medium", name: "Medium", min: 51, max: 100, note: "0.5–1 CU autoscaling; review always-on minimum" },
  { id: "custom", name: "Custom", min: 101, max: null, note: "Needs capacity review and commercial approval" },
];

const FIXED = [
  { name: "Demo Manufacturing", partnerId: "partner-a", seats: 32, used: 24, status: "Live", version: "1.8.2", cycle: "Monthly" },
  { name: "Sample Services", partnerId: "partner-a", seats: 12, used: 9, status: "Live", version: "1.8.1", cycle: "Monthly" },
  { name: "Example Logistics", partnerId: "partner-b", seats: 46, used: 40, status: "Live", version: "1.8.2", cycle: "Annual" },
  { name: "Test Retail", partnerId: "partner-b", seats: 10, used: 0, status: "Account created", version: null, cycle: "Monthly", trial: true },
];
const FIRST = ["Arden", "Bayside", "Cedar", "Delta", "Evergreen", "Fairview", "Granite", "Harbor", "Ironwood", "Juniper", "Kestrel", "Lakeside", "Meridian", "Northwind", "Oakridge", "Pinecrest", "Quarry", "Riverbend", "Summit", "Tidewater", "Upland", "Valley", "Westfield", "Yellowfin", "Zenith", "Coral", "Mangrove", "Sampaguita"];
const SECOND = ["Foods", "Engineering", "Logistics", "Labs", "Fabrication", "Services", "Packaging", "Plastics", "Textiles", "Electronics", "Builders", "Freight"];
const INDUSTRIES = ["Manufacturing", "Logistics", "Food production", "Engineering services", "Laboratory", "Construction"];

function buildClients() {
  const rnd = prng(2026);
  const names = new Set(FIXED.map((f) => f.name));
  const plan = [...FIXED];
  const statusPlan = [];
  for (let i = 0; i < 56; i++) {
    let n;
    do n = FIRST[Math.floor(rnd() * FIRST.length)] + " " + SECOND[Math.floor(rnd() * SECOND.length)];
    while (names.has(n));
    names.add(n);
    let status = "Live";
    if (i === 3 || i === 17) status = "Awaiting provisioning";
    else if (i === 9 || i === 41) status = "Account created";
    else if (i === 22) status = "Provisioning";
    else if (i === 30) status = "Provisioning failed";
    else if (i === 12 || i === 48) status = "Suspended";
    else if (i === 26 || i === 53) status = "Archived";
    statusPlan.push(status);
    const seats = status === "Live" || status === "Suspended" ? [5, 8, 10, 12, 15, 18, 20, 25, 30, 35, 40, 45, 50, 60][Math.floor(rnd() * 14)] : 10;
    const used = status === "Live" || status === "Suspended" ? Math.max(1, Math.min(seats, Math.round(seats * (0.55 + rnd() * 0.45)))) : 0;
    plan.push({
      name: n, partnerId: rnd() < 0.55 ? "partner-a" : "partner-b", seats, used, status,
      version: status === "Live" || status === "Suspended" ? (rnd() < 0.7 ? "1.8.2" : rnd() < 0.6 ? "1.8.1" : "1.8.0") : null,
      cycle: rnd() < 0.12 ? "Annual" : "Monthly",
      trial: (status === "Live" && rnd() < 0.1) || status === "Account created" || status === "Awaiting provisioning",
    });
  }
  return plan.map((p, i) => {
    const slug = slugify(p.name);
    const id = "c-" + slug;
    const startMonth = p.trial ? "2026-10" : MONTHS[i > 0 && i % 7 === 0 ? 2 : i % 5 === 0 ? 1 : 0];
    const createdAt = p.status === "Account created" || p.status === "Awaiting provisioning" ? "2026-10-" + String(10 + (i % 12)).padStart(2, "0") : startMonth + "-0" + (1 + (i % 6));
    const modules = [CORE_MODULE, ...MODULES.slice(1).filter((_, k) => (i + k) % 4 !== 0)];
    const subStatus = p.status === "Archived" ? "Cancelled" : p.status === "Suspended" ? "Suspended" : p.trial ? "Trial" : i === 7 || i === 19 ? "Past due" : "Active";
    return {
      id, slug, name: p.name, partnerId: p.partnerId,
      industry: INDUSTRIES[i % INDUSTRIES.length],
      hostname: slug + ".thryvems.example",
      contact: { name: "Account contact " + String(i + 1).padStart(2, "0"), email: "admin@" + slug + ".example", phone: "+63 2 8000 " + String(1000 + i).slice(-4) },
      accountStatus: p.status,
      createdAt,
      archivedAt: p.status === "Archived" ? "2026-09-30" : null,
      modules,
      notes: "",
      subscription: {
        planId: p.trial ? "trial" : "standard",
        status: subStatus,
        billingCycle: p.cycle,
        purchasedSeats: p.seats,
        activeUsers: p.used,
        startDate: p.trial ? createdAt : startMonth + "-01",
        renewalDate: p.cycle === "Annual" ? "2027-0" + (i % 2 ? "7" : "8") + "-01" : "2026-11-01",
        trialEnds: p.trial ? addDays(createdAt, 30) : null,
        cancelledAt: subStatus === "Cancelled" ? "2026-09-30" : null,
        history: [],
      },
      version: p.version,
    };
  });
}

const RELEASE_LIST = [
  { version: "1.9.0-rc.1", type: "Release candidate", commit: "9f3c2ab", build: "b-2026.10.23.2", date: "2026-10-23", schema: "S-25", notes: "Audit plan timetable printing, onboarding checklist, readiness tabs.", verification: "In testing", approval: "Not requested", stage: 2 },
  { version: "1.8.2", type: "Patch", commit: "4d81e07", build: "b-2026.10.18.1", date: "2026-10-18", schema: "S-24", notes: "Maintenance update: reminder timing and link checks.", verification: "Verified", approval: "Approved", stage: 6 },
  { version: "1.8.1", type: "Patch", commit: "a172f5c", build: "b-2026.10.12.1", date: "2026-10-12", schema: "S-24", notes: "Navigation fixes and loading states.", verification: "Verified", approval: "Approved", stage: 6 },
  { version: "1.8.0", type: "Minor", commit: "e05b9d1", build: "b-2026.10.08.3", date: "2026-10-08", schema: "S-24", notes: "Processes layouts and certification settings.", verification: "Verified", approval: "Approved", stage: 6 },
  { version: "1.7.4", type: "Patch", commit: "71ac3e2", build: "b-2026.08.20.1", date: "2026-08-20", schema: "S-23", notes: "Previous stable version.", verification: "Verified", approval: "Approved", stage: 6 },
];
export const RELEASE_STAGES = ["Development", "Sandbox", "Testing", "Review", "Approval", "Production deployment", "Verification"];

function buildDeployments(clients) {
  const rnd = prng(77);
  const deps = [];
  for (const c of clients) {
    const base = {
      id: "dep-" + c.slug, clientId: c.id, env: "Production", worker: "client-" + c.slug, hostname: c.hostname,
      channel: rnd() < 0.15 ? "Pilot" : "Stable",
      resources: { neonProject: "client-" + c.slug, region: "aws-ap-southeast-1 (Singapore)", queue: "q-" + c.slug, r2Prefix: "iqms-exports/" + c.slug + "/", secrets: "Set (values never shown)", entraRedirect: "Registered" },
      config: { idleTimeoutMinutes: [15, 30, 60][Math.floor(rnd() * 3)], absoluteSessionHours: 8, mfaPrivilegedRoles: "Required", diagnostics: "Off by default", brandingVersion: "v" + (1 + Math.floor(rnd() * 3)) },
      failures: [], lastDeployed: null, lastCheck: null, version: null, build: null, schema: null, health: "Not checked",
    };
    if (c.accountStatus === "Account created") continue;
    if (c.accountStatus === "Awaiting provisioning") { deps.push({ ...base, status: "Requested", requestedAt: c.createdAt }); continue; }
    if (c.accountStatus === "Provisioning") { deps.push({ ...base, status: "Provisioning", requestedAt: "2026-10-20", step: "Database and roles" }); continue; }
    if (c.accountStatus === "Provisioning failed") {
      deps.push({ ...base, status: "Failed", requestedAt: "2026-10-19", failures: [{ at: "2026-10-19T09:42", step: "DNS and hostname", message: "Hostname check did not pass. The custom hostname validation record was not found.", code: "PRV-DNS-02" }] });
      continue;
    }
    const rel = RELEASE_LIST.find((r) => r.version === c.version) || RELEASE_LIST[1];
    const archived = c.accountStatus === "Archived";
    const healthRoll = rnd();
    deps.push({
      ...base,
      status: archived ? "Deprovisioned" : c.accountStatus === "Suspended" ? "Suspended" : "Live",
      version: archived ? null : rel.version, build: archived ? null : rel.build, schema: archived ? null : rel.schema,
      lastDeployed: archived ? "2026-09-30T10:00" : rel.date + "T2" + Math.floor(rnd() * 3) + ":1" + Math.floor(rnd() * 6),
      lastCheck: archived ? null : "2026-10-24T13:" + String(10 + Math.floor(rnd() * 40)).padStart(2, "0"),
      health: archived ? "Not checked" : c.accountStatus === "Suspended" ? "Not checked" : healthRoll < 0.08 ? "Warning" : healthRoll < 0.1 ? "Down" : "Healthy",
      failures: healthRoll < 0.1 && !archived ? [{ at: "2026-10-24T11:05", step: "Health check", message: healthRoll < 0.08 ? "Queue delay above 5 minutes for 3 checks." : "5xx rate above 1% for 5 minutes.", code: healthRoll < 0.08 ? "HLT-Q-DELAY" : "HLT-5XX" }] : [],
    });
  }
  return deps;
}

function buildReleaseHistory(deployments) {
  const out = [];
  let n = 100;
  for (const d of deployments) {
    if (!d.version && d.status !== "Deprovisioned") continue;
    const target = d.version || "1.8.0";
    const idx = RELEASE_LIST.findIndex((r) => r.version === target);
    const prev = RELEASE_LIST[Math.min(idx + 1, RELEASE_LIST.length - 1)].version;
    out.push({ id: "rh-" + n, clientId: d.clientId, env: "Production", from: prev, to: target, ref: "CHG-" + (n++), requestedBy: "Platform owner", approval: "Approved by platform owner", result: "Succeeded", verification: "Verified", rollbackRef: null, at: (d.lastDeployed || "2026-10-08T21:00") });
  }
  out.push({ id: "rh-rollback-1", clientId: deployments[1].clientId, env: "Production", from: "1.8.1", to: "1.8.0", ref: "CHG-091", requestedBy: "Platform owner", approval: "Approved by platform owner", result: "Rolled back", verification: "Verified after rollback", rollbackRef: "CHG-090", at: "2026-10-12T22:40" });
  return out;
}

function buildSandboxes(clients) {
  const byName = (n) => clients.find((c) => c.name === n);
  const demo = byName("Demo Manufacturing"), logi = byName("Example Logistics"), svc = byName("Sample Services");
  const live = clients.filter((c) => c.accountStatus === "Live");
  const other = live[8], fourth = live[14];
  const mk = (o) => ({ simulated: true, description: "", retentionDays: 14, health: "Not checked (simulation)", changes: [], builds: [], tests: [], review: null, promotionRequestId: null, config: {}, ...o });
  return [
    mk({ id: "sb-1001", name: "demo-manufacturing-rc19", clientId: demo.id, sourceVersion: "1.8.2", targetVersion: "1.9.0-rc.1", purpose: "Version validation", reference: "CHG-140", description: "Validate 1.9.0-rc.1 audit plan printing before pilot release.", createdAt: "2026-10-21", expiresAt: "2026-11-04", status: "Ready for review",
      config: { modules: demo.modules.slice(), idleTimeoutMinutes: 30, brandingVersion: "v2" },
      changes: [{ at: "2026-10-21T10:02", by: "Platform owner", text: "Sandbox requested from production 1.8.2." }, { at: "2026-10-21T10:30", by: "Platform owner", text: "Target version set to 1.9.0-rc.1." }, { at: "2026-10-23T16:10", by: "Platform owner", text: "Submitted for review." }],
      builds: [{ at: "2026-10-21T10:20", version: "1.8.2", build: "b-2026.10.18.1", result: "Simulated" }, { at: "2026-10-23T09:12", version: "1.9.0-rc.1", build: "b-2026.10.23.2", result: "Simulated" }],
      tests: [{ id: "t-1", name: "Playwright e2e suite", result: "Passed", at: "2026-10-23T11:40", by: "Platform owner", link: "https://github.example/thryvems/actions/runs/1001", notes: "88/88 passed (recorded from CI)." }, { id: "t-2", name: "Isolation suite", result: "Passed", at: "2026-10-23T11:52", by: "Platform owner", link: "https://github.example/thryvems/actions/runs/1002", notes: "Cross-client negatives passed." }],
      review: { submittedAt: "2026-10-23T16:10", decision: null } }),
    mk({ id: "sb-1002", name: "example-logistics-sr1035", clientId: logi.id, sourceVersion: "1.8.2", targetVersion: "1.8.2", purpose: "Bug fix", reference: "SR-1035", description: "Reproduce reminder emails sent twice for one audit.", createdAt: "2026-10-22", expiresAt: "2026-11-05", status: "Testing",
      config: { modules: logi.modules.slice(), idleTimeoutMinutes: 30, brandingVersion: "v1" },
      changes: [{ at: "2026-10-22T08:15", by: "Platform owner", text: "Sandbox requested for SR-1035." }, { at: "2026-10-22T09:01", by: "Platform owner", text: "Issue recorded: duplicate reminder after queue retry." }],
      builds: [{ at: "2026-10-22T08:40", version: "1.8.2", build: "b-2026.10.18.1", result: "Simulated" }],
      tests: [{ id: "t-3", name: "Reminder idempotency test", result: "Failed", at: "2026-10-22T10:30", by: "Platform owner", link: "", notes: "Reproduced the duplicate send. Fix in progress." }] }),
    mk({ id: "sb-1003", name: "sample-services-config", clientId: svc.id, sourceVersion: "1.8.1", targetVersion: "1.8.2", purpose: "Configuration testing", reference: "CHG-133", createdAt: "2026-10-15", expiresAt: "2026-10-22", status: "Expired",
      config: { modules: svc.modules.slice(), idleTimeoutMinutes: 15, brandingVersion: "v1" }, changes: [{ at: "2026-10-15T14:00", by: "Platform owner", text: "Sandbox requested." }] }),
    mk({ id: "sb-1004", name: other.slug + "-provisioning", clientId: other.id, sourceVersion: other.version, targetVersion: "1.9.0-rc.1", purpose: "Feature update", reference: "CHG-142", createdAt: "2026-10-24", expiresAt: "2026-11-07", status: "Failed",
      config: { modules: other.modules.slice(), idleTimeoutMinutes: 30, brandingVersion: "v1" },
      changes: [{ at: "2026-10-24T09:00", by: "Platform owner", text: "Sandbox requested." }, { at: "2026-10-24T09:20", by: "Simulation", text: "Simulated provisioning stopped at Database and roles (PRV-DB-01)." }],
      failure: { step: "Database and roles", code: "PRV-DB-01", message: "Simulated failure: sandbox database could not be created." } }),
    mk({ id: "sb-0990", name: fourth.slug + "-hotfix", clientId: fourth.id, sourceVersion: "1.8.0", targetVersion: "1.8.1", purpose: "Bug fix", reference: "SR-1012", createdAt: "2026-10-05", expiresAt: "2026-10-19", status: "Retired",
      config: { modules: fourth.modules.slice() }, changes: [{ at: "2026-10-05T09:00", by: "Platform owner", text: "Sandbox requested." }, { at: "2026-10-13T17:00", by: "Platform owner", text: "Retired after 1.8.1 release. Reason: fix released." }] }),
  ];
}

/** Illustrative pricing only. Final monthly prices are not approved and are labelled as such on screen. */
export const PLANS = [
  { id: "trial", name: "Trial", description: "30 days, up to 10 users, no charge.", maxSeats: 10, chargeable: false },
  { id: "standard", name: "Standard", description: "Base subscription with 10 users included; additional seats billed separately.", maxSeats: null, chargeable: true },
];
const PRICING = [
  { id: "pv-1", effectiveFrom: "2026-07-01", basePrice: 5000, baseUsers: 10, additionalRate: 200, minSeats: 1, enterpriseFee: 150000, annualMonths: 12, reason: "Illustrative preview pricing (not approved).", by: "Platform owner", at: "2026-07-01T09:00" },
];
const ALLOCATION_DEFAULT = [{ id: "af-1", effectiveFrom: "2026-07-01", fixed: 1000, perUser: 15, reason: "Illustrative allocated service expense for commercial reporting.", by: "Platform owner", at: "2026-07-01T09:00" }];

/** Purchased seats in force for a month, replaying "Purchased seats" history entries by effective date. */
export function seatsAt(sub, month) {
  const changes = (sub.history || []).filter((h) => h.field === "Purchased seats").sort((a, b) => a.effective.localeCompare(b.effective));
  let seats = sub.purchasedSeats;
  for (let i = changes.length - 1; i >= 0; i--) if (changes[i].effective.slice(0, 7) > month) seats = changes[i].from;
  return Number(seats);
}

/** Monthly charge from pricing in force. */
export function subscriptionCharge(pricing, seats) {
  return round2(pricing.basePrice + Math.max(0, seats - pricing.baseUsers) * pricing.additionalRate);
}

function buildFinance(clients) {
  const rnd = prng(4242);
  const invoices = [], payments = [], costs = [], adjustments = [];
  let inv = 1;
  const fx = { "2026-07": 57.62, "2026-08": 57.91, "2026-09": 57.78, "2026-10": 57.8 };
  const pricing = PRICING[0];
  for (const m of MONTHS) {
    for (const c of clients) {
      const s = c.subscription;
      const started = s.startDate.slice(0, 7) <= m;
      const ended = s.cancelledAt && s.cancelledAt.slice(0, 7) < m;
      if (!started || ended || s.planId !== "standard") continue;
      if (c.accountStatus === "Suspended" && m === "2026-10") continue;
      const seats = seatsAt(s, m);
      const monthly = subscriptionCharge(pricing, seats);
      const annual = s.billingCycle === "Annual";
      if (annual && m !== s.startDate.slice(0, 7)) continue;
      const months = annual ? Array.from({ length: 12 }, (_, k) => { const d = new Date(Date.UTC(+m.slice(0, 4), +m.slice(5) - 1 + k, 1)); return d.toISOString().slice(0, 7); }) : [m];
      const net = annual ? round2(monthly * 12) : monthly;
      const issue = m + "-01";
      const due = m + "-15";
      const id = "inv-" + inv;
      const number = "INV-" + m.replace("-", "") + "-" + String(inv++).padStart(4, "0");
      const late = m === "2026-10" && rnd() < 0.3;
      const pastDue = s.status === "Past due" && (m === "2026-09" || m === "2026-10");
      invoices.push({ id, number, clientId: c.id, kind: "Subscription", issueDate: issue, dueDate: due, vatRate: 0.12, lines: [{ description: "Standard subscription, " + seats + " seats" + (annual ? ", annual" : ""), net, months }], voided: false });
      const gross = round2(net * 1.12);
      if (pastDue) continue;
      if (m === "2026-10" && late) continue;
      if (m === "2026-09" && rnd() < 0.05) { payments.push({ id: "pay-" + id, invoiceId: id, date: m + "-20", amount: round2(gross / 2), reference: "BT-" + number.slice(4), method: "Bank transfer (recorded manually)" }); continue; }
      payments.push({ id: "pay-" + id, invoiceId: id, date: m + "-" + String(5 + Math.floor(rnd() * 9)).padStart(2, "0"), amount: gross, reference: "BT-" + number.slice(4), method: "Bank transfer (recorded manually)" });
    }
    // Actual provider costs (developer only).
    for (const c of clients) {
      if (!["Live", "Suspended"].includes(c.accountStatus)) continue;
      if (c.subscription.startDate.slice(0, 7) > m) continue;
      const users = c.subscription.activeUsers;
      const neonUsd = round2(9.5 + users * 0.09 + rnd() * 1.2);
      const basis = m === "2026-10" ? "Estimate" : "Reconciled";
      costs.push({ id: "cost-neon-" + c.slug + "-" + m, month: m, category: "Neon databases and compute", provider: "Neon", clientId: c.id, usd: neonUsd, fx: fx[m], php: round2(neonUsd * fx[m]), basis, source: basis === "Reconciled" ? "Neon invoice line (synthetic)" : "Calculated from plan §3 cost model" });
      costs.push({ id: "cost-ses-" + c.slug + "-" + m, month: m, category: "Amazon SES email", provider: "AWS", clientId: c.id, usd: null, fx: null, php: round2(10 + users * 0.6), basis: "Estimate", source: "Email volume × USD 0.10 per 1,000 (estimate)" });
      const s3Missing = m === "2026-10" && c.slug.length % 5 === 0;
      costs.push({ id: "cost-s3-" + c.slug + "-" + m, month: m, category: "AWS S3 backups", provider: "AWS", clientId: c.id, usd: null, fx: null, php: s3Missing ? null : 29, basis: s3Missing ? "Not available" : "Manual", source: s3Missing ? "Billing export not received" : "Manual entry from AWS bill (synthetic)" });
      costs.push({ id: "cost-r2-" + c.slug + "-" + m, month: m, category: "R2 storage and exports", provider: "Cloudflare", clientId: c.id, usd: null, fx: null, php: round2(2 + rnd() * 6), basis: "Estimate", source: "Storage GB-month × USD 0.015 (estimate)" });
    }
    const shared = [
      ["Cloudflare Workers", "Cloudflare", 5], ["Cloudflare paid plans and features", "Cloudflare", 25], ["Neon databases and compute", "Neon", 10.4],
      ["Monitoring and logging", "AWS", 4.1], ["Authentication providers", "WorkOS", 0],
    ];
    for (const [cat, prov, usd] of shared) {
      costs.push({ id: "cost-shared-" + slugify(cat) + "-" + m, month: m, category: cat, provider: prov, clientId: null, shared: true, usd, fx: fx[m], php: round2(usd * fx[m]), basis: m === "2026-10" ? "Estimate" : "Reconciled", source: cat === "Neon databases and compute" ? "Neon Launch organisation: sandbox, staging, platform DB" : prov + " invoice (synthetic)" });
    }
    costs.push({ id: "cost-dns-" + m, month: m, category: "Domains and DNS-related services", provider: "Registrar", clientId: null, shared: true, usd: null, fx: null, php: 150, basis: "Manual", source: "Annual domain fee ÷ 12 (synthetic)" });
    costs.push({ id: "cost-gh-" + m, month: m, category: "Other platform operational tools", provider: "GitHub", clientId: null, shared: false, unallocated: true, usd: 4, fx: fx[m], php: round2(4 * fx[m]), basis: "Manual", source: "GitHub Team seat (not allocated to clients)" });
  }
  const demo = clients.find((c) => c.name === "Demo Manufacturing");
  const logi = clients.find((c) => c.name === "Example Logistics");
  adjustments.push({ id: "adj-1", clientId: demo.id, kind: "Discount", month: "2026-09", amount: 1000, reason: "Onboarding goodwill discount (approved)", by: "Platform owner", at: "2026-09-02T10:00", approval: "Approved by platform owner" });
  adjustments.push({ id: "adj-2", clientId: logi.id, kind: "Credit note", month: "2026-10", amount: 1500, reason: "Service credit for 2-hour outage (SLA)", by: "Platform owner", at: "2026-10-16T15:20", approval: "Approved by platform owner" });

  // Enterprise customisation projects. One-time fee ₱150,000 unless an approved exception applies.
  const projects = [
    { id: "ent-1", clientId: demo.id, name: "Supplier portal integration", type: "Integration", scope: "Read-only supplier evaluation feed into Risks & Opportunities via approved links.", amount: 150000, exception: null, status: "In progress", expectedCompletion: "2026-12-15", notes: "Uses links only; no file uploads.", approvedChanges: [{ at: "2026-09-10", text: "Added CSV mapping review step (no fee change).", by: "Platform owner" }],
      milestones: [{ id: "ms-1", name: "Design approved", due: "2026-08-25", status: "Done", amount: 75000, invoiceMonth: "2026-08" }, { id: "ms-2", name: "Delivery and acceptance", due: "2026-12-15", status: "Not started", amount: 75000, invoiceMonth: null }] },
    { id: "ent-2", clientId: logi.id, name: "Custom audit checklist pack", type: "Configuration", scope: "Twelve logistics-specific checklist templates and report layout.", amount: 120000, exception: { reference: "EXC-007", reason: "Multi-year commitment; approved commercial exception.", approvedBy: "Platform owner", at: "2026-08-30" }, status: "Completed", expectedCompletion: "2026-10-10", notes: "Accepted by client on 10 Oct 2026.", approvedChanges: [],
      milestones: [{ id: "ms-3", name: "Templates delivered", due: "2026-09-20", status: "Done", amount: 60000, invoiceMonth: "2026-09" }, { id: "ms-4", name: "Client acceptance", due: "2026-10-10", status: "Done", amount: 60000, invoiceMonth: "2026-10" }] },
    { id: "ent-3", clientId: clients.find((c) => c.accountStatus === "Live" && c.partnerId === "partner-a" && c !== demo).id, name: "Bilingual work instructions", type: "Feature", scope: "Filipino and English labels for procedures (scoping).", amount: 150000, exception: null, status: "Scoping", expectedCompletion: "2027-02-28", notes: "", approvedChanges: [], milestones: [{ id: "ms-5", name: "Scope agreed", due: "2026-11-15", status: "Not started", amount: 150000, invoiceMonth: null }] },
  ];
  for (const p of projects) {
    for (const ms of p.milestones) {
      if (!ms.invoiceMonth) continue;
      const id = "inv-" + inv;
      const number = "INV-" + ms.invoiceMonth.replace("-", "") + "-" + String(inv++).padStart(4, "0");
      invoices.push({ id, number, clientId: p.clientId, kind: "Enterprise", projectId: p.id, milestoneId: ms.id, issueDate: ms.invoiceMonth + "-12", dueDate: ms.invoiceMonth + "-26", vatRate: 0.12, lines: [{ description: p.name + " — " + ms.name, net: ms.amount, months: [ms.invoiceMonth] }], voided: false });
      ms.invoiceId = id;
      if (ms.invoiceMonth !== "2026-10") payments.push({ id: "pay-" + id, invoiceId: id, date: ms.invoiceMonth + "-24", amount: round2(ms.amount * 1.12), reference: "BT-" + number.slice(4), method: "Bank transfer (recorded manually)" });
    }
  }
  const opex = [];
  for (const m of MONTHS) {
    opex.push({ id: "opex-acct-" + m, month: m, category: "Accounting and bookkeeping", php: 3000, basis: "Manual", source: "Engagement letter (synthetic)" });
    opex.push({ id: "opex-net-" + m, month: m, category: "Internet and workspace", php: 1500, basis: "Manual", source: "Monthly bill (synthetic)" });
    opex.push({ id: "opex-lic-" + m, month: m, category: "Software licences", php: 800, basis: "Manual", source: "Licence invoices (synthetic)" });
  }
  const sharedBusiness = [];
  for (const m of MONTHS) {
    sharedBusiness.push({ id: "sbe-mkt-" + m, month: m, category: "Sales and marketing (shared)", php: 12000, recognised: true });
    sharedBusiness.push({ id: "sbe-cs-" + m, month: m, category: "Customer success (shared)", php: 8000, recognised: true });
  }
  const statements = [
    { month: "2026-07", status: "Paid", publishedAt: "2026-08-05", adjustments: [], payouts: [] },
    { month: "2026-08", status: "Paid", publishedAt: "2026-09-05", adjustments: [{ id: "da-1", amount: -2500, reason: "Late cancellation refund recognised after close", at: "2026-09-04T11:00", by: "Platform owner" }], payouts: [] },
    { month: "2026-09", status: "Published", publishedAt: "2026-10-06", adjustments: [], payouts: [] },
    { month: "2026-10", status: "Draft", publishedAt: null, adjustments: [], payouts: [] },
  ];
  return { invoices, payments, costs, adjustments, projects, opex, sharedBusiness, statements, pricing: PRICING.map((p) => ({ ...p })), allocationDefault: ALLOCATION_DEFAULT.map((a) => ({ ...a })), allocationOverrides: [
    { id: "ao-1", clientId: logi.id, effectiveFrom: "2026-09-01", fixed: 1500, perUser: 15, reason: "Higher support load agreed for annual client.", by: "Platform owner", at: "2026-08-28T10:00" },
  ] };
}

const LOGS = [
  ["2026-10-24T13:41", "Error", "queue-consumer", "QUE-RETRY-EXHAUSTED", "Reminder job exhausted retries; moved to dead-letter queue.", 1],
  ["2026-10-24T13:20", "Warning", "client-worker", "HLT-Q-DELAY", "Queue delay above 5 minutes for 3 checks.", 4],
  ["2026-10-24T12:58", "Info", "scheduler", "SCH-SWEEP-OK", "Dispatch sweep enqueued commands for all live clients.", null],
  ["2026-10-24T12:31", "Error", "client-worker", "API-5XX", "Unhandled error on GET /api/v1/audits (record ids only).", 2],
  ["2026-10-24T11:05", "Warning", "inbound-mail", "MAIL-ATTACH-DROPPED", "Support email attachment dropped (links only).", 0],
  ["2026-10-24T10:47", "Info", "platform", "PLT-SANDBOX-REQ", "Sandbox requested (simulation record).", 0],
  ["2026-10-24T09:20", "Error", "platform", "PRV-DB-01", "Simulated sandbox provisioning failure.", null],
  ["2026-10-23T22:10", "Info", "client-worker", "DEP-OK", "Deployment health check passed.", 5],
  ["2026-10-23T21:55", "Warning", "client-worker", "AUTH-STEPUP", "Step-up required for export (expected).", 6],
  ["2026-10-23T18:00", "Info", "scheduler", "BKP-OK", "Nightly logical dump completed.", null],
  ["2026-10-23T03:12", "Error", "scheduler", "BKP-FAIL", "Nightly logical dump failed for one client; retry scheduled.", 7],
  ["2026-10-22T16:40", "Info", "platform", "PLT-RELEASE", "Release 1.9.0-rc.1 registered.", null],
  ["2026-10-22T08:15", "Info", "platform", "PLT-SANDBOX-REQ", "Sandbox requested for SR-1035.", 2],
  ["2026-10-21T19:03", "Warning", "client-worker", "LINK-CHECK", "Evidence link check: 3 links returned 404 (ids only).", 3],
];

export function buildSeed() {
  const clients = buildClients();
  const demo = clients[0], logi = clients[2];
  const seedHistory = (c, at, effective, field, from, to, reason, by) => c.subscription.history.push({ id: "sh-" + c.slug + "-" + at, at, effective, field, from, to, reason, by });
  seedHistory(demo, "2026-08-28T09:00", "2026-09-01", "Purchased seats", 28, 32, "Two new process owners and two auditors.", "Platform owner");
  seedHistory(logi, "2026-07-01T09:00", "2026-07-01", "Billing cycle", "Monthly", "Annual", "Client chose annual billing at signing.", "Platform owner");
  const deployments = buildDeployments(clients);
  const finance = buildFinance(clients);
  const live = clients.filter((c) => c.accountStatus === "Live");
  const partnerAClient = live.find((c) => c.partnerId === "partner-a" && c !== demo && c.subscription.purchasedSeats < 40);
  const ten = clients.find((c, i) => i > 3 && c.accountStatus === "Live" && c.partnerId === "partner-b");
  const requests = [
    { id: "req-201", kind: "Seat change", from: "partner-a", clientId: partnerAClient.id, title: "Increase seats for " + partnerAClient.name, detail: { field: "purchasedSeats", from: partnerAClient.subscription.purchasedSeats, to: partnerAClient.subscription.purchasedSeats + 5, effective: "2026-11-01" }, reason: "Client is onboarding a second site.", status: "Pending", at: "2026-10-23T15:12", decision: null },
    { id: "req-202", kind: "New client account", from: "partner-b", clientId: null, title: "New client: Northwind Ceramics", detail: { name: "Northwind Ceramics", seats: 15, partnerId: "partner-b" }, reason: "Signed letter of intent; wants a trial first.", status: "Pending", at: "2026-10-22T10:40", decision: null },
    { id: "req-203", kind: "Enterprise customization", from: "partner-b", clientId: ten.id, title: "Customization request for " + ten.name, detail: { name: "Calibration register integration", type: "Integration", amount: 150000 }, reason: "Client wants calibration due dates linked to Evidence.", status: "Pending", at: "2026-10-21T09:05", decision: null },
    { id: "req-190", kind: "Seat change", from: "partner-a", clientId: demo.id, title: "Increase seats for Demo Manufacturing", detail: { field: "purchasedSeats", from: 28, to: 32, effective: "2026-09-01" }, reason: "Two new process owners and two auditors.", status: "Approved", at: "2026-08-27T10:00", decision: { by: "Platform owner", at: "2026-08-28T09:00", reason: "Within plan." } },
  ];
  const supportReports = [
    { id: "SR-1042", clientId: live[3].id, title: "Overview figures load slowly", source: "Person", category: "Performance", impact: "Some people affected", severity: "Low", created: "2026-10-24T08:12", state: "New", page: "/", details: "Overview takes about 6 seconds to show figures after sign-in. Technical details were not included.", updates: [], sandboxId: null },
    { id: "SR-1039", clientId: live[5].id, title: "Evidence link check shows 404 for SharePoint links", source: "Error monitor", category: "Integration", impact: "One person affected", severity: "Medium", created: "2026-10-23T19:05", state: "Investigating", page: "/evidence", details: "Link check fingerprint LINK-CHECK seen 3 times in one hour. Record ids only.", updates: [{ when: "2026-10-23T19:30", who: "Platform owner", text: "Checking whether links moved after a SharePoint site rename." }], sandboxId: null },
    { id: "SR-1035", clientId: logi.id, title: "Reminder email sent twice", source: "Person", category: "Notifications", impact: "Some people affected", severity: "Medium", created: "2026-10-22T07:58", state: "Fix in sandbox", page: "/audits", details: "Two identical reminders for one audit. Technical details included by the person after review.", updates: [{ when: "2026-10-22T08:15", who: "Platform owner", text: "Reproducing in sandbox example-logistics-sr1035." }], sandboxId: "sb-1002" },
    { id: "SR-1031", clientId: demo.id, title: "Audit plan timetable cut off when printing", source: "Person", category: "Bug", impact: "One person affected", severity: "Low", created: "2026-10-19T14:20", state: "Waiting for approval", page: "/audits/plans", details: "Portrait print cuts the third auditor column.", updates: [{ when: "2026-10-23T16:10", who: "Platform owner", text: "Fixed in 1.9.0-rc.1; sandbox sb-1001 submitted for review." }], sandboxId: "sb-1001" },
    { id: "SR-1020", clientId: live[9].id, title: "Cannot find Management Review record", source: "Person", category: "Question", impact: "One person affected", severity: "Low", created: "2026-10-10T11:00", state: "Closed", page: "/management-review", details: "Answered: record was Confidential and the person was not named.", updates: [{ when: "2026-10-10T13:00", who: "Platform owner", text: "Explained classification rules. Closed." }], sandboxId: null },
  ];
  const supportGrants = [
    { id: "SG-311", clientId: logi.id, ticket: "SR-1035", grantedBy: "Client administrator", usedBy: "Platform owner", hours: 2, start: "2026-10-24T13:00", end: "2026-10-24T15:00", scope: "Read-only, Audits and Notifications", ceiling: "Internal", state: "Active" },
    { id: "SG-305", clientId: live[5].id, ticket: "SR-1039", grantedBy: "Client owner", usedBy: "Platform owner", hours: 1, start: "2026-10-23T20:00", end: "2026-10-23T21:00", scope: "Read-only, Evidence", ceiling: "Internal", state: "Ended" },
    { id: "SG-299", clientId: demo.id, ticket: "SR-1031", grantedBy: "Client administrator", usedBy: "Platform owner", hours: 4, start: "2026-10-20T09:00", end: "2026-10-20T13:00", scope: "Read-only, Audits", ceiling: "Internal", state: "Expired" },
  ];
  const jobs = [
    { name: "dispatch-sweep", what: "Enqueues outbox dispatch for every live client", schedule: "Every minute", last: "2026-10-24T13:59", state: "Healthy", failures: 0 },
    { name: "reminders", what: "Due and overdue reminders in Asia/Manila time", schedule: "Daily 07:00", last: "2026-10-24T07:00", state: "Failing", failures: 1 },
    { name: "health-summary", what: "Sanitised health codes and counts per client", schedule: "Every 15 minutes", last: "2026-10-24T13:45", state: "Healthy", failures: 0 },
    { name: "logical-dump", what: "Encrypted nightly dump to S3 Object Lock", schedule: "Daily 02:00", last: "2026-10-24T02:00", state: "Retrying", failures: 1 },
    { name: "exports-cleanup", what: "Removes exports older than 24 hours", schedule: "Hourly", last: "2026-10-24T13:00", state: "Healthy", failures: 0 },
    { name: "sandbox-expiry", what: "Marks sandboxes past retention as Expired", schedule: "Daily 01:00", last: "2026-10-24T01:00", state: "Healthy", failures: 0 },
  ];
  const team = [
    { id: "pt-owner", name: "Platform owner", email: "owner@platform.example", role: "Platform owner", scope: "All clients", status: "Active", last: "2026-10-24T14:00", mfa: "Passkey" },
    { id: "pt-eng", name: "Leo Navarro", email: "leo@platform.example", role: "Platform engineer (read-only logs)", scope: "All clients", status: "Active", last: "2026-10-23T18:20", mfa: "Passkey" },
    { id: "pt-pa", name: "Mara Santos", email: "partner-a@partners.example", role: "Business partner", scope: "Partner A assigned clients", status: "Active", last: "2026-10-24T09:10", mfa: "Passkey", partnerId: "partner-a" },
    { id: "pt-pb", name: "Jun Reyes", email: "partner-b@partners.example", role: "Business partner", scope: "Partner B assigned clients", status: "Active", last: "2026-10-22T16:45", mfa: "Passkey", partnerId: "partner-b" },
  ];
  const integrations = [
    { name: "Cloudflare (Workers, Queues, R2, Access)", purpose: "Deployments, usage, availability", status: "Not connected" },
    { name: "Neon", purpose: "Database health, compute and storage usage, billing", status: "Not connected" },
    { name: "AWS (S3 backups, SES email)", purpose: "Backup age, email volume, billing", status: "Not connected" },
    { name: "WorkOS AuthKit", purpose: "Platform staff sign-in with passkeys (D9)", status: "Not connected" },
    { name: "Microsoft Entra ID", purpose: "Client staff sign-in (D7)", status: "Not connected" },
    { name: "GitHub Actions", purpose: "Builds, release provenance, production environment approval", status: "Not connected" },
    { name: "Payment provider (PayMongo under evaluation)", purpose: "Future hosted checkout; not approved (D21)", status: "Not approved" },
  ];
  const audit = [
    { id: "au-1", at: "2026-10-23T16:10", actor: "Platform owner", action: "Sandbox submitted for review", clientId: demo.id, target: "Sandbox sb-1001", before: "Testing", after: "Ready for review", reason: "Tests passed in CI.", approval: "Not required", outcome: "Recorded (preview)" },
    { id: "au-2", at: "2026-10-16T15:20", actor: "Platform owner", action: "Credit note recorded", clientId: logi.id, target: "Adjustment adj-2", before: "—", after: "₱1,500 credit", reason: "SLA service credit.", approval: "Approved by platform owner", outcome: "Recorded (preview)" },
    { id: "au-3", at: "2026-09-01T09:00", actor: "Platform owner", action: "Purchased seats changed", clientId: demo.id, target: "Subscription", before: "28", after: "32", reason: "Two new process owners and two auditors.", approval: "Request req-190", outcome: "Recorded (preview)" },
    { id: "au-4", at: "2026-08-28T10:00", actor: "Platform owner", action: "Allocated expense formula overridden", clientId: logi.id, target: "Allocation ao-1", before: "Default (₱1,000 + ₱15 per user)", after: "₱1,500 + ₱15 per user from 1 Sep 2026", reason: "Higher support load agreed for annual client.", approval: "Not required", outcome: "Recorded (preview)" },
  ];
  const settings = { currency: "PHP", fxSource: "Manual monthly rate (synthetic)", sandboxRetentionDays: 14, sandboxMaxPerClient: 3, seatBasis: "Purchased seats", periodClose: "Monthly, by the platform owner", largeSeatApproval: 100 };
  return {
    version: 2, clients: clients.map(({ version, ...c }) => c), deployments, releases: RELEASE_LIST.map((r) => ({ ...r, approvalHistory: [] })),
    releaseHistory: buildReleaseHistory(deployments), sandboxes: buildSandboxes(clients),
    ...finance, requests, logs: LOGS.map(([at, level, service, code, message, ci], i) => ({ id: "log-" + (i + 1), at, level, service, code, message, clientId: ci == null ? null : live[ci].id })),
    jobs, supportReports, supportGrants, team, integrations, audit, settings, provisioningRuns: [],
  };
}
