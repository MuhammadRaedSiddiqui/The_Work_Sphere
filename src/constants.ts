// Single source of truth for shared layout constants (hero spec §2, §13;
// ring table + grid geometry owned by the transition spec per CLAUDE.md).
export const BACKGROUND_COLOR = 0x0a0a0a;
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

// Zone map — inset crop-safe, outer ring unzoned (§5). Every zone inside rows 1–4, cols 1–6.
export type ZoneKey = "P" | "E" | "H" | "B" | "T" | "C1" | "C2";
export type Zone = { key: ZoneKey; row: number; col: number; rowSpan: number; colSpan: number; indices: number[] };

function indicesFor(row: number, col: number, rowSpan: number, colSpan: number): number[] {
  const out: number[] = [];
  for (let r = row; r < row + rowSpan; r++) for (let c = col; c < col + colSpan; c++) out.push(r * GRID_COLS + c);
  return out;
}

export const ZONES: Record<ZoneKey, Zone> = {
  P: { key: "P", row: 1, col: 1, rowSpan: 3, colSpan: 2, indices: indicesFor(1, 1, 3, 2) },
  E: { key: "E", row: 1, col: 3, rowSpan: 1, colSpan: 3, indices: indicesFor(1, 3, 1, 3) },
  H: { key: "H", row: 2, col: 3, rowSpan: 1, colSpan: 4, indices: indicesFor(2, 3, 1, 4) },
  B: { key: "B", row: 3, col: 3, rowSpan: 1, colSpan: 4, indices: indicesFor(3, 3, 1, 4) },
  T: { key: "T", row: 4, col: 3, rowSpan: 1, colSpan: 2, indices: indicesFor(4, 3, 1, 2) },
  C1: { key: "C1", row: 4, col: 5, rowSpan: 1, colSpan: 1, indices: indicesFor(4, 5, 1, 1) },
  C2: { key: "C2", row: 4, col: 6, rowSpan: 1, colSpan: 1, indices: indicesFor(4, 6, 1, 1) },
};

// Set of all zoned indices (21 cells), photo set (6), text/unzoned distinction
export const ZONED_INDICES = new Set<number>(Object.values(ZONES).flatMap((z) => z.indices));
export const PHOTO_INDICES = new Set<number>(ZONES.P.indices);
export const TEXT_ZONE_INDICES = new Set<number>([...ZONES.E.indices, ...ZONES.H.indices, ...ZONES.B.indices, ...ZONES.T.indices, ...ZONES.C1.indices, ...ZONES.C2.indices]);
export const UNZONED_INDICES = new Set<number>(Array.from({ length: TOTAL_CARDS }, (_, i) => i).filter((i) => !ZONED_INDICES.has(i)));

// Sub-rect position of a photo card within the 2×3 mosaic (colInZone 0–1, rowInZone 0–2)
export function photoSlotUV(slotIndex: number): { colInZone: number; rowInZone: number } | null {
  if (!PHOTO_INDICES.has(slotIndex)) return null;
  const row = Math.floor(slotIndex / GRID_COLS);
  const col = slotIndex % GRID_COLS;
  return { colInZone: col - ZONES.P.col, rowInZone: row - ZONES.P.row };
}

// Production copy for hero overlay and About video wall zones (§6 Overlay UI, §4 zone mapping, §5 state machine)
// Single importable source for all user-facing text; layout/positioning owned by components.
export const heroCopy = {
  wordmark: "Raed Siddiqui",
  nav: ["Work", "Lab", "About", "Contact"] as const,
  headerCta: { label: "Availability", href: "#contact" },
  headline: "Architecting autonomous AI systems\nand high-performance web platforms.",
  primaryCta: { label: "View selected work \u2193", href: "#work" },
  onboardingHint: "Drag to explore the sphere",
} as const;

export const aboutZones = {
  E: { label: "01 \u2014 THE PRACTICE", zone: "E" as const },
  H: { label: "Engineering at the edge of AI and automation.", zone: "H" as const },
  B: { label: "I build autonomous agents and scalable platforms that replace manual overhead with intelligent code.", zone: "B" as const },
  T: { label: "AI AGENTS \u00b7 REACT \u00b7 FASTAPI \u00b7 SYSTEMS", zone: "T" as const },
  C1: { label: "Email", href: "mailto:raedsiddiquie4@gmail.com", zone: "C1" as const },
  C2: { label: "Index", href: "#work", zone: "C2" as const },
} as const;

