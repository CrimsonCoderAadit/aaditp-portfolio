import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ContactShadows, Html, useCursor } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { CanvasTexture, MeshStandardMaterial, SRGBColorSpace } from "three";
import BrickInstances from "./BrickInstances";
import { AWARD_TROPHY_Y, createAchievementsKit } from "./achievementsGeometry";
import { isDistrictMode, useSceneTransition } from "./SceneTransition";
import { markCityExplored } from "./cityHint";
import SectionMarkers from "./SectionMarkers";
import { ACHIEVEMENT_PLINTHS, PLINTH_STYLE } from "./achievementPlinths";

export default function AchievementsDistrict({ position, rotation }: { position: [number, number, number]; rotation?: [number, number, number] }) {
  const kit = useMemo(() => createAchievementsKit(), []);
  const displayMaterial = useRef<MeshStandardMaterial | null>(null);
  const [hovered, setHovered] = useState(false);
  const { mode, section, enter } = useSceneTransition();
  const invalidate = useThree((state) => state.invalidate);
  const active = hovered && mode === "workbench";
  useCursor(active);
  const sign = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 480; canvas.height = 104;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#29292b"; context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#ddc793";
    context.font = '500 40px "Helvetica Neue", Arial, sans-serif';
    context.textAlign = "center"; context.textBaseline = "middle";
    context.fillText("ACHIEVEMENTS", 240, 55);
    const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace;
    return texture;
  }, []);
  useLayoutEffect(() => { displayMaterial.current = kit.materials.display; }, [kit]);
  useEffect(() => { invalidate(); }, [active, invalidate]);
  useEffect(() => {
    const reset = () => setHovered(false);
    window.addEventListener("blur", reset); window.addEventListener("resize", reset);
    return () => { window.removeEventListener("blur", reset); window.removeEventListener("resize", reset); };
  }, []);
  useEffect(() => () => {
    kit.geometryFor.brick.dispose(); kit.geometryFor.stud.dispose(); kit.partLibrary.dispose(); sign.dispose();
    Object.values(kit.materials).forEach((finish) => finish.dispose());
  }, [kit, sign]);
  useFrame((_, delta) => {
    if (!displayMaterial.current) return;
    const target = (active || (section === "achievements" && isDistrictMode(mode)) ? .19 : .08);
    displayMaterial.current.emissiveIntensity += (target - displayMaterial.current.emissiveIntensity) * (1 - Math.exp(-6 * Math.min(delta, .05)));
    if (Math.abs(target - displayMaterial.current.emissiveIntensity) > .001) invalidate();
  });
  return (
    <group name="Achievements district" position={position} rotation={rotation}>
      {kit.batches.map((batch, index) => <BrickInstances key={`${batch.finish}-${batch.form}-${index}`} parts={batch.parts} geometry={kit.geometryFor[batch.form]} material={kit.materials[batch.finish]} />)}
      <group position={[0, AWARD_TROPHY_Y, -.18]}>
        <mesh geometry={kit.geometryFor.slope} material={kit.materials.brass} position={[-.05, .10, 0]} scale={[.045, .20, .032]} dispose={null} raycast={() => {}} />
        <mesh geometry={kit.geometryFor.slope} material={kit.materials.brass} position={[.05, .10, 0]} rotation={[0, Math.PI, 0]} scale={[.045, .20, .032]} dispose={null} raycast={() => {}} />
        <mesh geometry={kit.geometryFor.brick} material={kit.materials.display} position={[0, .14, 0]} scale={[.026, .27, .026]} dispose={null} raycast={() => {}} />
      </group>
      <mesh position={[0, .186, .106]} raycast={() => {}}>
        <planeGeometry args={[.30, .065]} /><meshStandardMaterial map={sign} roughness={.4} />
      </mesh>
      <ContactShadows position={[0, .001, 0]} scale={1.15} far={.68} opacity={.27} blur={1.0} resolution={256} frames={1} color="#16191b" />
      <SectionMarkers section="achievements" markers={ACHIEVEMENT_PLINTHS} style={PLINTH_STYLE} />
      {/* Only in the room overview: inside the plaza it would shadow the plinths. */}
      {mode === "workbench" && <mesh position={[0, .62, 0]} onPointerOver={(event) => { event.stopPropagation(); setHovered(true); markCityExplored(); }} onPointerOut={() => setHovered(false)}
        onClick={(event) => { event.stopPropagation(); setHovered(false); enter("achievements"); }}>
        <boxGeometry args={[.62, 1.32, .70]} /><meshBasicMaterial visible={false} />
      </mesh>}
      {active && <Html position={[0, 1.50, -.18]} center style={{ pointerEvents: "none", whiteSpace: "nowrap" }}>
        <div style={{ padding: "10px 14px", color: "#e6e4df", background: "rgba(25,27,29,.90)", border: "1px solid rgba(211,208,196,.15)", borderRadius: 3, fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
          <div style={{ fontSize: 10, letterSpacing: ".16em", lineHeight: 1.5 }}>ACHIEVEMENTS</div>
          <div style={{ marginTop: 3, fontSize: 11, color: "#b8b7b1", lineHeight: 1.5 }}>Awards &amp; Recognition →</div>
        </div>
      </Html>}
    </group>
  );
}
