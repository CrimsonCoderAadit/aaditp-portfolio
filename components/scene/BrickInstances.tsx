import { useLayoutEffect, useRef } from "react";
import { BufferGeometry, Color, InstancedMesh, MeshStandardMaterial, Object3D } from "three";

export type BrickPart = { position: [number, number, number]; size: [number, number, number]; rotation?: [number, number, number] };
const noRaycast = () => {};

/** A window's lighting from a stable hash: mostly lit as authored, some warmer
 * or cooler, some dimmed, a few dark. */
function windowTint(h: number): [number, number, number] {
  if (h < .12) return [.16, .17, .19];
  if (h < .3) return [.5, .5, .52];
  if (h < .45) return [.82, .96, 1.18];
  if (h < .6) return [1.22, 1.04, .82];
  return [1, 1, 1];
}

/** One render batch for repeated rigid pieces sharing geometry and finish. */
export default function BrickInstances({ parts, geometry, material }: { parts: BrickPart[]; geometry: BufferGeometry; material: MeshStandardMaterial }) {
  const mesh = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const transform = new Object3D();
    const tint = new Color();
    const subtleJitter = material.userData.instanceJitter === true;
    const lightVariation = material.userData.lightVariation === true;
    parts.forEach((part, i) => {
      transform.position.set(...part.position);
      transform.scale.set(...part.size);
      transform.rotation.set(...(part.rotation ?? [0, 0, 0]));
      transform.updateMatrix();
      mesh.current!.setMatrixAt(i, transform.matrix);
      if (lightVariation) {
        const hash = Math.sin(part.position[0] * 127.1 + part.position[1] * 311.7 + part.position[2] * 74.7) * 43758.5453;
        mesh.current!.setColorAt(i, tint.setRGB(...windowTint(hash - Math.floor(hash))));
      } else if (subtleJitter) {
        // Stable ±1.2% value variation; no per-frame randomness or accent hue shift.
        const hash = Math.sin((i + 1) * 127.1 + part.position[0] * 311.7 + part.position[2] * 74.7) * 43758.5453;
        const value = 1 + ((hash - Math.floor(hash)) * 2 - 1) * .012;
        mesh.current!.setColorAt(i, tint.setRGB(value, value, value));
      }
    });
    mesh.current!.instanceMatrix.needsUpdate = true;
    if ((subtleJitter || lightVariation) && mesh.current!.instanceColor) mesh.current!.instanceColor.needsUpdate = true;
    mesh.current!.computeBoundingSphere();
  }, [parts, material]);
  return <instancedMesh ref={mesh} args={[geometry, material, parts.length]} customDepthMaterial={geometry.userData.moldedDepth} castShadow={!material.transparent} receiveShadow={!material.transparent} raycast={noRaycast} dispose={null} />;
}
