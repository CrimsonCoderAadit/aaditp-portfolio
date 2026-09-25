import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ContactShadows, Html, useCursor } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { CanvasTexture, Group, MeshStandardMaterial, SRGBColorSpace } from "three";
import BrickInstances from "./BrickInstances";
import { CHAMBER_CENTER_Z, createResearchKit, type ResearchAssembly } from "./researchGeometry";
import { isDistrictMode, phase, useSceneTransition } from "./SceneTransition";
import { markCityExplored } from "./cityHint";
import ResearchStations from "./ResearchStations";

export default function ResearchDistrict({ position, rotation }: { position: [number, number, number]; rotation?: [number, number, number] }) {
  const kit = useMemo(() => createResearchKit(), []);
  const windowMaterial = useRef<MeshStandardMaterial | null>(null);
  const coreMaterial = useRef<MeshStandardMaterial | null>(null);
  const scanner = useRef<Group>(null);
  const assemblies = useRef<Partial<Record<ResearchAssembly, Group>>>({});
  const panelRefs = useRef<Array<Group | null>>([]);
  const reducedMotion = useRef(false);
  const [hovered, setHovered] = useState(false);
  const { mode, section, progressOf, enter } = useSceneTransition();
  const invalidate = useThree((state) => state.invalidate);
  const active = hovered && mode === "workbench";
  useCursor(active);
  const sign = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#354449";
    context.fillRect(0, 0, 512, 128);
    context.fillStyle = "#e3eeeb";
    context.font = '500 57px "Helvetica Neue", Arial, sans-serif';
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("RESEARCH", 256, 67);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
  }, []);

  useLayoutEffect(() => {
    windowMaterial.current = kit.materials.window;
    coreMaterial.current = kit.core;
  }, [kit]);
  useEffect(() => { invalidate(); }, [active, invalidate]);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => { reducedMotion.current = preference.matches; invalidate(); };
    const reset = () => setHovered(false);
    sync();
    preference.addEventListener("change", sync);
    window.addEventListener("blur", reset);
    window.addEventListener("resize", reset);
    return () => {
      preference.removeEventListener("change", sync);
      window.removeEventListener("blur", reset);
      window.removeEventListener("resize", reset);
    };
  }, [invalidate]);
  useEffect(() => () => {
    kit.geometryFor.brick.dispose();
    kit.geometryFor.stud.dispose();
    kit.partLibrary.dispose();
    Object.values(kit.materials).forEach((finish) => finish.dispose());
    kit.glass.dispose();
    kit.core.dispose();
    sign.dispose();
  }, [kit, sign]);

  useFrame((_, delta) => {
    if (!windowMaterial.current || !coreMaterial.current || !scanner.current) return;
    const progress = progressOf("research");
    const chamber = assemblies.current.chamber;
    const core = assemblies.current.core;
    const interior = assemblies.current.interior;
    const chamberLift = phase(progress, .38, .58);
    const panelOpen = phase(progress, .49, .79);
    if (chamber) chamber.position.y = .035 * chamberLift;
    if (core) core.position.y = .20 * phase(progress, .61, .86);
    if (interior) {
      interior.visible = progress > .16;
      interior.position.y = .05 * phase(progress, .16, .42);
    }
    panelRefs.current.forEach((panel, index) => {
      const source = kit.panels[index];
      if (!panel || !source) return;
      const angle = source.rotation?.[1] ?? 0;
      const travel = .09 * panelOpen;
      panel.position.set(source.position[0] + Math.sin(angle) * travel, source.position[1] + .015 * panelOpen, source.position[2] + Math.cos(angle) * travel);
      panel.rotation.y = angle + .14 * panelOpen;
    });
    const damp = 1 - Math.exp(-6 * Math.min(delta, .05));
    const illumination = (active || (section === "research" && isDistrictMode(mode)) ? .15 : .07);
    const coreLight = (active || (section === "research" && isDistrictMode(mode)) ? .24 : .12);
    const angle = section === "research" && !reducedMotion.current ? Math.PI * .72 * phase(progress, .40, .82) : active && !reducedMotion.current ? Math.PI / 6 : 0;
    windowMaterial.current.emissiveIntensity += (illumination - windowMaterial.current.emissiveIntensity) * damp;
    coreMaterial.current.emissiveIntensity += (coreLight - coreMaterial.current.emissiveIntensity) * damp;
    scanner.current.rotation.y += (angle - scanner.current.rotation.y) * (1 - Math.exp(-1.5 * Math.min(delta, .05)));
    // The scanner's last fraction of a degree is invisible: it lands, and frames stop.
    if (Math.abs(angle - scanner.current.rotation.y) < .004) scanner.current.rotation.y = angle;
    if (Math.abs(illumination - windowMaterial.current.emissiveIntensity) > .001 || Math.abs(coreLight - coreMaterial.current.emissiveIntensity) > .001 || scanner.current.rotation.y !== angle) invalidate();
  });

  return (
    <group name="Research district" position={position} rotation={rotation}>
      {(["fixed", "chamber", "core", "interior"] as const).map((assembly) => (
        <group key={assembly} name={`Research ${assembly}`} ref={(group) => { if (group) assemblies.current[assembly] = group; }} visible={assembly !== "interior"}>
          {kit.batches.filter((batch) => batch.assembly === assembly).map((batch, index) => <BrickInstances key={`${assembly}-${batch.finish}-${batch.form}-${index}`} parts={batch.parts} geometry={kit.geometryFor[batch.form]} material={kit.materials[batch.finish]} />)}
          {/* The lens/sensor rides the platform: nested here so it rises with it. */}
          {assembly === "core" && (
            <group ref={scanner} position={[0, .315, CHAMBER_CENTER_Z]}>
              <mesh geometry={kit.geometryFor.brick} material={kit.materials.silver} scale={[.29, .012, .022]} position={[0, -.026, .028]} dispose={null} raycast={() => {}} />
              <mesh geometry={kit.geometryFor.brick} material={kit.materials.silver} scale={[.29, .012, .022]} position={[0, -.026, -.028]} dispose={null} raycast={() => {}} />
              <mesh geometry={kit.geometryFor.brick} material={kit.materials.charcoal} scale={[.245, .045, .075]} dispose={null} raycast={() => {}} />
              <mesh geometry={kit.geometryFor.brick} material={kit.core} scale={[.115, .10, .115]} position={[0, .038, 0]} rotation={[0, Math.PI / 4, 0]} dispose={null} raycast={() => {}} />
              <mesh geometry={kit.geometryFor.brick} material={kit.materials.cyan} scale={[.04, .065, .065]} position={[-.098, .02, 0]} dispose={null} raycast={() => {}} />
            </group>
          )}
        </group>
      ))}
      {/* Five separate, thin panels allow normal transparent sorting; no transmission pass. */}
      {kit.panels.map((panel, i) => <group key={i} ref={(group) => { panelRefs.current[i] = group; }} position={panel.position} rotation={panel.rotation}>
        <mesh geometry={kit.geometryFor.brick} material={kit.glass} scale={panel.size} raycast={() => {}} dispose={null} />
      </group>)}
      <mesh position={[0, .207, .368]} raycast={() => {}}>
        <planeGeometry args={[.66, .115]} />
        <meshStandardMaterial map={sign} roughness={.4} />
      </mesh>
      <ContactShadows position={[0, .001, 0]} scale={2.8} far={.75} opacity={.27} blur={1.1} resolution={256} frames={1} color="#16191b" />
      <ResearchStations />
      {/* Only in the room overview: inside the lab it would shadow the stations. */}
      {mode === "workbench" && <mesh position={[0, .32, 0]} onPointerOver={(event) => { event.stopPropagation(); if (mode === "workbench") { setHovered(true); markCityExplored(); } }} onPointerOut={() => setHovered(false)} onClick={(event) => { event.stopPropagation(); if (mode === "workbench") { setHovered(false); enter("research"); } }}>
        <boxGeometry args={[2.1, .65, .88]} />
        <meshBasicMaterial visible={false} />
      </mesh>}
      {active && (
        <Html position={[0, .92, 0]} center style={{ pointerEvents: "none", whiteSpace: "nowrap" }}>
          <div style={{ padding: "10px 14px", color: "#e6e4df", background: "rgba(25,27,29,.90)", border: "1px solid rgba(211,208,196,.15)", borderRadius: 3, fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
            <div style={{ fontSize: 10, letterSpacing: ".16em", lineHeight: 1.5 }}>RESEARCH</div>
            <div style={{ marginTop: 3, fontSize: 11, color: "#b8b7b1", lineHeight: 1.5 }}>Publications &amp; Experiments →</div>
          </div>
        </Html>
      )}
    </group>
  );
}
