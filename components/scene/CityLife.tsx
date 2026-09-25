import { useEffect, useMemo } from "react";
import { BoxGeometry, CylinderGeometry, Euler, MeshStandardMaterial, Quaternion } from "three";
import BrickInstances, { type BrickPart } from "./BrickInstances";
import { TABLETOP_Y } from "./districtLayout";
import { CIVIC_STREET, DISTRICTS, PROMENADE, SKILLS_YARD, type DistrictName } from "./cityMasterplan";
import { finishMaterials } from "./materialClasses";

/** The city's inhabitants: a couple of dozen minifigure-scale people, each part
 * of a small scene that says what its district is for, plus a bicycle and a
 * research cart. Everything is plain boxes and cylinders batched by finish, so
 * the whole population costs a handful of draw calls and takes no pointer
 * events. Placement is fixed: the same city on every visit. */

type V3 = [number, number, number];
type Finish = "skin" | "hair" | "navy" | "coat" | "hivis" | "green" | "red" | "tan" | "grey" | "denim" | "dark" | "rubber" | "metal" | "shell" | "bin" | "blue" | "yellow" | "leaf" | "blossom" | "wood";
type Pose = "stand" | "walk" | "sit" | "reach";
type Figure = { at: V3; facing: number; torso: Finish; legs: Finish; hat?: "helmet" | "hair"; pose?: Pose; holding?: "camera" | "box" | "tablet" | "book" | "paper" };

/** Ground levels in table units (cityInfrastructureGeometry). */
const WALK = .048, ROAD = .030, GROUND = .026, TURF = .034, PLAZA = .058;

/** A point given in a district's own units, placed through its anchor and turn. */
function inDistrict(name: DistrictName, x: number, y: number, z: number): V3 {
  const { at, turn, lift } = DISTRICTS[name];
  const t = turn * Math.PI / 180, c = Math.cos(t), s = Math.sin(t);
  return [at[0] + x * c + z * s, lift + y, at[1] - x * s + z * c];
}
const deg = (d: number) => d * Math.PI / 180;

const FIGURES: Figure[] = [
  // Projects: two engineers at the exhibition court, looking over the prototypes.
  { at: inDistrict("projects", -.34, .085, .85), facing: deg(160), torso: "coat", legs: "navy", hat: "hair", holding: "tablet", pose: "reach" },
  { at: inDistrict("projects", -.27, .085, .87), facing: deg(200), torso: "navy", legs: "grey", hat: "hair" },
  { at: inDistrict("projects", .9, .05, .85), facing: deg(-90), torso: "hivis", legs: "denim", hat: "helmet", holding: "box", pose: "reach" },
  // Experience: someone crossing the entry plaza to the lobby, another leaving.
  { at: inDistrict("experience", .05, .089, .36), facing: deg(180), torso: "navy", legs: "dark", hat: "hair", pose: "walk" },
  { at: inDistrict("experience", .32, .089, .48), facing: deg(20), torso: "red", legs: "grey", hat: "hair", pose: "walk" },
  // Research: a researcher at the western station, a colleague with notes.
  { at: inDistrict("research", -.76, .083, .34), facing: deg(90), torso: "coat", legs: "grey", hat: "hair", pose: "reach" },
  { at: inDistrict("research", -.86, .083, .22), facing: deg(60), torso: "coat", legs: "navy", hat: "hair", holding: "tablet", pose: "reach" },
  // A third, a little apart, reading a printed paper.
  { at: inDistrict("research", -.6, .083, .4), facing: deg(170), torso: "tan", legs: "dark", hat: "hair", holding: "paper", pose: "reach" },
  // Skills: a technician by the bays, a worker crossing the yard with stock.
  { at: inDistrict("skills", .32, .0785, .6), facing: deg(-110), torso: "hivis", legs: "denim", hat: "helmet" },
  { at: [SKILLS_YARD.x[0] + .62, GROUND, 2.2], facing: deg(90), torso: "hivis", legs: "grey", hat: "helmet", holding: "box", pose: "reach" },
  // About: someone reading on the garden bench.
  { at: inDistrict("about", 0, .103, .34), facing: deg(0), torso: "green", legs: "denim", hat: "hair", pose: "sit", holding: "book" },
  // Achievements: a visitor photographing the monument, a companion beside.
  { at: inDistrict("achievements", -.12, 0, .44), facing: deg(180), torso: "tan", legs: "denim", hat: "hair", holding: "camera", pose: "reach" },
  { at: inDistrict("achievements", -.02, 0, .46), facing: deg(190), torso: "red", legs: "dark", hat: "hair" },
  // Contact: a technician at the communications compound.
  { at: [5.43, GROUND, -2.1], facing: deg(90), torso: "hivis", legs: "navy", hat: "helmet", pose: "reach" },
  // The promenade: a couple walking, someone on a bench, a jogger.
  { at: [-1.62, WALK + .01, (PROMENADE.z[0] + PROMENADE.z[1]) / 2], facing: deg(90), torso: "navy", legs: "tan", hat: "hair", pose: "walk" },
  { at: [-1.53, WALK + .01, (PROMENADE.z[0] + PROMENADE.z[1]) / 2 + .03], facing: deg(90), torso: "red", legs: "dark", hat: "hair", pose: "walk" },
  { at: [-.1, WALK + .069, (PROMENADE.z[0] + PROMENADE.z[1]) / 2 - .01], facing: deg(180), torso: "grey", legs: "denim", hat: "hair", pose: "sit" },
  { at: [2.1, WALK + .01, (PROMENADE.z[0] + PROMENADE.z[1]) / 2], facing: deg(-90), torso: "green", legs: "dark", hat: "hair", pose: "walk" },
  // The park: two people by the fountain.
  { at: [.38, TURF + .008, 2.37], facing: deg(40), torso: "tan", legs: "navy", hat: "hair" },
  { at: [.46, TURF + .008, 2.33], facing: deg(-60), torso: "coat", legs: "dark", hat: "hair", pose: "reach", holding: "book" },
  // Boulevard sidewalks.
  { at: [-.2, WALK, -.82], facing: deg(90), torso: "denim", legs: "dark", hat: "hair", pose: "walk" },
  { at: [3.3, WALK, .14], facing: deg(-90), torso: "red", legs: "grey", hat: "hair", pose: "walk" },
  // Civic plaza benches.
  { at: [2.04, PLAZA + .069, .7], facing: deg(90), torso: "navy", legs: "tan", hat: "hair", pose: "sit" },
];

const PROMENADE_Z = (PROMENADE.z[0] + PROMENADE.z[1]) / 2;
/** Street furniture and yard equipment, chosen where each belongs: bins by the
 * promenade benches, a bike rack at the park, covers and drains in the
 * carriageways, a forklift and cable drums in the works yard, and a few
 * compact ornamental trees along the promenade. */
const BINS: [number, number][] = [-4.2, -.1, 3.6].map((x) => [x + .15, PROMENADE_Z]);
const BIKE_RACK: V3 = [-.12, TURF + .008, 2.06];
const COVERS: [number, number][] = [[-2.2, -.12], [1.9, -.58], [CIVIC_STREET.centre, 1.2], [2.72, -1.6], [-4.4, -.58]];
const DRAINS: [number, number][] = [[-3.6, .035], [-.6, -.735], [3.9, .035], [1.2, -.735]];
const FORKLIFT: { at: V3; facing: number } = { at: [4.05, GROUND, 2.62], facing: deg(-90) };
const SPOOLS: V3[] = [[4.6, GROUND, 2.86], [4.72, GROUND, 2.88]];
const ORNAMENTAL: { at: V3; bloom: boolean }[] = [[-3.0, false], [1.2, true], [4.7, false], [-5.2, true]].map(([x, bloom]) => ({ at: [x as number, WALK, PROMENADE_Z], bloom: bloom as boolean }));

/** A cyclist on the civic street, and the research institute's service cart. */
const BIKE: { at: V3; facing: number } = { at: [CIVIC_STREET.centre - .09, ROAD, 2.28], facing: deg(180) };
const CART: { at: V3; facing: number } = { at: inDistrict("research", .78, .083, .35), facing: deg(-90) };

function build() {
  const batches = new Map<string, { finish: Finish; stud: boolean; parts: BrickPart[] }>();
  const euler = new Euler(), quaternion = new Quaternion(), yx = new Euler(0, 0, 0, "YXZ");
  /** A part in an object's own frame (facing +z, standing at y = 0), placed at
   * `at` and turned about y by `facing`; `tilt` leans it about its own x axis. */
  const put = (finish: Finish, [ox, oy, oz]: V3, facing: number, [x, y, z]: V3, size: V3, tilt = 0, roll = 0, stud = false) => {
    const c = Math.cos(facing), s = Math.sin(facing);
    yx.set(tilt, facing, roll);
    quaternion.setFromEuler(yx);
    euler.setFromQuaternion(quaternion, "XYZ");
    const key = `${finish}-${stud}`;
    if (!batches.has(key)) batches.set(key, { finish, stud, parts: [] });
    batches.get(key)!.parts.push({ position: [ox + x * c + z * s, oy + y, oz - x * s + z * c], size, rotation: [euler.x, euler.y, euler.z] });
  };

  for (const f of FIGURES) {
    const p = (finish: Finish, at: V3, size: V3, tilt = 0, stud = false) => put(finish, f.at, f.facing, at, size, tilt, 0, stud);
    const pose = f.pose ?? "stand";
    const sit = pose === "sit";
    // Seated figures are placed by the seat's surface; the rest stand on the ground.
    const hip = sit ? .004 : .046;
    if (sit) {
      for (const x of [-.009, .009]) { p(f.legs, [x, .008, .017], [.016, .016, .034]); p(f.legs, [x, -.016, .032], [.016, .032, .016]); }
    } else {
      const swing = pose === "walk" ? .32 : 0;
      p(f.legs, [-.009, .022, 0], [.016, .044, .019], swing);
      p(f.legs, [.009, .022, 0], [.016, .044, .019], -swing);
    }
    p(f.legs, [0, hip, 0], [.036, .008, .021]);
    p(f.torso, [0, hip + .021, 0], [.034, .034, .02]);
    const forward = pose === "reach" || !!f.holding;
    for (const side of [-1, 1]) {
      const lift = forward ? -1.05 : pose === "walk" ? .3 * side : 0;
      p(f.torso, [side * .0225, hip + .02, forward ? .01 : 0], [.009, .028, .011], lift);
      p("skin", [side * .0225, forward ? hip + .022 : hip + .002, forward ? .028 : .002], [.008, .008, .008]);
    }
    p("skin", [0, hip + .049, 0], [.0105, .02, .0105], 0, true);
    if (f.hat === "helmet") p("hivis", [0, hip + .062, 0], [.0135, .009, .0135], 0, true);
    else if (f.hat === "hair") p("hair", [0, hip + .061, -.001], [.023, .008, .023]);
    const held: V3 = [0, hip + .024, .036];
    if (f.holding === "camera") { p("dark", [0, hip + .045, .03], [.018, .012, .01]); p("metal", [0, hip + .045, .037], [.006, .006, .006], Math.PI / 2, true); }
    if (f.holding === "box") p("tan", held, [.03, .026, .024]);
    if (f.holding === "tablet") p("dark", held, [.022, .016, .003], -.6);
    if (f.holding === "book") p("red", held, [.02, .004, .026], -.4);
    if (f.holding === "paper") { p("shell", [-.006, hip + .036, .034], [.022, .03, .002], -.25); p("shell", [.008, hip + .035, .036], [.022, .03, .002], -.3); }
  }

  // Bicycle and rider: two wheels, a frame, bars, and a figure on the saddle.
  {
    const b = (finish: Finish, at: V3, size: V3, tilt = 0, roll = 0, stud = false) => put(finish, BIKE.at, BIKE.facing, at, size, tilt, roll, stud);
    for (const z of [-.034, .034]) b("rubber", [0, .022, z], [.022, .006, .022], 0, Math.PI / 2, true);
    b("red", [0, .034, 0], [.004, .004, .07]);
    b("red", [0, .044, -.012], [.004, .024, .004], .3);
    b("metal", [0, .058, .03], [.026, .004, .004]);
    b("dark", [0, .054, -.02], [.012, .004, .02]);
    for (const x of [-.009, .009]) b("denim", [x, .046, -.01], [.016, .03, .016], .5);
    b("denim", [0, .062, -.018], [.036, .008, .021]);
    b("green", [0, .083, -.012], [.034, .034, .02], .35);
    for (const x of [-.0225, .0225]) b("green", [x, .084, .004], [.009, .03, .011], -1.1);
    b("skin", [0, .109, -.004], [.0105, .02, .0105], 0, 0, true);
    b("hivis", [0, .122, -.005], [.0135, .009, .0135], 0, 0, true);
  }
  // Street furniture and yard equipment.
  const at = (finish: Finish, [x, y, z]: V3, size: V3, roll = 0, stud = false, facing = 0) => put(finish, [x, y, z], facing, [0, 0, 0], size, 0, roll, stud);
  for (const [x, z] of BINS) for (const [dx, finish] of [[0, "bin"], [.04, "blue"]] as const) {
    at(finish, [x + dx, WALK + .023, z], [.03, .046, .03]);
    at("dark", [x + dx, WALK + .048, z], [.034, .005, .034]);
  }
  for (let i = 0; i < 3; i++) {
    const x = BIKE_RACK[0] + i * .045;
    for (const dz of [-.018, .018]) at("metal", [x, BIKE_RACK[1] + .02, BIKE_RACK[2] + dz], [.005, .04, .005]);
    at("metal", [x, BIKE_RACK[1] + .04, BIKE_RACK[2]], [.005, .005, .041]);
  }
  for (const [x, z] of COVERS) at("dark", [x, ROAD + .0015, z], [.024, .003, .024], 0, true);
  for (const [x, z] of DRAINS) at("metal", [x, ROAD + .0015, z], [.05, .003, .018]);
  {
    const f = (finish: Finish, p: V3, size: V3, roll = 0, stud = false) => put(finish, FORKLIFT.at, FORKLIFT.facing, p, size, 0, roll, stud);
    for (const x of [-.03, .03]) for (const z of [-.035, .035]) f("rubber", [x, .014, z], [.014, .01, .014], Math.PI / 2, true);
    f("yellow", [0, .03, 0], [.07, .03, .1]);
    f("dark", [0, .05, -.04], [.066, .03, .03]);
    f("dark", [0, .052, .006], [.03, .012, .03]);
    for (const x of [-.03, .03]) f("dark", [x, .085, -.02], [.004, .07, .004]);
    f("dark", [0, .12, .004], [.066, .004, .07]);
    for (const x of [-.022, .022]) { f("dark", [x, .07, .055], [.006, .1, .006]); f("metal", [x, .008, .09], [.01, .004, .07]); }
  }
  for (const [x, y, z] of SPOOLS) {
    for (const dx of [-.02, .02]) at("wood", [x + dx, y + .036, z], [.036, .008, .036], Math.PI / 2, true);
    at("dark", [x, y + .036, z], [.022, .04, .022], Math.PI / 2, true);
  }
  for (const { at: [x, y, z], bloom } of ORNAMENTAL) {
    at("wood", [x, y + .04, z], [.018, .08, .018]);
    for (const [h, r] of [[.085, .05], [.115, .042], [.14, .028]] as const) at(bloom ? "blossom" : "leaf", [x, y + h, z], [r, .03, r], 0, true);
  }

  // Research service cart: a small white electric cart with a canopy.
  {
    const c = (finish: Finish, at: V3, size: V3, stud = false) => put(finish, CART.at, CART.facing, at, size, 0, stud ? Math.PI / 2 : 0, stud);
    for (const x of [-.036, .036]) for (const z of [-.045, .045]) c("rubber", [x, .012, z], [.012, .008, .012], true);
    c("shell", [0, .026, 0], [.07, .022, .12]);
    c("dark", [0, .044, -.01], [.056, .014, .04]);
    for (const x of [-.03, .03]) c("metal", [x, .07, .022], [.004, .05, .004]);
    c("shell", [0, .097, .005], [.07, .006, .08]);
    c("coat", [0, .048, -.045], [.05, .03, .03]);
  }
  return [...batches.values()];
}

export default function CityLife() {
  const kit = useMemo(() => {
    const materials = finishMaterials({
      skin: new MeshStandardMaterial({ color: "#e3b53c" }),
      hair: new MeshStandardMaterial({ color: "#3a2a20" }),
      navy: new MeshStandardMaterial({ color: "#2c3f5c" }),
      coat: new MeshStandardMaterial({ color: "#e6e5df" }),
      hivis: new MeshStandardMaterial({ color: "#d77a2a" }),
      green: new MeshStandardMaterial({ color: "#4f6f4c" }),
      red: new MeshStandardMaterial({ color: "#9b3a33" }),
      tan: new MeshStandardMaterial({ color: "#b89d72" }),
      grey: new MeshStandardMaterial({ color: "#7d8284" }),
      denim: new MeshStandardMaterial({ color: "#48607c" }),
      dark: new MeshStandardMaterial({ color: "#23282b" }),
      rubber: new MeshStandardMaterial({ color: "#1c1e1f" }),
      metal: new MeshStandardMaterial({ color: "#8f969a" }),
      shell: new MeshStandardMaterial({ color: "#dcdcd4" }),
      bin: new MeshStandardMaterial({ color: "#35503f" }),
      blue: new MeshStandardMaterial({ color: "#35577a" }),
      yellow: new MeshStandardMaterial({ color: "#d9a93b" }),
      leaf: new MeshStandardMaterial({ color: "#4e6f4c" }),
      blossom: new MeshStandardMaterial({ color: "#c99297" }),
      wood: new MeshStandardMaterial({ color: "#826e50" }),
    }, { skin: "brick", hair: "brick", navy: "brick", coat: "brick", hivis: "brick", green: "brick", red: "brick", tan: "brick", grey: "brick", denim: "brick", dark: "brick", rubber: "rubber", metal: "paintedMetal", shell: "tile", bin: "brick", blue: "brick", yellow: "brick", leaf: "brick", blossom: "brick", wood: "brick" });
    return { box: new BoxGeometry(1, 1, 1), stud: new CylinderGeometry(1, 1, 1, 12), materials, batches: build() };
  }, []);
  useEffect(() => () => { kit.box.dispose(); kit.stud.dispose(); Object.values(kit.materials).forEach((material) => material.dispose()); }, [kit]);
  return (
    <group name="City life" position={[0, TABLETOP_Y, 0]}>
      {kit.batches.map((batch) => <BrickInstances key={`${batch.finish}-${batch.stud}`} parts={batch.parts} geometry={batch.stud ? kit.stud : kit.box} material={kit.materials[batch.finish]} />)}
    </group>
  );
}
