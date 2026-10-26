/**
 * ThryveMS console design preview: synthetic records only.
 * Every company, person, amount and identifier here is invented sample data. Nothing is read from
 * Cloudflare, Neon, a payment provider or a client QMS. Production must serve these from the backend,
 * filtered on the server by role and partner assignment.
 */

export const TODAY = "2026-10-26";
export const MONTHS = ["2026-07", "2026-08", "2026-09", "2026-10"];
export const PERIODS = [
  { id: "2026-10", label: "October 2026", months: ["2026-10"] },
  { id: "2026-09", label: "September 2026", months: ["2026-09"] },
  { id: "2026-08", label: "August 2026", months: ["2026-08"] },
  { id: "2026-07", label: "July 2026", months: ["2026-07"] },
  { id: "2026-Q3", label: "Q3 2026 (July to September)", months: ["2026-07", "2026-08", "2026-09"] },
  { id: "2026-YTD", label: "2026 to date (records from July)", months: MONTHS },
];

export const PARTNERS = {
  "partner-a": { id: "partner-a", name: "Lea Santos", label: "Partner A" },
  "partner-b": { id: "partner-b", name: "Marco Reyes", label: "Partner B" },
};

/* Account status is independent of deployment status. A client account never creates a deployment by itself. */
export const CLIENTS = [
  { id: "arden", name: "Arden & Co.", partner: "partner-a", plan: "Business", cycle: "Monthly", seats: 60, used: 54, status: "Active", trial: false, start: "2026-03-01", renewal: "2027-03-01", monthly: 42000, billFrom: "2026-07", modules: ["Documents", "Audits", "Risks", "Corrective action", "Management review", "Objectives"] },
  { id: "calamba", name: "Calamba Precision", partner: "partner-a", plan: "Business", cycle: "Annual", seats: 60, used: 58, status: "Active", trial: false, start: "2026-01-15", renewal: "2027-01-15", monthly: 42000, billFrom: "2026-07", modules: ["Documents", "Audits", "Risks", "Corrective action", "Management review"] },
  { id: "luzon", name: "Luzon Foods Packaging", partner: "partner-a", plan: "Business", cycle: "Monthly", seats: 40, used: 31, status: "Active", trial: false, start: "2026-06-01", renewal: "2027-06-01", monthly: 33000, billFrom: "2026-07", modules: ["Documents", "Audits", "Risks", "Corrective action"] },
  { id: "mindanao", name: "Mindanao Agri Supply", partner: "partner-a", plan: "Team", cycle: "Monthly", seats: 10, used: 6, status: "Active", trial: true, start: "2026-10-12", renewal: "2026-11-11", monthly: 0, billFrom: null, modules: ["Documents", "Audits"] },
  { id: "pasig", name: "Pasig Electronics", partner: "partner-b", plan: "Team", cycle: "Monthly", seats: 30, used: 22, status: "Active", trial: false, start: "2026-05-01", renewal: "2026-11-01", monthly: 24000, billFrom: "2026-07", modules: ["Documents", "Audits", "Corrective action"] },
  { id: "visayas", name: "Visayas Plastics", partner: "partner-b", plan: "Team", cycle: "Monthly", seats: 25, used: 19, status: "Active", trial: false, start: "2026-04-01", renewal: "2026-11-01", monthly: 21000, billFrom: "2026-07", modules: ["Documents", "Audits", "Risks"] },
  { id: "northbay", name: "Northbay Metals", partner: "partner-b", plan: "Team", cycle: "Monthly", seats: 10, used: 0, status: "Awaiting provisioning", trial: true, start: "2026-10-23", renewal: null, monthly: 0, billFrom: null, modules: ["Documents"] },
  { id: "cebu", name: "Cebu Print Works", partner: "partner-b", plan: "Team", cycle: "Monthly", seats: 15, used: 0, status: "Suspended", trial: false, start: "2026-02-01", renewal: null, monthly: 18000, billFrom: "2026-07", billTo: "2026-08", modules: ["Documents", "Audits"] },
];

export const DEPLOYMENTS = [
  { id: "prd-arden-01", client: "arden", host: "arden.thryvems.app", version: "3.8.2", build: "b7c41e2", channel: "Stable", status: "Live", health: "Healthy", lastDeploy: "2026-10-14", verified: "2026-10-26 09:00", region: "Asia Pacific", db: "neon-arden-prod", tier: "Medium (51–100)" },
  { id: "prd-calamba-01", client: "calamba", host: "calamba.thryvems.app", version: "3.8.2", build: "b7c41e2", channel: "Stable", status: "Live", health: "Healthy", lastDeploy: "2026-10-14", verified: "2026-10-26 09:00", region: "Asia Pacific", db: "neon-calamba-prod", tier: "Medium (51–100)" },
  { id: "prd-luzon-01", client: "luzon", host: "luzonfoods.thryvems.app", version: "3.8.2", build: "b7c41e2", channel: "Early access", status: "Live", health: "Healthy", lastDeploy: "2026-10-15", verified: "2026-10-26 09:00", region: "Asia Pacific", db: "neon-luzon-prod", tier: "Small (31–50)" },
  { id: "prd-mindanao-01", client: "mindanao", host: "mindanao.thryvems.app", version: "3.8.2", build: "b7c41e2", channel: "Stable", status: "Live", health: "Healthy", lastDeploy: "2026-10-12", verified: "2026-10-26 09:00", region: "Asia Pacific", db: "neon-mindanao-prod", tier: "Micro (1–30)" },
  { id: "prd-pasig-01", client: "pasig", host: "pasig.thryvems.app", version: "3.8.0", build: "9a02d11", channel: "Stable", status: "Deploy failed", health: "Healthy", lastDeploy: "2026-10-26", verified: "2026-10-25 09:00", region: "Asia Pacific", db: "neon-pasig-prod", tier: "Micro (1–30)" },
  { id: "prd-visayas-01", client: "visayas", host: "visayas.thryvems.app", version: "3.8.0", build: "9a02d11", channel: "Stable", status: "Live", health: "Backup late", lastDeploy: "2026-10-02", verified: "2026-10-25 09:00", region: "Asia Pacific", db: "neon-visayas-prod", tier: "Micro (1–30)" },
  { id: "prd-cebu-01", client: "cebu", host: "cebu.thryvems.app", version: "3.7.4", build: "71fd0c8", channel: "Stable", status: "Suspended", health: "No data", lastDeploy: "2026-08-03", verified: null, region: "Asia Pacific", db: "neon-cebu-prod", tier: "Micro (1–30)" },
];

export const RELEASES = [
  { version: "3.9.0", status: "In review", build: "e51f09a", date: "2026-10-24", notes: "Exports in batches of 500, management review report, faster document search.", compat: "Database schema v42. One migration, reversible.", verification: "Sandbox tests passed for Arden & Co. and Luzon Foods Packaging. End-to-end run pending.", approval: "Waiting for Developer approval" },
  { version: "3.8.2", status: "Released", build: "b7c41e2", date: "2026-10-14", notes: "Audit plan editing, management review steps.", compat: "Schema v41. No migration.", verification: "Verified after deployment on 5 clients.", approval: "Approved by Danica Boton, 13 Oct" },
  { version: "3.8.0", status: "Released", build: "9a02d11", date: "2026-09-29", notes: "Organisation and scope, process inputs and outputs.", compat: "Schema v41. One migration.", verification: "Verified after deployment.", approval: "Approved by Danica Boton, 28 Sep" },
  { version: "3.7.4", status: "Retired", build: "71fd0c8", date: "2026-08-01", notes: "Maintenance update.", compat: "Schema v40.", verification: "Verified.", approval: "Approved by Danica Boton, 31 Jul" },
];

export const DEPLOY_HISTORY = [
  { date: "2026-10-26", client: "pasig", from: "3.8.0", to: "3.8.2", result: "Failed", note: "Migration step stopped. Production kept 3.8.0.", by: "Danica Boton" },
  { date: "2026-10-26", client: "pasig", from: "3.8.2", to: "3.8.0", result: "Rolled back", note: "Automatic rollback after failed verification.", by: "Release workflow" },
  { date: "2026-10-15", client: "luzon", from: "3.8.0", to: "3.8.2", result: "Succeeded", note: "Verified 09:20.", by: "Danica Boton" },
  { date: "2026-10-14", client: "arden", from: "3.8.0", to: "3.8.2", result: "Succeeded", note: "Verified 10:05.", by: "Danica Boton" },
  { date: "2026-10-14", client: "calamba", from: "3.8.0", to: "3.8.2", result: "Succeeded", note: "Verified 10:40.", by: "Danica Boton" },
  { date: "2026-10-12", client: "mindanao", from: "None", to: "3.8.2", result: "Succeeded", note: "First deployment after provisioning.", by: "Danica Boton" },
  { date: "2026-10-02", client: "visayas", from: "3.7.4", to: "3.8.0", result: "Succeeded", note: "Verified 14:10.", by: "Danica Boton" },
];

export const START_SANDBOXES = [
  { id: "SB-014", client: "arden", source: "prd-arden-01", sourceVersion: "3.8.2", target: "3.9.0", name: "Export stuck at 90%: fix and test 3.9.0", purpose: "Bug fix", reference: "SUP-2026-041", description: "Exports of more than 2,000 records stop at 90%.", config: "Client modules and settings, no secrets", data: "Synthetic: manufacturing, 60 users", retention: "14 days", expires: "2026-11-09", status: "Testing", created: "2026-10-26", fixes: ["Export worker sends records in batches of 500"], tests: [{ name: "Export of 2,400 records", result: "Passed" }, { name: "Migration on synthetic data", result: "Passed" }] },
  { id: "SB-013", client: "pasig", source: "prd-pasig-01", sourceVersion: "3.8.0", target: "3.8.2", name: "Retry 3.8.2 migration", purpose: "Version testing", reference: "REL-3.8.2", description: "Find why the migration stopped in production.", config: "Client modules and settings, no secrets", data: "Synthetic: electronics, 30 users", retention: "7 days", expires: "2026-11-02", status: "Testing", created: "2026-10-26", fixes: [], tests: [] },
  { id: "SB-012", client: "luzon", source: "prd-luzon-01", sourceVersion: "3.8.2", target: "3.9.0", name: "Management review report", purpose: "Feature update", reference: "FEAT-2026-118", description: "Printable report from the locked review record.", config: "Client modules and settings, no secrets", data: "Synthetic: food packaging, 40 users", retention: "14 days", expires: "2026-11-05", status: "Ready for review", created: "2026-10-22", fixes: ["Report page added"], tests: [{ name: "Report prints on A4", result: "Passed" }] },
];

export const PROJECTS = [
  { id: "PRJ-2026-03", client: "arden", name: "Arden customisation: supplier portal", scope: "Supplier self-assessment forms and a supplier scorecard", type: "Customisation", partner: "partner-a", team: "Danica Boton", value: 150000, approval: "Approved", status: "In progress", start: "2026-09-15", due: "2026-12-15", invoice: "Milestone 1 invoiced and paid", milestones: [{ name: "Design agreed", due: "2026-10-12", state: "Done" }, { name: "Supplier forms live", due: "2026-11-20", state: "Planned" }, { name: "Scorecard and handover", due: "2026-12-15", state: "Planned" }], deliverables: ["Supplier form builder", "Scorecard report"], changes: ["Add Tagalog labels (approved, no extra fee)"] },
  { id: "PRJ-2026-04", client: "visayas", name: "Visayas Plastics: batch traceability", scope: "Link batches to nonconformities and complaints", type: "Customisation", partner: "partner-b", team: "Not assigned", value: 150000, approval: "Waiting for approval", status: "Proposed", start: null, due: null, invoice: "Not invoiced", milestones: [], deliverables: ["Batch register"], changes: [] },
];

/* Plan catalogue. Prices are not decided yet, so none is shown as final. Commercial plans and infrastructure tiers are separate. */
export const PLANS = [
  { id: "team", name: "Team", baseSeats: 10, minSeats: 1, monthly: null, extraSeat: null, cycles: "Monthly or annual", state: "Draft, price not set" },
  { id: "business", name: "Business", baseSeats: 10, minSeats: 1, monthly: null, extraSeat: null, cycles: "Monthly or annual", state: "Draft, price not set" },
];
export const TIERS = [
  { name: "Micro", users: "1–30" },
  { name: "Small", users: "31–50" },
  { name: "Medium", users: "51–100" },
];

export const SUB_HISTORY = [
  { date: "2026-10-01", client: "calamba", change: "Seats 50 → 60", effective: "2026-10-01", reason: "Second shift added", by: "Lea Santos (requested), Danica Boton (approved)" },
  { date: "2026-10-12", client: "mindanao", change: "Trial started, Team, 10 seats", effective: "2026-10-12", reason: "New client", by: "Lea Santos" },
  { date: "2026-09-01", client: "cebu", change: "Suspended", effective: "2026-09-01", reason: "Two invoices unpaid", by: "Danica Boton" },
  { date: "2026-08-01", client: "luzon", change: "Team → Business, 40 seats", effective: "2026-08-01", reason: "More modules needed", by: "Lea Santos (requested), Danica Boton (approved)" },
];

export const START_REQUESTS = [
  { id: "REQ-2026-041", type: "Seat change", client: "arden", from: "partner-a", detail: "Add 10 seats from 1 November", status: "Waiting", created: "2026-10-24" },
  { id: "REQ-2026-040", type: "Plan change", client: "calamba", from: "partner-a", detail: "Keep annual billing at renewal", status: "Waiting", created: "2026-10-22" },
  { id: "REQ-2026-039", type: "Billing", client: "visayas", from: "partner-b", detail: "Send October invoice to a new billing email", status: "Waiting", created: "2026-10-21" },
  { id: "REQ-2026-038", type: "Financial adjustment", client: null, from: "developer", detail: "Approve ADJ-2026-08: write-off of a Cebu Print Works invoice, −₱3,000", status: "Waiting", created: "2026-10-20" },
  { id: "REQ-2026-036", type: "Support access", client: "luzon", from: "client", detail: "4 hours to help with a data import", status: "Approved", created: "2026-10-18" },
];

export const LOGS = [
  { time: "2026-10-26 14:02", level: "Error", source: "prd-pasig-01 · migration", message: "Migration 041 stopped: lock timeout on table documents" },
  { time: "2026-10-26 13:58", level: "Info", source: "Release workflow", message: "Deployment of 3.8.2 to prd-pasig-01 started" },
  { time: "2026-10-26 09:00", level: "Info", source: "Health check", message: "6 of 7 deployments verified" },
  { time: "2026-10-26 03:10", level: "Warning", source: "prd-visayas-01 · backup", message: "Backup did not report in 26 hours" },
  { time: "2026-10-25 22:41", level: "Warning", source: "prd-arden-01 · export", message: "Export job ran longer than 10 minutes" },
  { time: "2026-10-25 08:15", level: "Info", source: "Billing (sample)", message: "Invoice INV-2026-1018 marked paid" },
];

export const JOBS = [
  { id: "JOB-88412", name: "Nightly backup", target: "prd-visayas-01", status: "Late", last: "2026-10-25 03:00", next: "2026-10-27 03:00" },
  { id: "JOB-88409", name: "Export to Excel", target: "prd-arden-01", status: "Failed", last: "2026-10-25 22:30", next: "Retry on request" },
  { id: "JOB-88400", name: "Due-date reminders", target: "All deployments", status: "Succeeded", last: "2026-10-26 07:00", next: "2026-10-27 07:00" },
  { id: "JOB-88398", name: "Invoice generation (sample)", target: "Billing", status: "Succeeded", last: "2026-10-01 06:00", next: "2026-11-01 06:00" },
  { id: "JOB-88390", name: "Health verification", target: "All deployments", status: "Succeeded", last: "2026-10-26 09:00", next: "2026-10-26 21:00" },
];

export const SUPPORT_REPORTS = [
  { id: "SUP-2026-041", client: "arden", title: "Export stuck at 90%", priority: "High", status: "In sandbox SB-014", opened: "2026-10-25" },
  { id: "SUP-2026-040", client: "calamba", title: "Can’t add a second approver to a procedure", priority: "Normal", status: "Open", opened: "2026-10-24" },
  { id: "SUP-2026-037", client: "luzon", title: "Data import help", priority: "Normal", status: "Waiting on client", opened: "2026-10-18" },
];

export const ACCESS_GRANTS = [
  { id: "ACC-2026-012", client: "luzon", who: "Danica Boton", reason: "Data import help (SUP-2026-037)", from: "2026-10-19 10:00", until: "2026-10-19 14:00", status: "Ended" },
];

export const TEAM = [
  { name: "Danica Boton", role: "Platform owner", access: "Everything, approves releases and financial adjustments", since: "2026-01-01" },
  { name: "Ken Uy", role: "Developer", access: "Deployments, sandboxes and logs. Views finance.", since: "2026-05-01" },
  { name: "Lea Santos", role: "Business Partner", access: "Partner A clients. Views shared finance.", since: "2026-01-01" },
  { name: "Marco Reyes", role: "Business Partner", access: "Partner B clients. Views shared finance.", since: "2026-03-01" },
];

export const START_AUDIT = [
  { at: "2026-10-26 14:05", who: "Release workflow", what: "Rolled back prd-pasig-01 to 3.8.0", area: "Deployment" },
  { at: "2026-10-26 09:12", who: "Danica Boton", what: "Created sandbox SB-014 for Arden & Co.", area: "Sandbox" },
  { at: "2026-10-24 16:20", who: "Danica Boton", what: "Approved ADJ-2026-07 (−₱5,000)", area: "Finance" },
  { at: "2026-10-01 08:00", who: "Danica Boton", what: "Calamba Precision seats 50 → 60, effective 1 Oct, reason: second shift", area: "Subscription" },
];

/* ---------- The one financial ledger ---------- */

const INFRA = [
  { vendor: "Cloudflare Workers and R2", base: [17600, 17950, 18100, 18240], usd: [313.0, 319.2, 321.9, 324.4] },
  { vendor: "Neon PostgreSQL", base: [21200, 21900, 22300, 22610], usd: [377.0, 389.5, 396.6, 402.1] },
  { vendor: "Email service", base: [2900, 3000, 3050, 3150], usd: [51.6, 53.4, 54.2, 56.0] },
  { vendor: "Backups and storage", base: [4600, 4700, 4800, 4880], usd: [81.8, 83.6, 85.4, 86.8] },
];
const RATES = [56.23, 56.23, 56.23, 56.23];
const OPERATING = [["Accounting services", 24000], ["Software tools", 12000], ["Contract developers", 30000]];
const SHARED = [["Marketing", 15000], ["Office and utilities", 26500]];

function billedIn(c, m) {
  return !!c.billFrom && c.billFrom <= m && (!c.billTo || m <= c.billTo);
}

/**
 * Every revenue, expense and adjustment record, with the fields the reports need: date, period, client,
 * category, source or vendor, description, amount, currency, rate, basis (actual, estimate, pending),
 * reference, evidence, created by, approval status and change history.
 */
export function buildLedger() {
  const L = [];
  let inv = 1001;
  MONTHS.forEach((m, mi) => {
    for (const c of CLIENTS) {
      if (!billedIn(c, m)) continue;
      const outstanding = (m === "2026-10" && (c.id === "pasig" || c.id === "luzon")) || (c.id === "cebu" && m === "2026-08");
      L.push({ ref: "INV-2026-" + inv++, date: m + "-05", period: m, client: c.id, kind: "Revenue", category: "Subscription", source: c.plan + " plan, " + c.seats + " seats, " + c.cycle.toLowerCase(), amount: c.monthly, currency: "PHP", rate: null, basis: "Actual", status: outstanding ? "Outstanding" : "Paid", evidence: "Invoice", createdBy: "Billing (sample)", approval: "Approved", history: ["Issued " + m + "-05"] });
    }
    INFRA.forEach((x, i) => L.push({ ref: "EXP-" + m.replace("-", "") + "-I" + (i + 1), date: m + "-03", period: m, client: null, kind: "Expense", category: "Infrastructure", source: x.vendor, amount: -x.base[mi], currency: "USD", usd: x.usd[mi], rate: RATES[mi], basis: "Actual", status: "Approved", evidence: "Provider invoice", createdBy: "Danica Boton", approval: "Approved", allocation: "By purchased seats", history: ["Recorded from provider invoice"] }));
    OPERATING.forEach(([v, a], i) => L.push({ ref: "EXP-" + m.replace("-", "") + "-O" + (i + 1), date: m + "-20", period: m, client: null, kind: "Expense", category: "Operating", source: v, amount: -a, currency: "PHP", rate: null, basis: "Actual", status: "Approved", evidence: "Receipt", createdBy: "Danica Boton", approval: "Approved", allocation: "Company-wide", history: ["Recorded"] }));
    SHARED.forEach(([v, a], i) => L.push({ ref: "EXP-" + m.replace("-", "") + "-S" + (i + 1), date: m + "-15", period: m, client: null, kind: "Expense", category: "Shared business", source: v, amount: -a, currency: "PHP", rate: null, basis: "Actual", status: "Approved", evidence: "Receipt", createdBy: "Lea Santos", approval: "Approved", allocation: "By purchased seats", history: ["Recorded by a Business Partner", "Approved by Danica Boton"] }));
  });
  L.push({ ref: "PRJ-2026-03-M1", date: "2026-10-12", period: "2026-10", client: "arden", kind: "Revenue", category: "Enterprise", source: "Customisation, milestone 1", amount: 150000, currency: "PHP", rate: null, basis: "Actual", status: "Paid", evidence: "Signed contract", createdBy: "Lea Santos", approval: "Approved", history: ["Milestone accepted 12 Oct"] });
  L.push({ ref: "CN-2026-014", date: "2026-10-26", period: "2026-10", client: "pasig", kind: "Revenue", category: "Revenue adjustment", source: "Credit for failed deployment downtime", amount: -7500, currency: "PHP", rate: null, basis: "Actual", status: "Approved", evidence: "Credit note", createdBy: "Danica Boton", approval: "Approved", history: ["Issued 26 Oct"] });
  L.push({ ref: "EXP-202610-U1", date: "2026-10-25", period: "2026-10", client: null, kind: "Expense", category: "Unallocated", source: "Bank charges, category not yet set", amount: -650, currency: "PHP", rate: null, basis: "Actual", status: "Approved", evidence: "Bank statement", createdBy: "Danica Boton", approval: "Approved", allocation: "Not allocated yet", history: ["Recorded, waiting for a category"] });
  L.push({ ref: "ADJ-2026-05", date: "2026-09-30", period: "2026-09", client: null, kind: "Adjustment", category: "Approved adjustment", source: "Provider refund for the August outage", amount: 2000, currency: "PHP", rate: null, basis: "Actual", status: "Approved", evidence: "Provider credit note", createdBy: "Danica Boton", approval: "Approved", history: ["Approved by Danica Boton 30 Sep"] });
  L.push({ ref: "ADJ-2026-07", date: "2026-10-24", period: "2026-10", client: null, kind: "Adjustment", category: "Approved adjustment", source: "Write-off: unrecoverable Cebu Print Works invoice", amount: -5000, currency: "PHP", rate: null, basis: "Actual", status: "Approved", evidence: "Write-off memo", createdBy: "Danica Boton", approval: "Approved", history: ["Approved by Danica Boton 24 Oct"] });
  L.push({ ref: "ADJ-2026-08", date: "2026-10-20", period: "2026-10", client: null, kind: "Adjustment", category: "Approved adjustment", source: "Write-off: second Cebu Print Works invoice", amount: -3000, currency: "PHP", rate: null, basis: "Pending", status: "Pending", evidence: "Write-off memo", createdBy: "Danica Boton", approval: "Waiting for approval", history: ["Requested 20 Oct"] });
  L.push({ ref: "EXP-202610-P1", date: "2026-10-26", period: "2026-10", client: null, kind: "Expense", category: "Operating", source: "Accounting services, October extra hours", amount: -8400, currency: "PHP", rate: null, basis: "Estimate", status: "Pending", evidence: "Awaiting invoice", createdBy: "Danica Boton", approval: "Not approved", allocation: "Company-wide", history: ["Estimated"] });
  L.push({ ref: "EXP-202610-P2", date: "2026-10-26", period: "2026-10", client: null, kind: "Expense", category: "Operating", source: "Domain renewals", amount: -4000, currency: "PHP", rate: null, basis: "Pending", status: "Pending", evidence: "Awaiting invoice", createdBy: "Ken Uy", approval: "Not approved", allocation: "Company-wide", history: ["Requested"] });
  return L;
}

/* Distribution payments already made, per period. The split itself is always worked out from net profit. */
export const PAYMENTS = {
  "2026-07": { developer: "all", partners: "all" },
  "2026-08": { developer: "all", partners: "all" },
  "2026-09": { developer: "all", partners: "all" },
  "2026-10": { developer: "all", partners: 60000 },
};
export const SPLIT = { developer: 0.3, partners: 0.7 };
