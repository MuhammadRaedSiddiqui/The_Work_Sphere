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

  // ---- Phase 6 gates ---------------------------------------------------
  // Any one failing → fallback: pin is never created (§7, §15).
  const [isFallback, setIsFallback] = useState<boolean>(() => {
    try { return shouldUseFallback(); } catch { return false; }
  });

  useEffect(() => {
    // Evaluate on debounced resize / orientationchange / reduced-motion change.
    // A flip reinitializes at progress 0: scroll to top and flip isFallback.
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;

    const checkAndFlip = () => {
      const next = shouldUseFallback();
      setIsFallback((prev) => {
        if (next !== prev) {
          // Reinitialize at progress 0 — kill the pin spacer by scrolling to top
          // before the gated effect re-creates the scene.
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
    // Newer browsers support addEventListener on MediaQueryList; fall back to addListener.
    const onMqlChange = () => checkAndFlip();
    try { mql.addEventListener("change", onMqlChange); }
    catch { (mql as unknown as { addListener: (cb: () => void) => void }).addListener(onMqlChange); }

    window.addEventListener("resize", debounced);
    window.addEventListener("orientationchange", debounced);
    // Also poll connection/memory changes where supported — they can flip the tier gate.
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

  // Phase 7: dynamic viewport unit for iOS Safari URL-bar (visualViewport)
  // Keeps --vh in sync so 100dvh fallback works, but trigger height stays
  // 100vh for ScrollTrigger stability (pin distance = 400% = 4× viewport).
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

    // Phase 7: thumbnail preload on scroll intent — fire once on first scroll
    // Do not load high-res thumbs immediately; LQIP stays through flight with no pop on desktop.
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
    // Also fire if ScrollTrigger progress becomes >0 (covers smooth scroll / trackpad)
    // handled in onUpdate below.

    // Phase 7: A/B scrub detection — hoisted so cleanup can remove it
    let detectedScrub: number | null = null;
    let detectScrubFromDelta: ((e: WheelEvent) => void) | null = null;

    // Gate the ScrollTrigger construction itself (§15) — no pin spacer when fallback.
    let st: ScrollTrigger | null = null;
    let onRefresh: (() => void) | null = null;

    if (!isFallback) {
      // Pin distance ≈4× viewport (spec §2). Use 400% of trigger height (100vh)
      // so it automatically tracks dvh/--vh without computing absolute px.
      // iOS URL-bar changes are handled via refresh on visualViewport, not via
      // swapping the end string (swapping end after creation breaks scrub).
      detectScrubFromDelta = (e: WheelEvent) => {
        if (detectedScrub !== null) return;
        const abs = Math.abs(e.deltaY);
        const isTrackpad = abs < 50 && e.deltaMode === 0;
        const isWheelMouse = abs >= 80;
        if (isTrackpad || isWheelMouse) {
          detectedScrub = isWheelMouse ? 0.85 : 0.6;
          // Note: mutating st.vars.scrub after creation is unreliable; the
          // detection is kept for logging/A-B insight, but scrub stays at 0.6
          // which tests equally well on trackpad and wheel.
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
        // Progress budget (v2, §6) — single scrub drives all beats:
        //   Flight (position/rotation/spacing lerp) 0 → 0.62
        //   Thumbnail fade to black                 0.62 → 0.74
        //   Edge-stroke boost to 0.9                0.74 → 0.78 (holds to 0.82 blueprint)
        //   Reveal (strokes→0, mosaic+text in)      0.82 → 0.94
        //   Settled buffer (no visual change)       0.94 → 1.0
        // TODO — GSAP timeline (when introduced): map these breakpoints to keyframes on a
        // single declarative timeline scrubbed by ScrollTrigger (spec §16). Animate driver
        // scalars only; one rAF reads them and applies per-card math. Keep continuous props
        // linear; arrival-fade and stroke-boost are the only authored beats.
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
      // Phase 7: visualViewport resize must refresh ScrollTrigger (iOS URL-bar)
      const vv = (window as unknown as { visualViewport?: VisualViewport }).visualViewport;
      if (vv) {
        const vvRefresh = () => ScrollTrigger.refresh();
        vv.addEventListener("resize", vvRefresh);
        vv.addEventListener("scroll", vvRefresh);
        // Store cleanup on st for dispose below
        (st as unknown as { _vvCleanup?: () => void })._vvCleanup = () => {
          vv.removeEventListener("resize", vvRefresh);
          vv.removeEventListener("scroll", vvRefresh);
        };
      }
    } else {
      // Fallback: hero keeps its natural height, no scrub. Keep sphere at p=0.
      scene.setScrubProgress(0);
      setScrubP(0);
      if (heroHeadlineRef.current) {
        heroHeadlineRef.current.style.opacity = "1";
        heroHeadlineRef.current.style.transform = "translateY(0)";
        heroHeadlineRef.current.style.pointerEvents = "auto";
      }
      stRef.current = null;
      // Ensure no stale pin spacers from a previous non-fallback init.
      ScrollTrigger.refresh();
    }

    // Zone HTML positioning: project each zone's rect every frame so overlay stays locked to wall
    // In fallback this loop still runs but exits early (p<0.74) — negligible cost; pause via opacity anyway.
    const updateZones = () => {
      rafZoneRef.current = requestAnimationFrame(updateZones);
      const p = scene.getScrubProgress();
      const layer = zoneLayerRef.current;
      if (!layer) return;
      // Only show zone layer after blueprint → through reveal and settled; hidden during flight
      // HTML text fades in 0.82–0.94 (§6 State 5), but we keep the layer mounted and control opacity
      const revealT = Math.max(0, Math.min(1, (p - 0.82) / (0.94 - 0.82)));
      const layerOpacity = p < 0.82 ? 0 : revealT;
      layer.style.opacity = String(layerOpacity);
      layer.style.pointerEvents = p >= 0.82 ? "auto" : "none";
      if (p < 0.74 || isFallback) return;
      const keys: (keyof typeof ZONES)[] = ["E", "H", "B", "T", "C1", "C2"];
      for (const k of keys) {
        const el = layer.querySelector(`[data-zone="${k}"]`) as HTMLElement | null;
        if (!el) continue;
        const rect = scene.getZoneScreenRect(k);
        if (!rect) continue;
        el.style.left = `${rect.left}px`;
        el.style.top = `${rect.top}px`;
        el.style.width = `${rect.width}px`;
        el.style.height = `${rect.height}px`;
        el.style.maxWidth = `${rect.width}px`;
        el.style.maxHeight = `${rect.height}px`;
        // Hard-constrain both axes + line-height from projected row height (§16)
        // to avoid seam strikethrough and overflow.
        if (k !== "C1" && k !== "C2") {
          const rowH = rect.height;
          el.style.lineHeight = `${Math.max(14, rowH * 0.62)}px`;
        }
        // Bio legibility across safe band 1.5–3.0: scale font-size with zone width
        // so the one-liner stays within the 4-col zone without overflow.
        if (k === "B") {
          // Zone B is 4 cols wide; at safe-band edges its projected width varies ~1.6×
          // Scale 11–15px clamp based on width so desktop narrow (1.5) doesn't clip and ultrawide doesn't look loose.
          const w = rect.width;
          const scaled = Math.max(11, Math.min(15, w * 0.038));
          el.style.fontSize = `${scaled}px`;
          el.style.whiteSpace = "nowrap";
          el.style.overflow = "hidden";
          el.style.textOverflow = "ellipsis";
        }
        if (k === "H") {
          const w = rect.width;
          // Headline scales with zone but stays balanced; 4-col width large enough for clamp
          const scaled = Math.max(18, Math.min(28, w * 0.065));
          el.style.fontSize = `${scaled}px`;
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
        // Removing the pin's spacer is part of kill(); force a refresh so a
        // gate flip never leaves a dead pinned spacer (§15).
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
  // Toggle hidden past p=0.10 in wall mode; always visible in fallback hero (scrubLocked) unless a panel is open.
  const effectiveToggleHidden = expandedIdx !== null || (!scrubLocked && scrubP > 0.10);
  const ctaLive = !isFallback && scrubP >= 0.82 && expandedIdx === null;

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

  // Onboarding hint dismisses on scroll start or first drag (§13)
  const onboardingHidden = hasScrolled || (!isFallback && scrubP > 0.02) || expandedIdx !== null;

  return (
    <div style={{ background: "#0A0A0A" }}>
      <section
        ref={triggerRef}
        style={{ position: "relative", height: "100vh", overflow: "hidden", background: "#0A0A0A" }}
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
            padding: "20px 24px",
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
                width: 36, height: 36, borderRadius: 999,
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
                height: 36, padding: "0 16px", borderRadius: 999,
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

        {/* Zone HTML — only rendered meaningfully when not in fallback; hidden via opacity otherwise */}
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
          {/* E — eyebrow */}
          <div
            data-zone="E"
            style={{
              position: "absolute",
              display: "flex", alignItems: "center",
              overflow: "hidden",
              color: "rgba(255,255,255,0.52)",
              fontFamily: "system-ui, sans-serif",
              fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase",
              whiteSpace: "nowrap",
            }}
          >
            01 — THE PRACTICE
          </div>
          {/* H — headline */}
          <div
            data-zone="H"
            style={{
              position: "absolute",
              display: "flex", alignItems: "center",
              overflow: "hidden",
              color: "rgba(255,255,255,0.96)",
              fontFamily: "system-ui, sans-serif",
              fontSize: "clamp(18px, 2.4vw, 28px)",
              fontWeight: 800, lineHeight: 1.08, letterSpacing: "-0.03em",
              textWrap: "balance",
            }}
          >
            Engineering at the edge of AI and automation.
          </div>
          {/* B — bio (one-liner, §5) */}
          <div
            data-zone="B"
            style={{
              position: "absolute",
              display: "flex", alignItems: "center",
              overflow: "hidden",
              color: "rgba(255,255,255,0.72)",
              fontFamily: "system-ui, sans-serif",
              fontSize: "clamp(12px, 1.2vw, 15px)",
              fontWeight: 400, lineHeight: 1.35, letterSpacing: "0.01em",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
            }}
          >
            I build autonomous agents and scalable platforms that replace manual overhead with intelligent code.
          </div>
          {/* T — tag line */}
          <div
            data-zone="T"
            style={{
              position: "absolute",
              display: "flex", alignItems: "center",
              overflow: "hidden",
              color: "rgba(255,255,255,0.38)",
              fontFamily: "system-ui, sans-serif",
              fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase",
              whiteSpace: "nowrap",
            }}
          >
            AI AGENTS · REACT · FASTAPI · SYSTEMS
          </div>
          {/* C1 — email */}
          <div data-zone="C1" style={{ position: "absolute", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", padding: "0 6px", boxSizing: "border-box" }}>
            <a
              href="mailto:raedsiddiquie4@gmail.com"
              tabIndex={ctaLive ? 0 : -1}
              aria-hidden={!ctaLive}
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                height: 34, padding: "0 18px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(255,255,255,0.08)",
                color: ctaLive ? "rgba(255,255,255,0.94)" : "rgba(255,255,255,0.5)",
                fontFamily: "system-ui, sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: "0.02em",
                textDecoration: "none",
                opacity: ctaLive ? 1 : 0.5,
                pointerEvents: ctaLive ? "auto" : "none",
                transition: "opacity 200ms ease, border-color 200ms ease",
                whiteSpace: "nowrap", flexShrink: 0,
              }}
            >
              Email
            </a>
          </div>
          {/* C2 — Index */}
          <div data-zone="C2" style={{ position: "absolute", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", padding: "0 6px", boxSizing: "border-box" }}>
            <a
              href="#work"
              tabIndex={ctaLive ? 0 : -1}
              aria-hidden={!ctaLive}
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                height: 34, padding: "0 18px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.18)",
                background: ctaLive ? "rgba(255,255,255,0.94)" : "rgba(255,255,255,0.06)",
                color: ctaLive ? "#0A0A0A" : "rgba(255,255,255,0.5)",
                fontFamily: "system-ui, sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: "0.02em",
                textDecoration: "none",
                opacity: ctaLive ? 1 : 0.5,
                pointerEvents: ctaLive ? "auto" : "none",
                transition: "opacity 200ms ease, background 200ms ease",
                whiteSpace: "nowrap", flexShrink: 0,
              }}
            >
              Index
            </a>
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
            background: "#0A0A0A",
            color: "rgba(255,255,255,0.58)",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div style={{ maxWidth: 640 }}>
            <p style={{ margin: 0, fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.4 }}>— Next section</p>
            <p style={{ marginTop: 16, lineHeight: 1.6, fontSize: 15 }}>
              The wall above has settled — cover-framed, stroke-free over text, bezelled photo mosaic, HTML text locked to its zones.
              Wall unpinned and scrolling away. WebGL pauses once off-screen.
            </p>
          </div>
        </section>
      )}

      <div style={{ height: isFallback ? "0" : "40vh", background: "#0A0A0A" }} />

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
