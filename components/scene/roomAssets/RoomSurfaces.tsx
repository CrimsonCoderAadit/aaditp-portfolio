import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { BufferGeometry, Material } from "three";
import { createRoomSurfaces, type RoomFinish, type RoomSurfaces, type RoomPixels } from "./surfaces";
import type { Vec3 } from "./shapes";

const Context = createContext<RoomSurfaces | null>(null);
const noRaycast = () => {};

/** One surface library for shell, furniture and decoration. */
export function RoomSurfacesProvider({ children, pixels }: { children: ReactNode; pixels: RoomPixels }) {
  const surfaces = useMemo(() => createRoomSurfaces(pixels), [pixels]);
  useEffect(() => () => surfaces.dispose(), [surfaces]);
  return <Context.Provider value={surfaces}>{children}</Context.Provider>;
}

export function useRoomSurfaces() {
  const surfaces = useContext(Context);
  if (!surfaces) throw new Error("RoomSurfacesProvider is missing");
  return surfaces;
}

/** Owns a merged piece's geometry for its lifetime. */
export function useAssembled(build: () => Map<RoomFinish, BufferGeometry>) {
  const [parts] = useState(build);
  useEffect(() => () => parts.forEach((geometry) => geometry.dispose()), [parts]);
  return parts;
}

type PieceProps = { parts: Map<RoomFinish, BufferGeometry>; name?: string; at?: Vec3; turn?: number; scale?: number; shadows?: boolean;
  /** Per-instance materials for finishes this piece animates on its own. */
  overrides?: Partial<Record<RoomFinish, Material>> };

/** Renders one merged mesh per finish. Room pieces are scenery and never take a pointer hit. */
export function Piece({ parts, name, at, turn = 0, scale = 1, shadows = true, overrides }: PieceProps) {
  const { materials } = useRoomSurfaces();
  return (
    <group name={name} position={at} rotation={[0, turn, 0]} scale={scale}>
      {[...parts].map(([finish, geometry]) => (
        <mesh key={finish} geometry={geometry} material={overrides?.[finish] ?? materials[finish]} castShadow={shadows && finish !== "glass" && finish !== "lampShade"} receiveShadow={finish !== "glass"} raycast={noRaycast} />
      ))}
    </group>
  );
}
