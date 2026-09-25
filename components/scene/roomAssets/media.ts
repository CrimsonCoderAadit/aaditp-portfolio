import type { RoomFinish } from "./surfaces";
import { Assembly, bevelBox, ellipsoid, rod, tube, turned, type Vec3 } from "./shapes";

/** The media corner and the chess ledge above it, authored in metres against
 * the wall: the wall plane at z = 0, the floor at y = 0, the room toward +Z. */

const HALF_PI = Math.PI / 2;

/** Television and console placement the scene component reads to hang the
 * live screen, its bias glow and the console's power light. */
export const MEDIA = {
  screen: { centre: [0, 1.05, .064] as Vec3, size: [.78, .44] as [number, number] },
  consoleTop: .46,
  power: [.3, .73, .2765] as Vec3,
} as const;

/** A game pad lying face up: a rounded body, two grips, offset sticks, a
 * d-pad and four face buttons. */
function controller(assembly: Assembly, body: RoomFinish, at: Vec3, turn: number) {
  const pad = new Assembly();
  pad.add(body, ellipsoid([.075, .022, .045], 20, 10), [0, .022, 0]);
  for (const side of [-1, 1]) pad.add(body, ellipsoid([.03, .024, .045], 14, 8), [side * .055, .019, .032], [0, side * .35, 0]);
  for (const [x, z] of [[-.035, -.008], [.018, .018]]) {
    pad.add("rubber", rod(.009, .012, 14), [x, .044, z]);
    pad.add("rubber", rod(.011, .003, 14), [x, .05, z]);
  }
  pad.add("plasticGrey", bevelBox([.022, .005, .007], .002), [-.016, .043, .018]);
  pad.add("plasticGrey", bevelBox([.007, .005, .022], .002), [-.016, .043, .018]);
  for (const [x, z] of [[.036, -.018], [.048, -.006], [.024, -.006], [.036, .006]]) pad.add("plasticGrey", rod(.005, .004, 10), [x, .043, z]);
  pad.add("aluminium", rod(.006, .002, 12), [0, .045, -.016]);
  assembly.include(pad, at, [0, turn, 0]);
}

/** Low walnut console with slatted doors, a tall matte-black games console
 * standing on it, a soundbar under the television, a pad and a headset on
 * its stand; the television hangs on a slim wall bracket above, with a
 * trunked cable dropping to the console. */
export function buildMediaCorner() {
  const media = new Assembly();
  const w = .8, d = .38, h = MEDIA.consoleTop, legs = .07;
  for (const x of [-w / 2 + .05, w / 2 - .05]) for (const z of [.06, d - .04]) media.add("blackSteel", rod(.011, legs, 12, .009), [x, legs / 2, z]);
  media.add("walnut", bevelBox([w, h - legs, d], .008), [0, legs + (h - legs) / 2, d / 2 + .01]);
  for (const x of [-w / 4, w / 4]) {
    for (let i = 0; i < 8; i++) media.add("oak", bevelBox([.034, h - legs - .05, .014], .003, "y"), [x + (i - 3.5) * .045, legs + (h - legs) / 2, d + .017]);
  }
  media.add("oakDark", bevelBox([w - .02, .012, d - .02], .003), [0, h - .006, d / 2 + .01]);

  // Games console: a tall block with a dished vent top and a front power light.
  const cx = .3, cz = .2, tall = .301, side = .151;
  media.add("plastic", bevelBox([side, tall, side], .006, "y"), [cx, h + tall / 2, cz]);
  media.add("rubber", rod(.058, .006, 36), [cx, h + tall - .001, cz]);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    media.add("plasticGrey", rod(.0045, .004, 8), [cx + Math.cos(a) * .038, h + tall + .001, cz + Math.sin(a) * .038]);
  }
  media.add("plasticGrey", bevelBox([.028, .004, .003], .001), [cx - .045, h + .06, cz + side / 2 + .001]);
  media.add("plasticGrey", bevelBox([.018, .004, .003], .001), [cx + .04, h + .06, cz + side / 2 + .001]);

  // Soundbar against the wall under the television.
  media.add("plastic", bevelBox([.44, .058, .075], .02), [-.03, h + .031, .1]);
  media.add("mesh", bevelBox([.42, .042, .004], .012), [-.03, h + .031, .138]);

  controller(media, "plastic", [-.02, h, .3], .2);

  // Headset on a stand.
  const hx = -.29, hz = .24;
  media.add("blackSteel", rod(.045, .01, 24), [hx, h + .005, hz]);
  media.add("blackSteel", rod(.007, .26, 12), [hx, h + .14, hz]);
  media.add("blackSteel", bevelBox([.02, .012, .07], .004), [hx, h + .272, hz]);
  const band: Vec3[] = [];
  for (let i = 0; i <= 10; i++) { const a = Math.PI * (i / 10); band.push([hx + Math.cos(a) * .085, h + .2 + Math.sin(a) * .085, hz]); }
  media.add("plasticGrey", tube(band, .009, 8), [0, 0, 0]);
  for (const s of [-1, 1]) {
    media.add("plastic", ellipsoid([.022, .045, .038], 16, 10), [hx + s * .09, h + .19, hz]);
    media.add("upholstery", rod(.034, .012, 20), [hx + s * .073, h + .19, hz], [0, 0, HALF_PI]);
  }

  // Television on its bracket.
  const [tx, ty] = MEDIA.screen.centre;
  media.add("blackSteel", bevelBox([.3, .2, .012], .004), [tx, ty, .006]);
  for (const s of [-1, 1]) media.add("blackSteel", bevelBox([.03, .26, .03], .004, "y"), [tx + s * .12, ty, .026]);
  media.add("plastic", bevelBox([.8, .46, .026], .006), [tx, ty, .049]);
  media.add("plasticGrey", bevelBox([.05, .007, .004], .002), [tx, ty - .226, .063]);
  // Cable trunking from the television down behind the console.
  media.add("trim", bevelBox([.04, ty - .23 - h, .018], .004, "y"), [tx + .25, h + (ty - .23 - h) / 2, .009]);
  return media.build();
}

/** A big bean bag on the rug facing the television, a spare pad on its seat. */
export function buildBeanBag() {
  const seat = new Assembly();
  seat.add("throw", ellipsoid([.4, .28, .4], 28, 16), [0, .22, 0]);
  seat.add("throw", ellipsoid([.34, .2, .1], 24, 12), [0, .45, -.24], [-.3, 0, 0]);
  seat.add("rubber", rod(.3, .012, 28), [0, .006, 0]);
  controller(seat, "plasticGrey", [.05, .45, .08], -.5);
  return seat.build();
}

/** A travel chess set on a picture ledge under the chess study. The board is
 * `CHESS.square` per square, white nearest the room so the visitor plays white;
 * the pieces that move in Scholar's Mate, and the pawn it takes, are built on
 * their own. */
export const CHESS = { ledge: [0, 1.44, 0] as Vec3, square: .026, boardTop: .018, depth: .17 } as const;

type PieceKind = "pawn" | "knight" | "bishop" | "rook" | "queen" | "king";
const PROFILE: Record<Exclude<PieceKind, "knight">, [number, number][]> = {
  pawn: [[0, 0], [.0085, 0], [.0085, .003], [.005, .006], [.0035, .014], [.0055, .016], [.004, .018], [.0048, .022], [0, .026]],
  rook: [[0, 0], [.009, 0], [.009, .003], [.0062, .006], [.0055, .024], [.0075, .026], [.0075, .032], [0, .032]],
  bishop: [[0, 0], [.009, 0], [.009, .003], [.0055, .007], [.0035, .022], [.0055, .026], [.004, .033], [.0015, .037], [0, .038]],
  queen: [[0, 0], [.0095, 0], [.0095, .003], [.006, .007], [.0038, .028], [.0068, .033], [.005, .037], [.002, .041], [0, .042]],
  king: [[0, 0], [.0095, 0], [.0095, .003], [.006, .007], [.004, .03], [.0065, .035], [.0045, .039], [0, .04]],
};

export function chessPiece(assembly: Assembly, kind: PieceKind, finish: RoomFinish, at: Vec3, facing = 0) {
  if (kind === "knight") {
    const knight = new Assembly();
    knight.add(finish, turned([[0, 0], [.009, 0], [.009, .003], [.0065, .007], [0, .008]], 20), [0, 0, 0]);
    knight.add(finish, bevelBox([.009, .018, .012], .003, "y"), [0, .016, 0], [.25, 0, 0]);
    knight.add(finish, bevelBox([.008, .008, .016], .003), [0, .026, .004], [-.35, 0, 0]);
    assembly.include(knight, at, [0, facing, 0]);
    return;
  }
  assembly.add(finish, turned(PROFILE[kind], 20), at);
  if (kind === "king") {
    assembly.add(finish, bevelBox([.002, .01, .002], .0006), [at[0], at[1] + .044, at[2]]);
    assembly.add(finish, bevelBox([.007, .002, .002], .0006), [at[0], at[1] + .045, at[2]]);
  }
}

/** Square centre on the board, relative to the board's centre, in the ledge frame. */
export function square(file: number, rank: number): Vec3 {
  return [(file - 3.5) * CHESS.square, CHESS.ledge[1] + CHESS.boardTop, CHESS.depth / 2 + .01 - (rank - 3.5) * CHESS.square];
}

const BACK_RANK: PieceKind[] = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"];
/** The pieces Scholar's Mate moves, and f7's pawn, which it takes; files and
 * ranks from zero (e2 is [4, 1]). */
export const MOVERS = [
  { kind: "pawn", white: true, from: [4, 1] },
  { kind: "pawn", white: false, from: [4, 6] },
  { kind: "bishop", white: true, from: [5, 0] },
  { kind: "knight", white: false, from: [1, 7] },
  { kind: "queen", white: true, from: [3, 0] },
  { kind: "knight", white: false, from: [6, 7] },
  { kind: "pawn", white: false, from: [5, 6] },
] as const;
/** 1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6?? 4. Qxf7#: each move names its mover (an
 * index into MOVERS), its destination and what it takes. Every path is clear
 * when it is played: e2 has emptied before the bishop and queen cross it. */
export const SCHOLARS_MATE: { piece: number; to: readonly [number, number]; takes?: number }[] = [
  { piece: 0, to: [4, 3] }, { piece: 1, to: [4, 4] }, { piece: 2, to: [2, 3] }, { piece: 3, to: [2, 5] },
  { piece: 4, to: [7, 4] }, { piece: 5, to: [5, 5] }, { piece: 4, to: [5, 6], takes: 6 },
];
/** The mated king, on e8. */
export const BLACK_KING = [4, 7] as const;

/** Ledge, board and every piece that stays put. */
export function buildChessLedge() {
  const ledge = new Assembly();
  const [, ly] = CHESS.ledge;
  ledge.add("oak", bevelBox([.5, .022, CHESS.depth + .03], .004), [0, ly - .011, (CHESS.depth + .03) / 2]);
  ledge.add("oak", bevelBox([.5, .03, .01], .003), [0, ly + .012, CHESS.depth + .025]);
  ledge.add("walnut", bevelBox([8 * CHESS.square + .02, CHESS.boardTop - .002, 8 * CHESS.square + .02], .003), [0, ly + (CHESS.boardTop - .002) / 2, CHESS.depth / 2 + .01]);
  for (let f = 0; f < 8; f++) for (let r = 0; r < 8; r++) {
    const [x, , z] = square(f, r);
    ledge.add((f + r) % 2 ? "oak" : "oakDark", bevelBox([CHESS.square, .002, CHESS.square], .0004), [x, ly + CHESS.boardTop - .001, z]);
  }
  const moving = (white: boolean, f: number, r: number) => MOVERS.some((m) => m.white === white && m.from[0] === f && m.from[1] === r);
  for (const white of [true, false]) {
    const finish: RoomFinish = white ? "ceramic" : "ceramicDark";
    const home = white ? 0 : 7, pawns = white ? 1 : 6;
    for (let f = 0; f < 8; f++) {
      if (!moving(white, f, home)) chessPiece(ledge, BACK_RANK[f], finish, square(f, home), white ? Math.PI : 0);
      if (!moving(white, f, pawns)) chessPiece(ledge, "pawn", finish, square(f, pawns));
    }
  }
  return ledge.build();
}

/** One of the moving pieces, drawn at the origin. */
export function buildChessMover(index: number) {
  const piece = new Assembly();
  const mover = MOVERS[index];
  chessPiece(piece, mover.kind, mover.white ? "ceramic" : "ceramicDark", [0, 0, 0], mover.white ? Math.PI : 0);
  return piece.build();
}
