import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Html, useCursor } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { BoxGeometry, CanvasTexture, CylinderGeometry, Euler, Group, MeshStandardMaterial, PlaneGeometry, Quaternion, SRGBColorSpace, Vector3 } from "three";
import { PROJECTS, shortName, type Project, type ProjectMotif } from "../content/projects";
import { hoverDetail, phase, useHoveredDetail, useSceneTransition } from "./SceneTransition";
import BrickInstances, { type BrickPart } from "./BrickInstances";
import { CITY_NEUTRALS } from "./cityPalette";

/** Eight exhibits on the court east of the hall entrance (see the exhibition
 * court in projectsGeometry), in project order: the first four on the raised
 * rear terrace, the rest on the forecourt paving. The rear row stops short of
 * the fabrication shed, which would hide its east end from the focus camera,
 * and the front row is offset so that each rear exhibit shows through the gap
 * between two front ones along the camera's line of sight. */
const BACK = { z: .40, floor: .119 };
const FRONT = { z: .70, floor: .085 };
const SLOTS: [number, number, number][] = [
  ...[-.3, -.13, .04, .21].map((x): [number, number, number] => [x, BACK.floor, BACK.z]),
  ...[-.195, -.025, .145, .315].map((x): [number, number, number] => [x, FRONT.floor, FRONT.z]),
];
const POD = .13;
const BASE = .075;
/** Sculptures stand on the podium's cap plate. */
const TOP = BASE + .012;
const PLATE: [number, number] = [.12, .03];
const ROW_PX = 128;

type Finish = "base" | "white" | "dark" | "plate" | "accent";
type Form = "box" | "stud";
type Piece = BrickPart & { finish: Finish; form: Form };
type V3 = [number, number, number];

const box = (finish: Finish, position: V3, size: V3, rotation?: V3): Piece => ({ finish, form: "box", position, size, rotation });
/** Studs are unit cylinders: size is radius, height, radius. */
const stud = (finish: Finish, position: V3, radius: number, height: number, rotation?: V3): Piece => ({ finish, form: "stud", position, size: [radius, height, radius], rotation });
const UP = new Vector3(0, 1, 0);
function rod(finish: Finish, from: V3, to: V3, thickness = .004): Piece {
  const a = new Vector3(...from), b = new Vector3(...to);
  const direction = b.clone().sub(a);
  const turn = new Euler().setFromQuaternion(new Quaternion().setFromUnitVectors(UP, direction.clone().normalize()));
  return box(finish, a.add(b).multiplyScalar(.5).toArray(), [thickness, direction.length(), thickness], [turn.x, turn.y, turn.z]);
}

/** One small brick sculpture per project, each with its own silhouette, drawn
 * from what the project does. Off-white and charcoal carry the form; accent
 * parts glow with the exhibit. Local y = 0 is the podium's cap plate. */
const SCULPTURES: Record<ProjectMotif, () => Piece[]> = {
  // CASSIAN-AI: a dependency graph built up as a tower of module nodes over a
  // storage drum, the analysed root at the top.
  graph: () => {
    const root: V3 = [0, .142, 0];
    const mid: V3[] = [[-.03, .088, 0], [.03, .088, 0]];
    const leaves: V3[] = [[-.042, .036, -.03], [-.042, .036, .03], [.042, .036, -.03], [.042, .036, .03]];
    return [
      stud("dark", [0, .006, 0], .034, .012),
      box("white", [0, .075, 0], [.01, .14, .01]),
      stud("accent", root, .015, .018),
      ...mid.map((at) => stud("white", at, .012, .016)),
      ...leaves.map((at) => stud("white", at, .011, .014)),
      ...mid.map((at) => rod("dark", root, at)),
      ...leaves.map((at) => rod("dark", at[0] < 0 ? mid[0] : mid[1], at)),
    ];
  },
  // Crib-Eyes: a sensor arch whose eye watches a cluster of telemetry points
  // with one outlier flagged.
  lens: () => [
    ...[-.046, .046].map((x) => box("white", [x, .05, 0], [.016, .1, .022])),
    box("white", [0, .109, 0], [.112, .018, .026]),
    box("dark", [0, .089, 0], [.034, .022, .026]),
    stud("dark", [0, .072, .006], .014, .014, [Math.PI / 2, 0, 0]),
    stud("accent", [0, .072, .015], .008, .004, [Math.PI / 2, 0, 0]),
    ...[[-.025, -.015], [-.012, .005], [.004, -.012], [.016, .012], [-.004, .024], [.02, -.022]].map(([x, z]) => stud("white", [x, .004, z], .006, .008)),
    stud("accent", [.032, .005, .042], .007, .01),
  ],
  // ACADEX-AI: a timetable board of attended and missed slots, with the bunk
  // calculator at its foot.
  timetable: () => [
    ...[-.04, .04].map((x) => box("dark", [x, .025, -.01], [.008, .05, .008])),
    box("white", [0, .087, -.01], [.112, .078, .012]),
    ...[0, 1, 2].flatMap((row) => [0, 1, 2, 3].filter((col) => !(row === 1 && col === 2)).map((col) =>
      box((row * 4 + col) % 3 === 0 ? "accent" : "dark", [-.039 + col * .026, .065 + row * .022, -.002], [.021, .016, .004]))),
    box("dark", [.02, .006, .036], [.038, .012, .026]),
    stud("accent", [.031, .014, .036], .004, .004),
    ...[.011, .021].map((x) => stud("white", [x, .014, .036], .004, .004)),
  ],
  // CSnake: a low game board with the snake's linked segments and its food.
  snake: () => [
    box("dark", [0, .009, 0], [.118, .018, .086]),
    box("white", [0, .02, 0], [.09, .004, .064]),
    ...[[-3, -1], [-2, -1], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1]].map(([x, z], i, path) =>
      box(i === path.length - 1 ? "accent" : "dark", [x * .013, .026, z * .013], [.011, .008, .011])),
    stud("accent", [.039, .025, 0], .005, .008),
  ],
  // FALSE POSITIVE: the VERITAS polygraph, a housing with an articulated
  // needle arm over four channels of chart paper, one of them spiking.
  trace: () => [
    box("white", [0, .018, -.02], [.1, .036, .046]),
    box("white", [0, .004, .026], [.096, .008, .04]),
    ...[.012, .021, .039].map((z) => box("dark", [0, .0085, z], [.086, .002, .002])),
    ...[[-.043, .03], [-.025, .03], [-.017, .022], [-.009, .038], [.001, .026], [.011, .036], [.043, .03]].map(([x, z], i, points) =>
      i === 0 ? null : rod("accent", [points[i - 1][0], .0095, points[i - 1][1]], [x, .0095, z], .003)).filter((piece): piece is Piece => piece !== null),
    box("dark", [.036, .06, -.03], [.008, .048, .008]),
    stud("white", [.036, .086, -.03], .007, .01, [Math.PI / 2, 0, 0]),
    rod("dark", [.036, .086, -.03], [.004, .024, .03], .005),
    stud("accent", [.004, .018, .03], .004, .012),
  ],
  // STRATA: a satellite over a block of structures, the damaged ones knocked
  // askew and marked.
  strata: () => [
    box("dark", [0, .003, 0], [.112, .006, .1]),
    ...[-.034, 0, .034].flatMap((x) => [-.02, .024].map((z) => {
      const damaged = (x === 0 && z < 0) || (x > 0 && z > 0);
      return damaged ? box("accent", [x, .012, z], [.022, .012, .022], [.2, .5, .35]) : box("white", [x, .017, z], [.022, .022, .022]);
    })),
    box("dark", [-.048, .066, -.04], [.006, .12, .006]),
    box("white", [-.03, .136, -.03], [.024, .018, .018]),
    ...[-.068, .008].map((x) => box("dark", [x, .136, -.03], [.03, .003, .02])),
    stud("accent", [-.03, .124, -.03], .005, .006),
  ],
  // Structure Over Surface: the surface stripped to an empty frame, with the
  // syntax tree inside it.
  tree: () => {
    const edge = .007, half = .045, low = .005, high = .095;
    const root: V3 = [0, .074, 0];
    const children: V3[] = [[-.022, .046, 0], [.022, .046, 0]];
    const leaves: V3[] = [[-.032, .018, 0], [-.01, .018, 0], [.026, .018, 0]];
    return [
      ...[-half, half].flatMap((x) => [-half, half].map((z) => box("white", [x, (low + high) / 2, z], [edge, high - low, edge]))),
      ...[low, high].flatMap((y) => [-half, half].flatMap((d) => [
        box("white", [0, y, d], [2 * half + edge, edge, edge]),
        box("white", [d, y, 0], [edge, edge, 2 * half + edge]),
      ])),
      stud("accent", root, .01, .012),
      ...children.map((at) => stud("dark", at, .008, .01)),
      ...leaves.map((at) => stud("dark", at, .007, .01)),
      ...children.map((at) => rod("dark", root, at, .003)),
      rod("dark", children[0], leaves[0], .003), rod("dark", children[0], leaves[1], .003), rod("dark", children[1], leaves[2], .003),
    ];
  },
  // DRISHTI: a ring route round a small city block, a bus on the ring and a
  // plate-reading camera at the roadside.
  transit: () => {
    const ring = Array.from({ length: 16 }, (_, i) => {
      const angle = i / 16 * Math.PI * 2;
      return box("dark", [Math.cos(angle) * .046, .004, Math.sin(angle) * .046], [.02, .008, .011], [0, -angle - Math.PI / 2, 0]);
    });
    const bus = Math.PI / 4;
    return [
      ...ring,
      stud("white", [0, .002, 0], .036, .004),
      ...[[-.012, -.01, .07], [.013, -.014, .05], [-.009, .016, .04], [.015, .013, .085]].map(([x, z, h]) => box("white", [x, h / 2, z], [.016, h, .016])),
      box("accent", [Math.cos(bus) * .046, .014, Math.sin(bus) * .046], [.024, .012, .011], [0, -bus - Math.PI / 2, 0]),
      box("dark", [-.056, .026, .02], [.005, .052, .005]),
      box("dark", [-.052, .054, .02], [.014, .009, .009]),
      stud("accent", [-.044, .054, .02], .003, .004, [0, 0, Math.PI / 2]),
    ];
  },
};

/** Podium, cap plate, accent band, the backing of the title plate and a tiny
 * lamp that lights with the exhibit. */
const PODIUM: Piece[] = [
  box("dark", [0, .005, 0], [POD + .024, .01, POD + .024]),
  box("white", [0, .0115, 0], [POD + .012, .003, POD + .012]),
  box("base", [0, BASE / 2, 0], [POD, BASE, POD]),
  box("accent", [0, BASE + .002, 0], [POD + .004, .004, POD + .004]),
  box("white", [0, BASE + .008, 0], [POD - .014, .008, POD - .014]),
  box("plate", [0, BASE * .48, POD / 2 + .0015], [PLATE[0] + .006, PLATE[1] + .006, .003]),
  stud("accent", [POD / 2 - .014, TOP + .003, POD / 2 - .014], .005, .006),
];

function exhibitPieces(project: Project, [x, y, z]: V3) {
  const lift = (piece: Piece, dy: number): Piece => ({ ...piece, position: [piece.position[0] + x, piece.position[1] + y + dy, piece.position[2] + z] });
  return [...PODIUM.map((piece) => lift(piece, 0)), ...SCULPTURES[project.motif]().map((piece) => lift(piece, TOP))];
}

/** One canvas holds every title plate, a row each. */
function plateAtlas() {
  const canvas = document.createElement("canvas");
  canvas.width = ROW_PX * PLATE[0] / PLATE[1];
  canvas.height = ROW_PX * PROJECTS.length;
  const context = canvas.getContext("2d")!;
  PROJECTS.forEach((project, i) => {
    const top = i * ROW_PX;
    context.fillStyle = "#1c2124";
    context.fillRect(0, top, canvas.width, ROW_PX);
    context.fillStyle = project.accent;
    context.fillRect(canvas.width * .3, top + ROW_PX - 22, canvas.width * .4, 5);
    const name = shortName(project).toUpperCase();
    context.font = '600 60px "Helvetica Neue", Helvetica, Arial, sans-serif';
    const size = Math.min(60, 60 * (canvas.width - 44) / context.measureText(name).width);
    context.font = `600 ${size}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    context.fillStyle = "#e8eced";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(name, canvas.width / 2, top + ROW_PX * .44);
  });
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

type Kit = { box: BoxGeometry; stud: CylinderGeometry; plate: PlaneGeometry; atlas: CanvasTexture; materials: Record<Exclude<Finish, "accent">, MeshStandardMaterial> };

function Exhibit({ project, index, kit, selected, hovered, interactive, onPoint, onSelect }: {
  project: Project; index: number; kit: Kit; selected: boolean; hovered: boolean; interactive: boolean;
  onPoint: (id: string, on: boolean) => void; onSelect: (id: string) => void;
}) {
  const slot = SLOTS[index];
  const accentParts = useMemo(() => {
    const pieces = exhibitPieces(project, slot).filter((piece) => piece.finish === "accent");
    return { box: pieces.filter((piece) => piece.form === "box"), stud: pieces.filter((piece) => piece.form === "stud") };
  }, [project, slot]);
  const { accent, plate, plateGeometry } = useMemo(() => {
    const plateGeometry = kit.plate.clone();
    const uv = plateGeometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - (index + 1 - uv.getY(i)) / PROJECTS.length);
    return {
      accent: new MeshStandardMaterial({ color: project.accent, emissive: project.accent, emissiveIntensity: .14, roughness: .4 }),
      plate: new MeshStandardMaterial({ map: kit.atlas, emissiveMap: kit.atlas, emissive: "#ffffff", emissiveIntensity: .2, roughness: .55 }),
      plateGeometry,
    };
  }, [project.accent, index, kit]);
  useEffect(() => () => { accent.dispose(); plate.dispose(); plateGeometry.dispose(); }, [accent, plate, plateGeometry]);
  // Glow is animated imperatively, like the district's window material.
  const glow = useRef<{ accent: MeshStandardMaterial; plate: MeshStandardMaterial } | null>(null);
  useLayoutEffect(() => { glow.current = { accent, plate }; }, [accent, plate]);
  const invalidate = useThree((state) => state.invalidate);
  useFrame((_, delta) => {
    if (!glow.current) return;
    const k = 1 - Math.exp(-10 * Math.min(delta, .05));
    const targets: [MeshStandardMaterial, number][] = [
      [glow.current.accent, hovered ? .75 : selected ? .6 : .14],
      [glow.current.plate, hovered ? .85 : selected ? .6 : .2],
    ];
    for (const [material, target] of targets) {
      material.emissiveIntensity += (target - material.emissiveIntensity) * k;
      if (Math.abs(target - material.emissiveIntensity) > .002) invalidate();
    }
  });
  const [x, y, z] = slot;
  return <>
    {accentParts.box.length > 0 && <BrickInstances parts={accentParts.box} geometry={kit.box} material={accent} />}
    {accentParts.stud.length > 0 && <BrickInstances parts={accentParts.stud} geometry={kit.stud} material={accent} />}
    <mesh geometry={plateGeometry} material={plate} position={[x, y + BASE * .48, z + POD / 2 + .0032]} raycast={() => {}} />
    {interactive && <mesh position={[x, y + .12, z]} name={`Exhibit ${project.id}`}
      onPointerOver={(event) => { event.stopPropagation(); onPoint(project.id, true); }}
      onPointerOut={() => onPoint(project.id, false)}
      onClick={(event) => { event.stopPropagation(); onSelect(project.id); }}>
      <boxGeometry args={[POD + .01, .24, POD + .01]} />
      <meshBasicMaterial visible={false} />
    </mesh>}
    {interactive && hovered && !selected && (
      <Html position={[x, y + .29, z]} center style={{ pointerEvents: "none" }}>
        <div className="project-bay-label"><strong>{shortName(project)}</strong><span>{project.technologies.slice(0, 2).join(" · ")}</span></div>
      </Html>
    )}
  </>;
}

/** The Projects exhibition court: one exhibit per project. They rise out of
 * the paving when the section opens and sink back when it closes. Pointing at an exhibit and at its selector entry set the same shared
 * hover, and both select through the same `selectDetail`. */
export default function ProjectBays() {
  const { mode, progressOf, detailId, selectDetail } = useSceneTransition();
  const hoveredDetailId = useHoveredDetail();
  const gl = useThree((state) => state.gl);
  const kit = useMemo<Kit>(() => {
    const atlas = plateAtlas();
    atlas.anisotropy = gl.capabilities.getMaxAnisotropy();
    return {
      box: new BoxGeometry(1, 1, 1),
      stud: new CylinderGeometry(1, 1, 1, 16),
      plate: new PlaneGeometry(...PLATE),
      atlas,
      materials: {
        base: new MeshStandardMaterial({ color: CITY_NEUTRALS.structural, roughness: .4 }),
        white: new MeshStandardMaterial({ color: CITY_NEUTRALS.offWhite, roughness: .3 }),
        dark: new MeshStandardMaterial({ color: CITY_NEUTRALS.charcoal, roughness: .35 }),
        plate: new MeshStandardMaterial({ color: "#1c2124", roughness: .5 }),
      },
    };
  }, [gl]);
  useEffect(() => () => {
    kit.box.dispose(); kit.stud.dispose(); kit.plate.dispose(); kit.atlas.dispose();
    Object.values(kit.materials).forEach((material) => material.dispose());
  }, [kit]);
  // Shared finishes for all eight exhibits render as one batch per finish and form.
  const shared = useMemo(() => {
    const batches = new Map<string, { finish: Exclude<Finish, "accent">; form: Form; parts: BrickPart[] }>();
    PROJECTS.forEach((project, i) => exhibitPieces(project, SLOTS[i]).forEach(({ finish, form, ...part }) => {
      if (finish === "accent") return;
      const key = `${finish}-${form}`;
      if (!batches.has(key)) batches.set(key, { finish, form, parts: [] });
      batches.get(key)!.parts.push(part);
    }));
    return [...batches.entries()];
  }, []);

  const interactive = mode === "projects";
  const hovered = interactive ? hoveredDetailId : null;
  const [pointing, setPointing] = useState(false);
  useCursor(interactive && pointing);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => { invalidate(); }, [hovered, detailId, invalidate]);
  const point = (id: string, on: boolean) => {
    setPointing(on);
    hoverDetail((current) => on ? id : current === id ? null : current);
  };

  const root = useRef<Group>(null);
  useFrame(() => {
    if (!root.current) return;
    const progress = progressOf("projects");
    const up = phase(progress, .82, 1);
    root.current.visible = up > 0;
    root.current.position.y = -.14 * (1 - up);
  });

  return (
    <group ref={root} name="Project exhibits" visible={false}>
      {shared.map(([key, batch]) => <BrickInstances key={key} parts={batch.parts} geometry={batch.form === "box" ? kit.box : kit.stud} material={kit.materials[batch.finish]} />)}
      {PROJECTS.slice(0, SLOTS.length).map((project, i) => (
        <Exhibit key={project.id} project={project} index={i} kit={kit} interactive={interactive}
          selected={detailId === project.id} hovered={hovered === project.id}
          onPoint={point} onSelect={(id) => { setPointing(false); selectDetail(id); }} />
      ))}
    </group>
  );
}
