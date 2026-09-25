import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useDecorativeLights } from "./quality";
import { useFrame, useThree } from "@react-three/fiber";
import { CanvasTexture, Group, InstancedMesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, PlaneGeometry, SRGBColorSpace } from "three";
import { paintBuildPassed, paintManuscript } from "./roomAssets/framedArt";
import { createRoomDecorKit, type DecorFinish, type RoomDecorKit } from "./roomDecorKit";
import { BEDSIDE_AT, DESK_AT, GLASS_WALL, METRE, PLANT_AT, ROOM, SHELF_AT, WARDROBE_AT, type Anchor } from "./roomLayout";
import { CITY_GROUP_POSITION, TABLETOP_Y } from "./districtLayout";
import { TABLE_HALF } from "./cityMasterplan";
import { Piece, useAssembled } from "./roomAssets/RoomSurfaces";
import { Assembly, bevelBox, type Vec3 } from "./roomAssets/shapes";
import { buildBedsideLamp, buildDeskLamp } from "./roomAssets/furniture";
import { buildPlant } from "./roomAssets/architecture";
import { RoomPulseTarget, RoomSwitch, useSwitchedLamp } from "./RoomSwitches";
import { usePulse } from "./roomInteractions";
import { discover } from "../room/discovery";

type Vector = [number, number, number];
type DecorPiece = { at: Vector; size: Vector; turn?: Vector; finish: DecorFinish };
type Props = { kit: RoomDecorKit };

const noRaycast = () => {};

function Solid({ kit, finish, size, at, turn }: Props & Omit<DecorPiece, "finish"> & { finish: DecorFinish }) {
  return <mesh geometry={kit.box} material={kit.materials[finish]} scale={size} position={at} rotation={turn} castShadow receiveShadow dispose={null} raycast={noRaycast} />;
}
function Rod({ kit, finish, size, at, turn }: Props & Omit<DecorPiece, "finish"> & { finish: DecorFinish }) {
  return <mesh geometry={kit.rod} material={kit.materials[finish]} scale={size} position={at} rotation={turn} castShadow receiveShadow dispose={null} raycast={noRaycast} />;
}
function Ball({ kit, finish, size, at }: Props & Omit<DecorPiece, "finish"> & { finish: DecorFinish }) {
  return <mesh geometry={kit.ball} material={kit.materials[finish]} scale={size} position={at} castShadow receiveShadow dispose={null} raycast={noRaycast} />;
}

/** Repeated small props — books, loose bricks, tray stock — collapse to one draw
 * call per finish instead of one per object. */
function Batch({ kit, finish, pieces }: Props & { finish: DecorFinish; pieces: DecorPiece[] }) {
  const mesh = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const transform = new Object3D();
    pieces.forEach((piece, i) => {
      transform.position.set(...piece.at);
      transform.scale.set(...piece.size);
      transform.rotation.set(...(piece.turn ?? [0, 0, 0]));
      transform.updateMatrix();
      mesh.current!.setMatrixAt(i, transform.matrix);
    });
    mesh.current!.instanceMatrix.needsUpdate = true;
    mesh.current!.computeBoundingSphere();
  }, [pieces]);
  return <instancedMesh ref={mesh} args={[kit.box, kit.materials[finish], pieces.length]} castShadow receiveShadow dispose={null} raycast={noRaycast} />;
}
function Cluster({ kit, pieces }: Props & { pieces: DecorPiece[] }) {
  const grouped = useMemo(() => {
    const byFinish = new Map<DecorFinish, DecorPiece[]>();
    for (const piece of pieces) {
      const list = byFinish.get(piece.finish) ?? [];
      list.push(piece);
      byFinish.set(piece.finish, list);
    }
    return [...byFinish.entries()];
  }, [pieces]);
  return <>{grouped.map(([finish, list]) => <Batch key={finish} kit={kit} finish={finish} pieces={list} />)}</>;
}

// ---------------------------------------------------------------------------
// Authored contents, all in the local metres of the piece they sit on.
// ---------------------------------------------------------------------------

const BOOK_TONES: DecorFinish[] = ["bookA", "bookB", "bookC", "bookD", "bookE"];

/** A run of upright spines with two leaners, so no shelf reads as a repeated array. */
function shelfBooks(y: number, from: number, specs: [number, number][], lean = -1): DecorPiece[] {
  const pieces: DecorPiece[] = [];
  let x = from;
  specs.forEach(([width, height], i) => {
    const tilt = i === lean ? .16 : 0;
    pieces.push({
      finish: BOOK_TONES[(i * 3 + specs.length) % BOOK_TONES.length],
      size: [width, height, .21],
      at: [x + width / 2 + (tilt ? height * .07 : 0), y + height / 2, .012],
      turn: tilt ? [0, 0, tilt] : undefined,
    });
    x += width + (tilt ? .026 : .006);
  });
  return pieces;
}

const SHELF_PIECES: DecorPiece[] = [
  ...shelfBooks(.071, -.345, [[.030, .216], [.024, .198], [.038, .232], [.026, .188], [.033, .222], [.022, .204], [.036, .238]], 4),
  { finish: "card", size: [.150, .120, .215], at: [.230, .131, .012] },
  { finish: "slate", size: [.152, .016, .217], at: [.230, .197, .012] },
  ...shelfBooks(.411, -.340, [[.034, .210], [.028, .226], [.024, .190], [.036, .206], [.030, .234]], 2),
  { finish: "card", size: [.170, .140, .220], at: [.180, .481, .012] },
  { finish: "leather", size: [.056, .030, .170], at: [.180, .566, .012], turn: [0, .10, 0] },
  // Shelf three carries the chess set; see ChessSet below for the board and pieces.
  { finish: "bookC", size: [.140, .028, .190], at: [-.270, .765, .014] },
  { finish: "bookA", size: [.132, .026, .182], at: [-.270, .792, .020], turn: [0, .09, 0] },
  { finish: "card", size: [.155, .135, .215], at: [-.250, 1.159, .012] },
  { finish: "card", size: [.135, .115, .200], at: [-.080, 1.149, .012] },
  { finish: "slate", size: [.137, .015, .202], at: [-.080, 1.214, .012] },
];

/** A small brick-built keepsake: the same vocabulary as the table, shelf-scale. */
const SHELF_MODEL: DecorPiece[] = [
  { finish: "brickBlue", size: [.120, .030, .090], at: [.215, .766, .010] },
  { finish: "brickSand", size: [.090, .030, .070], at: [.205, .796, .006] },
  { finish: "brickRed", size: [.060, .030, .060], at: [.226, .826, .014] },
  { finish: "brickBlue", size: [.036, .030, .036], at: [.212, .856, .010] },
  { finish: "brickRed", size: [.150, .028, .110], at: [.060, 1.447, .008] },
  { finish: "brickSand", size: [.100, .028, .080], at: [.070, 1.475, .004] },
  { finish: "brickBlue", size: [.054, .028, .054], at: [.048, 1.503, .010] },
];

/** Stock beside the model table: a compartment tray, a sheet and a few loose parts. */
const TRAY_STOCK: DecorPiece[] = [
  { finish: "brickRed", size: [.052, .030, .034], at: [-.145, .034, -.058] },
  { finish: "brickRed", size: [.034, .030, .034], at: [-.085, .034, -.062] },
  { finish: "brickBlue", size: [.048, .030, .032], at: [-.140, .034, .056] },
  { finish: "brickBlue", size: [.032, .030, .032], at: [-.082, .034, .050], turn: [0, .3, 0] },
  { finish: "brickSand", size: [.046, .030, .032], at: [.062, .034, -.056] },
  { finish: "brickSand", size: [.030, .030, .030], at: [.118, .034, -.050], turn: [0, -.2, 0] },
  { finish: "steel", size: [.040, .024, .028], at: [.070, .031, .054] },
  { finish: "steel", size: [.026, .024, .026], at: [.124, .031, .058], turn: [0, .4, 0] },
];

const LOOSE_BRICKS: DecorPiece[] = [
  { finish: "brickRed", size: [.062, .036, .040], at: [-.62, .018, .10], turn: [0, .28, 0] },
  { finish: "brickBlue", size: [.044, .036, .040], at: [-.48, .018, -.06], turn: [0, -.44, 0] },
  { finish: "brickSand", size: [.058, .036, .038], at: [-1.02, .018, .04], turn: [0, .12, 0] },
  { finish: "brickBlue", size: [.038, .036, .038], at: [-.90, .018, -.10], turn: [0, .62, 0] },
  { finish: "steel", size: [.050, .030, .036], at: [-1.24, .015, -.02], turn: [0, -.18, 0] },
  { finish: "brickRed", size: [.036, .036, .036], at: [.42, .018, -.11], turn: [0, .5, 0] },
  { finish: "brickSand", size: [.046, .018, .040], at: [.34, .009, .09], turn: [0, -.3, 0] },
];

// ---------------------------------------------------------------------------

/** The glass wall's curtain track. */
function buildCurtains() {
  const left = GLASS_WALL.centre - GLASS_WALL.width / 2, right = GLASS_WALL.centre + GLASS_WALL.width / 2;
  const trackY = ROOM.ceiling - .2, trackZ = ROOM.back + .24;
  const curtains = new Assembly();
  // The ceiling track the curtains run on (see GlassCurtains), the width of the
  // glass and a little more.
  curtains.add("blackSteel", bevelBox([right - left + 1.2, .035, .05], .008), [GLASS_WALL.centre, trackY, trackZ]);
  return curtains.build();
}

function buildRug() {
  const rug = new Assembly();
  // Flat-woven rug with a border band and an inner keyline.
  rug.add("rugBorder", bevelBox([5.6, .016, 2.8], .008), [0, .008, 0]);
  rug.add("rug", bevelBox([5.24, .018, 2.44], .006), [0, .009, 0]);
  for (const [w, d] of [[4.9, 2.1], [4.86, 2.06]]) {
    rug.add("rugBorder", bevelBox([w, .0185, .012], .004), [0, .0092, d / 2]);
    rug.add("rugBorder", bevelBox([w, .0185, .012], .004), [0, .0092, -d / 2]);
    rug.add("rugBorder", bevelBox([.012, .0185, d], .004), [w / 2, .0092, 0]);
    rug.add("rugBorder", bevelBox([.012, .0185, d], .004), [-w / 2, .0092, 0]);
  }
  return rug.build();
}

/** A small set mid-game on the shelf: recognisable at a glance, readable up close. */
function ChessSet({ kit }: Props) {
  const board = .20, y = .751;
  const men: [number, number, number, DecorFinish][] = [
    [-.060, -.055, .052, "boardLight"], [-.020, -.020, .046, "boardLight"], [.038, -.058, .044, "boardLight"],
    [.058, .048, .052, "boardDark"], [.006, .028, .070, "boardDark"], [-.052, .054, .044, "boardDark"],
  ];
  return (
    <group name="chess" position={[-.025, y, .020]} rotation={[0, .12, 0]}>
      <Solid kit={kit} finish="boardDark" size={[board + .018, .014, board + .018]} at={[0, .007, 0]} />
      <mesh geometry={kit.box} material={kit.printMaterials.board} scale={[board, .004, board]} position={[0, .016, 0]} dispose={null} raycast={noRaycast} />
      {men.map(([x, z, h, finish]) => (
        <group key={`${x}:${z}`} position={[x, .018, z]}>
          <Rod kit={kit} finish={finish} size={[.020, .008, .020]} at={[0, .004, 0]} />
          <Rod kit={kit} finish={finish} size={[.013, h - .016, .013]} at={[0, .008 + (h - .016) / 2, 0]} />
          <Ball kit={kit} finish={finish} size={[.017, .017, .017]} at={[0, h - .004, 0]} />
        </group>
      ))}
    </group>
  );
}

/** Desk props: a notebook and pen, and a mug. */
function DeskProps({ kit }: Props) {
  return (
    <group name="desk props">
      <Solid kit={kit} finish="leather" size={[.205, .017, .265]} at={[-.50, .747, .145]} turn={[0, .07, 0]} />
      <Solid kit={kit} finish="paper" size={[.190, .009, .250]} at={[-.498, .757, .146]} turn={[0, .07, 0]} />
      <Rod kit={kit} finish="lampMetal" size={[.009, .132, .009]} at={[-.47, .768, .030]} turn={[Math.PI / 2, 0, .34]} />
      <Rod kit={kit} finish="paper" size={[.080, .098, .080]} at={[.470, .789, .175]} />
      <Rod kit={kit} finish="paper" size={[.062, .086, .062]} at={[.470, .795, .175]} />
      <Solid kit={kit} finish="paper" size={[.016, .046, .012]} at={[.470, .795, .222]} />
    </group>
  );
}

/** The builder's corner of the table: a compartment tray, a folded sheet, a
 * separator tool and a handful of loose parts. Nothing overhangs the city. */
function ModelBench({ kit }: Props) {
  const pieces = useMemo(() => TRAY_STOCK, []);
  const loose = useMemo(() => LOOSE_BRICKS, []);
  return (
    <group name="model bench" position={[CITY_GROUP_POSITION[0] + 4.3, TABLETOP_Y, CITY_GROUP_POSITION[2] + TABLE_HALF.z - .25]}>
      <group rotation={[0, .14, 0]}>
        <Solid kit={kit} finish="slate" size={[.460, .016, .300]} at={[0, .008, 0]} />
        {[-.230, .230].map((x) => <Solid key={x} kit={kit} finish="slate" size={[.014, .044, .300]} at={[x, .030, 0]} />)}
        {[-.150, .150].map((z) => <Solid key={z} kit={kit} finish="slate" size={[.460, .044, .014]} at={[0, .030, z]} />)}
        <Solid kit={kit} finish="slate" size={[.012, .036, .286]} at={[-.010, .026, 0]} />
        <Solid kit={kit} finish="slate" size={[.446, .036, .012]} at={[0, .026, 0]} />
        <Cluster kit={kit} pieces={pieces} />
      </group>
      <group position={[-.86, 0, .04]} rotation={[0, -.22, 0]}>
        <Solid kit={kit} finish="paper" size={[.340, .006, .260]} at={[0, .003, 0]} />
        <Solid kit={kit} finish="slate" size={[.300, .002, .010]} at={[0, .007, -.080]} />
        <Solid kit={kit} finish="slate" size={[.190, .002, .008]} at={[-.050, .007, -.052]} />
        <Solid kit={kit} finish="brickBlue" size={[.120, .003, .088]} at={[.070, .007, .050]} />
      </group>
      <group position={[-1.44, 0, .08]} rotation={[0, .36, 0]}>
        <Solid kit={kit} finish="brickSand" size={[.140, .022, .046]} at={[0, .011, 0]} />
        <Solid kit={kit} finish="brickSand" size={[.060, .012, .042]} at={[.092, .008, 0]} turn={[0, 0, -.16]} />
      </group>
      <Cluster kit={kit} pieces={loose} />
    </group>
  );
}

/** The top sheet on the bedside is a handwritten draft, and the phone's lock
 * screen reports a passing build. */
function BedsideNotes() {
  const pages = useMemo(() => {
    const texture = (canvas: HTMLCanvasElement) => { const map = new CanvasTexture(canvas); map.colorSpace = SRGBColorSpace; map.anisotropy = 4; return map; };
    const manuscript = texture(paintManuscript()), screen = texture(paintBuildPassed());
    return {
      plane: new PlaneGeometry(1, 1), manuscript, screen,
      paper: new MeshStandardMaterial({ map: manuscript, roughness: .92 }),
      glow: new MeshBasicMaterial({ map: screen, toneMapped: false, color: "#9aa0a8" }),
    };
  }, []);
  useEffect(() => () => { Object.values(pages).forEach((resource) => resource.dispose()); }, [pages]);
  return (
    <>
      <mesh geometry={pages.plane} material={pages.paper} position={[.108, .5286, .050]} rotation={[-Math.PI / 2, 0, .22]} scale={[.112, .152, 1]} receiveShadow raycast={noRaycast} />
      <mesh geometry={pages.plane} material={pages.glow} position={[.13, .5132, -.1]} rotation={[-Math.PI / 2, 0, -.35]} scale={[.058, .134, 1]} raycast={noRaycast} />
    </>
  );
}

const RUG_AT: Vec3 = [CITY_GROUP_POSITION[0] + .3, ROOM.floor, 8.0];
const FOOTBALL: Vec3 = [ROOM.left + 2.77, ROOM.floor + .190, 1.3];
const HOP_SECONDS = 1.4;

/** The football, which hops twice and rolls a little way out and back when nudged. */
function Football({ kit }: Props) {
  const ball = useRef<Group>(null);
  const hops = usePulse("football");
  const invalidate = useThree((state) => state.invalidate);
  const run = useRef({ start: -1, seen: 0 });
  useEffect(() => { if (hops) { discover("football"); invalidate(); } }, [hops, invalidate]);
  useFrame((state) => {
    const r = run.current, group = ball.current;
    if (!group) return;
    if (hops !== r.seen) { r.seen = hops; r.start = state.clock.elapsedTime; }
    if (r.start < 0) return;
    const t = (state.clock.elapsedTime - r.start) / HOP_SECONDS;
    if (t >= 1) { group.position.set(0, 0, 0); group.rotation.set(0, 0, 0); r.start = -1; invalidate(); return; }
    const roll = Math.sin(t * Math.PI) * .35;
    group.position.set(roll, Math.abs(Math.sin(t * Math.PI * 2)) * (1 - t) * .45, 0);
    group.rotation.z = -roll / .19;
    invalidate();
  });
  return (
    <group position={FOOTBALL}>
      <group ref={ball}>
        <Ball kit={kit} finish="ballShell" size={[.380, .380, .380]} at={[0, 0, 0]} />
        {[[0, .152, .062], [.146, -.048, .058], [-.120, -.088, .052], [-.020, .020, .070]].map(([x, y, r], i) => (
          <Ball key={i} kit={kit} finish="ballMark" size={[r, r, r]} at={[x, y, Math.sqrt(Math.max(.0001, .0342 - x * x - y * y))]} />
        ))}
      </group>
    </group>
  );
}

/** Furniture-local metres to world, through an anchor's turn and the METRE scale. */
function toWorld({ at, turn }: Anchor, [x, y, z]: Vec3): Vec3 {
  const c = Math.cos(turn), s = Math.sin(turn);
  return [at[0] + (x * c + z * s) * METRE, at[1] + ROOM.floor + y * METRE, at[2] + (-x * s + z * c) * METRE];
}

/** Everything the phase adds that is not part of the approved furniture itself. */
export default function RoomDecor() {
  const kit = useMemo(() => createRoomDecorKit(), []);
  const root = useRef<Group>(null);
  const shelfPieces = useMemo(() => SHELF_PIECES, []);
  const shelfModel = useMemo(() => SHELF_MODEL, []);
  const deskLamp = useMemo(() => buildDeskLamp(), []);
  const bedsideLamp = useMemo(() => buildBedsideLamp(), []);
  const deskLampParts = useAssembled(() => deskLamp.geometry);
  const bedsideLampParts = useAssembled(() => bedsideLamp.geometry);
  const [bedsideShade, bedsideLightRef] = useSwitchedLamp("bedsideLamp", 1.7);
  const lamps = useDecorativeLights();
  const curtains = useAssembled(buildCurtains);
  const rug = useAssembled(buildRug);
  const plant = useAssembled(buildPlant);
  useEffect(() => () => kit.dispose(), [kit]);
  useLayoutEffect(() => {
    // Decoration is scenery: it must never win a pointer test from a city district.
    root.current?.traverse((object) => { object.raycast = noRaycast; });
  }, []);
  return (
    <>
    <group name="room-decor" ref={root}>
      {/* One quiet rug in the walking space, clear of the model table. */}
      <Piece name="rug" parts={rug} at={RUG_AT} turn={.03} />
      <Piece name="curtains" parts={curtains} />
      <ModelBench kit={kit} />

      <group position={SHELF_AT.at} rotation={[0, SHELF_AT.turn, 0]} scale={METRE}>
        <Cluster kit={kit} pieces={shelfPieces} />
        <Cluster kit={kit} pieces={shelfModel} />
        <ChessSet kit={kit} />
      </group>

      <group position={[DESK_AT.at[0], ROOM.floor, DESK_AT.at[2]]} rotation={[0, DESK_AT.turn, 0]} scale={METRE}>
        <DeskProps kit={kit} />
        <Piece name="desk lamp" parts={deskLampParts} />
      </group>

      <group position={[BEDSIDE_AT.at[0], ROOM.floor, BEDSIDE_AT.at[2]]} rotation={[0, BEDSIDE_AT.turn, 0]} scale={METRE}>
        <Piece name="bedside lamp" parts={bedsideLampParts} overrides={bedsideShade} />
        <Solid kit={kit} finish="bookB" size={[.130, .020, .170]} at={[.108, .510, .050]} turn={[0, .22, 0]} />
        <Solid kit={kit} finish="paper" size={[.118, .009, .158]} at={[.108, .524, .050]} turn={[0, .22, 0]} />
        <BedsideNotes />
      </group>

      <group position={WARDROBE_AT.at} rotation={[0, WARDROBE_AT.turn, 0]} scale={METRE}>
        <Solid kit={kit} finish="card" size={[.500, .230, .350]} at={[.230, 2.165, 0]} />
        <Solid kit={kit} finish="slate" size={[.504, .022, .354]} at={[.230, 2.290, 0]} />
      </group>

      {/* One football, resting on the floor where the bed meets the walkway. */}
      <Football kit={kit} />

      {/* One plant, in the gap between the shelving and the desk. */}
      <Piece name="plant" parts={plant} at={[PLANT_AT.at[0], ROOM.floor, PLANT_AT.at[2]]} turn={PLANT_AT.turn} scale={METRE} />

      {/* Two short-range warm practicals at their bulbs. Neither reaches the model table's key. */}
      <pointLight visible={lamps} position={toWorld(DESK_AT, deskLamp.bulb)} intensity={1.9} distance={2.4} decay={2} color="#ffca8a" />
      <pointLight visible={lamps} ref={bedsideLightRef} position={toWorld(BEDSIDE_AT, bedsideLamp.bulb)} intensity={1.7} distance={2.5} decay={2} color="#ffbe78" />
    </group>
    <RoomPulseTarget name="football" pulse="football" at={FOOTBALL} radius={.3} from={["personal", "display"]} />
    <RoomSwitch name="bedside lamp switch" toggle="bedsideLamp" at={toWorld(BEDSIDE_AT, bedsideLamp.bulb)} radius={.32} from={["personal"]} />
    </>
  );
}
