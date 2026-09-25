import { CanvasTexture, NearestFilter, SRGBColorSpace } from "three";
import type { FrameSpec } from "../roomLayout";

/** Original artwork for the framed pieces, drawn once into canvases: an
 * engineering blueprint, an orbital-transfer print, a pixel-art launch and a
 * chess study. Each is sized to its frame's proportions. */

type Draw = (c: CanvasRenderingContext2D, w: number, h: number) => void;

const blueprint: Draw = (c, w, h) => {
  c.fillStyle = "#18304f"; c.fillRect(0, 0, w, h);
  c.strokeStyle = "rgba(170,200,235,.16)"; c.lineWidth = 1;
  for (let x = 0; x < w; x += 24) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
  for (let y = 0; y < h; y += 24) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
  c.strokeStyle = "#dce8f5"; c.fillStyle = "#dce8f5"; c.lineWidth = 3;
  c.strokeRect(22, 22, w - 44, h - 44);
  // A two-link arm: base, shoulder, elbow, gripper, drawn as plan and joints.
  const gear = (cx: number, cy: number, r: number, teeth: number) => {
    c.beginPath();
    for (let i = 0; i <= teeth * 2; i++) {
      const a = i / (teeth * 2) * Math.PI * 2, rr = i % 2 ? r : r * .86;
      c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    c.stroke();
    c.beginPath(); c.arc(cx, cy, r * .28, 0, Math.PI * 2); c.stroke();
  };
  const base = [w * .26, h * .72], elbow = [w * .46, h * .34], wrist = [w * .7, h * .42];
  c.lineWidth = 4;
  c.strokeRect(base[0] - 70, base[1] + 26, 140, 34);
  for (const [a, b] of [[base, elbow], [elbow, wrist]]) {
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy), nx = -dy / len * 18, ny = dx / len * 18;
    c.beginPath(); c.moveTo(a[0] + nx, a[1] + ny); c.lineTo(b[0] + nx, b[1] + ny); c.moveTo(a[0] - nx, a[1] - ny); c.lineTo(b[0] - nx, b[1] - ny); c.stroke();
  }
  c.lineWidth = 3;
  gear(base[0], base[1], 46, 14); gear(elbow[0], elbow[1], 34, 11); gear(wrist[0], wrist[1], 24, 9);
  c.beginPath(); c.moveTo(wrist[0] + 20, wrist[1] - 18); c.lineTo(wrist[0] + 62, wrist[1] - 28); c.moveTo(wrist[0] + 20, wrist[1] + 18); c.lineTo(wrist[0] + 62, wrist[1] + 28); c.stroke();
  // Dimension lines and a reach arc.
  c.setLineDash([10, 8]); c.lineWidth = 2;
  c.beginPath(); c.arc(base[0], base[1], Math.hypot(wrist[0] - base[0], wrist[1] - base[1]), -1.2, -.05); c.stroke();
  c.setLineDash([]);
  c.beginPath(); c.moveTo(base[0], h * .9); c.lineTo(wrist[0], h * .9); c.stroke();
  for (const x of [base[0], wrist[0]]) { c.beginPath(); c.moveTo(x, h * .88); c.lineTo(x, h * .92); c.stroke(); }
  c.font = "600 20px Menlo, monospace"; c.textAlign = "center";
  c.fillText("REACH 620", (base[0] + wrist[0]) / 2, h * .9 - 10);
  // Title block.
  const tx = w - 300, ty = h - 120;
  c.strokeRect(tx, ty, 270, 90);
  c.beginPath(); c.moveTo(tx, ty + 45); c.lineTo(tx + 270, ty + 45); c.moveTo(tx + 150, ty + 45); c.lineTo(tx + 150, ty + 90); c.stroke();
  c.textAlign = "left"; c.font = "700 24px Menlo, monospace"; c.fillText("ARM-02  PLANAR", tx + 14, ty + 31);
  c.font = "500 18px Menlo, monospace"; c.fillText("SCALE 1:4", tx + 14, ty + 74); c.fillText("REV C", tx + 164, ty + 74);
};

const orbits: Draw = (c, w, h) => {
  c.fillStyle = "#e8e0cc"; c.fillRect(0, 0, w, h);
  const cx = w / 2, cy = h * .44;
  c.strokeStyle = "#2c2a27"; c.lineWidth = 2;
  for (const r of [70, 128, 196, 262]) { c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke(); }
  // Transfer ellipse from the second orbit to the fourth.
  c.strokeStyle = "#b8452f"; c.lineWidth = 4; c.setLineDash([14, 10]);
  c.beginPath(); c.ellipse(cx - (262 - 128) / 2, cy, (262 + 128) / 2, Math.sqrt(262 * 128), 0, 0, Math.PI); c.stroke();
  c.setLineDash([]);
  c.fillStyle = "#d48a2c"; c.beginPath(); c.arc(cx, cy, 30, 0, Math.PI * 2); c.fill();
  for (const [r, a, s, col] of [[70, 2.2, 8, "#5b6d7a"], [128, 0, 12, "#3f6c8f"], [196, 4.1, 10, "#8f5a3f"], [262, Math.PI, 16, "#6a5a86"]] as const) {
    c.fillStyle = col; c.beginPath(); c.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, s, 0, Math.PI * 2); c.fill();
  }
  c.fillStyle = "#2c2a27"; c.textAlign = "center";
  c.font = "600 38px Georgia, serif"; c.fillText("TRANSFER", cx, h * .86);
  c.font = "400 20px Georgia, serif"; c.fillText("Δv₁ + Δv₂   ·   t = π√(a³/μ)", cx, h * .91);
};

const pixel: Draw = (c, w, h) => {
  const n = 32, px = w / n;
  const grid = document.createElement("canvas");
  grid.width = n; grid.height = n;
  const g = grid.getContext("2d")!;
  for (let y = 0; y < n; y++) { g.fillStyle = `rgb(${26 + y * 2},${18 + y},${58 + y * 2})`; g.fillRect(0, y, n, 1); }
  for (const [x, y] of [[3, 3], [9, 6], [26, 4], [29, 11], [5, 13], [21, 2], [15, 8]]) { g.fillStyle = "#f4efd2"; g.fillRect(x, y, 1, 1); }
  g.fillStyle = "#f0a44a"; g.fillRect(22, 6, 5, 5); g.fillStyle = "#f7cf7a"; g.fillRect(23, 7, 2, 2);
  g.fillStyle = "#39304f"; g.fillRect(0, 26, n, 6);
  g.fillStyle = "#4a3f66"; for (const [x, hh] of [[0, 3], [4, 5], [9, 2], [20, 4], [25, 6], [29, 3]]) g.fillRect(x, 26 - hh, 4, hh);
  // Rocket on its pad, with a plume.
  g.fillStyle = "#6d6a7a"; g.fillRect(12, 25, 8, 1);
  g.fillStyle = "#e8e4dc"; g.fillRect(15, 12, 2, 11); g.fillRect(14, 15, 4, 8);
  g.fillStyle = "#c8463a"; g.fillRect(15, 10, 2, 2); g.fillRect(13, 20, 1, 3); g.fillRect(18, 20, 1, 3);
  g.fillStyle = "#5fa3c8"; g.fillRect(15, 15, 2, 2);
  g.fillStyle = "#f6c14e"; g.fillRect(15, 23, 2, 2); g.fillStyle = "#f08a3a"; g.fillRect(14, 24, 4, 1);
  c.imageSmoothingEnabled = false;
  c.drawImage(grid, 0, 0, n * px, n * px * h / w);
};

const chess: Draw = (c, w, h) => {
  c.fillStyle = "#1b1a1f"; c.fillRect(0, 0, w, h);
  // A receding board.
  const top = h * .62, bottom = h * .98, rows = 5, cols = 8;
  for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
    const t0 = r / rows, t1 = (r + 1) / rows;
    const y0 = top + (bottom - top) * t0 * t0, y1 = top + (bottom - top) * t1 * t1;
    const s0 = .45 + .55 * t0, s1 = .45 + .55 * t1;
    const x = (i: number, s: number) => w / 2 + (i / cols - .5) * w * 1.1 * s;
    c.fillStyle = (r + q) % 2 ? "#c9b98f" : "#2f2d33";
    c.beginPath(); c.moveTo(x(q, s0), y0); c.lineTo(x(q + 1, s0), y0); c.lineTo(x(q + 1, s1), y1); c.lineTo(x(q, s1), y1); c.fill();
  }
  // Knight silhouette.
  c.fillStyle = "#d6b25e";
  const k = (x: number, y: number): [number, number] => [w * .5 + (x - .5) * w * .52, h * .08 + y * h * .56];
  const path: [number, number][] = [[.22, .98], [.78, .98], [.72, .86], [.64, .82], [.62, .6], [.74, .5], [.8, .42], [.74, .3], [.6, .16], [.52, .04], [.46, .14], [.36, .16], [.24, .3], [.2, .44], [.3, .48], [.42, .42], [.46, .5], [.34, .66], [.3, .82], [.26, .86]];
  c.beginPath(); path.forEach(([x, y], i) => { const [px, py] = k(x, y); if (i) c.lineTo(px, py); else c.moveTo(px, py); }); c.closePath(); c.fill();
  c.fillStyle = "#1b1a1f"; const [ex, ey] = k(.52, .24); c.beginPath(); c.arc(ex, ey, w * .012, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#d6b25e"; c.font = "500 26px Georgia, serif"; c.textAlign = "center"; c.fillText("1. Nf3", w / 2, h * .06 + 20);
};

/** Football: a tactics board from the goalkeeper's end, a back four and the
 * keeper's lines of distribution chalked on. */
const pitch: Draw = (c, w, h) => {
  c.fillStyle = "#16301f"; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? "rgba(255,255,255,.025)" : "rgba(0,0,0,.05)"; c.fillRect(i * w / 8, 0, w / 8, h); }
  const m = w * .06, x0 = m, y0 = m, pw = w - 2 * m, ph = h - 2 * m;
  c.strokeStyle = "rgba(238,242,232,.85)"; c.lineWidth = 3;
  c.strokeRect(x0, y0, pw, ph);
  c.beginPath(); c.moveTo(x0 + pw / 2, y0); c.lineTo(x0 + pw / 2, y0 + ph); c.stroke();
  c.beginPath(); c.arc(x0 + pw / 2, y0 + ph / 2, ph * .17, 0, Math.PI * 2); c.stroke();
  for (const side of [0, 1]) {
    const bx = side ? x0 + pw : x0, dir = side ? -1 : 1;
    c.strokeRect(Math.min(bx, bx + dir * pw * .16), y0 + ph * .2, pw * .16, ph * .6);
    c.strokeRect(Math.min(bx, bx + dir * pw * .06), y0 + ph * .36, pw * .06, ph * .28);
    c.beginPath(); c.arc(bx + dir * pw * .11, y0 + ph / 2, ph * .15, side ? Math.PI - .9 : -.9 + Math.PI * 2, side ? Math.PI + .9 : .9, false); c.stroke();
  }
  const dot = (x: number, y: number, colour: string, r = w * .016) => { c.fillStyle = colour; c.beginPath(); c.arc(x0 + pw * x, y0 + ph * y, r, 0, Math.PI * 2); c.fill(); };
  // The keeper, ringed in amber, and the back four.
  dot(.035, .5, "#f0b44a", w * .02);
  c.strokeStyle = "#f0b44a"; c.lineWidth = 2.5; c.beginPath(); c.arc(x0 + pw * .035, y0 + ph * .5, w * .032, 0, Math.PI * 2); c.stroke();
  for (const y of [.18, .4, .6, .82]) dot(.2, y, "#e9ede4");
  for (const y of [.3, .5, .7]) dot(.42, y, "#e9ede4");
  for (const y of [.25, .5, .75]) dot(.64, y, "#e9ede4");
  // Distribution: a long ball and a short roll, with arrowheads.
  c.setLineDash([12, 9]); c.lineWidth = 3;
  const arrow = (fx: number, fy: number, tx: number, ty: number, bend: number) => {
    const ax = x0 + pw * fx, ay = y0 + ph * fy, bx = x0 + pw * tx, by = y0 + ph * ty;
    c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 - ph * bend, bx, by); c.stroke();
    const a = Math.atan2(by - ((ay + by) / 2 - ph * bend), bx - (ax + bx) / 2);
    c.setLineDash([]); c.beginPath(); c.moveTo(bx, by); c.lineTo(bx - 16 * Math.cos(a - .5), by - 16 * Math.sin(a - .5)); c.moveTo(bx, by); c.lineTo(bx - 16 * Math.cos(a + .5), by - 16 * Math.sin(a + .5)); c.stroke(); c.setLineDash([12, 9]);
  };
  c.strokeStyle = "#f0b44a"; arrow(.05, .5, .62, .26, .22); arrow(.05, .5, .19, .82, -.04);
  c.setLineDash([]);
};

/** Flute: a measured drawing of a concert flute, head joint to foot, keys in plan. */
const fluteDrawing: Draw = (c, w, h) => {
  c.fillStyle = "#172a45"; c.fillRect(0, 0, w, h);
  c.strokeStyle = "rgba(170,200,235,.12)"; c.lineWidth = 1;
  for (let x = 0; x < w; x += 20) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
  for (let y = 0; y < h; y += 20) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
  c.strokeStyle = "#dce8f5"; c.fillStyle = "#dce8f5"; c.lineWidth = 2.5;
  const x0 = w * .07, x1 = w * .93, cy = h * .44, r = h * .06;
  c.strokeRect(x0, cy - r, x1 - x0, r * 2);
  // Joints, lip plate and the keys along the body.
  for (const x of [.3, .78]) { c.beginPath(); c.moveTo(x0 + (x1 - x0) * x, cy - r * 1.25); c.lineTo(x0 + (x1 - x0) * x, cy + r * 1.25); c.stroke(); }
  c.beginPath(); c.ellipse(x0 + (x1 - x0) * .12, cy - r * .2, r * .9, r * .55, 0, 0, Math.PI * 2); c.stroke();
  for (let i = 0; i < 13; i++) {
    const x = x0 + (x1 - x0) * (.36 + i * .034);
    c.beginPath(); c.arc(x, cy, r * (i % 4 === 3 ? .45 : .6), 0, Math.PI * 2); c.stroke();
    if (i % 3 === 0) { c.beginPath(); c.arc(x, cy, r * .18, 0, Math.PI * 2); c.fill(); }
  }
  c.beginPath(); c.moveTo(x0 + (x1 - x0) * .35, cy + r * 1.6); c.lineTo(x0 + (x1 - x0) * .8, cy + r * 1.6); c.stroke();
  c.setLineDash([8, 6]); c.beginPath(); c.moveTo(x0, cy + r * 3); c.lineTo(x1, cy + r * 3); c.stroke(); c.setLineDash([]);
  for (const x of [x0, x1]) { c.beginPath(); c.moveTo(x, cy + r * 2.6); c.lineTo(x, cy + r * 3.4); c.stroke(); }
  c.font = "600 18px Menlo, monospace"; c.textAlign = "center"; c.fillText("C FLUTE  ·  L 670", w / 2, cy + r * 3 - 10);
  c.textAlign = "left"; c.font = "700 20px Menlo, monospace"; c.fillText("HEAD", x0, cy - r * 2.2); c.fillText("BODY", x0 + (x1 - x0) * .5, cy - r * 2.2); c.fillText("FOOT", x0 + (x1 - x0) * .82, cy - r * 2.2);
};

/** Fiction: a typed manuscript page mid-draft, with red pen through it. */
const manuscriptPage: Draw = (c, w, h) => {
  c.fillStyle = "#efe8d8"; c.fillRect(0, 0, w, h);
  c.fillStyle = "#2b2824"; c.textAlign = "center"; c.font = `600 ${Math.round(w * .045)}px Georgia, serif`;
  c.fillText("CHAPTER ONE", w / 2, h * .12);
  c.font = `italic ${Math.round(w * .032)}px Georgia, serif`; c.fillText("draft 4", w / 2, h * .165);
  // Lines of typescript as short dark strokes, paragraph by paragraph.
  let y = h * .23, seed = 7;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let line = 0; line < 22; line++) {
    const indent = line % 6 === 0 ? w * .08 : 0, end = line % 6 === 5 ? .45 + rand() * .3 : .9;
    let x = w * .1 + indent;
    c.fillStyle = "rgba(43,40,36,.78)";
    while (x < w * end) { const word = w * (.025 + rand() * .07); c.fillRect(x, y, Math.min(word, w * end - x), h * .007); x += word + w * .018; }
    y += h * .031;
    if (line % 6 === 5) y += h * .012;
  }
  // Red pen: two strike-throughs, a caret and a margin note.
  c.strokeStyle = "#b23a2c"; c.lineWidth = 2.4;
  c.beginPath(); c.moveTo(w * .22, h * .305); c.lineTo(w * .6, h * .3); c.stroke();
  c.beginPath(); c.moveTo(w * .14, h * .6); c.lineTo(w * .44, h * .605); c.stroke();
  c.beginPath(); c.moveTo(w * .5, h * .45); c.lineTo(w * .53, h * .425); c.lineTo(w * .56, h * .45); c.stroke();
  c.font = `italic ${Math.round(w * .036)}px Georgia, serif`; c.fillStyle = "#b23a2c"; c.textAlign = "left";
  c.fillText("tighter?", w * .66, h * .62);
  c.beginPath(); c.ellipse(w * .8, h * .455, w * .1, h * .03, -.1, 0, Math.PI * 2); c.stroke();
};

/** Chess: a pixel knight on a sliver of board, the mover of the room's openings. */
const knight: Draw = (c, w, h) => {
  const cell = Math.floor(Math.min(w / 22, h / 18));
  const ox = Math.floor((w - cell * 22) / 2), oy = Math.floor((h - cell * 18) / 2);
  c.fillStyle = "#1b1936"; c.fillRect(0, 0, w, h);
  for (let x = 0; x < 22; x++) for (let y = 14; y < 18; y++) { c.fillStyle = (x + y) % 2 ? "#c9b48c" : "#6b5236"; c.fillRect(ox + x * cell, oy + y * cell, cell, cell); }
  const art = [
    "......##......",
    ".....####.....",
    "....#######...",
    "...#########..",
    "..####o######.",
    "..##########..",
    ".#####..####..",
    ".###....####..",
    "........####..",
    ".......#####..",
    "......######..",
    ".....#######..",
    "....#########.",
    "...###########",
  ];
  art.forEach((row, y) => [...row].forEach((pixel, x) => {
    if (pixel === ".") return;
    c.fillStyle = pixel === "o" ? "#1b1936" : x + y < 12 ? "#f4efe4" : "#d9d1c0";
    c.fillRect(ox + (x + 4) * cell, oy + (y + 0) * cell, cell, cell);
  }));
  c.fillStyle = "#9c8cff"; for (const [x, y] of [[2, 2], [19, 3], [17, 8], [3, 9]]) c.fillRect(ox + x * cell, oy + y * cell, cell, cell);
};

/** Research: a message-passing graph, the shape behind both papers' models:
 * nodes and edges, one node's neighbourhood lit in violet. */
const network: Draw = (c, w, h) => {
  const gradient = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * .7);
  gradient.addColorStop(0, "#1c1838"); gradient.addColorStop(1, "#0b0c16");
  c.fillStyle = gradient; c.fillRect(0, 0, w, h);
  let seed = 11;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const nodes = Array.from({ length: 26 }, () => [w * (.1 + rand() * .8), h * (.1 + rand() * .8)] as [number, number]);
  const centre = 7;
  nodes.forEach((a, i) => nodes.forEach((b, j) => {
    if (j <= i) return;
    const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    if (d > w * .24) return;
    const lit = i === centre || j === centre;
    c.strokeStyle = lit ? "rgba(170,150,255,.9)" : "rgba(160,175,210,.22)"; c.lineWidth = lit ? 2.4 : 1.2;
    c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.stroke();
  }));
  nodes.forEach(([x, y], i) => {
    const near = Math.hypot(x - nodes[centre][0], y - nodes[centre][1]) < w * .24;
    c.fillStyle = i === centre ? "#c9b8ff" : near ? "#8f7cff" : "#5b6788";
    c.beginPath(); c.arc(x, y, i === centre ? w * .03 : w * .016, 0, Math.PI * 2); c.fill();
  });
  c.strokeStyle = "rgba(201,184,255,.5)"; c.lineWidth = 1.5;
  c.beginPath(); c.arc(...nodes[centre], w * .24, 0, Math.PI * 2); c.stroke();
};

/** A pencil technical sketch of a 2 × 4 brick, with dimensions. */
const brickSketch: Draw = (c, w, h) => {
  c.fillStyle = "#efeadf"; c.fillRect(0, 0, w, h);
  c.strokeStyle = "#4a4a4e"; c.lineWidth = 2;
  const x0 = w * .2, y0 = h * .45, bw = w * .6, bh = h * .16, dx = w * .12, dy = -h * .08;
  c.strokeRect(x0, y0, bw, bh);
  c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + dx, y0 + dy); c.lineTo(x0 + bw + dx, y0 + dy); c.lineTo(x0 + bw, y0); c.moveTo(x0 + bw + dx, y0 + dy); c.lineTo(x0 + bw + dx, y0 + bh + dy); c.lineTo(x0 + bw, y0 + bh); c.stroke();
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
    const sx = x0 + bw * (.125 + i * .25) + dx * (.25 + j * .5), sy = y0 + dy * (.25 + j * .5);
    c.beginPath(); c.ellipse(sx, sy - 6, bw * .07, 5, 0, 0, Math.PI * 2); c.stroke();
  }
  c.setLineDash([6, 5]); c.beginPath(); c.moveTo(x0, y0 + bh + 30); c.lineTo(x0 + bw, y0 + bh + 30); c.stroke(); c.setLineDash([]);
  c.fillStyle = "#4a4a4e"; c.font = "italic 24px Georgia, serif"; c.textAlign = "center";
  c.fillText("31.8", x0 + bw / 2, y0 + bh + 58); c.fillText("2 × 4", w / 2, h * .2);
};

/** Handwritten flute stave: five lines and a phrase of notes. */
const stave: Draw = (c, w, h) => {
  c.fillStyle = "#f1ebdc"; c.fillRect(0, 0, w, h);
  c.strokeStyle = "#3a3632"; c.lineWidth = 1.6;
  const top = h * .34, gap = h * .07;
  for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(w * .06, top + i * gap); c.lineTo(w * .94, top + i * gap); c.stroke(); }
  c.fillStyle = "#3a3632"; c.font = `${gap * 5.2}px Georgia, serif`; c.fillText("𝄞", w * .07, top + gap * 4.2);
  const notes = [5, 4, 3, 4, 5, 5, 5, 4, 4, 4, 5, 7, 7];
  notes.forEach((step, i) => {
    const x = w * (.2 + i * .058), y = top + gap * 4 - step * gap / 2;
    c.beginPath(); c.ellipse(x, y, gap * .55, gap * .4, -.4, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(x + gap * .5, y); c.lineTo(x + gap * .5, y - gap * 3); c.stroke();
  });
  c.font = "italic 26px Georgia, serif"; c.fillText("flute, practice", w * .06, h * .88);
};

/** Layered waveforms: a generative print in violet and teal. */
const waves: Draw = (c, w, h) => {
  const gradient = c.createLinearGradient(0, 0, 0, h); gradient.addColorStop(0, "#1a1430"); gradient.addColorStop(1, "#0d1a22");
  c.fillStyle = gradient; c.fillRect(0, 0, w, h);
  for (let k = 0; k < 14; k++) {
    c.strokeStyle = `hsla(${250 - k * 9}, 70%, ${55 + k * 1.5}%, ${.35 + k * .04})`; c.lineWidth = 2;
    c.beginPath();
    for (let x = 0; x <= w; x += 6) {
      const y = h * (.18 + k * .05) + Math.sin(x / w * Math.PI * (2 + k * .3) + k) * h * .04 * Math.sin(x / w * Math.PI);
      if (x) c.lineTo(x, y); else c.moveTo(x, y);
    }
    c.stroke();
  }
};

type PaintedArt = FrameSpec["art"];
const ART: Record<PaintedArt, { draw: Draw; pixel?: boolean }> = {
  blueprint: { draw: blueprint }, orbits: { draw: orbits }, pixel: { draw: pixel, pixel: true }, chess: { draw: chess },
  pitch: { draw: pitch }, flute: { draw: fluteDrawing }, manuscript: { draw: manuscriptPage }, network: { draw: network },
  knight: { draw: knight, pixel: true }, brickSketch: { draw: brickSketch }, stave: { draw: stave }, waves: { draw: waves },
};

/** Canvases are sized to how large a frame reads on screen: small pieces 512. */
export function paintArtwork(art: PaintedArt, aspect: number, maxAnisotropy: number, size = 1024) {
  const canvas = document.createElement("canvas");
  canvas.width = aspect >= 1 ? size : Math.round(size * aspect);
  canvas.height = aspect >= 1 ? Math.round(size / aspect) : size;
  ART[art].draw(canvas.getContext("2d")!, canvas.width, canvas.height);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = Math.min(8, maxAnisotropy);
  if (ART[art].pixel) texture.magFilter = NearestFilter;
  return texture;
}

/** Soft shadow card: dark at the centre, feathered to nothing at the edges,
 * laid on the wall behind each frame. */
export function paintFrameShadow() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const c = canvas.getContext("2d")!;
  c.filter = "blur(10px)";
  c.fillStyle = "rgba(0,0,0,1)";
  c.fillRect(22, 22, 84, 84);
  return new CanvasTexture(canvas);
}

/** The television's home screen: an original, quiet ambient layout (a soft
 * aurora, a row of abstract tiles and a status dot), nothing from any real
 * console's interface or any game. */
export function paintHomeScreen() {
  const canvas = document.createElement("canvas");
  canvas.width = 512; canvas.height = 288;
  const c = canvas.getContext("2d")!;
  const w = canvas.width, h = canvas.height;
  const base = c.createLinearGradient(0, 0, w, h);
  base.addColorStop(0, "#0b0d1c"); base.addColorStop(1, "#12102a");
  c.fillStyle = base; c.fillRect(0, 0, w, h);
  c.filter = "blur(28px)";
  for (const [x, y, r, colour] of [[.25, .3, 90, "rgba(106,85,230,.55)"], [.7, .22, 80, "rgba(64,170,190,.35)"], [.55, .7, 110, "rgba(150,90,220,.3)"]] as const) {
    c.fillStyle = colour; c.beginPath(); c.arc(x * w, y * h, r, 0, Math.PI * 2); c.fill();
  }
  c.filter = "none";
  const tiles = ["#6a55e6", "#2f8f9d", "#9a5bd6", "#3b4a7a", "#c07a3a"];
  const tw = 70, th = 46, gap = 12, left = (w - (tiles.length * tw + (tiles.length - 1) * gap)) / 2, top = h * .6;
  tiles.forEach((colour, i) => {
    const x = left + i * (tw + gap);
    const g = c.createLinearGradient(x, top, x + tw, top + th);
    g.addColorStop(0, colour); g.addColorStop(1, "rgba(10,10,24,.9)");
    c.fillStyle = g; c.beginPath(); c.roundRect(x, top, tw, th, 7); c.fill();
    if (i === 0) { c.strokeStyle = "rgba(255,255,255,.85)"; c.lineWidth = 2.5; c.stroke(); }
  });
  c.fillStyle = "rgba(235,232,255,.85)";
  c.font = "600 15px system-ui, sans-serif"; c.fillText("ARCADE", left, h * .22);
  c.fillStyle = "rgba(235,232,255,.45)"; c.font = "500 11px system-ui, sans-serif"; c.fillText("SYSTEM READY", left, h * .22 + 18);
  c.fillStyle = "#7de3a0"; c.beginPath(); c.arc(w - left - 5, h * .22 - 5, 4, 0, Math.PI * 2); c.fill();
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** A soft-edged rectangle of light for halos and bias lighting, additive:
 * full in the middle half, falling smoothly to nothing at the edges. */
export function paintGlow() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const c = canvas.getContext("2d")!;
  const image = c.createImageData(size, size);
  const fall = (t: number) => { const d = Math.max(0, Math.abs(t - .5) * 2 - .5) / .5; const k = Math.max(0, 1 - d); return k * k * (3 - 2 * k); };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const v = Math.round(255 * fall((x + .5) / size) * fall((y + .5) / size));
    image.data.set([v, v, v, 255], (y * size + x) * 4);
  }
  c.putImageData(image, 0, 0);
  return new CanvasTexture(canvas);
}

/** A draft page in pencil: a heading, lines of handwriting drawn as loose
 * wavy strokes, one line struck through and a margin note. */
export function paintManuscript() {
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 340;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#efe9dc"; c.fillRect(0, 0, 256, 340);
  c.strokeStyle = "rgba(90,120,170,.22)"; c.lineWidth = 1;
  for (let y = 58; y < 330; y += 18) { c.beginPath(); c.moveTo(14, y); c.lineTo(242, y); c.stroke(); }
  c.strokeStyle = "rgba(190,70,70,.35)"; c.beginPath(); c.moveTo(34, 0); c.lineTo(34, 340); c.stroke();
  c.strokeStyle = "#3a3a44"; c.lineWidth = 1.6; c.lineCap = "round";
  const scribble = (x0: number, x1: number, y: number, seed: number) => {
    c.beginPath(); c.moveTo(x0, y);
    for (let x = x0; x < x1; x += 3) c.lineTo(x, y - 3 - Math.abs(Math.sin(x * .31 + seed)) * 6 + Math.sin(x * .09 + seed) * 1.5);
    c.stroke();
  };
  c.lineWidth = 2.4; scribble(70, 186, 36, 1);
  c.lineWidth = 1.4;
  for (let i = 0; i < 14; i++) {
    const y = 56 + (i + 1) * 18, end = i % 5 === 4 ? 150 + (i * 13) % 50 : 222 - (i * 7) % 24;
    scribble(42, end, y, i * 2.3);
  }
  c.strokeStyle = "#3a3a44"; c.lineWidth = 1.2; c.beginPath(); c.moveTo(42, 56 + 7 * 18 - 5); c.lineTo(200, 56 + 7 * 18 - 7); c.stroke();
  c.strokeStyle = "#5a4fae"; c.lineWidth = 1.2; scribble(180, 236, 28, 4);
  return canvas;
}

/** The phone's lock screen after a CI run: a green tick and the words. */
export function paintBuildPassed() {
  const canvas = document.createElement("canvas");
  canvas.width = 128; canvas.height = 280;
  const c = canvas.getContext("2d")!;
  const g = c.createLinearGradient(0, 0, 0, 280);
  g.addColorStop(0, "#10131c"); g.addColorStop(1, "#070810");
  c.fillStyle = g; c.fillRect(0, 0, 128, 280);
  c.fillStyle = "#1a2a22"; c.beginPath(); c.roundRect(12, 104, 104, 58, 10); c.fill();
  c.strokeStyle = "#6fdc95"; c.lineWidth = 5; c.lineCap = "round";
  c.beginPath(); c.moveTo(28, 132); c.lineTo(38, 142); c.lineTo(56, 120); c.stroke();
  c.fillStyle = "#dff5e6"; c.font = "600 13px system-ui, sans-serif"; c.fillText("build", 66, 128);
  c.fillText("passed", 66, 146);
  c.fillStyle = "#9aa1aa"; c.font = "500 26px system-ui, sans-serif"; c.fillText("23:14", 30, 66);
  return canvas;
}
