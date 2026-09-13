# Performance baseline and optimized run

Harness: `scripts/measure-work-performance.cjs`, local production preview, Edge headless at 1440×900. These are desktop-lab numbers only; a real-phone pass still requires physical-device capture.

| Metric | Before | After |
|---|---:|---:|
| Sphere idle average / p95 frame time | 35.64 / 150.30 ms | 16.67 / 16.80 ms |
| About mid-flight average / p95 | 16.67 / 17.30 ms | 16.67 / 16.80 ms |
| Specimen detach average / p95 | 16.67 / 17.20 ms | 16.68 / 16.80 ms |
| View transition average / p95 | 16.68 / 17.00 ms | 16.68 / 16.90 ms |
| Initial transferred resources | 15.3 KB | 1.2 KB |
| LCP | 380 ms | 288 ms |

The before run was recorded 2026-09-08 on Edge 152; after was recorded 2026-09-13 on Edge 153. Browser version changed, so treat the delta as an indicative local regression check, not a cross-device benchmark.

Image source assets before optimization contained 336 MB of JPEGs. The project now emits AVIF and WebP siblings and a 48-cell shared thumbnail atlas (`thumbnail-atlas.avif` 308,776 bytes; WebP fallback 498,350 bytes). Original JPEGs remain as compatibility fallbacks and source masters.

Follow-up deliberately excluded from this work: replacing the existing `backdrop-filter` path.

## Scene lifecycle attribution

The historical pre-P3 implementation is not present in this checkout, so its numbers cannot be measured honestly after the fact. The following is deliberately separate from the image-atlas table.

At the requested position—About scrolled past, Work reached, and Specimen still inactive—the production-preview diagnostics measured `rafActive: false`, no visible registered scenes, and `0` scene updates during a 1.2 s sample (`updateCount` remained 56). This verifies that the current IntersectionObserver lifecycle gate pauses both rendering and per-frame scene updates in that between-sections state; it is not merely render suppression. Reproduce with `node scripts/measure-offscreen-pause.cjs`.
