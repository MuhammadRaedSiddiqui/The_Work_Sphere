import { useEffect, useRef, useState } from "react";

/**
 * Fallback About — Phase 6 (§15) + Phase 7 polishing.
 * When any gate fails we never create the pin/ScrollTrigger. Hero keeps its
 * natural dvh height and this conventional layout is shown instead of the
 * pinned wall. Content is the same as the WebGL wall — eyebrow, headline,
 * one-liner bio, tagline, two buttons — restyled with normal CSS rather than
 * projected coordinates. Photo is a single normal image, not a 2×3 mosaic.
 * Phase 7: real featured photo (square ≥1600²) with canvas fallback.
 */
export default function FallbackAbout() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [photoOk, setPhotoOk] = useState(true);

  // Render the same "studio portrait" motif as a single image (not mosaic) — fallback when real photo fails.
  useEffect(() => {
    if (photoOk) return;
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const w = 600, h = 600;
    c.width = w; c.height = h;
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#2b2e48");
    g.addColorStop(0.45, "#4a5a78");
    g.addColorStop(1, "#1a1d2e");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.beginPath(); ctx.ellipse(300, 300, 170, 220, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.font = "600 28px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("STUDIO PORTRAIT", 300, 310);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = "500 13px system-ui, sans-serif";
    ctx.fillText("photo · fallback single image", 300, 335);
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
        .fb-grid { display: grid; grid-template-columns: 1fr 1.15fr; gap: 36px; align-items: start; }
        @media (max-width: 760px) {
          .fb-grid { grid-template-columns: 1fr; }
        }
        .fb-photo {
          border-radius: 10px;
          overflow: hidden;
          background: #11131a;
          border: 1px solid rgba(255,255,255,0.08);
          line-height: 0;
        }
        .fb-photo canvas, .fb-photo img { width: 100%; height: auto; display: block; }
      `}</style>

      <div className="fb-outer">
        <div className="fb-grid">
          {/* Photo — single normal image (not mosaic), /img/about-featured.jpg */}
          <div className="fb-photo" aria-hidden="true">
            {photoOk ? (
              <img
                src="/img/about-featured.jpg"
                alt=""
                loading="lazy"
                onError={() => setPhotoOk(false)}
                style={{ width: "100%", height: "auto", display: "block", aspectRatio: "1 / 1", objectFit: "cover" }}
              />
            ) : (
              <canvas ref={canvasRef} width={600} height={600} />
            )}
          </div>

          {/* Text stack — same content as the pinned wall (§5), conventional stacking */}
          <div style={{ minWidth: 0, paddingTop: 4 }}>
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
                fontSize: "clamp(24px, 4vw, 34px)",
                fontWeight: 800, lineHeight: 1.05, letterSpacing: "-0.03em",
                textWrap: "balance",
              }}
            >
              Engineering at the edge of AI and automation.
            </h2>
            <p
              style={{
                margin: "14px 0 0",
                color: "rgba(255,255,255,0.72)",
                fontFamily: "system-ui, sans-serif",
                fontSize: 15, lineHeight: 1.55, letterSpacing: "0.01em",
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
        </div>
      </div>
    </section>
  );
}
