import * as THREE from "three";
import { BACKGROUND_COLOR, IDLE_STROKE_OPACITY } from "../constants";
import { projects } from "../data/projects";
import { CARD_HEIGHT, CARD_WIDTH, cardSlots } from "./layout";
import { applyThumbnailAtlasUv, getThumbnailAtlas, loadThumbnailAtlas } from "./textures";
import {
  createSphereCardMaterial,
  createSphereConnectorLines,
  outsideFogDistances,
  outsidePointerDelta,
  solveOutsideCameraDistance,
  SPHERE_DRAG_TO_RADIANS,
  SPHERE_IDLE_RESUME_EPSILON,
  SPHERE_IDLE_SPEED,
  SPHERE_MOMENTUM_DECAY,
  SPECIMEN_OUTSIDE_TARGET_FRACTION,
  tangentQuaternion,
} from "./sphereShared";
import { rotateToFaceCard } from "./rotateToFace";

type SpecimenCard = {
  slot: (typeof cardSlots)[number];
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  outline: THREE.LineSegments;
  baseQuaternion: THREE.Quaternion;
  targetOpacity: number;
  detach: number;
  detachTarget: number;
};

export type SpecimenCaptionFrame = { left: number; top: number; width: number; height: number; opacity: number };
export type SpecimenTileFrame = { stableIndex: number; left: number; top: number; width: number; height: number };
export type SpecimenNavigation = "previous-ring" | "next-ring" | "previous-card" | "next-card";

export type SpecimenSceneOptions = {
  onHover: (stableIndex: number) => void;
  onDetach: (stableIndex: number | null) => void;
  onDetachFrame: (frame: SpecimenCaptionFrame | null) => void;
  onOpen: (stableIndex: number, enterFrom: DOMRect) => void;
  onTileFrames: (frames: readonly SpecimenTileFrame[]) => void;
};

export class SpecimenScene {
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly globe = new THREE.Group();
  private readonly cards: SpecimenCard[] = [];
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private readonly lineOpacity: THREE.BufferAttribute;
  private readonly connectors: THREE.LineSegments;
  private readonly connectorTargets: Float32Array;
  private readonly screenAnchor = new THREE.Vector2();
  private readonly anchorPlane = new THREE.Plane();
  private readonly anchorWorld = new THREE.Vector3();
  private readonly anchorLocal = new THREE.Vector3();
  private readonly cameraDirection = new THREE.Vector3();
  private readonly globeQuaternion = new THREE.Quaternion();
  private readonly worldFacingQuaternion = new THREE.Quaternion();
  private readonly localFacingQuaternion = new THREE.Quaternion();
  private readonly facingHelper = new THREE.Object3D();
  private detachedStableIndex: number | null = null;
  private selectedStableIndex: number | null = null;
  private introFramesRemaining = 0;
  private readonly introRowRects = new Map<number, DOMRect>();
  private yawTarget: number | null = null;
  private pitchTarget: number | null = null;
  private yaw = 0;
  private pitch = 0;
  private velocity = { x: 0, y: 0 };
  private dragging = false;
  private clickCandidate = false;
  private dragStart: { x: number; y: number } | null = null;
  private lastPointer: { x: number; y: number; time: number } | null = null;
  private filtered = new Set<number>();
  private disposed = false;
  private readonly reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  constructor(private readonly container: HTMLElement, private readonly canvas: HTMLCanvasElement, private readonly options: SpecimenSceneOptions) {
    this.scene.background = new THREE.Color(BACKGROUND_COLOR);
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    this.camera.position.z = solveOutsideCameraDistance(this.camera.fov, SPECIMEN_OUTSIDE_TARGET_FRACTION);
    const fog = outsideFogDistances(this.camera.position.z);
    this.scene.fog = new THREE.Fog(BACKGROUND_COLOR, fog.near, fog.far);

    this.buildCards();
    const { lines, pairs } = createSphereConnectorLines();
    this.connectors = lines;
    lines.userData.pairs = pairs;
    const count = pairs.length * 2;
    this.lineOpacity = new THREE.BufferAttribute(new Float32Array(count).fill(1), 1);
    lines.geometry.setAttribute("lineOpacity", this.lineOpacity);
    this.connectorTargets = new Float32Array(count).fill(1);
    lines.material = this.createConnectorMaterial() as unknown as THREE.LineBasicMaterial;
    this.globe.add(lines);
    this.scene.add(this.globe);
    this.bindPointer();
  }

  getRenderScene() { return this.scene; }
  getRenderCamera() { return this.camera; }
  hasDetachedCard() { return this.detachedStableIndex !== null; }

  setSelectedStableIndex(stableIndex: number | null) {
    this.selectedStableIndex = stableIndex;
  }

  beginIntro(rowRects: ReadonlyMap<string, DOMRect>) {
    this.reattach();
    // A view switch clears detach synchronously: its residual scalar must never
    // compete with the row-to-orbit position blend on a rapid return to Specimen.
    this.cards.forEach((card) => {
      card.detach = 0;
      card.detachTarget = 0;
      card.mesh.renderOrder = 0;
      card.mesh.scale.setScalar(1);
    });
    this.introRowRects.clear();
    for (const card of this.cards) {
      const project = projects[card.slot.index];
      const rect = project ? rowRects.get(project.id) : undefined;
      if (rect) this.introRowRects.set(card.slot.index, rect);
    }
    this.introFramesRemaining = this.reduceMotion ? 0 : 45;
  }

  getProjectedCardRects() {
    const rects = new Map<string, DOMRect>();
    for (const card of this.cards) {
      const project = projects[card.slot.index];
      if (!project) continue;
      const rect = this.cardScreenRect(card);
      const host = this.container.getBoundingClientRect();
      rects.set(project.id, new DOMRect(host.left + rect.left, host.top + rect.top, rect.width, rect.height));
    }
    return rects;
  }

  selectStableIndex(stableIndex: number) {
    const slot = cardSlots[stableIndex];
    if (!slot) return;
    // This outside camera faces +Z while the shared focus helper's logical
    // front is -Z. Transform phi into that basis, then let the helper retain
    // its nearest-angle unwrapping and shared pitch clamp.
    const focus = rotateToFaceCard({ phi: Math.PI / 2 - slot.phi, theta: slot.theta }, this.yaw);
    this.yawTarget = focus.yaw;
    this.pitchTarget = focus.pitch;
    if (this.reduceMotion) { this.yaw = this.yawTarget; this.pitch = this.pitchTarget; }
  }

  moveSelection(stableIndex: number, direction: SpecimenNavigation) {
    const current = cardSlots[stableIndex];
    if (!current) return null;
    const eligible = (slot: (typeof cardSlots)[number]) => !this.filtered.has(slot.index) && Boolean(projects[slot.index]);
    if (direction === "previous-card" || direction === "next-card") {
      const cards = cardSlots.filter((slot) => slot.ring === current.ring && eligible(slot));
      const index = cards.findIndex((slot) => slot.index === current.index);
      if (index < 0 || cards.length === 0) return null;
      const step = direction === "previous-card" ? -1 : 1;
      return cards[(index + step + cards.length) % cards.length].index;
    }
    const ringCount = Math.max(...cardSlots.map((slot) => slot.ring)) + 1;
    const step = direction === "previous-ring" ? -1 : 1;
    const targetRing = (current.ring + step + ringCount) % ringCount;
    const candidates = cardSlots.filter((slot) => slot.ring === targetRing && eligible(slot));
    if (!candidates.length) return null;
    const fraction = current.indexInRing / cardSlots.filter((slot) => slot.ring === current.ring).length;
    const circularDistance = (candidate: (typeof cardSlots)[number]) => {
      const nextFraction = candidate.indexInRing / cardSlots.filter((slot) => slot.ring === targetRing).length;
      const difference = Math.abs(nextFraction - fraction);
      return Math.min(difference, 1 - difference);
    };
    return candidates.reduce((nearest, candidate) => circularDistance(candidate) < circularDistance(nearest) ? candidate : nearest).index;
  }

  activateStableIndex(stableIndex: number) {
    const card = this.cards.find((item) => item.slot.index === stableIndex);
    if (!card || this.filtered.has(stableIndex)) return;
    if (this.detachedStableIndex === stableIndex) this.options.onOpen(stableIndex, this.cardScreenRect(card));
    else this.setDetached(stableIndex);
  }

  reattach() {
    if (this.detachedStableIndex === null) return;
    this.detachedStableIndex = null;
    this.cards.forEach((card) => {
      card.detachTarget = 0;
      this.setDetachedRenderState(card, false);
    });
    this.options.onDetach(null);
  }

  setFilteredStableIndices(indices: ReadonlySet<number>) {
    this.filtered = new Set(indices);
    if (this.detachedStableIndex !== null && this.filtered.has(this.detachedStableIndex)) this.reattach();
    for (const card of this.cards) card.targetOpacity = this.filtered.has(card.slot.index) ? 0.13 : 1;
    const pairs = (this.connectors.userData.pairs as [number, number][] | undefined) ?? [];
    pairs.forEach(([a, b], pairIndex) => {
      const target = this.filtered.has(a) || this.filtered.has(b) ? 0.25 : 1;
      this.connectorTargets[pairIndex * 2] = target;
      this.connectorTargets[pairIndex * 2 + 1] = target;
    });
  }

  resize(width: number, height: number) {
    if (!width || !height) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.camera.position.z = solveOutsideCameraDistance(this.camera.fov, SPECIMEN_OUTSIDE_TARGET_FRACTION);
    const fog = outsideFogDistances(this.camera.position.z);
    if (this.scene.fog instanceof THREE.Fog) { this.scene.fog.near = fog.near; this.scene.fog.far = fog.far; }
    this.camera.lookAt(0, 0, 0);
  }

  update(deltaSeconds: number) {
    if (this.disposed) return;
    if (!this.dragging) {
      if (Math.abs(this.velocity.x) > SPHERE_IDLE_RESUME_EPSILON || Math.abs(this.velocity.y) > SPHERE_IDLE_RESUME_EPSILON) {
        this.applySpin(this.velocity.y * deltaSeconds / SPHERE_DRAG_TO_RADIANS, this.velocity.x * deltaSeconds / SPHERE_DRAG_TO_RADIANS);
        const decay = Math.exp(-SPHERE_MOMENTUM_DECAY * deltaSeconds);
        this.velocity.x *= decay;
        this.velocity.y *= decay;
      } else if (!this.reduceMotion) {
        this.yaw += SPHERE_IDLE_SPEED * deltaSeconds;
      }
    }
    if (!this.dragging && this.yawTarget !== null && this.pitchTarget !== null) {
      this.yaw = THREE.MathUtils.lerp(this.yaw, this.yawTarget, 0.11);
      this.pitch = THREE.MathUtils.lerp(this.pitch, this.pitchTarget, 0.11);
      if (Math.abs(this.yaw - this.yawTarget) < 0.004 && Math.abs(this.pitch - this.pitchTarget) < 0.004) {
        this.yaw = this.yawTarget;
        this.pitch = this.pitchTarget;
        this.yawTarget = null;
        this.pitchTarget = null;
      }
    }
    this.globe.rotation.set(this.pitch, this.yaw, 0);
    this.globe.updateMatrixWorld(true);
    let maximumDetach = 0;
    for (const card of this.cards) {
      card.detach = this.reduceMotion ? card.detachTarget : THREE.MathUtils.lerp(card.detach, card.detachTarget, 0.13);
      if (Math.abs(card.detach - card.detachTarget) < 0.001) card.detach = card.detachTarget;
      maximumDetach = Math.max(maximumDetach, card.detach);
    }
    const activeCard = this.detachedStableIndex === null ? undefined : this.cards.find((card) => card.slot.index === this.detachedStableIndex);
    for (const card of this.cards) if (card.detach > 0.001) this.positionDetachedCard(card);
    this.applyIntroBlend();
    for (const card of this.cards) {
      const material = card.mesh.material;
      const filterOpacity = card.targetOpacity;
      const detachedOpacity = card === activeCard ? 1 : 0.24;
      const targetOpacity = THREE.MathUtils.lerp(filterOpacity, detachedOpacity, maximumDetach);
      material.opacity = THREE.MathUtils.lerp(material.opacity, targetOpacity, 0.16);
      const outline = card.outline.material as THREE.LineBasicMaterial;
      const strokeOpacity = card.slot.index === this.selectedStableIndex ? 0.62 : IDLE_STROKE_OPACITY;
      outline.opacity = THREE.MathUtils.lerp(outline.opacity, material.opacity * strokeOpacity, 0.18);
      if (card !== activeCard && card.detach < 0.001 && this.introFramesRemaining === 0) {
        card.mesh.position.fromArray(card.slot.position);
        card.mesh.quaternion.copy(card.baseQuaternion);
        card.mesh.scale.setScalar(1);
      }
    }
    const opacities = this.lineOpacity.array as Float32Array;
    for (let index = 0; index < opacities.length; index++) {
      const introOpacity = this.introFramesRemaining === 0 ? 1 : 1 - this.introFramesRemaining / 45;
      const targetOpacity = THREE.MathUtils.lerp(this.connectorTargets[index], 0.30, maximumDetach) * introOpacity;
      opacities[index] = THREE.MathUtils.lerp(opacities[index], targetOpacity, 0.16);
    }
    this.lineOpacity.needsUpdate = true;
    if (activeCard && activeCard.detach > 0.01) {
      const frame = this.cardScreenRect(activeCard);
      this.options.onDetachFrame({ left: frame.left, top: frame.top, width: frame.width, height: frame.height, opacity: activeCard.detach });
    }
    else if (maximumDetach < 0.01) this.options.onDetachFrame(null);
    this.options.onTileFrames(this.cards
      .filter((card) => !this.filtered.has(card.slot.index))
      .map((card) => {
        const frame = this.cardScreenRect(card);
        return {
          stableIndex: card.slot.index,
          left: frame.left,
          top: frame.top,
          width: frame.width,
          height: frame.height,
        };
      }));
    if (this.introFramesRemaining > 0) this.introFramesRemaining -= 1;
  }

  dispose() {
    this.disposed = true;
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointercancel", this.onPointerUp);
    this.cards.forEach(({ mesh }) => { mesh.geometry.dispose(); mesh.material.dispose(); });
    (this.connectors.material as THREE.Material).dispose();
    this.connectors.geometry.dispose();
  }

  private buildCards() {
    const geometry = new THREE.PlaneGeometry(CARD_WIDTH, CARD_HEIGHT);
    const edgeGeometry = new THREE.EdgesGeometry(geometry);
    const atlas = getThumbnailAtlas();
    cardSlots.forEach((slot) => {
      const material = createSphereCardMaterial(atlas);
      const mesh = new THREE.Mesh(geometry.clone(), material);
      applyThumbnailAtlasUv(mesh.geometry, slot.index);
      mesh.position.fromArray(slot.position);
      mesh.quaternion.copy(tangentQuaternion(mesh.position));
      mesh.renderOrder = 0;
      const outline = new THREE.LineSegments(edgeGeometry.clone(), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: IDLE_STROKE_OPACITY, depthWrite: false, fog: true }));
      mesh.add(outline);
      this.globe.add(mesh);
      this.cards.push({ slot, mesh, outline, baseQuaternion: mesh.quaternion.clone(), targetOpacity: 1, detach: 0, detachTarget: 0 });
    });
    void loadThumbnailAtlas().then((loadedAtlas) => {
      if (this.disposed) return;
      this.cards.forEach((card) => {
        card.mesh.material.map = loadedAtlas;
        card.mesh.material.needsUpdate = true;
      });
    });
    geometry.dispose();
    edgeGeometry.dispose();
  }

  private createConnectorMaterial() {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      fog: true,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        { color: { value: new THREE.Color(0xffffff) } },
      ]),
      vertexShader: `
        attribute float lineOpacity;
        varying float vOpacity;
        #include <fog_pars_vertex>
        void main() {
          vOpacity = lineOpacity;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        varying float vOpacity;
        #include <fog_pars_fragment>
        void main() {
          gl_FragColor = vec4(color, vOpacity);
          #include <fog_fragment>
        }
      `,
    });
  }

  private bindPointer() {
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("pointercancel", this.onPointerUp);
  }

  private onPointerDown = (event: PointerEvent) => {
    this.dragging = true;
    this.clickCandidate = true;
    this.dragStart = { x: event.clientX, y: event.clientY };
    this.velocity = { x: 0, y: 0 };
    this.yawTarget = null;
    this.pitchTarget = null;
    this.lastPointer = { x: event.clientX, y: event.clientY, time: performance.now() };
    this.container.focus({ preventScroll: true });
    this.canvas.setPointerCapture(event.pointerId);
  };

  private onPointerMove = (event: PointerEvent) => {
    if (!this.dragging || !this.lastPointer) {
      const card = this.pick(event);
      if (card && this.detachedStableIndex === null) this.options.onHover(card.slot.index);
      return;
    }
    const now = performance.now();
    const dt = Math.max((now - this.lastPointer.time) / 1000, 1e-4);
    if (this.dragStart && Math.hypot(event.clientX - this.dragStart.x, event.clientY - this.dragStart.y) > 6) this.clickCandidate = false;
    const delta = outsidePointerDelta(event.clientX - this.lastPointer.x, event.clientY - this.lastPointer.y);
    this.applySpin(delta.dx, delta.dy);
    this.velocity.y = delta.dx * SPHERE_DRAG_TO_RADIANS / dt;
    this.velocity.x = delta.dy * SPHERE_DRAG_TO_RADIANS / dt;
    this.lastPointer = { x: event.clientX, y: event.clientY, time: now };
  };

  private onPointerUp = (event: PointerEvent) => {
    const wasClick = this.clickCandidate;
    this.dragging = false;
    this.lastPointer = null;
    this.dragStart = null;
    if (wasClick) this.handleStageClick(event);
  };

  private applySpin(dx: number, dy: number) {
    // `outsidePointerDelta` mirrors the pointer first. Match the Hero's
    // outside-mode rotation sign so the globe follows the drag in both views.
    this.yaw -= dx * SPHERE_DRAG_TO_RADIANS;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * SPHERE_DRAG_TO_RADIANS, -0.7, 0.7);
  }

  private pick(event: PointerEvent): SpecimenCard | undefined {
    const rect = this.container.getBoundingClientRect();
    if (!rect.width || !rect.height) return undefined;
    this.ndc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const candidates = this.cards.filter((card) => !this.filtered.has(card.slot.index)).map((card) => card.mesh);
    const hit = this.raycaster.intersectObjects(candidates, false)[0]?.object as THREE.Mesh | undefined;
    const card = hit && this.cards.find((item) => item.mesh === hit);
    return card;
  }

  private handleStageClick(event: PointerEvent) {
    const card = this.pick(event);
    if (!card) {
      this.reattach();
      return;
    }
    if (card.slot.index === this.detachedStableIndex) {
      this.options.onOpen(card.slot.index, this.cardScreenRect(card));
      return;
    }
    this.setDetached(card.slot.index);
  }

  private setDetached(stableIndex: number) {
    this.introFramesRemaining = 0;
    this.introRowRects.clear();
    this.detachedStableIndex = stableIndex;
    for (const card of this.cards) {
      card.detachTarget = card.slot.index === stableIndex ? 1 : 0;
      this.setDetachedRenderState(card, card.slot.index === stableIndex);
    }
    this.options.onHover(stableIndex);
    this.options.onDetach(stableIndex);
  }

  private positionDetachedCard(card: SpecimenCard) {
    this.getScreenAnchor(this.anchorWorld);
    this.anchorLocal.copy(this.anchorWorld);
    this.globe.worldToLocal(this.anchorLocal);
    card.mesh.position.fromArray(card.slot.position).lerp(this.anchorLocal, card.detach);
    this.facingHelper.position.copy(this.anchorWorld);
    this.facingHelper.up.set(0, 1, 0);
    this.facingHelper.lookAt(this.camera.position);
    this.worldFacingQuaternion.copy(this.facingHelper.quaternion);
    this.globe.getWorldQuaternion(this.globeQuaternion).invert();
    this.localFacingQuaternion.copy(this.globeQuaternion).multiply(this.worldFacingQuaternion);
    card.mesh.quaternion.copy(card.baseQuaternion).slerp(this.localFacingQuaternion, card.detach);
    card.mesh.scale.setScalar(THREE.MathUtils.lerp(1, 2.9, card.detach));
  }

  private setDetachedRenderState(card: SpecimenCard, detached: boolean) {
    card.mesh.renderOrder = detached ? 1 : 0;
    // Draw order alone does not beat a previously written depth value. The
    // lifted card must remain clean above the dimmed, rotating lattice.
    card.mesh.material.depthTest = !detached;
    card.mesh.material.needsUpdate = true;
    const outline = card.outline.material as THREE.LineBasicMaterial;
    outline.depthTest = !detached;
    outline.needsUpdate = true;
  }

  /** Index → Specimen is evaluated from live card geometry, never a static keyframe. */
  private applyIntroBlend() {
    if (this.introFramesRemaining === 0) return;
    const intro = this.introFramesRemaining / 45;
    const eased = intro * intro;
    for (const card of this.cards) {
      const rowRect = this.introRowRects.get(card.slot.index);
      if (!rowRect) continue;
      this.rowCentreToWorld(rowRect, this.anchorWorld);
      this.anchorLocal.copy(this.anchorWorld);
      this.globe.worldToLocal(this.anchorLocal);
      card.mesh.position.fromArray(card.slot.position).lerp(this.anchorLocal, eased);
    }
  }

  private rowCentreToWorld(rowRect: DOMRect, target: THREE.Vector3) {
    const host = this.container.getBoundingClientRect();
    this.screenAnchor.set(((rowRect.left + rowRect.width / 2 - host.left) / host.width) * 2 - 1, -((rowRect.top + rowRect.height / 2 - host.top) / host.height) * 2 + 1);
    this.raycaster.setFromCamera(this.screenAnchor, this.camera);
    this.camera.getWorldDirection(this.cameraDirection);
    this.anchorPlane.setFromNormalAndCoplanarPoint(this.cameraDirection, this.scene.position);
    return this.raycaster.ray.intersectPlane(this.anchorPlane, target) ?? target.set(0, 0, 0);
  }

  /** Converts the stage-relative anchor to world space on every frame. */
  private getScreenAnchor(target: THREE.Vector3) {
    const rect = this.container.getBoundingClientRect();
    const anchorX = rect.left + rect.width * (0.5 - 0.17);
    const anchorY = rect.top + rect.height * 0.46;
    this.screenAnchor.set(((anchorX - rect.left) / rect.width) * 2 - 1, -((anchorY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.screenAnchor, this.camera);
    this.camera.getWorldDirection(this.cameraDirection);
    this.anchorPlane.setFromNormalAndCoplanarPoint(this.cameraDirection, this.scene.position);
    return this.raycaster.ray.intersectPlane(this.anchorPlane, target) ?? target.set(0, 0, 0);
  }

  private cardScreenRect(card: SpecimenCard): DOMRect {
    this.globe.updateMatrixWorld(true);
    card.mesh.updateMatrixWorld(true);
    const containerRect = this.container.getBoundingClientRect();
    const corners = [
      new THREE.Vector3(-CARD_WIDTH / 2, -CARD_HEIGHT / 2, 0),
      new THREE.Vector3(-CARD_WIDTH / 2, CARD_HEIGHT / 2, 0),
      new THREE.Vector3(CARD_WIDTH / 2, -CARD_HEIGHT / 2, 0),
      new THREE.Vector3(CARD_WIDTH / 2, CARD_HEIGHT / 2, 0),
    ].map((corner) => card.mesh.localToWorld(corner).project(this.camera));
    const xs = corners.map((corner) => (corner.x * 0.5 + 0.5) * containerRect.width);
    const ys = corners.map((corner) => (-corner.y * 0.5 + 0.5) * containerRect.height);
    const left = Math.min(...xs);
    const top = Math.min(...ys);
    return new DOMRect(left, top, Math.max(...xs) - left, Math.max(...ys) - top);
  }
}
