import { CanvasTexture, LinearFilter, NearestFilter, SRGBColorSpace } from "three";

/** The gaming wall's artwork, all drawn here rather than taken from any game:
 *  - the big ape of the arcades as a large pixel mural, rasterised cell by cell
 *    from simple shapes so every pixel is crisp, then shaded from the upper left
 *    and outlined; the silhouette is the cut-out, standing on a riveted girder;
 *  - the undercover detective of the brick city as a flat minifigure poster on a
 *    painted arch with the city behind him;
 *  - a small arcade score marquee in a hand-set 3 × 5 pixel font. */

// ---- pixel mural --------------------------------------------------------------

export const KONG_GRID = { w: 60, h: 80 } as const;

type Label = "fur" | "face" | "tie" | "white" | "pupil" | "dark" | "girder" | "rivet" | "barrel" | "band" | "teeth";
type Tone = { base: string; light: string; shade: string };
const TONES: Record<Label, Tone> = {
  fur: { base: "#6e3b1d", light: "#94542a", shade: "#4a2512" },
  face: { base: "#e2a766", light: "#f5c992", shade: "#b67a43" },
  tie: { base: "#cf3326", light: "#f0604a", shade: "#8e1c16" },
  white: { base: "#f4efe4", light: "#ffffff", shade: "#d7d0c2" },
  pupil: { base: "#141414", light: "#141414", shade: "#141414" },
  dark: { base: "#2c140a", light: "#2c140a", shade: "#2c140a" },
  teeth: { base: "#f4efe4", light: "#f4efe4", shade: "#d7d0c2" },
  girder: { base: "#c43a3a", light: "#f07878", shade: "#7a1c24" },
  rivet: { base: "#ffd0c8", light: "#ffd0c8", shade: "#ffd0c8" },
  barrel: { base: "#a0602a", light: "#cf8d48", shade: "#6d3d17" },
  band: { base: "#4a2410", light: "#6a3618", shade: "#3a1a0a" },
};
const OUTLINE = "#1a0c06";

type Grid = (Label | null)[];
type Test = (x: number, y: number) => boolean;
const ellipse = (cx: number, cy: number, rx: number, ry: number): Test => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
const rect = (x0: number, y0: number, x1: number, y1: number): Test => (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
function capsule(ax: number, ay: number, bx: number, by: number, r: number): Test {
  return (x, y) => {
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(x - ax - dx * t, y - ay - dy * t) <= r;
  };
}
function polygon(points: [number, number][]): Test {
  return (x, y) => {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [xi, yi] = points[i], [xj, yj] = points[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
}

/** One frame of the mural: `pump` lifts the fists (0 at rest, 1 fully up),
 * `barrel` is a rolling barrel's progress along the girder (negative for none),
 * `sheen` sweeps a highlight band across the pixels (negative for none). */
export type KongPose = { pump?: number; barrel?: number; sheen?: number };

function rasterise({ pump = 0, barrel = -1 }: KongPose) {
  const { w, h } = KONG_GRID;
  const grid: Grid = new Array(w * h).fill(null);
  const paint = (label: Label, test: Test) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (test(x + .5, y + .5)) grid[y * w + x] = label;
  };
  const lift = Math.round(pump * 3);
  // An upright barrel: rounded staves with a dark hoop near each end.
  const barrelAt = (bx: number, by: number, turn = 0) => {
    paint("barrel", rect(bx, by + 1, bx + 7, by + 7));
    paint("barrel", rect(bx + 1, by, bx + 6, by + 8));
    paint("band", rect(bx, by + 1.5, bx + 7, by + 2.4));
    paint("band", rect(bx, by + 5.5, bx + 7, by + 6.4));
    const stave = bx + 2 + (turn % 3);
    paint("band", rect(stave, by + 3, stave + .9, by + 4.9));
  };

  // Girder he stands on, and a stack of barrels beside his left foot.
  paint("girder", rect(0, 72, w - 1, 77));
  for (const [bx, by] of [[5, 54], [1, 63], [9, 63]] as const) barrelAt(bx, by);
  // Legs, feet, torso and the shoulders under the arms.
  for (const side of [-1, 1]) {
    paint("fur", ellipse(30 + side * 8.5, 62, 6.5, 7.5));
    paint("face", ellipse(30 + side * 10, 69.4, 7, 2.9));
  }
  paint("fur", ellipse(30, 46, 15.5, 17));
  // Arms flexed up, fists at head height.
  for (const side of [-1, 1]) {
    const shoulder: [number, number] = [30 + side * 13, 36];
    const elbow: [number, number] = [30 + side * 24.5, 30 - lift * .4];
    const fist: [number, number] = [30 + side * 21.5, 15 - lift];
    paint("fur", capsule(shoulder[0], shoulder[1], elbow[0], elbow[1], 5.6));
    paint("fur", capsule(elbow[0], elbow[1], fist[0], fist[1] + 4, 4.8));
    paint("face", ellipse(fist[0], fist[1], 5, 4.6));
  }
  // Head with its crest of fur.
  paint("fur", ellipse(30, 22, 12.5, 11.5));
  paint("fur", polygon([[24, 13], [27, 6], [30, 11], [33, 5], [35, 12]]));
  // Face: the brow lobes over the eyes and a broad muzzle.
  paint("face", ellipse(25.5, 21, 5.2, 5));
  paint("face", ellipse(34.5, 21, 5.2, 5));
  paint("face", ellipse(30, 29, 11, 7.5));
  // His fur comes to a point between the eyes.
  paint("fur", polygon([[27, 14.5], [33, 14.5], [30, 21.5]]));
  paint("dark", rect(21, 17, 39, 17.9));
  paint("white", rect(24, 19, 26, 22));
  paint("white", rect(34, 19, 36, 22));
  paint("pupil", rect(25, 20, 26, 22));
  paint("pupil", rect(34, 20, 35, 22));
  paint("dark", rect(26, 25, 27.9, 25.9));
  paint("dark", rect(32, 25, 33.9, 25.9));
  paint("dark", ellipse(30, 31.5, 7.5, 2.4));
  paint("teeth", rect(25, 30, 35, 30.9));
  // The tie.
  paint("tie", polygon([[26.5, 36], [33.5, 36], [35.5, 50], [30, 56], [24.5, 50]]));
  paint("tie", rect(27, 34, 33, 36));
  // A barrel rolling along the girder.
  if (barrel >= 0) {
    barrelAt(Math.round(-8 + barrel * (w + 8)), 63.5, Math.round(barrel * 24));
  }
  return grid;
}

/** Draws the mural at one canvas pixel per cell; empty cells stay transparent. */
export function drawKong(context: CanvasRenderingContext2D, pose: KongPose = {}) {
  const { w, h } = KONG_GRID;
  const grid = rasterise(pose);
  const at = (x: number, y: number) => x < 0 || y < 0 || x >= w || y >= h ? null : grid[y * w + x];
  const image = context.createImageData(w, h);
  const put = (x: number, y: number, hex: string) => {
    const i = (y * w + x) * 4, n = parseInt(hex.slice(1), 16);
    image.data[i] = n >> 16; image.data[i + 1] = (n >> 8) & 255; image.data[i + 2] = n & 255; image.data[i + 3] = 255;
  };
  const sheen = pose.sheen ?? -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const label = at(x, y);
    if (!label) {
      if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) put(x, y, OUTLINE);
      continue;
    }
    const tone = TONES[label];
    let colour = at(x - 1, y - 1) !== label ? tone.light : at(x + 1, y + 1) !== label ? tone.shade : tone.base;
    if (label === "girder" && (x + (y - 72) * 2) % 8 === 0 && y > 72 && y < 77) colour = TONES.girder.shade;
    if (label === "girder" && x % 6 === 2 && (y === 73 || y === 76)) colour = TONES.rivet.base;
    if (sheen >= 0) {
      const band = x + y * .6 - (sheen * (w + h * .6 + 20) - 10);
      if (band > 0 && band < 3) colour = tone.light;
    }
    put(x, y, colour);
  }
  // Idle life: one bright pixel in each eye.
  put(24, 20, "#ffffff");
  put(34, 20, "#ffffff");
  context.clearRect(0, 0, w, h);
  context.putImageData(image, 0, 0);
}

/** The mural's silhouette grown by `grow` cells, for its shallow backing panel. */
export function drawKongBacking(context: CanvasRenderingContext2D, grow: number, colour: string) {
  const { w, h } = KONG_GRID;
  const grid = rasterise({});
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && grid[y * w + x] !== null;
  context.clearRect(0, 0, w, h);
  context.fillStyle = colour;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let near = false;
    for (let dy = -grow; dy <= grow && !near; dy++) for (let dx = -grow; dx <= grow && !near; dx++) if (Math.abs(dx) + Math.abs(dy) <= grow + 1 && solid(x + dx, y + dy)) near = true;
    if (near) context.fillRect(x, y, 1, 1);
  }
}

export function pixelTexture(canvas: HTMLCanvasElement) {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

// ---- detective poster ------------------------------------------------------------

export const CHASE_CANVAS = { w: 400, h: 800 } as const;

/** A flat minifigure poster: an arched navy panel with a gold keyline, the city's
 * skyline at night behind him, the detective standing square with his badge held
 * up, and his name on a plate at the foot. */
export function drawChase(c: CanvasRenderingContext2D) {
  const { w, h } = CHASE_CANVAS;
  c.clearRect(0, 0, w, h);
  const ink = "#0a0f1c";
  const arch = (inset: number) => {
    const r = w / 2 - inset;
    c.beginPath();
    c.moveTo(inset, h - inset);
    c.lineTo(inset, r + inset);
    c.arc(w / 2, r + inset, r, Math.PI, 0);
    c.lineTo(w - inset, h - inset);
    c.closePath();
  };
  // Panel, sky gradient and a faint searchlight.
  arch(0); c.fillStyle = ink; c.fill();
  arch(8);
  const sky = c.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#1b2d57"); sky.addColorStop(.6, "#13213f"); sky.addColorStop(1, "#0d162b");
  c.fillStyle = sky; c.fill();
  c.save(); arch(8); c.clip();
  const beam = c.createRadialGradient(w * .72, 150, 10, w * .72, 150, 260);
  beam.addColorStop(0, "#3f6fb866"); beam.addColorStop(1, "#3f6fb800");
  c.fillStyle = beam; c.fillRect(0, 0, w, h);
  // Skyline: two ranks of towers with lit windows.
  const towers = (ranks: [number, number, number][], fill: string, windows: string) => {
    for (const [x, width, top] of ranks) {
      c.fillStyle = fill; c.fillRect(x, top, width, h - top);
      c.fillStyle = windows;
      for (let wy = top + 14; wy < h - 110; wy += 22) for (let wx = x + 8; wx < x + width - 8; wx += 16) if ((wx * 7 + wy * 3) % 5 < 2) c.fillRect(wx, wy, 6, 9);
    }
  };
  towers([[10, 70, 470], [74, 56, 420], [300, 90, 440], [238, 64, 500], [346, 50, 380]], "#1c3260", "#f2c85b55");
  towers([[0, 90, 560], [96, 60, 600], [220, 80, 540], [310, 90, 590]], "#15264a", "#f2c85b88");
  c.restore();
  arch(8); c.lineWidth = 4; c.strokeStyle = "#d9b44a"; c.stroke();

  // The figure, outlined in the poster's ink.
  const cx = w / 2;
  const shape = (draw: () => void, fill: string) => { c.beginPath(); draw(); c.closePath(); c.fillStyle = fill; c.fill(); c.lineWidth = 6; c.strokeStyle = ink; c.lineJoin = "round"; c.stroke(); };
  const roundRect = (x: number, y: number, rw: number, rh: number, r: number) => { c.roundRect(x, y, rw, rh, r); };
  const navy = "#243f80", navyLight = "#2f56a8", skin = "#f2c31b", skinShade = "#d7a70f";
  // Legs and hips.
  shape(() => roundRect(cx - 92, 598, 88, 150, 8), "#1c2a4a");
  shape(() => roundRect(cx + 4, 598, 88, 150, 8), "#1c2a4a");
  shape(() => roundRect(cx - 96, 568, 192, 38, 6), "#1c2a4a");
  // Arm down, hand on the hip (his left, our right).
  shape(() => { c.moveTo(cx + 80, 405); c.lineTo(cx + 128, 420); c.lineTo(cx + 132, 540); c.lineTo(cx + 96, 548); }, navy);
  shape(() => { c.arc(cx + 112, 560, 22, 0, Math.PI * 2); }, skin);
  // Torso: a minifigure's trapezoid, shirt collar, tie, badge, belt.
  shape(() => { c.moveTo(cx - 78, 400); c.lineTo(cx + 78, 400); c.lineTo(cx + 98, 572); c.lineTo(cx - 98, 572); }, navy);
  c.fillStyle = navyLight; c.beginPath(); c.moveTo(cx - 66, 412); c.lineTo(cx - 20, 412); c.lineTo(cx - 34, 560); c.lineTo(cx - 84, 560); c.closePath(); c.fill();
  c.fillStyle = "#9cc3ef"; c.beginPath(); c.moveTo(cx - 34, 400); c.lineTo(cx + 34, 400); c.lineTo(cx, 452); c.closePath(); c.fill();
  c.fillStyle = "#101a33"; c.beginPath(); c.moveTo(cx - 8, 420); c.lineTo(cx + 8, 420); c.lineTo(cx + 12, 500); c.lineTo(cx, 514); c.lineTo(cx - 12, 500); c.closePath(); c.fill();
  c.fillStyle = "#d9b44a"; c.beginPath(); c.moveTo(cx + 42, 440); c.lineTo(cx + 66, 440); c.lineTo(cx + 66, 460); c.lineTo(cx + 54, 472); c.lineTo(cx + 42, 460); c.closePath(); c.fill();
  c.fillStyle = "#101418"; c.fillRect(cx - 94, 540, 188, 20); c.fillStyle = "#c8ccd2"; c.fillRect(cx - 12, 542, 24, 16);
  c.fillStyle = "#101418"; c.fillRect(cx - 70, 404, 26, 36); c.fillStyle = "#d33a2e"; c.fillRect(cx - 64, 408, 6, 6);
  // Arm raised, badge held up (his right, our left).
  shape(() => { c.moveTo(cx - 76, 404); c.lineTo(cx - 120, 330); c.lineTo(cx - 150, 350); c.lineTo(cx - 112, 438); }, navy);
  shape(() => { c.arc(cx - 136, 318, 24, 0, Math.PI * 2); }, skin);
  shape(() => { c.moveTo(cx - 170, 250); c.lineTo(cx - 104, 250); c.lineTo(cx - 104, 296); c.lineTo(cx - 137, 322); c.lineTo(cx - 170, 296); }, "#e0bb4c");
  c.fillStyle = "#b28a2a"; c.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 7 : 16; c.lineTo(cx - 137 + Math.cos(a) * r, 282 + Math.sin(a) * r); }
  c.closePath(); c.fill();
  // Neck and head: a stud-topped cylinder, face, and swept brown hair.
  shape(() => roundRect(cx - 30, 382, 60, 22, 4), skin);
  shape(() => roundRect(cx - 66, 238, 132, 150, 30), skin);
  c.fillStyle = skinShade; c.fillRect(cx + 38, 250, 18, 126);
  shape(() => { c.moveTo(cx - 72, 300); c.bezierCurveTo(cx - 84, 212, cx - 20, 184, cx + 40, 196); c.bezierCurveTo(cx + 90, 204, cx + 88, 250, cx + 72, 296); c.lineTo(cx + 60, 262); c.bezierCurveTo(cx + 20, 250, cx - 20, 262, cx - 50, 250); c.lineTo(cx - 60, 302); }, "#5a3a22");
  c.fillStyle = "#7a5334"; c.beginPath(); c.moveTo(cx - 40, 222); c.bezierCurveTo(cx - 10, 204, cx + 30, 204, cx + 58, 222); c.lineTo(cx + 40, 230); c.bezierCurveTo(cx + 12, 218, cx - 16, 222, cx - 40, 234); c.closePath(); c.fill();
  c.fillStyle = ink;
  for (const ex of [-26, 26]) { c.beginPath(); c.ellipse(cx + ex, 312, 8, 11, 0, 0, Math.PI * 2); c.fill(); }
  c.fillStyle = "#ffffff"; for (const ex of [-23, 29]) { c.beginPath(); c.arc(cx + ex, 308, 3, 0, Math.PI * 2); c.fill(); }
  c.strokeStyle = "#5a3a22"; c.lineWidth = 6; c.lineCap = "round";
  c.beginPath(); c.moveTo(cx - 40, 290); c.lineTo(cx - 14, 286); c.stroke();
  c.beginPath(); c.moveTo(cx + 14, 284); c.lineTo(cx + 40, 290); c.stroke();
  c.strokeStyle = ink; c.lineWidth = 5;
  c.beginPath(); c.moveTo(cx - 22, 346); c.quadraticCurveTo(cx + 6, 362, cx + 30, 340); c.stroke();

  // Name plate.
  c.fillStyle = ink; c.fillRect(24, h - 70, w - 48, 48);
  c.strokeStyle = "#d9b44a"; c.lineWidth = 2; c.strokeRect(30, h - 64, w - 60, 36);
  c.fillStyle = "#f3efe4"; c.font = "700 26px 'Helvetica Neue', Arial, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
  c.fillText("CHASE  McCAIN", w / 2, h - 46);
}

export function posterTexture(canvas: HTMLCanvasElement, anisotropy: number) {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = anisotropy;
  return texture;
}

// ---- score marquee ------------------------------------------------------------------

const FONT: Record<string, string> = {
  "0": "111101101101111", "1": "010110010010111", "2": "111001111100111", "3": "111001111001111", "4": "101101111001001",
  "5": "111100111001111", "6": "111100111101111", "7": "111001001001001", "8": "111101111101111", "9": "111101111001111",
  H: "101101111101101", I: "111010010010111", S: "111100111001111", C: "111100100100111", O: "111101101101111",
  R: "110101110101101", E: "111100111100111", U: "101101101101111", P: "111101111100100", "-": "000000111000000", " ": "000000000000000",
};

export const MARQUEE = { w: 72, h: 20 } as const;

/** Two rows of arcade text on black: the player's tag in red, the score in white. */
export function drawMarquee(c: CanvasRenderingContext2D) {
  const { w, h } = MARQUEE;
  c.fillStyle = "#07080c"; c.fillRect(0, 0, w, h);
  const text = (value: string, x: number, y: number, colour: string) => {
    c.fillStyle = colour;
    [...value].forEach((ch, i) => {
      const bits = FONT[ch] ?? FONT[" "];
      for (let b = 0; b < 15; b++) if (bits[b] === "1") c.fillRect(x + i * 4 + (b % 3), y + Math.floor(b / 3), 1, 1);
    });
  };
  text("1UP", 3, 3, "#ff4a4a");
  text("HI-SCORE", 22, 3, "#ff4a4a");
  text("007250", 3, 11, "#f4efe4");
  text("250000", 34, 11, "#f4efe4");
  c.fillStyle = "#d9b44a"; c.fillRect(0, 0, w, 1); c.fillRect(0, h - 1, w, 1);
}
