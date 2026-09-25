import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { CanvasTexture, Frustum, Matrix4, MeshPhysicalMaterial, SRGBColorSpace } from "three";
import { isDistrictMode, isTerminalMode, type SceneMode } from "./SceneTransition";
import { DASHBOARD_CENTRE } from "./terminalGeometry";
import { TIER_SETTINGS, useTier } from "./quality";

/** The left monitor's ambient operations dashboard: environmental storytelling,
 * not an interface. One continuous layout (system map, build log, load and
 * throughput, service health) whose emphasis drifts slowly between panels.
 * Everything is a pure function of time, painted into a small canvas. */

/** Beyond this the panel is a few pixels wide; it holds its last frame. */
const WATCH = 8;

const INK = {
  ground: "#0a0d11", panel: "#0e1318", header: "#11161c", rule: "rgba(120,190,210,.12)", ruleLit: "rgba(127,214,230,.34)",
  dim: "#56666f", text: "#8fa3ac", bright: "#d3e2e6", cyan: "#6fc6d8", green: "#6fb08a", violet: "#9a88e6", amber: "#d0a45a",
};
const MONO = "Menlo, ui-monospace, monospace";

const NODES: { id: string; x: number; y: number }[] = [
  { id: "edge", x: .08, y: .52 }, { id: "api", x: .3, y: .3 }, { id: "auth", x: .3, y: .76 },
  { id: "cache", x: .55, y: .16 }, { id: "queue", x: .55, y: .5 }, { id: "db", x: .55, y: .84 },
  { id: "search", x: .8, y: .24 }, { id: "worker", x: .8, y: .58 }, { id: "store", x: .86, y: .86 },
];
const EDGES: [number, number][] = [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [1, 5], [4, 7], [3, 6], [7, 8], [5, 8], [4, 6], [2, 4]];

const LOG: [string, string][] = [
  ["dim", "$ make release"], ["text", "> building project..."], ["text", "> compiling 148 modules"], ["green", "> tests: 212 passed"],
  ["green", "> build passed in 41.2s"], ["amber", "> checking services..."], ["green", "> api auth db cache: ok"],
  ["text", "> deploying to staging"], ["green", "> deployment ready"],
];
const SERVICES = ["api", "auth", "db", "cache", "queue", "search"];
const TABS = ["SYSTEM MAP", "BUILD STATUS", "NETWORK ACTIVITY"];

const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
/** Smooth, never-repeating-looking load curve from a few incommensurate sines. */
const wave = (t: number, seed: number) => .5 + .22 * Math.sin(t * .7 + seed) + .12 * Math.sin(t * 1.9 + seed * 2.3) + .06 * Math.sin(t * 4.3 + seed * 5.1);

function panel(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, title: string, lit: number) {
  c.fillStyle = INK.panel;
  c.beginPath(); c.roundRect(x, y, w, h, 5); c.fill();
  c.strokeStyle = INK.rule; c.lineWidth = 1; c.stroke();
  if (lit > .01) { c.globalAlpha = lit; c.strokeStyle = INK.ruleLit; c.stroke(); c.globalAlpha = 1; }
  c.font = `600 10px ${MONO}`; c.fillStyle = lit > .5 ? INK.text : INK.dim; c.textBaseline = "middle";
  c.fillText(title, x + 10, y + 12);
}

export function paintDashboard(canvas: HTMLCanvasElement, t: number) {
  const c = canvas.getContext("2d")!;
  const { width: w, height: h } = canvas;
  c.fillStyle = INK.ground; c.fillRect(0, 0, w, h);

  // Emphasis drifts across three panels every 9 s, crossfading over 1.5 s.
  const cycle = t / 9, focus = Math.floor(cycle) % 3, blend = Math.min(1, (cycle % 1) * 6);
  const emphasis = (i: number) => i === focus ? blend : i === (focus + 2) % 3 ? 1 - blend : 0;

  c.fillStyle = INK.header; c.fillRect(0, 0, w, 26);
  c.textBaseline = "middle"; c.font = `600 11px ${MONO}`;
  c.fillStyle = INK.dim; c.fillText("ops / overview", 12, 13);
  let tx = 150;
  TABS.forEach((tab, i) => {
    const e = emphasis(i);
    c.fillStyle = e > .5 ? INK.text : INK.dim; c.fillText(tab, tx, 13);
    const tw = c.measureText(tab).width;
    if (e > .01) { c.globalAlpha = e; c.fillStyle = INK.cyan; c.fillRect(tx, 23, tw, 2); c.globalAlpha = 1; }
    tx += tw + 22;
  });
  c.fillStyle = INK.green; c.beginPath(); c.arc(w - 88, 13, 3.5, 0, Math.PI * 2); c.fill();
  c.fillStyle = INK.dim; c.fillText("nominal", w - 78, 13);

  // System map: a small service graph; packets hop along edges and the
  // receiving node brightens briefly.
  const map = { x: 10, y: 34, w: 360, h: 214 };
  panel(c, map.x, map.y, map.w, map.h, "SYSTEM MAP", emphasis(0));
  const at = (i: number) => [map.x + 24 + NODES[i].x * (map.w - 48), map.y + 34 + NODES[i].y * (map.h - 58)];
  c.strokeStyle = "rgba(143,163,172,.34)"; c.lineWidth = 1.2;
  for (const [a, b] of EDGES) { const [ax, ay] = at(a), [bx, by] = at(b); c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke(); }
  const glow = new Array(NODES.length).fill(0);
  const gap = .55, travel = 1.1;
  for (let k = Math.floor(t / gap) - 4; k <= Math.floor(t / gap); k++) {
    const age = t - k * gap;
    if (age < 0) continue;
    const [a, b] = EDGES[Math.floor(hash(k) * EDGES.length)];
    const [from, to] = hash(k + .5) > .5 ? [a, b] : [b, a];
    if (age < travel) {
      const p = age / travel, [ax, ay] = at(from), [bx, by] = at(to);
      c.fillStyle = hash(k + .25) > .82 ? INK.violet : INK.cyan;
      c.beginPath(); c.arc(ax + (bx - ax) * p, ay + (by - ay) * p, 2.6, 0, Math.PI * 2); c.fill();
    } else glow[to] = Math.max(glow[to], 1 - (age - travel) / 1.2);
  }
  c.font = `500 10px ${MONO}`;
  NODES.forEach((node, i) => {
    const [x, y] = at(i), g = Math.max(0, glow[i]);
    c.fillStyle = INK.panel; c.beginPath(); c.arc(x, y, 7, 0, Math.PI * 2); c.fill();
    c.strokeStyle = g > 0 ? `rgba(111,198,216,${.55 + .45 * g})` : "rgba(143,163,172,.6)"; c.lineWidth = 1.5; c.stroke();
    c.fillStyle = g > 0 ? `rgba(111,198,216,${.35 + .65 * g})` : "rgba(111,198,216,.35)";
    c.beginPath(); c.arc(x, y, 2.6, 0, Math.PI * 2); c.fill();
    c.fillStyle = INK.dim; c.fillText(node.id, x + 11, y + 1);
  });

  // Load: CPU and memory traces over the last minute.
  const load = { x: 380, y: 34, w: 250, h: 96 };
  panel(c, load.x, load.y, load.w, load.h, "LOAD", emphasis(1) * .5);
  const traces: [string, string, number, number][] = [["cpu", INK.cyan, 1.3, .9], ["mem", INK.violet, 4.1, .35]];
  traces.forEach(([label, colour, seed, swing], row) => {
    const gx = load.x + 44, gw = load.w - 58, gy = load.y + 26 + row * 34, gh = 26;
    c.strokeStyle = colour; c.lineWidth = 1.25; c.beginPath();
    for (let i = 0; i <= 48; i++) {
      const v = .5 + (wave(t * .5 - (48 - i) * .12, seed) - .5) * swing;
      const x = gx + (i / 48) * gw, y = gy + gh - v * gh;
      if (i) c.lineTo(x, y); else c.moveTo(x, y);
    }
    c.stroke();
    const now = Math.round((.5 + (wave(t * .5, seed) - .5) * swing) * 100);
    c.fillStyle = INK.dim; c.font = `500 10px ${MONO}`; c.fillText(label, load.x + 10, gy + 8);
    c.fillStyle = INK.text; c.fillText(`${now}%`, load.x + 10, gy + 21);
  });

  // Throughput: a slow waveform, filled.
  const net = { x: 380, y: 138, w: 250, h: 110 };
  panel(c, net.x, net.y, net.w, net.h, "THROUGHPUT", emphasis(2));
  const base = net.y + net.h - 12, span = net.h - 38;
  const sample = (i: number) => base - span * (.25 + .6 * wave(t * .8 - (60 - i) * .09, 7.7) * (.8 + .2 * Math.sin(i * .9 + t * 3)));
  c.beginPath(); c.moveTo(net.x + 10, base);
  for (let i = 0; i <= 60; i++) c.lineTo(net.x + 10 + (i / 60) * (net.w - 20), sample(i));
  c.lineTo(net.x + net.w - 10, base); c.closePath();
  c.fillStyle = "rgba(154,136,230,.16)"; c.fill();
  c.beginPath();
  for (let i = 0; i <= 60; i++) { const x = net.x + 10 + (i / 60) * (net.w - 20); if (i) c.lineTo(x, sample(i)); else c.moveTo(x, sample(i)); }
  c.strokeStyle = INK.violet; c.lineWidth = 1.25; c.stroke();
  c.fillStyle = INK.text; c.font = `500 10px ${MONO}`;
  c.fillText(`${(1.2 + wave(t * .8, 7.7) * 1.6).toFixed(1)} GB/s`, net.x + net.w - 74, net.y + 12);

  // Build log: a new line every 1.3 s, the newest typed in with a cursor.
  const log = { x: 10, y: 256, w: 360, h: 92 };
  panel(c, log.x, log.y, log.w, log.h, "BUILD", emphasis(1));
  const step = 1.3, n = Math.floor(t / step), typed = Math.min(1, (t % step) / .45);
  c.font = `500 11px ${MONO}`;
  for (let row = 0; row < 4; row++) {
    const index = n - 3 + row;
    if (index < 0) continue;
    const [tone, text] = LOG[index % LOG.length];
    const shown = row === 3 ? text.slice(0, Math.ceil(text.length * typed)) : text;
    c.fillStyle = INK[tone as keyof typeof INK];
    c.globalAlpha = row === 3 ? 1 : .55 + row * .12;
    c.fillText(shown, log.x + 12, log.y + 30 + row * 16);
    if (row === 3 && (typed < 1 || Math.floor(t * 2) % 2 === 0)) c.fillRect(log.x + 13 + c.measureText(shown).width, log.y + 24 + row * 16, 6, 12);
  }
  c.globalAlpha = 1;

  // Services: steady green, with the queue briefly degraded once a minute.
  const svc = { x: 380, y: 256, w: 250, h: 92 };
  panel(c, svc.x, svc.y, svc.w, svc.h, "SERVICES", 0);
  c.font = `500 10px ${MONO}`;
  SERVICES.forEach((name, i) => {
    const x = svc.x + 14 + (i % 3) * 80, y = svc.y + 38 + Math.floor(i / 3) * 26;
    const degraded = name === "queue" && t % 60 > 38 && t % 60 < 45;
    c.fillStyle = degraded ? INK.amber : INK.green;
    c.globalAlpha = degraded ? .6 + .4 * Math.sin(t * 5) : 1;
    c.beginPath(); c.arc(x + 3, y, 3.2, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 1;
    c.fillStyle = INK.text; c.fillText(name, x + 12, y + 1);
  });
}

/** The dashboard's screen material and its cadence. It repaints at the quality tier's monitor rate, and
 * asks for frames itself, only while the panel is near and in view; far off,
 * in a district, at the terminal or in a hidden tab it holds its last frame.
 * Reduced-motion visitors get one still frame. */
export function useSystemsDashboard(mode: SceneMode) {
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const screen = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 640; canvas.height = 358;
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 8;
    const material = new MeshPhysicalMaterial({ color: "#5c5c5c", map: texture, emissiveMap: texture, emissive: "#ffffff", emissiveIntensity: .42, roughness: .66, specularIntensity: .2, envMapIntensity: .5 });
    const paint = (t: number) => { paintDashboard(canvas, t); texture.needsUpdate = true; };
    paint(20);
    return { material, paint, dispose: () => { texture.dispose(); material.dispose(); } };
  }, []);
  useEffect(() => () => screen.dispose(), [screen]);

  const watched = useRef(false);
  const last = useRef(0);
  const view = useMemo(() => ({ frustum: new Frustum(), matrix: new Matrix4() }), []);
  const still = useRef(true);
  const resting = !isDistrictMode(mode) && !isTerminalMode(mode);
  const fps = TIER_SETTINGS[useTier()].monitorFps;
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    still.current = preference.matches;
    const start = performance.now();
    const timer = window.setInterval(() => {
      if (still.current || document.hidden || !watched.current) return;
      last.current = (performance.now() - start) / 1000 + 20;
      invalidate();
    }, 1000 / fps);
    const follow = () => { still.current = preference.matches; };
    preference.addEventListener("change", follow);
    return () => { window.clearInterval(timer); preference.removeEventListener("change", follow); };
  }, [invalidate, fps]);

  const painted = useRef(0);
  useFrame(() => {
    view.matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    view.frustum.setFromProjectionMatrix(view.matrix);
    watched.current = resting && camera.position.distanceTo(DASHBOARD_CENTRE) < WATCH && view.frustum.containsPoint(DASHBOARD_CENTRE);
    if (watched.current && last.current !== painted.current) { painted.current = last.current; screen.paint(last.current); }
  });
  return screen.material;
}
