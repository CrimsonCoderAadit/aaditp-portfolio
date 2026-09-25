"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense, lazy } from "react";
import { PCFSoftShadowMap, SRGBColorSpace, NeutralToneMapping } from "three";
import { VIEWPOINTS } from "./viewpoints";
import { INITIAL, quality } from "./quality";

const loadWorld = () => import("./PortfolioWorld");
const PortfolioWorld = lazy(loadWorld);
if (typeof window !== "undefined") void loadWorld();

export default function PortfolioScene() {
  return (
    <Canvas
      shadows={{ type: PCFSoftShadowMap }}
      // The starting tier's resolution; QualityGovernor adjusts it from measured frames.
      dpr={typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio || 1, INITIAL.dpr)}
      frameloop="demand"
      camera={{ position: VIEWPOINTS.city.position, fov: VIEWPOINTS.city.fov, near: .15, far: 260 }}
      // Multisampling is fixed at context creation: off only where emergency rendering was the first guess.
      gl={{ antialias: quality.get().initial !== "emergency", alpha: true, powerPreference: "high-performance", toneMapping: NeutralToneMapping, toneMappingExposure: .9, outputColorSpace: SRGBColorSpace }}
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
