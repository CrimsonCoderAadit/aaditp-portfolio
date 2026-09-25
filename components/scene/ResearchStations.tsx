import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { Html, useCursor } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { BoxGeometry, CanvasTexture, CylinderGeometry, Euler, Group, MeshStandardMaterial, Quaternion, SRGBColorSpace, Vector3 } from "three";
import { RESEARCH, type ResearchEntry, type StationMotif } from "../content/research";
import { hoverDetail, phase, useHoveredDetail, useSceneTransition } from "./SceneTransition";
import { CITY_NEUTRALS } from "./cityPalette";

type V3 = [number, number, number];
/** A station's place in the lab (district units, see researchGeometry), the
 * height of the surface it stands on, and where its floor conduit meets one
 * of the chamber's radial channels. Stations stand where the focus camera
 * sees them whole: the forecourt west of the entrance plaque, and the low
 * terrace in front of the east wing. The plaque would hide anything between
 * it and the chamber. A third publication takes the far forecourt slot. */
const SLOTS: { at: V3; conduit: [number, number][] }[] = [
  { at: [-.62, .083, .29], conduit: [[-.55, .25], [-.33, .135]] },
  { at: [.52, .142, .19], conduit: [[.405, .165], [.33, .135]] },
  { at: [-.86, .083, .29], conduit: [[-.79, .25], [-.62, .215]] },
];
const POD = .17;
const BASE = .055;
const TOP = BASE + .01;
const PLATE: [number, number] = [.15, .03];
/** Stations are authored at a smaller podium; this brings them up to it. */
const STATION_SCALE = 1.15;
const noRaycast = () => {};

type Kit = { box: BoxGeometry; stud: CylinderGeometry; white: MeshStandardMaterial; dark: MeshStandardMaterial; silver: MeshStandardMaterial; cyan: MeshStandardMaterial };
type Finish = "white" | "dark" | "silver" | "accent";

function Part({ kit, accent, finish, at, size, turn, stud }: { kit: Kit; accent: MeshStandardMaterial; finish: Finish; at: V3; size: V3; turn?: V3; stud?: boolean }) {
  const material = finish === "accent" ? accent : kit[finish];
  return <mesh geometry={stud ? kit.stud : kit.box} material={material} position={at} scale={size} rotation={turn} castShadow raycast={noRaycast} />;
}
const UP = new Vector3(0, 1, 0);
function rod(from: V3, to: V3, thickness: number) {
  const a = new Vector3(...from), b = new Vector3(...to);
  const direction = b.clone().sub(a);
  const turn = new Euler().setFromQuaternion(new Quaternion().setFromUnitVectors(UP, direction.clone().normalize()));
  return { at: a.add(b).multiplyScalar(.5).toArray() as V3, size: [thickness, direction.length(), thickness] as V3, turn: [turn.x, turn.y, turn.z] as V3 };
}

/** Each station is built from its paper's method. `moving` is the one part
 * that shifts when the station is selected. Local y = 0 is the podium cap. */
function Station({ motif, kit, accent, moving }: { motif: StationMotif; kit: Kit; accent: MeshStandardMaterial; moving: RefObject<Group | null> }): ReactNode {
  const p = (finish: Finish, at: V3, size: V3, turn?: V3, stud?: boolean) => ({ finish, at, size, turn, stud });
  let parts: ReturnType<typeof p>[] = [];
  let mover: ReactNode = null;
  if (motif === "token-graph") {
    // FIRE: a code–comment pair as a token graph on a bench. A row of code
    // tokens and a row of comment tokens, sequential edges along each row, skip
    // links arching over the code row and bridge edges joining the two sides;
    // at the end, the compact classifier's two-way readout.
    const code = [-.05, -.025, 0, .025].map((x): V3 => [x, .022, -.02]);
    const comment = [-.0375, -.0125, .0125].map((x): V3 => [x, .022, .024]);
    const edge = (a: V3, b: V3, finish: Finish, lift = 0, thickness = .0035) => {
      const mid: V3 = [(a[0] + b[0]) / 2, Math.max(a[1], b[1]) + lift, (a[2] + b[2]) / 2];
      const segments = lift ? [rod(a, mid, thickness), rod(mid, b, thickness)] : [rod(a, b, thickness)];
      return segments.map((s) => p(finish, s.at, s.size, s.turn));
    };
    parts = [
      p("silver", [-.012, .006, 0], [.12, .012, .09]),
      ...code.map((at) => p("dark", at, [.009, .014, .009], undefined, true)),
      ...comment.map((at) => p("white", at, [.009, .014, .009], undefined, true)),
      ...code.slice(1).flatMap((at, i) => edge(code[i], at, "dark")),
      ...comment.slice(1).flatMap((at, i) => edge(comment[i], at, "white")),
      ...edge(code[0], code[2], "silver", .03), ...edge(code[1], code[3], "silver", .03),
      ...edge(code[0], comment[0], "accent", .022, .004), ...edge(code[2], comment[1], "accent", .022, .004), ...edge(code[3], comment[2], "accent", .022, .004),
      p("dark", [.062, .03, 0], [.014, .06, .07]),
      p("accent", [.07, .045, -.015], [.004, .014, .014]),
      p("white", [.07, .045, .015], [.004, .014, .014]),
    ];
    mover = <group ref={moving} position={[-.056, 0, 0]}>
      <Part kit={kit} accent={accent} finish="accent" at={[0, .034, .002]} size={[.004, .004, .07]} />
      {[-.035, .039].map((z) => <Part key={z} kit={kit} accent={accent} finish="dark" at={[0, .02, z]} size={[.008, .03, .006]} />)}
    </group>;
  } else {
    // SemEval: two CodeBERT "brains" side by side on an input tray, joined in a
    // hard ensemble, under a tall calibration gauge whose threshold marker is
    // the percentile setting; the calibrated decision lamp tops it.
    parts = [
      p("white", [0, .005, .035], [.08, .01, .04]),
      ...[-.012, 0, .012].map((z) => p("dark", [0, .011, .035 + z * .6], [.05, .002, .003])),
      ...[-.024, .024].flatMap((x, i) => [
        p(i ? "silver" : "white", [x, .06, -.01], [.026, .12, .026]),
        p("accent", [x, .085, .0035], [.012, .05, .002]),
      ]),
      p("dark", [0, .13, -.01], [.078, .022, .034]),
      p("silver", [0, .185, -.01], [.008, .09, .008]),
      ...[0, 1, 2, 3, 4].map((i) => p("dark", [.008, .148 + i * .018, -.01], [.008, .002, .004])),
      p("accent", [0, .236, -.01], [.011, .014, .011], undefined, true),
    ];
    mover = <group ref={moving} position={[0, .2, 0]}>
      <Part kit={kit} accent={accent} finish="accent" at={[0, 0, -.01]} size={[.024, .007, .016]} />
    </group>;
  }
  return <>{parts.map((part, i) => <Part key={i} kit={kit} accent={accent} {...part} />)}{mover}</>;
}

/** Where each moving part rests, and where it goes when its station is
 * selected: the FIRE scan bar crosses the token rows; the SemEval threshold
 * marker drops down the gauge to its calibrated percentile. */
const MOVES: Record<StationMotif, { axis: "x" | "y"; rest: number; selected: number }> = {
  "token-graph": { axis: "x", rest: -.056, selected: .042 },
  "dual-encoder": { axis: "y", rest: .2, selected: .156 },
};

function plateTexture(entry: ResearchEntry) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 102;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#1c2326";
  context.fillRect(0, 0, 512, 102);
  context.fillStyle = entry.accent;
  context.fillRect(0, 0, 6, 102);
  context.fillStyle = "#e3eeeb";
  context.font = '600 44px "Helvetica Neue", Helvetica, Arial, sans-serif';
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(entry.shortName, 259, 54);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function ResearchStation({ entry, slot, kit, selected, hovered, interactive, onPoint, onSelect }: {
  entry: ResearchEntry; slot: (typeof SLOTS)[number]; kit: Kit; selected: boolean; hovered: boolean; interactive: boolean;
  onPoint: (id: string, on: boolean) => void; onSelect: (id: string) => void;
}) {
  const { accent, plate, texture } = useMemo(() => {
    const texture = plateTexture(entry);
    return {
      accent: new MeshStandardMaterial({ color: entry.accent, emissive: entry.accent, emissiveIntensity: .15, roughness: .35 }),
      plate: new MeshStandardMaterial({ map: texture, emissiveMap: texture, emissive: "#ffffff", emissiveIntensity: .2, roughness: .5 }),
      texture,
    };
  }, [entry]);
  useEffect(() => () => { accent.dispose(); plate.dispose(); texture.dispose(); }, [accent, plate, texture]);
  const glow = useRef<{ accent: MeshStandardMaterial; plate: MeshStandardMaterial } | null>(null);
  useLayoutEffect(() => { glow.current = { accent, plate }; }, [accent, plate]);
  const moving = useRef<Group>(null);
  const invalidate = useThree((state) => state.invalidate);
  useFrame((_, delta) => {
    if (!glow.current) return;
    const step = Math.min(delta, .05);
    const k = 1 - Math.exp(-9 * step);
    const targets: [MeshStandardMaterial, number][] = [
      [glow.current.accent, hovered ? .8 : selected ? .65 : .15],
      [glow.current.plate, hovered ? .85 : selected ? .6 : .2],
    ];
    for (const [material, target] of targets) {
      material.emissiveIntensity += (target - material.emissiveIntensity) * k;
      if (Math.abs(target - material.emissiveIntensity) > .002) invalidate();
    }
    // Settles well inside a second.
    const move = MOVES[entry.motif];
    if (moving.current) {
      const target = selected ? move.selected : move.rest;
      const position = moving.current.position;
      position[move.axis] += (target - position[move.axis]) * (1 - Math.exp(-7 * step));
      if (Math.abs(target - position[move.axis]) > .0003) invalidate();
    }
  });
  const [x, y, z] = slot.at;
  return (
    <group position={[x, y, z]}>
      <Part kit={kit} accent={accent} finish="dark" at={[0, BASE / 2, 0]} size={[POD, BASE, POD]} />
      <Part kit={kit} accent={accent} finish="accent" at={[0, BASE + .002, 0]} size={[POD + .004, .004, POD + .004]} />
      <Part kit={kit} accent={accent} finish="white" at={[0, BASE + .007, 0]} size={[POD - .014, .006, POD - .014]} />
      <Part kit={kit} accent={accent} finish="silver" at={[0, BASE * .5, POD / 2 + .0015]} size={[PLATE[0] + .008, PLATE[1] + .008, .003]} />
      <mesh position={[0, BASE * .5, POD / 2 + .0032]} material={plate} raycast={noRaycast}>
        <planeGeometry args={PLATE} />
      </mesh>
      <group position={[0, TOP, 0]} scale={STATION_SCALE}>
        <Station motif={entry.motif} kit={kit} accent={accent} moving={moving} />
      </group>
      {interactive && <mesh position={[0, .17, 0]} name={`Research station ${entry.id}`}
        onPointerOver={(event) => { event.stopPropagation(); onPoint(entry.id, true); }}
        onPointerOut={() => onPoint(entry.id, false)}
        onClick={(event) => { event.stopPropagation(); onSelect(entry.id); }}>
        <boxGeometry args={[POD + .02, .34, POD + .02]} />
        <meshBasicMaterial visible={false} />
      </mesh>}
      {interactive && hovered && !selected && (
        <Html position={[0, .4, 0]} center style={{ pointerEvents: "none" }}>
          <div className="project-bay-label"><strong>{entry.shortName}</strong><span>{entry.venue.split(" · ").at(-1)} · {entry.year}</span></div>
        </Html>
      )}
    </group>
  );
}

/** The Research lab's publication stations, around the chamber that serves
 * them as a shared analysis core: each is joined to one of the chamber's
 * radial floor channels by a cyan conduit. They rise once the chamber has
 * opened. Pointing at a station and at its selector entry set the same shared
 * hover, and both select through the same `selectDetail`. */
export default function ResearchStations() {
  const { mode, progressOf, detailId, selectDetail } = useSceneTransition();
  const hoveredDetailId = useHoveredDetail();
  const kit = useMemo<Kit>(() => ({
    box: new BoxGeometry(1, 1, 1),
    stud: new CylinderGeometry(1, 1, 1, 16),
    white: new MeshStandardMaterial({ color: CITY_NEUTRALS.offWhite, roughness: .3 }),
    dark: new MeshStandardMaterial({ color: CITY_NEUTRALS.charcoal, roughness: .38 }),
    silver: new MeshStandardMaterial({ color: CITY_NEUTRALS.architectural, roughness: .36 }),
    cyan: new MeshStandardMaterial({ color: "#408b9b", emissive: "#9cd4dc", emissiveIntensity: .12, roughness: .32 }),
  }), []);
  useEffect(() => () => { kit.box.dispose(); kit.stud.dispose(); [kit.white, kit.dark, kit.silver, kit.cyan].forEach((m) => m.dispose()); }, [kit]);
  const interactive = mode === "research";
  const hovered = interactive ? hoveredDetailId : null;
  const [pointing, setPointing] = useState(false);
  useCursor(interactive && pointing);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => { invalidate(); }, [hovered, detailId, invalidate]);
  const point = (id: string, on: boolean) => {
    setPointing(on);
    hoverDetail((current) => on ? id : current === id ? null : current);
  };
  const entries = RESEARCH.slice(0, SLOTS.length);

  const root = useRef<Group>(null);
  useFrame(() => {
    if (!root.current) return;
    const progress = progressOf("research");
    const up = phase(progress, .8, 1);
    root.current.visible = up > 0;
    root.current.position.y = -.12 * (1 - up);
  });

  return <>
    {entries.map((entry, i) => SLOTS[i].conduit.slice(1).map(([bx, bz], j) => {
      const [ax, az] = SLOTS[i].conduit[j];
      const length = Math.hypot(bx - ax, bz - az);
      return <mesh key={`${entry.id}-${j}`} geometry={kit.box} material={kit.cyan} position={[(ax + bx) / 2, .0795, (az + bz) / 2]}
        rotation={[0, -Math.atan2(bz - az, bx - ax), 0]} scale={[length, .004, .012]} raycast={noRaycast} />;
    }))}
    <group ref={root} name="Research stations" visible={false}>
      {entries.map((entry, i) => (
        <ResearchStation key={entry.id} entry={entry} slot={SLOTS[i]} kit={kit} interactive={interactive}
          selected={interactive && detailId === entry.id} hovered={hovered === entry.id}
          onPoint={point} onSelect={(id) => { setPointing(false); selectDetail(id); }} />
      ))}
    </group>
  </>;
}
