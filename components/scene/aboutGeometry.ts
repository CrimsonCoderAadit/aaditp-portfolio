import { CylinderGeometry, MeshStandardMaterial, SphereGeometry } from "three";
import { createMoldedBoxGeometry } from "./brickGeometry/moldedEdges";
import { CITY_NEUTRALS } from "./cityPalette";
import { finishMaterials, translucentPlastic } from "./materialClasses";
import { builtWindow } from "./brickGeometry/builtWindow";
import type { BrickPart } from "./BrickInstances";
import { createDetails, type Role } from "./cityDetails";
import { upgradeAbout } from "./districtUpgrades";

type Finish = "cream" | "green" | "terracotta" | "tan" | "brown" | "charcoal" | "window" | "glass";
/** The studio opens as a diorama: the roof lifts and the front glazing rises. */
export type AboutAssembly = "fixed" | "roof" | "front";
type Batch = { finish: Finish; stud: boolean; assembly: AboutAssembly; parts: BrickPart[] };

export function createAboutKit() {
  const brick = createMoldedBoxGeometry();
  const stud = new CylinderGeometry(.046, .049, .028, 16);
  const football = new SphereGeometry(.065, 12, 8);
  const materials = {
    cream: new MeshStandardMaterial({ color: CITY_NEUTRALS.offWhite, roughness: .34 }),
    green: new MeshStandardMaterial({ color: "#596e58", roughness: .38 }),
    terracotta: new MeshStandardMaterial({ color: "#9b5945", roughness: .36 }),
    tan: new MeshStandardMaterial({ color: "#a88a61", roughness: .40 }),
    brown: new MeshStandardMaterial({ color: "#4c3c32", roughness: .42 }),
    charcoal: new MeshStandardMaterial({ color: CITY_NEUTRALS.charcoal, roughness: .40 }),
    window: new MeshStandardMaterial({ color: "#b68a5b", emissive: "#f2bf83", emissiveIntensity: .09 }),
    glass: translucentPlastic("#b68a5b", .72),
  };
  const batches: Batch[] = [];
  let assembly: AboutAssembly = "fixed";
  const add = (finish: Finish, position: BrickPart["position"], size: BrickPart["size"], isStud = false, rotation?: BrickPart["rotation"]) => {
    let batch = batches.find((b) => b.finish === finish && b.stud === isStud && b.assembly === assembly);
    if (!batch) { batch = { finish, stud: isStud, assembly, parts: [] }; batches.push(batch); }
    batch.parts.push(rotation ? { position, size, rotation } : { position, size });
  };
  const block = (finish: Finish, x: number, y: number, z: number, w: number, h: number, d: number) => add(finish, [x, y, z], [w, h, d]);
  const windowBay = (position: BrickPart["position"], size: BrickPart["size"], mullion = false) => {
    const bay = builtWindow(position, size, [0, 0, 0], mullion);
    bay.frame.forEach((part) => add("green", part.position, part.size));
    add("glass", bay.glass.position, bay.glass.size);
  };
  const studs = (finish: Finish, x: number, y: number, z: number, nx: number, nz = 1) => {
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) add(finish, [x + i * .15, y, z + j * .15], [1, 1, 1], true);
  };
  const course = (finish: Finish, x: number, y: number, z: number, length: number, row: number, side = false) => {
    for (let offset = 0; offset < length - .001;) {
      const width = Math.min(offset === 0 && row % 2 ? .15 : .30, length - offset);
      const p = offset + width / 2 - length / 2;
      block(finish, x + (side ? 0 : p), y, z + (side ? p : 0), side ? .11 : width - .008, .092, side ? width - .008 : .11);
      offset += width;
    }
  };

  // Small local base, patio and planted edge: a landmark-sized plot, not another district.
  block("charcoal", 0, .024, 0, 1.38, .048, .76);
  block("tan", .37, .061, .24, .58, .028, .29);
  block("green", -.48, .062, .25, .28, .03, .22);
  studs("green", -.57, .094, .17, 2, 2);
  for (let i = 0; i < 4; i++) block("cream", -.83 + i * .22, .065, -.31, .20, .03, .15);

  // Compact two-storey studio with an asymmetrical upper room.
  block("brown", -.27, .12, -.10, .76, .08, .48);
  for (let row = 0; row < 4; row++) {
    const y = .17 + row * .10;
    // Retain the wall envelope, but leave a real opening behind the front glazing.
    if (row === 1 || row === 2) {
      for (const x of [-.58, .04]) block("cream", x, y, .125, .152, .092, .11);
    } else course("cream", -.27, y, .125, .78, row);
    course("cream", -.63, y, -.10, .46, row, true);
    course(row === 1 ? "green" : "cream", -.27, y, -.34, .78, row);
  }
  // Warm front glazing and a green structural frame make the interior readable from the hero view.
  assembly = "front";
  windowBay([-.27, .35, .185], [.46, .20, .06], true);
  assembly = "fixed";
  block("terracotta", -.27, .49, .13, .82, .055, .14);
  block("terracotta", -.67, .35, .13, .055, .38, .12);
  block("terracotta", .13, .35, .13, .055, .38, .12);
  // Set-back second floor and stepped roof.
  for (let row = 0; row < 2; row++) {
    const y = .56 + row * .10;
    if (row === 1) {
      for (const x of [-.555, -.125]) block("cream", x, y, -.10, .134, .092, .11);
    } else course("cream", -.34, y, -.10, .58, row);
    course("green", -.61, y, -.10, .35, row, true);
    course("cream", -.34, y, -.28, .58, row);
  }
  // Seat the former floating pane in the existing wall, without a projecting bay.
  windowBay([-.34, .68, -.05], [.30, .14, .055], true);
  assembly = "roof";
  block("terracotta", -.34, .80, -.10, .70, .055, .46);
  assembly = "fixed";

  // Attached one-storey workspace wing and a quiet books-and-plants edge.
  block("brown", .39, .13, -.07, .38, .10, .39);
  for (let row = 0; row < 3; row++) {
    const y = .19 + row * .10;
    if (row === 1) {
      for (const x of [.225, .555]) block("terracotta", x, y, .13, .064, .092, .11);
    } else course("tan", .39, y, .13, .40, row);
    course("brown", .57, y, -.07, .38, row, true);
  }
  windowBay([.39, .30, .165], [.26, .12, .044]);
  block("tan", .39, .45, -.07, .48, .045, .45);
  studs("tan", .22, .49, -.22, 3, 1);
  for (let i = 0; i < 3; i++) block("brown", .59, .22 + i * .07, .17, .08, .045, .13);

  // Sparse personal cues: desk, monitor, chessboard and a small planter.
  block("brown", -.27, .235, .215, .34, .035, .10);
  block("charcoal", -.27, .17, .215, .025, .13, .025);
  block("charcoal", -.08, .17, .215, .025, .13, .025);
  block("charcoal", -.27, .315, .214, .15, .10, .025);
  block("window", -.27, .32, .198, .11, .055, .018);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) block((i + j) % 2 ? "brown" : "cream", .25 + i * .055, .102, .20 + j * .055, .05, .022, .05);
  block("brown", -.54, .14, .26, .10, .10, .10);
  studs("green", -.57, .215, .23, 2, 1);
  block("green", -.50, .265, .23, .04, .10, .04);
  block("green", -.59, .28, .20, .04, .06, .04);

  // Understated physical sign marker.
  block("brown", -.66, .13, .31, .08, .12, .08);
  block("cream", -.66, .22, .31, .47, .11, .065);
  studs("cream", -.84, .287, .31, 3);
  const roles: Record<Role, Finish> = { body: "cream", dark: "charcoal", metal: "charcoal", accent: "green", trim: "cream", warm: "terracotta", wood: "brown", glass: "glass", lamp: "window", hazard: "tan" };
  upgradeAbout({
    d: createDetails({
      box: (role, position, size, rotation) => add(roles[role], position, size, false, rotation),
      knob: (role, position) => add(roles[role], position, [1, 1, 1], true),
    }),
    assembly: (name) => { assembly = name; },
    window: (position, size, rotation = [0, 0, 0], mullion = false) => {
      const bay = builtWindow(position, size, rotation, mullion);
      bay.frame.forEach((part) => add("green", part.position, part.size, false, part.rotation));
      add("glass", bay.glass.position, bay.glass.size, false, bay.glass.rotation);
    },
  });
  assembly = "fixed";
  const footballMaterial = new MeshStandardMaterial({ color: "#273127", roughness: .70 });
  finishMaterials(materials, { cream: "tile", green: "brick", terracotta: "brick", tan: "brick", brown: "brick", charcoal: "brick", window: "indicator", glass: "translucent" });
  return { brick, stud, football, footballMaterial, materials, batches };
}
