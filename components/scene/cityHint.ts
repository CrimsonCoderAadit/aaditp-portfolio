import { useSyncExternalStore } from "react";

/** Whether this visitor has found their way into the city this session: the
 * first hover over a district, a click into one, the tour, or the hint simply
 * having been shown for long enough. Until then the hint invites a hover. */
const KEY = "studio:city-explored";
let explored: boolean | null = null;
const listeners = new Set<() => void>();

function read() {
  if (explored === null) {
    try { explored = sessionStorage.getItem(KEY) !== null; } catch { explored = false; }
  }
  return explored;
}

export function markCityExplored() {
  if (read()) return;
  explored = true;
  try { sessionStorage.setItem(KEY, "1"); } catch { /* storage unavailable: the hint just returns next load */ }
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function useCityExplored() {
  return useSyncExternalStore(subscribe, read, () => true);
}
