import { test, expect } from "@playwright/test";
import { testDb } from "./helpers/db";
import { apiPost, fakeIp } from "./helpers/api";
import { ensureActivatedProfessional, proLogin, fakeProIp } from "./helpers/pro";

/** Real customer funnel through to a Job, then admin-advanced to READY_FOR_ASSIGNMENT. */
async function seedReadyJob(baseURL: string, sessionId: string, serviceSlug = "wall-panels") {
  const ip = { "X-Forwarded-For": fakeIp(sessionId) };
  await apiPost(
    baseURL,
    "/api/lead/progress",
    {
      sessionId,
      serviceSlug,
      postalCode: "M5V 2T6",
      measurementUnit: "METRIC",
      totalAreaM2: 10,
      // No styleId — serviceSlug varies by caller (wallpaper, marble-sheets,
      // decorative-partitions, wall-panels) and styles are service-specific
      // (Session H0.2); this file doesn't test style.
      materialOwnership: "MATERIAL_AND_INSTALL",
      currentStep: "PRICE",
    },
    ip
  );
  await apiPost(baseURL, "/api/lead/price", { sessionId }, ip);
  await apiPost(
    baseURL,
    "/api/lead/contact",
    {
      sessionId,
      firstName: "ProWorkflow",
      email: `${sessionId}@example.com`,
      phone: "4165550030",
      formRenderedAt: new Date(Date.now() - 5000).toISOString(),
    },
    ip
  );
  await apiPost(baseURL, "/api/lead/timing", { sessionId, value: "ASAP" }, ip);
  await apiPost(baseURL, "/api/lead/booking-intent", { sessionId }, ip);

  // D044 — an offer can never be created before customer payment is
  // captured (Session G); this field-workflow suite starts every job
  // from a genuinely paid state, not an administrative shortcut.
  const createRes = await apiPost<{ providerOrderId: string }>(baseURL, "/api/lead/payment/create-order", { sessionId }, ip);
  const providerOrderId = (createRes.json as { ok: true; data: { providerOrderId: string } }).data.providerOrderId;
  await apiPost(baseURL, "/api/lead/payment/capture-order", { sessionId, providerOrderId }, ip);

  const lead = await testDb.lead.findUnique({ where: { sessionId } });
  const job = await testDb.job.findUnique({ where: { leadId: lead!.id } });
  await testDb.job.update({ where: { id: job!.id }, data: { status: "REVIEWING" } });
  const ready = await testDb.job.update({ where: { id: job!.id }, data: { status: "READY_FOR_ASSIGNMENT" } });
  return ready;
}

test.describe("Offer workflow — full field progression (spec section 81/87)", () => {
  test("offer -> accept -> en route -> arrived -> start -> complete, each transition valid/timestamped/audited/visible in admin", async ({
    page,
    baseURL,
  }) => {
    const stamp = Date.now();
    const job = await seedReadyJob(baseURL!, `field-progress-${stamp}`, "wall-panels");
    const pro = await ensureActivatedProfessional({ email: `field-progress-pro-${stamp}@example.com` });

    const offerRes = await page.request.post(`${baseURL}/api/admin/jobs/${job.id}/offer`, {
      data: { professionalId: pro.id, offerAmountMinor: 45000 },
    });
    expect(offerRes.status()).toBe(201);
    expect((await testDb.job.findUnique({ where: { id: job.id } }))!.status).toBe("OFFERED");

    const proContext = await page.context().browser()!.newContext({ extraHTTPHeaders: { "X-Forwarded-For": fakeProIp(String(Math.random())) } });
    const proPage = await proContext.newPage();
    await proLogin(proPage.request, baseURL!, pro.email);

    const accept = await proPage.request.post(`${baseURL}/api/pro/jobs/${job.id}/accept`);
    expect(accept.status()).toBe(200);
    const afterAccept = await testDb.job.findUnique({ where: { id: job.id } });
    expect(afterAccept!.status).toBe("ASSIGNED");
    expect(afterAccept!.assignedProfessionalId).toBe(pro.id);

    for (const [path, expectedStatus, auditAction] of [
      ["en-route", "EN_ROUTE", "JOB_EN_ROUTE"],
      ["arrived", "ARRIVED", "JOB_ARRIVED"],
      ["start", "IN_PROGRESS", "JOB_STARTED"],
      ["complete", "COMPLETED", "JOB_COMPLETION_REPORTED"],
    ] as const) {
      const res = await proPage.request.post(`${baseURL}/api/pro/jobs/${job.id}/${path}`);
      expect(res.status()).toBe(200);
      const row = await testDb.job.findUnique({ where: { id: job.id } });
      expect(row!.status).toBe(expectedStatus);

      const audit = await testDb.auditEvent.findFirst({
        where: { entityType: "JOB", entityId: job.id, action: auditAction },
      });
      expect(audit).not.toBeNull();
      expect(audit!.actorProfessionalId).toBe(pro.id);
    }

    // Visible in admin — job detail page renders the field timestamps and the offer as accepted.
    await page.goto(`${baseURL}/admin/jobs/${job.id}`, { waitUntil: "networkidle" });
    await expect(page.getByText("Completion reported").first()).toBeVisible();
    await expect(page.getByText(pro.displayName).first()).toBeVisible();

    await proContext.close();
  });

  test("invalid transitions are rejected server-side — OFFERED cannot jump to complete, ACCEPTED cannot jump to arrived", async ({
    page,
    baseURL,
  }) => {
    const stamp = Date.now();
    const job = await seedReadyJob(baseURL!, `invalid-transition-${stamp}`, "wallpaper");
    const pro = await ensureActivatedProfessional({
      email: `invalid-transition-pro-${stamp}@example.com`,
      serviceSlugs: ["wallpaper"],
    });
    await page.request.post(`${baseURL}/api/admin/jobs/${job.id}/offer`, {
      data: { professionalId: pro.id, offerAmountMinor: 30000 },
    });

    const proContext = await page.context().browser()!.newContext({ extraHTTPHeaders: { "X-Forwarded-For": fakeProIp(String(Math.random())) } });
    const proPage = await proContext.newPage();
    await proLogin(proPage.request, baseURL!, pro.email);

    // OFFERED -> complete, skipping the entire field progression. Rejected
    // as NOT_FOUND (not CONFLICT) because assignedProfessionalId isn't set
    // until acceptance — the IDOR boundary (getJobAssignedToProfessional)
    // correctly treats "not yet assigned to you" the same as "not yours".
    const skipToComplete = await proPage.request.post(`${baseURL}/api/pro/jobs/${job.id}/complete`);
    expect(skipToComplete.status()).toBe(404);

    await proPage.request.post(`${baseURL}/api/pro/jobs/${job.id}/accept`);
    // ASSIGNED -> arrived, skipping en-route.
    const skipEnRoute = await proPage.request.post(`${baseURL}/api/pro/jobs/${job.id}/arrived`);
    expect(skipEnRoute.status()).toBe(409);

    const stillAssigned = await testDb.job.findUnique({ where: { id: job.id } });
    expect(stillAssigned!.status).toBe("ASSIGNED");

    await proContext.close();
  });

  test("field actions are idempotent against a double tap", async ({ page, baseURL }) => {
    const stamp = Date.now();
    const job = await seedReadyJob(baseURL!, `idempotent-field-${stamp}`, "marble-sheets");
    const pro = await ensureActivatedProfessional({
      email: `idempotent-field-pro-${stamp}@example.com`,
      serviceSlugs: ["marble-sheets"],
    });
    await page.request.post(`${baseURL}/api/admin/jobs/${job.id}/offer`, {
      data: { professionalId: pro.id, offerAmountMinor: 40000 },
    });

    const proContext = await page.context().browser()!.newContext({ extraHTTPHeaders: { "X-Forwarded-For": fakeProIp(String(Math.random())) } });
    const proPage = await proContext.newPage();
    await proLogin(proPage.request, baseURL!, pro.email);

    await proPage.request.post(`${baseURL}/api/pro/jobs/${job.id}/accept`);
    await proPage.request.post(`${baseURL}/api/pro/jobs/${job.id}/en-route`);

    const first = await proPage.request.post(`${baseURL}/api/pro/jobs/${job.id}/en-route`);
    expect(first.status()).toBe(200); // already there — treated as a no-op success, not an error

    const enRouteEvents = await testDb.auditEvent.count({
      where: { entityType: "JOB", entityId: job.id, action: "JOB_EN_ROUTE" },
    });
    expect(enRouteEvents).toBe(1); // no duplicate audit row from the double tap

    await proContext.close();
  });
});

test.describe("Decline workflow (spec section 80)", () => {
  test("A declines, B is offered and accepts, A's decline stays in history", async ({ page, baseURL }) => {
    const stamp = Date.now();
    const job = await seedReadyJob(baseURL!, `decline-history-${stamp}`, "decorative-partitions");
    const proA = await ensureActivatedProfessional({
      email: `decline-a-${stamp}@example.com`,
      displayName: "Professional A",
      serviceSlugs: ["decorative-partitions"],
    });
    const proB = await ensureActivatedProfessional({
      email: `decline-b-${stamp}@example.com`,
      displayName: "Professional B",
      serviceSlugs: ["decorative-partitions"],
    });

    const offerA = await page.request.post(`${baseURL}/api/admin/jobs/${job.id}/offer`, {
      data: { professionalId: proA.id, offerAmountMinor: 35000 },
    });
    expect(offerA.status()).toBe(201);

    const proAContext = await page.context().browser()!.newContext({ extraHTTPHeaders: { "X-Forwarded-For": fakeProIp(String(Math.random())) } });
    const proAPage = await proAContext.newPage();
    await proLogin(proAPage.request, baseURL!, proA.email);
    const declineRes = await proAPage.request.post(`${baseURL}/api/pro/jobs/${job.id}/decline`, {
      data: { reason: "TIMING", note: "Can't make it work this week" },
    });
    expect(declineRes.status()).toBe(200);
    await proAContext.close();

    const afterDecline = await testDb.job.findUnique({ where: { id: job.id } });
    expect(afterDecline!.status).toBe("READY_FOR_ASSIGNMENT");

    // Admin sees the decline.
    await page.goto(`${baseURL}/admin/jobs/${job.id}`, { waitUntil: "networkidle" });
    await expect(page.getByText(/declined the offer/i)).toBeVisible();

    const offerB = await page.request.post(`${baseURL}/api/admin/jobs/${job.id}/offer`, {
      data: { professionalId: proB.id, offerAmountMinor: 36000 },
    });
    expect(offerB.status()).toBe(201);

    const proBContext = await page.context().browser()!.newContext({ extraHTTPHeaders: { "X-Forwarded-For": fakeProIp(String(Math.random())) } });
    const proBPage = await proBContext.newPage();
    await proLogin(proBPage.request, baseURL!, proB.email);
    const acceptRes = await proBPage.request.post(`${baseURL}/api/pro/jobs/${job.id}/accept`);
    expect(acceptRes.status()).toBe(200);
    await proBContext.close();

    // A's decline is still in the offer history, not overwritten.
    const offers = await testDb.jobOffer.findMany({ where: { jobId: job.id }, orderBy: { offeredAt: "asc" } });
    expect(offers).toHaveLength(2);
    expect(offers[0].professionalId).toBe(proA.id);
    expect(offers[0].status).toBe("DECLINED");
    expect(offers[1].professionalId).toBe(proB.id);
    expect(offers[1].status).toBe("ACCEPTED");

    const finalJob = await testDb.job.findUnique({ where: { id: job.id } });
    expect(finalJob!.assignedProfessionalId).toBe(proB.id);
  });

  test("a professional never sees a job that was offered to and declined by someone else and never re-offered to them", async ({
    page,
    baseURL,
  }) => {
    const stamp = Date.now();
    const job = await seedReadyJob(baseURL!, `decline-no-autooffer-${stamp}`, "wall-panels");
    const proA = await ensureActivatedProfessional({ email: `decline-noauto-a-${stamp}@example.com` });
    const proC = await ensureActivatedProfessional({ email: `decline-noauto-c-${stamp}@example.com` });

    await page.request.post(`${baseURL}/api/admin/jobs/${job.id}/offer`, {
      data: { professionalId: proA.id, offerAmountMinor: 30000 },
    });
    const proAContext = await page.context().browser()!.newContext({ extraHTTPHeaders: { "X-Forwarded-For": fakeProIp(String(Math.random())) } });
    const proAPage = await proAContext.newPage();
    await proLogin(proAPage.request, baseURL!, proA.email);
    await proAPage.request.post(`${baseURL}/api/pro/jobs/${job.id}/decline`, { data: { reason: "OTHER" } });
    await proAContext.close();

    // Job was never offered to C — C's accept attempt must be rejected.
    const proCContext = await page.context().browser()!.newContext({ extraHTTPHeaders: { "X-Forwarded-For": fakeProIp(String(Math.random())) } });
    const proCPage = await proCContext.newPage();
    await proLogin(proCPage.request, baseURL!, proC.email);
    const acceptRes = await proCPage.request.post(`${baseURL}/api/pro/jobs/${job.id}/accept`);
    expect(acceptRes.status()).toBe(404);
    await proCContext.close();
  });
});

test.describe("Problem reports (spec section 84)", () => {
  test("a problem report is stored safely (XSS inert), visible to admin, and audited", async ({ page, baseURL }) => {
    const stamp = Date.now();
    const job = await seedReadyJob(baseURL!, `problem-report-${stamp}`, "wall-panels");
    const pro = await ensureActivatedProfessional({ email: `problem-report-pro-${stamp}@example.com` });
    await page.request.post(`${baseURL}/api/admin/jobs/${job.id}/offer`, {
      data: { professionalId: pro.id, offerAmountMinor: 30000 },
    });

    const proContext = await page.context().browser()!.newContext({ extraHTTPHeaders: { "X-Forwarded-For": fakeProIp(String(Math.random())) } });
    const proPage = await proContext.newPage();
    await proLogin(proPage.request, baseURL!, pro.email);
    await proPage.request.post(`${baseURL}/api/pro/jobs/${job.id}/accept`);

    const xssPayload = "<script>window.__xss_fired = true;</script>Access blocked by locked gate";
    const reportRes = await proPage.request.post(`${baseURL}/api/pro/jobs/${job.id}/problem`, {
      data: { reasonCode: "ACCESS_PROBLEM", note: xssPayload },
    });
    expect(reportRes.status()).toBe(201);
    await proContext.close();

    const stored = await testDb.problemReport.findFirst({ where: { jobId: job.id } });
    expect(stored!.note).toBe(xssPayload); // preserved verbatim, not silently stripped

    const audit = await testDb.auditEvent.findFirst({
      where: { entityType: "JOB", entityId: job.id, action: "JOB_PROBLEM_REPORTED" },
    });
    expect(audit).not.toBeNull();

    await page.goto(`${baseURL}/admin/jobs/${job.id}`, { waitUntil: "networkidle" });
    const xssFired = await page.evaluate(() => (window as unknown as { __xss_fired?: boolean }).__xss_fired);
    expect(xssFired).toBeUndefined();
    await expect(page.getByText("Access problem").first()).toBeVisible();
    await expect(page.getByText(/Access blocked by locked gate/)).toBeVisible();
  });

  test("a problem report cannot be filed on a job not yet accepted", async ({ page, baseURL }) => {
    const stamp = Date.now();
    const job = await seedReadyJob(baseURL!, `problem-too-early-${stamp}`, "wall-panels");
    const pro = await ensureActivatedProfessional({ email: `problem-too-early-pro-${stamp}@example.com` });
    await page.request.post(`${baseURL}/api/admin/jobs/${job.id}/offer`, {
      data: { professionalId: pro.id, offerAmountMinor: 30000 },
    });

    const proContext = await page.context().browser()!.newContext({ extraHTTPHeaders: { "X-Forwarded-For": fakeProIp(String(Math.random())) } });
    const proPage = await proContext.newPage();
    await proLogin(proPage.request, baseURL!, pro.email);
    // Still OFFERED, not yet ASSIGNED — getJobAssignedToProfessional returns null.
    const res = await proPage.request.post(`${baseURL}/api/pro/jobs/${job.id}/problem`, {
      data: { reasonCode: "OTHER" },
    });
    expect(res.status()).toBe(404);
    await proContext.close();
  });
});
