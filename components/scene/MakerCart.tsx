import { useEffect, useRef, useState } from "react";
import { useCursor } from "@react-three/drei";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { Plane, Raycaster, Vector2, Vector3, type Group } from "three";
import { Piece, useAssembled } from "./roomAssets/RoomSurfaces";
import { buildMakerCart } from "./roomAssets/props";
import { CART_BOX, FLOOR_OBSTACLES } from "./cameraSafety";
import { roomDrag, roomReachable } from "./roomInteractions";
import { useSceneTransition } from "./SceneTransition";
import { CART_AT, METRE, ROOM } from "./roomLayout";

/** Where the cart was left this session, if it has been moved. */
const STORE = "studio:cart";
/** The cart's footprint as a circle, in scene units, kept clear of walls and furniture. */
const RADIUS = .45;
/** The longest single move a drag makes before checking for furniture again. */
const STEP = .08;
const VIEWS = ["room", "workstation", "city", "personal", "display"] as const;

type Spot = { x: number; z: number };
const home: Spot = { x: CART_AT.at[0], z: CART_AT.at[2] };

function stored(): Spot {
  try {
    const value = JSON.parse(sessionStorage.getItem(STORE) ?? "null") as Spot | null;
    if (value && Number.isFinite(value.x) && Number.isFinite(value.z) && free(value.x, value.z)) return value;
  } catch { /* storage unavailable: the cart starts home */ }
  return home;
}

/** Whether the cart's footprint fits here: inside the walls (never out on the
 * balcony) and clear of everything standing on the floor. */
function free(x: number, z: number) {
  if (x < ROOM.left + RADIUS || x > ROOM.right - RADIUS || z < ROOM.back + RADIUS || z > ROOM.front - RADIUS) return false;
  return !FLOOR_OBSTACLES.some(({ min, max }) => x > min[0] - RADIUS && x < max[0] + RADIUS && z > min[2] - RADIUS && z < max[2] + RADIUS);
}

/** Keeps the camera's keep-out volume on the cart wherever it stands. */
function follow({ x, z }: Spot) {
  CART_BOX.min[0] = x - .6; CART_BOX.max[0] = x + .6;
  CART_BOX.min[2] = z - .6; CART_BOX.max[2] = z + .6;
}

/** The maker cart, which the visitor can push around the room: press and drag
 * across the floor, and it slides upright, stopping at walls and furniture and
 * sliding along them. It stays where it is left for the session. Only an
 * active drag does any work. */
export default function MakerCart() {
  const { mode, touring, roomFocus, viewpoint, viewpointMoving } = useSceneTransition();
  const reachable = roomReachable({ mode, touring, roomFocus, viewpoint, viewpointMoving }, [...VIEWS]);
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const parts = useAssembled(buildMakerCart);
  const group = useRef<Group>(null);
  // Rendered only in the browser, inside the canvas, so the session can be read at once.
  const [spot, setSpot] = useState<Spot>(stored);
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  useCursor(hovered && reachable && !dragging, "grab");

  useEffect(() => { follow(spot); }, [spot]);

  const drag = useRef({ offset: new Vector3(), at: { ...home } });
  useEffect(() => {
    if (!dragging) return;
    const floor = new Plane(new Vector3(0, 1, 0), -ROOM.floor), ray = new Raycaster(), ndc = new Vector2(), hit = new Vector3();
    document.body.style.cursor = "grabbing";
    const move = (event: PointerEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      ndc.set((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      if (!ray.ray.intersectPlane(floor, hit)) return;
      const goalX = hit.x - drag.current.offset.x, goalZ = hit.z - drag.current.offset.z, at = drag.current.at;
      // Walk toward the pointer in short steps, so a fast drag can never jump
      // over furniture, sliding along whatever blocks one axis.
      const steps = Math.ceil(Math.hypot(goalX - at.x, goalZ - at.z) / STEP);
      for (let i = 0; i < steps; i++) {
        const x = at.x + (goalX - at.x) / (steps - i), z = at.z + (goalZ - at.z) / (steps - i);
        if (free(x, z)) { at.x = x; at.z = z; }
        else if (free(x, at.z)) at.x = x;
        else if (free(at.x, z)) at.z = z;
        else break;
      }
      group.current?.position.set(at.x, ROOM.floor, at.z);
      invalidate();
    };
    const up = () => {
      roomDrag.active = false;
      const at = { ...drag.current.at };
      setSpot(at);
      setDragging(false);
      try { sessionStorage.setItem(STORE, JSON.stringify(at)); } catch { /* storage unavailable: it resets next load */ }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      document.body.style.cursor = "";
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [dragging, camera, gl, invalidate]);

  const grab = (event: ThreeEvent<PointerEvent>) => {
    if (!reachable || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.stopPropagation();
    roomDrag.active = true;
    const floor = new Plane(new Vector3(0, 1, 0), -ROOM.floor), hit = new Vector3();
    if (event.ray.intersectPlane(floor, hit)) drag.current.offset.set(hit.x - spot.x, 0, hit.z - spot.z);
    drag.current.at = { ...spot };
    setDragging(true);
  };

  return (
    <group ref={group} name="maker cart" position={[spot.x, ROOM.floor, spot.z]}>
      <Piece parts={parts} turn={CART_AT.turn} scale={METRE} />
      <mesh name="cart hit" position={[0, .38 * METRE, 0]} rotation={[0, CART_AT.turn, 0]}
        onPointerOver={(event) => { if (!reachable) return; event.stopPropagation(); setHovered(true); }}
        onPointerOut={() => setHovered(false)} onPointerDown={grab}>
        <boxGeometry args={[.5 * METRE, .76 * METRE, .4 * METRE]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  );
}
