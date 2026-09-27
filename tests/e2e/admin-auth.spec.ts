import { test, expect } from "@playwright/test";
import { ensureTestAdmin, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } from "./helpers/admin";

test.beforeEach(async () => {
  await ensureTestAdmin();
});

test.describe("unauthenticated", () => {
  // Every test elsewhere in the suite starts pre-authenticated via the
  // shared storageState (see global-setup.ts) — these specifically need
  // to start with NO session to test the actual gate.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("unauthenticated browser request to /admin redirects to the login page", async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/admin`, { waitUntil: "networkidle" });
    expect(page.url()).toBe(`${baseURL}/admin/login`);
  });

  test("unauthenticated request to a nested admin page also redirects to login", async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/admin/leads`, { waitUntil: "networkidle" });
    expect(page.url()).toBe(`${baseURL}/admin/login`);
  });

  test("unauthenticated admin API mutation is rejected with 401, not silently accepted", async ({
    request,
    baseURL,
  }) => {
    const res = await request.post(`${baseURL}/api/admin/professionals`, {
      data: { displayName: "Should Not Exist", email: "nope@example.com", phone: "4165550000" },
    });
    expect(res.status()).toBe(401);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.code).toBe("UNAUTHORIZED");
  });

  test("logout works and the protected page is inaccessible immediately after logging back in and out", async ({
    page,
    baseURL,
  }) => {
    const login = await page.request.post(`${baseURL}/api/admin/auth/login`, {
      data: { email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD },
    });
    expect(login.status()).toBe(200);
    await page.goto(`${baseURL}/admin`, { waitUntil: "networkidle" });
    expect(page.url()).toBe(`${baseURL}/admin`);

    const logoutRes = await page.request.post(`${baseURL}/api/admin/auth/logout`);
    expect(logoutRes.status()).toBe(200);

    await page.goto(`${baseURL}/admin`, { waitUntil: "networkidle" });
    expect(page.url()).toBe(`${baseURL}/admin/login`);
  });
});

test("invalid login (wrong password) is rejected, real account still exists", async ({ request, baseURL }) => {
  const res = await request.post(`${baseURL}/api/admin/auth/login`, {
    data: { email: TEST_ADMIN_EMAIL, password: "definitely-the-wrong-password" },
  });
  expect(res.status()).toBe(401);
  const json = await res.json();
  expect(json.ok).toBe(false);
  expect(json.code).toBe("UNAUTHORIZED");
  // Message must not distinguish "no such user" from "wrong password".
  expect(json.message).toBe("Invalid email or password.");
});

test("invalid login (unknown email) returns the identical generic message", async ({ request, baseURL }) => {
  const res = await request.post(`${baseURL}/api/admin/auth/login`, {
    data: { email: "nobody-here@servino.local", password: "whatever-12345" },
  });
  expect(res.status()).toBe(401);
  const json = await res.json();
  expect(json.message).toBe("Invalid email or password.");
});

test("valid admin login works and grants access to the protected area", async ({ page, baseURL }) => {
  const res = await page.request.post(`${baseURL}/api/admin/auth/login`, {
    data: { email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD },
  });
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.ok).toBe(true);
  expect(json.data.email).toBe(TEST_ADMIN_EMAIL);

  await page.goto(`${baseURL}/admin`, { waitUntil: "networkidle" });
  expect(page.url()).toBe(`${baseURL}/admin`);
  await expect(page.locator("h1")).toHaveText("Overview");
});

test("an already-authenticated admin visiting /admin/login is redirected straight to the overview", async ({
  page,
  baseURL,
}) => {
  // Relies on the default authenticated storageState — no explicit login call needed.
  await page.goto(`${baseURL}/admin/login`, { waitUntil: "networkidle" });
  expect(page.url()).toBe(`${baseURL}/admin`);
});

test("admin login is rate-limited after repeated failed attempts", async ({ request, baseURL }) => {
  // clientIp() reads X-Forwarded-For (src/lib/server/rate-limit.ts) — spoofing
  // a unique value here isolates this test's rate-limit bucket from every
  // other test in this suite, which all share the real "unknown"/loopback
  // bucket. Without this, exhausting the login rate limit here would lock
  // every later test in the same worker out of logging in for the rest of
  // the 5-minute window.
  const fakeIp = `203.0.113.${Math.floor(Math.random() * 254) + 1}`;
  const attempts = Array.from({ length: 12 }, () =>
    request.post(`${baseURL}/api/admin/auth/login`, {
      headers: { "X-Forwarded-For": fakeIp },
      data: { email: TEST_ADMIN_EMAIL, password: "wrong-again" },
    })
  );
  const results = await Promise.all(attempts);
  const statuses = results.map((r) => r.status());
  expect(statuses).toContain(429);
});
