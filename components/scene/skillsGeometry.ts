import { CylinderGeometry, MeshStandardMaterial } from "three";
import { createMoldedBoxGeometry } from "./brickGeometry/moldedEdges";
import { CITY_NEUTRALS } from "./cityPalette";
import { finishMaterials, translucentPlastic } from "./materialClasses";
import { createPartLibrary } from "./brickGeometry/parts";
import { builtWindow } from "./brickGeometry/builtWindow";
import type { BrickPart } from "./BrickInstances";
import { createDetails, type Role } from "./cityDetails";
import { upgradeSkills } from "./districtUpgrades";

type Finish = "dark" | "grey" | "yellow" | "orange" | "silver" | "window" | "glass";
type Form = "technicalBeam" | "offsetPlate";
export type SkillsAssembly = "fixed" | "doors" | "roof" | "wing" | "interior";
type Batch = { finish: Finish; stud: boolean; form?: Form; assembly: SkillsAssembly; parts: BrickPart[] };

export function createSkillsKit() {
  const brick = createMoldedBoxGeometry();
  const stud = new CylinderGeometry(.046, .049, .028, 16);
  const partLibrary = createPartLibrary();
  const forms = {
    technicalBeam: partLibrary.get("technicalBeam", [.292, .072, .15]),
    offsetPlate: partLibrary.get("offsetPlate", [.28, .05, .24]),
  };
  const materials = {
    dark: new MeshStandardMaterial({ color: CITY_NEUTRALS.charcoal, roughness: .36 }),
    grey: new MeshStandardMaterial({ color: CITY_NEUTRALS.structural, roughness: .38 }),
    yellow: new MeshStandardMaterial({ color: "#bb9849", roughness: .32 }),
    orange: new MeshStandardMaterial({ color: "#a36540", roughness: .34 }),
    silver: new MeshStandardMaterial({ color: CITY_NEUTRALS.architectural, roughness: .32, metalness: .12 }),
    window: new MeshStandardMaterial({ color: "#796b4f", emissive: "#f2c78c", emissiveIntensity: .08 }),
    glass: translucentPlastic("#796b4f", .72),
  };
  const batches: Batch[] = [];
  let assembly: SkillsAssembly = "fixed";
  const block = (finish: Finish, x: number, y: number, z: number, w: number, h: number, d: number, isStud = false, form?: Form, rotation?: BrickPart["rotation"]) => {
    let batch = batches.find((b) => b.finish === finish && b.stud === isStud && b.form === form && b.assembly === assembly);
    if (!batch) { batch = { finish, stud: isStud, form, assembly, parts: [] }; batches.push(batch); }
    batch.parts.push(rotation ? { position: [x, y, z], size: [w, h, d], rotation } : { position: [x, y, z], size: [w, h, d] });
  };
  const windowBay = (position: BrickPart["position"], size: BrickPart["size"]) => {
    const bay = builtWindow(position, size);
    bay.frame.forEach((part) => block("silver", ...part.position, ...part.size));
    block("glass", ...bay.glass.position, ...bay.glass.size);
  };
  const studs = (finish: Finish, x: number, y: number, z: number, nx: number, nz = 1) => {
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) block(finish, x + i * .15, y, z + j * .15, 1, 1, 1, true);
  };
  const course = (finish: Finish, x: number, y: number, z: number, length: number, row: number, side = false) => {
    for (let offset = 0; offset < length - .001;) {
      const width = Math.min(offset === 0 && row % 2 ? .15 : .30, length - offset);
      const p = offset + width / 2 - length / 2;
      block(finish, x + (side ? 0 : p), y, z + (side ? p : 0), side ? .11 : width - .008, .092, side ? width - .008 : .11);
      offset += width;
    }
  };
  // Local layered base, tiled loading yard and exposed attachment zones.
  for (const x of [-.45, .45]) block("dark", x, .024, 0, .892, .048, .85);
  block("grey", 0, .061, -.08, 1.74, .026, .64);
  for (let i = 0; i < 6; i++) block("grey", -.75 + i * .30, .063, .31, .29, .031, .19);
  studs("dark", -.825, .065, -.365, 12);
  studs("grey", -.825, .092, .355, 3);

  // Fabrication hall: bonded masonry, a recessed shutter, and stepped monitor roofs.
  block("dark", -.43, .28, -.11, .76, .40, .44);
  for (let row = 0; row < 4; row++) {
    const y = .125 + row * .10;
    course(row === 0 ? "orange" : "grey", -.43, y, -.325, .75, row);
    course("grey", -.79, y, -.10, .45, row, true);
    for (const x of [-.72, -.14]) block(row === 0 ? "yellow" : "grey", x, y, .14, .12, .092, .12);
  }
  assembly = "doors";
  block("dark", -.43, .25, .122, .43, .26, .04);
  for (let i = 0; i < 5; i++) block("silver", -.43, .155 + i * .048, .15, .405, .026, .027);
  windowBay([-.43, .404, .149], [.40, .038, .035]);
  assembly = "fixed";
  assembly = "roof";
  block("orange", -.43, .468, .14, .76, .065, .15);
  for (let i = 0; i < 3; i++) {
    const z = -.265 + i * .16;
    const y = .51 + i * .035;
    block("dark", -.43, y, z, .84, .035, .153);
    windowBay([-.43, y + .034, z + .06], [.64, .035, .025]);
    block("grey", -.43, y + .063, z, .82, .024, .15);
    studs("grey", -.73, y + .089, z, 5);
  }
  assembly = "fixed";
  // Steel machinery wing with a small orange identification band.
  assembly = "wing";
  for (let row = 0; row < 3; row++) {
    course("grey", .21, .125 + row * .10, -.31, .45, row);
    course(row === 0 ? "orange" : "silver", .21, .125 + row * .10, .005, .45, row);
  }
  block("dark", .21, .386, -.15, .53, .042, .43);
  studs("grey", .065, .422, -.225, 3, 2);
  assembly = "fixed";
  block("grey", .66, .202, -.20, .30, .25, .29);
  for (let i = 0; i < 4; i++) block("silver", .548 + i * .075, .213, -.044, .028, .19, .03);
  block("dark", .66, .346, -.20, .35, .038, .34);
  studs("dark", .585, .38, -.275, 2, 2);
  block("silver", -.64, .70, -.24, .17, .10, .13);
  for (const x of [-.70, -.64, -.58]) block("dark", x, .758, -.24, .022, .014, .12);

  // Brick gantry spans the yard: two coursed pylons, rigid beam and trolley rail.
  for (const x of [.03, .75]) {
    block("dark", x, .102, .23, .20, .06, .24);
    for (let row = 0; row < 5; row++) block(row === 0 ? "yellow" : "grey", x, .18 + row * .10, .23, .12, .092, .13);
    block("grey", x, .65, .23, .19, .045, .19);
  }
  for (let i = 0; i < 3; i++) {
    if (i === 1) block("grey", .39, .709, .23, 1, 1, 1, false, "technicalBeam");
    else block("grey", .09 + i * .30, .709, .23, .292, .072, .15);
  }
  block("silver", .39, .752, .23, .92, .018, .055);
  studs("yellow", .015, .76, .18, 6);
  // A fixed tool pallet underneath, not another animated mechanism.
  block("dark", .37, .104, .21, 1, 1, 1, false, "offsetPlate");
  for (const x of [.29, .44]) block("grey", x, .164, .21, .135, .065, .20);
  studs("grey", .29, .212, .21, 2);
  // Blank fabrication platform and three modular tool sockets, hidden inside the closed hall.
  assembly = "interior";
  block("dark", -.12, .13, .02, .64, .055, .34);
  block("silver", -.12, .18, .02, .58, .025, .28);
  for (const x of [-.31, -.12, .07]) {
    block("yellow", x, .225, .02, .11, .07, .12);
    studs("silver", x - .04, .274, -.02, 1, 1);
    block("orange", x, .31, .02, .055, .07, .055);
  }
  block("grey", -.12, .365, -.17, .70, .035, .035);
  block("grey", -.12, .365, .21, .70, .035, .035);
  const roles: Record<Role, Finish> = { body: "grey", dark: "dark", metal: "silver", accent: "yellow", trim: "silver", warm: "orange", wood: "orange", glass: "glass", lamp: "window", hazard: "yellow" };
  upgradeSkills({
    d: createDetails({
      box: (role, [x, y, z], [w, h, dd], rotation) => block(roles[role], x, y, z, w, h, dd, false, undefined, rotation),
      knob: (role, [x, y, z]) => block(roles[role], x, y, z, 1, 1, 1, true),
    }),
    assembly: (name) => { assembly = name; },
    window: (position, size) => windowBay(position, size),
  });
  assembly = "fixed";
  finishMaterials(materials, { dark: "brick", grey: "brick", yellow: "brick", orange: "brick", silver: "paintedMetal", window: "indicator", glass: "translucent" });
  return { brick, stud, materials, batches, forms, partLibrary };
}
