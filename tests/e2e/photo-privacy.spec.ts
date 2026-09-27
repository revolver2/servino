import path from "node:path";
import { test, expect } from "@playwright/test";
import * as funnel from "./helpers/funnel";

const PHOTO = path.join(__dirname, "fixtures", "test-photo.png");

/**
 * Session H0.2 — verifies the actual (not assumed) photo behavior: a
 * photo added on /quote/photo is a local, in-browser preview only and
 * is never transmitted anywhere. Ground truth was confirmed by code
 * inspection (no API route, schema field, or fetch call anywhere in the
 * codebase references a photo payload) — this test verifies it holds at
 * the network level too, so a future change can't silently start
 * uploading it without a test catching it.
 */
test("an added photo is never sent over the network, in any request", async ({ page }) => {
  const requestBodies: string[] = [];
  page.on("request", (req) => {
    const data = req.postData();
    if (data) requestBodies.push(data);
  });

  await page.goto("/quote/project");
  await funnel.selectService(page, "Wall Panels");
  await funnel.enterLocation(page, "M5V 2T6");
  await page.waitForURL("**/quote/measurements");
  await funnel.fillWall(page, 0, "3", "2.5");
  await page.click('button:has-text("Continue")');
  await page.waitForURL("**/quote/photo");

  await funnel.uploadPhoto(page, PHOTO);

  // The preview must render locally (proves the file was read client-side)...
  await expect(page.locator('img[alt="Your uploaded wall"]')).toBeVisible();

  await page.click('button:has-text("Continue")');
  await page.waitForURL("**/quote/style");

  // ...but no outgoing request body anywhere in this flow may contain
  // multipart/binary image data or a base64-encoded PNG payload.
  for (const body of requestBodies) {
    expect(body).not.toMatch(/Content-Type:\s*image\//i);
    expect(body).not.toMatch(/^data:image\//i);
    expect(body.length).toBeLessThan(50_000); // no request should carry an ~image-sized payload
  }

  // The progress-save payload itself has no photo-shaped field at all.
  for (const body of requestBodies) {
    if (!body.startsWith("{")) continue;
    const parsed = JSON.parse(body);
    expect(parsed).not.toHaveProperty("photo");
    expect(parsed).not.toHaveProperty("photoUrl");
    expect(parsed).not.toHaveProperty("fileData");
  }
});
