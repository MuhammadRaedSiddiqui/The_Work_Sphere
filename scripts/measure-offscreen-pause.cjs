#!/usr/bin/env node
const puppeteer = require("puppeteer-core");
const baseUrl = process.env.PERF_BASE_URL || "http://127.0.0.1:4174";
const browserPath = process.env.PERF_BROWSER || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

(async () => {
  const browser = await puppeteer.launch({ executablePath: browserPath, headless: "new", defaultViewport: { width: 1440, height: 900 } });
  const page = await browser.newPage();
  await page.goto(baseUrl, { waitUntil: "networkidle0" });
  await page.waitForFunction(() => Boolean(window.__sceneLifecycle));
  await page.evaluate(() => document.getElementById("work")?.scrollIntoView());
  await new Promise((resolve) => setTimeout(resolve, 400));
  const before = await page.evaluate(() => window.__sceneLifecycle.getDiagnostics());
  await new Promise((resolve) => setTimeout(resolve, 1200));
  const after = await page.evaluate(() => window.__sceneLifecycle.getDiagnostics());
  const result = { before, after, updateDelta: after.updateCount - before.updateCount };
  console.log(JSON.stringify(result));
  await browser.close();
  if (result.after.rafActive || result.updateDelta !== 0) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exitCode = 1; });
