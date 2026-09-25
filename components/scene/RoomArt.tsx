import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { BoxGeometry, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry } from "three";
import { FRAMES, ROOM, type FrameSpec } from "./roomLayout";
import { paintArtwork, paintFrameShadow } from "./roomAssets/framedArt";

const noRaycast = () => {};

/** Frame build-up from the wall outward, in scene units: thin metal frames sit
 * shallow and narrow, and a piece without a mat shows its print to the edge. */
const STANDOFF = .012;
function build(frame: FrameSpec) {
  const thin = frame.frame === "metal";
  const small = Math.max(...frame.size) < .7;
  return { moulding: thin ? .028 : small ? .045 : .065, depth: thin ? .032 : .055, mat: frame.mat === false ? 0 : small ? .06 : .09 };
}

function placement({ wall, along, y }: FrameSpec): { position: [number, number, number]; turn: number } {
  if (wall === "back") return { position: [along, y, ROOM.back + STANDOFF], turn: 0 };
  if (wall === "left") return { position: [ROOM.left + STANDOFF, y, along], turn: Math.PI / 2 };
  return { position: [ROOM.right - STANDOFF, y, along], turn: -Math.PI / 2 };
}

/** Physical framed pieces hung over the murals: a moulded frame with real
 * depth, a mat, the print, glazing that catches the room, and a soft shadow
 * where the frame stands off the wall. Scenery only: nothing takes a pointer. */
export default function RoomArt() {
  const maxAnisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy());
  const kit = useMemo(() => {
    const box = new BoxGeometry(1, 1, 1);
    const plane = new PlaneGeometry(1, 1);
    const moulding = new MeshStandardMaterial({ color: "#1e1f22", roughness: .42, metalness: .25 });
    const oak = new MeshStandardMaterial({ color: "#8a6a47", roughness: .55 });
    const white = new MeshStandardMaterial({ color: "#e8e5de", roughness: .38 });
    const metal = new MeshStandardMaterial({ color: "#9aa0a6", roughness: .3, metalness: .75 });
    const mat = new MeshStandardMaterial({ color: "#e9e4d8", roughness: .9 });
    const glass = new MeshStandardMaterial({ color: "#ffffff", roughness: .05, metalness: 0, transparent: true, opacity: .1, envMapIntensity: 1.4, depthWrite: false });
    const shadowMap = paintFrameShadow();
    const shadow = new MeshBasicMaterial({ color: "#000000", alphaMap: shadowMap, transparent: true, opacity: .5, depthWrite: false });
    const prints = FRAMES.map((frame) => {
      const [w, h] = frame.size;
      const { moulding: m, mat: mt } = build(frame);
      const inner = [w - 2 * m - 2 * mt, h - 2 * m - 2 * mt];
      const texture = paintArtwork(frame.art, inner[0] / inner[1], maxAnisotropy, Math.max(w, h) < .9 ? 512 : 1024);
      return { texture, material: new MeshStandardMaterial({ map: texture, roughness: .7 }), inner };
    });
    return {
      box, plane, finishes: { black: moulding, oak, white, metal }, mat, glass, shadow, shadowMap, prints,
      dispose() {
        [box, plane, moulding, oak, white, metal, mat, glass, shadow, shadowMap].forEach((resource) => resource.dispose());
        prints.forEach(({ texture, material }) => { texture.dispose(); material.dispose(); });
      },
    };
  }, [maxAnisotropy]);
  useEffect(() => () => kit.dispose(), [kit]);

  return (
    <group name="framed art">
      {FRAMES.map((frame, i) => {
        const { position, turn } = placement(frame);
        const [w, h] = frame.size;
        const { inner, material } = kit.prints[i];
        const { moulding: MOULDING, depth: DEPTH } = build(frame);
        const trim = kit.finishes[frame.frame ?? "black"];
        const bars: [number, number, number, number][] = [
          [0, (h - MOULDING) / 2, w, MOULDING], [0, -(h - MOULDING) / 2, w, MOULDING],
          [(w - MOULDING) / 2, 0, MOULDING, h - 2 * MOULDING], [-(w - MOULDING) / 2, 0, MOULDING, h - 2 * MOULDING],
        ];
        return (
          <group key={i} position={position} rotation={[0, turn, 0]}>
            <mesh geometry={kit.plane} material={kit.shadow} position={[.03, -.06, .002]} scale={[w + .26, h + .26, 1]} raycast={noRaycast} />
            {bars.map(([x, y, bw, bh], j) => (
              <mesh key={j} geometry={kit.box} material={trim} position={[x, y, DEPTH / 2]} scale={[bw, bh, DEPTH]} castShadow receiveShadow raycast={noRaycast} />
            ))}
            <mesh geometry={kit.box} material={kit.mat} position={[0, 0, .012]} scale={[w - 2 * MOULDING + .004, h - 2 * MOULDING + .004, .02]} receiveShadow raycast={noRaycast} />
            <mesh geometry={kit.plane} material={material} position={[0, 0, .0225]} scale={[inner[0], inner[1], 1]} receiveShadow raycast={noRaycast} />
            <mesh geometry={kit.plane} material={kit.glass} position={[0, 0, DEPTH - .012]} scale={[w - 2 * MOULDING, h - 2 * MOULDING, 1]} renderOrder={1} raycast={noRaycast} />
          </group>
        );
      })}
    </group>
  );
}
