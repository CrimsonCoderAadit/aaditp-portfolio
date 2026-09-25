import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useCursor } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { AdditiveBlending, MathUtils, SpriteMaterial, type Material, type PointLight } from "three";
import { useRoomSurfaces } from "./roomAssets/RoomSurfaces";
import { paintGlow } from "./roomAssets/framedArt";
import { COVE_STRENGTH } from "./roomAssets/ambience";
import { firePulse, flipRoomToggle, roomReachable, useRoomToggle, type RoomPulse, type RoomToggle } from "./roomInteractions";
import { useSceneTransition } from "./SceneTransition";
import type { ViewpointId } from "./viewpoints";

type Vec3 = [number, number, number];

/** Brings a 0–1 level toward its switch position over about half a second,
 * asking for frames only while it moves, and hands it to `apply` with the
 * object it drives. */
function useLevel<T>(on: boolean, subject: T, apply: (level: number, subject: T) => void) {
  const invalidate = useThree((state) => state.invalidate);
  const level = useRef(on ? 1 : 0);
  const driven = useRef<T>(null);
  useLayoutEffect(() => { driven.current = subject; }, [subject]);
  useEffect(() => { invalidate(); }, [on, invalidate]);
  useFrame((_, delta) => {
    const target = on ? 1 : 0;
    level.current = MathUtils.damp(level.current, target, 7, Math.min(delta, .05));
    if (Math.abs(level.current - target) < .002) level.current = target;
    else invalidate();
    if (driven.current !== null) apply(level.current, driven.current);
  });
}

/** A lamp on its own switch: its own copy of the shade finish so it can glow
 * or go dark alone, and the light at its bulb following it. */
export function useSwitchedLamp(key: Extract<RoomToggle, "bedsideLamp" | "floorLamp">, intensity: number) {
  const { materials } = useRoomSurfaces();
  const glow = materials.lampShade.emissiveIntensity;
  const shade = useMemo(() => materials.lampShade.clone(), [materials]);
  useEffect(() => () => shade.dispose(), [shade]);
  const lightRef = useRef<PointLight>(null);
  useLevel(useRoomToggle(key), shade, (level, material) => {
    material.emissiveIntensity = glow * level;
    if (lightRef.current) lightRef.current.intensity = intensity * level;
  });
  return [useMemo(() => ({ lampShade: shade }), [shade]), lightRef] as const;
}

/** The cove on the wall switch by the door: dimmed, the violet wash drops to a
 * low evening level rather than off. */
export function useCoveDimmer() {
  useLevel(useRoomToggle("coveDimmed"), COVE_STRENGTH, (level, cove) => { cove.value = 1 - .7 * level; });
}

/** A switchable room object's pointer target: an invisible volume around it,
 * the shared hover halo, and a click that flips its switch. */
export function RoomSwitch({ toggle, at, radius, from, halo = radius * 1.6, name }: {
  toggle: RoomToggle; at: Vec3; radius: number; from: ViewpointId[]; halo?: number; name: string;
}) {
  const { mode, touring, roomFocus, viewpoint, viewpointMoving } = useSceneTransition();
  const reachable = roomReachable({ mode, touring, roomFocus, viewpoint, viewpointMoving }, from);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered && reachable);
  const material = useMemo(() => new SpriteMaterial({ map: paintGlow(), color: "#9d8cff", transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }), []);
  useEffect(() => () => { material.map?.dispose(); material.dispose(); }, [material]);
  useLevel(hovered && reachable, material as Material, (level, halo) => { halo.opacity = .45 * level; });
  return (
    <group name={name} position={at}>
      <sprite material={material} scale={[halo, halo, 1]} renderOrder={1} raycast={() => {}} />
      <mesh
        onPointerOver={(event) => { if (!reachable) return; event.stopPropagation(); setHovered(true); }}
        onPointerOut={() => setHovered(false)}
        onClick={(event) => { if (!reachable) return; event.stopPropagation(); flipRoomToggle(toggle); }}
      >
        <sphereGeometry args={[radius, 12, 8]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  );
}

/** A one-shot room detail's pointer target: the same halo language as the
 * switches, and a click that starts its effect. */
export function RoomPulseTarget({ pulse, at, radius, from, name }: {
  pulse: RoomPulse; at: Vec3; radius: number; from: ViewpointId[]; name: string;
}) {
  const { mode, touring, roomFocus, viewpoint, viewpointMoving } = useSceneTransition();
  const reachable = roomReachable({ mode, touring, roomFocus, viewpoint, viewpointMoving }, from);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered && reachable);
  const material = useMemo(() => new SpriteMaterial({ map: paintGlow(), color: "#9d8cff", transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }), []);
  useEffect(() => () => { material.map?.dispose(); material.dispose(); }, [material]);
  useLevel(hovered && reachable, material as Material, (level, halo) => { halo.opacity = .4 * level; });
  return (
    <group name={name} position={at}>
      <sprite material={material} scale={[radius * 2.4, radius * 2.4, 1]} renderOrder={1} raycast={() => {}} />
      <mesh
        onPointerOver={(event) => { if (!reachable) return; event.stopPropagation(); setHovered(true); }}
        onPointerOut={() => setHovered(false)}
        onClick={(event) => { if (!reachable) return; event.stopPropagation(); firePulse(pulse); }}
      >
        <sphereGeometry args={[radius, 12, 8]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  );
}
