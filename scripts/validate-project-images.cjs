#!/usr/bin/env node
/**
 * validate-project-images.cjs
 *   node scripts/validate-project-images.cjs                    → report only
 *   node scripts/validate-project-images.cjs --rebuild          → regenerate thumb (3:2 crop) + hero (NATIVE aspect, uncropped) from the original source image
 *   node scripts/validate-project-images.cjs --fix-shared       → copy single image → thumb.jpg + hero.jpg
 *   node scripts/validate-project-images.cjs --normalize        → center-crop existing thumb/hero to their target aspect
 *   node scripts/validate-project-images.cjs --skip-dimensions  → existence only
 *
 * Aspect rules:
 *   thumb → 3:2 (matches the sphere card)
 *   hero  → NATIVE aspect (no crop) so the expanded panel shows the full image.
 *           Prefer a fixed banner ratio instead? Set RULES.hero.aspect = 16/9 (only works
 *           if your sources are at least that wide).
 *
 * Severity: aspect mismatch = ERROR (exit 1) · resolution below target = WARNING
 */
const fs = require('fs');
const path = require('path');

const IMG_ROOT     = path.resolve(__dirname, '..', 'public', 'img');
const PROJECTS_DIR = path.join(IMG_ROOT, 'projects');
const EXTS         = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];
const EXPECTED     = ['thumb.jpg', 'hero.jpg'];
const FIX_SHARED   = process.argv.includes('--fix-shared');
const REBUILD      = process.argv.includes('--rebuild');
const NORMALIZE    = process.argv.includes('--normalize');
const SKIP_DIMS    = process.argv.includes('--skip-dimensions');

const ASPECT_TOLERANCE = 0.02;
// Keep these CommonJS image-validation ratios aligned with src/constants.ts.
const RULES = {
  thumb:            { aspect: 3 / 2, minWidth: 800,  label: '3:2, ≥800w' },
  hero:             { aspect: null,  minWidth: 1600, label: 'native aspect, ≥1600w' },
  'about-featured': { aspect: 1,     minWidth: 1600, label: '1:1, ≥1600×1600' },
  'coming-soon':    { aspect: 3 / 2, minWidth: 800,  label: '3:2, ≥800w' },
};

let sharp = null;
if (!SKIP_DIMS) { try { sharp = require('sharp'); } catch { sharp = null; } }

const IDS = [
  'personal-ai-employee','crm-digital-fte','agent-forge','finance-tracker',
  'devdocs-ai','estate-ease','physical-ai-textbook',
  'prompt-orchestrator','vision-index','voice-scribe','rag-pipeline-kit',
  'agent-memory','synth-data-factory','eval-harness','deploy-pilot','log-lens',
  'infra-graph','canary-watch','vault-console','invoice-flow','meeting-scribe',
  'form-forge','waitlist-kit','changelog-cms','slot-engine','habit-loop',
  'pantry-scan','transit-pulse','metric-mirror','funnel-scope','query-canvas',
  'git-pulse','env-sync','scaffold-cli','mock-mesh','rate-gate','webhook-relay',
  'hot-cache','audit-trail','token-forge','stream-ui','veritas','chart-kit',
  'snippet-vault','doc-search','pixel-sort','sound-map','terminal-studio',
];

const listImages = dir => fs.existsSync(dir)
  ? fs.readdirSync(dir).filter(f => EXTS.includes(path.extname(f).toLowerCase()))
  : null;

// The original source = any image in the folder that isn't thumb.jpg/hero.jpg.
function findSource(dir) {
  const candidates = (listImages(dir) || []).filter(f => f !== 'thumb.jpg' && f !== 'hero.jpg');
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  return candidates.sort((a, b) =>
    fs.statSync(path.join(dir, b)).size - fs.statSync(path.join(dir, a)).size)[0];
}

// Center-crop `file` to targetAspect, preserving its format. Returns "WxH → WxH" or null.
async function centerCrop(file, targetAspect) {
  const meta = await sharp(file).metadata();
  const w = meta.width, h = meta.height;
  const r0 = w / h;
  if (Math.abs(r0 - targetAspect) / targetAspect <= ASPECT_TOLERANCE) return null;
  let cw, ch;
  if (r0 > targetAspect) { ch = h; cw = Math.round(h * targetAspect); }
  else                   { cw = w; ch = Math.round(w / targetAspect); }
  const tmp = file + '.tmp' + path.extname(file);
  let p = sharp(file).extract({ left: Math.round((w - cw) / 2), top: Math.round((h - ch) / 2), width: cw, height: ch });
  if (meta.format === 'jpeg') p = p.jpeg({ quality: 92 });
  else if (meta.format === 'webp') p = p.webp({ quality: 92 });
  else if (meta.format === 'png') p = p.png();
  await p.toFile(tmp);
  fs.renameSync(tmp, file);
  return `${w}×${h} → ${cw}×${ch}`;
}

// Rebuild thumb (3:2 crop) + hero (native aspect) from the original source.
async function rebuildProject(id, stats) {
  const dir = path.join(PROJECTS_DIR, id);
  const source = findSource(dir);
  if (!source) { stats.skipped.push(id); return; }
  const src = path.join(dir, source);
  const meta = await sharp(src).metadata();
  const sw = meta.width, sh = meta.height;

  // thumb: center-crop to 3:2, output as JPEG
  const ta = RULES.thumb.aspect, sa = sw / sh;
  let tw, th;
  if (sa > ta) { th = sh; tw = Math.round(sh * ta); } else { tw = sw; th = Math.round(sw / ta); }
  await sharp(src)
    .extract({ left: Math.round((sw - tw) / 2), top: Math.round((sh - th) / 2), width: tw, height: th })
    .jpeg({ quality: 92 }).toFile(path.join(dir, 'thumb.jpg'));

  // hero: native aspect, uncropped. Copy if already JPEG, else re-encode to .jpg.
  if (meta.format === 'jpeg') fs.copyFileSync(src, path.join(dir, 'hero.jpg'));
  else await sharp(src).jpeg({ quality: 92 }).toFile(path.join(dir, 'hero.jpg'));

  stats.done.push(id);
}

const report = { complete: [], fixed: [], needsNaming: [], missing: [], noFolder: [] };
const dim = { errors: [], warnings: [], cropped: [], passed: 0 };
const dimTargets = [];

(async () => {
  // Step 1: rebuild from source if requested
  const rebuildStats = { done: [], skipped: [] };
  if (REBUILD && sharp) for (const id of IDS) await rebuildProject(id, rebuildStats);

  // Step 2: existence pass
  for (const id of IDS) {
    const dir = path.join(PROJECTS_DIR, id);
    const imgs = listImages(dir);
    if (imgs === null)     { report.noFolder.push(id); continue; }
    if (imgs.length === 0) { report.missing.push(id);  continue; }
    const have = n => fs.existsSync(path.join(dir, n));
    const missing = EXPECTED.filter(n => !have(n));
    if (missing.length === 0) {
      report.complete.push(id);
    } else if (FIX_SHARED) {
      const source = (have('thumb.jpg') && 'thumb.jpg') || (have('hero.jpg') && 'hero.jpg') || imgs[0];
      for (const n of missing) fs.copyFileSync(path.join(dir, source), path.join(dir, n));
      report.fixed.push(id);
    } else {
      report.needsNaming.push(id);
    }
    for (const n of EXPECTED) {
      const fp = path.join(dir, n);
      if (fs.existsSync(fp)) dimTargets.push({ file: fp, ruleKey: path.basename(n, path.extname(n)) });
    }
  }

  const globals = {};
  for (const base of ['about-featured', 'coming-soon']) {
    const hit = (listImages(IMG_ROOT) || []).find(f => path.basename(f, path.extname(f)) === base);
    globals[base] = !!hit;
    if (hit) dimTargets.push({ file: path.join(IMG_ROOT, hit), ruleKey: base });
  }

  // Step 3: dimension validation (+ optional normalize)
  async function processImage(file, ruleKey) {
    const rule = RULES[ruleKey];
    if (!rule) return;
    const rel = path.relative(IMG_ROOT, file);
    try {
      const meta = await sharp(file).metadata();
      let w = meta.width, h = meta.height;
      if (!w || !h) return;
      let cropped = null;
      if (NORMALIZE && rule.aspect != null) {
        cropped = await centerCrop(file, rule.aspect);
        if (cropped) { const m = await sharp(file).metadata(); w = m.width; h = m.height; }
      }
      const ratio = w / h;
      const aspectOk = rule.aspect == null || Math.abs(ratio - rule.aspect) / rule.aspect <= ASPECT_TOLERANCE;
      const widthOk  = w >= rule.minWidth;
      if (cropped) dim.cropped.push(`${rel}  ${cropped}`);
      if (!aspectOk)     dim.errors.push(`${rel}  ${w}×${h}  ratio ${ratio.toFixed(3)} ≠ ${rule.label}`);
      else if (!widthOk) dim.warnings.push(`${rel}  ${w}×${h}  below ${rule.label}`);
      else dim.passed++;
    } catch (e) { dim.errors.push(`${rel}  unreadable (${e.message})`); }
  }
  if (sharp) await Promise.all(dimTargets.map(t => processImage(t.file, t.ruleKey)));

  // Step 4: output
  const section = (label, arr, icon) => {
    if (!arr.length) return;
    console.log(`\n${icon} ${label} (${arr.length})`);
    arr.forEach(x => console.log('   - ' + x));
  };

  if (REBUILD) {
    console.log('\n── Rebuild from source ─────────────────────────────');
    console.log(`   🔧 rebuilt: ${rebuildStats.done.length}   ⚠️ skipped (no source image found): ${rebuildStats.skipped.length}`);
    section('Skipped — original source image not in folder', rebuildStats.skipped, '⚠️ ');
  }

  console.log('\n── Project image audit ──────────────────────────────');
  section('Complete (thumb + hero present)', report.complete, '✅');
  section('Fixed (copied single image → thumb + hero)', report.fixed, '🔧');
  section('Has image(s) but missing thumb.jpg/hero.jpg — run --fix-shared', report.needsNaming, '⚠️ ');
  section('No images at all', report.missing, '❌');
  section('Folder does not exist', report.noFolder, '📁');

  console.log('\n── Global assets ────────────────────────────────────');
  for (const base of ['about-featured', 'coming-soon']) console.log(`  ${globals[base] ? '✅' : '❌'} /img/${base}.*`);

  if (sharp) {
    console.log('\n── Dimensions / aspect ratio ────────────────────────');
    console.log(`   ✅ passed: ${dim.passed}   ✂️ cropped: ${dim.cropped.length}   ⚠️ warnings: ${dim.warnings.length}   ❌ errors: ${dim.errors.length}`);
    section('Center-cropped to target aspect', dim.cropped, '✂️');
    section('Aspect-ratio ERRORS (will distort)', dim.errors, '❌');
    section('Resolution WARNINGS (may look soft)', dim.warnings, '⚠️ ');
  } else if (!SKIP_DIMS) {
    console.log('\nℹ️  sharp not installed — dimension checks skipped. Run `npm i -D sharp`.\n');
  }

  const failures = report.missing.length + report.noFolder.length + report.needsNaming.length + dim.errors.length;
  const globalsOk = globals['about-featured'] && globals['coming-soon'];
  const ready = report.complete.length + report.fixed.length;
  console.log(`\nSummary: ${ready}/${IDS.length} projects ready · ${failures} blocking issue(s)`);
  process.exit(failures === 0 && globalsOk ? 0 : 1);
})();
