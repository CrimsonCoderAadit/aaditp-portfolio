import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useCursor } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending, BoxGeometry, BufferAttribute, BufferGeometry, CanvasTexture, CapsuleGeometry, MathUtils, MeshBasicMaterial, PlaneGeometry, Vector3,
} from "three";
import { discover } from "../room/discovery";
import { buildVaderParts, createVaderKit, PLINTH, type Finish } from "./roomAssets/vader";
import { settleWall } from "./roomAssets/murals";
import { bladeGlow } from "./saberGlow";
import { firePulse, roomReachable, usePulse } from "./roomInteractions";
import { useSceneTransition } from "./SceneTransition";
import { METRE, ROOM, VADER_AT } from "./roomLayout";

const noRaycast = () => {};

type WorkerPart = { finish: Finish; attributes: { name: string; array: ArrayLike<number>; itemSize: number; normalized: boolean }[]; index: ArrayLike<number> | null };
/** The figure's geometry is the largest single build in the room, so it is made
 * in a worker from the moment this module loads, alongside everything else,
 * and falls back to the main thread if no worker can run. */
const pendingParts = typeof window === "undefined" ? null : new Promise<Map<Finish, BufferGeometry>>((resolve) => {
  const detail = window.matchMedia("(pointer: coarse)").matches ? .7 : 1;
  const onMainThread = () => resolve(buildVaderParts(detail));
  try {
    const worker = new Worker(new URL("./roomAssets/vader.worker.ts", import.meta.url));
    worker.onmessage = ({ data }: MessageEvent<{ parts?: WorkerPart[]; error?: string }>) => {
      worker.terminate();
      if (!data.parts) { onMainThread(); return; }
      resolve(new Map(data.parts.map(({ finish, attributes, index }) => {
        const geometry = new BufferGeometry();
        for (const { name, array, itemSize, normalized } of attributes) geometry.setAttribute(name, new BufferAttribute(array as Float32Array, itemSize, normalized));
        if (index) geometry.setIndex(new BufferAttribute(index as Uint32Array, 1));
        geometry.computeBoundingSphere();
        return [finish, geometry];
      })));
    };
    worker.onerror = () => { worker.terminate(); onMainThread(); };
    worker.postMessage({ detail });
  } catch { onMainThread(); }
});

/** Renders the display figure once its geometry has arrived; the hero waits for it. */
export default function VaderDisplay() {
  const [parts, setParts] = useState<Map<Finish, BufferGeometry> | null>(null);
  useEffect(() => {
    let alive = true;
    void pendingParts?.then((built) => { if (alive) { setParts(built); settleWall("vader"); } });
    return () => { alive = false; };
  }, []);
  return parts ? <VaderFigure parts={parts} /> : null;
}
const FIGURE_Y = PLINTH.top + .012;
/** A click's sequence: the saber climbs and holds, the floor spill with it,
 * the chest panel wakes, then all of it settles back to idle. */
const SURGE_SECONDS = 3.6;
/** A second click while that plays runs a light around the plinth's edge. */
const PEDESTAL_SECONDS = 1.8;
/** Restrained at rest; a little brighter while the visitor stands at the display view. */
const IDLE_GLOW = .85, NEAR_GLOW = 1;

/** A soft radial falloff shared by the glow and contact-shadow decals. */
function falloff() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const g = canvas.getContext("2d")!;
  const gradient = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(.45, "rgba(255,255,255,.55)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gradient;
  g.fillRect(0, 0, 128, 128);
  return new CanvasTexture(canvas);
}

/** Life-size brick display figure on its plinth. Only its hit volume takes a
 * pointer, and only from views where it is in reach: a click wakes the saber,
 * its floor spill and the chest panel for a few seconds, and a second click
 * while that plays runs a light round the plinth. The figure itself never moves:
 * it is a display piece, merged per finish. */
function VaderFigure({ parts }: { parts: Map<Finish, BufferGeometry> }) {
  const { mode, touring, roomFocus, viewpoint, viewpointMoving } = useSceneTransition();
  const reachable = roomReachable({ mode, touring, roomFocus, viewpoint, viewpointMoving }, ["display", "personal", "room"]);
  const invalidate = useThree((state) => state.invalidate);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered && reachable);

  const kit = useMemo(() => createVaderKit({ parts }), [parts]);
  useEffect(() => () => kit.dispose(), [kit]);

  const saber = useMemo(() => {
    const { start, end } = kit.blade;
    const length = start.distanceTo(end);
    const core = new CapsuleGeometry(.0068, length - .0136, 4, 12);
    const coreMaterial = new MeshBasicMaterial({ color: "#ffd9d2", toneMapped: false });
    const glow = bladeGlow(start.clone(), end.clone(), .05);
    const centre = start.clone().add(end).multiplyScalar(.5);
    return { core, coreMaterial, glow, centre: centre.toArray() as [number, number, number] };
  }, [kit]);
  useEffect(() => () => { saber.core.dispose(); saber.coreMaterial.dispose(); saber.glow.geometry.dispose(); saber.glow.material.dispose(); }, [saber]);

  // Floor spill under the lower blade and soft contact shadows, in plinth space.
  const decals = useMemo(() => {
    const texture = falloff();
    const plane = new PlaneGeometry(1, 1);
    plane.rotateX(-Math.PI / 2);
    const spill = new MeshBasicMaterial({ color: "#ff2a12", alphaMap: texture, transparent: true, opacity: .07, blending: AdditiveBlending, depthWrite: false, toneMapped: false });
    const shade = new MeshBasicMaterial({ color: "#000000", alphaMap: texture, transparent: true, opacity: .55, depthWrite: false });
    // Where the lower blade passes over the floor, in plinth space.
    const c = Math.cos(VADER_AT.turn), s = Math.sin(VADER_AT.turn);
    const toPlinth = (p: Vector3) => new Vector3(p.x * c + p.z * s, p.y + FIGURE_Y, -p.x * s + p.z * c);
    const tip = toPlinth(kit.blade.end), low = toPlinth(kit.blade.start.clone().lerp(kit.blade.end, .7));
    const floorSpill = { at: [(tip.x + low.x) / 2, .003, (tip.z + low.z) / 2] as [number, number, number], turn: Math.atan2(tip.x - low.x, tip.z - low.z), size: [.62, 1, 1.1] as [number, number, number] };
    // Four light strips along the plinth's brushed band, one per side, in turn.
    const strip = new BoxGeometry(1, 1, 1);
    const edges = [0, 1, 2, 3].map(() => new MeshBasicMaterial({ color: "#ff3a22", transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, toneMapped: false }));
    return { texture, plane, spill, shade, floorSpill, strip, edges };
  }, [kit]);
  useEffect(() => () => {
    decals.texture.dispose(); decals.plane.dispose(); decals.spill.dispose(); decals.shade.dispose(); decals.strip.dispose();
    decals.edges.forEach((material) => material.dispose());
  }, [decals]);

  const surges = usePulse("vader");
  useEffect(() => { if (surges) { discover("vader"); invalidate(); } }, [surges, invalidate]);
  useEffect(() => { invalidate(); }, [hovered, reachable, invalidate]);

  const glows = useRef<{ saber: { value: number }[]; controls: { value: number }; spill: MeshBasicMaterial; edges: MeshBasicMaterial[] } | null>(null);
  useLayoutEffect(() => {
    glows.current = {
      saber: [kit.uniforms.saberGlow, saber.glow.material.uniforms.intensity], controls: kit.uniforms.controlGlow,
      spill: decals.spill, edges: decals.edges,
    };
  }, [kit, saber, decals]);

  const near = mode === "workbench" && !touring && viewpoint === "display" && !viewpointMoving;
  const run = useRef({ start: -1, pedestal: -1, seen: 0, hover: 0, near: 0 });
  useFrame((state, delta) => {
    const r = run.current, now = state.clock.elapsedTime;
    // One click wakes him; a second while that plays runs the plinth light.
    // Further clicks wait for those to finish, so runs never overlap.
    if (surges !== r.seen) {
      r.seen = surges;
      if (r.start < 0) r.start = now;
      else if (r.pedestal < 0) r.pedestal = now;
    }
    const hoverTarget = hovered && reachable ? 1 : 0;
    r.hover = MathUtils.damp(r.hover, hoverTarget, 8, delta);
    r.near = MathUtils.damp(r.near, near ? 1 : 0, 3, delta);
    let surge = 0, chest = 0;
    if (r.start >= 0) {
      const t = (now - r.start) / SURGE_SECONDS;
      if (t >= 1) r.start = -1;
      else {
        surge = MathUtils.smoothstep(t, 0, .18) * (1 - MathUtils.smoothstep(t, .55, 1));
        chest = MathUtils.smoothstep(t, .1, .28) * (1 - MathUtils.smoothstep(t, .62, 1)) * (1.5 + .6 * Math.sin(t * Math.PI * 6) ** 2);
      }
    }
    let lap = -1;
    if (r.pedestal >= 0) {
      lap = (now - r.pedestal) / PEDESTAL_SECONDS;
      if (lap >= 1) { r.pedestal = -1; lap = -1; }
    }
    const base = MathUtils.lerp(IDLE_GLOW, NEAR_GLOW, r.near);
    if (glows.current) {
      const g = glows.current;
      g.saber.forEach((uniform) => { uniform.value = base + r.hover * .12 + surge * .8; });
      g.controls.value = .85 + r.hover * .2 + chest;
      g.spill.opacity = .07 * base + surge * .14;
      // The light runs round the band once, each side rising as the last fades.
      // Hovering warms the band a little all round, as a sign he answers.
      g.edges.forEach((material, side) => {
        const local = lap < 0 ? 0 : lap * 4 - side;
        const run = local <= 0 || local >= 2.2 ? 0 : Math.sin(Math.min(1, local / 2.2) * Math.PI) * .55;
        material.opacity = Math.max(run, r.hover * .14);
      });
    }
    if (r.start >= 0 || r.pedestal >= 0 || Math.abs(r.hover - hoverTarget) > .003 || Math.abs(r.near - (near ? 1 : 0)) > .003) invalidate();
  });
  useEffect(() => { invalidate(); }, [near, invalidate]);
  const band = PLINTH.width / 2 + .004, bandY = .153;

  return (
    <group name="brick display figure" position={[VADER_AT.at[0], ROOM.floor, VADER_AT.at[2]]} scale={METRE}>
      <mesh geometry={decals.plane} material={decals.shade} position={[0, .002, 0]} scale={[1.02, 1, 1.02]} raycast={noRaycast} renderOrder={1} />
      <mesh geometry={decals.plane} material={decals.spill} position={decals.floorSpill.at} rotation={[0, decals.floorSpill.turn, 0]} scale={decals.floorSpill.size} raycast={noRaycast} renderOrder={2} />
      {decals.edges.map((material, side) => (
        <mesh key={side} geometry={decals.strip} material={material} raycast={noRaycast} renderOrder={2}
          position={side % 2 ? [(side === 1 ? 1 : -1) * band, bandY, 0] : [0, bandY, (side === 0 ? 1 : -1) * band]}
          scale={side % 2 ? [.006, .008, PLINTH.width] : [PLINTH.width, .008, .006]} />
      ))}
      <group position={[0, FIGURE_Y, 0]} rotation={[0, VADER_AT.turn, 0]}>
        {[...kit.parts].map(([finish, geometry]) => (
          <mesh key={finish} geometry={geometry} material={kit.materials[finish]} castShadow={finish !== "lens" && finish !== "plaque"} receiveShadow raycast={noRaycast} />
        ))}
        {[-1, 1].map((side) => (
          <mesh key={side} geometry={decals.plane} material={decals.shade} position={[side * .125, .0005, .045]} rotation={[0, side * .1, 0]} scale={[.19, 1, .34]} raycast={noRaycast} renderOrder={1} />
        ))}
        <mesh geometry={saber.core} material={saber.coreMaterial} position={saber.centre} quaternion={kit.blade.turn} raycast={noRaycast} />
        {/* Placed in its vertex shader, so it has no CPU bounds to cull by. */}
        <mesh geometry={saber.glow.geometry} material={saber.glow.material} frustumCulled={false} raycast={noRaycast} renderOrder={3} />
        <mesh
          name="display figure hit"
          position={[0, .98, -.02]}
          onPointerOver={(event) => { if (!reachable) return; event.stopPropagation(); setHovered(true); }}
          onPointerOut={() => setHovered(false)}
          onClick={(event) => { if (!reachable) return; event.stopPropagation(); firePulse("vader"); }}
        >
          <boxGeometry args={[.62, 1.98, .5]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      </group>
    </group>
  );
}
