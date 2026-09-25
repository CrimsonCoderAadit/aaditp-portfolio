import { BufferGeometry, CylinderGeometry, ExtrudeGeometry, Path, Shape } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { BrickPart } from "../BrickInstances";

export const MODULE = .15;
export const HALF_MODULE = MODULE / 2;
export type PartForm = "slope" | "offsetPlate" | "edgePanel" | "steppedArch" | "technicalBeam";

function extrude(points: number[][], depth: number, holes: number[][][] = []) {
  const shape = new Shape();
  points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y));
  shape.closePath();
  for (const points of holes) {
    const hole = new Path();
    points.forEach(([x, y], i) => i ? hole.lineTo(x, y) : hole.moveTo(x, y));
    hole.closePath(); shape.holes.push(hole);
  }
  const geometry = new ExtrudeGeometry(shape, { depth, steps: 1, bevelEnabled: false, curveSegments: 1 });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

/** Kit-owned cache. Dimensions are authored in physical units, never fillet-scaled.
 * Parts are centered; width/height/depth are their complete outer envelope.
 * Call dispose once with the owning district. No runtime CSG or frame allocation.
 */
export function createPartLibrary() {
  const cache = new Map<string, BufferGeometry>();
  return {
    get(form: PartForm, size: BrickPart["size"]): BufferGeometry {
      const key = `${form}:${size.join(",")}`;
      const existing = cache.get(key);
      if (existing) return existing;
      const [w, h, d] = size;
      const x = w / 2, y = h / 2;
      let geometry: BufferGeometry;
      if (form === "slope") {
        geometry = extrude([[-x, -y], [x, -y], [x, -h * .20], [-x, y]], d);
      } else if (form === "steppedArch") {
        // Three grid-like steps create an open portal, not a solid curved decal.
        geometry = extrude([[-x, -y], [-x, y], [x, y], [x, -y], [w * .32, -y], [w * .32, 0], [w * .18, 0], [w * .18, h * .22], [-w * .18, h * .22], [-w * .18, 0], [-w * .32, 0], [-w * .32, -y]], d);
      } else if (form === "technicalBeam") {
        const rail = Math.min(h * .22, .018);
        const post = Math.min(w * .09, .022);
        const holes = [-1, 1].map((side) => {
          const a = side < 0 ? -x + post : post / 2;
          const b = side < 0 ? -post / 2 : x - post;
          return [[a, -y + rail], [a, y - rail], [b, y - rail], [b, -y + rail]];
        });
        geometry = extrude([[-x, -y], [x, -y], [x, y], [-x, y]], d, holes);
      } else if (form === "edgePanel") {
        // Folded return lips: a thin face with genuine mounting depth.
        const skin = Math.min(d * .30, .009), lip = Math.min(h * .14, .014);
        const face = new RoundedBoxGeometry(w, h, skin, 1, .0015);
        face.translate(0, 0, (d - skin) / 2);
        const top = new RoundedBoxGeometry(w, lip, d - skin, 1, .0015);
        top.translate(0, (h - lip) / 2, -skin / 2);
        const bottom = top.clone(); bottom.translate(0, -(h - lip), 0);
        geometry = mergeGeometries([face, top, bottom])!;
        [face, top, bottom].forEach((g) => g.dispose());
      } else {
        // Centered stud on an even-width plate gives a half-module attachment axis.
        const studHeight = Math.min(.028, h * .5);
        const base = new RoundedBoxGeometry(w, h - studHeight, d, 2, Math.min(.003, (h - studHeight) * .12));
        base.translate(0, -studHeight / 2, 0);
        const stud = new CylinderGeometry(.046, .049, studHeight, 16).toNonIndexed();
        stud.translate(0, (h - studHeight) / 2, 0);
        geometry = mergeGeometries([base, stud])!;
        base.dispose(); stud.dispose();
      }
      geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      cache.set(key, geometry);
      return geometry;
    },
    dispose() { cache.forEach((g) => g.dispose()); cache.clear(); },
  };
}

/** Intentional grid offset, useful independently of the offset plate mesh. */
export function halfModuleOffset(position: BrickPart["position"], xSteps = 1, zSteps = 0): BrickPart["position"] {
  return [position[0] + xSteps * HALF_MODULE, position[1], position[2] + zSteps * HALF_MODULE];
}
