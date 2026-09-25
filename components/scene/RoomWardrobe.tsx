import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useCursor } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { Color, MathUtils, type Group, type MeshStandardMaterial } from "three";
import { Piece, useAssembled, useRoomSurfaces } from "./roomAssets/RoomSurfaces";
import { buildWardrobeCarcass, buildWardrobeDoor, buildWardrobeInterior, buildWardrobePull, WARDROBE_FLUTE, WARDROBE_HINGE } from "./roomAssets/furniture";
import { playFlutePhrase } from "../room/fluteSound";
import { discover } from "../room/discovery";
import { firePulse, roomReachable, setRoomToggle, flipRoomToggle, usePulse, useRoomToggle } from "./roomInteractions";
import { useSceneTransition } from "./SceneTransition";
import { METRE, ROOM, WARDROBE_AT } from "./roomLayout";

/** Just past square to the wall; the leaves clear the carcass and each other. */
const OPEN_ANGLE = MathUtils.degToRad(96);
const SWING_SECONDS = .8;
const HOVER_GLOW = new Color("#8d7bff");

/** The open wardrobe's volume encloses the flute case; the case takes its own clicks. */
const onFlute = (event: { intersections: { object: { name: string } }[] }) => event.intersections.some((hit) => hit.object.name === "flute case hit");

const doorPlus = () => buildWardrobeDoor(1);
const doorMinus = () => buildWardrobeDoor(-1);
const pullPlus = () => buildWardrobePull(1);
const pullMinus = () => buildWardrobePull(-1);

/** The wardrobe opens: its two leaves swing out on their hinge lines with an
 * eased swing and show the clothes and shelves inside. It
 * answers from the views where it is in reach, and closes on Escape or when the
 * visitor heads into the city. */
export default function RoomWardrobe() {
  const transition = useSceneTransition();
  const { mode, touring, roomFocus, viewpoint, viewpointMoving } = transition;
  const reachable = roomReachable({ mode, touring, roomFocus, viewpoint, viewpointMoving }, ["display", "room"]);
  const open = useRoomToggle("wardrobe");
  const invalidate = useThree((state) => state.invalidate);
  const [hovered, setHovered] = useState(false);
  const [fluteHover, setFluteHover] = useState(false);
  const fluteReady = reachable && open;
  useCursor((hovered && reachable) || (fluteHover && fluteReady));
  // The flute plays its phrase whenever asked, by pointer or keyboard.
  const flute = usePulse("flute");
  useEffect(() => { if (flute) { discover("flute"); playFlutePhrase(); } }, [flute]);

  const carcass = useAssembled(buildWardrobeCarcass);
  const interior = useAssembled(buildWardrobeInterior);
  const leaves = [useAssembled(doorPlus), useAssembled(doorMinus)];
  const pulls = [useAssembled(pullPlus), useAssembled(pullMinus)];

  const { materials } = useRoomSurfaces();
  const pullMaterial = useMemo(() => {
    const material = materials.blackSteel.clone();
    material.emissive.copy(HOVER_GLOW);
    material.emissiveIntensity = 0;
    return material;
  }, [materials]);
  useEffect(() => () => pullMaterial.dispose(), [pullMaterial]);
  const pullOverride = useMemo(() => ({ blackSteel: pullMaterial }), [pullMaterial]);
  const pull = useRef<MeshStandardMaterial>(null);
  useLayoutEffect(() => { pull.current = pullMaterial; }, [pullMaterial]);

  useEffect(() => { if (mode !== "workbench" || touring) setRoomToggle("wardrobe", false); }, [mode, touring]);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setRoomToggle("wardrobe", false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);
  useEffect(() => { invalidate(); }, [open, hovered, reachable, invalidate]);

  const hinges = useRef<(Group | null)[]>([]);
  const swing = useRef({ value: 0, glow: 0 });
  useFrame((_, delta) => {
    const s = swing.current;
    const target = open ? 1 : 0;
    const step = Math.min(delta, .05) / SWING_SECONDS;
    s.value = target > s.value ? Math.min(target, s.value + step) : Math.max(target, s.value - step);
    const glowTarget = hovered && reachable ? 1 : 0;
    s.glow = MathUtils.damp(s.glow, glowTarget, 10, delta);
    const eased = open ? 1 - (1 - s.value) ** 3 : s.value * s.value * (3 - 2 * s.value);
    hinges.current.forEach((hinge, i) => { if (hinge) hinge.rotation.y = (i === 0 ? 1 : -1) * eased * OPEN_ANGLE; });
    if (pull.current) pull.current.emissiveIntensity = s.glow * .9;
    if (s.value !== target || Math.abs(s.glow - glowTarget) > .004) invalidate();
  });

  return (
    <group name="wardrobe" position={[WARDROBE_AT.at[0], ROOM.floor, WARDROBE_AT.at[2]]} rotation={[0, WARDROBE_AT.turn, 0]} scale={METRE}>
      <Piece parts={carcass} />
      <Piece parts={interior} shadows={false} />
      {([1, -1] as const).map((side, i) => (
        <group key={side} ref={(group) => { hinges.current[i] = group; }} position={[side * WARDROBE_HINGE.x, 0, WARDROBE_HINGE.z]}>
          <Piece parts={leaves[i]} />
          <Piece parts={pulls[i]} overrides={pullOverride} />
        </group>
      ))}
      {open && (
        <mesh
          name="flute case hit"
          position={[WARDROBE_FLUTE[0], WARDROBE_FLUTE[1] + .05, WARDROBE_FLUTE[2]]}
          onPointerOver={(event) => { if (!fluteReady) return; event.stopPropagation(); setFluteHover(true); }}
          onPointerOut={() => setFluteHover(false)}
          onClick={(event) => { if (!fluteReady) return; event.stopPropagation(); firePulse("flute"); }}
        >
          <boxGeometry args={[.4, .12, .14]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      )}
      <mesh
        name="wardrobe hit"
        position={[0, 1.07, .12]}
        onPointerOver={(event) => { if (!reachable || onFlute(event)) return; event.stopPropagation(); setHovered(true); }}
        onPointerOut={() => setHovered(false)}
        onClick={(event) => { if (!reachable || onFlute(event)) return; event.stopPropagation(); flipRoomToggle("wardrobe"); }}
      >
        <boxGeometry args={[1.22, 1.98, .44]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  );
}
