// Phase 1 checkpoint smoke test: renders, idles, drag+momentum, upright thumbs.
import puppeteer from "puppeteer-core";

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  args: ["--use-gl=angle", "--enable-webgl", "--window-size=1280,800"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

await page.goto("http://localhost:5199/", { waitUntil: "networkidle2" });

// 1. Entrance + idle rotation: two screenshots ~1.5s apart must differ.
await new Promise((r) => setTimeout(r, 2500)); // entrance settles, idle spinning
await page.screenshot({ path: "gui-test-screenshots/t1_idle_a.png" });
await new Promise((r) => setTimeout(r, 1500));
await page.screenshot({ path: "gui-test-screenshots/t1_idle_b.png" });

// 2. Drag with momentum: fling left, screenshot right after release (should
// be blurred by motion) and again 2s later (settled + idle resumed).
await page.mouse.move(640, 400);
await page.mouse.down();
await page.mouse.move(440, 400, { steps: 8 });
await page.mouse.up();
await new Promise((r) => setTimeout(r, 120));
await page.screenshot({ path: "gui-test-screenshots/t2_momentum_early.png" });
await new Promise((r) => setTimeout(r, 2500));
await page.screenshot({ path: "gui-test-screenshots/t2_momentum_settled.png" });

// 3. Vertical drag (unclamped pitch) — thumbnails should stay upright.
await page.mouse.move(640, 300);
await page.mouse.down();
await page.mouse.move(640, 700, { steps: 10 });
await page.mouse.up();
await new Promise((r) => setTimeout(r, 300));
await page.screenshot({ path: "gui-test-screenshots/t3_pitch_drag.png" });

console.log("errors:", errors.length ? errors : "none");
await browser.close();
