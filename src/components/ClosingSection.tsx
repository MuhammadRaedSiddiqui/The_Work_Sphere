import { useEffect, useRef, useState } from "react";
import {
  CARD_ASPECT,
  CARD_COUNT,
  CARD_FILL_COLOR,
  CLOSING_BODY_REVEAL_DELAY_MS,
  CLOSING_BODY_REVEAL_MS,
  CLOSING_BODY_REVEAL_TRANSLATE_Y_PX,
  CLOSING_BORDER_REVEAL_DELAY_MS,
  CLOSING_BORDER_REVEAL_MS,
  CLOSING_CARD_MAX_VIEWPORT_WIDTH,
  CLOSING_CARD_MAX_WIDTH_PX,
  CLOSING_CARD_FLIP_MS,
  CLOSING_CARD_PADDING_MAX_PX,
  CLOSING_CARD_PADDING_MIN_PX,
  CLOSING_CARD_PADDING_VIEWPORT_WIDTH,
  CLOSING_COLOPHON_REVEAL_DELAY_MS,
  CLOSING_COLOPHON_REVEAL_MS,
  CLOSING_COPY_RESET_MS,
  CLOSING_PLACEHOLDER_FADE_MS,
  CLOSING_REVEALED_STROKE_OPACITY,
  CLOSING_REVEAL_DELAY_MS,
  CLOSING_REVEAL_THRESHOLD,
  COMING_SOON_IMAGE_SRC,
  CONNECTOR_SEGMENT_COUNT,
  DISPLAY_FONT_FAMILY,
  IDLE_STROKE_OPACITY,
  LABEL_FONT_FAMILY,
  RING_TABLE,
} from "../constants";

const EMAIL = "raedsiddiquie4@gmail.com";
const GITHUB_URL = "https://github.com/MuhammadRaedSiddiqui";
const AVAILABILITY = "Available for collaborations and contract work";
const mono = LABEL_FONT_FAMILY;
const grotesk = DISPLAY_FONT_FAMILY;

export default function ClosingSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const hasRevealed = useRef(false);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [revealed, setRevealed] = useState(reduceMotion);
  const [copied, setCopied] = useState(false);
  const [flipped, setFlipped] = useState(false);

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
      // The mailto link alongside this control remains the reliable fallback.
    }
  };

  return (
    <section
      ref={sectionRef}
      id="close"
      className={`closing-section${revealed ? " is-revealed" : ""}${reduceMotion ? " reduce-motion" : ""}`}
      aria-labelledby="closing-heading"
    >
      <div className="closing-card-shell">
        <div className={`closing-card${flipped ? " is-flipped" : ""}`}>
          <button
            type="button"
            className="closing-flip-button"
            aria-label={flipped ? "Show closing card front" : "Flip closing card"}
            aria-pressed={flipped}
            onClick={() => setFlipped((previous) => !previous)}
          />
          <div className="closing-card-flipper">
            <div className="closing-card-face closing-card-front">
            <div className="closing-placeholder" aria-hidden="true">
              <span>slot 49&nbsp;&nbsp;unassigned</span>
            </div>
            <div className="closing-body">
              <p className="closing-index">03 — Contact&nbsp;&nbsp;49 / 48</p>
              <h2 id="closing-heading">Looking for the next hard problem</h2>
              <p className="closing-support">Let’s make something durable.</p>
              <div className="closing-rule" />
              <p className="closing-availability"><span aria-hidden="true">◌</span>{AVAILABILITY}</p>
              <div className="closing-contact">
                <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
                <button type="button" onClick={copyEmail} aria-label={copied ? "Email address copied" : "Copy email address"}>
                  <span aria-live="polite">{copied ? "copied" : "copy"}</span>
                </button>
                <a href={GITHUB_URL} target="_blank" rel="noreferrer">GitHub ↗</a>
              </div>
            </div>
            </div>
            <div className="closing-card-face closing-card-back" aria-hidden="true">
              <span>slot 49&nbsp;&nbsp;unassigned</span>
            </div>
          </div>
        </div>
      </div>
      <footer className="closing-colophon">
        <p>{CARD_COUNT} cards&nbsp;&nbsp;{RING_TABLE.length} rings&nbsp;&nbsp;{CONNECTOR_SEGMENT_COUNT} connector segments</p>
        <p>TypeScript&nbsp;&nbsp;Python&nbsp;&nbsp;Rust&nbsp;&nbsp;Go</p>
      </footer>
      <style>{closingStyles}</style>
    </section>
  );
}

const closingStyles = `
  .closing-section { min-height:100vh; box-sizing:border-box; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:20px; padding:48px 20px; background:#000; color:#ededf0; }
  .closing-card-shell { width:min(${CLOSING_CARD_MAX_WIDTH_PX}px, ${CLOSING_CARD_MAX_VIEWPORT_WIDTH}vw); aspect-ratio:${CARD_ASPECT}; perspective:1100px; }.closing-card { position:relative; width:100%; height:100%; overflow:hidden; box-sizing:border-box; background:#${CARD_FILL_COLOR.toString(16).padStart(6, "0")}; border:1px solid rgba(255,255,255,${IDLE_STROKE_OPACITY}); transform-style:preserve-3d; transition:border-color ${CLOSING_BORDER_REVEAL_MS}ms ease ${CLOSING_BORDER_REVEAL_DELAY_MS}ms, transform ${CLOSING_CARD_FLIP_MS}ms cubic-bezier(.2,.8,.2,1); }.closing-card.is-flipped { transform:rotateY(180deg); }
  .closing-card-flipper { position:absolute; z-index:2; inset:0; pointer-events:none; transform-style:preserve-3d; }.closing-card-face { position:absolute; inset:0; backface-visibility:hidden; -webkit-backface-visibility:hidden; }.closing-card-back { display:flex; align-items:flex-end; box-sizing:border-box; padding:clamp(${CLOSING_CARD_PADDING_MIN_PX}px, ${CLOSING_CARD_PADDING_VIEWPORT_WIDTH}vw, ${CLOSING_CARD_PADDING_MAX_PX}px); background:linear-gradient(to top, rgba(0,0,0,.5), rgba(0,0,0,.03) 45%), url(${COMING_SOON_IMAGE_SRC}) center/cover no-repeat; color:rgba(255,255,255,.66); font:11px ${mono}; letter-spacing:.08em; text-transform:uppercase; transform:rotateY(180deg); }
  .closing-flip-button { position:absolute; z-index:1; inset:0; width:100%; height:100%; border:0; padding:0; background:transparent; cursor:pointer; backface-visibility:hidden; -webkit-backface-visibility:hidden; }.closing-flip-button:focus-visible { outline:2px solid #ededf0; outline-offset:-4px; }
  .closing-placeholder { position:absolute; inset:0; display:flex; align-items:flex-end; padding:clamp(${CLOSING_CARD_PADDING_MIN_PX}px, ${CLOSING_CARD_PADDING_VIEWPORT_WIDTH}vw, ${CLOSING_CARD_PADDING_MAX_PX}px); box-sizing:border-box; background:linear-gradient(to top, rgba(0,0,0,.5), rgba(0,0,0,.03) 45%), url(${COMING_SOON_IMAGE_SRC}) center/cover no-repeat; color:rgba(255,255,255,.66); font:11px ${mono}; letter-spacing:.08em; text-transform:uppercase; opacity:1; transition:opacity ${CLOSING_PLACEHOLDER_FADE_MS}ms ease; }
  .closing-body { position:relative; z-index:2; display:flex; height:100%; box-sizing:border-box; flex-direction:column; justify-content:center; padding:clamp(${CLOSING_CARD_PADDING_MIN_PX}px, ${CLOSING_CARD_PADDING_VIEWPORT_WIDTH}vw, ${CLOSING_CARD_PADDING_MAX_PX}px); opacity:0; pointer-events:none; transform:translateY(${CLOSING_BODY_REVEAL_TRANSLATE_Y_PX}px); transition:opacity ${CLOSING_BODY_REVEAL_MS}ms ease ${CLOSING_BODY_REVEAL_DELAY_MS}ms, transform ${CLOSING_BODY_REVEAL_MS}ms ease ${CLOSING_BODY_REVEAL_DELAY_MS}ms; }
  .closing-index { margin:0 0 14px; color:rgba(255,255,255,.48); font:11px ${mono}; letter-spacing:.08em; }
  .closing-body h2 { max-width:420px; margin:0; font:700 clamp(25px, 3.3vw, 38px)/1.03 ${grotesk}; letter-spacing:-.045em; }
  .closing-support { max-width:390px; margin:14px 0 0; color:rgba(255,255,255,.62); font:14px/1.45 ${grotesk}; }
  .closing-rule { height:1px; margin:clamp(18px, 3vw, 28px) 0 14px; background:rgba(255,255,255,.16); }
  .closing-availability { display:flex; align-items:center; gap:7px; margin:0; color:rgba(255,255,255,.8); font:11px ${mono}; }.closing-availability span { font-size:16px; line-height:1; animation:closing-pulse 1.6s ease-in-out infinite; } @keyframes closing-pulse { 50% { opacity:.35; } }
  .closing-contact { display:flex; align-items:center; flex-wrap:wrap; gap:10px; margin-top:14px; pointer-events:auto; font:11px ${mono}; }.closing-contact a { color:#ededf0; text-decoration:none; }.closing-contact a:hover { text-decoration:underline; text-underline-offset:3px; }.closing-contact button { appearance:none; border:1px solid rgba(255,255,255,.2); padding:4px 7px; background:transparent; color:rgba(255,255,255,.76); font:inherit; cursor:pointer; }
  .closing-colophon { width:min(${CLOSING_CARD_MAX_WIDTH_PX}px, ${CLOSING_CARD_MAX_VIEWPORT_WIDTH}vw); color:rgba(255,255,255,.42); font:11px/1.55 ${mono}; letter-spacing:.025em; opacity:0; transition:opacity ${CLOSING_COLOPHON_REVEAL_MS}ms ease ${CLOSING_COLOPHON_REVEAL_DELAY_MS}ms; }.closing-colophon p { margin:0; }
  .closing-section.is-revealed .closing-placeholder { opacity:0; }.closing-section.is-revealed .closing-body { opacity:1; transform:translateY(0); }.closing-section.is-revealed .closing-card { border-color:rgba(255,255,255,${CLOSING_REVEALED_STROKE_OPACITY}); }.closing-section.is-revealed .closing-colophon { opacity:1; }
  .closing-section.reduce-motion .closing-placeholder { display:none; }.closing-section.reduce-motion .closing-body,.closing-section.reduce-motion .closing-colophon { opacity:1; transform:none; transition:none; }.closing-section.reduce-motion .closing-card { border-color:rgba(255,255,255,.62); transition:none; }.closing-section.reduce-motion .closing-availability span { animation:none; }
  @media (max-width:520px) { .closing-section { padding:36px 16px; }.closing-index { margin-bottom:8px; }.closing-body h2 { font-size:clamp(21px, 7.4vw, 28px); }.closing-support { margin-top:8px; font-size:11px; }.closing-rule { margin:12px 0 9px; }.closing-availability,.closing-contact { font-size:10px; }.closing-contact { gap:8px; margin-top:9px; } }
`;
