import type { CardSlot } from "./layout";

export type CardNavigationKey = "next" | "previous" | "nextRing" | "previousRing" | "first" | "last";

/**
 * Moves through sphere slots while preserving a card's fractional angular
 * position when crossing rings. `availableSlotIndices` lets future filtered
 * consumers skip unavailable slots without changing the ring geometry.
 */
export function walkCardRing(
  slots: readonly CardSlot[],
  currentSlotIndex: number,
  key: CardNavigationKey,
  availableSlotIndices: ReadonlySet<number> = new Set(slots.map((slot) => slot.index)),
): number {
  const current = slots.find((slot) => slot.index === currentSlotIndex);
  if (!current || !availableSlotIndices.has(current.index)) return firstAvailableSlot(slots, availableSlotIndices, currentSlotIndex);

  const rings = groupSlotsByRing(slots);
  const currentRing = rings[current.ring] ?? [];
  const availableCurrentRing = currentRing.filter((slot) => availableSlotIndices.has(slot.index));
  if (availableCurrentRing.length === 0) return current.index;

  if (key === "first") return availableCurrentRing[0].index;
  if (key === "last") return availableCurrentRing[availableCurrentRing.length - 1].index;
  if (key === "next" || key === "previous") {
    const offset = key === "next" ? 1 : -1;
    const position = availableCurrentRing.findIndex((slot) => slot.index === current.index);
    return availableCurrentRing[(position + offset + availableCurrentRing.length) % availableCurrentRing.length].index;
  }

  const targetRingIndex = current.ring + (key === "nextRing" ? 1 : -1);
  const targetRing = rings[targetRingIndex];
  if (!targetRing) return current.index;
  const desiredPosition = Math.min(targetRing.length - 1, Math.floor((current.indexInRing / currentRing.length) * targetRing.length));
  return nearestAvailableSlot(targetRing, desiredPosition, availableSlotIndices)?.index ?? current.index;
}

function groupSlotsByRing(slots: readonly CardSlot[]) {
  const rings: CardSlot[][] = [];
  for (const slot of slots) (rings[slot.ring] ??= []).push(slot);
  return rings;
}

function nearestAvailableSlot(ring: readonly CardSlot[], desiredPosition: number, available: ReadonlySet<number>) {
  for (let distance = 0; distance < ring.length; distance++) {
    const clockwise = ring[(desiredPosition + distance) % ring.length];
    if (available.has(clockwise.index)) return clockwise;
    const anticlockwise = ring[(desiredPosition - distance + ring.length) % ring.length];
    if (available.has(anticlockwise.index)) return anticlockwise;
  }
  return null;
}

function firstAvailableSlot(slots: readonly CardSlot[], available: ReadonlySet<number>, fallback: number) {
  return slots.find((slot) => available.has(slot.index))?.index ?? fallback;
}
