import type { RoomFinish } from "./surfaces";
import { Assembly, bevelBox, ellipsoid, plainBox, rod, tube, turned, type Vec3 } from "./shapes";

/** Secondary room pieces, authored in metres in each piece's own frame (floor or
 * wall plane at the origin, front toward +Z). Same construction rules as the hero
 * furniture: bevelled parts, physical thickness, one merged mesh per finish. */

const HALF_PI = Math.PI / 2;
const BRICKS: RoomFinish[] = ["brickRed", "brickBlue", "brickYellow", "brickWhite"];

/** A loose brick with its studs; `studs` is [columns, rows]. */
function looseBrick(assembly: Assembly, finish: RoomFinish, at: Vec3, studs: [number, number], turn = 0, tall = .0096) {
  const pitch = .008;
  const piece = new Assembly();
  piece.add(finish, bevelBox([studs[0] * pitch - .0002, tall, studs[1] * pitch - .0002], .0006, "x", 1), [0, tall / 2, 0]);
  for (let i = 0; i < studs[0]; i++) for (let j = 0; j < studs[1]; j++) {
    piece.add(finish, rod(.0024, .0018, 8), [(i - (studs[0] - 1) / 2) * pitch, tall + .0009, (j - (studs[1] - 1) / 2) * pitch]);
  }
  assembly.include(piece, at, [0, turn, 0]);
}

/** Rolling maker cart: parts tray on top, four shallow drawers, a bin shelf,
 * castors. 0.78 m tall so it stays below the model table's top. */
export function buildMakerCart() {
  const cart = new Assembly();
  const w = .46, d = .36;
  for (const x of [-w / 2 + .012, w / 2 - .012]) for (const z of [-d / 2 + .012, d / 2 - .012]) {
    cart.add("blackSteel", rod(.011, .7, 12), [x, .43, z]);
    cart.add("plastic", bevelBox([.022, .03, .03], .006), [x, .065, z]);
    cart.add("rubber", rod(.024, .014, 16), [x, .026, z + .006], [0, 0, HALF_PI]);
  }
  // Bottom shelf with a lidded bin and a stack of baseplates.
  cart.add("blackSteel", bevelBox([w, .012, d], .003), [0, .1, 0]);
  cart.add("plasticGrey", bevelBox([.2, .12, .28], .01), [-.1, .166, 0]);
  cart.add("plastic", bevelBox([.206, .012, .286], .004), [-.1, .232, 0]);
  for (let i = 0; i < 3; i++) cart.add(i % 2 ? "brickBlue" : "leafDark", bevelBox([.16, .004, .16], .001), [.11, .11 + i * .0045, .01 * i]);
  // Drawer unit.
  cart.add("plasticGrey", bevelBox([w - .03, .3, d - .03], .006), [0, .44, 0]);
  for (let i = 0; i < 4; i++) {
    const y = .33 + i * .072;
    cart.add("plasticGrey", bevelBox([w - .05, .062, .008], .003), [0, y, d / 2 - .012]);
    cart.add("aluminium", bevelBox([.09, .008, .012], .003), [0, y + .012, d / 2 - .002]);
    cart.add(BRICKS[i], bevelBox([.03, .014, .002], .001), [-.16, y, d / 2 - .0075]);
  }
  // Top: shallow compartment tray with sorted parts and a few tools.
  cart.add("blackSteel", bevelBox([w, .012, d], .003), [0, .6, 0]);
  const top = .606;
  cart.add("plastic", bevelBox([w - .02, .006, d - .02], .002), [0, top + .003, 0]);
  for (const x of [-w / 2 + .014, -.07, .07, w / 2 - .014]) cart.add("plastic", bevelBox([.006, .028, d - .02], .002), [x, top + .014, 0]);
  for (const z of [-d / 2 + .014, 0, d / 2 - .014]) cart.add("plastic", bevelBox([w - .02, .028, .006], .002), [0, top + .014, z]);
  const bins: [RoomFinish, number, number][] = [["brickRed", -.15, -.08], ["brickBlue", 0, -.08], ["brickYellow", .15, -.08], ["brickWhite", -.15, .08], ["brickRed", 0, .08], ["brickBlue", .15, .08]];
  bins.forEach(([finish, x, z], i) => {
    for (let k = 0; k < 5; k++) {
      const jx = ((k * 37 + i * 11) % 9 - 4) * .01, jz = ((k * 53 + i * 7) % 7 - 3) * .012;
      looseBrick(cart, k === 4 ? BRICKS[(i + 1) % 4] : finish, [x + jx, top + .006 + (k % 2) * .009, z + jz], k % 3 ? [2, 4] : [2, 2], k * .7);
    }
  });
  // Tools laid on a small mat across the front edge of the tray.
  cart.add("rubber", bevelBox([.3, .003, .07], .001), [.02, .64, .215], [0, 0, 0]);
  cart.add("brickYellow", bevelBox([.07, .012, .02], .003), [-.07, .647, .215], [0, .2, 0]);
  cart.add("aluminium", tube([[.04, .645, .2], [.1, .646, .215], [.15, .646, .228]], .002, 6), [0, 0, 0]);
  cart.add("aluminium", tube([[.04, .645, .204], [.1, .646, .224], [.15, .646, .232]], .002, 6), [0, 0, 0]);
  cart.add("plasticGrey", rod(.006, .08, 10), [-.01, .649, .232], [0, 0, HALF_PI]);
  cart.add("chrome", rod(.0015, .035, 6), [.04, .649, .232], [0, 0, HALF_PI]);
  // Push handle.
  cart.add("aluminium", tube([[-w / 2 + .012, .6, -d / 2 + .012], [-w / 2 + .012, .72, -d / 2 + .012], [w / 2 - .012, .72, -d / 2 + .012], [w / 2 - .012, .6, -d / 2 + .012]], .008, 8, false, 0), [0, 0, 0]);
  return cart.build();
}

/** Low walnut sideboard: two sliding oak doors, a drawer rail, steel legs, and a
 * few objects on top — a small brick tower, books, a storage box. */
export function buildStorageCabinet() {
  const cabinet = new Assembly();
  const w = 1.0, d = .4, h = .62, legs = .1;
  for (const x of [-w / 2 + .05, w / 2 - .05]) for (const z of [-d / 2 + .05, d / 2 - .05]) cabinet.add("blackSteel", rod(.01, legs, 12, .008), [x, legs / 2, z]);
  cabinet.add("walnut", bevelBox([w, h, d], .008), [0, legs + h / 2, 0]);
  cabinet.add("walnut", bevelBox([w + .01, .02, d + .01], .006), [0, legs + h + .01, 0]);
  for (const [x, z] of [[-.25, .205], [.25, .211]] as const) cabinet.add("oak", bevelBox([w / 2 - .02, h - .16, .012], .003), [x, legs + (h - .12) / 2 + .03, z]);
  for (const x of [-.03, .03]) cabinet.add("blackSteel", bevelBox([.012, .12, .01], .004, "y"), [x, legs + .3, .222]);
  // The two top drawers open, so they are built on their own (buildCabinetDrawer);
  // their openings are dark recesses in the carcass.
  for (const x of [-.25, .25]) cabinet.add("plastic", bevelBox([w / 2 - .03, .092, .01], .002), [x, legs + h - .06, .196]);
  const top = legs + h + .02;
  // The skyscraper model stands at the left of the top (see Skyscraper).
  cabinet.add("oakDark", bevelBox([.2, .03, .15], .004), [.08, top + .015, .02], [0, .08, 0]);
  cabinet.add("brickRed", bevelBox([.19, .025, .145], .004), [.08, top + .0425, .02], [0, .03, 0]);
  cabinet.add("card", bevelBox([.18, .14, .22], .006), [.33, top + .07, -.04]);
  cabinet.add("plasticGrey", bevelBox([.184, .01, .224], .003), [.33, top + .145, -.04]);
  return cabinet.build();
}

/** Where each top drawer sits, cabinet-local, closed: front face centre. */
export const CABINET_DRAWERS = { y: .1 + .62 - .06, z: .206, xs: [-.25, .25] as const, width: .48, travel: .26 };

/** One of the cabinet's top drawers, drawn closed at its own origin (front
 * face centre): the front and pull, a shallow tray behind, and what it holds.
 * The left one is the electronics drawer, the right one the brick drawer. */
export function buildCabinetDrawer(kind: "electronics" | "bricks") {
  const d = new Assembly();
  const { width } = CABINET_DRAWERS, depth = .34, floor = -.042, back = -depth;
  d.add("oak", bevelBox([width, .1, .012], .003), [0, 0, 0]);
  d.add("blackSteel", bevelBox([.12, .008, .012], .003), [0, 0, .01]);
  d.add("oakDark", bevelBox([width - .03, .006, depth], .002), [0, floor, back / 2]);
  for (const x of [-width / 2 + .02, width / 2 - .02]) d.add("oakDark", bevelBox([.01, .075, depth], .002), [x, floor + .037, back / 2]);
  d.add("oakDark", bevelBox([width - .03, .075, .01], .002), [0, floor + .037, back + .005]);
  const on = floor + .003;
  if (kind === "electronics") {
    // Two small circuit boards, a row of USB sticks, a coiled cable, a
    // screwdriver set in its case and a pair of adapters.
    for (const [x, z, turn] of [[-.14, -.08, .1], [-.06, -.1, -.15]] as const) {
      d.add("leafDark", bevelBox([.07, .003, .05], .001), [x, on + .002, z], [0, turn, 0]);
      for (let i = 0; i < 4; i++) d.add("plastic", bevelBox([.008, .004, .008], .001), [x - .02 + i * .013, on + .005, z + .01], [0, turn, 0]);
      d.add("brickYellow", bevelBox([.012, .003, .006], .001), [x + .025, on + .005, z - .015], [0, turn, 0]);
    }
    for (let i = 0; i < 4; i++) d.add(i % 2 ? "plastic" : "plasticGrey", bevelBox([.012, .006, .04], .002), [.05 + i * .02, on + .003, -.07]);
    d.add("blackSteel", tube([[.12, on + .006, -.24], [.17, on + .008, -.2], [.14, on + .007, -.15], [.1, on + .008, -.2], [.13, on + .009, -.26], [.18, on + .008, -.23]], .0035, 6), [0, 0, 0]);
    d.add("plastic", bevelBox([.2, .018, .06], .004), [-.08, on + .009, -.22]);
    for (let i = 0; i < 6; i++) {
      d.add(BRICKS[i % 4], bevelBox([.012, .012, .03], .004), [-.16 + i * .03, on + .022, -.235]);
      d.add("chrome", rod(.002, .025, 6), [-.16 + i * .03, on + .022, -.205], [HALF_PI, 0, 0]);
    }
    for (const x of [.03, .08]) d.add("plasticGrey", bevelBox([.035, .014, .05], .004), [x, on + .007, -.29]);
  } else {
    // A divided parts tray of loose bricks, an instruction booklet and a
    // couple of minifigure heads.
    for (const x of [-.07, .07]) d.add("plastic", bevelBox([.004, .03, depth - .04], .001), [x, on + .015, back / 2]);
    d.add("plastic", bevelBox([width - .05, .03, .004], .001), [0, on + .015, -.17]);
    const bins: [RoomFinish, number, number][] = [["brickRed", -.15, -.08], ["brickBlue", 0, -.08], ["brickYellow", .15, -.08], ["brickWhite", -.15, -.25], ["brickBlue", 0, -.25], ["brickRed", .15, -.25]];
    bins.forEach(([finish, x, z], i) => {
      for (let k = 0; k < 4; k++) {
        const jx = ((k * 37 + i * 11) % 9 - 4) * .008, jz = ((k * 53 + i * 7) % 7 - 3) * .01;
        looseBrick(d, k === 3 ? BRICKS[(i + 1) % 4] : finish, [x + jx, on + (k % 2) * .009, z + jz], k % 3 ? [2, 4] : [2, 2], k * .7);
      }
    });
    d.add("sheet", bevelBox([.1, .004, .14], .001), [.15, on + .034, -.12], [0, -.18, 0]);
    d.add("brickBlue", bevelBox([.1, .0012, .06], .0004), [.15, on + .0366, -.1], [0, -.18, 0]);
    for (const x of [-.02, .01]) d.add("brickYellow", rod(.0075, .01, 12), [x, on + .005, -.05]);
  }
  return d.build();
}

/** Floor lamp: weighted disc base, slim stem, linen drum. Returns the bulb point. */
export function buildFloorLamp() {
  const lamp = new Assembly();
  lamp.add("blackSteel", turned([[0, 0], [.14, 0], [.145, .008], [.14, .022], [.02, .03], [0, .03]], 48));
  lamp.add("blackSteel", rod(.009, 1.36, 12), [0, .7, 0]);
  lamp.add("brass", rod(.013, .03, 16), [0, 1.37, 0]);
  lamp.add("lampShade", turned([[.17, 0], [.165, .26], [.16, .26]], 48), [0, 1.33, 0]);
  lamp.add("brass", tube([[0, 1.385, 0], [.08, 1.39, 0], [.16, 1.39, 0]], .003, 6), [0, 0, 0]);
  return { geometry: lamp.build(), bulb: [0, 1.45, 0] as Vec3 };
}

/** Maker pegboard on the wall above the cabinet: perforated board in an oak
 * frame, tidy rows of tools, two parts bins and a coiled cable. Wall at z = 0. */
export function buildPegboard(centreY: number) {
  const board = new Assembly();
  const w = .8, h = .56, y = centreY;
  board.add("oak", bevelBox([w + .03, h + .03, .018], .004), [0, y, .009]);
  board.add("pegboard", bevelBox([w, h, .008], .002), [0, y, .021]);
  for (let i = 0; i < 20; i++) for (let j = 0; j < 14; j++) {
    board.add("socket", plainBox([.006, .006, .001]), [-w / 2 + .02 + i * .04, y - h / 2 + .02 + j * .04, .0253]);
  }
  const face = .026;
  // Ruler and square.
  board.add("aluminium", bevelBox([.3, .026, .003], .001), [-.18, y + .22, face + .004]);
  for (let i = 0; i < 12; i++) board.add("socket", bevelBox([.001, i % 4 ? .006 : .012, .001], .0003), [-.32 + i * .025, y + .226 - (i % 4 ? .003 : .006), face + .006]);
  board.add("aluminium", bevelBox([.16, .018, .003], .001), [.22, y + .2, face + .004]);
  board.add("aluminium", bevelBox([.018, .12, .003], .001, "y"), [.149, y + .15, face + .004]);
  // Screwdrivers, hanging handle-up.
  [[-.3, "brickRed"], [-.25, "brickYellow"], [-.2, "brickBlue"]].forEach(([x, finish]) => {
    board.add(finish as RoomFinish, turned([[0, 0], [.011, .004], [.012, .06], [.009, .07], [0, .072]], 16), [x as number, y + .04, face + .016]);
    board.add("chrome", rod(.0025, .1, 8), [x as number, y - .01, face + .016]);
    board.add("chrome", rod(.0015, .02, 6), [x as number, y + .08, face + .006], [HALF_PI, 0, 0]);
  });
  // Calipers.
  board.add("aluminium", bevelBox([.012, .2, .003], .001, "y"), [-.1, y - .02, face + .005]);
  board.add("aluminium", bevelBox([.05, .01, .003], .001), [-.085, y + .07, face + .005]);
  board.add("aluminium", bevelBox([.04, .01, .003], .001), [-.09, y + .02, face + .006]);
  board.add("plastic", bevelBox([.028, .03, .006], .003), [-.1, y + .045, face + .008]);
  // Two parts bins on a shelf strip, with bricks visible in their open fronts.
  board.add("oakDark", bevelBox([.3, .012, .08], .003), [.2, y - .12, face + .04]);
  for (const x of [.13, .27]) {
    board.add("plasticGrey", bevelBox([.12, .07, .07], .006), [x, y - .08, face + .04]);
    board.add("plastic", bevelBox([.1, .05, .002], .002), [x, y - .082, face + .076]);
    looseBrick(board, x < .2 ? "brickRed" : "brickYellow", [x - .02, y - .114 + .07, face + .06], [2, 2]);
    looseBrick(board, x < .2 ? "brickBlue" : "brickWhite", [x + .02, y - .114 + .07, face + .058], [2, 3], .4);
  }
  // Coiled cable on a hook.
  board.add("chrome", rod(.0018, .03, 6), [.04, y + .1, face + .014], [HALF_PI, 0, 0]);
  const coil: Vec3[] = [];
  for (let i = 0; i <= 48; i++) {
    const a = i / 48 * Math.PI * 6;
    coil.push([.04 + Math.sin(a) * .035, y + .07 - (1 - Math.cos(a)) * .03 - i * .0004, face + .018 + (i % 16) * .0006]);
  }
  board.add("rubber", tube(coil, .0028, 6), [0, 0, 0]);
  return board.build();
}

/** Thin floating oak shelf, wall at z = 0: books, a turned king, a small board
 * computer and a storage box, with space between them. */
export function buildFloatingShelf(width: number, y: number) {
  const shelf = new Assembly();
  shelf.add("oak", bevelBox([width, .03, .2], .006), [0, y, .1]);
  const top = y + .015;
  const book = (x: number, w: number, h: number, finish: RoomFinish) => shelf.add(finish, bevelBox([w, h, .15], .003, "y"), [x, top + h / 2, .1]);
  for (const [x, w, h, finish] of [[-.3, .03, .2, "oakDark"], [-.268, .024, .22, "walnut"], [-.24, .028, .19, "brickBlue"], [-.212, .022, .21, "card"]] as const) book(x, w, h, finish);
  shelf.add("walnut", bevelBox([.13, .03, .13], .004), [-.08, top + .015, .1], [0, .12, 0]);
  // A turned king, as a nod to the chess set on the bookshelf.
  shelf.add("walnut", turned([[0, 0], [.022, 0], [.02, .012], [.011, .02], [.009, .07], [.016, .08], [.012, .09], [0, .095]], 20), [-.08, top + .03, .1]);
  shelf.add("walnut", bevelBox([.012, .022, .004], .001), [-.08, top + .135, .1]);
  shelf.add("walnut", bevelBox([.004, .03, .004], .001), [-.08, top + .135, .1]);
  // A small single-board computer on a stand: the room's quiet tech object.
  shelf.add("plastic", bevelBox([.1, .006, .07], .002), [.09, top + .003, .1]);
  shelf.add("leafDark", bevelBox([.085, .004, .056], .001), [.09, top + .014, .1]);
  for (const [dx, dz] of [[-.035, -.02], [.035, -.02], [-.035, .02], [.035, .02]]) shelf.add("aluminium", rod(.002, .008, 6), [.09 + dx, top + .008, .1 + dz]);
  shelf.add("aluminium", bevelBox([.02, .01, .016], .002), [.12, top + .021, .1]);
  shelf.add("plastic", bevelBox([.03, .008, .012], .002), [.07, top + .02, .085]);
  shelf.add("card", bevelBox([.12, .08, .12], .005), [.26, top + .04, .1]);
  return shelf.build();
}

/** Desk-local extras for the workstation: under-desk drawer pedestal, speakers,
 * a charging dock with phone, a docking hub and a headphone stand. */
export function buildDeskExtras() {
  const desk = new Assembly();
  // A rubber duck at the front-left corner, for talking bugs through.
  desk.add("brickYellow", ellipsoid([.045, .032, .034], 20, 12), [-.7, .772, .25]);
  desk.add("brickYellow", ellipsoid([.024, .024, .024], 16, 10), [-.728, .818, .25]);
  desk.add("brickRed", ellipsoid([.016, .006, .012], 12, 8), [-.756, .814, .25]);
  for (const z of [-.012, .012]) desk.add("plastic", ellipsoid([.004, .004, .004], 8, 6), [-.744, .826, .25 + z]);
  desk.add("brickYellow", ellipsoid([.018, .014, .01], 12, 8), [-.665, .79, .25], [0, 0, .5]);
  // Pedestal on castors under the left end, clear of the cable tray.
  const px = -.45, pz = -.03, pw = .4, pd = .46, ph = .5;
  for (const x of [px - pw / 2 + .04, px + pw / 2 - .04]) for (const z of [pz - pd / 2 + .04, pz + pd / 2 - .04]) {
    desk.add("plastic", bevelBox([.02, .025, .025], .005), [x, .038, z]);
    desk.add("rubber", rod(.016, .012, 12), [x, .016, z + .006], [0, 0, HALF_PI]);
  }
  desk.add("cabinetPaint", bevelBox([pw, ph, pd], .006, "y"), [px, .05 + ph / 2, pz]);
  [.12, .12, .2].reduce((y, height) => {
    desk.add("cabinetPaint", bevelBox([pw - .012, height - .008, .014], .003), [px, y + height / 2, pz + pd / 2 + .005]);
    desk.add("aluminium", bevelBox([.12, .008, .014], .003), [px, y + height - .03, pz + pd / 2 + .016]);
    return y + height;
  }, .06);

  // Speakers either side, toed in.
  for (const [x, turn] of [[-.56, .3], [.57, -.3]] as const) {
    const speaker = new Assembly();
    speaker.add("plastic", bevelBox([.09, .15, .1], .01, "y"), [0, .075, 0]);
    speaker.add("plasticGrey", turned([[0, 0], [.03, 0], [.026, .006], [.012, .01], [0, .012]], 24), [0, .055, .05], [HALF_PI, 0, 0]);
    speaker.add("plasticGrey", turned([[0, 0], [.012, 0], [.01, .004], [0, .006]], 16), [0, .12, .05], [HALF_PI, 0, 0]);
    desk.include(speaker, [x, .74, -.24], [0, turn, 0]);
  }
  // Charging stand with phone upright.
  desk.add("aluminium", bevelBox([.075, .01, .07], .004), [.42, .745, -.27]);
  desk.add("aluminium", bevelBox([.06, .09, .01], .003, "y"), [.42, .79, -.285], [-.28, 0, 0]);
  desk.add("plastic", bevelBox([.07, .15, .008], .006, "y"), [.42, .82, -.27], [-.28, 0, 0]);
  desk.add("screen", bevelBox([.064, .142, .001], .005, "y"), [.42, .82, -.2652], [-.28, 0, 0]);
  // Docking hub beside it, cabled into the tray.
  desk.add("aluminium", bevelBox([.13, .022, .06], .006), [.3, .751, -.3]);
  for (let i = 0; i < 4; i++) desk.add("socket", bevelBox([.012, .005, .002], .001), [.25 + i * .024, .751, -.2695]);
  desk.add("rubber", tube([[.3, .745, -.33], [.3, .72, -.345], [.28, .65, -.33], [.22, .612, -.28]], .003, 6), [0, 0, 0]);
  // Headphone stand at the front-right with the headphones hung on it.
  const stand: Vec3 = [.68, .74, .1];
  desk.add("blackSteel", turned([[0, 0], [.05, 0], [.052, .006], [.012, .012], [0, .012]], 32), stand);
  desk.add("blackSteel", rod(.006, .25, 10), [stand[0], stand[1] + .13, stand[2]]);
  desk.add("blackSteel", tube([[stand[0], stand[1] + .25, stand[2] - .045], [stand[0], stand[1] + .262, stand[2]], [stand[0], stand[1] + .25, stand[2] + .045]], .007, 8), [0, 0, 0]);
  const band: Vec3[] = [];
  for (let i = 0; i <= 16; i++) {
    const a = Math.PI * i / 16;
    band.push([stand[0], stand[1] + .185 + Math.sin(a) * .085, stand[2] + Math.cos(a) * .075]);
  }
  desk.add("plastic", tube(band, .009, 8), [0, 0, 0]);
  for (const side of [-1, 1]) {
    desk.add("plastic", ellipsoid([.03, .045, .042], 18, 10), [stand[0], stand[1] + .18, stand[2] + side * .082]);
    desk.add("upholstery", ellipsoid([.026, .038, .012], 16, 8), [stand[0], stand[1] + .18, stand[2] + side * .064]);
  }
  return desk.build();
}

/** Bedside extras: a phone on charge and a second book on the stack. Bedside-local. */
export function buildBedsideExtras() {
  const bedside = new Assembly();
  bedside.add("plastic", bevelBox([.07, .008, .15], .006), [.13, .508, -.1], [0, -.35, 0]);
  bedside.add("screen", bevelBox([.064, .001, .142], .005), [.13, .5125, -.1], [0, -.35, 0]);
  bedside.add("brickWhite", tube([[.108, .506, -.03], [.06, .505, -.02], [.02, .508, -.12], [0, .505, -.19], [-.02, .45, -.2]], .0022, 6), [0, 0, 0]);
  bedside.add("oakDark", bevelBox([.125, .024, .17], .003), [.108, .542, .05], [0, .1, 0]);
  return bedside.build();
}

