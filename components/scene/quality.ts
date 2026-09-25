import { useSyncExternalStore } from "react";

/** Automatic rendering quality. A first guess comes from what the device says
 * about itself (cores, memory, touch, the WebGL renderer string, never the
 * user-agent); measured frame times of the live scene then step it down (see
 * QualityGovernor). Visitors never choose a tier; `?quality=<tier>` forces one
 * and `?qualityStart=<tier>` sets the starting point, for testing.
 *
 *  - ultra: up to 2× device pixels, full close-up bricks everywhere, 4096² soft key shadow;
 *  - high: up to 1.5× device pixels, otherwise ultra;
 *  - medium: 1.25×, 2048² soft shadow, bricks simplified until a district is entered;
 *    (soft shadows and lamp lights change shader programs, so they switch only once,
 *    on the step to low, never between the tiers above it);
 *  - low: 1×, 2048² hard-edged shadow, no decorative lamps' real-time light;
 *  - emergency: .85×, 1024² shadow, slowest ambient ticks; nothing is removed. */
export type Tier = "ultra" | "high" | "medium" | "low" | "emergency";
export const TIERS: readonly Tier[] = ["ultra", "high", "medium", "low", "emergency"];

export type TierSettings = {
  /** Upper bound on the canvas pixel ratio (never above the device's own). */
  dpr: number;
  shadowMap: number;
  /** PCSS samples; 0 uses plain PCF filtering, much cheaper per pixel. */
  softShadowSamples: number;
  /** Lamp point lights and the glass wall's area light. */
  decorativeLights: boolean;
  /** Full molded bricks everywhere, or plain boxes until a district is entered. */
  fullBricks: boolean;
  /** Ambient star/beacon tick and the monitor dashboard, frames per second. */
  ambientFps: number;
  monitorFps: number;
};

export const TIER_SETTINGS: Record<Tier, TierSettings> = {
  ultra: { dpr: 2, shadowMap: 4096, softShadowSamples: 12, decorativeLights: true, fullBricks: true, ambientFps: 5, monitorFps: 15 },
  high: { dpr: 1.5, shadowMap: 4096, softShadowSamples: 12, decorativeLights: true, fullBricks: true, ambientFps: 5, monitorFps: 12 },
  medium: { dpr: 1.25, shadowMap: 2048, softShadowSamples: 12, decorativeLights: true, fullBricks: false, ambientFps: 4, monitorFps: 10 },
  low: { dpr: 1, shadowMap: 2048, softShadowSamples: 0, decorativeLights: false, fullBricks: false, ambientFps: 2, monitorFps: 6 },
  emergency: { dpr: .85, shadowMap: 1024, softShadowSamples: 0, decorativeLights: false, fullBricks: false, ambientFps: 1, monitorFps: 3 },
};

/** The WebGL renderer string, from a throwaway context released at once. */
function rendererName(): string {
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") ?? canvas.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return "";
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? "");
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return name;
  } catch { return ""; }
}

/** `?quality=<tier>` pins a tier; `?qualityStart=<tier>` only replaces the first guess. */
function fromQuery(key: string): Tier | null {
  const value = new URLSearchParams(location.search).get(key);
  return value && (TIERS as readonly string[]).includes(value) ? value as Tier : null;
}

function guess(): Tier {
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const cores = navigator.hardwareConcurrency ?? 4;
  const renderer = rendererName();
  if (/swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer)) return "emergency";
  if ((memory !== undefined && memory < 4) || cores <= 2) return "low";
  const touch = window.matchMedia("(pointer: coarse)").matches;
  // Integrated graphics: Intel's, and AMD's APUs, which report no model number.
  const integrated = /intel|radeon\(tm\) graphics|radeon graphics|vega \d+ graphics/i.test(renderer);
  if (integrated) return cores <= 4 ? "low" : "medium";
  if (touch || cores <= 4 || (memory !== undefined && memory < 8)) return "high";
  return cores >= 8 ? "ultra" : "high";
}

type State = { tier: Tier; initial: Tier; forced: boolean };
let state: State = { tier: "high", initial: "high", forced: false };
if (typeof window !== "undefined") {
  const pinned = fromQuery("quality");
  const tier = pinned ?? fromQuery("qualityStart") ?? guess();
  state = { tier, initial: tier, forced: pinned !== null };
}
const listeners = new Set<() => void>();

export const quality = {
  get: () => state,
  settings: () => TIER_SETTINGS[state.tier],
  /** Moves to another tier; a forced tier never moves. */
  set(tier: Tier) {
    if (state.forced || tier === state.tier) return;
    state = { ...state, tier };
    listeners.forEach((listener) => listener());
  },
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
};

const serverState = () => "high" as Tier;
export function useTier(): Tier {
  return useSyncExternalStore(quality.subscribe, () => state.tier, serverState);
}

/** The initial tier's settings, for choices fixed when the canvas is created. */
export const INITIAL = TIER_SETTINGS[state.initial];

/** Whether the lamps' real-time lights are on at the current tier. */
export const useDecorativeLights = () => TIER_SETTINGS[useTier()].decorativeLights;
