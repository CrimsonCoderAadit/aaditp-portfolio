import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useCursor } from "@react-three/drei";
import { BoxGeometry, CanvasTexture, CylinderGeometry, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace } from "three";
import { useThree } from "@react-three/fiber";
import { useSceneTransition } from "./SceneTransition";
import { markCityExplored } from "./cityHint";
import { DISTRICTS, type DistrictName } from "./cityMasterplan";
import { CITY_GROUP_POSITION, TABLETOP_Y } from "./districtLayout";
import { VIEWPOINTS } from "./viewpoints";

const noRaycast = () => {};

/** One flag per district, standing on its own ground at a front corner clear of
 * its façade signs, in table units relative to the district's anchor. The back
 * row is further from the hero camera, so its flags are a size larger. */
const FLAGS: Record<DistrictName, { label: string; accent: string; at: [number, number]; pole: number; size: number }> = {
  projects: { label: "PROJECTS", accent: "#6fb7e8", at: [-1.1, .8], pole: .7, size: 1.3 },
  experience: { label: "EXPERIENCE", accent: "#9aa6ff", at: [1.02, .72], pole: .7, size: 1.3 },
  research: { label: "RESEARCH", accent: "#5fd3b0", at: [-.95, .38], pole: .62, size: 1 },
  skills: { label: "SKILLS", accent: "#e0a24c", at: [-.82, .66], pole: .62, size: 1 },
  about: { label: "ABOUT", accent: "#e9c07a", at: [.62, .3], pole: .58, size: 1 },
  achievements: { label: "ACHIEVEMENTS", accent: "#d4b16a", at: [-.52, .42], pole: .62, size: 1.15 },
  contact: { label: "CONTACT", accent: "#7fd6e6", at: [-.6, .6], pole: .74, size: 1.3 },
};
const FLAG = { w: .5, h: .155, depth: .008 };
const GLOW = .38, HOVER_GLOW = .5;
/** The flag's hit volume: its cloth with a small margin, never the pole or plate. */
const HIT = { w: FLAG.w + .04, h: FLAG.h + .05, depth: .06 };

/** One invisible box over a flag. Clicking it enters the district through the
 * same `enter` its building calls; hovering brightens only this flag. */
function FlagHit({ name, material, geometry, hitMaterial }: { name: DistrictName; material: MeshStandardMaterial; geometry: BoxGeometry; hitMaterial: MeshBasicMaterial }) {
  const { mode, enter } = useSceneTransition();
  const invalidate = useThree((state) => state.invalidate);
  const [hovered, setHovered] = useState(false);
  const live = hovered && mode === "workbench";
  useCursor(live);
  const face = useRef<MeshStandardMaterial | null>(null);
  useLayoutEffect(() => { face.current = material; }, [material]);
  useEffect(() => { if (face.current) face.current.emissiveIntensity = live ? HOVER_GLOW : GLOW; invalidate(); }, [live, invalidate]);
  useEffect(() => {
    const reset = () => setHovered(false);
    window.addEventListener("blur", reset);
    return () => window.removeEventListener("blur", reset);
  }, []);
  if (mode !== "workbench") return null;
  return <mesh name={`${name} flag hit`} geometry={geometry} material={hitMaterial} scale={[HIT.w, HIT.h, HIT.depth]}
    onPointerOver={(event) => { event.stopPropagation(); setHovered(true); markCityExplored(); }}
    onPointerOut={() => setHovered(false)}
    onClick={(event) => { event.stopPropagation(); setHovered(false); enter(name); }} />;
}

function flagTexture(label: string, accent: string, anisotropy: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 640; canvas.height = Math.round(640 * FLAG.h / FLAG.w);
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#151923"; c.fillRect(0, 0, canvas.width, canvas.height);
  c.fillStyle = accent; c.fillRect(0, 0, 30, canvas.height); c.fillRect(0, canvas.height - 8, canvas.width, 8);
  c.font = "700 100px 'Helvetica Neue', Helvetica, Arial, sans-serif";
  const spaced = label.split("").join(String.fromCharCode(8202));
  const size = Math.min(canvas.height * .56, 100 * (canvas.width - 90) / c.measureText(spaced).width);
  c.font = `700 ${size}px 'Helvetica Neue', Helvetica, Arial, sans-serif`;
  c.fillStyle = "#f3f1ea"; c.textAlign = "center"; c.textBaseline = "middle";
  c.fillText(spaced, 15 + canvas.width / 2, canvas.height * .47);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = anisotropy;
  return texture;
}

/** Physical district flags: a round plate with a stud, a grey pole, a cap and a
 * flat flag carrying the district's name on a dark field with its accent at the
 * hoist. One shared design; each turned to face the hero camera. In the room
 * overview each flag is also a way into its district, exactly like its building. */
export default function DistrictFlags() {
  const anisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy());
  const kit = useMemo(() => {
    const flags = (Object.keys(FLAGS) as DistrictName[]).map((name) => {
      const texture = flagTexture(FLAGS[name].label, FLAGS[name].accent, anisotropy);
      return { name, texture, material: new MeshStandardMaterial({ map: texture, emissiveMap: texture, emissive: "#ffffff", emissiveIntensity: GLOW, roughness: .55 }) };
    });
    return {
      flags,
      plate: new CylinderGeometry(.05, .05, .018, 20),
      stud: new CylinderGeometry(.018, .018, .012, 14),
      pole: new CylinderGeometry(.0085, .0085, 1, 10),
      cap: new CylinderGeometry(.014, .014, .02, 12),
      cloth: new BoxGeometry(1, 1, 1),
      face: new PlaneGeometry(1, 1),
      grey: new MeshStandardMaterial({ color: "#a3a8ad", roughness: .42 }),
      dark: new MeshStandardMaterial({ color: "#2a2e36", roughness: .45 }),
      edge: new MeshStandardMaterial({ color: "#151923", roughness: .55 }),
      hit: new MeshBasicMaterial({ visible: false }),
    };
  }, [anisotropy]);
  useEffect(() => () => {
    kit.flags.forEach(({ texture, material }) => { texture.dispose(); material.dispose(); });
    [kit.plate, kit.stud, kit.pole, kit.cap, kit.cloth, kit.face, kit.grey, kit.dark, kit.edge, kit.hit].forEach((resource) => resource.dispose());
  }, [kit]);

  const [camX, , camZ] = VIEWPOINTS.city.position;
  return (
    <group name="district flags">
      {kit.flags.map(({ name, material }) => {
        const { at, lift } = DISTRICTS[name];
        const flag = FLAGS[name];
        const x = at[0] + flag.at[0], z = at[1] + flag.at[1];
        const facing = Math.atan2(camX - CITY_GROUP_POSITION[0] - x, camZ - CITY_GROUP_POSITION[2] - z);
        const top = flag.pole / flag.size;
        return (
          <group key={name} name={`${name} flag`} position={[x, TABLETOP_Y + lift, z]} rotation={[0, facing, 0]} scale={flag.size}>
            <mesh geometry={kit.plate} material={kit.dark} position={[0, .009, 0]} castShadow receiveShadow raycast={noRaycast} />
            <mesh geometry={kit.stud} material={kit.dark} position={[0, .024, 0]} raycast={noRaycast} />
            <mesh geometry={kit.pole} material={kit.grey} position={[0, top / 2, 0]} scale={[1, top, 1]} castShadow raycast={noRaycast} />
            <mesh geometry={kit.cap} material={kit.grey} position={[0, top + .01, 0]} raycast={noRaycast} />
            <group position={[FLAG.w / 2 + .01, top - FLAG.h / 2 - .02, 0]}>
              <mesh geometry={kit.cloth} material={kit.edge} scale={[FLAG.w, FLAG.h, FLAG.depth]} castShadow raycast={noRaycast} />
              <mesh geometry={kit.face} material={material} position={[0, 0, FLAG.depth / 2 + .0005]} scale={[FLAG.w, FLAG.h, 1]} raycast={noRaycast} />
              <mesh geometry={kit.face} material={material} position={[0, 0, -FLAG.depth / 2 - .0005]} rotation={[0, Math.PI, 0]} scale={[FLAG.w, FLAG.h, 1]} raycast={noRaycast} />
              <FlagHit name={name} material={material} geometry={kit.cloth} hitMaterial={kit.hit} />
            </group>
          </group>
        );
      })}
    </group>
  );
}
