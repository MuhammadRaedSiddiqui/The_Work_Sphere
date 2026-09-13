// Single source of truth for shared layout constants (hero spec §2, §13;
// ring table + grid geometry owned by the transition spec per CLAUDE.md).
export const BACKGROUND_COLOR = 0x000000;
export const CARD_FILL_COLOR = 0x33333a;
export const IDLE_STROKE_OPACITY = 0.33;
export const CONNECTOR_LINE_OPACITY = 0.16;
export const OUTSIDE_CONNECTOR_LINE_OPACITY = 0.20;

// Typography is intentionally limited to one display voice and one utility
// voice across Hero, About, Work, and Close.
export const DISPLAY_FONT_FAMILY = 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
export const LABEL_FONT_FAMILY = 'ui-monospace, "SFMono-Regular", Consolas, "Liberation Mono", monospace';
export const CONTROL_PILL_RADIUS_PX = 999;

// Card aspect is 3:2 (w:h) — locked; the 8×6 grid's native aspect of 2.0
// derives from it and the transition spec's gate math depends on it.
const CARD_ASPECT_WIDTH = 3;
const CARD_ASPECT_HEIGHT = 2;
export const CARD_ASPECT = CARD_ASPECT_WIDTH / CARD_ASPECT_HEIGHT;

// Cards per latitude ring, north to south. Sums to 48.
export const RING_TABLE: readonly number[] = [4, 8, 12, 12, 8, 4];
export const CARD_COUNT = RING_TABLE.reduce((a, b) => a + b, 0);
// Closed same-ring loops plus bidirectional nearest-neighbour links between
// adjacent rings. This mirrors buildConnectorPairs() without importing layout
// (which itself depends on these constants).
export const CONNECTOR_SEGMENT_COUNT = CARD_COUNT + RING_TABLE.slice(1).reduce(
  (count, ringSize, index) => count + Math.max(RING_TABLE[index], ringSize),
  0,
);
export const COMING_SOON_IMAGE_SRC = "/img/coming-soon.jpg";

// Target flat layout: 8 columns × 6 rows, row-major (row = floor(i/8), col = i%8).
export const GRID_COLS = 8;
export const GRID_ROWS = 6;
export const GRID_ASPECT = (GRID_COLS * CARD_ASPECT_WIDTH) / (GRID_ROWS * CARD_ASPECT_HEIGHT);

export const TOTAL_CARDS = CARD_COUNT;

export const LANES = ["ai", "tools", "apps"] as const;
export const LANE_DISPLAY_NAMES = {
  ai: "AI",
  tools: "Tools",
  apps: "Apps",
} as const;
export const LANE_COUNTS = {
  ai: 14,
  tools: 22,
  apps: 12,
} as const;

// Work index layout and motion. Kept here so its two renderers do not drift.
export const WORK_RAIL_WIDTH_PX = 320;
export const WORK_RAIL_STACK_BREAKPOINT_PX = 980;
export const WORK_RAIL_CROSSFADE_SWAP_MS = 100;
export const WORK_INDEX_PAGE_SIZE = 10;
export const WORK_STATUS_FILTERS = ["shipped", "in-progress", "planned"] as const;
export const WORK_STACK_FILTERS = ["TypeScript", "Python", "Rust", "Go"] as const;

// Closing section reveal and layout.
export const CLOSING_CARD_MAX_WIDTH_PX = 560;
export const CLOSING_CARD_MAX_VIEWPORT_WIDTH = 92;
export const CLOSING_CARD_PADDING_MIN_PX = 26;
export const CLOSING_CARD_PADDING_VIEWPORT_WIDTH = 4.4;
export const CLOSING_CARD_PADDING_MAX_PX = 40;
export const CLOSING_REVEAL_THRESHOLD = 0.55;
export const CLOSING_REVEAL_DELAY_MS = 520;
export const CLOSING_PLACEHOLDER_FADE_MS = 850;
export const CLOSING_BODY_REVEAL_DELAY_MS = 300;
export const CLOSING_BODY_REVEAL_MS = 750;
export const CLOSING_BODY_REVEAL_TRANSLATE_Y_PX = 6;
export const CLOSING_BORDER_REVEAL_DELAY_MS = 500;
export const CLOSING_BORDER_REVEAL_MS = 500;
export const CLOSING_REVEALED_STROKE_OPACITY = 0.62;
export const CLOSING_COLOPHON_REVEAL_DELAY_MS = 750;
export const CLOSING_COLOPHON_REVEAL_MS = 450;
export const CLOSING_COPY_RESET_MS = 1600;
export const CLOSING_CARD_FLIP_MS = 700;
export const CLOSING_MOTIF_RING_COUNT = 34;

// The shared thumbnail atlas is row-major by stable index (same 8×6 map as the wall).
export const THUMBNAIL_ATLAS_COLUMNS = GRID_COLS;
export const THUMBNAIL_ATLAS_ROWS = GRID_ROWS;
export const THUMBNAIL_ATLAS_AVIF_SRC = "/img/projects/thumbnail-atlas.avif";
export const THUMBNAIL_ATLAS_WEBP_SRC = "/img/projects/thumbnail-atlas.webp";

// Progress budget (v2, §6): flight 0–0.62 · arrival 0.62–0.74 · blueprint 0.74–0.82 · reveal 0.82–0.94 · settled 0.94–1.0
export const INTERACTION_LOCK_EPSILON = 0.02;
export const FOCUS_ROTATION_LERP = 0.11;
export const FOCUS_ROTATION_EPSILON = 0.004;
export const FOCUS_PITCH_SCALE = 0.55;
export const FOCUS_PITCH_LIMIT = 0.55;
export const TOGGLE_HIDE_END = 0.10;
export const HERO_HEADLINE_FADE_END = 0.12;
export const FLIGHT_END = 0.62;
export const ARRIVAL_END = 0.74;
export const BLUEPRINT_END = 0.82;
export const REVEAL_END = 0.94;

export const DEVICE_TIER_GATE = {
  minViewportWidth: 768,
  maxDeviceMemory: 2,
  maxHardwareConcurrency: 2,
} as const;

export const ZONE_GATE_FOV_DEG = 60;
export const ZONE_GATE_SAFETY_MARGIN_PX = 8;

// Zone map — closing-pass final (spec §5) — full-bleed fix.
// Three zones: P (photo, right 3 cols full height touches top/right/bottom), H (headline, left 4 cols single-row nominal),
// BC (bio+contact, left 4 cols single-row nominal at row 4). No E, no T.
export type ZoneKey = "P" | "H" | "BC";
export type Zone = { key: ZoneKey; row: number; col: number; rowSpan: number; colSpan: number; indices: number[] };

function indicesFor(row: number, col: number, rowSpan: number, colSpan: number): number[] {
  const out: number[] = [];
  for (let r = row; r < row + rowSpan; r++) for (let c = col; c < col + colSpan; c++) out.push(r * GRID_COLS + c);
  return out;
}

// Closing-pass editorial map (spec §5 final) — full-bleed per user fix:
// - P: 3 cols × 6 rows, rows 0–5, cols 5–7 → 18 cards, touches top/right/bottom, full height, single unsliced BW portrait
// - H: 1 row × 4 cols, row 2, cols 1–4 → 4 cards nominal, rendered 4 lines with bleed δ≈0.3
// - BC: 1 row × 4 cols, row 4, cols 1–4 → 4 cards nominal, bio (2 lines) + contact underlined with bleed
export const ZONES: Record<ZoneKey, Zone> = {
  P: { key: "P", row: 0, col: 5, rowSpan: 6, colSpan: 3, indices: indicesFor(0, 5, 6, 3) },
  H: { key: "H", row: 2, col: 1, rowSpan: 1, colSpan: 4, indices: indicesFor(2, 1, 1, 4) },
  BC: { key: "BC", row: 4, col: 1, rowSpan: 1, colSpan: 4, indices: indicesFor(4, 1, 1, 4) },
};

// Set of all zoned indices (26 nominal: 18P + 4H + 4BC), photo set, text distinction
export const ZONED_INDICES = new Set<number>(Object.values(ZONES).flatMap((z) => z.indices));
export const PHOTO_INDICES = new Set<number>(ZONES.P.indices);
export const TEXT_ZONE_INDICES = new Set<number>([...ZONES.H.indices, ...ZONES.BC.indices]);
export const UNZONED_INDICES = new Set<number>(Array.from({ length: TOTAL_CARDS }, (_, i) => i).filter((i) => !ZONED_INDICES.has(i)));

// Gate bleed for H/BC overflow exception — δ≈0.3 row-heights, final (spec §5, §7, §16)
export const ZONE_BLEED_ROWS = 0.3;

function deriveRawZoneGateBand(): readonly [number, number] {
  // Cover framing makes this structural aspect calculation independent of FOV.
  // The pixel safety margin is applied by passesZoneVisibilityGate to the projected rects,
  // where viewport dimensions are available.
  const halfFovTangent = Math.tan((ZONE_GATE_FOV_DEG * Math.PI) / 360);
  if (!Number.isFinite(halfFovTangent) || halfFovTangent <= 0) {
    throw new Error("ZONE_GATE_FOV_DEG must produce a finite positive projection scale.");
  }

  const safeBuffer = 1 - ZONE_BLEED_ROWS;
  const halfColumns = GRID_COLS / 2;
  const halfRows = GRID_ROWS / 2;
  const minAspect = GRID_ASPECT * (1 - safeBuffer / halfColumns);
  const maxAspect = (halfRows * GRID_ASPECT) / (halfRows - safeBuffer);
  return [minAspect, maxAspect] as const;
}

const rawZoneGateBand = deriveRawZoneGateBand();
// The gate contract is published to two decimal places; preserve that shipped cutoff.
export const ZONE_GATE_BAND = rawZoneGateBand.map((value) => Math.round(value * 100) / 100) as [number, number];

if (import.meta.env.DEV) {
  const derivedValueTolerance = 1e-9;
  const [zoneGateMin, zoneGateMax] = ZONE_GATE_BAND;
  if (Math.abs(GRID_ASPECT - 2) > derivedValueTolerance) {
    throw new Error("GRID_ASPECT changed: check GRID_COLS, GRID_ROWS, CARD_ASPECT_WIDTH, and CARD_ASPECT_HEIGHT.");
  }
  if (Math.abs(zoneGateMin - 1.65) > derivedValueTolerance || Math.abs(zoneGateMax - 2.61) > derivedValueTolerance) {
    throw new Error("ZONE_GATE_BAND changed: check GRID_COLS, GRID_ROWS, CARD_ASPECT_WIDTH, CARD_ASPECT_HEIGHT, and ZONE_BLEED_ROWS. ZONE_GATE_FOV_DEG and ZONE_GATE_SAFETY_MARGIN_PX are enforced by the projection gate.");
  }
}

// Photo zone helper — single unsliced image spanning the aggregate rect (§4 final).
// Each of the 18 cards maps a continuous sub-rect with no inset, no bezel.
// Returns normalized UV bounds for the card's portion of the full-zone image.
export function photoSliceUV(slotIndex: number): { u0: number; u1: number; v0: number; v1: number } | null {
  if (!PHOTO_INDICES.has(slotIndex)) return null;
  const row = Math.floor(slotIndex / GRID_COLS);
  const col = slotIndex % GRID_COLS;
  const colInZone = col - ZONES.P.col; // 0–1
  const rowInZone = row - ZONES.P.row; // 0–3
  const uSlice = 1 / ZONES.P.colSpan; // 0.5
  const vSlice = 1 / ZONES.P.rowSpan; // 0.25
  const u0 = colInZone * uSlice;
  const u1 = u0 + uSlice;
  // v 0 is bottom in Three.js UV space; zone row 1 is top → v 0.75–1.0
  const v1 = 1 - rowInZone * vSlice;
  const v0 = v1 - vSlice;
  return { u0, u1, v0, v1 };
}

// Legacy helper retained for any texture code that still imports by old name —
// now delegates to photoSliceUV and discards inset logic. Do not use for new code.
export function photoSlotUV(slotIndex: number): { colInZone: number; rowInZone: number } | null {
  if (!PHOTO_INDICES.has(slotIndex)) return null;
  const row = Math.floor(slotIndex / GRID_COLS);
  const col = slotIndex % GRID_COLS;
  return { colInZone: col - ZONES.P.col, rowInZone: row - ZONES.P.row };
}

// Production copy for hero overlay and About wall zones — single source per spec §16 "one content source, two layouts"
// Tag line T and eyebrow E are removed everywhere (cut, not relocated).
export const heroCopy = {
  wordmark: "Raed Siddiqui",
  nav: ["Work", "Lab", "About", "Contact"] as const,
  headerCta: { label: "Availability", href: "#contact" },
  headline: "Architecting autonomous AI systems\nand high-performance web platforms.",
  primaryCta: { label: "View selected work ↓", href: "#work" },
  onboardingHint: "Drag to explore the sphere",
} as const;

export const aboutZones = {
  H: { label: "Engineering\nat the edge of\nAI and\nAutomation.", zone: "H" as const },
  B: { label: "I build autonomous agents and scalable platforms that replace manual overhead with intelligent code.", zone: "BC" as const },
  C1: { label: "Email", href: "mailto:raedsiddiquie4@gmail.com", zone: "BC" as const },
  C2: { label: "Resume", href: "#work", zone: "BC" as const },
} as const;

// Photo asset paths — closing-pass final (§4, §16 Asset Status)
// - Final portrait: pre-processed black-and-white, real tonal range, static asset (no live filter)
//   Path is /img/about-portrait.png — supplied as PNG, used as PNG, never converted to JPG.
// - Placeholder was /img/about-placeholder-NOT-FINAL.jpg (now replaced by the real PNG).
//   The build check (vite.config.ts plugin + scripts/check-photo-asset.js) enforced the
//   placeholder until the real portrait landed; now the PNG is the source.
export const PHOTO_FINAL_SRC = "/img/about-portrait.png";
export const PHOTO_PLACEHOLDER_SRC = "/img/about-placeholder-NOT-FINAL.jpg";
export const PHOTO_ALT = "Portrait of Raed Siddiqui — studio portrait, black and white, soft even lighting, neutral background, looking directly at camera";
