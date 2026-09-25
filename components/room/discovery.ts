import { useSyncExternalStore } from "react";

/** The room's hidden interactive details. Finding one for the first time
 * shows a brief, quiet count; nothing else depends on it. */
export const DISCOVERIES = ["kong", "chase", "flute", "football", "devmode", "vader"] as const;
export type Discovery = (typeof DISCOVERIES)[number];

const KEY = "aadit-discovered";
let found: Discovery[] | null = null;
let latest: { count: number; at: number } | null = null;
const listeners = new Set<() => void>();

function load() {
  if (found) return found;
  try { found = (JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as Discovery[]).filter((id) => DISCOVERIES.includes(id)); }
  catch { found = []; }
  return found;
}

export function discover(id: Discovery) {
  const list = load();
  if (list.includes(id)) return;
  found = [...list, id];
  try { window.localStorage.setItem(KEY, JSON.stringify(found)); } catch { /* Storage is optional. */ }
  latest = { count: found.length, at: performance.now() };
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); };
/** The most recent new discovery, for the brief count. */
export function useLatestDiscovery() {
  return useSyncExternalStore(subscribe, () => latest, () => null);
}
