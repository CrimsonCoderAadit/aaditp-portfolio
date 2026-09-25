import { CylinderGeometry, DoubleSide, Euler, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3 } from "three";
import { createMoldedBoxGeometry } from "./brickGeometry/moldedEdges";
import { CITY_NEUTRALS } from "./cityPalette";
import { finishMaterials, translucentPlastic } from "./materialClasses";
import type { BrickPart } from "./BrickInstances";
import { createDetails, type Role } from "./cityDetails";
import { upgradeContact } from "./districtUpgrades";

type Finish = "charcoal" | "graphite" | "offwhite" | "window" | "signal" | "silver" | "red";
type Form = "brick" | "stud";
type Batch = { finish: Finish; form: Form; parts: BrickPart[] };

/** Crown dish mount, district-local; the dish group turns about it on hover. */
export const DISH_MOUNT: [number, number, number] = [.19, 2.02, .17];
/** Beacon tip at the top of the spire. */
export const BEACON_Y = 2.6;
/** Hover volume covering the whole tower, crown included. */
export const CONTACT_HIT = { centre: [0, 1.2, 0] as [number, number, number], size: [.86, 2.4, .86] as [number, number, number] };

/** A brick-built communications skyscraper. The mass changes character as it
 * rises: a glazed podium with the entrance and service door, solid banded
 * lower floors, a set-back mid tower of alternating glass and graphite floors
 * wearing external X-bracing, an open-frame technical top, then a braced crown
 * with antenna decks, dishes, a spire and the red beacon. Graphite, off-white
 * and icy glass throughout; red only for the beacon and a few indicators. */
export function createContactKit() {
  const brick = createMoldedBoxGeometry();
  const stud = new CylinderGeometry(.046, .049, .028, 16);
  const dish = new SphereGeometry(.1, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2.4);
  const geometryFor = { brick, stud };
  const materials = {
    charcoal: new MeshStandardMaterial({ color: CITY_NEUTRALS.charcoal, roughness: .36 }),
    graphite: new MeshStandardMaterial({ color: "#454d52", roughness: .38 }),
    offwhite: new MeshStandardMaterial({ color: CITY_NEUTRALS.offWhite, roughness: .31 }),
    window: new MeshStandardMaterial({ color: "#2f3a42", emissive: "#cfe2ea", emissiveIntensity: .05 }),
    signal: translucentPlastic("#9fd3dc", .62),
    silver: new MeshStandardMaterial({ color: CITY_NEUTRALS.architectural, roughness: .3, metalness: .2 }),
    red: new MeshStandardMaterial({ color: "#a83a3f", emissive: "#d2323a", emissiveIntensity: .05 }),
  };
  const batches: Batch[] = [];
  const add = (finish: Finish, position: BrickPart["position"], size: BrickPart["size"], form: Form = "brick", rotation?: BrickPart["rotation"]) => {
    let batch = batches.find((b) => b.finish === finish && b.form === form);
    if (!batch) { batch = { finish, form, parts: [] }; batches.push(batch); }
    batch.parts.push({ position, size, rotation });
  };
  const block = (finish: Finish, x: number, y: number, z: number, w: number, h: number, d: number) => add(finish, [x, y, z], [w, h, d]);
  const knob = (finish: Finish, x: number, y: number, z: number) => add(finish, [x, y, z], [1, 1, 1], "stud");
  // A rigid strut between two points, oriented by an actual rotation.
  const strut = (finish: Finish, from: [number, number, number], to: [number, number, number], thickness: number) => {
    const a = new Vector3(...from), b = new Vector3(...to);
    const mid = a.clone().add(b).multiplyScalar(.5);
    const dir = b.clone().sub(a);
    const length = dir.length();
    const euler = new Euler().setFromQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir.normalize()));
    add(finish, [mid.x, mid.y, mid.z], [thickness, length, thickness], "brick", [euler.x, euler.y, euler.z]);
  };
  /** Four faces of a rectangular plan: calls back with the face centre offset,
   * its width and whether it runs along X. */
  const faces = (w: number, d: number, cz: number, each: (x: number, z: number, span: number, alongX: boolean, out: [number, number]) => void) => {
    each(0, cz + d / 2, w, true, [0, 1]);
    each(0, cz - d / 2, w, true, [0, -1]);
    each(w / 2, cz, d, false, [1, 0]);
    each(-w / 2, cz, d, false, [-1, 0]);
  };

  // ---- podium: communications lobby -------------------------------------------------
  const PZ = -.03;
  block("charcoal", 0, .02, PZ, .92, .04, .84);
  block("charcoal", 0, .12, PZ - .04, .74, .16, .66);
  // Glazed lobby on three sides, off-white mullions every stud.
  faces(.8, .74, PZ, (x, z, span, alongX, [ox, oz]) => {
    if (oz < 0) return;
    const w = alongX ? span : .02, d = alongX ? .02 : span;
    add("signal", [x, .12, z], [w, .15, d]);
    for (let i = 0; i <= Math.round(span / .15); i++) {
      const o = -span / 2 + i * (span / Math.round(span / .15));
      block("offwhite", alongX ? o : x + ox * .006, .12, alongX ? z + oz * .006 : PZ + o, .022, .16, .022);
    }
  });
  // Upper podium floor: an off-white band with dark window slots.
  block("offwhite", 0, .245, PZ, .86, .09, .8);
  faces(.86, .8, PZ, (x, z, span, alongX, [ox, oz]) => {
    for (let i = 0; i < 5; i++) {
      const o = -span / 2 + (i + .5) * span / 5;
      add("window", [alongX ? o : x + ox * .004, .245, alongX ? z + oz * .004 : PZ + o], alongX ? [span / 5 - .05, .045, .012] : [.012, .045, span / 5 - .05]);
    }
  });
  block("graphite", 0, .305, PZ, .9, .03, .84);
  // Terrace studs where the tower sets back from the podium roof.
  for (const [x, z] of [[-.36, .3], [-.21, .3], [.21, .3], [.36, .3], [-.36, -.36], [.36, -.36]]) knob("offwhite", x, .334, z);
  // Entrance canopy with the sign fascia, and a service door facing the lane.
  block("offwhite", 0, .215, .43, .4, .024, .14);
  block("graphite", 0, .245, .495, .36, .05, .018);
  block("charcoal", 0, .1, .352, .16, .12, .012);
  block("graphite", -.466, .09, -.1, .012, .13, .22);
  for (let i = 0; i < 4; i++) block("silver", -.472, .04 + i * .03, -.1, .004, .006, .2);
  block("red", -.472, .17, .03, .01, .012, .012);

  // ---- lower tower: solid technical floors --------------------------------------------
  const LW = .56, LD = .5, LZ = -.05, L0 = .32, LFLOOR = .1, LCOUNT = 8;
  block("charcoal", 0, L0 + LFLOOR * LCOUNT / 2, LZ, LW - .04, LFLOOR * LCOUNT, LD - .04);
  for (let f = 0; f < LCOUNT; f++) {
    const y = L0 + f * LFLOOR;
    faces(LW, LD, LZ, (x, z, span, alongX, [ox, oz]) => {
      const at = (o: number, depth: number): [number, number, number] => [alongX ? o : x + ox * depth, 0, alongX ? z + oz * depth : LZ + o];
      const [sx, , sz] = at(0, -.004);
      add("offwhite", [sx, y + .012, sz], alongX ? [span - .06, .02, .02] : [.02, .02, span - .06]);
      const bays = 3;
      for (let i = 0; i < bays; i++) {
        const o = -span / 2 + .03 + (i + .5) * (span - .06) / bays;
        const [wx, , wz] = at(o, -.006);
        add("window", [wx, y + .06, wz], alongX ? [(span - .06) / bays - .03, .06, .014] : [.014, .06, (span - .06) / bays - .03]);
      }
    });
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) block("offwhite", sx * (LW / 2 - .02), L0 + LFLOOR * LCOUNT / 2, LZ + sz * (LD / 2 - .02), .05, LFLOOR * LCOUNT, .05);
  const L1 = L0 + LFLOOR * LCOUNT;
  block("offwhite", 0, L1 + .015, LZ, LW + .06, .03, LD + .06);
  for (const [x, z] of [[-.3, .2], [.3, .2]]) block("red", x, L1 + .036, z, .02, .014, .02);

  // ---- mid tower: communications offices, braced ---------------------------------------
  const MW = .42, MD = .38, MZ = -.06, M0 = L1 + .03, MFLOOR = .092, MCOUNT = 5;
  block("charcoal", 0, M0 + MFLOOR * MCOUNT / 2, MZ, MW - .1, MFLOOR * MCOUNT, MD - .1);
  for (let f = 0; f < MCOUNT; f++) {
    const y = M0 + f * MFLOOR;
    const glass = f % 2 === 0;
    block(glass ? "signal" : "graphite", 0, y + MFLOOR / 2, MZ, MW - .02, MFLOOR - .022, MD - .02);
    block("offwhite", 0, y + .008, MZ, MW, .016, MD);
  }
  const M1 = M0 + MFLOOR * MCOUNT;
  block("offwhite", 0, M1 + .01, MZ, MW + .02, .02, MD + .02);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) block("graphite", sx * (MW / 2), M0 + MFLOOR * MCOUNT / 2, MZ + sz * (MD / 2), .03, MFLOOR * MCOUNT, .03);
  // External X-bracing on the east and west faces, two floors per bay.
  for (const sx of [-1, 1]) for (const [y0, y1] of [[M0, M0 + MFLOOR * 2.5], [M0 + MFLOOR * 2.5, M1]]) {
    const x = sx * (MW / 2 + .018);
    strut("silver", [x, y0 + .01, MZ - MD / 2 + .02], [x, y1 - .01, MZ + MD / 2 - .02], .016);
    strut("silver", [x, y0 + .01, MZ + MD / 2 - .02], [x, y1 - .01, MZ - MD / 2 + .02], .016);
  }
  // Cantilevered antenna deck off the east face with a small fixed dish.
  const deckY = M0 + MFLOOR * 2.5;
  block("offwhite", MW / 2 + .09, deckY, MZ + .04, .18, .018, .2);
  for (const z of [MZ - .055, MZ + .135]) block("silver", MW / 2 + .175, deckY + .035, z, .008, .05, .008);
  block("silver", MW / 2 + .175, deckY + .06, MZ + .04, .008, .008, .2);
  for (const z of [MZ - .02, MZ + .04, MZ + .1]) block("offwhite", MW / 2 + .06, deckY + .07, z, .012, .12, .035);
  strut("silver", [MW / 2 + .02, deckY - .09, MZ + .04], [MW / 2 + .16, deckY - .01, MZ + .04], .014);

  // ---- upper tower: open technical levels --------------------------------------------
  const UW = .34, UD = .32, UZ = -.06, U0 = M1 + .02, U1 = U0 + .3;
  block("charcoal", 0, (U0 + U1) / 2, UZ, .16, U1 - U0, .16);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) block("silver", sx * (UW / 2 - .015), (U0 + U1) / 2, UZ + sz * (UD / 2 - .015), .026, U1 - U0, .026);
  for (const y of [U0 + .1, U0 + .2]) block("offwhite", 0, y, UZ, UW, .018, UD);
  block("signal", 0, U0 + .05, UZ + UD / 2 - .02, UW - .06, .08, .012);
  block("signal", UW / 2 - .02, U0 + .15, UZ, .012, .08, UD - .06);
  for (const [a, b] of [[U0 + .1, U0 + .2], [U0 + .2, U1]]) {
    strut("silver", [-UW / 2 + .02, a + .01, UZ + UD / 2 - .01], [UW / 2 - .02, b - .01, UZ + UD / 2 - .01], .012);
    strut("silver", [-UW / 2 + .01, a + .01, UZ - UD / 2 + .02], [-UW / 2 + .01, b - .01, UZ + UD / 2 - .02], .012);
  }
  // Crown deck with antenna panels; the moving dish is mounted on its corner.
  block("offwhite", 0, U1 + .012, UZ, UW + .12, .024, UD + .12);
  for (const x of [-.14, -.08, -.02]) block("offwhite", x, U1 + .1, UZ - UD / 2 - .03, .045, .16, .012);
  block("graphite", DISH_MOUNT[0], U1 + .05, DISH_MOUNT[2], .04, .07, .04);
  for (const [x, z] of [[-.22, .1], [.22, -.22], [-.22, -.22]]) block("red", x, U1 + .03, z, .016, .014, .016);

  // ---- crown: braced lattice, spire, beacon -------------------------------------------
  const apex = U1 + .3;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) strut("silver", [sx * .13, U1 + .03, UZ + sz * .12], [sx * .03, apex, UZ + sz * .03], .02);
  for (const [y, half] of [[U1 + .12, .095], [U1 + .21, .062]] as const) {
    block("silver", 0, y, UZ + half, half * 2 + .02, .014, .014);
    block("silver", 0, y, UZ - half, half * 2 + .02, .014, .014);
    block("silver", half, y, UZ, .014, .014, half * 2 + .02);
    block("silver", -half, y, UZ, .014, .014, half * 2 + .02);
  }
  block("charcoal", 0, U1 + .07, UZ, .1, .09, .1);
  block("graphite", 0, apex + .01, UZ, .07, .03, .07);
  block("silver", 0, (apex + BEACON_Y) / 2, UZ, .022, BEACON_Y - apex, .022);
  for (const y of [apex + .1, apex + .18]) block("silver", 0, y, UZ, .09, .01, .01);
  block("red", 0, BEACON_Y + .02, UZ, .036, .04, .036);

  // ---- forecourt from the entrance to the apron ----------------------------------------
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) block("offwhite", -.2 + i * .2, .008, .47 + j * .1, .19, .016, .09);
  for (const x of [-.26, .26]) { block("charcoal", x, .04, .6, .03, .05, .03); block("offwhite", x, .07, .6, .034, .01, .034); }

  const roles: Record<Role, Finish> = { body: "graphite", dark: "charcoal", metal: "silver", accent: "signal", trim: "offwhite", warm: "red", wood: "graphite", glass: "signal", lamp: "window", hazard: "red" };
  upgradeContact({
    d: createDetails({
      box: (role, position, size, rotation) => add(roles[role], position, size, "brick", rotation),
      knob: (role, position) => add(roles[role], position, [1, 1, 1], "stud"),
    }),
    assembly: () => {},
    window: () => {},
  });
  materials.signal.emissive.set("#bfe9ee");
  materials.signal.emissiveIntensity = .05;
  finishMaterials(materials, { charcoal: "brick", graphite: "brick", offwhite: "tile", window: "translucent", signal: "translucent", silver: "paintedMetal", red: "indicator" });
  // The bowl is an open shell seen from both sides as it turns.
  const dishMaterial = materials.offwhite.clone();
  dishMaterial.side = DoubleSide;
  return { geometryFor, dish, dishMaterial, materials, batches };
}
