import { ACHIEVEMENTS } from "../content/achievements";
import type { Marker, MarkerPart, MarkerStyle, V3 } from "./SectionMarkers";

const BRASS = "#d4b16a";

/** Civic finishes: charcoal and the monument's burgundy, brass kept small. */
export const PLINTH_STYLE: MarkerStyle = {
  finishes: { dark: "#29292b", burgundy: "#6e2a33", brass: "#a8884a", cream: "#e3dccb" },
  podium: { width: .1, depth: .1, height: .09, finish: "dark", cap: "burgundy" },
  plate: { width: .092, height: .024, background: "#1f1f21", ink: "#ddc793" },
  reach: .24,
};

const part = (finish: string, at: V3, size: V3, turn?: V3): MarkerPart => ({ finish, at, size, turn });
const stud = (finish: string, at: V3, radius: number, height: number, turn?: V3): MarkerPart => ({ finish, at, size: [radius, height, radius], turn, stud: true });
const FACE: V3 = [Math.PI / 2, 0, 0];

const medal = (radius: number, ribbon: string): MarkerPart[] => [
  part("dark", [0, .03, -.006], [.006, .06, .006]),
  part(ribbon, [-.008, .07, -.003], [.008, .03, .003], [0, 0, .35]),
  part(ribbon, [.008, .07, -.003], [.008, .03, .003], [0, 0, -.35]),
  stud("accent", [0, .052, 0], radius, .008, FACE),
];

/** One brass piece per kind of result, so each plinth reads by its outline. */
const SCULPTURES: Record<string, MarkerPart[]> = {
  // First place: a cup on a stepped base.
  "ieee-masathon": [
    part("dark", [0, .008, 0], [.05, .016, .05]),
    stud("brass", [0, .03, 0], .006, .03),
    stud("accent", [0, .058, 0], .022, .03),
    ...[-.026, .026].map((x) => part("accent", [x, .06, 0], [.006, .018, .006])),
  ],
  "barclays-hack-o-hire-2026": medal(.024, "burgundy"),
  "gdg-hackathon": medal(.02, "cream"),
  // Finalist: a framed award plaque on an easel.
  "zenith-2026": [
    part("dark", [0, .03, -.012], [.006, .06, .006], [-.25, 0, 0]),
    part("accent", [0, .05, 0], [.052, .064, .006]),
    part("dark", [0, .05, .0035], [.04, .05, .002]),
  ],
  // Special mention: a star on a slender post.
  "zenith-2025": [
    part("dark", [0, .03, 0], [.006, .06, .006]),
    part("accent", [0, .07, 0], [.03, .03, .006], [0, 0, Math.PI / 4]),
    part("accent", [0, .07, 0], [.03, .03, .006]),
  ],
  // Cleared the internal round: a check mark in brass.
  "smart-india-hackathon": [
    part("dark", [0, .008, 0], [.05, .016, .03]),
    part("accent", [-.012, .03, 0], [.008, .026, .008], [0, 0, .7]),
    part("accent", [.01, .045, 0], [.008, .05, .008], [0, 0, -.55]),
  ],
};

/** Two ranks of three on the plaza either side of the monument's base, facing
 * the focus camera. Each rank steps east as it goes back, because the camera
 * looks in from the south-east: straight ranks would hide each plinth behind
 * the one in front of it. */
/** The civic plaza around the monument base is the district's own floor. */
const PLAZA = 0;
const SLOTS: V3[] = [
  ...([[-.44, -.3], [-.5, -.02], [-.56, .26]] as const).map(([x, z]): V3 => [x, PLAZA, z]),
  ...([[.52, -.3], [.46, -.02], [.4, .26]] as const).map(([x, z]): V3 => [x, PLAZA, z]),
];

export const ACHIEVEMENT_PLINTHS: Marker[] = ACHIEVEMENTS.map((entry, i) => ({
  id: entry.id,
  at: SLOTS[i],
  facing: .36,
  plate: entry.result.toUpperCase(),
  label: entry.event,
  sublabel: entry.result,
  accent: BRASS,
  parts: SCULPTURES[entry.id],
}));
