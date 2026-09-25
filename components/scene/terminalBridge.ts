/** A small channel between the 3D workstation and the DOM terminal overlay:
 * where the screen currently sits on the page, and the lazily loaded game. */

/** The glass's bounding box on the page, and its four corners in reading
 * order (top-left, top-right, bottom-right, bottom-left). */
export type ScreenRect = { left: number; top: number; width: number; height: number; quad: [number, number][] };

let measure: (() => ScreenRect | null) | null = null;

export const terminalBridge = {
  /** Registered by the in-scene terminal; returns the glass's page rectangle. */
  setMeasure(fn: (() => ScreenRect | null) | null) { measure = fn; },
  screenRect(): ScreenRect | null { return measure?.() ?? null; },
};

let game: Promise<typeof import("../systemRunner/SystemRunner")> | null = null;
/** Starts downloading the game once; hovering or opening the terminal calls this. */
export function preloadSystemRunner() {
  game ??= import("../systemRunner/SystemRunner");
  return game;
}
