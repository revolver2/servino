import type { Page } from "@playwright/test";

export async function selectService(page: Page, name: string) {
  await page.click(`button:has-text("${name}")`);
}

export async function enterLocation(page: Page, postalCode: string) {
  await page.fill("#postal-code", postalCode);
  await page.click('button:has-text("Continue")');
}

export async function fillWall(page: Page, index: number, width: string, height: string) {
  const widths = await page.$$('input[id^="width-"]');
  const heights = await page.$$('input[id^="height-"]');
  await widths[index].fill(width);
  await heights[index].fill(height);
}

export async function addWall(page: Page) {
  await page.click('button:has-text("+ Add another wall")');
}

export async function skipPhoto(page: Page) {
  await page.click('button:has-text("Skip for now")');
}

export async function uploadPhoto(page: Page, filePath: string) {
  await page.setInputFiles('input[type="file"]', filePath);
  await page.waitForSelector('img[alt="Your uploaded wall"]');
}

export async function selectStyleAndMaterial(page: Page, style: string, materialLabel: string) {
  await page.click(`button:has-text("${style}")`);
  await page.click(`button:has-text("${materialLabel}")`);
}

export async function fillContact(page: Page, firstName: string, email: string, phone: string) {
  await page.fill("#firstName", firstName);
  await page.fill("#email", email);
  await page.fill("#phone", phone);
  await page.click('button[type="submit"]');
}

export async function selectTimingAndSubmit(page: Page, label: string) {
  await page.click(`button:has-text("${label}")`);
  await page.click('button:has-text("Submit My Project")');
}
