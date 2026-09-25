import { CylinderGeometry, MeshStandardMaterial } from "three";
import { createMoldedBoxGeometry } from "./brickGeometry/moldedEdges";
import { CITY_NEUTRALS } from "./cityPalette";
import { finishMaterials, translucentPlastic } from "./materialClasses";
import { builtWindow } from "./brickGeometry/builtWindow";
import type { BrickPart } from "./BrickInstances";
import { createDetails, type Role } from "./cityDetails";
import { upgradeExperience } from "./districtUpgrades";

type Finish = "grey" | "white" | "navy" | "red" | "charcoal" | "window" | "glass";
export type ExperienceAssembly = "fixed" | "core" | "facade" | "crown" | "wing" | "interior" | "closedInfill";
type Batch = { finish: Finish; stud: boolean; assembly: ExperienceAssembly; parts: BrickPart[] };

export function createExperienceKit() {
  const brick = createMoldedBoxGeometry();
  const stud = new CylinderGeometry(.046, .049, .028, 16);
  const materials = {
    grey: new MeshStandardMaterial({ color: CITY_NEUTRALS.architectural, roughness: .37 }),
    white: new MeshStandardMaterial({ color: CITY_NEUTRALS.offWhite, roughness: .29 }),
    navy: new MeshStandardMaterial({ color: "#244e70", roughness: .34 }),
    red: new MeshStandardMaterial({ color: "#963f43", roughness: .36 }),
    charcoal: new MeshStandardMaterial({ color: CITY_NEUTRALS.charcoal, roughness: .39 }),
    window: new MeshStandardMaterial({ color: "#414d57", emissive: "#d4e1e7", emissiveIntensity: .07 }),
    glass: translucentPlastic("#414d57", .72),
  };
  const batches: Batch[] = [];
  let assembly: ExperienceAssembly = "fixed";
  const add = (finish: Finish, position: BrickPart["position"], size: BrickPart["size"], isStud = false, rotation?: BrickPart["rotation"]) => {
    let batch = batches.find((b) => b.finish === finish && b.stud === isStud && b.assembly === assembly);
    if (!batch) { batch = { finish, stud: isStud, assembly, parts: [] }; batches.push(batch); }
    batch.parts.push({ position, size, rotation });
  };
  const block = (finish: Finish, x: number, y: number, z: number, w: number, h: number, d: number) => add(finish, [x, y, z], [w, h, d]);
  const windowBay = (position: BrickPart["position"], size: BrickPart["size"], rotation: BrickPart["rotation"] = [0, 0, 0]) => {
    const bay = builtWindow(position, size, rotation, true);
    bay.frame.forEach((part) => add("white", part.position, part.size, false, part.rotation));
    add("glass", bay.glass.position, bay.glass.size, false, bay.glass.rotation);
  };
  const studs = (finish: Finish, x: number, y: number, z: number, nx: number, nz: number) => {
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) add(finish, [x + .15 * i, y, z + .15 * j], [1, 1, 1], true);
  };
  const course = (finish: Finish, x: number, y: number, z: number, length: number, row: number, alongZ = false) => {
    let offset = 0;
    while (offset < length - .001) {
      const width = Math.min(offset === 0 && row % 2 ? .15 : .30, length - offset);
      const p = offset + width / 2 - length / 2;
      block(finish, x + (alongZ ? 0 : p), y, z + (alongZ ? p : 0), alongZ ? .13 : width - .008, .092, alongZ ? width - .008 : .13);
      offset += width;
    }
  };

  // Independent plot, with a raised forecourt and selective studded perimeter.
  for (const x of [-.525, .525]) block("charcoal", x, .025, 0, 1.043, .05, 1.56);
  block("grey", .07, .069, -.39, 1.86, .038, .65);
  for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++)
    block("grey", -.79 + i * .30, .07, .12 + j * .23, .29, .038, .22);
  studs("charcoal", -.975, .066, .705, 14, 1);
  studs("charcoal", -.975, .066, -.645, 14, 1);
  studs("charcoal", -.975, .066, -.495, 1, 8);
  studs("charcoal", .975, .066, -.495, 1, 8);

  // Corporate tower: navy structural frame, neutral floor bands, asymmetric red core.
  assembly = "closedInfill";
  block("charcoal", .10, .62, -.37, .62, 1.06, .47);
  assembly = "fixed";
  for (let floor = 0; floor < 4; floor++) {
    const base = .10 + floor * .26;
    block("white", .10, base, -.37, .88, .045, .66);
    assembly = "facade";
    windowBay([.10, base + .13, -.09], [.57, .145, .052]);
    assembly = "fixed";
    windowBay([.446, base + .13, -.37], [.42, .145, .05], [0, Math.PI / 2, 0]);
    course("grey", .10, base + .10, -.64, .75, floor);
    course("grey", .10, base + .20, -.64, .75, floor + 1);
    assembly = "facade";
    for (const x of [-.255, .355]) {
      block("navy", x, base + .083, -.065, .13, .112, .14);
      block("navy", x, base + .203, -.065, .13, .112, .14);
    }
    assembly = "fixed";
    course("grey", -.25, base + .10, -.40, .45, floor, true);
    course("grey", -.25, base + .20, -.40, .45, floor + 1, true);
  }
  assembly = "crown";
  block("white", .10, 1.14, -.37, .90, .05, .69);
  // Set-back executive/systems floor breaks the straight tower profile.
  for (let row = 0; row < 2; row++) {
    const y = 1.22 + row * .10;
    course("grey", .04, y, -.64, .60, row);
    course("navy", -.21, y, -.45, .45, row, true);
    course("navy", .29, y, -.45, .45, row, true);
  }
  windowBay([.04, 1.27, -.214], [.39, .14, .047]);
  block("white", .04, 1.399, -.43, .69, .05, .54);
  studs("navy", -.185, 1.438, -.58, 4, 3);
  studs("white", -.275, 1.18, -.085, 6, 1);
  // Red brick core is an architectural spine, not randomly coloured wall pieces.
  assembly = "core";
  for (let row = 0; row < 14; row++) course("red", .53, .14 + row * .10, -.40, .45, row, true);
  block("white", .53, 1.51, -.40, .20, .045, .52);
  studs("red", .53, 1.548, -.55, 1, 3);

  // Lower operations wing stretches forward on the opposite side of the tower.
  assembly = "wing";
  // Set only the hidden backing inward to leave air behind the inset wing pane.
  block("charcoal", -.63, .25, -.14, .53, .33, .82);
  for (let row = 0; row < 4; row++) {
    const y = .14 + row * .10;
    course("grey", -.90, y, -.12, .90, row, true);
    course(row === 0 ? "navy" : "grey", -.63, y, -.56, .60, row);
    if (row === 0 || row === 3) course("navy", -.63, y, .31, .60, row);
  }
  windowBay([-.63, .295, .32], [.44, .15, .038]);
  block("white", -.63, .514, -.12, .69, .05, 1.00);
  for (let i = 0; i < 3; i++) block("navy", -.63, .553, -.42 + i * .30, .43, .027, .285);
  studs("white", -.855, .553, .33, 4, 1);
  // Short enclosed connector gives the wing and tower a coherent circulation route.
  assembly = "fixed";
  block("navy", -.30, .46, -.17, .27, .09, .23);
  block("window", -.30, .555, -.17, .24, .10, .20);
  block("white", -.30, .628, -.17, .31, .043, .27);

  // Small data/service module: ribbed side panels and a discrete cooling unit.
  block("charcoal", .65, .22, .34, .57, .29, .53);
  for (let row = 0; row < 3; row++) {
    const y = .14 + row * .10;
    course("grey", .65, y, .61, .60, row);
    course("grey", .94, y, .34, .60, row, true);
  }
  for (let i = 0; i < 5; i++) block("navy", .432 + i * .105, .23, .686, .054, .22, .022);
  block("red", .65, .382, .68, .57, .034, .027);
  block("white", .65, .43, .34, .69, .05, .65);
  studs("grey", .425, .469, .11, 4, 1);
  block("charcoal", .67, .506, .35, .32, .10, .25);
  for (let i = 0; i < 4; i++) block("grey", .56 + i * .074, .565, .35, .035, .018, .21);

  // Recessed entry, shallow steps and a freestanding architectural identifier.
  block("navy", .10, .13, .08, .38, .09, .21);
  block("white", .10, .09, .20, .43, .035, .15);
  block("navy", .10, .37, .035, .50, .04, .30);
  for (const x of [-.51, .20]) block("grey", x, .17, .57, .11, .19, .13);
  block("charcoal", -.155, .29, .57, .92, .17, .12);
  block("white", -.155, .394, .57, .96, .035, .15);
  block("red", -.59, .29, .638, .035, .13, .018);
  studs("white", -.53, .427, .57, 6, 1);

  // Concealed system stack: generic floor modules, columns and restrained light rails.
  assembly = "interior";
  block("charcoal", .10, .62, -.59, .60, 1.06, .025);
  for (let level = 0; level < 4; level++) {
    const y = .145 + level * .26;
    block("grey", .10, y, -.35, .58, .035, .43);
    for (const x of [-.08, .18]) {
      block("navy", x, y + .068, -.39, .17, .095, .18);
      studs("grey", x, y + .129, -.39, 1, 1);
    }
    block("window", .10, y + .025, -.14, .47, .018, .025);
  }
  for (const x of [-.17, .37]) block("grey", x, .64, -.55, .035, 1.05, .035);
  const roles: Record<Role, Finish> = { body: "grey", dark: "charcoal", metal: "charcoal", accent: "navy", trim: "white", warm: "red", wood: "grey", glass: "glass", lamp: "window", hazard: "red" };
  upgradeExperience({
    d: createDetails({
      box: (role, position, size, rotation) => add(roles[role], position, size, false, rotation),
      knob: (role, position) => add(roles[role], position, [1, 1, 1], true),
    }),
    assembly: (name) => { assembly = name; },
    window: (position, size, rotation = [0, 0, 0]) => windowBay(position, size, rotation),
  });
  assembly = "fixed";
  finishMaterials(materials, { grey: "brick", white: "tile", navy: "brick", red: "brick", charcoal: "brick", window: "indicator", glass: "translucent" });
  return { brick, stud, materials, batches };
}
