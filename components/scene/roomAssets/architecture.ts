import { COVE_SWITCH, DESK_AT, DOOR, GLASS_WALL, METRE, ROOM } from "../roomLayout";
import { COVE_LIP } from "./ambience";
import { DESK_WALL_OUTLET } from "./furniture";
import { Assembly, bevelBox, leafBlade, rod, tube, turned, type Vec3 } from "./shapes";

/** Built-in joinery and fittings. Authored in metres at world origin and drawn
 * under the room's METRE scale, so every coordinate below is a scene-unit
 * position divided by METRE. */

const HALF_PI = Math.PI / 2;
const m = (x: number, y: number, z: number): Vec3 => [x / METRE, y / METRE, z / METRE];
const FLOOR = ROOM.floor;

/** Wall thickness exposed at the glass wall's reveals, in scene units. */
export const REVEAL = .27;
/** Plane the glass wall's frame sits in, set back into the reveal. */
export const GLAZING_Z = ROOM.back - .17;

const SKIRTING = { height: .09, thickness: .016 };

function skirting(assembly: Assembly, from: number, to: number, axis: "x" | "z", wall: number, inward: 1 | -1) {
  const length = Math.abs(to - from) / METRE;
  const centre = (from + to) / 2;
  const offset = wall + inward * (SKIRTING.thickness / 2) * METRE;
  const y = FLOOR + (SKIRTING.height / 2) * METRE;
  const size: Vec3 = axis === "x" ? [length, SKIRTING.height, SKIRTING.thickness] : [SKIRTING.thickness, SKIRTING.height, length];
  const at = axis === "x" ? m(centre, y, offset) : m(offset, y, centre);
  assembly.add("trim", bevelBox(size, .004, axis), at);
  // Rounded top bead.
  const beadAt = axis === "x" ? m(centre, FLOOR + SKIRTING.height * METRE, offset) : m(offset, FLOOR + SKIRTING.height * METRE, centre);
  assembly.add("trim", rod(SKIRTING.thickness / 2, length, 8), beadAt, axis === "x" ? [0, 0, HALF_PI] : [HALF_PI, 0, 0]);
}

/** Face plate for a switch or socket on a wall whose room-facing normal is `facing`. */
function plate(assembly: Assembly, at: Vec3, facing: "x+" | "x-" | "z+" | "z-", kind: "switch" | "double" | "data") {
  const turn: Vec3 = facing === "z+" ? [0, 0, 0] : facing === "z-" ? [0, Math.PI, 0] : facing === "x+" ? [0, HALF_PI, 0] : [0, -HALF_PI, 0];
  const fitting = new Assembly();
  const width = kind === "double" ? .146 : .086;
  fitting.add("ceramic", bevelBox([width, .086, .009], .003), [0, 0, .0045]);
  if (kind === "switch") {
    fitting.add("ceramic", bevelBox([.028, .05, .006], .003), [0, 0, .011], [.08, 0, 0]);
  } else {
    const sockets = kind === "double" ? [-.036, .036] : [0];
    for (const x of sockets) {
      fitting.add("ceramic", bevelBox([.046, .046, .002], .006), [x, 0, .0095]);
      if (kind === "data") fitting.add("socket", bevelBox([.016, .013, .002], .001), [x, 0, .0106]);
      else for (const dx of [-.009, .009]) fitting.add("socket", bevelBox([.004, .009, .002], .0008), [x + dx, .003, .0106]);
      if (kind !== "data") fitting.add("socket", bevelBox([.004, .009, .002], .0008), [x, -.012, .0106], [0, 0, HALF_PI]);
    }
  }
  assembly.include(fitting, at, turn);
}

export function buildArchitecture() {
  const a = new Assembly();
  // Glass wall: floor to just under the cove, four panes between slim steel
  // mullions set back in the wall's thickness, the second pane a sliding door
  // on the inner track with a long pull. Plastered jambs and head, a steel
  // threshold where the room floor meets the balcony's.
  const glassLeft = GLASS_WALL.centre - GLASS_WALL.width / 2, glassRight = GLASS_WALL.centre + GLASS_WALL.width / 2;
  const glassTop = ROOM.ceiling - COVE_LIP - .03, glassMid = (FLOOR + glassTop) / 2;
  const glassW = GLASS_WALL.width / METRE, glassH = (glassTop - FLOOR) / METRE;
  const revealMid = ROOM.back - REVEAL / 2;
  for (const x of [glassLeft - .006 * METRE, glassRight + .006 * METRE]) a.add("wallShade", bevelBox([.012, (ROOM.ceiling - FLOOR) / METRE, REVEAL / METRE], .002, "y"), m(x, (FLOOR + ROOM.ceiling) / 2, revealMid));
  a.add("wallShade", bevelBox([glassW + .024, .012, REVEAL / METRE], .002), m(GLASS_WALL.centre, ROOM.ceiling - .006 * METRE, revealMid));
  a.add("blackSteel", bevelBox([glassW, .012, REVEAL / METRE], .002), m(GLASS_WALL.centre, FLOOR + .006 * METRE, revealMid));
  const frame = .05, frameDepth = .08;
  a.add("blackSteel", bevelBox([glassW, .06, frameDepth], .004), m(GLASS_WALL.centre, glassTop - .03 * METRE, GLAZING_Z));
  a.add("blackSteel", bevelBox([glassW, .045, frameDepth + .03], .004), m(GLASS_WALL.centre, FLOOR + .0225 * METRE, GLAZING_Z));
  // Also the plane between the head frame and the ceiling, above the cove lip.
  a.add("blackSteel", bevelBox([glassW, (ROOM.ceiling - glassTop) / METRE, .02], .002), m(GLASS_WALL.centre, (ROOM.ceiling + glassTop) / 2, GLAZING_Z - .02));
  const pane = GLASS_WALL.width / GLASS_WALL.panes;
  for (let i = 0; i <= GLASS_WALL.panes; i++) {
    a.add("blackSteel", bevelBox([i % GLASS_WALL.panes ? frame : frame + .01, glassH, frameDepth], .004, "y"), m(glassLeft + i * pane, glassMid, GLAZING_Z));
  }
  for (let i = 0; i < GLASS_WALL.panes; i++) {
    const door = i === 1, x = glassLeft + (i + .5) * pane;
    const z = GLAZING_Z + (door ? .1 : .01);
    a.add("glass", bevelBox([pane / METRE - frame, glassH - .1, .008], .001, "y"), m(x, glassMid, z));
    if (!door) continue;
    // The sliding leaf's own stiles and its pull, on the inner track.
    for (const side of [-1, 1]) a.add("blackSteel", bevelBox([.035, glassH - .08, .045], .004, "y"), m(x + side * (pane / 2 - .02 * METRE), glassMid, z));
    a.add("aluminium", bevelBox([.022, .52, .03], .008, "y"), m(x + pane / 2 - .09 * METRE, FLOOR + 1.02 * METRE, z + .05));
  }

  // Continuous skirting, broken only by the door on the front wall.
  const doorFrom = DOOR.centre - DOOR.width / 2, doorTo = DOOR.centre + DOOR.width / 2;
  const casing = .05 * METRE;
  // Side runs butt against the back run rather than overlapping it, so the
  // corners never carry coplanar faces.
  const butt = SKIRTING.thickness * METRE;
  skirting(a, ROOM.left, GLASS_WALL.centre - GLASS_WALL.width / 2, "x", ROOM.back, 1);
  skirting(a, GLASS_WALL.centre + GLASS_WALL.width / 2, ROOM.right, "x", ROOM.back, 1);
  skirting(a, ROOM.back + butt, ROOM.front - butt, "z", ROOM.left, 1);
  skirting(a, ROOM.back + butt, ROOM.front - butt, "z", ROOM.right, -1);
  skirting(a, ROOM.left, doorFrom - casing, "x", ROOM.front, -1);
  skirting(a, doorTo + casing, ROOM.right, "x", ROOM.front, -1);

  // A slim dark shadow line where each wall meets the ceiling; no bright border.
  const crown = (from: number, to: number, axis: "x" | "z", wall: number, inward: 1 | -1) => {
    const length = Math.abs(to - from) / METRE, centre = (from + to) / 2;
    const offset = wall + inward * .005 * METRE, y = ROOM.ceiling - .008 * METRE;
    a.add("doorNight", bevelBox(axis === "x" ? [length, .016, .01] : [.01, .016, length], .002, axis), axis === "x" ? m(centre, y, offset) : m(offset, y, centre));
  };
  crown(ROOM.left, ROOM.right, "x", ROOM.back, 1);
  crown(ROOM.left, ROOM.right, "x", ROOM.front, -1);
  crown(ROOM.back + butt, ROOM.front - butt, "z", ROOM.left, 1);
  crown(ROOM.back + butt, ROOM.front - butt, "z", ROOM.right, -1);

  // Concealed LED cove: a slim dark lip just below the crown, with the violet
  // strip lying on it against the wall, out of sight from the floor. Side runs
  // butt against the back and front runs so the corners close without gaps.
  const lipDepth = .04, lipY = ROOM.ceiling - COVE_LIP;
  const cove = (from: number, to: number, axis: "x" | "z", wall: number, inward: 1 | -1) => {
    const length = Math.abs(to - from) / METRE, centre = (from + to) / 2;
    const run = (finish: "casingNight" | "led", depth: number, height: number, out: number, y: number) => {
      const offset = wall + inward * out * METRE;
      a.add(finish, bevelBox(axis === "x" ? [length, height, depth] : [depth, height, length], Math.min(.003, height / 2 - 1e-4), axis), axis === "x" ? m(centre, y, offset) : m(offset, y, centre));
    };
    run("casingNight", lipDepth, .022, lipDepth / 2, lipY);
    run("casingNight", .006, .05, lipDepth - .003, lipY + .014 * METRE);
    run("led", .008, .006, .012, lipY + .014 * METRE);
  };
  const lipButt = lipDepth * METRE;
  cove(ROOM.left, ROOM.right, "x", ROOM.back, 1);
  cove(ROOM.left, ROOM.right, "x", ROOM.front, -1);
  cove(ROOM.back + lipButt, ROOM.front - lipButt, "z", ROOM.left, 1);
  cove(ROOM.back + lipButt, ROOM.front - lipButt, "z", ROOM.right, -1);

  // Door on the front wall: jamb linings in the wall thickness, casings on the
  // face, a two-panel painted leaf set back into the frame, hinges on the
  // corner side and a lever on the latch side, toward the room.
  const doorMid = FLOOR + DOOR.head / 2;
  const jambDepth = REVEAL / METRE;
  const leafFace = ROOM.front + .02 * METRE;
  for (const x of [doorFrom, doorTo]) a.add("casingNight", bevelBox([.02, DOOR.head / METRE, jambDepth], .002, "y"), m(x + (x === doorFrom ? .01 : -.01) * METRE, doorMid, ROOM.front + REVEAL / 2));
  a.add("casingNight", bevelBox([DOOR.width / METRE, .02, jambDepth], .002), m(DOOR.centre, FLOOR + DOOR.head - .01 * METRE, ROOM.front + REVEAL / 2));
  for (const x of [doorFrom - casing / 2, doorTo + casing / 2]) a.add("casingNight", bevelBox([.05, (DOOR.head + casing) / METRE, .018], .005, "y"), m(x, FLOOR + (DOOR.head + casing) / 2, ROOM.front - .009 * METRE));
  a.add("casingNight", bevelBox([DOOR.width / METRE + .1, .05, .018], .005), m(DOOR.centre, FLOOR + DOOR.head + casing / 2, ROOM.front - .009 * METRE));
  const leafW = DOOR.width / METRE - .006, leafH = DOOR.head / METRE - .012;
  const stile = .11, rail = .12;
  for (const dx of [-1, 1]) a.add("casingNight", bevelBox([stile, leafH, .008], .003, "y"), m(DOOR.centre + dx * (leafW - stile) / 2 * METRE, FLOOR + (leafH / 2 + .004) * METRE, leafFace - .004 * METRE));
  for (const y of [rail / 2 + .004, leafH * .52, leafH - rail / 2 + .004]) a.add("casingNight", bevelBox([leafW - 2 * stile, rail, .008], .003), m(DOOR.centre, FLOOR + y * METRE, leafFace - .004 * METRE));
  // The lever is drawn standing out along +X with its arm toward -Z, then
  // turned so it stands out of the leaf with the arm toward the hinges.
  const lever = new Assembly();
  lever.add("aluminium", rod(.026, .008, 24), [0, 0, 0], [0, 0, HALF_PI]);
  lever.add("aluminium", rod(.009, .05, 12), [.028, 0, 0], [0, 0, HALF_PI]);
  lever.add("aluminium", tube([[.05, 0, 0], [.055, 0, -.03], [.056, -.004, -.12]], .0085, 10), [0, 0, 0]);
  lever.add("aluminium", rod(.009, .008, 16), [0, -.075, 0], [0, 0, HALF_PI]);
  a.include(lever, m(doorTo - .07 * METRE, FLOOR + 1.02 * METRE, leafFace - .008 * METRE), [0, HALF_PI, 0]);
  // Three butt hinges on the corner edge, knuckles proud of the leaf.
  for (const y of [.22, 1.02, 1.82]) {
    a.add("aluminium", rod(.007, .1, 12), m(doorFrom + .012 * METRE, FLOOR + y * METRE, leafFace - .004 * METRE));
    a.add("aluminium", bevelBox([.03, .09, .003], .001), m(doorFrom + .03 * METRE, FLOOR + y * METRE, leafFace - .006 * METRE));
  }

  // Switches, sockets and the cable outlet behind the workstation.
  plate(a, m(COVE_SWITCH[0], COVE_SWITCH[1], ROOM.front), "z-", "switch");
  plate(a, m(-5.75, FLOOR + .3 * METRE, ROOM.back), "z+", "double");
  plate(a, m(5.75, FLOOR + .3 * METRE, ROOM.back), "z+", "double");
  const deskOutlet: Vec3 = [DESK_AT.at[0] - DESK_WALL_OUTLET[2] * METRE, FLOOR + DESK_WALL_OUTLET[1] * METRE, DESK_AT.at[2] + DESK_WALL_OUTLET[0] * METRE];
  plate(a, m(ROOM.right, deskOutlet[1], deskOutlet[2]), "x-", "double");
  plate(a, m(ROOM.right, deskOutlet[1], deskOutlet[2] + .2 * METRE), "x-", "data");
  // Plug head in the lower socket where the desk's supply cable ends.
  a.add("ceramic", bevelBox([.024, .042, .032], .006), m(ROOM.right - .025 * METRE, deskOutlet[1], deskOutlet[2] - .036 * METRE));
  return a.build();
}

/** The door leaf, drawn by the shell in the door paint: size in metres and
 * centre in scene units. */
export function doorLeaf() {
  const leafFace = ROOM.front + .02 * METRE;
  const leafW = DOOR.width / METRE - .006, leafH = DOOR.head / METRE - .012;
  return { size: [leafW, leafH, .04] as Vec3, at: [DOOR.centre, FLOOR + (leafH / 2 + .004) * METRE, leafFace + .02 * METRE] as Vec3 };
}

/** A potted bird-of-paradise: long petioles carrying paddle leaves. */
export function buildPlant() {
  const plant = new Assembly();
  plant.add("ceramicDark", turned([[0, 0], [.1, 0], [.108, .01], [.13, .06], [.14, .28], [.145, .3], [.128, .3], [.12, .06], [.0, .07]], 40), [0, 0, 0]);
  plant.add("soil", turned([[0, .27], [.125, .27]], 32), [0, 0, 0]);
  const stems = [
    [0, .62, .35, .12], [1.3, .78, .42, .14], [2.4, .55, .3, .11], [3.3, .9, .44, .15], [4.4, .7, .38, .13],
    [5.4, .48, .28, .1], [.7, .98, .46, .15], [3.9, .6, .34, .12], [2.0, .84, .4, .13],
  ];
  stems.forEach(([heading, height, length, width], i) => {
    const lean = .12 + (i % 3) * .07;
    const tip: Vec3 = [Math.cos(heading) * lean * height, .27 + height, Math.sin(heading) * lean * height];
    plant.add(i % 2 ? "leafDark" : "leaf", tube([[Math.cos(heading) * .02, .27, Math.sin(heading) * .02], [tip[0] * .5, .27 + height * .55, tip[2] * .5], tip], .0045, 5), [0, 0, 0]);
    // Blade continues the petiole, tilted outward and curling back.
    const blade = new Assembly().add(i % 2 ? "leafDark" : "leaf", leafBlade(length, width, .35, .22), [0, 0, 0], [.55 + (i % 4) * .1, 0, 0]);
    plant.include(blade, tip, [0, HALF_PI - heading, 0]);
  });
  return plant.build();
}
