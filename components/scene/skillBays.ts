import { SKILL_CATEGORIES } from "../content/skills";
import type { Marker, MarkerPart, MarkerStyle, V3 } from "./SectionMarkers";

/** Workshop finishes: charcoal and steel with the district's orange and amber. */
export const BAY_STYLE: MarkerStyle = {
  finishes: { dark: "#30383d", grey: "#8e9296", silver: "#b8bcbc", orange: "#b95c2c", yellow: "#d9a93b", cream: "#e3dccb" },
  podium: { width: .12, depth: .12, height: .05, finish: "dark", cap: "grey" },
  plate: { width: .11, height: .026, background: "#1d2226", ink: "#f0e6cc" },
  reach: .2,
};

const part = (finish: string, at: V3, size: V3, turn?: V3): MarkerPart => ({ finish, at, size, turn });
const stud = (finish: string, at: V3, radius: number, height: number, turn?: V3): MarkerPart => ({ finish, at, size: [radius, height, radius], turn, stud: true });

/** One small machine per skill group, each with its own outline. */
const MACHINES: Record<string, MarkerPart[]> = {
  // A terminal bench: legs, top, monitor, keyboard, an angled second screen and a console unit.
  languages: [
    ...[-.035, .035].map((x) => part("dark", [x, .018, 0], [.006, .036, .04])),
    part("grey", [0, .04, 0], [.09, .008, .05]),
    part("dark", [0, .07, -.014], [.052, .036, .006]),
    part("accent", [0, .07, -.0105], [.044, .027, .002]),
    part("silver", [0, .046, .012], [.04, .004, .014]),
    part("dark", [.036, .062, -.016], [.018, .03, .006], [0, -.5, 0]),
    part("accent", [.0365, .062, -.0125], [.014, .022, .002], [0, -.5, 0]),
    part("grey", [-.03, .05, .01], [.016, .012, .016]),
  ],
  // A compute rack with side cooling vents and a top plate, beside a sensor on a mast.
  "data-science-ml": [
    part("dark", [-.018, .05, 0], [.045, .1, .042]),
    ...[0, 1, 2, 3].map((i) => part("accent", [-.018, .02 + i * .022, .022], [.03, .004, .002])),
    ...[0, 1, 2].map((i) => part("grey", [-.041, .03 + i * .025, 0], [.002, .012, .032])),
    part("grey", [-.018, .102, 0], [.04, .004, .036]),
    stud("silver", [.032, .03, 0], .004, .06),
    stud("accent", [.032, .064, 0], .013, .01),
  ],
  // An interface wall of panels in a framed, layered mount on two feet.
  web: [
    ...[-.036, .036].map((x) => part("dark", [x, .006, -.008], [.012, .012, .03])),
    part("dark", [0, .05, -.01], [.09, .075, .008]),
    ...[0, 1].flatMap((row) => [0, 1, 2].map((col) => part((row + col) % 2 ? "cream" : "accent", [-.028 + col * .028, .032 + row * .036, -.005], [.024, .03, .003]))),
    part("grey", [0, .0895, -.008], [.094, .004, .012]),
    part("grey", [0, .0105, -.008], [.094, .004, .012]),
    part("dark", [0, .05, -.018], [.07, .05, .008]),
  ],
  // A junction box with service pipes and lit ports.
  backend: [
    part("silver", [0, .024, 0], [.042, .048, .042]),
    stud("dark", [-.038, .024, 0], .008, .036, [0, 0, Math.PI / 2]),
    stud("dark", [.038, .024, 0], .008, .036, [0, 0, Math.PI / 2]),
    stud("dark", [0, .024, -.038], .008, .036, [Math.PI / 2, 0, 0]),
    stud("dark", [0, .062, 0], .008, .03),
    ...[-.012, .012].map((x) => part("accent", [x, .03, .022], [.008, .008, .002])),
  ],
  // Storage drums stacked into a column, with status lights and an access ladder.
  databases: [
    ...[0, 1, 2].flatMap((i) => [
      stud("grey", [0, .012 + i * .026, 0], .026, .022),
      stud("accent", [0, .025 + i * .026, 0], .027, .004),
    ]),
    stud("dark", [0, .082, 0], .018, .006),
    ...[0, 1, 2].map((i) => part("accent", [.02, .016 + i * .026, .02], [.004, .004, .004])),
    part("silver", [-.03, .04, .016], [.003, .08, .003]),
    part("silver", [-.022, .04, .016], [.003, .08, .003]),
    ...[0, 1, 2, 3].map((i) => part("silver", [-.026, .012 + i * .02, .016], [.01, .002, .002])),
  ],
  // A stepped stack of foundation blocks.
  "core-cs": [
    part("dark", [0, .012, 0], [.08, .024, .06]),
    part("grey", [0, .034, 0], [.062, .02, .05]),
    part("silver", [0, .053, 0], [.044, .018, .04]),
    part("accent", [0, .07, 0], [.026, .016, .03]),
  ],
  // A pegboard with a wrench, a hammer and a lit hook.
  tools: [
    ...[-.036, .036].map((x) => part("dark", [x, .006, -.02], [.012, .012, .03])),
    part("cream", [0, .05, -.022], [.085, .075, .006]),
    part("silver", [-.022, .052, -.017], [.008, .05, .004], [0, 0, .3]),
    part("dark", [.018, .045, -.017], [.006, .045, .004]),
    part("grey", [.018, .07, -.017], [.03, .01, .006]),
    part("accent", [0, .082, -.017], [.01, .006, .004]),
  ],
  // An uplink mast under a cloud of studs, with crossarms, a small dish and a footing.
  cloud: [
    part("dark", [0, .035, 0], [.006, .07, .006]),
    stud("cream", [-.02, .08, 0], .02, .02),
    stud("cream", [.018, .082, 0], .024, .024),
    stud("cream", [0, .094, 0], .02, .018),
    stud("accent", [0, .066, .01], .005, .006, [Math.PI / 2, 0, 0]),
    part("dark", [0, .05, 0], [.03, .003, .003]),
    part("dark", [0, .038, 0], [.02, .003, .003]),
    part("grey", [.016, .046, .006], [.016, .002, .016], [-.6, .4, 0]),
    part("dark", [0, .004, 0], [.028, .008, .028]),
  ],
};

/** Two rows of four on the loading yard, in front of the fabrication hall.
 * The front row sits half a bay aside so each rear bay shows between two
 * front ones along the focus camera's line of sight from the south-west. */
const YARD = .0785;
const SLOTS: V3[] = [
  ...[-.74, -.46, -.18, .1].map((x): V3 => [x, YARD, .47]),
  ...[-.705, -.425, -.145, .135].map((x): V3 => [x, YARD, .66]),
];
/** Plates turn to face the camera. */
const FACING = -.5;

export const SKILL_BAYS: Marker[] = SKILL_CATEGORIES.map((category, i) => ({
  id: category.id,
  at: SLOTS[i],
  facing: FACING,
  plate: category.name.toUpperCase().replace("DATA SCIENCE / ML", "DATA / ML"),
  label: category.name,
  sublabel: category.skills.slice(0, 3).join(" · ") + (category.skills.length > 3 ? " …" : ""),
  accent: category.accent,
  parts: MACHINES[category.id],
}));
