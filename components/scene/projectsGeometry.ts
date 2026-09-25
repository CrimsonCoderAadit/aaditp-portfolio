import { CylinderGeometry, MeshStandardMaterial } from "three";
import { createMoldedBoxGeometry } from "./brickGeometry/moldedEdges";
import { CITY_NEUTRALS } from "./cityPalette";
import { finishMaterials, translucentPlastic } from "./materialClasses";
import { createPartLibrary } from "./brickGeometry/parts";
import { builtWindow } from "./brickGeometry/builtWindow";
import { createDetails, type Role } from "./cityDetails";
import { upgradeProjects } from "./districtUpgrades";

type Finish = "stone" | "graphite" | "tile" | "tan" | "accent" | "metal" | "window" | "glass" | "marker";
export type Part = { position: [number, number, number]; size: [number, number, number]; rotation?: [number, number, number] };
export type Assembly = "fixed" | "roof" | "facade" | "tray";
type Form = "brick" | "stud" | "slope" | "round" | "edgePanel";
export type Batch = { finish: Finish; form: Form; assembly: Assembly; parts: Part[] };

/** Original modular forms, batched by finish and mechanical ownership. */
export function createProjectsKit() {
  const brick = createMoldedBoxGeometry();
  const stud = new CylinderGeometry(.046, .049, .028, 16);
  const partLibrary = createPartLibrary();
  const slope = partLibrary.get("slope", [1, 1, 1]);
  // Sideways end panels use physical dimensions and a quarter-turn mount.
  const edgePanel = partLibrary.get("edgePanel", [.39, .23, .065]);
  const round = new CylinderGeometry(.5, .5, 1, 12);
  const geometries = { brick, stud, slope, round, edgePanel };
  const materials = {
    stone: new MeshStandardMaterial({ color: CITY_NEUTRALS.architectural, roughness: .36 }),
    graphite: new MeshStandardMaterial({ color: CITY_NEUTRALS.structural, roughness: .38 }),
    tile: new MeshStandardMaterial({ color: CITY_NEUTRALS.offWhite, roughness: .29 }),
    tan: new MeshStandardMaterial({ color: "#9b8160", roughness: .38 }),
    accent: new MeshStandardMaterial({ color: "#526d70", roughness: .34 }),
    metal: new MeshStandardMaterial({ color: CITY_NEUTRALS.charcoal, roughness: .35, metalness: .25 }),
    window: new MeshStandardMaterial({ color: "#515a59", emissive: "#edc28a", emissiveIntensity: .10 }),
    glass: translucentPlastic("#85aaa5", .72),
    marker: new MeshStandardMaterial({ color: "#bb884c", roughness: .36 }),
  };
  const batches: Batch[] = [];
  let assembly: Assembly = "fixed";
  let upperHall = false;
  let bridge = false;
  const add = (finish: Finish, position: Part["position"], size: Part["size"], form: Form = "brick", rotation?: Part["rotation"]) => {
    // Bake massing into the parts, leaving the rigid opening-group transforms intact.
    if (upperHall) {
      position = [position[0], .831 + (position[1] - .831) * .48, position[2]];
      size = [size[0], size[1] * .48, size[2]];
    }
    if (bridge) position = [position[0], position[1] + .20, position[2]];
    let batch = batches.find((b) => b.finish === finish && b.form === form && b.assembly === assembly);
    if (!batch) { batch = { finish, form, assembly, parts: [] }; batches.push(batch); }
    batch.parts.push({ position, size, rotation });
  };
  const block = (finish: Finish, x: number, y: number, z: number, w: number, h: number, d: number) => add(finish, [x, y, z], [w, h, d]);
  const windowBay = (position: Part["position"], size: Part["size"], mullion = false) => {
    const bay = builtWindow(position, size, [0, 0, 0], mullion);
    bay.frame.forEach((part) => add("accent", part.position, part.size));
    add("glass", bay.glass.position, bay.glass.size);
  };
  const studs = (finish: Finish, x: number, y: number, z: number, nx: number, nz: number) => {
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) add(finish, [x + i * .15, y, z + j * .15], [1, 1, 1], "stud");
  };
  // Staggered 1x/2x bonds with real gaps so seams remain readable at hero distance.
  const course = (finish: Finish, x: number, y: number, z: number, length: number, row: number, alongZ = false) => {
    let offset = 0;
    while (offset < length - .001) {
      const width = Math.min(offset === 0 && row % 2 ? .15 : .30, length - offset);
      const p = offset + width / 2 - length / 2;
      block(finish, x + (alongZ ? 0 : p), y, z + (alongZ ? p : 0), alongZ ? .14 : width - .008, .092, alongZ ? width - .008 : .14);
      offset += width;
    }
  };

  // 2.5-wide footprint = 40% of the approved table width, with a raised rear base.
  for (const x of [-.625, .625]) block("graphite", x, .025, 0, 1.244, .05, 1.76);
  block("stone", 0, .069, -.40, 2.44, .038, .88);
  for (let x = 0; x < 6; x++) for (let z = 0; z < 3; z++)
    block((x + z) % 4 === 0 ? "tan" : "stone", -1.02 + x * .30, .068, .17 + z * .24, .29, .034, .23);
  studs("graphite", -1.125, .066, -.75, 16, 1);
  studs("graphite", -1.125, .066, .795, 16, 1);
  studs("graphite", -1.125, .066, -.60, 1, 9);
  studs("graphite", 1.125, .066, -.60, 1, 9);

  // Main hall: broad lower body, recessed entrance and set-back upper storey.
  // A shallow inner lining replaces the solid core, preserving dark window backing.
  block("metal", -.65, .44, -.635, .72, .69, .065);
  for (const x of [-.94, -.36]) for (const z of [-.57, -.19])
    block("graphite", x, .44, z, .065, .69, .065);
  assembly = "tray";
  block("graphite", -.65, .146, -.40, .62, .038, .46);
  block("tile", -.65, .176, -.40, .56, .022, .40);
  // Three blank modular display bays, with no project content.
  for (const x of [-.83, -.65, -.47]) {
    block("tan", x, .216, -.44, .145, .06, .20);
    block("tile", x, .251, -.44, .13, .012, .185);
  }
  assembly = "fixed";
  block("window", -.65, .25, -.59, .46, .027, .02);
  for (let row = 0; row < 7; row++) {
    const y = .14 + row * .10;
    const finish = row === 1 || row === 4 ? "tan" : "stone";
    course(finish, -.65, y, -.70, .90, row);
    course(finish, -1.03, y, -.40, .60, row, true);
    course(finish, -.27, y, -.40, .60, row, true);
    assembly = "facade";
    if (row < 2 || row === 4 || row === 6) course(finish, -.65, y, -.075, .90, row);
    assembly = "fixed";
  }
  assembly = "facade";
  for (const y of [.38, .68]) {
    const bay = builtWindow([-.65, y, -.035], [.65, .185, .065], [0, 0, 0], true);
    bay.frame.forEach((part) => add("tile", part.position, part.size));
    add("glass", bay.glass.position, bay.glass.size);
    block("graphite", -.65, y - .099, -.025, .76, .025, .085);
  }
  block("metal", -.65, .205, .015, .27, .24, .10);
  block("window", -.65, .205, .071, .19, .18, .017);
  // The canopy, portal and glazing all travel with the sliding façade.
  block("accent", -.65, .34, .12, .54, .042, .27);
  block("graphite", -.65, .382, .218, .49, .074, .055);
  for (const x of [-.835, -.465]) {
    block("tan", x, .205, .08, .055, .24, .095);
    block("window", x, .277, .132, .022, .055, .012);
  }
  add("accent", [-.65, .36, .105], [.16, .052, .53], "slope", [0, Math.PI / 2, 0]);
  assembly = "fixed";
  block("tile", -.65, .109, .17, .48, .035, .30);
  block("tan", -.65, .088, .32, .54, .028, .13);
  block("tile", -.65, .072, .42, .61, .023, .10);
  // Quiet occupied silhouettes behind the ribbon glazing, not detailed rooms.
  for (const x of [-.84, -.46]) {
    block("tan", x, .315, -.27, .20, .024, .13);
    block("metal", x, .375, -.30, .10, .095, .022);
    block("graphite", x, .25, -.27, .045, .11, .07);
  }
  assembly = "roof";
  // Guide rods retract into the existing corner columns when closed.
  for (const x of [-.94, -.36]) for (const z of [-.57, -.19])
    block("metal", x, .52, z, .025, .52, .025);
  block("tile", -.65, .805, -.39, .98, .052, .80);
  upperHall = true;
  for (let row = 0; row < 3; row++) {
    const y = .88 + row * .10;
    course(row === 1 ? "tan" : "tile", -.65, y, -.64, .60, row);
    course("stone", -.90, y, -.44, .45, row, true);
    course("stone", -.40, y, -.44, .45, row, true);
    if (row !== 1) course("tile", -.65, y, -.22, .60, row);
  }
  windowBay([-.65, .98, -.205], [.47, .09, .055]);
  block("graphite", -.65, .92, -.18, .53, .025, .09);
  block("graphite", -.65, 1.145, -.43, .67, .042, .55);
  studs("graphite", -.875, 1.18, -.58, 4, 1);
  studs("stone", -1.02, .848, -.09, 6, 1);
  // Asymmetric sloped plant enclosure and inset service terrace on the lift-off roof.
  block("graphite", -.73, 1.197, -.45, .37, .065, .25);
  for (let i = 0; i < 5; i++) block("metal", -.875 + i * .073, 1.24, -.45, .037, .023, .21);
  add("tile", [-.445, 1.20, -.44], [.17, .09, .30], "slope");
  for (const z of [-.65, -.38, -.10]) block("metal", -1.09, .94, z, .023, .22, .023);
  block("metal", -1.09, 1.05, -.375, .026, .026, .58);
  for (const z of [-.56, -.28]) block("tan", -.99, .848, z, .09, .022, .23);
  block("window", -.65, .855, -.29, .40, .02, .022);
  upperHall = false;
  assembly = "fixed";

  // Lower workshop frames the back of the court, with alternating tile/stud roof.
  block("metal", .48, .28, -.44, 1.04, .38, .50);
  for (let row = 0; row < 4; row++) {
    const y = .14 + row * .10;
    course("graphite", .48, y, -.70, 1.20, row);
    course(row % 2 ? "stone" : "graphite", 1.01, y, -.44, .60, row, true);
    if (row < 1 || row === 3) course("graphite", .48, y, -.16, 1.20, row);
  }
  block("window", .48, .29, -.154, 1.00, .16, .025);
  for (const x of [-.04, .26, .56, .86]) block("tan", x, .285, -.115, .058, .20, .07);
  block("tile", .48, .514, -.43, 1.25, .05, .68);
  for (let i = 0; i < 3; i++) block("graphite", .12 + i * .34, .554, -.45, .326, .03, .38);
  studs("stone", -.045, .553, -.16, 8, 1);
  studs("stone", -.045, .553, -.70, 8, 1);
  block("tan", -.125, .119, -.12, .20, .06, .40);

  // Foreground fabrication shed is separated by a service lane from the workshop.
  block("metal", .79, .22, .53, .57, .29, .43);
  for (let row = 0; row < 3; row++) {
    const y = .135 + row * .10;
    course(row === 0 ? "tan" : "stone", .79, y, .72, .60, row);
    course("stone", 1.025, y, .51, .45, row, true);
    block("tan", .52, y, .36, .11, .092, .13);
  }
  block("metal", .74, .24, .292, .32, .26, .03);
  for (let i = 0; i < 5; i++) block("graphite", .74, .14 + i * .045, .273, .30, .025, .015);
  block("tile", .79, .403, .50, .69, .045, .60);
  studs("stone", .565, .444, .35, 4, 3);
  block("graphite", .81, .462, .52, .27, .028, .30);
  block("tan", .73, .096, .19, .53, .085, .18);

  // The existing gantry becomes the structure of a glazed prototyping bridge.
  // It remains fixed, clear of the roof's vertical and façade's leftward travel.
  for (const x of [.06, 1.06]) {
    block("graphite", x, .11, .09, .23, .10, .28);
    for (let row = 0; row < 7; row++) block("accent", x, .205 + row * .10, .09, .12, .092, .15);
    studs("accent", x, .869, .09, 1, 1);
  }
  bridge = true;
  for (let i = 0; i < 4; i++) block("accent", .11 + i * .30, .697, .09, .292, .11, .18);
  block("metal", .56, .636, .09, 1.04, .025, .05);

  block("graphite", .48, .772, .035, 1.25, .038, .39);
  for (let i = 0; i < 4; i++) {
    const x = .015 + i * .30;
    block("tan", x, .797, .03, .292, .018, .32);
    block("accent", x, 1.033, .035, .292, .038, .39);
    windowBay([x, .917, .211], [.247, .19, .049]);
    block("accent", x - .14, .92, .215, .035, .225, .045);
    block("metal", x, .835, -.12, .16, .05, .022);
  }
  for (const x of [-.12, 1.08]) {
    add("accent", [x, .92, .035], [1, 1, 1], "edgePanel", [0, x < 0 ? -Math.PI / 2 : Math.PI / 2, 0]);
    add("accent", [x, .68, -.10], [.18, .18, .12], "slope");
  }
  // Smooth tiled roof contrasts with a narrow exposed attachment strip.
  for (const x of [.02, .32, .62]) block("tile", x, 1.066, .035, .292, .026, .40);
  add("accent", [.94, 1.085, .035], [.29, .09, .40], "slope");
  studs("accent", -.055, 1.095, -.105, 6, 1);
  block("window", .48, .808, .239, 1.09, .014, .013);
  // A small prototype bench is visible through the substantial tinted panels.
  block("tan", .43, .864, .055, .39, .025, .15);
  for (const x of [.28, .58]) block("metal", x, .829, .055, .028, .05, .11);
  block("graphite", .45, .90, .035, .13, .06, .08);
  block("marker", .49, .936, .035, .05, .012, .055);
  bridge = false;

  // Rear roof utility deck: paired round cooling drums and one shared conduit.
  for (const x of [.23, .39]) {
    add("stone", [x, .621, -.54], [.115, .12, .115], "round");
    add("metal", [x, .69, -.54], [.10, .025, .10], "round");
  }
  add("metal", [.31, .555, -.62], [.038, .45, .038], "round", [0, 0, Math.PI / 2]);
  // Sloped vent cowl and louvres give the small service shed a different roof form.
  add("graphite", [.81, .52, .52], [.28, .09, .30], "slope");
  for (let i = 0; i < 4; i++) block("metal", .60, .17 + i * .055, .738, .14, .022, .024);
  block("graphite", 1.04, .17, .12, .14, .16, .12);
  block("marker", 1.04, .22, .185, .055, .025, .014);

  block("metal", .64, .61, -.46, .30, .095, .24);
  for (let i = 0; i < 4; i++) block("stone", .535 + i * .07, .664, -.46, .035, .015, .20);
  // Open forecourt leads directly to the new entrance header (no second sign).
  for (let i = 0; i < 3; i++) block("tile", -.65, .09, .52 + i * .12, .45, .025, .112);
  for (const x of [-.96, -.34]) {
    block("graphite", x, .115, .54, .08, .10, .08);
    block("window", x, .169, .54, .06, .012, .06);
  }
  // Exhibition court east of the entrance (ProjectBays stands the exhibits on
  // it): a raised rear terrace lifts the back row clear of the front row, and a
  // pale lit walk runs between the two.
  block("tile", -.045, .102, .40, .65, .034, .18);
  block("tan", -.045, .102, .492, .65, .026, .006);
  block("tile", .07, .089, .55, .74, .008, .07);
  for (const x of [-.2, 0, .2, .4]) block("window", x, .095, .55, .018, .004, .018);
  for (const x of [-.1, .1, .3]) block("graphite", x, .094, .55, .04, .003, .006);

  const roles: Record<Role, Finish> = { body: "stone", dark: "graphite", metal: "metal", accent: "accent", trim: "tile", warm: "tan", wood: "tan", glass: "glass", lamp: "window", hazard: "marker" };
  const details = createDetails({
    box: (role, position, size, rotation) => add(roles[role], position, size, "brick", rotation),
    knob: (role, position) => add(roles[role], position, [1, 1, 1], "stud"),
  });
  upgradeProjects({
    d: details,
    assembly: (name) => { assembly = name; },
    window: (position, size, rotation = [0, 0, 0], mullion = false) => {
      const bay = builtWindow(position, size, rotation, mullion);
      bay.frame.forEach((part) => add("accent", part.position, part.size, "brick", part.rotation));
      add("glass", bay.glass.position, bay.glass.size, "brick", bay.glass.rotation);
    },
  });
  assembly = "fixed";

  const movingParts: Part[] = [
    { position: [0, .624, 0], size: [.19, .09, .21] },
    { position: [0, .50, 0], size: [.025, .18, .025] },
    { position: [.035, .404, 0], size: [.095, .025, .045] },
    { position: [.074, .43, 0], size: [.025, .07, .045] },
  ];
  // Keep the trolley suspended from the raised bridge rail.
  movingParts.forEach((part) => { part.position[1] += .20; });
  finishMaterials(materials, { stone: "brick", graphite: "brick", tile: "tile", tan: "brick", accent: "brick", metal: "paintedMetal", window: "indicator", glass: "translucent", marker: "paintedMetal" });
  return { brick, stud, geometries, materials, batches, movingParts };
}
