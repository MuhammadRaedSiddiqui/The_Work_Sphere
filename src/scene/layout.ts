import { RING_TABLE, CARD_ASPECT, GRID_COLS, GRID_ROWS } from "../constants";

export const SPHERE_RADIUS = 7;
export const CARD_WIDTH = 2.2;
export const CARD_HEIGHT = CARD_WIDTH / CARD_ASPECT; // 3:2 in world space

// Flat wall geometry — 8×6 grid, row-major. Centered at origin in the XY plane (z=0).
// Spacing is zero at p=1 (§9: spacing→0), so gridWidth/Height are exactly cols×cardW.
export const GRID_WIDTH = GRID_COLS * CARD_WIDTH;
export const GRID_HEIGHT = GRID_ROWS * CARD_HEIGHT;

export function gridPositionForIndex(index: number): [number, number, number] {
  const row = Math.floor(index / GRID_COLS);
  const col = index % GRID_COLS;
  const x = -GRID_WIDTH / 2 + CARD_WIDTH / 2 + col * CARD_WIDTH;
  const y = GRID_HEIGHT / 2 - CARD_HEIGHT / 2 - row * CARD_HEIGHT;
  return [x, y, 0];
}

export const gridPositions: [number, number, number][] = Array.from(
  { length: GRID_COLS * GRID_ROWS },
  (_, i) => gridPositionForIndex(i)
);

export type CardSlot = {
  index: number; // stable 0–47
  ring: number;
  indexInRing: number;
  theta: number; // latitude
  phi: number; // longitude
  position: [number, number, number]; // base (unrotated) position
};

// Latitude rings evenly spaced from -90° to +90°, band centers (poles skipped).
const ringLatitudes = RING_TABLE.map(
  (_, k) => (-90 + (k + 0.5) * (180 / RING_TABLE.length)) * (Math.PI / 180)
);

export const cardSlots: CardSlot[] = (() => {
  const slots: CardSlot[] = [];
  let index = 0;
  RING_TABLE.forEach((count, ring) => {
    const theta = ringLatitudes[ring];
    for (let i = 0; i < count; i++) {
      const phi = i * ((Math.PI * 2) / count);
      const r = SPHERE_RADIUS * Math.cos(theta);
      slots.push({
        index: index++,
        ring,
        indexInRing: i,
        theta,
        phi,
        position: [r * Math.cos(phi), SPHERE_RADIUS * Math.sin(theta), r * Math.sin(phi)],
      });
    }
  });
  return slots;
})();

// Connector pairs (§3): same-ring neighbors (closed latitude circles) plus
// nearest-φ matches in adjacent rings (many-to-many toward the poles).
export function buildConnectorPairs(): [number, number][] {
  const pairs: [number, number][] = [];
  const key = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const seen = new Set<string>();
  const add = (a: number, b: number) => {
    const k = key(a, b);
    if (!seen.has(k)) {
      seen.add(k);
      pairs.push([a, b]);
    }
  };

  const byRing: CardSlot[][] = RING_TABLE.map((_, r) =>
    cardSlots.filter((s) => s.ring === r)
  );

  // Left/right within each ring (wrap closes the circle).
  for (const ring of byRing) {
    for (let i = 0; i < ring.length; i++) {
      add(ring[i].index, ring[(i + 1) % ring.length].index);
    }
  }

  // Top/bottom: nearest-φ in the adjacent ring, added from both directions so
  // every card in the smaller ring stays attached (spec: not 1:1).
  const nearestByPhi = (from: CardSlot, ring: CardSlot[]) =>
    ring.reduce((best, c) =>
      Math.abs(((c.phi - from.phi + Math.PI * 3) % (Math.PI * 2)) - Math.PI) <
      Math.abs(((best.phi - from.phi + Math.PI * 3) % (Math.PI * 2)) - Math.PI)
        ? c
        : best
    );

  for (let r = 0; r < byRing.length - 1; r++) {
    for (const c of byRing[r]) add(c.index, nearestByPhi(c, byRing[r + 1]).index);
    for (const c of byRing[r + 1]) add(c.index, nearestByPhi(c, byRing[r]).index);
  }

  return pairs;
}
