# Work Section — Index & Specimen

> **Status — 2026-09-02.** Specification, not yet implemented. Third section of the page,
> following the About wall. Depends on `3d-sphere-cta-prompt.md` (card system, ring
> geometry, connector lines, outside/orbit camera and orientation rules, device-tier gate)
> and on `sphere-to-about-transition-spec.md` (pin-end handoff, which hands scroll to this
> section). This document **owns** the shared `ProjectPanel` contract (§11), the `lane`
> field on `Project` (§12), the lane roster (Appendix C), and the routing scheme (§13).

**Companion spec, not a standalone page.** Covers what the visitor reaches after the About wall unpins and scrolls away: a conventional, unpinned section presenting all 48 projects in two switchable views over one shared state — an **Index** (sortable table, the default) and a **Specimen** (an orbitable globe of the same cards, with click-to-detach).

## Concept

The hero puts you inside the sphere. The About wall dismantles it into a display surface. This section does the third thing the first two deliberately do not: **it lets you actually read the work.**

That framing is the whole design constraint. The sphere is exploration without hierarchy — 48 equally-weighted tiles with no way to sort, filter, or find the flagship. The wall is identity without data. Neither is a browsing surface, and neither should be retrofitted into one. So the Work section's job is release of tension: after two sections of spectacle, one that is dense, scannable, and quiet. That is what makes the arc read as deliberate rather than as three effects in a row.

The Specimen view exists because dropping the sphere entirely would waste the strongest visual asset on the site. But it is the **second** read, not the first — an inversion of the hero (you're outside the object now, turning it over in your hand rather than standing inside it) rather than a repeat of it.

## Scope

**In scope:** the section's two views, the state they share, the transition between them, the detach mechanic, keyboard operation, deep-linking, and the extraction of the expanded project panel into a component both this section and the hero mount.

**Out of scope:** the case-study content itself (owned by `src/data/projects.ts`, contract in hero §13), the hero sphere's own behaviour, and anything that happens above this section in scroll order.

**Explicitly rejected scope:** this section does **not** pin, does **not** scrub, and does **not** hijack scroll. See §2.

## 0. Shared Constants — Single Source of Truth

Three documents now derive values from the same small set of numbers, and two prior rounds of cross-document drift (the ring table, the device-tier gate, card aspect) came from each spec restating them. Implementation must read them from one module; specs cite that module by name rather than repeating literals.

`src/config/constants.ts` — owner of record for each value is listed below. The spec that owns a value is where its *reasoning* lives; the module is where its *number* lives.

| Constant | Value | Owning spec |
|---|---|---|
| `RING_TABLE` | `[4, 8, 12, 12, 8, 4]` | transition §8 |
| `CARD_COUNT` | 48 | transition §8 (derived) |
| `CARD_ASPECT` | 3:2 | hero §2 |
| `GRID_DIMS` | 8 × 6 | transition §8 |
| `GRID_ASPECT` | 2.0 | transition §3 (derived — assert, don't hardcode) |
| `DEVICE_TIER_GATE` | see hero §15 | hero §15 |
| `ZONE_GATE_BAND` | `v ∈ (1.65, 2.61)` | transition §7 (derived — see note) |
| `PROGRESS_BEATS` | `0.02 / 0.10 / 0.12 / 0.62 / 0.74 / 0.82 / 0.94` | transition §6, §13, §14 |
| `FILL`, `STROKE_IDLE`, `LINE_OPACITY` | `#33333A`, ~33%, ~16% | hero Theme, §1, §3 |
| `LANES` | `["ai", "tools", "apps"]` | this doc §12 |

**Derived values must be computed and asserted, not typed.** `GRID_ASPECT` and `ZONE_GATE_BAND` are consequences of card aspect, grid dimensions, FOV, δ, and the 8px safety margin. As literals they silently go stale the moment an input changes — which is exactly the failure mode that produced transition Appendix A corrections 3 and 4. Compute both at init from their inputs and assert them against the expected values in a dev-only check, so changing card aspect fails loudly instead of quietly invalidating the gate.

## 1. Placement & Scroll Budget

The About wall unpins at p = 1 and scrolls away like an ordinary section (transition §15). This section is what follows beneath it.

**Page-wide scroll rule: exactly one pinned section per page, and it is already spent on the hero.** Two hijacked sections back to back compound badly — the visitor has no way to estimate how far the page runs, and the second pin reads as an imposition rather than an effect. This section therefore uses ordinary scroll throughout. The Specimen view's globe is contained in a fixed-height stage that scrolls normally; it does not pin, and the page never takes over the wheel.

This also means the section is reachable and fully usable in the transition's fallback path (transition §15), where the wall never pinned in the first place.

## 2. Structure — Two Views, One State

```
┌─ toolbar ──────────────────────────────────────────────┐
│  [Index | Specimen]              filter chips …  clear │
├─────────────────────────────────────┬──────────────────┤
│                                     │                  │
│   stage — Index table               │   rail           │
│           or Specimen globe         │   (persistent)   │
│                                     │                  │
└─────────────────────────────────────┴──────────────────┘
```

- **Stage:** the view that changes. `1fr`.
- **Rail:** persistent across both views, fixed 320px, sticky. This is what makes the section read as one thing with two projections rather than two screens.
- **Toolbar:** sticky, view toggle left, filters right, hairline bottom rule. Same restraint rules as hero §6 — this chrome frames the content, it does not compete.

**Default view is Index.** Non-negotiable, and it is the load-bearing decision of this whole section. If Specimen were the default, the section would read as a second sphere and the visitor would have been given spectacle three times running with the data never arriving. Index first, globe as the offered alternative.

## 3. Shared State

| State | Shared across views? | Notes |
|---|---|---|
| Filter set | **Yes** | Survives view switch. |
| Selection (`cur`, a project id) | **Yes** | Survives view switch; drives the rail in both. |
| Sort key + direction | **No — Index only** | Meaningless on a sphere; see below. |
| Camera yaw / pitch | Specimen only | Persists while the section is mounted. |
| Detached card | Specimen only | Cleared on view switch. |

**Sort is deliberately not shared.** There is no ordering a sphere can express — ring position is fixed by the stable index (transition §8), and re-laying out the lattice on every header click would both destroy the structure and make the ring table a function of UI state. Switching to Specimen abandons the sort; switching back restores it, because the sort state is retained rather than reset.

**Selection is the thing that unifies the two views**, so it must be an id, never a row index or a ring slot. A row index is invalidated by sorting and filtering; a ring slot has no meaning in the list.

## 4. Index View

A table. No thumbnails in the rows — the rail carries the image, and thumbnails in a 48-row list would triple its height for no scanning benefit.

**Columns:** stable index (`#`), Project, Stack, Lane, Year, Status. Monospace for `#`, Stack, Lane, Year, and the status label; the grotesk for titles. This is the one place monospace is used semantically rather than decoratively — it is a table of structured data, and column alignment depends on it.

- **Rules:** hairline row separators at `--hair` (~9% white). Header row separated by a slightly stronger rule at `--faint` (~16%).
- **Row states:** hover and selected share the same treatment (5.5% white fill) plus a 2px inset left edge marker on the selected row only.
- **Sorting:** click a column header to sort; click again to reverse. Rows animate to their new positions (§7), never re-render in place.
- **Grouping:** sorting by Year, Status, or Lane inserts a small monospace group header before each run. Sorting by `#`, Project, or Stack does not. The distinction is whether the sort key has few enough distinct values to make groups meaningful — three lanes and three statuses do; 48 titles do not.
- **Status marks:** the same three typographic marks used everywhere on the site — filled dot (shipped), pulsing hollow dot (in-progress), dim hollow dot (planned). No colour, consistent with hero §10's "no colorful badges — stay typographic."

## 5. Specimen View — Geometry

Reuses the hero's outside/orbit configuration (hero §5) rather than defining a second sphere.

- **Layout:** same `RING_TABLE`, same stable index → ring mapping as the hero. The card at slot 0 is in ring 0 here exactly as it is there.
- **Ring assignment is by the stable index**, which — per Appendix B of the hero spec — is ordered newest-first. Recent work therefore occupies ring 0, the 4-card polar ring: the least crowded, most legible ring on the object. This is hierarchy for free, and it costs nothing because the ordering already existed.
- **Camera:** outside, distance solved from a target framing fraction exactly as hero §5 (`distance = R / (target_fraction · tan(vFOV / 2))`), not a fixed multiplier. FOV held constant. Target fraction ~0.72.
- **Orientation:** **tangent-to-surface**, per hero §5 — cards face outward along their own radius, not at the camera. Far-side cards showing their backs through the gaps is correct and expected; billboarding from outside makes the silhouette swim. The one exception is the detached card (§6).
- **Connector lines:** same-ring and adjacent-ring, per hero §3, built as a single merged `LineSegments`. **Draw order, not depth** — hero fix #27 applies unchanged even though this is an outside view, because using one material configuration for both sections is worth more than the marginal correctness of depth-testing here.
- **Fog:** outside-mode fog values from hero §5, not the inside-mode pair.
- **Stage mask:** a radial mask on the stage container fading the outer ~8% to transparent, so the globe dissolves at the stage edges instead of being clipped by a hard rectangle. This is the vignette idea from hero's Theme section applied to a bounded container rather than a full viewport.

**Idle motion:** slow auto-rotation plus drag-to-spin with momentum, reusing hero §7 and §8 wholesale — including the **outside-mode sign flip** on pointer deltas (hero fix #24). Pitch is clamped here to ±0.7 rad, unlike the hero's unclamped pitch (hero §8). The hero can afford free tumble because its cards are billboarded upright regardless; tangent-to-surface cards tumbling past vertical would render project thumbnails upside-down.

## 6. Specimen View — Detach

The mechanic that makes an outside view viable. Tiles on the globe are necessarily small — that is the honest cost of an overview — and the detach is what pays for it.

**Stages, on click:**

1. **Lift.** The clicked card's world position lerps from its position on the sphere toward a fixed screen-space anchor at the stage's left-of-centre (`cx − 0.17·W`), while its scale lerps to ~2.9× base. Its orientation slerps from tangent-to-surface to camera-facing over the same band — reusing the orientation interpolation from hero §5, which already exists for the inside/outside toggle.
2. **Recede.** Simultaneously, every other card drops to 24% opacity and all connector lines to 30%. The globe **keeps rotating** underneath — it is not frozen. This is the point: you never lose your place in the object.
3. **Reveal.** The detached card gains its caption (title + stack + year) beneath the frame, and the rail switches to that project.

**Exit:** clicking the stage background returns the card to its ring position by reversing the same lerp. Clicking the **detached card itself** opens the full case study (§11) — a second click on an already-detached card is an escalation, not a toggle.

**Only one card may be detached at a time.** Clicking a second card returns the first and lifts the second in one continuous motion; there is no queue and no multi-select.

**Lerp, not tween.** Detach state is a per-card scalar `d ∈ [0,1]` eased toward its target every frame (`d = lerp(d, target, 0.13)`), not a fixed-duration animation. This means an interrupted detach — clicking a second card mid-flight — resolves smoothly from wherever the first card actually is, with no timeline to cancel or desync. Same reasoning as the transition spec's preference for progress-keyed beats over time-keyed ones.

## 7. View Transition — Rows to Orbit

The section's one orchestrated motion moment. Rows fly outward into ring positions; ring positions collapse inward into rows.

- **Matched by stable index**, so the same record travels both ways. This is the reason the transition reads as one dataset rearranging rather than two screens swapping.
- **Index → Specimen:** capture each row's rect before the switch. Build the globe. For the first ~45 frames, blend each card's computed 3D position toward its captured row centre with an eased weight (`e = intro²`), releasing to the true position as `intro` decays. Connector lines fade in over the same band. This is a one-directional FLIP driven by the render loop rather than by the Web Animations API, because the destination is recomputed every frame and cannot be expressed as a static keyframe.
- **Specimen → Index:** capture each tile's projected rect. Render the table. Animate each row from its captured tile centre with `scale(1.4) → 1` and opacity `0 → 1`, staggered ~6ms per row, capped at 300ms total stagger. Standard WAAPI FLIP; the destination is static here, so the simpler technique applies.
- **Reduced motion:** both directions cut. No blend, no stagger.

## 8. Filtering

Chips for status (`shipped` / `in-progress` / `planned`) and primary stack (`TypeScript` / `Python` / `Rust` / `Go`). Within a facet, chips OR; across facets, they AND. Each chip carries a live count of what the result set *would* be if it were toggled — computed against the prospective filter set, not the current one, so the number answers "what happens if I click this" rather than restating the status quo.

**The two views filter differently, deliberately:**

- **Index removes rows.** Density is the list's entire value; keeping 40 dimmed rows to scroll past would destroy it.
- **Specimen dims tiles to 13% and leaves them in place.** The globe's value is its *shape*. Removing nodes would break the connector lattice and leave a partial, unreadable structure — and it would also mean rebuilding the merged line geometry on every filter change. Dimming keeps the silhouette intact and lets the visitor see *where in the structure* the matches sit, which is information the list cannot show.

Connector lines touching a filtered-out card drop to 25%. Filtered-out tiles are removed from hit-testing and tab order in both views.

**If the current selection is filtered out**, selection moves to the first surviving project rather than becoming null — the rail should never be empty.

## 9. Selection, and Focus That Follows Rotation

Hover sets selection in both views (in Specimen, only when nothing is detached, so hovering the dimmed field doesn't fight the detached card). Keyboard sets selection too — and in the Specimen view, **selecting a card rotates the globe to bring it to the front.**

This is not a flourish. It is the fix for the concrete accessibility defect in hero §14: 48 cards in tab order on a 3D object, with nothing guaranteeing that a focused card is visible. Focus currently can and will land on a fogged card on the far side, behind other cards. The mechanism already exists — it is the stage-one re-centre from hero §9, minus the expand — so the fix costs almost nothing:

```
yawTarget   = −card.φ          (unwrapped to the nearest equivalent angle)
pitchTarget = clamp(−card.lat · 0.55, ±0.55)
```

Both lerp at 0.11/frame and release when within 0.004 rad. Any pointer drag cancels the auto-rotation immediately — user input always wins.

**Angle unwrapping is required, not optional.** Without it, rotating from φ = 350° to φ = 10° spins the long way around the globe. Add or subtract 2π from the target until it is within π of the current yaw.

**Keyboard map:**

| Key | Index | Specimen |
|---|---|---|
| `↑` / `↓` (or `k` / `j`) | Previous / next row | Previous / next ring, preserving angular position |
| `←` / `→` | — | Previous / next card within the ring, wrapping |
| `Enter` | Open case study | Open case study |
| `Escape` | Close panel | Close panel, else re-attach detached card |
| `v` | Switch view | Switch view |

Ring-to-ring movement preserves *fractional* angular position (`k / ringCount`) rather than absolute index, so moving from a 12-card ring to a 4-card ring lands near where you were, not at index 0.

## 10. Rail

Persistent right column, sticky below the toolbar. The constant across both views, which is what gives selection a stable home on screen.

- **Frame** (3:2 thumbnail) — **Index view only.** Hidden in Specimen, where the detached card is already the image; showing both is redundant and splits attention across two copies of the same picture.
- **Title**, then one-line summary.
- **Facts block:** year, lane, stack, status as label/value rows, monospace, above a hairline rule.
- **"Open case study"** — full-width ghost button, same treatment as hero §6's header pill.
- **Key hints** at the bottom, contents switching with the view.

Content crossfades on selection change (opacity to 0, swap at ~100ms, back to 1) rather than cutting, so rapid arrow-key movement reads as a dissolve rather than a flicker.

## 11. Shared `ProjectPanel` — Extraction

**The expanded case-study panel currently specified in hero §9–§11 becomes a section-agnostic component that both the hero and this section mount.** This is the single most valuable structural change in this document, and it should be done **before** this section is built, so the dependency points the right way.

The alternative — this section mounting the hero's panel — would make the new section depend on the old one, and every difference this section needs would land as a conditional inside hero code. That is the same cross-ownership coupling that produced two rounds of correction between the existing two specs, arriving one layer up.

**Contract:**

```ts
type ProjectPanelProps = {
  project: Project;
  onNext?: () => void;      // omit to hide next affordance
  onPrev?: () => void;
  onClose: () => void;
  showTeaser?: boolean;     // next-project teaser (hero §10 item 8)
  enterFrom?: DOMRect;      // rect to animate the panel open from
};
```

**Shared:** everything in hero §10 — fixed header with index and close, hero image, title + meta row, one-line summary, Overview/Approach/Outcome body, gallery, links row. Dark panel, `p-8` desktop / `p-4`–`p-6` mobile, hidden scrollbar.

**What forks, and why:**

| Concern | Hero | Work section |
|---|---|---|
| Opening animation | 3D card re-centres, sphere blurs, crossfade to overlay (hero §9) | Panel scales from the clicked row's or tile's rect |
| Next / previous | Scroll-driven with clamp, overshoot, rubber-band (hero §11) | Arrow keys and explicit affordances — scroll must scroll the list |
| Teaser | Shown — it is the only affordance for scroll-to-next | Hidden — redundant when next/prev is explicit |

`enterFrom` covers the opening-animation fork without the component knowing which section called it. The next/prev fork is entirely in the caller's handlers.

**Two costs that do not go away**, and should not be discovered later: the scroll-handler routing table in transition §14 keeps its full complexity (there are still two scroll routes, sphere and expanded-project), and the `backdrop-filter` blur over the WebGL canvas stays on the risk list, since it belongs to the hero's opening animation specifically.

## 12. Content Model — `lane`

Adds one field to `Project` (hero §13):

```ts
lane: "ai" | "tools" | "apps";
```

Three values, assigned once per project, never derived from `techStack` at runtime. Derivation was considered and rejected: stack is a poor proxy (a Go CLI and a Go inference server are not the same kind of work), and a derived value would silently reshuffle the Lane column whenever a stack string was edited.

Lane drives the Index's Lane column and its grouped sort. It does **not** affect sphere placement — ring assignment remains a pure function of the stable index (transition §8), and coupling it to lane would reintroduce exactly the fragile ring-to-content coupling that transition Appendix A records as v1's mistake.

Full assignment in Appendix C.

## 13. Routing & Deep Links

The hero's expanded panel has no URL. That is defensible for a hero. It is not defensible for a work section: without routing, no individual project can be shared, the back button does nothing, and none of the case-study text is crawlable.

- **`/work`** — the section, Index view, no selection.
- **`/work?view=specimen`** — Specimen view.
- **`/work/<project-id>`** — case-study panel open over whichever view was active.
- Filters and sort serialise to query params (`?status=shipped&stack=rust&sort=year:desc`) so a filtered view is shareable.
- **Back closes the panel** rather than leaving the section. Panel open pushes; close pops.
- **Case-study body renders server-side** into the document, not only into the client-mounted panel. The panel hydrates over it. This is the crawlability fix and it is most of the SEO value the site currently lacks.

The hero adopts `/work/<id>` for its own expanded panel too, so the same case study has one canonical URL regardless of which section opened it.

## 14. Accessibility

Deliberately stronger than hero §14, because a browsing surface has no excuse.

- **Skip link** to the Work section heading, and a skip-past-hero link at the top of the document.
- **Index view is fully operable by construction** — it is a real `<table>` with real rows, sortable headers as buttons with `aria-sort`, and arrow-key navigation layered on top rather than replacing tab.
- **Specimen tiles are focusable buttons**, and focus triggers the same rotation-to-front as selection (§9). A focused card is always a visible card.
- **The view toggle is a real tablist**; the stage is the tabpanel.
- **Filter chips are toggle buttons** with `aria-pressed` and their counts in the accessible name.
- **Live region** announcing result counts on filter change ("14 of 48 projects").
- **`prefers-reduced-motion`:** globe auto-rotation stops (drag still works), the view transition cuts, detach becomes an instant state change, rail crossfade becomes a swap.
- The Specimen view is an *alternative* presentation, never the only path to any content — everything reachable in it is reachable in the Index. This is what makes the 3D view safe to ship without a parallel screen-reader experience.

## 15. Performance & Fallback

- **Device-tier gate:** reuse hero §15's definition — it remains the single definition site, and this document must not restate the thresholds. When the gate fails, **the Specimen view is not offered**: the toggle is not rendered, and the section is Index-only. The Index is cheap, complete, and the better experience on a phone regardless.
- **Gate the globe's construction, not just its animation** — do not build the scene and hide it. Same principle as transition §15's "the pin is never created."
- **Build the globe once per section mount**, not per view switch. Toggle visibility and pause the render loop when Index is active; do not tear down and rebuild the DOM and geometry each time.
- **Renderer ownership:** this is the third consumer of the WebGL context (hero, About wall, Specimen). Introduce a scene-lifecycle manager that sections register with — who holds the renderer, who may drive the camera, how "pause when off-screen" generalises. The mid-toggle interruption rule from transition §11 ("never let two things drive the camera at once") becomes a general rule of that manager rather than a special case in one transition. Section four should be an instance of this pattern, not a fourth bespoke integration.
- **Render loop pauses** when the section is off-screen or when Index is the active view. `IntersectionObserver`, not scroll position.
- **Thumbnails:** texture atlas for the 48, rather than 48 separate loads. The atlas is shared with the hero — same 48 images, same texture, bound once.
- **Encoding:** AVIF or WebP, not PNG or JPEG. The AI-generated thumbnails are high-detail and compress poorly; this is where the page weight is.
- **Frame budget:** measure before this section lands and after. Sphere idle, detach in flight, and view transition, on a mid-tier laptop and a real phone. Without a baseline there is no way to attribute a regression once a fourth section exists.

## 16. Implementation Notes

- **State container:** one object (`view`, `sort`, `dir`, `cur`, `filters`), one `render()` that branches on `view`. Filters and selection are read by both renderers; neither renderer owns them.
- **FLIP utility is shared** between the Index's sort animation and the Specimen→Index transition — same capture-rects/mutate/animate-from-delta helper, two call sites. The Index→Specimen direction cannot use it (§7) and is the deliberate exception.
- **Projection:** the Specimen's per-frame math is the hero's, restricted to outside mode. Do not fork it — extract the shared projection and orientation helpers when doing the `ProjectPanel` extraction (§11), as one refactor pass rather than two.
- **Hit-testing:** if the Specimen is built with real Three.js meshes rather than projected DOM, raycast against the card meshes; do not attempt pointer-events on projected DOM proxies. If it is built with projected DOM (viable at 48 cards and considerably simpler), zIndex must be written from `−z` every frame or click targets will fight the visual stacking.
- **Detach anchor is screen-space, not world-space.** Computing it as a world position in front of the camera makes it drift as the camera's framing distance changes on resize. Anchor to the stage rect.
- **Sort stability:** always tiebreak on stable index, so equal keys (three projects in 2024, `shipped`) produce a deterministic order rather than an engine-dependent one.
- **Group headers are rendered as rows** inside `<tbody>` with `colspan`, not as separate tables — otherwise column widths desynchronise between groups.
- **Do not animate `filter` or `backdrop-filter` on the globe stage.** The dim during detach is per-card opacity, which is cheap; a stage-level blur over the canvas is the same performance cliff flagged in the hero's expand path.

## 17. Settled Decisions

- Third section, after the About wall; ordinary scroll, no pin, no scrub — one pinned section per page and the hero has it (§1).
- Two views over one shared state: Index (default) and Specimen (§2).
- Index is the default, deliberately — the section's job is legibility after two spectacle sections (§2, Concept).
- Filters and selection are shared across views; sort is Index-only because a sphere cannot express an ordering (§3).
- Selection is stored as a project id, never a row index or ring slot (§3).
- Index carries no row thumbnails; the rail carries the image (§4).
- Grouped sort headers appear for Year, Status, and Lane only (§4).
- Specimen reuses hero §5's outside/orbit camera, tangent-to-surface orientation, fog pair, and drag sign flip — it is not a second sphere (§5).
- Specimen pitch is clamped to ±0.7 rad, unlike the hero's unclamped pitch, because tangent-to-surface cards have no billboard protection (§5).
- Ring assignment follows the stable index, so newest work lands in the 4-card polar ring — hierarchy at no cost (§5).
- Detach: one card at a time, globe keeps rotating, second click escalates to the case study, background click re-attaches (§6).
- Detach is a per-frame lerp on a scalar, not a fixed-duration tween, so interruption resolves smoothly (§6).
- View transition matches cards by stable index; Index→Specimen blends in the render loop, Specimen→Index uses WAAPI FLIP (§7).
- Filtering removes rows in the Index but dims tiles in the Specimen, because the list's value is density and the globe's is shape (§8).
- Filter chip counts are computed against the prospective set, not the current one (§8).
- Keyboard selection rotates the globe to bring the focused card forward — the fix for hero §14's invisible-focus defect (§9, §14).
- Rail is persistent across both views; its thumbnail frame hides in Specimen where the detached card is already the image (§10).
- The expanded panel is extracted to a shared `ProjectPanel` mounted by both sections; extraction happens **before** this section is built (§11).
- `lane` is authored per project, never derived from `techStack`, and never affects sphere placement (§12).
- Individual projects get URLs (`/work/<id>`), case-study bodies render server-side, and the hero adopts the same routes (§13).
- Specimen is an alternative presentation, never the sole path to content — which is what makes it safe to ship without a parallel screen-reader view (§14).
- Device-tier gate failure removes the Specimen view entirely rather than degrading it; the globe's construction is gated, not just its animation (§15).
- Shared constants live in one module; derived values (grid aspect, gate band) are computed and asserted, never typed as literals (§0).
- A scene-lifecycle manager arrives with this section, so section four is an instance of a pattern rather than a fourth bespoke integration (§15).

## Appendix A — Considered and Rejected

**Bento reflow as the primary layout.** A dense variable-footprint grid where cell size encodes hierarchy, re-packing on filter with FLIP. Genuinely good, and it solves the hierarchy problem the hero has. Rejected because the pattern is common enough now that execution has to carry it entirely, and because a deterministic shelf packer that never orphans single-column gaps is real work for a benefit the Index achieves with sorting.

**Query console as the primary interface.** A small parser (`stack:rust year:>2024 status:shipped`) over a plain grid. Rejected as a *primary* surface for discoverability — an empty input above 48 cards tells a first-time visitor nothing. Worth revisiting as a **layer over the Index**, where the grid is already populated and browsable and the console is an accelerator rather than a gate. The filter state it would drive already exists (§8), so the marginal cost is a tokeniser.

**Flat commit-graph timeline** (lanes, nodes by year, bezier edges). Rejected twice: it scans poorly, and the real year distribution (11 / 16 / 14 / 7 across 2023–2026) makes it visibly lumpy. Spacing by index instead of true time would fix the lumpiness by abandoning the premise.

**Sphere variants explored and rejected for this section** — drum (cylinder, no polar falloff), exploded rings, nested shells (one sphere per year, scroll to dive inward), focus ring, unwrapped equirectangular grid, braid, hex mesh. Each solved the small-card problem in a different way. All were rejected in favour of the outside-view Specimen because it is the only one that reuses hero §5 wholesale rather than defining new geometry, and because the detach mechanic (§6) solves card size directly instead of designing around it. Nested shells is the strongest of the rejected set and the one to revisit if Specimen underperforms in testing — it turns scroll into passage rather than scrub, which is a genuinely new mechanic.

**Detach target in world space.** Rejected in favour of a screen-space anchor; the world-space version drifts on resize as the framing distance is re-solved (§16).

**Deriving `lane` from `techStack`.** Rejected — stack is a poor proxy for kind of work, and derivation makes the Lane column mutate whenever a stack string is edited (§12).

## Appendix B — Open Items

1. **Detach anchor on narrow viewports.** `cx − 0.17·W` is tuned against a ~1000px stage. Below ~760px the rail stacks above the stage and the anchor should probably become centred. Needs a real device check, not a formula.
2. **Whether the Specimen keeps cross-lane connectors.** Hero §3 specifies same-ring and adjacent-ring only. Adding shared-stack chords would make lane relationships visible, but they compete with the detach dim for attention. Prototype both before deciding.
3. **Atlas sharing with the hero.** If the hero has already built the atlas and is paused off-screen, this section should bind the existing texture rather than reloading. Depends on the scene-lifecycle manager (§15) landing first.
4. **Whether `/work` should be a route or an anchor.** A real route implies the hero and About wall do not render on `/work/<id>` — which is better for load time and for sharing, but means the site is no longer a single scrolling page. Decide before implementing §13.

## Appendix C — Lane Assignment

Stable index → lane. Ordering matches hero Appendix B; ring column repeated there, not here.

| Slot | Project ID | Lane |
|---:|---|---|
| 0 | `personal-ai-employee` | ai |
| 1 | `crm-digital-fte` | apps |
| 2 | `agent-forge` | ai |
| 3 | `finance-tracker` | apps |
| 4 | `devdocs-ai` | ai |
| 5 | `estate-ease` | apps |
| 6 | `physical-ai-textbook` | apps |
| 7 | `prompt-orchestrator` | ai |
| 8 | `vision-index` | ai |
| 9 | `voice-scribe` | ai |
| 10 | `rag-pipeline-kit` | ai |
| 11 | `agent-memory` | ai |
| 12 | `synth-data-factory` | ai |
| 13 | `eval-harness` | ai |
| 14 | `deploy-pilot` | tools |
| 15 | `log-lens` | tools |
| 16 | `infra-graph` | tools |
| 17 | `canary-watch` | tools |
| 18 | `vault-console` | tools |
| 19 | `invoice-flow` | apps |
| 20 | `meeting-scribe` | ai |
| 21 | `form-forge` | tools |
| 22 | `waitlist-kit` | apps |
| 23 | `changelog-cms` | apps |
| 24 | `slot-engine` | tools |
| 25 | `habit-loop` | apps |
| 26 | `pantry-scan` | ai |
| 27 | `transit-pulse` | apps |
| 28 | `metric-mirror` | tools |
| 29 | `funnel-scope` | tools |
| 30 | `query-canvas` | tools |
| 31 | `git-pulse` | tools |
| 32 | `env-sync` | tools |
| 33 | `scaffold-cli` | tools |
| 34 | `mock-mesh` | tools |
| 35 | `rate-gate` | tools |
| 36 | `webhook-relay` | tools |
| 37 | `hot-cache` | tools |
| 38 | `audit-trail` | tools |
| 39 | `token-forge` | tools |
| 40 | `stream-ui` | apps |
| 41 | `veritas` | ai |
| 42 | `chart-kit` | tools |
| 43 | `snippet-vault` | tools |
| 44 | `doc-search` | ai |
| 45 | `pixel-sort` | apps |
| 46 | `sound-map` | apps |
| 47 | `terminal-studio` | tools |

Distribution: **ai 14, tools 22, apps 12.** The imbalance is real and should not be corrected by reassignment — `tools` genuinely is the largest body of work. It does mean grouped-sort-by-lane produces one long run, which is the honest shape of the roster.

## Related documents

`3d-sphere-cta-prompt.md` — hero spec. This document depends on its card system (§2), connector lines (§3), outside/orbit camera and tangent-to-surface orientation (§5), idle/drag physics (§7–§8), expanded-panel structure (§10), content model (§13), and device-tier gate (§15). It amends that document's §9–§11 (panel extraction), §13 (`lane` field), and §14 (focus-follows-rotation).

`sphere-to-about-transition-spec.md` — transition spec. This section is what the About wall hands scroll to at pin-end (§15). This document depends on its decoupled index mapping and ring table (§8) and adopts its progress-keyed-over-time-keyed principle for the detach lerp (§6).
