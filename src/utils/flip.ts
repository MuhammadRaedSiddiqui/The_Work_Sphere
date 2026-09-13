export type FlipRectMap = Map<string, DOMRect>;

export type FlipOptions = {
  duration?: number;
  easing?: string;
  stagger?: number;
  maxStagger?: number;
  fromScale?: number;
  fromOpacity?: number;
  reduceMotion?: boolean;
};

/** Capture keyed element rects before a DOM mutation. */
export function captureFlipRects(elements: Iterable<Element>): FlipRectMap {
  const rects: FlipRectMap = new Map();
  for (const element of elements) {
    const key = element.getAttribute("data-flip-key");
    if (key) rects.set(key, element.getBoundingClientRect());
  }
  return rects;
}

/**
 * Animate keyed elements from their captured rects after a layout mutation.
 * Call after React has committed the new layout (normally from a layout effect).
 */
export function animateFlipFromDelta(before: FlipRectMap, elements: Iterable<Element>, options: FlipOptions = {}): Animation[] {
  const { duration = 260, easing = "cubic-bezier(0.22, 1, 0.36, 1)", stagger = 0, maxStagger = duration, fromScale = 1, fromOpacity = 1, reduceMotion = false } = options;
  const animations: Animation[] = [];

  let index = 0;
  for (const element of elements) {
    const key = element.getAttribute("data-flip-key");
    const previous = key ? before.get(key) : undefined;
    if (!previous) continue;
    const next = element.getBoundingClientRect();
    const dx = previous.left - next.left;
    const dy = previous.top - next.top;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && fromScale === 1 && fromOpacity === 1) continue;

    if (!reduceMotion) {
      animations.push(element.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(${fromScale})`, opacity: fromOpacity },
          { transform: "translate(0, 0) scale(1)", opacity: 1 },
        ],
        { duration, easing, delay: Math.min(index * stagger, maxStagger), fill: "both" },
      ));
    }
    index += 1;
  }
  return animations;
}
