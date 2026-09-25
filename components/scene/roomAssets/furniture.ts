import type { RoomFinish } from "./surfaces";
import { Assembly, bevelBox, drape, ellipsoid, plainBox, rod, softOutline, softPanel, tube, turned, type SoftPanelOptions, type Vec3 } from "./shapes";

/** Hero furniture, authored in metres in each piece's own frame (floor at y = 0,
 * front toward +Z). Every piece merges to one mesh per finish. Dimensions and
 * anchor points match the approved layout; only the construction changed. */

const HALF_PI = Math.PI / 2;

// ---------------------------------------------------------------------------

export const BED = { mattressTop: .58, mattress: [1.26, .24, 1.96] as Vec3 };

export function buildBed() {
  const bed = new Assembly();
  const [mw, mh, ml] = BED.mattress;
  const top = BED.mattressTop;

  // Platform: recessed walnut plinth, oak rails with softened arrises.
  bed.add("walnut", bevelBox([1.22, .16, 1.90], .01, "z"), [0, .08, 0]);
  for (const x of [-.655, .655]) bed.add("oak", bevelBox([.05, .22, 2.04], .012, "z"), [x, .31, 0]);
  bed.add("oak", bevelBox([1.36, .22, .05], .012), [0, .31, 1.0]);
  bed.add("oakDark", bevelBox([1.26, .03, 1.92], .004, "z"), [0, top - mh - .015, 0]);

  // Headboard: oak posts and cap framing six upholstered channels.
  for (const x of [-.655, .655]) bed.add("oak", bevelBox([.05, .96, .06], .012, "y"), [x, .48, -1.03]);
  bed.add("oak", bevelBox([1.37, .045, .08], .014), [0, .975, -1.03]);
  bed.add("oakDark", bevelBox([1.26, .56, .02], .004), [0, .68, -1.05]);
  for (let i = 0; i < 6; i++) {
    bed.add("upholstery", softPanel({ width: .205, height: .52, depth: .07, corner: 4, fullness: .55, back: .3, segments: [10, 20] }), [-.525 + i * .21, .685, -1.02]);
  }

  bed.add("sheet", bevelBox([mw, mh, ml], .05, "x", 4), [0, top - mh / 2, 0]);

  // Duvet from mid-bed over the foot, a sheet turned back over its head edge,
  // a folded throw across the foot and two pillows propped on the headboard.
  const duvetFrom = -.36;
  bed.add("duvet", drape({ width: 1.30, length: .98 - duvetFrom + .02, dropSides: .22, dropFoot: .2, roll: .05, loft: .05, wrinkle: .01, thickness: .03, seed: 2 }), [0, top + .004, duvetFrom]);
  bed.add("sheet", drape({ width: 1.36, length: .30, dropSides: .19, dropFoot: .035, roll: .035, loft: .02, wrinkle: .006, thickness: .022, seed: 5, segments: [64, 20] }), [0, top + .06, duvetFrom + .27], [0, Math.PI, 0]);
  bed.add("throw", drape({ width: 1.40, length: .42, dropSides: .27, dropFoot: 0, roll: .06, loft: .012, wrinkle: .012, thickness: .012, seed: 9, segments: [72, 24] }), [-.01, top + .058, .47], [0, -.02, 0]);
  const pillow: SoftPanelOptions = { width: .64, height: .42, depth: .16, corner: 3.2, fullness: .7, segments: [24, 18] };
  bed.add("sheet", softPanel(pillow), [-.31, top + .11, -.79], [-1.2, .06, .02]);
  bed.add("linen", softPanel({ ...pillow, depth: .14 }), [.32, top + .1, -.76], [-1.28, -.12, -.03]);
  return bed.build();
}

export function buildBedsideTable() {
  const table = new Assembly();
  for (const x of [-.17, .17]) for (const z of [-.155, .155]) table.add("blackSteel", rod(.011, .17, 12, .008), [x, .085, z]);
  table.add("oak", bevelBox([.42, .33, .40], .008), [0, .335, 0]);
  table.add("oakDark", bevelBox([.39, .135, .014], .004), [0, .41, .203]);
  table.add("oakDark", bevelBox([.39, .12, .006], .002), [0, .245, .197]);
  table.add("brass", rod(.006, .09, 10), [0, .41, .222], [0, 0, HALF_PI]);
  for (const x of [-.045, .045]) table.add("brass", rod(.004, .012, 8), [x, .41, .214], [HALF_PI, 0, 0]);
  return table.build();
}

/** Two-door painted wardrobe, built to open: a hollow carcass with a divider,
 * each shaker door a separate leaf hung from its own hinge line, and a lived-in
 * interior. Wardrobe-local metres; the front face is at z = +0.28. */
export const WARDROBE_HINGE = { x: .597, z: .29 } as const;
/** Where the flute case rests on the top shelf, wardrobe-local. */
export const WARDROBE_FLUTE = [.2, 1.86, -.02] as const;

export function buildWardrobeCarcass() {
  const wardrobe = new Assembly();
  wardrobe.add("walnut", bevelBox([1.14, .08, .52], .006), [0, .04, -.02]);
  wardrobe.add("cabinetPaint", bevelBox([1.2, .03, .58], .004), [0, .095, -.01]);
  wardrobe.add("cabinetPaint", bevelBox([1.2, 1.93, .02], .004, "y"), [0, 1.045, -.29]);
  for (const x of [-.59, .59]) wardrobe.add("cabinetPaint", bevelBox([.02, 1.93, .58], .004, "y"), [x, 1.045, -.01]);
  wardrobe.add("cabinetPaint", bevelBox([1.2, .03, .58], .004), [0, 1.995, -.01]);
  wardrobe.add("cabinetPaint", bevelBox([1.23, .04, .61], .01), [0, 2.03, -.005]);
  // Stepped cornice over the top and a skirting band across the kick, so the
  // carcass has a moulded profile rather than a box edge.
  wardrobe.add("cabinetPaint", bevelBox([1.27, .022, .63], .008), [0, 2.061, -.005]);
  wardrobe.add("cabinetPaint", bevelBox([1.215, .018, .6], .006), [0, 2.003, -.005]);
  wardrobe.add("cabinetPaint", bevelBox([1.2, .05, .014], .004), [0, .055, .258]);
  wardrobe.add("cabinetPaint", bevelBox([.02, 1.88, .56], .003, "y"), [0, 1.045, -.01]);
  wardrobe.add("oakDark", plainBox([1.16, 1.86, .004]), [0, 1.045, -.277]);
  return wardrobe.build();
}

/** One door leaf, drawn about its hinge line: `side` +1 for the leaf whose
 * hinge is at +x, -1 for the other. */
export function buildWardrobeDoor(side: 1 | -1) {
  const door = new Assembly();
  const cx = -side * .298;
  door.add("cabinetPaint", bevelBox([.594, 1.90, .02], .003, "y"), [cx, 1.045, 0]);
  for (const edge of [-1, 1]) door.add("cabinetPaint", bevelBox([.075, 1.90, .012], .004, "y"), [cx + edge * .2595, 1.045, .015]);
  for (const y of [.13, 1.045, 1.96]) door.add("cabinetPaint", bevelBox([.445, .08, .012], .004), [cx, y, .015]);
  // Fielded panels inside the frame, with a bead where they meet it.
  for (const y of [.5875, 1.5025]) {
    door.add("cabinetPaint", bevelBox([.41, .8, .008], .006), [cx, y, .012]);
    for (const edge of [-1, 1]) {
      door.add("cabinetPaint", rod(.0035, .82, 8), [cx + edge * .2155, y, .016]);
      door.add("cabinetPaint", rod(.0035, .431, 8), [cx, y + edge * .4135, .016], [0, 0, HALF_PI]);
    }
  }
  // Exposed barrel hinges on the hinge line.
  for (const y of [.28, 1.045, 1.81]) {
    door.add("blackSteel", rod(.0065, .075, 12), [0, y, 0]);
    for (const end of [-1, 1]) door.add("blackSteel", rod(.0075, .004, 12), [0, y + end * .039, 0]);
  }
  return door.build();
}

/** The pull on a door leaf, apart so it can catch the light on hover. */
export function buildWardrobePull(side: 1 | -1) {
  const pull = new Assembly();
  const x = -side * .513;
  pull.add("blackSteel", rod(.008, .62, 12), [x, 1.12, .055]);
  for (const y of [.84, 1.40]) pull.add("blackSteel", rod(.005, .035, 8), [x, y, .035], [HALF_PI, 0, 0]);
  return pull.build();
}

/** What is inside: clothes on a rail on the left, shelves on the right with
 * folded stacks, a tangle of spare cables in a box, a backpack on the floor
 * and a couple of shelves left with room to spare. */
export function buildWardrobeInterior() {
  const inside = new Assembly();
  // A divider: hanging on the left, shelves on the right.
  inside.add("oakDark", bevelBox([.018, 1.87, .54], .003, "y"), [.0, 1.045, -.02]);
  for (const y of [.55, 1.05, 1.5, 1.85]) inside.add("oakDark", bevelBox([.56, .022, .54], .003), [.29, y, -.02]);
  inside.add("aluminium", rod(.009, .56, 12), [-.29, 1.76, -.02], [0, 0, HALF_PI]);

  // On the rail, left to right: a jacket, a hoodie, three shirts and two pairs
  // of trousers folded over their hangers. Each hangs sideways, as they would.
  const hanger = (x: number, width: number) => {
    inside.add("aluminium", tube([[x, 1.735, 0], [x, 1.765, .006], [x, 1.78, -.012], [x, 1.765, -.024]], .0028, 5), [0, 0, -.01]);
    inside.add("walnut", bevelBox([.012, .014, width], .004), [x, 1.715, -.02], [0, 0, 0]);
  };
  const garments: { x: number; finish: RoomFinish; kind: "jacket" | "hoodie" | "shirt" | "trousers"; lean: number }[] = [
    { x: -.53, finish: "upholstery", kind: "jacket", lean: -.04 },
    { x: -.45, finish: "throw", kind: "hoodie", lean: .05 },
    { x: -.375, finish: "sheet", kind: "shirt", lean: -.03 },
    { x: -.315, finish: "curtain", kind: "shirt", lean: .04 },
    { x: -.255, finish: "linen", kind: "shirt", lean: -.02 },
    { x: -.18, finish: "upholstery", kind: "trousers", lean: .03 },
    { x: -.105, finish: "duvet", kind: "trousers", lean: -.04 },
  ];
  for (const { x, finish, kind, lean } of garments) {
    hanger(x, kind === "trousers" ? .34 : .4);
    const turn: Vec3 = [0, lean, 0];
    if (kind === "trousers") {
      // Folded over the bar: two legs' worth of cloth each side of it.
      inside.add(finish, bevelBox([.028, .5, .3], .012, "y"), [x, 1.465, -.02], turn);
      inside.add(finish, bevelBox([.012, .03, .31], .01), [x, 1.715, -.02], turn);
      continue;
    }
    const thick = kind === "shirt" ? .026 : kind === "hoodie" ? .06 : .055;
    const length = kind === "shirt" ? .74 : kind === "hoodie" ? .66 : .86;
    // Shoulders slope off the hanger; the body hangs straight below them.
    inside.add(finish, bevelBox([thick, .1, .4], .012, "y"), [x, 1.66, -.02], turn);
    inside.add(finish, bevelBox([thick, length - .08, .44], .014, "y"), [x, 1.66 - length / 2, -.02], turn);
    if (kind === "shirt") inside.add(finish, bevelBox([thick + .008, .035, .07], .006), [x, 1.715, .03], turn);
    if (kind === "hoodie") inside.add(finish, ellipsoid([.04, .09, .1], 12, 8), [x, 1.66, -.2], turn);
    if (kind === "jacket") for (const dz of [-.12, .12]) inside.add("plasticGrey", bevelBox([thick + .004, .01, .006], .002), [x, 1.3, -.02 + dz], turn);
  }

  // A backpack on the floor under the shirts: body, front pocket, top handle, straps.
  inside.add("upholstery", bevelBox([.2, .38, .3], .06, "y"), [-.34, .305, -.06], [0, .12, 0]);
  inside.add("throw", bevelBox([.06, .18, .22], .03, "y"), [-.23, .23, -.05], [0, .12, 0]);
  inside.add("plasticGrey", bevelBox([.012, .006, .12], .002), [-.2, .3, -.05], [0, .12, 0]);
  inside.add("blackSteel", tube([[-.36, .49, -.1], [-.36, .53, -.06], [-.36, .49, -.02]], .008, 6), [0, 0, 0]);
  for (const dz of [-.12, .02]) inside.add("plastic", bevelBox([.02, .32, .04], .01, "y"), [-.455, .31, -.06 + dz], [0, .12, .08]);
  // A spare blanket, rolled, beside it.
  inside.add("duvet", rod(.075, .36, 16), [-.13, .185, .02], [HALF_PI, 0, 0]);

  // Bottom shelf bay: a lidded storage box.
  inside.add("walnut", bevelBox([.3, .2, .34], .006), [.3, .21, -.03]);
  inside.add("oak", bevelBox([.31, .02, .35], .004), [.3, .32, -.03]);
  // First shelf: two stacks of folded clothes and a folded towel.
  const stack = (x: number, finishes: RoomFinish[], width = .22) => finishes.forEach((finish, i) => inside.add(finish, bevelBox([width, .045, .22], .016), [x + (i % 2 ? .006 : -.004), .585 + i * .046, -.01]));
  stack(.15, ["throw", "linen", "upholstery", "sheet"]);
  stack(.42, ["duvet", "curtain", "linen"], .2);
  // Second shelf: a cable box with a coil spilling from it, and a controller case.
  inside.add("plasticGrey", bevelBox([.22, .12, .18], .004), [.16, 1.12, 0]);
  inside.add("blackSteel", tube([[.14, 1.18, .02], [.2, 1.21, .05], [.27, 1.19, -.02], [.32, 1.22, .04]], .006, 6), [0, 0, 0]);
  inside.add("plastic", bevelBox([.2, .07, .15], .03), [.42, 1.1, .02], [0, -.2, 0]);
  inside.add("plasticGrey", bevelBox([.12, .006, .07], .002), [.42, 1.137, .02], [0, -.2, 0]);
  // Third shelf: notebooks, one open-spined on top, and a keepsake box.
  for (const [i, finish] of (["plastic", "walnut", "plastic"] as RoomFinish[]).entries()) inside.add(finish, bevelBox([.17, .018, .23], .003), [.16 + i * .004, 1.52 + i * .019, -.02], [0, i * .08 - .05, 0]);
  inside.add("sheet", bevelBox([.165, .012, .225], .002), [.165, 1.575, -.02], [0, .05, 0]);
  inside.add("oak", bevelBox([.2, .12, .15], .005), [.43, 1.57, -.04]);
  inside.add("walnut", bevelBox([.14, .1, .14], .005), [.49, 1.91, -.06]);
  // An open flute case on the top shelf: lid up at the back, the three joints
  // resting in the lining.
  const [fx, fy, fz] = WARDROBE_FLUTE;
  inside.add("plastic", bevelBox([.36, .035, .1], .006), [fx, fy + .0175, fz]);
  inside.add("throw", bevelBox([.34, .006, .084], .002), [fx, fy + .035, fz]);
  inside.add("plastic", bevelBox([.36, .095, .012], .004), [fx, fy + .08, fz - .056], [-.25, 0, 0]);
  for (const [x, z, length] of [[fx - .07, fz + .018, .3], [fx - .105, fz - .02, .17], [fx + .12, fz - .02, .1]] as const) {
    inside.add("chrome", rod(.0095, length, 16), [x, fy + .047, z], [0, 0, HALF_PI]);
  }
  for (let i = 0; i < 6; i++) inside.add("chrome", rod(.006, .004, 12), [fx - .16 + i * .045, fy + .058, fz + .018]);
  inside.add("chrome", bevelBox([.02, .003, .014], .001), [fx - .16, fy + .058, fz - .02]);
  return inside.build();
}

/** Open shelving beside the desk; shelf heights are fixed by the decoration. */
export function buildBookshelf() {
  const shelf = new Assembly();
  shelf.add("blackSteel", bevelBox([.70, .04, .26], .004), [0, .02, 0]);
  for (const x of [-.3775, .3775]) shelf.add("oakDark", bevelBox([.025, 1.38, .30], .004, "y"), [x, .73, 0]);
  for (const y of [.06, .40, .74, 1.08]) shelf.add("oakDark", bevelBox([.73, .022, .29], .003), [0, y, 0]);
  shelf.add("oakDark", bevelBox([.79, .03, .31], .006), [0, 1.43, 0]);
  shelf.add("walnut", bevelBox([.73, 1.36, .012], .002, "y"), [0, .74, -.144]);
  return shelf.build();
}

// ---------------------------------------------------------------------------

/** Keyboard rows in key units; negative entries are gaps. */
const KEY_ROWS = [
  [1, -1, 1, 1, 1, 1, -.5, 1, 1, 1, 1, -.5, 1, 1, 1, 1, -.5, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, -.5, 1, 1, 1, 1],
  [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5, -.5, 1, 1, 1, 1],
  [1.75, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.25, -.5, 1, 1, 1, 1],
  [2.25, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.75, -.5, 1, 1, 1, 1],
  [1.25, 1.25, 1.25, 6.25, 1.25, 1.25, 1.25, 1.25, -.5, 2, 1, 1],
];

/** Low-profile board: a dark aluminium case, a faint backlit plate that shows
 * only in the gaps between the caps, and sculpted keycaps. */
function keyboard() {
  const board = new Assembly();
  const pitch = .0192;
  board.add("blackSteel", bevelBox([.44, .016, .142], .006), [0, .008, 0]);
  board.add("plasticGrey", bevelBox([.425, .002, .128], .001), [0, .0162, 0]);
  board.add("keyLight", bevelBox([.372, .002, .118], .001), [0, .0166, -.002]);
  KEY_ROWS.forEach((row, r) => {
    const width = row.reduce((sum, unit) => sum + Math.abs(unit), 0) * pitch;
    let x = -width / 2;
    for (const unit of row) {
      const span = Math.abs(unit) * pitch;
      if (unit > 0) board.add("keycap", bevelBox([span - .0034, .0085, pitch - .0036], .0022, "x", 1), [x + span / 2, .0215, -.052 + r * pitch + (r > 0 ? .004 : 0)]);
      x += span;
    }
  });
  return board;
}

/** Sculpted mouse: split primary buttons, a scroll wheel, rubber side grips
 * and a hairline violet accent at the heel. Front toward -Z. */
function mouse() {
  const m = new Assembly();
  m.add("plastic", ellipsoid([.031, .02, .06], 32, 12, HALF_PI), [0, 0, 0]);
  m.add("plasticGrey", bevelBox([.0012, .004, .05], .0005), [0, .0165, -.03], [-.3, 0, 0]);
  m.add("rubber", rod(.0042, .007, 14), [0, .0185, -.024], [0, 0, HALF_PI]);
  for (const side of [-1, 1]) m.add("rubber", ellipsoid([.004, .011, .034], 12, 8, HALF_PI), [side * .0285, .002, .004], [0, 0, side * .25]);
  m.add("led", bevelBox([.026, .0016, .003], .0007), [0, .004, .058], [-.2, 0, 0]);
  return m;
}

/** Slim panel: thin side and top bezels raised a hair proud of the recessed
 * glass, a deeper chin, a stepped rear housing with a vent band, a VESA plate
 * and tilt knuckle, and a violet bias strip around the back facing the wall. */
function monitor() {
  const display = new Assembly();
  display.add("plastic", bevelBox([.548, .322, .012], .003), [0, .004, .002]);
  display.add("screen", bevelBox([.536, .302, .002], .0006), [0, .006, .0078]);
  display.add("plastic", bevelBox([.548, .009, .003], .0012), [0, .1595, .0095]);
  display.add("plastic", bevelBox([.548, .014, .003], .0012), [0, -.149, .0095]);
  for (const x of [-.2695, .2695]) display.add("plastic", bevelBox([.009, .3, .003], .0012, "y"), [x, .006, .0095]);
  display.add("aluminium", bevelBox([.024, .0025, .001], .0008), [0, -.149, .0112]);
  display.add("plastic", bevelBox([.42, .25, .022], .01), [0, .006, -.014]);
  display.add("plastic", bevelBox([.26, .17, .02], .012), [0, .012, -.032]);
  for (let i = 0; i < 6; i++) display.add("plasticGrey", bevelBox([.3, .003, .002], .001), [0, .07 + i * .008, -.0255]);
  display.add("aluminium", bevelBox([.1, .1, .006], .003), [0, .012, -.045]);
  display.add("blackSteel", bevelBox([.05, .05, .018], .006), [0, .012, -.056]);
  display.add("aluminium", rod(.012, .07, 16), [0, .012, -.066], [0, 0, HALF_PI]);
  // Bias strip on the rear housing's perimeter, invisible from the chair.
  for (const y of [-.114, .126]) display.add("led", bevelBox([.39, .004, .004], .0015), [0, y, -.0255]);
  for (const x of [-.2035, .2035]) display.add("led", bevelBox([.004, .23, .004], .0015, "y"), [x, .006, -.0255]);
  return display;
}

export const MONITORS: { at: Vec3; turn: number }[] = [
  { at: [-.30, 1.16, -.175], turn: .20 },
  { at: [.30, 1.16, -.175], turn: -.20 },
];
/** Panel content sits on each monitor's glass: centre, then size. */
export const MONITOR_GLASS = { at: [0, .006, .0092] as Vec3, size: [.532, .298] as [number, number] };

/** Glass-sided small-form tower: a steel chassis with a vented front, a
 * tempered side window toward the room and a restrained violet interior. */
function tower() {
  const pc = new Assembly();
  const [w, h, d] = [.2, .43, .45];
  const y0 = .03, yc = y0 + h / 2;
  // Chassis: solid back side, roof, floor, rear and a vented front fascia.
  pc.add("blackSteel", bevelBox([.006, h, d], .003, "z"), [-w / 2 + .003, yc, 0]);
  for (const y of [y0 + .004, y0 + h - .004]) pc.add("blackSteel", bevelBox([w, .008, d], .004, "z"), [0, y, 0]);
  pc.add("blackSteel", bevelBox([w, h, .006], .003), [0, yc, -d / 2 + .003]);
  pc.add("plastic", bevelBox([w, h, .014], .006, "y"), [0, yc, d / 2 - .007]);
  for (let i = 0; i < 11; i++) pc.add("plasticGrey", bevelBox([.004, h - .1, .003], .0015, "y"), [-.06 + i * .012, yc - .015, d / 2 + .001]);
  pc.add("aluminium", rod(.008, .004, 20), [.07, y0 + h - .028, d / 2 + .002], [HALF_PI, 0, 0]);
  pc.add("led", rod(.0022, .002, 10), [.07, y0 + h - .028, d / 2 + .0045], [HALF_PI, 0, 0]);
  pc.add("plasticGrey", bevelBox([.12, .004, .3], .002, "z"), [-.01, y0 + h + .002, -.03]);
  // Window in a thin steel frame on the room-facing side.
  const sx = w / 2 - .003;
  pc.add("glass", bevelBox([.004, h - .024, d - .024], .002, "z"), [sx, yc, 0]);
  for (const y of [y0 + .006, y0 + h - .006]) pc.add("blackSteel", bevelBox([.008, .012, d], .002, "z"), [sx, y, 0]);
  for (const z of [-d / 2 + .006, d / 2 - .006]) pc.add("blackSteel", bevelBox([.008, h, .012], .002, "y"), [sx, yc, z]);
  // Interior: a dimly lit board, graphics card, tower cooler, front intake
  // fans ringed in violet and one strip along the roof.
  pc.add("ledDim", bevelBox([.004, h - .06, d - .08], .002, "z"), [-w / 2 + .009, yc + .01, -.01]);
  pc.add("plasticGrey", bevelBox([.13, .038, .27], .006, "z"), [-.02, y0 + .15, -.02]);
  pc.add("aluminium", bevelBox([.002, .03, .25], .001, "z"), [.046, y0 + .15, -.02]);
  pc.add("aluminium", bevelBox([.07, .08, .03], .004), [-.035, y0 + .31, -.04]);
  pc.add("plastic", rod(.034, .014, 24), [-.035, y0 + .31, -.019], [HALF_PI, 0, 0]);
  for (const y of [y0 + .12, y0 + .27]) {
    pc.add("plastic", rod(.055, .018, 28), [0, y, d / 2 - .03], [HALF_PI, 0, 0]);
    pc.add("led", tube([...Array(16).keys()].map((i) => { const t = i / 16 * Math.PI * 2; return [Math.cos(t) * .057, y + Math.sin(t) * .057, d / 2 - .03] as Vec3; }), .0018, 5, true), [0, 0, 0]);
    pc.add("plasticGrey", rod(.016, .02, 16), [0, y, d / 2 - .03], [HALF_PI, 0, 0]);
  }
  pc.add("led", bevelBox([.004, .004, d - .1], .0015, "z"), [.04, y0 + h - .014, -.01]);
  // Machined feet.
  for (const x of [-.07, .07]) for (const z of [-.18, .18]) {
    pc.add("aluminium", rod(.016, .018, 18), [x, .018, z]);
    pc.add("rubber", rod(.016, .006, 18), [x, .003, z]);
  }
  return pc;
}

/** Coding desk: T-frame steel legs, 35 mm oak top, pole-mounted dual arms,
 * cable tray, keyboard, mouse and a small-form tower on the floor. */
export function buildWorkstation() {
  const desk = new Assembly();
  desk.add("oak", bevelBox([1.60, .035, .70], .007), [0, .7225, 0]);
  for (const x of [-.68, .68]) {
    desk.add("blackSteel", bevelBox([.065, .03, .66], .01, "z"), [x, .015, 0]);
    desk.add("blackSteel", bevelBox([.075, .63, .05], .008, "y"), [x, .345, -.02]);
    desk.add("blackSteel", bevelBox([.06, .04, .60], .006, "z"), [x, .685, 0]);
    for (const z of [-.3, .3]) desk.add("rubber", rod(.014, .008, 12), [x, .004, z]);
  }
  desk.add("blackSteel", bevelBox([1.30, .05, .05], .006), [0, .64, -.18]);

  // Cable tray under the rear edge, and the under-desk strip on the top's
  // underside at the back, washing the wall and floor behind.
  desk.add("blackSteel", bevelBox([1.0, .004, .12], .001), [0, .60, -.25]);
  for (const z of [-.19, -.31]) desk.add("blackSteel", bevelBox([1.0, .055, .004], .001), [0, .6255, z]);
  desk.add("blackSteel", bevelBox([1.2, .012, .018], .003), [0, .699, -.335]);
  desk.add("led", bevelBox([1.16, .003, .006], .0012), [0, .692, -.338]);

  // Pole clamp, matte black pole and two articulated arms: a gas-spring upper
  // bar, an elbow and a forearm into each monitor's tilt knuckle.
  desk.add("aluminium", bevelBox([.08, .016, .07], .004), [0, .748, -.30]);
  desk.add("aluminium", bevelBox([.06, .07, .05], .006), [0, .675, -.33]);
  desk.add("blackSteel", rod(.017, .48, 24), [0, .98, -.30]);
  desk.add("aluminium", rod(.019, .012, 24), [0, 1.226, -.30]);
  for (const y of [.86, .98]) desk.add("plasticGrey", bevelBox([.04, .012, .04], .004), [0, y, -.30]);
  desk.add("blackSteel", rod(.024, .05, 24), [0, 1.165, -.30]);
  for (const side of [-1, 1]) {
    const elbow: Vec3 = [side * .15, 1.185, -.33], knuckle: Vec3 = [side * .312, 1.172, -.236];
    desk.add("blackSteel", tube([[side * .02, 1.172, -.302], [side * .08, 1.18, -.318], elbow], .011, 10), [0, 0, 0]);
    desk.add("blackSteel", tube([[side * .02, 1.156, -.302], [side * .08, 1.164, -.318], [elbow[0], elbow[1] - .016, elbow[2]]], .006, 8), [0, 0, 0]);
    desk.add("aluminium", rod(.019, .045, 20), [elbow[0], elbow[1] - .008, elbow[2]]);
    desk.add("blackSteel", tube([elbow, [side * .23, 1.18, -.3], [side * .29, 1.174, -.262], knuckle], .01, 10), [0, 0, 0]);
    desk.add("aluminium", rod(.014, .03, 18), [knuckle[0], knuckle[1], knuckle[2]]);
  }
  MONITORS.forEach(({ at, turn }) => desk.include(monitor(), at, [0, turn, 0]));

  // Input: desk mat, keyboard with a slight rake, mouse, phone.
  desk.add("upholstery", bevelBox([.80, .003, .32], .0015), [-.02, .7415, .12]);
  desk.include(keyboard(), [-.06, .743, .11], [.035, 0, 0]);
  desk.include(mouse(), [.30, .743, .11], [0, -.06, 0]);
  desk.add("plastic", bevelBox([.075, .008, .155], .006), [.54, .744, -.24], [0, .18, 0]);
  desk.add("screen", bevelBox([.069, .001, .148], .004), [.54, .7485, -.24], [0, .18, 0]);

  desk.include(tower(), [.54, 0, -.12]);

  // Cables, routed: each monitor's lead follows its arm to the pole, clipped
  // down the pole into the tray; the tray feeds the tower, the wall outlet and
  // the phone stand.
  const cable = (points: Vec3[], radius = .0035) => desk.add("rubber", tube(points, radius, 6), [0, 0, 0]);
  for (const side of [-1, 1]) cable([[side * .3, 1.13, -.24], [side * .22, 1.155, -.29], [side * .12, 1.16, -.325], [side * .03, 1.12, -.322], [side * .022, .98, -.321], [side * .022, .78, -.322], [side * .05, .66, -.29], [side * .15, .612, -.25]]);
  cable([[.3, .608, -.26], [.42, .6, -.3], [.5, .55, -.33], [.52, .47, -.34]], .005);
  cable([[-.2, .608, -.24], [-.4, .59, -.3], [-.47, .42, -.37], [-.5, .22, -.392], [-.5, .175, -.397]]);
  cable([[-.66, .76, -.2], [-.73, .74, -.26], [-.72, .66, -.3], [-.55, .612, -.25]]);
  cable([[.46, .612, -.26], [.5, .63, -.36], [.49, .72, -.366], [.47, .748, -.342], [.44, .752, -.3]], .0022);
  return desk.build();
}

/** Cable-exit point on the wall behind the desk, in desk-local metres. */
export const DESK_WALL_OUTLET: Vec3 = [-.5, .175, -.4];

// ---------------------------------------------------------------------------

/** Mesh-back task chair: polished five-star base, gas lift, sculpted seat with
 * waterfall edge, lumbar-curved back in a moulded frame, T-arms and headrest. */
export function buildChair() {
  const chair = new Assembly();
  chair.add("aluminium", rod(.036, .05, 24, .042), [0, .085, 0]);
  for (let spoke = 0; spoke < 5; spoke++) {
    const angle = (spoke / 5) * Math.PI * 2 + Math.PI / 5;
    const arm = new Assembly();
    arm.add("aluminium", bevelBox([.046, .034, .28], .012, "z"), [0, .072, .16], [-.07, 0, 0]);
    arm.add("plastic", bevelBox([.032, .03, .04], .008), [0, .058, .30]);
    arm.add("chrome", rod(.005, .02, 8), [0, .045, .30]);
    for (const x of [-.013, .013]) arm.add("rubber", rod(.024, .012, 18), [x, .024, .31], [0, 0, HALF_PI]);
    chair.include(arm, [0, 0, 0], [0, angle, 0]);
  }
  chair.add("plastic", rod(.027, .17, 20, .033), [0, .195, 0]);
  chair.add("chrome", rod(.0145, .1, 20), [0, .31, 0]);
  chair.add("plastic", bevelBox([.22, .05, .26], .012), [0, .37, -.01]);
  chair.add("plastic", rod(.012, .06, 12), [.14, .36, .04], [0, 0, HALF_PI]);

  // Seat: panel laid flat; panel-up becomes chair-back, panel-front becomes up.
  chair.add("plastic", bevelBox([.46, .02, .44], .008), [0, .405, .015]);
  chair.add("upholstery", softPanel({
    width: .50, height: .48, depth: .085, corner: 5, fullness: .3, cup: .012, back: .4,
    bend: (t) => t < .22 ? -.035 * Math.pow(1 - t / .22, 2) : 0, segments: [28, 28],
  }), [0, .445, .015], [-HALF_PI, 0, 0]);

  // Back: lumbar-shaped mesh panel wrapped by a moulded frame.
  const back: SoftPanelOptions = {
    width: .46, height: .58, depth: .035, corner: 4.5, fullness: .5, cup: .03, back: .6,
    taper: (t) => .86 + .14 * Math.sin(Math.min(1, t / .75) * HALF_PI) - .05 * Math.max(0, t - .75) / .25,
    bend: (t) => .028 * Math.exp(-Math.pow((t - .3) / .17, 2)) - .035 * t * t,
    segments: [26, 30],
  };
  const backAt: Vec3 = [0, .84, -.26], backTurn: Vec3 = [-.12, 0, 0];
  chair.add("mesh", softPanel(back), backAt, backTurn);
  chair.add("plastic", tube(softOutline(back, 64, 1.0), .012, 8, true), backAt, backTurn);
  chair.add("plastic", tube([[0, .37, -.12], [0, .375, -.235], [0, .44, -.3], [0, .56, -.305]], .022, 10), [0, 0, 0]);

  const head: SoftPanelOptions = { width: .29, height: .12, depth: .05, corner: 4, fullness: .5, bend: (t) => -.012 * t, segments: [16, 10] };
  chair.add("upholstery", softPanel(head), [0, 1.23, -.33], [-.2, 0, 0]);
  for (const x of [-.06, .06]) chair.add("plastic", tube([[x, 1.1, -.315], [x, 1.16, -.33], [x, 1.2, -.345]], .008, 8), [0, 0, 0]);

  for (const side of [-1, 1]) {
    chair.add("plastic", tube([[side * .19, .38, -.06], [side * .245, .39, -.06], [side * .27, .47, -.06], [side * .27, .625, -.065]], .016, 10), [0, 0, 0]);
    chair.add("upholstery", softPanel({ width: .085, height: .25, depth: .032, corner: 4, fullness: .6, segments: [10, 16] }), [side * .27, .645, -.03], [-HALF_PI, 0, 0]);
  }
  return chair.build();
}

// ---------------------------------------------------------------------------

/** Architect's desk lamp in desk-local metres; returns the bulb position too. */
export function buildDeskLamp() {
  const lamp = new Assembly();
  const base: Vec3 = [-.70, .74, -.18];
  lamp.add("blackSteel", turned([[0, 0], [.07, 0], [.072, .006], [.068, .018], [.02, .024], [0, .024]], 40), base);
  const pivot: Vec3 = [base[0], base[1] + .03, base[2]];
  const elbow: Vec3 = [-.66, 1.15, -.12];
  const head: Vec3 = [-.55, 1.11, .06];
  lamp.add("blackSteel", tube([pivot, [(pivot[0] + elbow[0]) / 2, (pivot[1] + elbow[1]) / 2, (pivot[2] + elbow[2]) / 2], elbow], .0085, 8), [0, 0, 0]);
  lamp.add("blackSteel", tube([elbow, [(elbow[0] + head[0]) / 2, (elbow[1] + head[1]) / 2 + .01, (elbow[2] + head[2]) / 2], head], .0075, 8), [0, 0, 0]);
  lamp.add("aluminium", rod(.014, .03, 16), elbow, [0, 0, HALF_PI]);
  lamp.add("aluminium", rod(.012, .03, 16), pivot, [0, 0, HALF_PI]);
  // Shade opens downward and slightly toward the keyboard.
  const shade = turned([[.07, 0], [.068, .01], [.05, .07], [.022, .105], [.012, .12], [0, .122]], 36);
  lamp.add("blackSteel", shade, [head[0], head[1] - .09, head[2]], [.28, 0, .12]);
  lamp.add("lampShade", turned([[0, .004], [.062, .004]], 24), [head[0], head[1] - .09, head[2]], [.28, 0, .12]);
  return { geometry: lamp.build(), bulb: [head[0] + .01, head[1] - .1, head[2] + .03] as Vec3 };
}

/** Bedside lamp: glazed ceramic base and a linen drum shade, bedside-local. */
export function buildBedsideLamp() {
  const lamp = new Assembly();
  const at: Vec3 = [-.075, .50, -.02];
  lamp.add("ceramicDark", turned([[0, 0], [.05, 0], [.056, .012], [.072, .06], [.068, .11], [.04, .15], [.016, .165], [.012, .18], [0, .18]], 40), at);
  lamp.add("brass", rod(.005, .06, 10), [at[0], at[1] + .2, at[2]]);
  lamp.add("lampShade", turned([[.11, 0], [.108, .13], [.1, .135]], 48), [at[0], at[1] + .17, at[2]]);
  return { geometry: lamp.build(), bulb: [at[0], at[1] + .23, at[2]] as Vec3 };
}
