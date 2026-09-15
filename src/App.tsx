import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SphereScene } from "./scene/SphereScene";
import { SceneLifecycleManager } from "./scene/SceneLifecycleManager";
import { walkCardRing, type CardNavigationKey } from "./scene/cardNavigation";
import { cardSlots } from "./scene/layout";
import ProjectPanel, { type ProjectPanelHandle } from "./components/ProjectPanel";
import FallbackAbout from "./components/FallbackAbout";
import ClosingSection from "./components/ClosingSection";
import WorkSection from "./components/WorkSection";
import { projects } from "./data/projects";
import type { Project } from "./types";
import {
  ARRIVAL_END,
  BLUEPRINT_END,
  CONTROL_PILL_RADIUS_PX,
  DISPLAY_FONT_FAMILY,
  HERO_HEADLINE_FADE_END,
  INTERACTION_LOCK_EPSILON,
  LABEL_FONT_FAMILY,
  REVEAL_END,
  TOGGLE_HIDE_END,
  ZONES,
} from "./constants";
import { shouldUseFallback } from "./utils/gates";

gsap.registerPlugin(ScrollTrigger);

export default function App() {
  const [lifecycle, setLifecycle] = useState<SceneLifecycleManager | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const vignetteRef = useRef<HTMLDivElement>(null);
  const heroHeadlineRef = useRef<HTMLDivElement>(null);
  const zoneLayerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SphereScene | null>(null);
  const stRef = useRef<ScrollTrigger | null>(null);
  const projectPanelRef = useRef<ProjectPanelHandle>(null);
  const panelNavigationAnimatingRef = useRef(false);
  const wheelAccumRef = useRef(0);
  const wheelAccumTimerRef = useRef<number | null>(null);
  const [hasScrolled, setHasScrolled] = useState(false);
  const hasScrolledRef = useRef(false);

  const filteredProjects = useMemo(() => projects.filter(Boolean) as Project[], []);
  const availableCardSlots = useMemo(() => cardSlots.filter((slot) => projects[slot.index] !== null), []);
  const availableCardSlotIndices = useMemo(() => new Set(availableCardSlots.map((slot) => slot.index)), [availableCardSlots]);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [activeSlotIndex, setActiveSlotIndex] = useState(() => availableCardSlots[0]?.index ?? 0);
  const [liveMessage, setLiveMessage] = useState("");
  const [skipLinkFocused, setSkipLinkFocused] = useState(false);
  const [enterFrom, setEnterFrom] = useState<DOMRect | undefined>();
  const [viewMode, setViewMode] = useState<"inside" | "outside">("inside");
  const [scrubP, setScrubP] = useState(0);
  const [heroSectionVisible, setHeroSectionVisible] = useState(true);

  const handleAboutNavigation = useCallback((event: ReactMouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const trigger = stRef.current;
    if (!trigger) {
      document.getElementById("about")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    window.history.replaceState(null, "", "#about");
    window.scrollTo({
      top: trigger.start + (trigger.end - trigger.start) * 0.9,
      behavior: "smooth",
    });
  }, []);

  useEffect(() => {
    const manager = new SceneLifecycleManager();
    setLifecycle(manager);
    (window as unknown as { __sceneLifecycle?: SceneLifecycleManager }).__sceneLifecycle = manager;
    return () => {
      delete (window as unknown as { __sceneLifecycle?: SceneLifecycleManager }).__sceneLifecycle;
      manager.dispose();
    };
  }, []);

  // ---- Gates (derived values live in src/constants.ts) --------------------
  const [isFallback, setIsFallback] = useState<boolean>(() => {
    try { return shouldUseFallback(); } catch { return false; }
  });

  useEffect(() => {
    if (!triggerRef.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      setHeroSectionVisible(entry.isIntersecting);
    }, { threshold: 0.01 });
    observer.observe(triggerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;

    const checkAndFlip = () => {
      const next = shouldUseFallback();
      setIsFallback((prev) => {
        if (next !== prev) {
          try { window.scrollTo({ top: 0, behavior: "auto" }); } catch { window.scrollTo(0, 0); }
          setScrubP(0);
          hasScrolledRef.current = false;
          setHasScrolled(false);
        }
        return next;
      });
    };

    const debounced = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(checkAndFlip, 150);
    };

    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMqlChange = () => checkAndFlip();
    try { mql.addEventListener("change", onMqlChange); }
    catch { (mql as unknown as { addListener: (cb: () => void) => void }).addListener(onMqlChange); }

    window.addEventListener("resize", debounced);
    window.addEventListener("orientationchange", debounced);
    const conn = (navigator as unknown as { connection?: { addEventListener?: (t: string, cb: () => void) => void } }).connection;
    if (conn?.addEventListener) conn.addEventListener("change", debounced);

    return () => {
      clearTimeout(debounceTimer);
      try { mql.removeEventListener("change", onMqlChange); }
      catch { (mql as unknown as { removeListener: (cb: () => void) => void }).removeListener(onMqlChange); }
      window.removeEventListener("resize", debounced);
      window.removeEventListener("orientationchange", debounced);
      if (conn?.addEventListener) {
        try { (conn as unknown as { removeEventListener: (t: string, cb: () => void) => void }).removeEventListener("change", debounced); } catch { /* no-op */ }
      }
    };
  }, []);

  const slotForFiltered = (fi: number) => {
    const p = filteredProjects[fi];
    return projects.findIndex((x) => x?.id === p.id);
  };

  const openProjectAtSlot = useCallback((slotIndex: number, screenRect: DOMRect) => {
    const project = projects[slotIndex];
    if (!project) return;
    const filteredIndex = filteredProjects.findIndex(({ id }) => id === project.id);
    if (filteredIndex < 0) return;

    // Hero panels remain in place so their close animation can return to the
    // clicked sphere card. Case-study routes belong to the Work section.
    setActiveSlotIndex(slotIndex);
    setEnterFrom(screenRect);
    sceneRef.current?.setExpandedSlot(slotIndex);
    setExpandedIdx(filteredIndex);
  }, [filteredProjects]);

  const activateCardSlot = useCallback((slotIndex: number) => {
    if (!availableCardSlotIndices.has(slotIndex)) return;
    setActiveSlotIndex(slotIndex);
    sceneRef.current?.setActiveSlot(slotIndex);
  }, [availableCardSlotIndices]);

  useEffect(() => {
    const setVh = () => {
      const vv = (window as unknown as { visualViewport?: VisualViewport }).visualViewport;
      const h = vv ? vv.height : window.innerHeight;
      document.documentElement.style.setProperty("--vh", `${h * 0.01}px`);
    };
    setVh();
    window.addEventListener("resize", setVh);
    const vv = (window as unknown as { visualViewport?: VisualViewport }).visualViewport;
    if (vv) {
      vv.addEventListener("resize", setVh);
      vv.addEventListener("scroll", setVh);
    }
    return () => {
      window.removeEventListener("resize", setVh);
      if (vv) {
        vv.removeEventListener("resize", setVh);
        vv.removeEventListener("scroll", setVh);
      }
    };
  }, []);

  // ---- Scene + ScrollTrigger (gated) -----------------------------------
  useEffect(() => {
    if (!lifecycle || !triggerRef.current || !containerRef.current) return;
    const scene = new SphereScene(containerRef.current, lifecycle.renderer.domElement);
    sceneRef.current = scene;
    (window as unknown as { __sphere?: SphereScene }).__sphere = scene;
    if (vignetteRef.current) scene.setVignetteEl(vignetteRef.current);
    setViewMode(scene.getViewMode());
    scene.setOnViewModeChange((mode) => setViewMode(mode));
    scene.setOnCardClick(openProjectAtSlot);
    let scrollIntentFired = false;
    const fireScrollIntent = () => {
      if (scrollIntentFired) return;
      scrollIntentFired = true;
      scene.notifyScrollIntent();
    };
    const onFirstWheel = () => fireScrollIntent();
    const onFirstTouch = () => fireScrollIntent();
    window.addEventListener("wheel", onFirstWheel, { passive: true, once: true });
    window.addEventListener("touchmove", onFirstTouch, { passive: true, once: true });

    let detectedScrub: number | null = null;
    let detectScrubFromDelta: ((e: WheelEvent) => void) | null = null;

    let st: ScrollTrigger | null = null;
    let onRefresh: (() => void) | null = null;

    if (!isFallback) {
      detectScrubFromDelta = (e: WheelEvent) => {
        if (detectedScrub !== null) return;
        const abs = Math.abs(e.deltaY);
        const isTrackpad = abs < 50 && e.deltaMode === 0;
        const isWheelMouse = abs >= 80;
        if (isTrackpad || isWheelMouse) {
          detectedScrub = isWheelMouse ? 0.85 : 0.6;
          if (detectScrubFromDelta) window.removeEventListener("wheel", detectScrubFromDelta as EventListener);
        }
      };
      window.addEventListener("wheel", detectScrubFromDelta as EventListener, { passive: true });

      st = ScrollTrigger.create({
        trigger: triggerRef.current,
        start: "top top",
        end: "+=400%",
        pin: true,
        scrub: 0.6,
        anticipatePin: 1,
        onUpdate: (self) => {
          const p = self.progress;
          if (p > 0.005 && !hasScrolledRef.current) {
            hasScrolledRef.current = true;
            setHasScrolled(true);
            fireScrollIntent();
          }
          if (p > 0.001) fireScrollIntent();
          setScrubP(p);
          scene.setScrubProgress(p);
          if (heroHeadlineRef.current) {
            const t = Math.min(p / HERO_HEADLINE_FADE_END, 1);
            heroHeadlineRef.current.style.opacity = String(1 - t);
            heroHeadlineRef.current.style.transform = `translateY(${t * -8}px)`;
            heroHeadlineRef.current.style.pointerEvents = t >= 0.98 ? "none" : "auto";
          }
        },
      });
      stRef.current = st;
      scene.setScrubProgress(st.progress);
      setScrubP(st.progress);

      onRefresh = () => scene.setScrubProgress(st!.progress);
      ScrollTrigger.addEventListener("refresh", onRefresh);
      const vv = (window as unknown as { visualViewport?: VisualViewport }).visualViewport;
      if (vv) {
        const vvRefresh = () => ScrollTrigger.refresh();
        vv.addEventListener("resize", vvRefresh);
        vv.addEventListener("scroll", vvRefresh);
        (st as unknown as { _vvCleanup?: () => void })._vvCleanup = () => {
          vv.removeEventListener("resize", vvRefresh);
          vv.removeEventListener("scroll", vvRefresh);
        };
      }
    } else {
      scene.setScrubProgress(0);
      setScrubP(0);
      if (heroHeadlineRef.current) {
        heroHeadlineRef.current.style.opacity = "1";
        heroHeadlineRef.current.style.transform = "translateY(0)";
        heroHeadlineRef.current.style.pointerEvents = "auto";
      }
      stRef.current = null;
      ScrollTrigger.refresh();
    }

    // Zone HTML positioning — closing-pass final (spec §5, §16)
    // Three zones: P (photo, WebGL single unsliced, no HTML), H (headline, 4 lines heaviest weight),
    // BC (bio+contact, small underlined links beneath bio). No E, no T.
    // H and BC use narrowly-scoped overflow:visible with δ≈0.3 bleed beyond single-row nominal
    // to carry 4 lines + 2 bio lines + contact. All zone roots are padding:0, borderRadius:0,
    // flush to projected cell rect. Photo bleeds to top/right/bottom with no border.
    const updateZones = () => {
      const p = scene.getScrubProgress();
      const layer = zoneLayerRef.current;
      if (!layer) return;
      const revealT = Math.max(0, Math.min(1, (p - BLUEPRINT_END) / (REVEAL_END - BLUEPRINT_END)));
      const layerOpacity = p < BLUEPRINT_END ? 0 : revealT;
      layer.style.opacity = String(layerOpacity);
      layer.style.pointerEvents = p >= BLUEPRINT_END ? "auto" : "none";
      if (p < ARRIVAL_END || isFallback) return;
      // Only H and BC have HTML overlays; P is pure WebGL photo texture
      // H is single-row at row 1, BC nominally at row 4 — the visual gap is rAF-positioned to 2px
      let hRect: { left: number; top: number; width: number } | null = null;
      let hScaled = 0;
      const keys: (keyof typeof ZONES)[] = ["H", "BC"];
      for (const k of keys) {
        const el = layer.querySelector(`[data-zone="${k}"]`) as HTMLElement | null;
        if (!el) continue;
        const rect = scene.getZoneScreenRect(k);
        if (!rect) continue;
        if (k === "H") {
          // Flush to projected cell rect — zero padding/radius (§4, §16)
          el.style.left = `${rect.left}px`;
          // Lift the complete About stack to retain the contact links within the viewport.
          el.style.top = `${rect.top - 40}px`;
          el.style.width = `${rect.width}px`;
          el.style.height = `${rect.height}px`;
          el.style.padding = "0";
          el.style.borderRadius = "0";
          el.style.overflow = "visible";
          const w = rect.width;
          const scaled = Math.max(56, Math.min(84, w * 0.145));
          hScaled = scaled;
          hRect = { left: rect.left, top: rect.top - 40, width: rect.width };
          el.style.fontSize = `${scaled}px`;
          el.style.lineHeight = "0.92";
          el.style.fontWeight = "900";
        } else if (k === "BC") {
          // Place BC 2px below H's visual bottom, not at its own row-4 rect — this is the 2px you asked for
          const w = rect.width;
          const scaled = Math.max(14, Math.min(18, w * 0.038));
          el.style.fontSize = `${scaled}px`;
          el.style.lineHeight = "1.4";
          el.style.padding = "0";
          el.style.borderRadius = "0";
          el.style.overflow = "visible";
          el.style.width = `${rect.width}px`;
          // Use H's visual height to compute BC top if H has been laid out
          if (hRect) {
            const hVisualHeight = hScaled * 0.92 * 4; // 4 lines at 0.92 leading
            el.style.left = `${hRect.left}px`;
            el.style.top = `${hRect.top + hVisualHeight + 2}px`;
            el.style.height = "auto";
          } else {
            el.style.left = `${rect.left}px`;
            el.style.top = `${rect.top}px`;
            el.style.height = `${rect.height}px`;
          }
        }
      }
    };
    const unregisterScene = lifecycle.register({
      id: "hero-about",
      scene: scene.getRenderScene(),
      camera: scene.getRenderCamera(),
      element: containerRef.current,
      update: (deltaSeconds) => {
        scene.update(deltaSeconds);
        updateZones();
      },
      resize: ({ width, height }) => scene.resize(width, height),
    });
    lifecycle.setActive("hero-about");

    return () => {
      window.removeEventListener("wheel", onFirstWheel as EventListener);
      window.removeEventListener("touchmove", onFirstTouch as EventListener);
      if (detectScrubFromDelta) window.removeEventListener("wheel", detectScrubFromDelta as EventListener);
      if (onRefresh) ScrollTrigger.removeEventListener("refresh", onRefresh);
      if (st) {
        const vvCleanup = (st as unknown as { _vvCleanup?: () => void })._vvCleanup;
        if (vvCleanup) vvCleanup();
        st.kill();
        ScrollTrigger.refresh();
      }
      stRef.current = null;
      scene.setOnCardClick(null);
      scene.setOnViewModeChange(null);
      scene.setVignetteEl(null);
      unregisterScene();
      scene.dispose();
      sceneRef.current = null;
      delete (window as unknown as { __sphere?: unknown }).__sphere;
    };
  }, [isFallback, lifecycle, openProjectAtSlot]);

  // The browser resolves a post-pin anchor before effects create the About pin.
  // Re-resolve after the pin/fallback layout has committed so both routes land correctly.
  useEffect(() => {
    let frameA = 0;
    let frameB = 0;
    let postPinTimer = 0;
    const alignPostPinHash = () => {
      const targetId = window.location.hash.slice(1);
      if (targetId !== "work" && targetId !== "close") return;
      cancelAnimationFrame(frameA);
      cancelAnimationFrame(frameB);
      frameA = requestAnimationFrame(() => {
        const align = () => document.getElementById(targetId)?.scrollIntoView({ block: "start" });
        frameB = requestAnimationFrame(() => {
          align();
          // ScrollTrigger's initial pin refresh can land after the browser's
          // native hash jump. One post-layout alignment covers cold deep links.
          postPinTimer = window.setTimeout(align, 180);
        });
      });
    };
    alignPostPinHash();
    window.addEventListener("hashchange", alignPostPinHash);
    return () => {
      cancelAnimationFrame(frameA);
      cancelAnimationFrame(frameB);
      window.clearTimeout(postPinTimer);
      window.removeEventListener("hashchange", alignPostPinHash);
    };
  }, [isFallback]);

  useEffect(() => {
    const st = stRef.current;
    if (expandedIdx !== null) {
      st?.disable(false);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      st?.enable(false, false);
      ScrollTrigger.refresh();
      sceneRef.current?.setExpandedSlot(null);
    }
  }, [expandedIdx]);

  const handleClose = useCallback(() => {
    const scene = sceneRef.current;
    setExpandedIdx(null);
    window.setTimeout(() => setEnterFrom(undefined), 600);
    scene?.setExpandedSlot(null);
  }, []);

  const navigatePanel = useCallback((direction: 1 | -1) => {
    if (expandedIdx === null || panelNavigationAnimatingRef.current) return;
    const atBoundary = direction > 0 ? expandedIdx >= filteredProjects.length - 1 : expandedIdx <= 0;
    const panel = projectPanelRef.current?.getPanelElement();

    if (atBoundary) {
      if (!panel) return;
      panelNavigationAnimatingRef.current = true;
      const offset = direction > 0 ? -18 : 18;
      gsap.timeline({ onComplete: () => (panelNavigationAnimatingRef.current = false) })
        .to(panel, { x: offset, duration: 0.14, ease: "power2.out" })
        .to(panel, { x: 0, duration: 0.32, ease: "elastic.out(1, 0.5)" });
      return;
    }

    panelNavigationAnimatingRef.current = true;
    const nextIndex = expandedIdx + direction;
    const exitOffset = direction > 0 ? -40 : 40;
    const entranceOffset = direction > 0 ? 30 : -30;
    const kick = direction > 0 ? -14 : 14;
    const settle = () => {
      setExpandedIdx(nextIndex);
      sceneRef.current?.setExpandedSlot(slotForFiltered(nextIndex));
      requestAnimationFrame(() => {
        const nextPanel = projectPanelRef.current?.getPanelElement();
        if (!nextPanel) { panelNavigationAnimatingRef.current = false; return; }
        gsap.set(nextPanel, { x: entranceOffset });
        gsap.to(nextPanel, {
          x: 0,
          duration: 0.5,
          ease: "back.out(1.4)",
          onComplete: () => (panelNavigationAnimatingRef.current = false),
        });
        const scroll = projectPanelRef.current?.getScrollElement();
        if (scroll) scroll.scrollTop = 0;
      });
    };

    if (!panel) {
      settle();
      return;
    }
    gsap.timeline({ onComplete: settle })
      .to(panel, { x: kick, duration: 0.12, ease: "power2.in" })
      .to(panel, { x: exitOffset, opacity: 0.85, duration: 0.18, ease: "power2.in" }, "-=0.04");
  }, [expandedIdx, filteredProjects.length]);

  const handleNext = useCallback(() => navigatePanel(1), [navigatePanel]);
  const handlePrev = useCallback(() => navigatePanel(-1), [navigatePanel]);

  const expandedProject = expandedIdx !== null ? filteredProjects[expandedIdx] : null;
  const canvasBlur = expandedIdx !== null ? "blur(14px) saturate(0.9)" : "blur(0px)";
  const heroHeaderVisible = isFallback ? heroSectionVisible : scrubP < HERO_HEADLINE_FADE_END;
  const heroHeaderOpacity = isFallback ? Number(heroSectionVisible) : Math.max(0, 1 - scrubP / HERO_HEADLINE_FADE_END);
  const scrubLocked = isFallback;
  const effectiveToggleHidden = expandedIdx !== null || (!scrubLocked && scrubP > TOGGLE_HIDE_END);

  const handleToggle = () => {
    const next: "inside" | "outside" = viewMode === "inside" ? "outside" : "inside";
    setViewMode(next);
    sceneRef.current?.setViewMode(next);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && expandedIdx !== null) {
        e.preventDefault();
        handleClose();
      } else if (expandedIdx !== null && (e.key === "ArrowDown" || e.key === "ArrowRight")) {
        e.preventDefault();
        handleNext();
      } else if (expandedIdx !== null && (e.key === "ArrowUp" || e.key === "ArrowLeft")) {
        e.preventDefault();
        handlePrev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expandedIdx, handleClose, handleNext, handlePrev]);

  useEffect(() => {
    if (expandedIdx === null) return;
    const onWheel = (e: WheelEvent) => {
      if (panelNavigationAnimatingRef.current) {
        e.preventDefault();
        return;
      }
      const scroll = projectPanelRef.current?.getScrollElement();
      if (!scroll) return;
      const atTop = scroll.scrollTop <= 1;
      const atBottom = scroll.scrollTop + scroll.clientHeight >= scroll.scrollHeight - 1;
      const { deltaY } = e;

      if ((deltaY < 0 && !atTop) || (deltaY > 0 && !atBottom)) {
        wheelAccumRef.current = 0;
        return;
      }

      wheelAccumRef.current += deltaY;
      if (wheelAccumTimerRef.current) window.clearTimeout(wheelAccumTimerRef.current);
      wheelAccumTimerRef.current = window.setTimeout(() => (wheelAccumRef.current = 0), 180);

      const threshold = 55;
      if (Math.abs(wheelAccumRef.current) < threshold) {
        if (atTop || atBottom) e.preventDefault();
        return;
      }
      e.preventDefault();
      const direction: 1 | -1 = wheelAccumRef.current > 0 ? 1 : -1;
      wheelAccumRef.current = 0;
      navigatePanel(direction);
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("wheel", onWheel);
      if (wheelAccumTimerRef.current) window.clearTimeout(wheelAccumTimerRef.current);
    };
  }, [expandedIdx, navigatePanel]);

  const onboardingHidden = hasScrolled || (!isFallback && scrubP > INTERACTION_LOCK_EPSILON) || expandedIdx !== null;
  const keyboardSphereEnabled = scrubP <= INTERACTION_LOCK_EPSILON && expandedIdx === null && availableCardSlots.length > 0;
  const activeProject = projects[activeSlotIndex];

  useEffect(() => {
    if (!keyboardSphereEnabled) sceneRef.current?.setActiveSlot(null);
  }, [keyboardSphereEnabled]);

  useEffect(() => {
    if (!keyboardSphereEnabled || !activeProject) {
      setLiveMessage("");
      return;
    }
    const timer = window.setTimeout(() => {
      setLiveMessage(`${activeProject.title}, ${activeProject.year ?? "year unknown"}, ${activeProject.status}`);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [activeProject, keyboardSphereEnabled]);

  const handleSphereKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!keyboardSphereEnabled) return;
    const keyMap: Record<string, CardNavigationKey> = {
      ArrowLeft: "previous",
      ArrowRight: "next",
      ArrowUp: "previousRing",
      ArrowDown: "nextRing",
      Home: "first",
      End: "last",
    };
    const navigation = keyMap[event.key];
    if (navigation) {
      event.preventDefault();
      activateCardSlot(walkCardRing(cardSlots, activeSlotIndex, navigation, availableCardSlotIndices));
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const rect = sceneRef.current?.getCardScreenPosition(activeSlotIndex) ?? new DOMRect();
      openProjectAtSlot(activeSlotIndex, rect);
    }
  };

  return (
    <div style={{ background: "#000" }}>
      <a
        href="#after-hero"
        onFocus={() => setSkipLinkFocused(true)}
        onBlur={() => setSkipLinkFocused(false)}
        style={{
          position: "fixed",
          top: 12,
          left: 12,
          zIndex: 100,
          padding: "8px 12px",
          border: "1px solid rgba(255,255,255,0.55)",
          background: "#000",
          color: "#EDEDF0",
          fontFamily: LABEL_FONT_FAMILY,
          fontSize: 13,
          textDecoration: "none",
          transform: skipLinkFocused ? "translateY(0)" : "translateY(-160%)",
          transition: "transform 120ms ease",
        }}
      >
        Skip past hero
      </a>
      <section
        ref={triggerRef}
        style={{ position: "relative", height: "100vh", overflow: "hidden", background: "#000" }}
      >
        <div
          ref={containerRef}
          style={{ position: "absolute", inset: 0, filter: canvasBlur, transition: "filter 420ms ease", willChange: "filter" }}
        />
        <div
          role="listbox"
          tabIndex={keyboardSphereEnabled ? 0 : -1}
          aria-label="Project sphere"
          aria-disabled={!keyboardSphereEnabled}
          aria-activedescendant={activeProject ? `hero-card-${activeProject.id}` : undefined}
          onFocus={() => sceneRef.current?.setActiveSlot(activeSlotIndex)}
          onKeyDown={handleSphereKeyDown}
          style={{ position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none", outline: "none" }}
        >
          {availableCardSlots.map((slot) => {
            const project = projects[slot.index];
            if (!project) return null;
            return (
              <div
                key={project.id}
                id={`hero-card-${project.id}`}
                role="option"
                aria-selected={slot.index === activeSlotIndex}
                aria-label={`${project.title}, ${project.year ?? "year unknown"}, ${project.status}`}
                style={{
                  position: "absolute",
                  width: 1,
                  height: 1,
                  padding: 0,
                  margin: -1,
                  overflow: "hidden",
                  clip: "rect(0, 0, 0, 0)",
                  whiteSpace: "nowrap",
                  border: 0,
                }}
              />
            );
          })}
        </div>
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: "hidden",
            clip: "rect(0, 0, 0, 0)",
            whiteSpace: "nowrap",
            border: 0,
          }}
        >
          {liveMessage}
        </div>
        <div
          ref={vignetteRef}
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background: "radial-gradient(ellipse at center, rgba(255,255,255,0.045) 0%, rgba(0,0,0,0) 38%, rgba(0,0,0,0.5) 100%)",
            opacity: 1,
            transition: "opacity 120ms linear",
          }}
        />

        {/* Header — persists unchanged above wall at all progress (§13) */}
        {createPortal(<div
          style={{
            position: "fixed",
            top: 0, left: 0, right: 0,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "16px 24px",
            pointerEvents: "none",
            zIndex: 3,
            opacity: heroHeaderOpacity,
            visibility: heroHeaderVisible ? "visible" : "hidden",
            transition: "opacity 160ms ease, visibility 160ms step-end",
          }}
        >
          <div style={{ color: "rgba(255,255,255,0.9)", fontFamily: LABEL_FONT_FAMILY, fontSize: 13, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", userSelect: "none" }}>
            Raed Siddiqui
          </div>
          <nav aria-label="Primary" style={{ display: "flex", alignItems: "center", gap: 18, pointerEvents: "auto" }}>
            <a href="#about" onClick={handleAboutNavigation} style={{ color: "rgba(255,255,255,0.6)", fontFamily: LABEL_FONT_FAMILY, fontSize: 14, fontWeight: 500, letterSpacing: "0.02em", textDecoration: "none" }}>About</a>
            <a href="#work" style={{ color: "rgba(255,255,255,0.6)", fontFamily: LABEL_FONT_FAMILY, fontSize: 14, fontWeight: 500, letterSpacing: "0.02em", textDecoration: "none" }}>Work</a>
            <a href="#close" style={{ color: "rgba(255,255,255,0.6)", fontFamily: LABEL_FONT_FAMILY, fontSize: 14, fontWeight: 500, letterSpacing: "0.02em", textDecoration: "none" }}>Contact</a>
          </nav>
          <div style={{ display: "flex", alignItems: "center", gap: 10, pointerEvents: "auto" }}>
            <button
              type="button"
              aria-label={viewMode === "inside" ? "Switch to outside orbit view" : "Switch to inside view"}
              aria-pressed={viewMode === "outside"}
              title={viewMode === "inside" ? "Outside view" : "Inside view"}
              onClick={handleToggle}
              tabIndex={effectiveToggleHidden ? -1 : 0}
              style={{
                width: 34, height: 34, borderRadius: CONTROL_PILL_RADIUS_PX,
                border: "1px solid rgba(255,255,255,0.14)",
                background: viewMode === "outside" ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.92)",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                cursor: effectiveToggleHidden ? "default" : "pointer",
                opacity: effectiveToggleHidden ? 0 : 1,
                transform: effectiveToggleHidden ? "translateY(-4px) scale(0.96)" : "translateY(0) scale(1)",
                pointerEvents: effectiveToggleHidden ? "none" : "auto",
                transition: "opacity 260ms ease, transform 260ms ease, background 200ms ease, border-color 200ms ease",
              }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleToggle(); } }}
            >
              {viewMode === "inside" ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <rect x="2.5" y="2.5" width="11" height="11" rx="1.2" stroke="currentColor" strokeWidth="1.2" opacity="0.95" />
                  <rect x="5.2" y="5.2" width="5.6" height="5.6" rx="0.6" stroke="currentColor" strokeWidth="1.1" opacity="0.65" />
                  <circle cx="8" cy="8" r="1.1" fill="currentColor" opacity="0.9" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <circle cx="8" cy="8" r="5.2" stroke="currentColor" strokeWidth="1.2" opacity="0.95" />
                  <ellipse cx="8" cy="8" rx="2.4" ry="5.2" stroke="currentColor" strokeWidth="1" opacity="0.85" />
                  <ellipse cx="8" cy="8" rx="5.2" ry="2.4" stroke="currentColor" strokeWidth="1" opacity="0.45" />
                  <path d="M3.2 8 H12.8" stroke="currentColor" strokeWidth="1" opacity="0.45" />
                </svg>
              )}
            </button>
            <a
              href="#close"
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                height: 34, padding: "0 15px", borderRadius: CONTROL_PILL_RADIUS_PX,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.92)",
                fontFamily: LABEL_FONT_FAMILY, fontSize: 13, fontWeight: 500, letterSpacing: "0.02em",
                textDecoration: "none",
                opacity: expandedIdx !== null ? 0 : 1,
                pointerEvents: expandedIdx !== null ? "none" : "auto",
                transition: "opacity 260ms ease",
              }}
            >
              Availability
            </a>
          </div>
        </div>, document.body)}

        {/* Hero headline + CTA — fades 0–0.12, distinct from About headline zone H (§13) */}
        <div
          ref={heroHeadlineRef}
          style={{
            position: "absolute",
            left: 24, bottom: 56,
            maxWidth: 520,
            pointerEvents: "auto",
            zIndex: 2,
          }}
        >
          <h1
            style={{
              margin: 0,
              color: "rgba(255,255,255,0.96)",
              fontFamily: DISPLAY_FONT_FAMILY,
              fontSize: "clamp(28px, 4.2vw, 44px)",
              fontWeight: 700,
              lineHeight: 1.02,
              letterSpacing: "-0.03em",
              textWrap: "balance",
            }}
          >
            Architecting autonomous AI systems<br />and high-performance web platforms.
          </h1>
          <div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "center" }}>
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                height: 36, padding: "0 16px", borderRadius: CONTROL_PILL_RADIUS_PX,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.94)",
                fontFamily: LABEL_FONT_FAMILY, fontSize: 13, fontWeight: 500,
                textDecoration: "none",
              }}
            >
              View selected work ↓
            </a>
            <span style={{ color: "rgba(255,255,255,0.42)", fontFamily: LABEL_FONT_FAMILY, fontSize: 12, letterSpacing: "0.04em" }}>
              {isFallback ? "Craft that holds up close" : "Scroll to reveal the wall"}
            </span>
          </div>
        </div>

        {/* Onboarding hint — bottom-right, dismisses on scroll start, same as first-drag (§13) */}
        <div
          aria-hidden={onboardingHidden}
          style={{
            position: "absolute",
            right: 16, bottom: 14,
            display: "inline-flex", alignItems: "center", gap: 8,
            color: "rgba(255,255,255,0.42)",
            fontFamily: LABEL_FONT_FAMILY, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase",
            pointerEvents: "none", userSelect: "none",
            opacity: onboardingHidden ? 0 : 1,
            transform: onboardingHidden ? "translateY(4px)" : "translateY(0)",
            transition: "opacity 260ms ease, transform 260ms ease",
            zIndex: 2,
          }}
        >
          <span>Drag to explore the sphere</span>
        </div>

        {/* Zone HTML — closing-pass final §5: H (headline 4 lines heaviest weight) + BC (bio + contact)
            No E, no T. Photo P is pure WebGL single unsliced BW — no HTML overlay. */}
        <div
          ref={zoneLayerRef}
          aria-hidden={isFallback || scrubP < BLUEPRINT_END}
          style={{
            position: "absolute", inset: 0,
            pointerEvents: !isFallback && scrubP >= BLUEPRINT_END ? "auto" : "none",
            opacity: 0,
            transition: "opacity 120ms linear",
            zIndex: 2,
          }}
        >
          {/* H — headline: 4 lines heaviest weight, final line 15% lightness, single-row bleed */}
          <div
            data-zone="H"
            style={{
              position: "absolute",
              display: "block",
              padding: 0,
              borderRadius: 0,
              overflow: "visible",
              color: "rgba(255,255,255,0.96)",
              fontFamily: DISPLAY_FONT_FAMILY,
              fontWeight: 700,
              lineHeight: 0.98,
              letterSpacing: "-0.01em",
              textWrap: "balance",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "-2.4em",
                left: 0,
                color: "rgba(255,255,255,0.52)",
                fontFamily: LABEL_FONT_FAMILY,
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.14em",
                lineHeight: 1,
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              01 — THE PRACTICE
            </div>
            <div>Engineering</div>
            <div>at the edge of</div>
            <div>AI and</div>
            <span style={{ background: "linear-gradient(90deg, #444343 0%, #707070 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", color: "transparent", display: "inline-block", fontWeight: 700 }}>automation</span>
          </div>
          {/* BC — bio + contact stacked, small underlined links beneath bio */}
          <div
            data-zone="BC"
            style={{
              position: "absolute",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 10,
              padding: 0,
              borderRadius: 0,
              marginTop: 0,
              overflow: "visible",
            }}
          >
            <p
              style={{
                margin: 0,
                color: "rgba(255,255,255,0.58)",
                fontFamily: DISPLAY_FONT_FAMILY,
                fontSize: "inherit",
                fontWeight: 400,
                lineHeight: 1.35,
                letterSpacing: "0.01em",
              }}
            >
              I build autonomous agents and scalable platforms<br />that replace manual overhead with intelligent code.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <a
                href="mailto:raedsiddiquie4@gmail.com"
                style={{
                  color: "rgba(255,255,255,0.72)",
                  display: "inline-flex",
                  alignItems: "center",
                  minHeight: 30,
                  boxSizing: "border-box",
                  padding: "5px 10px",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: CONTROL_PILL_RADIUS_PX,
                  background: "transparent",
                  fontFamily: LABEL_FONT_FAMILY,
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: "0.02em",
                  textDecoration: "none",
                }}
              >
                Email
              </a>
              <a
                href="https://www.linkedin.com/in/raedsiddiquie/"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "rgba(255,255,255,0.72)",
                  display: "inline-flex",
                  alignItems: "center",
                  minHeight: 30,
                  boxSizing: "border-box",
                  padding: "5px 10px",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: CONTROL_PILL_RADIUS_PX,
                  background: "transparent",
                  fontFamily: LABEL_FONT_FAMILY,
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: "0.02em",
                  textDecoration: "none",
                }}
              >
                Resume
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Gate flip: fallback renders conventional About; otherwise the wall itself is the About (§2, §15) */}
      <div id="after-hero" tabIndex={-1}>
        {isFallback ? (
          <>
            <FallbackAbout />
            {lifecycle && <WorkSection lifecycle={lifecycle} />}
          </>
        ) : (
          lifecycle && <WorkSection lifecycle={lifecycle} />
        )}
      </div>
      <ClosingSection />

      {expandedProject && expandedIdx !== null && (
        <ProjectPanel
          ref={projectPanelRef}
          project={expandedProject}
          enterFrom={enterFrom}
          onClose={handleClose}
          onPrev={handlePrev}
          onNext={handleNext}
        />
      )}
    </div>
  );
}
