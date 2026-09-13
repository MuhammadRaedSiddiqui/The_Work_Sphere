import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useCallback, useState } from "react";
import gsap from "gsap";
import { CARD_FILL_COLOR, IDLE_STROKE_OPACITY } from "../constants";
import { projects } from "../data/projects";
import type { Project } from "../types";

const CARD_FILL_CSS = `#${CARD_FILL_COLOR.toString(16).padStart(6, "0")}`;

export type ProjectPanelProps = {
  project: Project;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  showTeaser?: boolean;
  enterFrom?: DOMRect;
};

export type ProjectPanelHandle = {
  getPanelElement: () => HTMLDivElement | null;
  getScrollElement: () => HTMLDivElement | null;
};

const ProjectPanel = forwardRef<ProjectPanelHandle, ProjectPanelProps>(function ProjectPanel({ project, onClose, onNext, onPrev, showTeaser = true, enterFrom }, ref) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const animatingRef = useRef(false);
  const [heroImgError, setHeroImgError] = useState(false);
  const projectList = useMemo(() => projects.filter((item): item is Project => item !== null), []);
  const projectIndex = projectList.findIndex((item) => item.id === project.id);
  const total = projectList.length;
  const nextProject = projectIndex >= 0 ? projectList[projectIndex + 1] : undefined;
  const hasNext = Boolean(nextProject && onNext);
  useImperativeHandle(ref, () => ({
    getPanelElement: () => panelRef.current,
    getScrollElement: () => scrollRef.current,
  }), []);
  useEffect(() => setHeroImgError(false), [project.id, project.heroImage]);

  // Prefetch adjacent heroes on demand (§15: hero.jpg only on panel open, optionally adjacent §11)
  useEffect(() => {
    const prefetch = (id: string) => {
      const img = new Image();
      img.decoding = "async";
      img.src = `/img/projects/${id}/hero.jpg`;
    };
    if (projectIndex > 0) prefetch(projectList[projectIndex - 1].id);
    if (projectIndex >= 0 && projectIndex < projectList.length - 1) prefetch(projectList[projectIndex + 1].id);
  }, [project.id, projectIndex, projectList]);

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

    // Start from the caller-provided source rect; without one, fade in at final size.
    const startW = enterFrom?.width;
    const startH = enterFrom?.height;
    const startX = enterFrom?.left;
    const startY = enterFrom?.top;

    if (startW && startH && startX !== undefined && startY !== undefined) {
      gsap.set(panel, { left: startX, top: startY, width: startW, height: startH, opacity: 0, scale: 0.96 });
    } else {
      gsap.set(panel, { left: inset, top: inset, width: vw - inset * 2, height: vh - inset * 2, opacity: 0, scale: 0.96 });
    }
    gsap.set(overlay, { backgroundColor: "rgba(10,10,10,0)" });

    const tl = gsap.timeline();
    if (startW && startH) {
      tl.to(panel, { left: vw / 2 - startW / 2, top: vh / 2 - startH / 2, opacity: 1, scale: 1, duration: 0.38, ease: "expo.out" });
      tl.to(panel, { left: inset, top: inset, width: vw - inset * 2, height: vh - inset * 2, duration: 0.52, ease: "expo.out" }, "-=0.08");
    } else {
      tl.to(panel, { opacity: 1, scale: 1, duration: 0.3, ease: "expo.out" });
    }
    tl.to(overlay, { backgroundColor: "rgba(10,10,10,0.32)", duration: 0.45 }, 0);

    // Content fade in after zoom lands
    if (scrollRef.current) gsap.fromTo(scrollRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3, delay: 0.55 });

    return () => {
      tl.kill();
    };
  }, [enterFrom]);

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
      const targetW = enterFrom?.width;
      const targetH = enterFrom?.height;
      const targetX = enterFrom?.left;
      const targetY = enterFrom?.top;

      const tl = gsap.timeline({ onComplete: () => { animatingRef.current = false; cb(); } });
      if (scrollRef.current) tl.to(scrollRef.current, { opacity: 0, duration: 0.18 }, 0);
      tl.to(overlay, { backgroundColor: "rgba(10,10,10,0)", duration: 0.32 }, 0);
      if (targetW && targetH && targetX !== undefined && targetY !== undefined) {
        tl.to(panel, { left: inset, top: inset, width: vw - targetW, duration: 0 }, 0);
        tl.to(panel, { left: targetX, top: targetY, width: targetW, height: targetH, opacity: 0.2, scale: 0.96, duration: 0.42, ease: "expo.in" });
      } else {
        tl.to(panel, { opacity: 0, scale: 0.96, duration: 0.32, ease: "expo.in" });
      }
    },
    [enterFrom]
  );

  const handleClose = useCallback(() => {
    animateClose(onClose);
  }, [animateClose, onClose]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      handleClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [handleClose]);

  // Project-to-project transition with threshold + overshoot + rubber-band (§11)

  return (
    <div
      ref={overlayRef}
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
          <span style={{ fontFamily: "system-ui, sans-serif", fontSize: 14, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)" }}>
            {String(projectIndex + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {!showTeaser && onPrev && <button onClick={onPrev} aria-label="Previous project" style={panelArrowStyle}>←</button>}
          {!showTeaser && onNext && <button onClick={onNext} aria-label="Next project" style={panelArrowStyle}>→</button>}
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
              fontSize: 14,
              letterSpacing: "0.04em",
              cursor: "pointer",
            }}
          >
            Close ✕
          </button>
          </div>
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
          {/* Hero image — native aspect banner: hero.jpg is ~1.83:1 uncropped */}
          <div style={{ width: "100%", background: "#0A0A0A", overflow: "hidden" }}>
            {!heroImgError ? (
              <picture>
                <source srcSet={project.heroImage.replace(/\.jpg$/, ".avif")} type="image/avif" />
                <source srcSet={project.heroImage.replace(/\.jpg$/, ".webp")} type="image/webp" />
                <img
                  src={project.heroImage}
                  alt={project.title}
                  loading="eager"
                  decoding="async"
                  onError={() => setHeroImgError(true)}
                  style={{ width: "100%", height: "auto", display: "block" }}
                />
              </picture>
            ) : (
              <img
                src="/img/coming-soon.jpg"
                alt=""
                style={{ width: "100%", height: "auto", display: "block" }}
              />
            )}
          </div>

          <div style={{ padding: isMobile() ? "22px 18px 6px" : "28px 28px 28px" }}>
            {/* Title + meta row §10.3 */}
            <h2 style={{ margin: 0, fontFamily: "system-ui, sans-serif", fontSize: isMobile() ? 28 : 32, fontWeight: 700, letterSpacing: "-0.02em", color: "#F5F5F7", lineHeight: 1.1 }}>
              {project.title}
            </h2>
            <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: "8px 14px", alignItems: "center", fontFamily: "system-ui, sans-serif", fontSize: 14, color: "rgba(255,255,255,0.5)" }}>
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
              <p style={{ marginTop: 14, marginBottom: 0, fontFamily: "system-ui, sans-serif", fontSize: 16, lineHeight: 1.6, color: "rgba(255,255,255,0.72)" }}>
                {project.summary}
              </p>
            )}

            {/* Case-study body §10.5 */}
            {project.content && (
              <div style={{ marginTop: 20, fontFamily: "system-ui, sans-serif", fontSize: 16, lineHeight: 1.75, color: "rgba(255,255,255,0.78)" }}>
                {project.content.split("\n").map((raw, i) => {
                  const para = raw.trim();
                  if (!para) return null;
                  if (para.startsWith("## ")) {
                    return (
                      <h3 key={i} style={{ margin: i === 0 ? "0 0 8px" : "20px 0 8px", fontSize: 15, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.92)" }}>
                        {para.replace(/^##\s*/, "")}
                      </h3>
                    );
                  }
                  return (
                    <p key={i} style={{ margin: i === 0 ? 0 : "0 0 14px" }}>
                      {para}
                    </p>
                  );
                })}
              </div>
            )}

            {/* Gallery §10.6 — stacked full-width images at natural aspect, lazy */}
            {project.gallery && project.gallery.length > 0 && (
              <div style={{ marginTop: 24, display: "grid", gap: 12 }}>
                {project.gallery.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    style={{ width: "100%", height: "auto", display: "block", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", background: "#0A0A0A" }}
                  />
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
          {showTeaser && onNext && (
          <div
            onClick={() => { if (hasNext) onNext?.(); }}
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
            <div style={{ width: 56, height: 36, borderRadius: 8, background: CARD_FILL_CSS, border: `1px solid rgba(255,255,255,${IDLE_STROKE_OPACITY})`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>
              {hasNext ? nextProject!.title.slice(0, 2).toUpperCase() : "—"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>
                {hasNext ? "Next project" : "End of projects"}
              </div>
              <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.82)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {hasNext ? nextProject!.title : "You’ve reached the end — scroll up or close"}
              </div>
            </div>
            {hasNext && <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 16 }}>→</span>}
          </div>
          )}
        </div>
      </div>

      <style>{`.expand-scroll::-webkit-scrollbar{display:none}`}</style>
    </div>
  );
});

export default ProjectPanel;

function isMobile() {
  return typeof window !== "undefined" ? window.innerWidth < 768 : false;
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
  fontSize: 15,
  textDecoration: "none",
};

const panelArrowStyle: React.CSSProperties = {
  appearance: "none",
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "rgba(255,255,255,0.85)",
  borderRadius: 999,
  width: 30,
  height: 30,
  cursor: "pointer",
};
