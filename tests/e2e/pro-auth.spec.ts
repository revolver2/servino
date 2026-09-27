import { test, expect } from "@playwright/test";
import { testDb } from "./helpers/db";
import { ensureActivatedProfessional, createUnactivatedProfessionalWithToken, proLogin, TEST_PRO_PASSWORD } from "./helpers/pro";

test.describe("Professional authentication — unauthenticated access", () => {
  test("unauthenticated /pro redirects to /pro/login", async ({ page, baseURL }) => {
    await page.context().clearCookies();
    await page.goto(`${baseURL}/pro`);
    await expect(page).toHaveURL(/\/pro\/login$/);
  });

  test("unauthenticated /api/pro/* mutation returns 401, not a redirect", async ({ page, baseURL }) => {
    await page.context().clearCookies();
    const res = await page.request.post(`${baseURL}/api/pro/jobs/nonexistent/accept`);
    expect(res.status()).toBe(401);
  });
});

test.describe("Professional authentication — login/logout", () => {
  test("valid login succeeds and grants access to /pro", async ({ page, baseURL }) => {
    const email = `pro-login-ok-${Date.now()}@example.com`;
    await ensureActivatedProfessional({ email });
    await page.context().clearCookies();

    const res = await proLogin(page.request, baseURL!, email);
    expect(res.status()).toBe(200);

    await page.goto(`${baseURL}/pro`);
    await expect(page).toHaveURL(/\/pro$/);
  });

  test("invalid password is rejected, no session is created", async ({ page, baseURL }) => {
    const email = `pro-login-bad-${Date.now()}@example.com`;
    await ensureActivatedProfessional({ email });
    await page.context().clearCookies();

    const res = await page.request.post(`${baseURL}/api/pro/auth/login`, {
      data: { email, password: "wrong-password-entirely" },
    });
    expect(res.status()).toBe(401);

    await page.goto(`${baseURL}/pro`);
    await expect(page).toHaveURL(/\/pro\/login$/);
  });

  test("inactive professional cannot log in even with the correct password", async ({ page, baseURL }) => {
    const email = `pro-login-inactive-${Date.now()}@example.com`;
    await ensureActivatedProfessional({ email, active: false });
    await page.context().clearCookies();

    const res = await page.request.post(`${baseURL}/api/pro/auth/login`, {
      data: { email, password: TEST_PRO_PASSWORD },
    });
    expect(res.status()).toBe(401);
  });

  test("logout revokes the session — the old cookie no longer works", async ({ page, baseURL }) => {
    const email = `pro-logout-${Date.now()}@example.com`;
    await ensureActivatedProfessional({ email });
    await page.context().clearCookies();
    await proLogin(page.request, baseURL!, email);

    await page.goto(`${baseURL}/pro`);
    await expect(page).toHaveURL(/\/pro$/);

    const logoutRes = await page.request.post(`${baseURL}/api/pro/auth/logout`);
    expect(logoutRes.status()).toBe(200);

    await page.goto(`${baseURL}/pro`);
    await expect(page).toHaveURL(/\/pro\/login$/);
  });

  test("a professional deactivated mid-session loses access even with a still-unexpired session token", async ({
    page,
    baseURL,
  }) => {
    const email = `pro-deactivated-midsession-${Date.now()}@example.com`;
    const pro = await ensureActivatedProfessional({ email });
    await page.context().clearCookies();
    await proLogin(page.request, baseURL!, email);

    await page.goto(`${baseURL}/pro`);
    await expect(page).toHaveURL(/\/pro$/);

    await testDb.professional.update({ where: { id: pro.id }, data: { active: false } });

    await page.goto(`${baseURL}/pro`);
    await expect(page).toHaveURL(/\/pro\/login$/);
  });
});

test.describe("Professional activation", () => {
  test("a valid activation token sets the password and logs the professional in", async ({ page, baseURL }) => {
    const email = `pro-activate-ok-${Date.now()}@example.com`;
    const { rawToken } = await createUnactivatedProfessionalWithToken({ email });
    await page.context().clearCookies();

    const res = await page.request.post(`${baseURL}/api/pro/auth/activate`, {
      data: { token: rawToken, password: "MyNewSecurePassword123" },
    });
    expect(res.status()).toBe(200);

    await page.goto(`${baseURL}/pro`);
    await expect(page).toHaveURL(/\/pro$/);

    // The new password now works via a fresh login too.
    await page.request.post(`${baseURL}/api/pro/auth/logout`);
    const loginRes = await page.request.post(`${baseURL}/api/pro/auth/login`, {
      data: { email, password: "MyNewSecurePassword123" },
    });
    expect(loginRes.status()).toBe(200);
  });

  test("a reused activation token is rejected on the second attempt", async ({ page, baseURL }) => {
    const email = `pro-activate-reuse-${Date.now()}@example.com`;
    const { rawToken } = await createUnactivatedProfessionalWithToken({ email });

    const first = await page.request.post(`${baseURL}/api/pro/auth/activate`, {
      data: { token: rawToken, password: "FirstPassword123456" },
    });
    expect(first.status()).toBe(200);

    const second = await page.request.post(`${baseURL}/api/pro/auth/activate`, {
      data: { token: rawToken, password: "SecondPassword123456" },
    });
    expect(second.status()).toBe(400);

    // The original password from the first (successful) activation still works.
    const loginRes = await page.request.post(`${baseURL}/api/pro/auth/login`, {
      data: { email, password: "FirstPassword123456" },
    });
    expect(loginRes.status()).toBe(200);
  });

  test("an expired activation token is rejected", async ({ page, baseURL }) => {
    const email = `pro-activate-expired-${Date.now()}@example.com`;
    const { rawToken } = await createUnactivatedProfessionalWithToken({ email, expiresInMs: -1000 });

    const res = await page.request.post(`${baseURL}/api/pro/auth/activate`, {
      data: { token: rawToken, password: "SomeValidPassword123" },
    });
    expect(res.status()).toBe(400);
  });

  test("a short password is rejected by server-side validation", async ({ page, baseURL }) => {
    const email = `pro-activate-shortpw-${Date.now()}@example.com`;
    const { rawToken } = await createUnactivatedProfessionalWithToken({ email });

    const res = await page.request.post(`${baseURL}/api/pro/auth/activate`, {
      data: { token: rawToken, password: "short" },
    });
    expect(res.status()).toBe(400);
  });

  test("a garbage token is rejected, not a 500", async ({ page, baseURL }) => {
    const res = await page.request.post(`${baseURL}/api/pro/auth/activate`, {
      data: { token: "not-a-real-token-at-all", password: "SomeValidPassword123" },
    });
    expect(res.status()).toBe(400);
  });
});

test.describe("Professional login rate limiting", () => {
  test("repeated failed logins from the same IP are eventually rate-limited", async ({ page, baseURL }) => {
    const email = `pro-brute-${Date.now()}@example.com`;
    await ensureActivatedProfessional({ email });
    const ip = "198.51.100.201"; // isolated test IP — never shared with other tests' buckets

    let sawRateLimited = false;
    for (let i = 0; i < 10; i++) {
      const res = await page.request.post(`${baseURL}/api/pro/auth/login`, {
        data: { email, password: "wrong-password" },
        headers: { "X-Forwarded-For": ip },
      });
      if (res.status() === 429) {
        sawRateLimited = true;
        break;
      }
    }
    expect(sawRateLimited).toBe(true);
  });
});
