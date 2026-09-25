import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ContactShadows, Html, useCursor } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { CanvasTexture, Group, MeshStandardMaterial, SRGBColorSpace } from "three";
import BrickInstances from "./BrickInstances";
import { BEACON_Y, CONTACT_HIT, DISH_MOUNT, createContactKit } from "./contactGeometry";
import { phase, useSceneTransition } from "./SceneTransition";
import { markCityExplored } from "./cityHint";

/** The dish's resting turn, where it is mounted, so a tower at rest needs no frames. */
const DISH_REST = -.12;
/** The signal's climb up the lower tower's front corner post (contactGeometry). */
const PULSE_FROM = .36, PULSE_TO = 1.1;

export default function ContactDistrict({ position, rotation }: { position: [number, number, number]; rotation?: [number, number, number] }) {
  const kit = useMemo(() => createContactKit(), []);
  const dish = useRef<Group>(null);
  const beacon = useRef<MeshStandardMaterial | null>(null);
  const signal = useRef<MeshStandardMaterial | null>(null);
  const pulse = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);
  const { mode, progressOf, enter } = useSceneTransition();
  const invalidate = useThree((state) => state.invalidate);
  const active = hovered && mode === "workbench";
  useCursor(active);
  const sign = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512; canvas.height = 128;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#2d3439"; context.fillRect(0, 0, 512, 128);
    context.fillStyle = "#d8e0dc";
    context.font = '500 56px "Helvetica Neue", Arial, sans-serif';
    context.textAlign = "center"; context.textBaseline = "middle";
    context.fillText("CONTACT", 256, 68);
    const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace;
    return texture;
  }, []);
  useLayoutEffect(() => { beacon.current = kit.materials.red; signal.current = kit.materials.signal; }, [kit]);
  useEffect(() => { invalidate(); }, [active, invalidate]);
  useEffect(() => {
    const reset = () => setHovered(false);
    window.addEventListener("blur", reset); window.addEventListener("resize", reset);
    return () => { window.removeEventListener("blur", reset); window.removeEventListener("resize", reset); };
  }, []);
  useEffect(() => () => {
    kit.geometryFor.brick.dispose(); kit.geometryFor.stud.dispose(); kit.dish.dispose(); kit.dishMaterial.dispose(); sign.dispose();
    Object.values(kit.materials).forEach((finish) => finish.dispose());
  }, [kit, sign]);
  useFrame((state, delta) => {
    if (!dish.current || !beacon.current || !signal.current) return;
    const step = Math.min(delta, .05);
    // Opening Contact runs one activation: a signal climbs the tower's front
    // corner, the communication floors light, the dish swings into line and the
    // beacon holds steady. It all reverses on the way out.
    const progress = progressOf("contact");
    const align = phase(progress, .4, .75);
    const target = (active ? -.32 : DISH_REST) - .75 * align;
    const idlePulse = .05 + .045 * Math.sin(state.clock.elapsedTime * 1.1);
    const light = (active ? .22 : idlePulse + (.4 - idlePulse) * phase(progress, .7, .9));
    if (pulse.current) {
      const climb = phase(progress, .3, .72);
      pulse.current.visible = climb > 0 && climb < 1;
      pulse.current.position.y = PULSE_FROM + (PULSE_TO - PULSE_FROM) * climb;
    }
    // Each value eases toward its target and lands on it exactly, so a settled
    // tower asks for no more frames.
    const ease = (value: number, goal: number, rate: number, epsilon: number) => {
      const next = value + (goal - value) * (1 - Math.exp(-rate * step));
      return Math.abs(goal - next) < epsilon ? goal : next;
    };
    dish.current.rotation.y = ease(dish.current.rotation.y, target, 1.4, .004);
    beacon.current.emissiveIntensity = ease(beacon.current.emissiveIntensity, light, 6, .002);
    // The communication floors warm up slightly while hovered.
    const glass = (active ? .16 : .05 + .15 * phase(progress, .55, .8));
    signal.current.emissiveIntensity = ease(signal.current.emissiveIntensity, glass, 5, .001);
    // At rest the beacon's slow pulse rides the room's ambient tick (StarClock);
    // only the dish, the floors and a beacon settling to a new level ask for frames.
    if (dish.current.rotation.y !== target || signal.current.emissiveIntensity !== glass || (active && beacon.current.emissiveIntensity !== light)) invalidate();
  });
  return (
    <group name="Contact district" position={position} rotation={rotation}>
      {kit.batches.map((batch, index) => <BrickInstances key={`${batch.finish}-${batch.form}-${index}`} parts={batch.parts} geometry={kit.geometryFor[batch.form]} material={kit.materials[batch.finish]} />)}
      {/* Crown dish: yoke, bowl turned outward over the corner, feed horn. */}
      <group ref={dish} position={DISH_MOUNT} rotation={[0, DISH_REST, 0]}>
        <group rotation={[0, Math.PI / 4, 0]}>
          <mesh geometry={kit.geometryFor.brick} material={kit.materials.silver} position={[0, .01, 0]} scale={[.02, .07, .02]} dispose={null} raycast={() => {}} />
          <mesh geometry={kit.dish} material={kit.dishMaterial} position={[0, .06, .02]} rotation={[-Math.PI / 2.6, 0, 0]} scale={[1, .5, 1]} dispose={null} raycast={() => {}} />
          <mesh geometry={kit.geometryFor.brick} material={kit.materials.silver} position={[0, .08, .085]} rotation={[-.9, 0, 0]} scale={[.008, .09, .008]} dispose={null} raycast={() => {}} />
        </group>
      </group>
      <mesh position={[0, .245, .505]} raycast={() => {}}>
        <planeGeometry args={[.32, .044]} /><meshStandardMaterial map={sign} roughness={.42} />
      </mesh>
      <group ref={pulse} position={[-.27, PULSE_FROM, .19]} visible={false}>
        <mesh geometry={kit.geometryFor.brick} material={kit.materials.signal} scale={[.03, .05, .03]} dispose={null} raycast={() => {}} />
      </group>
      <ContactShadows position={[0, .001, 0]} scale={1.3} far={1.2} opacity={.27} blur={1.2} resolution={256} frames={1} color="#16191b" />
      {mode === "workbench" && <mesh position={CONTACT_HIT.centre} onPointerOver={(event) => { event.stopPropagation(); setHovered(true); markCityExplored(); }} onPointerOut={() => setHovered(false)}
        onClick={(event) => { event.stopPropagation(); setHovered(false); enter("contact"); }}>
        <boxGeometry args={CONTACT_HIT.size} /><meshBasicMaterial visible={false} />
      </mesh>}
      {active && <Html position={[0, BEACON_Y + .15, 0]} center style={{ pointerEvents: "none", whiteSpace: "nowrap" }}>
        <div style={{ padding: "10px 14px", color: "#e6e4df", background: "rgba(25,27,29,.90)", border: "1px solid rgba(211,208,196,.15)", borderRadius: 3, fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
          <div style={{ fontSize: 10, letterSpacing: ".16em", lineHeight: 1.5 }}>CONTACT</div>
          <div style={{ marginTop: 3, fontSize: 11, color: "#b8b7b1", lineHeight: 1.5 }}>Get in Touch →</div>
        </div>
      </Html>}
    </group>
  );
}
