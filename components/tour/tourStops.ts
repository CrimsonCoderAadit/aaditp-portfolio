import type { Section } from "../scene/SceneTransition";
import type { ViewpointId } from "../scene/viewpoints";
import { PROJECTS } from "../content/projects";
import { EXPERIENCE } from "../content/experience";
import { RESEARCH } from "../content/research";
import { SKILL_CATEGORIES } from "../content/skills";
import { ACHIEVEMENTS } from "../content/achievements";

/** Where a stop takes the camera: one of the curated room viewpoints, or a
 * district's own focus (its opening sequence and anchor), without its content. */
export type TourPlace = { viewpoint: ViewpointId } | { section: Section };
export type TourStop = { id: string; place: TourPlace; title: string; line: string };

const count = (n: number) => ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"][n] ?? String(n);
const [internship] = EXPERIENCE;

/** The guided tour: the room, its personal and gaming corners, the workbench,
 * the city, each district, and back to the city at the end.
 * Counts and names are read from the content, so the copy cannot claim more
 * than the portfolio holds. */
export const TOUR_STOPS: TourStop[] = [
  { id: "room", place: { viewpoint: "room" }, title: "Welcome to the studio", line: "A room built around a brick city, with New York at night beyond the glass. The brick city holds the work." },
  { id: "wall", place: { viewpoint: "kong" }, title: "Personal corner", line: "Games, stories and the things that shaped what I like to build." },
  { id: "workstation", place: { viewpoint: "workstation" }, title: "The workbench", line: "Where the software gets built. The terminal runs SYSTEM RUNNER, yours to play after the tour." },
  { id: "media", place: { viewpoint: "media" }, title: "The game corner", line: "The room has a small arcade hidden inside it: three original games on the console." },
  { id: "city", place: { viewpoint: "city" }, title: "The city is the portfolio", line: "Each district holds a different part of the work. After the tour, hover over any of them to explore." },
  { id: "projects", place: { section: "projects" }, title: "Projects", line: `${count(PROJECTS.length)} projects on exhibit, each with its own brick-built model.` },
  { id: "experience", place: { section: "experience" }, title: "Experience", line: `A tower of career floors. The first is lit: ${internship.role} at ${internship.company}.` },
  { id: "research", place: { section: "research" }, title: "Research", line: `${count(RESEARCH.length)} published papers, each with its own analysis station.` },
  { id: "skills", place: { section: "skills" }, title: "Skills", line: `${count(SKILL_CATEGORIES.length)} workshop bays, each group linked to the work that uses it. No ratings.` },
  { id: "about", place: { section: "about" }, title: "About", line: "The studio opens onto the person: study, flute, chess, football and fiction." },
  { id: "achievements", place: { section: "achievements" }, title: "Achievements", line: `${count(ACHIEVEMENTS.length)} competition results around the civic monument.` },
  { id: "contact", place: { section: "contact" }, title: "Contact", line: "Email, GitHub, LinkedIn and the other places the work lives." },
];
