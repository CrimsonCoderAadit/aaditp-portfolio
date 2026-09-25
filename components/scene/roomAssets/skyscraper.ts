import { BufferGeometry, Float32BufferAttribute } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { Assembly, bevelBox, plainBox, rod, type Vec3 } from "./shapes";

/** A desk-scale brick skyscraper, about 42 cm tall, in metres at its own base
 * centre: a studded podium with a glazed lobby, a tower of three setbacks with
 * corner fins and a dark glass core, an open crown and an antenna. The window
 * bands are one separate mesh whose vertices carry their floor number, so the
 * floors can be lit one by one. */

type Tier = { w: number; d: number; floors: number };
const PODIUM = { w: .17, d: .13, h: .05 };
const FLOOR = .0105;
const TIERS: Tier[] = [{ w: .1, d: .082, floors: 14 }, { w: .084, d: .068, floors: 9 }, { w: .066, d: .054, floors: 6 }];
export const SKYSCRAPER_FLOORS = TIERS.reduce((sum, tier) => sum + tier.floors, 0);

export function buildSkyscraper() {
  const s = new Assembly();
  const bands: BufferGeometry[] = [];
  // Podium: a white base with a recessed lobby band and studs round its roof.
  s.add("brickWhite", bevelBox([PODIUM.w, PODIUM.h * .45, PODIUM.d], .002), [0, PODIUM.h * .225, 0]);
  s.add("plastic", bevelBox([PODIUM.w - .012, PODIUM.h * .35, PODIUM.d - .012], .001), [0, PODIUM.h * .62, 0]);
  s.add("brickWhite", bevelBox([PODIUM.w, PODIUM.h * .2, PODIUM.d], .002), [0, PODIUM.h * .9, 0]);
  for (let i = 0; i < 6; i++) for (const z of [-PODIUM.d / 2 + .01, PODIUM.d / 2 - .01]) s.add("brickWhite", rod(.0045, .003, 10), [-PODIUM.w / 2 + .015 + i * .028, PODIUM.h + .0015, z]);
  // The lobby's glazing, lit with the ground floor.
  addBand(bands, [PODIUM.w - .01, PODIUM.h * .3, PODIUM.d - .01], PODIUM.h * .62, 0);

  let y = PODIUM.h, floor = 1;
  TIERS.forEach((tier, t) => {
    const h = tier.floors * FLOOR;
    // Dark glass core, slab edges every floor, blue fins at the corners.
    s.add("plastic", bevelBox([tier.w - .008, h, tier.d - .008], .001), [0, y + h / 2, 0]);
    for (let f = 0; f <= tier.floors; f++) s.add(t === 1 ? "brickBlue" : "brickWhite", plainBox([tier.w - .004, .0016, tier.d - .004]), [0, y + f * FLOOR, 0]);
    for (const x of [-1, 1]) for (const z of [-1, 1]) s.add("brickBlue", bevelBox([.006, h, .006], .001, "y"), [x * (tier.w / 2 - .003), y + h / 2, z * (tier.d / 2 - .003)]);
    // Mid-face mullions.
    for (const x of [-tier.w / 6, tier.w / 6]) for (const z of [-1, 1]) s.add("aluminium", plainBox([.0018, h, .0018]), [x, y + h / 2, z * (tier.d / 2 - .0035)]);
    for (let f = 0; f < tier.floors; f++) addBand(bands, [tier.w - .007, FLOOR * .62, tier.d - .007], y + f * FLOOR + FLOOR * .5, floor++);
    y += h;
    // A setback ledge with a railing of studs.
    s.add("brickWhite", bevelBox([tier.w + .006, .004, tier.d + .006], .001), [0, y + .002, 0]);
    y += .004;
  });
  // Crown: four slim posts and a ring, a mechanical level inside, the antenna.
  const top = TIERS[TIERS.length - 1];
  s.add("plasticGrey", bevelBox([top.w * .6, .018, top.d * .6], .002), [0, y + .009, 0]);
  for (const x of [-1, 1]) for (const z of [-1, 1]) s.add("aluminium", rod(.0022, .045, 8), [x * top.w * .42, y + .0225, z * top.d * .42]);
  s.add("aluminium", bevelBox([top.w * .9, .004, top.d * .9], .001), [0, y + .045, 0]);
  s.add("brickBlue", bevelBox([top.w * .55, .004, top.d * .55], .001), [0, y + .05, 0]);
  s.add("chrome", rod(.0018, .09, 8), [0, y + .095, 0]);
  const beacon: Vec3 = [0, y + .142, 0];
  return { parts: s.build(), windows: mergeGeometries(bands)!, beacon, height: y + .14 };
}

/** A floor's band of windows: the four faces of a thin box, each vertex
 * tagged with its floor. */
function addBand(bands: BufferGeometry[], size: Vec3, y: number, floor: number) {
  const band = plainBox(size).toNonIndexed();
  band.translate(0, y, 0);
  band.deleteAttribute("uv");
  band.setAttribute("floor", new Float32BufferAttribute(new Array(band.getAttribute("position").count).fill(floor), 1));
  bands.push(band);
}
