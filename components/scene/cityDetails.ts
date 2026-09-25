import { Euler, Quaternion, Vector3 } from "three";

/** Shared micro-detail vocabulary for the district kits. Every helper reduces to
 * plain box and stud parts handed to the owning kit, so the details batch with
 * that kit's own finishes and instances and follow whichever moving assembly
 * the kit currently has selected. Coordinates are district-local; `y` is the
 * surface the object stands on. */

export type Role = "body" | "dark" | "metal" | "accent" | "trim" | "warm" | "wood" | "glass" | "lamp" | "hazard";
type V3 = [number, number, number];
export type DetailSink = {
  box: (role: Role, position: V3, size: V3, rotation?: V3, form?: "fin") => void;
  knob: (role: Role, position: V3) => void;
};

export function createDetails({ box, knob }: DetailSink) {
  /** A rigid bar between two points. */
  const line = (role: Role, from: V3, to: V3, thickness = .014) => {
    const a = new Vector3(...from), b = new Vector3(...to);
    const mid = a.clone().add(b).multiplyScalar(.5), dir = b.clone().sub(a), length = dir.length();
    const euler = new Euler().setFromQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir.normalize()));
    box(role, [mid.x, mid.y, mid.z], [thickness, length, thickness], [euler.x, euler.y, euler.z]);
  };

  /** Split-system condenser: casing, top plate, two fans and grille slats on the front. */
  const ac = (x: number, y: number, z: number, w = .1, d = .075) => {
    box("dark", [x, y + .026, z], [w, .052, d]);
    box("metal", [x, y + .056, z], [w * .94, .008, d * .94]);
    knob("metal", [x - w * .22, y + .063, z]); knob("metal", [x + w * .22, y + .063, z]);
    for (let i = 0; i < 3; i++) box("trim", [x, y + .014 + i * .014, z + d / 2 + .002], [w * .72, .006, .006]);
  };

  /** Louvred vent hood. */
  const vent = (x: number, y: number, z: number, w = .08, h = .05) => {
    box("dark", [x, y + h / 2, z], [w, h, w * .8]);
    box("metal", [x, y + h + .006, z], [w * 1.12, .012, w * .92]);
    for (let i = 0; i < 3; i++) box("trim", [x, y + .012 + i * h * .28, z + w * .4 + .002], [w * .74, .005, .005]);
  };

  /** Straight rail with posts, an axis-aligned run. */
  const rail = (x0: number, z0: number, x1: number, z1: number, y: number, h = .055, role: Role = "metal") => {
    const alongX = Math.abs(z1 - z0) < 1e-6, length = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
    const n = Math.max(1, Math.round(length / .075)), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      box(role, [x0 + (x1 - x0) * t, y + h / 2, z0 + (z1 - z0) * t], [.01, h, .01]);
    }
    for (const at of [1, .5]) box(role, [cx, y + h * at, cz], alongX ? [length, .008, .008] : [.008, .008, length]);
  };

  /** A square pipe run along an axis, standing or lying. */
  const pipe = (role: Role, x: number, y: number, z: number, length: number, axis: "x" | "y" | "z", t = .014) => {
    const size: V3 = axis === "x" ? [length, t, t] : axis === "y" ? [t, length, t] : [t, t, length];
    box(role, [x, axis === "y" ? y + length / 2 : y, z], size);
  };

  /** Mast with crossarms and a tip. */
  const mast = (x: number, y: number, z: number, h: number, arms = 2, tip: Role = "hazard") => {
    box("metal", [x, y + h / 2, z], [.014, h, .014]);
    for (let i = 0; i < arms; i++) box("metal", [x, y + h * (.55 + i * .2), z], [.07 - i * .02, .008, .008]);
    box(tip, [x, y + h + .008, z], [.02, .016, .02]);
  };

  /** Equipment cabinet with a door seam and handle facing +z. */
  const cabinet = (x: number, y: number, z: number, w = .08, h = .1, d = .05) => {
    box("dark", [x, y + h / 2, z], [w, h, d]);
    box("metal", [x, y + h + .004, z], [w + .008, .008, d + .008]);
    box("trim", [x, y + h / 2, z + d / 2 + .001], [.004, h * .84, .004]);
    box("trim", [x + w * .16, y + h * .5, z + d / 2 + .004], [.006, .02, .006]);
  };

  /** Steps climbing toward `dir`; `x,z` is the foot of the lowest step. */
  const stairs = (x: number, y: number, z: number, steps: number, dir: "+x" | "-x" | "+z" | "-z", width = .1, rise = .03, run = .04, role: Role = "body") => {
    const s = dir[0] === "+" ? 1 : -1, alongX = dir[1] === "x";
    for (let i = 0; i < steps; i++) {
      const h = rise * (i + 1), o = (i + .5) * run * s;
      box(role, [alongX ? x + o : x, y + h / 2, alongX ? z : z + o], alongX ? [run, h, width] : [width, h, run]);
    }
  };

  /** Ladder with rungs, against a face looking toward +z. */
  const ladder = (x: number, y: number, z: number, h: number, w = .05) => {
    for (const o of [-w / 2, w / 2]) box("metal", [x + o, y + h / 2, z], [.007, h, .007]);
    for (let i = 1; i < Math.floor(h / .035); i++) box("metal", [x, y + i * .035, z], [w, .006, .006]);
  };

  /** Projecting cornice/ledge along X or Z. */
  const ledge = (role: Role, x: number, y: number, z: number, w: number, d: number, h = .014) => box(role, [x, y + h / 2, z], [w, h, d]);

  /** Skylight: frame, glazing and a ridge bar. */
  const skylight = (x: number, y: number, z: number, w = .14, d = .09) => {
    box("metal", [x, y + .008, z], [w, .016, d]);
    box("glass", [x, y + .02, z], [w - .022, .012, d - .022]);
    box("metal", [x, y + .028, z], [.008, .008, d]);
  };

  /** Small satellite dish on a stub: a tilted plate, a feed boom and a hub stud. */
  const dish = (x: number, y: number, z: number, size = .09, turn = 0) => {
    box("metal", [x, y + .02, z], [.012, .04, .012]);
    box("trim", [x, y + .052, z], [size, .012, size], [-.6, turn, 0]);
    box("metal", [x, y + .07, z + Math.sin(turn) * .0], [.006, .05, .006], [-.6, turn, 0]);
    knob("metal", [x, y + .062, z]);
  };

  /** A little tree in the model's own idiom: trunk and stacked crowns. */
  const tree = (x: number, y: number, z: number, s = 1, crown: Role = "accent") => {
    box("wood", [x, y + .04 * s, z], [.028 * s, .08 * s, .028 * s]);
    box(crown, [x, y + .11 * s, z], [.13 * s, .07 * s, .12 * s]);
    box(crown, [x, y + .165 * s, z], [.085 * s, .05 * s, .08 * s]);
    knob(crown, [x, y + .195 * s, z]);
  };

  /** Planter box with a low hedge. */
  const planter = (x: number, y: number, z: number, w = .12, d = .05) => {
    box("wood", [x, y + .015, z], [w, .03, d]);
    box("accent", [x, y + .04, z], [w - .01, .03, d - .01]);
  };

  /** A tiny lamp post. */
  const lamp = (x: number, y: number, z: number, h = .12) => {
    box("metal", [x, y + h / 2, z], [.008, h, .008]);
    box("lamp", [x, y + h + .008, z], [.022, .014, .022]);
  };

  return { line, ac, vent, rail, pipe, mast, cabinet, stairs, ladder, ledge, skylight, dish, tree, planter, lamp, box, knob };
}

export type Details = ReturnType<typeof createDetails>;
