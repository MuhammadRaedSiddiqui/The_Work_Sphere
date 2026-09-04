// Single source of truth for shared layout constants (hero spec §2, §13;
// ring table + grid geometry owned by the transition spec per CLAUDE.md).
export const BACKGROUND_COLOR = 0x000000;
export const CARD_FILL_COLOR = 0x33333a;

// Card aspect is 3:2 (w:h) — locked; the 8×6 grid's native aspect of 2.0
// derives from it and the transition spec's gate math depends on it.
export const CARD_ASPECT = 3 / 2;

// Cards per latitude ring, north to south. Sums to 48.
export const RING_TABLE: readonly number[] = [4, 8, 12, 12, 8, 4];
export const CARD_COUNT = RING_TABLE.reduce((a, b) => a + b, 0);

// Target flat layout: 8 columns × 6 rows, row-major (row = floor(i/8), col = i%8).
export const GRID_COLS = 8;
export const GRID_ROWS = 6;

export const TOTAL_CARDS = CARD_COUNT;

// Progress budget (v2, §6): flight 0–0.62 · arrival 0.62–0.74 · blueprint 0.74–0.82 · reveal 0.82–0.94 · settled 0.94–1.0
export const FLIGHT_END = 0.62;
export const ARRIVAL_END = 0.74;
export const BLUEPRINT_END = 0.82;
export const REVEAL_END = 0.94;

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
