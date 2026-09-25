"use client";

import { useEffect, useRef, useState } from "react";
import { BackgroundMusicManager } from "./soundtrackManager";
import { prepareGameMode, registerAudioManager } from "./gameMode";
import "./background-music.css";

const SESSION_KEY = "aadit-portfolio-music-muted";
function sessionMuted() {
  try { return window.sessionStorage.getItem(SESSION_KEY) === "1"; } catch { return false; }
}

/** Lives beside the scene, so camera moves and district focus never remount it. */
/** `game` is true while the arcade or SYSTEM RUNNER is open: Game Mode. */
export default function BackgroundMusic({ game }: { game: boolean }) {
  const [muted, setMuted] = useState(sessionMuted);
  const [unavailable, setUnavailable] = useState(false);
  const manager = useRef<BackgroundMusicManager | null>(null);

  useEffect(() => {
    const soundtrack = new BackgroundMusicManager(sessionMuted(), () => setUnavailable(true));
    manager.current = soundtrack;
    registerAudioManager(soundtrack);
    if (process.env.NODE_ENV === "development")
      (window as unknown as { __musicDebug?: BackgroundMusicManager }).__musicDebug = soundtrack;
    const unlock = (event: Event) => {
      const element = event.target;
      if (element instanceof Element && element.closest(".music-control")) return;
      if (event instanceof KeyboardEvent && !["Enter", "Space", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.code)) return;
      void soundtrack.start();
      prepareGameMode();
    };
    document.addEventListener("pointerdown", unlock, { capture: true, passive: true });
    document.addEventListener("keydown", unlock, true);
    return () => {
      document.removeEventListener("pointerdown", unlock, true);
      document.removeEventListener("keydown", unlock, true);
      soundtrack.dispose();
      registerAudioManager(null);
      manager.current = null;
      if (process.env.NODE_ENV === "development")
        delete (window as unknown as { __musicDebug?: BackgroundMusicManager }).__musicDebug;
    };
  }, []);

  useEffect(() => { manager.current?.setGameMode(game); }, [game]);

  const toggle = () => {
    if (unavailable) return;
    const next = !muted;
    setMuted(next);
    try { window.sessionStorage.setItem(SESSION_KEY, next ? "1" : "0"); } catch { /* Session storage is optional. */ }
    manager.current?.setMuted(next);
  };

  return <button type="button" className="music-control" data-muted={muted || undefined}
    onClick={toggle} disabled={unavailable}
    aria-label={unavailable ? "Background music unavailable" : muted ? "Enable background music" : "Mute background music"}
    aria-pressed={!muted && !unavailable}>
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9h3l4-3v12l-4-3H4z" />
      {muted || unavailable ? <path d="m16 9 5 6m0-6-5 6" /> : <><path d="M15 9a4 4 0 0 1 0 6" /><path d="M18 6a8 8 0 0 1 0 12" /></>}
    </svg>
    <span className="music-tooltip" aria-hidden="true">{unavailable ? "Music unavailable" : muted ? "Music Off" : "Music On"}</span>
  </button>;
}
