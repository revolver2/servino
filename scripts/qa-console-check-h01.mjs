import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "http://localhost:3000";
const pages = ["/", "/toronto/wall-makeover", "/quote/project", "/privacy", "/terms", "/contact"];

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  const messages = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      messages.push({ url: page.url(), type: msg.type(), text: msg.text() });
    }
  });
  page.on("pageerror", (err) => {
    messages.push({ url: page.url(), type: "pageerror", text: err.message });
  });

  for (const p of pages) {
    await page.goto(`${BASE}${p}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
  }

  console.log(JSON.stringify(messages, null, 2));
  await browser.close();
}
main();
