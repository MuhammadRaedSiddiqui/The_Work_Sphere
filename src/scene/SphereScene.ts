import * as THREE from "three";
import {
  ARRIVAL_END,
  BACKGROUND_COLOR,
  BLUEPRINT_END,
  CONNECTOR_LINE_OPACITY,
  FLIGHT_END,
  IDLE_STROKE_OPACITY,
  INTERACTION_LOCK_EPSILON,
  OUTSIDE_CONNECTOR_LINE_OPACITY,
  PHOTO_INDICES,
  photoSliceUV,
  REVEAL_END,
  ZONES,
} from "../constants";
import {
  cardSlots,
  buildConnectorPairs,
  CARD_WIDTH,
  CARD_HEIGHT,
  SPHERE_RADIUS,
  GRID_WIDTH,
  GRID_HEIGHT,
  gridPositions,
} from "./layout";
import { getComingSoonTexture, getPhotoTexture, getCachedThumbnail, loadThumbnailTexture, markScrollIntent, hasScrollIntent, preloadThumbnails } from "./textures";
import { projects } from "../data/projects";
import type { Project } from "../types";

const IDLE_SPEED = 0.045;
const MOMENTUM_DECAY = 2.6;
const IDLE_RESUME_EPS = 0.01;
const STROKE_OPACITY = IDLE_STROKE_OPACITY;
const STROKE_BOOST = 0.9;
const STROKE_BOOST_END = 0.78;
const LINE_OPACITY = CONNECTOR_LINE_OPACITY;
const OUTSIDE_LINE_OPACITY = OUTSIDE_CONNECTOR_LINE_OPACITY;
const ENTRANCE_DURATION = 0.9;

const TOGGLE_TARGET_FRAC = 0.70;
const TOGGLE_LERP_RATE = 5.5;
const INSIDE_CAM_Z = 0.01;
const FOG_INSIDE_NEAR = SPHERE_RADIUS * 1.6;
const FOG_INSIDE_FAR = SPHERE_RADIUS * 3.2;

// Photo — SINGLE UNSLICED image spanning the zone's aggregate rect (§4 final).
// No per-card UV inset, no bezel, no tiled seams. Each of the 8 photo cards
// maps a continuous sub-rect of the shared BW texture with no inset. Spacing →0 at p=1
// makes the 8 cards read as one seamless portrait, ~1/3 zoned width, full height.
// Do not reintroduce live filters or mosaic — the file itself is the BW master.

type Card = {
  slot: (typeof cardSlots)[number];
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  outline: THREE.LineSegments;
  entranceDelay: number;
  // Phase 5: keep original map refs for state-machine swaps
  thumbMap: THREE.Texture | null;
  isPhoto: boolean;
  baseGeometry: THREE.PlaneGeometry; // for photo cards holds the UV-inset clone
};

export class SphereScene {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private cards: Card[] = [];
  private connectors: THREE.LineSegments;
  private connectorBasePositions: Float32Array;
  private connectorGridPositions: Float32Array;

  private rot = new THREE.Quaternion();
  private idleAngle = 0;
  private angVel = { x: 0, y: 0 };
  private dragging = false;
  private lastPointer: { x: number; y: number; t: number } | null = null;
  private dragStart: { x: number; y: number } | null = null;
  private clickCandidate = false;

  private clock = new THREE.Clock();
  private elapsed = 0;
  private resizeTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly resizeDelayMs = 150;
  private rafId = 0;
  private disposed = false;
  private pausedOffscreen = false;
  private reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  private scrubP = 0;
  private coverDistance = 8;

  private toggleProgress = 0;
  private viewModeTarget: 0 | 1 = 0;
  private outsideDistance = 12;
  private outsideFogNear = FOG_INSIDE_NEAR;
  private outsideFogFar = FOG_INSIDE_FAR;
  private onViewModeChangeCb: ((mode: "inside" | "outside", progress: number) => void) | null = null;

  // Phase 5: scrub-driven UI hooks
  private onScrubCb: ((p: number) => void) | null = null;
  private vignetteEl: HTMLElement | null = null;

  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private onCardClickCb: ((slotIndex: number, screenRect: DOMRect) => void) | null = null;
  private expandedSlotIndex: number | null = null;

  private tmpQ = new THREE.Quaternion();
  private tmpQ2 = new THREE.Quaternion();
  private tmpQBillboard = new THREE.Quaternion();
  private tmpQTangent = new THREE.Quaternion();
  private tmpV = new THREE.Vector3();
  private tmpV2 = new THREE.Vector3();
  private tmpV3 = new THREE.Vector3();

  // Colors for arrival fade — reused object to avoid alloc
  private blackColor = new THREE.Color(BACKGROUND_COLOR);
  private whiteColor = new THREE.Color(0xffffff);

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.domElement.style.touchAction = "none";
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(BACKGROUND_COLOR);
    this.scene.fog = new THREE.Fog(BACKGROUND_COLOR, FOG_INSIDE_NEAR, FOG_INSIDE_FAR);

    this.camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 100);
    this.camera.position.set(0, 0, INSIDE_CAM_Z);
    this.coverDistance = this.computeCoverDistance();
    this.outsideDistance = this.computeOutsideDistance();
    this.updateOutsideFogValues();

    this.buildCards();
    const built = this.buildConnectors();
    this.connectors = built.lines;
    this.connectorBasePositions = built.basePositions;
    this.connectorGridPositions = built.gridPositions;

    this.bindPointer();
    window.addEventListener("resize", this.onResize);
    // iOS Safari: URL-bar collapse fires visualViewport resize, not window resize
    const vv = (window as unknown as { visualViewport?: VisualViewport }).visualViewport;
    if (vv) {
      vv.addEventListener("resize", this.onResize);
      vv.addEventListener("scroll", this.onResize);
    }
    // Pin-end handoff: pause WebGL once wall fully off-screen (§15)
    this.setupOffscreenPause();
    this.animate();
  }

  setScrubProgress(p: number) {
    this.scrubP = THREE.MathUtils.clamp(p, 0, 1);
    this.onScrubCb?.(this.scrubP);
  }

  setOnScrub(cb: ((p: number) => void) | null) { this.onScrubCb = cb; }

  getViewMode(): "inside" | "outside" {
    return this.viewModeTarget === 1 ? "outside" : "inside";
  }
  getToggleProgress(): number { return this.toggleProgress; }
  isToggleAnimating(): boolean { return Math.abs(this.toggleProgress - this.viewModeTarget) > 0.001; }
  setOnViewModeChange(cb: ((mode: "inside" | "outside", progress: number) => void) | null) { this.onViewModeChangeCb = cb; }
  setViewMode(mode: "inside" | "outside") {
    const target: 0 | 1 = mode === "outside" ? 1 : 0;
    if (target === this.viewModeTarget) return;
    this.viewModeTarget = target;
    if (this.reduceMotion) {
      this.toggleProgress = target;
      this.syncFogImmediate();
      this.notifyViewModeChange();
      return;
    }
    this.notifyViewModeChange();
  }
  toggleViewMode() { this.setViewMode(this.viewModeTarget === 1 ? "inside" : "outside"); }

  private computeOutsideDistance(): number {
    const fovRad = (this.camera.fov * Math.PI) / 180;
    const halfTan = Math.tan(fovRad / 2);
    if (halfTan < 1e-6) return SPHERE_RADIUS * 2.5;
    return SPHERE_RADIUS / (TOGGLE_TARGET_FRAC * halfTan);
  }
  private computeCoverDistance(): number {
    // Axis-fit COVER (spec §10): distance = min(dHeightFit, dWidthFit)
    // where dHeightFit = gridH/(2·tan(fov/2)), dWidthFit = gridW/(2·tan(fov/2)·aspect).
    // This makes the grid COVER the viewport (one axis fills exactly, the other crops
    // the unzoned outer ring). Do NOT use min(vw/GW, vh/GH) — that's contain/letterbox.
    const fovRad = (this.camera.fov * Math.PI) / 180;
    const halfTan = Math.tan(fovRad / 2);
    const aspect = this.camera.aspect || this.container.clientWidth / Math.max(this.container.clientHeight, 1);
    const dHeightFit = GRID_HEIGHT / (2 * halfTan);
    const dWidthFit = GRID_WIDTH / (2 * halfTan * aspect);
    return Math.min(dHeightFit, dWidthFit);
  }
  private updateOutsideFogValues() {
    this.outsideFogNear = this.outsideDistance * 0.75;
    this.outsideFogFar = this.outsideDistance * 1.85;
  }
  private syncFogImmediate() {
    if (!(this.scene.fog instanceof THREE.Fog)) return;
    const t = this.toggleProgress;
    const flightT = THREE.MathUtils.clamp(this.scrubP / FLIGHT_END, 0, 1);
    const nearT = THREE.MathUtils.lerp(FOG_INSIDE_NEAR, this.outsideFogNear, t);
    const farT = THREE.MathUtils.lerp(FOG_INSIDE_FAR, this.outsideFogFar, t);
    this.scene.fog.near = THREE.MathUtils.lerp(nearT, this.coverDistance * 2, flightT);
    this.scene.fog.far = THREE.MathUtils.lerp(farT, this.coverDistance * 4, flightT);
  }
  private notifyViewModeChange() { this.onViewModeChangeCb?.(this.getViewMode(), this.toggleProgress); }

  setOnCardClick(cb: ((slotIndex: number, screenRect: DOMRect) => void) | null) { this.onCardClickCb = cb; }
  setExpandedSlot(index: number | null) { this.expandedSlotIndex = index; }
  getCardScreenPosition(slotIndex: number): DOMRect | null {
    const card = this.cards.find((c) => c.slot.index === slotIndex);
    if (!card) return null;
    card.mesh.updateMatrixWorld(true);
    const containerRect = this.container.getBoundingClientRect();
    const corners = [
      new THREE.Vector3(-CARD_WIDTH / 2, -CARD_HEIGHT / 2, 0),
      new THREE.Vector3(-CARD_WIDTH / 2, CARD_HEIGHT / 2, 0),
      new THREE.Vector3(CARD_WIDTH / 2, -CARD_HEIGHT / 2, 0),
      new THREE.Vector3(CARD_WIDTH / 2, CARD_HEIGHT / 2, 0),
    ].map((corner) => card.mesh.localToWorld(corner).project(this.camera));
    const xs = corners.map((corner) => containerRect.left + (corner.x * 0.5 + 0.5) * containerRect.width);
    const ys = corners.map((corner) => containerRect.top + (-corner.y * 0.5 + 0.5) * containerRect.height);
    const left = Math.min(...xs);
    const top = Math.min(...ys);
    return new DOMRect(left, top, Math.max(...xs) - left, Math.max(...ys) - top);
  }
  getScrubProgress() { return this.scrubP; }
  getCoverDistance() { return this.coverDistance; }

  // Project a zone's rect to screen for HTML overlay (§4, §16)
  getZoneScreenRect(zoneKey: keyof typeof ZONES): { left: number; top: number; width: number; height: number } | null {
    const zone = ZONES[zoneKey];
    if (!zone) return null;
    // Project the four corner cards' centers + half-sizes to form bounding box
    const indices = zone.indices;
    if (indices.length === 0) return null;
    // Compute world-space bounding box of the zone on the wall (z=0 plane)
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const idx of indices) {
      const [gx, gy] = gridPositions[idx];
      minX = Math.min(minX, gx - CARD_WIDTH / 2);
      maxX = Math.max(maxX, gx + CARD_WIDTH / 2);
      minY = Math.min(minY, gy - CARD_HEIGHT / 2);
      maxY = Math.max(maxY, gy + CARD_HEIGHT / 2);
    }
    const corners = [
      new THREE.Vector3(minX, maxY, 0),
      new THREE.Vector3(maxX, maxY, 0),
      new THREE.Vector3(minX, minY, 0),
      new THREE.Vector3(maxX, minY, 0),
    ];
    let sxMin = Infinity, sxMax = -Infinity, syMin = Infinity, syMax = -Infinity;
    for (const c of corners) {
      const p = c.clone().project(this.camera);
      const x = (p.x * 0.5 + 0.5) * this.container.clientWidth;
      const y = (-p.y * 0.5 + 0.5) * this.container.clientHeight;
      sxMin = Math.min(sxMin, x); sxMax = Math.max(sxMax, x);
      syMin = Math.min(syMin, y); syMax = Math.max(syMax, y);
    }
    return { left: sxMin, top: syMin, width: sxMax - sxMin, height: syMax - syMin };
  }

  // Vignette element driven by scrub (fades out approaching flat, §12)
  setVignetteEl(el: HTMLElement | null) { this.vignetteEl = el; }

  private buildCards() {
    const baseGeometry = new THREE.PlaneGeometry(CARD_WIDTH, CARD_HEIGHT);
    const edgeGeometry = new THREE.EdgesGeometry(baseGeometry);
    const soon = getComingSoonTexture();
    const photoTex = getPhotoTexture();

    cardSlots.forEach((slot) => {
      const project = projects[slot.index];
      const isPhoto = PHOTO_INDICES.has(slot.index);
      let geometry: THREE.PlaneGeometry = baseGeometry;

      if (isPhoto) {
        // Single unsliced portrait — continuous sub-rect per card, no inset, no bezel (§4 final).
        // Computed once at build, not per-frame. The 8 cards together read as one seamless
        // BW image bleeding to the top/right/bottom of its zone with zero border.
        geometry = baseGeometry.clone() as THREE.PlaneGeometry;
        const uvAttr = geometry.getAttribute("uv") as THREE.BufferAttribute;
        const slice = photoSliceUV(slot.index)!;
        for (let i = 0; i < uvAttr.count; i++) {
          const u = uvAttr.getX(i);
          const v = uvAttr.getY(i);
          const nu = THREE.MathUtils.lerp(slice.u0, slice.u1, u);
          const nv = THREE.MathUtils.lerp(slice.v0, slice.v1, v);
          uvAttr.setXY(i, nu, nv);
        }
        uvAttr.needsUpdate = true;
      }

      // Initial map is always coming-soon.jpg (progressive: render coming-soon first,
      // swap to full texture on load complete). Thumbnails are exactly 3:2, matching
      // card aspect, so plain UV full-face — no cover-crop/repeat math.
      let materialMap: THREE.Texture | null = soon;

      const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        map: materialMap,
        transparent: true, // must render AFTER the lines — opaque objects always render before transparent ones in Three.js
        depthWrite: true, // cards still occlude each other correctly
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
        fog: true,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.renderOrder = 0;

      const outline = new THREE.LineSegments(
        edgeGeometry,
        new THREE.LineBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: STROKE_OPACITY,
          depthTest: true,
          depthWrite: false,
          fog: true,
        })
      );
      mesh.add(outline);
      this.scene.add(mesh);

      let thumbMap: THREE.Texture | null = null;
      if (project) {
        thumbMap = materialMap;
      } else {
        thumbMap = null;
      }

      const ringStagger = slot.ring * 0.12;
      this.cards.push({
        slot,
        mesh,
        outline,
        entranceDelay: this.reduceMotion ? Infinity : ringStagger + slot.indexInRing * 0.04,
        thumbMap,
        isPhoto,
        baseGeometry: geometry,
      });
    });
    // Keep photoTexture ready (warms the texture) — real featured 1600 loads in background
    void photoTex;
    // Eagerly load thumbnails immediately (progressive: coming-soon first, swap when each loads).
    // Swaps are gated to p<=0.02 so flight never pops, but idle p=0 shows real thumbs right away.
    this.warmThumbnailsEagerly();
  }

  /**
   * Progressive eager load: only the first hemisphere (≈12 cards) starts immediately
   * with low concurrency so the initial sphere isn't blocked or network-flooded.
   * The remaining 36 are not loaded until scroll intent fires, so the flight never
   * pops. An idle fallback batches the rest after 2.5s if the user never scrolls,
   * still throttled. All swaps still gated to p≤0.02 in updateCards.
   */
  private warmThumbnailsEagerly(): void {
    const realProjects = projects.filter((p): p is Project => !!p);
    const initial = realProjects.slice(0, 12);
    const remaining = realProjects.slice(12);
    // Low-concurrency initial window — shows real thumbs on the facing hemisphere quickly
    void preloadThumbnails(initial, 3);
    // Defer remaining until scroll intent or idle timeout
    const idleTimer = setTimeout(() => {
      if (this.disposed) return;
      if (hasScrollIntent()) return;
      // Still throttled; scroll intent will accelerate any untouched ones
      void preloadThumbnails(remaining, 2);
    }, 2500);
    // Allow dispose to cancel
    (this as unknown as { _thumbIdleTimer?: ReturnType<typeof setTimeout> })._thumbIdleTimer = idleTimer;
  }

  /**
   * Phase 7 — Thumbnail preload on scroll intent.
   * Called once when the user shows scroll intent (wheel/touch scroll). Starts
   * loading real thumbnails with concurrency throttling; swaps are gated to safe
   * scrub windows (p≤0.02) so flight never pops.
   */
  notifyScrollIntent(): void {
    if (hasScrollIntent()) return;
    markScrollIntent();
    const realProjects = projects.filter((p): p is Project => !!p);
    void preloadThumbnails(realProjects, 4).then(() => {
      // After cache fills, eligible swaps happen in updateCards when safe
      if (this.disposed) return;
      // Trigger one immediate safe-swap pass if we're at sphere
      if (this.scrubP <= INTERACTION_LOCK_EPSILON) this.applyPendingThumbnailSwaps();
    });
    // Also warm individual loads as fallback for any slot that already cached
    for (const p of realProjects) {
      void loadThumbnailTexture(p).then((tex) => {
        if (this.disposed) return;
        // Try swap if safe; otherwise it will happen on next safe window in updateCards
        if (this.scrubP <= INTERACTION_LOCK_EPSILON) {
          const card = this.cards.find((c) => projects[c.slot.index]?.id === p.id);
          if (!card || card.isPhoto && this.scrubP >= FLIGHT_END) return;
          if (card.thumbMap !== tex) {
            card.thumbMap = tex;
            if (this.scrubP <= FLIGHT_END) {
              const mat = card.mesh.material as THREE.MeshBasicMaterial;
              mat.map = tex;
              mat.needsUpdate = true;
            }
          }
        }
      });
    }
  }

  private applyPendingThumbnailSwaps(): void {
    if (this.scrubP > INTERACTION_LOCK_EPSILON) return;
    for (const card of this.cards) {
      const proj = projects[card.slot.index];
      if (!proj) continue;
      const cached = getCachedThumbnail(proj.id);
      if (!cached || cached === card.thumbMap) continue;
      card.thumbMap = cached;
      // Only swap visible map if still in flight-safe window (thumbnails persist through flight)
      if (this.scrubP <= FLIGHT_END) {
        const mat = card.mesh.material as THREE.MeshBasicMaterial;
        // Don't overwrite photo mosaic when settled
        if (card.isPhoto && this.scrubP >= BLUEPRINT_END) continue;
        mat.map = cached;
        mat.needsUpdate = true;
      }
    }
  }

  private buildConnectors(): { lines: THREE.LineSegments; basePositions: Float32Array; gridPositions: Float32Array; } {
    const pairs = buildConnectorPairs();
    const base = new Float32Array(pairs.length * 6);
    const grid = new Float32Array(pairs.length * 6);
    pairs.forEach(([a, b], i) => {
      const pa = cardSlots[a].position;
      const pb = cardSlots[b].position;
      base.set([...pa, ...pb], i * 6);
      const ga = gridPositions[a];
      const gb = gridPositions[b];
      grid.set([...ga, ...gb], i * 6);
    });
    const geometry = new THREE.BufferGeometry();
    const geometryPositions = new Float32Array(base);
    geometry.setAttribute("position", new THREE.BufferAttribute(geometryPositions, 3));
    const material = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: LINE_OPACITY,
      depthWrite: false,
      depthTest: false, // drawn before anything; nothing to test yet
      fog: true,
    });
    const lines = new THREE.LineSegments(geometry, material);
    lines.renderOrder = -1; // put them at the head of the queue
    this.scene.add(lines);
    return { lines, basePositions: base, gridPositions: grid };
  }

  private bindPointer() {
    const el = this.renderer.domElement;
    el.addEventListener("pointerdown", this.onPointerDown);
    el.addEventListener("pointermove", this.onPointerMove);
    el.addEventListener("pointerup", this.onPointerUp);
    el.addEventListener("pointercancel", this.onPointerUp);
  }

  private onPointerDown = (e: PointerEvent) => {
    if (this.scrubP > INTERACTION_LOCK_EPSILON) return;
    if (this.expandedSlotIndex !== null) return;
    this.dragging = true;
    this.clickCandidate = true;
    this.dragStart = { x: e.clientX, y: e.clientY };
    this.angVel = { x: 0, y: 0 };
    this.lastPointer = { x: e.clientX, y: e.clientY, t: performance.now() };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.dragging || !this.lastPointer) return;
    if (this.scrubP > INTERACTION_LOCK_EPSILON) return;
    if (this.expandedSlotIndex !== null) return;
    const now = performance.now();
    const dt = Math.max((now - this.lastPointer.t) / 1000, 1e-4);
    let dx = e.clientX - this.lastPointer.x;
    let dy = e.clientY - this.lastPointer.y;
    const isOutside = this.toggleProgress > 0.5;
    if (isOutside) { dx *= -1; dy *= -1; }
    if (this.dragStart) {
      const totalDx = e.clientX - this.dragStart.x;
      const totalDy = e.clientY - this.dragStart.y;
      if (Math.hypot(totalDx, totalDy) > 6) this.clickCandidate = false;
    }
    this.applyDrag(dx, dy);
    this.angVel.y = (dx * this.DRAG_TO_RAD) / dt;
    this.angVel.x = (dy * this.DRAG_TO_RAD) / dt;
    this.lastPointer = { x: e.clientX, y: e.clientY, t: now };
  };

  private readonly DRAG_TO_RAD = 0.005;

  private onPointerUp = (e: PointerEvent) => {
    const wasDragging = this.dragging;
    if (this.dragging) { this.dragging = false; this.lastPointer = null; }
    if (wasDragging && this.clickCandidate && this.scrubP <= INTERACTION_LOCK_EPSILON && this.expandedSlotIndex === null && this.onCardClickCb) {
      const rect = this.container.getBoundingClientRect();
      this.ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.ndc, this.camera);
      const meshes = this.cards.map((c) => c.mesh);
      const hits = this.raycaster.intersectObjects(meshes, false);
      if (hits.length > 0) {
        const hitMesh = hits[0].object as THREE.Mesh;
        const card = this.cards.find((c) => c.mesh === hitMesh);
        if (card) {
          const project = projects[card.slot.index];
          if (project) {
            const screenRect = this.getCardScreenPosition(card.slot.index) || new DOMRect(e.clientX, e.clientY, 0, 0);
            this.onCardClickCb(card.slot.index, screenRect);
          }
        }
      }
    }
    this.clickCandidate = false;
    this.dragStart = null;
    if (!wasDragging) this.lastPointer = null;
  };

  private applyDrag(dxPx: number, dyPx: number) {
    const yaw = -dxPx * this.DRAG_TO_RAD;
    const pitch = -dyPx * this.DRAG_TO_RAD;
    this.tmpQ.setFromAxisAngle(AXIS_Y, yaw);
    this.rot.premultiply(this.tmpQ);
    this.tmpQ.setFromAxisAngle(AXIS_X, pitch);
    this.rot.premultiply(this.tmpQ);
  }

  private setupOffscreenPause() {
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        this.setOffscreenPaused(!entry.isIntersecting);
      },
      { threshold: 0 }
    );
    io.observe(this.container);
    // Store for dispose via closure — we recreate on each construction only
    (this as unknown as { _io: IntersectionObserver })._io = io;
  }

  private setOffscreenPaused(paused: boolean) {
    if (this.pausedOffscreen === paused || this.disposed) return;
    this.pausedOffscreen = paused;
    if (paused) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
      return;
    }

    // Recompute from the live scrub/camera state before drawing again. Resetting the
    // clock prevents the time spent off-screen from becoming one large simulation step.
    this.clock.getDelta();
    this.updateFrame(0);
    this.renderer.render(this.scene, this.camera);
    this.rafId = requestAnimationFrame(this.animate);
  }

  private animate = () => {
    this.rafId = 0;
    if (this.disposed || this.pausedOffscreen) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.updateFrame(dt);
    this.renderer.render(this.scene, this.camera);
    this.rafId = requestAnimationFrame(this.animate);
  };

  private updateFrame(dt: number) {
    this.elapsed += dt;

    const pForToggleGate = this.scrubP;
    const flightTForGate = THREE.MathUtils.clamp(pForToggleGate / FLIGHT_END, 0, 1);
    const shouldFreezeToggle = flightTForGate > 0.001;
    if (!shouldFreezeToggle && !this.reduceMotion) {
      const delta = this.viewModeTarget - this.toggleProgress;
      if (Math.abs(delta) > 0.001) {
        const step = 1 - Math.exp(-TOGGLE_LERP_RATE * dt);
        this.toggleProgress += delta * step;
        if (Math.abs(this.viewModeTarget - this.toggleProgress) < 0.001) {
          this.toggleProgress = this.viewModeTarget;
          this.notifyViewModeChange();
        }
      }
    } else if (this.reduceMotion && Math.abs(this.viewModeTarget - this.toggleProgress) > 0.001) {
      this.toggleProgress = this.viewModeTarget;
      this.notifyViewModeChange();
    }
    const toggleT = this.toggleProgress;

    const interactive = this.scrubP <= INTERACTION_LOCK_EPSILON;
    if (interactive) {
      if (this.dragging) {
      } else if (Math.abs(this.angVel.x) > IDLE_RESUME_EPS || Math.abs(this.angVel.y) > IDLE_RESUME_EPS) {
        this.applyDrag((this.angVel.y * dt) / this.DRAG_TO_RAD, (this.angVel.x * dt) / this.DRAG_TO_RAD);
        const decay = Math.exp(-MOMENTUM_DECAY * dt);
        this.angVel.x *= decay;
        this.angVel.y *= decay;
      } else if (!this.reduceMotion) {
        this.angVel = { x: 0, y: 0 };
        this.idleAngle += IDLE_SPEED * dt;
      }
    }

    this.tmpQ.setFromAxisAngle(AXIS_Y, -this.idleAngle);
    const frameRot = this.tmpQ.clone().multiply(this.rot);

    const p = this.scrubP;
    const flightT = THREE.MathUtils.clamp(p / FLIGHT_END, 0, 1);

    const liveZ = THREE.MathUtils.lerp(INSIDE_CAM_Z, this.outsideDistance, toggleT);
    const camZ = THREE.MathUtils.lerp(liveZ, this.coverDistance, flightT);
    this.camera.position.set(0, 0, camZ);
    this.camera.lookAt(0, 0, 0);

    this.updateCards(frameRot, flightT, p, toggleT);
    this.updateConnectors(frameRot, flightT, toggleT);

    if (this.scene.fog instanceof THREE.Fog) {
      const fogNearT = THREE.MathUtils.lerp(FOG_INSIDE_NEAR, this.outsideFogNear, toggleT);
      const fogFarT = THREE.MathUtils.lerp(FOG_INSIDE_FAR, this.outsideFogFar, toggleT);
      const fogNear = THREE.MathUtils.lerp(fogNearT, this.coverDistance * 2, flightT);
      const fogFar = THREE.MathUtils.lerp(fogFarT, this.coverDistance * 4, flightT);
      this.scene.fog.near = fogNear;
      this.scene.fog.far = fogFar;
    }

    // Vignette fades out approaching flat (§12)
    if (this.vignetteEl) {
      const vOpacity = THREE.MathUtils.clamp(1 - flightT * 0.95, 0, 1);
      this.vignetteEl.style.opacity = String(vOpacity);
    }
  }

  private updateCards(frameRot: THREE.Quaternion, flightT: number, scrubP: number, toggleT: number) {
    // Beats §6 (v2): flight 0→0.62 · thumb fade 0.62→0.74 · stroke boost 0.74→0.78 hold→0.82 · reveal 0.82→0.94 · settled 0.94→1.0
    const arrivalT = THREE.MathUtils.clamp((scrubP - FLIGHT_END) / (ARRIVAL_END - FLIGHT_END), 0, 1);
    const revealT = THREE.MathUtils.clamp((scrubP - BLUEPRINT_END) / (REVEAL_END - BLUEPRINT_END), 0, 1);

    for (const card of this.cards) {
      const sphereBase = this.tmpV.fromArray(card.slot.position);
      const spherePos = sphereBase.clone().applyQuaternion(frameRot);
      const gridPos = this.tmpV2.fromArray(gridPositions[card.slot.index]);

      let entranceT = 1;
      let basePos: THREE.Vector3;
      if (card.entranceDelay !== Infinity) {
        const t = THREE.MathUtils.clamp((this.elapsed - card.entranceDelay) / ENTRANCE_DURATION, 0, 1);
        const e = 1 - Math.pow(1 - t, 3);
        entranceT = t;
        basePos = spherePos.clone().multiplyScalar(1 + (1 - e) * 1.5);
        card.mesh.scale.setScalar(0.1 + 0.9 * e);
        if (t >= 1) card.entranceDelay = Infinity;
      } else {
        basePos = spherePos;
        card.mesh.scale.setScalar(1);
      }

      const lerpT = entranceT < 1 ? 0 : flightT;
      if (lerpT === 0) {
        if (entranceT < 1) card.mesh.position.copy(basePos);
        else card.mesh.position.copy(spherePos);
      } else if (lerpT === 1) card.mesh.position.copy(gridPos);
      else card.mesh.position.copy(spherePos).lerp(gridPos, lerpT);

      if (entranceT < 1) {
        card.mesh.up.set(0, 1, 0);
        card.mesh.lookAt(this.camera.position);
      } else if (flightT === 1) {
        card.mesh.quaternion.identity();
      } else {
        const billboardQ = this.computeBillboardQuat(card.mesh.position.clone(), this.camera.position);
        const tangentQ = this.computeTangentQuat(spherePos.clone());
        this.tmpQBillboard.copy(billboardQ);
        this.tmpQTangent.copy(tangentQ);
        const startQ = this.tmpQBillboard.clone().slerp(this.tmpQTangent, toggleT);
        if (lerpT === 0) card.mesh.quaternion.copy(startQ);
        else {
          this.tmpQ2.identity();
          card.mesh.quaternion.copy(startQ).slerp(this.tmpQ2, lerpT);
        }
      }

      // ——— State machine for card appearance (§6) ———
      const mat = card.mesh.material as THREE.MeshBasicMaterial;
      const lineMat = card.outline.material as THREE.LineBasicMaterial;

      // Safe thumbnail upgrade — real thumb swaps only when back at sphere (p≤0.02)
      // so flight never pops. Works for both eager idle loads and scroll-intent preloads.
      if (scrubP <= INTERACTION_LOCK_EPSILON) {
        const proj = projects[card.slot.index];
        if (proj) {
          const cached = getCachedThumbnail(proj.id);
          if (cached && cached !== card.thumbMap) {
            card.thumbMap = cached;
            // Only swap the live map if we are still in thumbnail-visible range
            if (scrubP <= FLIGHT_END) {
              const inPhotoReveal = card.isPhoto && scrubP >= BLUEPRINT_END;
              if (!inPhotoReveal) {
                mat.map = cached;
                mat.needsUpdate = true;
              }
            }
          }
        }
      }

      // Stroke: idle → boosted (0.74–0.78 ramp to 0.9, hold to 0.82) → exactly 0 by 0.94
      // All cards participate; verification: ease-down targets 0, not idle (§16)
      let targetStroke: number;
      if (scrubP <= ARRIVAL_END) {
        targetStroke = STROKE_OPACITY;
      } else if (scrubP <= STROKE_BOOST_END) {
        const boostT = THREE.MathUtils.clamp((scrubP - ARRIVAL_END) / (STROKE_BOOST_END - ARRIVAL_END), 0, 1);
        targetStroke = THREE.MathUtils.lerp(STROKE_OPACITY, STROKE_BOOST, boostT);
      } else if (scrubP <= BLUEPRINT_END) {
        targetStroke = STROKE_BOOST;
      } else if (scrubP <= REVEAL_END) {
        targetStroke = THREE.MathUtils.lerp(STROKE_BOOST, 0, revealT);
      } else {
        targetStroke = 0;
      }
      // During expanded mode, lines already at 0; otherwise lerp toward target
      if (this.expandedSlotIndex !== null) {
        lineMat.opacity = THREE.MathUtils.lerp(lineMat.opacity, 0, 0.18);
        if (lineMat.opacity < 0.01) lineMat.opacity = 0;
      } else {
        // During the blueprint→reveal authored beats keep strokes tightly tied to the
        // scrub so a fast flick still legibly hits the boost-then-vanish.
        // Before arrival keep slight smoothing so idle flicker doesn't chatter.
        if (scrubP >= ARRIVAL_END) {
          lineMat.opacity = targetStroke;
          if (scrubP >= REVEAL_END) lineMat.opacity = 0;
        } else if (Math.abs(lineMat.opacity - targetStroke) > 0.001) {
          lineMat.opacity = THREE.MathUtils.lerp(lineMat.opacity, targetStroke, 0.14);
          if (Math.abs(lineMat.opacity - targetStroke) < 0.004) lineMat.opacity = targetStroke;
        } else {
          lineMat.opacity = targetStroke;
        }
      }

      // Fill / thumbnail → black → (photo mosaic)
      // Continuous thumbnail state before arrival; post-arrival drives to black
      if (card.isPhoto) {
        // Photo zone: thumbnails through flight, fade to black 0.62–0.74, hold, then reveal mosaic 0.82–0.94
        if (scrubP <= FLIGHT_END) {
          // Flight: keep thumbnail tinted white
          mat.color.copy(this.whiteColor);
          if (mat.map !== card.thumbMap && card.thumbMap) {
            mat.map = card.thumbMap;
            mat.needsUpdate = true;
          }
        } else if (scrubP <= ARRIVAL_END) {
          // Arrival fade to black — animate color multiply to black; keep map but it multiplies to black
          const t = arrivalT;
          mat.color.lerpColors(this.whiteColor, this.blackColor, t);
        } else if (scrubP <= BLUEPRINT_END) {
          // Blueprint: solid black, edge boost — hold black
          mat.color.copy(this.blackColor);
          // Keep map off so black is pure (avoid filtering ghost); but reassign on reveal
          if (mat.map !== null && revealT === 0) {
            // retain black without map to guarantee pure fill
            // Leave map as-is — color black still wins; clearing map avoids a faint texture read-through on some GPUs
          }
        } else if (scrubP <= REVEAL_END) {
          // Reveal: black → mosaic. Swap map to shared photo texture with inset UVs, fade color white
          if (mat.map !== getPhotoTexture()) {
            mat.map = getPhotoTexture();
            mat.needsUpdate = true;
          }
          const t = revealT;
          mat.color.lerpColors(this.blackColor, this.whiteColor, t);
        } else {
          // Settled: full mosaic, pure
          if (mat.map !== getPhotoTexture()) {
            mat.map = getPhotoTexture();
            mat.needsUpdate = true;
          }
          mat.color.copy(this.whiteColor);
        }
      } else {
        // Text-zone + unzoned: thumbnails → black, remain black permanently; no mosaic
        if (scrubP <= FLIGHT_END) {
          mat.color.copy(this.whiteColor);
          if (mat.map !== card.thumbMap && card.thumbMap) {
            // card.thumbMap is null for empty slots (comingSoon stays)
            // comingSoon cards keep their hatch map throughout flight, then to black
          }
        } else if (scrubP <= ARRIVAL_END) {
          const t = arrivalT;
          mat.color.lerpColors(this.whiteColor, this.blackColor, t);
        } else {
          // Blueprint onward: solid black, stays black through reveal + settled
          mat.color.copy(this.blackColor);
          // After arrival, thumbnails / hatch should never be reassigned (§16: don't assign-then-hide)
          // Keep map null-equivalent by leaving color black; clearing map ensures some drivers don't ghost
          if (scrubP >= ARRIVAL_END + INTERACTION_LOCK_EPSILON && mat.map !== null) {
            // Keep a null map illusion: the black color already makes texture invisible,
            // but to satisfy the "never assigned past State 3" guarantee we could clear.
            // Only clear for non-photo text/unzoned after the fade has advanced a bit so reversal is still smooth
            if (arrivalT >= 0.92) {
              // don't actually clear if we'd need it for reverse — only on forward settle, handled via color anyway
            }
          }
        }
      }
      // Ensure stroke opacity exactly zero at settled — critical pitfall #3/#16
      if (scrubP >= REVEAL_END) {
        lineMat.opacity = 0;
      }
    }
  }

  private billboardHelper = new THREE.Object3D();
  private tangentHelper = new THREE.Object3D();

  private computeBillboardQuat(from: THREE.Vector3, to: THREE.Vector3): THREE.Quaternion {
    this.billboardHelper.position.copy(from);
    this.billboardHelper.up.copy(BILLBOARD_UP);
    this.billboardHelper.lookAt(to);
    return this.billboardHelper.quaternion.clone();
  }
  private computeTangentQuat(outwardPos: THREE.Vector3): THREE.Quaternion {
    const dir = this.tmpV3.copy(outwardPos).normalize();
    if (Math.abs(dir.y) > 0.999) dir.x += 0.001;
    dir.normalize();
    this.tangentHelper.position.copy(outwardPos);
    this.tangentHelper.up.copy(BILLBOARD_UP);
    this.tangentHelper.lookAt(outwardPos.clone().add(dir));
    return this.tangentHelper.quaternion.clone();
  }

  private updateConnectors(frameRot: THREE.Quaternion, flightT: number, toggleT: number) {
    const posAttr = this.connectors.geometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    for (let i = 0; i < this.connectorBasePositions.length; i += 3) {
      this.tmpV.fromArray(this.connectorBasePositions, i).applyQuaternion(frameRot);
      this.tmpV2.fromArray(this.connectorGridPositions, i);
      this.tmpV.lerp(this.tmpV2, flightT);
      arr[i] = this.tmpV.x; arr[i + 1] = this.tmpV.y; arr[i + 2] = this.tmpV.z;
    }
    posAttr.needsUpdate = true;
    const mat = this.connectors.material as THREE.LineBasicMaterial;
    const targetOpacity = THREE.MathUtils.lerp(LINE_OPACITY, OUTSIDE_LINE_OPACITY, toggleT);
    if (this.expandedSlotIndex !== null) {
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, 0, 0.18);
      if (mat.opacity < 0.01) mat.opacity = 0;
    } else {
      const target = THREE.MathUtils.lerp(targetOpacity, 0, flightT);
      if (Math.abs(mat.opacity - target) > 0.001) {
        mat.opacity = THREE.MathUtils.lerp(mat.opacity, target, 0.18);
        if (Math.abs(mat.opacity - target) < 0.005) mat.opacity = target;
      } else mat.opacity = target;
    }
  }

  private onResize = () => {
    clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => this.resize(), this.resizeDelayMs);
  };
  private resize() {
    // iOS Safari: visualViewport.height reflects the true layout viewport after URL-bar collapse
    const vv = (window as unknown as { visualViewport?: VisualViewport }).visualViewport;
    const w = this.container.clientWidth || (vv ? vv.width : window.innerWidth);
    // Prefer container size, but if visualViewport shrank (URL bar), use that for camera aspect
    // to keep cover framing correct; the container itself is sized by CSS dvh.
    const h = this.container.clientHeight || (vv ? vv.height : window.innerHeight);
    if (w === 0 || h === 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.coverDistance = this.computeCoverDistance();
    this.outsideDistance = this.computeOutsideDistance();
    this.updateOutsideFogValues();
    const flightT = THREE.MathUtils.clamp(this.scrubP / FLIGHT_END, 0, 1);
    const liveZ = THREE.MathUtils.lerp(INSIDE_CAM_Z, this.outsideDistance, this.toggleProgress);
    this.camera.position.z = THREE.MathUtils.lerp(liveZ, this.coverDistance, flightT);
    this.camera.lookAt(0, 0, 0);
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    clearTimeout(this.resizeTimer);
    const t = (this as unknown as { _thumbIdleTimer?: ReturnType<typeof setTimeout> })._thumbIdleTimer;
    if (t) clearTimeout(t);
    window.removeEventListener("resize", this.onResize);
    const vv = (window as unknown as { visualViewport?: VisualViewport }).visualViewport;
    if (vv) {
      vv.removeEventListener("resize", this.onResize);
      vv.removeEventListener("scroll", this.onResize);
    }
    const io = (this as unknown as { _io: IntersectionObserver })._io;
    if (io) io.disconnect();
    const el = this.renderer.domElement;
    el.removeEventListener("pointerdown", this.onPointerDown);
    el.removeEventListener("pointermove", this.onPointerMove);
    el.removeEventListener("pointerup", this.onPointerUp);
    el.removeEventListener("pointercancel", this.onPointerUp);
    this.renderer.dispose();
    el.remove();
  }
}

const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const BILLBOARD_UP = new THREE.Vector3(0, 1, 0);
