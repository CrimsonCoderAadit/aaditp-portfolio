import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ContactShadows, Html, useCursor } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { CanvasTexture, Group, MeshStandardMaterial, SRGBColorSpace } from "three";
import BrickInstances from "./BrickInstances";
import { createSkillsKit, type SkillsAssembly } from "./skillsGeometry";
import { isDistrictMode, phase, useSceneTransition } from "./SceneTransition";
import { markCityExplored } from "./cityHint";
import SectionMarkers from "./SectionMarkers";
import { BAY_STYLE, SKILL_BAYS } from "./skillBays";

export default function SkillsDistrict({ position, rotation }: { position: [number, number, number]; rotation?: [number, number, number] }) {
  const kit = useMemo(() => createSkillsKit(), []);
  const material = useRef<MeshStandardMaterial | null>(null);
  const trolley = useRef<Group>(null);
  const assemblies = useRef<Partial<Record<SkillsAssembly, Group>>>({});
  const reducedMotion = useRef(false);
  const [hovered, setHovered] = useState(false);
  const { mode, section, progressOf, enter } = useSceneTransition();
  const active = hovered && mode === "workbench";
  const invalidate = useThree((state) => state.invalidate);
  useCursor(active);
  const sign = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512; canvas.height = 128;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#b95c2c"; context.fillRect(0, 0, 512, 128);
    context.fillStyle = "#f0e6cc";
    context.font = '500 64px "Helvetica Neue", Arial, sans-serif';
    context.textAlign = "center"; context.textBaseline = "middle";
    context.fillText("SKILLS", 256, 68);
    const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace;
    return texture;
  }, []);
  useLayoutEffect(() => { material.current = kit.materials.window; }, [kit]);
  useEffect(() => { invalidate(); }, [active, invalidate]);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => { reducedMotion.current = preference.matches; invalidate(); };
    const reset = () => setHovered(false);
    sync(); preference.addEventListener("change", sync);
    window.addEventListener("blur", reset); window.addEventListener("resize", reset);
    return () => {
      preference.removeEventListener("change", sync);
      window.removeEventListener("blur", reset); window.removeEventListener("resize", reset);
    };
  }, [invalidate]);
  useEffect(() => () => {
    kit.brick.dispose(); kit.stud.dispose(); kit.partLibrary.dispose(); sign.dispose();
    Object.values(kit.materials).forEach((finish) => finish.dispose());
  }, [kit, sign]);
  useFrame((_, delta) => {
    if (!material.current || !trolley.current) return;
    const step = Math.min(delta, .05);
    const progress = progressOf("skills");
    const doors = assemblies.current.doors;
    const roof = assemblies.current.roof;
    const wing = assemblies.current.wing;
    const interior = assemblies.current.interior;
    if (doors) doors.position.z = .18 * phase(progress, .46, .67);
    if (roof) roof.position.y = .15 * phase(progress, .52, .78);
    if (wing) wing.position.x = .18 * phase(progress, .65, .83);
    if (interior) {
      interior.visible = progress > .20;
      interior.position.z = .15 * phase(progress, .58, .82);
    }
    const light = (active || (section === "skills" && isDistrictMode(mode)) ? .18 : .08);
    const x = section === "skills" && !reducedMotion.current ? .74 * phase(progress, .32, .70) + .28 : active && !reducedMotion.current ? .54 : .28;
    material.current.emissiveIntensity += (light - material.current.emissiveIntensity) * (1 - Math.exp(-6 * step));
    trolley.current.position.x += (x - trolley.current.position.x) * (1 - Math.exp(-1.5 * step));
    trolley.current.position.y += ((section === "skills" ? .79 - .07 * phase(progress, .68, .86) : .79) - trolley.current.position.y) * (1 - Math.exp(-2 * step));
    if (Math.abs(light - material.current.emissiveIntensity) > .001 || Math.abs(x - trolley.current.position.x) > .001) invalidate();
  });
  return (
    <group name="Skills district" position={position} rotation={rotation}>
      {(["fixed", "doors", "roof", "wing", "interior"] as const).map((assembly) => (
        <group key={assembly} name={`Skills ${assembly}`} ref={(group) => { if (group) assemblies.current[assembly] = group; }} visible={assembly !== "interior"}>
          {kit.batches.filter((batch) => batch.assembly === assembly).map((batch, index) => <BrickInstances key={`${assembly}-${batch.finish}-${batch.stud}-${index}`} parts={batch.parts} geometry={batch.form ? kit.forms[batch.form] : batch.stud ? kit.stud : kit.brick} material={kit.materials[batch.finish]} />)}
        </group>
      ))}
      <group ref={trolley} position={[.28, .79, .23]}>
        <mesh geometry={kit.brick} customDepthMaterial={kit.brick.userData.moldedDepth} material={kit.materials.orange} scale={[.18, .085, .19]} castShadow dispose={null} raycast={() => {}} />
        <mesh geometry={kit.brick} material={kit.materials.dark} position={[0, -.18, 0]} scale={[.025, .28, .025]} dispose={null} raycast={() => {}} />
        <mesh geometry={kit.brick} material={kit.materials.yellow} position={[.025, -.32, 0]} scale={[.075, .045, .07]} dispose={null} raycast={() => {}} />
      </group>
      <mesh position={[-.43, .468, .216]} raycast={() => {}}>
        <planeGeometry args={[.46, .06]} /><meshStandardMaterial map={sign} roughness={.4} />
      </mesh>
      <ContactShadows position={[0, .001, 0]} scale={2.5} far={.9} opacity={.27} blur={1.1} resolution={256} frames={1} color="#16191b" />
      <SectionMarkers section="skills" markers={SKILL_BAYS} style={BAY_STYLE} />
      {/* Only in the room overview: inside the workshop it would shadow the bays. */}
      {mode === "workbench" && <mesh position={[0, .42, 0]} onPointerOver={(event) => { event.stopPropagation(); if (mode === "workbench") { setHovered(true); markCityExplored(); } }} onPointerOut={() => setHovered(false)} onClick={(event) => { event.stopPropagation(); if (mode === "workbench") { setHovered(false); enter("skills"); } }}>
        <boxGeometry args={[1.8, .85, .85]} /><meshBasicMaterial visible={false} />
      </mesh>}
      {active && <Html position={[0, 1.10, 0]} center style={{ pointerEvents: "none", whiteSpace: "nowrap" }}>
        <div style={{ padding: "10px 14px", color: "#e6e4df", background: "rgba(25,27,29,.90)", border: "1px solid rgba(211,208,196,.15)", borderRadius: 3, fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
          <div style={{ fontSize: 10, letterSpacing: ".16em", lineHeight: 1.5 }}>SKILLS</div>
          <div style={{ marginTop: 3, fontSize: 11, color: "#b8b7b1", lineHeight: 1.5 }}>Tools &amp; Technologies →</div>
        </div>
      </Html>}
    </group>
  );
}
