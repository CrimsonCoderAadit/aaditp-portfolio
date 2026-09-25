/** Tabletop urban plan. Everything the city stands on — district anchors, street
 * corridors, blocks, plazas and open ground — is authored here in table-local
 * units so the layout can be read, checked and moved in one place.
 *
 * The model table is 7.4 × 4.55 m under the bench's 1.65 scale (12.21 × 7.51
 * units). The city is laid out as a grid: one boulevard with a planted median
 * runs east-west, two secondary streets cross it full depth (the two four-ways),
 * and three minor streets meet the network as tees. Every rectangle between
 * corridors is a named block, so no bare tabletop shows inside the city.
 *
 * Streets are corridors: `road` is the running surface, `walk` the sidewalk strip
 * on each side. A district footprint may touch a corridor edge but never enter it.
 */
export const TABLE = { width: 7.4, depth: 4.55, height: .94, top: .115, scale: 1.65 } as const;
export const TABLE_HALF = { x: TABLE.width * TABLE.scale / 2, z: TABLE.depth * TABLE.scale / 2 };
export const EDGE_MARGIN = .28;

/** Outer edge of the urban model. The front keeps a wider strip of bare table
 * for the builder's tray and the visitor's side of the model. */
export const CITY = { x: [-5.8, 5.8] as [number, number], z: [-3.45, 3.25] as [number, number] };

export type Anchor = { at: [number, number]; turn: number; lift: number };

/** Turn is degrees about Y; lift raises a district onto its own platform. */
export const DISTRICTS = {
  projects: { at: [-3.35, -2.05], turn: 0, lift: 0 },
  experience: { at: [.62, -2.30], turn: 0, lift: 0 },
  contact: { at: [4.05, -2.15], turn: 0, lift: 0 },
  research: { at: [-3.75, .95], turn: -2.5, lift: .045 },
  about: { at: [-4.10, 2.55], turn: 3, lift: .030 },
  achievements: { at: [.71, 1.00], turn: 0, lift: .058 },
  skills: { at: [4.15, 1.00], turn: -3, lift: 0 },
} satisfies Record<string, Anchor>;

export type DistrictName = keyof typeof DISTRICTS;

/** Footprints measured from the built geometry; used for platforms and clearances. */
export const FOOTPRINTS: Record<DistrictName, { x: [number, number]; z: [number, number] }> = {
  projects: { x: [-1.247, 1.580], z: [-.880, .880] },
  experience: { x: [-1.047, 1.047], z: [-.780, .780] },
  contact: { x: [-.656, .656], z: [-.656, .656] },
  research: { x: [-1.047, 1.047], z: [-.440, .440] },
  about: { x: [-.930, .690], z: [-.395, .385] },
  achievements: { x: [-.568, .568], z: [-.569, .450] },
  skills: { x: [-.896, .896], z: [-.425, .730] },
};

export type Street = {
  name: string;
  /** "x" runs east-west and `centre` is a z line; "z" runs north-south on an x line. */
  axis: "x" | "z";
  centre: number;
  road: number;
  walk: number;
  from: number;
  to: number;
};

/** The boulevard: two carriageways of two lanes each either side of a planted median. */
export const BOULEVARD: Street = { name: "boulevard", axis: "x", centre: -.35, road: .80, walk: .16, from: CITY.x[0], to: CITY.x[1] };
export const MEDIAN = .14;
/** Secondary streets, full depth; each crosses the boulevard at a four-way. */
export const CIVIC_STREET: Street = { name: "civic", axis: "z", centre: -1.30, road: .40, walk: .12, from: CITY.z[0], to: 3.02 };
export const MARKET_STREET: Street = { name: "market", axis: "z", centre: 2.72, road: .40, walk: .12, from: CITY.z[0], to: 3.02 };
/** Minor streets: a quiet residential lane and two service roads, each a tee. */
export const ABOUT_LANE: Street = { name: "lane", axis: "x", centre: 1.85, road: .26, walk: .09, from: CITY.x[0], to: CIVIC_STREET.centre - CIVIC_STREET.road / 2 };
export const CAMPUS_SERVICE: Street = { name: "campus", axis: "z", centre: -5.30, road: .22, walk: .05, from: -3.30, to: BOULEVARD.centre - BOULEVARD.road / 2 };
export const WORKS_ROAD: Street = { name: "works", axis: "z", centre: 5.45, road: .24, walk: .05, from: BOULEVARD.centre + BOULEVARD.road / 2, to: 2.92 };
export const STREETS = [BOULEVARD, CIVIC_STREET, MARKET_STREET, ABOUT_LANE, CAMPUS_SERVICE, WORKS_ROAD];

export const edge = (s: Street) => s.road / 2 + s.walk;

type Rect = { x: [number, number]; z: [number, number] };
const rect = (x0: number, x1: number, z0: number, z1: number): Rect => ({ x: [x0, x1], z: [z0, z1] });

const NORTH = BOULEVARD.centre - edge(BOULEVARD);
const SOUTH = BOULEVARD.centre + edge(BOULEVARD);
const CIVIC_W = CIVIC_STREET.centre - edge(CIVIC_STREET), CIVIC_E = CIVIC_STREET.centre + edge(CIVIC_STREET);
const MARKET_W = MARKET_STREET.centre - edge(MARKET_STREET), MARKET_E = MARKET_STREET.centre + edge(MARKET_STREET);
const LANE_N = ABOUT_LANE.centre - edge(ABOUT_LANE), LANE_S = ABOUT_LANE.centre + edge(ABOUT_LANE);
const CAMPUS_W = CAMPUS_SERVICE.centre - edge(CAMPUS_SERVICE), CAMPUS_E = CAMPUS_SERVICE.centre + edge(CAMPUS_SERVICE);
const WORKS_W = WORKS_ROAD.centre - edge(WORKS_ROAD), WORKS_E = WORKS_ROAD.centre + edge(WORKS_ROAD);
export const PROMENADE = rect(CITY.x[0], CITY.x[1], 3.02, CITY.z[1]);

/** Every block between the corridors. `base` is the finish laid under the whole
 * block, beneath its own plazas, lawns and yards. */
export type Block = { name: string; area: Rect; base: "walk" | "ground" | "turf" };
export const BLOCKS: Block[] = [
  { name: "campus-west", area: rect(CITY.x[0], CAMPUS_W, CITY.z[0], NORTH), base: "turf" },
  { name: "campus-service-end", area: rect(CAMPUS_W, CAMPUS_E, CITY.z[0], CAMPUS_SERVICE.from), base: "ground" },
  { name: "projects", area: rect(CAMPUS_E, CIVIC_W, CITY.z[0], NORTH), base: "walk" },
  { name: "experience", area: rect(CIVIC_E, MARKET_W, CITY.z[0], NORTH), base: "walk" },
  { name: "contact", area: rect(MARKET_E, CITY.x[1], CITY.z[0], NORTH), base: "ground" },
  { name: "research", area: rect(CITY.x[0], CIVIC_W, SOUTH, LANE_N), base: "turf" },
  { name: "about", area: rect(CITY.x[0], CIVIC_W, LANE_S, PROMENADE.z[0]), base: "turf" },
  { name: "civic", area: rect(CIVIC_E, MARKET_W, SOUTH, PROMENADE.z[0]), base: "walk" },
  { name: "skills", area: rect(MARKET_E, WORKS_W, SOUTH, PROMENADE.z[0]), base: "ground" },
  { name: "works-edge", area: rect(WORKS_E, CITY.x[1], SOUTH, PROMENADE.z[0]), base: "ground" },
  { name: "works-end", area: rect(WORKS_W, WORKS_E, WORKS_ROAD.to, PROMENADE.z[0]), base: "ground" },
];

/** Features inside the blocks. */
export const PROJECTS_FORECOURT = rect(-4.60, -1.77, -1.17, NORTH);
export const PROJECTS_COURTYARD = rect(-4.60, -1.77, CITY.z[0], -2.93);
export const PROJECTS_YARD = rect(CAMPUS_E, -4.66, -3.30, NORTH);
export const EXPERIENCE_PLAZA = rect(-.60, 1.84, -1.52, NORTH);
export const CONTACT_PLAZA = rect(3.30, 4.80, -1.49, NORTH);
export const CONTACT_COMPOUND = rect(4.90, 5.74, -3.38, -1.62);
export const CONTACT_DRIVE = rect(MARKET_E, 5.74, CITY.z[0], -2.90);
export const RESEARCH_COURT = rect(CITY.x[0] + .04, -4.88, SOUTH + .04, LANE_N - .04);
export const RESEARCH_GREEN = rect(-2.62, CIVIC_W - .04, SOUTH + .04, LANE_N - .04);
export const ABOUT_GARDEN = rect(-3.30, CIVIC_W - .04, LANE_S + .04, PROMENADE.z[0] - .04);
export const CIVIC_PLAZA = rect(CIVIC_E + .03, MARKET_W - .03, SOUTH + .03, 1.96);
export const PARK = rect(CIVIC_E + .03, MARKET_W - .03, 1.99, PROMENADE.z[0] - .03);
export const SKILLS_APRON = rect(MARKET_E + .04, WORKS_W - .03, SOUTH + .03, .52);
export const SKILLS_YARD = rect(MARKET_E + .04, WORKS_W - .03, 1.80, PROMENADE.z[0] - .04);

/** The two four-ways, the boulevard tees and the lane's local junction. */
export const JUNCTIONS = {
  civicCross: [CIVIC_STREET.centre, BOULEVARD.centre] as [number, number],
  marketCross: [MARKET_STREET.centre, BOULEVARD.centre] as [number, number],
  campusTee: [CAMPUS_SERVICE.centre, BOULEVARD.centre] as [number, number],
  worksTee: [WORKS_ROAD.centre, BOULEVARD.centre] as [number, number],
  laneTee: [CIVIC_STREET.centre, ABOUT_LANE.centre] as [number, number],
};

/** Thin site slabs laid under a district's whole footprint so no bare tabletop
 * shows between its own base and the street. Top stays below any district base. */
export const SITE_PAD_TOP = .004;
