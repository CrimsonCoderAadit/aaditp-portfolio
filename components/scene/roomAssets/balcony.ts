import { BALCONY, GLASS_WALL, METRE, ROOM } from "../roomLayout";
import { buildPlant, REVEAL } from "./architecture";
import { Assembly, bevelBox, type Vec3 } from "./shapes";

/** The recessed balcony beyond the glass wall: a porcelain-tiled floor a step
 * down, dark side walls and soffit that frame the view, a low stone upstand
 * carrying a frameless glass balustrade under a slim steel rail, and one
 * planter. Authored in metres under METRE like the rest of the architecture;
 * the camera never goes out here. */

const m = (x: number, y: number, z: number): Vec3 => [x / METRE, y / METRE, z / METRE];

/** Where the balcony sits in scene units: the wall's outer face, the
 * balustrade line and the floor level. */
export const BALCONY_EDGE = {
  inner: ROOM.back - REVEAL,
  outer: ROOM.back - REVEAL - BALCONY.depth,
  floor: ROOM.floor - BALCONY.step,
  left: GLASS_WALL.centre - GLASS_WALL.width / 2,
  right: GLASS_WALL.centre + GLASS_WALL.width / 2,
  soffit: ROOM.ceiling + .1,
  /** Top of the balustrade's handrail. */
  rail: ROOM.floor + 1.08 * METRE,
} as const;

export function buildBalcony() {
  const b = new Assembly();
  const { inner, outer, floor, left, right, soffit, rail } = BALCONY_EDGE;
  const width = (right - left) / METRE, depth = (inner - outer) / METRE;
  const cx = (left + right) / 2, cz = (inner + outer) / 2;

  // Floor: large-format tiles with fine joints, on a slab whose edge shows.
  b.add("ceramicDark", bevelBox([width, .12, depth], .004), m(cx, floor - .06 * METRE, cz));
  for (let i = 1; i < 6; i++) b.add("plasticGrey", bevelBox([.006, .003, depth - .02], .001), m(left + i * (right - left) / 6, floor + .0015 * METRE, cz));
  for (let i = 1; i < 3; i++) b.add("plasticGrey", bevelBox([width - .02, .003, .006], .001), m(cx, floor + .0015 * METRE, inner - i * (inner - outer) / 3));

  // Side walls and soffit: the recess that frames the view.
  const height = (soffit - floor) / METRE;
  for (const x of [left - .1 * METRE, right + .1 * METRE]) b.add("casingNight", bevelBox([.2, height, depth + .1], .006, "y"), m(x, (floor + soffit) / 2, cz - .05 * METRE));
  b.add("casingNight", bevelBox([width + .4, .2, depth + .1], .006), m(cx, soffit + .1 * METRE, cz - .05 * METRE));
  // Two small downlights set into the soffit, unlit: fixtures, not sources.
  for (const x of [left + (right - left) * .25, left + (right - left) * .75]) b.add("aluminium", bevelBox([.09, .008, .09], .004), m(x, soffit - .004 * METRE, cz));

  // Balustrade: stone upstand, frameless glass in a steel shoe, handrail.
  const upstand = .26;
  b.add("wallShade", bevelBox([width, upstand, .2], .01), m(cx, floor + upstand / 2 * METRE, outer + .1 * METRE));
  b.add("blackSteel", bevelBox([width, .05, .06], .004), m(cx, floor + (upstand + .025) * METRE, outer + .1 * METRE));
  const glassHeight = (rail - floor) / METRE - upstand - .07;
  b.add("glass", bevelBox([width - .04, glassHeight, .016], .002), m(cx, floor + (upstand + .04 + glassHeight / 2) * METRE, outer + .1 * METRE));
  b.add("blackSteel", bevelBox([width, .035, .06], .012), m(cx, rail - .0175 * METRE, outer + .1 * METRE));

  // One long planter against the right side wall, with the room's plant in it.
  const planterX = right - .45 * METRE, planterZ = cz - .15 * METRE;
  b.add("ceramicDark", bevelBox([.42, .5, 1.1], .02, "y"), m(planterX, floor + .25 * METRE, planterZ));
  for (const [dz, turn] of [[.2, .6], [-.25, -1.1]]) {
    for (const [finish, geometry] of buildPlant()) b.add(finish, geometry, m(planterX, floor + .22 * METRE, planterZ + dz * METRE), [0, turn, 0]);
  }
  return b.build();
}
