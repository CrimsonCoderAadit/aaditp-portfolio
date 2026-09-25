import type { Details } from "./cityDetails";

/** Per-district architectural upgrades, authored in each district's own local
 * units on top of its existing kit. Each function receives the shared detail
 * vocabulary, the kit's assembly selector (so a detail travels with the moving
 * part it belongs to) and its built-window helper. Nothing here changes a
 * footprint: every element stays inside the measured plan bounds. */

type V3 = [number, number, number];
export type UpgradeContext<A extends string> = {
  d: Details;
  assembly: (name: A) => void;
  /** A recessed built window; front is local +Z unless turned. */
  window: (position: V3, size: V3, rotation?: V3, mullion?: boolean) => void;
};
const PI = Math.PI;

// ---------------------------------------------------------------------------
// PROJECTS — advanced engineering campus. The glazed bridge is the hero.
// ---------------------------------------------------------------------------
export function upgradeProjects({ d, assembly, window }: UpgradeContext<"fixed" | "roof" | "facade" | "tray">) {
  assembly("fixed");
  // Bridge: an exposed Warren truss along the front fascia, lit from below.
  const TOP = .93, BOT = .85, TZ = .197, X0 = .0, X1 = 1.0, BAYS = 8;
  d.box("metal", [(X0 + X1) / 2, TOP, TZ], [X1 - X0, .014, .014]);
  d.box("metal", [(X0 + X1) / 2, BOT, TZ], [X1 - X0, .014, .014]);
  for (let i = 0; i <= BAYS; i++) d.box("metal", [X0 + i * (X1 - X0) / BAYS, (TOP + BOT) / 2, TZ], [.012, TOP - BOT, .012]);
  for (let i = 0; i < BAYS; i++) {
    const a = X0 + i * (X1 - X0) / BAYS, b = a + (X1 - X0) / BAYS;
    d.line("accent", i % 2 ? [b, BOT, TZ] : [a, BOT, TZ], i % 2 ? [a, TOP, TZ] : [b, TOP, TZ], .012);
  }
  for (let i = 0; i < 5; i++) d.box("lamp", [.08 + i * .21, BOT - .012, TZ], [.016, .01, .016]);
  // Underside: cross-ribs and a keel beam beneath the deck.
  for (let i = 0; i < 9; i++) d.box("dark", [-.06 + i * .152, .945, .035], [.02, .03, .36]);
  d.box("metal", [.48, .935, .035], [1.24, .012, .02]);
  // Pylon bracing: crossed struts on the front face of each tower.
  for (const x of [.06, 1.06]) {
    d.line("metal", [x - .05, .17, .3], [x + .05, .8, .3], .012);
    d.line("metal", [x + .05, .17, .3], [x - .05, .8, .3], .012);
  }
  // Back face glazing, so the bridge reads as a glass tube from either side.
  for (let i = 0; i < 4; i++) window([.015 + i * .3, 1.117, -.135], [.247, .19, .049], [0, PI, 0]);
  for (let i = 0; i < 4; i++) d.box("trim", [.015 + i * .3, 1.016, .243], [.27, .012, .03]);
  // Roof: chord line, plant and a skylight run.
  d.box("metal", [.48, 1.286, .222], [1.24, .012, .012]);
  d.ac(.2, 1.279, .1); d.ac(.5, 1.279, .1); d.skylight(.35, 1.279, -.06, .2, .09); d.mast(.72, 1.279, -.1, .16, 1, "lamp");
  // Cantilevered observation terrace off the east end, braced back to the pylon.
  d.box("body", [1.29, .975, .035], [.32, .03, .36]);
  d.rail(1.13, .215, 1.44, .215, .99, .055, "accent");
  d.rail(1.44, -.145, 1.44, .215, .99, .055, "accent");
  d.rail(1.13, -.145, 1.44, -.145, .99, .055, "accent");
  d.line("metal", [1.1, .8, .12], [1.42, .965, .12], .016);
  d.line("metal", [1.1, .8, -.05], [1.42, .965, -.05], .016);
  d.box("wood", [1.34, 1.02, .035], [.1, .012, .1]);
  d.box("dark", [1.34, .995, .035], [.012, .04, .012]);
  d.lamp(1.42, .99, .19, .09);

  // Main hall: exterior stair up to a service landing, with a downpipe.
  d.stairs(-1.17, .088, -.62, 6, "+z", .11, .03, .04, "body");
  d.box("body", [-1.17, .255, -.365], [.14, .022, .13]);
  d.rail(-1.24, -.43, -1.24, -.3, .266, .05);
  d.rail(-1.24, -.3, -1.1, -.3, .266, .05);
  d.box("dark", [-1.09, .32, -.365], [.012, .11, .07]);
  d.pipe("metal", -1.092, .088, -.72, .5, "y");
  // Workshop and shed roofs: plant and stacks.
  d.ac(.62, .569, -.62); d.ac(.8, .569, -.62);
  for (const [x, z] of [[.95, -.62], [1.0, -.54]] as const) { d.pipe("metal", x, .569, z, .13, "y", .022); d.box("dark", [x, .705, z], [.04, .012, .04]); }
  d.vent(.3, .569, -.62, .07); d.vent(1.0, .426, .7, .07);
  // Service zone: cabinets, a hose reel and crates against the shed.
  d.cabinet(1.3, .088, .45); d.cabinet(1.3, .088, .55, .08, .1); d.ac(1.3, .088, -.5);
  d.box("warm", [1.24, .118, .3], [.07, .06, .07]); d.box("warm", [1.31, .118, .3], [.07, .06, .07]);
  d.pipe("metal", 1.26, .088, -.42, .3, "z");
  d.tree(-1.2, .088, .2, 1.05, "accent");

  // Work in progress by the fabrication shed, on the base plate in front of it:
  // a tool trolley, a stack of component crates, a small test rig, and hazard
  // lines at the door.
  const PLATE = .05;
  d.cabinet(1.0, PLATE, .835, .07, .06, .04);
  d.box("warm", [1.15, PLATE + .03, .83], [.06, .06, .06]); d.box("warm", [1.15, PLATE + .078, .83], [.044, .036, .044]); d.box("dark", [1.21, PLATE + .02, .85], [.04, .04, .04]);
  d.box("dark", [.64, PLATE + .01, .84], [.05, .02, .05]);
  d.line("metal", [.64, PLATE + .02, .84], [.66, PLATE + .075, .82], .012); d.line("metal", [.66, PLATE + .075, .82], [.7, PLATE + .065, .84], .01);
  d.box("accent", [.705, PLATE + .06, .84], [.016, .016, .016]);
  for (const x of [.6, .72, .84, .96]) d.box("hazard", [x, PLATE + .002, .77], [.06, .003, .014]);

  // Hall roof (lifts with the roof assembly): plant, skylight, railing and mast.
  assembly("roof");
  const ROOF = .992;
  d.ac(-.85, ROOF, -.24); d.ac(-.68, ROOF, -.24);
  d.rail(-.98, -.17, -.33, -.17, ROOF, .05);
  d.skylight(-.45, ROOF, -.65, .16, .07);
  d.mast(-.95, ROOF, -.66, .3);
  d.vent(-.36, ROOF, -.66, .06);
  d.pipe("metal", -.99, ROOF, -.45, .18, "z");
}

// ---------------------------------------------------------------------------
// EXPERIENCE — corporate technology tower: fins, mechanical floor, stepped crown.
// ---------------------------------------------------------------------------
export function upgradeExperience({ d, assembly }: UpgradeContext<"fixed" | "core" | "facade" | "crown" | "wing" | "interior" | "closedInfill">) {
  assembly("facade");
  for (let floor = 0; floor < 4; floor++) {
    const base = .10 + floor * .26;
    for (const x of [-.03, .10, .23]) d.box("trim", [x, base + .13, -.048], [.014, .2, .04]);
    d.box("trim", [.10, base + .222, -.045], [.62, .012, .075]);
    d.box("dark", [.10, base + .0555, -.045], [.6, .012, .03]);
  }
  assembly("fixed");
  // Mechanical floor on the west face: a louvre bank, and a duct riser.
  for (let i = 0; i < 7; i++) d.box("dark", [-.322, .5 + i * .03, -.4], [.014, .012, .38]);
  d.box("dark", [-.335, .61, -.62], [.03, .5, .05]);
  d.pipe("metal", -.35, .12, -.2, .95, "y", .018);
  for (const y of [.3, .56, .82]) d.box("trim", [-.35, y, -.2], [.03, .012, .03]);
  // Entrance: flagpoles, lamps and planters on the forecourt.
  for (const x of [-.6, .58]) { d.box("metal", [x, .29, .69], [.01, .42, .01]); d.box("accent", [x + .035, .43, .69], [.06, .04, .006]); }
  for (const x of [-.9, .9]) d.lamp(x, .088, .66, .14);
  d.planter(-.3, .088, .72, .2, .05); d.planter(.3, .088, .72, .2, .05);
  d.tree(.96, .088, .5, 1.05); d.tree(-.98, .088, .52, 1);
  d.stairs(.02, .088, .2, 3, "+z", .3, .012, .03, "trim");
  // Data module: extra plant and a cable ladder.
  d.ac(.48, .455, .38, .09, .07); d.cabinet(.98, .088, .6);

  // Occupied floors behind the tower's glazing: a lobby desk, a meeting table
  // with chairs, and a server room with lit racks, near the open front.
  assembly("interior");
  d.box("trim", [.25, .19, -.2], [.16, .05, .05]);
  d.box("trim", [.02, .71, -.2], [.16, .01, .07]); d.box("dark", [.02, .695, -.2], [.02, .025, .02]);
  for (const x of [-.08, .12]) d.knob("accent", [x, .692, -.2]);
  for (const x of [-.1, -.03]) {
    d.box("dark", [x, .99, -.2], [.05, .095, .045]);
    for (const y of [.965, .99, 1.015]) d.box("lamp", [x, y, -.176], [.03, .004, .002]);
  }
  assembly("fixed");

  assembly("wing");
  d.rail(-.97, .37, -.3, .37, .5665, .05);
  d.ac(-.9, .5665, -.45); d.ac(-.7, .5665, -.45); d.vent(-.46, .5665, -.42, .07);
  d.mast(-.98, .5665, -.1, .24, 1, "lamp");
  d.skylight(-.55, .5665, -.12, .18, .08);

  assembly("core");
  // The red service core: a machine-room penthouse, lit vertical slits and a lightning mast.
  d.box("warm", [.53, 1.575, -.4], [.2, .075, .25]);
  for (let i = 0; i < 4; i++) d.box("trim", [.53, 1.56 + i * .018, -.272], [.14, .006, .006]);
  for (let i = 0; i < 6; i++) d.box("lamp", [.598, .28 + i * .2, -.4 + (i % 2 ? .05 : -.05)], [.008, .09, .03]);
  d.mast(.53, 1.613, -.44, .22, 2, "hazard");
  d.ac(.53, 1.535, -.3, .08, .06);

  assembly("crown");
  // Stepped crown: an inset technical level, a roof deck and mechanical equipment.
  d.box("accent", [.12, 1.476, -.42], [.42, .07, .34]);
  d.box("trim", [.12, 1.522, -.42], [.46, .022, .38]);
  for (const x of [-.02, .08]) d.box("accent", [x, 1.577, -.5], [.09, .08, .1]);
  d.ac(.24, 1.533, -.32, .11, .08);
  d.cabinet(.3, 1.533, -.52, .07, .08);
  d.vent(-.02, 1.533, -.3, .07);
  d.mast(.3, 1.533, -.44, .32, 3);
  d.dish(-.03, 1.533, -.36, .1, .5);
  d.rail(-.11, -.24, .35, -.24, 1.533, .045);
  d.lamp(-.1, 1.533, -.6, .06); d.lamp(.34, 1.533, -.6, .06);
}

// ---------------------------------------------------------------------------
// RESEARCH — precision scientific facility. Low, calm, instrumented.
// ---------------------------------------------------------------------------
export function upgradeResearch({ d, assembly }: UpgradeContext<"fixed" | "chamber" | "core" | "interior">) {
  assembly("fixed");
  const CZ = -.055;
  // Radial paving: spokes across the apse's arc and a second, paler course.
  for (let i = -4; i <= 4; i++) {
    const a = i * PI / 8, x = Math.sin(a) * .40, z = Math.cos(a) * .40 + CZ;
    d.box("dark", [x, .078, z], [.012, .006, .17], [0, -a, 0]);
  }
  for (let i = -4; i <= 4; i++) {
    const a = (i + .5) * PI / 8, x = Math.sin(a) * .475, z = Math.cos(a) * .475 + CZ;
    d.box("trim", [x, .079, z], [.10, .008, .034], [0, a, 0]);
  }
  // Guide rails behind the chamber with a sensor carriage on them.
  for (const z of [-.365, -.385]) d.box("metal", [0, .086, z], [.66, .012, .012]);
  for (const x of [-.33, .33]) d.box("dark", [x, .09, -.375], [.02, .028, .05]);
  d.box("dark", [.14, .098, -.375], [.07, .03, .05]); d.box("accent", [.14, .12, -.375], [.04, .016, .03]);
  // Coolant lines from the west wing, valves picked out in cyan.
  d.pipe("metal", -.62, .088, -.37, .56, "x", .016);
  for (const x of [-.85, -.6, -.4]) d.box("accent", [x, .098, -.37], [.026, .02, .026]);
  // West wing roof: fume stacks, a mast and an air handler.
  const W = .3375;
  d.pipe("metal", -.44, W, -.05, .11, "y", .02); d.pipe("metal", -.40, W, -.02, .09, "y", .02);
  d.box("dark", [-.44, W + .115, -.05], [.036, .01, .036]);
  d.ac(-.67, W, .02, .09, .06);
  d.mast(-.95, W, -.03, .17, 1, "accent");
  // East wing roof: dome observatory, dish and sensor mast.
  const E = .268;
  d.box("body", [.62, E + .02, .0], [.11, .04, .11]); d.box("trim", [.62, E + .05, .0], [.085, .02, .085]); d.box("accent", [.62, E + .066, .012], [.05, .012, .03]);
  d.dish(.86, E, -.3, .08, -.4); d.mast(.88, E, -.05, .16, 1, "accent");
  d.rail(.5, .1, .96, .1, E, .04);
  // Forecourt lamps flank the entrance plaque.
  d.lamp(-.5, .076, .28, .1); d.lamp(.5, .076, .28, .1);

  // Service tubing from each wing into the chamber, and a maintenance gantry
  // with a hoist over the rear rails.
  for (const [x0, len] of [[-.39, .11], [.28, .11]] as const) {
    d.pipe("metal", x0 + len / 2, .2, -.15, len, "x", .01);
    d.pipe("trim", x0 + len / 2, .22, -.15, len, "x", .008);
  }
  for (const x of [-.33, .33]) d.box("metal", [x, .27, -.375], [.014, .42, .014]);
  d.box("metal", [0, .48, -.375], [.68, .016, .016]);
  d.box("dark", [.14, .462, -.375], [.04, .026, .03]); d.box("metal", [.14, .41, -.375], [.004, .08, .004]); d.box("accent", [.14, .366, -.375], [.02, .008, .02]);

  assembly("chamber");
  // Guide-post caps and cyan light rods over the apse.
  for (let i = -3; i <= 3; i++) {
    const a = i * PI / 4 - PI / 8;
    if (Math.abs(a) > PI * .6) continue;
    const r = .296, x = Math.sin(a) * r, z = Math.cos(a) * r + CZ;
    d.box("trim", [x, .49, z], [.04, .012, .04]);
    d.box("accent", [x, .51, z], [.014, .04, .014]);
  }
  // Panel-frame collars mid-height.
  for (const i of [-2, -1, 0, 1, 2]) {
    const a = i * PI / 4, x = Math.sin(a) * .29, z = Math.cos(a) * .29 + CZ;
    d.box("metal", [x, .315, z], [.21, .01, .012], [0, a, 0]);
  }

  assembly("core");
  // The instrument on the platform: a lens arch, corner lights and a scan head.
  d.box("metal", [0, .27, CZ], [.2, .012, .014]);
  for (const x of [-.098, .098]) d.box("metal", [x, .235, CZ], [.014, .07, .014]);
  d.box("accent", [0, .32, CZ], [.05, .035, .05]);
  for (const x of [-.16, .16]) for (const z of [-.13, .13]) d.box("accent", [x, .152, CZ + z], [.014, .012, .014]);
  d.box("trim", [0, .302, CZ], [.09, .006, .09]);
}

// ---------------------------------------------------------------------------
// SKILLS — industrial fabrication district: gantry, bays, plant, pipe rack.
// ---------------------------------------------------------------------------
export function upgradeSkills({ d, assembly }: UpgradeContext<"fixed" | "doors" | "roof" | "wing" | "interior">) {
  assembly("fixed");
  const YARD = .0785;
  // Gantry: braced pylons, a catwalk with rails and a ladder.
  for (const x of [.03, .75]) {
    d.line("metal", [x - .055, .16, .3], [x + .055, .62, .3], .012);
    d.line("metal", [x + .055, .16, .3], [x - .055, .62, .3], .012);
  }
  d.box("dark", [.39, .68, .335], [.78, .012, .06]);
  d.rail(.0, .365, .78, .365, .686, .05);
  d.ladder(.66, .09, .305, .59);
  for (const x of [.09, .69]) d.box("accent", [x, .655, .296], [.05, .02, .01]);
  d.box("metal", [.39, .795, .23], [.86, .008, .05]);
  // Door surround: safety-yellow jambs and a header beam; a beacon on top.
  for (const x of [-.665, -.195]) d.box("accent", [x, .26, .132], [.03, .3, .05]);
  d.box("accent", [-.43, .445, .132], [.5, .03, .05]);
  d.box("dark", [-.43, .475, .132], [.04, .03, .04]); d.box("lamp", [-.43, .5, .132], [.024, .022, .024]);
  for (const x of [-.7, -.16]) d.lamp(x, .305, .16, .05);
  // The yard in front of the hall is kept clear for the skill bays (skillBays.ts).
  // Open pipe rack in the yard: posts, beams, three runs and diagonal braces.
  const RX0 = .6, RX1 = .86, RZ0 = .46, RZ1 = .66, RH = .3;
  for (const x of [RX0, RX1]) for (const z of [RZ0, RZ1]) d.box("metal", [x, YARD + RH / 2, z], [.02, RH, .02]);
  for (const y of [.15, RH]) for (const x of [RX0, RX1]) d.box("metal", [x, YARD + y, (RZ0 + RZ1) / 2], [.02, .02, RZ1 - RZ0]);
  for (const z of [RZ0, RZ1]) d.line("metal", [RX0, YARD + .02, z], [RX1, YARD + RH - .02, z], .012);
  for (const [i, role] of ["accent", "trim", "dark"].entries()) d.box(role as "accent", [(RX0 + RX1) / 2 + .1, YARD + RH + .022 + i * .0, RZ0 + .04 + i * .06], [.5, .02, .02]);
  d.box("dark", [.78, YARD + .12, .8], [.12, .12, .1]);

  // An extract duct runs down the hall's west wall on brackets.
  d.box("metal", [-.875, .42, -.1], [.04, .04, .42]);
  for (const z of [-.26, -.1, .06]) d.box("dark", [-.852, .42, z], [.012, .05, .012]);
  d.box("metal", [-.875, .26, .09], [.04, .32, .04]);

  assembly("roof");
  // Monitor roofs: extractor vents at each stage, and plant on the front strip.
  for (let i = 0; i < 3; i++) d.vent(-.08, .51 + i * .035 + .075, -.265 + i * .16, .06, .05);
  d.ac(-.66, .5005, .15, .09, .07); d.ac(-.2, .5005, .15, .09, .07);
  d.pipe("metal", -.3, .5005, .12, .08, "y", .02);

  assembly("wing");
  // Machinery bays: roll-up doors with hazard headers, then roof plant.
  for (const x of [.07, .21, .35]) {
    d.box("dark", [x, .2, .066], [.11, .17, .012]);
    for (let i = 0; i < 4; i++) d.box("trim", [x, .14 + i * .04, .074], [.095, .008, .006]);
    d.box("accent", [x, .296, .07], [.12, .014, .02]);
  }
  d.vent(.4, .245, .07, .04);
  d.ac(.4, .407, .02, .11, .08);
  d.pipe("metal", .1, .407, -.32, .13, "y", .022); d.box("dark", [.1, .545, -.32], [.045, .012, .045]);
  d.box("dark", [.33, .452, -.2], [.16, .09, .13]); d.knob("metal", [.3, .5, -.2]); d.knob("metal", [.36, .5, -.2]);
  d.rail(-.02, .06, .44, .06, .407, .04);
}

// ---------------------------------------------------------------------------
// ABOUT — a warm, personal studio-home: pergola, balcony, dormer, chimney.
// ---------------------------------------------------------------------------
export function upgradeAbout({ d, window, assembly }: UpgradeContext<"fixed" | "roof" | "front">) {
  // Pitched, stepped roof over the upper room, with a dormer and a chimney.
  assembly("roof");
  d.box("dark", [-.34, .776, .135], [.72, .012, .014]);
  d.box("warm", [-.34, .848, -.10], [.62, .04, .40]);
  d.box("warm", [-.34, .888, -.10], [.50, .04, .32]);
  d.box("warm", [-.34, .928, -.10], [.38, .04, .24]);
  d.box("wood", [-.34, .9665, -.10], [.26, .037, .16]);
  d.box("trim", [-.34, .997, -.10], [.30, .02, .05]);
  d.box("body", [-.34, .913, .05], [.18, .09, .09]);
  d.box("warm", [-.34, .966, .05], [.21, .02, .12]);
  window([-.34, .915, .098], [.11, .06, .03]);
  d.box("dark", [-.55, .95, -.19], [.07, .22, .07]);
  d.box("body", [-.55, 1.07, -.19], [.09, .02, .09]);
  d.box("trim", [-.55, 1.09, -.19], [.03, .05, .03]);
  assembly("fixed");
  // Balcony on the first-floor roof: rail, pots and a small chair.
  d.rail(-.66, .195, .10, .195, .5175, .05, "dark");
  d.rail(-.66, -.04, -.66, .195, .5175, .05, "dark");
  d.rail(.10, -.04, .10, .195, .5175, .05, "dark");
  d.planter(-.52, .5175, .16, .12, .05); d.planter(-.2, .5175, .16, .12, .05);
  d.box("wood", [-.34, .5335, .1], [.06, .012, .06]); d.box("wood", [-.34, .56, .07], [.06, .05, .012]);
  // Wing: a proper front door with a step and porch lamp, window box and a downpipe.
  d.box("trim", [.555, .155, .188], [.1, .19, .012]);
  d.box("wood", [.555, .152, .196], [.08, .17, .012]);
  d.box("lamp", [.6, .245, .2], [.016, .02, .016]);
  d.box("body", [.555, .09, .225], [.12, .03, .07]);
  d.planter(.39, .235, .205, .2, .04);
  d.pipe("dark", .585, .1, .12, .35, "y", .012);
  // Patio pergola: posts, beams, slats, string lights and a table set.
  for (const x of [.14, .6]) for (const z of [.12, .36]) d.box("wood", [x, .215, z], [.02, .28, .02]);
  for (const z of [.12, .36]) d.box("wood", [.37, .365, z], [.5, .02, .03]);
  for (let i = 0; i < 6; i++) d.box("wood", [.16 + i * .09, .38, .24], [.016, .012, .26]);
  for (let i = 0; i < 6; i++) d.box("lamp", [.17 + i * .085, .348, .36], [.012, .012, .012]);
  d.box("wood", [.37, .17, .24], [.14, .016, .14]); d.box("dark", [.37, .12, .24], [.02, .08, .02]);
  for (const x of [.27, .47]) d.box("body", [x, .12, .24], [.05, .05, .05]);
  d.box("accent", [.14, .27, .105], [.03, .2, .012]); d.box("accent", [.6, .3, .375], [.03, .18, .012]);
  // A telescope on a tripod at the patio corner: personal, and slightly asymmetrical.
  d.line("metal", [.62, .075, .33], [.65, .19, .34], .008); d.line("metal", [.66, .075, .31], [.65, .19, .34], .008); d.line("metal", [.63, .075, .37], [.65, .19, .34], .008);
  d.line("dark", [.64, .18, .34], [.68, .27, .30], .022);
  // Front garden: hedge and mailbox, a tree, a bench and a bird bath.
  for (let i = 0; i < 5; i++) d.box("accent", [-.83 + i * .1, .075, .35], [.09, .06, .05]);
  for (let i = 0; i < 9; i++) d.knob(i % 3 ? "warm" : "trim", [-.86 + i * .05, .108, .35 + (i % 2 ? .01 : -.01)]);
  d.box("wood", [-.9, .1, .3], [.014, .1, .014]); d.box("dark", [-.9, .17, .3], [.06, .04, .05]); d.box("warm", [-.87, .19, .3], [.006, .04, .012]);
  d.tree(-.8, .05, -.25, 1.15, "accent");
  d.box("wood", [.0, .095, .34], [.16, .016, .05]); d.box("dark", [-.06, .07, .34], [.012, .05, .04]); d.box("dark", [.06, .07, .34], [.012, .05, .04]);
  d.box("body", [-.05, .09, .26], [.04, .06, .04]); d.box("body", [-.05, .13, .26], [.08, .014, .08]);
  d.tree(.63, .075, -.3, 1.05, "accent");
  d.lamp(-.16, .048, .33, .1);
}

// ---------------------------------------------------------------------------
// ACHIEVEMENTS — civic monument: pedestal tiers, fins, banners, uplights.
// ---------------------------------------------------------------------------
export function upgradeAchievements({ d }: UpgradeContext<"fixed">) {
  // Pedestal tiers flaring out of the shaft base, and brass bands up the shaft.
  d.box("dark", [0, .087, -.18], [.34, .03, .34]);
  d.box("trim", [0, .114, -.18], [.28, .024, .28]);
  for (const y of [.28, .58, .78]) d.box("accent", [0, y, -.18], [.215, .012, .215]);
  // Taller flanking fins and small brass studs on the fin plinths.
  for (const a of [-1.15, 1.15]) d.box("accent", [.155 * Math.sin(a), .34, -.18 + .155 * Math.cos(a)], [1.05, 1.7, 1.05], [0, a, 0], "fin");
  // Ceremonial paving: a diamond field of alternating tiles between the walk and the gate.
  for (let i = -2; i <= 2; i++) for (let j = 0; j < 2; j++) {
    const x = i * .105 + (j % 2 ? .052 : 0), z = .205 + j * .06;
    if (Math.abs(x) > .2) continue;
    d.box((i + j) % 2 ? "dark" : "trim", [x, .078, z], [.07, .01, .07], [0, PI / 4, 0]);
  }
  d.knob("accent", [0, .092, .235]);
  // Flagpoles and burgundy banners flanking the gate, with plinth lamps.
  for (const x of [-.255, .255]) {
    d.box("metal", [x, .34, .11], [.008, .54, .008]);
    d.box("warm", [x + (x < 0 ? .03 : -.03), .52, .11], [.05, .09, .006]);
    d.box("dark", [x, .085, .11], [.04, .026, .04]);
  }
  for (const [x, z] of [[-.25, .28], [.25, .28], [-.25, -.28], [.25, -.28]] as const) d.lamp(x, .072, z, .07);
  // Up-lights washing the shaft from its base.
  for (const x of [-.13, .13]) d.box("lamp", [x, .108, -.05], [.03, .014, .018]);
  // Sculptural top: four slender posts and a square ring frame the trophy, tied by braces.
  const R = .09, RY = 1.11;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) d.line("accent", [sx * .11, .96, -.18 + sz * .11], [sx * R, RY, -.18 + sz * R], .012);
  for (const s of [-1, 1]) {
    d.box("accent", [0, RY, -.18 + s * R], [R * 2 + .012, .01, .01]);
    d.box("accent", [s * R, RY, -.18], [.01, .01, R * 2 + .012]);
  }
  for (const [x, z] of [[-R, -R], [R, -R], [R, R], [-R, R]] as const) d.knob("accent", [x, RY + .009, -.18 + z]);
  // Ceremonial approach on the plaza: a pale strip on the axis and inset floor lights.
  d.box("trim", [0, .0015, .4], [.14, .003, .08]);
  for (const x of [-.36, .36]) for (const z of [.1, .38]) d.box("lamp", [x, .002, z], [.016, .004, .016]);
}

// ---------------------------------------------------------------------------
// CONTACT — the most technically complex building: blades, decks, dishes, terrace.
// ---------------------------------------------------------------------------
export function upgradeContact({ d }: UpgradeContext<"fixed">) {
  // Podium: entrance fins, lamps and a roof terrace with rail, plant and planters.
  for (const x of [-.24, .24]) d.box("trim", [x, .14, .445], [.02, .2, .06]);
  for (const x of [-.34, .34]) d.lamp(x, .04, .56, .1);
  d.rail(-.43, .385, .43, .385, .32, .05);
  d.rail(-.43, -.43, -.43, .385, .32, .05);
  d.rail(.43, -.43, .43, .385, .32, .05);
  d.ac(.35, .32, -.2); d.ac(.35, .32, -.08, .09, .07); d.ac(-.35, .32, -.12, .09, .07); d.cabinet(.36, .32, .06);
  d.planter(0, .32, .32, .22, .05);
  // Lower tower: vertical blades give the banded shaft a structural rhythm.
  const L0 = .32, LH = .8, LZ = -.05;
  for (const x of [-.18, -.06, .06, .18]) d.box("trim", [x, L0 + LH / 2, LZ + .212 + .0], [.014, LH, .02]);
  for (const z of [-.13, .03]) for (const s of [-1, 1]) d.box("trim", [s * .292, L0 + LH / 2, LZ + z + .0], [.02, LH, .014]);
  // Mid tower: X-bracing on the north and south faces, tied to the east/west bracing.
  const M0 = 1.15, MF = .092, MZ = -.06;
  for (const sz of [-1, 1]) for (const [y0, y1] of [[M0, M0 + MF * 2.5], [M0 + MF * 2.5, M0 + MF * 5]]) {
    const z = MZ + sz * (.19 + .018);
    d.line("metal", [-.19, y0 + .01, z], [.19, y1 - .01, z], .014);
    d.line("metal", [.19, y0 + .01, z], [-.19, y1 - .01, z], .014);
  }
  // Terrace and deck on the west face: a second antenna deck mirroring the east one.
  const deckY = M0 + MF * 2.5 + .2;
  d.box("trim", [-.26, deckY, MZ + .02], [.18, .018, .2]);
  for (const z of [MZ - .075, MZ + .115]) d.box("metal", [-.34, deckY + .035, z], [.008, .05, .008]);
  d.box("metal", [-.34, deckY + .06, MZ + .02], [.008, .008, .2]);
  for (const z of [MZ - .04, MZ + .02, MZ + .08]) d.box("trim", [-.235, deckY + .07, z], [.012, .12, .035]);
  d.dish(-.3, deckY + .009, MZ + .07, .085, PI / 2);
  d.line("metal", [-.22, deckY - .09, MZ + .02], [-.32, deckY - .01, MZ + .02], .014);
  // Upper tower: technical terrace, cable risers and cabinets.
  const U0 = 1.63;
  d.box("trim", [0, U0 + .16, -.06], [.42, .012, .38]);
  d.rail(-.21, .13, .21, .13, U0 + .166, .04);
  d.cabinet(.14, U0 + .166, .09, .07, .08); d.cabinet(-.14, U0 + .166, .09, .07, .08);
  for (const x of [-.17, .17]) d.box("metal", [x, U0 + .08, -.06 + .17], [.01, .16, .01]);
  // Crown: static dishes, panel horns, warning lights and a lattice ring.
  const U1 = 1.93;
  d.dish(-.19, U1 + .024, .06, .085, .4);
  d.dish(.18, U1 + .024, -.22, .085, -.5);
  d.dish(-.2, U1 + .024, -.14, .07, 1.2);
  for (const [x, z] of [[.05, 0], [-.05, 0], [0, .05], [0, -.05]] as const) d.box("trim", [x, U1 + .26, -.06 + z], [.032, .028, .05], [0, Math.atan2(x, z || 1e-6) || 0, 0]);
  for (const y of [U1 + .28, U1 + .5]) d.box("lamp", [0, y, -.06 + .012], [.014, .014, .014]);
  d.box("hazard", [.05, U1 + .3, -.06], [.012, .012, .012]); d.box("hazard", [-.05, U1 + .3, -.06], [.012, .012, .012]);
  d.box("metal", [0, U1 + .26, -.06], [.16, .01, .01]); d.box("metal", [0, U1 + .26, -.06], [.01, .01, .16]);
  // Service access: a ladder up the upper tower, a cable riser on the east face
  // and a microwave dish on the podium roof.
  d.ladder(.1, U0, .107, .3);
  d.box("dark", [.302, .72, .12], [.016, .8, .016]);
  d.dish(-.3, .32, .22, .07, .5);
}
