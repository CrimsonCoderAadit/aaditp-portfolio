import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { CanvasTexture, type Material, type Mesh } from "three";

/** Printed signs and plates are canvas textures seen at a slant from every
 * focus camera; full anisotropic filtering keeps their lettering crisp there.
 * Runs as the scene mounts and for a little while after, as the districts
 * build their plates. */
export default function TextureSharpness() {
  const scene = useThree((state) => state.scene);
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    const max = gl.capabilities.getMaxAnisotropy();
    const sharpen = () => {
      let changed = false;
      scene.traverse((object) => {
        const materials = (object as Mesh).material;
        if (!materials) return;
        for (const material of (Array.isArray(materials) ? materials : [materials]) as (Material & { map?: unknown; emissiveMap?: unknown })[]) {
          for (const map of [material.map, material.emissiveMap]) {
            if (map instanceof CanvasTexture && map.anisotropy < max) { map.anisotropy = max; map.needsUpdate = true; changed = true; }
          }
        }
      });
      if (changed) invalidate();
    };
    sharpen();
    let runs = 0;
    const id = window.setInterval(() => { sharpen(); if (++runs >= 8) window.clearInterval(id); }, 4000);
    return () => window.clearInterval(id);
  }, [scene, gl, invalidate]);
  return null;
}
