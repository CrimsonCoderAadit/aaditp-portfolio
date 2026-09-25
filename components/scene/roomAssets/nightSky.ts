import { DataTexture, LinearFilter, LinearMipmapLinearFilter, NoColorSpace, RGBAFormat, SRGBColorSpace, Texture } from "three";

/** The procedural deep-sky ceiling, painted once into canvases. The sky is an
 * authored composition, not a uniform scatter:
 *
 *  - a base gradient in navy and indigo, never pure black;
 *  - large, very faint dust clouds shaped by layered value noise;
 *  - authored features (a Milky-Way-like band across the ceiling, tone matches
 *    at the edges that meet the walls' panorama);
 *  - stars placed by rejection sampling against a density field (clouds,
 *    clusters, the band), with a steep brightness distribution: very many
 *    faint stars, fewer medium ones, very few bright.
 *
 * `color` is the painted sky. `glow` is a half-resolution data texture read
 * by the shell shader: R is a star's emission, G marks the few stars that
 * shimmer, B is that star's phase. Emission takes its hue from the painted
 * star beneath it, so the wall itself never glows. */

/** Shared clock for the few stars that shimmer; advanced by StarClock. */
export const STAR_TIME = { value: 0 };

type Rgb = [number, number, number];
type Cloud = { x: number; y: number; rx: number; ry: number; color: Rgb; alpha: number };

export type SkySpec = {
  width: number;
  height: number;
  seed: number;
  /** Stars per million pixels, before the density field thins them. */
  stars: number;
  /** Base gradient, top then bottom of the canvas. */
  tones: [string, string];
  /** Colours of the large noise dust, and its strength. */
  dust: { colors: Rgb[]; strength: number; scale: number };
  /** Authored soft clouds: centre and radii as fractions of width and height. They also raise star density. */
  clouds: Cloud[];
  /** Open star clusters, in canvas fractions. */
  clusters: { x: number; y: number; r: number; count: number }[];
  /** A Milky-Way-like band along a polyline, in canvas fractions. */
  band?: { path: [number, number][]; width: number };
  /** A small crescent: centre, radius (fractions of width) and lit side angle. */
  crescent?: { x: number; y: number; r: number; light: number };
  /** Share of glowing stars that shimmer. */
  shimmer: number;
  /** Scale on each star's painted size and glow, for surfaces seen at grazing angles. */
  starScale?: number;
};

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth fractal value noise on a coarse lattice, sampled in canvas fractions. */
function fbm(random: () => number, cells: number, aspect: number) {
  const octaves = [1, 2, 4, 8].map((k) => {
    const nx = Math.ceil(cells * k * aspect) + 2, ny = cells * k + 2;
    return { k, nx, ny, grid: Float32Array.from({ length: nx * ny }, random) };
  });
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (u: number, v: number) => {
    let sum = 0, weight = 0, amp = 1;
    for (const { k, nx, ny, grid } of octaves) {
      const x = u * cells * k * aspect, y = v * cells * k;
      const ix = Math.min(nx - 2, Math.floor(x)), iy = Math.min(ny - 2, Math.floor(y));
      const fx = smooth(x - ix), fy = smooth(y - iy);
      const at = (i: number, j: number) => grid[j * nx + i];
      const top = at(ix, iy) * (1 - fx) + at(ix + 1, iy) * fx;
      const bottom = at(ix, iy + 1) * (1 - fx) + at(ix + 1, iy + 1) * fx;
      sum += (top * (1 - fy) + bottom * fy) * amp; weight += amp; amp *= .5;
    }
    return sum / weight;
  };
}

const smoothstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Distance from a point to a polyline, and the fraction along it. */
function toPath(path: [number, number][], x: number, y: number, aspect: number) {
  let best = Infinity, along = 0, walked = 0, total = 0;
  for (let i = 1; i < path.length; i++) total += Math.hypot((path[i][0] - path[i - 1][0]) * aspect, path[i][1] - path[i - 1][1]);
  for (let i = 1; i < path.length; i++) {
    const [ax, ay] = path[i - 1], [bx, by] = path[i];
    const dx = (bx - ax) * aspect, dy = by - ay, len = Math.hypot(dx, dy);
    const t = Math.max(0, Math.min(1, (((x - ax) * aspect) * dx + (y - ay) * dy) / (len * len)));
    const d = Math.hypot((x - ax) * aspect - t * dx, y - ay - t * dy);
    if (d < best) { best = d; along = (walked + t * len) / total; }
    walked += len;
  }
  return { distance: best, along };
}

/** A 2D canvas on the page, or an offscreen one inside a worker. */
function canvasOf(width: number, height: number) {
  const canvas = typeof document === "undefined" ? new OffscreenCanvas(width, height) : document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  return { canvas, context: canvas.getContext("2d") as CanvasRenderingContext2D };
}

export function paintNightSky(spec: SkySpec) {
  const { width: w, height: h } = spec;
  const starScale = spec.starScale ?? 1;
  const random = rng(spec.seed);
  const aspect = w / h;
  const { canvas: color, context: c } = canvasOf(w, h);

  // Base gradient.
  const base = c.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, spec.tones[0]); base.addColorStop(1, spec.tones[1]);
  c.fillStyle = base; c.fillRect(0, 0, w, h);

  // Large dust: noise rendered into a small canvas, then scaled up with
  // smoothing so the clouds stay soft at any distance.
  const dust = fbm(random, spec.dust.scale, aspect);
  const detail = fbm(random, spec.dust.scale * 3, aspect);
  const band = spec.band;
  const bandAt = (u: number, v: number) => {
    if (!band) return 0;
    const { distance, along } = toPath(band.path, u, v, aspect);
    const wobble = .7 + .6 * detail(u * .7, v * .7);
    return Math.exp(-((distance / (band.width * wobble)) ** 2)) * smoothstep(0, .08, along) * smoothstep(1, .88, along);
  };
  const sw = Math.round(360 * Math.sqrt(aspect)), sh = Math.round(sw / aspect);
  const { canvas: small, context: s } = canvasOf(sw, sh);
  const image = s.createImageData(sw, sh);
  const [ca, cb] = spec.dust.colors;
  for (let j = 0; j < sh; j++) for (let i = 0; i < sw; i++) {
    const u = i / sw, v = j / sh;
    const n = dust(u, v), m = detail(u, v);
    const cloud = smoothstep(.48, .78, n) * (.55 + .45 * m);
    const lanes = band ? bandAt(u, v) : 0;
    // Dark lanes cut through the band where the fine noise is high.
    const glow = cloud * spec.dust.strength + lanes * (.5 + .5 * smoothstep(.35, .7, m)) * .95 * (1 - .75 * smoothstep(.6, .8, m));
    const mix = smoothstep(.3, .7, m);
    const k = (i + j * sw) * 4;
    image.data[k] = ca[0] + (cb[0] - ca[0]) * mix;
    image.data[k + 1] = ca[1] + (cb[1] - ca[1]) * mix;
    image.data[k + 2] = ca[2] + (cb[2] - ca[2]) * mix;
    image.data[k + 3] = Math.min(255, glow * 255);
  }
  s.putImageData(image, 0, 0);
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = "high";
  c.drawImage(small, 0, 0, w, h);

  // Authored clouds: soft elliptical washes.
  for (const cloud of spec.clouds) {
    c.save();
    c.translate(cloud.x * w, cloud.y * h);
    c.scale(1, (cloud.ry * h) / (cloud.rx * w));
    const r = cloud.rx * w;
    const g = c.createRadialGradient(0, 0, 0, 0, 0, r);
    const [r0, g0, b0] = cloud.color;
    g.addColorStop(0, `rgba(${r0},${g0},${b0},${cloud.alpha})`);
    g.addColorStop(.5, `rgba(${r0},${g0},${b0},${cloud.alpha * .42})`);
    g.addColorStop(1, `rgba(${r0},${g0},${b0},0)`);
    c.fillStyle = g; c.fillRect(-r, -r, 2 * r, 2 * r);
    c.restore();
  }

  // Crescent: a dark disc with a thin lit limb and a faint atmosphere.
  if (spec.crescent) {
    const { x, y, r, light } = spec.crescent;
    const px = x * w, py = y * h, pr = r * w;
    const disc = c.createRadialGradient(px, py, pr * .2, px, py, pr);
    disc.addColorStop(0, "#0b1120"); disc.addColorStop(1, "#070b16");
    c.fillStyle = disc; c.beginPath(); c.arc(px, py, pr, 0, Math.PI * 2); c.fill();
    c.save();
    c.beginPath(); c.arc(px, py, pr, 0, Math.PI * 2); c.clip();
    const lx = px + Math.cos(light) * pr * .55, ly = py + Math.sin(light) * pr * .55;
    const lit = c.createRadialGradient(lx, ly, pr * .6, lx, ly, pr * 1.2);
    lit.addColorStop(0, "rgba(0,0,0,0)"); lit.addColorStop(.72, "rgba(0,0,0,0)");
    lit.addColorStop(.86, "rgba(150,176,214,.38)"); lit.addColorStop(1, "rgba(200,216,240,.62)");
    c.fillStyle = lit;
    c.beginPath(); c.arc(px, py, pr, 0, Math.PI * 2); c.fill();
    c.restore();
    const halo = c.createRadialGradient(px, py, pr, px, py, pr * 1.25);
    halo.addColorStop(0, "rgba(110,140,200,.12)"); halo.addColorStop(1, "rgba(110,140,200,0)");
    c.fillStyle = halo; c.beginPath(); c.arc(px, py, pr * 1.25, 0, Math.PI * 2); c.fill();
  }

  // Star density: faint everywhere, rich in the clouds, the clusters and the band.
  const cloudDensity = (u: number, v: number) => spec.clouds.reduce((sum, cl) =>
    sum + Math.exp(-(((u - cl.x) / cl.rx) ** 2 + ((v - cl.y) / cl.ry) ** 2) * 1.6) * cl.alpha * 3, 0);
  const density = (u: number, v: number) => {
    const n = dust(u, v);
    return Math.min(1, .12 + .5 * smoothstep(.42, .8, n) + .9 * bandAt(u, v) + cloudDensity(u, v));
  };

  type Star = { x: number; y: number; m: number; tone: Rgb };
  const stars: Star[] = [];
  const temperature = (): Rgb => {
    const t = random();
    if (t < .52) return [214, 226, 255];
    if (t < .8) return [240, 242, 255];
    if (t < .95) return [255, 236, 206];
    return [255, 206, 170];
  };
  const target = Math.round(spec.stars * w * h / 1e6);
  for (let tries = 0; stars.length < target && tries < target * 8; tries++) {
    const u = random(), v = random();
    if (random() > density(u, v)) continue;
    if (spec.crescent && Math.hypot((u - spec.crescent.x) * aspect, v - spec.crescent.y) < spec.crescent.r * aspect * 1.05) continue;
    stars.push({ x: u * w, y: v * h, m: random() ** 6, tone: temperature() });
  }
  for (const cluster of spec.clusters) {
    for (let i = 0; i < cluster.count; i++) {
      const a = random() * Math.PI * 2, rr = Math.sqrt(-2 * Math.log(1 - random() * .999)) * cluster.r * .5;
      stars.push({ x: (cluster.x + Math.cos(a) * rr / aspect) * w, y: (cluster.y + Math.sin(a) * rr) * h, m: random() ** 4, tone: temperature() });
    }
  }

  // Paint stars: faint ones are single sub-pixel points; brighter ones get a
  // core, and only the very brightest a soft glow.
  for (const { x, y, m, tone } of stars) {
    const [r, g, b] = tone;
    if (m < .08) { c.fillStyle = `rgba(${r},${g},${b},${.1 + m * 2})`; c.fillRect(x, y, 1, 1); continue; }
    const size = (.45 + m * 1.35) * starScale;
    if (m > .85) {
      const halo = c.createRadialGradient(x, y, 0, x, y, size * 3.5);
      halo.addColorStop(0, `rgba(${r},${g},${b},${.16 * m})`); halo.addColorStop(1, `rgba(${r},${g},${b},0)`);
      c.fillStyle = halo; c.beginPath(); c.arc(x, y, size * 3.5, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = `rgba(${r},${g},${b},${Math.min(1, .2 + m * .85)})`;
    c.beginPath(); c.arc(x, y, size, 0, Math.PI * 2); c.fill();
  }

  // Emission data at half resolution: only stars bright enough to show.
  const gw = Math.round(w / 2), gh = Math.round(h / 2);
  const { canvas: glow, context: gc } = canvasOf(gw, gh);
  const data = gc.createImageData(gw, gh);
  for (let k = 3; k < data.data.length; k += 4) data.data[k] = 255;
  let shimmering = 0;
  for (const star of stars) {
    if (star.m < .45) continue;
    const shimmer = random() < spec.shimmer;
    if (shimmer) shimmering++;
    const phase = Math.floor(random() * 255);
    const cx = star.x / 2, cy = star.y / 2, radius = (.5 + star.m * 1.1) * starScale;
    for (let j = Math.floor(cy - radius); j <= Math.ceil(cy + radius); j++) for (let i = Math.floor(cx - radius); i <= Math.ceil(cx + radius); i++) {
      if (i < 0 || j < 0 || i >= gw || j >= gh) continue;
      const falloff = Math.max(0, 1 - Math.hypot(i + .5 - cx, j + .5 - cy) / (radius + .5));
      if (falloff <= 0) continue;
      const k = (j * gw + i) * 4;
      const value = Math.min(255, falloff * falloff * (40 + star.m * 190));
      if (value <= data.data[k]) continue;
      data.data[k] = value;
      data.data[k + 1] = shimmer ? 255 : 0;
      data.data[k + 2] = phase;
    }
  }
  gc.putImageData(data, 0, 0);
  return { color, glow, count: stars.length, shimmering };
}

/** A painted canvas, or its raw pixels as a worker hands them back. */
type SkyImage = HTMLCanvasElement | OffscreenCanvas | { data: Uint8Array | null; width: number; height: number };
export type SkyImages = { color: SkyImage; glow: SkyImage };

/** Both images as textures on the room's mural UV channel. Raw pixels arrive
 * top row first and upload unflipped, so canvases do too, and the surface's
 * mural coordinates run top-down. Raw pixels are let go once they are on the
 * GPU, so the images can be used for only one set of textures. */
export function skyTextures({ color, glow }: SkyImages, maxAnisotropy: number) {
  const texture = (image: SkyImage, data: boolean) => {
    let t: Texture;
    if ("data" in image) {
      const pixels = new DataTexture(image.data, image.width, image.height, RGBAFormat);
      pixels.onUpdate = () => { Object.assign(pixels.image, { data: null }); image.data = null; };
      t = pixels;
    } else t = new Texture(image);
    t.needsUpdate = true;
    t.flipY = false;
    t.channel = 1;
    t.colorSpace = data ? NoColorSpace : SRGBColorSpace;
    t.generateMipmaps = true;
    t.minFilter = LinearMipmapLinearFilter; t.magFilter = LinearFilter;
    t.anisotropy = Math.min(16, maxAnisotropy);
    return t;
  };
  return { map: texture(color, false), glow: texture(glow, true) };
}

/** Ceiling, viewed from below: canvas left is the left wall, canvas top the
 * front of the room and canvas bottom the back wall. The band runs from above
 * the display figure, across the middle, toward the back-right corner. */
export const CEILING_SKY: SkySpec = {
  width: 4096, height: 2802, seed: 90210, stars: 900, tones: ["#0a1024", "#0d1530"],
  dust: { colors: [[50, 66, 140], [84, 66, 148]], strength: .36, scale: 2.4 },
  clouds: [
    // Tone matches where the ceiling meets the back mural and the pixel wall.
    { x: .5, y: 1.02, rx: .6, ry: .1, color: [26, 44, 86], alpha: .5 },
    { x: 1.02, y: .7, rx: .06, ry: .4, color: [60, 34, 120], alpha: .22 },
    { x: -.02, y: .55, rx: .06, ry: .4, color: [30, 40, 90], alpha: .3 },
  ],
  clusters: [{ x: .34, y: .52, r: .04, count: 140 }, { x: .72, y: .7, r: .035, count: 110 }, { x: .15, y: .25, r: .03, count: 50 }],
  starScale: .7,
  band: { path: [[-.05, .5], [.3, .55], [.6, .66], [.85, .84], [1.05, .98]], width: .075 },
  shimmer: .45,
};
