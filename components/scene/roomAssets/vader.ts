import {
  BufferGeometry, CanvasTexture, Color, CylinderGeometry, Euler, ExtrudeGeometry, Float32BufferAttribute, LatheGeometry, Matrix4,
  MeshPhysicalMaterial, MeshStandardMaterial, Quaternion, Shape, ShapeUtils, SRGBColorSpace, Vector2, Vector3,
  type Material,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { VADER_AT } from "../roomLayout";
import type { Vec3 } from "./shapes";

/** Life-size brick sculpture of the display figure, in metres, standing on its
 * baseplate at y = 0 and facing +Z; 1.935 m to the helmet crown.
 *
 * Built the way large display sculptures are: each body part is a stack of thin
 * courses whose plan outline follows the sculpted contour. Courses loft into the
 * next like curved slopes, so helmet and armour read as tiled surfaces while every
 * course edge, and the staggered joints the shader draws along it, stay visible up
 * close. Mask, controls, gloves and hilt are explicit wedges, tiles and plates.
 * Everything merges into one mesh per finish. */

export type Finish = "helmet" | "armour" | "suit" | "cape" | "leather" | "charcoal" | "metal" | "lens" | "control" | "plinth" | "plate" | "plaque";

/** Finishes whose pieces carry per-vertex colour. */
const COLOURED = new Set<Finish>(["control"]);

export const SABER = {
  hilt: .27,
  blade: .9,
};

type Pt = [number, number];
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => { const c = clamp01(t); return c * c * (3 - 2 * c); };
const keyed = (keys: [number, number][], y: number) => {
  if (y <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (y <= keys[i][0]) return mix(keys[i - 1][1], keys[i][1], smooth((y - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0])));
  return keys[keys.length - 1][1];
};

// ---- one mesh per finish ------------------------------------------------------------

class Figure {
  private parts = new Map<Finish, BufferGeometry[]>();

  add(finish: Finish, geometry: BufferGeometry, matrix?: Matrix4, colour?: Color) {
    const part = geometry.index ? geometry : geometry.setIndex([...Array(geometry.getAttribute("position").count).keys()]);
    for (const name of Object.keys(part.attributes)) if (!["position", "normal", "seam", "color"].includes(name)) part.deleteAttribute(name);
    const count = part.getAttribute("position").count;
    if (!part.getAttribute("seam")) part.setAttribute("seam", new Float32BufferAttribute(new Float32Array(count * 3), 3));
    if (COLOURED.has(finish)) {
      const c = colour ?? new Color(.4, .4, .4);
      part.setAttribute("color", new Float32BufferAttribute(Array.from({ length: count }, () => [c.r, c.g, c.b]).flat(), 3));
    } else if (part.getAttribute("color")) part.deleteAttribute("color");
    if (matrix) part.applyMatrix4(matrix);
    const list = this.parts.get(finish) ?? [];
    list.push(part);
    this.parts.set(finish, list);
  }

  build() {
    const merged = new Map<Finish, BufferGeometry>();
    for (const [finish, list] of this.parts) {
      const geometry = mergeGeometries(list)!;
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      merged.set(finish, geometry);
      list.forEach((part) => part.dispose());
    }
    this.parts.clear();
    return merged;
  }
}

const place = (at: Vec3, turn: Vec3 = [0, 0, 0], scale: Vec3 = [1, 1, 1]) =>
  new Matrix4().compose(new Vector3(...at), new Quaternion().setFromEuler(new Euler(...turn)), new Vector3(...scale));

/** A frame whose +Y runs along `axis` and whose +Z leans toward `front`. */
function frame(origin: Vec3, axis: Vector3, front = new Vector3(0, 0, 1)) {
  const y = axis.clone().normalize();
  let z = front.clone().addScaledVector(y, -front.dot(y));
  if (z.lengthSq() < 1e-6) z = new Vector3(1, 0, 0).addScaledVector(y, -y.x);
  z.normalize();
  const x = new Vector3().crossVectors(y, z).normalize();
  return new Matrix4().makeBasis(x, y, z).setPosition(...origin);
}

// ---- coursed shells -----------------------------------------------------------------

class Sheet {
  positions: number[] = [];
  normals: number[] = [];
  seams: number[] = [];
  index: number[] = [];
  vertex(p: Vec3, n: Vec3, seam: Vec3 = [0, 0, 0]) {
    this.positions.push(...p);
    this.normals.push(...n);
    this.seams.push(...seam);
    return this.positions.length / 3 - 1;
  }
  /** Winds each triangle to agree with its vertex normals. */
  tri(a: number, b: number, c: number) {
    const P = this.positions, N = this.normals;
    const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2];
    const ux = P[b * 3] - ax, uy = P[b * 3 + 1] - ay, uz = P[b * 3 + 2] - az;
    const vx = P[c * 3] - ax, vy = P[c * 3 + 1] - ay, vz = P[c * 3 + 2] - az;
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    const nx = N[a * 3] + N[b * 3] + N[c * 3], ny = N[a * 3 + 1] + N[b * 3 + 1] + N[c * 3 + 1], nz = N[a * 3 + 2] + N[b * 3 + 2] + N[c * 3 + 2];
    if (fx * nx + fy * ny + fz * nz < 0) this.index.push(a, c, b); else this.index.push(a, b, c);
  }
  geometry() {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute("normal", new Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute("seam", new Float32BufferAttribute(this.seams, 3));
    geometry.setIndex(this.index);
    return geometry;
  }
}

type Course = {
  /** Course height; the span is divided into whole courses. */
  course: number;
  /** Chamfer on every course edge, which is what reads as the brick seam line. */
  bevel?: number;
  /** Brick length for the drawn joints; 0 for none. */
  joint?: number;
  /** Corners sharper than this (radians) keep split normals. */
  crease?: number;
  /** Each course leans to meet the next one's outline, like a curved slope. */
  loft?: boolean;
};

type Ring = { pts: Pt[]; n: Pt[]; m: Pt[]; prev: Pt[]; next: Pt[]; sharp: boolean[]; u: number[]; length: number };

function ring(poly: Pt[], crease: number): Ring {
  let area = 0;
  for (let i = 0; i < poly.length; i++) { const [x1, z1] = poly[i], [x2, z2] = poly[(i + 1) % poly.length]; area += x1 * z2 - x2 * z1; }
  const pts = area < 0 ? [...poly].reverse() : poly;
  const count = pts.length;
  const edge: Pt[] = [];
  const u: number[] = [0];
  for (let i = 0; i < count; i++) {
    const [x1, z1] = pts[i], [x2, z2] = pts[(i + 1) % count];
    const length = Math.hypot(x2 - x1, z2 - z1) || 1e-6;
    edge.push([(z2 - z1) / length, -(x2 - x1) / length]);
    u.push(u[i] + length);
  }
  const n: Pt[] = [], m: Pt[] = [], prev: Pt[] = [], next: Pt[] = [], sharp: boolean[] = [];
  const limit = Math.cos(crease);
  for (let i = 0; i < count; i++) {
    const a = edge[(i - 1 + count) % count], b = edge[i];
    const dot = a[0] * b[0] + a[1] * b[1];
    const sx = a[0] + b[0], sz = a[1] + b[1], sl = Math.hypot(sx, sz) || 1;
    n.push([sx / sl, sz / sl]);
    const k = Math.min(2.2, 1 / Math.max(.2, (1 + dot) / 2) / 2);
    m.push([sx * k, sz * k]);
    prev.push(a); next.push(b);
    sharp.push(dot < limit);
  }
  return { pts, n, m, prev, next, sharp, u, length: u[count] };
}

/** The ring as a closed strip of entries: one per smooth vertex, two per crease. */
function strip(r: Ring) {
  const entries: { i: number; n: Pt; u: number }[] = [];
  const count = r.pts.length;
  const first = r.sharp[0] ? r.next[0] : r.n[0];
  entries.push({ i: 0, n: first, u: 0 });
  for (let i = 1; i < count; i++) {
    if (r.sharp[i]) { entries.push({ i, n: r.prev[i], u: r.u[i] }, { i, n: r.next[i], u: r.u[i] }); }
    else entries.push({ i, n: r.n[i], u: r.u[i] });
  }
  entries.push({ i: 0, n: r.sharp[0] ? r.prev[0] : r.n[0], u: r.length });
  return entries;
}

/** Stack of courses from y0 to y1; outline(y, course) gives the plan outline in
 * (x, z) at height y, or null for no course. Lofted outlines must keep their
 * point count from course to course. */
function coursed(y0: number, y1: number, outline: (y: number, course: number) => Pt[] | null, style: Course) {
  const { course, bevel = .0012, joint = .064, crease = .7, loft = false } = style;
  const sheet = new Sheet();
  const count = Math.max(1, Math.round((y1 - y0) / course));
  const h = (y1 - y0) / count;
  for (let c = 0; c < count; c++) {
    const yb = y0 + c * h, yt = yb + h;
    const lower = outline(loft ? yb : yb + h / 2, c);
    if (!lower || lower.length < 3) continue;
    const upperPoly = loft ? outline(yt, c) : null;
    const bottom = ring(lower, crease);
    const top = upperPoly && upperPoly.length === lower.length ? ring(upperPoly, crease) : bottom;
    const b = Math.min(bevel, h * .3);
    const stagger = (c % 2) * joint * .5 + ((c * 7) % 3) * joint * .17;
    const entries = strip(bottom);
    const pos = (r: Ring, i: number, y: number, inset: number): Vec3 => [r.pts[i][0] - r.m[i][0] * inset, y, r.pts[i][1] - r.m[i][1] * inset];
    // Grooves darken toward the inset edge of each chamfer, so course joints read
    // as fine shadow lines rather than highlights.
    const band = (ra: Ring, ya: number, ia: number, rb: Ring, yb2: number, ib: number, ny: number, slope: boolean) => {
      const row: number[][] = [];
      for (const e of entries) {
        const pa = pos(ra, e.i, ya, ia), pb = pos(rb, e.i, yb2, ib);
        let nx = e.n[0], nz = e.n[1], nyy = ny;
        if (slope) {
          const d = (pb[0] - pa[0]) * e.n[0] + (pb[2] - pa[2]) * e.n[1];
          const l = Math.hypot(yb2 - ya, d) || 1;
          nx = e.n[0] * (yb2 - ya) / l; nz = e.n[1] * (yb2 - ya) / l; nyy = -d / l;
        }
        const nl = Math.hypot(nx, nyy, nz) || 1;
        const normal: Vec3 = [nx / nl, nyy / nl, nz / nl];
        row.push([sheet.vertex(pa, normal, [e.u + stagger, joint, ia > 0 ? 1 : 0]), sheet.vertex(pb, normal, [e.u + stagger, joint, ib > 0 ? 1 : 0])]);
      }
      for (let k = 0; k < entries.length - 1; k++) {
        if (entries[k].i === entries[k + 1].i) continue;
        const [a0, a1] = row[k], [b0, b1] = row[k + 1];
        sheet.tri(a0, b0, b1); sheet.tri(a0, b1, a1);
      }
    };
    band(bottom, yb, b, bottom, yb + b, 0, -.4, false);
    band(bottom, yb + b, 0, top, yt - b, 0, 0, true);
    band(top, yt - b, 0, top, yt, b, .4, false);
    const cap = (r: Ring, y: number, up: number) => {
      const inset = r.pts.map((_, i) => pos(r, i, y, b));
      const contour = inset.map(([x, , z]) => new Vector2(x, z));
      const start = sheet.positions.length / 3;
      inset.forEach((p) => sheet.vertex(p, [0, up, 0], [0, 0, 1]));
      for (const [a, bb, cc] of ShapeUtils.triangulateShape(contour, [])) sheet.tri(start + a, start + bb, start + cc);
    };
    cap(bottom, yb, -1);
    cap(top, yt, 1);
  }
  return sheet.geometry();
}

/** Superellipse outline about (cx, cz); angle is measured from +Z toward +X. */
function oval(cx: number, cz: number, a: number, b: number, points: number, power = 2, radial?: (angle: number) => number): Pt[] {
  return Array.from({ length: points }, (_, i) => {
    const t = (i / points) * Math.PI * 2;
    const s = Math.sin(t), c = Math.cos(t);
    const k = radial ? radial(t) : 1;
    return [cx + a * k * Math.sign(s) * Math.pow(Math.abs(s), 2 / power), cz + b * k * Math.sign(c) * Math.pow(Math.abs(c), 2 / power)];
  });
}

/** A thick C-shaped band: the arc from `from` to `to` (radians from +Z), with
 * radial offsets for folds. */
function arcBand(cx: number, cz: number, a: number, b: number, from: number, to: number, thickness: number, points: number, radial: (angle: number) => number = () => 0, clampPoint?: (outer: Pt, inner: Pt) => [Pt, Pt]): Pt[] {
  const outer: Pt[] = [], inner: Pt[] = [];
  for (let i = 0; i <= points; i++) {
    const t = mix(from, to, i / points);
    const s = Math.sin(t), c = Math.cos(t), r = radial(t);
    let o: Pt = [cx + (a + r) * s, cz + (b + r) * c];
    let n: Pt = [cx + (a + r - thickness) * s, cz + (b + r - thickness) * c];
    if (clampPoint) [o, n] = clampPoint(o, n);
    outer.push(o); inner.push(n);
  }
  return [...outer, ...inner.reverse()];
}

/** Tapered limb along a → b, courses square to its own axis. */
function limb(a: Vec3, b: Vec3, radius: (t: number) => Pt, style: Course, points: number, front?: Vector3) {
  const axis = new Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const length = axis.length();
  const geometry = coursed(0, length, (y) => { const [rx, rz] = radius(y / length); return oval(0, 0, rx, rz, points, 2.2); }, style);
  geometry.applyMatrix4(frame(a, axis, front));
  return geometry;
}

// ---- small pieces ---------------------------------------------------------------------

const box = (size: Vec3, radius = .0025, segments = 2) => new RoundedBoxGeometry(size[0], size[1], size[2], segments, Math.min(radius, Math.min(...size) / 2 - 1e-4));

/** A plate extruded from an outline in the XY plane, thickness along +Z, with a chamfer. */
function plate(outline: Pt[], thickness: number, chamfer = .0015) {
  const shape = new Shape();
  outline.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y));
  shape.closePath();
  const geometry = new ExtrudeGeometry(shape, { depth: Math.max(1e-4, thickness - chamfer * 2), bevelEnabled: chamfer > 0, bevelThickness: chamfer, bevelSize: chamfer, bevelSegments: 1, curveSegments: 4 });
  geometry.translate(0, 0, chamfer);
  geometry.computeVertexNormals();
  return geometry;
}

const turned = (profile: Pt[], segments = 28) => {
  const geometry = new LatheGeometry(profile.map(([r, y]) => new Vector2(r, y)), segments);
  geometry.computeVertexNormals();
  return geometry;
};

const rod = (radius: number, length: number, segments = 16) => new CylinderGeometry(radius, radius, length, segments);

// ---- the figure -----------------------------------------------------------------------

/** Right fist and hilt axis; the saber is held low and forward of the hip. */
const RIGHT = { shoulder: [.215, 1.43, -.005] as Vec3, elbow: [.3, 1.16, -.01] as Vec3, wrist: [.29, 1.07, .19] as Vec3 };
const LEFT = { shoulder: [-.215, 1.43, -.005] as Vec3, elbow: [-.305, 1.15, -.03] as Vec3, wrist: [-.3, .95, .04] as Vec3 };
const SABER_AXIS = new Vector3(.28, -.95, .1).normalize();

const v3 = (p: Vec3) => new Vector3(...p);
const forearm = (arm: typeof RIGHT) => v3(arm.wrist).sub(v3(arm.elbow)).normalize();
const RIGHT_FIST = v3(RIGHT.wrist).addScaledVector(forearm(RIGHT), .058);
const LEFT_FIST = v3(LEFT.wrist).addScaledVector(forearm(LEFT), .052);

/** Keeps the cape's back on the plinth and off the wall behind it: the figure is
 * turned on a plinth that stands square to the wall. */
const TURN = VADER_AT.turn;
const WALL_SIDE = -.34;
function offWall(centre: Pt) {
  const toPlinth = ([x, z]: Pt) => x * Math.cos(TURN) + z * Math.sin(TURN);
  const c = toPlinth(centre);
  return (outer: Pt, inner: Pt): [Pt, Pt] => {
    const o = toPlinth(outer);
    if (o >= WALL_SIDE) return [outer, inner];
    const k = (WALL_SIDE - c) / (o - c);
    const pull = (p: Pt): Pt => [centre[0] + (p[0] - centre[0]) * k, centre[1] + (p[1] - centre[1]) * k];
    return [pull(outer), pull(inner)];
  };
}

/** Gloved fist around an axis: a knuckle block, four finger plates wrapped over
 * the grip, a thumb curled across its leading end and a cuff seam at the wrist. */
function fist(figure: Figure, centre: Vector3, grip: Vector3, knuckles: Vector3, side: 1 | -1) {
  const m = frame(centre.toArray() as Vec3, grip, knuckles);
  const add = (finish: Finish, geometry: BufferGeometry, at: Vec3, turn: Vec3 = [0, 0, 0]) => figure.add(finish, geometry, m.clone().multiply(place(at, turn)));
  add("leather", box([.074, .098, .068], .02, 3), [0, .004, -.012]);
  for (let i = 0; i < 4; i++) {
    const y = -.036 + i * .0245;
    add("leather", box([.078, .021, .03], .008, 2), [side * .002, y, .026]);
    add("leather", box([.03, .02, .03], .007, 2), [side * -.03, y, .006]);
  }
  add("leather", box([.058, .022, .034], .01, 2), [side * -.006, .054, .006], [0, 0, side * -.12]);
  add("charcoal", box([.064, .012, .062], .004), [0, .054, -.016]);
}

function buildFigure(detail: number) {
  const figure = new Figure();
  const pts = (n: number) => Math.max(10, Math.round(n * detail / 2) * 2);

  // ---- helmet -----------------------------------------------------------------------
  // Dome: lofted tile courses rising to a slight crest; the first course stands
  // just proud as the rim where dome meets flare.
  const domeBase = 1.748, crown = 1.935;
  figure.add("helmet", coursed(domeBase, crown, (y) => {
    const u = clamp01((y - domeBase) / (crown - domeBase));
    const f = Math.pow(Math.max(0, 1 - Math.pow(u, 2.3)), 1 / 2.3);
    const rim = y < domeBase + .011 ? .0035 : 0;
    const crest = (t: number) => 1 + .05 * smooth((u - .25) / .5) * Math.exp(-Math.pow(Math.sin(t) / .15, 2));
    return oval(0, -.016, .147 * f + rim + .001, .164 * f + rim + .001, pts(56), 2.1, crest);
  }, { course: .0112, loft: true, joint: .09 }));

  // Flare: a C-shaped band that starts right under the dome, wraps forward to
  // frame the cheeks and sweeps wider and further back toward its lower edge;
  // the back drops lower than the cheeks.
  figure.add("helmet", coursed(1.512, domeBase + .002, (y) => {
    const t = clamp01((y - 1.512) / (domeBase + .002 - 1.512));
    const spread = Math.pow(1 - t, 1.25);
    const a = .146 + .08 * spread, b = .161 + .066 * spread, cz = -.018 - .036 * (1 - t);
    const open = keyed([[1.512, 110], [1.555, 90], [1.595, 60], [1.64, 42], [domeBase, 36]], y) * Math.PI / 180;
    const lip = y < 1.527 ? .005 : 0;
    return arcBand(0, cz, a + lip, b + lip, open, Math.PI * 2 - open, .02 + lip, pts(48));
  }, { course: .0112, loft: true, joint: .09 }));

  // Mask: courses whose front outline carries the nose ridge, cheekbones and the
  // recessed eye band under the brow; its back fills the flare so nothing shows
  // through beside the cheeks.
  const mirror = (half: Pt[]): Pt[] => [...half, ...half.slice(1).reverse().map(([x, z]) => [-x, z] as Pt)].slice(0, half.length * 2 - 1);
  const MASK: [number, Pt[]][] = [
    [1.552, [[0, .112], [.022, .11], [.04, .105], [.056, .096], [.07, .083], [.08, .062], [.1, .02], [.13, -.05]]],
    [1.6, [[0, .134], [.024, .128], [.047, .116], [.068, .101], [.088, .082], [.104, .058], [.122, .02], [.15, -.05]]],
    [1.648, [[0, .147], [.026, .14], [.052, .127], [.078, .109], [.098, .088], [.114, .064], [.13, .025], [.15, -.05]]],
    [1.7, [[0, .153], [.018, .148], [.044, .136], [.074, .118], [.1, .095], [.118, .068], [.134, .03], [.15, -.05]]],
    [1.708, [[0, .15], [.012, .146], [.022, .114], [.058, .106], [.094, .097], [.114, .076], [.134, .035], [.15, -.05]]],
    [1.746, [[0, .149], [.012, .145], [.022, .113], [.058, .105], [.094, .096], [.114, .075], [.134, .035], [.15, -.05]]],
    [1.752, [[0, .153], [.02, .151], [.046, .144], [.076, .131], [.102, .107], [.118, .075], [.134, .035], [.15, -.05]]],
  ];
  figure.add("helmet", coursed(1.552, 1.756, (y) => {
    let k = 1;
    while (k < MASK.length - 1 && y > MASK[k][0]) k++;
    const [ya, a] = MASK[k - 1], [yb, b] = MASK[k];
    const t = clamp01((y - ya) / (yb - ya));
    return mirror(a.map(([x, z], i) => [mix(x, b[i][0], t), mix(z, b[i][1], t)] as Pt));
  }, { course: .0102, loft: true, crease: .5, joint: .07 }));

  for (const side of [-1, 1] as const) {
    // Eye lenses in the recess, following its floor and leaning back under the brow;
    // their upper edge falls toward the nose like the brow above.
    const lens: Pt[] = [[-.036, .012], [-.01, .017], [.022, .02], [.042, .016], [.044, .002], [.034, -.013], [.006, -.019], [-.026, -.014], [-.038, -.002]];
    figure.add("lens", plate(lens.map(([x, y]) => [side * x, y] as Pt), .006, .0018), place([side * .058, 1.727, .104], [-.1, side * .24, 0]));
    // Cheek plates stepping out below the eyes.
    figure.add("helmet", plate([[-.034, .011], [.034, .013], [.03, -.012], [-.02, -.019]].map(([x, y]) => [side * x, y] as Pt), .008), place([side * .074, 1.679, .114], [-.05, side * .62, 0]));
  }
  // Respirator: a downward triangle, a dark backplate behind short vertical slats
  // in a metal frame, a nose bridge and a small chin vent.
  const grille = new Matrix4().compose(new Vector3(0, 1.628, .13), new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -.16), new Vector3(1, 1, 1));
  const onGrille = (finish: Finish, geometry: BufferGeometry, at: Vec3, turn: Vec3 = [0, 0, 0]) => figure.add(finish, geometry, grille.clone().multiply(place(at, turn)));
  onGrille("charcoal", plate([[-.046, .037], [.046, .037], [0, -.05]], .012, .002), [0, 0, 0]);
  // Slats fill the triangle from its top bar down to its sloping edges.
  for (let i = -3; i <= 3; i++) {
    const x = i * .0112, bottom = -.042 + Math.abs(x) * 1.89, top = .031;
    onGrille("metal", box([.0042, top - bottom, .004], .0014), [x, (top + bottom) / 2, .013]);
  }
  onGrille("metal", box([.094, .005, .006], .002), [0, .036, .012]);
  figure.add("helmet", box([.024, .034, .016], .005), place([0, 1.684, .145], [-.2, 0, 0]));
  figure.add("charcoal", box([.028, .01, .008], .003), place([0, 1.566, .114], [.2, 0, 0]));
  for (const side of [-1, 1]) {
    figure.add("charcoal", plate([[0, .016], [.022, 0], [0, -.016]].map(([x, y]) => [side * x, y] as Pt), .007, .0015), place([side * .062, 1.62, .105], [0, side * .7, 0]));
    for (let r = 0; r < 3; r++) figure.add("metal", box([.015, .0026, .0035], .001), place([side * (.066 + r * .002), 1.627 - r * .007, .109 - r * .002], [0, side * .7, 0]));
  }

  // Neck seal under the helmet.
  figure.add("charcoal", coursed(1.49, 1.6, () => oval(0, -.01, .068, .074, pts(24)), { course: .012, joint: .05 }));

  // ---- torso ------------------------------------------------------------------------
  const torsoA: [number, number][] = [[.9, .165], [.98, .158], [1.08, .152], [1.18, .168], [1.28, .186], [1.38, .199], [1.45, .2]];
  const torsoB: [number, number][] = [[.9, .118], [.98, .112], [1.08, .108], [1.18, .118], [1.28, .125], [1.38, .128], [1.45, .124]];
  const torso = (y: number, grow = 0) => oval(0, -.01, keyed(torsoA, y) + grow, keyed(torsoB, y) + grow, pts(52), 2.7);
  figure.add("suit", coursed(.9, 1.45, (y) => torso(y), { course: .016, loft: true, joint: .064 }));

  // Yoke: the armoured shoulder mantle, squared and rounding over to the neck.
  figure.add("armour", coursed(1.4, 1.535, (y) => {
    const t = clamp01((y - 1.4) / .135);
    const a = keyed([[1.4, .212], [1.45, .232], [1.5, .222], [1.535, .15]], y);
    const b = keyed([[1.4, .136], [1.45, .144], [1.5, .136], [1.535, .1]], y);
    return oval(0, -.012, a, b, pts(52), mix(3.1, 2.4, t));
  }, { course: .0135, loft: true, joint: .085 }));

  // Chest plates over the suit, open at the back, with a lower edge that curves up
  // at the sides.
  figure.add("armour", coursed(1.235, 1.415, (y) => {
    const open = keyed([[1.235, 58], [1.28, 72], [1.415, 80]], y) * Math.PI / 180;
    const a = keyed(torsoA, y) + .014, b = keyed(torsoB, y) + .014;
    return arcBand(0, -.01, a, b, -open, open, .016, pts(30));
  }, { course: .015, loft: true, joint: .085 }));

  // Shoulder armour: three layered caps per side, each tilted further out.
  for (const side of [-1, 1] as const) {
    const caps: [Vec3, number, number, number][] = [[[side * .19, 1.455, -.01], .5, .102, .075], [[side * .245, 1.418, -.008], .82, .082, .058], [[side * .282, 1.372, -.006], 1.1, .066, .044]];
    for (const [at, tilt, r, h] of caps) {
      const geometry = coursed(0, h, (y) => { const f = Math.sqrt(Math.max(.02, 1 - Math.pow(y / h, 2.2))); return oval(0, 0, r * f, r * 1.1 * f, pts(32), 2.4); }, { course: .0125, loft: true, joint: .07 });
      figure.add("armour", geometry, place(at, [0, 0, -side * tilt]));
    }
  }

  // Chest control box: a housing, a dark face, switch rows and slot bars.
  const chest = new Matrix4().compose(new Vector3(0, 1.3, .142), new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -.1), new Vector3(1, 1, 1));
  const onChest = (finish: Finish, geometry: BufferGeometry, at: Vec3, colour?: Color) => figure.add(finish, geometry, chest.clone().multiply(place(at)), colour);
  onChest("metal", box([.135, .104, .018], .004), [0, 0, 0]);
  onChest("charcoal", box([.121, .09, .008], .002), [0, 0, .008]);
  const lamps: [string, number, number][] = [["#d5261b", -.044, .028], ["#d5261b", -.026, .028], ["#2d8f4a", -.008, .028], ["#2f67c9", .01, .028], ["#e4e1d6", .028, .028], ["#d5261b", .046, .028]];
  for (const [hex, x, y] of lamps) onChest("control", box([.013, .012, .008], .002), [x, y, .013], new Color(hex));
  for (const [x, hex] of [[-.036, "#2f67c9"], [-.02, "#d5261b"], [-.004, "#2f67c9"]] as const) onChest("control", box([.01, .03, .007], .002), [x, -.018, .013], new Color(hex));
  for (const y of [.004, -.012, -.028]) onChest("metal", box([.038, .006, .007], .0015), [.03, y, .013]);
  onChest("control", box([.01, .01, .007], .002), [.044, -.03, .014], new Color("#e0a13a"));

  // Belt: a band proud of the waist, a buckle plate with a raised frame, and
  // three control boxes either side following the curve.
  const beltY = 1.022;
  figure.add("armour", coursed(.985, 1.06, (y) => torso(y, .014), { course: .015, joint: .05, bevel: .0014 }));
  figure.add("metal", box([.104, .066, .012], .004), place([0, beltY, .125]));
  figure.add("charcoal", box([.084, .046, .006], .002), place([0, beltY, .131]));
  for (const [x, hex] of [[-.02, "#d5261b"], [0, "#e4e1d6"], [.02, "#2f67c9"]] as const) figure.add("control", box([.012, .012, .006], .002), place([x, beltY + .004, .135]), new Color(hex));
  for (const side of [-1, 1]) for (let k = 0; k < 3; k++) {
    const angle = side * (.52 + k * .24);
    const a = keyed(torsoA, beltY) + .02, b = keyed(torsoB, beltY) + .02;
    const at: Vec3 = [a * Math.sin(angle), beltY, -.01 + b * Math.cos(angle)];
    const turn: Vec3 = [0, angle * .85, 0];
    figure.add(k === 1 ? "charcoal" : "metal", box([.03, .058, .016], .003), place(at, turn));
    const lamp = place(at, turn).multiply(place([0, .012, .009]));
    figure.add("control", box([.01, .01, .005], .0015), lamp, new Color(k === 1 ? "#d5261b" : "#2f67c9"));
    figure.add("charcoal", box([.02, .004, .004], .001), place(at, turn).multiply(place([0, -.012, .009])));
  }

  // Tunic below the belt, split at the front so the legs keep their line.
  figure.add("suit", coursed(.74, .99, (y) => {
    const t = clamp01((.99 - y) / .25);
    return arcBand(0, -.012, .168 + t * .052 + .006, .12 + t * .036 + .006, .14 + t * .1, Math.PI * 2 - .14 - t * .1, .018, pts(40), (angle) => .004 * Math.sin(angle * 5) * t);
  }, { course: .018, loft: true, joint: .064 }));

  // ---- arms -------------------------------------------------------------------------
  for (const [arm, fistAt, grip, side] of [[RIGHT, RIGHT_FIST, SABER_AXIS, 1], [LEFT, LEFT_FIST, new Vector3(0, .33, .944).normalize(), -1]] as const) {
    const f = forearm(arm);
    figure.add("suit", limb(arm.shoulder, arm.elbow, (t) => [mix(.062, .053, t), mix(.066, .055, t)], { course: .016, loft: true, joint: .06 }, pts(20)));
    figure.add("charcoal", coursed(-.032, .032, (y) => oval(0, 0, .056 * Math.sqrt(1 - Math.pow(y / .036, 2)), .058 * Math.sqrt(1 - Math.pow(y / .036, 2)), pts(20)), { course: .01, loft: true, joint: 0 }), frame(arm.elbow, f));
    const cuffStart = v3(arm.wrist).addScaledVector(f, -.13).toArray() as Vec3;
    figure.add("suit", limb(arm.elbow, cuffStart, (t) => [mix(.052, .047, t), mix(.054, .048, t)], { course: .016, loft: true, joint: .06 }, pts(20)));
    // Gauntlet: flared glove cuff down to the wrist.
    figure.add("leather", limb(cuffStart, arm.wrist, (t) => { const r = mix(.062, .045, Math.pow(t, .7)); return [r, r * 1.04]; }, { course: .013, loft: true, joint: .05 }, pts(20)));
    const knuckles = f.clone().addScaledVector(grip, -f.dot(grip)).normalize();
    fist(figure, fistAt, grip, knuckles, side);
  }

  // ---- legs -------------------------------------------------------------------------
  for (const side of [-1, 1] as const) {
    const ankle: Vec3 = [side * .125, .09, 0];
    figure.add("suit", limb([side * .118, .47, .006], [side * .092, .95, -.004], (t) => [mix(.07, .088, t), mix(.074, .09, t)], { course: .018, loft: true, joint: .064 }, pts(24)));
    figure.add("charcoal", limb([side * .119, .455, .006], [side * .118, .5, .006], () => [.072, .076], { course: .015, joint: .05 }, pts(24)));
    // Boot shaft with a flared cuff; shin guard across its front.
    figure.add("leather", limb(ankle, [side * .119, .47, .006], (t) => {
      const r = t < .86 ? mix(.058, .067, t / .86) : mix(.067, .081, (t - .86) / .14);
      return [r, r * 1.06];
    }, { course: .017, loft: true, joint: .06 }, pts(26)));
    const shin = coursed(.2, .425, (y) => {
      const t = (y - .09) / .38, r = mix(.058, .067, t / .86) + .012;
      return arcBand(0, 0, r, r * 1.06, -.95, .95, .012, pts(18));
    }, { course: .016, loft: true, joint: .06 });
    figure.add("armour", shin, place([side * .124, 0, .004], [0, side * .05, 0]));
    // Foot: a lofted toe box that drops toward the toe, on a sole.
    const foot = coursed(.016, .105, (y) => {
      const toe = .165 - .085 * clamp01((y - .04) / .065), heel = -.072;
      const a = .057 - .01 * clamp01((y - .06) / .045);
      return oval(0, (toe + heel) / 2, a, (toe - heel) / 2, pts(32), 2.6);
    }, { course: .0148, loft: true, joint: .06 });
    const turnOut = side * .1;
    figure.add("leather", foot, place([ankle[0], 0, 0], [0, turnOut, 0]));
    figure.add("charcoal", coursed(0, .016, () => oval(0, .047, .061, .122, pts(32), 2.6), { course: .016, joint: 0 }), place([ankle[0], 0, 0], [0, turnOut, 0]));
  }

  // ---- cape -------------------------------------------------------------------------
  // Hangs from under the shoulder armour, clear of the arms, flaring behind the
  // legs to a weighted hem; folds deepen toward the floor.
  const capeTop = 1.49;
  figure.add("cape", coursed(.02, capeTop, (y) => {
    const a = keyed([[.02, .45], [.6, .41], [1.1, .37], [1.36, .35], [1.44, .3], [capeTop, .24]], y);
    const b = keyed([[.02, .33], [.6, .28], [1.1, .235], [1.4, .2], [capeTop, .16]], y);
    const cz = keyed([[.02, -.12], [.6, -.09], [1.3, -.05], [capeTop, -.02]], y);
    const open = keyed([[.02, 101], [1.3, 93], [1.42, 72], [capeTop, 60]], y) * Math.PI / 180;
    const depth = keyed([[.02, .032], [.5, .022], [1.2, .012], [capeTop, .003]], y);
    const hem = y < .07 ? .03 : .02;
    const folds = (angle: number) => depth * (Math.sin(angle * 6.2 + 1.1) * .7 + Math.sin(angle * 11.3 + 2.4) * .3);
    return arcBand(0, cz, a, b, open, Math.PI * 2 - open, hem, pts(64), folds, offWall([0, cz]));
  }, { course: .02, loft: true, joint: .08, bevel: .0014 }));

  return figure;
}

// ---- hilt ---------------------------------------------------------------------------------

/** Pommel, black grip with its ridge track, clamp with a red switch, and a
 * flared, notched emitter shroud; turned along +Y from the pommel. */
function buildHilt(figure: Figure, start: Vector3, axis: Vector3) {
  const length = SABER.hilt;
  const m = frame(start.toArray() as Vec3, axis, new Vector3(1, 0, 0));
  const add = (finish: Finish, geometry: BufferGeometry, at: Vec3 = [0, 0, 0], turn: Vec3 = [0, 0, 0], colour?: Color) => figure.add(finish, geometry, m.clone().multiply(place(at, turn)), colour);
  add("metal", turned([[0, 0], [.013, 0], [.018, .004], [.018, .016], [.0155, .02], [.0155, .03], [0, .03]], 24));
  add("charcoal", turned([[0, .03], [.0165, .03], [.0165, .128], [0, .128]], 24));
  for (let i = 0; i < 7; i++) add("charcoal", box([.008, .009, .006], .0015), [0, .04 + i * .0125, .018]);
  add("metal", turned([[0, .128], [.0172, .128], [.0172, .19], [.0195, .196], [.0195, .205], [0, .205]], 28));
  add("metal", box([.022, .044, .012], .002), [0, .158, .019]);
  add("control", box([.008, .009, .005], .0015), [0, .168, .026], [0, 0, 0], new Color("#d5261b"));
  add("charcoal", box([.008, .009, .005], .0015), [0, .15, .026]);
  add("metal", turned([[0, .205], [.019, .205], [.021, .22], [.024, length - .012], [.022, length], [.012, length], [.012, length - .004], [0, length - .004]], 28));
  for (let i = 0; i < 3; i++) add("charcoal", box([.006, .03, .005], .0015), [0, length - .026, 0], [0, i * Math.PI * 2 / 3, 0]);
}

// ---- plinth ---------------------------------------------------------------------------------

export const PLINTH = { width: .74, top: .17 };

/** Collector plinth, square to the walls: a recessed kick, a lacquered body with
 * a brushed edge band, a tile top, a studded baseplate and a small engraved
 * plaque on the face toward the room's front. Authored in plinth space (y = 0 on
 * the floor) and carried into figure space so it shares the figure's finishes. */
function buildPlinth(figure: Figure) {
  const w = PLINTH.width;
  const toFigure = new Matrix4().makeRotationY(-TURN).multiply(new Matrix4().makeTranslation(0, -(PLINTH.top + .012), 0));
  const add = (finish: Finish, geometry: BufferGeometry, at: Vec3) => figure.add(finish, geometry, toFigure.clone().multiply(place(at)));
  add("charcoal", box([w - .06, .034, w - .06], .004), [0, .017, 0]);
  add("plinth", box([w, .116, w], .006, 3), [0, .092, 0]);
  add("metal", box([w + .004, .006, w + .004], .0018), [0, .153, 0]);
  add("plinth", box([w + .012, .014, w + .012], .004, 3), [0, .163, 0]);
  add("metal", box([.24, .058, .006], .002), [0, .088, w / 2 + .002]);
  add("plaque", plaqueFace(), [0, .088, w / 2 + .0052]);
  // Baseplate, studded except where the boots stand.
  add("plate", box([.62, .012, .62], .002), [0, PLINTH.top + .006, 0]);
  const stud = rod(.0092, .0068, 12);
  for (let i = 0; i < 20; i++) for (let j = 0; j < 20; j++) {
    const x = -.285 + i * .03, z = -.285 + j * .03;
    const lx = x * Math.cos(TURN) - z * Math.sin(TURN), lz = x * Math.sin(TURN) + z * Math.cos(TURN);
    if (Math.abs(lx) < .21 && lz > -.11 && lz < .2) continue;
    add("plate", stud.clone(), [x, PLINTH.top + .012 + .0034, z]);
  }
  stud.dispose();
}

function plaqueFace() {
  const geometry = box([.224, .044, .002], .0006, 1);
  // Front face only carries the engraving: project UVs across the plate.
  const position = geometry.getAttribute("position");
  const uv = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) { uv[i * 3] = position.getX(i) / .224 + .5; uv[i * 3 + 1] = position.getY(i) / .044 + .5; }
  geometry.setAttribute("seam", new Float32BufferAttribute(uv, 3));
  return geometry;
}

function plaqueTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024; canvas.height = 200;
  const g = canvas.getContext("2d")!;
  const shade = g.createLinearGradient(0, 0, 1024, 200);
  shade.addColorStop(0, "#15161a"); shade.addColorStop(.5, "#1d1e23"); shade.addColorStop(1, "#131418");
  g.fillStyle = shade; g.fillRect(0, 0, 1024, 200);
  g.strokeStyle = "#8d9197"; g.lineWidth = 3; g.strokeRect(14, 14, 996, 172);
  g.fillStyle = "#b9bdc2";
  g.font = "500 76px 'Helvetica Neue', Arial, sans-serif";
  g.textAlign = "center"; g.textBaseline = "middle";
  const letters = "DARTH VADER".split("").join(String.fromCharCode(8202));
  g.fillText(letters, 512, 92);
  g.font = "400 22px 'Helvetica Neue', Arial, sans-serif";
  g.fillStyle = "#7c8086";
  g.fillText("BRICK-BUILT DISPLAY SCULPTURE  ·  1 : 1", 512, 156);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

// ---- materials ------------------------------------------------------------------------------

export type FigureUniforms = {
  saberStart: { value: Vector3 };
  saberEnd: { value: Vector3 };
  saberGlow: { value: number };
  controlGlow: { value: number };
  keyDirection: { value: Vector3 };
  rimDirection: { value: Vector3 };
};

/** Figure-only shading after the standard material's own:
 *  - staggered brick joints drawn along each course from its perimeter coordinate;
 *  - red spill from the blade, by distance to the blade segment in figure space;
 *  - a display key light and a cool rim that only the sculpture receives, so gloss
 *    black reads in a dim corner and the helmet separates from the dark mural
 *    without a scene light every other surface would pay for. */
function withFigureShading(material: MeshStandardMaterial, uniforms: FigureUniforms, spill: number, key: number, rim: number, joints: number) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec3 seam;\nvarying vec3 vSeam;\nvarying vec3 vFigurePosition;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvSeam = seam;\nvFigurePosition = transformed;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vSeam;\nvarying vec3 vFigurePosition;\nuniform vec3 saberStart;\nuniform vec3 saberEnd;\nuniform float saberGlow;\nuniform vec3 keyDirection;\nuniform vec3 rimDirection;")
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
        float jointLine = 0.0;
        if (vSeam.y > 0.0) {
          float along = fract(vSeam.x / vSeam.y);
          float gapWidth = min(along, 1.0 - along) * vSeam.y;
          float blur = max(fwidth(vSeam.x) * .75, 1e-5);
          jointLine = (1.0 - smoothstep(.00045, .00045 + blur, gapWidth)) * ${joints.toFixed(3)};
        }
        jointLine = max(jointLine, smoothstep(.25, 1.0, vSeam.z) * .85);
        diffuseColor.rgb *= 1.0 - .55 * jointLine;
        roughnessFactor = mix(roughnessFactor, 1.0, jointLine * .7);`)
      .replace("#include <lights_physical_fragment>", "#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\nmaterial.clearcoat *= 1.0 - jointLine;\n#endif")
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        vec3 bladeAxis = saberEnd - saberStart;
        float bladeT = clamp(dot(vFigurePosition - saberStart, bladeAxis) / dot(bladeAxis, bladeAxis), 0.0, 1.0);
        float bladeGap = length(vFigurePosition - (saberStart + bladeAxis * bladeT));
        totalEmissiveRadiance += vec3(1.0, .07, .03) * ${spill.toFixed(3)} * saberGlow * exp(-bladeGap / .065) * (1.0 - jointLine * .5);
        vec3 viewDir = normalize(vViewPosition);
        vec3 keyL = normalize((viewMatrix * vec4(keyDirection, 0.0)).xyz);
        vec3 keyH = normalize(keyL + viewDir);
        float keyN = max(dot(normal, keyL), 0.0);
        float keySpec = pow(max(dot(normal, keyH), 0.0), mix(10.0, 180.0, 1.0 - roughnessFactor)) * (1.0 - roughnessFactor) * .6;
        totalEmissiveRadiance += ${key.toFixed(3)} * vec3(1.0, .96, .9) * (diffuseColor.rgb * keyN + keySpec * keyN) * (1.0 - jointLine * .6);
        vec3 rimL = normalize((viewMatrix * vec4(rimDirection, 0.0)).xyz);
        float rimEdge = pow(1.0 - clamp(dot(normal, viewDir), 0.0, 1.0), 2.6);
        totalEmissiveRadiance += ${rim.toFixed(3)} * vec3(.55, .66, 1.0) * rimEdge * max(dot(normal, rimL) * .7 + .3, 0.0) * mix(.35, 1.0, 1.0 - roughnessFactor);`);
  };
  material.customProgramCacheKey = () => `vader-figure-${spill}-${key}-${rim}-${joints}`;
}

/** The figure, hilt and plinth geometry, one merged geometry per finish. Pure
 * geometry, so it can be built in a worker (see vader.worker.ts). */
export function buildVaderParts(detail = 1) {
  const figure = buildFigure(detail);
  const hiltStart = RIGHT_FIST.clone().addScaledVector(SABER_AXIS, -SABER.hilt * .36);
  buildHilt(figure, hiltStart, SABER_AXIS);
  buildPlinth(figure);
  return figure.build();
}

export function createVaderKit({ detail = 1, parts = buildVaderParts(detail) }: { detail?: number; parts?: Map<Finish, BufferGeometry> } = {}) {
  const d = SABER_AXIS;
  const hiltEnd = RIGHT_FIST.clone().addScaledVector(d, SABER.hilt * .64);
  const bladeEnd = hiltEnd.clone().addScaledVector(d, SABER.blade);

  const uniforms: FigureUniforms = {
    saberStart: { value: hiltEnd.clone() },
    saberEnd: { value: bladeEnd.clone() },
    saberGlow: { value: 1 },
    controlGlow: { value: 1 },
    // Figure space: key from above, in front and to the figure's right of the
    // room; rim from behind and above on the side away from the wall.
    keyDirection: { value: new Vector3(Math.sin(.5), 1.5, Math.cos(.5)).normalize() },
    rimDirection: { value: new Vector3(.75, .55, -.55).normalize() },
  };
  const plaque = plaqueTexture();

  const physical = (color: string, roughness: number, clearcoat: number, clearcoatRoughness: number, envMapIntensity: number) =>
    new MeshPhysicalMaterial({ color, roughness, clearcoat, clearcoatRoughness, envMapIntensity });
  const materials: Record<Finish, MeshStandardMaterial> = {
    // Gloss armour: lacquered helmet, slightly softer body armour.
    helmet: physical("#0b0c0f", .2, 1, .05, 2.2),
    armour: physical("#101114", .26, .7, .1, 1.8),
    // Satin suit, dead-matte cape, glossy leather boots and gloves.
    suit: new MeshStandardMaterial({ color: "#1a1b1f", roughness: .52, envMapIntensity: 1 }),
    cape: new MeshStandardMaterial({ color: "#121316", roughness: .9, envMapIntensity: .45 }),
    leather: physical("#0e0f12", .34, .45, .22, 1.5),
    charcoal: new MeshStandardMaterial({ color: "#26282c", roughness: .56, envMapIntensity: .9 }),
    metal: new MeshStandardMaterial({ color: "#5d6269", roughness: .32, metalness: .9, envMapIntensity: 1.2 }),
    lens: physical("#070506", .05, 1, .02, 2.2),
    control: new MeshStandardMaterial({ color: "#ffffff", vertexColors: true, roughness: .3, envMapIntensity: .8 }),
    plinth: physical("#0c0d10", .32, .6, .14, 1.4),
    plate: new MeshStandardMaterial({ color: "#2c2f33", roughness: .42, envMapIntensity: .8 }),
    plaque: new MeshStandardMaterial({ map: plaque, roughness: .38, metalness: .35, envMapIntensity: 1 }),
  };
  const shading: [Finish, number, number, number, number][] = [
    // Spill stays small: on near-black finishes any red emission dominates.
    ["helmet", .04, 2.6, 1.0, .35], ["armour", .06, 2.2, .8, .4], ["suit", .07, 2.3, .45, .6], ["cape", .08, 2.2, .35, .45],
    ["leather", .025, 2.4, .7, .45], ["charcoal", .05, 2.4, .35, .5], ["metal", .012, 1.8, .45, .3], ["lens", 0, 2.4, .6, 0],
    ["plate", .12, 2.2, .2, 0], ["plinth", .1, 1.6, .3, 0],
  ];
  for (const [finish, spill, key, rim, joints] of shading) withFigureShading(materials[finish], uniforms, spill, key, rim, joints);
  // Controls glow from their own colour and pulse with the figure's breath.
  const control = materials.control;
  control.onBeforeCompile = (shader) => {
    shader.uniforms.controlGlow = uniforms.controlGlow;
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float controlGlow;")
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor.rgb * vColor.rgb * .45 * controlGlow;");
  };
  control.customProgramCacheKey = () => "vader-controls";
  // The plaque's UVs ride in the seam attribute.
  const plaqueMaterial = materials.plaque;
  plaqueMaterial.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec3 seam;")
      .replace("#include <uv_vertex>", "#include <uv_vertex>\nvMapUv = seam.xy;");
  };
  plaqueMaterial.customProgramCacheKey = () => "vader-plaque";

  const hiltTurn = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), d);
  return {
    parts, materials, uniforms,
    blade: { start: hiltEnd, end: bladeEnd, turn: hiltTurn },
    dispose() {
      parts.forEach((geometry) => geometry.dispose());
      Object.values(materials).forEach((material: Material) => material.dispose());
      plaque.dispose();
    },
  };
}
