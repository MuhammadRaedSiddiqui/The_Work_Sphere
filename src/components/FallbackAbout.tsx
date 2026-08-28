import { useEffect, useRef, useState } from "react";

/**
 * Fallback About — Phase 6 (§15) + Phase 7 polishing + editorial v2.
 * When any gate fails we never create the pin/ScrollTrigger. Hero keeps its
 * natural dvh height and this conventional layout is shown instead of the
 * pinned wall. Content is the same as the WebGL wall — eyebrow, headline
 * (dominant with dimmed trailing word), one-liner bio, tagline, two buttons —
 * restyled with normal CSS rather than projected coordinates. Photo is a single
 * normal image, not a 2×4 mosaic, desaturated flat grey (static-asset
 * recommendation: pre-process to PNG; runtime CSS grayscale is the live fallback).
 * Layout mirrors the wall: desktop text left / photo right (editorial §5), mobile
 * single-column photo first (top). Same dark theme.
 */
export default function FallbackAbout() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [photoOk, setPhotoOk] = useState(true);

  // Render the same desaturated studio portrait as a single image — fallback when real photo fails.
  // Canvas fallback draws a portrait 3:4 placeholder (matches 2×4 column aspect 0.75).
  useEffect(() => {
    if (photoOk) return;
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const w = 900, h = 1200;
    c.width = w; c.height = h;
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#2b2e48");
    g.addColorStop(0.45, "#4a5a78");
    g.addColorStop(1, "#1a1d2e");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.beginPath(); ctx.ellipse(w/2, h/2, 220, 300, 0, 0, Math.PI * 2); ctx.fill();
    // Desaturate hint
    ctx.filter = "grayscale(1)";
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.font = "600 24px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("STUDIO PORTRAIT", w/2, h/2 + 10);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = "500 12px system-ui, sans-serif";
    ctx.fillText("photo · fallback single image · 3:4 desaturated", w/2, h/2 + 35);
  }, [photoOk]);

  return (
    <section
      aria-label="About"
      style={{
        background: "#0A0A0A",
        color: "rgba(255,255,255,0.9)",
        padding: "56px 20px 64px",
      }}
    >
      <style>{`
        .fb-outer { max-width: 1100px; margin: 0 auto; }
        .fb-grid { display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 36px; align-items: start; }
        @media (max-width: 760px) {
          .fb-grid { grid-template-columns: 1fr; }
          .fb-photo { order: -1; }
          .fb-text { order: 0; }
        }
        .fb-photo {
          border-radius: 10px;
          overflow: hidden;
          background: #11131a;
          border: 1px solid rgba(255,255,255,0.08);
          line-height: 0;
        }
        .fb-photo canvas, .fb-photo img { width: 100%; height: auto; display: block; }
        .fb-photo img { filter: grayscale(1) contrast(1.08) brightness(1.03); }
      `}</style>

      <div className="fb-outer">
        <div className="fb-grid">
          {/* Text stack — same content as the pinned wall (§5), now LEFT per editorial mirror */}
          <div className="fb-text" style={{ minWidth: 0, paddingTop: 4 }}>
            <div
              style={{
                color: "rgba(255,255,255,0.52)",
                fontFamily: "system-ui, sans-serif",
                fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase",
              }}
            >
              01 — THE PRACTICE
            </div>
            <h2
              style={{
                margin: "12px 0 0",
                color: "rgba(255,255,255,0.96)",
                fontFamily: "system-ui, sans-serif",
                fontSize: "clamp(28px, 4vw, 42px)",
                fontWeight: 560, lineHeight: 1.02, letterSpacing: "-0.04em",
                textWrap: "balance",
              }}
            >
              Engineering at the edge of AI and{" "}
              <span style={{ color: "rgba(255,255,255,0.28)", fontWeight: 500 }}>automation.</span>
            </h2>
            <p
              style={{
                margin: "14px 0 0",
                color: "rgba(255,255,255,0.58)",
                fontFamily: "system-ui, sans-serif",
                fontSize: 14, lineHeight: 1.55, letterSpacing: "0.01em",
              }}
            >
              I build autonomous agents and scalable platforms that replace manual overhead with intelligent code.
            </p>
            <div
              style={{
                marginTop: 16,
                color: "rgba(255,255,255,0.38)",
                fontFamily: "system-ui, sans-serif",
                fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase",
              }}
            >
              AI AGENTS · REACT · FASTAPI · SYSTEMS
            </div>
            {/* C1/C2 placement flagged OPEN in spec §5: quiet text beneath bio vs header nav.
                Fallback currently keeps pill buttons to preserve discoverability; if spec resolves
                to quiet text, restyle this row to small text links; if to header nav, hide here. */}
            <div style={{ marginTop: 22, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a
                href="mailto:raedsiddiquie4@gmail.com"
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  height: 36, padding: "0 18px", borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.92)",
                  fontFamily: "system-ui, sans-serif", fontSize: 13, fontWeight: 600, letterSpacing: "0.02em",
                  textDecoration: "none",
                }}
              >
                Email
              </a>
              <a
                href="#work"
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  height: 36, padding: "0 18px", borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "rgba(255,255,255,0.94)",
                  color: "#0A0A0A",
                  fontFamily: "system-ui, sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: "0.02em",
                  textDecoration: "none",
                }}
              >
                Index
              </a>
            </div>
          </div>

          {/* Photo — single normal image (not mosaic), now RIGHT per editorial mirror (text left) */}
          <div className="fb-photo">
            {photoOk ? (
              <img
                src="/img/about-featured.jpg"
                alt="Portrait of Raed Siddiqui — studio portrait in flat grey, looking directly at camera"
                loading="lazy"
                decoding="async"
                onError={() => setPhotoOk(false)}
                style={{ width: "100%", height: "auto", display: "block", aspectRatio: "3 / 4", objectFit: "cover" }}
              />
            ) : (
              <canvas ref={canvasRef} width={900} height={1200} aria-label="Portrait of Raed Siddiqui — studio portrait placeholder" />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
