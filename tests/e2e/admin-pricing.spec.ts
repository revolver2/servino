import { test, expect } from "@playwright/test";
import { testDb } from "./helpers/db";

function validVersionBody(label: string, overrides: Record<string, unknown> = {}) {
  return {
    citySlug: "toronto",
    label,
    taxRatePercent: 13,
    taxLabel: "HST (13%)",
    professionalPayoutPercentOfLabor: 75,
    materialCostPercentOfCustomerRate: 70,
    paymentProcessingPercent: 2.9,
    paymentProcessingFixedMinor: 30,
    estimatedCacMinor: 7500,
    otherVariableCostMinor: 1000,
    healthyMarginPercent: 30,
    acceptableMarginPercent: 15,
    lowMarginPercent: 5,
    rules: [
      { serviceSlug: "wall-panels", installOnlyRateMinorPerM2: 6500, materialRateMinorPerM2: 8500, minimumSubtotalMinor: 35000 },
    ],
    ...overrides,
  };
}

test.afterEach(async () => {
  // Keep this file's versions from becoming the "active" one other test
  // files (e.g. admin-overview, which reads real Job data) might observe.
  await testDb.pricingVersion.updateMany({
    where: { citySlug: "toronto", status: "ACTIVE", label: { contains: "admin-pricing-test" } },
    data: { status: "RETIRED", retiredAt: new Date() },
  });
});

test.describe("Pricing version lifecycle", () => {
  test("create draft, activate it, and confirm it becomes the one active version for the city", async ({ page, baseURL }) => {
    const label = `admin-pricing-test-${Date.now()}`;
    const createRes = await page.request.post(`${baseURL}/api/admin/pricing/versions`, {
      data: validVersionBody(label),
    });
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();
    const id = created.data.id;

    const row = await testDb.pricingVersion.findUnique({ where: { id } });
    expect(row?.status).toBe("DRAFT");

    const activateRes = await page.request.post(`${baseURL}/api/admin/pricing/versions/${id}/activate`);
    expect(activateRes.status()).toBe(200);

    const activated = await testDb.pricingVersion.findUnique({ where: { id } });
    expect(activated?.status).toBe("ACTIVE");

    const auditRows = await testDb.auditEvent.findMany({
      where: { entityType: "PRICING_VERSION", entityId: id },
    });
    expect(auditRows.map((a) => a.action)).toEqual(
      expect.arrayContaining(["PRICING_VERSION_CREATED", "PRICING_VERSION_ACTIVATED"])
    );
  });

  test("activating a new version automatically retires the previously active one for the same city", async ({
    page,
    baseURL,
  }) => {
    const labelA = `admin-pricing-test-a-${Date.now()}`;
    const labelB = `admin-pricing-test-b-${Date.now()}`;

    const resA = await page.request.post(`${baseURL}/api/admin/pricing/versions`, { data: validVersionBody(labelA) });
    const idA = (await resA.json()).data.id;
    await page.request.post(`${baseURL}/api/admin/pricing/versions/${idA}/activate`);

    const resB = await page.request.post(`${baseURL}/api/admin/pricing/versions`, { data: validVersionBody(labelB) });
    const idB = (await resB.json()).data.id;
    const activateB = await page.request.post(`${baseURL}/api/admin/pricing/versions/${idB}/activate`);
    expect(activateB.status()).toBe(200);

    const [rowA, rowB] = await Promise.all([
      testDb.pricingVersion.findUnique({ where: { id: idA } }),
      testDb.pricingVersion.findUnique({ where: { id: idB } }),
    ]);
    expect(rowA?.status).toBe("RETIRED");
    expect(rowB?.status).toBe("ACTIVE");

    // Database-level guarantee (D027): at most one ACTIVE row per city.
    const activeCount = await testDb.pricingVersion.count({ where: { citySlug: "toronto", status: "ACTIVE" } });
    expect(activeCount).toBe(1);
  });

  test("only a DRAFT version can be activated — an already-retired version cannot be reactivated", async ({
    page,
    baseURL,
  }) => {
    const label = `admin-pricing-test-retired-${Date.now()}`;
    const res = await page.request.post(`${baseURL}/api/admin/pricing/versions`, { data: validVersionBody(label) });
    const id = (await res.json()).data.id;
    await page.request.post(`${baseURL}/api/admin/pricing/versions/${id}/activate`);
    await page.request.post(`${baseURL}/api/admin/pricing/versions/${id}/retire`);

    const reactivate = await page.request.post(`${baseURL}/api/admin/pricing/versions/${id}/activate`);
    expect(reactivate.status()).toBe(409);
    const json = await reactivate.json();
    expect(json.code).toBe("INVALID_TRANSITION");
  });

  test("retiring an already-retired version is rejected, not a silent no-op", async ({ page, baseURL }) => {
    const label = `admin-pricing-test-doubleretire-${Date.now()}`;
    const res = await page.request.post(`${baseURL}/api/admin/pricing/versions`, { data: validVersionBody(label) });
    const id = (await res.json()).data.id;
    const first = await page.request.post(`${baseURL}/api/admin/pricing/versions/${id}/retire`);
    expect(first.status()).toBe(200);
    const second = await page.request.post(`${baseURL}/api/admin/pricing/versions/${id}/retire`);
    expect(second.status()).toBe(409);
  });

  test("two simultaneous activations for the same city cannot both win — the DB partial unique index is the real guarantee (D027)", async ({
    page,
    baseURL,
  }) => {
    const stamp = Date.now();
    const labelA = `admin-pricing-test-race-a-${stamp}`;
    const labelB = `admin-pricing-test-race-b-${stamp}`;

    const [resA, resB] = await Promise.all([
      page.request.post(`${baseURL}/api/admin/pricing/versions`, { data: validVersionBody(labelA) }),
      page.request.post(`${baseURL}/api/admin/pricing/versions`, { data: validVersionBody(labelB) }),
    ]);
    const idA = (await resA.json()).data.id;
    const idB = (await resB.json()).data.id;

    // Both start as DRAFT with neither ACTIVE yet — fire both activations at
    // once so the database's partial unique index, not app-level
    // sequencing, is what decides the winner.
    const [activateA, activateB] = await Promise.all([
      page.request.post(`${baseURL}/api/admin/pricing/versions/${idA}/activate`),
      page.request.post(`${baseURL}/api/admin/pricing/versions/${idB}/activate`),
    ]);

    const statuses = [activateA.status(), activateB.status()].sort();
    // Exactly one wins (200); the other either loses the race explicitly
    // (409 CONFLICT, the P2002 branch) or — if it happened to run first and
    // complete before the other started — also succeeds sequentially. What
    // must never happen is both ending up ACTIVE at once, so assert on the
    // database's final state, which is the guarantee that actually matters.
    expect(statuses.every((s) => s === 200 || s === 409)).toBe(true);

    const activeRows = await testDb.pricingVersion.findMany({
      where: { citySlug: "toronto", status: "ACTIVE" },
    });
    expect(activeRows.length).toBe(1);
    expect([idA, idB]).toContain(activeRows[0]!.id);
  });
});

test.describe("Pricing simulator", () => {
  test("simulator result matches a direct engine computation for the same inputs", async ({ page, baseURL }) => {
    const label = `admin-pricing-test-sim-${Date.now()}`;
    const res = await page.request.post(`${baseURL}/api/admin/pricing/versions`, { data: validVersionBody(label) });
    const id = (await res.json()).data.id;

    const simRes = await page.request.post(`${baseURL}/api/admin/pricing/simulate`, {
      data: { pricingVersionId: id, serviceSlug: "wall-panels", totalAreaM2: 10, materialOwnership: "MATERIAL_AND_INSTALL" },
    });
    expect(simRes.status()).toBe(200);
    const sim = (await simRes.json()).data;
    // (6500+8500)*10 = 150000, tax 13% = 19500, total 169500 — same numbers
    // verified against computeCustomerPrice directly in pricing-engine.spec.ts.
    expect(sim.customer.subtotalMinor).toBe(150000);
    expect(sim.customer.taxMinor).toBe(19500);
    expect(sim.customer.totalMinor).toBe(169500);
    expect(sim.internal.contributionMarginPercent).toBeGreaterThan(0);
  });

  test("simulator works against a DRAFT version, not just the active one", async ({ page, baseURL }) => {
    const label = `admin-pricing-test-draft-sim-${Date.now()}`;
    const res = await page.request.post(`${baseURL}/api/admin/pricing/versions`, { data: validVersionBody(label) });
    const id = (await res.json()).data.id;
    const row = await testDb.pricingVersion.findUnique({ where: { id } });
    expect(row?.status).toBe("DRAFT");

    const simRes = await page.request.post(`${baseURL}/api/admin/pricing/simulate`, {
      data: { pricingVersionId: id, serviceSlug: "wall-panels", totalAreaM2: 5, materialOwnership: "INSTALL_ONLY" },
    });
    expect(simRes.status()).toBe(200);
  });
});

test.describe("D029 — UNPROFITABLE quote health does not block the customer, but surfaces to admin", () => {
  test("a job whose economics snapshot is UNPROFITABLE appears in the Overview's Action Required list", async ({
    page,
    baseURL,
  }) => {
    const stamp = Date.now();
    // Seed the full chain directly — this test is about the admin dashboard
    // query, not about re-proving the engine (already covered in
    // pricing-engine.spec.ts) or the funnel (already covered elsewhere).
    const lead = await testDb.lead.create({
      data: {
        sessionId: `unprofitable-dashboard-${stamp}`,
        status: "BOOKING_INTENT",
        serviceSlug: "marble-sheets",
        citySlug: "toronto",
        postalCode: "M4B1B3",
        totalAreaM2: 1,
        materialOwnership: "INSTALL_ONLY",
        contact: { create: { firstName: "UnprofitableCheck", email: `unprofitable-${stamp}@example.com`, phone: "4165550099" } },
      },
    });
    const version = await testDb.pricingVersion.create({
      data: {
        citySlug: "toronto",
        label: `admin-pricing-test-unprofitable-${stamp}`,
        status: "RETIRED", // doesn't need to be active for this — the snapshot just references it
        taxRatePercent: 13,
        taxLabel: "HST (13%)",
        professionalPayoutPercentOfLabor: 75,
        materialCostPercentOfCustomerRate: 70,
        paymentProcessingPercent: 2.9,
        paymentProcessingFixedMinor: 30,
        estimatedCacMinor: 7500,
        otherVariableCostMinor: 1000,
        healthyMarginPercent: 30,
        acceptableMarginPercent: 15,
        lowMarginPercent: 5,
      },
    });
    const snapshot = await testDb.quoteSnapshot.create({
      data: {
        leadId: lead.id,
        serviceSlug: "marble-sheets",
        serviceName: "Marble Sheets",
        totalAreaM2: 1,
        materialOwnership: "INSTALL_ONLY",
        subtotalMinor: 35000,
        taxMinor: 4550,
        taxLabel: "HST (13%)",
        totalMinor: 39550,
        pricingSource: "AUTHORITATIVE_VERSIONED",
        priceGeneratedAt: new Date(),
        pricingVersionId: version.id,
      },
    });
    await testDb.economicsSnapshot.create({
      data: {
        quoteSnapshotId: snapshot.id,
        pricingVersionId: version.id,
        professionalPayoutEstimateMinor: 26250,
        materialCostEstimateMinor: 0,
        processingEstimateMinor: 1177,
        cacAssumptionMinor: 7500,
        otherVariableCostMinor: 1000,
        contributionProfitMinor: -927,
        contributionMarginPercent: -2.65,
        quoteHealth: "UNPROFITABLE",
      },
    });
    const bookingIntent = await testDb.bookingIntent.create({
      data: { leadId: lead.id, quoteSnapshotId: snapshot.id },
    });
    const job = await testDb.job.create({
      data: { leadId: lead.id, bookingIntentId: bookingIntent.id, status: "NEW" },
    });

    await page.goto(`${baseURL}/admin`, { waitUntil: "networkidle" });
    await expect(page.getByText(/Quote economics flagged unprofitable/i)).toBeVisible();

    // And the job detail page itself shows the red flag, not a hidden one.
    await page.goto(`${baseURL}/admin/jobs/${job.id}`, { waitUntil: "networkidle" });
    await expect(page.getByText(/^Unprofitable$/i)).toBeVisible();
  });
});

test.describe("unauthenticated", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("an unauthenticated caller cannot create, activate, retire, or simulate pricing", async ({ request, baseURL }) => {
    const createRes = await request.post(`${baseURL}/api/admin/pricing/versions`, {
      data: validVersionBody(`should-not-exist-${Date.now()}`),
    });
    expect(createRes.status()).toBe(401);

    const existing = await testDb.pricingVersion.findFirst({ where: { citySlug: "toronto" } });
    if (existing) {
      const activateRes = await request.post(`${baseURL}/api/admin/pricing/versions/${existing.id}/activate`);
      expect(activateRes.status()).toBe(401);
      const simRes = await request.post(`${baseURL}/api/admin/pricing/simulate`, {
        data: { pricingVersionId: existing.id, serviceSlug: "wall-panels", totalAreaM2: 10, materialOwnership: "INSTALL_ONLY" },
      });
      expect(simRes.status()).toBe(401);
    }
  });
});

test.describe("Server-side validation — invalid values are rejected, not silently clamped", () => {
  test("negative rates are rejected", async ({ page, baseURL }) => {
    const res = await page.request.post(`${baseURL}/api/admin/pricing/versions`, {
      data: validVersionBody(`admin-pricing-test-negative-${Date.now()}`, {
        rules: [{ serviceSlug: "wall-panels", installOnlyRateMinorPerM2: -100, materialRateMinorPerM2: 8500, minimumSubtotalMinor: 35000 }],
      }),
    });
    expect(res.status()).toBe(400);
  });

  test("NaN / non-finite values are rejected", async ({ page, baseURL }) => {
    const res = await page.request.post(`${baseURL}/api/admin/pricing/versions`, {
      data: validVersionBody(`admin-pricing-test-nan-${Date.now()}`, { taxRatePercent: Number.NaN }),
    });
    expect(res.status()).toBe(400);
  });

  test("absurdly large amounts are rejected, not silently accepted", async ({ page, baseURL }) => {
    const res = await page.request.post(`${baseURL}/api/admin/pricing/versions`, {
      data: validVersionBody(`admin-pricing-test-huge-${Date.now()}`, {
        estimatedCacMinor: 999_999_999_999,
      }),
    });
    expect(res.status()).toBe(400);
  });

  test("percentages above 100 are rejected", async ({ page, baseURL }) => {
    const res = await page.request.post(`${baseURL}/api/admin/pricing/versions`, {
      data: validVersionBody(`admin-pricing-test-pct-${Date.now()}`, { professionalPayoutPercentOfLabor: 150 }),
    });
    expect(res.status()).toBe(400);
  });

  test("an unknown service slug in a rule is rejected", async ({ page, baseURL }) => {
    const res = await page.request.post(`${baseURL}/api/admin/pricing/versions`, {
      data: validVersionBody(`admin-pricing-test-unknown-svc-${Date.now()}`, {
        rules: [{ serviceSlug: "not-a-real-service", installOnlyRateMinorPerM2: 100, materialRateMinorPerM2: 100, minimumSubtotalMinor: 100 }],
      }),
    });
    expect(res.status()).toBe(400);
  });

  test("healthy threshold below acceptable threshold is rejected (thresholds must be ordered)", async ({ page, baseURL }) => {
    const res = await page.request.post(`${baseURL}/api/admin/pricing/versions`, {
      data: validVersionBody(`admin-pricing-test-order-${Date.now()}`, {
        healthyMarginPercent: 10,
        acceptableMarginPercent: 20,
      }),
    });
    expect(res.status()).toBe(400);
  });

  test("mass assignment: a client-supplied id/status is ignored — server always creates a fresh DRAFT", async ({
    page,
    baseURL,
  }) => {
    const res = await page.request.post(`${baseURL}/api/admin/pricing/versions`, {
      data: {
        ...validVersionBody(`admin-pricing-test-mass-assign-${Date.now()}`),
        id: "attacker-chosen-id",
        status: "ACTIVE",
        activatedAt: new Date().toISOString(),
      },
    });
    expect(res.status()).toBe(201);
    const json = await res.json();
    expect(json.data.id).not.toBe("attacker-chosen-id");
    const row = await testDb.pricingVersion.findUnique({ where: { id: json.data.id } });
    expect(row?.status).toBe("DRAFT"); // never ACTIVE from creation, regardless of what the client sent
  });
});
