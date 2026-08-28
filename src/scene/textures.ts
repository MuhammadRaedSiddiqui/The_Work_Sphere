import * as THREE from "three";
import type { Project } from "../types";
import { CARD_FILL_COLOR } from "../constants";

// ---------------------------------------------------------------------------
// Asset pipeline — spec requirements:
// - Card thumbnails: /img/projects/{id}/thumb.jpg (3:2, ≥800w), hero same at hero.jpg
// - About photo mosaic: /img/about-featured.jpg (square, ≥1600²) as ONE shared texture
// - Fallback: /img/coming-soon.jpg (3:2) — never render black/broken
// Progressive: render coming-soon.jpg first, swap to full texture on load complete.
// Performance: do not load all 48 full-res at once — eager staggered load + preload remaining on first scroll intent.
// ---------------------------------------------------------------------------

// -- Fallback canvas for coming-soon (used while /img/coming-soon.jpg loads or on error)
let comingSoonFallback: THREE.CanvasTexture | null = null;
export function makeComingSoon(): THREE.CanvasTexture {
  if (comingSoonFallback) return comingSoonFallback;
  const c = document.createElement("canvas");
  c.width = 600;
  c.height = 400;
  const ctx = c.getContext("2d")!;
  const fill = `#${CARD_FILL_COLOR.toString(16).padStart(6, "0")}`;
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, 600, 400);
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 1.2;
  for (let x = -600; x < 600; x += 20) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 400, 400);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, 599, 399);
  ctx.fillStyle = "rgba(255,255,255,0.34)";
  ctx.font = "600 18px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("coming soon", 300, 200);
  comingSoonFallback = new THREE.CanvasTexture(c);
  comingSoonFallback.colorSpace = THREE.SRGBColorSpace;
  comingSoonFallback.minFilter = THREE.LinearFilter;
  comingSoonFallback.magFilter = THREE.LinearFilter;
  return comingSoonFallback;
}

// keep procedural thumbnail fallback for internal use (not primary)
function hueFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}
export function makeLQIP(id: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 8;
  c.height = 6;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = `hsl(${hueFor(id)}, 18%, 22%)`;
  ctx.fillRect(0, 0, 8, 6);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  return t;
}
export function makeThumbnailCanvas(p: Project): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 600;
  c.height = 400;
  const ctx = c.getContext("2d")!;
  const h = hueFor(p.id);
  const g = ctx.createLinearGradient(0, 0, 600, 400);
  g.addColorStop(0, `hsl(${h}, 30%, 26%)`);
  g.addColorStop(1, `hsl(${(h + 40) % 360}, 24%, 12%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 600, 400);
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1;
  for (let x = -600; x < 600; x += 28) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 400, 400);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(235,235,240,0.92)";
  ctx.font = "600 28px system-ui, sans-serif";
  ctx.fillText(p.title, 20, 202);
  ctx.fillStyle = "rgba(255,255,255,0.42)";
  ctx.font = "500 12px system-ui, sans-serif";
  ctx.fillText(`${p.id} · fallback thumbnail`, 20, 222);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  return t;
}
export function makeThumbnail(p: Project): THREE.CanvasTexture {
  return makeThumbnailCanvas(p);
}

// -- Shared coming-soon texture (real file /img/coming-soon.jpg, fallback to canvas)
// Progressive pattern: render coming-soon.jpg first; thumb loads swap on complete.
// We create a Texture that initially shows the canvas fallback instantly (no black flash)
// and upgrades in-place (image + needsUpdate) when the real jpg arrives.
let comingSoonTexture: THREE.Texture | null = null;
let comingSoonPromise: Promise<THREE.Texture> | null = null;

function getComingSoonFallbackTexture(): THREE.Texture {
  if (!comingSoonFallback) makeComingSoon();
  return comingSoonFallback!;
}

export function getComingSoonTexture(): THREE.Texture {
  if (comingSoonTexture) return comingSoonTexture;
  // Start with immediate canvas fallback so first frame never black
  comingSoonTexture = getComingSoonFallbackTexture();
  // Kick real load in background — update image in place when ready
  void loadRealComingSoonTexture();
  return comingSoonTexture;
}

function loadRealComingSoonTexture(): Promise<THREE.Texture> {
  if (comingSoonPromise) return comingSoonPromise;
  comingSoonPromise = new Promise((resolve) => {
    const loader = new THREE.TextureLoader();
    loader.load(
      "/img/coming-soon.jpg",
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.generateMipmaps = false;
        // In-place upgrade: keep same object reference so existing materials see it
        if (comingSoonTexture && comingSoonTexture !== tex) {
          // Replace image and UV settings in-place per spec (update texture.image + needsUpdate)
          (comingSoonTexture as THREE.Texture).image = tex.image;
          comingSoonTexture.needsUpdate = true;
          // Preserve colorSpace/filter already set
          comingSoonTexture.colorSpace = THREE.SRGBColorSpace;
          // Cache new for future callers that check identity — they still share the upgraded object
          resolve(comingSoonTexture);
        } else {
          comingSoonTexture = tex;
          resolve(tex);
        }
      },
      undefined,
      () => {
        // 404 → keep fallback canvas, resolve with it (never black)
        resolve(getComingSoonFallbackTexture());
      }
    );
  });
  return comingSoonPromise;
}

// -- Shared photo mosaic texture — one shared texture for 2×4 editorial column (§4, §5)
// Loaded from /img/about-featured.jpg (portrait 3:4, ≥1600 on long edge). UV sub-rects
// with 3.5% inset bezel are applied via geometry UV remap in SphereScene (computed once).
// Editorial desaturation (flat grey vs single-accent duotone, both flagged undecided in spec)
// is resolved here as **flat grey** via a static build-time asset recommendation (§5):
// pre-process the source photo to a grayscale/duotone PNG so Three.js texture and
// fallback <img> share one file with zero visual drift. Runtime fallback is a
// canvas-desaturated clone of the loaded image (live CSS filter is the flexible
// alternative if the photo swaps often without rebuild — confirm which matters).
let photoTexture: THREE.Texture | null = null;
let photoRealLoaded = false;
let photoPromise: Promise<THREE.Texture | null> | null = null;

function makePhotoFallback1600(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 1200;
  c.height = 1600;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 1200, 1600);
  g.addColorStop(0, "#2b2e48");
  g.addColorStop(0.45, "#4a5a78");
  g.addColorStop(1, "#1a1d2e");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1200, 1600);
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.beginPath();
  ctx.ellipse(600, 800, 320, 480, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.font = "700 44px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("STUDIO PORTRAIT", 600, 820);
  ctx.fillStyle = "rgba(255,255,255,0.38)";
  ctx.font = "500 16px system-ui, sans-serif";
  ctx.fillText("featured · 1200×1600 · photo mosaic 2×4", 600, 860);
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.font = "500 11px system-ui, sans-serif";
  ctx.fillText("real featured photo fallback — replace /img/about-featured.jpg", 600, 890);
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(600, 0); ctx.lineTo(600, 1600); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, 400); ctx.lineTo(1200, 400); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, 800); ctx.lineTo(1200, 800); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, 1200); ctx.lineTo(1200, 1200); ctx.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  return t;
}

export function getPhotoTexture(): THREE.Texture {
  if (photoTexture) return photoTexture;
  // Immediate fallback so wall never shows black; upgrade in background
  // Fallback canvas is already desaturated in palette; real image will be
  // desaturated on load to match the static-asset recommendation.
  photoTexture = makePhotoFallback1600();
  void loadRealPhotoTexture();
  return photoTexture;
}

// Static-asset recommendation helper: desaturate a loaded image to a canvas
// so Three.js and fallback <img> can share one greyscale source. This runtime
// clone is the live fallback when a pre-built grayscale PNG isn't present;
// for production, replace /img/about-featured.jpg with a pre-processed
// grayscale/duotone PNG and skip this step. Duotone alternative (single accent
// over grayscale) would add: ctx.globalCompositeOperation='multiply' + tint fill.
function desaturateSourceToCanvas(source: HTMLImageElement): HTMLCanvasElement {
  const w = (source as HTMLImageElement).naturalWidth || (source as unknown as { width: number }).width || 1200;
  const h = (source as HTMLImageElement).naturalHeight || (source as unknown as { height: number }).height || 1600;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  // Flat grey desaturation — matches FallbackAbout CSS `grayscale(1)` so both paths drift together.
  // For duotone, apply a luminance-mapped tint after this draw.
  try {
    ctx.filter = "grayscale(1) contrast(1.08) brightness(1.03)";
  } catch { /* filter fallback */ }
  ctx.drawImage(source as unknown as CanvasImageSource, 0, 0, w, h);
  return c;
}

export function loadRealPhotoTexture(): Promise<THREE.Texture | null> {
  if (photoPromise) return photoPromise;
  photoPromise = new Promise((resolve) => {
    const loader = new THREE.TextureLoader();
    loader.load(
      "/img/about-featured.jpg",
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.generateMipmaps = false;
        // Desaturate to flat grey (static-asset recommendation: pre-process to PNG instead of live filter)
        // Produce a canvas so Three.js texture and fallback <img> share the same desaturated source.
        let desaturatedCanvas: HTMLCanvasElement | null = null;
        try {
          const img = tex.image as HTMLImageElement;
          if (img && (img.naturalWidth || (img as unknown as { width: number }).width)) {
            desaturatedCanvas = desaturateSourceToCanvas(img);
          }
        } catch { /* fall through to raw tex */ }
        const finalImage: CanvasImageSource = (desaturatedCanvas as unknown as CanvasImageSource) || tex.image;
        if (photoTexture && photoTexture !== tex) {
          // In-place upgrade: preserve object identity so photo cards already holding
          // the fallback reference show the real image without per-card reassignment.
          (photoTexture as THREE.Texture).image = finalImage;
          photoTexture.needsUpdate = true;
          // Keep canvas-backed texture crisp
          if (desaturatedCanvas) {
            (photoTexture as THREE.Texture).colorSpace = THREE.SRGBColorSpace;
          }
          photoRealLoaded = true;
          resolve(photoTexture);
        } else {
          if (desaturatedCanvas) {
            const canvasTex = new THREE.CanvasTexture(desaturatedCanvas);
            canvasTex.colorSpace = THREE.SRGBColorSpace;
            canvasTex.minFilter = THREE.LinearFilter;
            canvasTex.magFilter = THREE.LinearFilter;
            canvasTex.generateMipmaps = false;
            photoTexture = canvasTex;
            photoRealLoaded = true;
            resolve(canvasTex);
          } else {
            photoTexture = tex;
            photoRealLoaded = true;
            resolve(tex);
          }
        }
      },
      undefined,
      () => resolve(null) // keep fallback canvas on error
    );
  });
  return photoPromise;
}

export function isPhotoRealLoaded(): boolean {
  return photoRealLoaded;
}

// ---------------------------------------------------------------------------
// Thumbnail pipeline — real thumbnails via /img/projects/{id}/thumb.jpg
// - Initially every card shows coming-soon.jpg (via getComingSoonTexture)
// - Real 3:2 JPGs start loading immediately (eager, concurrency-limited) and
//   also on first scroll intent as backup — swaps are gated to safe scrub
//   windows (p≤0.02) so flight never pops. On 404/error keep coming-soon (never black).
// ---------------------------------------------------------------------------

const thumbCache = new Map<string, THREE.Texture>();
const thumbInflight = new Map<string, Promise<THREE.Texture>>();
let scrollIntentFired = false;

export function hasScrollIntent(): boolean {
  return scrollIntentFired;
}
export function markScrollIntent(): void {
  scrollIntentFired = true;
}

/**
 * Load one project's thumbnail as a THREE.Texture.
 * Tries project.thumbnail (/img/projects/{id}/thumb.jpg); on error resolves
 * to the coming-soon texture (never black).
 * Cached — second call is synchronous via cache.
 */
export function loadThumbnailTexture(p: Project): Promise<THREE.Texture> {
  const cached = thumbCache.get(p.id);
  if (cached) return Promise.resolve(cached);
  const inflight = thumbInflight.get(p.id);
  if (inflight) return inflight;

  const promise = new Promise<THREE.Texture>((resolve) => {
    const loader = new THREE.TextureLoader();
    const url = p.thumbnail; // "/img/projects/{id}/thumb.jpg" — do NOT change paths in data
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        // Thumbnails are exactly 3:2, matching card aspect — plain UV full-face, no cover math
        tex.generateMipmaps = false;
        thumbCache.set(p.id, tex);
        thumbInflight.delete(p.id);
        resolve(tex);
      },
      undefined,
      () => {
        // 404/error → keep coming-soon texture (never black/broken)
        const fallback = getComingSoonTexture();
        thumbCache.set(p.id, fallback);
        thumbInflight.delete(p.id);
        resolve(fallback);
      }
    );
  });
  thumbInflight.set(p.id, promise);
  return promise;
}

/**
 * Preloads project thumbnails with concurrency throttling.
 * Deduped via thumbCache/thumbInflight — multiple calls with overlapping
 * subsets are safe (already-loaded/in-flight entries are skipped).
 * Used progressively: initial hemisphere eagerly, remaining on scroll intent.
 */
export async function preloadThumbnails(projects: Project[], concurrency = 4): Promise<void> {
  // Filter to those not already cached or in-flight so subsequent calls still make progress
  const pending = projects.filter((p) => !thumbCache.has(p.id) && !thumbInflight.has(p.id));
  if (pending.length === 0) {
    // Even if all pending are in-flight, wait for them rather than returning immediately
    const inflightPending = projects
      .map((p) => thumbInflight.get(p.id))
      .filter(Boolean) as Promise<THREE.Texture>[];
    if (inflightPending.length) await Promise.allSettled(inflightPending);
    return;
  }
  const queue = [...pending];
  const workers: Promise<void>[] = [];
  for (let w = 0; w < Math.min(concurrency, queue.length); w++) {
    workers.push(
      (async () => {
        while (queue.length) {
          const p = queue.shift()!;
          try {
            await loadThumbnailTexture(p);
          } catch {
            // fallback already handled
          }
        }
      })()
    );
  }
  await Promise.all(workers);
}

export function getCachedThumbnail(id: string): THREE.Texture | undefined {
  return thumbCache.get(id);
}

export function __resetThumbnailPipeline(): void {
  thumbCache.clear();
  thumbInflight.clear();
  scrollIntentFired = false;
  comingSoonTexture = null;
  comingSoonPromise = null;
  photoTexture = null;
  photoRealLoaded = false;
  photoPromise = null;
}
