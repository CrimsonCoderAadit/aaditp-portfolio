import { MeshStandardMaterial } from "three";

/** A neutral seamless floor with a restrained depth falloff, still receiving shadows. */
export const studioFloor = new MeshStandardMaterial({ color: "#23292d", roughness: .92, metalness: .05 });
studioFloor.onBeforeCompile = (shader) => {
  shader.vertexShader = shader.vertexShader.replace(
    "#include <common>",
    "#include <common>\nvarying float vStudioDepth;",
  ).replace(
    "#include <begin_vertex>",
    "#include <begin_vertex>\nvStudioDepth = (modelMatrix * vec4(transformed, 1.0)).z;",
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <common>",
    "#include <common>\nvarying float vStudioDepth;",
  ).replace(
    "#include <color_fragment>",
    "#include <color_fragment>\ndiffuseColor.rgb *= mix(0.92, 1.035, smoothstep(-24.0, 14.0, vStudioDepth));",
  );
};
studioFloor.customProgramCacheKey = () => "neutral-studio-floor-v1";
