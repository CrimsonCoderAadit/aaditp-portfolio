import type { SaberId } from "./roomInteractions";

/** What the collection says about each hilt: the character, the blade, and a
 * short line. Three are the characters' own well-known lines; for Dooku and
 * Maul no line is sourced here, so theirs describe the hilt instead. Kept free
 * of three.js: the page's controls read it. */
export const SABER_INFO: Record<SaberId, { name: string; blade: string; line: string; quote: boolean }> = {
  vader: { name: "Darth Vader", blade: "Red saber", line: "I find your lack of faith disturbing.", quote: true },
  kenobi: { name: "Obi-Wan Kenobi", blade: "Blue saber", line: "Hello there.", quote: true },
  dooku: { name: "Count Dooku", blade: "Red saber · Curved hilt", line: "A curved hilt, shaped for the precise fencing of an old duellist.", quote: false },
  maul: { name: "Darth Maul", blade: "Red saberstaff · Double-bladed", line: "Two blades from one staff, lit end to end.", quote: false },
  skywalker: { name: "Luke Skywalker", blade: "Green saber", line: "I am a Jedi, like my father before me.", quote: true },
};
export const SABER_ORDER: SaberId[] = ["vader", "kenobi", "dooku", "maul", "skywalker"];
