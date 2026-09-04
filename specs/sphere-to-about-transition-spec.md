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
The cards are the section, not decoration behind it. The full-bleed claim holds within the zone-visibility gate (§7): whenever the gate passes, the wall covers the viewport; when it fails, the section falls back (§15). All zone content — text and photo alike — renders with **zero padding and zero border-radius, flush to its projected cell rect**. No zone carries its own visible container: no card chrome, no inset margin, no rounded corners. The wall's seamlessness is the whole premise; a zone with its own visible boundary breaks it as surely as a visible card seam would. Settled state, by content type:

- **Photo (portrait):** a **single unsliced image spanning the photo zone** — one texture covering the zone's aggregate rect, no per-card UV-inset seams, no bezel. A tiled face reads as a defect, not a motif. Treatment is **full black-and-white conversion with genuine tonal range** — real highlight and shadow detail from actual photography. The image is the only zone that ever shows imagery once settled; its mapping is computed once at build/load against final grid coordinates, independent of the flight interpolation. Edge strokes on all cards — photo zone included — fade to exactly zero in State 5 (§6) like every other zone; there are no retained seam gaps to preserve.
  - **Asset status:** no final portrait exists yet. A photography brief (separate document) is sourcing the real image externally. An AI-generated reference was used only to direct lighting/pose/crop and is explicitly **not** a final asset — see §16 for the implementation guard that must prevent it from shipping by omission.
- **Text (headline, bio, contact):** real, selectable HTML, absolutely positioned and sized to the on-screen projected bounding box of its assigned block — with the narrowly-scoped headline/bio overflow documented in §5. Cards underneath are solid black permanently — their final resting state, never a thumbnail. Their seams fade fully invisible in State 5; text sits on a clean uniform surface. Headline is sized to **dominate** the frame (see §5) — four lines at the heaviest available display weight, final line dimmed as a trailing-off device; bio sits beneath at secondary weight (up to two lines at wall scale); Email/Index sit below the bio as small quiet links each with an underline. No tag line — the T zone is cut entirely, not relocated to cards or header; the zone is unzoned black, full stop.
- **Unzoned:** solid black, identical to text-zone cards, nothing layered on top.

### 5. Content Zone Mapping — Inset, Crop-Safe (Editorial / Type-Led)
**The constraint is law: every zone's card footprint sits inside rows 1–4, cols 1–6.** The full outer ring (rows 0 and 5, cols 0 and 7) is unzoned black and exists to be cropped by cover framing (§7, §10). Three zones — **photo (P), headline (H), and a combined bio+contact block (BC)**. No T zone — the tag line is cut, the zone is unzoned black, full stop. The former eyebrow (E) is retired; its signal is carried by the headline's weight and the portrait.

Nominal split: photo takes the **right 2 of the 6 zoned columns** at full zoned height; headline + bio/contact take the **left 4 columns**. Photo column target is **~1/3 of the zoned width** (2 / 6). At site scale this reads as a generous portrait column, not a narrow strip, with the remaining ~2/3 split between text and gutter.

```
 .  .  .  .  .  .  .  .
 .  H  H  H  H  P  P  .
 .  H  H  H  H  P  P  .
 .  H  H  H  H  P  P  .
 .  B  B  B  B  P  P  .
 .  .  .  .  .  .  .  .
```

Nominal card footprints (row-major, 8×6):

- **P — portrait column (photo):** 2 cols × 4 rows, rows 1–4, cols 5–6 → **8 cards**, single unsliced image spanning the aggregate rect (§4). Full black-and-white conversion with genuine tonal range — real highlight and shadow detail from actual photography. No seams, no bezel. Runs the visual height of the section as a tall column on the **right**.
- **H — headline:** 4 cols × 1 row, row 1, cols 1–4 → **4 cards nominal**, but rendered as four wrapped lines at the **heaviest available display weight** (the 500-max used in early mockups was a prototyping-tool limit, not a design decision): **"Engineering" / "at the edge of" / "AI and" / "automation."** The **entire final line ("automation.") is dimmed** — same weight and typeface as the rest, at **~15% of base text lightness** — as a deliberate trailing-off device. H keeps its single-row footprint and **deliberately bleeds past the nominal cell boundary** via the narrowly-scoped §16 exception to carry four lines at target dominance (see row math below). The dimmed treatment applies to the whole line because it now wraps onto its own line; do not dim only the last word.
- **BC — bio + contact (combined):** 4 cols × 1 row, row 4, cols 1–4 → **4 cards nominal**, but rendered HTML stacks **bio (up to two lines at wall scale, secondary/small weight, copy currently "I build autonomous agents and scalable platforms that replace manual overhead with intelligent code." — wording tunable, the one-/two-line constraint is not) above a contact row holding "Email" and "Index" as small quiet text, each with a **small underline beneath the text**.** The two fall inside the same projected block beneath the headline; they share BC's card footprint and are not separate zoned cards. BC also participates in the same bleed exception as H to carry its stack at wall scale.

Zoned total nominally **16 cards (8 P + 4 H + 4 BC) / 32 unzoned** — the rendered headline and bio/contact visibly occupy the left column's full height via the overflow, but their card footprints remain single-row.

**Row math — why the bleed exists (and why it is scoped):** four headline lines at heaviest weight, plus two bio lines, plus a contact row, do not fit inside four zoned rows without either this bleed or eating into the unzoned buffer rows. Eating the buffer — claiming row 0 and/or row 5 as zoned — was considered and rejected: it removes the 1-row crop buffer the §7 safe range was derived from, costing real device-compatibility range for no benefit. The chosen path is to **let the left-column content overflow its nominal single-row cell boundaries** vertically while keeping the card footprints inside rows 1–4. The cards stay where they are; the HTML is allowed `overflow: visible` beyond the projected box by a bounded bleed **δ ≈ 0.3 row-heights**, final. All other zones (P, unzoned, and any future zone) remain hard-constrained on both axes with `max-width`/`max-height` and line-height from projected row height; do not silently widen the exception. The gate in §7 is re-derived with this δ, and the implementation must verify that at both boundary aspect ratios the gate allows, the overflowed text rect does not intersect the photo zone's rect (left-column vs right-column separation guarantees this for horizontal, and the vertical bleed stays within the viewport's cropped outer rows at the gate limits — verify explicitly, do not assume).

Copy consequence, restated for the editorial direction: the wall is a typographic statement — headline dominates, bio is compact secondary weight, portrait carries the human presence. Longer copy belongs in the fallback or an expanded view, not on the wall. The ~1/3 photo / ~2/3 text+gutter split and the 15% dim are anchors at mockup scale — tune to the site's real type and color scale while preserving the dominance ratio and the heaviest-weight headline decision.

### 6. Card Content State Machine
Cards keep their thumbnails throughout flight; the swap to black is an animated fade that happens **after** arrival — a deliberate two-beat sequence: grid snaps into formation still showing project imagery, imagery fades to black together, blank-wall pause, then content reveal. Beats are authored against progress sub-ranges (not real-time durations), so they stay synced under variable scroll speed, fast flicks, and reversal.

| Progress | State | What happens |
|---|---|---|
| 0 | **1 — Sphere** | Idle hero state, thumbnails, idle strokes. |
| 0 < p < 0.62 | **2 — Flight** | Thumbnails throughout; edge strokes visible as always; zone destiny not yet apparent. |
| 0.62–0.74 | **3 — Arrived, fading to black** | Grid fully formed at zero spacing, still showing imagery; thumbnails fade to black together — a genuine transition, never a hard cut. |
| 0.74–0.82 | **4 — Blank (blueprint)** | Solid black, no content. Edge-stroke opacity boosted above idle: crisp intentional "blueprint" quality, not a loading state. |
| 0.82–0.94 | **5 — Content reveal** | All edge strokes — photo zone included — fade to **exactly zero**. Photo portrait fades in as a single unsliced image across the zone's aggregate rect (§4); HTML text fades in on its zones; text/unzoned cards stay solid black. Reads as the wall "switching on" at once. |
| 0.94–1.0 | **Settled buffer** | No visual change. Deliberate dead band: absorbs the last scroll increment so fast flicks can't clip the reveal and pin exit isn't abrupt. |

Reversal plays this exactly backward: content out + strokes boost back (5→4), black back to thumbnails in arrived positions (4→3), thumbnails carried back into flight (3→2), resettling into the sphere (1). Continuous properties (position, rotation, spacing, camera) track the scrub linearly; States 3–5 are the authored exceptions.

### 7. Zone-Visibility Gate
Cover framing crops outer rows/columns first on aspect mismatch. Re-derived from the **new §5 three-zone map**.

**Gate:** zoned card footprints remain rows 1–4, cols 1–6 — the outer ring (rows 0/5, cols 0/7) is still the full crop buffer, and P (cols 5–6, rows 1–4) stops at row 4 / col 6 exactly as before. But the rendered HTML rects for H/BC extend beyond their nominal single-row cells by a bounded bleed **δ ≈ 0.3 row-heights, final** (§5), via the narrowly-scoped §16 exception. Effective buffer therefore shrinks to **1 − δ rows per side vertically and 1 − δ columns per side horizontally**.

With grid aspect **g = 2.0**, cropped depth is `3(v−g)/v` rows/side when viewport aspect v > g, and `4(g−v)/g` cols/side when v < g. Solving against the effective buffers:

- Vertical (v > g): `3(v−g)/v = 1 − δ` → **v_max = 3g / (2 + δ)**
- Horizontal (v < g): `4(g−v)/g = 1 − δ` → **v_min = g·(3 + δ)/4**

For **δ ≈ 0.3, final**, this gives **v ∈ (1.65, 2.61)**. δ≈0.3 is the value; do not re-derive with a different δ without explicit rationale. The prior (1.5, 3.0) assumed strict cell containment with no bleed and is superseded; the intermediate (1.5, 2.61) assumed vertical-only bleed and is also superseded.

Every laptop, desktop, and moderate ultrawide within this band sees all zones; narrower tablet-landscape (~1.33) and portrait phones (~0.5) fail horizontally, very wide ultrawides (>2.61) fail vertically, both correctly falling back (§15) as intended.

**Verification required:** at both boundary aspects the gate allows, project the photo zone's rect and the **actual overflowed HTML rects** for H/BC (nominal cells + δ) and confirm they do not intersect. With the left-4 / right-2 column split they are separated by a full gutter column, so no collision occurs — but this must be checked explicitly against the chosen δ and the final type scale, not assumed.

**Mechanics:** run the cover-framing math, project each zone's bounding rect (for H/BC the rect **includes** the bleed δ ≈ 0.3; for P it is the card aggregate rect of the single unsliced texture), fail the gate if any rect extends outside the viewport minus an 8px safety margin. Evaluate at init, on debounced resize, and on `orientationchange`. If the result flips mid-session, reinitialize the section in the new mode at progress 0. The pin (§2) is only created when this gate passes together with the §15 gates.

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
Solve distance so the grid **covers** the viewport: the closer of the two axis-fit distances, i.e. `distance = min(dHeightFit, dWidthFit)` where `dHeightFit = gridH / (2·tan(fov/2))` and `dWidthFit = gridW / (2·tan(fov/2)·aspect)`. That axis fills exactly; the other overflows and crops into the unzoned perimeter (§5, §7). Uniform card proportions preserved — never stretch cells. Recompute on resize. *(The v1 formula `min(viewportW/gridW, viewportH/gridH)` is the contain scale — do not use it; it letterboxes.)* Photo mapping: single unsliced texture stretched across the photo zone's aggregate rect (§4), mapped once at build/load against final grid coordinates, independent of the interpolation. Start state: camera, fog, and line opacity depart from live captured state (§11), never hardcoded.

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
- **One content source, two layouts:** the zone content is the same real HTML used by the WebGL mode, restyled with conventional CSS instead of projected coordinates. Nothing duplicated; SEO and screen readers get the content either way. Tag line (T) is not rendered in either layout — it was cut entirely in the editorial direction (§4–§5), not relocated.
- **Photo:** a single normal image spanning its column (not a mosaic, not tiled), **full black-and-white conversion with genuine tonal range — real highlight and shadow detail from actual photography, per §4**. Gated behind real-asset availability per §16; if the real portrait is not yet delivered, render an explicit placeholder state — do not ship the AI-generated reference as if it were final.
- **Layout:** desktop — two columns, **text stack left, photo right** (mirrors the primary WebGL wall's left-dominant headline / right portrait column, §5). Prior fallback spec had this reversed (photo left, text right); that is corrected here so fallback does not contradict the primary editorial layout — fallback column order matches primary, per the settled decision. If an intentional divergence were desired, it would need explicit rationale — none is claimed. Mobile — single-column stack, photo first (top). Same dark theme; Email/Index retain the small underline treatment from §5.
- **Entrance:** none, or a single opacity fade.

### 16. Implementation Notes
- **Scroll-linking:** GSAP `ScrollTrigger` (`pin: true`, `scrub: ~0.6`); Framer Motion `useScroll`/`useTransform` as the React-native alternative.
- **Single source of truth:** implement §6 as one declarative timeline scrubbed by ScrollTrigger, animating a small set of driver scalars; one rAF reads them and applies per-card math. Don't scatter `progress → value` functions.
- **Read scroll, apply in rAF:** read progress in the scroll callback; apply interpolation inside `requestAnimationFrame`, never in the handler.
- **Capture live state at scroll start (§11):** read camera position/quaternion and fog off the live objects; interrupt a mid-flight toggle rather than letting both drive the camera.
- **Arrival fade:** genuine opacity/material animation keyed to 0.62–0.74, triggered at arrival, not departure. Text-zone and unzoned indices should **never be assigned** a thumbnail or photo texture past State 3 — don't assign-then-hide.
- **Edge strokes:** authored keyframes — boost 0.74–0.82, ease to **exactly 0** during 0.82–0.94 on all cards. Verify the ease-down is wired and targets 0, not a static or nonzero value.
- **Photo (portrait):** single unsliced texture stretched across the photo zone's aggregate rect (§4) — no per-card UV sub-rects, no bezel inset, no tiled seams. Mapping computed once at build/load against final grid coordinates. **Asset guard:** the photo texture source must not silently default to the AI-generated reference file. Either gate the photo zone behind a real-asset-available check with an explicit placeholder state (e.g. solid black or typographic placeholder until the real photograph is delivered), or block this piece of implementation entirely until the real asset lands — do not ship the generated face as if it were final by omission. Any silent fallback to the reference image is a build failure; see Asset Status below and §4.
- **Text zones:** project the four corner cards of each block; position the HTML to match; hard-constrain both axes (`max-width`/`max-height`), and derive line-height from projected row height. Verify the bio on narrow widths within the gate band. **Narrowly-scoped bleed exception (final — §5):** H and BC are allowed `overflow: visible` with bleed **δ ≈ 0.3 row-heights, final**, to carry the four-line headline and the bio+contact stack at target dominance. This exception is scoped to H/BC only and the §7 gate is re-derived with that δ; all other zones (P, unzoned) remain hard-constrained — do not silently widen or remove the guard.
- **Zone content bleed — zero padding / zero radius (all zones):** every zone's root element renders with **padding: 0, border-radius: 0**, sized and positioned to exactly match its projected cell rect, nothing else. No zone carries its own visible container. If a shared component (a generic "photo card" or similar) is being reused for zone content, either strip these properties for this specific use or don't reuse that component — a component built for bounded, padded contexts will not become flush by accident.
- **Cover framing (§10):** axis-fit `min` distance; recompute on resize in the same handler that re-runs the §7 gate.
- **Scroll-handler routing:** four routes — fallback (no handler), sphere, mid-transition, expanded project.
- **Easing:** continuous properties linear to the scrub; §6 beats are the deliberate authored exceptions.

**Asset Status — Portrait:** no final portrait exists yet. A photography brief (separate document, already written) is sourcing the real image externally. Do not treat the AI-generated reference — used only to direct lighting/pose/crop — as final under any circumstances, including as a placeholder left in past a review. That omission is exactly what the §16 asset guard is meant to prevent; the photo zone must remain gated or blocked until the real asset is delivered.

### 17. Settled Decisions
- Pin-and-scrub, smoothed (`scrub ≈ 0.6`), ~4× viewport pin distance (§2).
- Full-bleed video wall as the section's display surface, within the gate (§4, §7).
- Photo as single unsliced texture spanning the zone's aggregate rect; text as real HTML positioned to projected block bounds; no bezel, no tiled seams; strokes fade to zero everywhere (§4).
- Unzoned cells resolve to solid black identically to text-zone cards; only the photo zone reveals imagery (§4, §6).
- Thumbnails persist through flight; swap to black is a post-arrival animated fade — the two-beat arrival (§6).
- Card aspect 3:2 → grid aspect 2.0; the gate's reference value (§3).
- Zone map inset to rows 1–4 / cols 1–6; outer ring is unzoned crop buffer (§5).
- Zone-visibility gate with safe band **v ∈ (1.65, 2.61) for δ≈0.3, final** (§7); mid-session flip reinitializes at progress 0 (§7). Prior (1.5, 3.0) assumed strict cell containment and is superseded.
- Decoupled index mapping; fixed ring table `[4,8,12,12,8,4]` owned here (§8).
- Spacing interpolates to zero; axis-fit cover framing; start state read from live scene (§9–§11).
- Lines/fog/vignette fade to nothing in lockstep with spacing; background unaffected (§12).
- Overlay UI keyed to progress; toggle hidden by 0.10; hero headline gone by 0.12 (§13).
- Interaction routing: drag/click/tab locked past 0.02; buttons live from 0.82 (§14).
- Pin end unpins and scrolls away; render pauses off-screen (§15).
- Fallback skips the pin entirely and reuses the same content in conventional layout, photo right / text left matching primary (§15).
- **Card roster:** all 48 slots filled (hero spec Appendix B) — no null/placeholder cards in production; the "coming soon" texture is retained only for degraded fallback. Flight therefore carries real thumbnails on every card until the post-arrival fade (§6).
- **2026-08-28 — About-wall content direction: editorial / type-led (§4–§5, §7, §15–§16):** explored four directions (expanded bento grid, editorial/type-led, terminal/console, embedded interactive query panel); settled on **oversized, dominant headline on the left + large-format portrait as a tall column on the right**. Chosen for **typographic craft signal at the lowest build cost of the four**. Mechanism (pin-and-scrub, card dismantle/reform, state machine, fallback gating) unchanged — only what fills the zones and the zone map itself changed. This entry is superseded in detail by the 2026-08-29 finalization below; direction and rationale stand.
- **2026-08-29 — Editorial direction finalized (§4):** direction confirmed as **editorial / type-led**, chosen over expanded bento grid, terminal treatment, and embedded query panel for typographic craft signal at lowest build cost.
- **2026-08-29 — Photo mechanism (§4):** **single unsliced image spanning the photo zone** — one texture covering the zone's aggregate rect, no per-card UV-inset seams, no bezel. A tiled face reads as a defect, not a motif.
- **2026-08-29 — Photo treatment (§4):** **full black-and-white conversion with genuine tonal range** — real highlight and shadow detail from actual photography.
- **2026-08-29 — Photo asset status (§4, §16):** portrait is **pending real photography** (photography brief already sourcing externally). An AI-generated image was used to direct lighting/pose/crop only and is **explicitly not a final asset** — must not ship by omission; see §16 asset guard and Asset Status.
- **2026-08-29 — Tag line (§4–§5, §15):** **cut entirely** — not on this wall, not relocated to project cards. No T zone in the redrawn zone map; the zone is unzoned black, full stop.
- **2026-08-29 — Headline weight & copy (§5):** **heaviest available display weight** (the 500-max used in early mockups was a prototyping-tool limit, not a design decision). Wraps **four lines** at target size: **"Engineering" / "at the edge of" / "AI and" / "automation."**
- **2026-08-29 — Headline dimmed treatment (§5):** dimmed treatment applies to the **full final line ("automation.")**, not just the last word, since it now wraps onto its own line — same weight/typeface, **~15% of base lightness**.
- **2026-08-29 — Zone map redraw (§5, §7):** redrawn to **three zones (P, H, BC)** — photo takes the right 2 of the 6 zoned columns at full height, headline + bio/contact take the left 4. Headline keeps its single-row footprint and deliberately bleeds via the narrowly-scoped §16 exception (δ ≈ 0.3, final) — eating the buffer to claim two rows was considered and rejected for costing device-compatibility range for no benefit. §7 gate re-derived as **v ∈ (1.65, 2.61)** and photo-zone collision verified at both boundaries.
- **2026-08-29 — Photo column width (§5):** **~1/3 of the zoned width**, not the ~28–30% estimated earlier.
- **2026-08-29 — Contact treatment (§5, §15):** Email/Index each with a **small underline beneath the text**, sitting in the combined bio+contact zone below the bio — small quiet text beneath the bio, confirmed by what's already built and rendering correctly.
- **2026-08-29 — Fallback column order (§15):** **photo right, text left**, matching primary layout (already corrected in prior pass; reaffirmed).
- **2026-08-29 — Closing pass — all remaining open items resolved + zone-content bleed rule (§4–§5, §7, §15–§17):** **(1) portrait slicing** locked to single unsliced image spanning the zone — no UV-inset seams, no bezel (§4); **(2) portrait desaturation** locked to full black-and-white conversion with genuine tonal range — real highlight/shadow detail (§4–§5, §15); **(3) headline sizing** locked to single-row footprint with deliberate bleed via §16 exception, δ≈0.3 final, gate v ∈ (1.65, 2.61) — claiming two rows considered and rejected to Appendix A for costing buffer (§5, §7); **(4) C1/C2** locked to small quiet underlined text beneath the bio, confirmed built (§5); **(5) tag line** cut, no T zone, unzoned black (§5); **(6) zone content bleed** — all zones render flush with zero padding and zero border-radius to the projected cell rect, no visible container chrome (§4, §16).

### Appendix A — Decision Rationale & Build-Test Corrections
Archaeology preserved from v1; the normative body above reads as if it were always true.

**Rationale:** scrub over triggered one-shot (reverse free, no desync class); decoupled mapping replaced v1's fragile ring→row claim; unzoned cells reversed to black after seeing them render; stroke ease-down targets zero, not ~30–35% idle; v1's stale "instant swap on departure" decision deleted — the fade-after-arrival beat is the intended one.

**2026-08-29 closing pass — considered, rejected (archaeology):** headline sizing **option (a)** — headline claims two rows (2×4 / 3×4, e.g. 8 or 12 cards) to contain four lines at heaviest weight without bleed — **considered and rejected**. It would have required either eating into the unzoned crop buffer (shrinking the gate band) or holding a larger nominal footprint for no typographic benefit over **option (b)**: single-row footprint (1×4) with deliberate bleed δ≈0.3 via the narrowly-scoped §16 exception, which preserves dominance and keeps the gate at v ∈ (1.65, 2.61). Moved here so §5/§7 no longer read as open.

**Build-test corrections, kept as verification notes:**
1. Text overflowed zone width and collided with seams (strikethrough artifact on the bio) → hard-constrain both axes + line-height from projected row height (§16).
2. Edge-stroke opacity observed stuck near the boosted value, lines cutting through text → verify ease-down wiring and zero target (§16).
3. v1's cover formula was `min(viewportW/gridW, viewportH/gridH)` — that is contain, not cover; final uses axis-fit distance. Verify on ultrawide (§10).
4. Rounded `cos(θ)` yields ~36 cards, not 48 → fixed table (§8).
5. v1's zone map spanned the entire grid (zones on all four edges), so any aspect mismatch cropped content and a pure aspect gate would pass almost nobody → inset map + perimeter + visibility gate (§5, §7).
6. v1 described photo seams as "gaps between slices" while driving spacing to zero — touching cards have no gap → UV-inset bezel is the mechanism (§4).

## Related documents
`3d-sphere-cta-prompt.md` — the homepage hero spec this document depends on (card system, ring geometry, connector lines, inside/outside toggle). This spec owns the ring-count table `[4,8,12,12,8,4]` and the device-tier gate definition lives in that document's §15.