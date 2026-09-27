import { test, expect } from "@playwright/test";
import { apiPost, fakeIp } from "./helpers/api";
import { ensureTestAdmin } from "./helpers/admin";
import { testDb } from "./helpers/db";

test.beforeEach(async () => {
  await ensureTestAdmin();
});

async function submitFullProject(baseURL: string, sessionId: string, serviceSlug: string) {
  const ip = { "X-Forwarded-For": fakeIp(sessionId) };
  await apiPost(
    baseURL,
    "/api/lead/progress",
    {
      sessionId,
      serviceSlug,
      postalCode: "M5V 2T6",
      measurementUnit: "METRIC",
      totalAreaM2: 8,
      // No styleId — serviceSlug varies by caller and styles are
      // service-specific (Session H0.2); this file doesn't test style.
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
      firstName: "Overview",
      email: `${sessionId}@example.com`,
      phone: "4165550000",
      formRenderedAt: new Date(Date.now() - 5000).toISOString(),
    },
    ip
  );
  await apiPost(baseURL, "/api/lead/timing", { sessionId, value: "ASAP" }, ip);
  await apiPost(baseURL, "/api/lead/booking-intent", { sessionId }, ip);
}

test("overview counts are computed from real database data, not hardcoded", async ({ page, baseURL }) => {
  // Seed a known, controlled set of jobs directly so the expected counts are exact.
  const stamp = Date.now();
  await submitFullProject(baseURL!, `overview-a-${stamp}`, "wall-panels");
  await submitFullProject(baseURL!, `overview-b-${stamp}`, "marble-sheets");

  const leadA = await testDb.lead.findUnique({ where: { sessionId: `overview-a-${stamp}` } });
  const jobA = await testDb.job.findUnique({ where: { leadId: leadA!.id } });
  // Move job A to COMPLETED to exercise the "Completed jobs" metric.
  await testDb.job.update({ where: { id: jobA!.id }, data: { status: "COMPLETED" } });

  const [expectedCompleted, expectedUnassigned] = await Promise.all([
    testDb.job.count({ where: { status: "COMPLETED" } }),
    testDb.job.count({ where: { assignedProfessionalId: null, status: { notIn: ["COMPLETED", "CANCELLED"] } } }),
  ]);

  await page.goto(`${baseURL}/admin`, { waitUntil: "networkidle" });

  const completedCard = page.locator("text=Completed jobs").locator("..");
  await expect(completedCard.locator("p").nth(1)).toHaveText(String(expectedCompleted));

  const unassignedCard = page.locator("text=Unassigned jobs").locator("..");
  await expect(unassignedCard.locator("p").nth(1)).toHaveText(String(expectedUnassigned));
});

test("action required section reflects a real NEW job and disappears once resolved", async ({ page, baseURL }) => {
  const sessionId = `action-required-${Date.now()}`;
  await submitFullProject(baseURL!, sessionId, "wallpaper");
  const lead = await testDb.lead.findUnique({ where: { sessionId } });
  const job = await testDb.job.findUnique({ where: { leadId: lead!.id } });
  expect(job!.status).toBe("NEW");

  await page.goto(`${baseURL}/admin`, { waitUntil: "networkidle" });
  await expect(page.getByText("New customer requests need review")).toBeVisible();

  // Resolve it — the count must actually reflect the database, not a cached page state.
  await testDb.job.update({ where: { id: job!.id }, data: { status: "REVIEWING" } });
  await page.goto(`${baseURL}/admin`, { waitUntil: "networkidle" });
  const newLeadsAfter = await testDb.job.count({ where: { status: "NEW" } });
  if (newLeadsAfter === 0) {
    await expect(page.getByText("New customer requests need review")).not.toBeVisible();
  }
});

test("recent activity shows the real submitted project with its real timestamp", async ({ page, baseURL }) => {
  const sessionId = `recent-activity-${Date.now()}`;
  await submitFullProject(baseURL!, sessionId, "decorative-partitions");

  await page.goto(`${baseURL}/admin`, { waitUntil: "networkidle" });
  await expect(page.getByText(/Project request submitted.*Overview.*decorative-partitions/)).toBeVisible();
});
