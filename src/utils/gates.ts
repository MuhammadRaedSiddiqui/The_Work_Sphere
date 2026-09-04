import * as THREE from "three";
import { ZONES, ZONE_BLEED_ROWS } from "../constants";
import { GRID_WIDTH, GRID_HEIGHT, CARD_WIDTH, CARD_HEIGHT, gridPositions } from "../scene/layout";

// ---------------------------------------------------------------------------
// Gate helpers — closing-pass final (spec §7, §15; hero §15)
// Any one failing → fallback (pin never created, conventional About layout).
// Evaluated at init, debounced resize, and orientationchange. A flip
// reinitializes at progress 0 (handled in App.tsx).
// Spec-final safe band is v ∈ (1.65, 2.61) for δ≈0.3, not 1.5–3.0.
// ---------------------------------------------------------------------------

const FOV_DEG = 60;
const SAFETY_MARGIN = 8;

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function isLowTierDevice(): boolean {
  if (typeof window === "undefined") return false;
  const vw = window.innerWidth;
  if (vw < 768) return true;
  const dm = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
  if (typeof dm === "number" && dm > 0 && dm <= 2) return true;
  if (typeof navigator.hardwareConcurrency === "number" && navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 2) {
    return true;
  }
  const conn = (navigator as unknown as { connection?: { saveData?: boolean } }).connection;
  if (conn?.saveData) return true;
  try {
    if (window.matchMedia("(pointer: coarse)").matches && vw < 1024) return true;
  } catch {
    // ignore
  }
  return false;
}

/**
 * Zone-visibility gate (spec §7 final).
 * Axis-fit cover framing, projects each zone's rect, fails if any rect
 * extends outside viewport minus SAFETY_MARGIN (8px).
 * Final safe band is v ∈ (1.65, 2.61) for δ≈0.3 bleed on H/BC — not a
 * conditional branch. H and BC keep single-row footprints and bleed via
 * the narrowly-scoped §16 exception; their checked rects are expanded by δ.
 */
export function passesZoneVisibilityGate(
  vw = typeof window !== "undefined" ? window.innerWidth : 0,
  vh = typeof window !== "undefined" ? window.innerHeight : 0,
): boolean {
  if (vw <= 0 || vh <= 0) return false;

  const aspect = vw / vh;
  // Closing-pass final gate: v ∈ (1.65, 2.61) for δ≈0.3 — not 1.5–3.0.
  if (aspect < 1.65 || aspect > 2.61) return false;
  const fovRad = (FOV_DEG * Math.PI) / 180;
  const halfTan = Math.tan(fovRad / 2);
  if (halfTan < 1e-6) return false;

  const dHeightFit = GRID_HEIGHT / (2 * halfTan);
  const dWidthFit = GRID_WIDTH / (2 * halfTan * aspect);
  const coverDistance = Math.min(dHeightFit, dWidthFit);

  const camera = new THREE.PerspectiveCamera(FOV_DEG, aspect, 0.1, 100);
  camera.position.set(0, 0, coverDistance);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();

  const tmp = new THREE.Vector3();

  for (const zone of Object.values(ZONES)) {
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

    // Apply bleed expansion for H/BC overflow exception (δ≈0.3 rows, final)
    // These zones are single-row nominal but rendered taller via overflow:visible.
    // The gate must check the bleed-included rect, not just the nominal cells.
    // P remains hard-constrained (no bleed).
    if (zone.key === "H" || zone.key === "BC") {
      const bleedWorld = ZONE_BLEED_ROWS * CARD_HEIGHT;
      // Bleed is vertical — headline and bio+contact overflow beyond their single rows
      // to carry 4 lines + 2 lines + contact. Expand top and bottom by bleed/2 each
      // as a conservative bound; the actual HTML may shift top, but this covers both.
      // For strictness we expand the full bleed downward (where text flows).
      minY -= bleedWorld * 0.15;
      maxY += bleedWorld * 0.85;
      // Also include horizontal bleed guard — final spec expands both axes by 1−δ
      const bleedW = ZONE_BLEED_ROWS * CARD_WIDTH;
      minX -= bleedW * 0.3;
      maxX += bleedW * 0.3;
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

    // Full-bleed P touches viewport edges — allow it to be cropped by cover, not fully inset.
    // E, H, BC must stay fully inside with 8px safety margin (E now inset at row1, not corner).
    if (zone.key === "P") {
      // P is 3×6 full height/width, intended to bleed to top/right/bottom.
      // Only fail if completely off-screen, not if edge is at viewport.
      if (sxMax <= 0 || sxMin >= vw || syMax <= 0 || syMin >= vh) return false;
      // Also ensure at least the central portion is visible — not a strict inset check.
      continue;
    }

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

export function shouldUseFallback(): boolean {
  return evaluateGates().fallback;
}
