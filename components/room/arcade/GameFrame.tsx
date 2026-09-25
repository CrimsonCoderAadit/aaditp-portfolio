"use client";

import EscControl from "../EscControl";
import { coverScene } from "../../scene/roomInteractions";
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createSfx, type Sfx } from "./sfx";
import type { Engine, GameDefinition, Input } from "./types";
import "./game-frame.css";

type Phase = "title" | "playing" | "paused" | "over";
type Held = "left" | "right" | "up" | "down" | "action";

const KEYS: Record<string, Held> = {
  ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
  ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", Space: "action",
};

const readBest = (key: string) => { try { return Math.max(0, Number(window.localStorage.getItem(key)) || 0); } catch { return 0; } };
const blankInput = (): Input => ({ left: false, right: false, up: false, down: false, action: false, actionHit: false, pointer: { x: 0, y: 0, active: false, down: false, hit: false } });

/** The stage every arcade game runs on: a full-viewport canvas with the
 * loop, keyboard, pointer and touch input, title, pause and game-over menus,
 * the best score, and complete cleanup when it closes. Escape pauses a game
 * in play; from the menus it returns to the library. */
export default function GameFrame({ game, onExit }: { game: GameDefinition; onExit: () => void }) {
  const [phase, setPhase] = useState<Phase>("title");
  const [best, setBest] = useState(() => readBest(game.bestKey));
  const [result, setResult] = useState({ score: 0, newBest: false });
  const [touch] = useState(() => window.matchMedia("(pointer: coarse)").matches);

  const canvas = useRef<HTMLCanvasElement>(null);
  const hud = useRef<HTMLDivElement>(null);
  const engine = useRef<Engine | null>(null);
  const sfx = useRef<Sfx | null>(null);
  const input = useRef<Input>(blankInput());
  const phaseRef = useRef<Phase>("title");
  const size = useRef({ w: 1, h: 1 });

  const draw = useCallback(() => {
    const element = canvas.current, running = engine.current;
    const context = element?.getContext("2d");
    if (!element || !running || !context) return;
    const dpr = element.width / Math.max(1, size.current.w);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    running.render(context, size.current.w, size.current.h);
  }, []);

  const writeHud = useCallback(() => {
    const running = engine.current;
    if (!hud.current || !running) return;
    const cells = [["Score", String(running.score)], ...running.hud()];
    hud.current.replaceChildren(...cells.map(([label, value]) => {
      const cell = document.createElement("span");
      const name = document.createElement("small");
      name.textContent = label;
      cell.append(name, value);
      return cell;
    }));
  }, []);

  const go = useCallback((next: Phase) => { phaseRef.current = next; setPhase(next); }, []);

  const start = useCallback(() => {
    engine.current = game.create(sfx.current!);
    input.current = blankInput();
    sfx.current?.play("start");
    go("playing");
  }, [game, go]);

  // One sound bank and one attract-screen world for the frame's lifetime.
  useEffect(() => {
    const bank = createSfx();
    sfx.current = bank;
    engine.current = game.create(bank);
    return () => { bank.close(); sfx.current = null; engine.current = null; };
  }, [game]);

  // Canvas at device resolution, redrawn when the stage resizes.
  useEffect(() => {
    const element = canvas.current!;
    const fit = () => {
      const box = element.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      size.current = { w: Math.max(1, box.width), h: Math.max(1, box.height) };
      element.width = Math.round(size.current.w * dpr);
      element.height = Math.round(size.current.h * dpr);
      draw();
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, [draw]);

  // The loop runs only while a game is in play.
  useEffect(() => {
    if (phase !== "playing") { draw(); writeHud(); return; }
    let frame = 0, last = performance.now(), hudClock = 0;
    const tick = (now: number) => {
      const running = engine.current;
      if (!running) return;
      const dt = Math.min(.05, (now - last) / 1000);
      last = now;
      running.update(dt, input.current);
      input.current.actionHit = false;
      input.current.pointer.hit = false;
      draw();
      hudClock -= dt;
      if (hudClock <= 0) { writeHud(); hudClock = .1; }
      if (running.over) {
        writeHud();
        const score = running.score, previous = readBest(game.bestKey);
        const newBest = score > previous;
        if (newBest) { try { window.localStorage.setItem(game.bestKey, String(score)); } catch { /* Storage is optional. */ } setBest(score); }
        setResult({ score, newBest });
        sfx.current?.play("over");
        go("over");
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [phase, draw, writeHud, game.bestKey, go]);

  // The game hides the room entirely: the room rests until it closes.
  useEffect(() => coverScene(), []);

  // Keyboard, captured ahead of the room so Escape stays with the game.
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const current = phaseRef.current;
      if (event.code === "Escape" || event.code === "KeyP") {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (current === "playing") go("paused");
        else if (event.code === "KeyP" && current === "paused") go("playing");
        else if (event.code === "Escape") onExit();
        return;
      }
      const held = KEYS[event.code];
      if (!held || current !== "playing") return;
      event.preventDefault();
      if (held === "action" && !event.repeat) input.current.actionHit = true;
      input.current[held] = true;
    };
    const up = (event: KeyboardEvent) => {
      const held = KEYS[event.code];
      if (held) input.current[held] = false;
    };
    const away = () => { if (phaseRef.current === "playing") go("paused"); input.current = blankInput(); };
    const hidden = () => { if (document.hidden) away(); };
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up, true);
    window.addEventListener("blur", away);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("keydown", down, true);
      window.removeEventListener("keyup", up, true);
      window.removeEventListener("blur", away);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [go, onExit]);

  const point = (event: ReactPointerEvent<HTMLCanvasElement>, pressed?: boolean) => {
    const box = event.currentTarget.getBoundingClientRect();
    const pointer = input.current.pointer;
    pointer.x = event.clientX - box.left;
    pointer.y = event.clientY - box.top;
    pointer.active = true;
    if (pressed === true) { pointer.down = true; pointer.hit = true; event.currentTarget.setPointerCapture(event.pointerId); }
    if (pressed === false) pointer.down = false;
  };
  const hold = (key: Held) => ({
    onPointerDown: (event: ReactPointerEvent) => {
      event.preventDefault();
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      if (key === "action") input.current.actionHit = true;
      input.current[key] = true;
    },
    onPointerUp: () => { input.current[key] = false; },
    onPointerCancel: () => { input.current[key] = false; },
  });

  const menu = phase !== "playing";
  return (
    <section className="game-frame" aria-label={game.title} data-phase={phase}>
      <canvas ref={canvas} className="game-canvas" aria-hidden="true"
        onPointerDown={(event) => point(event, true)} onPointerMove={(event) => point(event)}
        onPointerUp={(event) => point(event, false)} onPointerLeave={() => { input.current.pointer.active = false; input.current.pointer.down = false; }} />
      <header className="game-bar">
        <strong>{game.title}</strong>
        <div ref={hud} className="game-hud" aria-live="off" />
        <span className="game-best"><small>Best</small>{best}</span>
      </header>
      {phase === "playing" ? <EscControl label="Pause" onPress={() => go("paused")} /> : <EscControl label="Library" onPress={onExit} />}

      {phase === "playing" && touch && game.touch !== "aim" && (
        <div className="game-touch" data-layout={game.touch}>
          <div className="game-touch-side">
            <button type="button" aria-label="Left" {...hold("left")}>◀</button>
            <button type="button" aria-label="Right" {...hold("right")}>▶</button>
          </div>
          <div className="game-touch-side">
            {game.touch === "drive" ? <>
              <button type="button" aria-label="Drift" {...hold("action")}>DRIFT</button>
              <button type="button" aria-label="Brake" {...hold("down")}>BRAKE</button>
              <button type="button" aria-label="Accelerate" {...hold("up")}>GAS</button>
            </> : <>
              <button type="button" aria-label="Climb down" {...hold("down")}>▼</button>
              <button type="button" aria-label="Climb up" {...hold("up")}>▲</button>
              <button type="button" aria-label="Jump" {...hold("action")}>JUMP</button>
            </>}
          </div>
        </div>
      )}

      {menu && (
        <div className="game-menu" role="dialog" aria-modal="true" aria-labelledby={`${game.id}-menu`}>
          {phase === "title" && <>
            <p className="game-eyebrow">Arcade · Original game</p>
            <h2 id={`${game.id}-menu`}>{game.title}</h2>
            <ul className="game-howto">{game.howTo.map((line) => <li key={line}>{line}</li>)}</ul>
            <div className="game-actions">
              <button type="button" className="game-primary" autoFocus onClick={start}>Play</button>
              <button type="button" onClick={onExit}>Library</button>
            </div>
          </>}
          {phase === "paused" && <>
            <p className="game-eyebrow">Paused</p>
            <h2 id={`${game.id}-menu`}>{game.title}</h2>
            <div className="game-actions">
              <button type="button" className="game-primary" autoFocus onClick={() => go("playing")}>Resume</button>
              <button type="button" onClick={start}>Restart</button>
              <button type="button" onClick={onExit}>Exit to library</button>
            </div>
          </>}
          {phase === "over" && <>
            <p className="game-eyebrow">{result.newBest ? "New best" : "Game over"}</p>
            <h2 id={`${game.id}-menu`}>{result.score}</h2>
            <p className="game-note">Best {best}</p>
            <div className="game-actions">
              <button type="button" className="game-primary" autoFocus onClick={start}>Play again</button>
              <button type="button" onClick={onExit}>Exit to library</button>
            </div>
          </>}
        </div>
      )}
    </section>
  );
}
