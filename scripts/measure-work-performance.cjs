#!/usr/bin/env node
/* Reproducible local benchmark. Results describe the machine and browser used. */
const fs = require("node:fs");
const path = require("node:path");
const puppeteer = require("puppeteer-core");

const baseUrl = process.env.PERF_BASE_URL || "http://127.0.0.1:4173";
const browserPath = process.env.PERF_BROWSER || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const outputPath = path.resolve(__dirname, "..", "performance-baseline.json");

async function frameSample(page, durationMs = 1800) {
  return page.evaluate(async (duration) => new Promise((resolve) => {
    const samples = [];
    let previous = 0;
    let until = 0;
    const tick = (now) => {
      if (previous === 0) {
        previous = now;
        until = now + duration;
        requestAnimationFrame(tick);
        return;
      }
      samples.push(now - previous);
      previous = now;
      if (now < until) requestAnimationFrame(tick);
      else {
        samples.sort((a, b) => a - b);
        const percentile = (fraction) => samples[Math.min(samples.length - 1, Math.floor(samples.length * fraction))];
        resolve({ frames: samples.length, averageMs: samples.reduce((sum, value) => sum + value, 0) / samples.length, p95Ms: percentile(0.95), worstMs: samples[samples.length - 1] });
      }
    };
    requestAnimationFrame(tick);
  }), durationMs);
}

async function main() {
  const browser = await puppeteer.launch({ executablePath: browserPath, headless: "new", defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 } });
  const page = await browser.newPage();
  page.setDefaultTimeout(8000);
  await page.evaluateOnNewDocument(() => {
    window.__perfLcp = 0;
    new PerformanceObserver((entries) => {
      const last = entries.getEntries().at(-1);
      if (last) window.__perfLcp = last.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
  });
  const go = async (url) => {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    // Vite's development WebSocket intentionally prevents networkidle0.
    await new Promise((resolve) => setTimeout(resolve, 1800));
  };

  console.log("[perf] sphere idle");
  await go(`${baseUrl}/`);
  await page.waitForSelector("canvas");
  const idle = await frameSample(page);
  await page.evaluate(() => window.scrollTo(0, window.innerHeight * 2));
  await new Promise((resolve) => setTimeout(resolve, 500));
  const aboutFlight = await frameSample(page);

  console.log("[perf] specimen detach");
  await go(`${baseUrl}/work?view=specimen`);
  await page.waitForSelector(".work-specimen-stage canvas");
  const stage = await page.$(".work-specimen-stage");
  const box = await stage.boundingBox();
  if (!box) throw new Error("Specimen stage has no layout box.");
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
  const detach = await frameSample(page);

  console.log("[perf] view transition");
  await go(`${baseUrl}/work`);
  await page.waitForSelector("#work-specimen-tab");
  await page.click("#work-specimen-tab");
  const viewTransition = await frameSample(page, 900);

  const navigation = await page.evaluate(() => {
    const resources = performance.getEntriesByType("resource");
    return {
      initialPayloadBytes: resources.reduce((total, entry) => total + entry.transferSize, 0),
      lcpMs: window.__perfLcp || null,
      userAgent: navigator.userAgent,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
    };
  });
  const results = { measuredAt: new Date().toISOString(), baseUrl, ...navigation, frameTime: { sphereIdle: idle, aboutMidFlight: aboutFlight, specimenDetach: detach, viewTransition } };
  fs.writeFileSync(outputPath, `${JSON.stringify(results, null, 2)}\n`);
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
