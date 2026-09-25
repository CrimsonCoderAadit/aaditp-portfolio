import {
  BoxGeometry, BufferAttribute, BufferGeometry, CatmullRomCurve3, CylinderGeometry, Euler, Float32BufferAttribute, LatheGeometry,
  Matrix4, Quaternion, SphereGeometry, TubeGeometry, Vector2, Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { RoomFinish } from "./surfaces";

export type Vec3 = [number, number, number];

/** Box-projected UVs in the geometry's own units (metres for furniture), so wood
 * and weave keep true scale on every part. `grain` is the axis the long texture
 * direction follows. */
export function metreUVs(geometry: BufferGeometry, grain: "x" | "y" | "z" = "x") {
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const nx = Math.abs(normal.getX(i)), ny = Math.abs(normal.getY(i)), nz = Math.abs(normal.getZ(i));
    // Two in-plane coordinates for the dominant face; the grain axis goes to U.
    const plane: Record<"x" | "y" | "z", number> = { x, y, z };
    const dominant = nx >= ny && nx >= nz ? "x" : ny >= nz ? "y" : "z";
    const rest = (["x", "y", "z"] as const).filter((axis) => axis !== dominant);
    const along = rest.includes(grain) ? grain : rest[0];
    const across = rest.find((axis) => axis !== along)!;
    uv[i * 2] = plane[along];
    uv[i * 2 + 1] = plane[across];
  }
  geometry.setAttribute("uv", new BufferAttribute(uv, 2));
  return geometry;
}

/** Built rounded boxes by shape; the room repeats many identical parts. */
const bevelled = new Map<string, BufferGeometry>();

export function bevelBox(size: Vec3, radius = .006, grain: "x" | "y" | "z" = "x", segments = 2) {
  const r = Math.max(Math.min(radius, Math.min(...size) / 2 - 1e-4), 1e-4);
  const key = `${size[0]},${size[1]},${size[2]},${r},${grain},${segments}`;
  let template = bevelled.get(key);
  if (!template) {
    // Held as a plain BufferGeometry: cloning a RoundedBoxGeometry would build a new one first.
    template = new BufferGeometry().copy(metreUVs(new RoundedBoxGeometry(size[0], size[1], size[2], segments, r), grain));
    bevelled.set(key, template);
  }
  // Callers transform and merge what they get, so each receives its own copy.
  return template.clone();
}

/** Unbevelled box for tiny repeated details where a fillet would never read. */
export function plainBox(size: Vec3) {
  return metreUVs(new BoxGeometry(...size));
}

export function rod(radius: number, length: number, segments = 16, radiusBottom = radius) {
  return metreUVs(new CylinderGeometry(radius, radiusBottom, length, segments), "y");
}

/** Turned profile, points as [radius, height] from the bottom up. */
export function turned(profile: [number, number][], segments = 32) {
  return metreUVs(new LatheGeometry(profile.map(([r, y]) => new Vector2(r, y)), segments), "y");
}

export function tube(points: Vec3[], radius: number, radial = 8, closed = false, tension = .5) {
  const curve = new CatmullRomCurve3(points.map((p) => new Vector3(...p)), closed, "catmullrom", tension);
  return metreUVs(new TubeGeometry(curve, Math.max(12, points.length * 10), radius, radial, closed), "x");
}

export function ellipsoid(radii: Vec3, widthSegments = 24, heightSegments = 14, thetaLength = Math.PI) {
  const geometry = new SphereGeometry(1, widthSegments, heightSegments, 0, Math.PI * 2, 0, thetaLength);
  geometry.scale(...radii);
  geometry.computeVertexNormals();
  return metreUVs(geometry);
}

/** Grid surface helper: (s, t) ∈ [0,1]² → position, then normals from topology.
 * Unflipped, a grid laid out with s → +X and t → +Z faces +Y. */
function grid(columns: number, rows: number, at: (s: number, t: number) => Vec3, flip = false) {
  const positions = new Float32Array((columns + 1) * (rows + 1) * 3);
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= columns; i++) {
    positions.set(at(i / columns, j / rows), (j * (columns + 1) + i) * 3);
  }
  const index: number[] = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
    const a = j * (columns + 1) + i, b = a + 1, c = a + columns + 1, d = c + 1;
    if (flip) index.push(a, b, c, b, d, c); else index.push(a, c, b, b, c, d);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

/** Gives an unflipped grid surface real thickness: an offset underside and a rim joining
 * the two along every boundary, sharing vertices so hems read rolled, not cut. */
function thicken(surface: BufferGeometry, columns: number, rows: number, thickness: number) {
  const top = surface.getAttribute("position"), normal = surface.getAttribute("normal");
  const count = top.count;
  const positions = new Float32Array(count * 6);
  positions.set(top.array as Float32Array);
  for (let i = 0; i < count; i++) {
    positions[(count + i) * 3] = top.getX(i) - normal.getX(i) * thickness;
    positions[(count + i) * 3 + 1] = top.getY(i) - normal.getY(i) * thickness;
    positions[(count + i) * 3 + 2] = top.getZ(i) - normal.getZ(i) * thickness;
  }
  const faces = Array.from(surface.index!.array);
  const index = [...faces];
  for (let f = 0; f < faces.length; f += 3) index.push(faces[f] + count, faces[f + 2] + count, faces[f + 1] + count);
  const at = (i: number, j: number) => j * (columns + 1) + i;
  const boundary: number[] = [];
  for (let i = 0; i < columns; i++) boundary.push(at(i, 0));
  for (let j = 0; j < rows; j++) boundary.push(at(columns, j));
  for (let i = columns; i > 0; i--) boundary.push(at(i, rows));
  for (let j = rows; j > 0; j--) boundary.push(at(0, j));
  for (let k = 0; k < boundary.length; k++) {
    const a = boundary[k], b = boundary[(k + 1) % boundary.length];
    index.push(a, b, b + count, a, b + count, a + count);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  surface.dispose();
  return geometry;
}

export type SoftPanelOptions = {
  width: number;
  height: number;
  /** Full thickness at the crown. */
  depth: number;
  /** Width multiplier along the panel's height, t ∈ [0,1] bottom to top. */
  taper?: (t: number) => number;
  /** Forward offset (+z) along height: lumbar curves, waterfall seat fronts. */
  bend?: (t: number) => number;
  /** Forward offset toward the side edges: wrap-around backs and dished seats. */
  cup?: number;
  /** Corner squareness of the outline; higher is boxier. */
  corner?: number;
  /** Edge fullness; low values pinch like a pillow seam, high values stay boxy. */
  fullness?: number;
  /** Relative thickness of the back face. */
  back?: number;
  segments?: [number, number];
};

/** A closed, stuffed panel in the XY plane facing +Z: pillows, cushions, chair
 * backs and headboard channels. The outline is a superellipse and the two faces
 * meet at a seam, so silhouettes and highlights stay soft from every angle. */
function panelPoint(options: SoftPanelOptions, a: number, b: number, side: 1 | -1): Vec3 {
  const { width, height, depth, taper = () => 1, bend = () => 0, cup = 0, corner = 5, fullness = .45, back = 1 } = options;
  const t = (b + 1) / 2;
  const peak = Math.max(Math.abs(a), Math.abs(b));
  const ring = Math.pow(Math.pow(Math.abs(a), corner) + Math.pow(Math.abs(b), corner), 1 / corner);
  const k = ring > 0 ? peak / ring : 0;
  const loft = Math.pow(Math.max(0, 1 - Math.pow(Math.min(1, peak), 6)), fullness);
  return [
    a * k * width / 2 * taper(t),
    b * k * height / 2,
    side * loft * depth / 2 * (side > 0 ? 1 : back) + bend(t) + cup * Math.pow(Math.abs(a) * k, 2),
  ];
}

export function softPanel(options: SoftPanelOptions) {
  const [columns, rows] = options.segments ?? [28, 28];
  const surface = (side: 1 | -1) => grid(columns, rows, (s, t) => panelPoint(options, s * 2 - 1, t * 2 - 1, side), side > 0);
  return metreUVs(mergeGeometries([surface(1), surface(-1)])!);
}

/** Points on a soft panel's seam, for piping and frames that follow its outline. */
export function softOutline(options: SoftPanelOptions, count = 48, inset = 1): Vec3[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2;
    const c = Math.cos(angle), s = Math.sin(angle);
    const scale = inset / Math.max(Math.abs(c), Math.abs(s));
    return panelPoint(options, c * scale, s * scale, 1);
  });
}

export type DrapeOptions = {
  /** Width of the support under the cloth (the mattress). */
  width: number;
  /** Length of cloth lying on the support, from its open edge to the foot edge. */
  length: number;
  dropSides: number;
  dropFoot: number;
  /** Radius the cloth rolls over the support's edge with. */
  roll?: number;
  /** Crown loft of the filling on top. */
  loft?: number;
  wrinkle?: number;
  /** Cloth thickness at the hem. */
  thickness?: number;
  seed?: number;
  segments?: [number, number];
};

/** Authored cloth: a bedding layer lying on a flat support, rolling over its side
 * and foot edges and hanging with a flared, wavy hem. Z runs from the open edge
 * (z = 0) toward the foot (z = length). No simulation; every fold is a function. */
export function drape(options: DrapeOptions) {
  const { width, length, dropSides, dropFoot, roll = .05, loft = .03, wrinkle = .012, thickness = .02, seed = 1, segments = [72, 64] } = options;
  const arc = roll * Math.PI / 2;
  const clothWidth = width + 2 * (arc + dropSides);
  const clothLength = length + arc + dropFoot;
  const phase = seed * 1.618;
  const fold = (c: number, half: number, drop: number): [number, number] => {
    const d = Math.abs(c) - half, sign = Math.sign(c) || 1;
    if (d <= 0) return [c, 0];
    if (d < arc) { const a = d / roll; return [sign * (half + roll * Math.sin(a)), roll * (1 - Math.cos(a))]; }
    const hang = Math.min(d - arc, drop);
    return [sign * (half + roll + hang * .1), roll + hang];
  };
  return metreUVs(thicken(grid(segments[0], segments[1], (s, t) => {
    const c = (s - .5) * clothWidth;
    const w = t * clothLength;
    const [x, downX] = fold(c, width / 2, dropSides);
    let zOffset = w, downZ = 0;
    if (w > length) { const [over, down] = fold(w - length, 0, dropFoot); zOffset = length + over; downZ = down; }
    const down = Math.min(downX + downZ, Math.max(dropSides, dropFoot) + roll);
    // Filling lofts in the middle and relaxes toward the edges it rolls over.
    const inside = Math.max(0, 1 - Math.max(Math.abs(c) / (width / 2), w / length));
    const crown = loft * Math.sqrt(Math.min(1, inside * 4)) * (.8 + .2 * Math.sin(w * 3.1 + phase));
    // Wrinkles gather where the cloth hangs and near the foot.
    const hanging = Math.min(1, (downX + downZ) / .08);
    const ripple = wrinkle * (Math.sin(c * 9.3 + w * 2.1 + phase) * .6 + Math.sin(c * 3.7 - w * 6.3 + phase * 2) * .4);
    // Soft vertical folds in the hanging cloth, growing toward the hem.
    const folds = (u: number) => .6 * Math.sin(u * 17 + phase) + .4 * Math.sin(u * 29 + phase * 3);
    const waveX = hanging * .011 * folds(w) * Math.sign(c) * (downX > 0 ? 1 : 0);
    const waveZ = hanging * .011 * folds(c) * (downZ > 0 ? 1 : 0);
    return [x + waveX, crown - down + ripple * (.35 + .65 * hanging), zOffset + waveZ];
  }), segments[0], segments[1], thickness));
}

/** Pleated panel hanging from its top edge in the XY plane; pleats bulge along +Z. */
export function pleated(width: number, height: number, pleats: number, depth: number, flare = .015, seed = 1) {
  return metreUVs(grid(pleats * 8, 24, (s, t) => {
    const x = (s - .5) * width * (1 + (1 - t) * flare * 4);
    const wave = Math.sin(s * pleats * Math.PI * 2 + seed) * (.75 + .25 * Math.sin(s * 7 + seed));
    const y = (t - 1) * height;
    return [x, y, wave * depth * (.7 + .3 * (1 - t)) + Math.sin(s * 3 + seed) * .01 * (1 - t)];
  }, true), "y");
}

/** Collects parts by finish and merges each finish into one static mesh. */
export class Assembly {
  private parts = new Map<RoomFinish, BufferGeometry[]>();
  private static matrix = new Matrix4();
  private static rotation = new Quaternion();

  add(finish: RoomFinish, geometry: BufferGeometry, at: Vec3 = [0, 0, 0], turn: Vec3 = [0, 0, 0], scale: Vec3 = [1, 1, 1]) {
    Assembly.rotation.setFromEuler(new Euler(...turn));
    Assembly.matrix.compose(new Vector3(...at), Assembly.rotation, new Vector3(...scale));
    const part = geometry.index ? geometry : geometry.setIndex([...Array(geometry.getAttribute("position").count).keys()]);
    for (const name of Object.keys(part.attributes)) if (!["position", "normal", "uv"].includes(name)) part.deleteAttribute(name);
    part.applyMatrix4(Assembly.matrix);
    const list = this.parts.get(finish) ?? [];
    list.push(part);
    this.parts.set(finish, list);
    return this;
  }

  /** Adds a nested assembly under a transform. */
  include(other: Assembly, at: Vec3 = [0, 0, 0], turn: Vec3 = [0, 0, 0]) {
    for (const [finish, list] of other.parts) for (const part of list) this.add(finish, part.clone(), at, turn);
    return this;
  }

  build() {
    const merged = new Map<RoomFinish, BufferGeometry>();
    for (const [finish, list] of this.parts) {
      const geometry = mergeGeometries(list)!;
      geometry.computeBoundingSphere();
      geometry.computeBoundingBox();
      merged.set(finish, geometry);
      list.forEach((part) => part.dispose());
    }
    this.parts.clear();
    return merged;
  }
}

/** A single leaf blade growing along +Y from its base, curling toward +Z and
 * folded along the midrib. */
export function leafBlade(length: number, width: number, curl: number, fold: number) {
  return metreUVs(grid(4, 10, (s, t) => {
    const a = s * 2 - 1;
    const half = width / 2 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05 + .02)), .7);
    return [a * half, t * length * (1 - .25 * curl * t), curl * length * t * t + fold * Math.abs(a) * half];
  }, true), "y");
}
