import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useCursor } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { AdditiveBlending, CanvasTexture, Color, ConeGeometry, MathUtils, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, Quaternion, SphereGeometry, Vector3, type Group } from "three";
import { Piece, useAssembled, useRoomSurfaces } from "./roomAssets/RoomSurfaces";
import { buildCabinetDrawer, CABINET_DRAWERS } from "./roomAssets/props";
import { buildSkyscraper, SKYSCRAPER_FLOORS } from "./roomAssets/skyscraper";
import { bevelBox, rod } from "./roomAssets/shapes";
import { firePulse, flipRoomToggle, roomReachable, usePulse, useRoomToggle } from "./roomInteractions";
import { useSceneTransition } from "./SceneTransition";
import { CABINET_AT, METRE, ROOM } from "./roomLayout";

const noRaycast = () => {};
const REACH = ["workstation", "room"] as const;
const TOP = .1 + .62 + .02;
const TOWER_AT: [number, number, number] = [-.3, TOP, -.02];
const TAPE_AT: [number, number, number] = [.24, TOP + .02, .13];
const LAMP = { clip: [-.08, 1.62, -.19] as [number, number, number], head: [-.2, 1.5, -.12] as [number, number, number] };
const ARM = (() => {
  const clip = new Vector3(...LAMP.clip), head = new Vector3(...LAMP.head), along = head.clone().sub(clip);
  return { centre: clip.clone().add(head).multiplyScalar(.5), length: along.length(), turn: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), along.normalize()) };
})();
const GLOW = new Color("#8d7bff");
/** Floors come on over this long; the tape runs out and back over these. */
const LIGHTING_SECONDS = 2.4, TAPE_OUT = .5, TAPE_HOLD = 1.2, TAPE_IN = .6;
type Target = "electronics" | "bricks" | "tower" | "tape" | "lamp";

const electronics = () => buildCabinetDrawer("electronics");
const bricks = () => buildCabinetDrawer("bricks");

/** The workshop cabinet's working parts: its two top drawers slide out on a
 * click (electronics on the left, spare bricks on the right), the skyscraper
 * model on top lights floor by floor and then its crown beacon, the tape
 * measure runs its tape out and back, and the clip lamp on the pegboard
 * switches on and off. Everything else about the cabinet is scenery. */
export default function CabinetWorkshop() {
  const { mode, touring, roomFocus, viewpoint, viewpointMoving } = useSceneTransition();
  const reachable = roomReachable({ mode, touring, roomFocus, viewpoint, viewpointMoving }, [...REACH]);
  const invalidate = useThree((state) => state.invalidate);
  const [hover, setHover] = useState<Target | null>(null);
  useCursor(hover !== null && reachable);
  const open = { electronics: useRoomToggle("electronicsDrawer"), bricks: useRoomToggle("brickDrawer") };
  const tower = (usePulse("tower") % 3) as 0 | 1 | 2;
  const lamp = useRoomToggle("pegLamp");
  const tapeRuns = usePulse("tape");

  const drawers = [useAssembled(electronics), useAssembled(bricks)];
  const { materials } = useRoomSurfaces();
  const model = useMemo(() => buildSkyscraper(), []);
  const kit = useMemo(() => {
    const pull = [0, 1].map(() => { const m = materials.blackSteel.clone(); m.emissive.copy(GLOW); m.emissiveIntensity = 0; return m; });
    const windows = new MeshStandardMaterial({ color: "#1a2230", roughness: .25, emissive: "#ffd796", emissiveIntensity: 1 });
    const lit = { value: 0 };
    windows.onBeforeCompile = (shader) => {
      shader.uniforms.litFloors = lit;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nattribute float floor;\nvarying float vFloor;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvFloor = floor;");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform float litFloors;\nvarying float vFloor;")
        .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance *= clamp(litFloors - vFloor, 0.0, 1.0) * (.75 + .25 * fract(sin(vFloor * 12.9898) * 43758.5453));");
    };
    windows.customProgramCacheKey = () => "skyscraper-windows";
    const beacon = new MeshBasicMaterial({ color: "#ff3b2f", transparent: true, opacity: .25, toneMapped: false });
    const bulb = new MeshBasicMaterial({ color: "#fff1d0", toneMapped: false });
    const tapeBody = bevelBox([.06, .06, .03], .012);
    const tape = bevelBox([1, .002, .018], .0005);
    tape.translate(.5, 0, 0);
    const lampArm = rod(.005, 1, 8);
    const head = new ConeGeometry(.035, .06, 16, 1, true);
    const dot = new SphereGeometry(.006, 10, 8);
    // The lamp's light is a warm pool laid over the board and the model, not a
    // real light: a real one would cost every surface in the room, lit or not.
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const g = canvas.getContext("2d")!, falloff = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    falloff.addColorStop(0, "rgba(255,255,255,1)"); falloff.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = falloff; g.fillRect(0, 0, 64, 64);
    const poolMap = new CanvasTexture(canvas);
    const pool = new MeshBasicMaterial({ color: "#ffd9a0", alphaMap: poolMap, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, toneMapped: false });
    const poolPlane = new PlaneGeometry(1, 1);
    return {
      pull, windows, lit, beacon, bulb, tapeBody, tape, lampArm, head, dot, pool, poolMap, poolPlane,
      overrides: pull.map((material) => ({ blackSteel: material })),
      dispose() { [...pull, windows, beacon, bulb, pool].forEach((m) => m.dispose()); [tapeBody, tape, lampArm, head, dot, poolPlane].forEach((g) => g.dispose()); poolMap.dispose(); },
    };
  }, [materials]);
  useEffect(() => () => kit.dispose(), [kit]);
  useEffect(() => () => { model.windows.dispose(); model.parts.forEach((geometry) => geometry.dispose()); }, [model]);
  const live = useRef<typeof kit | null>(null);
  useLayoutEffect(() => { live.current = kit; }, [kit]);
  useEffect(() => { invalidate(); }, [open.electronics, open.bricks, tower, lamp, tapeRuns, hover, reachable, mode, touring, invalidate]);
  // Drawers stay shut while the visitor is out of the room (a district, the terminal, the tour).
  const inRoom = mode === "workbench" && !touring;

  const drawerGroups = useRef<(Group | null)[]>([]);
  const tapeGroup = useRef<Group>(null);
  const run = useRef({ slide: [0, 0], lit: 0, tape: { seen: 0, start: -1 }, glow: [0, 0], lamp: 0 });
  useFrame((state, delta) => {
    const k = live.current, r = run.current, step = Math.min(delta, .05), now = state.clock.elapsedTime;
    if (!k) return;
    let busy = false;
    (["electronics", "bricks"] as const).forEach((id, i) => {
      const target = open[id] && inRoom ? 1 : 0;
      r.slide[i] = MathUtils.damp(r.slide[i], target, 7, step);
      if (Math.abs(r.slide[i] - target) < .002) r.slide[i] = target; else busy = true;
      const group = drawerGroups.current[i];
      if (group) group.position.z = CABINET_DRAWERS.z + r.slide[i] * CABINET_DRAWERS.travel;
      const glow = hover === id && reachable ? 1 : 0;
      r.glow[i] = MathUtils.damp(r.glow[i], glow, 10, step);
      if (Math.abs(r.glow[i] - glow) > .003) busy = true;
      k.pull[i].emissiveIntensity = r.glow[i] * .9;
    });
    // Floors light from the lobby up; off, they go out together.
    const litTarget = tower ? SKYSCRAPER_FLOORS + 1 : 0;
    r.lit = tower ? Math.min(litTarget, r.lit + step * (SKYSCRAPER_FLOORS + 1) / LIGHTING_SECONDS) : Math.max(0, r.lit - step * 40);
    if (r.lit !== litTarget) busy = true;
    k.lit.value = r.lit;
    k.beacon.opacity = tower === 2 ? 1 : .25;
    // The tape: out, a moment, back in.
    if (tapeRuns !== r.tape.seen) { r.tape.seen = tapeRuns; if (r.tape.start < 0) r.tape.start = now; }
    let reach = 0;
    if (r.tape.start >= 0) {
      const t = now - r.tape.start;
      if (t > TAPE_OUT + TAPE_HOLD + TAPE_IN) r.tape.start = -1;
      else { busy = true; reach = t < TAPE_OUT ? MathUtils.smootherstep(t, 0, TAPE_OUT) : t < TAPE_OUT + TAPE_HOLD ? 1 : 1 - MathUtils.smoothstep(t, TAPE_OUT + TAPE_HOLD, TAPE_OUT + TAPE_HOLD + TAPE_IN); }
    }
    if (tapeGroup.current) tapeGroup.current.scale.x = Math.max(.001, reach * .24);
    r.lamp = MathUtils.damp(r.lamp, lamp ? 1 : 0, 12, step);
    if (Math.abs(r.lamp - (lamp ? 1 : 0)) > .003) busy = true;
    k.pool.opacity = r.lamp * .55;
    k.bulb.color.setRGB(.25 + .75 * r.lamp, .22 + .72 * r.lamp, .18 + .6 * r.lamp);
    if (busy) invalidate();
  });

  const target = (id: Target, act: () => void) => ({
    onPointerOver: (event: { stopPropagation(): void }) => { if (!reachable) return; event.stopPropagation(); setHover(id); },
    onPointerOut: () => setHover((current) => (current === id ? null : current)),
    onClick: (event: { stopPropagation(): void }) => { if (!reachable) return; event.stopPropagation(); act(); },
  });
  const [cx, , cz] = CABINET_AT.at;
  return (
    <group name="workshop cabinet" position={[cx, ROOM.floor, cz]} rotation={[0, CABINET_AT.turn, 0]} scale={METRE}>
      {(["electronics", "bricks"] as const).map((id, i) => (
        <group key={id} ref={(group) => { drawerGroups.current[i] = group; }} position={[CABINET_DRAWERS.xs[i], CABINET_DRAWERS.y, CABINET_DRAWERS.z]}>
          <Piece parts={drawers[i]} overrides={kit.overrides[i]} />
          <mesh position={[0, 0, .01]} {...target(id, () => flipRoomToggle(id === "electronics" ? "electronicsDrawer" : "brickDrawer"))}>
            <boxGeometry args={[CABINET_DRAWERS.width, .11, .05]} />
            <meshBasicMaterial visible={false} />
          </mesh>
        </group>
      ))}

      <group position={TOWER_AT}>
        <Piece parts={model.parts} />
        <mesh geometry={model.windows} material={kit.windows} raycast={noRaycast} />
        <mesh geometry={kit.dot} material={kit.beacon} position={model.beacon} raycast={noRaycast} />
        <mesh position={[0, model.height / 2, 0]} {...target("tower", () => firePulse("tower"))}>
          <boxGeometry args={[.19, model.height, .15]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      </group>

      <group position={TAPE_AT}>
        <mesh geometry={kit.tapeBody} material={materials.brickYellow} castShadow raycast={noRaycast} />
        <group ref={tapeGroup} position={[.03, -.028, 0]} scale={[.001, 1, 1]}>
          <mesh geometry={kit.tape} material={materials.brass} raycast={noRaycast} />
        </group>
        <mesh {...target("tape", () => firePulse("tape"))}>
          <boxGeometry args={[.08, .08, .05]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      </group>

      {/* The clip lamp on the pegboard's top edge, its arm reaching over the model. */}
      <group>
        <mesh geometry={kit.lampArm} material={materials.blackSteel} position={ARM.centre} quaternion={ARM.turn} scale={[1, ARM.length, 1]} raycast={noRaycast} />
        <mesh geometry={kit.head} material={materials.blackSteel} position={LAMP.head} castShadow raycast={noRaycast} />
        <mesh geometry={kit.dot} material={kit.bulb} position={[LAMP.head[0], LAMP.head[1] - .02, LAMP.head[2]]} scale={2} raycast={noRaycast} />
        <mesh geometry={kit.poolPlane} material={kit.pool} position={[LAMP.head[0] + .05, 1.36, -.182]} scale={[.62, .5, 1]} raycast={noRaycast} renderOrder={1} />
        <mesh geometry={kit.poolPlane} material={kit.pool} position={[TOWER_AT[0] + .05, TOP + .002, TOWER_AT[2]]} rotation={[-Math.PI / 2, 0, 0]} scale={[.45, .32, 1]} raycast={noRaycast} renderOrder={1} />
        <mesh position={LAMP.head} {...target("lamp", () => flipRoomToggle("pegLamp"))}>
          <boxGeometry args={[.1, .1, .1]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      </group>
    </group>
  );
}
