#!/usr/bin/env node
const puppeteer = require("puppeteer-core");

const baseUrl = process.env.CLOSE_BASE_URL || "http://127.0.0.1:4191";
const browserPath = process.env.PERF_BROWSER || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const viewport = { width: 1280, height: 720 };

const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function anchorResult(browser, reducedMotion) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  if (reducedMotion) await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await page.goto(`${baseUrl}/#close`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#close");
  await pause(700);
  const direct = await page.evaluate(() => {
    const rect = document.getElementById("close").getBoundingClientRect();
    return {
      targetTop: Math.round(rect.top),
      pinActive: Boolean(document.querySelector(".pin-spacer")),
      reducedMotion: document.querySelector(".closing-section").classList.contains("reduce-motion"),
    };
  });

  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("a");
  await page.evaluate(() => {
    const link = [...document.querySelectorAll("a")].find((element) => element.getAttribute("href") === "#close");
    if (!link) throw new Error("Availability link was not found.");
    link.click();
  });
  await pause(700);
  const clickTargetTop = await page.evaluate(() => Math.round(document.getElementById("close").getBoundingClientRect().top));
  await page.close();
  return { direct, clickTargetTop };
}

async function revealResult(browser) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#close");
  const setVisibility = async (ratio) => {
    await page.evaluate((targetRatio) => {
      const section = document.getElementById("close");
      const absoluteTop = section.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, absoluteTop - window.innerHeight + section.offsetHeight * targetRatio);
    }, ratio);
    await pause(100);
    return page.evaluate(() => document.getElementById("close").classList.contains("is-revealed"));
  };

  const belowBeforeDelay = await setVisibility(0.54);
  await pause(600);
  const belowAfterDelay = await page.evaluate(() => document.getElementById("close").classList.contains("is-revealed"));
  const aboveBeforeDelay = await setVisibility(0.56);
  await pause(600);
  const aboveAfterDelay = await page.evaluate(() => document.getElementById("close").classList.contains("is-revealed"));
  await page.close();
  return { belowBeforeDelay, belowAfterDelay, aboveBeforeDelay, aboveAfterDelay };
}

async function main() {
  const browser = await puppeteer.launch({ executablePath: browserPath, headless: "new" });
  try {
    const pinActive = await anchorResult(browser, false);
    const fallback = await anchorResult(browser, true);
    const reveal = await revealResult(browser);
    console.log(JSON.stringify({ viewport, pinActive, fallback, reveal }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
