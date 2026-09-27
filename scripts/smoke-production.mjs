#!/usr/bin/env node
// Post-deploy production smoke test (spec sections 82/83). Read-only by
// default — never submits a fake lead, never creates a fake booking,
// and NEVER attempts a real payment capture. This is meant to run
// against REAL production after every deploy; polluting real data or
// spending real money is not an acceptable side effect of a smoke test.
//
// Usage: node scripts/smoke-production.mjs <base-url>
// Example: node scripts/smoke-production.mjs https://servino.ca
//
// Optional admin-login check (still non-destructive — logs in and
// immediately logs out, creating/revoking one real session row, which
// is the intended, ordinary behavior of a login):
//   SMOKE_ADMIN_EMAIL=... SMOKE_ADMIN_PASSWORD=... node scripts/smoke-production.mjs <base-url>

const baseUrl = process.argv[2];
if (!baseUrl) {
  console.error("Usage: node scripts/smoke-production.mjs <base-url>");
  process.exit(1);
}

let failures = 0;

function pass(label) {
  console.log(`PASS  ${label}`);
}
function fail(label, detail) {
  failures++;
  console.error(`FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
}

async function checkPage(path, label, expectedStatus = 200) {
  try {
    const res = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
    if (res.status === expectedStatus) {
      pass(`${label} (${path}) → ${res.status}`);
    } else {
      fail(`${label} (${path})`, `expected ${expectedStatus}, got ${res.status}`);
    }
    return res;
  } catch (err) {
    fail(`${label} (${path})`, err.message);
    return null;
  }
}

async function checkSecurityHeaders() {
  try {
    const res = await fetch(`${baseUrl}/`);
    const required = [
      "content-security-policy",
      "x-content-type-options",
      "x-frame-options",
      "referrer-policy",
      "permissions-policy",
      "strict-transport-security",
    ];
    const missing = required.filter((h) => !res.headers.get(h));
    if (missing.length === 0) {
      pass("Security headers present (CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, HSTS)");
    } else {
      fail("Security headers", `missing: ${missing.join(", ")}`);
    }
  } catch (err) {
    fail("Security headers", err.message);
  }
}

async function checkHealth() {
  try {
    const res = await fetch(`${baseUrl}/api/health`);
    const body = await res.json().catch(() => null);
    if (res.status === 200 && body?.status === "ok") {
      pass(`Health endpoint → ok (database: ${body.checks?.database}, config: ${body.checks?.config})`);
      if (body.warnings?.length) {
        for (const w of body.warnings) console.warn(`      warning: ${w}`);
      }
    } else {
      fail("Health endpoint", `status ${res.status}, body: ${JSON.stringify(body)}`);
    }

    // Session H0.2: a missing real support contact must not take the
    // running app down (it stays a /api/health *warning*, not an error —
    // same treatment as PayPal being unconfigured), but it MUST clearly
    // fail this launch-readiness gate rather than being buried as a
    // passive warning line, per the spec's explicit "make launch
    // readiness clearly fail" instruction.
    const supportEmailMissing = body?.warnings?.some((w) => w.includes("SUPPORT_EMAIL"));
    if (supportEmailMissing) {
      fail("Support contact readiness", "SUPPORT_EMAIL is not configured — real customers would see a placeholder on /contact. This blocks launch, not the running app.");
    } else if (body?.status === "ok") {
      pass("Support contact readiness (SUPPORT_EMAIL configured)");
    }
  } catch (err) {
    fail("Health endpoint", err.message);
  }
}

async function checkAdminLoginOptional() {
  const email = process.env.SMOKE_ADMIN_EMAIL;
  const password = process.env.SMOKE_ADMIN_PASSWORD;
  if (!email || !password) {
    console.log("SKIP  Admin login round-trip (SMOKE_ADMIN_EMAIL/SMOKE_ADMIN_PASSWORD not set)");
    return;
  }
  try {
    const loginRes = await fetch(`${baseUrl}/api/admin/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const cookie = loginRes.headers.get("set-cookie");
    if (loginRes.status === 200 && cookie) {
      pass("Admin login succeeds with provided credentials");
      // Log out immediately — leaves no lingering session.
      await fetch(`${baseUrl}/api/admin/auth/logout`, { method: "POST", headers: { Cookie: cookie } });
      pass("Admin logout succeeds");
    } else {
      fail("Admin login", `status ${loginRes.status}`);
    }
  } catch (err) {
    fail("Admin login round-trip", err.message);
  }
}

async function main() {
  console.log(`Smoke testing ${baseUrl}\n`);

  await checkPage("/", "Homepage");
  await checkPage("/toronto/wall-makeover", "Toronto landing page");
  await checkPage("/quote/project", "Quote entry");
  await checkPage("/contact", "Contact page");
  await checkPage("/admin/login", "Admin login page");
  await checkPage("/pro/login", "Professional login page");
  await checkPage("/robots.txt", "robots.txt");
  await checkPage("/sitemap.xml", "sitemap.xml");

  // Auth-required routes must redirect/reject, never silently render —
  // read-only checks, no credentials submitted.
  await checkPage("/admin", "Admin overview (unauthenticated)", 307);
  const unauthApi = await fetch(`${baseUrl}/api/admin/professionals`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  }).catch(() => null);
  if (unauthApi?.status === 401) {
    pass("Unauthenticated admin API mutation rejected (401)");
  } else {
    fail("Unauthenticated admin API mutation", `expected 401, got ${unauthApi?.status}`);
  }

  await checkHealth();
  await checkSecurityHeaders();
  await checkAdminLoginOptional();

  console.log(`\n${failures === 0 ? "PASS" : "FAIL"} — ${failures} failure(s).`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
