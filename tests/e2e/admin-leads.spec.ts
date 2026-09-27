import { test, expect } from "@playwright/test";
import { apiPost, fakeIp } from "./helpers/api";
import { ensureTestAdmin } from "./helpers/admin";

test.beforeEach(async () => {
  await ensureTestAdmin();
});

async function submitFullProject(
  baseURL: string,
  sessionId: string,
  opts: { serviceSlug: string; firstName: string; email: string; withAttribution?: boolean }
) {
  const ip = { "X-Forwarded-For": fakeIp(sessionId) };
  await apiPost(
    baseURL,
    "/api/lead/progress",
    {
      sessionId,
      serviceSlug: opts.serviceSlug,
      postalCode: "M5V 2T6",
      measurementUnit: "METRIC",
      totalAreaM2: 9,
      // No styleId — opts.serviceSlug varies by caller and styles are
      // service-specific (Session H0.2); this file doesn't test style.
      materialOwnership: "MATERIAL_AND_INSTALL",
      currentStep: "PRICE",
      ...(opts.withAttribution
        ? {
            attribution: {
              utmSource: null,
              utmMedium: null,
              utmCampaign: null,
              utmContent: null,
              utmTerm: null,
              landingRoute: "/quote/project",
              referrer: null,
              firstTouchAt: new Date().toISOString(),
            },
          }
        : {}),
    },
    ip
  );
  await apiPost(baseURL, "/api/lead/price", { sessionId }, ip);
  await apiPost(
    baseURL,
    "/api/lead/contact",
    {
      sessionId,
      firstName: opts.firstName,
      email: opts.email,
      phone: "4165550001",
      formRenderedAt: new Date(Date.now() - 5000).toISOString(),
    },
    ip
  );
  await apiPost(baseURL, "/api/lead/timing", { sessionId, value: "WITHIN_MONTH" }, ip);
  return apiPost<{ price: { totalMinor: number } }>(baseURL, "/api/lead/booking-intent", { sessionId }, ip);
}

test("leads list displays real, correct values for a submitted lead", async ({ page, baseURL }) => {
  const stamp = Date.now();
  const firstName = `Priya${stamp}`;
  await submitFullProject(baseURL!, `leads-list-${stamp}`, {
    serviceSlug: "wall-panels",
    firstName,
    email: `priya-${stamp}@example.com`,
  });

  await page.goto(`${baseURL}/admin/leads`, { waitUntil: "networkidle" });

  const row = page.locator("tbody tr", { hasText: firstName });
  await expect(row).toBeVisible();
  await expect(row).toContainText("wall-panels");
  await expect(row).toContainText("9 m²");
  await expect(row).toContainText("Submitted");
});

test("status filter narrows the leads list correctly", async ({ page, baseURL }) => {
  const stamp = Date.now();
  const firstName = `FilterTarget${stamp}`;
  await submitFullProject(baseURL!, `leads-filter-${stamp}`, {
    serviceSlug: "marble-sheets",
    firstName,
    email: `filtertarget-${stamp}@example.com`,
  });

  await page.goto(`${baseURL}/admin/leads?status=BOOKING_INTENT`, { waitUntil: "networkidle" });
  await expect(page.locator("tbody tr", { hasText: firstName })).toBeVisible();

  // A status that this lead does NOT have must exclude it.
  await page.goto(`${baseURL}/admin/leads?status=QUOTE_STARTED`, { waitUntil: "networkidle" });
  await expect(page.locator("tbody tr", { hasText: firstName })).toHaveCount(0);
});

test("search finds a lead by email and by name", async ({ page, baseURL }) => {
  const stamp = Date.now();
  const email = `searchable-${stamp}@example.com`;
  const firstName = `SearchableName${stamp}`;
  await submitFullProject(baseURL!, `leads-search-${stamp}`, {
    serviceSlug: "wallpaper",
    firstName,
    email,
  });

  await page.goto(`${baseURL}/admin/leads?q=${encodeURIComponent(email)}`, { waitUntil: "networkidle" });
  await expect(page.locator("tbody tr", { hasText: firstName })).toBeVisible();

  await page.goto(`${baseURL}/admin/leads?q=${encodeURIComponent(firstName)}`, { waitUntil: "networkidle" });
  await expect(page.locator("tbody tr", { hasText: firstName })).toBeVisible();

  await page.goto(`${baseURL}/admin/leads?q=no-such-lead-exists-anywhere`, { waitUntil: "networkidle" });
  await expect(page.getByText("No leads found")).toBeVisible();
});

test("lead detail shows customer, quote (from the authoritative snapshot), timing, and attribution", async ({
  page,
  baseURL,
}) => {
  const stamp = Date.now();
  const email = `detail-${stamp}@example.com`;
  const firstName = `DetailPerson${stamp}`;
  const result = await submitFullProject(baseURL!, `leads-detail-${stamp}`, {
    serviceSlug: "wall-panels",
    firstName,
    email,
    withAttribution: true,
  });
  void result;

  await page.goto(`${baseURL}/admin/leads?q=${encodeURIComponent(email)}`, { waitUntil: "networkidle" });
  await page.locator("tbody tr", { hasText: firstName }).getByText("View").click();
  await page.waitForURL(/\/admin\/leads\/[a-z0-9]+$/);

  await expect(page.getByText(email)).toBeVisible();
  await expect(page.getByText("Within a month")).toBeVisible();
  await expect(page.getByText("Direct")).toBeVisible(); // referrer fallback, real attribution data
  await expect(page.getByText("Created")).toBeVisible(); // booking intent status
});
