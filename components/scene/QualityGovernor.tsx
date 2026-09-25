import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { DirectionalLight } from "three";
import { quality, TIER_SETTINGS, TIERS, useTier, type Tier } from "./quality";
import { setBrickDetail } from "./brickGeometry/moldedEdges";
import { isDistrictMode, useSceneTransition } from "./SceneTransition";

/** Measures the live scene and steps quality down when it cannot keep up.
 *
 * Rendering is on demand, so only frames that follow straight on from a frame
 * that asked for another (camera travel, parallax, animation) are timed; the
 * gap between two such frames is what the visitor feels. Right after the hero
 * appears, the scene is drawn continuously for a few seconds to take a first
 * reading from real frames. Each reading is a batch of frames:
 *
 *  - median over 150 ms: straight to emergency;
 *  - p95 over 45 ms or median over 40 ms (around 20 fps or worse): two tiers down;
 *  - p95 over 25 ms (under 40 fps at the slow end): one tier down;
 *  - otherwise the tier holds.
 *
 * Quality only ever goes down within a session, so it never oscillates, and a
 * second of frames after each change is ignored while it settles. */
const BATCH = 36;
const CALIBRATE_MS = 3200;
const SETTLE_MS = 1000;

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

  const run = useRef({ last: 0, chained: false, gaps: [] as number[], quietUntil: 0, calibrateUntil: -1 });
  useEffect(() => { run.current.gaps = []; run.current.quietUntil = performance.now() + SETTLE_MS; }, [tier]);

  // The first reading starts with the hero on screen.
  useEffect(() => {
    const begin = () => { run.current.calibrateUntil = performance.now() + CALIBRATE_MS; run.current.quietUntil = performance.now() + 150; invalidate(); };
    if (performance.getEntriesByName("studio:ready").length) { begin(); return; }
    const listen = (event: Event) => { if ((event as CustomEvent).detail === "ready") begin(); };
    window.addEventListener("studio-stage", listen);
    return () => window.removeEventListener("studio-stage", listen);
  }, [invalidate]);

  useEffect(() => {
    const target = window as Window & { __quality?: () => object };
    target.__quality = () => ({ ...quality.get(), settings: quality.settings(), dpr: get().gl.getPixelRatio(), pending: run.current.gaps.length });
    return () => { delete target.__quality; };
  }, [get]);

  // Runs after the scene has been drawn (priority above HeroFrame's).
  useFrame((state) => {
    const r = run.current, now = performance.now();
    const calibrating = now < r.calibrateUntil;
    if (r.chained && now >= r.quietUntil && !document.hidden) r.gaps.push(now - r.last);
    r.last = now;
    if (calibrating) state.invalidate();
    // True when something in this frame asked for the next one.
    r.chained = state.internal.frames > 1 || calibrating;
    const enough = r.gaps.length >= BATCH || (r.calibrateUntil > 0 && !calibrating && r.gaps.length >= 3);
    if (!enough) return;
    if (r.calibrateUntil > 0 && !calibrating) r.calibrateUntil = 0;
    const steps = stepsDown(r.gaps);
    r.gaps = [];
    if (!steps) return;
    const current = TIERS.indexOf(quality.get().tier);
    quality.set(TIERS[Math.min(TIERS.length - 1, current + steps)] as Tier);
  }, 2);
  return null;
}
