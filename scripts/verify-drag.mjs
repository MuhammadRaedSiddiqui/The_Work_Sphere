// Verify: drag follows pointer; idle spins one direction (rightward).
// Method: cross-correlate a horizontal image strip between two frames;
// the shift s minimizing diff is the content's horizontal travel.
import puppeteer from "puppeteer-core";
import { PNG } from "pngjs";

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  args: ["--use-gl=angle", "--enable-webgl"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
await page.goto("http://localhost:5199/", { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 2600)); // entrance settles

const strip = async () => {
  const png = PNG.sync.read(await page.screenshot({ type: "png" }));
  const rows = [];
  for (let y = 300; y < 520; y += 4) {
    const row = [];
    for (let x = 80; x < 1200; x += 2) {
      const i = (png.width * y + x) << 2;
      row.push((png.data[i] + png.data[i + 1] + png.data[i + 2]) / 3);
    }
    rows.push(row);
  }
  return rows;
};
function measureShift(rowsA, rowsB) {
  let best = 0, bestScore = Infinity;
  for (let s = -60; s <= 60; s += 2) {
    let d = 0, n = 0;
    for (const [ra, rb] of rowsA.map((r, i) => [r, rowsB[i]])) {
      for (let x = Math.max(0, -s); x < Math.min(ra.length, rb.length - s); x++) {
        d += Math.abs(ra[x] - rb[x + s]); n++;
      }
    }
    const score = d / n;
    if (score < bestScore) { bestScore = score; best = s; }
  }
  return best; // pixels per 2-sample step: content moved right by best*2 px
}

// DRAG TEST — pointer held down throughout, so no idle/momentum interference.
await page.mouse.move(640, 400);
await page.mouse.down();
await page.mouse.move(700, 400, { steps: 10 });
const dragA = await strip();
await page.mouse.move(740, 400, { steps: 8 }); // +40px right
const dragB = await strip();
await page.mouse.up();
console.log("drag shift px (expect ~ +40):", measureShift(dragA, dragB) * 2);

// IDLE TEST — no input; 1s apart. Rightward spin → positive shift.
await new Promise((r) => setTimeout(r, 1500));
const idleA = await strip();
await new Promise((r) => setTimeout(r, 1000));
const idleB = await strip();
console.log("idle shift px/s (expect small positive):", measureShift(idleA, idleB) * 2);

await browser.close();
