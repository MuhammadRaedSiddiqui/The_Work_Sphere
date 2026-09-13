#!/usr/bin/env node
const puppeteer = require("puppeteer-core");

const baseUrl = process.env.PERF_BASE_URL || "http://127.0.0.1:4174";
const browserPath = process.env.PERF_BROWSER || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

(async () => {
  const browser = await puppeteer.launch({ executablePath: browserPath, headless: "new", defaultViewport: { width: 600, height: 900, isMobile: true } });
  const page = await browser.newPage();
  await page.goto(`${baseUrl}/work?view=specimen`, { waitUntil: "networkidle0" });
  const result = await page.evaluate(() => ({
    specimenTab: Boolean(document.getElementById("work-specimen-tab")),
    specimenHost: Boolean(document.querySelector(".work-specimen-stage")),
    workCanvas: Boolean(document.querySelector(".work-specimen-stage canvas")),
  }));
  await browser.close();
  console.log(JSON.stringify(result));
  if (result.specimenTab || result.specimenHost || result.workCanvas) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exitCode = 1; });
