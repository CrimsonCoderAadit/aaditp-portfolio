import { CylinderGeometry, MeshStandardMaterial } from "three";
import { createMoldedBoxGeometry } from "./brickGeometry/moldedEdges";
import { createPartLibrary, HALF_MODULE } from "./brickGeometry/parts";
import { CITY_NEUTRALS } from "./cityPalette";
import { finishMaterials } from "./materialClasses";
import type { BrickPart } from "./BrickInstances";
import { createDetails, type Role } from "./cityDetails";
import { upgradeAchievements } from "./districtUpgrades";

type Finish = "charcoal" | "burgundy" | "brass" | "cream" | "slate" | "display";
type Form = "brick" | "stud" | "slope" | "fin";
type Batch = { finish: Finish; form: Form; parts: BrickPart[] };

export const AWARD_PLINTH_TOP = .955;
export const AWARD_TROPHY_Y = AWARD_PLINTH_TOP + .015;

/** A small-footprint award stele: light plinth, slender coursed shaft, a
 * partial ring of brass fins, and an abstract brass-and-glow crown — not a
 * pavilion in miniature.
 */
export function createAchievementsKit() {
  const brick = createMoldedBoxGeometry();
  const stud = new CylinderGeometry(.046, .049, .028, 16);
  const partLibrary = createPartLibrary();
  const slope = partLibrary.get("slope", [1, 1, 1]);
  const fin = partLibrary.get("edgePanel", [.085, .155, .026]);
  const geometryFor = { brick, stud, slope, fin };
  const materials = {
    charcoal: new MeshStandardMaterial({ color: CITY_NEUTRALS.charcoal, roughness: .34 }),
    burgundy: new MeshStandardMaterial({ color: "#5b2838", roughness: .35 }),
    brass: new MeshStandardMaterial({ color: "#b08a49", emissive: "#7d5628", emissiveIntensity: .03 }),
    cream: new MeshStandardMaterial({ color: CITY_NEUTRALS.offWhite, roughness: .32 }),
    slate: new MeshStandardMaterial({ color: CITY_NEUTRALS.structural, roughness: .38 }),
    display: new MeshStandardMaterial({ color: "#845d4b", emissive: "#e4ad72", emissiveIntensity: .08 }),
  };
  const batches: Batch[] = [];
  const add = (finish: Finish, position: BrickPart["position"], size: BrickPart["size"], form: Form = "brick", rotation?: BrickPart["rotation"]) => {
    let batch = batches.find((b) => b.finish === finish && b.form === form);
    if (!batch) { batch = { finish, form, parts: [] }; batches.push(batch); }
    batch.parts.push({ position, size, rotation });
  };
  const block = (finish: Finish, x: number, y: number, z: number, w: number, h: number, d: number) => add(finish, [x, y, z], [w, h, d]);
  const course = (finish: Finish, x: number, y: number, z: number, length: number, row: number, side = false) => {
    for (let offset = 0; offset < length - .001;) {
      const width = Math.min(offset === 0 && row % 2 ? .15 : .30, length - offset);
      const p = offset + width / 2 - length / 2;
      block(finish, x + (side ? 0 : p), y, z + (side ? p : 0), side ? .10 : width - .008, .092, side ? width - .008 : .10);
      offset += width;
    }
  };

  // Light architectural plinth spans the whole footprint — the same depth as the
  // approved pavilion, so the redesign keeps its clearance from Research's rear
  // wall — so the burgundy/charcoal shaft reads against a bright base instead
  // of disappearing into the ground.
  block("charcoal", 0, .022, 0, .58, .044, .64);
  block("cream", 0, .057, 0, .54, .030, .60);

  // Tile-on-edge coping along the plinth's front lip — a soldier course of
  // premium tiles standing on edge, not another flat paving band.
  for (let i = 0; i < 9; i++) block("cream", -.24 + i * .06, .086, .30, .046, .05, .012);

  // Ceremonial awards walk: four brass-capped markers on a half-module stagger,
  // implying multiple future accomplishments without naming any yet.
  for (let i = 0; i < 4; i++) {
    const z = .05 + i * HALF_MODULE;
    const x = i % 2 === 0 ? -.20 : .20;
    block("charcoal", x, .096, z, .044, .05, .044);
    add("brass", [x, .126, z], [1, 1, 1], "stud");
  }

  // A small ceremonial gate is the walk's final threshold before the monument.
  block("brass", 0, .146, .02, .30, .045, .07);
  block("charcoal", 0, .186, .07, .36, .08, .07);

  // Slender burgundy shaft: bonded coursing on three visible faces around a
  // structural core, deliberately narrower than the old pavilion mass.
  block("charcoal", 0, .49, -.18, .18, .82, .18);
  for (let row = 0; row < 8; row++) {
    const y = .13 + row * .10;
    course("slate", 0, y, -.27, .20, row);
    course("burgundy", -.09, y, -.18, .20, row, true);
    course("burgundy", 0, y, -.09, .20, row);
  }
  block("display", 0, .49, -.08, .10, .55, .020);
  for (const x of [-.09, .09]) block("brass", x, .49, -.075, .022, .80, .030);

  // Partial ring of brass fins fans out from the shaft's base, facing the walk.
  const finRadius = .13;
  for (const angle of [-.55, 0, .55]) {
    const x = finRadius * Math.sin(angle);
    const z = -.18 + finRadius * Math.cos(angle);
    add("brass", [x, .27, z], [1, 1, 1], "fin", [0, angle, 0]);
  }

  // Stepped cap tiers carry the shaft up to the crown platform.
  block("charcoal", 0, .90, -.18, .30, .045, .30);
  block("charcoal", 0, .925, -.18, .22, .025, .22);
  block("brass", 0, .945, -.18, .16, .02, .16);

  const roles: Record<Role, Finish> = { body: "slate", dark: "charcoal", metal: "slate", accent: "brass", trim: "cream", warm: "burgundy", wood: "charcoal", glass: "display", lamp: "display", hazard: "brass" };
  upgradeAchievements({
    d: createDetails({
      box: (role, position, size, rotation, form) => add(roles[role], position, size, form ?? "brick", rotation),
      knob: (role, position) => add(roles[role], position, [1, 1, 1], "stud"),
    }),
    assembly: () => {},
    window: () => {},
  });
  finishMaterials(materials, { charcoal: "brick", burgundy: "brick", brass: "paintedMetal", cream: "tile", slate: "brick", display: "indicator" });
  return { geometryFor, materials, batches, partLibrary };
}
