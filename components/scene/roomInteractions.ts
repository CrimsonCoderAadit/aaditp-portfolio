import { useSyncExternalStore } from "react";
import type { SceneMode } from "./SceneTransition";
import type { ViewpointId } from "./viewpoints";

/** Room objects that switch between two states. The 3D objects and their
 * keyboard buttons read and write the same values here. */
export type RoomToggle = "wardrobe" | "bedsideLamp" | "floorLamp" | "coveDimmed" | "curtains" | "electronicsDrawer" | "brickDrawer" | "pegLamp";

const state: Record<RoomToggle, boolean> = { wardrobe: false, bedsideLamp: true, floorLamp: true, coveDimmed: false, curtains: false, electronicsDrawer: false, brickDrawer: false, pegLamp: false };
const listeners = new Set<() => void>();

export function setRoomToggle(key: RoomToggle, value: boolean) {
  if (state[key] === value) return;
  state[key] = value;
  listeners.forEach((listener) => listener());
}
export const flipRoomToggle = (key: RoomToggle) => setRoomToggle(key, !state[key]);
export const roomToggle = (key: RoomToggle) => state[key];

const subscribe = (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); };
export function useRoomToggle(key: RoomToggle) {
  return useSyncExternalStore(subscribe, () => state[key], () => state[key]);
}

/** Room objects answer only in the room itself, from views where they are in
 * reach: not in a district, the tour or the terminal, not mid-flight, and not
 * from across the room. A close-up counts only when it is listed. */
export function roomReachable({ mode, touring, roomFocus, viewpoint, viewpointMoving }: {
  mode: SceneMode; touring: boolean; roomFocus: unknown; viewpoint: ViewpointId; viewpointMoving: boolean;
}, from: ViewpointId[]) {
  return mode === "workbench" && !touring && !viewpointMoving && from.includes(viewpoint) && (!roomFocus || from.includes(roomFocus as ViewpointId));
}

/** Scholar's Mate, as the chess ledge plays it once per run. */
export const CHESS_LINE = ["1. e4", "1… e5", "2. Bc4", "2… Nc6", "3. Qh5", "3… Nf6??", "4. Qxf7#"] as const;
let chess = { run: 0, ply: 0 };
const chessListeners = new Set<() => void>();
const notifyChess = () => chessListeners.forEach((listener) => listener());
/** Sets the board back to the start and plays the line through. */
export function playChess() {
  chess = { run: chess.run + 1, ply: 0 };
  notifyChess();
}
/** The board reports each move as it begins. */
export function setChessPly(ply: number) {
  if (chess.ply === ply) return;
  chess = { ...chess, ply };
  notifyChess();
}
const subscribeChess = (listener: () => void) => { chessListeners.add(listener); return () => chessListeners.delete(listener); };
export function useChessGame() {
  return useSyncExternalStore(subscribeChess, () => chess, () => chess);
}

/** Full-screen overlays that hide the room entirely (an arcade game) cover it
 * while open, and the room's ambient animation and parallax rest meanwhile. */
let covers = 0;
const coverListeners = new Set<() => void>();
export function coverScene() {
  covers++;
  coverListeners.forEach((listener) => listener());
  let released = false;
  return () => { if (!released) { released = true; covers--; coverListeners.forEach((listener) => listener()); } };
}
export const sceneCovered = () => covers > 0;
export const onSceneCover = (listener: () => void) => { coverListeners.add(listener); return () => { coverListeners.delete(listener); }; };

/** Set while an object is being dragged across the floor, so the camera
 * leaves that pointer alone. */
export const roomDrag = { active: false };

/** The saber collection: which hilt is picked out (hovered, or tapped on a
 * touch screen) and which blades are lit. Each blade toggles on its own. */
export type SaberId = "vader" | "kenobi" | "dooku" | "maul" | "skywalker";
type Sabers = { selected: SaberId | null; lit: Record<SaberId, boolean> };
const UNLIT: Record<SaberId, boolean> = { vader: false, kenobi: false, dooku: false, maul: false, skywalker: false };
let sabers: Sabers = { selected: null, lit: UNLIT };
const saberListeners = new Set<() => void>();
const setSabers = (next: Sabers) => { sabers = next; saberListeners.forEach((listener) => listener()); };
export const selectSaber = (id: SaberId | null) => { if (sabers.selected !== id) setSabers({ ...sabers, selected: id }); };
export const toggleSaber = (id: SaberId) => setSabers({ ...sabers, lit: { ...sabers.lit, [id]: !sabers.lit[id] } });
/** Every blade in and nothing picked out, as when leaving the collection. */
export const resetSabers = () => { if (sabers.selected || Object.values(sabers.lit).some(Boolean)) setSabers({ selected: null, lit: UNLIT }); };
const subscribeSabers = (listener: () => void) => { saberListeners.add(listener); return () => saberListeners.delete(listener); };
export function useSabers() {
  return useSyncExternalStore(subscribeSabers, () => sabers, () => sabers);
}

/** One-shot room effects, counted so the 3D object and its keyboard button
 * can both start one: the print's barrels, the flute's phrase, the ball's hop,
 * the detective's patrol-car lights, the skyscraper model's next light
 * (floors, beacon, off) and the tape measure's run. */
export type RoomPulse = "kong" | "flute" | "football" | "vader" | "chase" | "tower" | "tape";
const pulses: Record<RoomPulse, number> = { kong: 0, flute: 0, football: 0, vader: 0, chase: 0, tower: 0, tape: 0 };
const pulseListeners = new Set<() => void>();
export function firePulse(name: RoomPulse) {
  pulses[name]++;
  pulseListeners.forEach((listener) => listener());
}
const subscribePulse = (listener: () => void) => { pulseListeners.add(listener); return () => pulseListeners.delete(listener); };
export function usePulse(name: RoomPulse) {
  return useSyncExternalStore(subscribePulse, () => pulses[name], () => 0);
}
