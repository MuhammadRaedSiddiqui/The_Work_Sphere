# CLAUDE.md

## What you're building

A **personal portfolio** for a developer/designer. Single purpose: showcase the owner's own projects to employers, clients, and collaborators. Not a general template — do not generalize it toward e-commerce or B2B SaaS patterns.

The experience has two connected parts:

1. **Hero:** the camera sits **inside** a hollow sphere of 48 rectangular project cards arranged in latitude rings. It idles with slow rotation + subtle wobble, can be drag-spun with momentum, cards expand to a fullscreen project view on click, and there's an inside/outside orbit toggle.
2. **Scroll transition (the hard part):** scrolling past the hero **pins and scrubs** a transition that dismantles the sphere and reassembles the same 48 cards into a flat 8×6 **video wall** that *is* the About section — cards are the display surface, not a backdrop. Reverse-scrolling plays it backward.

**Dark theme, site-wide, no light/dark toggle.** Background `#0A0A0A`, card fill `#33333A`, idle edge stroke ~30–35% white opacity. These are tested values — earlier fainter values rendered as solid black.

## Source of truth

The full specs live in `/specs/`:
- `/specs/3d-sphere-cta-prompt.md` — hero sphere
- `/specs/sphere-to-about-transition-spec.md` — the scroll transition

Read the relevant spec section before each task. **The specs reflect FINAL (v2) decisions.** If any older content conflicts with the "Locked decisions" below, the locked decisions win — do not regress to earlier versions.

## Tech stack

- **React + TypeScript** (see `Project` type in hero spec §13).
- **Three.js** (or react-three-fiber) for the sphere/cards. Not CSS 3D transforms, not `OrbitControls` for drag.
- **GSAP `ScrollTrigger`** (`pin: true`, `scrub: ~0.6`) for the pin-and-scrub transition.
- Connector lines: one `THREE.LineSegments`, `transparent: true, depthWrite: false, depthTest: true`.

## Locked decisions — do not regress

**Geometry**
- 48 cards. Ring distribution is the fixed table `[4, 8, 12, 12, 8, 4]` (owned by the transition spec) — NOT a rounded `cos(θ)` formula (that can't hit 48).
- Card aspect **3:2** → flat grid native aspect **2.0**. Don't change without re-running the gate math.
- Sphere↔grid mapping is decoupled: stable index 0–47; grid position is row-major (`row = floor(i/8)`, `col = i%8`), always a clean 8×6.

**Transition mechanism**
- Pin-and-scrub, smoothed `scrub ≈ 0.6`, pin distance ≈ 4× viewport. Progress 0 = sphere, 1 = settled wall. Reverse is free.
- **Progress budget (v2):** flight `0–0.62` · arrival-fade-to-black `0.62–0.74` · blueprint `0.74–0.82` · content reveal `0.82–0.94` · settled buffer `0.94–1.0`. (Older 0.85/0.90/0.92 values are superseded.)
- Thumbnails persist through flight; fade to black happens **after** arrival, as an animated fade, never a hard cut.
- Camera framing is **axis-fit cover**: `distance = min(dHeightFit, dWidthFit)` where `dHeightFit = gridH/(2·tan(fov/2))`, `dWidthFit = gridW/(2·tan(fov/2)·aspect)`. Do NOT use `min(vw/GW, vh/GH)` — that's contain and letterboxes.

**Zone map (v2 inset, crop-safe)** — every zone inside rows 1–4, cols 1–6; outer ring is unzoned black crop buffer:
```
 .  .  .  .  .  .  .  .
 .  P  P  E  E  E  .  .
 .  P  P  H  H  H  H  .
 .  P  P  B  B  B  B  .
 .  .  .  T  T  C1 C2 .
 .  .  .  .  .  .  .  .
```
- P = photo mosaic (2×3, rows 1–3 cols 1–2) · E = eyebrow · H = headline · B = bio · T = tagline · C1/C2 = buttons.
- **Bio is a one-liner** (currently "I build autonomous agents and scalable platforms that replace manual overhead with intelligent code.") — copy is tunable, the one-line row constraint is not.
- Only the photo zone ever shows imagery once settled. Text-zone and unzoned cards are solid black, permanently. Text is real HTML positioned to the zone's projected bounding box, never rasterized into textures.
- Production copy for hero overlay and wall zones is centralized in `src/constants.ts:heroCopy` / `aboutZones` and consumed by both the scrub wall and `FallbackAbout`; roster identity/order is authoritative in `src/data/projects.ts` + hero spec Appendix B.

**Photo mosaic**
- One shared texture; per-card UV sub-rects with ~3–4% inset bezel. Seams are the bezel, not spacing gaps. Computed once at build/load, not per-frame.

**Gates & fallback**
- Zone-visibility gate: project each zone's rect under cover framing; fall back if any extends outside viewport − 8px. Safe aspect band ≈ 1.5–3.0.
- Fallback = skip the pin entirely (hero keeps natural height), conventional About layout reusing the same content. Never create a dead pin spacer.
- Also fall back on `prefers-reduced-motion` and the low-end/mobile device tier (hero §15).

**Interaction routing (by progress)**
- Drag/click-to-expand/card-tab-order lock past `p > 0.02`. Toggle hidden by `p = 0.10`. C1/C2 buttons live from `p ≥ 0.82`. Restoration on scroll-back is symmetric.
- Pin end: wall unpins and scrolls away like a normal section; WebGL render pauses off-screen.

## Critical pitfalls (learned from build testing — don't rediscover)

1. **Connector lines** need `depthTest: true, depthWrite: false` AND cards must NOT be `transparent: true`, or occlusion breaks between inside/outside views.
2. **Text zones** overflow and get strikethrough artifacts unless hard-constrained on both axes (`max-width`/`max-height`) with line-height derived from projected row height.
3. **Edge strokes** must ease to **exactly 0** on text/unzoned cards during reveal — not back to idle ~30–35%. Verify the ease-down is actually wired and targets 0. Photo-zone seams are exempt (they're real slice gaps).
4. **Momentum vs idle-resume** are two different trigger points: momentum applies synchronously on `pointerup` (zero delay); idle rotation resumes only when momentum decays near zero (a per-frame condition, not a timer). Don't conflate.
5. **Drag sign flip** in outside mode: negate `dx`/`dy` before the rotation math, or drag feels inverted.
6. Canvas needs `touch-action: none`, or browser gesture delay looks like a code pause.

## Build order (work one phase at a time)

Phase 0 Scaffold & data → Phase 1 Hero sphere alive → **Phase 2 Scrub vertical slice (KILL-SWITCH)** → Phase 3 Expand flow → Phase 4 Inside/outside toggle → Phase 5 Transition production → Phase 6 Gates & fallback → Phase 7 Assets & performance.

**Phase 2 is the go/no-go for the whole concept.** Get position-lerp + spacing + axis-fit cover camera on a scrub feeling right before building anything else. Do not advance past a phase whose checkpoint fails.

## How to work

- Read the spec section for the current phase before writing code.
- Build one phase at a time; confirm its checkpoint before moving on.
- Do not build the whole system in one pass. Do not add features outside the current phase's scope.
- Keep continuous properties (position, rotation, spacing, camera) linear to the scrub; the arrival-fade and stroke-boost are the only authored beats.
- Read scroll in the scroll callback; apply interpolation in `requestAnimationFrame`, never in the handler.

## Out of scope

- Light/dark toggle, screen-reader list view / ARIA live narration, mobile zone remapping (fallback covers it instead), starfield background, brand-color CTAs in the expanded panel.