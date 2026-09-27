import { test, expect } from "@playwright/test";
import { apiPost } from "./helpers/api";
import { testDb } from "./helpers/db";

/**
 * The server must remain financially authoritative (spec section 6/9 of
 * this phase). These tests talk to the API directly — bypassing the UI
 * entirely — because that's the actual attack surface: anything a real
 * attacker could do with a browser's dev tools or a raw HTTP client.
 */

async function buildLeadToPriceViewed(baseURL: string, sessionId: string) {
  await apiPost(baseURL, "/api/lead/progress", {
    sessionId,
    serviceSlug: "wall-panels",
    postalCode: "M5V 2T6",
    measurementUnit: "METRIC",
    totalAreaM2: 10,
    styleId: "black",
    materialOwnership: "INSTALL_ONLY",
    currentStep: "PRICE",
  });
  return apiPost(baseURL, "/api/lead/price", { sessionId });
}

test("injecting a fake total/subtotal into the price request is ignored", async ({ baseURL }) => {
  const sessionId = `phase-c-price-inject-${Date.now()}`;
  const result = await buildLeadToPriceViewed(baseURL!, sessionId);

  expect(result.status).toBe(200);
  const data = result.json as { ok: true; data: { price: { totalMinor: number; subtotalMinor: number } } };
  // wall-panels install-only @ 8500/m2 * 10m2 = 85000, min 45000 doesn't apply, tax 13% = 11050, total 96050
  expect(data.data.price.subtotalMinor).toBe(85000);
  expect(data.data.price.totalMinor).toBe(96050);

  // Now retry the SAME endpoint while attempting to smuggle a fake total —
  // the endpoint only accepts { sessionId } (see src/lib/server/schemas.ts
  // priceSchema) so extra fields are structurally inert, but assert the
  // actual behavior, not just the schema.
  const tampered = await apiPost(baseURL!, "/api/lead/price", {
    sessionId,
    totalMinor: 1,
    subtotalMinor: 1,
    taxMinor: 0,
    total: "$0.01",
    price: 1,
  });
  const tamperedData = tampered.json as { ok: true; data: { price: { totalMinor: number } } };
  expect(tamperedData.data.price.totalMinor).toBe(96050);
});

test("booking-intent cannot be pointed at a forged quoteSnapshotId", async ({ baseURL }) => {
  const sessionId = `phase-c-booking-inject-${Date.now()}`;
  await buildLeadToPriceViewed(baseURL!, sessionId);
  await apiPost(baseURL!, "/api/lead/contact", {
    sessionId,
    firstName: "Test",
    email: "inject-test@example.com",
    phone: "4165551234",
    formRenderedAt: new Date(Date.now() - 5000).toISOString(),
  });
  await apiPost(baseURL!, "/api/lead/timing", { sessionId, value: "ASAP" });

  const result = await apiPost(baseURL!, "/api/lead/booking-intent", {
    sessionId,
    quoteSnapshotId: "totally-fake-snapshot-id-belonging-to-someone-else",
  });
  expect(result.status).toBe(201);

  const data = result.json as { ok: true; data: { bookingIntentId: string } };
  const bookingIntent = await testDb.bookingIntent.findUnique({
    where: { id: data.data.bookingIntentId },
    include: { quoteSnapshot: true },
  });
  // The snapshot actually referenced must belong to THIS lead's own real
  // price computation, never the forged id.
  expect(bookingIntent!.quoteSnapshot.id).not.toBe("totally-fake-snapshot-id-belonging-to-someone-else");
  const lead = await testDb.lead.findUnique({ where: { sessionId } });
  expect(bookingIntent!.quoteSnapshot.leadId).toBe(lead!.id);
});

test("changing lead inputs after a price snapshot does not mutate the frozen snapshot", async ({ baseURL }) => {
  const sessionId = `phase-c-snapshot-immutable-${Date.now()}`;
  const first = await buildLeadToPriceViewed(baseURL!, sessionId);
  const firstData = first.json as { ok: true; data: { snapshotId: string; price: { totalMinor: number } } };
  const originalSnapshotId = firstData.data.snapshotId;
  const originalTotal = firstData.data.price.totalMinor;

  // Change the lead's area — simulates a customer going back and editing
  // measurements after having already seen a price.
  await apiPost(baseURL!, "/api/lead/progress", {
    sessionId,
    totalAreaM2: 999,
    currentStep: "PRICE",
  });

  const frozen = await testDb.quoteSnapshot.findUnique({ where: { id: originalSnapshotId } });
  expect(frozen!.totalMinor).toBe(originalTotal);
  expect(Number(frozen!.totalAreaM2)).toBe(10); // still the original area, not 999
});

test("price computation is deterministic — same inputs always produce the same money", async ({ baseURL }) => {
  const sessionId = `phase-c-determinism-${Date.now()}`;
  await apiPost(baseURL!, "/api/lead/progress", {
    sessionId,
    serviceSlug: "wallpaper",
    postalCode: "M4B 1B3",
    measurementUnit: "METRIC",
    totalAreaM2: 6.37,
    styleId: "neutral",
    materialOwnership: "MATERIAL_AND_INSTALL",
    currentStep: "PRICE",
  });

  const [r1, r2, r3] = await Promise.all([
    apiPost(baseURL!, "/api/lead/price", { sessionId }),
    apiPost(baseURL!, "/api/lead/price", { sessionId }),
    apiPost(baseURL!, "/api/lead/price", { sessionId }),
  ]);
  type PriceResp = {
    ok: true;
    data: { price: { subtotalMinor: number; taxMinor: number; totalMinor: number; generatedAt: string } };
  };
  const prices = [r1, r2, r3].map((r) => (r.json as PriceResp).data.price);

  for (const p of prices) {
    expect(p.subtotalMinor + p.taxMinor).toBe(p.totalMinor);
    expect(Number.isInteger(p.subtotalMinor)).toBe(true);
    expect(Number.isInteger(p.taxMinor)).toBe(true);
    expect(Number.isInteger(p.totalMinor)).toBe(true);
  }
  // Deterministic: identical inputs produce identical money every time.
  // `generatedAt` legitimately differs per call (real timestamp) — compare
  // everything else.
  const stripTimestamp = (p: (typeof prices)[number]) => {
    const { generatedAt, ...rest } = p;
    void generatedAt;
    return rest;
  };
  expect(stripTimestamp(prices[0])).toEqual(stripTimestamp(prices[1]));
  expect(stripTimestamp(prices[1])).toEqual(stripTimestamp(prices[2]));
});

test("concurrent booking-intent submissions for the same lead resolve to one row", async ({ baseURL }) => {
  const sessionId = `phase-c-concurrent-${Date.now()}`;
  await buildLeadToPriceViewed(baseURL!, sessionId);
  await apiPost(baseURL!, "/api/lead/contact", {
    sessionId,
    firstName: "Concurrent",
    email: "concurrent@example.com",
    phone: "4165559999",
    formRenderedAt: new Date(Date.now() - 5000).toISOString(),
  });
  await apiPost(baseURL!, "/api/lead/timing", { sessionId, value: "ASAP" });

  const [a, b, c] = await Promise.all([
    apiPost(baseURL!, "/api/lead/booking-intent", { sessionId }),
    apiPost(baseURL!, "/api/lead/booking-intent", { sessionId }),
    apiPost(baseURL!, "/api/lead/booking-intent", { sessionId }),
  ]);
  type BiResp = { ok: true; data: { bookingIntentId: string } };
  const ids = [a, b, c].map((r) => (r.json as BiResp).data.bookingIntentId);
  expect(ids[0]).toBe(ids[1]);
  expect(ids[1]).toBe(ids[2]);

  const lead = await testDb.lead.findUnique({ where: { sessionId } });
  const count = await testDb.bookingIntent.count({ where: { leadId: lead!.id } });
  expect(count).toBe(1);
});

test("honeypot-tripped contact submission persists nothing", async ({ baseURL }) => {
  const sessionId = `phase-c-honeypot-${Date.now()}`;
  await buildLeadToPriceViewed(baseURL!, sessionId);

  const result = await apiPost(baseURL!, "/api/lead/contact", {
    sessionId,
    firstName: "Bot",
    email: "bot-phase-c@example.com",
    phone: "4165550000",
    honeypot: "filled in by an automated script",
  });
  expect(result.status).toBe(200);

  const lead = await testDb.lead.findUnique({ where: { sessionId }, include: { contact: true } });
  expect(lead!.contact).toBeNull();
  const rows = await testDb.contactInfo.findMany({ where: { email: "bot-phase-c@example.com" } });
  expect(rows.length).toBe(0);
});
