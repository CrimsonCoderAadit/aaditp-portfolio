import { CylinderGeometry, MeshStandardMaterial } from "three";
import { registerDetail } from "./brickGeometry/moldedEdges";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { finishMaterials } from "./materialClasses";
import type { BrickPart } from "./BrickInstances";
import {
  ABOUT_GARDEN, ABOUT_LANE, BLOCKS, CITY, BOULEVARD, CAMPUS_SERVICE, CIVIC_PLAZA, CIVIC_STREET, CONTACT_COMPOUND, CONTACT_DRIVE,
  CONTACT_PLAZA, DISTRICTS, EXPERIENCE_PLAZA, FOOTPRINTS, MARKET_STREET, MEDIAN, PARK, PROJECTS_COURTYARD, PROJECTS_FORECOURT,
  PROJECTS_YARD, PROMENADE, RESEARCH_COURT, RESEARCH_GREEN, SITE_PAD_TOP, SKILLS_APRON, SKILLS_YARD, WORKS_ROAD, edge,
  type DistrictName, type Street,
} from "./cityMasterplan";

type Finish =
  | "asphalt" | "mark" | "kerb" | "walk" | "plaza" | "ground" | "turf" | "water" | "bloom"
  | "metal" | "wood" | "leaf" | "sage" | "lamp" | "stop" | "go" | "hazard" | "carA" | "carB" | "carC" | "shell" | "glass";
type Batch = { finish: Finish; stud: boolean; parts: BrickPart[] };
type Rect = { x: [number, number]; z: [number, number] };

/** Surface levels above the tabletop. Block bases lie lowest, roads a plate up,
 * sidewalks another plate, the civic plaza above those; markings are thin tiles
 * laid on the road. No two surfaces that overlap share a top. */
const BASE = SITE_PAD_TOP - .001, ROAD = .030, MARK = .036, KERB = .054, WALK = .048, PLAZA_TOP = .058, GROUND = .026, TURF = .034;

/** The whole tabletop ground plane: streets, sidewalks, plazas, planting, parked
 * vehicles and yards, all built from discrete plates so the city reads as laid
 * brick rather than a printed board. Every coordinate comes from cityMasterplan,
 * so moving a district or a street moves the ground with it. */
export function createCityInfrastructureKit() {
  const brick = new RoundedBoxGeometry(1, 1, 1, 2, .025);
  // Lower tiers lay the ground with a one-step chamfer until a district is entered.
  registerDetail(brick, () => new RoundedBoxGeometry(1, 1, 1, 1, .025));
  const stud = new CylinderGeometry(.027, .029, .018, 12);
  const materials = {
    asphalt: new MeshStandardMaterial({ color: "#363c3e", roughness: .46 }),
    mark: new MeshStandardMaterial({ color: "#d6d2c2", roughness: .38 }),
    kerb: new MeshStandardMaterial({ color: "#8e948f", roughness: .40 }),
    walk: new MeshStandardMaterial({ color: "#a9ada3", roughness: .40 }),
    plaza: new MeshStandardMaterial({ color: "#c0bcad", roughness: .34 }),
    ground: new MeshStandardMaterial({ color: "#7c7b6e", roughness: .48 }),
    turf: new MeshStandardMaterial({ color: "#5b7155", roughness: .50 }),
    water: new MeshStandardMaterial({ color: "#4f7f95", roughness: .12, metalness: .1 }),
    bloom: new MeshStandardMaterial({ color: "#b36b5a", roughness: .45 }),
    metal: new MeshStandardMaterial({ color: "#303b3e", roughness: .34, metalness: .12 }),
    wood: new MeshStandardMaterial({ color: "#826e50", roughness: .42 }),
    leaf: new MeshStandardMaterial({ color: "#46654a", roughness: .40 }),
    sage: new MeshStandardMaterial({ color: "#74856a", roughness: .40 }),
    lamp: new MeshStandardMaterial({ color: "#e4d7b6", emissive: "#f0cd92", emissiveIntensity: .22 }),
    stop: new MeshStandardMaterial({ color: "#a23a2e", emissive: "#d2402c", emissiveIntensity: .35 }),
    go: new MeshStandardMaterial({ color: "#3d8a5a", emissive: "#46b872", emissiveIntensity: .35 }),
    hazard: new MeshStandardMaterial({ color: "#b0823c", roughness: .42 }),
    carA: new MeshStandardMaterial({ color: "#8a4b40", roughness: .34 }),
    carB: new MeshStandardMaterial({ color: "#4c6a7e", roughness: .34 }),
    carC: new MeshStandardMaterial({ color: "#c7a24a", roughness: .34 }),
    shell: new MeshStandardMaterial({ color: "#c2c4bc", roughness: .34 }),
    glass: new MeshStandardMaterial({ color: "#26343b", roughness: .18, metalness: .2 }),
  };

  const batches: Batch[] = [];
  const add = (finish: Finish, position: BrickPart["position"], size: BrickPart["size"], rotation?: BrickPart["rotation"], isStud = false) => {
    let batch = batches.find((b) => b.finish === finish && b.stud === isStud);
    if (!batch) { batch = { finish, stud: isStud, parts: [] }; batches.push(batch); }
    batch.parts.push(rotation ? { position, size, rotation } : { position, size });
  };
  /** A part given by its plan rectangle and the level it rises to. */
  const slab = (f: Finish, x: number, z: number, w: number, d: number, top: number, base = 0, turn = 0) =>
    add(f, [x, (top + base) / 2, z], [w, Math.max(top - base, .003), d], turn ? [0, turn, 0] : undefined);
  const box = (f: Finish, x: number, y: number, z: number, w: number, h: number, d: number, turn = 0) =>
    add(f, [x, y, z], [w, h, d], turn ? [0, turn, 0] : undefined);
  const knob = (f: Finish, x: number, y: number, z: number) => add(f, [x, y, z], [1, 1, 1], undefined, true);
  const rad = (deg: number) => deg * Math.PI / 180;

  /** Lay a rectangle as a grid of plates, optionally turned about its centre. */
  const paved = (f: Finish, x0: number, x1: number, z0: number, z1: number, top: number, base = 0, pitch = .30, deg = 0) => {
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    if (w <= .005 || d <= .005) return;
    const nx = Math.max(1, Math.round(w / pitch)), nz = Math.max(1, Math.round(d / pitch));
    const px = w / nx, pz = d / nz;
    const t = rad(deg), c = Math.cos(t), s = Math.sin(t);
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const lx = -w / 2 + (i + .5) * px, lz = -d / 2 + (j + .5) * pz;
      slab(f, cx + lx * c + lz * s, cz - lx * s + lz * c, px - .013, pz - .013, top, base, t);
    }
  };
  const area = (f: Finish, r: Rect, top: number, base = 0, pitch = .30) => paved(f, r.x[0], r.x[1], r.z[0], r.z[1], top, base, pitch);
  /** A raised kerb frame around a rectangle. */
  const rim = (r: Rect, top: number, w = .022) => {
    const cx = (r.x[0] + r.x[1]) / 2, cz = (r.z[0] + r.z[1]) / 2, lx = r.x[1] - r.x[0], lz = r.z[1] - r.z[0];
    for (const z of [r.z[0] + w / 2, r.z[1] - w / 2]) slab("kerb", cx, z, lx, w, top);
    for (const x of [r.x[0] + w / 2, r.x[1] - w / 2]) slab("kerb", x, cz, w, lz - 2 * w, top);
  };

  // ---- street geometry -----------------------------------------------------
  /** A street-relative band: along the street from `a` to `b`, across from `c0` to `c1`. */
  const band = (s: Street, f: Finish, a: number, b: number, c0: number, c1: number, top: number, base = 0, pitch = .30) => {
    if (b - a <= .005) return;
    if (s.axis === "x") paved(f, a, b, s.centre + c0, s.centre + c1, top, base, pitch);
    else paved(f, s.centre + c0, s.centre + c1, a, b, top, base, pitch);
  };
  const point = (s: Street, along: number, across: number): [number, number] => s.axis === "x" ? [along, s.centre + across] : [s.centre + across, along];
  /** A plan-space bar laid on a street: length along it, width across it. */
  const bar = (s: Street, f: Finish, along: number, across: number, length: number, width: number, top: number, base: number) => {
    const [x, z] = point(s, along, across);
    slab(f, x, z, s.axis === "x" ? length : width, s.axis === "x" ? width : length, top, base);
  };
  /** [from, to] minus the given gaps. */
  const spans = (from: number, to: number, gaps: [number, number][]) => {
    const out: [number, number][] = [];
    let at = from;
    for (const [lo, hi] of [...gaps].sort((p, q) => p[0] - q[0])) {
      if (hi <= at || lo >= to) continue;
      if (lo > at) out.push([at, lo]);
      at = Math.max(at, hi);
    }
    if (at < to) out.push([at, to]);
    return out;
  };

  const roadRun = (s: Street, a: number, b: number) => band(s, "asphalt", a, b, -s.road / 2, s.road / 2, ROAD, 0, .32);
  /** Curb plus walking surface on one side, over each of the given spans. */
  const kerbWalk = (s: Street, runs: [number, number][], side: 1 | -1) => {
    const kerbW = Math.min(.04, s.walk);
    for (const [a, b] of runs) {
      const inner = s.road / 2, lo = side > 0 ? inner : -inner - kerbW;
      band(s, "kerb", a, b, lo, lo + kerbW, KERB, 0, .28);
      if (s.walk - kerbW <= .02) continue;
      const w0 = side > 0 ? inner + kerbW : -s.road / 2 - s.walk, w1 = side > 0 ? inner + s.walk : -inner - kerbW;
      band(s, "walk", a, b, w0, w1, WALK, 0, .28);
    }
  };
  const dashes = (s: Street, a: number, b: number, across = 0, dash = .16) => {
    const n = Math.max(1, Math.floor((b - a) / (dash * 2.2)));
    const pitch = (b - a) / n;
    for (let i = 0; i < n; i++) bar(s, "mark", a + (i + .5) * pitch, across, dash, .02, MARK, ROAD);
  };
  /** Zebra crossing over the running surface of `s` at one point along it:
   * stripes parallel to the traffic, repeated across the road. */
  const zebra = (s: Street, along: number, depth = .11) => {
    const reach = s.road - .04, n = Math.floor(reach / .065);
    for (let i = 0; i < n; i++) bar(s, "mark", along, -reach / 2 + (i + .5) * (reach / n), depth, .032, MARK, ROAD);
  };
  const stopLine = (s: Street, along: number, side: 1 | -1) => bar(s, "mark", along, side * s.road / 4, .018, s.road / 2 - .03, MARK, ROAD);

  // ---- props -----------------------------------------------------------------
  const tree = (x: number, z: number, scale = 1, y = 0) => {
    box("wood", x, y + .105 * scale, z, .036, .21 * scale, .036);
    box("leaf", x, y + .265 * scale, z, .185 * scale, .11 * scale, .175 * scale);
    box("sage", x + .012, y + .352 * scale, z - .010, .135 * scale, .07 * scale, .128 * scale);
    box("leaf", x - .006, y + .412 * scale, z + .004, .082 * scale, .048 * scale, .088 * scale);
    knob("sage", x, y + .446 * scale, z);
  };
  /** Street tree in a square pit with a kerbed surround, standing on a walk. */
  const streetTree = (x: number, z: number, scale = .78) => {
    slab("kerb", x, z, .09, .09, WALK + .006, WALK - .004);
    slab("turf", x, z, .066, .066, WALK + .008, WALK);
    tree(x, z, scale, WALK - .01);
  };
  const planter = (x: number, z: number, w: number, d: number, deg = 0, y = 0) => {
    const t = rad(deg);
    box("kerb", x, y + .048, z, w, .078, d, t);
    box("wood", x, y + .090, z, w - .028, .016, d - .028, t);
    box("leaf", x, y + .122, z, w - .042, .058, d * .58, t);
    box("sage", x, y + .134, z + d * .22, w - .056, .050, d * .30, t);
    knob("sage", x, y + .156, z);
  };
  const lamp = (x: number, z: number, deg = 0, y = WALK) => {
    const t = rad(deg), dx = Math.sin(t) * .045, dz = Math.cos(t) * .045;
    box("kerb", x, y + .018, z, .05, .036, .05);
    box("metal", x, y + .157, z, .021, .24, .021);
    box("metal", x + dx, y + .278, z + dz, .075, .024, .075, t);
    box("lamp", x + dx, y + .262, z + dz, .055, .016, .046, t);
  };
  const bench = (x: number, z: number, deg = 0, y = WALK) => {
    const t = rad(deg), ax = Math.cos(t), az = -Math.sin(t);
    for (const o of [-.072, .072]) box("metal", x + Math.sin(t) * o, y + .024, z + Math.cos(t) * o, .070, .048, .024, t);
    box("wood", x, y + .058, z, .086, .022, .200, t);
    box("wood", x - ax * .042, y + .098, z - az * .042, .020, .06, .200, t);
  };
  const bollard = (x: number, z: number, y = WALK) => {
    box("metal", x, y + .027, z, .030, .054, .030);
    box("shell", x, y + .059, z, .034, .012, .034);
  };
  const utilityBox = (x: number, z: number, deg = 0, y = WALK) => {
    const t = rad(deg);
    box("metal", x, y + .059, z, .110, .118, .086, t);
    box("kerb", x, y + .124, z, .124, .012, .098, t);
    box("shell", x + Math.cos(t) * .057, y + .059, z - Math.sin(t) * .057, .006, .080, .058, t);
  };
  const sign = (x: number, z: number, deg = 0, face: Finish = "shell", y = WALK) => {
    box("metal", x, y + .088, z, .016, .175, .016);
    box(face, x, y + .182, z, .085, .085, .010, rad(deg));
  };
  /** Signal mast on a corner: a post, an arm reaching over the road and a
   * three-aspect head facing the approaching traffic. */
  const signal = (x: number, z: number, armX: number, armZ: number, deg: number) => {
    box("metal", x, WALK + .16, z, .022, .32, .022);
    const reach = Math.hypot(armX, armZ);
    box("metal", x + armX / 2, WALK + .31, z + armZ / 2, Math.abs(armX) > .001 ? reach : .016, .016, Math.abs(armZ) > .001 ? reach : .016);
    const hx = x + armX, hz = z + armZ, t = rad(deg);
    box("metal", hx, WALK + .26, hz, .036, .09, .03, t);
    box("stop", hx + Math.sin(t) * .017, WALK + .285, hz + Math.cos(t) * .017, .018, .018, .006, t);
    box("go", hx + Math.sin(t) * .017, WALK + .237, hz + Math.cos(t) * .017, .018, .018, .006, t);
  };
  const barrier = (x: number, z: number, deg = 0, y = GROUND) => {
    const t = rad(deg), ax = Math.cos(t), az = -Math.sin(t);
    for (const o of [-.085, .085]) box("metal", x + ax * o, y + .036, z + az * o, .020, .072, .046, t);
    box("hazard", x, y + .066, z, .210, .036, .018, t);
  };
  const fence = (x0: number, z0: number, x1: number, z1: number, y = GROUND) => {
    const length = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(length / .16)), t = Math.atan2(-(z1 - z0), x1 - x0);
    for (let i = 0; i <= n; i++) box("metal", x0 + (x1 - x0) * i / n, y + .06, z0 + (z1 - z0) * i / n, .014, .12, .014);
    const alongZ = Math.abs(x1 - x0) < 1e-6;
    for (const h of [.05, .11]) box("metal", (x0 + x1) / 2, y + h, (z0 + z1) / 2, alongZ ? .006 : length, .008, alongZ ? length : .006, alongZ ? 0 : t);
  };
  const crate = (x: number, z: number, y: number, deg = 0, f: Finish = "wood") => box(f, x, y + .03, z, .07, .06, .07, rad(deg));

  // ---- vehicles --------------------------------------------------------------
  const wheels = (x: number, z: number, t: number, lx: number, lz: number, y: number) => {
    for (const a of [-lx, lx]) for (const b of [-lz, lz]) {
      const wx = x + a * Math.cos(t) + b * Math.sin(t), wz = z - a * Math.sin(t) + b * Math.cos(t);
      box("metal", wx, y + .017, wz, .034, .034, .020, t);
    }
  };
  /** Local offset along the vehicle's length. */
  const ahead = (x: number, z: number, t: number, d: number): [number, number] => [x + Math.cos(t) * d, z - Math.sin(t) * d];
  const car = (x: number, z: number, deg: number, paint: "carA" | "carB" | "carC", y = ROAD) => {
    const t = rad(deg);
    wheels(x, z, t, .088, .050, y);
    box(paint, x, y + .045, z, .262, .046, .104, t);
    const [cx, cz] = ahead(x, z, t, -.012);
    box(paint, cx, y + .085, cz, .132, .038, .096, t);
    box("glass", cx, y + .088, cz, .122, .026, .100, t);
    box("shell", cx, y + .106, cz, .126, .006, .09, t);
    const [lx, lz] = ahead(x, z, t, .126);
    box("lamp", lx, y + .045, lz, .010, .016, .076, t);
  };
  const van = (x: number, z: number, deg: number, y = GROUND) => {
    const t = rad(deg);
    wheels(x, z, t, .104, .056, y);
    box("shell", x, y + .055, z, .310, .066, .118, t);
    const [bx, bz] = ahead(x, z, t, -.052);
    box("shell", bx, y + .121, bz, .206, .068, .112, t);
    const [fx, fz] = ahead(x, z, t, .118);
    box("glass", fx, y + .111, fz, .074, .048, .108, t);
    box("carB", fx, y + .139, fz, .074, .008, .112, t);
  };
  /** Box truck: cab, chassis and a tall cargo body. */
  const truck = (x: number, z: number, deg: number, y = GROUND) => {
    const t = rad(deg);
    wheels(x, z, t, .14, .06, y);
    const [ax, az] = ahead(x, z, t, .005);
    box("metal", ax, y + .045, az, .40, .03, .11, t);
    const [cx, cz] = ahead(x, z, t, .15);
    box("carC", cx, y + .1, cz, .1, .1, .12, t);
    const [gx, gz] = ahead(x, z, t, .197);
    box("glass", gx, y + .12, gz, .012, .045, .1, t);
    const [kx, kz] = ahead(x, z, t, -.05);
    box("shell", kx, y + .135, kz, .29, .15, .13, t);
    box("hazard", kx, y + .135, kz, .292, .016, .132, t);
  };
  /** Utility vehicle with a folded aerial platform, for the mast compound. */
  const bucketTruck = (x: number, z: number, deg: number, y = GROUND) => {
    const t = rad(deg);
    wheels(x, z, t, .12, .058, y);
    box("hazard", x, y + .055, z, .34, .05, .116, t);
    const [cx, cz] = ahead(x, z, t, .12);
    box("hazard", cx, y + .11, cz, .09, .07, .11, t);
    box("glass", cx + Math.cos(t) * .03, y + .115, cz - Math.sin(t) * .03, .035, .045, .1, t);
    const [bx, bz] = ahead(x, z, t, -.06);
    box("metal", bx, y + .105, bz, .05, .05, .05, t);
    const [rx, rz] = ahead(x, z, t, .02);
    box("metal", rx, y + .14, rz, .24, .016, .022, t);
    const [px, pz] = ahead(x, z, t, .14);
    box("shell", px, y + .165, pz, .05, .04, .07, t);
  };

  // ==========================================================================
  // BLOCK BASES — every block is laid edge to edge before anything stands on it.
  // ==========================================================================
  for (const block of BLOCKS) area(block.base, block.area, BASE, 0, .34);

  // ==========================================================================
  // BOULEVARD — through road for every junction on it.
  // ==========================================================================
  const B = BOULEVARD;
  const lane = (B.road - MEDIAN) / 2;
  roadRun(B, B.from, B.to);
  const crossGap = (s: Street): [number, number] => [s.centre - s.road / 2, s.centre + s.road / 2];
  const civicGap = crossGap(CIVIC_STREET), marketGap = crossGap(MARKET_STREET);
  const campusGap = crossGap(CAMPUS_SERVICE), worksGap = crossGap(WORKS_ROAD);
  kerbWalk(B, spans(B.from, B.to, [civicGap, marketGap, campusGap]), -1);
  kerbWalk(B, spans(B.from, B.to, [civicGap, marketGap, worksGap]), 1);

  // Planted median, broken for the crossings and the turn into each tee.
  const medianGaps: [number, number][] = [
    [CIVIC_STREET.centre - edge(CIVIC_STREET) - .12, CIVIC_STREET.centre + edge(CIVIC_STREET) + .12],
    [MARKET_STREET.centre - edge(MARKET_STREET) - .12, MARKET_STREET.centre + edge(MARKET_STREET) + .12],
    [campusGap[0] - .08, campusGap[1] + .08], [worksGap[0] - .08, worksGap[1] + .08],
  ];
  const medianRuns = spans(B.from + .1, B.to - .1, medianGaps);
  for (const [a, b] of medianRuns) {
    band(B, "kerb", a, b, -MEDIAN / 2, MEDIAN / 2, KERB - .008, ROAD, .3);
    band(B, "turf", a + .02, b - .02, -MEDIAN / 2 + .018, MEDIAN / 2 - .018, KERB - .002, KERB - .008, .3);
    for (let p = a + .32; p < b - .2; p += .62) {
      const [x, z] = point(B, p, 0);
      tree(x, z, .72, KERB - .012);
    }
  }
  // Lane lines on each carriageway, stopping short of every junction box.
  const laneOffset = MEDIAN / 2 + lane / 2;
  const blvdRuns = spans(B.from + .12, B.to - .12, medianGaps.map(([a, b]) => [a - .05, b + .05] as [number, number]));
  for (const [a, b] of blvdRuns) for (const side of [-1, 1]) dashes(B, a, b, side * laneOffset);
  // Solid edge line along the median on each carriageway.
  for (const [a, b] of medianRuns) for (const side of [-1, 1]) bar(B, "mark", (a + b) / 2, side * (MEDIAN / 2 + .02), b - a - .04, .012, MARK, ROAD);

  // ==========================================================================
  // SECONDARY STREETS — each crosses the boulevard at a signalised four-way.
  // ==========================================================================
  const blvdRoad: [number, number] = [B.centre - B.road / 2, B.centre + B.road / 2];
  const blvdCorridor: [number, number] = [B.centre - edge(B), B.centre + edge(B)];
  const laneRoad: [number, number] = [ABOUT_LANE.centre - ABOUT_LANE.road / 2, ABOUT_LANE.centre + ABOUT_LANE.road / 2];
  for (const s of [CIVIC_STREET, MARKET_STREET]) {
    for (const [a, b] of spans(s.from, s.to, [blvdRoad])) {
      roadRun(s, a, b);
    }
    for (const [a, b] of spans(s.from + .15, s.to - .15, [[blvdRoad[0] - .3, blvdRoad[1] + .3], ...(s === CIVIC_STREET ? [[laneRoad[0] - .22, laneRoad[1] + .22] as [number, number]] : [])])) dashes(s, a, b);
    const westGaps: [number, number][] = [blvdCorridor, ...(s === CIVIC_STREET ? [laneRoad] : [])];
    kerbWalk(s, spans(s.from, s.to, westGaps), -1);
    kerbWalk(s, spans(s.from, s.to, [blvdCorridor]), 1);
    // Zebras on all four legs, stop lines behind them, and the signals.
    for (const side of [-1, 1] as const) {
      zebra(s, B.centre + side * (B.road / 2 + B.walk / 2), B.walk - .02);
      stopLine(s, B.centre + side * (B.road / 2 + B.walk + .03), side > 0 ? -1 : 1);
      zebra(B, s.centre + side * (s.road / 2 + s.walk / 2 + .04), s.walk);
    }
    const cornerX = s.road / 2 + s.walk * .5, cornerZ = B.road / 2 + B.walk * .5;
    signal(s.centre - cornerX, B.centre - cornerZ, 0, .16, 0);
    signal(s.centre + cornerX, B.centre + cornerZ, 0, -.16, 180);
    signal(s.centre + cornerX, B.centre - cornerZ, -.14, 0, 90);
    signal(s.centre - cornerX, B.centre + cornerZ, .14, 0, -90);
    // End of the street at the front promenade: a raised table and bollards.
    band(s, "plaza", s.to - .1, s.to, -s.road / 2, s.road / 2, ROAD + .006, ROAD);
    for (const o of [-.12, 0, .12]) { const [x, z] = point(s, s.to - .05, o); bollard(x, z, ROAD); }
  }

  // ==========================================================================
  // TEES — the About lane off the civic street; two service roads off the boulevard.
  // ==========================================================================
  const L = ABOUT_LANE;
  const civicRoad: [number, number] = [CIVIC_STREET.centre - CIVIC_STREET.road / 2, CIVIC_STREET.centre + CIVIC_STREET.road / 2];
  roadRun(L, L.from, civicRoad[0]);
  for (const side of [-1, 1] as const) kerbWalk(L, [[L.from, CIVIC_STREET.centre - edge(CIVIC_STREET)]], side);
  dashes(L, L.from + .25, civicRoad[0] - .3, 0, .1);
  zebra(L, CIVIC_STREET.centre - CIVIC_STREET.road / 2 - CIVIC_STREET.walk / 2, CIVIC_STREET.walk - .02);
  zebra(CIVIC_STREET, L.centre - L.road / 2 - .09, .1);
  stopLine(L, civicRoad[0] - CIVIC_STREET.walk - .03, 1);
  { const [x, z] = point(L, civicRoad[0] - CIVIC_STREET.walk - .02, L.road / 2 + .05); sign(x, z, 90, "stop"); }
  // Turning head where the lane ends at the city's west edge.
  band(L, "plaza", L.from, L.from + .1, -L.road / 2, L.road / 2, ROAD + .006, ROAD);

  for (const s of [CAMPUS_SERVICE, WORKS_ROAD]) {
    const north = s === CAMPUS_SERVICE;
    roadRun(s, north ? s.from : blvdRoad[1], north ? blvdRoad[0] : s.to);
    const walkRun: [number, number] = north ? [s.from, blvdCorridor[0]] : [blvdCorridor[1], s.to];
    for (const side of [-1, 1] as const) kerbWalk(s, [walkRun], side);
    zebra(s, B.centre + (north ? -1 : 1) * (B.road / 2 + B.walk / 2), B.walk - .02);
    stopLine(s, B.centre + (north ? -1 : 1) * (B.road / 2 + B.walk + .03), north ? 1 : -1);
    const [x, z] = point(s, B.centre + (north ? -1 : 1) * (B.road / 2 + B.walk + .05), (north ? 1 : -1) * (s.road / 2 + .05));
    sign(x, z, north ? 180 : 0, "stop", GROUND);
    // Service roads end in a hard stand, not at the table edge.
    band(s, "ground", north ? s.from - .0 : s.to, north ? s.from + .12 : s.to + .08, -s.road / 2, s.road / 2, ROAD + .004, ROAD);
  }

  // ==========================================================================
  // FRONT PROMENADE — the pedestrian edge the streets terminate against.
  // ==========================================================================
  area("plaza", PROMENADE, WALK, 0, .30);
  slab("kerb", 0, PROMENADE.z[1] - .011, PROMENADE.x[1] - PROMENADE.x[0], .022, WALK + .006);
  for (const x of [-5.1, -3.2, -.4, 1.6, 4.3]) lamp(x, PROMENADE.z[0] + .1, 0);
  for (const x of [-4.2, -.1, 3.6]) bench(x, (PROMENADE.z[0] + PROMENADE.z[1]) / 2, 90);

  // ==========================================================================
  // STREET TREES AND LAMPS along the boulevard and the secondary streets.
  // ==========================================================================
  const nearJunction = (p: number, gaps: [number, number][], pad: number) => gaps.some(([a, b]) => p > a - pad && p < b + pad);
  const allBlvdGaps = [civicGap, marketGap, campusGap, worksGap];
  let n = 0;
  for (let p = B.from + .45; p < B.to - .3; p += .74) {
    if (nearJunction(p, allBlvdGaps, .42)) continue;
    for (const side of [-1, 1]) {
      const across = side * (B.road / 2 + B.walk * .62);
      const [x, z] = point(B, p, across);
      if (n % 3 === 1) lamp(x, z, side > 0 ? 180 : 0);
      else streetTree(x, z, .74);
    }
    n++;
  }
  for (const s of [CIVIC_STREET, MARKET_STREET]) {
    let k = 0;
    for (let p = s.from + .35; p < s.to - .3; p += .7) {
      if (nearJunction(p, [blvdCorridor, ...(s === CIVIC_STREET ? [laneRoad] : [])], .35)) continue;
      for (const side of [-1, 1]) {
        const [x, z] = point(s, p, side * (s.road / 2 + s.walk * .62));
        if ((k + (side > 0 ? 1 : 0)) % 2) lamp(x, z, side > 0 ? -90 : 90);
        else streetTree(x, z, .7);
      }
      k++;
    }
  }

  // ==========================================================================
  // PROJECTS — engineering campus: forecourt, rear courtyard, service yard.
  // ==========================================================================
  area("plaza", PROJECTS_FORECOURT, PLAZA_TOP - .006, 0, .28);
  for (let x = PROJECTS_FORECOURT.x[0] + .35; x < PROJECTS_FORECOURT.x[1] - .2; x += .7) bollard(x, PROJECTS_FORECOURT.z[1] - .05, PLAZA_TOP - .006);
  planter(-4.35, -1.02, .3, .1, 0, PLAZA_TOP - .06); planter(-2.02, -1.02, .3, .1, 0, PLAZA_TOP - .06);
  // Rear courtyard: lawn, a cross path and a pair of trees.
  area("turf", PROJECTS_COURTYARD, TURF);
  paved("walk", (PROJECTS_COURTYARD.x[0] + PROJECTS_COURTYARD.x[1]) / 2 - .07, (PROJECTS_COURTYARD.x[0] + PROJECTS_COURTYARD.x[1]) / 2 + .07, PROJECTS_COURTYARD.z[0], PROJECTS_COURTYARD.z[1], TURF + .008, TURF, .2);
  tree(-4.25, -3.2, .8, TURF - .01); tree(-2.1, -3.2, .86, TURF - .01);
  bench(-3.55, -3.22, 0, TURF); bench(-2.8, -3.22, 0, TURF);
  // Service yard off the campus road: marked bays and a van at the loading door.
  area("ground", PROJECTS_YARD, GROUND, 0, .26);
  for (let z = PROJECTS_YARD.z[0] + .35; z < PROJECTS_YARD.z[1] - .1; z += .4) slab("mark", (PROJECTS_YARD.x[0] + PROJECTS_YARD.x[1]) / 2, z, PROJECTS_YARD.x[1] - PROJECTS_YARD.x[0] - .06, .014, GROUND + .005, GROUND);
  van((PROJECTS_YARD.x[0] + PROJECTS_YARD.x[1]) / 2, -2.35, 90);
  for (const z of [-3.1, -1.25]) utilityBox(PROJECTS_YARD.x[1] - .07, z, 90, GROUND);
  for (let z = -3.2; z < -1.2; z += .5) tree(-5.63, z, .8, BASE);

  // ==========================================================================
  // EXPERIENCE — commercial block: entry plaza on the boulevard, trees either side.
  // ==========================================================================
  area("plaza", EXPERIENCE_PLAZA, PLAZA_TOP - .006, 0, .28);
  rim(EXPERIENCE_PLAZA, PLAZA_TOP);
  for (const x of [-.35, 1.59]) { planter(x, -1.25, .16, .3, 0, PLAZA_TOP - .06); }
  for (const x of [.1, .62, 1.14]) bollard(x, EXPERIENCE_PLAZA.z[1] - .05, PLAZA_TOP - .006);
  // Flagpoles either side of the entrance.
  for (const x of [.2, 1.04]) { box("metal", x, PLAZA_TOP + .2, -1.46, .012, .4, .012); box("carB", x + .04, PLAZA_TOP + .36, -1.46, .07, .045, .004); }
  paved("walk", CIVIC_STREET.centre + edge(CIVIC_STREET) + .04, -.52, -3.4, -1.56, WALK, 0, .26);
  for (const z of [-3.0, -2.35, -1.75]) tree(-.73, z, .82, WALK - .01);
  paved("turf", 1.74, MARKET_STREET.centre - edge(MARKET_STREET) - .04, -3.4, -1.56, TURF, 0, .26);
  for (const z of [-3.1, -2.5, -1.9]) tree(2.06, z, .9, TURF - .01);
  bench(1.9, -2.2, 90, TURF);

  // ==========================================================================
  // CONTACT — the mast's urban block: entrance plaza, compound, rear drive.
  // ==========================================================================
  area("plaza", CONTACT_PLAZA, PLAZA_TOP - .006, 0, .28);
  rim(CONTACT_PLAZA, PLAZA_TOP);
  for (const x of [3.55, 4.55]) planter(x, -1.12, .22, .12, 0, PLAZA_TOP - .06);
  for (const x of [3.8, 4.05, 4.3]) bollard(x, CONTACT_PLAZA.z[1] - .05, PLAZA_TOP - .006);
  // Technical compound: fenced hard standing, equipment cabins, panel antennas.
  area("ground", CONTACT_COMPOUND, GROUND, 0, .26);
  const cc = CONTACT_COMPOUND;
  fence(cc.x[0], cc.z[0], cc.x[1], cc.z[0]); fence(cc.x[1], cc.z[0], cc.x[1], cc.z[1]); fence(cc.x[0], cc.z[1], cc.x[1], cc.z[1]);
  fence(cc.x[0], cc.z[0], cc.x[0], cc.z[0] + .55);
  for (const [z, h] of [[-3.1, .12], [-2.75, .1]] as const) {
    box("shell", 5.45, GROUND + h / 2, z, .36, h, .22);
    box("metal", 5.45, GROUND + h + .006, z, .38, .012, .24);
    box("metal", 5.63, GROUND + h / 2, z, .01, h * .7, .08);
  }
  for (const [z, deg] of [[-2.25, 25], [-1.9, -20]] as const) {
    box("metal", 5.25, GROUND + .09, z, .02, .18, .02);
    box("shell", 5.25, GROUND + .2, z, .12, .12, .02, rad(deg));
    box("metal", 5.25, GROUND + .2, z, .03, .03, .04, rad(deg));
  }
  utilityBox(5.55, -2.1, 90, GROUND);
  bucketTruck(5.4, -2.45, 90);
  // Rear drive from the market street to the compound gate.
  area("ground", CONTACT_DRIVE, GROUND, 0, .26);
  for (let x = CONTACT_DRIVE.x[0] + .2; x < CONTACT_DRIVE.x[1] - .1; x += .3) slab("hazard", x, (CONTACT_DRIVE.z[0] + CONTACT_DRIVE.z[1]) / 2, .12, .016, GROUND + .004, GROUND);
  barrier(4.95, -3.0, 90);
  const contact = DISTRICTS.contact.at;
  for (const [dx, dz] of [[-.72, -.72], [.72, -.72]]) slab("metal", contact[0] + dx, contact[1] + dz, .08, .08, GROUND + .004, BASE);

  // ==========================================================================
  // RESEARCH — raised institute on a lawn: science court, green buffer, paths.
  // ==========================================================================
  area("turf", RESEARCH_COURT, TURF, 0, .26);
  const rc = RESEARCH_COURT, rcx = (rc.x[0] + rc.x[1]) / 2, rcz = (rc.z[0] + rc.z[1]) / 2;
  paved("walk", rc.x[0] + .05, rc.x[1] - .05, rcz - .06, rcz + .06, TURF + .008, TURF, .22);
  paved("walk", rcx - .06, rcx + .06, rc.z[0] + .02, rc.z[1] - .02, TURF + .008, TURF, .22);
  // A small instrument at the crossing: a plinth and an armillary of bars.
  box("kerb", rcx, TURF + .03, rcz, .12, .044, .12);
  for (const deg of [0, 60, 120]) box("hazard", rcx, TURF + .13, rcz, .15, .012, .012, rad(deg));
  box("metal", rcx, TURF + .12, rcz, .012, .16, .012);
  tree(rc.x[0] + .16, rc.z[0] + .2, .78, TURF - .01); tree(rc.x[0] + .16, rc.z[1] - .2, .86, TURF - .01);
  tree(rc.x[1] - .16, rc.z[1] - .2, .74, TURF - .01);
  area("turf", RESEARCH_GREEN, TURF, 0, .26);
  paved("walk", RESEARCH_GREEN.x[0] + .1, RESEARCH_GREEN.x[1] - .1, 1.12, 1.24, TURF + .008, TURF, .22);
  for (const [x, z] of [[-2.35, .5], [-1.85, .55], [-2.1, 1.45], [-1.8, 1.45]]) tree(x, z, .8, TURF - .01);
  // Buffer lawn between the boulevard and the institute, with its approach path.
  paved("turf", -4.84, -2.66, B.centre + edge(B) + .04, .42, TURF, 0, .26);
  paved("walk", -3.84, -3.62, B.centre + edge(B) + .04, .42, TURF + .008, TURF, .22);

  // ==========================================================================
  // ABOUT — a quiet neighbourhood on its own lane: front lawn, garden, path.
  // ==========================================================================
  paved("turf", -5.74, -3.36, L.centre + edge(L) + .03, 2.12, TURF, 0, .22);
  paved("walk", -4.16, -3.98, L.centre + edge(L) + .03, 2.12, TURF + .008, TURF, .18);
  paved("turf", CITY.x[0] + .04, -5.08, 2.12, PROMENADE.z[0] - .04, TURF, 0, .22);
  area("turf", ABOUT_GARDEN, TURF, 0, .24);
  const ag = ABOUT_GARDEN;
  paved("walk", ag.x[0] + .04, ag.x[1] - .04, 2.5, 2.6, TURF + .008, TURF, .2);
  for (let i = 0; i < 4; i++) paved("wood", ag.x[0] + .12 + i * .25, ag.x[0] + .3 + i * .25, 2.72, 2.9, TURF + .02, TURF, .2);
  for (let i = 0; i < 4; i++) box("leaf", ag.x[0] + .21 + i * .25, TURF + .045, 2.81, .14, .04, .14);
  tree(ag.x[1] - .2, 2.3, .88, TURF - .01); tree(ag.x[0] + .18, 2.3, .74, TURF - .01);
  bench(ag.x[1] - .5, 2.33, 180, TURF);
  // Hedge line along the lane.
  for (let x = -3.28; x < -1.9; x += .18) box("leaf", x, TURF + .04, L.centre + edge(L) + .06, .16, .07, .06);
  car(-5.0, L.centre - L.road / 4, 0, "carC");

  // ==========================================================================
  // CIVIC PLAZA — Achievements on open paving; the boulevard passes its head.
  // ==========================================================================
  area("plaza", CIVIC_PLAZA, PLAZA_TOP, 0, .28);
  rim(CIVIC_PLAZA, PLAZA_TOP + .004);
  const cp = CIVIC_PLAZA, cpx = DISTRICTS.achievements.at[0];
  // Award walk: paired markers stepping south from the monument to the park.
  for (let i = 0; i < 3; i++) for (const o of [-.3, .3]) slab("mark", cpx + o, 1.6 + i * .082, .052, .040, PLAZA_TOP + .008, PLAZA_TOP);
  for (const [x, z] of [[cp.x[0] + .06, cp.z[0] + .06], [cp.x[1] - .06, cp.z[0] + .06], [cp.x[0] + .06, cp.z[1] - .06], [cp.x[1] - .06, cp.z[1] - .06]]) bollard(x, z, PLAZA_TOP);
  for (const x of [cp.x[0] + .33, cp.x[1] - .33]) { lamp(x, 1.1, x < cpx ? 90 : -90, PLAZA_TOP); bench(x, .7, 0, PLAZA_TOP); bench(x, 1.5, 0, PLAZA_TOP); }
  // Double rows of trees down both flanks frame the monument from the boulevard.
  for (const x of [cp.x[0] + .16, cp.x[0] + .5, cp.x[1] - .5, cp.x[1] - .16]) for (const z of [.55, 1.05, 1.55]) {
    slab("kerb", x, z, .1, .1, PLAZA_TOP + .006, PLAZA_TOP - .004);
    slab("turf", x, z, .074, .074, PLAZA_TOP + .008, PLAZA_TOP);
    tree(x, z, .8, PLAZA_TOP - .002);
  }
  // Reflecting pool on the axis between the monument and the park.
  slab("kerb", cpx, 1.73, .5, .36, PLAZA_TOP + .026, PLAZA_TOP);
  slab("water", cpx, 1.73, .44, .3, PLAZA_TOP + .02, PLAZA_TOP + .006);
  slab("kerb", cpx, .3, .9, .06, PLAZA_TOP + .02, PLAZA_TOP);

  // ==========================================================================
  // CITY PARK — lawns, a loop of paths, a fountain, benches and a stand of trees.
  // ==========================================================================
  area("turf", PARK, TURF, 0, .26);
  const pk = PARK, px = (pk.x[0] + pk.x[1]) / 2, pz = (pk.z[0] + pk.z[1]) / 2;
  const pathTop = TURF + .008;
  paved("walk", pk.x[0] + .02, pk.x[1] - .02, pz - .055, pz + .055, pathTop, TURF, .22);
  paved("walk", px - .055, px + .055, pk.z[0] + .02, pk.z[1] - .02, pathTop, TURF, .2);
  for (const side of [-1, 1]) paved("walk", px + side * .95 - .05, px + side * .95 + .05, pk.z[0] + .02, pk.z[1] - .02, pathTop, TURF, .2);
  // Fountain: a round-cornered basin, water and a two-tier centre.
  slab("kerb", px, pz, .36, .36, TURF + .05, TURF);
  slab("water", px, pz, .3, .3, TURF + .044, TURF + .02);
  box("kerb", px, TURF + .07, pz, .08, .06, .08);
  box("water", px, TURF + .11, pz, .05, .03, .05);
  box("kerb", px, TURF + .135, pz, .03, .03, .03);
  for (const [dx, dz, s] of [[-1.35, -.3, .92], [-1.25, .32, .82], [-.55, -.34, 1], [-.5, .34, .86], [.52, -.33, .9], [.6, .33, 1.02], [1.3, -.3, .84], [1.38, .3, .94]] as const) tree(px + dx, pz + dz, s, TURF - .01);
  for (const [dx, dz, deg] of [[-.3, -.14, 0], [.3, .14, 180], [-1.2, .07, 90], [1.2, -.07, -90]] as const) bench(px + dx, pz + dz, deg, pathTop);
  for (const dx of [-.72, .72]) {
    slab("kerb", px + dx, pz + .32, .3, .12, TURF + .03, TURF);
    slab("bloom", px + dx, pz + .32, .26, .08, TURF + .038, TURF + .03);
  }
  for (const dx of [-.95, .95]) lamp(px + dx + .08, pz + .08, 0, pathTop);

  // ==========================================================================
  // SKILLS — works block: loading apron, technical yard and an industrial edge.
  // ==========================================================================
  area("ground", SKILLS_APRON, GROUND, 0, .26);
  for (let x = SKILLS_APRON.x[0] + .12; x < SKILLS_APRON.x[1] - .05; x += .16) slab("hazard", x, SKILLS_APRON.z[1] - .03, .08, .02, GROUND + .004, GROUND);
  area("ground", SKILLS_YARD, GROUND, 0, .26);
  const sy = SKILLS_YARD;
  for (const x of [sy.x[0] + .5, sy.x[0] + 1.0]) slab("mark", x, (sy.z[0] + sy.z[1]) / 2, .014, sy.z[1] - sy.z[0] - .1, GROUND + .005, GROUND);
  truck(sy.x[0] + .26, 2.4, 90);
  // Stacked stock on pallets, a skip and a tool container along the back.
  for (const [x, z] of [[4.3, 2.0], [4.52, 2.0], [4.3, 2.22]] as const) {
    slab("wood", x, z, .16, .16, GROUND + .015, GROUND);
    for (const [dx, dz] of [[-.04, -.04], [.04, -.04], [-.04, .04], [.04, .04]] as const) crate(x + dx, z + dz, GROUND + .015, 0, dx > 0 ? "wood" : "kerb");
  }
  box("hazard", 4.95, GROUND + .045, 2.1, .2, .09, .12);
  box("metal", 4.9, GROUND + .075, 2.6, .34, .15, .16);
  box("shell", 4.9, GROUND + .155, 2.6, .35, .01, .17);
  fence(sy.x[0], sy.z[1] - .02, sy.x[1], sy.z[1] - .02);
  fence(WORKS_ROAD.centre + edge(WORKS_ROAD) + .06, B.centre + edge(B) + .05, WORKS_ROAD.centre + edge(WORKS_ROAD) + .06, PROMENADE.z[0] - .05);
  for (let z = .6; z < 2.9; z += .45) tree(5.73, z, .7, BASE);
  utilityBox(sy.x[1] - .1, 1.92, 90, GROUND);

  // ==========================================================================
  // RAISED PLATFORMS and SITE PADS under the districts.
  // ==========================================================================
  const footprintBox = (name: DistrictName, lip: number) => {
    const foot = FOOTPRINTS[name], { at, turn } = DISTRICTS[name];
    const t = rad(turn), c = Math.cos(t), s = Math.sin(t);
    const cx = (foot.x[0] + foot.x[1]) / 2, cz = (foot.z[0] + foot.z[1]) / 2;
    return { x: at[0] + cx * c + cz * s, z: at[1] - cx * s + cz * c, w: foot.x[1] - foot.x[0] + lip * 2, d: foot.z[1] - foot.z[0] + lip * 2, turn };
  };
  const platform = (name: DistrictName, lip: number, top: number, f: Finish) => {
    const p = footprintBox(name, lip);
    paved(f, p.x - p.w / 2, p.x + p.w / 2, p.z - p.d / 2, p.z + p.d / 2, top, 0, .34, p.turn);
  };
  platform("research", .055, DISTRICTS.research.lift, "walk");
  platform("about", .050, DISTRICTS.about.lift, "walk");
  // Steps up onto the Research platform from its approach path.
  slab("kerb", -3.73, .47, .3, .05, DISTRICTS.research.lift * .6);
  // Contact stands in its own paved apron; Skills on a slab a plate proud of its yard.
  platform("contact", .1, GROUND + .004, "plaza");
  platform("skills", .06, GROUND + .004, "ground");

  // ==========================================================================
  // VEHICLES ON THE STREETS — a few parked and waiting, none moving.
  // ==========================================================================
  car(-3.1, B.centre + MEDIAN / 2 + lane * .75, 180, "carA");
  car(1.35, B.centre - MEDIAN / 2 - lane * .25, 0, "carB");
  car(CIVIC_STREET.centre + CIVIC_STREET.road / 4, -2.6, 90, "carC");
  car(MARKET_STREET.centre - MARKET_STREET.road / 4, 1.1, -90, "carA");

  finishMaterials(materials, {
    asphalt: "tile", mark: "tile", kerb: "tile", walk: "tile", plaza: "tile", ground: "rubber", water: "tile", bloom: "brick",
    turf: "brick", metal: "paintedMetal", wood: "brick", leaf: "brick", sage: "brick", lamp: "indicator", stop: "indicator", go: "indicator",
    hazard: "paintedMetal", carA: "brick", carB: "brick", carC: "brick", shell: "tile", glass: "tile",
  });
  return { brick, stud, materials, batches };
}

