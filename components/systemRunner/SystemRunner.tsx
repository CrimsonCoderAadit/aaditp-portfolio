"use client";

import EscControl from "../room/EscControl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createWorld, displayScore, update, type Phase, type World } from "./engine";
import { createBackdrop, draw, fitCanvas } from "./render";
import { useSceneTransition } from "../scene/SceneTransition";
import { terminalBridge } from "../scene/terminalBridge";
import "./system-runner.css";

const STORE = "aadit-portfolio-system-runner-best";
const GAME_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD", "Space", "KeyP", "Escape"]);
const seed = () => Math.floor(Math.random() * 0xffffffff);

function bestFromStorage() {
  try { return Math.max(0, Number(window.localStorage.getItem(STORE)) || 0); } catch { return 0; }
}
/** The console is authored at the monitor's proportions and never resized:
 * CSS transforms carry it from the glass to the viewport and back. */
const CONSOLE = { w: 960, h: 538 };
const IDENTITY = "matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)";

/** Full-viewport layout on portrait, short and narrow screens, where a scaled
 * laptop-sized console would be unusable. */
const isCompact = (w: number, h: number) => w < 760 || h < 520 || h > w;

/** matrix3d taking the console's box onto four page points (top-left,
 * top-right, bottom-right, bottom-left): the unit square to quad projection,
 * so the page overlay sits exactly on the perspective-foreshortened glass. */
function fitQuad(w: number, h: number, [p0, p1, p2, p3]: [number, number][]) {
  const [x0, y0] = p0, [x1, y1] = p1, [x2, y2] = p2, [x3, y3] = p3;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = den ? (dx3 * dy2 - dx2 * dy3) / den : 0, hh = den ? (dx1 * dy3 - dx3 * dy1) / den : 0;
  const a = x1 - x0 + g * x1, b = x3 - x0 + hh * x3, d = y1 - y0 + g * y1, e = y3 - y0 + hh * y3;
  return `matrix3d(${[a / w, d / w, 0, g / w, b / h, e / h, 0, hh / h, 0, 0, 1, 0, x0, y0, 0, 1].join(",")})`;
}

type Placement = { w: number; h: number; transform: string; scale: number };

function place(expanded: boolean, quad: [number, number][] | null, vw: number, vh: number): Placement {
  if (expanded && isCompact(vw, vh)) return { w: vw, h: vh, transform: IDENTITY, scale: 1 };
  const scale = Math.min(vw * .86 / CONSOLE.w, vh * .84 / CONSOLE.h);
  if (expanded || !quad) {
    const s = expanded ? scale : scale * .6;
    return { ...CONSOLE, transform: `matrix3d(${s},0,0,0,0,${s},0,0,0,0,1,0,${(vw - CONSOLE.w * s) / 2},${(vh - CONSOLE.h * s) / 2},0,1)`, scale: s };
  }
  return { ...CONSOLE, transform: fitQuad(CONSOLE.w, CONSOLE.h, quad as [number, number][]), scale: 1 };
}

const pad6 = (value: number) => String(value).padStart(6, "0");

function Primary({ label, onClick, disabled }: { label: string; onClick: () => void; disabled: boolean }) {
  return <button type="button" className="runner-primary" data-autofocus onClick={onClick} disabled={disabled}>{label}<span aria-hidden="true">→</span></button>;
}

export default function SystemRunner() {
  const { mode, closeTerminal } = useSceneTransition();
  const reduced = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  const [touch, setTouch] = useState(() => window.matchMedia("(pointer: coarse)").matches);
  const [phase, setPhase] = useState<Phase>("menu");
  const phaseRef = useRef<Phase>("menu");
  const [expanded, setExpanded] = useState(false);
  const [shown, setShown] = useState(false);
  const [closing, setClosing] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [view, setView] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const [quad, setQuad] = useState(() => terminalBridge.screenRect()?.quad ?? null);
  const [best, setBest] = useState(bestFromStorage);
  const [score, setScore] = useState(0);
  const [hud, setHud] = useState({ integrity: 3, pulse: 1, multiplier: 1 });
  const [clock, setClock] = useState(0);
  const root = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const world = useRef<World>(createWorld(seed(), reduced));
  const keys = useRef(new Set<string>());
  const pad = useRef(new Set<string>());
  const pulseRequest = useRef(false);
  const backdrop = useMemo(() => createBackdrop(), []);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const busy = useRef(false);
  const placement = place(expanded, quad, view.w, view.h);
  const ratio = useRef(1);
  useEffect(() => { ratio.current = Math.min(2.5, (window.devicePixelRatio || 1) * Math.max(1, place(true, null, view.w, view.h).scale)); }, [view]);
  const later = useCallback((run: () => void, ms: number) => { timers.current.push(setTimeout(run, reduced ? Math.min(ms, 90) : ms)); }, [reduced]);

  const changePhase = useCallback((next: Phase) => { phaseRef.current = next; setPhase(next); }, []);
  const paint = useCallback((time: number) => {
    const element = canvas.current;
    const context = element?.getContext("2d", { alpha: false });
    if (!element || !context) return;
    const fitted = fitCanvas(element, ratio.current);
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = "#0a0d11"; context.fillRect(0, 0, element.width, element.height);
    context.setTransform(fitted.scale, 0, 0, fitted.scale, fitted.x, fitted.y);
    draw(context, world.current, backdrop, phaseRef.current, { reducedMotion: reduced, clock: time });
  }, [backdrop, reduced]);

  // Fade in over the monitor once the camera has settled; the console then
  // keeps the glass's quad until START RUN.
  useEffect(() => {
    let inner = 0;
    const outer = requestAnimationFrame(() => { inner = requestAnimationFrame(() => setShown(true)); });
    return () => { cancelAnimationFrame(outer); cancelAnimationFrame(inner); };
  }, []);
  useEffect(() => {
    const onResize = () => {
      setView({ w: window.innerWidth, h: window.innerHeight });
      if (!expanded) setQuad(terminalBridge.screenRect()?.quad ?? null);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [expanded]);
  useEffect(() => { paint(clock); }, [paint, phase, clock, placement.w, placement.h, placement.scale]);
  // The menu's network drifts slowly behind the title.
  useEffect(() => {
    if (phase !== "menu" || !shown || closing || reduced) return;
    let frame = 0, last = 0;
    const tick = (now: number) => {
      if (now - last > 40) { paint(now / 1000); last = now; }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [phase, shown, closing, reduced, paint]);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const onChange = () => setTouch(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const finish = useCallback(() => {
    const value = displayScore(world.current);
    setScore(value);
    setBest((previous) => {
      const next = Math.max(previous, value);
      if (next > previous) { try { window.localStorage.setItem(STORE, String(next)); } catch { /* Storage is optional. */ } }
      return next;
    });
    changePhase("over");
  }, [changePhase]);
  const start = useCallback(() => {
    keys.current.clear(); pad.current.clear(); pulseRequest.current = false;
    world.current = createWorld(seed(), reduced);
    if (process.env.NODE_ENV === "development") (window as unknown as { __runnerDebug?: World }).__runnerDebug = world.current;
    setScore(0); setClock(0); setHud({ integrity: 3, pulse: 1, multiplier: 1 });
    busy.current = false; setLaunching(false);
    changePhase("playing");
  }, [changePhase, reduced]);
  // START RUN from the monitor: the console grows to the viewport first, then the run begins.
  const launch = useCallback(() => {
    if (busy.current || closing) return;
    if (expanded) { start(); return; }
    busy.current = true; setLaunching(true);
    if (isCompact(view.w, view.h)) {
      setSwapping(true);
      later(() => { setExpanded(true); setSwapping(false); later(start, 380); }, 170);
    } else {
      setExpanded(true);
      later(start, 560);
    }
  }, [closing, expanded, later, start, view.h, view.w]);
  const pause = useCallback(() => {
    if (phaseRef.current === "playing") { keys.current.clear(); pad.current.clear(); changePhase("paused"); }
  }, [changePhase]);
  const resume = useCallback(() => changePhase("playing"), [changePhase]);
  const exit = useCallback(() => {
    if (closing || busy.current) return;
    keys.current.clear(); pad.current.clear(); pulseRequest.current = false;
    setClosing(true);
    if (expanded && !isCompact(view.w, view.h)) {
      setQuad(terminalBridge.screenRect()?.quad ?? null);
      setExpanded(false);
      later(closeTerminal, 620);
    } else later(closeTerminal, 260);
  }, [closeTerminal, closing, expanded, later, view.h, view.w]);
  useEffect(() => () => {
    timers.current.forEach(clearTimeout);
    if (process.env.NODE_ENV === "development") delete (window as unknown as { __runnerDebug?: World }).__runnerDebug;
  }, []);

  // Focus follows the screen: the primary action of whatever is showing.
  useEffect(() => {
    if (!shown || closing) return;
    root.current?.querySelector<HTMLElement>("[data-autofocus]:not(:disabled)")?.focus({ preventScroll: true });
  }, [shown, closing, phase, expanded]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!GAME_KEYS.has(event.code)) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.code === "Escape") {
        if (phaseRef.current === "playing") pause();
        else exit();
        return;
      }
      if (event.code === "KeyP") {
        if (phaseRef.current === "playing") pause(); else if (phaseRef.current === "paused") resume();
        return;
      }
      if (phaseRef.current !== "playing") return;
      keys.current.add(event.code);
      if (event.code === "Space" && !event.repeat) pulseRequest.current = true;
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (!GAME_KEYS.has(event.code)) return;
      event.preventDefault(); event.stopImmediatePropagation();
      keys.current.delete(event.code);
    };
    const hidden = () => { if (document.hidden) pause(); };
    const blur = () => pause();
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("blur", blur);
    };
  }, [pause, resume, exit]);

  useEffect(() => {
    if (phase !== "playing" || mode !== "terminal" || closing) return;
    let frame = 0, previous = 0, lastHud = 0;
    const tick = (now: number) => {
      if (!previous) previous = now;
      const dt = Math.min((now - previous) / 1000, .05);
      previous = now;
      const held = keys.current, touched = pad.current;
      update(world.current, dt, {
        x: Number(held.has("ArrowRight") || held.has("KeyD") || touched.has("right")) - Number(held.has("ArrowLeft") || held.has("KeyA") || touched.has("left")),
        y: Number(held.has("ArrowDown") || held.has("KeyS") || touched.has("down")) - Number(held.has("ArrowUp") || held.has("KeyW") || touched.has("up")),
        pulse: pulseRequest.current,
      });
      pulseRequest.current = false;
      paint(now / 1000);
      if (now - lastHud > 120) { setScore(displayScore(world.current)); setHud({ integrity: world.current.integrity, pulse: world.current.pulseCharge, multiplier: world.current.multiplier }); lastHud = now; }
      if (world.current.over) { finish(); return; }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [phase, mode, closing, paint, finish]);

  const padButton = (direction: string, label: string, name: string) => <button type="button" aria-label={name} className={`runner-pad-${direction}`}
    onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); pad.current.add(direction); }}
    onPointerUp={() => pad.current.delete(direction)} onPointerCancel={() => pad.current.delete(direction)} onLostPointerCapture={() => pad.current.delete(direction)}>{label}</button>;

  // Tab stays inside the console while it is open.
  const trapTab = (event: React.KeyboardEvent) => {
    if (event.key !== "Tab") return;
    const items = [...(root.current?.querySelectorAll<HTMLElement>("button:not(:disabled)") ?? [])].filter((item) => item.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  const screen = closing ? null : phase === "menu" ? "menu" : phase === "paused" ? "paused" : phase === "over" ? "over" : null;
  const disabled = !shown || launching || swapping;

  return <div className="runner-layer" data-expanded={expanded && !closing} data-phase={phase}>
    <div className="runner-shade" aria-hidden="true" />
    {!closing && (phase === "playing" ? <EscControl label="Pause" onPress={pause} /> : <EscControl label="Exit terminal" onPress={exit} disabled={disabled} />)}
    <section ref={root} className="runner-console" role="dialog" aria-modal="true" aria-label="System Runner" onKeyDown={trapTab}
      data-shown={shown && !closing} data-swapping={swapping} data-closing={closing} data-collapse={closing && !expanded && !isCompact(view.w, view.h)}
      style={{ width: placement.w, height: placement.h, transform: placement.transform }}>
      <canvas ref={canvas} aria-label="System Runner play field" />
      {touch && phase === "playing" && <div className="runner-mobile-hud" aria-label={`Score ${score}. Integrity ${hud.integrity} of 3. Pulse ${Math.round(hud.pulse * 100)} percent charged.`}>
        <span>SCORE <strong>{pad6(score)}</strong></span><span>INTEGRITY <strong>{"●".repeat(hud.integrity)}{"○".repeat(3 - hud.integrity)}</strong></span>
        <span>PULSE <strong>{hud.pulse >= 1 ? "READY" : `${Math.round(hud.pulse * 100)}%`}</strong></span>{hud.multiplier > 1 && <span className="runner-mobile-multiplier">×2 SCORE</span>}
      </div>}
      {screen === "menu" && <div key="menu" className="runner-screen runner-menu" data-leaving={launching}>
        <div className="runner-stack">
          <h2>SYSTEM RUNNER</h2>
          <p className="runner-sub"><span>ROUTE THE PACKET.</span><span>KEEP THE SYSTEM ALIVE.</span></p>
          <Primary label="START RUN" onClick={launch} disabled={disabled} />
          <div className="runner-best">BEST SCORE <strong>{pad6(best)}</strong></div>
        </div>
        <ul className="runner-controls" aria-label="Controls">
          {touch ? <><li><b>PAD</b> MOVE</li><li><b>PULSE</b> CLEAR PACKETS</li><li><b>Ⅱ</b> PAUSE</li></>
            : <><li><b>WASD / ARROWS</b> MOVE</li><li><b>SPACE</b> PULSE</li><li><b>ESC</b> PAUSE</li></>}
        </ul>
      </div>}
      {screen === "paused" && <div key="paused" className="runner-screen runner-overlay">
        <div className="runner-stack">
          <h2 className="runner-title-sm">SYSTEM PAUSED</h2>
          <div className="runner-actions">
            <Primary label="RESUME" onClick={resume} disabled={disabled} />
            <button type="button" onClick={start} disabled={disabled}>RESTART RUN</button>
            <button type="button" onClick={exit} disabled={disabled}>EXIT TERMINAL</button>
          </div>
        </div>
      </div>}
      {screen === "over" && <div key="over" className="runner-screen runner-overlay">
        <div className="runner-stack">
          <h2 className="runner-title-sm">CONNECTION LOST</h2>
          <dl className="runner-results"><div><dt>SCORE</dt><dd>{pad6(score)}</dd></div><div><dt>BEST</dt><dd>{pad6(best)}</dd></div></dl>
          <div className="runner-actions">
            <Primary label="RUN AGAIN" onClick={start} disabled={disabled} />
            <button type="button" onClick={exit} disabled={disabled}>EXIT TERMINAL</button>
          </div>
        </div>
      </div>}
      {touch && phase === "playing" && <div className="runner-touch"><div className="runner-pad">{padButton("up", "↑", "Move up")}{padButton("left", "←", "Move left")}{padButton("right", "→", "Move right")}{padButton("down", "↓", "Move down")}</div><button type="button" className="runner-pulse" onPointerDown={(event) => { event.preventDefault(); pulseRequest.current = true; }}>PULSE</button><button type="button" className="runner-touch-pause" aria-label="Pause" onClick={pause}>Ⅱ</button></div>}
      <div className="runner-frame" aria-hidden="true" />
    </section>
  </div>;
}
