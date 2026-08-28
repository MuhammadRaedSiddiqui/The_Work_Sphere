import * as THREE from "three";
import { ZONES } from "../constants";
import { GRID_WIDTH, GRID_HEIGHT, CARD_WIDTH, CARD_HEIGHT, gridPositions } from "../scene/layout";

// ---------------------------------------------------------------------------
// Gate helpers — Phase 6 (spec §7, §15; hero §15)
// Any one failing → fallback (pin never created, conventional About layout).
// Evaluated at init, debounced resize, and orientationchange. A flip
// reinitializes at progress 0 (handled in App.tsx).
// ---------------------------------------------------------------------------

const FOV_DEG = 60;
const SAFETY_MARGIN = 8;

/** prefers-reduced-motion gate — matches the media query directly. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Low-end / mobile device tier gate — hero §15 is the single definition site.
 * Heuristic: viewport-width proxy, deviceMemory, hardwareConcurrency, coarse pointer.
 * This mirrors the "lighter ring config" signal; when it fires the transition falls back.
 */
export function isLowTierDevice(): boolean {
  if (typeof window === "undefined") return false;
  const vw = window.innerWidth;

  // 1) Simple viewport-width proxy — phones + narrow tablets.
  //    Hero §15 example was 4×6 cards on mobile; we gate instead of reducing.
  //    This is the primary signal — other heuristics are secondary.
  if (vw < 768) return true;

  // 2) Device memory (Chromium only). Spec §15 / task: ≤2 GB → fallback.
  //    deviceMemory values are discrete (0.25,0.5,1,2,4,8); ≤2 captures low-end.
  const dm = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
  if (typeof dm === "number" && dm > 0 && dm <= 2) return true;

  // 3) Logical cores — ≤2 correlates with low-end Android / cheap laptops.
  //    ≤4 is too aggressive: many mainstream laptops (i5/Ryzen 5) report 4
  //    logical cores but comfortably run the sphere. Gate only at ≤2.
  if (typeof navigator.hardwareConcurrency === "number" && navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 2) {
    return true;
  }

  // 4) Data Saver
  const conn = (navigator as unknown as { connection?: { saveData?: boolean } }).connection;
  if (conn?.saveData) return true;

  // 5) Coarse pointer (touch) + not a large desktop viewport → tablet/phone tier.
  try {
    if (window.matchMedia("(pointer: coarse)").matches && vw < 1024) return true;
  } catch {
    // ignore
  }

  return false;
}

/**
 * Zone-visibility gate (spec §7).
 * Runs the axis-fit cover framing math, projects each zone's bounding rect,
 * and fails if any rect extends outside viewport minus SAFETY_MARGIN (8px).
 * Safe band with GRID_ASPECT 2.0 is ≈ 1.5–3.0 — this function is the precise check.
 */
export function passesZoneVisibilityGate(
  vw = typeof window !== "undefined" ? window.innerWidth : 0,
  vh = typeof window !== "undefined" ? window.innerHeight : 0,
): boolean {
  if (vw <= 0 || vh <= 0) return false;

  const aspect = vw / vh;
  // Task literal: the inset zone map (grid native 2.0) tolerates ±1 row/col crop
  // → safe band 1.5–3.0. Fail fast on aspect before the precise projection check.
  if (aspect < 1.5 || aspect > 3.0) return false;
  const fovRad = (FOV_DEG * Math.PI) / 180;
  const halfTan = Math.tan(fovRad / 2);
  if (halfTan < 1e-6) return false;

  const dHeightFit = GRID_HEIGHT / (2 * halfTan);
  const dWidthFit = GRID_WIDTH / (2 * halfTan * aspect);
  const coverDistance = Math.min(dHeightFit, dWidthFit);

  // Temporary camera at the cover distance looking at origin (same math as SphereScene.computeCoverDistance)
  const camera = new THREE.PerspectiveCamera(FOV_DEG, aspect, 0.1, 100);
  camera.position.set(0, 0, coverDistance);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();

  // Reusable vectors
  const tmp = new THREE.Vector3();

  for (const zone of Object.values(ZONES)) {
    // World-space bounding box of the zone on the z=0 wall plane.
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const idx of zone.indices) {
      const [gx, gy] = gridPositions[idx];
      minX = Math.min(minX, gx - CARD_WIDTH / 2);
      maxX = Math.max(maxX, gx + CARD_WIDTH / 2);
      minY = Math.min(minY, gy - CARD_HEIGHT / 2);
      maxY = Math.max(maxY, gy + CARD_HEIGHT / 2);
    }

    const corners: [number, number][] = [
      [minX, maxY],
      [maxX, maxY],
      [minX, minY],
      [maxX, minY],
    ];

    let sxMin = Infinity;
    let sxMax = -Infinity;
    let syMin = Infinity;
    let syMax = -Infinity;

    for (const [x, y] of corners) {
      tmp.set(x, y, 0).project(camera);
      const sx = (tmp.x * 0.5 + 0.5) * vw;
      const sy = (-tmp.y * 0.5 + 0.5) * vh;
      sxMin = Math.min(sxMin, sx);
      sxMax = Math.max(sxMax, sx);
      syMin = Math.min(syMin, sy);
      syMax = Math.max(syMax, sy);
    }

    // Visibility gate: any edge outside viewport minus margin → fail the gate.
    if (sxMin < SAFETY_MARGIN || sxMax > vw - SAFETY_MARGIN || syMin < SAFETY_MARGIN || syMax > vh - SAFETY_MARGIN) {
      return false;
    }
  }

  return true;
}

export type GateReason = "pass" | "reduced-motion" | "device-tier" | "zone-visibility";

export function evaluateGates(): { fallback: boolean; reason: GateReason } {
  if (prefersReducedMotion()) return { fallback: true, reason: "reduced-motion" };
  if (isLowTierDevice()) return { fallback: true, reason: "device-tier" };
  if (!passesZoneVisibilityGate()) return { fallback: true, reason: "zone-visibility" };
  return { fallback: false, reason: "pass" };
}

/** Convenience — true means we should render the fallback (pin never created). */
export function shouldUseFallback(): boolean {
  return evaluateGates().fallback;
}
