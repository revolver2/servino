import { test, expect } from "@playwright/test";
import { apiPost, fakeIp } from "./helpers/api";
import { ensureTestAdmin } from "./helpers/admin";
import { testDb } from "./helpers/db";

test.beforeEach(async () => {
  await ensureTestAdmin();
});

async function seedJob(baseURL: string, sessionId: string, serviceSlug = "wall-panels") {
  const ip = { "X-Forwarded-For": fakeIp(sessionId) };
  await apiPost(
    baseURL,
    "/api/lead/progress",
    {
      sessionId,
      serviceSlug,
      postalCode: "M5V 2T6",
      measurementUnit: "METRIC",
      totalAreaM2: 12,
      // No styleId here deliberately — this helper is called with several
      // different serviceSlugs (spec: styles are service-specific since
      // Session H0.2), and these tests don't exercise style at all.
      materialOwnership: "INSTALL_ONLY",
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
      firstName: "JobTest",
      email: `${sessionId}@example.com`,
      phone: "4165550020",
      formRenderedAt: new Date(Date.now() - 5000).toISOString(),
    },
    ip
  );
  await apiPost(baseURL, "/api/lead/timing", { sessionId, value: "ASAP" }, ip);
  await apiPost(baseURL, "/api/lead/booking-intent", { sessionId }, ip);
  const lead = await testDb.lead.findUnique({ where: { sessionId } });
  return testDb.job.findUniqueOrThrow({ where: { leadId: lead!.id } });
}

test("manual assignment: one eligible professional assigned to one job is persisted with an audit entry", async ({
  page,
  baseURL,
}) => {
  const stamp = Date.now();
  const job = await seedJob(baseURL!, `assign-${stamp}`, "wall-panels");
  const pro = await testDb.professional.create({
    data: {
      displayName: "Assignable Pro",
      email: `assignable-${stamp}@example.com`,
      phone: "4165550021",
      active: true,
      services: { create: [{ serviceSlug: "wall-panels" }] },
    },
  });

  const res = await page.request.post(`${baseURL}/api/admin/jobs/${job.id}/assign`, {
    data: { professionalId: pro.id },
  });
  expect(res.status()).toBe(200);

  const updated = await testDb.job.findUnique({ where: { id: job.id } });
  expect(updated!.assignedProfessionalId).toBe(pro.id);
  expect(updated!.assignedAt).not.toBeNull();

  const audit = await testDb.auditEvent.findFirst({ where: { entityType: "JOB", entityId: job.id, action: "JOB_ASSIGNED" } });
  expect(audit).not.toBeNull();
  expect((audit!.metadata as { professionalId: string }).professionalId).toBe(pro.id);

  // List and detail both reflect it.
  await page.goto(`${baseURL}/admin/jobs/${job.id}`, { waitUntil: "networkidle" });
  await expect(page.getByRole("link", { name: "Assignable Pro" })).toBeVisible();
  await page.goto(`${baseURL}/admin/jobs`, { waitUntil: "networkidle" });
  // Match on the job's own (unique) truncated id shown in the table, not the
  // shared "JobTest" contact name, which repeated test runs can duplicate.
  await expect(page.locator("tbody tr", { hasText: job.id.slice(0, 10) })).toContainText("Assignable Pro");
});

test("assignment rejects an inactive professional and one without the required service", async ({ page, baseURL }) => {
  const stamp = Date.now();
  const job = await seedJob(baseURL!, `assign-invalid-${stamp}`, "marble-sheets");

  const inactivePro = await testDb.professional.create({
    data: {
      displayName: "Inactive Pro",
      email: `inactive-${stamp}@example.com`,
      phone: "4165550022",
      active: false,
      services: { create: [{ serviceSlug: "marble-sheets" }] },
    },
  });
  const wrongServicePro = await testDb.professional.create({
    data: {
      displayName: "Wrong Service Pro",
      email: `wrongservice-${stamp}@example.com`,
      phone: "4165550023",
      active: true,
      services: { create: [{ serviceSlug: "wallpaper" }] },
    },
  });

  const res1 = await page.request.post(`${baseURL}/api/admin/jobs/${job.id}/assign`, {
    data: { professionalId: inactivePro.id },
  });
  expect(res1.status()).toBe(400);

  const res2 = await page.request.post(`${baseURL}/api/admin/jobs/${job.id}/assign`, {
    data: { professionalId: wrongServicePro.id },
  });
  expect(res2.status()).toBe(400);

  const untouched = await testDb.job.findUnique({ where: { id: job.id } });
  expect(untouched!.assignedProfessionalId).toBeNull();
});

test("reassignment preserves history — both the original and new professional remain in the audit trail", async ({
  page,
  baseURL,
}) => {
  const stamp = Date.now();
  const job = await seedJob(baseURL!, `reassign-${stamp}`, "wallpaper");

  const [proA, proB] = await Promise.all([
    testDb.professional.create({
      data: { displayName: "Pro A", email: `proa-${stamp}@example.com`, phone: "4165550024", active: true, services: { create: [{ serviceSlug: "wallpaper" }] } },
    }),
    testDb.professional.create({
      data: { displayName: "Pro B", email: `prob-${stamp}@example.com`, phone: "4165550025", active: true, services: { create: [{ serviceSlug: "wallpaper" }] } },
    }),
  ]);

  await page.request.post(`${baseURL}/api/admin/jobs/${job.id}/assign`, { data: { professionalId: proA.id } });
  const reassignRes = await page.request.post(`${baseURL}/api/admin/jobs/${job.id}/assign`, {
    data: { professionalId: proB.id },
  });
  expect(reassignRes.status()).toBe(200);

  const finalJob = await testDb.job.findUnique({ where: { id: job.id } });
  expect(finalJob!.assignedProfessionalId).toBe(proB.id);

  const events = await testDb.auditEvent.findMany({
    where: { entityType: "JOB", entityId: job.id, action: { in: ["JOB_ASSIGNED", "JOB_REASSIGNED"] } },
    orderBy: { createdAt: "asc" },
  });
  expect(events).toHaveLength(2);
  expect(events[0].action).toBe("JOB_ASSIGNED");
  expect((events[0].metadata as { professionalId: string }).professionalId).toBe(proA.id);
  expect(events[1].action).toBe("JOB_REASSIGNED");
  const reassignMeta = events[1].metadata as { fromProfessionalId: string; toProfessionalId: string };
  expect(reassignMeta.fromProfessionalId).toBe(proA.id);
  expect(reassignMeta.toProfessionalId).toBe(proB.id);
});

test("status transitions: an allowed transition succeeds, an invalid one is rejected server-side", async ({
  page,
  baseURL,
}) => {
  const job = await seedJob(baseURL!, `status-${Date.now()}`, "decorative-partitions");
  expect(job.status).toBe("NEW");

  const ok = await page.request.post(`${baseURL}/api/admin/jobs/${job.id}/status`, { data: { status: "REVIEWING" } });
  expect(ok.status()).toBe(200);

  // NEW -> ASSIGNED is not an allowed direct transition (must go through REVIEWING/READY_FOR_ASSIGNMENT first)
  // but the job is now REVIEWING, so try an actually-invalid jump: REVIEWING -> COMPLETED.
  const invalid = await page.request.post(`${baseURL}/api/admin/jobs/${job.id}/status`, {
    data: { status: "COMPLETED" },
  });
  expect(invalid.status()).toBe(409);
  const invalidJson = await invalid.json();
  expect(invalidJson.code).toBe("INVALID_TRANSITION");

  const stillReviewing = await testDb.job.findUnique({ where: { id: job.id } });
  expect(stillReviewing!.status).toBe("REVIEWING");
});

test("a crafted API request cannot bypass the transition rules by sending an out-of-band status", async ({
  page,
  baseURL,
}) => {
  const job = await seedJob(baseURL!, `bypass-${Date.now()}`, "wall-panels");

  const res = await page.request.post(`${baseURL}/api/admin/jobs/${job.id}/status`, {
    data: { status: "NOT_A_REAL_STATUS" },
  });
  expect(res.status()).toBe(400);

  const untouched = await testDb.job.findUnique({ where: { id: job.id } });
  expect(untouched!.status).toBe("NEW");
});

test("cancelled jobs are terminal — no further status transition is accepted", async ({ page, baseURL }) => {
  const job = await seedJob(baseURL!, `terminal-${Date.now()}`, "marble-sheets");
  const cancel = await page.request.post(`${baseURL}/api/admin/jobs/${job.id}/status`, { data: { status: "CANCELLED" } });
  expect(cancel.status()).toBe(200);

  const revive = await page.request.post(`${baseURL}/api/admin/jobs/${job.id}/status`, { data: { status: "REVIEWING" } });
  expect(revive.status()).toBe(409);
});
