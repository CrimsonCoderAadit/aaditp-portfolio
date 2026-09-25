"use client";

import EscControl from "../EscControl";
import { lazy, Suspense, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ARCADE_LIBRARY, type ArcadeTitle } from "./games";
import type { GameDefinition } from "./types";
import { discover } from "../discovery";
import { useNowPlaying } from "../../audio/gameMode";
import "./arcade.css";

// The shared game stage arrives with the first game launched.
const GameFrame = lazy(() => import("./GameFrame"));

const DEV_KEY = "aadit-arcade-developer-mode";
const LAUNCH_MS = 420;
const readDev = () => { try { return window.localStorage.getItem(DEV_KEY) === "1"; } catch { return false; } };

function Cover({ title }: { title: ArcadeTitle }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current!;
    const paint = () => {
      const box = element.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      if (!box.width || !box.height) return;
      element.width = Math.round(box.width * dpr); element.height = Math.round(box.height * dpr);
      const context = element.getContext("2d")!;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      title.cover(context, box.width, box.height);
    };
    paint();
    const observer = new ResizeObserver(paint);
    observer.observe(element);
    return () => observer.disconnect();
  }, [title]);
  return <canvas ref={canvas} className="arcade-cover" aria-hidden="true" />;
}

/** The media corner's console front end: a row of large cover tiles over the
 * lower part of the view, the television still glowing above it. Choosing a
 * game expands its cover and loads its code; SYSTEM RUNNER is listed as the
 * workstation's own. The status light hides a developer skin. */
export default function ArcadeShell({ onExit }: { onExit: () => void }) {
  const [selected, setSelected] = useState(0);
  const [launching, setLaunching] = useState<string | null>(null);
  const [running, setRunning] = useState<GameDefinition | null>(null);
  const [failed, setFailed] = useState(false);
  const [developer, setDeveloper] = useState(readDev);
  const taps = useRef({ count: 0, at: 0 });
  const tiles = useRef<(HTMLButtonElement | null)[]>([]);
  const title = ARCADE_LIBRARY[selected];
  const song = useNowPlaying();

  useEffect(() => { tiles.current[0]?.focus({ preventScroll: true }); }, []);

  const launch = (entry: ArcadeTitle) => {
    if (!entry.load || launching) return;
    setFailed(false);
    setLaunching(entry.id);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pause = new Promise((resolve) => window.setTimeout(resolve, reduced ? 0 : LAUNCH_MS));
    Promise.all([entry.load(), pause])
      .then(([definition]) => setRunning(definition))
      .catch(() => setFailed(true))
      .finally(() => setLaunching(null));
  };

  const back = () => {
    setRunning(null);
    requestAnimationFrame(() => tiles.current[selected]?.focus({ preventScroll: true }));
  };

  const tapStatus = () => {
    const now = performance.now(), t = taps.current;
    t.count = now - t.at < 900 ? t.count + 1 : 1;
    t.at = now;
    if (t.count < 5) return;
    t.count = 0;
    const next = !developer;
    setDeveloper(next);
    try { window.localStorage.setItem(DEV_KEY, next ? "1" : "0"); } catch { /* Storage is optional. */ }
    if (next) discover("devmode");
  };

  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Enter") { event.preventDefault(); launch(title); return; }
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const next = (selected + (event.key === "ArrowRight" ? 1 : ARCADE_LIBRARY.length - 1)) % ARCADE_LIBRARY.length;
    setSelected(next);
    tiles.current[next]?.focus();
  };

  if (running) {
    return (
      <Suspense fallback={<div className="arcade-loading" role="status">Loading {running.title}</div>}>
        <GameFrame game={running} onExit={back} />
      </Suspense>
    );
  }

  return (
    <section className="arcade" aria-labelledby="arcade-title" data-developer={developer || undefined} data-launching={launching || undefined}>
      <header className="arcade-head">
        <div className="arcade-brand">
          <button type="button" className="arcade-status" aria-label="Console status" onClick={tapStatus} />
          <h2 id="arcade-title">ARCADE</h2>
          <span className="arcade-state">{developer ? "Developer mode" : "System ready"}</span>
        </div>
      </header>
      <EscControl label="Back to room" onPress={onExit} />

      <div className="arcade-library" role="listbox" aria-label="Games" aria-orientation="horizontal" onKeyDown={onKey}>
        {ARCADE_LIBRARY.map((entry, i) => (
          <button key={entry.id} ref={(button) => { tiles.current[i] = button; }} type="button" role="option"
            className="arcade-tile" aria-selected={i === selected} data-exclusive={entry.exclusive ? true : undefined}
            data-launching={launching === entry.id || undefined}
            onFocus={() => setSelected(i)} onClick={() => setSelected(i)}
            onDoubleClick={() => launch(entry)}>
            <Cover title={entry} />
            <span className="arcade-tile-title">{entry.title}</span>
            {entry.exclusive && <span className="arcade-tile-badge">{entry.exclusive}</span>}
          </button>
        ))}
      </div>

      <div className="arcade-detail" aria-live="polite">
        <div>
          <h3>{title.title}</h3>
          <p>{title.line}</p>
          <p className="arcade-controls">{title.controls}</p>
        </div>
        {title.load
          ? <button type="button" className="arcade-play" onClick={() => launch(title)} disabled={!!launching}>{launching ? "Starting" : failed ? "Try again" : "Play"}</button>
          : <span className="arcade-exclusive">{title.exclusive}</span>}
      </div>
      <p className="arcade-song" aria-live="polite">{song ? <>♪ {song.title} — {song.artist}</> : null}</p>
    </section>
  );
}
