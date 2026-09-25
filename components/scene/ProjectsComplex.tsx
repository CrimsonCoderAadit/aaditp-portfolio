import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ContactShadows, Html, useCursor } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { CanvasTexture, Group, MeshStandardMaterial, SRGBColorSpace } from "three";
import { createProjectsKit } from "./projectsGeometry";
import { isDistrictMode, phase, useSceneTransition } from "./SceneTransition";
import { markCityExplored } from "./cityHint";
import Parts from "./BrickInstances";
import { PROJECTS_POSITION } from "./districtLayout";
import ProjectBays from "./ProjectBays";

const noRaycast = () => {};

export default function ProjectsComplex() {
  const { mode, section, progressOf, enter } = useSceneTransition();
  const kit = useMemo(() => createProjectsKit(), []);
  const windowMaterial = useRef<MeshStandardMaterial | null>(null);
  const trolley = useRef<Group>(null);
  const roof = useRef<Group>(null);
  const facade = useRef<Group>(null);
  const tray = useRef<Group>(null);
  const reducedMotion = useRef(false);
  const signTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#30393d";
    context.fillRect(0, 0, 512, 128);
    context.fillStyle = "#e5dfcd";
    context.font = '500 58px "Helvetica Neue", Arial, sans-serif';
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("PROJECTS", 256, 67);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
  }, []);
  const [hovered, setHovered] = useState(false);
  const invalidate = useThree((state) => state.invalidate);
  useCursor(hovered && mode === "workbench");

  useLayoutEffect(() => { windowMaterial.current = kit.materials.window; }, [kit]);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => { reducedMotion.current = preference.matches; invalidate(); };
    sync();
    preference.addEventListener("change", sync);
    return () => preference.removeEventListener("change", sync);
  }, [invalidate]);
  useEffect(() => () => signTexture.dispose(), [signTexture]);

  useEffect(() => () => {
    Object.values(kit.geometries).forEach((geometry) => geometry.dispose());
    Object.values(kit.materials).forEach((material) => material.dispose());
  }, [kit]);

  useEffect(() => { invalidate(); }, [hovered, invalidate]);
  useEffect(() => {
    const reset = () => setHovered(false);
    window.addEventListener("blur", reset);
    window.addEventListener("resize", reset);
    return () => {
      window.removeEventListener("blur", reset);
      window.removeEventListener("resize", reset);
    };
  }, []);

  useFrame((_, delta) => {
    const progress = progressOf("projects");
    // Absolute transforms avoid accumulation and make the return sequence exact.
    if (roof.current) roof.current.position.y = .025 * phase(progress, .34, .43) + .46 * phase(progress, .44, .74);
    if (facade.current) {
      facade.current.position.y = .05 * phase(progress, .49, .57);
      facade.current.position.z = .18 * phase(progress, .57, .69);
      facade.current.position.x = -.62 * phase(progress, .65, .88);
    }
    if (tray.current) {
      tray.current.position.y = .22 * phase(progress, .72, .86);
      tray.current.position.z = .32 * phase(progress, .84, 1);
    }
    const material = windowMaterial.current;
    if (!material) return;
    const target = ((hovered && mode === "workbench") || (section === "projects" && isDistrictMode(mode)) ? .23 : .10);
    material.emissiveIntensity += (target - material.emissiveIntensity) * (1 - Math.exp(-7 * Math.min(delta, .05)));
    const targetX = hovered && mode === "workbench" && !reducedMotion.current ? .66 : .44;
    if (trolley.current) trolley.current.position.x += (targetX - trolley.current.position.x) * (1 - Math.exp(-2 * Math.min(delta, .05)));
    if (Math.abs(target - material.emissiveIntensity) > .001 || (trolley.current && Math.abs(targetX - trolley.current.position.x) > .001)) invalidate();
  });

  return (
    <group name="Projects district" position={PROJECTS_POSITION}>
      {(["fixed", "roof", "facade", "tray"] as const).map((assembly) => (
        <group key={assembly} name={`Projects ${assembly}`} ref={assembly === "roof" ? roof : assembly === "facade" ? facade : assembly === "tray" ? tray : undefined}>
          {kit.batches.filter((batch) => batch.assembly === assembly).map((batch) => <Parts key={`${assembly}-${batch.finish}-${batch.form}`} parts={batch.parts} geometry={kit.geometries[batch.form]} material={kit.materials[batch.finish]} />)}
          {assembly === "facade" && (
            <mesh position={[-.65, .382, .247]} raycast={noRaycast}>
              <planeGeometry args={[.45, .062]} />
              <meshStandardMaterial map={signTexture} roughness={.4} />
            </mesh>
          )}
        </group>
      ))}
      <group ref={trolley} position={[.44, 0, .09]}>
        <Parts parts={kit.movingParts} geometry={kit.brick} material={kit.materials.metal} />
      </group>
      <ContactShadows position={[0, .001, 0]} scale={3.4} far={1.3} opacity={.28} blur={1.1} resolution={256} frames={1} color="#16191b" />
      <ProjectBays />
      {/* A single hit volume prevents hover flicker across brick seams. Only in
          the room overview: inside the campus it would shadow the project bays. */}
      {mode === "workbench" && <mesh position={[0, .67, 0]} onPointerOver={(event) => { event.stopPropagation(); if (mode === "workbench") { setHovered(true); markCityExplored(); } }} onPointerOut={() => setHovered(false)} onClick={(event) => { event.stopPropagation(); if (mode === "workbench") { setHovered(false); enter(); } }}>
        <boxGeometry args={[2.5, 1.36, 1.76]} />
        <meshBasicMaterial visible={false} />
      </mesh>}
      {hovered && mode === "workbench" && (
        <Html position={[-.15, 1.68, 0]} center style={{ pointerEvents: "none", whiteSpace: "nowrap" }}>
          <div style={{ padding: "10px 14px", color: "#e6e4df", background: "rgba(25,27,29,.90)", border: "1px solid rgba(211,208,196,.15)", borderRadius: 3, fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
            <div style={{ fontSize: 10, letterSpacing: ".16em", lineHeight: 1.5 }}>PROJECTS</div>
            <div style={{ marginTop: 3, fontSize: 11, color: "#b8b7b1", lineHeight: 1.5 }}>Selected Work →</div>
          </div>
        </Html>
      )}
    </group>
  );
}
