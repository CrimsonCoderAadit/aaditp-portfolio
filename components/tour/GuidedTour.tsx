"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isDistrictMode, useSceneTransition } from "../scene/SceneTransition";
import { TOUR_STOPS, type TourPlace } from "./tourStops";
import { TOUR_SEEN_KEY } from "./tourKey";
import "./tour.css";

/** The guided tour: an optional walk from the room into each district. It owns
 * no camera of its own; each stop names a destination, and the tour issues the
 * one existing command (a viewpoint move, a district enter, hop or leave) that
 * brings the camera nearer to it, then waits for that transition to finish.
 * Stepping ahead or back mid-flight, or exiting, just changes the destination. */
export default function GuidedTour() {
  const { mode, section, viewpoint, viewpointMoving, goToViewpoint, enter, hop, leave, setTouring } = useSceneTransition();
  const [step, setStep] = useState(0);
  const [exiting, setExiting] = useState(false);
  const stop = TOUR_STOPS[step];
  const last = step === TOUR_STOPS.length - 1;
  const moving = viewpointMoving || mode.startsWith("entering-") || mode.startsWith("leaving-");

  // Exiting always returns to the City hero the visit began on.
  const target = useMemo<TourPlace | null>(() => exiting ? { viewpoint: "city" } : stop.place, [exiting, stop.place]);
  const arrived = !moving && (target === null
    || ("section" in target ? mode === target.section : mode === "workbench" && viewpoint === target.viewpoint));

  useEffect(() => {
    if (moving) return;
    if (exiting && arrived) { setTouring(false); return; }
    if (!target || arrived) return;
    if ("section" in target) {
      if (mode === "workbench") enter(target.section);
      else if (mode === section) hop(target.section);
    } else if (isDistrictMode(mode)) {
      if (mode === section) leave();
    } else if (mode === "workbench") {
      goToViewpoint(target.viewpoint);
    }
  }, [moving, exiting, arrived, target, mode, section, enter, hop, leave, goToViewpoint, setTouring]);

  const next = useCallback(() => { if (last) setExiting(true); else setStep((n) => Math.min(TOUR_STOPS.length - 1, n + 1)); }, [last]);
  const previous = useCallback(() => setStep((n) => Math.max(0, n - 1)), []);
  const exit = useCallback(() => setExiting(true), []);

  useEffect(() => {
    try { sessionStorage.setItem(TOUR_SEEN_KEY, "1"); } catch { /* storage unavailable: the prompt just stays emphasised */ }
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (exiting || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (event.key === "ArrowRight") next();
      else if (event.key === "ArrowLeft") previous();
      else if (event.key === "Escape") exit();
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exiting, next, previous, exit]);

  const nextButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { nextButton.current?.focus({ preventScroll: true }); }, []);

  return (
    <aside className="guided-tour" aria-label="Guided tour" data-exiting={exiting || undefined}>
      <div className="guided-tour-caption" data-moving={!arrived || undefined} aria-live="polite">
        <p className="guided-tour-count"><span>{String(step + 1).padStart(2, "0")}</span> / {String(TOUR_STOPS.length).padStart(2, "0")}</p>
        <h2 key={stop.id}>{stop.title}</h2>
        <p key={`${stop.id}-line`} className="guided-tour-line">{stop.line}</p>
      </div>
      <div className="guided-tour-progress" aria-hidden="true">
        {TOUR_STOPS.map((item, i) => <i key={item.id} data-state={i < step ? "past" : i === step ? "current" : undefined} />)}
      </div>
      <nav className="guided-tour-controls" aria-label="Tour controls">
        <button type="button" onClick={previous} disabled={step === 0 || exiting}><span aria-hidden="true">←</span> Previous</button>
        <button ref={nextButton} type="button" className="is-primary" onClick={next} disabled={exiting}>{last ? "Finish" : "Next"} <span aria-hidden="true">→</span></button>
        {!last && <button type="button" className="guided-tour-skip" onClick={exit} disabled={exiting}>Skip tour</button>}
      </nav>
    </aside>
  );
}
