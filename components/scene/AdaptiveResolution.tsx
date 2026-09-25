import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { QUALITY } from "./quality";

/** Starts at the quality tier's resolution (see quality.ts) and steps down one
 * level only if sustained motion (camera travel, parallax) renders slower than
 * ~45 fps, never back up. The canvas renders on demand, so only back-to-back
 * frames are measured; idle gaps never count. */
const STEPS = [2, 1.5, 1.25, 1];
const SAMPLE = 45;
const BUDGET_MS = 22;

export default function AdaptiveResolution() {
  const setDpr = useThree((state) => state.setDpr);
  const step = useRef(Math.max(0, STEPS.indexOf(QUALITY.maxDpr)));
  const run = useRef({ frames: 0, total: 0, last: 0 });
  useFrame(() => {
    const now = performance.now();
    const gap = now - run.current.last;
    run.current.last = now;
    if (gap > 100) { run.current.frames = 0; run.current.total = 0; return; }
    run.current.frames++;
    run.current.total += gap;
    if (run.current.frames < SAMPLE) return;
    const average = run.current.total / run.current.frames;
    run.current.frames = 0; run.current.total = 0;
    if (average > BUDGET_MS && step.current < STEPS.length - 1) {
      step.current++;
      setDpr(Math.min(window.devicePixelRatio, STEPS[step.current]));
    }
  });
  return null;
}
