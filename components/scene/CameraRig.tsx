import { useEffect, useLayoutEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { MathUtils, PerspectiveCamera, Vector2, Vector3 } from "three";
import { isTerminalMode, phase, useSceneTransition } from "./SceneTransition";
import { terminalPose } from "./terminalGeometry";
import { FOCUS_FOV, HERO_FOV, PANEL_SECTIONS, SECTION_ANCHORS, sectionTarget } from "./districtLayout";
import { ROOM_CENTRE_X, ROOM_CENTRE_Z } from "./roomLayout";
import { fitFov, viewpointPose } from "./viewpointPose";
import { clampCamera, clampToRoom } from "./cameraSafety";
import { roomDrag, sceneCovered } from "./roomInteractions";

/** Film offset that centres the frame in the part of the viewport left of a
 * section's detail panel (see content.css: min(66vw, 1180px) plus its margin).
 * Narrow layouts show the panel full screen, so they get no shift. */
function detailLensShift(width: number, aspect: number, fov: number) {
  if (width < 900 || aspect < 1.2) return 0;
  const free = width - Math.min(width * .66, 1180) - 32;
  const fraction = .5 - free / 2 / width;
  return fraction * 35 * aspect * 2 * Math.tan(MathUtils.degToRad(fov) / 2);
}

/** Pixels of travel before a press becomes a drag rather than a click. */
const DRAG_THRESHOLD = { mouse: 6, touch: 10 };

/** The camera has three behaviours, all damped and all driven from here:
 *  - resting at a curated viewpoint, with constrained exploration (drag to orbit
 *    a little around the viewpoint's target, wheel/pinch to dolly a little);
 *  - travelling between viewpoints on a short arc;
 *  - the district focus transitions, which always start from and return to the
 *    canonical City viewpoint. */
export default function CameraRig() {
  const { camera, size, invalidate, gl } = useThree();
  const setEvents = useThree((state) => state.setEvents);
  const { mode, section, advance, finish, viewpoint, viewpointRequest, finishViewpoint, terminalArrived, terminalLeft, detailId, touring } = useSceneTransition();
  const aspect = size.width / size.height;

  const pointer = useRef(new Vector2());
  const reduced = useRef(false);
  const coarse = useRef(false);
  const activeMode = useRef(mode);
  const touringRef = useRef(touring);
  const activeViewpoint = useRef(viewpoint);
  const look = useRef(new Vector3());
  const desired = useRef(new Vector3());
  const desiredLook = useRef(new Vector3());
  const initialised = useRef(false);

  // Exploration offsets: goal (driven by input) and current (damped toward goal).
  const exploreGoal = useRef({ yaw: 0, pitch: 0, dolly: 0 });
  const explore = useRef({ yaw: 0, pitch: 0, dolly: 0 });
  const dragging = useRef(false);

  // Viewpoint travel.
  const tween = useRef({ active: false, t: 0, duration: 1.6, arc: 0, fromFov: HERO_FOV, toFov: HERO_FOV });
  const tweenFrom = useRef(new Vector3());
  const tweenTo = useRef(new Vector3());
  const tweenFromLook = useRef(new Vector3());
  const tweenToLook = useRef(new Vector3());

  // District focus transition.
  const start = useRef(new Vector3());
  const startLook = useRef(new Vector3());
  const focus = useRef(new Vector3());
  const focusTarget = useRef(new Vector3(...sectionTarget("projects")));
  const focusOffset = useRef(new Vector3(...SECTION_ANCHORS.projects.offset));
  const arc = useRef(new Vector3(...SECTION_ANCHORS.projects.arc));

  // Terminal walk: from wherever the camera is to the seated terminal view,
  // and back to the workstation viewpoint.
  const walk = useRef({ t: 1, duration: 1.5, fromFov: HERO_FOV, done: true });
  const walkFrom = useRef(new Vector3());
  const walkFromLook = useRef(new Vector3());
  const walkTo = useRef(new Vector3());
  const walkToLook = useRef(new Vector3());

  // Planning-only camera, opt-in via ?roomPlan=1 (overview) or
  // ?roomPlan=x,y,z,tx,ty,tz (explicit pose). Never changes the approved hero
  // pose or any scene object transforms.
  const planParam = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("roomPlan") : null;
  const planPose = planParam?.split(",").map(Number);
  const roomPlanning = useRef(planParam === "1" || (planPose?.length ?? 0) >= 6);
  const planEye = useRef((planPose?.length ?? 0) >= 6 && planPose ? new Vector3(planPose[0], planPose[1], planPose[2]) : new Vector3(17, 21, 24));
  const planFov = useRef(planPose?.length === 7 ? planPose[6] : planPose?.length === 6 ? 35 : 45);
  const planLook = useRef((planPose?.length ?? 0) >= 6 && planPose ? new Vector3(planPose[3], planPose[4], planPose[5]) : new Vector3(ROOM_CENTRE_X, .6, ROOM_CENTRE_Z));

  // CameraRig owns the imperative Three.js camera; the helpers and effects below
  // are intentionally imperative, like the rest of the rig.
  /* eslint-disable react-hooks/immutability */

  /** The resting pose for a viewpoint with the current exploration applied. */
  const restingPose = (outPosition: Vector3, outLook: Vector3, withExplore: boolean) => {
    const pose = viewpointPose(activeViewpoint.current, aspect);
    const offset = pose.position.clone().sub(pose.target);
    if (withExplore) {
      const { yaw, pitch, dolly } = explore.current;
      const radius = offset.length() * (1 - dolly);
      const flat = Math.hypot(offset.x, offset.z);
      const azimuth = Math.atan2(offset.x, offset.z) + yaw;
      const elevation = MathUtils.clamp(Math.atan2(offset.y, flat) + pitch, -.2, 1.35);
      offset.set(Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.cos(azimuth) * Math.cos(elevation)).multiplyScalar(radius);
    }
    outPosition.copy(pose.target).add(offset);
    outPosition.x += pointer.current.x * .16;
    outPosition.y -= pointer.current.y * .10;
    clampCamera(outPosition);
    outLook.copy(pose.target);
    return pose;
  };

  const setFov = (fov: number, rate: number) => {
    const perspective = camera as PerspectiveCamera;
    if (perspective.fov === fov) return false;
    // Within a hair of the lens it lands on it exactly, rather than easing forever.
    perspective.fov = Math.abs(perspective.fov - fov) < .01 ? fov : perspective.fov + (fov - perspective.fov) * rate;
    perspective.updateProjectionMatrix();
    return true;
  };

  // Input: pointer parallax, drag exploration, wheel and pinch dolly.
  useEffect(() => {
    const element = gl.domElement;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarsePointer = window.matchMedia("(pointer: coarse)");
    const sync = () => { reduced.current = preference.matches; coarse.current = coarsePointer.matches; pointer.current.set(0, 0); invalidate(); };
    const canExplore = () => activeMode.current === "workbench" && !tween.current.active && !touringRef.current && !roomPlanning.current;
    const clampGoal = () => {
      const { bounds } = viewpointPose(activeViewpoint.current, 1);
      // Touch gets a tighter range; curated viewpoints carry mobile.
      const reach = coarse.current ? .6 : 1;
      const goal = exploreGoal.current;
      goal.yaw = MathUtils.clamp(goal.yaw, -bounds.yaw * reach, bounds.yaw * reach);
      goal.pitch = MathUtils.clamp(goal.pitch, -bounds.pitchDown * reach, bounds.pitchUp * reach);
      goal.dolly = MathUtils.clamp(goal.dolly, -bounds.dollyOut * reach, bounds.dollyIn * reach);
    };

    const press = { id: -1, x: 0, y: 0, lastX: 0, lastY: 0, type: "mouse" };
    const touches = new Map<number, { x: number; y: number }>();
    let pinchDistance = 0;

    const move = (event: PointerEvent) => {
      // An object being dragged across the floor owns the pointer.
      if (roomDrag.active) { press.id = -1; return; }
      if (touches.has(event.pointerId)) touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (touches.size === 2 && canExplore()) {
        const [a, b] = [...touches.values()];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchDistance) { exploreGoal.current.dolly += (distance - pinchDistance) * .0012; clampGoal(); invalidate(); }
        pinchDistance = distance;
        return;
      }
      if (event.pointerId === press.id) {
        const travelled = Math.hypot(event.clientX - press.x, event.clientY - press.y);
        const threshold = press.type === "touch" ? DRAG_THRESHOLD.touch : DRAG_THRESHOLD.mouse;
        if (!dragging.current && travelled > threshold && canExplore()) {
          dragging.current = true;
          // No hover or click while the room is being turned.
          setEvents({ enabled: false });
          element.style.cursor = "grabbing";
        }
        if (dragging.current) {
          const dx = event.clientX - press.lastX, dy = event.clientY - press.lastY;
          const scale = 1 / Math.max(480, window.innerWidth);
          exploreGoal.current.yaw -= dx * scale * 1.35;
          exploreGoal.current.pitch += dy * scale * 1.0;
          clampGoal();
          invalidate();
        }
        press.lastX = event.clientX; press.lastY = event.clientY;
        return;
      }
      if (activeMode.current !== "workbench" || reduced.current || event.pointerType !== "mouse" || dragging.current || sceneCovered()) return;
      pointer.current.set(MathUtils.clamp(event.clientX / window.innerWidth * 2 - 1, -1, 1), MathUtils.clamp(event.clientY / window.innerHeight * 2 - 1, -1, 1));
      invalidate();
    };
    const down = (event: PointerEvent) => {
      if (event.pointerType === "touch") touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (touches.size > 1) { press.id = -1; pinchDistance = 0; return; }
      if (!canExplore() || (event.pointerType === "mouse" && event.button !== 0)) return;
      // A district or object already under the pointer owns the press: never turn the room.
      if (roomDrag.active || document.body.style.cursor === "pointer" || document.body.style.cursor === "grab") return;
      Object.assign(press, { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, type: event.pointerType });
    };
    const swallowClick = (event: MouseEvent) => { event.stopPropagation(); event.preventDefault(); };
    const up = (event: PointerEvent) => {
      touches.delete(event.pointerId);
      if (touches.size < 2) pinchDistance = 0;
      if (event.pointerId !== press.id) return;
      press.id = -1;
      if (!dragging.current) return;
      dragging.current = false;
      element.style.cursor = "";
      setEvents({ enabled: !touringRef.current });
      // The click that follows a drag must not reach a district.
      window.addEventListener("click", swallowClick, { capture: true, once: true });
      window.setTimeout(() => window.removeEventListener("click", swallowClick, { capture: true }), 0);
    };
    const wheel = (event: WheelEvent) => {
      if (!canExplore()) return;
      event.preventDefault();
      // Trackpad pinch arrives as ctrl+wheel with small deltas.
      exploreGoal.current.dolly -= event.deltaY * (event.ctrlKey ? .006 : .0006);
      clampGoal();
      invalidate();
    };
    const reset = () => { if (activeMode.current === "workbench") pointer.current.set(0, 0); invalidate(); };

    sync();
    element.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    element.addEventListener("wheel", wheel, { passive: false });
    document.documentElement.addEventListener("pointerleave", reset);
    window.addEventListener("blur", reset);
    preference.addEventListener("change", sync);
    coarsePointer.addEventListener("change", sync);
    return () => {
      element.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      element.removeEventListener("wheel", wheel);
      document.documentElement.removeEventListener("pointerleave", reset);
      window.removeEventListener("blur", reset);
      preference.removeEventListener("change", sync);
      coarsePointer.removeEventListener("change", sync);
    };
  }, [gl, invalidate, setEvents]);

  // First pose, the planning camera, and re-fitting on resize. Laid out before
  // the first frame so the room is never drawn from anywhere but the hero.
  useLayoutEffect(() => {
    if (roomPlanning.current) {
      camera.position.copy(planEye.current);
      camera.lookAt(planLook.current);
      (camera as PerspectiveCamera).fov = planFov.current;
      (camera as PerspectiveCamera).updateProjectionMatrix();
      invalidate();
      return;
    }
    if (!initialised.current) {
      initialised.current = true;
      const pose = restingPose(camera.position, look.current, false);
      camera.lookAt(look.current);
      (camera as PerspectiveCamera).fov = pose.fov;
    }
    (camera as PerspectiveCamera).updateProjectionMatrix();
    invalidate();
    // restingPose reads refs and the current aspect only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, aspect, invalidate]);

  // A guided tour drives the camera itself: districts take no pointer events
  // and the room cannot be turned by hand until it ends.
  useEffect(() => {
    touringRef.current = touring;
    if (touring) { exploreGoal.current = { yaw: 0, pitch: 0, dolly: 0 }; pointer.current.set(0, 0); }
    if (!tween.current.active) setEvents({ enabled: !touring });
    invalidate();
  }, [touring, setEvents, invalidate]);

  // A viewpoint request starts an arced, eased move from wherever the camera is.
  useLayoutEffect(() => {
    activeViewpoint.current = viewpoint;
    exploreGoal.current = { yaw: 0, pitch: 0, dolly: 0 };
    explore.current = { yaw: 0, pitch: 0, dolly: 0 };
    if (!initialised.current || mode !== "workbench" || viewpointRequest === 0) return;
    const pose = restingPose(tweenTo.current, tweenToLook.current, false);
    tweenFrom.current.copy(camera.position);
    tweenFromLook.current.copy(look.current);
    const distance = tweenFrom.current.distanceTo(tweenTo.current);
    Object.assign(tween.current, {
      active: true, t: 0,
      duration: reduced.current ? .35 : MathUtils.clamp(1.2 + distance * .055, 1.2, 2),
      arc: reduced.current ? 0 : Math.min(1.4, distance * .12),
      fromFov: (camera as PerspectiveCamera).fov, toFov: pose.fov,
    });
    setEvents({ enabled: false });
    invalidate();
    // restingPose reads refs and the current aspect only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewpoint, viewpointRequest]);

  // Terminal walk: capture the departure at each boundary.
  useLayoutEffect(() => {
    if (mode !== "terminal-entering" && mode !== "terminal-leaving") return;
    if (tween.current.active) { tween.current.active = false; setEvents({ enabled: !touringRef.current }); finishViewpoint(); }
    walkFrom.current.copy(camera.position);
    walkFromLook.current.copy(look.current);
    Object.assign(walk.current, {
      t: 0, done: false, fromFov: (camera as PerspectiveCamera).fov,
      duration: reduced.current ? .35 : mode === "terminal-entering" ? 1.25 : 1.35,
    });
    pointer.current.set(0, 0);
    invalidate();
    // restingPose reads refs and the current aspect only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // District focus: capture the departure, and return to the canonical city.
  useLayoutEffect(() => {
    if (mode.startsWith("entering-") && !activeMode.current.startsWith("entering-")) {
      start.current.copy(camera.position);
      startLook.current.copy(look.current);
      const anchor = SECTION_ANCHORS[section];
      focusTarget.current.set(...sectionTarget(section));
      focusOffset.current.set(...anchor.offset);
      arc.current.set(...anchor.arc);
      if (tween.current.active) { tween.current.active = false; setEvents({ enabled: !touringRef.current }); finishViewpoint(); }
    }
    if (mode.startsWith("leaving-") && !activeMode.current.startsWith("leaving-")) {
      // Back always lands on the City viewpoint, not the angle the visitor left.
      activeViewpoint.current = "city";
      pointer.current.set(0, 0);
      restingPose(start.current, startLook.current, false);
    }
    if (mode === "workbench" && activeMode.current.startsWith("leaving-")) {
      camera.position.copy(start.current);
      look.current.copy(startLook.current);
    }
    activeMode.current = mode;
    invalidate();
    // restingPose reads refs and the current aspect only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, section, camera, invalidate, finishViewpoint, setEvents]);

  useFrame((_, delta) => {
    if (roomPlanning.current) {
      camera.lookAt(planLook.current);
      return;
    }
    const step = Math.min(delta, .05);
    // An open detail panel takes the right of the screen on wide layouts; a lens
    // shift (not a camera move) re-centres the district in the space left of it.
    const perspective = camera as PerspectiveCamera;
    const open = mode === section && !touring;
    // About's reading column sits on the left, so its district moves right instead.
    const lensShift = open && section === "about" ? -.7 * detailLensShift(size.width, aspect, perspective.fov)
      : open && (detailId || PANEL_SECTIONS.has(section)) ? detailLensShift(size.width, aspect, perspective.fov) : 0;
    if (Math.abs(perspective.filmOffset - lensShift) > .002) {
      perspective.filmOffset += (lensShift - perspective.filmOffset) * (reduced.current ? 1 : 1 - Math.exp(-6 * step));
      perspective.updateProjectionMatrix();
      invalidate();
    }
    if (isTerminalMode(mode)) {
      const entering = mode !== "terminal-leaving";
      // Destinations are re-evaluated each frame so a resize mid-walk still lands true.
      let toFov: number;
      if (entering) {
        const pose = terminalPose(aspect);
        walkTo.current.copy(pose.position); walkToLook.current.copy(pose.target); toFov = fitFov(pose.fov, aspect);
      } else {
        toFov = restingPose(walkTo.current, walkToLook.current, false).fov;
      }
      const w = walk.current;
      if (!w.done) {
        w.t = Math.min(1, w.t + step / w.duration);
        const eased = phase(w.t, 0, 1);
        camera.position.lerpVectors(walkFrom.current, walkTo.current, eased);
        // A slight rise mid-walk, as if stepping around the chair.
        camera.position.y += Math.sin(Math.PI * eased) * Math.min(.45, walkFrom.current.distanceTo(walkTo.current) * .06);
        clampToRoom(camera.position);
        look.current.lerpVectors(walkFromLook.current, walkToLook.current, eased);
        (camera as PerspectiveCamera).fov = MathUtils.lerp(w.fromFov, toFov, eased);
        (camera as PerspectiveCamera).updateProjectionMatrix();
        camera.lookAt(look.current);
        invalidate();
        if (w.t >= 1) {
          w.done = true;
          if (entering) terminalArrived(); else terminalLeft();
        }
      } else if (entering) {
        camera.position.copy(walkTo.current);
        look.current.copy(walkToLook.current);
        camera.lookAt(look.current);
        setFov(toFov, 1);
      }
      return;
    }
    if (mode !== "workbench") {
      const t = advance(delta);
      const travel = phase(t.progress, 0, .88);
      focus.current.copy(focusTarget.current).add(focusOffset.current);
      // Bow out gently along the approach, never leaving the room.
      camera.position.lerpVectors(start.current, focus.current, travel);
      camera.position.addScaledVector(arc.current, Math.sin(Math.PI * travel));
      clampToRoom(camera.position);
      look.current.lerpVectors(startLook.current, focusTarget.current, travel);
      camera.lookAt(look.current);
      const fromFov = viewpointPose("city", aspect).fov;
      setFov(MathUtils.lerp(fromFov, fitFov(FOCUS_FOV, aspect), travel), 1 - Math.exp(-6 * step));
      if (mode.startsWith("entering-") || mode.startsWith("leaving-")) {
        invalidate();
        if (t.elapsed >= t.duration) finish();
      }
      return;
    }

    if (tween.current.active) {
      const move = tween.current;
      move.t = Math.min(1, move.t + step / move.duration);
      const eased = phase(move.t, 0, 1);
      camera.position.lerpVectors(tweenFrom.current, tweenTo.current, eased);
      camera.position.y += move.arc * Math.sin(Math.PI * eased);
      clampCamera(camera.position);
      look.current.lerpVectors(tweenFromLook.current, tweenToLook.current, eased);
      camera.lookAt(look.current);
      (camera as PerspectiveCamera).fov = MathUtils.lerp(move.fromFov, move.toFov, eased);
      (camera as PerspectiveCamera).updateProjectionMatrix();
      invalidate();
      if (move.t >= 1) {
        move.active = false;
        setEvents({ enabled: !touringRef.current });
        finishViewpoint();
      }
      return;
    }

    // Resting: heavy damping toward the explored pose.
    const current = explore.current, goal = exploreGoal.current;
    const settle = 1 - Math.exp(-3.2 * step);
    current.yaw += (goal.yaw - current.yaw) * settle;
    current.pitch += (goal.pitch - current.pitch) * settle;
    current.dolly += (goal.dolly - current.dolly) * settle;
    const pose = restingPose(desired.current, desiredLook.current, true);
    const follow = 1 - Math.exp(-3 * step);
    camera.position.lerp(desired.current, follow);
    look.current.lerp(desiredLook.current, follow);
    camera.lookAt(look.current);
    const fovMoving = setFov(pose.fov, follow);
    const exploring = Math.abs(goal.yaw - current.yaw) + Math.abs(goal.pitch - current.pitch) + Math.abs(goal.dolly - current.dolly) > .0002;
    if (exploring || fovMoving || camera.position.distanceToSquared(desired.current) > .000001 || look.current.distanceToSquared(desiredLook.current) > .000001) invalidate();
  }, -2);
  /* eslint-enable react-hooks/immutability */
  return null;
}
