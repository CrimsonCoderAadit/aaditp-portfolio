"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense, lazy } from "react";
import { PCFSoftShadowMap, SRGBColorSpace, NeutralToneMapping } from "three";
import { VIEWPOINTS } from "./viewpoints";
import { QUALITY } from "./quality";

const loadWorld = () => import("./PortfolioWorld");
const PortfolioWorld = lazy(loadWorld);
if (typeof window !== "undefined") void loadWorld();

export default function PortfolioScene() {
  return (
    <Canvas
      shadows={{ type: PCFSoftShadowMap }}
      dpr={[1, QUALITY.maxDpr]}
      frameloop="demand"
      camera={{ position: VIEWPOINTS.city.position, fov: VIEWPOINTS.city.fov, near: .15, far: 260 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance", toneMapping: NeutralToneMapping, toneMappingExposure: .9, outputColorSpace: SRGBColorSpace }}
      onCreated={({ gl }) => {
        performance.mark("studio:webgl-created");
        gl.setClearColor("#05060a", 0);
        gl.domElement.addEventListener("webglcontextlost", () => window.dispatchEvent(new CustomEvent("studio-stage", { detail: "error" })), { once: true });
      }}
      fallback={<div className="scene-fallback">This studio requires a browser with WebGL enabled.</div>}
    >
      <Suspense fallback={null}>
        <PortfolioWorld />
      </Suspense>
    </Canvas>
  );
}
