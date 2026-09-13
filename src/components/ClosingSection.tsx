import { useEffect, useRef, useState } from "react";
import {
  CARD_COUNT,
  CLOSING_BODY_REVEAL_DELAY_MS,
  CLOSING_BODY_REVEAL_MS,
  CLOSING_BODY_REVEAL_TRANSLATE_Y_PX,
  CLOSING_COLOPHON_REVEAL_DELAY_MS,
  CLOSING_COLOPHON_REVEAL_MS,
  CLOSING_COPY_RESET_MS,
  CLOSING_MOTIF_RING_COUNT,
  CLOSING_REVEAL_DELAY_MS,
  CLOSING_REVEAL_THRESHOLD,
  CONNECTOR_LINE_OPACITY,
  CONNECTOR_SEGMENT_COUNT,
  CONTROL_PILL_RADIUS_PX,
  DISPLAY_FONT_FAMILY,
  LABEL_FONT_FAMILY,
  RING_TABLE,
} from "../constants";

const EMAIL = "raedsiddiquie4@gmail.com";
const GITHUB_URL = "https://github.com/MuhammadRaedSiddiqui";
const RESUME_URL = "https://www.linkedin.com/in/raedsiddiquie/";
const mono = LABEL_FONT_FAMILY;
const grotesk = DISPLAY_FONT_FAMILY;
const CLOSING_MOTIF_CENTER = 500;

function ClosingMotif() {
  return (
    <svg className="closing-motif" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g className="closing-motif-rings">
        {Array.from({ length: CLOSING_MOTIF_RING_COUNT }, (_, index) => (
          <circle key={index} cx={CLOSING_MOTIF_CENTER} cy={CLOSING_MOTIF_CENTER} r={36 + index * 14} />
        ))}
      </g>
      <path className="closing-motif-axis" d={`M 0 ${CLOSING_MOTIF_CENTER} H 1000 M ${CLOSING_MOTIF_CENTER} 0 V 1000`} />
    </svg>
  );
}

export default function ClosingSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const hasRevealed = useRef(false);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [revealed, setRevealed] = useState(reduceMotion);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (reduceMotion || !sectionRef.current) return;
    const element = sectionRef.current;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || entry.intersectionRatio < CLOSING_REVEAL_THRESHOLD || hasRevealed.current) return;
      hasRevealed.current = true;
      observer.disconnect();
      window.setTimeout(() => setRevealed(true), CLOSING_REVEAL_DELAY_MS);
    }, { threshold: CLOSING_REVEAL_THRESHOLD });
    observer.observe(element);
    return () => observer.disconnect();
  }, [reduceMotion]);

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(EMAIL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), CLOSING_COPY_RESET_MS);
    } catch {
      // The primary mailto link remains available when clipboard access is denied.
    }
  };

  return (
    <section
      ref={sectionRef}
      id="close"
      className={`closing-section${revealed ? " is-revealed" : ""}${reduceMotion ? " reduce-motion" : ""}`}
      aria-labelledby="closing-heading"
    >
      <ClosingMotif />
      <main className="closing-main">
        <div className="closing-content">
          <p className="closing-eyebrow">03 — The Close</p>
          <h2 id="closing-heading">Looking for the next hard problem</h2>
          <p className="closing-support">Let’s make something durable. Open to collaborations and contract work right now.</p>
          <div className="closing-actions">
            <div className="closing-primary-action">
              <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
              <button type="button" onClick={copyEmail} aria-label={copied ? "Email address copied" : "Copy email address"}>
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <rect x="5" y="5" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.25" />
                  <path d="M11 5V3.75A1.75 1.75 0 0 0 9.25 2H3.75A1.75 1.75 0 0 0 2 3.75v5.5C2 10.216 2.784 11 3.75 11H5" stroke="currentColor" strokeWidth="1.25" />
                </svg>
                <span className="closing-copy-status" aria-live="polite">{copied ? "Email address copied" : ""}</span>
              </button>
            </div>
            <a className="closing-secondary-action" href={GITHUB_URL} target="_blank" rel="noreferrer">GitHub ↗</a>
            <a className="closing-secondary-action" href={RESUME_URL} target="_blank" rel="noreferrer">Resume ↗</a>
          </div>
        </div>
      </main>
      <footer className="closing-footer">
        <p>{CARD_COUNT} cards&nbsp;&nbsp;{RING_TABLE.length} rings&nbsp;&nbsp;{CONNECTOR_SEGMENT_COUNT} connector segments</p>
        <p>TypeScript&nbsp;&nbsp;Python&nbsp;&nbsp;Rust&nbsp;&nbsp;Go</p>
      </footer>
      <style>{closingStyles}</style>
    </section>
  );
}

const closingStyles = `
  .closing-section { position:relative; isolation:isolate; min-height:100vh; box-sizing:border-box; display:flex; flex-direction:column; overflow:hidden; padding:32px 24px 28px; background:#000; color:#ededf0; }
  .closing-motif { position:absolute; z-index:0; inset:50% auto auto 50%; width:min(1080px, 112vw); height:min(1080px, 112vw); transform:translate(-50%,-50%); pointer-events:none; opacity:.72; }.closing-motif-rings circle,.closing-motif-axis { fill:none; stroke:rgba(255,255,255,${CONNECTOR_LINE_OPACITY}); stroke-width:1; }.closing-motif-rings circle:nth-child(-n+12) { stroke-opacity:.42; }.closing-motif-rings circle:nth-child(n+26) { stroke-opacity:.55; }.closing-motif-axis { stroke-opacity:.76; }
  .closing-main { position:relative; z-index:1; flex:1; display:grid; align-content:center; padding:54px 0 48px; }.closing-content { max-width:760px; opacity:0; transform:translateY(${CLOSING_BODY_REVEAL_TRANSLATE_Y_PX}px); transition:opacity ${CLOSING_BODY_REVEAL_MS}ms ease ${CLOSING_BODY_REVEAL_DELAY_MS}ms, transform ${CLOSING_BODY_REVEAL_MS}ms ease ${CLOSING_BODY_REVEAL_DELAY_MS}ms; }.closing-eyebrow { margin:0 0 16px; color:rgba(255,255,255,.45); font:600 12px ${mono}; letter-spacing:.14em; text-transform:uppercase; }.closing-content h2 { max-width:720px; margin:0; font:700 clamp(42px, 6.3vw, 84px)/.95 ${grotesk}; letter-spacing:-.055em; text-wrap:balance; }.closing-support { max-width:570px; margin:20px 0 0; color:rgba(255,255,255,.66); font:clamp(15px,1.5vw,18px)/1.42 ${grotesk}; letter-spacing:-.01em; }
  .closing-actions { display:flex; flex-wrap:wrap; align-items:center; gap:10px; margin-top:30px; font:500 14px ${mono}; }.closing-primary-action { display:inline-flex; align-items:stretch; min-height:42px; overflow:hidden; border-radius:${CONTROL_PILL_RADIUS_PX}px; background:#ededf0; color:#000; }.closing-primary-action a,.closing-primary-action button,.closing-secondary-action { display:inline-flex; align-items:center; justify-content:center; min-height:42px; box-sizing:border-box; border:1px solid transparent; border-radius:${CONTROL_PILL_RADIUS_PX}px; padding:0 16px; color:inherit; font:inherit; text-decoration:none; cursor:pointer; }.closing-primary-action a { padding-right:12px; }.closing-primary-action button { width:42px; border-left-color:rgba(0,0,0,.18); border-radius:0; padding:0; background:transparent; }.closing-copy-status { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); clip-path:inset(50%); white-space:nowrap; }.closing-secondary-action { border-color:rgba(255,255,255,.28); background:transparent; color:#ededf0; }.closing-primary-action a:hover,.closing-primary-action button:hover { background:rgba(0,0,0,.08); }.closing-secondary-action:hover { background:rgba(255,255,255,.08); }
  .closing-footer { position:relative; z-index:1; display:flex; justify-content:space-between; align-items:flex-end; gap:20px; padding-top:16px; border-top:1px solid rgba(255,255,255,.12); color:rgba(255,255,255,.48); font:11px/1.55 ${mono}; letter-spacing:.025em; opacity:0; transition:opacity ${CLOSING_COLOPHON_REVEAL_MS}ms ease ${CLOSING_COLOPHON_REVEAL_DELAY_MS}ms; }.closing-footer p { margin:0; }.closing-footer p:last-child { text-align:right; }
  .closing-section.is-revealed .closing-content,.closing-section.is-revealed .closing-footer { opacity:1; }.closing-section.is-revealed .closing-content { transform:translateY(0); }.closing-section.reduce-motion .closing-content,.closing-section.reduce-motion .closing-footer { opacity:1; transform:none; transition:none; }
  @media (max-width:720px) { .closing-section { min-height:100svh; padding:24px 16px 20px; }.closing-main { padding:42px 0; }.closing-content h2 { font-size:clamp(38px, 11vw, 58px); }.closing-support { margin-top:16px; }.closing-actions { margin-top:24px; }.closing-primary-action a { max-width:calc(100vw - 164px); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.closing-footer { align-items:flex-start; flex-direction:column; gap:4px; }.closing-footer p:last-child { text-align:left; }.closing-motif { width:150vw; height:150vw; opacity:.54; } }
`;
