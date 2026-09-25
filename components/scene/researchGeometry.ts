import { CylinderGeometry, MeshStandardMaterial } from "three";
import { createMoldedBoxGeometry, withMoldedEdges } from "./brickGeometry/moldedEdges";
import { createPartLibrary, HALF_MODULE } from "./brickGeometry/parts";
import { builtWindow } from "./brickGeometry/builtWindow";
import type { BrickPart } from "./BrickInstances";
import { CITY_NEUTRALS } from "./cityPalette";
import { finishMaterials, translucentPlastic } from "./materialClasses";
import { createDetails, type Role } from "./cityDetails";
import { upgradeResearch } from "./districtUpgrades";

type Finish = "white" | "silver" | "charcoal" | "cyan" | "window" | "glass";
type Form = "brick" | "stud" | "slope";
export type ResearchAssembly = "fixed" | "chamber" | "core" | "interior";
type Batch = { finish: Finish; form: Form; assembly: ResearchAssembly; parts: BrickPart[] };

export const CHAMBER_RADIUS = .275;
export const CHAMBER_CENTER_Z = -.055;

/** The instrument in the courtyard: quiet low laboratory wings around a partial
 * curved apse of translucent panels framed by guide posts, enclosing a rising
 * analysis platform and a lens on a short rail.
 */
export function createResearchKit() {
  const brick = createMoldedBoxGeometry();
  const stud = new CylinderGeometry(.046, .049, .028, 16);
  const partLibrary = createPartLibrary();
  const slope = partLibrary.get("slope", [1, 1, 1]);
  const geometryFor = { brick, stud, slope };
  const materials = {
    white: new MeshStandardMaterial({ color: CITY_NEUTRALS.offWhite, roughness: .31 }),
    silver: new MeshStandardMaterial({ color: CITY_NEUTRALS.architectural, roughness: .37 }),
    charcoal: new MeshStandardMaterial({ color: CITY_NEUTRALS.charcoal, roughness: .38 }),
    cyan: new MeshStandardMaterial({ color: "#408b9b", roughness: .32 }),
    window: new MeshStandardMaterial({ color: "#408b9b", emissive: "#9cd4dc", emissiveIntensity: .07 }),
    glass: translucentPlastic("#65adba", .55),
  };
  const glass = translucentPlastic("#65adba", .55);
  const core = withMoldedEdges(new MeshStandardMaterial({ color: "#d8ece9", emissive: "#9dd9e0", emissiveIntensity: .12, roughness: .34 }));
  const batches: Batch[] = [];
  let assembly: ResearchAssembly = "fixed";
  let lowWing = false;
  const add = (finish: Finish, position: BrickPart["position"], size: BrickPart["size"], form: Form = "brick", rotation?: BrickPart["rotation"]) => {
    // Only the fixed wings recede; the instrument and its opening parts retain their height.
    if (lowWing) {
      position = [position[0], .076 + (position[1] - .076) * .56, position[2]];
      size = [size[0], size[1] * .56, size[2]];
    }
    let batch = batches.find((b) => b.finish === finish && b.form === form && b.assembly === assembly);
    if (!batch) { batch = { finish, form, assembly, parts: [] }; batches.push(batch); }
    batch.parts.push({ position, size, rotation });
  };
  const block = (finish: Finish, x: number, y: number, z: number, w: number, h: number, d: number) => add(finish, [x, y, z], [w, h, d]);
  const windowBay = (position: BrickPart["position"], size: BrickPart["size"], mullion = false) => {
    const bay = builtWindow(position, size, [0, 0, 0], mullion);
    bay.frame.forEach((part) => add("silver", part.position, part.size));
    add("glass", bay.glass.position, bay.glass.size);
  };
  const studs = (finish: Finish, x: number, y: number, z: number, nx: number, nz: number) => {
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) add(finish, [x + .15 * i, y, z + .15 * j], [1, 1, 1], "stud");
  };
  const course = (finish: Finish, x: number, y: number, z: number, length: number, row: number, alongZ = false) => {
    let offset = 0;
    while (offset < length - .001) {
      const width = Math.min(offset === 0 && row % 2 ? .15 : .30, length - offset);
      const p = offset + width / 2 - length / 2;
      block(finish, x + (alongZ ? 0 : p), y, z + (alongZ ? p : 0), alongZ ? .115 : width - .008, .092, alongZ ? width - .008 : .115);
      offset += width;
    }
  };
  // A narrow on-edge tile, laid as a soldier course rather than a flat plate.
  const edgeTile = (finish: Finish, x: number, y: number, z: number, n: number, step: number, alongZ = false) => {
    for (let i = 0; i < n; i++) {
      const o = (i - (n - 1) / 2) * step;
      block(finish, x + (alongZ ? 0 : o), y, z + (alongZ ? o : 0), alongZ ? .05 : .046, .05, alongZ ? .046 : .05);
    }
  };

  // Layered pale base and a tiled forecourt; no connections to other districts.
  for (const x of [-.525, .525]) block("silver", x, .024, 0, 1.043, .048, .88);
  block("white", 0, .062, -.11, 2.04, .028, .60);
  for (let i = 0; i < 7; i++) block("silver", -.90 + i * .30, .066, .285, .29, .033, .18);
  studs("silver", -.975, .064, .385, 14, 1);
  studs("silver", -.975, .064, -.365, 14, 1);

  // A partial curved paving band echoes the apse's arc from above.
  for (let i = -3; i <= 3; i++) {
    const angle = i * Math.PI / 8;
    const r = CHAMBER_RADIUS + .155;
    block("white", Math.sin(angle) * r, .073, Math.cos(angle) * r + CHAMBER_CENTER_Z, .155, .014, .05);
  }
  // Three narrow technical channels radiate toward the future research docks.
  for (const angle of [-Math.PI / 3, 0, Math.PI / 3]) {
    block("charcoal", Math.sin(angle) * (CHAMBER_RADIUS + .08), .069, Math.cos(angle) * (CHAMBER_RADIUS + .08) + CHAMBER_CENTER_Z, .022, .006, .13);
  }

  // Main computational wing: a long low quiet band, charcoal/white with a single
  // cyan optical strip, a shallow stepped roof and a recessed built window.
  lowWing = true;
  block("charcoal", -.67, .235, -.10, .56, .30, .46);
  for (let row = 0; row < 4; row++) {
    const y = .125 + row * .10;
    course("charcoal", -.67, y, -.32, .60, row);
    course("white", -.94, y, -.095, .45, row, true);
    if (row === 0 || row === 3) course("white", -.67, y, .145, .60, row);
  }
  block("cyan", -.67, .175, -.325, .58, .012, .012);
  windowBay([-.67, .277, .168], [.46, .18, .05], true);
  block("silver", -.67, .491, -.10, .68, .041, .57);
  block("white", -.67, .527, -.10, .60, .03, .40);
  add("white", [-.67 + HALF_MODULE, .555, -.28], [.30, .05, .13], "slope");
  edgeTile("silver", -.895, .535, -.28, 3, .10, false);
  block("charcoal", -.73, .575, -.15, .23, .067, .17);
  for (let i = 0; i < 3; i++) block("silver", -.80 + i * .07, .616, -.15, .033, .015, .15);

  // Opposite technical wing is lower and set back, with a quiet observation deck.
  block("charcoal", .73, .18, -.14, .46, .21, .36);
  for (let row = 0; row < 3; row++) {
    const y = .125 + row * .10;
    course("white", .73, y, -.32, .45, row);
    course(row === 0 ? "charcoal" : "silver", .955, y, -.14, .45, row, true);
    if (row !== 1) course("white", .73, y, .065, .45, row);
  }
  windowBay([.73, .225, .072], [.33, .09, .036]);
  block("silver", .73, .389, -.14, .54, .04, .48);
  block("charcoal", .73, .420, -.18, .38, .022, .20);
  block("cyan", .73, .432, -.18, .10, .01, .06);
  block("white", .70, .109, .20, .59, .066, .20);
  block("charcoal", .75, .16, .19, .23, .033, .13);
  block("window", .75, .199, .145, .21, .05, .018);

  // Small technical vents mark both wings as supporting enclosure, not feature buildings.
  for (const x of [-.51, -.83]) block("silver", x, .565, .07, .05, .014, .05);
  block("silver", .855, .437, .02, .05, .014, .05);
  lowWing = false;

  // Two short brick thresholds connect the wings to the chamber; a thin cyan
  // inlay is the only optical accent, not a solid coloured wall.
  for (const x of [-.365, .38]) {
    block("charcoal", x, .107, -.045, .22, .06, .25);
    block("silver", x, .149, -.045, .22, .024, .25);
    block("cyan", x, .162, -.045, .22, .006, .04);
  }

  // A partial ring of five framed translucent panels forms the apse's front-facing
  // 180-degree curve; the rear stays open into the courtyard, not one closed drum.
  const panels: BrickPart[] = [];
  assembly = "chamber";
  const panelSteps = [-2, -1, 0, 1, 2];
  for (const i of panelSteps) {
    const angle = i * Math.PI / 4;
    const x = Math.sin(angle) * CHAMBER_RADIUS;
    const z = Math.cos(angle) * CHAMBER_RADIUS + CHAMBER_CENTER_Z;
    add("charcoal", [x, .116, z], [.225, .062, .09], "brick", [0, angle, 0]);
    add("white", [x, .502, z], [.225, .055, .087], "brick", [0, angle, 0]);
    add("cyan", [x, .545, z], [1, 1, 1], "stud");
    panels.push({ position: [x, .312, z], size: [.205, .325, .027], rotation: [0, angle, 0] });
  }
  // Guide posts frame every seam, with two collars each reading as sliding-track
  // hardware for the panels that travel radially past them.
  const post = (angle: number) => {
    const r = CHAMBER_RADIUS + .021;
    const x = Math.sin(angle) * r, z = Math.cos(angle) * r + CHAMBER_CENTER_Z;
    add("silver", [x, .313, z], [.032, .34, .032]);
    add("charcoal", [x, .175, z], [.05, .028, .05]);
    add("charcoal", [x, .455, z], [.05, .024, .05]);
  };
  for (const i of panelSteps) post(i * Math.PI / 4 - Math.PI / 8);
  post(panelSteps[panelSteps.length - 1] * Math.PI / 4 + Math.PI / 8);

  // Central analysis platform: concentric rings reading as a precise instrument
  // deck rather than another small roof, with rail seats for the sensor.
  assembly = "core";
  block("white", 0, .105, CHAMBER_CENTER_Z, .38, .045, .38);
  block("charcoal", 0, .144, CHAMBER_CENTER_Z, .30, .012, .30);
  block("cyan", 0, .152, CHAMBER_CENTER_Z, .23, .028, .23);
  for (const x of [-.098, .098]) block("silver", x, .184, CHAMBER_CENTER_Z, .022, .012, .16);
  block("charcoal", 0, .229, CHAMBER_CENTER_Z, .075, .14, .075);

  // Three generic, blank experiment docks remain hidden beneath the closed chamber.
  assembly = "interior";
  block("charcoal", -.16, .215, CHAMBER_CENTER_Z, .09, .20, .30);
  block("charcoal", 0, .215, CHAMBER_CENTER_Z, .09, .20, .30);
  block("charcoal", .16, .215, CHAMBER_CENTER_Z, .09, .20, .30);
  for (const x of [-.16, 0, .16]) {
    block("silver", x, .335, CHAMBER_CENTER_Z, .12, .025, .26);
    block("cyan", x, .365, CHAMBER_CENTER_Z, .08, .022, .08);
  }
  block("white", 0, .10, CHAMBER_CENTER_Z, .58, .035, .46);

  // Physical entrance plaque on a stepped low brick marker.
  assembly = "fixed";
  for (const x of [-.29, .29]) block("silver", x, .126, .32, .09, .10, .10);
  block("charcoal", 0, .207, .32, .72, .13, .095);
  block("white", 0, .288, .32, .76, .025, .12);
  const roles: Record<Role, Finish> = { body: "silver", dark: "charcoal", metal: "silver", accent: "cyan", trim: "white", warm: "cyan", wood: "charcoal", glass: "glass", lamp: "window", hazard: "cyan" };
  upgradeResearch({
    d: createDetails({
      box: (role, position, size, rotation) => add(roles[role], position, size, "brick", rotation),
      knob: (role, position) => add(roles[role], position, [1, 1, 1], "stud"),
    }),
    assembly: (name) => { assembly = name; },
    window: (position, size, _rotation, mullion) => windowBay(position, size, mullion),
  });
  assembly = "fixed";
  finishMaterials(materials, { white: "tile", silver: "brick", charcoal: "brick", cyan: "brick", window: "indicator", glass: "translucent" });
  return { geometryFor, materials, glass, core, batches, panels, partLibrary };
}
