import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { DirectionalLight } from "three";
import { quality, TIER_SETTINGS, TIERS, useTier, type Tier } from "./quality";
import { setBrickDetail } from "./brickGeometry/moldedEdges";
import { isDistrictMode, useSceneTransition } from "./SceneTransition";

/** Measures the live scene and steps quality down when it cannot keep up.
 *
 * The first reading is taken behind the hero poster: HeroFrame starts it with
 * the first live frame and keeps the poster up until it settles, so resolution,
 * shadow and brick changes, and the one shader recompile of a drop to low, all
 * happen before the visitor sees the live scene. The scene is drawn back to
 * back in short windows; each window may step the tier down, and the next one
 * re-measures at the new tier, until a window holds, emergency is reached or
 * CALIBRATE_CAP_MS passes.
 *
 * Afterwards rendering is on demand, so only frames that follow straight on
 * from a frame that asked for another (camera travel, parallax, animation)
 * are timed, in batches. For every reading:
 *
 *  - median over 150 ms: straight to emergency;
 *  - p95 over 45 ms or median over 40 ms (around 20 fps or worse): two tiers down;
 *  - p95 over 25 ms (under 40 fps at the slow end): one tier down;
 *  - otherwise the tier holds.
 *
 * Quality only ever goes down within a session, so it never oscillates, and the
 * first frames after each change (recompiles, uploads) are ignored. */
const BATCH = 36;
const WINDOW = 16, WINDOW_MS = 1500, CALIBRATE_CAP_MS = 6000;
/** Frames skipped after a tier change while programs and buffers settle. */
const SKIP_AFTER_CHANGE = 1;

/** The first reading's progress, shared with HeroFrame. */
export const calibration = {
  phase: "waiting" as "waiting" | "running" | "settled",
  startedAt: 0,
  windowStart: 0,
  begin() {
    if (this.phase !== "waiting") return;
    this.phase = "running";
    this.startedAt = this.windowStart = performance.now();
  },
};

function percentile(sorted: number[], fraction: number) {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
}

export function stepsDown(gaps: number[]) {
  const sorted = [...gaps].sort((a, b) => a - b);
  const median = percentile(sorted, .5), p95 = percentile(sorted, .95);
  if (median > 150) return TIERS.length;
  if (p95 > 45 || median > 40) return 2;
  if (p95 > 25) return 1;
  return 0;
}

export default function QualityGovernor() {
  const tier = useTier();
  const settings = TIER_SETTINGS[tier];
  const { mode } = useSceneTransition();
  const setDpr = useThree((state) => state.setDpr);
  const get = useThree((state) => state.get);
  const invalidate = useThree((state) => state.invalidate);

  // Resolution: the tier's ceiling, never above the device's own pixels.
  useEffect(() => { setDpr(Math.min(window.devicePixelRatio || 1, settings.dpr)); invalidate(); }, [settings.dpr, setDpr, invalidate]);

  // The key light's map is rebuilt at the new size on the next shadow pass.
  useEffect(() => {
    const { scene, gl } = get();
    scene.traverse((object) => {
      const light = object as DirectionalLight;
      if (!light.isDirectionalLight || !light.castShadow || light.shadow.mapSize.x === settings.shadowMap) return;
      light.shadow.mapSize.set(settings.shadowMap, settings.shadowMap);
      light.shadow.map?.dispose();
      light.shadow.map = null;
    });
    gl.shadowMap.needsUpdate = true;
    invalidate();
  }, [settings.shadowMap, get, invalidate]);

  // Close-up brick detail wherever it can be seen: everywhere on the upper
  // tiers, and in a district being entered or visited on the others.
  const closeUp = settings.fullBricks || isDistrictMode(mode);
  useEffect(() => { setBrickDetail(closeUp); invalidate(); }, [closeUp, invalidate]);

  const run = useRef({ last: 0, chained: false, gaps: [] as number[], skip: 0 });
  useEffect(() => { run.current.gaps = []; run.current.skip = SKIP_AFTER_CHANGE; calibration.windowStart = performance.now(); }, [tier]);

  useEffect(() => {
    const target = window as Window & { __quality?: () => object };
    target.__quality = () => ({ ...quality.get(), settings: quality.settings(), dpr: get().gl.getPixelRatio(), pending: run.current.gaps.length });
    return () => { delete target.__quality; };
  }, [get]);

  // Runs after the scene has been drawn (priority above HeroFrame's).
  useFrame((state) => {
    const r = run.current, now = performance.now();
    const calibrating = calibration.phase === "running";
    if (calibrating) state.invalidate();
    if (r.chained && !document.hidden) { if (r.skip > 0) r.skip--; else r.gaps.push(now - r.last); }
    r.last = now;
    // True when something in this frame asked for the next one.
    r.chained = state.internal.frames > 1 || calibrating;
    const step = () => {
      const steps = stepsDown(r.gaps);
      r.gaps = [];
      const current = TIERS.indexOf(quality.get().tier);
      if (steps && current < TIERS.length - 1) { quality.set(TIERS[Math.min(TIERS.length - 1, current + steps)] as Tier); return true; }
      return false;
    };
    if (calibrating) {
      const settle = () => { calibration.phase = "settled"; r.gaps = []; };
      // Past the cap, whatever was measured still decides, once.
      if (now - calibration.startedAt > CALIBRATE_CAP_MS) { if (r.gaps.length) step(); settle(); return; }
      // A window closes after WINDOW frames, or after WINDOW_MS with any frame:
      // on a very slow machine a single frame is already the answer.
      if (r.gaps.length < WINDOW && !(now - calibration.windowStart > WINDOW_MS && r.gaps.length >= 1)) return;
      calibration.windowStart = now;
      if (!step()) settle();
      return;
    }
    if (calibration.phase === "settled" && r.gaps.length >= BATCH) step();
  }, 2);
  return null;
}
