# 3D Sphere Project-Grid — Hero / CTA Section

> **Implementation alignment — 2026-08-30.** The current build is the reference for
> values and behaviour in this document. The shared page, scene, and fog background is
> true black (`#000`); card fill remains `#33333A`. The About-wall portrait is a
> transparent PNG over that black field; its layout and contact details are specified in
> the companion transition document.

> **Amendment — 2026-09-02.** A third section (`work-section-spec.md`) now follows the
> About wall. It amends this document in three places: the expanded project panel (§9–§11)
> is extracted into a shared `ProjectPanel` component mounted by both sections; `Project`
> gains a `lane` field (§13); and keyboard focus on a card must rotate the sphere to bring
> that card into view (§14). Numeric constants shared across all three documents now live
> in `src/config/constants.ts` — see work spec §0 for the ownership table. Values in this
> document remain the reasoning of record; the module is the number of record.

## Concept

A full-viewport hero section where the camera sits **inside** a hollow sphere made of rectangular cards, arranged in evenly spaced horizontal rings (like lines of latitude on a globe), so the visitor feels *surrounded by* a wireframe cage of project tiles rather than looking at a sphere from outside. The sphere idles in a slow auto-rotation with a subtle secondary wobble, can be spun manually by drag, and clicking any card expands it into a fullscreen scrollable project view. An optional toggle lets visitors pull back to an outside/orbit view of the same structure (§5). Scrolling further transitions into the About/personal-info section — that mechanic (sphere flattening into a grid, etc.) is specified separately in the companion *Sphere-to-About Transition* doc, not in this document. Past the About wall sits a third section, the Work section, which presents the same 48 projects as a sortable index and an orbitable globe; see `work-section-spec.md`.

Each card = a placeholder for one of my projects, to be filled in as the portfolio grows.

## Project Scope

This is the hero/CTA section for **my personal portfolio** — not a general-purpose template meant for reuse across arbitrary business types. The sphere showcases my own projects (case studies, side projects, client work) to whoever lands on the site: potential employers, freelance clients, collaborators, or other developers/designers checking out my work. Wherever this doc previously read as advice about "who this pattern suits," it should now be read as the reasoning behind why it suits *this* site specifically.

Worth being explicit about what it's *not* scoped for, since the interaction pattern itself doesn't generalize well beyond this use case: it's not a fit for e-commerce (shoppers need fast scan/filter/search, not spatial exploration) or enterprise/B2B SaaS (needs an immediate, clear value prop rather than a playful interaction). If any part of this spec ever gets reused for a different kind of site, that mismatch is worth remembering.

## Theme — Dark, Site-Wide (No Toggle)

**Decision:** dark theme throughout, no light/dark toggle.

**Reasoning:**

- Matches the scope (§ Project Scope): developers and designers — the audience for my personal portfolio — have a well-documented preference for dark UI (IDEs, terminals, GitHub, dev tool dashboards default dark). A dark site is a small extra signal of craft before the visitor has even scrolled.
- The design was already trending dark: the expanded project panel is dark by construction (§10, to preserve the "this card grew" illusion), and the hover treatment is a soft glow — glows read as genuinely luminous against a dark surface, but mostly disappear into a faint gray smudge against a light one. Several pieces of this spec were already dark-mode-shaped before the theme was named.
- The original light-background reasoning has mostly dissolved: light background made sense when cards were plain flat rectangles needing contrast to read at all. Now cards are filled by project thumbnail images — the image is doing the visual work, not the shape. Thumbnails and screenshots pop harder against dark (same reason galleries use black walls/mats) and can look washed out against a bright void.
- Reinforces the "inside a sphere" atmosphere: an immersive, spatial interaction pairs naturally with a dark, void-like environment (planetarium/orbit feel) rather than a bright showroom feel.
- Toggle was considered and rejected (for light/dark, specifically): every custom effect here (blur intensity behind the expanded panel, glow contrast, "coming soon" texture, case-study body contrast, hero image treatment) would need designing and tuning twice, for a benefit that mostly serves a minority of this specific audience's actual preference.

**Caveat:** if this portfolio may also need to read well to non-technical stakeholders (e.g. an agency pitching corporate clients rather than just other engineers), dark can occasionally register as "edgy/informal" in that context — worth confirming the actual audience before locking this in for a different use case.

### Background + tile treatment: dark background, dark tiles (tonal, not stark)

Two options were weighed:

- **Dark background + light tiles:** guarantees strong contrast, so the ring/wireframe structure stays legible even on empty slots or against dark thumbnail images. But it risks looking like a grid of bright dashboard cards rather than an atmospheric scene, and a light frame competes with the image content sitting inside it rather than receding behind it.
- **Dark background + dark tiles** (tonally close, implemented as background `#000` vs. tile `#33333A`): far more cohesive and atmospheric — the frame nearly disappears, so thumbnails read as windows floating in space, which suits "a cage of images" better than loud rectangle borders. The hover glow also lands harder here: a tile that's barely visible at rest lighting up under the cursor is a bigger, more satisfying payoff than a tile that was already bright getting slightly brighter.

**Recommendation:** dark-on-dark, with two refinements to protect legibility. First, give every tile a thin, subtle edge stroke (e.g. 1px, ~30–35% white opacity) even at idle, not just on hover. Second — and this is a correction from an earlier pass of this spec — don't go as tonally close as it might first seem right to. An initial version of this spec suggested tile fill only marginally lighter than the background (e.g. `#1C1C1E`, roughly an 18-value gap on a 0–255 scale) with a faint 10–15% edge stroke; tested in an actual build, that combination reads as essentially solid black on most screens — "atmospheric" tips into "invisible" well before you'd expect. `#33333A` fill with a ~30–35% opacity stroke is the tested floor for staying clearly legible while still reading as tonal, not stark — treat these as the actual starting values, not the more subtle ones, and only dial back down while checking contrast on your real target displays, not in the abstract.

### Scene background: Tier 2 — depth fog + radial vignette (finalized)

Of the three tiers prototyped (flat / fog+vignette / fog+vignette+starfield), Tier 2 is the final choice. Fog (`THREE.Fog`, matched to the background color) fades far-side cards toward the background with distance rather than letting them pop at a hard edge — this reinforces the depth read the whole "inside a sphere" concept depends on, at negligible performance cost. The radial vignette (a faint CSS `radial-gradient`, brighter center fading to darker edges, sitting above the canvas) subtly draws focus back to center, which also happens to be where the clicked-card re-center animation lands (§9). The Tier 3 starfield was left out — it added independent-motion tuning risk (density, opacity, drift speed all need careful balancing to avoid competing with the sphere) for an effect that's a nice-to-have rather than something the depth illusion needs. Outside/orbit mode (§5) uses its own, separately tuned fog values rather than reusing these — see §5.

## 1. Visual Design

- **Background:** true black (`#000`) — flat base color, with `THREE.Fog` matched to it fading far-side cards with distance, plus a faint CSS radial vignette over the canvas (brighter center, darker edges). See Theme section above for the full reasoning; no starfield or other background decoration.
- **Cards:** tonally dark fill, `#33333A` against the black background, with a thin subtle edge stroke (~33% white opacity) that stays visible at idle. A project thumbnail image fills most of the card (`object-fit: cover`).
- **Card spacing:** consistent gap between cards on all sides (padding *around* each card, not inside it) so the ring/grid structure reads clearly through the negative space.
- **Card content (idle state):** the project's thumbnail/cover image, edge-to-edge inside the thin stroke — no title text at idle size (titles are small enough at this distance that image recognition reads better than text). Full title/description/detail only appears on expand.
- **Hover state:** the idle edge stroke intensifies into a soft glow/outline on pointer hover, plus a pointer cursor — an amplification of the always-visible stroke, not a new effect appearing from nothing.
- **Empty slots:** cards without an assigned project yet show a subtle "coming soon" texture/pattern (not a plain blank tile) — kept visible against the dark tile fill via the same edge stroke, so it doesn't disappear into the background.
- **Overlay text** (headline, project titles, meta): light/off-white text throughout for contrast against the dark background and panels.
- No skybox, no stars, no extraneous 3D decoration — just the cards, the connector lines (§3), and the dark background showing through the gaps.

## 2. Geometry — Ring-Based Sphere Layout

Cards are placed on **latitude rings**, not a random/Fibonacci scatter (important distinction — you explicitly want uniform rings, i.e. visible horizontal bands):

- Starting point: **6 rings, 48 cards total, distributed per the fixed table `[4, 8, 12, 12, 8, 4]`** (owned by the companion transition spec's Target Layout section). Treat this as the base density to tune once the sphere is on screen — the layout math below scales cleanly if you later want more rings or a higher base count per ring.
- Divide the sphere into the 6 latitude bands, evenly spaced from -90° to +90°, skipping the exact poles to avoid degenerate single-point rings.
- For each ring at latitude `θ`:
  - Ring radius = `R * cos(θ)` (rings near the "equator" are widest, rings near top/bottom are narrowest).
  - Number of cards in that ring ∝ its circumference — the `count(θ) ≈ 8 * cos(θ)` falloff is the **shaping rationale**, keeping card spacing visually uniform rather than bunching near the poles. The **implemented** distribution is the fixed table `[4, 8, 12, 12, 8, 4]` (owned by the companion transition spec), chosen because a rounded `cos(θ)` formula cannot reliably hit 48; the table does, while preserving the falloff shape.
  - Cards within a ring are spaced evenly in longitude: `φ_i = i * (360° / count(θ))`.
- Convert to Cartesian per card: `x = R cos(θ) cos(φ)`, `y = R sin(θ)`, `z = R cos(θ) sin(φ)`.
- **Card aspect:** fixed at **3:2** in world space. This is the single lever that sets the flat grid's native aspect — (8×3)/(6×2) = **2.0** — which sits mid-range among real desktop viewport aspects once browser chrome is subtracted (~1.7–2.2). The companion transition spec's cover framing and zone-visibility gate are calibrated against this value; do not change it without re-running that document's gate math.
- **Card orientation (inside mode):** position and rotation are decoupled. A card's *position* is fully determined by the ring math above and rotates rigidly with the sphere (this is what preserves the ring/wireframe structure as it spins). A card's *rotation* for rendering, however, is recomputed every frame as a camera-facing billboard with its up-vector locked to true screen/world up — not inherited from the sphere's tumble. This means thumbnails stay upright and readable no matter how the sphere has been dragged (see §8 for why this matters with unclamped pitch). The visible side-effect: cards will subtly counter-rotate in place to stay upright during an aggressive drag — expected and intentional, not a bug. This orientation rule applies to inside mode only — outside/orbit mode uses a different rule; see §5.

## 3. Wireframe Connector Lines

Thin lines connect each card's center to its immediate neighbors — left/right (same-ring) and top/bottom (adjacent-ring) — extending the wireframe metaphor from the ring layout itself into the negative space between cards. This is what makes the eye read a genuine *curved surface* rather than a scattered set of boxes that merely implies one.

- **Within a ring (left/right):** connect each card to its immediate neighbor by index within the same ring, tracing a clean closed "latitude" circle around the sphere.
- **Between rings (top/bottom):** connect each card to its nearest angular match (closest `φ`) in the adjacent ring above and below. Since ring card counts differ (per the varying per-ring counts in §2), this isn't a 1:1 pairing — some cards will connect to more than one neighbor in the next ring, and the resulting lines naturally converge toward the poles, which mirrors how real meridian lines behave on a globe.
- **Opacity:** noticeably fainter than the card's own idle edge stroke (§1) — aim for roughly half, e.g. ~15–18% white opacity (scaled from the corrected §1 edge-stroke value — see Theme section for why the original, fainter figures rendered as effectively invisible). These lines are atmosphere/structure, not a UI element competing for attention; too bright and the sphere reads as cluttered rather than considered.
- **Fog interaction:** connector lines should be affected by the same `THREE.Fog` as the cards (§1, Theme section) so lines spanning toward the far side of the sphere fade with distance exactly like the cards they connect — keeping the depth cue consistent rather than having flat, uniformly-bright lines floating at every distance.
- **Depth/draw-order configuration — required, not optional, and corrected from an earlier pass:** the original recipe (lines `transparent: true, depthWrite: false, depthTest: true` tested against opaque cards) only occludes lines that are geometrically behind the cards — true in outside view, false in inside view. In inside view the camera sits at the sphere's center and every connector is a chord whose interior points are closer to the camera than the card faces, so with correct depth testing the lines legitimately render on top; no combination of depth flags can invert that. The working fix is draw order, not depth order — render the lines first and let the cards paint over them: lines use `transparent: true, depthWrite: false, depthTest: false` and `renderOrder = -1` (head of the render queue, drawn before everything); cards use `transparent: true` with `depthWrite: true` and default `renderOrder 0`, which moves them into the transparent pass that renders after the lines (opaque objects always render before transparent ones in Three.js, so cards left opaque would draw first and the lines would still land on top) while still occluding each other correctly. Result: lines read only in the negative space between cards; any card pixel overwrites them, and opacity fades (expand/collapse, fog) still work since both remain transparent. If making the card body transparent causes thumbnail alpha edges to blend oddly, add `alphaTest ≈ 0.5` to discard rather than blend. Geometrically-pure alternative, if depth correctness is ever preferred: subdivide each connector into an arc hugging the sphere at radius R+ε so it sits behind the card faces from inside — more vertices for a visually identical result; the draw-order trick is the pragmatic fix.
- **Expand/collapse behavior:** a card's connector lines fade out in the same beat as the background blur when that card is clicked (§9), and fade back in when it closes — they shouldn't remain stretched across the screen while their card is at fullscreen.
- **Outside/orbit mode:** these lines need no special handling — they're computed from card positions, not camera mode, and if anything read even more clearly as a wireframe globe from outside (§5).
- **Known minor imperfection:** because cards are independently billboarded to face the camera in inside mode (§2) while a connector line runs straight between two box centers, an aggressive drag can momentarily leave a line appearing to graze a box corner rather than meeting it cleanly (neighboring cards can rotate to noticeably different facings mid-drag). At the faint opacity specified above this is very unlikely to be noticeable, and doesn't warrant the added complexity of per-frame line-endpoint correction — worth knowing about, not worth engineering around.

## 4. Camera / Perspective

- Camera positioned at or very near the sphere's center, with a normal perspective FOV (not orthographic) so nearby cards feel large and distant ones on the far side of the sphere feel small — this sells the "standing inside" feeling.
- Near/far clipping should be tuned so cards on the far side of the sphere are visible through the gaps (it's a wireframe cage, not a solid shell), giving depth.
- This is the default, inside-view camera state. See §5 for the outside/orbit alternative.

## 5. Outside/Orbit View Toggle

A manual toggle — a button/switch in the overlay UI (§6) — lets visitors switch between the default inside view (§4: camera at the sphere's center) and an **outside/orbit view**: camera pulled back beyond the sphere's radius, viewing the whole structure like a spinnable globe. This is an additive advanced mode, not a replacement for the default experience.

- **Camera transition:** on toggle, the camera animates — it does not cut instantly — from its inside position out to an external distance, settling on a view looking back at the sphere's center. The same animation plays in reverse when toggling back to inside view. Target duration in the same range as the click-to-expand transition (§9) — long enough to read as a deliberate "pulling back," short enough not to feel sluggish.
- The sphere's geometry is unchanged between modes — same radius `R`, same card dimensions, same ring layout (§2), same connector lines (§3). Only the camera moves; nothing about the object itself is rescaled. (Rescaling the sphere for outside mode would also require rescaling every card to keep them proportionate, which is a third animated property to keep in sync with the camera and orientation-mode transitions below — not worth it for no real benefit.) The visible result is that the sphere reads much smaller on screen in outside mode simply because the camera is much further away — that's the point of this mode, not a flaw: trade "huge, immersive, can't see the whole shape" for "small, complete view of the structure at a glance."
- **Outside-mode camera distance:** solve from a target framing margin, not a fixed multiplier. Rather than hardcoding "2–3× the sphere radius" as a flat world-space distance (which frames differently depending on viewport aspect ratio and FOV — comfortable on a wide desktop window, potentially cramped or clipping near-side cards on a narrow mobile portrait screen), compute the distance so the sphere's silhouette occupies a target share of the vertical field of view (e.g. ~70%): `distance = R / (target_fraction * tan(verticalFOV / 2))`. This self-adjusts across screen sizes instead of needing separate tuning per breakpoint.
- **Keep FOV constant across both modes** — only dolly the camera, don't change the lens angle. Animating FOV alongside the position move introduces a perspective-distortion shift that can feel subtly uncanny; moving the camera backward is the more natural real-world analog (literally just stepping back) and it's one fewer animated parameter to keep synchronized with everything else already happening in this transition.
- **Card orientation mode switch — the core technical piece:** inside mode billboards every card to face the camera (§2), which is correct for a centered camera but would look wrong from outside — it would make far-side cards visibly swivel to face the external viewer too, showing through the gaps between near-side cards and breaking the clean globe silhouette an outside view is supposed to deliver. Outside mode therefore uses a different orientation rule: **tangent-to-surface** — each card's facing is locked to its own position on the sphere, pointing straight outward along its own radius from center, independent of where the camera currently sits. This is the standard approach behind "wireframe globe" / tag-cloud-sphere effects, and it's what actually produces the "cards flip to point outward" behavior described when this feature was proposed. On toggle, interpolate every card's rotation between the two rules (billboard → tangent-to-surface, or the reverse) over the same duration as the camera's fly-out animation, so the two animate in sync rather than the cards snapping into their new orientation ahead of or behind the camera move.
- **Drag behavior:** shares the same rotation state, but flips input sign by view mode. In outside mode, dragging still spins the sphere itself around its own center — exactly the same rotation/momentum/pitch logic already specified in §8 — rather than orbiting the camera around a stationary sphere. That part of the reasoning holds: there is only ever one rotation state, shared identically between inside and outside modes, so toggling back and forth never needs to reconcile two separate values, and outside mode requires no new physics system.

  One correction, though: applying the identical drag-delta-to-rotation mapping in both modes will feel inverted to the visitor in outside mode. This isn't a bug so much as an inherent consequence of viewing a rotating surface from the opposite side — the same relationship as a clock face viewed from behind the glass appearing to sweep in reverse. Looking at the sphere's inner surface versus its outer surface means identical rotation math produces mirror-opposite apparent motion on screen. The fix is minimal: negate the raw pointer deltas (`dx`, `dy`) before feeding them into the existing drag-to-rotation function when in outside mode — `const sign = viewMode === 'outside' ? -1 : 1;` applied to both axes, since the mirroring affects the whole rotation, not just the horizontal component. Same function, same momentum/pitch logic, one sign flip gated on view mode — not a fork of the system.

  Orbiting the camera instead of the sphere would mean building a second physics system from scratch — effectively `OrbitControls`, which §16 already avoids for inside mode for the same reasons.
- **Fog retuning:** the near/far values from the Theme section are calibrated for a camera near the card radius; at 2–3× that distance they'd either have no visible effect or wash out the whole sphere. Outside mode needs its own `THREE.Fog` near/far pair, calibrated to the new camera distance, cross-faded in alongside the camera and orientation transitions rather than snapped.
- Idle rotation and wobble (§7) continue unchanged in outside mode — a slowly spinning, slightly wobbling globe viewed from outside is, if anything, a more familiar visual than the same motion viewed from inside.
- Click-to-expand (§9) requires no changes — it operates in 2D screen space after 3D-to-2D projection, so it works identically regardless of which camera mode was active when the card was clicked.
- **Connector line legibility at distance:** at 2–3× the inside-mode viewing distance, the same faint line opacity (§3) may read as too thin/sparse to register. Worth checking during implementation whether outside mode needs a slightly higher base opacity or line width than inside mode to stay legible — flag this as a tuning pass rather than committing to specific numbers now.

## 6. Overlay UI — Header, Headline & Onboarding

The composition goal here: everything in this section should be **small, quiet, and low-contrast** relative to the sphere — its job is to frame the hero visual, not compete with it. Concretely, that means a restrained header, one clear headline + one modest CTA, and nothing else fighting for attention. (How these elements behave once the visitor scrolls past the hero is covered in the companion *Sphere-to-About Transition* spec, not here.)

### Header / Navigation

- **Logo:** plain text wordmark, light/off-white, regular weight — no icon mark needed.
- **Nav links:** muted off-white (~55–65% opacity) at rest, brightening to full opacity only on hover — no underlines, no active-state backgrounds. Restraint here is what keeps the header from competing with the sphere.
- **Header CTA pill:** labelled **“Availability”** in the current build; it is a 34px-high ghost button with a thin light border, near-transparent fill, off-white text, fully rounded shape, and modest horizontal padding. It deliberately reuses the thin-stroke visual language of the card edges and hover glow (§1, §3).
- **Header background:** none — no bar color, no drop shadow. It should read as floating over the 3D scene, not sitting on top of it. An optional very faint blur is fine if nav text needs a touch more legibility over busy card imagery, but keep it subtle.
- **Inside/outside toggle (§5):** lives in this same right-hand cluster alongside the header CTA, but rendered smaller and icon-only (no label) — grouped with the CTA spatially, subordinate to it visually, so the two utility/meta controls don't compete with the one actual call-to-action.

### Primary Headline + CTA

- **Position: bottom-left, not centered.** Mirrors the header's own left/right anchor rhythm (logo left, CTA right) and, more importantly, keeps the text out of the sphere's visual center — the middle of the screen is where the "inside the sphere" effect is doing its work, and text sitting on top of it undercuts that.
- **Headline:** 2–3 short lines, bold, large, light/off-white — one confident statement, no supporting paragraph underneath. Less copy is what keeps this reading as premium rather than busy.
- **CTA button:** directly below the headline, same ghost-button treatment as the header pill (thin light border, near-transparent fill, off-white text, fully rounded). Small and quiet by design. A small emoji or icon (as in the reference) is a cheap, effective way to add a touch of personality without adding visual weight.

### First-load onboarding hint

- Text + animated icon, as previously specified, but positioned **bottom-right** rather than bottom-center — balances the bottom-left headline block instead of competing with it for the same space, and continues the left/right anchoring pattern established by the header.
- Fades out automatically after the visitor's first drag; doesn't reappear on repeat visits (persisted flag).

## 7. Idle Animation

- Continuous slow auto-rotation around the X axis.
- A subtle secondary wobble on a second axis layered on top of the X-axis spin, so the motion feels organic rather than mechanical — keep the amplitude small, this should read as "alive," not distracting.
- Pause auto-rotation (including the wobble) during manual drag. On release, momentum (§8) begins immediately with no delay; idle rotation resumes only once that momentum has decayed to near-zero — a per-frame condition check, not a fixed pause.
- Continues unchanged in outside/orbit mode (§5).

## 8. Interaction — Manual Drag-to-Spin

- Click/touch-and-drag rotates the sphere in the direction of the drag, similar to dragging a folder icon in Windows: the motion should feel directly coupled to the pointer (1:1 or near-1:1 tracking) while the pointer is down, not an orbit-control-style "camera swings around a fixed target."
- **Momentum:** on release, the sphere keeps spinning in the direction/speed it was being dragged and decelerates smoothly to a stop (track velocity over the last few drag frames, apply it as angular velocity on release, then exponentially damp it toward zero). Momentum must apply synchronously in the same `pointerup` handler — zero artificial delay. This is a different trigger point from idle-rotation resumption below; don't let the two get conflated in implementation. If momentum feels like it "waits" before starting, that's very likely idle-resume timing logic (a condition — momentum has decayed near zero — not a fixed timer) accidentally gating the start of momentum instead of gating what happens after it. If testing on touch, also confirm the canvas has `touch-action: none` — without it, the browser's own default gesture-recognition delay can look identical to a code-level pause.
- Idle auto-rotation resumes only after the momentum has fully decayed — this one is a condition (angular velocity below a small threshold), evaluated every frame, not a fixed timeout.
- **Pitch (vertical drag):** unclamped — users can freely spin the sphere on this axis too, including all the way upside-down. No artificial limits. This is safe to leave unclamped specifically because card rotation is billboarded per §2 (inside mode) — the sphere structure can tumble freely while each card's image stays upright and readable regardless of the sphere's current orientation.
- Support both mouse drag and touch drag.
- This system is reused for outside/orbit mode with one input correction (§5) — the camera doesn't move during a drag in either mode, only the sphere's rotation state changes, but the raw pointer delta needs its sign flipped in outside mode to compensate for the inside/outside viewing mirror-flip (§5) — otherwise drag direction will feel inverted from outside.

## 9. Interaction — Click to Expand

Two-stage animation on card click:

1. **Re-center:** the clicked card animates from its position on the sphere to dead-center of the screen (in front of the camera, facing forward). At the same time, the rest of the sphere gets a blur applied (e.g. backdrop-filter/gaussian blur, transitioning in over the same duration) so focus shifts entirely to the selected card — the sphere stays visible but softened behind it, rather than fading out or staying sharp.
2. **Zoom to fullscreen:** the centered, now-blurred-background card then scales up to fill the viewport, settling with `p-8` padding on all four sides on desktop (drop to `p-4`–`p-6` under a mobile breakpoint — `p-8` is too generous on small screens). The blurred sphere remains visible as a backdrop behind the fullscreen panel (or behind its edges/padding area) rather than being hidden entirely.

- **Content:** the expanded panel is vertically scrollable, but the scrollbar itself is hidden (`overflow-y: auto` + `scrollbar-width: none` / `::-webkit-scrollbar { display: none }`).
- **Exit:** provide a clear way back (close button and/or Escape key) that reverses the animation — card shrinks and flies back to its ring position, the background blur clears, and sphere rotation resumes.
- **Note:** the sphere itself is best implemented as a 3D scene (see below), but the expanded fullscreen project view is realistically its own HTML/DOM overlay (for real scrollable text, links, etc.) rather than a 3D-space element — the "zoom in" is a transition from the 3D card to this 2D overlay, not the 3D card itself growing in 3D space. Works identically regardless of inside/outside mode (§5).

## 10. Expanded Card Layout

> **Amended 2026-09-02 — this panel is now a shared component.** The structure below is unchanged, but it is implemented as a section-agnostic `ProjectPanel` mounted by both this section and the Work section, rather than owned here. The Work spec §11 holds the props contract and records which concerns fork by caller: the opening animation (this section's 3D re-centre + blur vs. a rect-anchored scale), next/previous navigation (scroll-driven with clamp here per §11, arrow-driven there), and the next-project teaser (item 8 below — shown here, hidden there). Extraction happens **before** the Work section is built, so the dependency points from new code to shared code rather than from new section to old section.

Keep the panel **dark** (consistent with the theme and the card fill), not a switch to a light background — the card animates from a small dark tile into this view, and flipping to light would break the "this card grew" illusion, turning it into a cross-fade instead. The `p-8` padding then does double duty: breathing room, and a visible ring of the blurred sphere behind the panel, echoing where the card just came from.

Structure, top to bottom:

1. **Fixed header** (does not scroll): close button (top-right) and a project index, e.g. "03 / 12" — reinforces that scrolling moves between projects (§11), not just through this one.
2. **Hero image/video:** full-width, higher-res than the sphere thumbnail, sets the tone immediately.
3. **Title + meta row:** project title (large, light/off-white), then a compact line of metadata — year, role, status (`planned`/`in-progress`/`shipped`), tech stack as small plain text tags. No colorful badges — stay typographic, consistent with the plain aesthetic.
4. **One-line summary/tagline** directly under the title, before the full write-up, for scanners.
5. **Case-study body**, lightly structured (e.g. Overview → Approach → Outcome) rather than one long paragraph block — easier to scan, and a pattern visitors already recognize from agency/portfolio sites.
6. **Secondary gallery:** additional full-width screenshots stacked below the write-up, for projects that have them.
7. **Links row:** "View live" / "View source" as understated text links or thin outline buttons — not filled, colorful CTAs. This isn't the place to introduce a brand color.
8. **Next-project teaser** at the very bottom — small preview (thumbnail + title) of whatever's next in scroll order. This is the visible affordance for the scroll-to-next-project behavior in §11; without it, that behavior is undiscoverable.

## 11. Interaction — Scroll Behavior

Scroll is context-dependent on whether a project is currently expanded:

- **At the sphere (nothing expanded):** scroll continues into the next section of the page — the personal-info/About section. The hero-to-About transition itself (sphere flattening into a grid, camera pull-back, etc.) is specified separately; see the companion *Sphere-to-About Transition* doc rather than this one.
- **Inside an expanded project:** scroll instead navigates between projects — scrolling down slides to the next project's fullscreen view, scrolling up slides to the previous one — rather than scrolling the page or the project content itself. (This means the project content area needs its own internal scroll mechanism, e.g. a dedicated scrollable region within the panel, decoupled from the page-level scroll listener that drives project-to-project navigation.)

**Clamp/resistance feedback on project-to-project transitions:** treat this like a scroll-snap carousel, not a free-scrolling feed:

- Require a minimum scroll delta (or a short debounce window aggregating trackpad/wheel events) before a transition actually triggers — small/accidental scroll input shouldn't switch projects.
- Once triggered, animate the outgoing project sliding out and the incoming project sliding in with a slight overshoot-and-settle: the incoming panel moves slightly past its resting position and springs back (a short spring/ease-out-back curve), rather than landing flat — this is the "clamp" feel, giving each transition a tactile, physical snap rather than an abrupt cut.
- Lock further scroll input for the duration of the transition animation (typically 300–500ms) so rapid scrolling can't queue up multiple transitions or desync the animation.
- At the first and last project, an extra scroll attempt past the boundary should rubber-band — a small bounce-and-return on the current panel (like iOS overscroll) — as a clear "you've reached the end" signal, rather than silently doing nothing.

**Implementation note:** swap the active scroll listener/handler when entering and exiting the expanded state, rather than trying to have one listener branch on state for every event — cleaner to reason about and avoids scroll-jank during the transition itself.

## 12. Entrance Animation

- On page load, cards fly/scale into their ring positions rather than the sphere simply appearing static — e.g. start scattered/off-scale and animate each into its final ring position with a slight stagger per ring or per card.
- Empty "coming soon" slots animate in the same way as filled cards, so the whole sphere feels like one cohesive entrance rather than real projects arriving after placeholders.
- Page always loads into inside view (§4); outside/orbit mode (§5) is opt-in via the toggle, never the default entrance state.

## 13. Content Model

Each card maps to a project record (stable index 0–47). All 48 slots are now filled — no "coming soon" placeholders remain in production; the placeholder texture (§1) is retained only for degraded/low-end fallback or future empty slots.

```ts
type Project = {
  id: string;
  title: string;
  thumbnail: string;       // image shown on the idle card
  heroImage: string;       // larger image for the expanded header
  summary?: string;        // one-line tagline shown under the title
  year?: string;
  role?: string;
  techStack?: string[];
  status: "planned" | "in-progress" | "shipped";
  lane: "ai" | "tools" | "apps";   // added 2026-09-02 — see work spec §12
  content?: string;        // full case-study body (expanded view)
  gallery?: string[];      // additional screenshots
  links?: {
    live?: string;
    repo?: string;
  };
};
```

Slots 0–6 hold the original shipped/in-progress flagships; slots 7–47 hold the 41 additional projects listed in Appendix B. Source of truth lives in `src/data/projects.ts` — the spec roster below is authoritative for card identity and ordering.

**`lane` (added 2026-09-02):** authored per project, never derived from `techStack` at runtime — stack is a poor proxy for kind of work, and derivation would make the field mutate whenever a stack string is edited. It is consumed only by the Work section (grouping and the Lane column); it has **no effect on sphere placement**, which remains a pure function of the stable index per the transition spec §8. Full assignment lives in work spec Appendix C, not here, so this document keeps one roster rather than two.

Cards without an assigned project (should none remain in prod) would render the "coming soon" placeholder texture described in §1.

## 14. Accessibility

- All cards are keyboard-focusable (`tabindex`), in ring/reading order.
- **Focus must bring the card into view (added 2026-09-02, fix #28).** As originally written this section had a real defect: 48 cards in tab order on a 3D object, with nothing guaranteeing the focused card is visible. In inside mode focus can and will land on a fogged card on the far side of the sphere, behind other cards — a focus ring on something the user cannot see. On focus, rotate the sphere to bring that card forward, reusing the stage-one re-centre from §9 without the expand: lerp `yaw → −card.φ` (unwrapped to the nearest equivalent angle, or the rotation takes the long way round) and `pitch → clamp(−card.lat · 0.55, ±0.55)`, releasing within ~0.004 rad. Any pointer drag cancels it immediately — user input always wins. Specified in full in work spec §9; both sections use the same helper.
- **Skip link** past the hero, so keyboard users are not forced through 48 tab stops to reach the rest of the page.
- `Enter` (or `Space`) on a focused card triggers the same expand animation as a click.
- `Escape` closes an expanded project, same as the close button.
- The inside/outside toggle (§6) is a standard focusable button — `Enter`/`Space` activates it, same as any other control.
- Alt text on each thumbnail and hero image (project title at minimum).
- Full screen-reader list view and complex ARIA live-region narration are explicitly out of scope for this pass — keyboard operability is the target, not a parallel content experience.

## 15. Performance

- The current sphere keeps its fixed 48-card ring table on all supported devices; there is no reduced-card ring configuration. Instead, the **About transition** uses a device-tier gate and selects its conventional fallback when any of these are true: viewport width below 768px, `deviceMemory ≤ 2`, `hardwareConcurrency ≤ 2`, Save-Data enabled, or a coarse pointer below 1024px. The same transition fallback is used for `prefers-reduced-motion` and a failed zone-visibility check. The hero itself remains the 3D sphere.
- Respect `prefers-reduced-motion`: disable/slow idle auto-rotation and wobble, and consider skipping the entrance fly-in in favor of a simple fade, and skipping the overshoot/spring on project transitions in favor of a plain cut, for users who've set that preference. The inside/outside toggle transition (§5) should similarly cut rather than fly/interpolate for these users. (The scroll-driven transition into the About section has its own device/motion fallback — see the companion *Sphere-to-About Transition* spec.)
- Lazy/progressively load thumbnail and hero images (low-res placeholder → full image) rather than loading all 48 at once. **Amended 2026-09-02:** ship the 48 thumbnails as a single texture atlas rather than 48 separate loads, and encode as AVIF/WebP rather than JPEG/PNG — the roster's images are high-detail and compress poorly, and this is where the page's weight actually sits. The atlas is shared with the Work section's globe (work spec §15); bind it once.
- **This section's device-tier gate has three consumers now** (this document, transition §15, work spec §15) and remains the single definition site for all of them — do not restate the thresholds elsewhere. The values themselves live in `src/config/constants.ts` per work spec §0.
- **Renderer ownership (added 2026-09-02).** The WebGL context now has three consumers: this hero, the About wall, and the Work section's Specimen globe. Introduce a scene-lifecycle manager that sections register with — who holds the renderer, who may drive the camera, and how "pause when off-screen" generalises — rather than continuing to handle each handoff as a special case. The mid-toggle interruption rule in transition §11 (never let two things drive the camera at once) becomes a general rule of that manager. See work spec §15.

## 16. Suggested Implementation

- **Sphere + cards:** Three.js (or react-three-fiber) rather than pure CSS 3D transforms — better performance with many cards, smoother inertia/drag math, and easier depth handling for "see through to the far side" cards. Cards can be simple flat meshes with a dark material, or `@react-three/drei`'s `<Html transform>` if you want real DOM/text inside each card at idle state.
- **Drag rotation:** custom pointer handlers (not `OrbitControls`, which orbits a camera around a fixed target rather than spinning the object with the pointer) — track pointer delta and apply it directly to the sphere group's rotation. Shared between inside and outside modes with a sign flip on the input in outside mode (§5, §8).
- **Billboarding (inside mode):** if using react-three-fiber, `@react-three/drei`'s `<Billboard>` wrapper handles camera-facing, world-up-locked rotation out of the box — wrap each card mesh in it rather than hand-rolling the look-at math. In vanilla Three.js, recompute each card's quaternion every frame via `Object3D.lookAt(camera.position)` after resetting to world-up, applied on top of (not instead of) the position update driven by sphere rotation.
- **Tangent-to-surface orientation (outside mode):** each card's rotation faces directly away from the sphere's origin along its own base-position vector — no per-frame camera dependency, so this is cheaper than billboarding and only needs recomputing when the sphere's rotation state itself changes.
- **Orientation-mode transition (§5):** interpolate (`slerp`) each card's quaternion between its billboard orientation and its tangent-to-surface orientation over the toggle's transition duration, driven by the same timeline as the camera's position animation.
- **Outside-mode camera distance:** compute on each toggle (and on resize/orientation change while in outside mode) via `distance = R / (target_fraction * tan(verticalFOV / 2))` per §5, rather than a stored constant — this keeps the framing consistent across viewport sizes without per-breakpoint tuning. FOV itself stays fixed; only `camera.position` animates.
- **Connector lines (§3):** build once as a single `THREE.LineSegments` on a shared `BufferGeometry` containing every connection pair, rather than one line object per connection — with ~48 cards and their ring/inter-ring neighbors that's 90+ individual segments, and a single merged geometry is far cheaper to update per frame than that many separate objects. Update the shared position buffer each frame from the same rotated card positions used for the cards themselves, so lines and cards never drift out of sync. Draw order (not depth) handles occlusion (§3): line material `transparent:true, depthWrite:false, depthTest:false` with `renderOrder = -1` on the line object; card material `transparent:true, depthWrite:true` so cards render after the lines and paint over them. The earlier `depthTest:true` + opaque-cards recipe only occludes lines behind cards (outside view) and fails in inside view, where connector chords sit in front of the card faces.
- **Expand transition:** animate the clicked card's Three.js object to screen-center/full-scale, then crossfade to an HTML overlay (React state + Framer Motion or CSS transitions) for the actual scrollable fullscreen content.
- **Scroll handling:** a single global handler that checks current app state (sphere view vs. expanded project) and routes the scroll event accordingly (§11). For the project-to-project carousel behavior, a scroll-snap/carousel library (or a small custom state machine gating input during the transition) will be cleaner than hand-rolling raw wheel-delta accumulation.
- **Easing:** use an ease-out-expo (or similar) curve for the expand/collapse animation, and a short spring/ease-out-back curve for the project-to-project clamp/overshoot (§11), rather than linear/default easing throughout.

## Settled decisions

- Header/nav is minimal and floating (no background bar), with a ghost-button CTA pill — restrained by design so nothing in the overlay UI competes with the sphere (§6).
- Primary headline + CTA anchored bottom-left (not centered), using the same ghost-button treatment as the header pill; onboarding hint moved to bottom-right to balance the composition (§6).
- Scroll is state-dependent: next page section at the sphere, next/previous project when one is expanded (§11).
- Hover state: soft glow/outline, amplifying an always-visible idle edge stroke (§1).
- Empty slots: "coming soon" texture/pattern, not blank (§1).
- Entrance animation: cards fly/scale into position on load (§12).
- Accessibility: keyboard nav (Tab + Enter/Escape) only, no separate list view (§14) — **amended 2026-09-02:** focus on a card now rotates the sphere to bring it into view, and a skip link past the hero is required (§14, fix #28).
- Performance: the sphere keeps its fixed 48-card ring table on all devices; the device-tier gate selects the *About transition's* fallback and the Work section's Index-only mode, not a reduced sphere (§15). *(Supersedes the earlier "reduce card count on low-end/mobile devices" entry, which never described the shipped behaviour.)*
- 2026-09-02 — Expanded panel extracted to a shared `ProjectPanel` mounted by both this section and the Work section; opening animation, next/prev binding, and the teaser fork by caller (§10, fix #30, work spec §11).
- 2026-09-02 — `Project` gains an authored `lane` field with no effect on sphere placement (§13, fix #29, work spec §12).
- 2026-09-02 — Numeric constants shared across the three specs move to `src/config/constants.ts`; derived values (grid aspect, zone gate band) are computed and asserted rather than typed (work spec §0).
- 2026-09-02 — Renderer gains a scene-lifecycle manager rather than a third bespoke handoff; thumbnails ship as one shared texture atlas in AVIF/WebP (§15, work spec §15).
- Idle rotation includes a subtle secondary wobble axis (§7).
- Pitch (vertical drag) is unclamped — free rotation, including upside-down (§8).
- Drag release has momentum with exponential decay (§8).
- Other cards blur (not fade/hide) while one is expanded (§9).
- Base density: 6 rings, 48 cards, distributed per the fixed table `[4, 8, 12, 12, 8, 4]` (§2; table owned by the transition spec).
- Card aspect fixed at 3:2, giving the 8×6 grid a native aspect of 2.0 — the reference value the transition spec's cover framing and zone-visibility gate are calibrated against (§2).
- Cards show their project's thumbnail image at idle size; no text until expanded (§1, §13).
- Card rotation is billboarded in inside mode (always upright, camera-facing) independent of sphere tumble, so free/unclamped drag never leaves thumbnails upside-down or sideways (§2, §8).
- Expanded card layout: dark panel, structured header → hero → title/meta → summary → case-study body → gallery → links → next-project teaser (§10).
- Project-to-project scroll transitions use a threshold + overshoot/spring "clamp" effect, with input locked mid-transition and a rubber-band bounce at the first/last project (§11).
- Theme: dark, site-wide, no light/dark toggle — dark background with tonally dark tiles (not light tiles), distinguished by a thin idle edge stroke that intensifies into the hover glow (Theme section, §1).
- Scene background: Tier 2 finalized — depth fog + radial vignette, no starfield (Theme section, §1).
- Thin wireframe lines connect each card to its same-ring and adjacent-ring neighbors, faint and fog-affected, fading out during expand and back in on close (§3).
- Added an outside/orbit view toggle (icon-only, grouped into the header's right-hand cluster next to the header CTA per §6): camera dollies out (FOV held constant) to a distance solved from a target framing margin rather than a fixed multiplier, so it self-adjusts across viewport sizes; the sphere's own geometry is unchanged, it just reads smaller on screen at that distance; cards switch from camera-billboarded to tangent-to-surface orientation via a synced interpolation; and drag reuses the exact same sphere-rotation system as inside mode (with an input sign flip, see fix #24) rather than a separate camera-orbit system (§5, §6).
- Header/CTA visual language redesigned around a reference (minimal studio site: muted nav, single quiet pill CTA, bottom-left headline, generous negative space): translated into the existing dark theme via a ghost-button treatment (thin light border, near-transparent fill) rather than adopting the reference's light theme directly — keeps the UI chrome deliberately quiet so the sphere stays the visual focus (§6).

## Fixes from implementation testing

Found by building against an earlier version of this spec — logged here since they corrected claims made elsewhere in the document, not just this section:

23. Connector lines now require explicit `depthTest: true, depthWrite: false` — an unspecified gap that caused inconsistent line/card occlusion between inside and outside view (§3, §16).
24. Drag input needs its sign flipped in outside mode (`dx` / `dy` negated before the existing rotation math) to compensate for the inside/outside viewing mirror-flip — the earlier claim that outside mode reuses drag "unchanged" was incomplete (§5, §8).
25. Card fill and edge-stroke opacity corrected from `#1C1C1E` / ~10–15% to tested values of `#33333A` / ~30–35% — the original figures rendered as effectively solid black in an actual build; connector line opacity (§3) scaled proportionately (Theme section, §1, §3).
26. Momentum on drag release must apply synchronously with zero delay, distinct from the separately-timed (decay-condition-based, not fixed-timeout) idle-rotation resume — these are two different trigger points that are easy to conflate in implementation (§7, §8).
27. Connector-line occlusion in inside view is solved by draw order, not depth order. The §3/#23 recipe (lines `depthTest:true` tested against opaque cards) cannot work in inside view: with the camera at the sphere's center, connector chords are geometrically closer to the camera than the card faces, so depth-correct rendering draws the lines on top of the cards — exactly the reported symptom, and why applying #23 changed nothing. Fix: lines `transparent:true, depthWrite:false, depthTest:false, renderOrder = -1` (drawn first); cards `transparent:true, depthWrite:true` (rendered after, painting over the lines). This supersedes the §3 depth recipe and #23's "confirm the card material is not transparent" advice — that advice is the part that was wrong (§3, §16).
28. Keyboard focus on a card must rotate the sphere to bring that card into view. As originally specified, §14 put 48 cards in tab order with no guarantee the focused card was on-screen — focus lands on fogged far-side cards behind other cards. The re-centre animation already exists (§9); focus reuses it without the expand. Angle unwrapping is required or the rotation takes the long way round (§14, work spec §9).
29. `Project` gains a `lane` field, authored rather than derived, consumed only by the Work section and with no effect on sphere placement (§13, work spec §12).
30. The expanded panel (§9–§11) is extracted to a shared `ProjectPanel` rather than remaining owned by this section. Left in place, the Work section would have had to mount hero code and every difference it needed would have landed as a conditional inside this section — the same cross-ownership coupling that produced corrections #23–#27 between this document and the transition spec, one layer up (§10, work spec §11).

## Appendix B — Full 48-Card Roster (slots 0–47)

Stable index → Project ID. Order matches `src/data/projects.ts`. Grid position is row-major (`row = floor(i/8)`, `col = i%8`); sphere ring follows the `[4, 8, 12, 12, 8, 4]` table — neither affects content, but both are shown for reference.

| Slot | Project ID | Title | Year | Status | Ring |
|---:|---|---|---|:---:|:---|
| 0 | `personal-ai-employee` | Personal AI Employee | 2026 | shipped | 0 (4) |
| 1 | `crm-digital-fte` | CRM Digital FTE | 2026 | shipped | 0 |
| 2 | `agent-forge` | Agent Forge | 2026 | shipped | 0 |
| 3 | `finance-tracker` | Finance Tracker | 2026 | shipped | 0 |
| 4 | `devdocs-ai` | DevDocs AI | 2026 | in-progress | 1 (8) |
| 5 | `estate-ease` | Estate Ease | 2026 | in-progress | 1 |
| 6 | `physical-ai-textbook` | Physical AI Textbook | 2025 | shipped | 1 |
| 7 | `prompt-orchestrator` | Prompt Orchestrator | 2025 | shipped | 1 |
| 8 | `vision-index` | Vision Index | 2025 | shipped | 1 |
| 9 | `voice-scribe` | Voice Scribe | 2024 | shipped | 1 |
| 10 | `rag-pipeline-kit` | RAG Pipeline Kit | 2025 | in-progress | 1 |
| 11 | `agent-memory` | Agent Memory Store | 2026 | in-progress | 1 |
| 12 | `synth-data-factory` | Synth Data Factory | 2024 | shipped | 2 (12) |
| 13 | `eval-harness` | Eval Harness | 2025 | shipped | 2 |
| 14 | `deploy-pilot` | Deploy Pilot | 2024 | shipped | 2 |
| 15 | `log-lens` | Log Lens | 2023 | shipped | 2 |
| 16 | `infra-graph` | Infra Graph | 2024 | in-progress | 2 |
| 17 | `canary-watch` | Canary Watch | 2025 | planned | 2 |
| 18 | `vault-console` | Vault Console | 2023 | shipped | 2 |
| 19 | `invoice-flow` | Invoice Flow | 2024 | shipped | 2 |
| 20 | `meeting-scribe` | Meeting Scribe | 2025 | in-progress | 2 |
| 21 | `form-forge` | Form Forge | 2023 | shipped | 2 |
| 22 | `waitlist-kit` | Waitlist Kit | 2024 | shipped | 2 |
| 23 | `changelog-cms` | Changelog CMS | 2024 | shipped | 2 |
| 24 | `slot-engine` | Slot Engine | 2023 | shipped | 3 (12) |
| 25 | `habit-loop` | Habit Loop | 2024 | shipped | 3 |
| 26 | `pantry-scan` | Pantry Scan | 2025 | in-progress | 3 |
| 27 | `transit-pulse` | Transit Pulse | 2023 | shipped | 3 |
| 28 | `metric-mirror` | Metric Mirror | 2024 | shipped | 3 |
| 29 | `funnel-scope` | Funnel Scope | 2025 | planned | 3 |
| 30 | `query-canvas` | Query Canvas | 2024 | in-progress | 3 |
| 31 | `git-pulse` | Git Pulse | 2023 | shipped | 3 |
| 32 | `env-sync` | Env Sync | 2024 | shipped | 3 |
| 33 | `scaffold-cli` | Scaffold CLI | 2025 | shipped | 3 |
| 34 | `mock-mesh` | Mock Mesh | 2023 | shipped | 3 |
| 35 | `rate-gate` | Rate Gate | 2024 | shipped | 3 |
| 36 | `webhook-relay` | Webhook Relay | 2025 | in-progress | 4 (8) |
| 37 | `hot-cache` | Hot Cache | 2023 | shipped | 4 |
| 38 | `audit-trail` | Audit Trail | 2024 | shipped | 4 |
| 39 | `token-forge` | Token Forge | 2023 | shipped | 4 |
| 40 | `stream-ui` | Stream UI | 2025 | in-progress | 4 |
| 41 | `veritas` | Veritas | 2024 | shipped | 4 |
| 42 | `chart-kit` | Chart Kit | 2023 | shipped | 4 |
| 43 | `snippet-vault` | Snippet Vault | 2024 | shipped | 4 |
| 44 | `doc-search` | Doc Search | 2025 | planned | 5 (4) |
| 45 | `pixel-sort` | Pixel Sort | 2023 | shipped | 5 |
| 46 | `sound-map` | Sound Map | 2024 | planned | 5 |
| 47 | `terminal-studio` | Terminal Studio | 2025 | planned | 5 |

> Note: With 48 unique projects the roster fully occupies the grid; no null slots remain. The transition spec's decoupled index mapping (§8) still applies — e.g. `prompt-orchestrator` at slot 7 lands at grid `(0,7)` but sphere ring 1, with no coupling between the two.

Card detail contract (mirrors §13 `Project`): every entry carries `thumbnail` + `heroImage` at `/img/projects/<id>/thumb.jpg` + `hero.jpg`, plus `summary`, `role: "Solo — design + engineering"`, `techStack`, `content` (Overview/Approach/Outcome), `gallery: []`, `links.repo`.

## Related documents

`sphere-to-about-transition-spec.md` — companion spec covering the scroll-driven transition from this hero into the About/personal-info section (sphere flattening into a grid, camera pull-back, fallback behavior). Depends on this document's geometry (§2), connector lines (§3), and orbit-toggle interpolation approach (§5), but is intentionally kept separate since it governs a different section of the page.

`work-section-spec.md` — third section, following the About wall: the same 48 projects as a sortable Index and an orbitable Specimen globe. Depends on this document's card system (§2), connector lines (§3), outside/orbit camera and tangent-to-surface orientation (§5), idle and drag physics (§7–§8), expanded-panel structure (§10), content model (§13), and device-tier gate (§15). It **amends** this document at §9–§11 (panel extraction), §13 (`lane`), §14 (focus-follows-rotation), and §15 (renderer ownership, atlas), and it **owns** the `ProjectPanel` contract, the `lane` roster, the routing scheme, and the shared-constants ownership table.
