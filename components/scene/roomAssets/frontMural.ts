import { ROOM } from "../roomLayout";

/** "Aadit's Worlds": the front wall's painting, laid over the panorama's star
 * field and horizon when the wall's mural loads, so it is the wall's own paint
 * and takes the room's light like the rest of the shell.
 *
 * A night city in three depths: a pale far skyline on the panorama's horizon,
 * a rank of tall towers with window columns and neon edges, and dark foreground
 * rooftops under a lit maglev line. A pale moon hangs over it in a violet haze.
 * The room overview sees this wall almost edge-on from its right end, so the
 * tallest, brightest towers stand on the near stretch where vertical forms
 * survive the angle; the stretch behind the identity text keeps to dark
 * silhouettes. Hidden in the city: an explorer on a rooftop, a chess knight on
 * another, a flute for an antenna, a football for the moon, a lit window with an
 * open book, a controller-shaped sign, a construction crane swinging a brick, and
 * a terminal sign (its own small plane; see MuralTerminal).
 *
 * The city is drawn at a quarter of the mural's resolution and scaled up with
 * hard edges, for a quiet pixel grain. Authored in scene units on the wall:
 * x along it, y up it. Lit windows and signs also go into the glow map's R. */

/** The terminal sign's place on the wall and its size, in scene units. */
export const MURAL_TERMINAL = { x: 4.3, y: 3.12, size: [.84, .33] as [number, number] };

const HORIZON = 1.73;
/** Behind the identity text in the room overview: silhouettes only. */
const QUIET = { from: 5.35, to: 7.25, below: 3.05 };
const LOW = 4;

type Lit = [number, number, number, number, number];
type Rand = () => number;
function random(seed: number): Rand {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** A canvas holding the wall at some resolution, addressed in scene units. */
type Wall = { c: CanvasRenderingContext2D; w: number; h: number; X: (x: number) => number; Y: (y: number) => number; unit: number };
function wall(c: CanvasRenderingContext2D): Wall {
  const w = c.canvas.width, h = c.canvas.height;
  const unit = w / (ROOM.right - ROOM.left);
  return { c, w, h, unit, X: (x) => (ROOM.right - x) * unit, Y: (y) => (ROOM.ceiling - y) * h / (ROOM.ceiling - ROOM.floor) };
}
const quiet = (x: number, y: number) => x > QUIET.from && x < QUIET.to && y < QUIET.below;

/** Paints the mural over the panorama in `paint`, and its lit points into
 * `glow` (half resolution, emission in R). Both contexts already hold the
 * loaded images. */
export function paintFrontMural(paint: CanvasRenderingContext2D, glow: CanvasRenderingContext2D | null) {
  const P = wall(paint);
  const lit: Lit[] = [];
  haze(P);
  moon(P);

  const low = document.createElement("canvas");
  low.width = Math.round(P.w / LOW); low.height = Math.round(P.h / LOW);
  const L = wall(low.getContext("2d")!);
  const rand = random(11);
  farSkyline(L, rand);
  midRank(L, rand, lit);
  towers(L, rand, lit);
  foreground(L, rand, lit);
  paint.save();
  paint.imageSmoothingEnabled = false;
  paint.drawImage(low, 0, 0, P.w, P.h);
  paint.restore();

  if (glow) {
    const G = wall(glow);
    for (const [x, y, w, h, strength] of lit) {
      const phase = (((x * 7.31 + y * 3.7) % 1) + 1) % 1;
      glow.fillStyle = `rgb(${Math.round(255 * strength)}, 0, ${Math.round(255 * phase)})`;
      glow.fillRect(G.X(x), G.Y(y), Math.max(1, w * G.unit), Math.max(1, h * G.unit));
    }
  }
}

/** Violet atmosphere over the city and a few nebula clouds in the upper wall. */
function haze({ c, w, h, X, Y }: Wall) {
  const band = c.createLinearGradient(0, Y(ROOM.ceiling), 0, Y(HORIZON));
  band.addColorStop(0, "rgba(40, 30, 100, .10)");
  band.addColorStop(.6, "rgba(80, 52, 160, .26)");
  band.addColorStop(1, "rgba(140, 90, 210, .34)");
  c.fillStyle = band; c.fillRect(0, Y(ROOM.ceiling), w, Y(HORIZON) - Y(ROOM.ceiling));
  for (const [x, y, r, a] of [[3.2, 4.3, 3.2, .22], [6.8, 4.6, 2.4, .16], [-2.5, 4.2, 3.6, .18], [-6, 3.8, 2.6, .12], [.8, 2.6, 2.2, .14]] as const) {
    const g = c.createRadialGradient(X(x), Y(y), 0, X(x), Y(y), r * w / 19.3);
    g.addColorStop(0, `rgba(160, 110, 240, ${a})`); g.addColorStop(.6, `rgba(90, 70, 200, ${a * .45})`); g.addColorStop(1, "rgba(90, 70, 200, 0)");
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  }
}

/** The moon, which is also a football: faint pentagon panels on its disc. */
function moon({ c, X, Y, unit }: Wall) {
  const cx = X(1.15), cy = Y(3.85), r = .52 * unit;
  const halo = c.createRadialGradient(cx, cy, r * .9, cx, cy, r * 3);
  halo.addColorStop(0, "rgba(205, 195, 255, .28)"); halo.addColorStop(1, "rgba(205, 195, 255, 0)");
  c.fillStyle = halo; c.fillRect(cx - r * 4, cy - r * 4, r * 8, r * 8);
  const disc = c.createRadialGradient(cx - r * .35, cy - r * .35, r * .1, cx, cy, r);
  disc.addColorStop(0, "#f1edfa"); disc.addColorStop(.7, "#d2cbea"); disc.addColorStop(1, "#9c95c6");
  c.fillStyle = disc; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
  c.save(); c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.clip();
  c.fillStyle = "rgba(118, 110, 168, .34)";
  const pentagon = (px: number, py: number, s: number, turn: number) => {
    c.beginPath();
    for (let i = 0; i < 5; i++) { const a = turn + i * Math.PI * 2 / 5; c.lineTo(px + Math.cos(a) * s, py + Math.sin(a) * s); }
    c.closePath(); c.fill();
  };
  pentagon(cx, cy, r * .28, -Math.PI / 2);
  for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 5 + Math.PI / 5; pentagon(cx + Math.cos(a) * r * .78, cy + Math.sin(a) * r * .78, r * .24, a); }
  c.restore();
}

const rect = ({ c, X, Y }: Wall, colour: string, x0: number, x1: number, y0: number, y1: number) => {
  c.fillStyle = colour;
  const left = Math.round(Math.min(X(x0), X(x1))), right = Math.round(Math.max(X(x0), X(x1)));
  const top = Math.round(Y(Math.max(y0, y1))), bottom = Math.round(Y(Math.min(y0, y1)));
  c.fillRect(left, top, Math.max(1, right - left), Math.max(1, bottom - top));
};
const px = (L: Wall) => 1 / L.unit;

/** Far rank: low, pale with distance, along the whole horizon. */
function farSkyline(L: Wall, rand: Rand) {
  for (let x = ROOM.right - .1; x > ROOM.left + 1.6;) {
    const width = .18 + rand() * .35;
    const top = HORIZON + .12 + rand() * (quiet(x, 2) ? .25 : .55);
    rect(L, quiet(x, 2) ? "#1c2146" : "#262d62", x, x - width, HORIZON - .1, top);
    x -= width + rand() * .08;
  }
}

/** Middle rank: medium towers with a few lit windows, filling between the
 * tall ones. */
function midRank(L: Wall, rand: Rand, lit: Lit[]) {
  for (let x = ROOM.right - .3; x > ROOM.left + 1.8;) {
    const width = .25 + rand() * .3;
    const hush = quiet(x, 2) || quiet(x - width, 2);
    const top = HORIZON + .5 + rand() * (hush ? .7 : 1.1);
    rect(L, hush ? "#141934" : "#1a2048", x, x - width, HORIZON - .15, top);
    windows(L, rand, lit, x, width, top, hush ? .03 : .1);
    x -= width + .05 + rand() * .15;
  }
}

type Tower = { x: number; w: number; top: number; neon?: string; beacon?: boolean };

/** The tall rank, placed by hand: tallest and brightest on the near stretch
 * the room overview sees, darker behind the identity text, smaller further on. */
const TOWERS: Tower[] = [
  { x: 9.5, w: .55, top: 5.05, neon: "#b47cff", beacon: true },
  { x: 8.55, w: .5, top: 4.55 },
  { x: 7.9, w: .42, top: 3.9, neon: "#6fe3ff" },
  { x: 7.1, w: .55, top: 3.55 },
  { x: 6.35, w: .6, top: 4.05, beacon: true },
  { x: 5.6, w: .38, top: 3.35 },
  { x: 4.95, w: .52, top: 4.75, neon: "#6fe3ff", beacon: true },
  { x: 4.3, w: .56, top: 2.72 },
  { x: 3.6, w: .44, top: 4.95 },
  { x: 2.95, w: .6, top: 4.2, neon: "#b47cff" },
  { x: 2.2, w: .42, top: 3.45 },
  { x: 1.45, w: .5, top: 3.3 },
  { x: .55, w: .6, top: 3.95, beacon: true },
  { x: -.55, w: .52, top: 4.3, neon: "#b47cff" },
  { x: -1.75, w: .5, top: 3.0 },
  { x: -3.0, w: .58, top: 3.65, beacon: true },
  { x: -4.3, w: .48, top: 3.2 },
  { x: -5.6, w: .54, top: 2.95, neon: "#6fe3ff" },
  { x: -6.8, w: .46, top: 2.6 },
];

function towers(L: Wall, rand: Rand, lit: Lit[]) {
  const { c, X, Y } = L;
  for (const t of TOWERS) {
    const left = t.x, right = t.x - t.w;
    // Body darkening toward the ground, a lighter crown, facade stripes.
    const body = c.createLinearGradient(0, Y(t.top), 0, Y(HORIZON - .2));
    body.addColorStop(0, "#2a2f6c"); body.addColorStop(.35, "#161b42"); body.addColorStop(1, "#0b0e24");
    c.fillStyle = body;
    c.fillRect(Math.round(X(left)), Math.round(Y(t.top)), Math.round(X(right) - X(left)), Math.round(Y(HORIZON - .2) - Y(t.top)));
    rect(L, "#2f3576", left - t.w * .18, right + t.w * .18, t.top, t.top + .08);
    for (let sx = left - .06; sx > right + .04; sx -= .12) rect(L, "#0e1230", sx, sx - px(L), HORIZON, t.top - .1);
    windows(L, rand, lit, left, t.w, t.top, .2);
    if (t.neon) {
      rect(L, t.neon, right + px(L), right, HORIZON + .3, t.top);
      lit.push([right + px(L), t.top, px(L), t.top - HORIZON - .3, .5]);
    }
    if (t.beacon) {
      const mid = (left + right) / 2;
      rect(L, "#2a2f6c", mid, mid - px(L), t.top + .08, t.top + .45);
      rect(L, "#ff5a5a", mid, mid - px(L), t.top + .45, t.top + .45 + px(L));
      lit.push([mid, t.top + .45 + px(L), px(L), px(L), .8]);
    }
  }
  details(L, lit);
}

/** Lit windows in columns: warm and cool, sparse, none low behind the text. */
function windows(L: Wall, rand: Rand, lit: Lit[], left: number, width: number, top: number, chance: number) {
  const step = px(L) * 2;
  for (let y = top - .12; y > HORIZON + .1; y -= step * 1.5) for (let x = left - .05; x > left - width + .05; x -= step) {
    if (quiet(x, y) ? rand() > .015 : rand() > chance) continue;
    const warm = rand() > .35;
    rect(L, warm ? "#ffd27a" : "#8fd8ff", x, x - px(L), y, y + px(L));
    lit.push([x, y + px(L), px(L), px(L), warm ? .5 : .38]);
  }
}

/** The hidden things, on the rooftops and in the windows. */
function details(L: Wall, lit: Lit[]) {
  const p = px(L);
  const box = (colour: string, x: number, y: number, w: number, h: number) => rect(L, colour, x, x - w * p, y, y + h * p);
  const roof = (x: number) => TOWERS.find((t) => Math.abs(t.x - x) < .01)!;

  // The terminal sign's frame on its roof (the screen is its own plane).
  { const t = roof(4.3); const mid = t.x - t.w / 2;
    box("#0b0f24", mid + .1, t.top, 2, 8); box("#0b0f24", mid - .06, t.top, 2, 8); }

  // An explorer on a rooftop, looking toward the moon.
  { const t = roof(2.95); const x = t.x - t.w * .7, b = t.top + .08;
    box("#070a18", x, b + 2 * p, 3, 5); box("#070a18", x, b, 1, 2); box("#070a18", x - 2 * p, b, 1, 2);
    box("#070a18", x, b + 7 * p, 3, 3); box("#070a18", x - 3 * p, b + 4 * p, 2, 1);
    box("#8fd8ff", x - p, b + 8 * p, 1, 1); lit.push([x - p, b + 9 * p, p, p, .6]); }

  // A chess knight standing on a roof like a statue.
  { const t = roof(1.45); const x = t.x - t.w / 2 + 2 * p, b = t.top + .08;
    for (const [dx, dy, w, h] of [[-3, 0, 7, 2], [-2, 2, 5, 2], [-1, 4, 3, 4], [-1, 8, 4, 3], [2, 9, 2, 2], [0, 11, 2, 1]] as const) box("#070a18", x - dx * p, b + dy * p, w, h); }

  // A controller-shaped sign on a roof, violet with cyan buttons.
  { const t = roof(2.2); const x = t.x - t.w / 2 + 5 * p, b = t.top + .12;
    box("#b47cff", x, b + p, 11, 3); box("#b47cff", x + p, b, 2, 3); box("#b47cff", x - 10 * p, b, 2, 3);
    box("#8fe8ff", x - p, b + 2 * p, 1, 1); box("#8fe8ff", x - 8 * p, b + 2 * p, 1, 1);
    lit.push([x + p, b + 4 * p, 13 * p, 4 * p, .6]); }

  // The tallest near spire's antenna is a flute: a long tube with its keys.
  { const t = roof(3.6); const x = t.x - t.w / 2;
    box("#1d2550", x + p, t.top + .08, 2, 30); box("#c9cbe0", x, t.top + .08, 1, 27);
    for (let k = 0; k < 6; k++) box("#0b0f24", x, t.top + .16 + k * 3.5 * p, 1, 1);
    box("#ff6a6a", x, t.top + .08 + 30 * p, 1, 1); lit.push([x, t.top + .08 + 31 * p, p, p, .8]); }

  // A lit window with an open book in it.
  { const t = roof(.55); const x = t.x - .12, y = t.top - .5;
    box("#ffd27a", x, y, 8, 6); box("#f6ecd2", x - p, y + 2 * p, 3, 2); box("#f6ecd2", x - 4 * p, y + 2 * p, 3, 2); box("#8a6a3a", x - 3 * p, y + 2 * p, 1, 3);
    lit.push([x, y + 6 * p, 8 * p, 6 * p, .6]); }

  // A tower still being built, with a construction crane swinging a brick.
  { const t = roof(-1.75); const x = t.x - .1, top = t.top;
    for (let k = 1; k < 5; k++) box("#151b3d", t.x, top + k * 3 * p, Math.round(t.w / p), 1);
    box("#e3b23c", x, top, 1, 22); box("#e3b23c", x + 6 * p, top + 22 * p, 28, 1);
    box("#d33a2e", x + 6 * p, top + 20 * p, 4, 2);
    box("#9aa0b8", x - 18 * p, top + 14 * p, 1, 8);
    box("#3b73d9", x - 16 * p, top + 12 * p, 5, 2);
    for (const k of [0, 2, 4]) box("#3b73d9", x - (16 + k) * p, top + 14 * p, 1, 1);
    box("#ff6a6a", x, top + 23 * p, 1, 1); lit.push([x, top + 24 * p, p, p, .8]); }
}

/** Foreground: dark rooftops at the foot of the wall under a lit maglev line,
 * one train on it. */
function foreground(L: Wall, rand: Rand, lit: Lit[]) {
  const p = px(L);
  for (let x = ROOM.right; x > ROOM.left + 1.7;) {
    const width = .5 + rand() * .7;
    const top = .55 + rand() * .55;
    rect(L, "#070a18", x, x - width, ROOM.floor, top);
    if (!quiet(x, top)) for (let y = top - .1; y > .3; y -= 4 * p) for (let wx = x - .08; wx > x - width + .08; wx -= 3 * p) {
      if (rand() > .06) continue;
      rect(L, "#ffcf7a", wx, wx - p, y, y + p);
      lit.push([wx, y + p, p, p, .4]);
    }
    x -= width + rand() * .1;
  }
  // The maglev: a thin deck on pylons, gently rising toward the near end.
  const deck = (x: number) => 1.18 + .12 * (x - ROOM.left) / (ROOM.right - ROOM.left);
  for (let x = ROOM.right; x > ROOM.left + 1.8; x -= p) rect(L, "#2b3470", x, x - p, deck(x), deck(x) + p);
  for (let x = ROOM.right - .4; x > ROOM.left + 1.8; x -= 1.6) rect(L, "#1b2250", x, x - p, .6, deck(x));
  for (let i = 0; i < 20; i++) {
    const x = 3.05 - i * p;
    rect(L, "#cfd6f2", x, x - p, deck(x) + p, deck(x) + 3 * p);
    if (i % 3 === 1) { rect(L, "#8fe8ff", x, x - p, deck(x) + 2 * p, deck(x) + 3 * p); lit.push([x, deck(x) + 3 * p, p, p, .55]); }
  }
}
