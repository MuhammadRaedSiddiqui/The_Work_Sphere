import * as THREE from "three";
import type { Project } from "../types";
import { CARD_FILL_COLOR } from "../constants";

// ---------------------------------------------------------------------------
// Phase 7 — Asset pipeline
// Real featured photo (square ≥1600²), real thumbnails/hero images, "coming soon"
// texture, thumbnail preload on scroll intent, LQIP that never pops during flight.
// hero spec appendix + transition §16 + hero §15.
// ---------------------------------------------------------------------------

function hueFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}

// -- LQIP: 8×6 flat color — instant paint, no network
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

// -- Procedural fallback thumbnail (used when /assets/thumbnails/{id}.jpg 404s)
// Phase 7 keeps this as the Contents fallback — still a valid render if real asset fails.
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

// Keep old name for compat — now delegates to canvas fallback
export function makeThumbnail(p: Project): THREE.CanvasTexture {
  return makeThumbnailCanvas(p);
}

// -- "Coming soon" placeholder (§1) — subtle hatch over card fill
let comingSoon: THREE.CanvasTexture | null = null;
export function makeComingSoon(): THREE.CanvasTexture {
  if (comingSoon) return comingSoon;
  const c = document.createElement("canvas");
  c.width = 600;
  c.height = 400;
  const ctx = c.getContext("2d")!;
  const fill = `#${CARD_FILL_COLOR.toString(16).padStart(6, "0")}`;
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, 600, 400);
  // sharper hatch for Phase 7 — still low-contrast
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 1.2;
  for (let x = -600; x < 600; x += 20) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 400, 400);
    ctx.stroke();
  }
  // inner border hint
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, 599, 399);
  ctx.fillStyle = "rgba(255,255,255,0.34)";
  ctx.font = "600 18px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("coming soon", 300, 200);
  comingSoon = new THREE.CanvasTexture(c);
  comingSoon.colorSpace = THREE.SRGBColorSpace;
  comingSoon.minFilter = THREE.LinearFilter;
  comingSoon.magFilter = THREE.LinearFilter;
  return comingSoon;
}

// -- Shared photo mosaic texture — one canvas sampled across 2×3 zone via UV inset
// Phase 7: real featured photo (square ≥1600²) is the source. We keep a procedural
// 1600² fallback and attempt to load /assets/photo/featured.jpg on top of it.
let photoTexture: THREE.CanvasTexture | THREE.Texture | null = null;
let photoRealLoaded = false;

function makePhotoFallback1600(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 1600;
  c.height = 1600;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 1600, 1600);
  g.addColorStop(0, "#2b2e48");
  g.addColorStop(0.45, "#4a5a78");
  g.addColorStop(1, "#1a1d2e");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1600, 1600);
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.beginPath();
  ctx.ellipse(800, 800, 420, 560, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.font = "700 52px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("STUDIO PORTRAIT", 800, 830);
  ctx.fillStyle = "rgba(255,255,255,0.38)";
  ctx.font = "500 18px system-ui, sans-serif";
  ctx.fillText("featured · 1600² · photo mosaic 2×3", 800, 870);
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.font = "500 12px system-ui, sans-serif";
  ctx.fillText("real featured photo fallback — replace /assets/photo/featured.jpg", 800, 900);
  // slice hints
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(800, 0); ctx.lineTo(800, 1600); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, 533); ctx.lineTo(1600, 533); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, 1066); ctx.lineTo(1600, 1066); ctx.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  return t;
}

export function getPhotoTexture(): THREE.Texture {
  if (photoTexture) return photoTexture;
  photoTexture = makePhotoFallback1600();
  // Kick real load in background — swaps when done if not already replaced
  void loadRealPhotoTexture();
  return photoTexture;
}

// Try to load the real featured square. If it succeeds, replace the fallback
// texture's image in place so existing materials pick it up without reassigning
// during flight (avoid pop). Callers that already hold the fallback ref will see
// the update after needsUpdate.
let realPhotoPromise: Promise<THREE.Texture | null> | null = null;
export function loadRealPhotoTexture(): Promise<THREE.Texture | null> {
  if (realPhotoPromise) return realPhotoPromise;
  realPhotoPromise = new Promise((resolve) => {
    const loader = new THREE.TextureLoader();
    const tryLoad = (url: string, onFail: () => void) => {
      loader.load(
        url,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.minFilter = THREE.LinearFilter;
          tex.magFilter = THREE.LinearFilter;
          tex.generateMipmaps = false;
          photoTexture = tex;
          photoRealLoaded = true;
          resolve(tex);
        },
        undefined,
        onFail
      );
    };
    tryLoad("/assets/photo/featured.jpg", () => {
      tryLoad("/assets/photo/featured.png", () => resolve(null));
    });
  });
  return realPhotoPromise;
}

export function isPhotoRealLoaded(): boolean {
  return photoRealLoaded;
}

// ---------------------------------------------------------------------------
// Thumbnail asset pipeline — real thumbnails with LQIP + scroll-intent preload
// - Initially every card shows its 8×6 LQIP (synchronous, no pop).
// - Real 600×400 JPG at /assets/thumbnails/{id}.jpg loads only after scroll intent
//   (first wheel/touch scroll or explicit trigger) — no LQIP pop-in during flight
//   on desktop because swaps are gated to safe scrub windows (p≤0.02 or p≥0.82).
// - Fail → procedural fallback canvas, not a broken texture.
// ---------------------------------------------------------------------------

const thumbCache = new Map<string, THREE.Texture>();
const thumbInflight = new Map<string, Promise<THREE.Texture>>();
let scrollIntentFired = false;
let thumbnailPreloadStarted = false;

export function hasScrollIntent(): boolean {
  return scrollIntentFired;
}
export function markScrollIntent(): void {
  scrollIntentFired = true;
}

/**
 * Load one project's thumbnail as a THREE.Texture.
 * Tries /assets/thumbnails/{id}.jpg first (real asset), falls back to canvas.
 * Cached — second call is synchronous.
 */
export function loadThumbnailTexture(p: Project): Promise<THREE.Texture> {
  const cached = thumbCache.get(p.id);
  if (cached) return Promise.resolve(cached);
  const inflight = thumbInflight.get(p.id);
  if (inflight) return inflight;

  const promise = new Promise<THREE.Texture>((resolve) => {
    const loader = new THREE.TextureLoader();
    const url = p.thumbnail; // already "/assets/thumbnails/{id}.jpg"
    const pngUrl = url.replace(/\.jpg$/i, ".png");
    const onSuccess = (tex: THREE.Texture) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      thumbCache.set(p.id, tex);
      thumbInflight.delete(p.id);
      resolve(tex);
    };
    const fallback = () => {
      const fb = makeThumbnailCanvas(p);
      thumbCache.set(p.id, fb);
      thumbInflight.delete(p.id);
      resolve(fb);
    };
    loader.load(
      url,
      onSuccess,
      undefined,
      () => {
        // jpg 404 → try png (real mime) before procedural fallback
        if (pngUrl !== url) {
          loader.load(pngUrl, onSuccess, undefined, fallback);
        } else fallback();
      }
    );
  });
  thumbInflight.set(p.id, promise);
  return promise;
}

/**
 * Preloads all project thumbnails. Called on scroll intent — not at build.
 * Concurrency limited to avoid flooding the loader and janking the scrub.
 */
export async function preloadThumbnails(projects: Project[], concurrency = 4): Promise<void> {
  if (thumbnailPreloadStarted) return;
  thumbnailPreloadStarted = true;
  const queue = [...projects];
  const workers: Promise<void>[] = [];
  for (let w = 0; w < Math.min(concurrency, queue.length); w++) {
    workers.push(
      (async () => {
        while (queue.length) {
          const p = queue.shift()!;
          try {
            await loadThumbnailTexture(p);
          } catch {
            // ignore — fallback already handled
          }
        }
      })()
    );
  }
  await Promise.all(workers);
}

/**
 * Whether a realised texture is available for this id (real or fallback).
 * Used by SphereScene to decide if a swap is safe without re-triggering load.
 */
export function getCachedThumbnail(id: string): THREE.Texture | undefined {
  return thumbCache.get(id);
}

/**
 * Reset helper for tests / HMR.
 */
export function __resetThumbnailPipeline(): void {
  thumbCache.clear();
  thumbInflight.clear();
  scrollIntentFired = false;
  thumbnailPreloadStarted = false;
}
