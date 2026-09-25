import { DoubleSide, MeshPhysicalMaterial, MeshStandardMaterial } from "three";
import { withMoldedEdges } from "./brickGeometry/moldedEdges";

export type MaterialClass = "brick" | "tile" | "paintedMetal" | "rubber" | "indicator" | "translucent";

const response: Record<MaterialClass, { roughness: number; metalness: number; envMapIntensity: number }> = {
  brick: { roughness: .40, metalness: 0, envMapIntensity: .72 },
  tile: { roughness: .22, metalness: 0, envMapIntensity: .90 },
  paintedMetal: { roughness: .53, metalness: .18, envMapIntensity: .78 },
  rubber: { roughness: .70, metalness: 0, envMapIntensity: .38 },
  indicator: { roughness: .34, metalness: 0, envMapIntensity: .65 },
  translucent: { roughness: .16, metalness: 0, envMapIntensity: .85 },
};

/** One restrained finish hierarchy shared by all districts. */
export function finishMaterials<T extends Record<string, MeshStandardMaterial>>(
  materials: T,
  classes: { [K in keyof T]: MaterialClass },
): T {
  for (const name of Object.keys(materials) as Array<keyof T>) {
    const material = materials[name];
    const kind = classes[name];
    Object.assign(material, response[kind]);
    material.userData.instanceJitter = kind === "brick" || kind === "tile";
    if (kind === "indicator" && name === "window") {
      // Lit windows vary by instance (see BrickInstances): the instance colour
      // scales the glow as well as the glass, so some rooms read warm, some
      // cool, some dim and a few dark, fixed per window, never per frame.
      material.userData.lightVariation = true;
      material.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <emissivemap_fragment>",
          "#include <emissivemap_fragment>\n#ifdef USE_INSTANCING_COLOR\ntotalEmissiveRadiance *= vColor;\n#endif",
        );
      };
      material.customProgramCacheKey = () => "lit-window-v1";
    }
    if (kind === "brick") {
      // Barely perceptible highlight breakup, in local space, without texture fetches.
      material.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader.replace(
          "#include <common>",
          "#include <common>\nvarying vec3 vBrickPosition;",
        ).replace("#include <begin_vertex>", "#include <begin_vertex>\nvBrickPosition = position;");
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <common>",
          "#include <common>\nvarying vec3 vBrickPosition;",
        ).replace(
          "#include <roughnessmap_fragment>",
          "#include <roughnessmap_fragment>\nfloat micro = fract(sin(dot(floor(vBrickPosition * 780.0), vec3(12.9898, 78.233, 45.164))) * 43758.5453);\nroughnessFactor = clamp(roughnessFactor + (micro - 0.5) * 0.006, 0.0, 1.0);",
        );
      };
      material.customProgramCacheKey = () => "molded-plastic-v2";
    }
    withMoldedEdges(material);
  }
  return materials;
}

/** A single thin shell keeps its brick-scale edge and lets the interior read. */
export function translucentPlastic(color: string, opacity: number) {
  return withMoldedEdges(new MeshPhysicalMaterial({
    color,
    transparent: true,
    opacity,
    // Alpha provides the light-through effect without a second full-scene transmission pass.
    transmission: 0,
    thickness: .035,
    ior: 1.46,
    roughness: .16,
    metalness: 0,
    clearcoat: .38,
    clearcoatRoughness: .18,
    envMapIntensity: .85,
    side: DoubleSide,
    forceSinglePass: true,
    depthWrite: false,
  }));
}
