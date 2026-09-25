import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Html, useCursor } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { BoxGeometry, CanvasTexture, CylinderGeometry, Group, MeshStandardMaterial, SRGBColorSpace } from "three";
import { hoverDetail, phase, useHoveredDetail, useSceneTransition, type Section } from "./SceneTransition";

export type V3 = [number, number, number];
/** One part of a marker's sculpture: a unit box or cylinder scaled to `size`
 * (a cylinder's size is radius, height, radius), in a finish of the kit or the
 * marker's own glowing accent. */
export type MarkerPart = { finish: string; at: V3; size: V3; turn?: V3; stud?: boolean };
export type Marker = {
  id: string;
  /** Where it stands, in the district's units: x, floor height, z. */
  at: V3;
  /** Turn about y, so the plate faces the focus camera. */
  facing?: number;
  plate: string;
  label: string;
  sublabel?: string;
  accent: string;
  parts: MarkerPart[];
};
export type MarkerStyle = {
  finishes: Record<string, string>;
  podium: { width: number; depth: number; height: number; finish: string; cap: string };
  plate: { width: number; height: number; background: string; ink: string };
  /** Height of the invisible hit volume above the floor. */
  reach: number;
};

const noRaycast = () => {};

function plateTexture(text: string, style: MarkerStyle["plate"], accent: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = Math.round(512 * style.height / style.width);
  const context = canvas.getContext("2d")!;
  context.fillStyle = style.background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = accent;
  context.fillRect(0, canvas.height - 8, canvas.width, 8);
  context.font = '600 60px "Helvetica Neue", Helvetica, Arial, sans-serif';
  const size = Math.min(canvas.height * .62, 60 * (canvas.width - 40) / context.measureText(text).width);
  context.font = `600 ${size}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  context.fillStyle = style.ink;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, canvas.width / 2, canvas.height * .46);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

type Kit = { box: BoxGeometry; stud: CylinderGeometry; finishes: Record<string, MeshStandardMaterial> };

function MarkerModel({ marker, style, kit, selected, hovered, interactive, onPoint, onSelect }: {
  marker: Marker; style: MarkerStyle; kit: Kit; selected: boolean; hovered: boolean; interactive: boolean;
  onPoint: (id: string, on: boolean) => void; onSelect: (id: string) => void;
}) {
  const { accent, plate, texture } = useMemo(() => {
    const texture = plateTexture(marker.plate, style.plate, marker.accent);
    return {
      accent: new MeshStandardMaterial({ color: marker.accent, emissive: marker.accent, emissiveIntensity: .12, roughness: .35 }),
      plate: new MeshStandardMaterial({ map: texture, emissiveMap: texture, emissive: "#ffffff", emissiveIntensity: .2, roughness: .5 }),
      texture,
    };
  }, [marker.plate, marker.accent, style.plate]);
  useEffect(() => () => { accent.dispose(); plate.dispose(); texture.dispose(); }, [accent, plate, texture]);
  const glow = useRef<{ accent: MeshStandardMaterial; plate: MeshStandardMaterial } | null>(null);
  useLayoutEffect(() => { glow.current = { accent, plate }; }, [accent, plate]);
  const invalidate = useThree((state) => state.invalidate);
  useFrame((_, delta) => {
    if (!glow.current) return;
    const k = 1 - Math.exp(-9 * Math.min(delta, .05));
    const targets: [MeshStandardMaterial, number][] = [
      [glow.current.accent, hovered ? .75 : selected ? .6 : .12],
      [glow.current.plate, hovered ? .85 : selected ? .6 : .2],
    ];
    for (const [material, target] of targets) {
      material.emissiveIntensity += (target - material.emissiveIntensity) * k;
      if (Math.abs(target - material.emissiveIntensity) > .002) invalidate();
    }
  });
  const { podium } = style;
  return (
    <group position={marker.at} rotation={[0, marker.facing ?? 0, 0]}>
      {/* A stepped base course seats the stand in its paving. */}
      <mesh geometry={kit.box} material={kit.finishes[podium.finish]} position={[0, .005, 0]} scale={[podium.width + .024, .01, podium.depth + .024]} receiveShadow raycast={noRaycast} />
      <mesh geometry={kit.box} material={kit.finishes[podium.cap]} position={[0, .0115, 0]} scale={[podium.width + .012, .003, podium.depth + .012]} raycast={noRaycast} />
      <mesh geometry={kit.box} material={kit.finishes[podium.finish]} position={[0, podium.height / 2, 0]} scale={[podium.width, podium.height, podium.depth]} castShadow receiveShadow raycast={noRaycast} />
      <mesh geometry={kit.box} material={accent} position={[0, podium.height + .002, 0]} scale={[podium.width + .004, .004, podium.depth + .004]} raycast={noRaycast} />
      <mesh geometry={kit.box} material={kit.finishes[podium.cap]} position={[0, podium.height + .007, 0]} scale={[podium.width - .012, .006, podium.depth - .012]} raycast={noRaycast} />
      <mesh material={plate} position={[0, podium.height * .5, podium.depth / 2 + .002]} raycast={noRaycast}>
        <planeGeometry args={[style.plate.width, style.plate.height]} />
      </mesh>
      <group position={[0, podium.height + .01, 0]}>
        {marker.parts.map((part, i) => <mesh key={i} geometry={part.stud ? kit.stud : kit.box} material={part.finish === "accent" ? accent : kit.finishes[part.finish]}
          position={part.at} scale={part.size} rotation={part.turn} castShadow raycast={noRaycast} />)}
      </group>
      {interactive && <mesh position={[0, style.reach / 2, 0]} name={`Marker ${marker.id}`}
        onPointerOver={(event) => { event.stopPropagation(); onPoint(marker.id, true); }}
        onPointerOut={() => onPoint(marker.id, false)}
        onClick={(event) => { event.stopPropagation(); onSelect(marker.id); }}>
        <boxGeometry args={[podium.width + .02, style.reach, podium.depth + .02]} />
        <meshBasicMaterial visible={false} />
      </mesh>}
      {interactive && hovered && !selected && (
        <Html position={[0, style.reach + .06, 0]} center style={{ pointerEvents: "none" }}>
          <div className="project-bay-label"><strong>{marker.label}</strong>{marker.sublabel && <span>{marker.sublabel}</span>}</div>
        </Html>
      )}
    </group>
  );
}

/** A district's selectable markers: small physical stands, one per entry,
 * that rise once the district has opened. Pointing at a marker and at its
 * selector entry set the same shared hover, and both select through the same
 * `selectDetail`. */
export default function SectionMarkers({ section, markers, style }: { section: Section; markers: Marker[]; style: MarkerStyle }) {
  const { mode, progressOf, detailId, selectDetail } = useSceneTransition();
  const hoveredDetailId = useHoveredDetail();
  const kit = useMemo<Kit>(() => ({
    box: new BoxGeometry(1, 1, 1),
    stud: new CylinderGeometry(1, 1, 1, 16),
    finishes: Object.fromEntries(Object.entries(style.finishes).map(([name, color]) => [name, new MeshStandardMaterial({ color, roughness: .36 })])),
  }), [style.finishes]);
  useEffect(() => () => { kit.box.dispose(); kit.stud.dispose(); Object.values(kit.finishes).forEach((material) => material.dispose()); }, [kit]);
  const interactive = mode === section;
  const hovered = interactive ? hoveredDetailId : null;
  const [pointing, setPointing] = useState(false);
  useCursor(interactive && pointing);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => { invalidate(); }, [hovered, detailId, invalidate]);
  const point = (id: string, on: boolean) => {
    setPointing(on);
    hoverDetail((value) => on ? id : value === id ? null : value);
  };

  const root = useRef<Group>(null);
  useFrame(() => {
    if (!root.current) return;
    const progress = progressOf(section);
    const up = phase(progress, .8, 1);
    root.current.visible = up > 0;
    root.current.position.y = -.12 * (1 - up);
  });

  return (
    <group ref={root} name={`${section} markers`} visible={false}>
      {markers.map((marker) => <MarkerModel key={marker.id} marker={marker} style={style} kit={kit} interactive={interactive}
        selected={interactive && detailId === marker.id} hovered={hovered === marker.id}
        onPoint={point} onSelect={(id) => { setPointing(false); selectDetail(id); }} />)}
    </group>
  );
}
