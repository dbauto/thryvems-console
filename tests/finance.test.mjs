/** Unit tests for src/finance.js. Expected numbers are worked out by hand in the comments. */
import test from "node:test";
import assert from "node:assert/strict";
import { revenueByClient, actualCosts, sharedProfit, expenseCategories, distribution, invoiceTotals, validateSeats } from "../src/finance.js";
import { buildSeed, seatsAt, subscriptionCharge } from "../src/seed.js";

const OCT = ["2026-10"];
const client = (id, partnerId, users, status = "Live", extra = {}) => ({ id, name: id, partnerId, accountStatus: status, subscription: { planId: "standard", status: "Active", activeUsers: users, purchasedSeats: users, startDate: "2026-07-01", history: [] }, ...extra });
function fixture() {
  return {
    clients: [client("A", "partner-a", 20), client("B", "partner-b", 10), client("C", "partner-a", 0, "Account created")],
    invoices: [
      { id: "i1", clientId: "A", kind: "Subscription", vatRate: 0.12, dueDate: "2026-10-15", voided: false, lines: [{ net: 7000, months: ["2026-10"] }] },
      // Annual: 60,000 over 12 months → 5,000 recognised in October.
      { id: "i2", clientId: "B", kind: "Subscription", vatRate: 0.12, dueDate: "2026-10-15", voided: false, lines: [{ net: 60000, months: ["2026-10", "2026-11", "2026-12", "2027-01", "2027-02", "2027-03", "2027-04", "2027-05", "2027-06", "2027-07", "2027-08", "2027-09"] }] },
      { id: "i3", clientId: "B", kind: "Enterprise", vatRate: 0.12, dueDate: "2026-11-01", voided: false, lines: [{ net: 75000, months: ["2026-10"] }] },
      { id: "i4", clientId: "A", kind: "Subscription", vatRate: 0.12, dueDate: "2026-10-15", voided: true, lines: [{ net: 999999, months: ["2026-10"] }] },
    ],
    payments: [{ invoiceId: "i1", amount: 3000 }],
    adjustments: [{ clientId: "A", kind: "Discount", month: "2026-10", amount: 1000 }],
    costs: [
      { month: "2026-10", clientId: "A", php: 700, basis: "Reconciled", category: "Neon" },
      { month: "2026-10", clientId: "A", php: null, basis: "Not available", category: "AWS S3 backups" },
      { month: "2026-10", clientId: "B", php: 500, basis: "Estimate", category: "Neon" },
      { month: "2026-10", clientId: null, shared: true, php: 300, basis: "Reconciled", category: "Cloudflare" },
      { month: "2026-10", clientId: null, unallocated: true, php: 50, basis: "Manual", category: "GitHub" },
    ],
    opex: [{ month: "2026-10", php: 1000 }],
    allocationDefault: [{ effectiveFrom: "2026-07-01", fixed: 1000, perUser: 15 }],
    allocationOverrides: [],
    sharedBusiness: [{ month: "2026-10", php: 2000, recognised: true }, { month: "2026-10", php: 9999, recognised: false }],
    statements: [{ month: "2026-10", status: "Published", adjustments: [{ amount: -500 }], payouts: [{ recipient: "Developer", amount: 10000 }] }],
    pricing: [{ effectiveFrom: "2026-07-01", basePrice: 5000, baseUsers: 10, additionalRate: 200, minSeats: 1, enterpriseFee: 150000 }],
  };
}

test("revenue is recognised by service month, net of discounts, excluding void invoices", () => {
  const r = revenueByClient(fixture(), OCT);
  assert.deepEqual(r.get("A"), { subscription: 7000, enterprise: 0, adjustments: -1000, total: 6000 });
  assert.deepEqual(r.get("B"), { subscription: 5000, enterprise: 75000, adjustments: 0, total: 80000 });
});

test("shared costs split per active user; missing costs mark Incomplete and are never 0", () => {
  const k = actualCosts(fixture(), OCT);
  assert.equal(k.perClient.get("A").shared, 200); // 300 × 20/30
  assert.equal(k.perClient.get("B").shared, 100); // 300 × 10/30
  assert.equal(k.perClient.get("A").direct, 700);
  assert.equal(k.perClient.get("A").incomplete, true);
  assert.equal(k.perClient.get("B").incomplete, false);
  assert.equal(k.unallocated, 50);
  assert.equal(k.opex, 1000);
});

test("one shared net profit: revenue − recognised expenses ± approved adjustments", () => {
  const s = sharedProfit(fixture(), OCT);
  assert.equal(s.revenue, 86000);
  assert.equal(s.direct, 1200);
  assert.equal(s.shared, 300);
  assert.equal(s.sharedBusiness, 2000); // unrecognised 9,999 excluded
  assert.equal(s.notRecognised, 9999);
  assert.equal(s.expenses, 4550); // 1,200 + 300 + 50 + 1,000 + 2,000
  assert.equal(s.approvedAdjustments, -500);
  assert.equal(s.net, 80950);
  const a = s.rows.find((r) => r.client.id === "A"), b = s.rows.find((r) => r.client.id === "B");
  assert.equal(a.profit, 5100); // 6,000 − 700 − 200
  assert.equal(b.profit, 79400); // 80,000 − 500 − 100
  assert.equal(a.profit + b.profit + s.companyWide, s.net);
  assert.equal(s.incomplete, true);
});

test("expense categories add up to recognised expenses", () => {
  const f = fixture();
  const cats = expenseCategories(f, OCT);
  assert.equal(Math.round(cats.reduce((x, c) => x + c.amount, 0)), sharedProfit(f, OCT).expenses);
});

test("distribution is 30/70 of the same shared net profit, not of gross revenue", () => {
  const f = fixture();
  const d = distribution(f, "2026-10");
  assert.equal(d.distributable, sharedProfit(f, OCT).net);
  assert.equal(d.developer, 24285);
  assert.equal(d.partners, 56665);
  assert.equal(d.paidDeveloper, 10000);
  assert.equal(d.pendingDeveloper, 14285);
  assert.equal(d.pendingPartners, 56665);
});

test("losses are not distributed", () => {
  const f = fixture();
  f.opex = [{ month: "2026-10", php: 500000 }];
  const d = distribution(f, "2026-10");
  assert.ok(d.net < 0);
  assert.equal(d.developer, 0);
  assert.equal(d.partners, 0);
});

test("invoice totals: VAT 12%, payments, outstanding and overdue status", () => {
  const f = fixture();
  const t = invoiceTotals(f, f.invoices[0]);
  assert.equal(t.gross, 7840);
  assert.equal(t.outstanding, 4840);
  assert.equal(t.status, "Overdue"); // due 15 Oct, preview date 24 Oct
});

test("seat validation enforces minimum, active users, trials and large-seat approval", () => {
  const f = fixture();
  const a = f.clients[0];
  assert.match(validateSeats(f, a, 0), /fewer than 1/);
  assert.match(validateSeats(f, a, 19), /20 active users/);
  assert.equal(validateSeats(f, a, 25), null);
  assert.match(validateSeats(f, a, 150, { largeSeatApproval: 100 }), /commercial approval reference/);
  assert.equal(validateSeats(f, a, 150, { largeSeatApproval: 100, commercialReference: "EXC-1" }), null);
  assert.match(validateSeats(f, { ...a, subscription: { ...a.subscription, planId: "trial", activeUsers: 5 } }, 12), /Trials allow up to 10/);
});

test("subscription charge: base includes 10 users; additional seats billed at the rate", () => {
  const p = fixture().pricing[0];
  assert.equal(subscriptionCharge(p, 1), 5000);
  assert.equal(subscriptionCharge(p, 10), 5000);
  assert.equal(subscriptionCharge(p, 32), 9400);
});

test("seed: invoices follow seat history and the full preview reconciles", () => {
  const seed = buildSeed();
  const demo = seed.clients.find((c) => c.name === "Demo Manufacturing");
  assert.equal(seatsAt(demo.subscription, "2026-08"), 28);
  assert.equal(seatsAt(demo.subscription, "2026-09"), 32);
  const aug = seed.invoices.find((i) => i.clientId === demo.id && i.kind === "Subscription" && i.lines[0].months[0] === "2026-08");
  assert.equal(aug.lines[0].net, 8600);
  const s = sharedProfit(seed, ["2026-07", "2026-08", "2026-09", "2026-10"]);
  const perClient = s.rows.reduce((a, r) => a + r.profit, 0);
  assert.ok(Math.abs(perClient + s.companyWide - s.net) < 0.05, "per-client + company-wide = net");
  assert.ok(Math.abs(s.revenue - s.expenses + s.approvedAdjustments - s.net) < 0.05);
  assert.ok(seed.clients.length >= 50, "scale: at least 50 synthetic organisations");
});
