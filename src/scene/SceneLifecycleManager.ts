import * as THREE from "three";

export type CameraSnapshot = {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  up: THREE.Vector3;
};

export type RendererViewport = {
  width: number;
  height: number;
  pixelRatio: number;
};

export type SceneRegistration = {
  id: string;
  scene: THREE.Scene;
  camera: THREE.Camera;
  element: HTMLElement;
  update: (deltaSeconds: number, isCameraDriver: boolean) => void;
  isUpdateEnabled?: () => boolean;
  resize?: (viewport: RendererViewport) => void;
  takeCamera?: (liveCamera: CameraSnapshot) => void;
};

type RegisteredScene = SceneRegistration & { visible: boolean };

/**
 * Owns the page's one WebGL renderer and its one RAF loop. A registered scene is
 * updated only while its host is visible; only the active scene is rendered and
 * receives the camera-driver lease.
 */
export class SceneLifecycleManager {
  readonly renderer: THREE.WebGLRenderer;
  private readonly scenes = new Map<string, RegisteredScene>();
  private readonly observer: IntersectionObserver;
  private readonly clock = new THREE.Clock();
  private activeId: string | null = null;
  private rafId = 0;
  private updateCount = 0;
  private resizeTimer: ReturnType<typeof setTimeout> | undefined;
  private disposed = false;

  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.domElement.style.touchAction = "none";
    // A zero threshold treats a pin's sub-pixel trailing edge as visible. That
    // let Hero reclaim the shared canvas while Work was already on screen.
    this.observer = new IntersectionObserver(this.onIntersection, { threshold: 0.01 });
    window.addEventListener("resize", this.onResize);
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", this.onResize);
    viewport?.addEventListener("scroll", this.onResize);
  }

  register(registration: SceneRegistration): () => void {
    if (this.disposed) throw new Error("Cannot register a scene after SceneLifecycleManager.dispose().");
    if (this.scenes.has(registration.id)) throw new Error(`A scene is already registered with id \"${registration.id}\".`);

    const entry: RegisteredScene = {
      ...registration,
      visible: this.isVisible(registration.element),
    };
    this.scenes.set(entry.id, entry);
    this.observer.observe(entry.element);

    if (this.activeId === null) this.setActive(entry.id);
    else this.syncLoop();

    return () => this.unregister(entry.id);
  }

  setActive(id: string | null) {
    if (id === this.activeId) {
      const active = id === null ? null : this.scenes.get(id) ?? null;
      if (active) {
        this.mountActiveCanvas(active);
        this.resizeActive();
      }
      this.syncLoop();
      return;
    }
    if (id !== null && !this.scenes.has(id)) throw new Error(`Cannot activate unregistered scene \"${id}\".`);

    const outgoing = this.activeId === null ? null : this.scenes.get(this.activeId) ?? null;
    const incoming = id === null ? null : this.scenes.get(id) ?? null;
    const liveCamera = outgoing ? this.captureCamera(outgoing.camera) : null;

    this.activeId = id;
    if (!incoming) {
      this.syncLoop();
      return;
    }

    // A handoff starts from the outgoing driver's live camera state. The next
    // driver can adapt it in takeCamera, but no two update callbacks receive the
    // driver lease during the switch.
    if (liveCamera) {
      incoming.camera.position.copy(liveCamera.position);
      incoming.camera.quaternion.copy(liveCamera.quaternion);
      incoming.camera.up.copy(liveCamera.up);
      incoming.camera.updateMatrixWorld();
      incoming.takeCamera?.(liveCamera);
    }
    this.mountActiveCanvas(incoming);
    this.resizeActive();
    if (incoming.visible && incoming.isUpdateEnabled?.() !== false) {
      this.clock.getDelta();
      incoming.update(0, true);
      this.renderer.render(incoming.scene, incoming.camera);
    }
    this.syncLoop();
  }

  hasRegistration(id: string) {
    return this.scenes.has(id);
  }

  getDiagnostics() {
    return {
      rafActive: this.rafId !== 0,
      updateCount: this.updateCount,
      activeId: this.activeId,
      visibleSceneIds: [...this.scenes.values()].filter((entry) => entry.visible).map((entry) => entry.id),
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    clearTimeout(this.resizeTimer);
    this.observer.disconnect();
    window.removeEventListener("resize", this.onResize);
    const viewport = window.visualViewport;
    viewport?.removeEventListener("resize", this.onResize);
    viewport?.removeEventListener("scroll", this.onResize);
    this.scenes.clear();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private unregister(id: string) {
    const entry = this.scenes.get(id);
    if (!entry) return;
    this.observer.unobserve(entry.element);
    this.scenes.delete(id);
    if (this.activeId === id) this.activeId = null;
    this.syncLoop();
  }

  private onIntersection = (entries: IntersectionObserverEntry[]) => {
    const entering: RegisteredScene[] = [];
    for (const record of entries) {
      for (const entry of this.scenes.values()) {
        if (entry.element === record.target) {
          entry.visible = record.isIntersecting;
          if (record.isIntersecting && entry.isUpdateEnabled?.() !== false) entering.push(entry);
          break;
        }
      }
    }

    // A released renderer should resume with the scene the visitor actually
    // scrolls back to. This is what lets Work's Index pause Specimen without
    // handing the canvas back to the off-screen Hero.
    const active = this.activeId === null ? null : this.scenes.get(this.activeId) ?? null;
    const enteredScene = entering[0];
    if (!active) {
      if (enteredScene) {
        this.setActive(enteredScene.id);
        return;
      }
    } else if (!active.visible || active.isUpdateEnabled?.() === false) {
      // Hero and Work can overlap briefly at some viewport heights. If Hero
      // entered one observer turn before Work fully exited, it is already
      // visible here and must still receive the renderer.
      const replacement = enteredScene ?? [...this.scenes.values()].find((entry) => entry.visible && entry.isUpdateEnabled?.() !== false);
      if (replacement) {
        this.setActive(replacement.id);
        return;
      }
    }

    if (active?.visible && active.isUpdateEnabled?.() !== false) {
      this.clock.getDelta();
      active.update(0, true);
      this.renderer.render(active.scene, active.camera);
    }
    this.syncLoop();
  };

  private onResize = () => {
    clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => this.resizeActive(), 150);
  };

  private resizeActive() {
    const entry = this.activeId === null ? null : this.scenes.get(this.activeId) ?? null;
    if (!entry) return;
    const width = entry.element.clientWidth || window.innerWidth;
    const height = entry.element.clientHeight || window.innerHeight;
    if (width <= 0 || height <= 0) return;
    const pixelRatio = Math.min(window.devicePixelRatio, 2);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height);
    entry.resize?.({ width, height, pixelRatio });
  }

  private mountActiveCanvas(entry: RegisteredScene) {
    if (this.renderer.domElement.parentElement !== entry.element) entry.element.appendChild(this.renderer.domElement);
  }

  private syncLoop() {
    if (this.disposed) return;
    const shouldRun = [...this.scenes.values()].some((entry) => entry.visible && entry.isUpdateEnabled?.() !== false);
    if (shouldRun && this.rafId === 0) {
      this.clock.getDelta();
      this.rafId = requestAnimationFrame(this.tick);
    } else if (!shouldRun && this.rafId !== 0) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  private tick = () => {
    this.rafId = 0;
    if (this.disposed) return;
    const deltaSeconds = Math.min(this.clock.getDelta(), 0.05);
    for (const entry of this.scenes.values()) {
      if (entry.visible && entry.isUpdateEnabled?.() !== false) {
        this.updateCount += 1;
        entry.update(deltaSeconds, entry.id === this.activeId);
      }
    }

    const active = this.activeId === null ? null : this.scenes.get(this.activeId) ?? null;
    if (active?.visible && active.isUpdateEnabled?.() !== false) this.renderer.render(active.scene, active.camera);
    this.syncLoop();
  };

  private captureCamera(camera: THREE.Camera): CameraSnapshot {
    return {
      position: camera.position.clone(),
      quaternion: camera.quaternion.clone(),
      up: camera.up.clone(),
    };
  }

  private isVisible(element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    return rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth;
  }
}
