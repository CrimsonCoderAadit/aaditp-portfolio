import type { SaberId } from "../roomInteractions";
import { Assembly, bevelBox, rod, tube, turned, type Vec3 } from "./shapes";

/** The saber display table and its five hilts, authored in metres with the
 * table's front toward local +z and its length along x. Each hilt is an
 * original approximation built from turned sections: the silhouette carries
 * the reference, not any one prop's detail. */

export const TABLE = { length: 1.25, depth: .42, height: .82 } as const;
const TOP = TABLE.height;

/** Blade colours as linear RGB: glow and white-hot centre. */
const RED: [Vec3, Vec3] = [[1, .07, .035], [1, .78, .72]];
const BLUE: [Vec3, Vec3] = [[.08, .32, 1], [.78, .9, 1]];
const GREEN: [Vec3, Vec3] = [[.12, 1, .18], [.82, 1, .82]];

export type SaberSpec = {
  id: SaberId; label: string; colour: [Vec3, Vec3];
  /** Where the hilt's emitter ends, and the blade's direction(s) from there, table-local. */
  emitters: { at: Vec3; toward: Vec3 }[];
  /** The hilt's footprint for pointing at it: centre and size. */
  hit: { at: Vec3; size: Vec3 };
  plate: Vec3;
};

const UPRIGHT_Z = .06, BASE = TOP + .03, BLADE = .95;
const up = (x: number, length: number): SaberSpec["emitters"][number] => ({ at: [x, BASE + length, UPRIGHT_Z], toward: [0, 1, 0] });
const MAUL_Y = TOP + .42, MAUL_Z = -.11, MAUL_HALF = .275;

export const SABERS: SaberSpec[] = [
  { id: "vader", label: "Vader", colour: RED, emitters: [up(-.45, .28)], hit: { at: [-.45, BASE + .14, UPRIGHT_Z], size: [.09, .34, .09] }, plate: [-.45, TOP + .012, .18] },
  { id: "kenobi", label: "Kenobi", colour: BLUE, emitters: [up(-.15, .275)], hit: { at: [-.15, BASE + .14, UPRIGHT_Z], size: [.09, .34, .09] }, plate: [-.15, TOP + .012, .18] },
  { id: "dooku", label: "Dooku", colour: RED, emitters: [{ at: [.19, BASE + .27, UPRIGHT_Z], toward: [.14, 1, 0] }], hit: { at: [.16, BASE + .14, UPRIGHT_Z], size: [.1, .34, .09] }, plate: [.15, TOP + .012, .18] },
  { id: "skywalker", label: "Skywalker", colour: GREEN, emitters: [up(.45, .265)], hit: { at: [.45, BASE + .14, UPRIGHT_Z], size: [.09, .34, .09] }, plate: [.45, TOP + .012, .18] },
  {
    id: "maul", label: "Maul", colour: RED,
    emitters: [{ at: [-MAUL_HALF, MAUL_Y, MAUL_Z], toward: [-1, 0, 0] }, { at: [MAUL_HALF, MAUL_Y, MAUL_Z], toward: [1, 0, 0] }],
    hit: { at: [0, MAUL_Y, MAUL_Z], size: [.6, .08, .08] }, plate: [0, TOP + .012, -.17],
  },
];
export const BLADE_LENGTH = BLADE;

export function buildSaberTable() {
  const t = new Assembly();
  const { length, depth } = TABLE;
  // A dark lacquered case on a slim steel plinth, the top inset with felt.
  t.add("blackSteel", bevelBox([length - .16, .04, depth - .12], .004), [0, .02, 0]);
  t.add("blackSteel", bevelBox([length - .24, TOP - .16, .06], .004, "y"), [0, (TOP - .16) / 2 + .04, 0]);
  t.add("casingNight", bevelBox([length, .12, depth], .01), [0, TOP - .06, 0]);
  t.add("upholstery", bevelBox([length - .06, .006, depth - .06], .002), [0, TOP + .001, 0]);
  t.add("brass", bevelBox([length + .004, .006, depth + .004], .002), [0, TOP - .004, 0]);
  // Four upright holders: a turned brass collar on a small black base.
  for (const x of [-.45, -.15, .15, .45]) {
    t.add("blackSteel", turned([[0, 0], [.035, 0], [.035, .012], [.02, .018], [0, .02]], 24), [x, TOP, UPRIGHT_Z]);
    t.add("brass", turned([[.021, 0], [.024, 0], [.024, .03], [.021, .03]], 24), [x, TOP + .012, UPRIGHT_Z]);
  }
  // The staff's rack: two slim posts with cradles.
  for (const x of [-.18, .18]) {
    t.add("blackSteel", rod(.006, MAUL_Y - TOP - .02, 10), [x, (TOP + MAUL_Y - .02) / 2, MAUL_Z]);
    t.add("brass", bevelBox([.03, .012, .04], .004), [x, MAUL_Y - .026, MAUL_Z]);
  }
  // Brass name plates along the front edge, and one for the staff behind.
  for (const saber of SABERS) t.add("brass", bevelBox([.1, .004, .026], .001), saber.plate);

  return t.build();
}

/** One hilt on its own, at its place on the table, so it can lift when picked out. */
export function buildHilt(id: SaberId) {
  const t = new Assembly();
  ({ vader: () => vader(t, -.45), kenobi: () => kenobi(t, -.15), dooku: () => dooku(t, .15), skywalker: () => skywalker(t, .45), maul: () => maul(t) })[id]();
  return t.build();
}

/** Vader: a dark mechanical hilt, ribbed black grip, chrome shroud with a
 * slight flare at the emitter. */
function vader(t: Assembly, x: number) {
  t.add("chrome", turned([[0, 0], [.013, 0], [.014, .012], [.0125, .03], [.0125, .03], [0, .03]], 20), [x, BASE, UPRIGHT_Z]);
  for (let i = 0; i < 7; i++) t.add("rubber", turned([[.0138, 0], [.0138, .011], [.0128, .014]], 20), [x, BASE + .032 + i * .015, UPRIGHT_Z]);
  t.add("blackSteel", turned([[.0125, 0], [.0135, 0], [.0135, .06], [.0125, .06]], 20), [x, BASE + .14, UPRIGHT_Z]);
  t.add("plastic", bevelBox([.012, .018, .006], .002), [x, BASE + .17, UPRIGHT_Z + .013]);
  t.add("chrome", turned([[.013, 0], [.017, .05], [.0165, .08], [.014, .08]], 20), [x, BASE + .2, UPRIGHT_Z]);
}

/** Kenobi: the classic silver hilt, black grip rings, a thin neck under a
 * flared emitter. */
function kenobi(t: Assembly, x: number) {
  t.add("aluminium", turned([[0, 0], [.012, 0], [.0135, .02], [.0125, .04]], 20), [x, BASE, UPRIGHT_Z]);
  for (let i = 0; i < 6; i++) t.add("rubber", turned([[.0132, 0], [.0132, .012], [.0125, .014]], 20), [x, BASE + .04 + i * .016, UPRIGHT_Z]);
  t.add("aluminium", turned([[.0125, 0], [.0125, .06], [.0075, .075], [.0075, .1], [.014, .105], [.0155, .135], [.013, .135]], 20), [x, BASE + .14, UPRIGHT_Z]);
}

/** Dooku: an elegant curved hilt, dark leather with gold furniture. */
function dooku(t: Assembly, x: number) {
  const points: Vec3[] = [[x, BASE, UPRIGHT_Z], [x + .01, BASE + .08, UPRIGHT_Z], [x + .026, BASE + .17, UPRIGHT_Z], [x + .04, BASE + .27, UPRIGHT_Z]];
  t.add("plastic", tube(points, .0135, 16), [0, 0, 0]);
  t.add("brass", turned([[0, 0], [.015, 0], [.015, .02], [0, .024]], 20), [x, BASE - .004, UPRIGHT_Z]);
  t.add("brass", tube([[x + .026, BASE + .17, UPRIGHT_Z], [x + .04, BASE + .27, UPRIGHT_Z]], .0152, 16), [0, 0, 0]);
  t.add("brass", tube([[x + .004, BASE + .05, UPRIGHT_Z], [x + .012, BASE + .1, UPRIGHT_Z]], .0145, 16), [0, 0, 0]);
}

/** Skywalker: a slimmer black hilt with a silver vented emitter. */
function skywalker(t: Assembly, x: number) {
  t.add("blackSteel", turned([[0, 0], [.0115, 0], [.0115, .16], [.011, .16]], 20), [x, BASE, UPRIGHT_Z]);
  for (let i = 0; i < 5; i++) t.add("aluminium", turned([[.0118, 0], [.0118, .004], [.0112, .004]], 20), [x, BASE + .02 + i * .026, UPRIGHT_Z]);
  t.add("aluminium", turned([[.0112, 0], [.013, .02], [.013, .1], [.0122, .105]], 20), [x, BASE + .16, UPRIGHT_Z]);
  for (let i = 0; i < 4; i++) t.add("plastic", bevelBox([.004, .05, .003], .001), [x + Math.cos(i * Math.PI / 2) * .0125, BASE + .215, UPRIGHT_Z + Math.sin(i * Math.PI / 2) * .0125]);
}

/** Maul: one long staff, two emitters, the grip ridged down its middle. */
function maul(t: Assembly) {
  const turn: Vec3 = [0, 0, Math.PI / 2];
  t.add("blackSteel", rod(.0135, MAUL_HALF * 2 - .08, 20), [0, MAUL_Y, MAUL_Z], turn);
  for (let i = -3; i <= 3; i++) t.add("rubber", rod(.0145, .012, 20), [i * .03, MAUL_Y, MAUL_Z], turn);
  for (const side of [-1, 1]) {
    t.add("chrome", rod(.015, .05, 20), [side * (MAUL_HALF - .03), MAUL_Y, MAUL_Z], turn);
    t.add("blackSteel", rod(.016, .01, 20), [side * (MAUL_HALF - .005), MAUL_Y, MAUL_Z], turn);
  }
}
