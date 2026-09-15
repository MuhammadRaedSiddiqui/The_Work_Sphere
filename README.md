# The Work Sphere

A single-page portfolio for Raed Siddiqui, built around one shared system of 48 project cards.

The page moves from an interactive Hero sphere, through a scroll-pinned About wall, into a filterable Work index and orbitable Specimen globe, then resolves in a compact contact section.

## Highlights

- 48 projects arranged across six latitude rings in a Three.js sphere
- Hero card exploration with keyboard access and in-place project panels
- Scroll-pinned Hero-to-About transition that dismantles the sphere into a flat video wall
- Sortable, filterable Work table with deterministic ordering and FLIP row transitions
- Specimen globe that reuses the same project data and sphere geometry
- Drag momentum, keyboard navigation, focus-following rotation, and click-to-detach project cards
- Shared project panel with direct open/close transitions from rows, tiles, and Hero cards
- Device-tier and reduced-motion fallbacks
- AVIF/WebP project imagery and a shared thumbnail atlas for the WebGL scenes

## Stack

- React 18
- TypeScript
- Vite
- Three.js
- GSAP + ScrollTrigger

## Local development

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Production build

```bash
npm run build
```

The build type-checks the application, validates the project-lane data, builds the Vite bundle, and generates the configured static output.

## Project structure

```text
src/
  components/       React sections and the shared project panel
  data/projects.ts  The 48-project content source
  scene/            Three.js scenes, shared sphere geometry, textures, lifecycle management
  utils/            Device gates and FLIP helper
  constants.ts      Shared visual, geometry, and layout constants
specs/              Interaction and visual specifications
public/img/         Project images and atlas inputs
```

## Interaction model

- **Hero:** drag to explore the sphere; choose a card to open its project panel.
- **About:** the sphere becomes a flat wall as the page scrolls through the pinned transition.
- **Work / Index:** sort, filter, select, and open projects from a conventional data table.
- **Work / Specimen:** orbit the same 48 cards; first click detaches a card for inspection, second click opens its project panel.
- **Contact:** email, GitHub, and availability details at the page close.

## Accessibility and motion

The Index is the primary accessible browsing surface. It is a real table with keyboard-operable controls. Specimen supplies focusable tiles and rotates keyboard-selected cards toward the viewer. Reduced-motion preferences remove staged motion and globe auto-rotation while preserving content access.

## License

All portfolio content and imagery are © Raed Siddiqui. Code licensing is not currently specified.
