import { useEffect, useMemo } from "react";
import { RoundedBox } from "@react-three/drei";
import { MeshStandardMaterial } from "three";
import { TABLE } from "./cityMasterplan";

/** Dimensions are in metres under the bench scale: a 7.4 × 4.55 m model-city
 * table at 0.94 m working height. The span is carried by three leg frames
 * (ends and centre), a deep perimeter apron under the top, a centre spine
 * along the length and low stretchers, so the long top reads as supported
 * without a bulky base.
 */
const { width: W, depth: D, height: H, top: T } = TABLE;
const LEG = .09;
const LEG_X = W / 2 - .34;
const LEG_Z = D / 2 - .3;
const APRON = { h: .11, y: H - T / 2 - .06 };

export default function Workbench() {
  const surface = useMemo(() => {
    const material = new MeshStandardMaterial({ color: "#363b3d", roughness: .53, metalness: .20 });
    // Tiny object-space variations keep the finish tactile without texture downloads.
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vSurfacePosition;");
      shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvSurfacePosition = position;");
      shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vSurfacePosition;\nfloat grain(vec3 p) { return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }");
      shader.fragmentShader = shader.fragmentShader.replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nfloat surfaceGrain = grain(floor(vSurfacePosition * 1400.0));\nroughnessFactor = clamp(roughnessFactor + (surfaceGrain - 0.5) * 0.075, 0.0, 1.0);\ndiffuseColor.rgb *= 0.98 + surfaceGrain * 0.04;");
    };
    material.customProgramCacheKey = () => "workbench-finish-v1";
    return material;
  }, []);
  const frame = useMemo(() => new MeshStandardMaterial({ color: "#353b3e", roughness: .38, metalness: .78 }), []);
  const apron = useMemo(() => new MeshStandardMaterial({ color: "#151a1d", roughness: .34, metalness: .72 }), []);

  useEffect(() => () => { surface.dispose(); frame.dispose(); apron.dispose(); }, [surface, frame, apron]);

  const legHeight = APRON.y - APRON.h / 2;
  return (
    <group scale={TABLE.scale}>
      <RoundedBox args={[W, T, D]} radius={.026} smoothness={4} position={[0, H, 0]} castShadow receiveShadow>
        <primitive object={surface} attach="material" />
      </RoundedBox>
      {/* Perimeter apron set in under the top's overhang. */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <RoundedBox args={[W - .28, APRON.h, .05]} radius={.01} smoothness={2} position={[0, APRON.y, side * (D / 2 - .14)]} material={apron} castShadow receiveShadow />
          <RoundedBox args={[.05, APRON.h, D - .33]} radius={.01} smoothness={2} position={[side * (W / 2 - .14), APRON.y, 0]} material={apron} castShadow receiveShadow />
        </group>
      ))}
      {/* Spine and cross-members under the top, one per leg frame and between them. */}
      <RoundedBox args={[W - .33, .07, .07]} radius={.008} smoothness={2} position={[0, APRON.y, 0]} material={apron} castShadow />
      {[-LEG_X / 2, LEG_X / 2].map((x) => (
        <RoundedBox key={x} args={[.06, .07, D - .33]} radius={.008} smoothness={2} position={[x, APRON.y, 0]} material={apron} castShadow />
      ))}
      {/* Three leg frames: two legs, a top rail and a floor stretcher each. */}
      {[-LEG_X, 0, LEG_X].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          {[-LEG_Z, LEG_Z].map((z) => (
            <RoundedBox key={z} args={[LEG, legHeight, LEG]} radius={.008} smoothness={2} position={[0, legHeight / 2, z]} material={frame} castShadow receiveShadow />
          ))}
          <RoundedBox args={[.085, .075, 2 * LEG_Z + LEG]} radius={.009} smoothness={2} position={[0, .06, 0]} material={frame} castShadow receiveShadow />
          <RoundedBox args={[.07, .07, 2 * LEG_Z]} radius={.008} smoothness={2} position={[0, APRON.y, 0]} material={frame} castShadow />
        </group>
      ))}
      {/* Low longitudinal stretcher tying the three frames together. */}
      <RoundedBox args={[2 * LEG_X, .065, .065]} radius={.006} smoothness={2} position={[0, .33, 0]} material={frame} castShadow />
    </group>
  );
}
