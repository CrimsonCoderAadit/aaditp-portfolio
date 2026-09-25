"use client";

import { createContext, useCallback, useContext, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject, type SetStateAction } from "react";
import { isRoomFocus, type RoomFocus, type ViewpointId } from "./viewpoints";
import type { Section } from "./districtLayout";

export type { Section };
/** One app-level mode for the whole experience. The room ("workbench"), a
 * district focus and its two transitions, and the workstation terminal: the
 * camera walking over, the terminal in use, and the camera pulling back. The
 * game's own phases (menu, playing, paused, over) live inside the terminal. */
export type TerminalMode = "terminal-entering" | "terminal" | "terminal-leaving";
export type SceneMode = "workbench" | Section | `entering-${Section}` | `leaving-${Section}` | TerminalMode;

export const isTerminalMode = (mode: SceneMode): mode is TerminalMode => mode.startsWith("terminal");
/** A district focus or one of its transitions. */
export const isDistrictMode = (mode: SceneMode) => mode !== "workbench" && !isTerminalMode(mode);
type Timeline = { progress: number; elapsed: number; duration: number };
type Transition = {
  mode: SceneMode;
  section: Section;
  timeline: RefObject<Timeline>;
  enter: (section?: Section) => void;
  leave: () => void;
  /** From one district's settled focus straight to another's: the camera flies
   * across while the first district closes and the second opens, then
   * opens `entry` there if one is given. */
  hop: (section: Section, entry?: string) => void;
  /** Opening progress of a district, 0 closed to 1 open; the district a hop
   * is leaving reports its own closing progress. */
  progressOf: (section: Section) => number;
  /** A guided tour is driving the camera: districts ignore pointers, content
   * interfaces stay closed and the room cannot be turned by hand. */
  touring: boolean;
  setTouring: (on: boolean) => void;
  /** A room object the camera has moved in to (the media corner, the chess
   * study), or null. Leaving returns to the viewpoint it was entered from. */
  roomFocus: RoomFocus | null;
  focusRoom: (target: RoomFocus) => void;
  leaveRoomFocus: () => void;
  finish: () => void;
  advance: (delta: number) => Timeline;
  /** Curated room viewpoint the camera rests at while in workbench mode. */
  viewpoint: ViewpointId;
  /** True while the camera travels between viewpoints; commands are ignored. */
  viewpointMoving: boolean;
  goToViewpoint: (id: ViewpointId) => void;
  finishViewpoint: () => void;
  /** Bumped when the same viewpoint is requested again, to re-frame it. */
  viewpointRequest: number;
  /** Walk over to the workstation terminal (from the room only). */
  openTerminal: () => void;
  /** The camera has arrived at the terminal. */
  terminalArrived: () => void;
  /** The terminal UI has closed; pull the camera back. */
  closeTerminal: () => void;
  /** The camera is back at the workstation viewpoint. */
  terminalLeft: () => void;
  /** The entry open in detail inside the current section's focus (a project
   * in Projects, an experience in Experience), or null while browsing its
   * district. Navigation is ROOM → SECTION (mode) → ENTRY (this id); entering
   * or leaving a section always clears it, so the id is only ever read
   * against the section that set it. */
  detailId: string | null;
  selectDetail: (id: string | null) => void;
};
const Context = createContext<Transition | null>(null);

/** One timeline drives both camera and rigid assemblies; state updates only at boundaries. */
/** The entry a pointer is over, shared by a district's 3D markers and its
 * index. Kept outside the scene's context, which every room and city
 * component reads: a hover re-renders only the few that show it. */
let hoveredDetail: string | null = null;
const hoverListeners = new Set<() => void>();
export function hoverDetail(next: SetStateAction<string | null>) {
  const value = typeof next === "function" ? next(hoveredDetail) : next;
  if (value === hoveredDetail) return;
  hoveredDetail = value;
  hoverListeners.forEach((listener) => listener());
}
const subscribeHover = (listener: () => void) => { hoverListeners.add(listener); return () => hoverListeners.delete(listener); };
export const useHoveredDetail = () => useSyncExternalStore(subscribeHover, () => hoveredDetail, () => null);

export function SceneTransitionProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<SceneMode>("workbench");
  const modeRef = useRef<SceneMode>("workbench");
  const [section, setSection] = useState<Section>("projects");
  const sectionRef = useRef<Section>("projects");
  const timeline = useRef<Timeline>({ progress: 0, elapsed: 0, duration: 2.4 });
  /** The district a hop is closing, and how open it still is. */
  const closing = useRef<{ section: Section | null; progress: number }>({ section: null, progress: 0 });
  const [touring, setTouring] = useState(false);
  const [roomFocus, setRoomFocus] = useState<RoomFocus | null>(null);
  const focusReturn = useRef<ViewpointId>("room");
  const viewpointRef = useRef<ViewpointId>("city");
  const [viewpoint, setViewpoint] = useState<ViewpointId>("city");
  const [viewpointMoving, setViewpointMoving] = useState(false);
  const [viewpointRequest, setViewpointRequest] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);
  const movingRef = useRef(false);
  const goToViewpoint = useCallback((id: ViewpointId) => {
    if (modeRef.current !== "workbench" || movingRef.current) return;
    movingRef.current = true;
    setViewpointMoving(true);
    // Any other destination ends a close-up, however it was asked for.
    if (!isRoomFocus(id)) setRoomFocus(null);
    viewpointRef.current = id;
    setViewpoint(id);
    setViewpointRequest((n) => n + 1);
  }, []);
  const finishViewpoint = useCallback(() => {
    movingRef.current = false;
    setViewpointMoving(false);
  }, []);
  const start = useCallback((entering: boolean, selected: Section) => {
    if (modeRef.current !== (entering ? "workbench" : sectionRef.current)) return;
    if (movingRef.current) return;
    // District focus always starts from, and returns to, the canonical city home.
    if (entering) { viewpointRef.current = "city"; setViewpoint("city"); setRoomFocus(null); }
    const next: SceneMode = `${entering ? "entering" : "leaving"}-${selected}`;
    setDetailId(null);
    hoverDetail(null);
    sectionRef.current = selected;
    setSection(selected);
    timeline.current.elapsed = 0;
    timeline.current.duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? .22 : 2.4;
    modeRef.current = next;
    setMode(next);
  }, []);
  const enter = useCallback((selected: Section = "projects") => start(true, selected), [start]);
  const focusRoom = useCallback((target: RoomFocus) => {
    if (modeRef.current !== "workbench" || movingRef.current || viewpointRef.current === target) return;
    if (!isRoomFocus(viewpointRef.current)) focusReturn.current = viewpointRef.current;
    setRoomFocus(target);
    goToViewpoint(target);
  }, [goToViewpoint]);
  const leaveRoomFocus = useCallback(() => goToViewpoint(focusReturn.current), [goToViewpoint]);
  const leave = useCallback(() => start(false, sectionRef.current), [start]);
  const pendingEntry = useRef<string | null>(null);
  const hop = useCallback((selected: Section, entry?: string) => {
    if (modeRef.current !== sectionRef.current || selected === sectionRef.current) return;
    pendingEntry.current = entry ?? null;
    closing.current = { section: sectionRef.current, progress: 1 };
    const next: SceneMode = `entering-${selected}`;
    setDetailId(null);
    hoverDetail(null);
    sectionRef.current = selected;
    setSection(selected);
    timeline.current.elapsed = 0;
    timeline.current.progress = 0;
    timeline.current.duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? .22 : 2.2;
    modeRef.current = next;
    setMode(next);
  }, []);
  const progressOf = useCallback((of: Section) => {
    if (of === sectionRef.current) return timeline.current.progress;
    return of === closing.current.section ? closing.current.progress : 0;
  }, []);
  const advance = useCallback((delta: number) => {
    const t = timeline.current;
    if (modeRef.current.startsWith("entering-") || modeRef.current.startsWith("leaving-")) {
      t.elapsed = Math.min(t.duration, t.elapsed + Math.min(delta, .1));
      t.progress = modeRef.current.startsWith("entering-") ? t.elapsed / t.duration : 1 - t.elapsed / t.duration;
      if (closing.current.section) closing.current.progress = 1 - t.elapsed / t.duration;
    }
    return t;
  }, []);
  const finish = useCallback(() => {
    if (!modeRef.current.startsWith("entering-") && !modeRef.current.startsWith("leaving-")) return;
    const next = modeRef.current.startsWith("entering-") ? sectionRef.current : "workbench";
    timeline.current.progress = next !== "workbench" ? 1 : 0;
    closing.current = { section: null, progress: 0 };
    modeRef.current = next;
    setMode(next);
    if (next !== "workbench" && pendingEntry.current) setDetailId(pendingEntry.current);
    pendingEntry.current = null;
  }, []);
  const shift = useCallback((from: SceneMode, to: SceneMode) => {
    if (modeRef.current !== from) return;
    modeRef.current = to;
    setMode(to);
  }, []);
  const openTerminal = useCallback(() => {
    if (modeRef.current !== "workbench" || movingRef.current) return;
    // The terminal returns to the workstation viewpoint; set it now so the
    // rig's exploration offsets reset while the camera walks over.
    viewpointRef.current = "workstation";
    setViewpoint("workstation");
    setRoomFocus(null);
    shift("workbench", "terminal-entering");
  }, [shift]);
  const terminalArrived = useCallback(() => shift("terminal-entering", "terminal"), [shift]);
  const closeTerminal = useCallback(() => shift("terminal", "terminal-leaving"), [shift]);
  const terminalLeft = useCallback(() => shift("terminal-leaving", "workbench"), [shift]);
  // Entries open only once their district has finished opening.
  const selectDetail = useCallback((id: string | null) => {
    if (id !== null && modeRef.current !== sectionRef.current) return;
    setDetailId(id);
  }, []);
  return <Context.Provider value={{ mode, section, timeline, enter, leave, hop, progressOf, touring, setTouring, roomFocus, focusRoom, leaveRoomFocus, finish, advance, viewpoint, viewpointMoving, goToViewpoint, finishViewpoint, viewpointRequest, openTerminal, terminalArrived, closeTerminal, terminalLeft, detailId, selectDetail }}>{children}</Context.Provider>;
}

export function useSceneTransition() {
  const value = useContext(Context);
  if (!value) throw new Error("Scene transition provider is missing");
  return value;
}

export function phase(progress: number, start: number, end: number) {
  const t = Math.max(0, Math.min(1, (progress - start) / (end - start)));
  return t * t * t * (t * (t * 6 - 15) + 10);
}
