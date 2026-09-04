import { useEffect, useRef, useState, useMemo } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SphereScene } from "./scene/SphereScene";
import ExpandedPanel from "./components/ExpandedPanel";
import FallbackAbout from "./components/FallbackAbout";
import { projects } from "./data/projects";
import type { Project } from "./types";
import { ZONES } from "./constants";
import { shouldUseFallback } from "./utils/gates";

gsap.registerPlugin(ScrollTrigger);

export default function App() {
  const triggerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const vignetteRef = useRef<HTMLDivElement>(null);
  const heroHeadlineRef = useRef<HTMLDivElement>(null);
  const zoneLayerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SphereScene | null>(null);
  const stRef = useRef<ScrollTrigger | null>(null);
  const rafZoneRef = useRef<number>(0);
  const [hasScrolled, setHasScrolled] = useState(false);
  const hasScrolledRef = useRef(false);

  const filteredProjects = useMemo(() => projects.filter(Boolean) as Project[], []);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const [viewMode, setViewMode] = useState<"inside" | "outside">("inside");
  const [scrubP, setScrubP] = useState(0);

  // ---- Gates — closing-pass final: v ∈ (1.65, 2.61) for δ≈0.3 ----
  const [isFallback, setIsFallback] = useState<boolean>(() => {
    try { return shouldUseFallback(); } catch { return false; }
  });

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
    if (!triggerRef.current || !containerRef.current) return;
    const scene = new SphereScene(containerRef.current);
    sceneRef.current = scene;
    (window as unknown as { __sphere?: SphereScene }).__sphere = scene;
    if (vignetteRef.current) scene.setVignetteEl(vignetteRef.current);
    setViewMode(scene.getViewMode());
    scene.setOnViewModeChange((mode) => setViewMode(mode));
    scene.setOnCardClick((slotIndex, screenPos) => {
      if (filteredProjects.length === 0) return;
      const proj = projects[slotIndex];
      if (!proj) return;
      const fi = filteredProjects.findIndex((p) => p.id === proj.id);
      if (fi === -1) return;
      setOrigin(screenPos);
      setExpandedIdx(fi);
      scene.setExpandedSlot(slotIndex);
    });

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
            const t = Math.min(p / 0.12, 1);
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
      rafZoneRef.current = requestAnimationFrame(updateZones);
      const p = scene.getScrubProgress();
      const layer = zoneLayerRef.current;
      if (!layer) return;
      const revealT = Math.max(0, Math.min(1, (p - 0.82) / (0.94 - 0.82)));
      const layerOpacity = p < 0.82 ? 0 : revealT;
      layer.style.opacity = String(layerOpacity);
      layer.style.pointerEvents = p >= 0.82 ? "auto" : "none";
      if (p < 0.74 || isFallback) return;
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
    updateZones();

    return () => {
      cancelAnimationFrame(rafZoneRef.current);
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
      scene.dispose();
      sceneRef.current = null;
      delete (window as unknown as { __sphere?: unknown }).__sphere;
    };
  }, [filteredProjects, isFallback]);

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

  const handleClose = () => {
    const scene = sceneRef.current;
    setExpandedIdx(null);
    window.setTimeout(() => setOrigin(null), 600);
    scene?.setExpandedSlot(null);
  };
  const handleNext = () => {
    if (expandedIdx === null) return;
    const next = Math.min(expandedIdx + 1, filteredProjects.length - 1);
    if (next === expandedIdx) return;
    setExpandedIdx(next);
    const slot = slotForFiltered(next);
    sceneRef.current?.setExpandedSlot(slot);
    const pos = sceneRef.current?.getCardScreenPosition(slot);
    if (pos) setOrigin(pos);
  };
  const handlePrev = () => {
    if (expandedIdx === null) return;
    const prev = Math.max(expandedIdx - 1, 0);
    if (prev === expandedIdx) return;
    setExpandedIdx(prev);
    const slot = slotForFiltered(prev);
    sceneRef.current?.setExpandedSlot(slot);
    const pos = sceneRef.current?.getCardScreenPosition(slot);
    if (pos) setOrigin(pos);
  };

  const expandedProject = expandedIdx !== null ? filteredProjects[expandedIdx] : null;
  const canvasBlur = expandedIdx !== null ? "blur(14px) saturate(0.9)" : "blur(0px)";
  const scrubLocked = isFallback;
  const effectiveToggleHidden = expandedIdx !== null || (!scrubLocked && scrubP > 0.10);

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
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expandedIdx]);

  const onboardingHidden = hasScrolled || (!isFallback && scrubP > 0.02) || expandedIdx !== null;

  return (
    <div style={{ background: "#000" }}>
      <section
        ref={triggerRef}
        style={{ position: "relative", height: "100vh", overflow: "hidden", background: "#000" }}
      >
        <div
          ref={containerRef}
          style={{ position: "absolute", inset: 0, filter: canvasBlur, transition: "filter 420ms ease", willChange: "filter" }}
        />
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
        <div
          style={{
            position: "absolute",
            top: 0, left: 0, right: 0,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "16px 24px",
            pointerEvents: "none",
            zIndex: 3,
          }}
        >
          <div style={{ color: "rgba(255,255,255,0.9)", fontFamily: "system-ui, sans-serif", fontSize: 13, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", userSelect: "none" }}>
            Raed Siddiqui
          </div>
          <nav aria-label="Primary" style={{ display: "flex", alignItems: "center", gap: 18, pointerEvents: "auto" }}>
            <a href="#work" style={{ color: "rgba(255,255,255,0.6)", fontFamily: "system-ui, sans-serif", fontSize: 13, fontWeight: 500, letterSpacing: "0.02em", textDecoration: "none" }}>Work</a>
            <a href="#lab" style={{ color: "rgba(255,255,255,0.6)", fontFamily: "system-ui, sans-serif", fontSize: 13, fontWeight: 500, letterSpacing: "0.02em", textDecoration: "none" }}>Lab</a>
            <a href="#about" style={{ color: "rgba(255,255,255,0.6)", fontFamily: "system-ui, sans-serif", fontSize: 13, fontWeight: 500, letterSpacing: "0.02em", textDecoration: "none" }}>About</a>
            <a href="#contact" style={{ color: "rgba(255,255,255,0.6)", fontFamily: "system-ui, sans-serif", fontSize: 13, fontWeight: 500, letterSpacing: "0.02em", textDecoration: "none" }}>Contact</a>
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
                width: 34, height: 34, borderRadius: 999,
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
              href="#"
              onClick={(e) => e.preventDefault()}
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                height: 34, padding: "0 15px", borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.92)",
                fontFamily: "system-ui, sans-serif", fontSize: 13, fontWeight: 500, letterSpacing: "0.02em",
                textDecoration: "none",
                opacity: expandedIdx !== null ? 0 : 1,
                pointerEvents: expandedIdx !== null ? "none" : "auto",
                transition: "opacity 260ms ease",
              }}
            >
              Availability
            </a>
          </div>
        </div>

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
              fontFamily: "system-ui, sans-serif",
              fontSize: "clamp(28px, 4.2vw, 44px)",
              fontWeight: 800,
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
                height: 36, padding: "0 16px", borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.94)",
                fontFamily: "system-ui, sans-serif", fontSize: 13, fontWeight: 500,
                textDecoration: "none",
              }}
            >
              View selected work ↓
            </a>
            <span style={{ color: "rgba(255,255,255,0.42)", fontFamily: "system-ui, sans-serif", fontSize: 12, letterSpacing: "0.04em" }}>
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
            fontFamily: "system-ui, sans-serif", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase",
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
          aria-hidden={isFallback || scrubP < 0.82}
          style={{
            position: "absolute", inset: 0,
            pointerEvents: !isFallback && scrubP >= 0.82 ? "auto" : "none",
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
              fontFamily: "system-ui, sans-serif",
              fontWeight: 900,
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
                fontFamily: "system-ui, sans-serif",
                fontSize: "clamp(12px, 1vw, 15px)",
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
            <span style={{ background: "linear-gradient(90deg, #444343 0%, #707070 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", color: "transparent", display: "inline-block", fontWeight: 900 }}>automation</span>
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
                fontFamily: "system-ui, sans-serif",
                fontSize: "inherit",
                fontWeight: 400,
                lineHeight: 1.35,
                letterSpacing: "0.01em",
              }}
            >
              I build autonomous agents and scalable platforms<br />that replace manual overhead with intelligent code.
            </p>
            <div style={{ display: "flex", gap: 18 }}>
              <a
                href="mailto:raedsiddiquie4@gmail.com"
                style={{
                  color: "rgba(255,255,255,0.72)",
                  fontFamily: "system-ui, sans-serif",
                  fontSize: 16,
                  fontWeight: 500,
                  letterSpacing: "0.02em",
                  textDecoration: "underline",
                  textUnderlineOffset: 3,
                  textDecorationThickness: 1,
                  textDecorationColor: "rgba(255,255,255,0.35)",
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
                  fontFamily: "system-ui, sans-serif",
                  fontSize: 16,
                  fontWeight: 500,
                  letterSpacing: "0.02em",
                  textDecoration: "underline",
                  textUnderlineOffset: 3,
                  textDecorationThickness: 1,
                  textDecorationColor: "rgba(255,255,255,0.35)",
                }}
              >
                Resume
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Gate flip: fallback renders conventional About; otherwise the wall itself is the About (§2, §15) */}
      {isFallback ? (
        <FallbackAbout />
      ) : (
        <section
          style={{
            minHeight: "60vh",
            padding: "80px 40px",
            background: "#000",
            color: "rgba(255,255,255,0.58)",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div style={{ maxWidth: 640 }}>
            <p style={{ margin: 0, fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.4 }}>— Next section</p>
            <p style={{ marginTop: 16, lineHeight: 1.6, fontSize: 15 }}>
              The wall above has settled — cover-framed, stroke-free, single unsliced BW portrait, HTML zones flush with zero padding/radius.
              Wall unpinned and scrolling away. WebGL pauses once off-screen.
            </p>
          </div>
        </section>
      )}

      <div style={{ height: isFallback ? "0" : "40vh", background: "#000" }} />

      {expandedProject && expandedIdx !== null && (
        <ExpandedPanel
          project={expandedProject}
          index={expandedIdx}
          total={filteredProjects.length}
          origin={origin}
          allProjects={filteredProjects}
          onClose={handleClose}
          onPrev={handlePrev}
          onNext={handleNext}
        />
      )}
    </div>
  );
}
