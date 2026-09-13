import * as THREE from "three";
import type { Project } from "../types";
import {
  CARD_FILL_COLOR,
  COMING_SOON_IMAGE_SRC,
  PHOTO_PLACEHOLDER_SRC,
  PHOTO_FINAL_SRC,
  THUMBNAIL_ATLAS_AVIF_SRC,
  THUMBNAIL_ATLAS_COLUMNS,
  THUMBNAIL_ATLAS_ROWS,
  THUMBNAIL_ATLAS_WEBP_SRC,
} from "../constants";

// ---------------------------------------------------------------------------
// Asset pipeline — closing-pass rebuild (spec §4 final):
// - Card thumbnails: /img/projects/{id}/thumb.jpg (3:2, ≥800w), hero same at hero.jpg
// - About photo: SINGLE UNSLICED image spanning the photo zone's aggregate rect.
//   Final asset is /img/about-portrait.png — used as PNG, never converted to JPG,
//   pre-processed black-and-white, real highlight/shadow detail, static asset,
//   NO live filter. No bezel, no mosaic. Placeholder has been replaced.
// - Fallback: /img/coming-soon.jpg (3:2) — never render black/broken
// Progressive: render coming-soon.jpg first, swap to full texture on load complete.
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
let comingSoonTexture: THREE.Texture | null = null;
let comingSoonPromise: Promise<THREE.Texture> | null = null;

function getComingSoonFallbackTexture(): THREE.Texture {
  if (!comingSoonFallback) makeComingSoon();
  return comingSoonFallback!;
}

export function getComingSoonTexture(): THREE.Texture {
  if (comingSoonTexture) return comingSoonTexture;
  comingSoonTexture = getComingSoonFallbackTexture();
  void loadRealComingSoonTexture();
  return comingSoonTexture;
}

function loadRealComingSoonTexture(): Promise<THREE.Texture> {
  if (comingSoonPromise) return comingSoonPromise;
  comingSoonPromise = new Promise((resolve) => {
    const loader = new THREE.TextureLoader();
    loader.load(
      COMING_SOON_IMAGE_SRC,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.generateMipmaps = false;
        if (comingSoonTexture && comingSoonTexture !== tex) {
          (comingSoonTexture as THREE.Texture).image = tex.image;
          comingSoonTexture.needsUpdate = true;
          comingSoonTexture.colorSpace = THREE.SRGBColorSpace;
          resolve(comingSoonTexture);
        } else {
          comingSoonTexture = tex;
          resolve(tex);
        }
      },
      undefined,
      () => {
        resolve(getComingSoonFallbackTexture());
      }
    );
  });
  return comingSoonPromise;
}

// -- Photo portrait — SINGLE UNSLICED, pre-processed BW, zero bezel (§4 final)
// Final static asset: PHOTO_FINAL_SRC (/img/about-portrait.png) — must be a
// black-and-white file with real tonal range baked in, used as PNG, never
// converted to JPG. No canvas grayscale filter.
// The placeholder (/img/about-placeholder-NOT-FINAL.jpg) has been replaced
// by the real PNG; the production build guard now only fails if someone
// reintroduces the placeholder path. Do not reintroduce live filters or mosaic.
let photoTexture: THREE.Texture | null = null;
let photoRealLoaded = false;
let photoPromise: Promise<THREE.Texture | null> | null = null;

function makePhotoPlaceholderCanvas(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 900;
  c.height = 1200;
  const ctx = c.getContext("2d")!;
  // Fallback if PNG fails to load — should rarely show now that real asset exists
  ctx.fillStyle = "#0A0A0A";
  ctx.fillRect(0, 0, 900, 1200);
  ctx.fillStyle = "rgba(255,60,60,0.95)";
  ctx.font = "700 22px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("PORTRAIT LOAD FAILED", 450, 520);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "600 14px system-ui, sans-serif";
  ctx.fillText("about-portrait.png", 450, 550);
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.font = "500 11px system-ui, sans-serif";
  ctx.fillText("Check /public/img/about-portrait.png exists and is not corrupt", 450, 580);
  ctx.strokeStyle = "rgba(255,60,60,0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, 860, 1160);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  return t;
}

export function getPhotoTexture(): THREE.Texture {
  if (photoTexture) return photoTexture;
  photoTexture = makePhotoPlaceholderCanvas();
  void loadRealPhotoTexture();
  return photoTexture;
}

// Primary loader — real PNG portrait, used as PNG, never converted to JPG.
const PHOTO_LOAD_SRC = PHOTO_FINAL_SRC;

export function loadRealPhotoTexture(): Promise<THREE.Texture | null> {
  if (photoPromise) return photoPromise;
  photoPromise = new Promise((resolve) => {
    const loader = new THREE.TextureLoader();
    loader.load(
      PHOTO_LOAD_SRC,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.generateMipmaps = false;
        // No desaturation — the file itself is the BW master. If the delivered
        // file is not yet BW, re-export it offline; do not add a live filter here.
        if (photoTexture && photoTexture !== tex) {
          (photoTexture as THREE.Texture).image = tex.image;
          photoTexture.needsUpdate = true;
          photoRealLoaded = true;
          resolve(photoTexture);
        } else {
          photoTexture = tex;
          photoRealLoaded = true;
          resolve(tex);
        }
      },
      undefined,
      () => resolve(null)
    );
  });
  return photoPromise;
}

export function isPhotoRealLoaded(): boolean {
  return photoRealLoaded;
}

// Expose the current load target for the build check (vite plugin can import this)
export function getPhotoLoadSrc(): string {
  return PHOTO_LOAD_SRC;
}
export const PHOTO_FINAL_SRC_EXPORT = PHOTO_FINAL_SRC;
export const PHOTO_PLACEHOLDER_SRC_EXPORT = PHOTO_PLACEHOLDER_SRC;

// ---------------------------------------------------------------------------
// Thumbnail pipeline — real thumbnails via /img/projects/{id}/thumb.jpg
// ---------------------------------------------------------------------------

const thumbCache = new Map<string, THREE.Texture>();
const thumbInflight = new Map<string, Promise<THREE.Texture>>();
let thumbnailAtlas: THREE.Texture | null = null;
let thumbnailAtlasPromise: Promise<THREE.Texture> | null = null;
let scrollIntentFired = false;

export function hasScrollIntent(): boolean {
  return scrollIntentFired;
}
export function markScrollIntent(): void {
  scrollIntentFired = true;
}

export function loadThumbnailTexture(p: Project): Promise<THREE.Texture> {
  const cached = thumbCache.get(p.id);
  if (cached) return Promise.resolve(cached);
  const inflight = thumbInflight.get(p.id);
  if (inflight) return inflight;

  const promise = new Promise<THREE.Texture>((resolve) => {
    const loader = new THREE.TextureLoader();
    const url = p.thumbnail;
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.generateMipmaps = false;
        thumbCache.set(p.id, tex);
        thumbInflight.delete(p.id);
        resolve(tex);
      },
      undefined,
      () => {
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

export async function preloadThumbnails(projects: Project[], concurrency = 4): Promise<void> {
  const pending = projects.filter((p) => !thumbCache.has(p.id) && !thumbInflight.has(p.id));
  if (pending.length === 0) {
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

/** Single texture bound by both spherical views; card geometry supplies its own atlas UVs. */
export function getThumbnailAtlas(): THREE.Texture {
  if (thumbnailAtlas) return thumbnailAtlas;
  // The final atlas replaces this separate fallback texture rather than
  // resizing an already-uploaded WebGL allocation.
  thumbnailAtlas = new THREE.CanvasTexture(getComingSoonFallbackTexture().image as HTMLCanvasElement);
  thumbnailAtlas.colorSpace = THREE.SRGBColorSpace;
  thumbnailAtlas.minFilter = THREE.LinearFilter;
  thumbnailAtlas.magFilter = THREE.LinearFilter;
  thumbnailAtlas.generateMipmaps = false;
  void loadThumbnailAtlas();
  return thumbnailAtlas;
}

export function loadThumbnailAtlas(): Promise<THREE.Texture> {
  if (thumbnailAtlasPromise) return thumbnailAtlasPromise;
  thumbnailAtlasPromise = new Promise((resolve) => {
    const loader = new THREE.TextureLoader();
    const finish = (texture: THREE.Texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      if (thumbnailAtlas && thumbnailAtlas !== texture) {
        thumbnailAtlas = texture;
        resolve(texture);
      } else {
        thumbnailAtlas = texture;
        resolve(texture);
      }
    };
    loader.load(
      THUMBNAIL_ATLAS_AVIF_SRC,
      finish,
      undefined,
      () => loader.load(THUMBNAIL_ATLAS_WEBP_SRC, finish, undefined, () => resolve(getComingSoonTexture())),
    );
  });
  return thumbnailAtlasPromise;
}

export function applyThumbnailAtlasUv(geometry: THREE.BufferGeometry, stableIndex: number) {
  const column = stableIndex % THUMBNAIL_ATLAS_COLUMNS;
  const row = Math.floor(stableIndex / THUMBNAIL_ATLAS_COLUMNS);
  applyUvWindow(geometry, column / THUMBNAIL_ATLAS_COLUMNS, (column + 1) / THUMBNAIL_ATLAS_COLUMNS, (THUMBNAIL_ATLAS_ROWS - row - 1) / THUMBNAIL_ATLAS_ROWS, (THUMBNAIL_ATLAS_ROWS - row) / THUMBNAIL_ATLAS_ROWS);
}

export function applyUvWindow(geometry: THREE.BufferGeometry, u0: number, u1: number, v0: number, v1: number) {
  const uv = geometry.getAttribute("uv") as THREE.BufferAttribute;
  const baseUv = (geometry.userData.baseUv ??= Array.from(uv.array as Float32Array)) as number[];
  for (let index = 0; index < uv.count; index++) {
    const u = baseUv[index * 2];
    const v = baseUv[index * 2 + 1];
    uv.setXY(index, THREE.MathUtils.lerp(u0, u1, u), THREE.MathUtils.lerp(v0, v1, v));
  }
  uv.needsUpdate = true;
}

export function __resetThumbnailPipeline(): void {
  thumbCache.clear();
  thumbInflight.clear();
  thumbnailAtlas = null;
  thumbnailAtlasPromise = null;
  scrollIntentFired = false;
  comingSoonTexture = null;
  comingSoonPromise = null;
  photoTexture = null;
  photoRealLoaded = false;
  photoPromise = null;
}
