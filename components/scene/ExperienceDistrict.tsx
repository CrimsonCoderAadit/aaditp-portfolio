import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ContactShadows, Html, useCursor } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { CanvasTexture, Group, MeshStandardMaterial, SRGBColorSpace } from "three";
import BrickInstances from "./BrickInstances";
import { createExperienceKit, type ExperienceAssembly } from "./experienceGeometry";
import { EXPERIENCE_POSITION } from "./districtLayout";
import { isDistrictMode, phase, useSceneTransition } from "./SceneTransition";
import { markCityExplored } from "./cityHint";
import CareerFloors from "./CareerFloors";

export default function ExperienceDistrict() {
  const kit = useMemo(() => createExperienceKit(), []);
  const material = useRef<MeshStandardMaterial | null>(null);
  const [hovered, setHovered] = useState(false);
  const { mode, section, progressOf, enter } = useSceneTransition();
  const assemblies = useRef<Partial<Record<ExperienceAssembly, Group>>>({});
  const invalidate = useThree((state) => state.invalidate);
  const active = hovered && mode === "workbench";
  useCursor(active);
  const sign = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 768;
    canvas.height = 128;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#303a41";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#e3e7e5";
    context.font = '500 63px "Helvetica Neue", Arial, sans-serif';
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("EXPERIENCE", 384, 67);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
  }, []);

  useLayoutEffect(() => { material.current = kit.materials.window; }, [kit]);
  useEffect(() => { invalidate(); }, [active, invalidate]);
  useEffect(() => {
    const reset = () => setHovered(false);
    window.addEventListener("blur", reset);
    window.addEventListener("resize", reset);
    return () => {
      window.removeEventListener("blur", reset);
      window.removeEventListener("resize", reset);
    };
  }, []);
  useEffect(() => () => {
    kit.brick.dispose();
    kit.stud.dispose();
    Object.values(kit.materials).forEach((finish) => finish.dispose());
    sign.dispose();
  }, [kit, sign]);

  useFrame((_, delta) => {
    const p = progressOf("experience");
    const { core, facade, crown, wing, interior, closedInfill } = assemblies.current;
    if (core) core.position.set(.28 * phase(p, .34, .62), 0, -.16 * phase(p, .34, .62));
    if (facade) facade.position.set(.70 * phase(p, .60, .86), .40 * phase(p, .44, .60), .10 * phase(p, .44, .60));
    if (crown) crown.position.set(0, .26 * phase(p, .57, .83), -.10 * phase(p, .57, .83));
    if (wing) wing.position.set(0, .16 * phase(p, .72, .86), .13 * phase(p, .84, 1));
    if (interior) interior.visible = p > 0;
    if (closedInfill) closedInfill.visible = p === 0;
    if (!material.current) return;
    const target = (active || (section === "experience" && isDistrictMode(mode)) ? .16 : .07);
    material.current.emissiveIntensity += (target - material.current.emissiveIntensity) * (1 - Math.exp(-7 * Math.min(delta, .05)));
    if (Math.abs(target - material.current.emissiveIntensity) > .001) invalidate();
  });

  return (
    <group name="Experience district" position={EXPERIENCE_POSITION}>
      {(["fixed", "core", "facade", "crown", "wing", "interior", "closedInfill"] as const).map((assembly) => (
        <group key={assembly} name={`Experience ${assembly}`} ref={(group) => { if (group) assemblies.current[assembly] = group; }} visible={assembly !== "interior"}>
          {kit.batches.filter((batch) => batch.assembly === assembly).map((batch, index) => <BrickInstances key={`${assembly}-${batch.finish}-${batch.stud}-${index}`} parts={batch.parts} geometry={batch.stud ? kit.stud : kit.brick} material={kit.materials[batch.finish]} />)}
        </group>
      ))}
      <mesh position={[-.14, .29, .631]} raycast={() => {}}>
        <planeGeometry args={[.82, .143]} />
        <meshStandardMaterial map={sign} roughness={.4} />
      </mesh>
      <ContactShadows position={[0, .001, 0]} scale={3} far={1.65} opacity={.28} blur={1.1} resolution={256} frames={1} color="#16191b" />
      <CareerFloors />
      {/* Only in the room overview: inside the district it would shadow the career floors. */}
      {mode === "workbench" && <mesh position={[0, .79, 0]} onPointerOver={(event) => { event.stopPropagation(); if (mode === "workbench") { setHovered(true); markCityExplored(); } }} onPointerOut={() => setHovered(false)} onClick={(event) => { event.stopPropagation(); if (mode === "workbench") { setHovered(false); enter("experience"); } }}>
        <boxGeometry args={[2.1, 1.59, 1.56]} />
        <meshBasicMaterial visible={false} />
      </mesh>}
      {active && (
        <Html position={[0, 1.94, 0]} center style={{ pointerEvents: "none", whiteSpace: "nowrap" }}>
          <div style={{ padding: "10px 14px", color: "#e6e4df", background: "rgba(25,27,29,.90)", border: "1px solid rgba(211,208,196,.15)", borderRadius: 3, fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
            <div style={{ fontSize: 10, letterSpacing: ".16em", lineHeight: 1.5 }}>EXPERIENCE</div>
            <div style={{ marginTop: 3, fontSize: 11, color: "#b8b7b1", lineHeight: 1.5 }}>Industry Work →</div>
          </div>
        </Html>
      )}
    </group>
  );
}
