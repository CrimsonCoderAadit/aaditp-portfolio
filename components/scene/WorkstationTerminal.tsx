import { useEffect, useMemo, useRef, useState } from "react";
import { useCursor } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { CanvasTexture, MeshPhysicalMaterial, SRGBColorSpace, Vector3 } from "three";
import { MONITOR_GLASS, MONITORS } from "./roomAssets/furniture";
import { DESK_AT, METRE, ROOM } from "./roomLayout";
import { DESK_GLOW } from "./roomAssets/ambience";
import { isTerminalMode, useSceneTransition } from "./SceneTransition";
import { useSystemsDashboard } from "./systemsDashboard";
import { preloadSystemRunner, terminalBridge } from "./terminalBridge";
import { enterGameMode, prepareGameMode } from "../audio/gameMode";
import { DASHBOARD_MONITOR, SCREEN, screenCorners, TERMINAL_MONITOR } from "./terminalGeometry";

/** Hover and click only from nearby: the workstation view, or anywhere the
 * camera stands within reach of the desk. Never from across the room. */
const REACH = 6.5;

type ScreenState = "idle" | "hover" | "connecting" | "active";

/** The hover sequence: a scanline wipes the idle terminal into the ready
 * screen, then a cursor blinks. Seconds. */
const WIPE = .22, SETTLE = .36, BLINK = .45;

function paintGround(c: CanvasRenderingContext2D, w: number, h: number) {
  c.fillStyle = "#0b0f13"; c.fillRect(0, 0, w, h);
  c.strokeStyle = "rgba(120,190,210,.08)"; c.lineWidth = 1;
  for (let x = 0; x < w; x += 32) { c.beginPath(); c.moveTo(x + .5, 0); c.lineTo(x + .5, h); c.stroke(); }
  for (let y = 0; y < h; y += 32) { c.beginPath(); c.moveTo(0, y + .5); c.lineTo(w, y + .5); c.stroke(); }
  c.fillStyle = "#141b22"; c.fillRect(0, 0, w, 30);
  c.font = "600 15px Menlo, ui-monospace, monospace"; c.textBaseline = "middle";
  c.fillStyle = "#6f8792"; c.fillText("portfolio.local — terminal", 16, 15);
  for (const [i, color] of ["#c7644f", "#c9a24a", "#5f9b73"].entries()) { c.fillStyle = color; c.beginPath(); c.arc(w - 60 + i * 18, 15, 5, 0, Math.PI * 2); c.fill(); }
}

function paintEmblem(c: CanvasRenderingContext2D, w: number, h: number) {
  c.save(); c.translate(w - 70, h - 62); c.rotate(Math.PI / 4);
  c.strokeStyle = "#7fd6e6"; c.lineWidth = 3; c.strokeRect(-14, -14, 28, 28);
  c.fillStyle = "#7fd6e6"; c.fillRect(-5, -5, 10, 10);
  c.restore();
}

function paintLines(c: CanvasRenderingContext2D, lines: [string, string][]) {
  c.font = "600 28px Menlo, ui-monospace, monospace";
  lines.forEach(([color, text], i) => { c.fillStyle = color; c.fillText(text, 28, 78 + i * 46); });
}

/** The runner's startup screen, drawn in the same composition as its menu so
 * the page overlay takes over without a jump: title and subtitle where the
 * menu has them, and three status lines that arrive over the first second.
 * `since` is the time into the sequence; Infinity is the finished screen. */
const STARTUP_LINES: [number, string][] = [[.25, "INITIALIZING NETWORK..."], [.6, "ROUTING TABLE READY"], [.95, "SYSTEM READY"]];
const STARTUP_END = 1.3;

function paintStartup(c: CanvasRenderingContext2D, w: number, h: number, since: number) {
  const centre = w / 2, appear = Math.min(1, since / .2);
  c.textAlign = "center"; c.textBaseline = "middle";
  c.globalAlpha = appear;
  c.font = "700 46px 'Helvetica Neue', Helvetica, Arial, sans-serif"; c.letterSpacing = "5px"; c.fillStyle = "#e8f3f5";
  c.fillText("SYSTEM RUNNER", centre + 2, h * .32);
  c.font = "600 11px Menlo, ui-monospace, monospace"; c.letterSpacing = "2.5px"; c.fillStyle = "#7f9aa3";
  c.fillText("ROUTE THE PACKET.  KEEP THE SYSTEM ALIVE.", centre + 1, h * .32 + 42);
  c.globalAlpha = 1;
  c.textAlign = "left"; c.font = "600 14px Menlo, ui-monospace, monospace"; c.letterSpacing = "1.5px";
  STARTUP_LINES.forEach(([at, text], i) => {
    if (since < at) return;
    const last = i === STARTUP_LINES.length - 1, fade = Math.min(1, (since - at) / .12);
    c.globalAlpha = fade;
    c.fillStyle = last ? "#7fd6e6" : "#8fa3ac";
    c.fillText((last ? "\u25B8 " : "> ") + text, centre - 120, h * .62 + i * 26);
  });
  c.globalAlpha = 1; c.letterSpacing = "0px";
}

/** The terminal's screen content. `since` is the time into the hover or startup sequence. */
function paintScreen(canvas: HTMLCanvasElement, state: ScreenState, since = 0) {
  const c = canvas.getContext("2d")!;
  const { width: w, height: h } = canvas;
  if (state === "connecting" || state === "active") {
    c.fillStyle = "#0a0d11"; c.fillRect(0, 0, w, h);
    c.strokeStyle = "rgba(127,214,230,.045)"; c.lineWidth = 1;
    for (let x = 0; x < w; x += 32) { c.beginPath(); c.moveTo(x + .5, 0); c.lineTo(x + .5, h); c.stroke(); }
    for (let y = 0; y < h; y += 32) { c.beginPath(); c.moveTo(0, y + .5); c.lineTo(w, y + .5); c.stroke(); }
    paintStartup(c, w, h, state === "connecting" ? since : Infinity);
    c.strokeStyle = "rgba(127,214,230,.34)"; c.lineWidth = 2; c.strokeRect(1, 1, w - 2, h - 2);
    return;
  }
  paintGround(c, w, h);
  const idle = () => { paintLines(c, [["#7fd6e6", "SYSTEM READY"], ["#8fa3ac", "> portfolio.local"], ["#8fa3ac", "> runner available"], ["#6f8792", "_"]]); paintEmblem(c, w, h); };
  if (state === "idle") { idle(); return; }
  const wipe = Math.min(1, since / WIPE), edge = 30 + wipe * (h - 30);
  c.save(); c.beginPath(); c.rect(0, edge, w, h - edge); c.clip(); idle(); c.restore();
  c.save(); c.beginPath(); c.rect(0, 30, w, edge - 30); c.clip();
  c.font = "700 40px Menlo, ui-monospace, monospace"; c.fillStyle = "#7fd6e6"; c.fillText("SYSTEM RUNNER", 28, 92);
  c.font = "600 26px Menlo, ui-monospace, monospace";
  c.fillStyle = "#8fa3ac"; c.fillText("> runner ready", 28, 150);
  const prompt = "> CLICK TO PLAY";
  c.fillStyle = "#e3eef0"; c.fillText(prompt, 28, 196);
  if (since > SETTLE && Math.floor((since - SETTLE) / BLINK) % 2 === 0) c.fillRect(34 + c.measureText(prompt).width, 182, 15, 28);
  paintEmblem(c, w, h);
  c.restore();
  // The scanline itself, and a hairline frame that settles in with it.
  if (wipe < 1) {
    const band = c.createLinearGradient(0, edge - 18, 0, edge + 2);
    band.addColorStop(0, "rgba(127,214,230,0)"); band.addColorStop(1, "rgba(127,214,230,.4)");
    c.fillStyle = band; c.fillRect(0, edge - 18, w, 20);
    c.fillStyle = "rgba(210,240,245,.75)"; c.fillRect(0, edge, w, 2);
  }
  c.strokeStyle = `rgba(127,214,230,${.45 * Math.min(1, since / SETTLE)})`; c.lineWidth = 3;
  c.strokeRect(1.5, 1.5, w - 3, h - 3);
}

/** The interactive workstation terminal: live screen content, a precise hit
 * volume over its glass only, and the entry into the SYSTEM RUNNER easter egg.
 * The invitation lives inside the screen itself. It also hosts the other
 * panel's ambient dashboard and drives the desk's violet glow. */
export default function WorkstationTerminal() {
  const { mode, viewpoint, viewpointMoving, openTerminal } = useSceneTransition();
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const [hovered, setHovered] = useState(false);
  const [near, setNear] = useState(false);
  const nearRef = useRef(false);
  const usable = mode === "workbench" && !viewpointMoving && (near || viewpoint === "workstation");
  const active = hovered && usable;
  useCursor(active);
  const dashboard = useSystemsDashboard(mode);

  const screen = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 640; canvas.height = 358;
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 8;
    const material = new MeshPhysicalMaterial({ color: "#5c5c5c", map: texture, emissiveMap: texture, emissive: "#ffffff", emissiveIntensity: .36, roughness: .66, specularIntensity: .2, envMapIntensity: .5 });
    const ease = (from: number, to: number, delta: number) => from + (to - from) * (1 - Math.exp(-8 * Math.min(delta, .05)));
    return { material, repaint: (state: ScreenState, since?: number) => { paintScreen(canvas, state, since); texture.needsUpdate = true; },
      /** Eases screen brightness and the desk glow toward their targets; true while either moves. */
      adjust: (screenTarget: number, glowTarget: number, delta: number) => {
        const moving = Math.abs(screenTarget - material.emissiveIntensity) > .002 || Math.abs(glowTarget - DESK_GLOW.value) > .002;
        if (!moving) return false;
        material.emissiveIntensity = ease(material.emissiveIntensity, screenTarget, delta);
        DESK_GLOW.value = ease(DESK_GLOW.value, glowTarget, delta);
        return true;
      },
      dispose: () => { texture.dispose(); material.dispose(); } };
  }, []);
  useEffect(() => () => screen.dispose(), [screen]);

  const state: ScreenState = mode === "terminal-entering" ? "connecting" : mode === "terminal" ? "active" : active ? "hover" : "idle";
  const hoverStart = useRef(0);
  const lastHoverFrame = useRef("");
  useEffect(() => {
    hoverStart.current = performance.now();
    lastHoverFrame.current = "";
    screen.repaint(state, 0);
    invalidate();
    if (state !== "hover") return;
    // After the wipe, the cursor blink needs a frame twice a second.
    const timer = window.setInterval(invalidate, BLINK * 1000 / 2);
    return () => window.clearInterval(timer);
  }, [state, screen, invalidate]);

  // Warm the game module the first time the terminal is within reach.
  useEffect(() => { if (active) void preloadSystemRunner(); }, [active]);

  // Reach is checked each frame against the camera; it changes React state
  // only when it flips.
  const scratch = useMemo(() => new Vector3(), []);
  useFrame((_, delta) => {
    const within = camera.position.distanceTo(SCREEN.centre) < REACH;
    if (within !== nearRef.current) { nearRef.current = within; setNear(within); }
    if (state === "hover" || state === "connecting") {
      const since = (performance.now() - hoverStart.current) / 1000;
      const running = state === "hover" ? since < SETTLE + .05 : since < STARTUP_END + .05;
      const frame = state === "connecting" ? (running ? `c${Math.floor(since * 15)}` : "cdone")
        : since < SETTLE ? `${since}` : `blink${Math.floor((since - SETTLE) / BLINK) % 2}`;
      if (frame !== lastHoverFrame.current) { lastHoverFrame.current = frame; screen.repaint(state, since); }
      if (running) invalidate();
    }
    // The desk glow lifts a touch on hover and steps back while the game has focus.
    const focused = isTerminalMode(mode) && mode !== "terminal-leaving";
    const screenTarget = state === "connecting" ? .6 : active ? .44 : .36;
    const glowTarget = focused ? .55 : active ? 1.1 : 1;
    if (screen.adjust(screenTarget, glowTarget, delta)) invalidate();
  });

  // The DOM overlay grows out of, and collapses back into, the glass on the page.
  useEffect(() => {
    terminalBridge.setMeasure(() => {
      const rect = gl.domElement.getBoundingClientRect();
      // One pass: `scratch` is reused, so each corner must be read before the next projection.
      const points = screenCorners().map((corner) => { const p = scratch.copy(corner).project(camera); return [rect.left + (p.x + 1) / 2 * rect.width, rect.top + (1 - p.y) / 2 * rect.height]; });
      const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
      const left = Math.min(...xs), top = Math.min(...ys);
      // Corners come bottom-left first; the page wants top-left first.
      const quad: [number, number][] = [points[3], points[2], points[1], points[0]].map(([x, y]) => [x, y]);
      return { left, top, width: Math.max(...xs) - left, height: Math.max(...ys) - top, quad };
    });
    return () => terminalBridge.setMeasure(null);
  }, [gl, camera, scratch]);

  const noRaycast = () => {};
  const glassAt: [number, number, number] = [MONITOR_GLASS.at[0], MONITOR_GLASS.at[1], MONITOR_GLASS.at[2] + .0008];
  return (
    <group name="workstation terminal" position={[DESK_AT.at[0], ROOM.floor, DESK_AT.at[2]]} rotation={[0, DESK_AT.turn, 0]} scale={METRE}>
      <group position={MONITORS[DASHBOARD_MONITOR].at} rotation={[0, MONITORS[DASHBOARD_MONITOR].turn, 0]}>
        <mesh material={dashboard} position={glassAt} raycast={noRaycast}>
          <planeGeometry args={MONITOR_GLASS.size} />
        </mesh>
      </group>
      <group position={MONITORS[TERMINAL_MONITOR].at} rotation={[0, MONITORS[TERMINAL_MONITOR].turn, 0]}>
        <mesh material={screen.material} position={glassAt} raycast={noRaycast}>
          <planeGeometry args={MONITOR_GLASS.size} />
        </mesh>
        {/* Match the terminal glass itself, leaving the other monitor and desk inert. */}
        <mesh position={[MONITOR_GLASS.at[0], MONITOR_GLASS.at[1], MONITOR_GLASS.at[2] + .003]}
          onPointerOver={(event) => { event.stopPropagation(); if (usable) { setHovered(true); prepareGameMode(); } }}
          onPointerOut={() => setHovered(false)}
          onClick={(event) => { event.stopPropagation(); if (!usable) return; setHovered(false); void preloadSystemRunner(); enterGameMode(); openTerminal(); }}>
          <planeGeometry args={MONITOR_GLASS.size} />
          <meshBasicMaterial visible={false} />
        </mesh>
      </group>
    </group>
  );
}
