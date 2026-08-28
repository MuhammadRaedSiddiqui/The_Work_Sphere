# Scroll-Driven Sphere-to-Screen Transition — Hero → About Section

**Final.** Companion spec to `3d-sphere-cta-prompt.md`, not a standalone page. Covers what happens when a visitor scrolls past the hero sphere: the 48 cards dismantle from their spherical arrangement and reassemble into a flat 8×6 grid that fills the viewport and functions as the About section's actual display surface — the content's medium, the way a real LCD video wall's individual screens combine into one canvas. Scrolling back up reverses it. The transition runs only when the entry gates pass (§7, §15); otherwise the section uses the conventional fallback (§15).

**Prerequisites from the homepage spec:** the card system (48 cards, ring layout) and its wireframe connector lines; the camera-dolly + orientation-slerp technique from the inside/outside toggle (reused here with different framing, §10); the "3D spectacle, then hand off to 2D content" pattern from click-to-expand (refined into panel-anchored content). The homepage spec's scroll section defers the at-sphere case to this document.

### 1. Overview
Extends the "at the sphere, nothing expanded" scroll case. Scrolling past the hero dismantles the sphere and reassembles the same 48 cards into a flat grid covering the screen — a video wall. Once settled, only the photo zone shows imagery; every other panel — text zones and unzoned cells alike — is solid black, with real HTML text floating over its assigned block. Scrolling back up reverses everything, including content dissolving back into ordinary project cards before the sphere re-forms.

### 2. Mechanism — Pin-and-Scrub
The hero section pins for a scroll distance long enough to play the full transition (starting point ≈ 4× viewport height, tuned against beat legibility); scroll position within the pin maps directly to progress (0 = sphere, 1 = settled wall). Reverse scrolling is free — progress decreases and everything plays backward, no separate reverse logic. Use a **smoothed scrub** (e.g. GSAP `scrub: 0.6`) rather than direct: the slight catch-up rides over wheel-notch stepping and keeps the authored beats (§6) legible on fast flicks, at the cost of a sub-second reversal lag. A/B on a wheel mouse and a trackpad before locking the value.

### 3. Foundation — Card Aspect, Grid Aspect
Card world-space aspect is **3:2** (owned by the homepage spec §2), making the 8×6 grid's native aspect (8×3)/(6×2) = **2.0** — mid-range among real desktop viewports. Card aspect is the single lever that sets grid aspect, and grid aspect drives both cover framing (§10) and the zone-visibility gate (§7). Changing it invalidates both.

### 4. Content Model — Full-Bleed Video Wall
The cards are the section, not decoration behind it. The full-bleed claim holds within the zone-visibility gate (§7): whenever the gate passes, the wall covers the viewport; when it fails, the section falls back (§15). Settled state, by content type:

- **Photo (mosaic):** one source image sampled across the zone's cards via **UV-inset slices on a single shared texture** — each photo card maps an inset sub-rect (~3–4% of the card's short edge), letting the dark card fill show through as a bezel. The bezel is baked into the mapping, so seams survive zero grid spacing (§9) and never need re-slicing on resize. The bezel carries the tiled-photo aesthetic alone — photo-zone edge strokes fade to zero with everyone else's (§6, State 5).
  - **Open question — portrait slicing (requires explicit answer before build):** this bezel-mosaic mechanism was designed for a textural/abstract image where visible seams are aesthetic. For the editorial portrait (§5) — a large-format professional pose, desaturated (flat grey vs. single-accent duotone over grayscale, both flagged as undecided) — chopping a human face across a visible-seam grid risks fragmentation at eyes/mouth and reads as a defect rather than a motif. Flagged alternatives that the spec must choose among explicitly: **(a)** retain the bezel mosaic as-is; **(b)** fewer, larger slices (e.g. 1×4 single-column strip or 2×2) to keep the tiled idiom but reduce facial cuts; **(c)** single unslit image spanning the zone (one texture stretched across the zone's aggregate rect with no per-card seams, or a single card carrying the image while the remaining zone cards stay black). Do not silently default to (a). Whichever is chosen, desaturation treatment and the §6 State-5 stroke-to-zero rule apply, and any UV-inset math remains baked at build/load.
- **Text (headline, bio, tag line, buttons):** real, selectable HTML, absolutely positioned and sized to the on-screen projected bounding box of its assigned cell block (headline may bleed beyond that box only under the narrowly-scoped exception in §5 option (b)). Cards underneath are solid black permanently — their final resting state, never a thumbnail. Their seams fade fully invisible in State 5; text sits on a clean uniform surface. The tiled-seam aesthetic is reserved for the photo zone (subject to the portrait-slicing decision above). Headline is sized to **dominate** the frame (see §5), with its final word/phrase at reduced contrast — dimmed, not a separate color — as a deliberate trailing-off device; bio stays a one-liner beneath it at secondary/small weight; button and tag-line placement are flagged open in §5.
- **Unzoned:** solid black, identical to text-zone cards, nothing layered on top.

### 5. Content Zone Mapping — Inset, Crop-Safe (Editorial / Type-Led)
**The constraint is law: every zone sits inside rows 1–4, cols 1–6.** The full outer ring (rows 0 and 5, cols 0 and 7) is unzoned black and exists to be cropped by cover framing (§7, §10). Exact cell ranges within that constraint are tunable once on screen; placement outside it is not. Working assumption below is 23 zoned / 25 unzoned (8 P + 3 E + 8 H + 4 B); C1/C2 and T are intentionally **unmapped** pending open decisions — if they re-enter as zoned cards the count rises, if they fold into the header or are cut it stays here.

```
 .  .  .  .  .  .  .  .
 .  E  E  E  .  P  P  .
 .  H  H  H  H  P  P  .
 .  H  H  H  H  P  P  .
 .  B  B  B  B  P  P  .
 .  .  .  .  .  .  .  .
```

- **E — eyebrow** ("01 — THE PRACTICE"): 1×3, row 1, cols 1–3 — small, quiet, above the headline. Retained from prior map but shifted left to free the right column for the portrait. Styling unchanged.
- **P — portrait column (photo):** 2 cols × 4 rows, rows 1–4, cols 5–6 → slice grid 2×4 (8 cards) under the working assumption that the bezel mosaic is retained; if §4 option (b) or (c) is chosen the slice grid becomes 1×4 / 2×2 or a single unslit span. Runs the visual height of the section as a tall column on the **right**, not the former compact 2×3 block on the left (rows 1–3, cols 1–2). Image is a large-format professional pose, **desaturated — flat grey or duotone (single accent over grayscale), both flagged as undecided options**. Reference (illustrative, not final — tune to real type/color scale): portrait column ~28–30% of frame width; text column ~60% with remainder as gutter.
- **H — headline** ("Engineering at the edge of AI and automation." or successor copy — final wording tunable, dominance is not): evaluated against two explicit options that the spec must choose between before build:
  - **(a) More rows (working assumption in the map above):** 2 rows × 4 cols, rows 2–3, cols 1–4 (8 cards), letting the headline's **size dominate the frame** at ~32px/500 weight at mockup scale rather than sitting as a peer to bio/tags. Final word/phrase rendered at reduced contrast — **dimmed to ~15% of base text lightness at mockup scale, not a separate color** — as a deliberate trailing-off device. Under (a) the headline stays fully contained within its assigned cells and respects the existing §16 hard-constrain rule (max-width/max-height, line-height from projected row height).
  - **(b) Keep single-row footprint and bleed:** 1×4, row 2, cols 1–4, but allow the oversized type to **deliberately bleed past the nominal cell boundary** as an accepted device to achieve the same dominance without claiming an extra row. If (b) is chosen, this requires a **narrowly-scoped exception** to §16's "hard-constrain both axes" overflow-collision guard — e.g. `overflow: visible` on the headline zone only, with a bleed allowance δ capped at ~0.25–0.35 row-heights and an explicit re-derivation of the §7 gate (see §7). The global hard-constrain rule otherwise stays intact; do not silently remove it.
  No silent default — record the choice between (a) and (b) explicitly.
- **B — bio** ("I build autonomous agents and scalable platforms that replace manual overhead with intelligent code."): 1×4, row 4, cols 1–4 — one wide row directly under the headline. Content unchanged; copy constraint (one-liner row) is law, same as before. Drops to **secondary / small visual weight** beneath the dominant headline, not a peer.
- **C1 / C2 — buttons** (Email / "Index"): **moved off their current position (row 4, cols 5–6). Map position flagged OPEN.** Working assumption (NOT confirmed): small quiet text links **beneath the bio** — i.e. inline HTML sitting just below B's projected rect, not occupying dedicated grid cells (hence absent from the ASCII map). Alternative, equally viable: **fold into the persistent header nav instead of the wall zones at all** — they would then have no wall cells and be unreachable as zoned cards. Do not assign them to portrait-adjacent cells without an explicit decision; record the choice.
- **T — tag line** ("AI AGENTS · REACT · FASTAPI · SYSTEMS"): **status undecided — early editorial exploration dropped it entirely.** Decide whether it returns and where, or is **cut from this section on purpose**. If kept, candidate placements (pending H decision): row 1, cols 4 with E (sharing the eyebrow row as a secondary tag), or row 4 alongside/just below B at small scale, or omitted in favor of letting the headline's dimmed tail carry the signal. If cut, the zone is unzoned black. Do not silently reintroduce it at its old position (row 4, cols 3–4); that position is now occupied by B/P.

Copy consequence, restated for the editorial direction: the wall is a typographic statement — headline dominates, bio is a one-liner in secondary weight, portrait carries the human presence. Longer copy belongs in the fallback or an expanded view, not on the wall. Reference values above (32px/500, 15% dim, 28–30% / 60% columns) are illustrative mockup-scale anchors, not final tokens — tune to the site's real type and color scale while preserving the dominance ratio.

### 6. Card Content State Machine
Cards keep their thumbnails throughout flight; the swap to black is an animated fade that happens **after** arrival — a deliberate two-beat sequence: grid snaps into formation still showing project imagery, imagery fades to black together, blank-wall pause, then content reveal. Beats are authored against progress sub-ranges (not real-time durations), so they stay synced under variable scroll speed, fast flicks, and reversal.

| Progress | State | What happens |
|---|---|---|
| 0 | **1 — Sphere** | Idle hero state, thumbnails, idle strokes. |
| 0 < p < 0.62 | **2 — Flight** | Thumbnails throughout; edge strokes visible as always; zone destiny not yet apparent. |
| 0.62–0.74 | **3 — Arrived, fading to black** | Grid fully formed at zero spacing, still showing imagery; thumbnails fade to black together — a genuine transition, never a hard cut. |
| 0.74–0.82 | **4 — Blank (blueprint)** | Solid black, no content. Edge-stroke opacity boosted above idle: crisp intentional "blueprint" quality, not a loading state. |
| 0.82–0.94 | **5 — Content reveal** | All edge strokes — photo zone included — fade to **exactly zero**. Photo mosaic fades in via its bezel-inset slices; HTML text fades in on its zones; text/unzoned cards stay solid black. Reads as the wall "switching on" at once. |
| 0.94–1.0 | **Settled buffer** | No visual change. Deliberate dead band: absorbs the last scroll increment so fast flicks can't clip the reveal and pin exit isn't abrupt. |

Reversal plays this exactly backward: content out + strokes boost back (5→4), black back to thumbnails in arrived positions (4→3), thumbnails carried back into flight (3→2), resettling into the sphere (1). Continuous properties (position, rotation, spacing, camera) track the scrub linearly; States 3–5 are the authored exceptions.

### 7. Zone-Visibility Gate
Cover framing crops outer rows/columns first on aspect mismatch. Re-derived from the **new §5 perimeter** rather than assuming the prior (1.5, 3.0) still holds.

- **Working assumption — §5 option (a) (headline claims 2 rows, no bleed):** zoned extent remains rows 1–4, cols 1–6 — the outer ring (rows 0/5, cols 0/7) is still the full crop buffer, even though P is now a 2×4 column on the right (cols 5–6) and H spans rows 2–3 on the left (cols 1–4) instead of the old left-block P / right-block text arrangement. The wall therefore still tolerates up to **1 row cropped per side** vertically and **1 column per side** horizontally before any zoned rect is touched. With grid aspect g = 2.0, cropped depth is `3(v−g)/v` rows/side when viewport aspect v > g, and `4(g−v)/g` cols/side when v < g — so all zoned cells stay visible for **v ∈ (1.5, 3.0)** under strict cell containment: every laptop, desktop, and ultrawide up to 21:9. Tablet-landscape (~1.33) and portrait phones (~0.5) fail and fall back, as intended. The taller, narrower P does not itself shrink the outer buffer — it still stops at row 4 / col 6 — so the band is unchanged *for this option*. This was re-derived, not assumed.
- **If §5 option (b) is chosen (headline keeps 1 row and bleeds):** the headline's projected HTML rect extends beyond its nominal cell by a bleed allowance δ (illustrative δ ≈ 0.25–0.35 row-heights to achieve dominance). Effective vertical buffer then shrinks to **1 − δ rows per side** and, if the bleed also extends horizontally, horizontal buffer similarly. Solving `3(v−g)/v = 1−δ` gives v_max = 3g / (2 + δ); solving `4(g−v)/g = 1−δ` gives v_min = g·(3 + δ)/4. For δ = 0.3, this tightens the safe band to **≈ v ∈ (1.65, 2.61)** instead of (1.5, 3.0). Any bleed therefore requires its own gate re-derivation with the chosen δ and a narrowly-scoped §16 exception; do not ship (b) with the (1.5, 3.0) gate.

**Mechanics:** run the cover-framing math, project each zone's bounding rect (for option (b), the rect includes the bleed), fail the gate if any rect extends outside the viewport minus an 8px safety margin. Evaluate at init, on debounced resize, and on `orientationchange`. If the result flips mid-session, reinitialize the section in the new mode at progress 0. The pin (§2) is only created when this gate passes together with the §15 gates.

### 8. Target Layout — Decoupled Index Mapping
Sphere placement and grid placement are fully decoupled. Each card gets one stable index (0–47) at initialization, driving two independent calculations:

- **Sphere position:** ring math — which ring and position-within-ring the index falls into, using the fixed table `[4, 8, 12, 12, 8, 4]` (sums to exactly 48 while preserving the falloff shape). This table is the single source of truth for ring counts; the homepage's `cos(θ)` formula is shaping rationale only.
- **Grid position:** row-major — `row = floor(index / 8)`, `col = index % 8`. Always exactly an 8×6 rectangle, unconditionally.

A card's sphere ring has no bearing on its grid cell; card identity (the same `Project` record) is consistent across both.

### 9. Position, Rotation, Spacing
- **Position:** lerp sphere position → grid position over the flight band.
- **Rotation:** slerp from whichever orientation mode is active (billboard or tangent-to-surface) to uniform forward-facing.
- **Spacing:** interpolate from the sphere's gap to zero over the same band — the settled wall is tiled edge-to-edge, one continuous surface, no background between cards.

### 10. Camera — Axis-Fit Cover Framing
Solve distance so the grid **covers** the viewport: the closer of the two axis-fit distances, i.e. `distance = min(dHeightFit, dWidthFit)` where `dHeightFit = gridH / (2·tan(fov/2))` and `dWidthFit = gridW / (2·tan(fov/2)·aspect)`. That axis fills exactly; the other overflows and crops into the unzoned perimeter (§5, §7). Uniform card proportions preserved — never stretch cells. Recompute on resize. *(The v1 formula `min(viewportW/gridW, viewportH/gridH)` is the contain scale — do not use it; it letterboxes.)* Photo mapping: UV sub-rect assignment against final grid coordinates (§4), computed once at build/load, independent of the interpolation. Start state: camera, fog, and line opacity depart from live captured state (§11), never hardcoded.

### 11. Starting State — From Either Inside or Outside
A visitor can toggle to outside/orbit view and scroll without switching back; the transition departs from wherever the scene actually is. Camera dollies from its current live position; fog/vignette cross-fade from whichever pair is active; line opacity starts from its current live value. **Mid-toggle interruption:** if scrolling begins while the toggle's animation is in flight, the scroll-transition takes over immediately, treating the interrupted state as its start — never let both drive the camera at once. **Side effect:** scrolling back to progress 0 returns the visitor to whichever mode they were actually in, because the "from" state is real captured state, not a preset.

### 12. Connector Lines, Fog, Vignette
All three resolve to nothing by completion — expected: the settled wall is a flat, opaque, gap-free surface with nothing left for them to act on. Background color stays on the hero's dark treatment throughout.
- **Connector lines:** fade to zero in lockstep with spacing reaching zero (§9), not on an independent schedule.
- **Fog:** fades out approaching the flat state; no meaningful depth variation remains.
- **Vignette:** fades out for the same reason; nothing beyond the wall's edges to darken.

### 13. Overlay UI During the Transition
All keyed off the same progress value — no separate scroll listener.
- **Header** (logo, nav, header CTA pill): persists unchanged above the wall at all progress.
- **Hero headline + CTA:** fades out over **0–0.12**, well before flattening completes. Distinct from the About headline (zone H) — retired, not morphed.
- **Onboarding hint:** dismisses on scroll start, same fade logic as first-drag dismissal.
- **Inside/outside toggle:** disabled and hidden by **p = 0.10**; restored when progress returns below 0.10 on scroll-back.

### 14. Interaction Routing by Progress

| Input | p = 0 | 0 < p < 0.62 | 0.62–0.94 | p ≥ 0.94 |
|---|---|---|---|---|
| Drag-to-spin | ✓ hero spec | Disabled past p > 0.02 | Disabled | Disabled |
| Card click-to-expand | ✓ hero §9 | Disabled past p > 0.02 | Disabled | Disabled, incl. photo zone |
| Cards in tab order | ✓ hero §14 | Removed at p > 0.02 | Removed | Removed |
| Inside/outside toggle | ✓ | Hidden by 0.10 | Hidden | Hidden |
| Escape | Closes expanded | no-op | no-op | no-op |
| C1 / C2 buttons | — | — | — | Live from **p ≥ 0.82** |
| Scroll | Scrubs | Scrubs | Scrubs | Scrubs to 1.0, then unpins (§15) |

- The **0.02 epsilon** tolerates pointer/scroll jitter at the boundary.
- **Drag specifically:** sphere-group rotation is the *from* end of the position lerp; dragging mid-flight moves the origin while destinations are fixed and cards swim. Off, hard, at flight start.
- **Restoration is symmetric:** below 0.02 on scroll-back, drag, tab order, and toggle all return.
- **Photo zone when settled:** scenery, not navigation — not clickable.

### 15. Pin-End Handoff, Risk & Fallback
**Pin-end:** the About wall is exactly one viewport of content; nothing scrolls inside it. At p = 1 the pin releases and the wall **unpins and scrolls away like an ordinary section**, the next section following beneath. All zone HTML lives **inside the pinned wrapper**. WebGL rendering **pauses once the wall is fully off-screen**, resumes on re-entry. C1/C2 remain live during the scroll-away.

**Risk:** highest-risk piece of the system; budget real testing time for feel, not just function. Scroll-hijacking is easy to get wrong on mobile Safari and trackpads, and this transition syncs many properties off one progress value. Build order: get position lerp + spacing + cover camera on a scrub working first. iOS Safari pinning needs real-device time specifically.

**Gates — any one fails → fallback:** (1) `prefers-reduced-motion`; (2) low-end/mobile device tier (homepage §15 is the single definition site); (3) zone-visibility gate (§7).

**Fallback layout:**
- **The pin is never created** — gate the ScrollTrigger construction itself, not just the animation. Hero takes its natural 100vh height; no pin spacer, no scrub listener.
- **One content source, two layouts:** the zone content is the same real HTML used by the WebGL mode, restyled with conventional CSS instead of projected coordinates. Nothing duplicated; SEO and screen readers get the content either way.
- **Photo:** a single normal image, not a mosaic (desaturation — flat grey vs. duotone — still applies per §5).
- **Layout:** desktop — two columns, **text stack left, photo right** (mirrors the primary WebGL wall's left-dominant headline / right portrait column, §5). Prior fallback spec had this reversed (photo left, text right); that is corrected here so fallback does not contradict the primary editorial layout. If an intentional divergence were desired, it would need explicit rationale — none is claimed. Mobile — single-column stack, photo first (top). Same dark theme and ghost-button treatment (or quiet-text treatment if C1/C2 resolve to that).
- **Entrance:** none, or a single opacity fade.

### 16. Implementation Notes
- **Scroll-linking:** GSAP `ScrollTrigger` (`pin: true`, `scrub: ~0.6`); Framer Motion `useScroll`/`useTransform` as the React-native alternative.
- **Single source of truth:** implement §6 as one declarative timeline scrubbed by ScrollTrigger, animating a small set of driver scalars; one rAF reads them and applies per-card math. Don't scatter `progress → value` functions.
- **Read scroll, apply in rAF:** read progress in the scroll callback; apply interpolation inside `requestAnimationFrame`, never in the handler.
- **Capture live state at scroll start (§11):** read camera position/quaternion and fog off the live objects; interrupt a mid-flight toggle rather than letting both drive the camera.
- **Arrival fade:** genuine opacity/material animation keyed to 0.62–0.74, triggered at arrival, not departure. Text-zone and unzoned indices should **never be assigned** a thumbnail or photo texture past State 3 — don't assign-then-hide.
- **Edge strokes:** authored keyframes — boost 0.74–0.82, ease to **exactly 0** during 0.82–0.94 on all cards. Verify the ease-down is wired and targets 0, not a static or nonzero value.
- **Photo mosaic:** one shared texture, per-card UV offsets with ~3–4% inset (§4), slice grid **2×4** under §5 working assumption (was 2×3) — or fewer/larger slices / single unslit span if §4 portrait-slicing decision resolves to (b) or (c). Compute at build/load.
- **Text zones:** project the four corner cards of each block; position the HTML to match; hard-constrain both axes (`max-width`/`max-height`), and derive line-height from projected row height. Verify the bio on narrow widths within the gate band. **Narrowly-scoped exception (only if §5 H option (b) is chosen):** headline zone may allow `overflow: visible` with a capped bleed δ (~0.25–0.35 row-heights) as an accepted device; this exception must be carved explicitly and the §7 gate re-derived with that δ — do not silently widen or remove the hard-constrain.
- **Cover framing (§10):** axis-fit `min` distance; recompute on resize in the same handler that re-runs the §7 gate.
- **Scroll-handler routing:** four routes — fallback (no handler), sphere, mid-transition, expanded project.
- **Easing:** continuous properties linear to the scrub; §6 beats are the deliberate authored exceptions.

### 17. Settled Decisions
- Pin-and-scrub, smoothed (`scrub ≈ 0.6`), ~4× viewport pin distance (§2).
- Full-bleed video wall as the section's display surface, within the gate (§4, §7).
- Photos as UV-inset mosaic on one shared texture; text as real HTML positioned to projected block bounds; bezel carries photo seams, strokes fade everywhere (§4).
- Unzoned cells resolve to solid black identically to text-zone cards; only the photo zone reveals imagery (§4, §6).
- Thumbnails persist through flight; swap to black is a post-arrival animated fade — the two-beat arrival (§6).
- Card aspect 3:2 → grid aspect 2.0; the gate's reference value (§3).
- Zone map inset to rows 1–4 / cols 1–6; outer ring is unzoned crop buffer; bio is a one-liner (§5).
- Zone-visibility gate with safe band v ∈ (1.5, 3.0) under §5 option (a) strict containment (tightens to ~1.65–2.61 for δ≈0.3 bleed under option (b) — see §7); mid-session flip reinitializes at progress 0 (§7).
- Decoupled index mapping; fixed ring table `[4,8,12,12,8,4]` owned here (§8).
- Spacing interpolates to zero; axis-fit cover framing; start state read from live scene (§9–§11).
- Lines/fog/vignette fade to nothing in lockstep with spacing; background unaffected (§12).
- Overlay UI keyed to progress; toggle hidden by 0.10; hero headline gone by 0.12 (§13).
- Interaction routing: drag/click/tab locked past 0.02; buttons live from 0.82 (§14).
- Pin end unpins and scrolls away; render pauses off-screen (§15).
- Fallback skips the pin entirely and reuses the same content in conventional layout (§15).
- **Card roster:** all 48 slots filled (hero spec Appendix B) — no null/placeholder cards in production; the "coming soon" texture is retained only for degraded fallback. Flight therefore carries real thumbnails on every card until the post-arrival fade (§6).
- **2026-08-28 — About-wall content direction: editorial / type-led (§4–§5, §7, §15–§16):** explored four directions (expanded bento grid, editorial/type-led, terminal/console, embedded interactive query panel); settled on **oversized, dominant headline on the left + large-format desaturated portrait as a tall column on the right**. Chosen for **typographic craft signal at the lowest build cost of the four**. Mechanism (pin-and-scrub, card dismantle/reform, state machine, fallback gating) unchanged — only what fills the zones and the zone map itself changed. Portrait desaturation (flat grey vs. single-accent duotone), portrait slicing (bezel mosaic retained vs. fewer/larger slices vs. single unslit span), headline sizing strategy (§5 option (a) extra rows vs. option (b) deliberate bleed with narrowly-scoped §16 exception), C1/C2 placement (small quiet text beneath bio vs. folding into persistent header nav), and tag-line retention (return vs. cut) all remain **flagged open** and require explicit decisions before build. §7 gate re-derived from the new inset map (holds at 1.5–3.0 under option (a); tightens to ~1.65–2.61 for δ≈0.3 bleed under option (b)); §15 fallback column order corrected to text-left/photo-right to mirror the primary wall; Appendix A not touched per this pass's out-of-scope rule.

### Appendix A — Decision Rationale & Build-Test Corrections
Archaeology preserved from v1; the normative body above reads as if it were always true.

**Rationale:** scrub over triggered one-shot (reverse free, no desync class); decoupled mapping replaced v1's fragile ring→row claim; unzoned cells reversed to black after seeing them render; stroke ease-down targets zero, not ~30–35% idle; v1's stale "instant swap on departure" decision deleted — the fade-after-arrival beat is the intended one.

**Build-test corrections, kept as verification notes:**
1. Text overflowed zone width and collided with seams (strikethrough artifact on the bio) → hard-constrain both axes + line-height from projected row height (§16).
2. Edge-stroke opacity observed stuck near the boosted value, lines cutting through text → verify ease-down wiring and zero target (§16).
3. v1's cover formula was `min(viewportW/gridW, viewportH/gridH)` — that is contain, not cover; final uses axis-fit distance. Verify on ultrawide (§10).
4. Rounded `cos(θ)` yields ~36 cards, not 48 → fixed table (§8).
5. v1's zone map spanned the entire grid (zones on all four edges), so any aspect mismatch cropped content and a pure aspect gate would pass almost nobody → inset map + perimeter + visibility gate (§5, §7).
6. v1 described photo seams as "gaps between slices" while driving spacing to zero — touching cards have no gap → UV-inset bezel is the mechanism (§4).

## Related documents
`3d-sphere-cta-prompt.md` — the homepage hero spec this document depends on (card system, ring geometry, connector lines, inside/outside toggle). This spec owns the ring-count table `[4,8,12,12,8,4]` and the device-tier gate definition lives in that document's §15.