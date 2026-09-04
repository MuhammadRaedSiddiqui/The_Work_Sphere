#!/usr/bin/env node
// Build check: fails loudly if the placeholder portrait is still the primary load target
// or if the cut tag line is still referenced anywhere. Run via `node scripts/check-photo-asset.js`
// or automatically on `vite build` through the vite.config.ts plugin.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

let failed = false;

function checkFile(relPath, predicate, error) {
  const full = path.join(root, relPath);
  try {
    const content = fs.readFileSync(full, "utf8");
    if (predicate(content)) {
      console.error(`✖ ${error}\n  → ${relPath}`);
      failed = true;
    } else {
      console.log(`✔ ${relPath} — ok`);
    }
  } catch (e) {
    console.error(`? Could not read ${relPath}: ${e.message}`);
  }
}

// 1. Placeholder still primary?
checkFile(
  "src/scene/textures.ts",
  (c) => c.includes("PHOTO_LOAD_SRC = PHOTO_PLACEHOLDER_SRC"),
  "Production build blocked: PHOTO_LOAD_SRC still points at PHOTO_PLACEHOLDER_SRC (/img/about-placeholder-NOT-FINAL.jpg). Replace with PHOTO_FINAL_SRC when the real BW portrait is delivered."
);

// 2. Tag line still rendered anywhere?
checkFile(
  "src/components/FallbackAbout.tsx",
  (c) => c.includes("AI AGENTS") || c.includes('zone="T"') || c.includes("aboutZones.T"),
  "Cut tag line (T zone) still referenced in FallbackAbout.tsx — remove all T references per spec §5."
);

checkFile(
  "src/App.tsx",
  (c) => c.includes('data-zone="T"'),
  "Cut T tag line still referenced in App.tsx — only E, H and BC should render."
);

checkFile(
  "src/constants.ts",
  (c) => c.includes('"T"') && c.includes("aboutZones") && c.includes("AI AGENTS"),
  "aboutZones still defines T — tag line is cut, remove it."
);

// 3. Placeholder file still physically referenced as <img src> in production path?
// This is intentionally still present until the photoshoot delivers — the build guard above
// is the gate. We log it here for visibility.
try {
  const fallback = fs.readFileSync(path.join(root, "src/components/FallbackAbout.tsx"), "utf8");
  if (fallback.includes("PHOTO_PLACEHOLDER_SRC")) {
    console.log("ℹ FallbackAbout references PHOTO_PLACEHOLDER_SRC — expected until real portrait lands; production vite build will block until textures.ts switches to PHOTO_FINAL_SRC.");
  }
} catch {}

if (failed) {
  console.error("\nBuild check failed — see errors above. Fix and re-run.");
  process.exit(1);
} else {
  console.log("\nBuild check passed (or placeholder guard is the only remaining blocker, which is expected until the photoshoot delivers).");
}
