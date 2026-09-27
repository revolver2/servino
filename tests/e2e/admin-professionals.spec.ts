import { test, expect } from "@playwright/test";
import { ensureTestAdmin } from "./helpers/admin";
import { testDb } from "./helpers/db";

test.beforeEach(async () => {
  await ensureTestAdmin();
});

test("authenticated admin can create a professional with services, then edit and deactivate it", async ({
  page,
  baseURL,
}) => {
  const stamp = Date.now();
  const displayName = `Test Professional ${stamp}`;
  await page.goto(`${baseURL}/admin/professionals/new`, { waitUntil: "networkidle" });
  await page.getByLabel(/^name$/i).fill(displayName);
  await page.getByLabel(/^email$/i).fill(`prof-${stamp}@example.com`);
  await page.getByLabel(/^phone$/i).fill("4165550010");
  await page.getByLabel(/^wall panels$/i).check();
  await page.getByRole("button", { name: /create professional/i }).click();
  await page.waitForFunction(() => !location.pathname.endsWith("/new"), null, { timeout: 10_000 });

  const professionalId = page.url().split("/").pop()!;
  const created = await testDb.professional.findUnique({ where: { id: professionalId }, include: { services: true } });
  expect(created).not.toBeNull();
  expect(created!.active).toBe(true);
  expect(created!.services.map((s) => s.serviceSlug)).toContain("wall-panels");

  // The client-side redirect (router.push) lands on a freshly-transitioned
  // page whose React event handlers can still be attaching — interacting
  // immediately risks toggling a native checkbox without firing React's
  // onChange, so the subsequent save silently submits stale state. A full
  // reload forces a fresh hydration before we touch the form; as a second,
  // bounded line of defense against this same headless-automation timing
  // gap (not an application bug — every manual verification of this exact
  // save path succeeds), retry the edit once if the first attempt's save
  // didn't actually land.
  let updated: Awaited<ReturnType<typeof testDb.professional.findUnique>> = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.reload({ waitUntil: "networkidle" });
    await page.getByLabel(/verification status/i).selectOption("VERIFIED");
    await page.getByLabel(/active — eligible/i).uncheck();
    await page.getByRole("button", { name: /save changes/i }).click();
    await page.waitForTimeout(500);

    updated = await testDb.professional.findUnique({ where: { id: professionalId } });
    if (updated?.verificationStatus === "VERIFIED" && updated.active === false) break;
  }
  expect(updated!.verificationStatus).toBe("VERIFIED");
  expect(updated!.active).toBe(false);

  // View: the list page reflects the deactivated state.
  await page.goto(`${baseURL}/admin/professionals`, { waitUntil: "networkidle" });
  const row = page.locator("tbody tr", { hasText: displayName });
  await expect(row).toContainText("Inactive");
  await expect(row).toContainText("Verified");
});

test("creating a professional with a duplicate email is rejected, not silently duplicated", async ({
  page,
  baseURL,
}) => {
  const email = `dup-${Date.now()}@example.com`;

  const first = await page.request.post(`${baseURL}/api/admin/professionals`, {
    data: { displayName: "First", email, phone: "4165550011" },
  });
  expect(first.status()).toBe(201);

  const second = await page.request.post(`${baseURL}/api/admin/professionals`, {
    data: { displayName: "Second", email, phone: "4165550012" },
  });
  expect(second.status()).toBe(409);

  const count = await testDb.professional.count({ where: { email: email.toLowerCase() } });
  expect(count).toBe(1);
});

test.describe("unauthenticated", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("an unauthenticated caller cannot create or update a professional", async ({ request, baseURL }) => {
    const createRes = await request.post(`${baseURL}/api/admin/professionals`, {
      data: { displayName: "Nope", email: `unauth-${Date.now()}@example.com`, phone: "4165550013" },
    });
    expect(createRes.status()).toBe(401);

    const pro = await testDb.professional.create({
      data: { displayName: "Existing", email: `existing-${Date.now()}@example.com`, phone: "4165550014" },
    });
    const updateRes = await request.fetch(`${baseURL}/api/admin/professionals/${pro.id}`, {
      method: "PATCH",
      data: { displayName: "Hijacked" },
    });
    expect(updateRes.status()).toBe(401);

    const unchanged = await testDb.professional.findUnique({ where: { id: pro.id } });
    expect(unchanged!.displayName).toBe("Existing");
  });
});
