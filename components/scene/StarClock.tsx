import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { STAR_TIME } from "./roomAssets/nightSky";
import { sceneCovered } from "./roomInteractions";
import { TIER_SETTINGS, useTier } from "./quality";
import { isDistrictMode, isTerminalMode, useSceneTransition } from "./SceneTransition";

const START = typeof performance === "undefined" ? 0 : performance.now();

/** The room's one ambient tick: it advances the star shimmer and gives the
 * Contact beacon's slow pulse its frames a few times a second. Scene rendering
 * is on demand, so this is all that renders while the room is at rest; it
 * stops for reduced-motion visitors, hidden tabs and full-screen games. */
export default function StarClock() {
  const invalidate = useThree((state) => state.invalidate);
  // Five ticks a second on capable machines, down to one on the weakest, and
  // at most two behind a district's content panels or the terminal.
  const { mode } = useSceneTransition();
  const tierRate = TIER_SETTINGS[useTier()].ambientFps;
  const rate = isDistrictMode(mode) || isTerminalMode(mode) ? Math.min(2, tierRate) : tierRate;
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const timer = window.setInterval(() => {
      if (preference.matches || document.hidden || sceneCovered()) return;
      STAR_TIME.value = (performance.now() - START) / 1000;
      invalidate();
    }, 1000 / rate);
    return () => window.clearInterval(timer);
  }, [invalidate, rate]);
  return null;
}
