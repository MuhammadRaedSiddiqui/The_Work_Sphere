import { useEffect, useRef, useState } from "react";
import { CONTROL_PILL_RADIUS_PX, DISPLAY_FONT_FAMILY, LABEL_FONT_FAMILY } from "../constants";
import { PHOTO_ALT, PHOTO_FINAL_SRC } from "../constants";

/**
 * Fallback About — closing-pass rebuild (spec §15 final).
 * Mirrors the primary WebGL wall exactly: photo right, text left desktop;
 * single-column photo first (top) on mobile. Same source content as the wall
 * (one content source, two layouts — this is a CSS restyle, not new markup).
 * Includes eyebrow "01 — THE PRACTICE" top left, no tag line. Contact is small
 * underlined text beneath the bio. All zone roots are padding:0, borderRadius:0,
 * flush with no container chrome. Photo is single normal BW PNG, not mosaic,
 * used as PNG, never converted to JPG, with descriptive alt text.
 */
export default function FallbackAbout() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [photoOk, setPhotoOk] = useState(true);

  useEffect(() => {
    if (photoOk) return;
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const w = 900, h = 1200;
    c.width = w; c.height = h;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,60,60,0.95)";
    ctx.font = "700 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("PORTRAIT LOAD FAILED", w / 2, h / 2 - 8);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "500 11px system-ui, sans-serif";
    ctx.fillText("about-portrait.png", w / 2, h / 2 + 12);
    ctx.strokeStyle = "rgba(255,60,60,0.3)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(12, 12, w - 24, h - 24);
  }, [photoOk]);

  return (
    <section
      aria-label="About"
      style={{
        background: "#000",
        color: "rgba(255,255,255,0.9)",
        padding: 0,
        minHeight: "100vh",
        display: "flex",
        alignItems: "stretch",
      }}
    >
      <style>{`
        .fb-outer { max-width: none; width: 100%; margin: 0; padding: 0; }
        .fb-grid { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 24px; align-items: stretch; min-height: 100vh; }
        @media (max-width: 760px) {
          .fb-grid { grid-template-columns: 1fr; min-height: auto; }
          .fb-photo { order: -1; min-height: 60vh; }
          .fb-text { order: 0; padding: 24px 20px !important; }
        }
        .fb-photo {
          padding: 0;
          border-radius: 0;
          overflow: hidden;
          background: transparent;
          line-height: 0;
          min-height: 100vh;
        }
        .fb-photo canvas, .fb-photo img {
          width: 100%;
          height: 100%;
          min-height: 100vh;
          display: block;
          padding: 0;
          border-radius: 0;
          object-fit: cover;
        }
        .fb-text {
          padding: 48px 32px 48px 40px;
          border-radius: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
      `}</style>

      <div className="fb-outer">
        <div className="fb-grid">
          {/* Text stack — same content as the WebGL wall, left per spec §5 mirror */}
          <div className="fb-text" style={{ minWidth: 0 }}>
            <div
              style={{
                color: "rgba(255,255,255,0.52)",
                fontFamily: LABEL_FONT_FAMILY,
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.14em",
                marginLeft: "2.2rem",
                textTransform: "uppercase",
                marginBottom: 12,
              }}
            >
              01 — THE PRACTICE
            </div>
            <h2
              style={{
                margin: 0,
                color: "rgba(255,255,255,0.96)",
                fontFamily: DISPLAY_FONT_FAMILY,
                fontSize: "clamp(56px, 6.5vw, 84px)",
                fontWeight: 700,
                lineHeight: 0.92,
                letterSpacing: "-0.04em",
                textWrap: "balance",
              }}
            >
              <span style={{ display: "block" }}>Engineering</span>
              <span style={{ display: "block" }}>at the edge of</span>
              <span style={{ display: "block" }}>AI and</span>
              <span style={{ display: "inline-block", background: "linear-gradient(90deg, #8A8A8A 0%, #D4D4D4 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", color: "transparent", fontWeight: 700 }}>Automation.</span>
            </h2>
            <p
              style={{
                margin: "2px 0 0",
                color: "rgba(255,255,255,0.58)",
                fontFamily: DISPLAY_FONT_FAMILY,
                fontSize: 17,
                lineHeight: 1.35,
                letterSpacing: "0.01em",
              }}
            >
              I build autonomous agents and scalable platforms<br />that replace manual overhead with intelligent code.
            </p>
            <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 8 }}>
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

          {/* Photo — single normal BW PNG, right per spec §5 mirror, no border/radius */}
          <div className="fb-photo">
            {photoOk ? (
              <img
                src={PHOTO_FINAL_SRC}
                alt={PHOTO_ALT}
                loading="lazy"
                decoding="async"
                onError={() => setPhotoOk(false)}
                style={{
                  width: "100%",
                  height: "auto",
                  display: "block",
                  padding: 0,
                  borderRadius: 0,
                  objectFit: "cover",
                  // File is PNG BW — used as PNG, never converted to JPG. No live filter.
                }}
              />
            ) : (
              <canvas
                ref={canvasRef}
                width={900}
                height={1200}
                aria-label={PHOTO_ALT}
                style={{ padding: 0, borderRadius: 0 }}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
