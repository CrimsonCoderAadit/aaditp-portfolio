import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Html, useCursor } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { BoxGeometry, CanvasTexture, Group, MeshStandardMaterial, SRGBColorSpace } from "three";
import { CAREER, startYear, type ExperienceEntry } from "../content/experience";
import { hoverDetail, useHoveredDetail, useSceneTransition } from "./SceneTransition";
import { CITY_NEUTRALS } from "./cityPalette";

/** Career levels in the Experience tower (see experienceGeometry: four storeys,
 * slab `n` at y = .10 + .26n). The ground storey is the lobby, so positions
 * take the storeys above it in order, the oldest lowest; storeys without a
 * position stay neutral offices. The tower has three to give. */
const FIRST_STOREY = 1;
const STOREY = .26;
const slabY = (storey: number) => .10 + storey * STOREY;
/** Opened, the slab above hides all but the front of a storey from the focus
 * camera, so everything that marks a career storey sits within this depth of
 * the slab edge (z = -.04). */
const FRONT = -.05;
const PLAQUE: [number, number] = [.3, .0375];
const noRaycast = () => {};

function plaqueTexture(entry: ExperienceEntry) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 64;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#1c2226";
  context.fillRect(0, 0, 512, 64);
  context.fillStyle = entry.accent;
  context.fillRect(18, 27, 10, 10);
  context.fillStyle = "#e3e7e5";
  context.font = '600 34px "Helvetica Neue", Helvetica, Arial, sans-serif';
  context.textBaseline = "middle";
  context.fillText(`${entry.companyShort} · ${entry.role.toUpperCase()}`, 44, 34);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

type Kit = { box: BoxGeometry; dark: MeshStandardMaterial; rack: MeshStandardMaterial };

function Block({ kit, material, at, size }: { kit: Kit; material: MeshStandardMaterial; at: [number, number, number]; size: [number, number, number] }) {
  return <mesh geometry={kit.box} material={material} position={at} scale={size} castShadow raycast={noRaycast} />;
}

/** One position's storey. Closed, its window band glows warm behind the
 * façade glass. Opened, a plaque hangs from the slab edge above, light spills
 * across the front of the floor, and a small workstation and server rack
 * stand at the front of the office. */
function CareerFloor({ entry, storey, kit, selected, hovered, interactive, onPoint, onSelect }: {
  entry: ExperienceEntry; storey: number; kit: Kit; selected: boolean; hovered: boolean; interactive: boolean;
  onPoint: (id: string, on: boolean) => void; onSelect: (id: string) => void;
}) {
  const { progressOf } = useSceneTransition();
  const base = slabY(storey);
  /** Top of the storey's floor plate (experienceGeometry's interior levels). */
  const floor = base + .0625;
  const ceiling = base + STOREY - .0225;
  const { light, plaque, texture } = useMemo(() => {
    const texture = plaqueTexture(entry);
    return {
      light: new MeshStandardMaterial({ color: "#3b3f42", emissive: entry.accent, emissiveIntensity: .5, roughness: .5 }),
      plaque: new MeshStandardMaterial({ map: texture, emissiveMap: texture, emissive: "#ffffff", emissiveIntensity: .15, roughness: .5 }),
      texture,
    };
  }, [entry]);
  useEffect(() => () => { light.dispose(); plaque.dispose(); texture.dispose(); }, [light, plaque, texture]);
  const glow = useRef<{ light: MeshStandardMaterial; plaque: MeshStandardMaterial } | null>(null);
  useLayoutEffect(() => { glow.current = { light, plaque }; }, [light, plaque]);
  const inside = useRef<Group>(null);
  const outside = useRef<Group>(null);
  const invalidate = useThree((state) => state.invalidate);
  useFrame((_, delta) => {
    const progress = progressOf("experience");
    // Same switch as the tower's interior and closed infill.
    if (inside.current) inside.current.visible = progress > 0;
    if (outside.current) outside.current.visible = progress === 0;
    if (!glow.current) return;
    const k = 1 - Math.exp(-9 * Math.min(delta, .05));
    const targets: [MeshStandardMaterial, number][] = [
      [glow.current.light, hovered ? 1.1 : selected ? .9 : .5],
      [glow.current.plaque, hovered ? .8 : selected ? .6 : .25],
    ];
    for (const [material, target] of targets) {
      material.emissiveIntensity += (target - material.emissiveIntensity) * k;
      if (Math.abs(target - material.emissiveIntensity) > .002) invalidate();
    }
  });

  return <>
    <group ref={outside}>
      {/* Lit band just in front of the closed infill, seen through the façade glass. */}
      {[-.1, .1, .3].map((x) => <Block key={x} kit={kit} material={light} at={[x, base + .13, -.128]} size={[.17, .1, .004]} />)}
    </group>
    <group ref={inside} visible={false}>
      <Block kit={kit} material={kit.dark} at={[.10, ceiling - .026, FRONT]} size={[PLAQUE[0] + .012, PLAQUE[1] + .01, .006]} />
      <mesh position={[.10, ceiling - .026, FRONT + .0035]} material={plaque} raycast={noRaycast}>
        <planeGeometry args={PLAQUE} />
      </mesh>
      <Block kit={kit} material={light} at={[.10, base + .026, FRONT]} size={[.6, .006, .008]} />
      <Block kit={kit} material={light} at={[.10, floor + .0015, -.2]} size={[.52, .003, .1]} />
      <Block kit={kit} material={kit.dark} at={[.04, floor + .02, -.19]} size={[.1, .04, .045]} />
      <Block kit={kit} material={kit.dark} at={[.04, floor + .062, -.205]} size={[.056, .036, .006]} />
      <Block kit={kit} material={light} at={[.04, floor + .062, -.2015]} size={[.048, .028, .002]} />
      <Block kit={kit} material={kit.rack} at={[-.1, floor + .05, -.21]} size={[.045, .1, .045]} />
      {[0, 1, 2].map((i) => <Block key={i} kit={kit} material={light} at={[-.1, floor + .025 + i * .026, -.187]} size={[.032, .005, .002]} />)}
    </group>
    {interactive && <mesh position={[.10, base + STOREY / 2 + .02, -.33]} name={`Career floor ${entry.id}`}
      onPointerOver={(event) => { event.stopPropagation(); onPoint(entry.id, true); }}
      onPointerOut={() => onPoint(entry.id, false)}
      onClick={(event) => { event.stopPropagation(); onSelect(entry.id); }}>
      <boxGeometry args={[.62, STOREY - .02, .6]} />
      <meshBasicMaterial visible={false} />
    </mesh>}
    {interactive && hovered && !selected && (
      <Html position={[-.28, base + STOREY / 2, -.05]} center style={{ pointerEvents: "none" }}>
        <div className="project-bay-label"><strong>{entry.company}</strong><span>{entry.role} · {startYear(entry)}</span></div>
      </Html>
    )}
  </>;
}

/** The Experience tower as a career timeline: one selectable storey per
 * position. Pointing at a storey and at its selector entry set the same shared
 * hover, and both select through the same `selectDetail`. */
export default function CareerFloors() {
  const { mode, detailId, selectDetail } = useSceneTransition();
  const hoveredDetailId = useHoveredDetail();
  const kit = useMemo<Kit>(() => ({
    box: new BoxGeometry(1, 1, 1),
    dark: new MeshStandardMaterial({ color: CITY_NEUTRALS.charcoal, roughness: .4 }),
    rack: new MeshStandardMaterial({ color: "#252b30", roughness: .45, metalness: .2 }),
  }), []);
  useEffect(() => () => { kit.box.dispose(); kit.dark.dispose(); kit.rack.dispose(); }, [kit]);
  const interactive = mode === "experience";
  const hovered = interactive ? hoveredDetailId : null;
  const [pointing, setPointing] = useState(false);
  useCursor(interactive && pointing);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => { invalidate(); }, [hovered, detailId, invalidate]);
  const point = (id: string, on: boolean) => {
    setPointing(on);
    hoverDetail((current) => on ? id : current === id ? null : current);
  };

  return <group name="Career floors">
    {CAREER.slice(0, 3).map((entry, i) => (
      <CareerFloor key={entry.id} entry={entry} storey={FIRST_STOREY + i} kit={kit} interactive={interactive}
        selected={interactive && detailId === entry.id} hovered={hovered === entry.id}
        onPoint={point} onSelect={(id) => { setPointing(false); selectDetail(id); }} />
    ))}
  </group>;
}
