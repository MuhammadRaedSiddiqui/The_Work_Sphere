import { useEffect, useRef, useCallback, useState } from "react";
import gsap from "gsap";
import type { Project } from "../types";

type Props = {
  project: Project;
  index: number; // 0-based within filtered list
  total: number;
  origin: { x: number; y: number } | null; // card screen pos for FLIP
  allProjects: Project[]; // filtered list for next teaser
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
};

export default function ExpandedPanel({ project, index, total, origin, allProjects, onClose, onNext, onPrev }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const animatingRef = useRef(false);
  const accumRef = useRef(0);
  const accumTimerRef = useRef<number | null>(null);
  const [heroImgError, setHeroImgError] = useState(false);
  useEffect(() => setHeroImgError(false), [project.id, project.heroImage]);

  // Entrance: re-center + blur beat then zoom to fullscreen with p-8 (§9)
  useEffect(() => {
    const overlay = overlayRef.current;
    const panel = panelRef.current;
    if (!overlay || !panel) return;

    // Blur is handled by parent via CSS on the canvas container; here we animate panel
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const isMobile = vw < 768;
    const inset = isMobile ? 16 : 32; // p-8 desktop, p-4 mobile

    // Start rect: card screen pos or center fallback. Approximate card screen size
    // derived from world card 2.2×1.467 projected at ~7 units distance ~ small.
    // We use a fixed 220×147 placeholder; the FLIP read is the position, not exact size.
    const startW = 220;
    const startH = 147;
    const startX = origin ? origin.x - startW / 2 : vw / 2 - startW / 2;
    const startY = origin ? origin.y - startH / 2 : vh / 2 - startH / 2;

    // Set initial FLIP state
    gsap.set(panel, {
      left: startX,
      top: startY,
      width: startW,
      height: startH,
      opacity: 0,
      scale: 0.96,
    });
    gsap.set(overlay, { backgroundColor: "rgba(10,10,10,0)" });

    const tl = gsap.timeline();
    // Phase 1: re-center (card flies to center) + blur already on canvas
    tl.to(panel, {
      left: vw / 2 - startW / 2,
      top: vh / 2 - startH / 2,
      opacity: 1,
      scale: 1,
      duration: 0.38,
      ease: "expo.out",
    });
    // Phase 2: zoom to fullscreen with p-8
    tl.to(panel, {
      left: inset,
      top: inset,
      width: vw - inset * 2,
      height: vh - inset * 2,
      duration: 0.52,
      ease: "expo.out",
    }, "-=0.08");
    tl.to(overlay, { backgroundColor: "rgba(10,10,10,0.32)", duration: 0.45 }, 0);

    // Content fade in after zoom lands
    if (scrollRef.current) gsap.fromTo(scrollRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3, delay: 0.55 });

    return () => {
      tl.kill();
    };
  }, [origin]);

  // Close animation reversed
  const animateClose = useCallback(
    (cb: () => void) => {
      if (animatingRef.current) return;
      animatingRef.current = true;
      const panel = panelRef.current;
      const overlay = overlayRef.current;
      if (!panel || !overlay) {
        cb();
        return;
      }
      const vw = window.innerWidth;
      const isMobile = vw < 768;
      const inset = isMobile ? 16 : 32;
      // Reverse zoom: shrink back toward origin or center
      const targetW = 220;
      const targetH = 147;
      const targetX = origin ? origin.x - targetW / 2 : vw / 2 - targetW / 2;
      const targetY = origin ? origin.y - targetH / 2 : vw / 2 - targetH / 2;

      const tl = gsap.timeline({ onComplete: () => { animatingRef.current = false; cb(); } });
      if (scrollRef.current) tl.to(scrollRef.current, { opacity: 0, duration: 0.18 }, 0);
      tl.to(overlay, { backgroundColor: "rgba(10,10,10,0)", duration: 0.32 }, 0);
      // Zoom back to center first, then to origin
      tl.to(panel, {
        left: inset,
        top: inset,
        width: vw - targetW,
        // keep height full until shrink
        duration: 0,
      }, 0);
      tl.to(panel, {
        left: targetX,
        top: targetY,
        width: targetW,
        height: targetH,
        opacity: 0.2,
        scale: 0.96,
        duration: 0.42,
        ease: "expo.in",
      });
    },
    [origin]
  );

  const handleClose = useCallback(() => {
    animateClose(onClose);
  }, [animateClose, onClose]);

  // Project-to-project transition with threshold + overshoot + rubber-band (§11)
  const triggerNext = useCallback(() => {
    if (animatingRef.current) return;
    if (index >= total - 1) {
      // Rubber-band at last (§11)
      const panel = panelRef.current;
      if (!panel) return;
      animatingRef.current = true;
      gsap.timeline({ onComplete: () => (animatingRef.current = false) })
        .to(panel, { x: -18, duration: 0.14, ease: "power2.out" })
        .to(panel, { x: 0, duration: 0.32, ease: "elastic.out(1, 0.5)" });
      return;
    }
    animatingRef.current = true;
    const panel = panelRef.current;
    if (!panel) { onNext(); animatingRef.current = false; return; }
    const tl = gsap.timeline({
      onComplete: () => {
        onNext();
        // After React swaps project, do overshoot settle
        requestAnimationFrame(() => {
          const p = panelRef.current;
          if (!p) { animatingRef.current = false; return; }
          gsap.set(p, { x: 30 });
          gsap.to(p, { x: 0, duration: 0.5, ease: "back.out(1.4)", onComplete: () => (animatingRef.current = false) });
          if (scrollRef.current) scrollRef.current.scrollTop = 0;
        });
      },
    });
    tl.to(panel, { x: -14, duration: 0.12, ease: "power2.in" }).to(panel, { x: -40, opacity: 0.85, duration: 0.18, ease: "power2.in" }, "-=0.04");
  }, [index, total, onNext]);

  const triggerPrev = useCallback(() => {
    if (animatingRef.current) return;
    if (index <= 0) {
      const panel = panelRef.current;
      if (!panel) return;
      animatingRef.current = true;
      gsap.timeline({ onComplete: () => (animatingRef.current = false) })
        .to(panel, { x: 18, duration: 0.14, ease: "power2.out" })
        .to(panel, { x: 0, duration: 0.32, ease: "elastic.out(1, 0.5)" });
      return;
    }
    animatingRef.current = true;
    const panel = panelRef.current;
    if (!panel) { onPrev(); animatingRef.current = false; return; }
    const tl = gsap.timeline({
      onComplete: () => {
        onPrev();
        requestAnimationFrame(() => {
          const p = panelRef.current;
          if (!p) { animatingRef.current = false; return; }
          gsap.set(p, { x: -30 });
          gsap.to(p, { x: 0, duration: 0.5, ease: "back.out(1.4)", onComplete: () => (animatingRef.current = false) });
          if (scrollRef.current) scrollRef.current.scrollTop = 0;
        });
      },
    });
    tl.to(panel, { x: 14, duration: 0.12, ease: "power2.in" }).to(panel, { x: 40, opacity: 0.85, duration: 0.18, ease: "power2.in" }, "-=0.04");
  }, [index, total, onPrev]);

  // Wheel handler with threshold + scroll decoupling (§11)
  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      if (animatingRef.current) {
        e.preventDefault();
        return;
      }
      const el = scrollRef.current;
      if (!el) return;
      const atTop = el.scrollTop <= 1;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
      const delta = e.deltaY;

      // If inner content can still scroll in this direction, let it scroll
      if ((delta < 0 && !atTop) || (delta > 0 && !atBottom)) {
        // Reset carousel accumulator when scrolling content
        accumRef.current = 0;
        return;
      }

      // Accumulate for carousel navigation
      accumRef.current += delta;
      if (accumTimerRef.current) window.clearTimeout(accumTimerRef.current);
      accumTimerRef.current = window.setTimeout(() => (accumRef.current = 0), 180);

      const THRESHOLD = 55;
      if (Math.abs(accumRef.current) < THRESHOLD) {
        // Prevent page scroll while we are accumulating at the edge
        if (atTop || atBottom) e.preventDefault();
        return;
      }
      e.preventDefault();
      const dir = accumRef.current > 0 ? 1 : -1;
      accumRef.current = 0;
      if (dir > 0) triggerNext();
      else triggerPrev();
    },
    [triggerNext, triggerPrev]
  );

  // Keyboard: Escape close, arrow navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        if (!animatingRef.current) { e.preventDefault(); triggerNext(); }
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        if (!animatingRef.current) { e.preventDefault(); triggerPrev(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleClose, triggerNext, triggerPrev]);

  const nextProject = allProjects[(index + 1) % total];
  const hasNext = index < total - 1;

  return (
    <div
      ref={overlayRef}
      onWheel={onWheel}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(10,10,10,0.32)",
        // p-8 padding is the panel's inset; overlay itself is full-screen
        padding: 0,
        display: "flex",
        alignItems: "stretch",
        justifyContent: "stretch",
      }}
      // clicking the dimmed backdrop behind the panel closes
      onClick={(e) => {
        if (e.target === overlayRef.current) handleClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={project.title}
        style={{
          position: "fixed",
          background: "#141417",
          color: "#EDEDF0",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 24px 64px rgba(0,0,0,0.6), 0 2px 12px rgba(0,0,0,0.4)",
        }}
      >
        {/* Fixed header (does not scroll) §10.1 */}
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 18px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            background: "rgba(20,20,23,0.96)",
            backdropFilter: "blur(8px)",
            position: "sticky",
            top: 0,
            zIndex: 1,
          }}
        >
          <span style={{ fontFamily: "system-ui, sans-serif", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)" }}>
            {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>
          <button
            onClick={handleClose}
            aria-label="Close"
            style={{
              appearance: "none",
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.85)",
              borderRadius: 999,
              padding: "6px 12px",
              fontSize: 12,
              letterSpacing: "0.04em",
              cursor: "pointer",
            }}
          >
            Close ✕
          </button>
        </div>

        {/* Scrollable body — hidden scrollbar §9 */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: "auto",
            overscrollBehavior: "contain",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
          className="expand-scroll"
        >
          {/* Hero image — Phase 7: real heroImage with procedural fallback */}
          <div style={{ width: "100%", aspectRatio: "16 / 9", background: "#0A0A0A", overflow: "hidden", position: "relative" }}>
            {!heroImgError ? (
              <img
                src={project.heroImage}
                alt={project.title}
                loading="eager"
                onError={() => setHeroImgError(true)}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  background: `linear-gradient(135deg, hsl(${hueFor(project.id)},30%,18%) 0%, hsl(${(hueFor(project.id)+40)%360},22%,10%) 100%)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "rgba(255,255,255,0.18)",
                  fontFamily: "system-ui, sans-serif",
                  fontSize: 48,
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                }}
              >
                {project.title.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>

          <div style={{ padding: isMobile() ? "22px 18px 0" : "28px 28px 0" }}>
            {/* Title + meta row §10.3 */}
            <h2 style={{ margin: 0, fontFamily: "system-ui, sans-serif", fontSize: isMobile() ? 26 : 30, fontWeight: 700, letterSpacing: "-0.02em", color: "#F5F5F7", lineHeight: 1.1 }}>
              {project.title}
            </h2>
            <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: "8px 14px", alignItems: "center", fontFamily: "system-ui, sans-serif", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
              {project.year && <span>{project.year}</span>}
              {project.role && <span>· {project.role}</span>}
              <span style={{ textTransform: "uppercase", letterSpacing: "0.06em", padding: "2px 7px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.62)" }}>
                {project.status}
              </span>
              {project.techStack && (
                <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {project.techStack.map((t) => (
                    <span key={t} style={{ padding: "2px 7px", borderRadius: 999, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      {t}
                    </span>
                  ))}
                </span>
              )}
            </div>

            {/* Summary §10.4 */}
            {project.summary && (
              <p style={{ marginTop: 14, marginBottom: 0, fontFamily: "system-ui, sans-serif", fontSize: 14, lineHeight: 1.6, color: "rgba(255,255,255,0.72)" }}>
                {project.summary}
              </p>
            )}

            {/* Case-study body §10.5 */}
            {project.content && (
              <div style={{ marginTop: 20, fontFamily: "system-ui, sans-serif", fontSize: 14, lineHeight: 1.75, color: "rgba(255,255,255,0.78)" }}>
                {project.content.split("\n").map((para, i) => (
                  <p key={i} style={{ margin: i === 0 ? 0 : "14px 0 0" }}>
                    {para}
                  </p>
                ))}
              </div>
            )}

            {/* Gallery §10.6 */}
            {project.gallery && project.gallery.length > 0 && (
              <div style={{ marginTop: 24, display: "grid", gap: 12 }}>
                {project.gallery.map((src, i) => (
                  <div key={i} style={{ width: "100%", aspectRatio: "16/10", background: "#0A0A0A", borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                ))}
              </div>
            )}

            {/* Links row §10.7 */}
            {project.links && (project.links.live || project.links.repo) && (
              <div style={{ marginTop: 22, display: "flex", gap: 10, flexWrap: "wrap" }}>
                {project.links.live && (
                  <a href={project.links.live} target="_blank" rel="noreferrer" style={linkStyle}>
                    View live →
                  </a>
                )}
                {project.links.repo && (
                  <a href={project.links.repo} target="_blank" rel="noreferrer" style={linkStyle}>
                    View source →
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Next-project teaser §10.8 — affordance for scroll-to-next */}
          <div
            onClick={() => { if (hasNext) triggerNext(); }}
            style={{
              marginTop: 28,
              marginLeft: isMobile() ? 18 : 28,
              marginRight: isMobile() ? 18 : 28,
              marginBottom: 28,
              padding: 14,
              borderRadius: 12,
              background: hasNext ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.08)",
              display: "flex",
              alignItems: "center",
              gap: 12,
              cursor: hasNext ? "pointer" : "default",
              opacity: hasNext ? 1 : 0.55,
            }}
          >
            <div style={{ width: 56, height: 36, borderRadius: 8, background: hasNext ? `hsl(${hueFor(nextProject.id)},28%,16%)` : "rgba(255,255,255,0.06)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>
              {hasNext ? nextProject.title.slice(0, 2).toUpperCase() : "—"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>
                {hasNext ? "Next project" : "End of projects"}
              </div>
              <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.82)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {hasNext ? nextProject.title : "You’ve reached the end — scroll up or close"}
              </div>
            </div>
            {hasNext && <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 14 }}>→</span>}
          </div>
        </div>
      </div>

      <style>{`.expand-scroll::-webkit-scrollbar{display:none}`}</style>
    </div>
  );
}

function isMobile() {
  return typeof window !== "undefined" ? window.innerWidth < 768 : false;
}

function hueFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}

const linkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 14px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.04)",
  color: "rgba(255,255,255,0.82)",
  fontFamily: "system-ui, sans-serif",
  fontSize: 13,
  textDecoration: "none",
};
