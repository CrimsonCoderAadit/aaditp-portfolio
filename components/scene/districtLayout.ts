import { DISTRICTS, TABLE, TABLE_HALF, type DistrictName } from "./cityMasterplan";
import { ROOM } from "./roomLayout";

export const TABLETOP_Y = (TABLE.height + TABLE.top / 2) * TABLE.scale;

/** Rigid offset for the whole city+table group: the table is centred across
 * the room and set one aisle forward of the back wall. District positions
 * below stay table-relative; CameraRig adds this same offset so every camera
 * destination tracks it without touching its own math. */
const BACK_AISLE = 1.2;
export const CITY_GROUP_POSITION: [number, number, number] = [0, 0, ROOM.back + BACK_AISLE + TABLE_HALF.z];

const place = (name: DistrictName): [number, number, number] => {
  const { at, lift } = DISTRICTS[name];
  return [at[0], TABLETOP_Y + lift, at[1]];
};
const turn = (name: DistrictName): [number, number, number] => [0, DISTRICTS[name].turn * Math.PI / 180, 0];

export const PROJECTS_POSITION = place("projects");
export const EXPERIENCE_POSITION = place("experience");
export const RESEARCH_POSITION = place("research");
export const SKILLS_POSITION = place("skills");
export const ABOUT_POSITION = place("about");
export const ACHIEVEMENTS_POSITION = place("achievements");
export const CONTACT_POSITION = place("contact");

export const RESEARCH_TURN = turn("research");
export const SKILLS_TURN = turn("skills");
export const ABOUT_TURN = turn("about");
export const ACHIEVEMENTS_TURN = turn("achievements");
export const CONTACT_TURN = turn("contact");

export type Section = "projects" | "experience" | "research" | "skills" | "about" | "achievements" | "contact";
/** Sections whose content is one panel rather than a district of entries:
 * entering them opens the panel directly, and closing it leaves the section. */
export const PANEL_SECTIONS: ReadonlySet<Section> = new Set(["about", "contact"]);

/** One camera anchor per focusable district, expressed relative to its own
 * transform. `lift` raises the look-at above the district floor, `offset` is the
 * approach vector from that point and `arc` bows the travel. Because every value
 * is district-relative, moving a district in the masterplan moves its camera too;
 * no section coordinate is written down twice. */
export type SectionAnchor = {
  lift: number;
  nudge: [number, number];
  offset: [number, number, number];
  arc: [number, number, number];
};

export const SECTION_ANCHORS: Record<Section, SectionAnchor> = {
  // Every approach comes in from the front of the table and stays under the
  // ceiling, so no path crosses a neighbouring district or leaves the room.
  // Projects looks a little down onto the exhibition court as well as the hall,
  // steep enough for the terrace row to read over the forecourt row.
  projects: { lift: .45, nudge: [-.02, .2], offset: [1.75, 1.85, 2.7], arc: [.45, .2, .1] },
  // Experience looks at the tower's open front, clear of the façade that slides
  // aside, so every career storey reads.
  experience: { lift: .7, nudge: [-.05, -.12], offset: [.95, 1.5, 3.6], arc: [-.35, .22, .15] },
  research: { lift: .34, nudge: [.24, -.06], offset: [1.9, 1.2, 2.7], arc: [-.45, .18, -.2] },
  skills: { lift: .42, nudge: [0, .02], offset: [-1.7, 1.25, 2.9], arc: [.4, .18, .18] },
  about: { lift: .3, nudge: [-.2, .05], offset: [1.3, 1.25, 2.9], arc: [-.3, .16, .1] },
  achievements: { lift: .42, nudge: [0, 0], offset: [1.0, 1.5, 2.9], arc: [.3, .18, .1] },
  contact: { lift: 1.05, nudge: [0, 0], offset: [-2.0, 1.4, 3.8], arc: [.35, .22, .15] },
};

const ANCHOR_OF: Record<Section, [number, number, number]> = {
  projects: PROJECTS_POSITION,
  experience: EXPERIENCE_POSITION,
  research: RESEARCH_POSITION,
  skills: SKILLS_POSITION,
  about: ABOUT_POSITION,
  achievements: ACHIEVEMENTS_POSITION,
  contact: CONTACT_POSITION,
};

/** World-space look-at for a section, with the city group offset already applied. */
export function sectionTarget(section: Section): [number, number, number] {
  const [x, y, z] = ANCHOR_OF[section];
  const { lift, nudge } = SECTION_ANCHORS[section];
  return [x + nudge[0] + CITY_GROUP_POSITION[0], y + lift, z + nudge[1] + CITY_GROUP_POSITION[2]];
}

/** Hero pose, as an offset from the city target (table centre, a little above
 * the top). The camera stands in the room's front zone, high under the ceiling,
 * with the whole city in frame and the room reading at the edges. */
export const HERO_TARGET_LIFT = 1.45;
export const HERO_OFFSET: [number, number, number] = [.55, 3.47, 7.3];
export const HERO_FOV = 54;
/** Lens for the district close-ups; the section offsets are composed for it. */
export const FOCUS_FOV = 40;
