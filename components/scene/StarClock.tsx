import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { STAR_TIME } from "./roomAssets/nightSky";
import { sceneCovered } from "./roomInteractions";

/** The room's one ambient tick: it advances the star shimmer and gives the
 * Contact beacon's slow pulse its frames a few times a second. Scene rendering
 * is on demand, so this is all that renders while the room is at rest; it
 * stops for reduced-motion visitors, hidden tabs and full-screen games. */
const RATE = 5;

export default function StarClock() {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const start = performance.now();
    const timer = window.setInterval(() => {
      if (preference.matches || document.hidden || sceneCovered()) return;
      STAR_TIME.value = (performance.now() - start) / 1000;
      invalidate();
    }, 1000 / RATE);
    return () => window.clearInterval(timer);
  }, [invalidate]);
  return null;
}
