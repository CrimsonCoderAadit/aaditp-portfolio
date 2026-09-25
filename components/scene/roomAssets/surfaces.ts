import {
  CanvasTexture, Color, DataTexture, DoubleSide, LinearMipmapLinearFilter, Material, MeshPhysicalMaterial,
  MeshStandardMaterial, RepeatWrapping, RGBAFormat, SRGBColorSpace, Texture, UnsignedByteType,
} from "three";
import { METRE } from "../roomLayout";

/** Physical surface families for the room. Each family owns one albedo texture and
 * one packed detail texture (R = height for bumpMap, G = roughness for
 * roughnessMap), so wood, fabric, paint and floor each cost two uploads however
 * many finishes share them. Everything is generated once, deterministically, with
 * no network fetch: the room adds ~34 MB of mipmapped texture memory in total. */

/** Writes albedo, height and roughness for (u, v) into `out`; no per-pixel allocation. */
type Pixel = (u: number, v: number, out: Float32Array) => void;

function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Value noise on an integer lattice that wraps at `period`, so every texture tiles. */
function tileNoise(period: [number, number], seed: number) {
  const [px, py] = period;
  const random = seeded(seed);
  const lattice = Float32Array.from({ length: px * py }, random);
  const at = (x: number, y: number) => lattice[((y % py + py) % py) * px + ((x % px + px) % px)];
  return (x: number, y: number) => {
    const ix = Math.floor(x), iy = Math.floor(y);
    let fx = x - ix, fy = y - iy;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const a = at(ix, iy), b = at(ix + 1, iy), c = at(ix, iy + 1), d = at(ix + 1, iy + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}

function bake(width: number, height: number, pixel: Pixel, albedoTint: [number, number, number] = [1, 1, 1]) {
  const albedo = new Uint8Array(width * height * 4);
  const detail = new Uint8Array(width * height * 4);
  const out = new Float32Array(3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      pixel(x / width, y / height, out);
      const a = out[0], h = out[1], r = out[2];
      const i = (y * width + x) * 4;
      albedo[i] = Math.min(255, a * albedoTint[0] * 255);
      albedo[i + 1] = Math.min(255, a * albedoTint[1] * 255);
      albedo[i + 2] = Math.min(255, a * albedoTint[2] * 255);
      albedo[i + 3] = 255;
      detail[i] = Math.min(255, Math.max(0, h * 255));
      detail[i + 1] = Math.min(255, Math.max(0, r * 255));
      detail[i + 2] = 0;
      detail[i + 3] = 255;
    }
  }
  const wrap = (data: Uint8Array, colour: boolean) => {
    const texture = new DataTexture(data, width, height, RGBAFormat, UnsignedByteType);
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = 8;
    if (colour) texture.colorSpace = SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  };
  return { albedo: wrap(albedo, true), detail: wrap(detail, false), raw: { albedo, detail, width, height } };
}

/** Long-grain wood: rings run along U. One texture tile spans 1.2 × 0.6 m. */
const WOOD_TILE: [number, number] = [1.2, .6];
function woodPixel(): Pixel {
  const pores = tileNoise([96, 640], 11);
  const figure = tileNoise([6, 12], 12);
  const streak = tileNoise([4, 48], 13);
  return (u, v, out) => {
    const wobble = .018 * Math.sin(2 * Math.PI * (u * 2 + v)) + .03 * (figure(u * 6, v * 12) - .5);
    const ring = (v * 26 + wobble * 26 + .35 * Math.sin(2 * Math.PI * (u + v * 3))) % 1;
    const late = Math.pow(Math.max(0, Math.sin(Math.PI * ring)), 10);
    const pore = pores(u * 96, v * 640);
    const band = streak(u * 4, v * 48);
    const albedo = .9 - .075 * late - .05 * (pore > .72 ? 1 : 0) * (.4 + late) + .07 * (band - .5);
    const height = .55 - .25 * late - .3 * (pore > .72 ? 1 : 0);
    out[0] = albedo;
    out[1] = height;
    out[2] = .86 + .1 * (pore > .72 ? 1 : 0) - .08 * late + .06 * (band - .5);
  };
}

/** Engineered oak strip floor, in scene units: 0.30-wide boards, staggered 2.6
 * lengths, a micro-bevel at every joint. One tile covers 4.8 × 5.2 units. */
export const FLOOR_TILE: [number, number] = [4.8, 5.2];
const BOARD_WIDTH = .30, BOARD_LENGTH = 2.6;
/** Boards reuse the baked wood tile rather than re-evaluating its noise per texel. */
function floorPixel(wood: ReturnType<typeof bake>["raw"]): Pixel {
  const random = seeded(29);
  const rows = Math.round(FLOOR_TILE[0] / BOARD_WIDTH);
  const stagger = Array.from({ length: rows }, random);
  const tone = Array.from({ length: rows * 4 }, random);
  return (u, v, out) => {
    const x = u * FLOOR_TILE[0], y = v * FLOOR_TILE[1];
    const row = Math.floor(x / BOARD_WIDTH);
    const along = y + stagger[row] * BOARD_LENGTH;
    const board = Math.floor(along / BOARD_LENGTH);
    const bx = x / BOARD_WIDTH - row;
    const by = along / BOARD_LENGTH - board;
    const shade = tone[row * 4 + (board & 3)];
    const gu = ((by * BOARD_LENGTH) / WOOD_TILE[0] + shade * 7) % 1, gv = ((bx * BOARD_WIDTH) / WOOD_TILE[1] + shade * 3) % 1;
    const texel = (Math.floor(gv * wood.height) * wood.width + Math.floor(gu * wood.width)) * 4;
    const a = wood.albedo[texel] / 255, h = wood.detail[texel] / 255, r = wood.detail[texel + 1] / 255;
    const edge = Math.min(bx, 1 - bx) * BOARD_WIDTH;
    const end = Math.min(by, 1 - by) * BOARD_LENGTH;
    const joint = Math.min(1, Math.min(edge, end) / .006);
    const bevel = joint * joint * (3 - 2 * joint);
    out[0] = a * (.93 + .1 * shade) * (.62 + .38 * bevel);
    out[1] = h * .6 + .4 * bevel;
    out[2] = r + (1 - bevel) * .12;
  };
}

/** Plain-weave cloth; one tile is 24 threads square. */
function weavePixel(): Pixel {
  const slub = tileNoise([24, 24], 41);
  return (u, v, out) => {
    const warp = Math.sin(Math.PI * ((u * 24) % 1)), weft = Math.sin(Math.PI * ((v * 24) % 1));
    const over = (Math.floor(u * 24) + Math.floor(v * 24)) % 2 === 0;
    const h = over ? warp * (.6 + .4 * weft) : weft * (.6 + .4 * warp);
    const s = slub(u * 24, v * 24);
    out[0] = .94 + .06 * h - .04 * s; out[1] = h; out[2] = .92 + .08 * s;
  };
}

/** Eggshell emulsion: low-amplitude roller texture and faint roughness mottling. */
function paintPixel(): Pixel {
  const fine = tileNoise([128, 128], 57);
  const roller = tileNoise([12, 24], 58);
  return (u, v, out) => {
    const f = fine(u * 128, v * 128), r = roller(u * 12, v * 24);
    out[0] = .985 + .02 * (r - .5); out[1] = .5 + .35 * (f - .5) + .15 * (r - .5); out[2] = .9 + .1 * (f - .5);
  };
}

function repeatFor(texture: Texture, tile: [number, number]) {
  const copy = texture.clone();
  copy.repeat.set(1 / tile[0], 1 / tile[1]);
  copy.needsUpdate = true;
  return copy;
}

/** A painted gradient seen through the window: blue-grey evening, warmer at the horizon. */
function eveningSky() {
  const canvas = document.createElement("canvas");
  canvas.width = 4; canvas.height = 256;
  const context = canvas.getContext("2d")!;
  const sky = context.createLinearGradient(0, 0, 0, 256);
  sky.addColorStop(0, "#3a4658");
  sky.addColorStop(.55, "#5a6a7d");
  sky.addColorStop(.86, "#8a8f94");
  sky.addColorStop(1, "#a69a8a");
  context.fillStyle = sky; context.fillRect(0, 0, 4, 256);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export type RoomFinish =
  // wood
  | "oak" | "oakDark" | "walnut"
  // paint
  | "wall" | "wallShade" | "trim" | "cabinetPaint" | "doorNight" | "casingNight"
  // fabric
  | "linen" | "sheet" | "duvet" | "throw" | "upholstery" | "mesh" | "rug" | "rugBorder" | "curtain" | "lampShade"
  // metal
  | "blackSteel" | "aluminium" | "chrome" | "brass"
  // plastic, rubber, ceramic, glass, electronics
  | "plastic" | "plasticGrey" | "keycap" | "rubber" | "ceramic" | "ceramicDark" | "glass" | "screen" | "socket"
  // violet accent light: strip emitters, a faint cavity glow, keyboard backlight
  | "led" | "ledDim" | "keyLight"
  // plant
  | "leaf" | "leafDark" | "soil"
  // loose bricks and maker kit
  | "brickRed" | "brickBlue" | "brickYellow" | "brickWhite" | "pegboard" | "card";

/** Deterministic texture baking runs in a worker, not in React's render. */
export function bakeRoomPixels() {
  const wood = bake(1024, 512, woodPixel());
  const floor = bake(2048, 2048, floorPixel(wood.raw), [1, .97, .92]);
  const weave = bake(128, 128, weavePixel());
  const paint = bake(256, 256, paintPixel());
  return { wood: wood.raw, floor: floor.raw, weave: weave.raw, paint: paint.raw };
}

export type RoomPixels = ReturnType<typeof bakeRoomPixels>;

export function createRoomSurfaces(pixels: RoomPixels) {
  const maps = (raw: RoomPixels["wood"]) => {
    const wrap = (data: Uint8Array, colour: boolean) => {
      const texture = new DataTexture(data, raw.width, raw.height, RGBAFormat, UnsignedByteType);
      texture.wrapS = texture.wrapT = RepeatWrapping;
      texture.minFilter = LinearMipmapLinearFilter;
      texture.generateMipmaps = true;
      texture.anisotropy = 8;
      if (colour) texture.colorSpace = SRGBColorSpace;
      texture.needsUpdate = true;
      return texture;
    };
    return { albedo: wrap(raw.albedo, true), detail: wrap(raw.detail, false) };
  };
  const wood = maps(pixels.wood), floor = maps(pixels.floor);
  const weave = maps(pixels.weave), paint = maps(pixels.paint);
  const floorDetail = floor.detail;
  const sky = eveningSky();

  // Wood UVs are authored in metres, so one repeat factor holds everywhere.
  const woodMap = repeatFor(wood.albedo, WOOD_TILE), woodDetail = repeatFor(wood.detail, WOOD_TILE);
  const weaveMap = repeatFor(weave.detail, [.035, .035]);
  const paintMap = repeatFor(paint.detail, [.9, .9]);
  const textures: Texture[] = [wood.albedo, wood.detail, floor.albedo, floorDetail, weave.albedo, weave.detail, paint.albedo, paint.detail, sky, woodMap, woodDetail, weaveMap, paintMap];

  const woodFinish = (color: string, roughness: number) => new MeshStandardMaterial({
    color, roughness, map: woodMap, roughnessMap: woodDetail, bumpMap: woodDetail, bumpScale: .9, envMapIntensity: .75,
  });
  const paintFinish = (color: string, roughness: number, bump = .06) => new MeshStandardMaterial({
    color, roughness, roughnessMap: paintMap, bumpMap: paintMap, bumpScale: bump, envMapIntensity: .55,
  });
  // Sheen gives cloth its soft grazing highlight instead of a specular hotspot.
  const fabric = (color: string, sheen: string, roughness = .96, side: Material["side"] = 0) => new MeshPhysicalMaterial({
    color, roughness, roughnessMap: weaveMap, bumpMap: weaveMap, bumpScale: 1.6, sheen: 1, sheenRoughness: .78,
    sheenColor: new Color(sheen), envMapIntensity: .4, side,
  });

  const materials: Record<RoomFinish, MeshStandardMaterial> = {
    oak: woodFinish("#9a8467", .66),
    oakDark: woodFinish("#77644c", .62),
    walnut: woodFinish("#5a4636", .56),

    wall: paintFinish("#bdb6aa", .92),
    wallShade: paintFinish("#b2aca1", .92),
    trim: paintFinish("#d6d1c6", .42, .02),
    cabinetPaint: paintFinish("#8e897e", .5, .03),
    doorNight: paintFinish("#0d1322", .46, .03),
    casingNight: paintFinish("#39415a", .4, .02),

    linen: fabric("#c9c0ae", "#e9e2d4"),
    sheet: fabric("#dcd6ca", "#f3efe7"),
    duvet: fabric("#9d9584", "#cfc7b5", .96, DoubleSide),
    throw: fabric("#4d5048", "#7c8074", .98, DoubleSide),
    upholstery: fabric("#474a4d", "#6f7478"),
    mesh: fabric("#34373b", "#62676d", .88, DoubleSide),
    rug: fabric("#3a3730", "#5d584d", .99),
    rugBorder: fabric("#57503f", "#7d7462", .99),
    curtain: fabric("#5b5548", "#8b8472", .97, DoubleSide),
    lampShade: new MeshPhysicalMaterial({ color: "#e6dcc6", roughness: .9, emissive: "#d9a660", emissiveIntensity: .7, side: DoubleSide, sheen: .6, sheenColor: new Color("#fff1d6") }),

    blackSteel: new MeshStandardMaterial({ color: "#2c2e31", roughness: .38, metalness: .85, envMapIntensity: 1 }),
    aluminium: new MeshStandardMaterial({ color: "#b8bcbf", roughness: .3, metalness: 1, envMapIntensity: 1 }),
    chrome: new MeshStandardMaterial({ color: "#d8dadc", roughness: .12, metalness: 1, envMapIntensity: 1.1 }),
    brass: new MeshStandardMaterial({ color: "#a88a52", roughness: .32, metalness: 1, envMapIntensity: 1 }),

    plastic: new MeshStandardMaterial({ color: "#1f2124", roughness: .46, envMapIntensity: .8 }),
    plasticGrey: new MeshStandardMaterial({ color: "#3b3e42", roughness: .5, envMapIntensity: .8 }),
    keycap: new MeshStandardMaterial({ color: "#2a2c2f", roughness: .62, envMapIntensity: .6 }),
    rubber: new MeshStandardMaterial({ color: "#161718", roughness: .9, envMapIntensity: .3 }),
    ceramic: new MeshStandardMaterial({ color: "#d9d4ca", roughness: .3, envMapIntensity: .9 }),
    ceramicDark: new MeshStandardMaterial({ color: "#3c3a36", roughness: .42, envMapIntensity: .8 }),
    glass: new MeshPhysicalMaterial({ color: "#c9d6e6", roughness: .03, metalness: 0, transparent: true, opacity: .2, envMapIntensity: 2, depthWrite: false }),
    screen: new MeshStandardMaterial({ color: "#0d0f11", roughness: .12, envMapIntensity: .9 }),
    socket: new MeshStandardMaterial({ color: "#1a1b1c", roughness: .7 }),
    // Emitters stay small; the room reads their light from the shell shader's wash.
    led: new MeshStandardMaterial({ color: "#120f22", emissive: "#6a55e6", emissiveIntensity: 1.6, roughness: .6 }),
    ledDim: new MeshStandardMaterial({ color: "#141220", emissive: "#4d3fae", emissiveIntensity: .5, roughness: .7 }),
    keyLight: new MeshStandardMaterial({ color: "#18161f", emissive: "#a89ce8", emissiveIntensity: .34, roughness: .7 }),

    leaf: new MeshStandardMaterial({ color: "#46583a", roughness: .55, side: DoubleSide, envMapIntensity: .6 }),
    leafDark: new MeshStandardMaterial({ color: "#34432d", roughness: .6, side: DoubleSide, envMapIntensity: .5 }),
    soil: new MeshStandardMaterial({ color: "#2b241d", roughness: 1 }),

    brickRed: new MeshStandardMaterial({ color: "#a8322a", roughness: .36, envMapIntensity: .8 }),
    brickBlue: new MeshStandardMaterial({ color: "#2f5d91", roughness: .36, envMapIntensity: .8 }),
    brickYellow: new MeshStandardMaterial({ color: "#d2a431", roughness: .36, envMapIntensity: .8 }),
    brickWhite: new MeshStandardMaterial({ color: "#dcdcd5", roughness: .36, envMapIntensity: .8 }),
    pegboard: paintFinish("#c3bfb5", .72, .02),
    card: new MeshStandardMaterial({ color: "#8f8371", roughness: .86 }),
  };

  const floorMaterial = new MeshStandardMaterial({
    color: "#8a7560", roughness: .58, map: floor.albedo, roughnessMap: floorDetail, bumpMap: floorDetail, bumpScale: 1.1, envMapIntensity: .8,
  });
  // Floor UVs are in metres; the board pattern is laid out in scene units.
  for (const texture of [floor.albedo, floorDetail]) {
    texture.anisotropy = 16;
    texture.repeat.set(METRE / FLOOR_TILE[0], METRE / FLOOR_TILE[1]);
  }
  const skyMaterial = new MeshStandardMaterial({ color: "#000000", emissive: "#ffffff", emissiveMap: sky, roughness: 1 });

  return {
    materials,
    floor: floorMaterial,
    floorTile: FLOOR_TILE,
    sky: skyMaterial,
    dispose() {
      textures.forEach((texture) => texture.dispose());
      Object.values(materials).forEach((material) => material.dispose());
      floorMaterial.dispose();
      skyMaterial.dispose();
    },
  };
}

export type RoomSurfaces = ReturnType<typeof createRoomSurfaces>;
