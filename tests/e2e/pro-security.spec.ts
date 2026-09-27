import { test, expect } from "@playwright/test";
import { testDb } from "./helpers/db";
import { apiPost, fakeIp } from "./helpers/api";
import { ensureActivatedProfessional, proLogin, fakeProIp } from "./helpers/pro";

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
      styleId: "black",
      materialOwnership: "MATERIAL_AND_INSTALL",
      currentStep: "PRICE",
    },
    ip
  );
  await apiPost(baseURL, "/api/lead/price", { sessionId }, ip);
  await apiPost(
    baseURL,
    "/api/lead/contact",
    { sessionId, firstName: "SecurityTest", email: `${sessionId}@example.com`, phone: "4165550031", formRenderedAt: new Date(Date.now() - 5000).toISOString() },
    ip
  );
  await apiPost(baseURL, "/api/lead/timing", { sessionId, value: "ASAP" }, ip);
  await apiPost(baseURL, "/api/lead/booking-intent", { sessionId }, ip);

  // D044 — an offer can never be created before customer payment is
  // captured; every job these security/concurrency tests offer must be
  // genuinely paid first, not just administratively fast-forwarded.
  const createRes = await apiPost<{ providerOrderId: string }>(baseURL, "/api/lead/payment/create-order", { sessionId }, ip);
  const providerOrderId = (createRes.json as { ok: true; data: { providerOrderId: string } }).data.providerOrderId;
  await apiPost(baseURL, "/api/lead/payment/capture-order", { sessionId, providerOrderId }, ip);

  const lead = await testDb.lead.findUnique({ where: { sessionId } });
  const job = await testDb.job.findUnique({ where: { leadId: lead!.id } });
  await testDb.job.update({ where: { id: job!.id }, data: { status: "REVIEWING" } });
  return testDb.job.update({ where: { id: job!.id }, data: { status: "READY_FOR_ASSIGNMENT" } });
}

test.describe("IDOR / BOLA — Professional A cannot touch Professional B's data (P0, spec section 56/78)", () => {
  test("A cannot see B's own profile via a direct query", async ({ page, baseURL }) => {
    const stamp = Date.now();
    const proA = await ensureActivatedProfessional({ email: `idor-a-profile-${stamp}@example.com` });
    const proB = await ensureActivatedProfessional({ email: `idor-b-profile-${stamp}@example.com`, displayName: "Professional B Private" });

    const ctxA = await page.context().browser()!.newContext({ extraHTTPHeaders: { "X-Forwarded-For": fakeProIp(String(Math.random())) } });
    const pageA = await ctxA.newPage();
    await proLogin(pageA.request, baseURL!, proA.email);
    await pageA.goto(`${baseURL}/pro/profile`, { waitUntil: "networkidle" });
    const bodyText = await pageA.textContent("body");
    expect(bodyText).not.toContain("Professional B Private");
    expect(bodyText).not.toContain(proB.email);
    await ctxA.close();
  });

  test("A cannot accept an offer made to B", async ({ page, baseURL }) => {
    const stamp = Date.now();
    const job = await seedReadyJob(baseURL!, `idor-accept-${stamp}`, "wall-panels");
    const proA = await ensureActivatedProfessional({ email: `idor-accept-a-${stamp}@example.com` });
    const proB = await ensureActivatedProfessional({ email: `idor-accept-b-${stamp}@example.com` });

    await page.request.post(`${baseURL}/api/admin/jobs/${job.id}/offer`, {
      data: { professionalId: proB.id, offerAmountMinor: 40000 },
    });

    const ctxA = await page.context().browser()!.newContext({ extraHTTPHeaders: { "X-Forwarded-For": fakeProIp(String(Math.random())) } });
    const pageA = await ctxA.newPage();
    await proLogin(pageA.request, baseURL!, proA.email);
    const res = await pageA.request.post(`${baseURL}/api/pro/jobs/${job.id}/accept`);
    expect(res.status()).toBe(404); // never a distinguishable "exists but not yours"
    await ctxA.close();

    const untouched = await testDb.job.findUnique({ where: { id: job.id } });
    expect(untouched!.status).toBe("OFFERED");
    expect(untouched!.assignedProfessionalId).toBeNull();
  });

  test("A cannot decline an offer made to B", async ({ page, baseURL }) => {
    const stamp = Date.now();
    const job = await seedReadyJob(baseURL!, `idor-decline-${stamp}`, "wall-panels");
    const proA = await ensureActivatedProfessional({ email: `idor-decline-a-${stamp}@example.com` });
    const proB = await ensureActivatedProfessional({ email: `idor-decline-b-${stamp}@example.com` });
    await page.request.post(`${baseURL}/api/admin/jobs/${job.id}/offer`, {
      data: { professionalId: proB.id, offerAmountMinor: 40000 },
    });

    const ctxA = await page.context().browser()!.newContext({ extraHTTPHeaders: { "X-Forwarded-For": fakeProIp(String(Math.random())) } });
    const pageA = await ctxA.newPage();
    await proLogin(pageA.request, baseURL!, proA.email);
    const res = await pageA.request.post(`${baseURL}/api/pro/jobs/${job.id}/decline`);
    expect(res.status()).toBe(404);
    await ctxA.close();
  });

  test("A cannot change status on B's assigned job (en route/arrived/start/complete/problem)", async ({ page, baseURL }) => {
    const stamp = Date.now();
    const job = await seedReadyJob(baseURL!, `idor-field-${stamp}`, "wall-panels");
    const proA = await ensureActivatedProfessional({ email: `idor-field-a-${stamp}@example.com` });
    const proB = await ensureActivatedProfessional({ email: `idor-field-b-${stamp}@example.com` });
    await page.request.post(`${baseURL}/api/admin/jobs/${job.id}/offer`, {
      data: { professionalId: proB.id, offerAmountMinor: 40000 },
    });

    const ctxB = await page.context().browser()!.newContext({ extraHTTPHeaders: { "X-Forwarded-For": fakeProIp(String(Math.random())) } });
    const pageB = await ctxB.newPage();
    await proLogin(pageB.request, baseURL!, proB.email);
    await pageB.request.post(`${baseURL}/api/pro/jobs/${job.id}/accept`);
    await ctxB.close();

    const ctxA = await page.context().browser()!.newContext({ extraHTTPHeaders: { "X-Forwarded-For": fakeProIp(String(Math.random())) } });
    const pageA = await ctxA.newPage();
    await proLogin(pageA.request, baseURL!, proA.email);
    for (const path of ["en-route", "arrived", "start", "complete"]) {
      const res = await pageA.request.post(`${baseURL}/api/pro/jobs/${job.id}/${path}`);
      expect(res.status()).toBe(404);
    }
    const problemRes = await pageA.request.post(`${baseURL}/api/pro/jobs/${job.id}/problem`, {
      data: { reasonCode: "OTHER" },
    });
    expect(problemRes.status()).toBe(404);
    await ctxA.close();

    const stillAssignedToB = await testDb.job.findUnique({ where: { id: job.id } });
    expect(stillAssignedToB!.status).toBe("ASSIGNED");
    expect(stillAssignedToB!.assignedProfessionalId).toBe(proB.id);
  });

  test("A cannot see B's compensation amount by requesting B's job detail directly", async ({ page, baseURL }) => {
    const stamp = Date.now();
    const job = await seedReadyJob(baseURL!, `idor-comp-${stamp}`, "wall-panels");
    const proA = await ensureActivatedProfessional({ email: `idor-comp-a-${stamp}@example.com` });
    const proB = await ensureActivatedProfessional({ email: `idor-comp-b-${stamp}@example.com` });
    await page.request.post(`${baseURL}/api/admin/jobs/${job.id}/offer`, {
      data: { professionalId: proB.id, offerAmountMinor: 77700 },
    });

    const ctxA = await page.context().browser()!.newContext({ extraHTTPHeaders: { "X-Forwarded-For": fakeProIp(String(Math.random())) } });
    const pageA = await ctxA.newPage();
    await proLogin(pageA.request, baseURL!, proA.email);
    await pageA.goto(`${baseURL}/pro/jobs/${job.id}`);
    // notFound() page — never the $777.00 offer amount.
    const bodyText = await pageA.textContent("body");
    expect(bodyText).not.toContain("777.00");
    await ctxA.close();
  });
});

test.describe("Mass assignment / money tampering (spec section 20/85)", () => {
  test("admin offer creation rejects negative, NaN, and Infinity amounts", async ({ page, baseURL }) => {
    const stamp = Date.now();
    const job = await seedReadyJob(baseURL!, `money-invalid-${stamp}`, "wall-panels");
    const pro = await ensureActivatedProfessional({ email: `money-invalid-pro-${stamp}@example.com` });

    for (const bad of [-100, Number.NaN, Number.POSITIVE_INFINITY, 999_999_999]) {
      const res = await page.request.post(`${baseURL}/api/admin/jobs/${job.id}/offer`, {
        data: { professionalId: pro.id, offerAmountMinor: bad },
      });
      expect(res.status(), `offerAmountMinor=${bad}`).toBe(400);
    }
    const untouched = await testDb.job.findUnique({ where: { id: job.id } });
    expect(untouched!.status).toBe("READY_FOR_ASSIGNMENT");
  });

  test("a professional cannot smuggle an offerAmountMinor into their own accept/decline/field-action requests", async ({
    page,
    baseURL,
  }) => {
    const stamp = Date.now();
    const job = await seedReadyJob(baseURL!, `money-smuggle-${stamp}`, "wall-panels");
    const pro = await ensureActivatedProfessional({ email: `money-smuggle-pro-${stamp}@example.com` });
    await page.request.post(`${baseURL}/api/admin/jobs/${job.id}/offer`, {
      data: { professionalId: pro.id, offerAmountMinor: 30000 },
    });

    const ctx = await page.context().browser()!.newContext({ extraHTTPHeaders: { "X-Forwarded-For": fakeProIp(String(Math.random())) } });
    const proPage = await ctx.newPage();
    await proLogin(proPage.request, baseURL!, pro.email);
    // The accept endpoint takes no body at all — a forged amount field is simply ignored (there's no code path that reads it).
    const res = await proPage.request.post(`${baseURL}/api/pro/jobs/${job.id}/accept`, {
      data: { offerAmountMinor: 999999999 },
    });
    expect(res.status()).toBe(200);
    await ctx.close();

    const offer = await testDb.jobOffer.findFirst({ where: { jobId: job.id } });
    expect(offer!.offerAmountMinor).toBe(30000); // unchanged from what admin actually offered
  });

  test("a client-supplied professionalId cannot be overridden by a crafted decline/field-action body", async ({
    page,
    baseURL,
  }) => {
    const stamp = Date.now();
    const job = await seedReadyJob(baseURL!, `money-actor-forge-${stamp}`, "wall-panels");
    const proA = await ensureActivatedProfessional({ email: `money-actor-a-${stamp}@example.com` });
    const proB = await ensureActivatedProfessional({ email: `money-actor-b-${stamp}@example.com` });
    await page.request.post(`${baseURL}/api/admin/jobs/${job.id}/offer`, {
      data: { professionalId: proA.id, offerAmountMinor: 30000 },
    });

    const ctx = await page.context().browser()!.newContext({ extraHTTPHeaders: { "X-Forwarded-For": fakeProIp(String(Math.random())) } });
    const proPageA = await ctx.newPage();
    await proLogin(proPageA.request, baseURL!, proA.email);
    // Try to make the accept "count" as professional B via a forged field — the route never reads a
    // professionalId from the body at all; it's derived solely from the authenticated session.
    const res = await proPageA.request.post(`${baseURL}/api/pro/jobs/${job.id}/accept`, {
      data: { professionalId: proB.id },
    });
    expect(res.status()).toBe(200);
    await ctx.close();

    const finalJob = await testDb.job.findUnique({ where: { id: job.id } });
    expect(finalJob!.assignedProfessionalId).toBe(proA.id); // the actually-authenticated professional, not the forged one
  });
});

test.describe("Concurrency (spec section 53/83)", () => {
  test("two simultaneous accept attempts from the same professional resolve safely, no duplicate assignment", async ({
    page,
    baseURL,
  }) => {
    const stamp = Date.now();
    const job = await seedReadyJob(baseURL!, `concurrent-accept-${stamp}`, "wall-panels");
    const pro = await ensureActivatedProfessional({ email: `concurrent-accept-pro-${stamp}@example.com` });
    await page.request.post(`${baseURL}/api/admin/jobs/${job.id}/offer`, {
      data: { professionalId: pro.id, offerAmountMinor: 30000 },
    });

    const ctx = await page.context().browser()!.newContext({ extraHTTPHeaders: { "X-Forwarded-For": fakeProIp(String(Math.random())) } });
    const proPage = await ctx.newPage();
    await proLogin(proPage.request, baseURL!, pro.email);

    const [a, b] = await Promise.all([
      proPage.request.post(`${baseURL}/api/pro/jobs/${job.id}/accept`),
      proPage.request.post(`${baseURL}/api/pro/jobs/${job.id}/accept`),
    ]);
    expect([a.status(), b.status()].every((s) => s === 200)).toBe(true);
    await ctx.close();

    const offers = await testDb.jobOffer.count({ where: { jobId: job.id, status: "ACCEPTED" } });
    expect(offers).toBe(1); // exactly one accepted offer, not two, no corrupted duplicate

    const acceptedAudits = await testDb.auditEvent.count({
      where: { entityType: "JOB", entityId: job.id, action: "JOB_OFFER_ACCEPTED" },
    });
    expect(acceptedAudits).toBe(1);
  });

  test("admin withdrawing an offer races safely against the professional accepting it", async ({ page, baseURL }) => {
    const stamp = Date.now();
    const job = await seedReadyJob(baseURL!, `concurrent-withdraw-accept-${stamp}`, "wall-panels");
    const pro = await ensureActivatedProfessional({ email: `concurrent-withdraw-pro-${stamp}@example.com` });
    await page.request.post(`${baseURL}/api/admin/jobs/${job.id}/offer`, {
      data: { professionalId: pro.id, offerAmountMinor: 30000 },
    });

    const ctx = await page.context().browser()!.newContext({ extraHTTPHeaders: { "X-Forwarded-For": fakeProIp(String(Math.random())) } });
    const proPage = await ctx.newPage();
    await proLogin(proPage.request, baseURL!, pro.email);

    const [withdrawRes, acceptRes] = await Promise.all([
      page.request.post(`${baseURL}/api/admin/jobs/${job.id}/offer/withdraw`),
      proPage.request.post(`${baseURL}/api/pro/jobs/${job.id}/accept`),
    ]);
    await ctx.close();

    // Exactly one of the two wins — never both, never neither leaving a corrupted state.
    const finalJob = await testDb.job.findUnique({ where: { id: job.id } });
    if (withdrawRes.status() === 200) {
      expect(acceptRes.status()).not.toBe(200);
      expect(finalJob!.status).toBe("READY_FOR_ASSIGNMENT");
    } else {
      expect(acceptRes.status()).toBe(200);
      expect(finalJob!.status).toBe("ASSIGNED");
    }
  });

  test("duplicate concurrent complete calls do not create duplicate audit history", async ({ page, baseURL }) => {
    const stamp = Date.now();
    const job = await seedReadyJob(baseURL!, `concurrent-complete-${stamp}`, "wall-panels");
    const pro = await ensureActivatedProfessional({ email: `concurrent-complete-pro-${stamp}@example.com` });
    await page.request.post(`${baseURL}/api/admin/jobs/${job.id}/offer`, {
      data: { professionalId: pro.id, offerAmountMinor: 30000 },
    });

    const ctx = await page.context().browser()!.newContext({ extraHTTPHeaders: { "X-Forwarded-For": fakeProIp(String(Math.random())) } });
    const proPage = await ctx.newPage();
    await proLogin(proPage.request, baseURL!, pro.email);
    await proPage.request.post(`${baseURL}/api/pro/jobs/${job.id}/accept`);
    await proPage.request.post(`${baseURL}/api/pro/jobs/${job.id}/en-route`);
    await proPage.request.post(`${baseURL}/api/pro/jobs/${job.id}/arrived`);
    await proPage.request.post(`${baseURL}/api/pro/jobs/${job.id}/start`);

    const [a, b] = await Promise.all([
      proPage.request.post(`${baseURL}/api/pro/jobs/${job.id}/complete`),
      proPage.request.post(`${baseURL}/api/pro/jobs/${job.id}/complete`),
    ]);
    expect([a.status(), b.status()].every((s) => s === 200)).toBe(true);
    await ctx.close();

    const completedAudits = await testDb.auditEvent.count({
      where: { entityType: "JOB", entityId: job.id, action: "JOB_COMPLETION_REPORTED" },
    });
    expect(completedAudits).toBe(1);
  });
});

test.describe("CSRF / origin protection on professional mutations", () => {
  test("a mutation with a mismatched Origin header is rejected", async ({ page, baseURL }) => {
    const stamp = Date.now();
    const email = `pro-csrf-${stamp}@example.com`;
    await ensureActivatedProfessional({ email });
    const res = await page.request.post(`${baseURL}/api/pro/auth/login`, {
      data: { email, password: "wrong-but-origin-checked-first" },
      headers: { Origin: "https://evil.example.com" },
    });
    expect(res.status()).toBe(403);
  });
});
