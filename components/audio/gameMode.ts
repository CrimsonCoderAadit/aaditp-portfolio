import { useSyncExternalStore } from "react";
import type { BackgroundMusicManager, NowPlaying } from "./soundtrackManager";

/** The app's handle on the one audio manager. Gaming entry points call
 * enterGameMode() from the click that starts them, so the first track can
 * begin inside that gesture; nothing else here knows which songs play. */
let manager: BackgroundMusicManager | null = null;
const listeners = new Set<() => void>();
let unsubscribe: (() => void) | null = null;

export function registerAudioManager(next: BackgroundMusicManager | null) {
  unsubscribe?.();
  manager = next;
  unsubscribe = next ? next.subscribe(() => listeners.forEach((listener) => listener())) : null;
  listeners.forEach((listener) => listener());
}

export const enterGameMode = () => manager?.setGameMode(true);
export const leaveGameMode = () => manager?.setGameMode(false);
/** Fetches the small Game Mode manifest; call on first hover or focus of a gaming entry point. */
export const prepareGameMode = () => manager?.prepareGame();
/** The arcade's sound-effect bus, or null when audio is unavailable. */
export const sfxOutput = () => manager?.sfxOutput() ?? null;

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function useNowPlaying(): NowPlaying {
  return useSyncExternalStore(subscribe, () => manager?.getNowPlaying() ?? null, () => null);
}
