import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ContactShadows, Html, useCursor } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { CanvasTexture, Group, MeshStandardMaterial, SRGBColorSpace } from "three";
import BrickInstances from "./BrickInstances";
import { createAboutKit, type AboutAssembly } from "./aboutGeometry";
import { isDistrictMode, phase, useSceneTransition } from "./SceneTransition";
import { markCityExplored } from "./cityHint";

const noRaycast = () => {};
type V3 = [number, number, number];
type Piece = { finish: "brown" | "cream" | "terracotta" | "green" | "tan" | "charcoal" | "window"; at: V3; size: V3; turn?: V3 };

/** A few personal things inside the ground-floor room, seen once the front
 * glazing rises. Only what the About copy names: a shelf and a writing table
 * for the fiction, the flute on its stand, and a warm lamp over a rug. */
const INTERIOR: Piece[] = [
  { finish: "terracotta", at: [-.27, .163, -.02], size: [.36, .004, .16] },
  { finish: "brown", at: [-.46, .25, -.04], size: [.12, .18, .045] },
  ...[0, 1, 2].flatMap((row) => [0, 1, 2, 3].map((i): Piece => ({
    finish: (["terracotta", "green", "cream", "tan"] as const)[(i + row) % 4],
    at: [-.502 + i * .028, .196 + row * .055, -.015], size: [.02, .038 - ((i * 7 + row) % 3) * .005, .02],
  }))),
  ...[-.29, -.19].map((x): Piece => ({ finish: "brown", at: [x, .2, .0], size: [.008, .08, .008] })),
  { finish: "brown", at: [-.24, .243, .0], size: [.13, .01, .07] },
  { finish: "cream", at: [-.26, .256, .0], size: [.05, .016, .036] },
  { finish: "charcoal", at: [-.22, .25, .01], size: [.03, .003, .004], turn: [0, .5, 0] },
  { finish: "charcoal", at: [-.06, .2, .01], size: [.006, .08, .006] },
  { finish: "charcoal", at: [-.06, .243, .01], size: [.03, .006, .012] },
  { finish: "cream", at: [-.06, .252, .01], size: [.12, .007, .007] },
  { finish: "window", at: [-.27, .44, -.02], size: [.08, .012, .08] },
];

export default function AboutDistrict({ position, rotation }: { position: [number, number, number]; rotation?: [number, number, number] }) {
  const kit = useMemo(() => createAboutKit(), []);
  const windowMaterial = useRef<MeshStandardMaterial | null>(null);
  const roof = useRef<Group>(null);
  const front = useRef<Group>(null);
  const interior = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);
  const { mode, section, progressOf, enter } = useSceneTransition();
  const invalidate = useThree((state) => state.invalidate);
  const active = hovered && mode === "workbench";
  useCursor(active);
  const sign = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512; canvas.height = 128;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#4c3c32"; context.fillRect(0, 0, 512, 128);
    context.fillStyle = "#eadcc1";
    context.font = '500 62px "Helvetica Neue", Arial, sans-serif';
    context.textAlign = "center"; context.textBaseline = "middle";
    context.fillText("ABOUT", 256, 68);
    const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace;
    return texture;
  }, []);
  useLayoutEffect(() => { windowMaterial.current = kit.materials.window; }, [kit]);
  useEffect(() => { invalidate(); }, [active, invalidate]);
  useEffect(() => {
    const reset = () => setHovered(false);
    window.addEventListener("blur", reset); window.addEventListener("resize", reset);
    return () => { window.removeEventListener("blur", reset); window.removeEventListener("resize", reset); };
  }, []);
  useEffect(() => () => {
    kit.brick.dispose(); kit.stud.dispose(); kit.football.dispose(); kit.footballMaterial.dispose(); sign.dispose();
    Object.values(kit.materials).forEach((finish) => finish.dispose());
  }, [kit, sign]);
  useFrame((_, delta) => {
    if (!windowMaterial.current) return;
    // The studio opens like a diorama: the roof lifts a little, the front glazing
    // rises like a sash window, clear of the room, and the room's lamp warms.
    const progress = progressOf("about");
    if (roof.current) roof.current.position.y = .16 * phase(progress, .32, .62);
    if (front.current) {
      const open = phase(progress, .46, .8);
      front.current.position.set(0, .21 * open, .05 * open);
    }
    if (interior.current) interior.current.visible = progress > 0;
    const target = (active ? .20 : section === "about" && isDistrictMode(mode) ? .09 + .2 * phase(progress, .6, .9) : .09);
    windowMaterial.current.emissiveIntensity += (target - windowMaterial.current.emissiveIntensity) * (1 - Math.exp(-6 * Math.min(delta, .05)));
    if (Math.abs(target - windowMaterial.current.emissiveIntensity) > .001) invalidate();
  });
  const batches = (assembly: AboutAssembly) => kit.batches.filter((batch) => batch.assembly === assembly)
    .map((batch, index) => <BrickInstances key={`${assembly}-${batch.finish}-${batch.stud}-${index}`} parts={batch.parts} geometry={batch.stud ? kit.stud : kit.brick} material={kit.materials[batch.finish]} />);
  return (
    <group name="About district" position={position} rotation={rotation}>
      {batches("fixed")}
      <group ref={roof} name="About roof">{batches("roof")}</group>
      <group ref={front} name="About front">{batches("front")}</group>
      <group ref={interior} name="About interior" visible={false}>
        {INTERIOR.map((piece, i) => <mesh key={i} geometry={kit.brick} material={kit.materials[piece.finish]} position={piece.at} scale={piece.size} rotation={piece.turn} castShadow dispose={null} raycast={noRaycast} />)}
      </group>
      <mesh geometry={kit.football} material={kit.footballMaterial} position={[.58, .15, .29]} castShadow receiveShadow dispose={null} raycast={noRaycast} />
      <mesh position={[-.66, .22, .315]} raycast={noRaycast}>
        <planeGeometry args={[.47, .12]} /><meshStandardMaterial map={sign} roughness={.42} />
      </mesh>
      <ContactShadows position={[0, .001, 0]} scale={1.85} far={.82} opacity={.26} blur={1.1} resolution={256} frames={1} color="#16191b" />
      {mode === "workbench" && <mesh position={[0, .38, 0]} onPointerOver={(event) => { event.stopPropagation(); setHovered(true); markCityExplored(); }} onPointerOut={() => setHovered(false)}
        onClick={(event) => { event.stopPropagation(); setHovered(false); enter("about"); }}>
        <boxGeometry args={[1.38, .88, .76]} /><meshBasicMaterial visible={false} />
      </mesh>}
      {active && <Html position={[0, 1.10, 0]} center style={{ pointerEvents: "none", whiteSpace: "nowrap" }}>
        <div style={{ padding: "10px 14px", color: "#e6e4df", background: "rgba(25,27,29,.90)", border: "1px solid rgba(211,208,196,.15)", borderRadius: 3, fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
          <div style={{ fontSize: 10, letterSpacing: ".16em", lineHeight: 1.5 }}>ABOUT</div>
          <div style={{ marginTop: 3, fontSize: 11, color: "#b8b7b1", lineHeight: 1.5 }}>Who I Am →</div>
        </div>
      </Html>}
    </group>
  );
}
