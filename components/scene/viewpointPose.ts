import { MathUtils, Vector3 } from "three";
import { VIEWPOINTS, type ViewpointId } from "./viewpoints";

/** The aspect every viewpoint is composed for. */
const DESIGN_ASPECT = 1.6;

/** Inside a closed room the camera cannot back away for narrow screens, so a
 * narrow viewport widens the lens instead: the vertical FOV grows until the
 * horizontal view matches the composed one, within a sane limit. */
export function fitFov(fov: number, aspect: number) {
  if (aspect >= DESIGN_ASPECT) return fov;
  const half = Math.atan(Math.tan(MathUtils.degToRad(fov) / 2) * DESIGN_ASPECT / aspect);
  return Math.min(68, MathUtils.radToDeg(2 * half));
}

/** Camera math stays in the lazy 3D bundle; HTML navigation needs only data. */
export function viewpointPose(id: ViewpointId, aspect: number) {
  const viewpoint = VIEWPOINTS[id];
  const target = new Vector3(...viewpoint.target);
  // A tall frame shows more above and below the subject than a wide one; views
  // tip down on portrait screens so the ceiling stays out of frame. Every phone
  // (aspect up to .66) shares one tilt, so one hero poster matches them all.
  target.y -= MathUtils.clamp((1.2 - aspect) / .54, 0, 1) * (id === "city" ? .95 : .6);
  return { position: new Vector3(...viewpoint.position), target, fov: fitFov(viewpoint.fov, aspect), bounds: viewpoint.bounds };
}
