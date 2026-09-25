/** One quality tier, chosen once from what the device says about itself (never
 * the user-agent string): memory and cores where the browser reports them, and
 * whether it is a touch screen. The live frame rate can still step resolution
 * down from there (see AdaptiveResolution); nothing ever steps it back up.
 *
 *  - high: up to 2× device pixels, 4096² key shadow, full soft-shadow sampling;
 *  - standard: up to 1.5× device pixels, otherwise the same;
 *  - low: up to 1.25× device pixels, a 2048² shadow and lighter soft shadows. */
export type Tier = "high" | "standard" | "low";

function pick(): Tier {
  if (typeof window === "undefined") return "high";
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const cores = navigator.hardwareConcurrency;
  if ((memory !== undefined && memory < 4) || (cores !== undefined && cores <= 4)) return "low";
  if (window.matchMedia("(pointer: coarse)").matches || (memory !== undefined && memory < 8)) return "standard";
  return "high";
}

const tier = pick();
export const QUALITY = {
  tier,
  maxDpr: tier === "high" ? 2 : tier === "standard" ? 1.5 : 1.25,
  shadowMap: tier === "low" ? 2048 : 4096,
  softShadowSamples: tier === "low" ? 6 : 12,
} as const;
